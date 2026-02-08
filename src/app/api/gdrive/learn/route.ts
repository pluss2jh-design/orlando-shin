import { NextResponse } from 'next/server';
import { runLearningPipeline } from '@/lib/stock-analysis/ai-learning';

export async function POST() {
  try {
    const knowledge = await runLearningPipeline();

    return NextResponse.json({
      status: 'completed',
      companiesFound: knowledge.companies.length,
      rulesLearned: knowledge.criteria.goodCompanyRules.length,
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
