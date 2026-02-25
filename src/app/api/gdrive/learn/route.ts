import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/services/stock.service';

export async function GET() {
  try {
    const summary = await StockService.getActiveKnowledgeSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('Check knowledge failed:', error);
    return NextResponse.json({ exists: false, error: 'Check failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileIds, aiModels, title } = body;

    const result = await StockService.runLearning({ fileIds, aiModels, title });

    return NextResponse.json({
      status: 'completed',
      id: result.id,
      filesAnalyzed: result.knowledge.fileAnalyses.length,
      rulesLearned: result.totalRules,
      principlesLearned: result.knowledge.criteria.principles.length,
      sourceFiles: result.knowledge.sourceFiles,
      learnedAt: result.knowledge.learnedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '학습 실패';
    console.error('Learning pipeline error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
