import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { StockService, userAnalysisJobs } from '@/lib/services/stock.service';
import type { InvestmentStyle } from '@/types/stock-analysis';

interface AnalysisRequestBody {
  conditions?: { 
    companyCount?: number; 
    newsAiModel?: string; 
    newsApiKey?: string; 
    sector?: string; 
    strategyType?: 'growth' | 'value' | 'all'; 
    excludeSP500?: boolean; 
    universeType?: 'sp500' | 'russell1000' | 'russell1000_exclude_sp500';
  };

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

    const rawBody = (await request.json()) as any;
    console.log(`[API] POST /api/analysis - Received body:`, JSON.stringify(rawBody));

    // Flat body -> Nested body 변환 지원 (강력한 호환성 확보)
    let body: AnalysisRequestBody;
    if (rawBody.conditions) {
      body = rawBody;
    } else {
      body = {
        style: rawBody.style || 'moderate',
        conditions: { ...rawBody }
      };
      delete (body.conditions as any).style;
    }

    // 기본 뉴스 스캔 AI 모델 설정 (환경변수에서 읽어옴)
    if (body.conditions && !body.conditions.newsAiModel && process.env.NEWS_SCAN_AI_MODEL) {
      body.conditions.newsAiModel = process.env.NEWS_SCAN_AI_MODEL;
    }

    // 비즈니스 로직을 StockService로 위임
    await StockService.startAnalysis(session.user.id, body);

    return NextResponse.json({ status: 'started' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('분석 API 오류:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
