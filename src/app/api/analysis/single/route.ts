import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';
import { validateTicker, runSingleCompanyAnalysis } from '@/lib/stock-analysis/single-company-engine';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { ticker, conditions, newsAiModel, fallbackAiModel, newsApiKey } = body;

    if (!ticker || typeof ticker !== 'string') {
      return NextResponse.json({ error: 'ticker가 필요합니다.' }, { status: 400 });
    }

    // 학습된 지식 확인
    const knowledge = await getLearnedKnowledge();
    if (!knowledge) {
      return NextResponse.json(
        { error: '학습된 데이터가 없습니다. 먼저 학습을 완료해주세요.' },
        { status: 422 }
      );
    }

    // ticker 유효성 검증
    const validation = await validateTicker(ticker);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 404 });
    }

    // 단일 기업 분석 실행
    const parsedConditions = {
      ...conditions,
      amount: 0,
      asOfDate: conditions?.asOfDate ? new Date(conditions.asOfDate) : undefined,
    };

    const result = await runSingleCompanyAnalysis(
      ticker,
      parsedConditions,
      knowledge,
      newsAiModel || process.env.NEWS_SCAN_AI_MODEL,
      fallbackAiModel,
      newsApiKey
    );

    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류';
    console.error('[Single Analysis API] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
