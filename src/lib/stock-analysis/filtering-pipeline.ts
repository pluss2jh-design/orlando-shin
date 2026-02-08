import type {
  ExtractedCompanyAnalysis,
  YahooFinanceData,
  FilterStageResult,
  ExchangeRate,
} from '@/types/stock-analysis';
import { convertToKRW } from './currency';
import { calculateMonthlyReturns } from './yahoo-finance';
import { normalizePrices } from './scoring';

export function filterStage1Validity(
  company: ExtractedCompanyAnalysis,
  ticker: string | null
): FilterStageResult {
  if (!ticker) {
    return {
      stage: 1,
      stageName: '유효성 검증',
      passed: false,
      reason: `${company.companyName}: Yahoo Finance에서 종목을 찾을 수 없음`,
    };
  }

  if (!company.targetPrice && !company.recommendedBuyPrice) {
    return {
      stage: 1,
      stageName: '유효성 검증',
      passed: false,
      reason: `${company.companyName}: 목표가 또는 매수추천가 정보가 없음`,
    };
  }

  return {
    stage: 1,
    stageName: '유효성 검증',
    passed: true,
    reason: `${company.companyName}: 티커 ${ticker} 매칭, 가격 데이터 확인됨`,
  };
}

export function filterStage2PriceCheck(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  exchangeRate: ExchangeRate
): FilterStageResult {
  const prices = normalizePrices(company, yahooData, exchangeRate);

  if (company.targetPrice && prices.currentPriceKRW >= prices.targetPriceKRW) {
    return {
      stage: 2,
      stageName: '가격 필터',
      passed: false,
      reason: `현재가(${formatKRW(prices.currentPriceKRW)})가 이미 목표가(${formatKRW(prices.targetPriceKRW)})를 초과 - 상승 여력 없음`,
    };
  }

  if (
    company.recommendedBuyPrice &&
    prices.currentPriceKRW > prices.recommendedBuyPriceKRW * 1.15
  ) {
    return {
      stage: 2,
      stageName: '가격 필터',
      passed: true,
      reason: `현재가가 매수추천가 대비 15% 이상 높음 - 감점 적용 (현재가: ${formatKRW(prices.currentPriceKRW)}, 매수추천가: ${formatKRW(prices.recommendedBuyPriceKRW)})`,
    };
  }

  if (
    company.recommendedBuyPrice &&
    prices.currentPriceKRW < prices.recommendedBuyPriceKRW * 0.85
  ) {
    return {
      stage: 2,
      stageName: '가격 필터',
      passed: true,
      reason: `현재가가 매수추천가 대비 급락 중 - 추가 검증 필요 (현재가: ${formatKRW(prices.currentPriceKRW)}, 매수추천가: ${formatKRW(prices.recommendedBuyPriceKRW)})`,
    };
  }

  return {
    stage: 2,
    stageName: '가격 필터',
    passed: true,
    reason: `가격 조건 충족 (현재가: ${formatKRW(prices.currentPriceKRW)}, 목표가: ${formatKRW(prices.targetPriceKRW)})`,
  };
}

export function filterStage3Affordability(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  investmentAmount: number,
  exchangeRate: ExchangeRate
): FilterStageResult {
  const currentPriceKRW = convertToKRW(
    yahooData.currentPrice,
    yahooData.currency,
    exchangeRate
  );

  if (investmentAmount < currentPriceKRW) {
    const isUS = yahooData.currency === 'USD';
    if (!isUS) {
      return {
        stage: 3,
        stageName: '매수 가능성',
        passed: false,
        reason: `투자금(${formatKRW(investmentAmount)})으로 1주도 매수 불가 (1주 가격: ${formatKRW(currentPriceKRW)})`,
      };
    }
  }

  const maxShares = Math.floor(investmentAmount / currentPriceKRW);
  const allocationRatio = (maxShares * currentPriceKRW) / investmentAmount;

  if (allocationRatio < 0.1 && maxShares < 1) {
    return {
      stage: 3,
      stageName: '매수 가능성',
      passed: false,
      reason: `투자금 대비 유의미한 배분 불가 (최대 ${maxShares}주, 배분율 ${(allocationRatio * 100).toFixed(1)}%)`,
    };
  }

  return {
    stage: 3,
    stageName: '매수 가능성',
    passed: true,
    reason: `매수 가능 (최대 ${maxShares}주, 배분율 ${(allocationRatio * 100).toFixed(1)}%)`,
  };
}

export function filterStage4PeriodFeasibility(
  company: ExtractedCompanyAnalysis,
  yahooData: YahooFinanceData,
  periodMonths: number,
  exchangeRate: ExchangeRate
): FilterStageResult {
  const prices = normalizePrices(company, yahooData, exchangeRate);

  if (!company.targetPrice || prices.targetPriceKRW <= prices.currentPriceKRW) {
    return {
      stage: 4,
      stageName: '기간 실현 가능성',
      passed: false,
      reason: '목표가가 현재가 이하이거나 없음',
    };
  }

  const requiredReturn =
    (prices.targetPriceKRW - prices.currentPriceKRW) / prices.currentPriceKRW;

  const monthlyReturns = calculateMonthlyReturns(yahooData.priceHistory);
  if (monthlyReturns.length === 0) {
    return {
      stage: 4,
      stageName: '기간 실현 가능성',
      passed: true,
      reason: '히스토리컬 데이터 부족으로 통과 처리 (추가 검증 필요)',
    };
  }

  const avgMonthlyReturn =
    monthlyReturns.reduce((sum, r) => sum + r, 0) / monthlyReturns.length;

  if (avgMonthlyReturn <= 0) {
    return {
      stage: 4,
      stageName: '기간 실현 가능성',
      passed: requiredReturn <= 0.05,
      reason: avgMonthlyReturn <= 0
        ? `과거 평균 월 수익률 음수 (${(avgMonthlyReturn * 100).toFixed(2)}%) - 목표 달성 어려움`
        : '통과',
    };
  }

  const estimatedMonths = requiredReturn / avgMonthlyReturn;

  if (estimatedMonths > periodMonths * 1.5) {
    return {
      stage: 4,
      stageName: '기간 실현 가능성',
      passed: false,
      reason: `추정 도달 기간(${estimatedMonths.toFixed(1)}개월)이 투자기간(${periodMonths}개월)의 1.5배 초과 - 비현실적`,
    };
  }

  if (estimatedMonths > periodMonths) {
    return {
      stage: 4,
      stageName: '기간 실현 가능성',
      passed: true,
      reason: `추정 도달 기간(${estimatedMonths.toFixed(1)}개월)이 투자기간(${periodMonths}개월) 초과 - 감점 적용`,
    };
  }

  return {
    stage: 4,
    stageName: '기간 실현 가능성',
    passed: true,
    reason: `추정 도달 기간 ${estimatedMonths.toFixed(1)}개월 ≤ 투자기간 ${periodMonths}개월 - 실현 가능`,
  };
}

function formatKRW(amount: number): string {
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    return `${(amount / 10000).toFixed(0)}만원`;
  }
  return `${Math.round(amount).toLocaleString()}원`;
}
