import { prisma } from '@/lib/db';
import { runAnalysisEngine } from '@/lib/stock-analysis/analysis-engine';
import { 
  runLearningPipeline, 
  getLearnedKnowledge, 
  saveKnowledgeToDB 
} from '@/lib/stock-analysis/ai-learning';
import type { 
  InvestmentStyle, 
  LearnedKnowledge 
} from '@/types/stock-analysis';

// 분석 작업 상태 관리를 위한 인메모리 맵
export const userAnalysisJobs = (global as any).userAnalysisJobs || new Map<string, {
  status: 'processing' | 'completed' | 'error';
  result?: any;
  error?: string;
  startedAt: Date;
}>();
(global as any).userAnalysisJobs = userAnalysisJobs;

const planLimits: Record<string, { weeklyAnalysisLimit: number }> = {
  FREE: { weeklyAnalysisLimit: 1 },
  STANDARD: { weeklyAnalysisLimit: 7 },
  PREMIUM: { weeklyAnalysisLimit: 10 },
  MASTER: { weeklyAnalysisLimit: -1 },
};

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export class StockService {
  /**
   * 사용자의 이번 주 분석 가능 횟수를 체크합니다.
   */
  static async checkAnalysisLimit(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, email: true }
    });

    if (!user) throw new Error('사용자를 찾을 수 없습니다.');

    const isMaster = user.email === 'pluss2.jh@gmail.com';
    const effectivePlan = isMaster ? 'MASTER' : user.plan;
    const planConfig = planLimits[effectivePlan] || planLimits.FREE;

    if (planConfig.weeklyAnalysisLimit === -1) return { allowed: true };

    const weekStart = getWeekStart(new Date());
    const usage = await prisma.analysisUsage.findUnique({
      where: { userId_weekStart: { userId, weekStart } }
    });

    const currentCount = usage?.count || 0;
    if (currentCount >= planConfig.weeklyAnalysisLimit) {
      return { 
        allowed: false, 
        limit: planConfig.weeklyAnalysisLimit, 
        used: currentCount 
      };
    }

    return { allowed: true, limit: planConfig.weeklyAnalysisLimit, used: currentCount };
  }

  /**
   * 주식 분석을 시작합니다 (백그라운드 실행).
   */
  static async startAnalysis(userId: string, options: {
    conditions?: { periodMonths?: number; companyCount?: number; companyAiModel?: string; companyApiKey?: string; newsAiModel?: string; newsApiKey?: string; sector?: string; strategyType?: 'growth' | 'value' | 'all' };
    style?: InvestmentStyle;
  }) {
    // 1. 제한 확인
    const limitCheck = await this.checkAnalysisLimit(userId);
    if (!limitCheck.allowed) {
      throw new Error(`이번 주 분석 횟수(${limitCheck.limit})를 모두 사용했습니다.`);
    }

    // 2. 학습된 지식 확인
    const knowledge = await getLearnedKnowledge();
    if (!knowledge) {
      throw new Error('학습된 데이터가 없습니다. 먼저 Google Drive 동기화 후 학습을 시작해주세요.');
    }

    // 3. 작업 상태 등록
    userAnalysisJobs.set(userId, {
      status: 'processing',
      startedAt: new Date()
    });

    // 4. 백그라운드 엔진 실행 (비동기)
    runAnalysisEngine(
      { 
        amount: 0, 
        periodMonths: options.conditions?.periodMonths || 12, 
        sector: options.conditions?.sector, 
        strategyType: options.conditions?.strategyType 
      },
      knowledge,
      options.style || 'moderate',
      options.conditions?.companyCount || 5,
      options.conditions?.companyAiModel,
      options.conditions?.companyApiKey,
      options.conditions?.newsAiModel,
      options.conditions?.newsApiKey
    ).then(async (result) => {
      // 성공 시 사용량 카운트 업
      await this.incrementAnalysisUsage(userId);
      
      userAnalysisJobs.set(userId, {
        status: 'completed',
        result,
        startedAt: new Date()
      });
    }).catch((error) => {
      console.error('Service analysis error:', error);
      userAnalysisJobs.set(userId, {
        status: 'error',
        error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
        startedAt: new Date()
      });
    });

    return { status: 'started' };
  }

  /**
   * 분석 사용 횟수를 1 증가시킵니다.
   */
  private static async incrementAnalysisUsage(userId: string) {
    const weekStart = getWeekStart(new Date());
    await prisma.analysisUsage.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: { userId, weekStart, count: 1 },
      update: { count: { increment: 1 } }
    });
  }

  /**
   * AI 학습 파이프라인을 실행하고 결과를 DB에 저장합니다.
   */
  static async runLearning(options: {
    fileIds?: string[];
    aiModels?: Record<string, string>;
    title?: string;
  }) {
    const knowledge = await runLearningPipeline(options.fileIds, options.aiModels);
    const knowledgeId = await saveKnowledgeToDB(knowledge, options.title);
    
    return {
      id: knowledgeId,
      knowledge,
      totalRules: this.countTotalRules(knowledge)
    };
  }

  /**
   * 현재 활성화된 지식 정보를 요약하여 반환합니다.
   */
  static async getActiveKnowledgeSummary() {
    const activeKnowledge = await prisma.learnedKnowledge.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (activeKnowledge) {
      const content = activeKnowledge.content as any;
      return {
        exists: true,
        title: activeKnowledge.title,
        filesAnalyzed: content.fileAnalyses?.length || 0,
        rulesLearned: this.countTotalRules(content),
        learnedAt: activeKnowledge.createdAt,
      };
    }

    // Fallback to local
    const localKnowledge = await getLearnedKnowledge();
    if (localKnowledge) {
      return {
        exists: true,
        title: '시스템 로컬 데이터',
        filesAnalyzed: localKnowledge.fileAnalyses.length,
        rulesLearned: this.countTotalRules(localKnowledge),
        learnedAt: localKnowledge.learnedAt,
      };
    }

    return { exists: false };
  }

  private static countTotalRules(knowledge: any) {
    const criteria = knowledge.criteria;
    if (!criteria) return 0;
    return (
      (criteria.goodCompanyRules?.length || 0) +
      (criteria.technicalRules?.length || 0) +
      (criteria.marketSizeRules?.length || 0) +
      (criteria.unitEconomicsRules?.length || 0) +
      (criteria.lifecycleRules?.length || 0) +
      (criteria.buyTimingRules?.length || 0)
    );
  }
}
