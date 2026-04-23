import type {
  YahooFinanceData,
  PriceHistoryEntry,
  FinancialRecord,
  CurrencyCode,
  StockMarket,
} from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';

// 인스턴스 생성을 통한 설정 주입
const yahooFinance = new YahooFinance({
  suppressNotices: ['yahooSurvey']
});

interface SearchQuoteResult {
  symbol?: string;
  exchDisp?: string;
}

const KRX_TICKER_MAP: Record<string, string> = {
  '삼성전자': '005930.KS',
  '삼성SDI': '006400.KS',
  'SK하이닉스': '000660.KS',
  'LG에너지솔루션': '373220.KS',
  '현대자동차': '005380.KS',
  '기아': '000270.KS',
};

/** 기업명으로 티커 심볼 찾기 */
export async function resolveTickerSymbol(companyName: string, market: StockMarket): Promise<string | null> {
  const directMatch = KRX_TICKER_MAP[companyName];
  if (directMatch) return directMatch;
  try {
    const searchResult = await yahooFinance.search(companyName);
    const quotes = searchResult.quotes as unknown as SearchQuoteResult[];
    if (quotes.length === 0) return null;
    if (market === 'KRX') {
      const match = quotes.find(q => q.symbol?.endsWith('.KS') || q.symbol?.endsWith('.KQ'));
      if (match?.symbol) return match.symbol;
    }
    if (market === 'NYSE' || market === 'NASDAQ') {
      const match = quotes.find(q => q.exchDisp === 'NYSE' || q.exchDisp === 'NASDAQ');
      if (match?.symbol) return match.symbol;
    }
    return quotes[0]?.symbol || null;
  } catch { return null; }
}

