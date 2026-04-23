import { NextRequest, NextResponse } from 'next/server';
import { StockService } from '@/lib/services/stock.service';

export async function GET() {
  try {
    const summary = await StockService.getActiveKnowledgeSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error('지식 확인 실패:', error);
    return NextResponse.json({ exists: false, error: 'Check failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as any;
    const { fileIds, aiModel, fallbackAiModel, title, forceFullAnalysis } = body;

    await StockService.runLearning({ fileIds, aiModel, fallbackAiModel, title, forceFullAnalysis });

    return NextResponse.json({ status: 'started' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '학습 실패';
    console.error('학습 파이프라인 오류:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
