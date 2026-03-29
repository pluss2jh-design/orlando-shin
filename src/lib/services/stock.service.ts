import { prisma } from '@/lib/db';
import { runAnalysisEngine } from '@/lib/stock-analysis/analysis-engine';
import {
  runLearningPipeline,
  getLearnedKnowledge,
  saveKnowledgeToDB
} from '@/lib/stock-analysis/ai-learning';
import type {
  InvestmentStyle,
  LearnedKnowledge,
  RecommendationResult,
  LearnedInvestmentCriteria,
  ExcludedStockDetail
} from '@/types/stock-analysis';


interface AnalysisJobStatus {
  status: 'processing' | 'completed' | 'error';
  result?: RecommendationResult;
  error?: string;
  startedAt: Date;
  progress?: number;
  progressMessage?: string;
  excludedStockCount?: number;
  excludedDetails?: ExcludedStockDetail[];
  processedCount?: number;
  universeCounts?: {
    russellCount: number;
    sp500Count: number;
    overlapCount: number;
  };
  isCancelled?: boolean;
}




declare global {
  // eslint-disable-next-line no-var
  var userAnalysisJobs: Map<string, AnalysisJobStatus> | undefined;
}

export const userAnalysisJobs = globalThis.userAnalysisJobs || new Map<string, AnalysisJobStatus>();
globalThis.userAnalysisJobs = userAnalysisJobs;