/** 헬퍼: 타임아웃 래퍼 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout(${ms}ms): ${label}`)), ms))
  ]);
}

/** 핵심 로직: 기업 상세 데이터 수집 */
export async function fetchYahooFinanceData(ticker: string, asOfDate?: Date): Promise<YahooFinanceData> {
  const effectiveEnd = asOfDate || new Date();
  const effectiveEndStr = effectiveEnd.toISOString().split('T')[0];
  const period1 = new Date(effectiveEnd);
  period1.setMonth(period1.getMonth() - 48); // 최근 4년 데이터
  const period1Str = period1.toISOString().split('T')[0];

  console.log(`[Yahoo] Data Scraping Start: ${ticker} (asOf: ${effectiveEndStr})`);

  // 1. 병렬 데이터 수집 (Summary + Charts + FTS Multi-module)
  const [summary, chartResult, ftsFinancials, ftsBalance, ftsCashFlow] = await Promise.all([
    // 1-1. 최신 요약 및 통계
    withTimeout(yahooFinance.quoteSummary(ticker, {
      modules: ['financialData', 'price', 'defaultKeyStatistics', 'summaryDetail', 'assetProfile', 'insiderTransactions', 'institutionOwnership', 'quoteType']
    }, { validateResult: false }), 15000, `Summary:${ticker}`),
    
    // 1-2. 주가 이력
    withTimeout(yahooFinance.chart(ticker, { period1: period1Str, period2: effectiveEnd, interval: '1d' }, { validateResult: false }), 15000, `Chart:${ticker}`),

    // 1-3. 핵심 재무 시계열 (각 모듈별로 확실히 호출)
    withTimeout(yahooFinance.fundamentalsTimeSeries(ticker, {
      period1: period1Str, period2: effectiveEnd, type: 'annual', module: 'financials'
    }, { validateResult: false }), 15000, `FTS:Fin:${ticker}`).catch(() => []),

    withTimeout(yahooFinance.fundamentalsTimeSeries(ticker, {
      period1: period1Str, period2: effectiveEnd, type: 'annual', module: 'balance-sheet'
    }, { validateResult: false }), 15000, `FTS:BS:${ticker}`).catch(() => []),

    withTimeout(yahooFinance.fundamentalsTimeSeries(ticker, {
      period1: period1Str, period2: effectiveEnd, type: 'annual', module: 'cash-flow'
    }, { validateResult: false }), 15000, `FTS:CF:${ticker}`).catch(() => []),
  ]);

  // 모든 재무 데이터를 하나로 병합
  const ftsRaw = [...ftsFinancials, ...ftsBalance, ...ftsCashFlow];

  const fin = summary.financialData || {};
  const stats = summary.defaultKeyStatistics || {};
  const detail = summary.summaryDetail || {};
  const profile = summary.assetProfile || {};
  const price = summary.price || {};
  const currency = detectTickerCurrency(ticker, price.currency);

  // 2. 재무 필드 맵핑 (FTS 데이터 통합)
  const financialMap = new Map<string, any>();
  ftsRaw.forEach((entry: any) => {
    if (!entry.date) return;
    const d = new Date(entry.date).toISOString().split('T')[0];
    const existing = financialMap.get(d) || { date: d };
    
    // 야후 FTS 필드명을 우리 시스템 필드로 매칭
    const mapping: Record<string, string> = {
      'annualTotalRevenue': 'revenue',
      'annualOperatingIncome': 'operatingIncome',
      'annualNetIncomeCommonStockholders': 'netIncome',
      'annualStockholdersEquity': 'equity',
      'annualTreasuryStock': 'treasury',
      'annualOperatingCashFlow': 'ocf',
      'annualFreeCashFlow': 'fcf',
      'annualTotalAssets': 'assets'
    };

    Object.entries(mapping).forEach(([yKey, myKey]) => {
      if (entry[yKey] !== undefined) existing[myKey] = entry[yKey];
    });
    financialMap.set(d, existing);
  });

  const sortedDates = Array.from(financialMap.keys()).sort((a, b) => b.localeCompare(a));
  const latestFts = financialMap.get(sortedDates[0]) || {};

  const financialHistory: FinancialRecord[] = sortedDates.map((date, idx) => {
    const entry = financialMap.get(date);
    const prev = financialMap.get(sortedDates[idx + 1]);
    const rev = entry.revenue ?? 0;
    return {
      date: date.slice(0, 4),
      revenue: rev,
      operatingIncome: entry.operatingIncome ?? 0,
      operatingMargin: rev > 0 ? (entry.operatingIncome ?? 0) / rev : 0,
      netIncome: entry.netIncome,
      stockholdersEquity: entry.equity,
      totalCash: entry.cash, // FTS에 없을 시 FinancialData 활용
      freeCashflow: entry.fcf,
      revenueGrowth: (rev > 0 && prev?.revenue > 0) ? ((rev - prev.revenue) / prev.revenue) * 100 : undefined,
      treasuryStock: entry.treasury
    };
  }).reverse();

  // 3. 주가 이력 가공
  const priceHistory: PriceHistoryEntry[] = (chartResult?.quotes || [])
    .filter((q: any) => q.close != null)
    .map((q: any) => ({
      date: new Date(q.date),
      close: q.adjclose ?? q.close ?? 0,
      volume: q.volume ?? 0,
    }));

  const realCurrentPrice = price.regularMarketPrice ?? fin.currentPrice ?? 0;
  let currentPrice = realCurrentPrice;
  if (asOfDate && priceHistory.length > 0) {
    const past = priceHistory.filter(h => h.date <= asOfDate).sort((a,b) => b.date.getTime() - a.date.getTime());
    if (past.length > 0) currentPrice = past[0].close;
  }

  // 4. 역사적 지표 보정 (현재일이 아닐 경우)
  let roe = fin.returnOnEquity;
  let opMargin = fin.operatingMargins;
  let revGrowth = fin.revenueGrowth;

  if (asOfDate && financialHistory.length > 0) {
    const latest = financialHistory[financialHistory.length - 1];
    if (latest.stockholdersEquity && latest.netIncome) roe = latest.netIncome / latest.stockholdersEquity;
    opMargin = latest.operatingMargin;
    revGrowth = latest.revenueGrowth;
  }

  // 5. IPO 날짜 파싱
  const ipoEpoch = summary.quoteType?.firstTradeDateEpochUtc || summary.price?.firstTradeDateEpochUtc;
  let ipoDate: Date | undefined;
  if (ipoEpoch) {
    const val = typeof ipoEpoch === 'number' ? ipoEpoch : Number((ipoEpoch as any).raw);
    const d = new Date(val < 50000000000 ? val * 1000 : val);
    if (!isNaN(d.getTime())) ipoDate = d;
  }

  // 6. 수익률 계산
  const returnRates: any = { prices: { current: currentPrice, realCurrent: realCurrentPrice } };
  [{ l: 'oneYear', m: 12 }, { l: 'sixMonths', m: 6 }, { l: 'threeMonths', m: 3 }, { l: 'oneMonth', m: 1 }].forEach(iv => {
    const t = new Date(effectiveEnd); t.setMonth(t.getMonth() - iv.m);
    const p = priceHistory.filter(h => h.date <= t).sort((a,b) => b.date.getTime() - a.date.getTime())[0];
    if (p && p.close > 0) returnRates[iv.l] = ((currentPrice - p.close) / p.close) * 100;
  });

  return {
    ticker,
    currency,
    currentPrice,
    previousClose: price.regularMarketPreviousClose ?? 0,
    fiftyTwoWeekHigh: detail.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: detail.fiftyTwoWeekLow ?? 0,
    targetMeanPrice: fin.targetMeanPrice,
    trailingPE: detail.trailingPE || (fin.trailingEps > 0 ? currentPrice / fin.trailingEps : undefined),
    forwardPE: detail.forwardPE || stats.forwardPE,
    priceToBook: stats.priceToBook,
    returnOnEquity: roe,
    trailingEps: fin.trailingEps || stats.trailingEps,
    dividendYield: detail.dividendYield || 0,
    marketCap: price.marketCap || detail.marketCap,
    sector: profile.sector,
    industry: profile.industry,
    businessSummary: profile.longBusinessSummary,
    revenueGrowth: revGrowth,
    operatingMargins: opMargin,
    ebitdaMargins: fin.ebitdaMargins,
    grossMargins: fin.grossMargins,
    profitMargins: fin.profitMargins,
    freeCashFlow: fin.freeCashflow || latestFts.fcf,
    operatingCashflow: fin.operatingCashflow || latestFts.ocf,
    returnOnAssets: fin.returnOnAssets,
    
    // 추가 핵심 지표
    totalCash: fin.totalCash || latestFts.cash,
    totalDebt: fin.totalDebt || latestFts.totalLiabilities,
    currentRatio: fin.currentRatio,
    debtToEquity: fin.debtToEquity,
    treasuryStock: latestFts.treasury,
    fullTimeEmployees: profile.fullTimeEmployees,

    heldPercentInstitutions: stats.heldPercentInstitutions,
    heldPercentInsiders: stats.heldPercentInsiders,
    shortPercentOfFloat: stats.shortPercentOfFloat,
    insiderTransactions: summary.insiderTransactions?.transactions || [],
    institutionalHolders: summary.institutionOwnership?.ownershipList || [],
    priceHistory,
    financialHistory,
    returnRates,
    fetchedAt: new Date(),
    ipoDate,
  };
}

function detectTickerCurrency(ticker: string, yCurr?: string): CurrencyCode {
  if (yCurr === 'KRW' || ticker.endsWith('.KS') || ticker.endsWith('.KQ')) return 'KRW';
  return 'USD';
}

export async function fetchBatchQuotes(tickers: string[]): Promise<YahooFinanceData[]> {
  const quotes = await yahooFinance.quote(tickers, {}, { validateResult: false });
  return quotes.map(q => ({
    ticker: q.symbol,
    currency: detectTickerCurrency(q.symbol, q.currency),
    currentPrice: q.regularMarketPrice ?? 0,
    previousClose: q.regularMarketPreviousClose ?? 0,
    fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
    fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
    marketCap: q.marketCap,
    priceHistory: [],
    fetchedAt: new Date(),
  }));
}
