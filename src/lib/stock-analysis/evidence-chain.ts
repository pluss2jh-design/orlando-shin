import type {
  ExtractedCompanyAnalysis,
  YahooFinanceData,
  FilterStageResult,
  LearnedInvestmentCriteria,
  EvidenceChain,
  EvidenceFactor,
  RealTimeCheck,
  NormalizedPrices,
} from '@/types/stock-analysis';

export function buildEvidenceChain(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  normalizedPrices: NormalizedPrices,
  filterResults: FilterStageResult[],
  criteria: LearnedInvestmentCriteria | null
): EvidenceChain {
  const factors = buildEvidenceFactors(company, criteria);
  const realTimeChecks = buildRealTimeChecks(company, yahooData, normalizedPrices);
  const decision = buildDecisionSummary(company, filterResults);

  return { decision, factors, realTimeChecks };
}

function buildEvidenceFactors(
  company: ExtractedCompanyAnalysis,
  criteria: LearnedInvestmentCriteria | null
): EvidenceFactor[] {
  const factors: EvidenceFactor[] = [];

  if (company.investmentThesis && company.sources.length > 0) {
    factors.push({
      factor: '투자 논거',
      value: company.investmentThesis,
      source: company.sources[0],
      weight: 0.3,
    });
  }

  if (company.targetPrice && company.sources.length > 0) {
    const source = company.sources.find(
      (s) => s.content.includes('목표') || s.content.includes('target')
    ) ?? company.sources[0];

    factors.push({
      factor: '목표가',
      value: `${company.currency} ${company.targetPrice.toLocaleString()}`,
      source,
      weight: 0.25,
    });
  }

  if (company.recommendedBuyPrice && company.sources.length > 0) {
    factors.push({
      factor: '매수 추천가',
      value: `${company.currency} ${company.recommendedBuyPrice.toLocaleString()}`,
      source: company.sources[0],
      weight: 0.2,
    });
  }

  if (company.metrics.per && company.sources.length > 0) {
    factors.push({
      factor: 'PER',
      value: `${company.metrics.per}`,
      source: company.sources[company.sources.length > 1 ? 1 : 0],
      weight: 0.1,
    });
  }

  if (company.metrics.roe && company.sources.length > 0) {
    factors.push({
      factor: 'ROE',
      value: `${company.metrics.roe}%`,
      source: company.sources[company.sources.length > 1 ? 1 : 0],
      weight: 0.1,
    });
  }

  if (criteria) {
    for (const rule of criteria.goodCompanyRules) {
      factors.push({
        factor: `투자 기준: ${rule.rule}`,
        value: '교육 자료 기반 판단 기준',
        source: rule.source,
        weight: rule.weight * 0.05,
      });
    }
  }

  for (const riskFactor of company.riskFactors) {
    if (company.sources.length > 0) {
      factors.push({
        factor: `리스크: ${riskFactor}`,
        value: riskFactor,
        source: company.sources[0],
        weight: -0.05,
      });
    }
  }

  return factors;
}

function buildRealTimeChecks(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  normalizedPrices: NormalizedPrices
): RealTimeCheck[] {
  const checks: RealTimeCheck[] = [];

  checks.push({
    metric: '현재 주가',
    materialValue: company.recommendedBuyPrice
      ? `매수추천가 ${company.currency} ${company.recommendedBuyPrice.toLocaleString()}`
      : '자료 없음',
    realTimeValue: `${yahooData.currency} ${yahooData.currentPrice.toLocaleString()}`,
    status: determineStatus(
      normalizedPrices.currentPriceKRW,
      normalizedPrices.recommendedBuyPriceKRW,
      'lower_is_better'
    ),
  });

  if (company.targetPrice) {
    checks.push({
      metric: '목표가 대비',
      materialValue: `목표가 ${company.currency} ${company.targetPrice.toLocaleString()}`,
      realTimeValue: `현재가 ${yahooData.currency} ${yahooData.currentPrice.toLocaleString()}`,
      status: normalizedPrices.currentPriceKRW < normalizedPrices.targetPriceKRW
        ? 'favorable'
        : 'unfavorable',
    });
  }

  if (company.metrics.per && yahooData.trailingPE) {
    checks.push({
      metric: 'PER',
      materialValue: `자료: ${company.metrics.per}`,
      realTimeValue: `실시간: ${yahooData.trailingPE.toFixed(2)}`,
      status: Math.abs(company.metrics.per - yahooData.trailingPE) / company.metrics.per < 0.2
        ? 'favorable'
        : 'neutral',
    });
  }

  if (company.metrics.pbr && yahooData.priceToBook) {
    checks.push({
      metric: 'PBR',
      materialValue: `자료: ${company.metrics.pbr}`,
      realTimeValue: `실시간: ${yahooData.priceToBook.toFixed(2)}`,
      status: yahooData.priceToBook <= company.metrics.pbr ? 'favorable' : 'neutral',
    });
  }

  if (yahooData.targetMeanPrice) {
    checks.push({
      metric: '애널리스트 컨센서스',
      materialValue: company.targetPrice
        ? `내 자료 목표가 ${company.currency} ${company.targetPrice.toLocaleString()}`
        : '자료 없음',
      realTimeValue: `Yahoo 컨센서스 ${yahooData.currency} ${yahooData.targetMeanPrice.toLocaleString()}`,
      status: yahooData.currentPrice < yahooData.targetMeanPrice ? 'favorable' : 'unfavorable',
    });
  }

  return checks;
}

function determineStatus(
  current: number,
  reference: number,
  direction: 'lower_is_better' | 'higher_is_better'
): 'favorable' | 'neutral' | 'unfavorable' {
  if (reference <= 0) return 'neutral';

  const ratio = current / reference;

  if (direction === 'lower_is_better') {
    if (ratio < 0.95) return 'favorable';
    if (ratio > 1.15) return 'unfavorable';
    return 'neutral';
  }

  if (ratio > 1.05) return 'favorable';
  if (ratio < 0.85) return 'unfavorable';
  return 'neutral';
}

function buildDecisionSummary(
  company: ExtractedCompanyAnalysis,
  filterResults: FilterStageResult[]
): string {
  const passedAll = filterResults.every((r) => r.passed);
  const failedStages = filterResults.filter((r) => !r.passed);

  if (passedAll) {
    return `${company.companyName}: 모든 필터 통과 - 매수 유효`;
  }

  const failedNames = failedStages.map((s) => s.stageName).join(', ');
  return `${company.companyName}: ${failedNames} 단계에서 제외됨`;
}