/** Prisma JSON 필드에서 조회한 지식 콘텐츠 구조 */
interface KnowledgeContentShape {
  fileAnalyses?: { fileName: string; keyConditions: string[] }[];
  criteria?: {
    goodCompanyRules?: unknown[];
    technicalRules?: unknown[];
    marketSizeRules?: unknown[];
    unitEconomicsRules?: unknown[];
    lifecycleRules?: unknown[];
    buyTimingRules?: unknown[];
  };
  strategy?: unknown;
  learnedAt?: Date;
}

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

    const isMaster = user.email === process.env.ADMIN_EMAIL;
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
   * 분석을 시작합니다 (백그라운드 실행).
   */
  static async startAnalysis(userId: string, options: {
    conditions?: { 
      companyCount?: number; 
      newsAiModel?: string; 
      newsApiKey?: string; 
      sector?: string; 
      strategyType?: 'growth' | 'value' | 'all'; 
      asOfDate?: string | Date; 
      excludeSP500?: boolean;
      universeType?: 'sp500' | 'russell1000' | 'russell1000_exclude_sp500';
    };
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
      startedAt: new Date(),
      progress: 1, // 0%에서 멈춘 것처럼 보이지 않게 즉시 1%로 시작
      progressMessage: '분석 엔진 초기화 중...',
      isCancelled: false
    });

    // 4. 백그라운드 엔진 실행 (비동기 - fire & forget)
    console.log(`[StockService] Handing off analysis to engine for user: ${userId}`);
    // 분석 백그라운드 태스크 시작
    (async () => {
      console.log(`[StockService] Engine background task started for user: ${userId}`);
      try {
        // 이미 route.ts에서 nested 구조로 정규화해서 옴
        const conditions = options.conditions || (options as any);
        console.log(`[StockService] Transmitting conditions to engine:`, JSON.stringify(conditions));

        const result = await runAnalysisEngine(
          {
            ...conditions,
            amount: 0, // 기본값 강제
            asOfDate: conditions?.asOfDate ? new Date(conditions.asOfDate) : undefined,
          },
          knowledge,
          options.style || 'moderate',
          conditions?.companyCount || 5,
          conditions?.newsAiModel,
          conditions?.newsApiKey,
          (progress: number, message: string, meta?: any) => {
            const currentJob = userAnalysisJobs.get(userId);
            if (currentJob && currentJob.status === 'processing') {
              if (currentJob.isCancelled) {
                throw new Error('STOPPED_BY_USER');
              }
              userAnalysisJobs.set(userId, {
                ...currentJob,
                progress,
                progressMessage: message,
                excludedStockCount: meta?.excludedStockCount || currentJob.excludedStockCount,
                excludedDetails: meta?.excludedDetails || currentJob.excludedDetails,
              });
            }
          }


        );

        // 성공 시 사용량 카운트 업 및 개별 리포트 저장
        await Promise.all([
          StockService.incrementAnalysisUsage(userId),
          StockService.saveAnalysisReports(userId, result.topPicks, result.investmentConditions)
        ]);

        userAnalysisJobs.set(userId, {
          status: 'completed',
          result,
          startedAt: new Date(),
          excludedStockCount: result.excludedStockCount,
          excludedDetails: result.excludedDetails,
          universeCounts: result.universeCounts
        });


      } catch (error) {
        if (error instanceof Error && error.message === 'STOPPED_BY_USER') {
          console.log(`[StockService] Analysis manually stopped by user: ${userId}`);
          userAnalysisJobs.set(userId, {
            status: 'error',
            error: '사용자에 의해 분석이 중단되었습니다.',
            startedAt: new Date(),
            isCancelled: true
          });
          return;
        }

        console.error('분석 엔진 오류:', error);
        userAnalysisJobs.set(userId, {
          status: 'error',
          error: error instanceof Error ? error.message : '분석 중 오류가 발생했습니다.',
          startedAt: new Date()
        });
      }
    })();

    return { status: 'started' };
  }

  /**
   * 진행 중인 분석을 중단합니다.
   */
  static async stopAnalysis(userId: string) {
    const job = userAnalysisJobs.get(userId);
    if (job && job.status === 'processing') {
      userAnalysisJobs.set(userId, {
        ...job,
        isCancelled: true,
        progressMessage: '중단 요청 중...'
      });
      return { success: true };
    }
    return { success: false, message: '진행 중인 분석이 없습니다.' };
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
    // 0. 학습 상태 즉시 초기화 (Race Condition 방지)
    const { resetLearningStatus } = await import('@/lib/stock-analysis/ai-learning');
    resetLearningStatus(options.fileIds?.length || 0);

    // 1. 학습 파이프라인 시작 (비동기)
    (async () => {
      try {
        const knowledge = await runLearningPipeline(options.fileIds, options.aiModels);
        const knowledgeId = await saveKnowledgeToDB(knowledge, options.title);
        console.log(`Learning completed: ${knowledgeId}`);
      } catch (error) {
        console.error('Background learning error:', error);
      }
    })();

    return { status: 'started' };
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
      const content = activeKnowledge.content as unknown as LearnedKnowledge;
      return {
        exists: true,
        id: activeKnowledge.id, // ID 추가
        title: activeKnowledge.title,
        filesAnalyzed: content.fileAnalyses?.length || 0,
        rulesLearned: this.countTotalRules(content),
        learnedAt: activeKnowledge.createdAt,
        content: content, // 전체 내용 포함
      };
    }

    return { exists: false };
  }

  /**
   * 분석된 각 기업별 심층 리포트를 DB에 저장합니다.
   */
  static async saveAnalysisReports(userId: string, topPicks: any[], conditions: any) {
    try {
      const reports = topPicks.map(pick => ({
        userId,
        ticker: pick.yahooData.ticker,
        companyName: pick.company.companyName,
        conditions: conditions || {},
        expertVerdict: pick.expertVerdict || {},
        ruleScores: pick.ruleScores || [],
        sentiment: pick.sentiment || {},
        prediction: pick.prediction || {},
        overallScore: pick.score || 0,
      }));

      // 개별 저장 (대량 저장 시 오류 방지)
      for (const report of reports) {
        await prisma.analysisReport.create({ data: report });
      }
      
      console.log(`Saved ${reports.length} analysis reports for user ${userId}`);
    } catch (error) {
      console.error('Failed to save analysis reports:', error);
    }
  }

  private static countTotalRules(knowledge: KnowledgeContentShape | LearnedKnowledge) {
    const criteria = knowledge.criteria;
    if (!criteria) return 0;

    // 1. 새로운 동적 구조 확인
    if ('criterias' in criteria && Array.isArray(criteria.criterias)) {
      return criteria.criterias.length;
    }

    // 2. 레거시 고정 구조 확인 (캐스팅 후 접근)
    const leg = criteria as any;
    return (
      (leg.goodCompanyRules?.length || 0) +
      (leg.technicalRules?.length || 0) +
      (leg.marketSizeRules?.length || 0) +
      (leg.unitEconomicsRules?.length || 0) +
      (leg.lifecycleRules?.length || 0) +
      (leg.buyTimingRules?.length || 0)
    );
  }
}
