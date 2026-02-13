import { NextResponse } from 'next/server';
import { runLearningPipeline, getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';

export async function GET() {
  try {
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
        filesAnalyzed: knowledge.fileAnalyses.length,
        rulesLearned: totalRules,
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
