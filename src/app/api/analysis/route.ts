import { NextRequest, NextResponse } from 'next/server';
import { runAnalysisEngine } from '@/lib/stock-analysis/analysis-engine';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';
import type {
  InvestmentConditions,
  InvestmentStyle,
} from '@/types/stock-analysis';

interface AnalysisRequestBody {
  conditions: InvestmentConditions;
  style?: InvestmentStyle;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalysisRequestBody;

    if (!body.conditions?.amount || !body.conditions?.periodMonths) {
      return NextResponse.json(
        { error: '투자금(amount)과 투자기간(periodMonths)이 필요합니다.' },
        { status: 400 }
      );
    }

    if (body.conditions.amount <= 0) {
      return NextResponse.json(
        { error: '투자금은 0보다 커야 합니다.' },
        { status: 400 }
      );
    }

    if (body.conditions.periodMonths < 1 || body.conditions.periodMonths > 60) {
      return NextResponse.json(
        { error: '투자기간은 1~60개월 사이여야 합니다.' },
        { status: 400 }
      );
    }

    const knowledge = await getLearnedKnowledge();
    if (!knowledge || knowledge.companies.length === 0) {
      return NextResponse.json(
        { error: '학습된 데이터가 없습니다. 먼저 Google Drive 동기화 후 학습을 시작해주세요.' },
        { status: 400 }
      );
    }

    const result = await runAnalysisEngine(
      knowledge.companies,
      body.conditions,
      knowledge.criteria,
      body.style ?? 'moderate'
    );

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('Analysis API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
