import type {
  YahooFinanceData,
  PriceHistoryEntry,
  CurrencyCode,
  StockMarket,
} from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

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
  const quotes = await yahooFinance.quote(tickers);
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
  periodMonths: number
): Promise<YahooFinanceData> {
  const period1 = new Date();
  period1.setMonth(period1.getMonth() - Math.max(periodMonths, 6));

  let summaryResult: any = {};
  let historicalResult: any[] = [];

  try {
    summaryResult = await yahooFinance.quoteSummary(ticker, {
      modules: ['financialData', 'price', 'defaultKeyStatistics', 'summaryDetail', 'assetProfile', 'incomeStatementHistory'],
    });
  } catch (error) {
    console.warn(`Quote summary failed for ${ticker}, attempting basic quote:`, error);
    try {
      const basicQuote = await yahooFinance.quote(ticker);
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
        }
      };
    } catch (e) {
      console.error(`Basic quote also failed for ${ticker}`);
    }
  }

  try {
    historicalResult = await yahooFinance.historical(ticker, {
      period1: period1.toISOString().split('T')[0],
    });
  } catch (error) {
    console.warn(`Historical data failed for ${ticker}:`, error);
  }

  const financial = summaryResult.financialData;
  const price = summaryResult.price;
  const keyStats = summaryResult.defaultKeyStatistics;
  const summaryDetail = summaryResult.summaryDetail;
  const assetProfile = summaryResult.assetProfile;

  const currency = detectTickerCurrency(ticker, price?.currency);

  const priceHistory: PriceHistoryEntry[] = (historicalResult || []).map((entry) => ({
    date: entry.date instanceof Date ? entry.date : new Date(entry.date),
    close: entry.adjClose ?? entry.close ?? 0,
    volume: entry.volume ?? 0,
  }));

  // 수익률 계산 (1년, 6개월, 3개월, 1개월)
  const returnRates: any = {};
  const now = new Date();
  const intervals = [
    { label: 'oneYear', months: 12 },
    { label: 'sixMonths', months: 6 },
    { label: 'threeMonths', months: 3 },
    { label: 'oneMonth', months: 1 },
  ];

  const currentPrice = price?.regularMarketPrice ?? financial?.currentPrice ?? 0;

  if (priceHistory.length > 0 && currentPrice > 0) {
    intervals.forEach(({ label, months }) => {
      const targetDate = new Date();
      targetDate.setMonth(now.getMonth() - months);
      // 가장 가까운 과거 데이터 찾기
      const pastEntry = priceHistory
        .filter(h => h.date <= targetDate)
        .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

      if (pastEntry && pastEntry.close > 0) {
        returnRates[label] = ((currentPrice - pastEntry.close) / pastEntry.close) * 100;
      }
    });
  }

  // 재무 정보 추출 (최근 4분기/년)
  const incomeStatementHistory = summaryResult.incomeStatementHistory?.incomeStatementHistory || [];
  const financialHistory = incomeStatementHistory.map((item: any, index: number) => {
    const rev = item.totalRevenue;
    const opInc = item.operatingIncome;
    const margin = rev > 0 ? opInc / rev : 0;

    let revGrowth = 0;
    let opGrowth = 0;

    if (index < incomeStatementHistory.length - 1) {
      const nextItem = incomeStatementHistory[index + 1];
      if (nextItem.totalRevenue > 0) revGrowth = (rev - nextItem.totalRevenue) / nextItem.totalRevenue;
      if (nextItem.operatingIncome > 0) opGrowth = (opInc - nextItem.operatingIncome) / nextItem.operatingIncome;
    }

    return {
      date: item.endDate ? new Date(item.endDate).toLocaleDateString() : 'N/A',
      revenue: rev,
      operatingIncome: opInc,
      operatingMargin: margin,
      revenueGrowth: revGrowth * 100,
      operatingIncomeGrowth: opGrowth * 100,
    };
  }).reverse(); // 최근 데이터가 뒤로 가게 정렬

  return {
    ticker,
    currency,

    currentPrice: price?.regularMarketPrice ?? financial?.currentPrice ?? 0,
    previousClose: price?.regularMarketPreviousClose ?? 0,
    fiftyTwoWeekHigh: (summaryDetail?.fiftyTwoWeekHigh as number | undefined) ?? 0,
    fiftyTwoWeekLow: (summaryDetail?.fiftyTwoWeekLow as number | undefined) ?? 0,

    targetMeanPrice: financial?.targetMeanPrice,
    targetHighPrice: financial?.targetHighPrice,
    targetLowPrice: financial?.targetLowPrice,

    trailingPE: summaryDetail?.trailingPE,
    forwardPE: summaryDetail?.forwardPE ?? keyStats?.forwardPE,
    priceToBook: keyStats?.priceToBook,
    returnOnEquity: financial?.returnOnEquity,
    trailingEps: summaryDetail?.trailingAnnualDividendYield,
    dividendYield: summaryDetail?.dividendYield,
    marketCap: price?.marketCap,
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

export function calculateMonthlyReturns(
  priceHistory: PriceHistoryEntry[]
): number[] {
  if (priceHistory.length < 2) return [];

  const sorted = [...priceHistory].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const monthlyPrices: { month: string; close: number }[] = [];
  for (const entry of sorted) {
    const date = new Date(entry.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyPrices.push({ month: monthKey, close: entry.close });
  }

  const uniqueMonths = new Map<string, number>();
  for (const mp of monthlyPrices) {
    uniqueMonths.set(mp.month, mp.close);
  }

  const months = Array.from(uniqueMonths.entries()).sort(
    (a, b) => a[0].localeCompare(b[0])
  );

  const returns: number[] = [];
  for (let i = 1; i < months.length; i++) {
    const prevClose = months[i - 1][1];
    const currClose = months[i][1];
    if (prevClose > 0) {
      returns.push((currClose - prevClose) / prevClose);
    }
  }

  return returns;
}

export function calculateHistoricalVolatility(
  priceHistory: PriceHistoryEntry[]
): number {
  const returns = calculateMonthlyReturns(priceHistory);
  if (returns.length < 2) return 0.3;

  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) /
    (returns.length - 1);

  return Math.sqrt(variance);
}
