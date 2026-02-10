import type {
  ExtractedCompanyAnalysis,
  YahooFinanceData,
  LearnedInvestmentCriteria,
  InvestmentStyle,
  RiskLevel,
  ExchangeRate,
  NormalizedPrices,
  InvestmentStrategy,
} from '@/types/stock-analysis';
import { convertToKRW, convertCurrency } from './currency';
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

  let targetPrice = company.targetPrice;
  
  if (!targetPrice && yahooData.targetMeanPrice) {
    targetPrice = yahooData.targetMeanPrice;
    if (yahooData.currency !== company.currency) {
      targetPrice = convertCurrency(targetPrice, yahooData.currency, company.currency, exchangeRate);
    }
  }

  const targetPriceKRW = targetPrice
    ? convertToKRW(targetPrice, company.currency, exchangeRate)
    : currentPriceKRW * 1.2;

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

export function calculateStrategyScore(
  yahooData: YahooFinanceData,
  strategy: InvestmentStrategy | null
): number {
  if (!strategy) return 50;

  let score = 50;

  for (const condition of strategy.longTermConditions) {
    if (condition.toLowerCase().includes('roe') && (yahooData.returnOnEquity ?? 0) > 0.15) score += 10;
    if (condition.toLowerCase().includes('pe') && (yahooData.trailingPE ?? 100) < 20) score += 5;
    if (condition.toLowerCase().includes('cap') && (yahooData.marketCap ?? 0) > 1000000000) score += 5;
  }

  for (const pattern of strategy.winningPatterns) {
    if (pattern.toLowerCase().includes('growth') && (yahooData.trailingEps ?? 0) > 0) score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateFinalScore(params: {
  expectedReturnRate: number;
  fundamentalsScore: number;
  feasibilityScore: number;
  strategyScore?: number;
  dataConfidence: number;
  style: InvestmentStyle;
}): number {
  const weights =
    params.style === 'aggressive' ? AGGRESSIVE_WEIGHTS : CONSERVATIVE_WEIGHTS;

  const returnScore = Math.min(100, Math.max(0, params.expectedReturnRate));
  const fundamentals = Math.min(100, Math.max(0, params.fundamentalsScore));
  const feasibility = Math.min(100, Math.max(0, params.feasibilityScore));
  const strategy = Math.min(100, Math.max(0, params.strategyScore ?? 50));
  const confidence = Math.min(100, Math.max(0, params.dataConfidence * 100));

  const finalScore =
    returnScore * (weights.returnRate * 0.8) +
    fundamentals * (weights.fundamentals * 0.8) +
    feasibility * (weights.feasibility * 0.8) +
    strategy * 0.2 +
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
): { score: number; details: string[] } {
  let score = company.confidence;
  const details: string[] = [`기초 데이터 신뢰도 (${(company.confidence * 100).toFixed(0)}%)`];

  if (yahooData.targetMeanPrice) {
    score += 0.1;
    details.push('분석가 목표가 존재 (+10%)');
  }
  if (yahooData.trailingPE) {
    score += 0.05;
    details.push('실시간 PER 데이터 확인 (+5%)');
  }
  if (yahooData.priceToBook) {
    score += 0.05;
    details.push('실시간 PBR 데이터 확인 (+5%)');
  }
  if (yahooData.returnOnEquity) {
    score += 0.05;
    details.push('실시간 ROE 데이터 확인 (+5%)');
  }
  if (yahooData.priceHistory.length > 60) {
    score += 0.1;
    details.push('충분한 히스토리컬 데이터 보유 (+10%)');
  } else if (yahooData.priceHistory.length > 20) {
    score += 0.05;
    details.push('기초 히스토리컬 데이터 보유 (+5%)');
  }

  if (company.sources.length > 3) {
    score += 0.1;
    details.push('다수의 분석 자료 근거 보유 (+10%)');
  } else if (company.sources.length > 1) {
    score += 0.05;
    details.push('복수의 분석 자료 근거 보유 (+5%)');
  }

  return { 
    score: Math.min(1, score), 
    details 
  };
}
