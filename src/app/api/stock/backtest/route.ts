import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({ 
    suppressNotices: ['yahooSurvey'] 
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get('ticker');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!ticker) {
      return NextResponse.json({ error: 'Ticker is required' }, { status: 400 });
    }

    // 과거 데이터 조회 기간 설정
    let end = new Date();
    let start = new Date();
    
    if (endDateParam) {
      end = new Date(endDateParam);
    }
    
    if (startDateParam) {
      start = new Date(startDateParam);
    } else {
      start.setFullYear(end.getFullYear() - 1);
    }

    const extendedStart = new Date(start);
    extendedStart.setDate(start.getDate() - 10); // 10일 여유분 확보

    const queryOptions = {
      period1: extendedStart,
      period2: end,
      interval: '1d' as const,
    };

    const [history, benchmarkHistory, quote] = await Promise.all([
      yahooFinance.chart(ticker, queryOptions, { validateResult: false }) as any,
      yahooFinance.chart('^GSPC', queryOptions, { validateResult: false }) as any,
      yahooFinance.quote(ticker, {}, { validateResult: false })
    ]);

    if (!history || !history.quotes || history.quotes.length === 0) {
      return NextResponse.json({ error: 'History not found' }, { status: 404 });
    }

    const currentPrice = (quote as any).regularMarketPrice ?? (quote as any).currentPrice ?? 0;
    const quotes = (history.quotes as any[]).filter((q: any) => (q.adjclose !== null || q.close !== null));
    const benchmarkQuotes = (benchmarkHistory?.quotes as any[] || []).filter((q: any) => (q.adjclose !== null || q.close !== null));

    if (quotes.length < 2) {
      return NextResponse.json({ error: 'Insufficient data for backtesting' }, { status: 400 });
    }

    // --- 기업 수익률 계산 (카드와 동일한 로직적 정렬) ---
    // 시작일(start) 이전 또는 당일 중 가장 최근 거래일 찾기
    const findStartPrice = (qs: any[], target: Date) => {
      const past = qs.filter(q => q.date <= target).sort((a,b) => b.date.getTime() - a.date.getTime());
      return past.length > 0 ? (past[0].adjclose ?? past[0].close) : (qs[0].adjclose ?? qs[0].close);
    };

    const first = findStartPrice(quotes, start);
    const last = currentPrice || (quotes[quotes.length - 1].adjclose ?? quotes[quotes.length - 1].close);
    const totalReturn = first > 0 ? ((last - first) / first) * 100 : 0;

    // --- 벤치마크 수익률 계산 ---
    const bFirst = findStartPrice(benchmarkQuotes, start);
    const bLast = (benchmarkHistory as any).meta?.regularMarketPrice || (benchmarkQuotes[benchmarkQuotes.length - 1].adjclose ?? benchmarkQuotes[benchmarkQuotes.length - 1].close);
    const benchmarkReturn = bFirst > 0 ? ((bLast - bFirst) / bFirst) * 100 : 0;

    // 최대 낙폭(MDD) 계산용으로는 차트에 포함된 데이터만 사용 (조회 기간 내)
    const analysisQuotes = quotes.filter(q => q.date >= start);
    let mdd = 0;
    let peak = -Infinity;
    for (const q of analysisQuotes) {
      const price = q.adjclose ?? q.close!;
      if (price > peak) peak = price;
      const dd = (price - peak) / peak;
      if (dd < mdd) mdd = dd;
    }

    return NextResponse.json({
      ticker,
      name: (quote as any)?.longName || ticker,
      currentPrice: last,
      currency: (quote as any)?.currency || 'USD',
      history: quotes.filter(q => q.date >= start).map(q => ({
        date: q.date.toISOString().split('T')[0],
        close: q.adjclose ?? q.close
      })),
      metrics: {
        totalReturn: Number(totalReturn.toFixed(2)),
        benchmarkReturn: Number(benchmarkReturn.toFixed(2)),
        benchmarkStartPrice: Number(bFirst.toFixed(2)),
        benchmarkEndPrice: Number(bLast.toFixed(2)),
        mdd: Number((mdd * 100).toFixed(2)),
        startPrice: first,
        endPrice: last,
        startDate: start,
        endDate: end,
      }
    });
  } catch (error: any) {
    console.error('Backtest API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
