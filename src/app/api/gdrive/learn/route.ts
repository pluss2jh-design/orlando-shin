import { NextResponse } from 'next/server';
import { runLearningPipeline, getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';

export async function GET() {
  try {
    const knowledge = await getLearnedKnowledge();
    if (knowledge) {
      return NextResponse.json({
        exists: true,
        filesAnalyzed: knowledge.fileAnalyses.length,
        rulesLearned: knowledge.criteria.goodCompanyRules.length,
        learnedAt: knowledge.learnedAt,
      });
    }
    return NextResponse.json({ exists: false });
  } catch (error) {
    return NextResponse.json({ exists: false, error: 'Check failed' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const knowledge = await runLearningPipeline();

    return NextResponse.json({
      status: 'completed',
      filesAnalyzed: knowledge.fileAnalyses.length,
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
