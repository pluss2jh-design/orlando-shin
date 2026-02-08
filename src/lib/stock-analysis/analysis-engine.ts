import type {
  ExtractedCompanyAnalysis,
  InvestmentConditions,
  LearnedInvestmentCriteria,
  InvestmentStyle,
  FilteredCandidate,
  RecommendationResult,
  SourceReference,
} from '@/types/stock-analysis';
import { fetchExchangeRate } from './currency';
import {
  resolveTickerSymbol,
  fetchYahooFinanceData,
  calculateHistoricalVolatility,
} from './yahoo-finance';
import {
  filterStage1Validity,
  filterStage2PriceCheck,
  filterStage3Affordability,
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
import { buildEvidenceChain } from './evidence-chain';

export async function runAnalysisEngine(
  candidates: ExtractedCompanyAnalysis[],
  conditions: InvestmentConditions,
  criteria: LearnedInvestmentCriteria | null = null,
  style: InvestmentStyle = 'moderate'
): Promise<RecommendationResult> {
  const exchangeRate = await fetchExchangeRate();
  const allSourcesUsed: SourceReference[] = [];
  const filteredCandidates: FilteredCandidate[] = [];

  for (const company of candidates) {
    try {
      const ticker = await resolveTickerSymbol(company.companyName, company.market);

      const stage1 = filterStage1Validity(company, ticker);
      if (!stage1.passed || !ticker) {
        filteredCandidates.push(
          createFailedCandidate(company, [stage1])
        );
        continue;
      }

      const yahooData = await fetchYahooFinanceData(ticker, conditions.periodMonths);

      const stage2 = filterStage2PriceCheck(company, yahooData, exchangeRate);
      if (!stage2.passed) {
        filteredCandidates.push(
          createFailedCandidate(company, [stage1, stage2])
        );
        continue;
      }

      const stage3 = filterStage3Affordability(
        company,
        yahooData,
        conditions.amount,
        exchangeRate
      );
      if (!stage3.passed) {
        filteredCandidates.push(
          createFailedCandidate(company, [stage1, stage2, stage3])
        );
        continue;
      }

      const stage4 = filterStage4PeriodFeasibility(
        company,
        yahooData,
        conditions.periodMonths,
        exchangeRate
      );

      const filterResults = [stage1, stage2, stage3, stage4];
      const passedAllFilters = filterResults.every((r) => r.passed);

      const prices = normalizePrices(company, yahooData, exchangeRate);
      const volatility = calculateHistoricalVolatility(yahooData.priceHistory);

      const expectedReturnRate = calculateExpectedReturn(
        prices.currentPriceKRW,
        prices.targetPriceKRW,
        conditions.periodMonths,
        volatility
      );

      const fundamentalsScore = calculateFundamentalsScore(
        company,
        yahooData,
        criteria
      );

      const feasibilityScore = calculateFeasibilityScore(
        prices.currentPriceKRW,
        prices.targetPriceKRW,
        conditions.periodMonths,
        yahooData.priceHistory
      );

      const confidenceScore = calculateConfidenceScore(company, yahooData);

      const score = calculateFinalScore({
        expectedReturnRate,
        fundamentalsScore,
        feasibilityScore,
        dataConfidence: confidenceScore,
        style,
      });

      const priceVsTarget = prices.targetPriceKRW > 0
        ? prices.currentPriceKRW / prices.targetPriceKRW
        : 1;
      const riskLevel = assessRiskLevel(volatility, priceVsTarget, style);

      buildEvidenceChain(
        company,
        yahooData,
        prices,
        filterResults,
        criteria
      );

      allSourcesUsed.push(...company.sources);

      filteredCandidates.push({
        company,
        yahooData,
        normalizedPrices: prices,
        filterResults,
        passedAllFilters,
        score,
        expectedReturnRate,
        confidenceScore,
        riskLevel,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      filteredCandidates.push(
        createFailedCandidate(company, [
          {
            stage: 0,
            stageName: '데이터 조회',
            passed: false,
            reason: `데이터 조회 실패: ${errorMsg}`,
          },
        ])
      );
    }
  }

  const passedCandidates = filteredCandidates
    .filter((c) => c.passedAllFilters)
    .sort((a, b) => b.score - a.score);

  const allCandidates = filteredCandidates.sort((a, b) => b.score - a.score);

  const topPick = passedCandidates.length > 0 ? passedCandidates[0] : null;

  const summary = generateSummary(topPick, passedCandidates.length, candidates.length);

  return {
    candidates: allCandidates,
    topPick,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary,
    allSourcesUsed: deduplicateSources(allSourcesUsed),
  };
}

function createFailedCandidate(
  company: ExtractedCompanyAnalysis,
  filterResults: { stage: number; stageName: string; passed: boolean; reason: string }[]
): FilteredCandidate {
  return {
    company,
    yahooData: {
      ticker: '',
      currency: company.currency,
      currentPrice: 0,
      previousClose: 0,
      fiftyTwoWeekHigh: 0,
      fiftyTwoWeekLow: 0,
      priceHistory: [],
      fetchedAt: new Date(),
    },
    normalizedPrices: {
      currentPriceKRW: 0,
      targetPriceKRW: 0,
      recommendedBuyPriceKRW: 0,
    },
    filterResults,
    passedAllFilters: false,
    score: 0,
    expectedReturnRate: 0,
    confidenceScore: 0,
    riskLevel: 'high',
  };
}

function generateSummary(
  topPick: FilteredCandidate | null,
  passedCount: number,
  totalCount: number
): string {
  if (!topPick) {
    return `총 ${totalCount}개 후보 기업 중 모든 필터를 통과한 기업이 없습니다. 투자 조건을 조정해보세요.`;
  }

  return (
    `총 ${totalCount}개 후보 중 ${passedCount}개 기업이 필터를 통과했습니다. ` +
    `최우선 추천: ${topPick.company.companyName} ` +
    `(예상 수익률: ${topPick.expectedReturnRate.toFixed(1)}%, ` +
    `신뢰도: ${(topPick.confidenceScore * 100).toFixed(0)}%, ` +
    `리스크: ${topPick.riskLevel})`
  );
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
