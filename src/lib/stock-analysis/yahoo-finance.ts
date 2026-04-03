import type {
  YahooFinanceData,
  PriceHistoryEntry,
  CurrencyCode,
  StockMarket,
} from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

interface SearchQuoteResult {
  symbol?: string;
  shortname?: string;
  longname?: string;
  exchDisp?: string;
  exchange?: string;
  quoteType?: string;
}

const KRX_TICKER_MAP: Record<string, string> = {
  '삼성전자': '005930.KS',
  '삼성SDI': '006400.KS',
  'SK하이닉스': '000660.KS',
  'LG에너지솔루션': '373220.KS',
  '현대자동차': '005380.KS',
  '기아': '000270.KS',
  'NAVER': '035420.KS',
  '카카오': '035720.KS',
  'LG화학': '051910.KS',
  'POSCO홀딩스': '005490.KS',
  '셀트리온': '068270.KS',
  'KB금융': '105560.KS',
  '신한지주': '055550.KS',
  '하나금융지주': '086790.KS',
  '삼성바이오로직스': '207940.KS',
  '현대모비스': '012330.KS',
  'LG전자': '066570.KS',
  'SK이노베이션': '096770.KS',
  'SK텔레콤': '017670.KS',
  'KT': '030200.KS',
  '삼성물산': '028260.KS',
  '한국전력': '015760.KS',
  '포스코퓨처엠': '003670.KS',
  '에코프로비엠': '247540.KQ',
  '에코프로': '086520.KQ',
};

export async function resolveTickerSymbol(
  companyName: string,
  market: StockMarket
): Promise<string | null> {
  const directMatch = KRX_TICKER_MAP[companyName];
  if (directMatch) return directMatch;

  try {
    const searchResult = await yahooFinance.search(companyName);
    const quotes = searchResult.quotes as unknown as SearchQuoteResult[];

    if (quotes.length === 0) return null;

    if (market === 'KRX') {
      const krxMatch = quotes.find(
        (q) => q.symbol?.endsWith('.KS') || q.symbol?.endsWith('.KQ')
      );
      if (krxMatch?.symbol) return krxMatch.symbol;
    }

    if (market === 'NYSE' || market === 'NASDAQ') {
      const usMatch = quotes.find(
        (q) => q.exchDisp === 'NYSE' || q.exchDisp === 'NASDAQ'
      );
      if (usMatch?.symbol) return usMatch.symbol;
    }

    const firstQuote = quotes[0];
    if (firstQuote?.symbol) return firstQuote.symbol;

    return null;
  } catch {
    return null;
  }
}

export async function fetchBatchQuotes(tickers: string[]): Promise<YahooFinanceData[]> {
  console.log(`[Yahoo] Fetching batch quotes for ${tickers.length} tickers...`);
  const quotes = await yahooFinance.quote(tickers, {}, { validateResult: false });
  const results: YahooFinanceData[] = [];

  for (const q of quotes) {
    const currency = detectTickerCurrency(q.symbol, q.currency);
    results.push({
      ticker: q.symbol,
      currency,
      currentPrice: q.regularMarketPrice ?? 0,
      previousClose: q.regularMarketPreviousClose ?? 0,
      fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
      fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
      targetMeanPrice: (q as any).targetMeanPrice,
      trailingPE: q.trailingPE,
      forwardPE: q.forwardPE,
      priceToBook: q.priceToBook,
      dividendYield: q.dividendYield,
      marketCap: q.marketCap,
      priceHistory: [],
      fetchedAt: new Date(),
    });
  }

  return results;
}

