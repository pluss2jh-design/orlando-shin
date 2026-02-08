import type {
  ExtractedCompanyAnalysis,
  YahooFinanceData,
  LearnedInvestmentCriteria,
  InvestmentStyle,
  RiskLevel,
  ExchangeRate,
  NormalizedPrices,
} from '@/types/stock-analysis';
import { convertToKRW } from './currency';
import { calculateMonthlyReturns } from './yahoo-finance';

const CONSERVATIVE_WEIGHTS = {
  returnRate: 0.30,
  fundamentals: 0.35,
  feasibility: 0.25,
  confidence: 0.10,
};

const AGGRESSIVE_WEIGHTS = {
  returnRate: 0.50,
  fundamentals: 0.20,
  feasibility: 0.20,
  confidence: 0.10,
};

export function normalizePrices(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  exchangeRate: ExchangeRate
): NormalizedPrices {
  const currentPriceKRW = convertToKRW(
    yahooData.currentPrice,
    yahooData.currency,
    exchangeRate
  );

  const targetPriceKRW = company.targetPrice
    ? convertToKRW(company.targetPrice, company.currency, exchangeRate)
    : currentPriceKRW;

  const recommendedBuyPriceKRW = company.recommendedBuyPrice
    ? convertToKRW(company.recommendedBuyPrice, company.currency, exchangeRate)
    : currentPriceKRW;

  return {
    currentPriceKRW,
    targetPriceKRW,
    recommendedBuyPriceKRW,
    exchangeRateUsed: exchangeRate.rate,
  };
}

export function calculateExpectedReturn(
  currentPrice: number,
  targetPrice: number,
  periodMonths: number,
  historicalVolatility: number
): number {
  if (currentPrice <= 0 || targetPrice <= 0) return 0;

  const baseReturn = ((targetPrice - currentPrice) / currentPrice) * 100;
  const volatilityDiscount = Math.max(0.3, 1 - historicalVolatility * 0.3);

  return baseReturn * volatilityDiscount;
}

export function calculateFundamentalsScore(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  criteria: LearnedInvestmentCriteria | null
): number {
  let score = 50;

  if (yahooData.trailingPE && yahooData.trailingPE > 0) {
    if (yahooData.trailingPE < 10) score += 15;
    else if (yahooData.trailingPE < 15) score += 10;
    else if (yahooData.trailingPE < 25) score += 5;
    else if (yahooData.trailingPE > 50) score -= 10;
  }

  if (yahooData.priceToBook && yahooData.priceToBook > 0) {
    if (yahooData.priceToBook < 1) score += 15;
    else if (yahooData.priceToBook < 2) score += 10;
    else if (yahooData.priceToBook < 3) score += 5;
    else if (yahooData.priceToBook > 5) score -= 5;
  }

  if (yahooData.returnOnEquity) {
    const roe = yahooData.returnOnEquity * 100;
    if (roe > 20) score += 15;
    else if (roe > 10) score += 10;
    else if (roe > 5) score += 5;
    else if (roe < 0) score -= 10;
  }

  if (yahooData.dividendYield && yahooData.dividendYield > 0) {
    const dy = yahooData.dividendYield * 100;
    if (dy > 4) score += 10;
    else if (dy > 2) score += 5;
  }

  if (criteria) {
    for (const range of criteria.idealMetricRanges) {
      const metricValue = getMetricValue(yahooData, range.metric);
      if (metricValue === null) continue;

      const inRange =
        (range.min === undefined || metricValue >= range.min) &&
        (range.max === undefined || metricValue <= range.max);

      if (inRange) score += 5;
      else score -= 3;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function getMetricValue(
  yahooData: YahooFinanceData,
  metric: string
): number | null {
  const metricMap: Record<string, number | undefined> = {
    per: yahooData.trailingPE,
    pbr: yahooData.priceToBook,
    roe: yahooData.returnOnEquity ? yahooData.returnOnEquity * 100 : undefined,
    eps: yahooData.trailingEps,
    dividendYield: yahooData.dividendYield
      ? yahooData.dividendYield * 100
      : undefined,
    forwardPE: yahooData.forwardPE,
  };

  return metricMap[metric] ?? null;
}

export function calculateFeasibilityScore(
  currentPrice: number,
  targetPrice: number,
  periodMonths: number,
  priceHistory: { date: Date; close: number; volume: number }[]
): number {
  if (currentPrice <= 0 || targetPrice <= 0) return 0;

  const requiredReturn = (targetPrice - currentPrice) / currentPrice;
  const monthlyReturns = calculateMonthlyReturns(priceHistory);

  if (monthlyReturns.length === 0) return 50;

  const avgMonthlyReturn =
    monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;

  if (avgMonthlyReturn <= 0) {
    return requiredReturn <= 0 ? 70 : 20;
  }

  const estimatedMonths = requiredReturn / avgMonthlyReturn;

  if (estimatedMonths <= periodMonths) return 90;
  if (estimatedMonths <= periodMonths * 1.5) return 60;
  if (estimatedMonths <= periodMonths * 2) return 30;
  return 10;
}

export function calculateFinalScore(params: {
  expectedReturnRate: number;
  fundamentalsScore: number;
  feasibilityScore: number;
  dataConfidence: number;
  style: InvestmentStyle;
}): number {
  const weights =
    params.style === 'aggressive' ? AGGRESSIVE_WEIGHTS : CONSERVATIVE_WEIGHTS;

  const returnScore = Math.min(100, Math.max(0, params.expectedReturnRate));
  const fundamentals = Math.min(100, Math.max(0, params.fundamentalsScore));
  const feasibility = Math.min(100, Math.max(0, params.feasibilityScore));
  const confidence = Math.min(100, Math.max(0, params.dataConfidence * 100));

  const finalScore =
    returnScore * weights.returnRate +
    fundamentals * weights.fundamentals +
    feasibility * weights.feasibility +
    confidence * weights.confidence;

  return Math.round(Math.max(0, Math.min(100, finalScore)));
}

export function assessRiskLevel(
  volatility: number,
  priceVsTarget: number,
  style: InvestmentStyle
): RiskLevel {
  if (style === 'conservative') {
    if (volatility > 0.3 || priceVsTarget > 0.9) return 'high';
    if (volatility > 0.15 || priceVsTarget > 0.7) return 'medium';
    return 'low';
  }

  if (volatility > 0.5 || priceVsTarget > 0.95) return 'high';
  if (volatility > 0.3 || priceVsTarget > 0.85) return 'medium';
  return 'low';
}

export function calculateConfidenceScore(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData
): number {
  let confidence = company.confidence;

  if (yahooData.targetMeanPrice) confidence += 0.1;
  if (yahooData.trailingPE) confidence += 0.05;
  if (yahooData.priceToBook) confidence += 0.05;
  if (yahooData.returnOnEquity) confidence += 0.05;
  if (yahooData.priceHistory.length > 60) confidence += 0.1;
  else if (yahooData.priceHistory.length > 20) confidence += 0.05;

  if (company.sources.length > 3) confidence += 0.1;
  else if (company.sources.length > 1) confidence += 0.05;

  return Math.min(1, confidence);
}
