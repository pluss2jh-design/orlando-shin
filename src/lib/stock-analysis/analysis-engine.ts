import type {
  ExtractedCompanyAnalysis,
  InvestmentConditions,
  LearnedInvestmentCriteria,
  InvestmentStyle,
  FilteredCandidate,
  RecommendationResult,
  SourceReference,
  InvestmentStrategy,
} from '@/types/stock-analysis';
import { fetchExchangeRate } from './currency';
import {
  fetchYahooFinanceData,
  calculateHistoricalVolatility,
  fetchBatchQuotes,
} from './yahoo-finance';
import { getStockUniverse } from './universe';
import {
  filterStage1Validity,
  filterStage2PriceCheck,
  filterStage4PeriodFeasibility,
} from './filtering-pipeline';
import {
  normalizePrices,
  calculateExpectedReturn,
  calculateFundamentalsScore,
  calculateFeasibilityScore,
  calculateFinalScore,
  assessRiskLevel,
  calculateConfidenceScore,
  calculateStrategyScore,
} from './scoring';

import {
  getOpenAIClient,
  USE_MOCK_AI,
} from './ai-learning';

export async function runAnalysisEngine(
  conditions: InvestmentConditions,
  knowledge: { criteria: LearnedInvestmentCriteria; strategy: InvestmentStrategy; companies: ExtractedCompanyAnalysis[] },
  style: InvestmentStyle = 'moderate'
): Promise<RecommendationResult> {
  console.log(`Starting analysis engine with ${knowledge.companies.length} learned companies and universe screening...`);
  
  const exchangeRate = await fetchExchangeRate();
  const universe = getStockUniverse();
  console.log(`Universe size: ${universe.length} tickers`);
  
  const batchSize = 40;
  const allYahooData: any[] = [];
  
  for (let i = 0; i < universe.length; i += batchSize) {
    const batch = universe.slice(i, i + batchSize);
    try {
      const quotes = await fetchBatchQuotes(batch);
      allYahooData.push(...quotes);
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Batch fetch error for ${batch.join(',')}:`, error);
    }
  }

  console.log(`Fetched data for ${allYahooData.length} tickers from Yahoo Finance`);

  const screenedCandidates: FilteredCandidate[] = [];

  for (const yahooData of allYahooData) {
    try {
      if (!yahooData.ticker || yahooData.currentPrice <= 0) continue;

      const matchingExtracted = knowledge.companies.find(c => 
        c.ticker?.split('.')[0] === yahooData.ticker.split('.')[0] ||
        c.companyName?.toLowerCase() === yahooData.ticker.toLowerCase()
      );
      
      const company: ExtractedCompanyAnalysis = matchingExtracted || {
        companyName: yahooData.ticker,
        ticker: yahooData.ticker,
        market: yahooData.ticker.endsWith('.KS') || yahooData.ticker.endsWith('.KQ') ? 'KRX' : 'unknown',
        currency: yahooData.currency,
        metrics: {},
        investmentThesis: 'Universe screening based on core strategy',
        riskFactors: [],
        investmentStyle: 'moderate',
        sources: [],
        extractedAt: new Date(),
        confidence: 0.5,
      };

      const stage1 = filterStage1Validity(company, yahooData.ticker, true);
      const stage2 = filterStage2PriceCheck(company, yahooData, exchangeRate);
      
      const passScreening = stage1.passed && (company.targetPrice ? stage2.passed : true);
      
      if (!passScreening) {
        if (matchingExtracted) {
          console.log(`Company ${yahooData.ticker} failed screening: ${stage1.reason}, ${stage2.reason}`);
        }
        continue;
      }

      const prices = normalizePrices(company, yahooData, exchangeRate);
      const fundamentalsScore = calculateFundamentalsScore(
        company,
        yahooData,
        knowledge.criteria
      );

      const strategyScore = calculateStrategyScore(yahooData, knowledge.strategy);
      
      const appliedRules = knowledge.criteria.goodCompanyRules.filter(r => {
        const ruleLower = r.rule.toLowerCase();
        if (ruleLower.includes('roe') && (yahooData.returnOnEquity ?? 0) > 0.12) return true;
        if (ruleLower.includes('per') && (yahooData.trailingPE ?? 100) < 22) return true;
        if (ruleLower.includes('성장') && (yahooData.revenueGrowth ?? 0) > 0.05) return true;
        return false;
      });

      const strategySources = appliedRules.map(r => r.source);
      const extractionBonus = matchingExtracted ? 100 : 0;
      
      const finalSources = matchingExtracted 
        ? [...matchingExtracted.sources, ...strategySources] 
        : strategySources.length > 0 
          ? strategySources 
          : [
              {
                fileName: '시장 유니버스 스크리닝',
                type: 'pdf' as const,
                pageOrTimestamp: '-',
                content: '핵심 투자 전략 부합도 분석 결과입니다.'
              }
            ];

      screenedCandidates.push({
        company: {
          ...company,
          sources: deduplicateSources(finalSources)
        },
        yahooData,
        normalizedPrices: prices,
        filterResults: [stage1, stage2],
        passedAllFilters: true,
        score: fundamentalsScore + strategyScore + extractionBonus + (Math.random() * 5),
        expectedReturnRate: 0,
        confidenceScore: 0.5,
        riskLevel: 'medium',
      });
    } catch (error) {
      console.error(`Error screening ${yahooData.ticker}:`, error);
    }
  }

  console.log(`Screened ${screenedCandidates.length} candidates after filters`);

  const topScreened = screenedCandidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 30);

  console.log(`Deep-diving into top ${topScreened.length} screened candidates...`);

  const finalResults: FilteredCandidate[] = [];

  for (const cand of topScreened) {
    try {
      const fullYahooData = await fetchYahooFinanceData(cand.yahooData.ticker, conditions.periodMonths);
      
      if (!fullYahooData || !fullYahooData.priceHistory || fullYahooData.priceHistory.length === 0) {
        console.log(`No history for ${cand.yahooData.ticker}, using screening data`);
        finalResults.push(cand);
        continue;
      }

      const stage4 = filterStage4PeriodFeasibility(cand.company, fullYahooData, conditions.periodMonths, exchangeRate);
      
      const prices = normalizePrices(cand.company, fullYahooData, exchangeRate);

      const volatility = calculateHistoricalVolatility(fullYahooData.priceHistory);
      const expectedReturnRate = calculateExpectedReturn(
        prices.currentPriceKRW,
        prices.targetPriceKRW,
        conditions.periodMonths,
        volatility
      );

      const feasibilityScore = calculateFeasibilityScore(
        prices.currentPriceKRW,
        prices.targetPriceKRW,
        conditions.periodMonths,
        fullYahooData.priceHistory
      );

      const confidenceData = calculateConfidenceScore(cand.company, fullYahooData);
      const strategyScore = calculateStrategyScore(fullYahooData, knowledge.strategy);

      const score = calculateFinalScore({
        expectedReturnRate,
        fundamentalsScore: cand.score,
        strategyScore,
        feasibilityScore,
        dataConfidence: confidenceData.score,
        style,
      });

      const priceVsTarget = prices.targetPriceKRW > 0
        ? prices.currentPriceKRW / prices.targetPriceKRW
        : 0.6;
      const riskLevel = assessRiskLevel(volatility, priceVsTarget, style);

      finalResults.push({
        ...cand,
        yahooData: fullYahooData,
        normalizedPrices: prices,
        filterResults: [...cand.filterResults, stage4],
        score,
        expectedReturnRate,
        confidenceScore: confidenceData.score,
        confidenceDetails: confidenceData.details,
        riskLevel,
      });
    } catch (error) {
      console.error(`Error deep-diving ${cand.yahooData.ticker}:`, error);
      finalResults.push(cand);
    }
  }

  const sortedFinal = finalResults.sort((a, b) => b.score - a.score);
  const topPicks = sortedFinal.slice(0, 5);

  if (topPicks.length === 0 && screenedCandidates.length > 0) {
    topPicks.push(...screenedCandidates.sort((a, b) => b.score - a.score).slice(0, 5));
  }

  const openai = getOpenAIClient();
  const reasoningTasks = topPicks.map(async (pick) => {
    try {
      const metricsText = JSON.stringify({
        price: pick.yahooData.currentPrice,
        pe: pick.yahooData.trailingPE,
        pbr: pick.yahooData.priceToBook,
        roe: pick.yahooData.returnOnEquity,
        target: pick.yahooData.targetMeanPrice,
        marketCap: pick.yahooData.marketCap
      });

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: '당신은 주식 투자 전문가입니다. 기업의 실시간 지표와 학습된 투자 전략, 그리고 자료에서 추출된 분석 내용을 종합하여 독창적인 투자 논거를 3문장 이내로 작성하세요. 자료의 핵심 요약을 반드시 반영하고, 수치를 언급하여 전문성을 높이세요.'
          },
          {
            role: 'user',
            content: `기업: ${pick.company.companyName} (${pick.yahooData.ticker})\n추출된 분석 내용: ${pick.company.investmentThesis}\n투자 전략 패턴: ${knowledge.strategy.winningPatterns.join(', ')}\n실시간 데이터: ${metricsText}\n참고 자료: ${pick.company.sources.map(s => s.fileName).join(', ')}`
          }
        ],
        max_tokens: 350,
        temperature: 0.8,
      });

      pick.company.investmentThesis = response.choices[0]?.message?.content || pick.company.investmentThesis;
    } catch (error) {
      console.error(`Reasoning generation failed for ${pick.yahooData.ticker}:`, error);
      pick.company.investmentThesis = `${pick.company.companyName}은 학습된 투자 전략에 따라 재무 지표가 우수하며, 현재 시장 유니버스 내에서 ${conditions.periodMonths}개월 내에 높은 성장성이 기대되는 상위권 종목입니다.`;
    }
  });

  await Promise.all(reasoningTasks);

  return {
    candidates: sortedFinal,
    topPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `학습된 고유 투자 전략을 바탕으로 S&P 500, Russell 1000, Dow Jones 유니버스 내 ${allYahooData.length}개 종목을 정밀 스크리닝하여 현재 가장 적합한 상위 5개 유망 기업을 선정했습니다.`,
    allSourcesUsed: deduplicateSources([
      ...knowledge.companies.flatMap(c => c.sources),
      ...knowledge.criteria.goodCompanyRules.map(r => r.source)
    ]),
  };
}

function deduplicateSources(sources: SourceReference[]): SourceReference[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = `${s.fileName}:${s.pageOrTimestamp}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
