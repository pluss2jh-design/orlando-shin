import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ 
    suppressNotices: ['yahooSurvey'] 
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');
    const period = searchParams.get('period') || '1y';

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // 과거 데이터 조회 기간 설정
    const end = new Date();
    const start = new Date();
    
    switch (period) {
      case '3m': start.setMonth(end.getMonth() - 3); break;
      case '6m': start.setMonth(end.getMonth() - 6); break;
      case '1y': start.setFullYear(end.getFullYear() - 1); break;
      case '3y': start.setFullYear(end.getFullYear() - 3); break;
      default: start.setFullYear(end.getFullYear() - 1);
    }

    const queryOptions = {
      period1: start,
      period2: end,
      interval: '1d' as const,
    };

    const [history, quote] = await Promise.all([
      yahooFinance.chart(ticker, queryOptions, { validateResult: false }) as any,
      yahooFinance.quote(ticker, {}, { validateResult: false })
    ]);

    if (!history || !history.quotes || history.quotes.length === 0) {
      return NextResponse.json({ error: 'History not found' }, { status: 404 });
    }

    // 수익률 및 성과 지표 계산
    const quotes = (history.quotes as any[]).filter((q: any) => q.close !== null && q.close !== undefined);
    if (quotes.length < 2) {
      return NextResponse.json({ error: 'Insufficient data for backtesting' }, { status: 400 });
    }

    const first = quotes[0].close!;
    const last = quotes[quotes.length - 1].close!;
    const totalReturn = ((last - first) / first) * 100;

    // 최대 낙폭(MDD) 계산
    let mdd = 0;
    let peak = -Infinity;
    for (const q of quotes) {
      if (q.close! > peak) peak = q.close!;
      const dd = (q.close! - peak) / peak;
      if (dd < mdd) mdd = dd;
    }

    return NextResponse.json({
      ticker,
      name: (quote as any)?.longName || ticker,
      currentPrice: last,
      currency: (quote as any)?.currency || 'USD',
      history: quotes.map(q => ({
        date: q.date.toISOString().split('T')[0],
        close: q.close
      })),
      metrics: {
        totalReturn: Number(totalReturn.toFixed(2)),
        mdd: Number((mdd * 100).toFixed(2)),
        startPrice: first,
        endPrice: last,
        startDate: quotes[0].date,
        endDate: quotes[quotes.length - 1].date,
      }
    });
  } catch (error: any) {
    console.error('Backtest API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
