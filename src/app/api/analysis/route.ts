import { NextRequest, NextResponse } from 'next/server';
import { runAnalysisEngine } from '@/lib/stock-analysis/analysis-engine';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';
import type {
  InvestmentConditions,
  InvestmentStyle,
} from '@/types/stock-analysis';

interface AnalysisRequestBody {
  conditions?: { periodMonths?: number; companyCount?: number; companyAiModel?: string; companyApiKey?: string; newsAiModel?: string; newsApiKey?: string };
  style?: InvestmentStyle;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalysisRequestBody;

    const knowledge = await getLearnedKnowledge();
    if (!knowledge) {
      return NextResponse.json(
        { error: '학습된 데이터가 없습니다. 먼저 Google Drive 동기화 후 학습을 시작해주세요.' },
        { status: 400 }
      );
    }

    const result = await runAnalysisEngine(
      { amount: 0, periodMonths: body.conditions?.periodMonths || 12 },
      knowledge,
      body.style ?? 'moderate',
      body.conditions?.companyCount || 5,
      body.conditions?.companyAiModel,
      body.conditions?.companyApiKey,
      body.conditions?.newsAiModel,
      body.conditions?.newsApiKey
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('Analysis API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
