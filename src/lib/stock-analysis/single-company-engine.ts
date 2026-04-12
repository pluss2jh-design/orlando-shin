/**
 * 단일 기업 심층 분석 엔진
 * 유니버스 스캔 없이 특정 ticker 1개에 대해 즉시 AI 분석을 수행합니다.
 */
import type {
  InvestmentConditions,
  LearnedKnowledge,
  AnalysisResult,
  YahooFinanceData,
  RuleScore,
  MacroContext,
} from '@/types/stock-analysis';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';
import { fetchYahooFinanceData } from './yahoo-finance';
import { fetchExchangeRate } from './currency';
import {
  fetchMarketMacroContext,
  analyzeStockSentiment,
  predictStockGrowth,
  generateExpertVerdict,
} from './market-context';
import { evaluateQuantifiedRule } from './analysis-engine';

/**
 * ticker가 Yahoo Finance에서 유효한지 검증합니다.
 * 현재가 또는 시장가가 0 이상이면 유효로 간주합니다.
 */
export async function validateTicker(ticker: string): Promise<{
  valid: boolean;
  companyName?: string;
  error?: string;
}> {
  try {
    const data = await fetchYahooFinanceData(ticker.toUpperCase());
    if (!data || (data.currentPrice <= 0 && data.previousClose <= 0)) {
      return { valid: false, error: `${ticker} 에 대한 가격 데이터를 찾을 수 없습니다.` };
    }
    return { valid: true, companyName: data.ticker };
  } catch (e: any) {
    return { valid: false, error: `${ticker} 검증 실패: ${e.message}` };
  }
}
/**
 * 단일 기업 분석을 실행합니다.
 */
export async function runSingleCompanyAnalysis(
  ticker: string,
  conditions: InvestmentConditions,
  knowledge: LearnedKnowledge,
  newsAiModel?: string,
  fallbackAiModel?: string,
  newsApiKey?: string
): Promise<AnalysisResult> {
  const asOfDate = conditions.asOfDate;
  const normalizedTicker = ticker.trim().toUpperCase();

  // 1. Yahoo Finance 데이터 수집
  const yahooData = await fetchYahooFinanceData(normalizedTicker, asOfDate);
  if (!yahooData) throw new Error(`${normalizedTicker}: Yahoo Finance 데이터를 가져올 수 없습니다.`);

  // 2. 환율 + 매크로 컨텍스트
  await fetchExchangeRate();
  const macroContext = await fetchMarketMacroContext(asOfDate);
  
  const allRules = knowledge.criteria?.criterias || [];
  const ruleScores: RuleScore[] = [];
  let weightedScoreSum = 0;
  let totalWeightSum = 0;

  for (const rule of allRules) {
    const scoreResult = evaluateQuantifiedRule(rule, yahooData as any, undefined, macroContext);
    ruleScores.push(scoreResult);
    weightedScoreSum += scoreResult.score * (rule.weight || 1);
    totalWeightSum += (rule.weight || 1);
  }

  const normalizedScore = totalWeightSum > 0 ? (weightedScoreSum / totalWeightSum) : 0; // 0~10 scale

  // 4. AI 심층 분석
  const sentiment = await analyzeStockSentiment(normalizedTicker, newsAiModel, newsApiKey, asOfDate, fallbackAiModel);
  if (!sentiment) throw new Error(`${normalizedTicker}: 감성 분석에 실패했습니다.`);

  const prediction = await predictStockGrowth(normalizedTicker, yahooData, macroContext, sentiment, newsAiModel, newsApiKey, fallbackAiModel);
  if (!prediction) throw new Error(`${normalizedTicker}: 예측 분석에 실패했습니다.`);

  const expertVerdict = await generateExpertVerdict(
    normalizedTicker,
    yahooData,
    macroContext,
    sentiment,
    prediction,
    knowledge,
    newsAiModel,
    newsApiKey,
    fallbackAiModel
  );

  const sentimentImpact = (sentiment.score / 10);
  const adjustedScore = Math.max(0, Math.min(10, normalizedScore + sentimentImpact));

  // 신규 상장 여부
  const ipoDate = yahooData.ipoDate;
  const now = new Date();
  const listingStatus: 'new_listing' | 'normal' =
    ipoDate && asOfDate && ipoDate > asOfDate && ipoDate <= now ? 'new_listing' : 'normal';

  return {
    ticker: normalizedTicker,
    companyName: normalizedTicker,
    price: yahooData.currentPrice,
    change: yahooData.previousClose
      ? ((yahooData.currentPrice - yahooData.previousClose) / yahooData.previousClose) * 100
      : 0,
    marketCap: yahooData.marketCap || 0,
    pe: yahooData.trailingPE,
    sector: yahooData.sector,
    description: sentiment.summary.slice(0, 100),
    score: Math.round(adjustedScore * 10),
    totalRuleScore: Math.round(normalizedScore * 10),
    maxPossibleScore: 100,
    recommendation: adjustedScore >= 8 ? 'STRONG_BUY' : adjustedScore >= 6 ? 'BUY' : 'HOLD',
    metrics: { roe: yahooData.returnOnEquity },
    rules: ruleScores,
    investmentThesis: `[단일 기업 분석] ${normalizedTicker} — ${sentiment.summary}`,
    returnRates: yahooData.returnRates,
    market: (yahooData as any).market || 'NYSE',
    riskLevel: expertVerdict?.riskLevel,
    riskFactors: expertVerdict?.risks,
    expertVerdict,
    sources: ruleScores.map((r: any) => r.source).filter(Boolean),
    track: 'A',
    isSpeculative: false,
    sentiment,
    prediction,
    macroContext,
    yahooData,
    fetchedAt: new Date(),
    extractedAt: new Date(),
    ipoDate,
    listingStatus,
    timeLabel: conditions.timeLabel,
  } as AnalysisResult;
}
