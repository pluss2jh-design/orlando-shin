import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService, userAnalysisJobs } from '@/lib/services/stock.service';
import type { InvestmentStyle } from '@/types/stock-analysis';

interface AnalysisRequestBody {
  conditions?: { periodMonths?: number; companyCount?: number; companyAiModel?: string; companyApiKey?: string; newsAiModel?: string; newsApiKey?: string; sector?: string; strategyType?: 'growth' | 'value' | 'all' };
  style?: InvestmentStyle;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const job = userAnalysisJobs.get(session.user.id);
    if (!job) {
      return NextResponse.json({ status: 'idle' });
    }

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: '상태 조회 실패' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    userAnalysisJobs.delete(session.user.id);
    return NextResponse.json({ success: true, status: 'idle' });
  } catch (error) {
    return NextResponse.json({ error: '상태 초기화 실패' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as AnalysisRequestBody;
    
    // 비즈니스 로직을 StockService로 위임
    await StockService.startAnalysis(session.user.id, body);

    return NextResponse.json({ status: 'started' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('Analysis API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
