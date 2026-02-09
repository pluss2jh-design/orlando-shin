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
} from './scoring';

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

      screenedCandidates.push({
        company,
        yahooData,
        normalizedPrices: prices,
        filterResults: [stage1, stage2],
        passedAllFilters: true,
        score: fundamentalsScore,
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
      
      const volatility = calculateHistoricalVolatility(fullYahooData.priceHistory);
      const expectedReturnRate = calculateExpectedReturn(
        cand.normalizedPrices.currentPriceKRW,
        cand.normalizedPrices.targetPriceKRW || cand.normalizedPrices.currentPriceKRW * 1.5,
        conditions.periodMonths,
        volatility
      );

      const feasibilityScore = calculateFeasibilityScore(
        cand.normalizedPrices.currentPriceKRW,
        cand.normalizedPrices.targetPriceKRW || cand.normalizedPrices.currentPriceKRW * 1.5,
        conditions.periodMonths,
        fullYahooData.priceHistory
      );

      const confidenceScore = calculateConfidenceScore(cand.company, fullYahooData);

      const score = calculateFinalScore({
        expectedReturnRate,
        fundamentalsScore: cand.score,
        feasibilityScore,
        dataConfidence: confidenceScore,
        style,
      });

      const priceVsTarget = cand.normalizedPrices.targetPriceKRW > 0
        ? cand.normalizedPrices.currentPriceKRW / cand.normalizedPrices.targetPriceKRW
        : 0.6;
      const riskLevel = assessRiskLevel(volatility, priceVsTarget, style);

      finalResults.push({
        ...cand,
        yahooData: fullYahooData,
        filterResults: [...cand.filterResults, stage4],
        score,
        expectedReturnRate,
        confidenceScore,
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
    console.log("Forcing top picks from screened candidates due to empty final results");
    topPicks.push(...screenedCandidates.sort((a, b) => b.score - a.score).slice(0, 5));
  }

  console.log(`Analysis complete. Found ${topPicks.length} top picks.`);

  return {
    candidates: sortedFinal,
    topPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `시장 유니버스(S&P 500, Russell 1000, Dow Jones)를 대상으로 핵심 전략 조건에 부합하는 상위 5개 기업을 선정했습니다.`,
    allSourcesUsed: deduplicateSources(knowledge.companies.flatMap(c => c.sources)),
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
