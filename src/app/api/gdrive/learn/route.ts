import { NextRequest, NextResponse } from 'next/server';
import { runLearningPipeline, getLearnedKnowledge, saveKnowledgeToDB } from '@/lib/stock-analysis/ai-learning';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // 1. DB에서 활성화된 지식 먼저 확인
    const activeKnowledgeFromDB = await prisma.learnedKnowledge.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });

    if (activeKnowledgeFromDB) {
      const content = activeKnowledgeFromDB.content as any;
      const criteria = content.criteria;
      const totalRules = (
        (criteria?.goodCompanyRules?.length || 0) +
        (criteria?.technicalRules?.length || 0) +
        (criteria?.marketSizeRules?.length || 0) +
        (criteria?.unitEconomicsRules?.length || 0) +
        (criteria?.lifecycleRules?.length || 0) +
        (criteria?.buyTimingRules?.length || 0)
      );

      return NextResponse.json({
        exists: true,
        title: activeKnowledgeFromDB.title,
        filesAnalyzed: content.fileAnalyses?.length || 0,
        rulesLearned: totalRules,
        learnedAt: activeKnowledgeFromDB.createdAt,
      });
    }

    // 2. 파일 기반 지식 (Fallback)
    const knowledge = await getLearnedKnowledge();
    if (knowledge) {
      const criteria = knowledge.criteria;
      const totalRules = (
        (criteria?.goodCompanyRules?.length || 0) +
        (criteria?.technicalRules?.length || 0) +
        (criteria?.marketSizeRules?.length || 0) +
        (criteria?.unitEconomicsRules?.length || 0) +
        (criteria?.lifecycleRules?.length || 0) +
        (criteria?.buyTimingRules?.length || 0)
      );

      return NextResponse.json({
        exists: true,
        title: '시스템 로컬 데이터',
        filesAnalyzed: knowledge.fileAnalyses.length,
        rulesLearned: totalRules,
        learnedAt: knowledge.learnedAt,
      });
    }
    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('Check knowledge failed:', error);
    return NextResponse.json({ exists: false, error: 'Check failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileIds, aiModels, title } = body;

    const knowledge = await runLearningPipeline(fileIds, aiModels);

    // DB에 저장
    const knowledgeId = await saveKnowledgeToDB(knowledge, title);

    const criteria = knowledge.criteria;
    const totalRules = (
      (criteria?.goodCompanyRules?.length || 0) +
      (criteria?.technicalRules?.length || 0) +
      (criteria?.marketSizeRules?.length || 0) +
      (criteria?.unitEconomicsRules?.length || 0) +
      (criteria?.lifecycleRules?.length || 0) +
      (criteria?.buyTimingRules?.length || 0)
    );

    return NextResponse.json({
      status: 'completed',
      id: knowledgeId,
      filesAnalyzed: knowledge.fileAnalyses.length,
      rulesLearned: totalRules,
      principlesLearned: knowledge.criteria.principles.length,
      sourceFiles: knowledge.sourceFiles,
      learnedAt: knowledge.learnedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '학습 실패';
    console.error('Learning pipeline error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