export async function fetchYahooFinanceData(
  ticker: string,
  asOfDate?: Date
): Promise<YahooFinanceData> {
  const effectiveEnd = asOfDate || new Date();
  const effectiveEndStr = effectiveEnd.toISOString().split('T')[0];

  // 2년치 차트 기간 (asOfDate 기준 역산)
  const period1 = new Date(effectiveEnd);
  period1.setMonth(period1.getMonth() - 18); // 2년(24개월) -> 1.5년(18개월)로 조정
  const period1Str = period1.toISOString().split('T')[0];

  // 타임아웃 헬퍼 (ms 단위)
  const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout(${ms}ms): ${label}`)), ms)
      ),
    ]);

  let summaryResult: any = {};
  let chartQuotes: any[] = [];
  let ftsData: any[] = [];

  // ── 1. 기본 Summary (asOfDate가 현재일 경우만 최신 데이터 활용) ──
  try {
    summaryResult = await withTimeout(
      yahooFinance.quoteSummary(ticker, {
        modules: ['financialData', 'price', 'defaultKeyStatistics', 'summaryDetail', 'assetProfile'],
      }, { validateResult: false }),
      15000,
      `quoteSummary(${ticker})`
    );
  } catch (error) {
    console.warn(`QuoteSummary failed for ${ticker}:`, (error as Error).message?.slice(0, 80));
    try {
      const basicQuote = await withTimeout(yahooFinance.quote(ticker, {}, { validateResult: false }), 10000, `quote(${ticker})`);
      summaryResult = {
        price: {
          regularMarketPrice: basicQuote.regularMarketPrice,
          regularMarketPreviousClose: basicQuote.regularMarketPreviousClose,
          marketCap: basicQuote.marketCap,
          currency: basicQuote.currency,
        },
        summaryDetail: {
          trailingPE: basicQuote.trailingPE,
          dividendYield: basicQuote.dividendYield,
        },
      };
    } catch (e) {
      console.error(`Basic quote also failed for ${ticker}`);
    }
  }

  // ── 2. 주가 이력 — chart() ──
  try {
    const chartResult: any = await withTimeout(
      yahooFinance.chart(ticker, { period1: period1Str, period2: effectiveEnd, interval: '1d' }, { validateResult: false }),
      20000,
      `chart(${ticker})`
    );
    chartQuotes = chartResult?.quotes ?? [];
  } catch (error) {
    console.warn(`Chart data failed for ${ticker}:`, (error as Error).message?.slice(0, 80));
  }


  // ── 3. 재무제표 — fundamentalsTimeSeries ──
  try {
    const fts = await withTimeout(
      yahooFinance.fundamentalsTimeSeries(ticker, {
        period1: period1Str,
        period2: effectiveEnd, // asOfDate까지만 조회
        type: 'annual',
        module: 'financials',
      }, { validateResult: false }),
      15000,
      `fundamentalsTimeSeries(${ticker})`
    );
    ftsData = Array.isArray(fts) ? fts : [];
  } catch (error) {
    console.debug(`FTS failed for ${ticker}:`, (error as Error).message?.slice(0, 60));
  }

  const financial = summaryResult.financialData;
  const price = summaryResult.price;
  const keyStats = summaryResult.defaultKeyStatistics;
  const summaryDetail = summaryResult.summaryDetail;
  const assetProfile = summaryResult.assetProfile;
  const currency = detectTickerCurrency(ticker, price?.currency);

  const priceHistory: PriceHistoryEntry[] = (chartQuotes || [])
    .filter((q: any) => q.close != null)
    .map((q: any) => ({
      date: q.date instanceof Date ? q.date : new Date(q.date),
      close: q.adjclose ?? q.close ?? 0,
      volume: q.volume ?? 0,
    }));

  // asOfDate 시점의 실시간 가격 시뮬레이션
  let currentPrice = price?.regularMarketPrice ?? financial?.currentPrice ?? 0;
  if (asOfDate && priceHistory.length > 0) {
    // asOfDate와 가장 가까운(이전) 종가를 현재가로 간주
    const pastEntries = priceHistory.filter(h => h.date <= asOfDate).sort((a, b) => b.date.getTime() - a.date.getTime());
    if (pastEntries.length > 0) {
      currentPrice = pastEntries[0].close;
    }
  }

  const returnRates: any = {};
  const intervals = [
    { label: 'oneYear', months: 12 },
    { label: 'sixMonths', months: 6 },
    { label: 'threeMonths', months: 3 },
    { label: 'oneMonth', months: 1 },
  ];

  if (priceHistory.length > 0 && currentPrice > 0) {
    intervals.forEach(({ label, months }) => {
      const targetDate = new Date(effectiveEnd);
      targetDate.setMonth(targetDate.getMonth() - months);
      const pastEntry = priceHistory
        .filter(h => h.date <= targetDate)
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
      if (pastEntry && pastEntry.close > 0) {
        returnRates[label] = ((currentPrice - pastEntry.close) / pastEntry.close) * 100;
      }
    });
  }

  // 야후 파이낸스 FTS(Fundamentals Time Series) 데이터 통합 파싱
  const financialMap = new Map<string, any>();
  ftsData.forEach((entry: any) => {
    if (!entry.date) return;
    const dateKey = new Date(entry.date).toISOString().split('T')[0];
    const existing = financialMap.get(dateKey) || { date: entry.date };
    
    // 주요 지표 누적 (야후 API는 한 날짜에 여러 지표가 분산되어 올 수 있음)
    if (entry.totalRevenue !== undefined) existing.totalRevenue = entry.totalRevenue;
    if (entry.operatingIncome !== undefined) existing.operatingIncome = entry.operatingIncome;
    if (entry.basicEPS !== undefined) existing.basicEPS = entry.basicEPS;
    if (entry.dilutedEPS !== undefined) existing.dilutedEPS = entry.dilutedEPS;
    
    financialMap.set(dateKey, existing);
  });

  const sortedFinancials = Array.from(financialMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const financialHistory = sortedFinancials.map((entry: any, idx: number) => {
    const rev = entry.totalRevenue ?? 0;
    const opInc = entry.operatingIncome ?? 0;
    const margin = rev > 0 ? opInc / rev : 0;
    const prev = sortedFinancials[idx + 1];
    const prevRev = prev?.totalRevenue ?? 0;
    const prevOp = prev?.operatingIncome ?? 0;
    return {
      date: entry.date ? new Date(entry.date).getFullYear().toString() : 'N/A',
      revenue: rev,
      operatingIncome: opInc,
      operatingMargin: margin,
      revenueGrowth: prevRev > 0 ? ((rev - prevRev) / prevRev) * 100 : 0,
      operatingIncomeGrowth: prevOp > 0 ? ((opInc - prevOp) / prevOp) * 100 : 0,
      eps: entry.basicEPS ?? entry.dilutedEPS
    };
  }).reverse();

  // 지표 보정 (asOfDate가 과거일 경우 현재가 반영하여 PER/PBR 재계산)
  let trailingPE = summaryDetail?.trailingPE;
  let priceToBook = keyStats?.priceToBook;

  if (asOfDate && currentPrice > 0) {
    // 단순화: 최신 EPS/BPS와 과거 주가로 PER/PBR 추정 (실제 과거 데이터를 완벽히 복원하긴 어려우나 흐름 파악용)
    const eps = financial?.trailingEps || (currentPrice / (trailingPE || 1));
    if (eps > 0) trailingPE = currentPrice / eps;

    const bookValue = (price?.regularMarketPrice || currentPrice) / (priceToBook || 1);
    if (bookValue > 0) priceToBook = currentPrice / bookValue;
  }

  return {
    ticker,
    currency,
    currentPrice,
    previousClose: price?.regularMarketPreviousClose ?? 0,
    fiftyTwoWeekHigh: (summaryDetail?.fiftyTwoWeekHigh as number | undefined) ?? 0,
    fiftyTwoWeekLow: (summaryDetail?.fiftyTwoWeekLow as number | undefined) ?? 0,
    targetMeanPrice: financial?.targetMeanPrice,
    targetHighPrice: financial?.targetHighPrice,
    targetLowPrice: financial?.targetLowPrice,
    trailingPE,
    forwardPE: summaryDetail?.forwardPE ?? keyStats?.forwardPE,
    priceToBook,
    returnOnEquity: financial?.returnOnEquity,
    trailingEps: summaryDetail?.trailingAnnualDividendYield,
    dividendYield: summaryDetail?.dividendYield,
    marketCap: (asOfDate && currentPrice > 0 && price?.marketCap)
      ? (price.marketCap * (currentPrice / (price.regularMarketPrice || currentPrice)))
      : price?.marketCap,
    sector: assetProfile?.sector,
    revenueGrowth: financial?.revenueGrowth,
    priceHistory,
    financialHistory,
    returnRates,
    fetchedAt: new Date(),
  };
}

function detectTickerCurrency(
  ticker: string,
  yahooCurrency?: string | null
): CurrencyCode {
  if (yahooCurrency) {
    if (yahooCurrency === 'KRW') return 'KRW';
    if (yahooCurrency === 'USD') return 'USD';
  }

  if (ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return 'KRW';
  return 'USD';
}
