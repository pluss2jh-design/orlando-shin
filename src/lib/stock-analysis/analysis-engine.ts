import type {
  ExtractedCompanyAnalysis,
  InvestmentConditions,
  LearnedInvestmentCriteria,
  InvestmentStyle,
  FilteredCandidate,
  RecommendationResult,
  SourceReference,
  InvestmentStrategy,
  YahooFinanceData,
  RuleScore,
  LearnedKnowledge,
  TenbaggerStepResult,
  TenbaggerScoreResult,
} from '@/types/stock-analysis';
import { fetchExchangeRate } from './currency';
import {
  fetchYahooFinanceData,
  fetchBatchQuotes,
} from './yahoo-finance';
import { getStockUniverse } from './universe';

/**
 * 기업 분석 엔진 메인 함수
 * S&P 500, Russell 1000, Dow Jones 등 300개 기업 유니버스를 대상으로
 * 학습된 투자 규칙에 따른 점수를 산정하여 TOP 5를 추천합니다.
 */
export async function runAnalysisEngine(
  conditions: InvestmentConditions,
  knowledge: LearnedKnowledge,
  style: InvestmentStyle = 'moderate',
  companyCount: number = 5,
  companyAiModel?: string,
  companyApiKey?: string,
  newsAiModel?: string,
  newsApiKey?: string,
  onProgress?: (progress: number, message: string) => void
): Promise<RecommendationResult> {
  console.log(`Starting analysis engine with universe screening...`);

  if (onProgress) onProgress(5, '시장 유니버스 구성 및 환율 정보 수집 중...');
  const exchangeRate = await fetchExchangeRate();
  const universe = getStockUniverse();
  console.log(`Universe size: ${universe.length} tickers`);

  // 모든 규칙 카테고리 통합
  const criteria = knowledge.criteria;
  const allRules = [
    ...(criteria.goodCompanyRules || []).map(r => ({ ...r, category: 'fundamental' })),
    ...(criteria.technicalRules || []).map(r => ({ ...r, category: 'technical' })),
    ...(criteria.marketSizeRules || []).map(r => ({ ...r, category: 'market' })),
    ...(criteria.unitEconomicsRules || []).map(r => ({ ...r, category: 'unit_economics' })),
    ...(criteria.lifecycleRules || []).map(r => ({ ...r, category: 'lifecycle' })),
    ...(criteria.buyTimingRules || []).map(r => ({ ...r, category: 'timing' })),
    // 전략 조건들 추가 (InvestmentStrategy)
    ...(knowledge.strategy?.shortTermConditions || []).map(s => ({ rule: s, category: 'strategy', weight: 0.8, source: { fileName: '전략' } as any })),
    ...(knowledge.strategy?.longTermConditions || []).map(s => ({ rule: s, category: 'strategy', weight: 0.9, source: { fileName: '전략' } as any })),
    ...(knowledge.strategy?.winningPatterns || []).map(s => ({ rule: s, category: 'strategy', weight: 0.7, source: { fileName: '전략' } as any })),
  ];

  console.log(`Evaluating ${allRules.length} rules for each company.`);

  // 기본 시세 데이터 1차 조회 (배치 처리)
  const batchSize = 25;
  const allYahooData: YahooFinanceData[] = [];

  for (let i = 0; i < universe.length; i += batchSize) {
    if (onProgress) onProgress(10 + Math.floor((i / universe.length) * 20), `기초 데이터 수집 중... (${i}/${universe.length})`);
    const batch = universe.slice(i, i + batchSize);
    try {
      const quotes = await fetchBatchQuotes(batch);
      allYahooData.push(...quotes);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.warn(`Batch fetch failed, trying individual tickers...`);
      for (const ticker of batch) {
        try {
          const singleQuote = await fetchBatchQuotes([ticker]);
          allYahooData.push(...singleQuote);
        } catch (e) { }
      }
    }
  }

  const validStocks = allYahooData.filter(d => d.ticker && d.currentPrice > 0);
  console.log(`Valid stocks for deep analysis: ${validStocks.length}`);

  const stocksWithScores: Array<{
    ticker: string;
    yahooData: YahooFinanceData;
    periodReturn: number;
    company: ExtractedCompanyAnalysis;
    ruleScores: RuleScore[];
    totalScore: number;
  }> = [];

  // 상세 데이터 조회 및 규칙 점수 산정 (청크 병렬 처리)
  const chunkSize = 10;
  for (let i = 0; i < validStocks.length; i += chunkSize) {
    if (onProgress) onProgress(30 + Math.floor((i / validStocks.length) * 60), `기업 상세 재무 데이터 수집 및 분석 중... (${i}/${validStocks.length})`);
    const chunk = validStocks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (stock) => {
      try {
        const fullData = await fetchYahooFinanceData(stock.ticker, conditions.periodMonths || 12);

        if (conditions.sector && conditions.sector !== 'ALL') {
          const stockSector = (fullData.sector || (stock as any).sector || '').toLowerCase().trim();
          const targetSector = conditions.sector.toLowerCase().trim();

          // 섹터 문자열이 포함되어 있는지 확인 (예: 'Technology' vs 'tech')
          if (!stockSector.includes(targetSector) && !targetSector.includes(stockSector)) {
            console.log(`Skipping ${stock.ticker}: Sector mismatch (${stockSector} vs ${targetSector})`);
            return; // Skip this stock
          }
          console.log(`Matched ${stock.ticker} for sector ${targetSector}`);
        }

        let periodReturn = 0;
        if (fullData.priceHistory && fullData.priceHistory.length >= 2) {
          const startPrice = fullData.priceHistory[0].close;
          const endPrice = fullData.priceHistory[fullData.priceHistory.length - 1].close;
          if (startPrice > 0) periodReturn = ((endPrice - startPrice) / startPrice) * 100;
        } else if (stock.previousClose) {
          periodReturn = ((stock.currentPrice - stock.previousClose) / stock.previousClose) * 100;
        }

        const company: ExtractedCompanyAnalysis = {
          companyName: stock.ticker,
          ticker: stock.ticker,
          market: stock.ticker.endsWith('.KS') || stock.ticker.endsWith('.KQ') ? 'KRX' : 'NYSE',
          currency: stock.currency,
          metrics: {
            per: fullData.trailingPE || stock.trailingPE,
            pbr: fullData.priceToBook || stock.priceToBook,
            roe: fullData.returnOnEquity ? fullData.returnOnEquity * 100 : undefined,
          },
          investmentThesis: '',
          riskFactors: [],
          investmentStyle: style,
          sources: [],
          extractedAt: new Date(),
          confidence: 0.7,
        };

        const ruleScores: RuleScore[] = [];
        let weightedScoreSum = 0;
        let totalWeightSum = 0;

        for (const ruleObj of allRules) {
          const scoreResult = calculateRuleScore(ruleObj.rule, fullData, company);
          // 데이터가 부족한 경우 stock(배치 데이터)에서라도 정보를 찾아 점수 보정
          if (scoreResult.score === 5 && scoreResult.reason === '보통') {
            const refinedScore = calculateRuleScore(ruleObj.rule, stock, company);
            if (refinedScore.score !== 5) {
              ruleScores.push(refinedScore);
              const weight = (ruleObj as any).weight || 0.5;
              weightedScoreSum += refinedScore.score * weight;
              totalWeightSum += weight;
              continue;
            }
          }

          const weight = (ruleObj as any).weight || 0.5;
          ruleScores.push(scoreResult);
          weightedScoreSum += scoreResult.score * weight;
          totalWeightSum += weight;
        }

        let strategyBonus = 0;
        if (conditions.strategyType === 'growth') {
          if (fullData.revenueGrowth && fullData.revenueGrowth > 0.1) strategyBonus += 1.5;
          if (fullData.revenueGrowth && fullData.revenueGrowth > 0.3) strategyBonus += 1.5;
        } else if (conditions.strategyType === 'value') {
          if (fullData.priceToBook && fullData.priceToBook > 0 && fullData.priceToBook < 1.2) strategyBonus += 1.5;
          if (fullData.trailingPE && fullData.trailingPE > 0 && fullData.trailingPE < 12) strategyBonus += 1.5;
        }

        // 0-10점 척도로 정규화 (AGENTS.md Rule 5 준수)
        let finalScore = totalWeightSum > 0 ? (weightedScoreSum / totalWeightSum) : 5;
        finalScore = Math.min(10, finalScore + strategyBonus);

        stocksWithScores.push({
          ticker: stock.ticker,
          yahooData: fullData,
          periodReturn,
          company,
          ruleScores,
          totalScore: Number(finalScore.toFixed(2)),
        });
      } catch (err) {
        console.error(`Deep analysis failed for ${stock.ticker}:`, err);
      }
    }));
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (onProgress) onProgress(95, '분석 완료! 수익률 및 점수 기반 결과 정렬 중...');

  const topPicks: FilteredCandidate[] = stocksWithScores
    .sort((a, b) => b.totalScore - a.totalScore || b.periodReturn - a.periodReturn)
    .slice(0, Math.min(companyCount, 20))
    .map((stock) => {
      const riskLevel = stock.periodReturn > 50 ? 'high' : stock.periodReturn > 20 ? 'medium' : 'low';
      const sortedRules = [...stock.ruleScores].sort((a, b) => b.score - a.score);
      const topRules = sortedRules.slice(0, 3);

      // 텐배거 7단계 스코어 산정
      const tenbaggerScore = calculateTenbaggerScore(stock);

      const thesis = `${stock.ticker}는 텐배거 파이프라인 ${tenbaggerScore.percentage}% 달성 (${tenbaggerScore.steps.filter(s => s.passed).length}/7단계 통과). ` +
        `웹 시 권고 편입 비중: ${tenbaggerScore.allocationLabel}. ` +
        `특히 ${topRules.map(r => r.rule.split(':')[0]).join(', ')} 등의 지표에서 긍정적인 신호를 보였습니다. ` +
        `실시간 데이터 PER ${stock.yahooData.trailingPE?.toFixed(1) || 'N/A'}, ROE ${stock.yahooData.returnOnEquity ? (stock.yahooData.returnOnEquity * 100).toFixed(1) : 'N/A'}%`;

      return {
        company: { ...stock.company, investmentThesis: thesis },
        yahooData: stock.yahooData,
        normalizedPrices: {
          currentPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          targetPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1) * (1 + tenbaggerScore.recommendedAllocation / 100),
          recommendedBuyPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          exchangeRateUsed: exchangeRate.rate,
        },
        filterResults: [
          { stage: 1, stageName: '데이터 수집', passed: true, reason: '실시간 데이터 기반 규칙 평가 완료' },
          { stage: 2, stageName: '텐배거 단계', passed: tenbaggerScore.percentage >= 50, reason: `${tenbaggerScore.percentage}% 달성` }
        ],
        passedAllFilters: tenbaggerScore.percentage >= 50,
        score: tenbaggerScore.percentage,
        expectedReturnRate: stock.periodReturn,
        confidenceScore: Math.min(98, 50 + tenbaggerScore.percentage / 2),
        riskLevel,
        ruleScores: stock.ruleScores,
        totalRuleScore: stock.totalScore,
        maxPossibleScore: 10,
        tenbaggerScore,
      };
    });

  return {
    candidates: topPicks,
    topPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `시장 유니버스 ${stocksWithScores.length}개 종목을 텐배거 7단계 파이프라인으로 분석하여 TOP ${companyCount} 기업을 선정했습니다.`,
    allSourcesUsed: deduplicateSources(allRules.map(r => r.source).filter(Boolean)),
    queriedTickers: universe,
  };
}

/**
 * 개별 투자 규칙에 대한 기업의 부합 정도를 0-10점 사이로 산정합니다.
 */
function calculateRuleScore(rule: string, data: YahooFinanceData, company: ExtractedCompanyAnalysis): RuleScore {
  const ruleLower = rule.toLowerCase();

  // ROE 평가 (수익성)
  if (ruleLower.includes('roe')) {
    const val = (data.returnOnEquity || 0) * 100;
    if (val <= 0) return { rule, score: 0, reason: 'ROE 마이너스' };
    if (val >= 25) return { rule, score: 10, reason: `ROE ${val.toFixed(1)}% (최상)` };
    if (val >= 15) return { rule, score: 9, reason: `ROE ${val.toFixed(1)}% (우수)` };
    if (val >= 8) return { rule, score: 6, reason: `ROE ${val.toFixed(1)}% (보통)` };
    return { rule, score: 3, reason: `ROE ${val.toFixed(1)}% (저조)` };
  }

  // PER 평가 (밸류에이션)
  if (ruleLower.includes('per')) {
    const val = data.trailingPE;
    if (!val) return { rule, score: 5, reason: 'PER 데이터 없음' };
    if (val > 0 && val <= 12) return { rule, score: 10, reason: `PER ${val.toFixed(1)} (저평가 매력)` };
    if (val <= 20) return { rule, score: 8, reason: `PER ${val.toFixed(1)} (적정)` };
    if (val <= 35) return { rule, score: 4, reason: `PER ${val.toFixed(1)} (고평가 영역)` };
    return { rule, score: 1, reason: `PER ${val.toFixed(1)} (과도한 고평가)` };
  }

  // PBR 평가 (자산가치)
  if (ruleLower.includes('pbr')) {
    const val = data.priceToBook;
    if (!val) return { rule, score: 5, reason: 'PBR 데이터 없음' };
    if (val > 0 && val <= 1.2) return { rule, score: 10, reason: `PBR ${val.toFixed(1)} (자산가치 저평가)` };
    if (val <= 2.5) return { rule, score: 7, reason: `PBR ${val.toFixed(1)} (보통)` };
    return { rule, score: 3, reason: `PBR ${val.toFixed(1)} (자산가치 대비 고평가)` };
  }

  // 기술적 지표 (스토캐스틱, RSI 등)
  if (ruleLower.includes('스토캐스틱') || ruleLower.includes('stochastic') || ruleLower.includes('rsi')) {
    if (data.priceHistory && data.priceHistory.length >= 14) {
      const recent = data.priceHistory.slice(-14);
      const low = Math.min(...recent.map(p => p.close));
      const high = Math.max(...recent.map(p => p.close));
      const k = high === low ? 50 : ((data.currentPrice - low) / (high - low)) * 100;
      if (k < 25) return { rule, score: 10, reason: `지표 ${k.toFixed(0)} (과매도 구간)` };
      if (k < 45) return { rule, score: 8, reason: `지표 ${k.toFixed(0)} (바닥권 확인)` };
      if (k > 75) return { rule, score: 2, reason: `지표 ${k.toFixed(0)} (과매수 구간 주의)` };
      return { rule, score: 6, reason: `지표 ${k.toFixed(0)} (중립)` };
    }
  }

  // 시장 지배력 (Market Cap 활용)
  if (ruleLower.includes('tam') || ruleLower.includes('시장') || ruleLower.includes('규모') || ruleLower.includes('점유율')) {
    const cap = data.marketCap || 0;
    if (cap > 500e9) return { rule, score: 10, reason: '글로벌 초거대 기업' };
    if (cap > 100e9) return { rule, score: 8, reason: '대형 시장 선도 기업' };
    if (cap > 20e9) return { rule, score: 6, reason: '중대형 우량 기업' };
    return { rule, score: 4, reason: '성장 잠재력 탐색 단계' };
  }

  // 수익성 구조 (Operating Margin 활용)
  if (ruleLower.includes('마진') || ruleLower.includes('수익성') || ruleLower.includes('단위 경제') || ruleLower.includes('ltv') || ruleLower.includes('cac')) {
    const margin = (data as any).operatingMargins || 0;
    if (margin > 0.3) return { rule, score: 10, reason: `영업이익률 ${(margin * 100).toFixed(1)}% (최상위권)` };
    if (margin > 0.15) return { rule, score: 8, reason: `영업이익률 ${(margin * 100).toFixed(1)}% (우수)` };
    if (margin > 0.05) return { rule, score: 5, reason: `영업이익률 ${(margin * 100).toFixed(1)}% (보통)` };
    return { rule, score: 2, reason: '수익성 개선 필요' };
  }

  // 성장 단계 (Revenue Growth 활용)
  if (ruleLower.includes('성장') || ruleLower.includes('도입') || ruleLower.includes('성숙') || ruleLower.includes('growth')) {
    const growth = (data as any).revenueGrowth || 0;
    if (growth > 0.25) return { rule, score: 10, reason: `매출성장률 ${(growth * 100).toFixed(1)}% (폭발적 성장)` };
    if (growth > 0.1) return { rule, score: 8, reason: `매출성장률 ${(growth * 100).toFixed(1)}% (양호한 성장)` };
    if (growth > 0) return { rule, score: 6, reason: `매출성장률 ${(growth * 100).toFixed(1)}% (안정적 성장)` };
    // 전략 및 문장형 규칙 평가 (InvestmentStrategy 등)
    if (ruleLower.length > 20 || ruleLower.includes('패턴') || ruleLower.includes('상승') || ruleLower.includes('조건')) {
      // Yahoo Finance 데이터에 기반한 간단한 텍스트 기반 추론 (예시)
      if (ruleLower.includes('상승') && data.currentPrice > data.previousClose) return { rule, score: 8, reason: '단기 상승 추세 확인됨' };
      if (ruleLower.includes('거래량') && data.priceHistory && data.priceHistory.length > 0) {
        const lastVol = data.priceHistory[data.priceHistory.length - 1].volume;
        if (lastVol > 1000000) return { rule, score: 9, reason: '대량 거래량 동반' };
      }
      return { rule, score: 7, reason: '학습된 전략 패턴 부합 (기본 점수)' };
    }

    // 현금 흐름 및 재무 안정성
  }

  // 현금 흐름 및 재무 안정성
  if (ruleLower.includes('현금') || ruleLower.includes('fcf') || ruleLower.includes('부채')) {
    const d2e = (data as any).debtToEquity || 0;
    if (d2e > 0 && d2e < 50) return { rule, score: 10, reason: '부채비율 매우 낮음 (재무 건전성 최상)' };
    if (d2e < 100) return { rule, score: 8, reason: '재무 안정성 양호' };
    if (d2e > 200) return { rule, score: 2, reason: '부채 비율 높음 주의' };
  }

  // 기본값 (규칙 존재 시 최소 점수 부여)
  return { rule, score: 5, reason: '기본 규칙 부합성 확인' };
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

/**
 * 텐배거 7단계 파이프라인 스코어를 산정합니다.
 * 단계마다 통과 시마다 편입 비중을 점진적으로 늘려갑니다.
 */
function calculateTenbaggerScore(
  stock: { ticker: string; yahooData: YahooFinanceData; periodReturn: number; totalScore: number; ruleScores: RuleScore[] }
): TenbaggerScoreResult {
  const d = stock.yahooData;
  const tk = stock.ticker;
  const steps: TenbaggerStepResult[] = [];

  // ─── URL 헬퍼 ───────────────────────────────────────────
  // Yahoo Finance: 공식 데이터 제공 (실시간 시세·재무)
  const yahooUrl = (path: string) => `https://finance.yahoo.com/quote/${tk}${path}`;
  // SEC EDGAR: Full-Text Search (HTML 결과 화면) - 사람이 읽을 수 있는 페이지
  const edgarViewer = (form: string) =>
    `https://efts.sec.gov/LATEST/search-index?q=%22${tk}%22&forms=${form}&dateRange=custom&startdt=2024-01-01`;
  // SEC EDGAR: 기업검색 페이지 (EDGAR 회사 검색 HTML UI)
  const edgarCompany = (form: string) =>
    `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${tk}&type=${form}&dateb=&owner=include&count=10`;
  // Macrotrends: 장기 재무 추이 차트 (검색 기반으로 정확한 종목 접근)
  // WSJ: 월스트리트저널 재무데이터
  const wsj = (section: string) => `https://www.wsj.com/market-data/quotes/${tk}/${section}`;
  // Finviz: 기술 지표 스크리너
  const finvizUrl = () => `https://finviz.com/quote.ashx?t=${tk}`;

  // ────────────────────────────────────
  // Step 1: 관심 산업 선정 (매출 성장률)
  // ────────────────────────────────────
  const revenueGrowth = (d as any).revenueGrowth || 0;
  const step1Score = revenueGrowth > 0.3 ? 10 : revenueGrowth > 0.2 ? 8 : revenueGrowth > 0.1 ? 6 : revenueGrowth > 0 ? 4 : 2;
  steps.push({
    step: 1,
    stepName: '관심 산업 선정 (패러다임 변화)',
    passed: step1Score >= 6,
    score: step1Score,
    detail: `매출성장률 ${(revenueGrowth * 100).toFixed(1)}% — ${revenueGrowth > 0.3 ? '폭발적 성장 (빙의 영역)' : revenueGrowth > 0.2 ? '패러다임 전환 후보 산업' : revenueGrowth > 0.1 ? '양호한 성장기' : '성장 모멘텀 부족'}`,
    recommendation: step1Score >= 6 ? '패러다임 전환 후보 산업 확인, 다음 단계 진행' : '산업 성장률 부족 — 관망 종목 등록부터 시작',
    sources: [
      {
        label: 'Yahoo Finance — Financials',
        url: yahooUrl('/financials'),
        metric: `매출 성장률 ${(revenueGrowth * 100).toFixed(1)}%`,
        description: `전년 대비 매출이 ${(revenueGrowth * 100).toFixed(1)}% 성장했습니다. 30% 초과 → 10점, 20~30% → 8점, 10~20% → 6점(통과), 0~10% → 4점, 마이너스 → 2점으로 현재 ${step1Score}점입니다. 이 수치가 Step 1 점수 산정의 직접적 근거입니다.`
      },
      {
        label: 'WSJ — Income Statement',
        url: wsj('financials/annual/income-statement'),
        metric: 'Revenue Growth YoY',
        description: `손익계산서의 Revenue 항목에서 전년과 금년 매출을 비교하면 성장률 ${(revenueGrowth * 100).toFixed(1)}%가 도출됩니다. 3년 이상 지속적으로 성장 중인지 여기서 추가 확인할 수 있습니다.`
      },
      {
        label: 'Macrotrends — Revenue 검색',
        url: `https://www.macrotrends.net/search?query=${tk}+revenue`,
        metric: '연간 매출 성장 추이',
        description: `현재 ${(revenueGrowth * 100).toFixed(1)}% 성장이 일회성인지, 3년 이상 이어지는 구조적 성장인지 이 차트로 확인합니다. 구조적 성장이 확인되면 텐배거 패러다임 변화 산업의 핵심 조건을 충족합니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 2: 13F 기관 매집 (시총 기반 추정)
  // ────────────────────────────────────
  const marketCap = d.marketCap || 0;
  const instOwnership = (d as any).institutionalOwnershipPercentage ||
    (marketCap > 0 ? Math.min(90, 50 + (marketCap / 200e9) * 20) : 60);
  const step2Score = instOwnership > 80 ? 10 : instOwnership > 60 ? 8 : instOwnership > 40 ? 5 : 3;
  steps.push({
    step: 2,
    stepName: '13F 기관 매집 분석',
    passed: step2Score >= 5,
    score: step2Score,
    detail: `기관 보유비율 추정 ${instOwnership.toFixed(0)}% — ${instOwnership > 80 ? '대형 기관 동시 매집 신호' : instOwnership > 60 ? '기관 지지 화력 확인' : '기관 지지 미약'}`,
    recommendation: step2Score >= 5 ? '스마트 머니 유입 확인 — 정찰병 5% 진입' : '기관 매집 부족 — 아직 관망단계',
    sources: [
      {
        label: 'SEC EDGAR — 13F 공시 검색',
        url: edgarCompany('13F-HR'),
        metric: '분기별 기관 포트폴리오 공시',
        description: `블랙록·피델리티 등 대형 기관이 보유한 ${tk} 주식 수량과 전 분기 대비 변화량을 직접 확인합니다. 여러 기관이 동시에 보유량을 늘렸다면 강력한 스마트머니 매집 신호입니다.`
      },
      {
        label: 'Yahoo Finance — Holders',
        url: yahooUrl('/holders'),
        metric: `기관 보유비율 추정 ${instOwnership.toFixed(0)}%`,
        description: `기관 보유비율 ${instOwnership.toFixed(0)}%가 이 점수의 핵심 수치입니다. 80% 초과 → 10점, 60~80% → 8점, 40~60% → 5점(통과), 40% 미만 → 3점. 현재 ${step2Score}점입니다. 기관 비율이 높을수록 대형 투자 전문가들이 이 주식을 선택했다는 의미입니다.`
      },
      {
        label: 'Fintel — Institutional Ownership',
        url: `https://fintel.io/so/us/${tk.toLowerCase()}`,
        metric: '13F 기관 매집 현황',
        description: `전 분기 대비 기관 순매수(매집량 증가)인지 순매도인지 확인합니다. 신규 진입 기관 수가 증가 중이라면 "${tk}에 대한 기관의 관심이 커지고 있다"는 신호로 점수에 긍정적으로 작용합니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 3: Form 4 내부자 매수 (순이익률 대리)
  // ────────────────────────────────────
  const profitMargin = (d as any).profitMargins || 0;
  const step3Score = profitMargin > 0.2 ? 9 : profitMargin > 0.1 ? 7 : profitMargin > 0.05 ? 5 : profitMargin > 0 ? 3 : 1;
  steps.push({
    step: 3,
    stepName: 'Form 4 내부자 매수 분석',
    passed: step3Score >= 5,
    score: step3Score,
    detail: `순이익률 ${(profitMargin * 100).toFixed(1)}% — ${profitMargin > 0.2 ? '내부자가 자사주를 매수할 만한 강한 수익성' : profitMargin > 0.1 ? '내부자 매수 가능한 수익 구조' : '수익성 개선 필요'}`,
    recommendation: step3Score >= 5 ? '내부자 매수 신호 확인 시 1차 비중 확대 진행' : '내부자 확신 부족 — 수익성 개선 후 진입',
    sources: [
      {
        label: 'SEC EDGAR — Form 4 코퍼스 검색',
        url: edgarCompany('4'),
        metric: `순이익률 ${(profitMargin * 100).toFixed(1)}% (대리지표)`,
        description: `CEO·CFO·이사 등 핵심 내부자가 최근 공개 시장에서 ${tk} 주식을 자기 돈으로 직접 매수(코드 P)했는지 확인합니다. 내부자 매수는 "회사가 저평가돼 있다"는 가장 강력한 신호 중 하나입니다.`
      },
      {
        label: 'OpenInsider — 내부자 매수 현황',
        url: `https://openinsider.com/search?q=${tk}`,
        metric: '경영진 직접 매수 내역',
        description: `순이익률 ${(profitMargin * 100).toFixed(1)}%를 내부자 확신의 대리지표로 씁니다. 20% 초과 → 9점, 10~20% → 7점, 5~10% → 5점(통과), 0~5% → 3점, 적자 → 1점. 수익성이 높을수록 경영진이 자사주를 살 유인이 큽니다. 현재 ${step3Score}점입니다.`
      },
      {
        label: 'Yahoo Finance — Insider Transactions',
        url: yahooUrl('/insider-transactions'),
        metric: 'Form 4 공시 내역',
        description: `최근 6개월 내 내부자 매수 건수가 매도보다 많은지 확인합니다. 내부자 순매수(매수 > 매도) 지속은 경영진이 주가 상승을 확신한다는 뜻으로, Step 3 점수를 보완하는 근거로 활용됩니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 4: 재무 펀더멘털 (ROE + 매출 성장률)
  // ────────────────────────────────────
  const roe = (d.returnOnEquity || 0) * 100;
  const step4Base = roe > 20 ? 10 : roe > 15 ? 8 : roe > 8 ? 6 : roe > 0 ? 4 : 1;
  const step4Score = Math.min(10, step4Base + (revenueGrowth > 0.2 && roe > 15 ? 1 : 0));
  steps.push({
    step: 4,
    stepName: '재무 펀더멘털 검증 (ROE/매출성장률)',
    passed: step4Score >= 6,
    score: step4Score,
    detail: `ROE ${roe.toFixed(1)}% | 매출성장률 ${(revenueGrowth * 100).toFixed(1)}% — ${roe > 20 ? '탁월한 자본효율, 텐배거 유리한 수익구조' : roe > 15 ? '펀더멘털 양호' : '개선 모니터링 필요'}`,
    recommendation: step4Score >= 6 ? 'ROE 변곡점 확인! 1차 비중 확대 시작' : '펀더멘털 개선 확인 후 비중 조절',
    sources: [
      {
        label: 'Yahoo Finance — Key Statistics',
        url: yahooUrl('/key-statistics'),
        metric: `ROE ${roe.toFixed(1)}% / 매출성장률 ${(revenueGrowth * 100).toFixed(1)}%`,
        description: `ROE(자기자본이익률) ${roe.toFixed(1)}%가 핵심 수치입니다. "내 돈 100원으로 ${roe.toFixed(0)}원을 번다"는 의미입니다. 20% 초과 → 10점, 15~20% → 8점, 8~15% → 6점(통과), 0~8% → 4점, 적자 → 1점. 매출성장률 ${(revenueGrowth * 100).toFixed(1)}%가 20% 초과이고 ROE도 15% 초과이면 보너스 1점 추가. 현재 ${step4Score}점입니다.`
      },
      {
        label: 'Macrotrends — ROE 검색',
        url: `https://www.macrotrends.net/search?query=${tk}+return+on+equity`,
        metric: 'Return on Equity 추이',
        description: `${tk}의 ROE ${roe.toFixed(1)}%가 최근 3~5년간 꾸준히 상승 중인지 확인합니다. ROE가 지속적으로 우상향하는 기업은 경쟁우위가 강화되고 있다는 뜻으로, 텐배거 핵심 조건 중 하나입니다.`
      },
      {
        label: 'Macrotrends — Revenue 검색',
        url: `https://www.macrotrends.net/search?query=${tk}+revenue`,
        metric: '연간 매출 성장 추이',
        description: `ROE ${roe.toFixed(1)}% + 매출성장률 ${(revenueGrowth * 100).toFixed(1)}% 조합이 3년 이상 지속되는지 확인합니다. 이 두 지표가 함께 우상향하는 기업은 "성장하면서도 효율이 좋아지는" 복리 기업의 전형적인 패턴입니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 5: 기술적 분석 (200일 이동평균)
  // ────────────────────────────────────
  const { priceHistory, currentPrice, previousClose } = d;
  let step5Score = 5;
  let step5Detail = '';
  let step5Metric = '';
  if (priceHistory && priceHistory.length >= 200) {
    const ma200 = priceHistory.slice(-200).reduce((s, p) => s + p.close, 0) / 200;
    const ma50 = priceHistory.slice(-50).reduce((s, p) => s + p.close, 0) / 50;
    step5Metric = `현재가 $${currentPrice.toFixed(2)} / 200MA $${ma200.toFixed(2)} / 50MA $${ma50.toFixed(2)}`;
    if (currentPrice > ma200 * 1.05 && ma50 > ma200) {
      step5Score = 10; step5Detail = `200일선(${ma200.toFixed(0)}) 돌파 & 50일선 골든크로스 형성 ✅`;
    } else if (currentPrice > ma200) {
      step5Score = 7; step5Detail = `200일선(${ma200.toFixed(0)}) 위에서 거래 중, 수급 개선 확인`;
    } else {
      step5Score = 3; step5Detail = `200일선(${ma200.toFixed(0)}) 하방 — 추세 전환 대기`;
    }
  } else {
    const chg = previousClose > 0 ? (currentPrice - previousClose) / previousClose : 0;
    step5Score = chg > 0.02 ? 7 : chg > 0 ? 5 : 3;
    step5Detail = `단기 주가 변동 ${(chg * 100).toFixed(1)}% (200일 데이터 부족)`;
    step5Metric = `현재가 $${currentPrice.toFixed(2)}`;
  }
  steps.push({
    step: 5,
    stepName: '기술적 분석 (200일선 수급 확인)',
    passed: step5Score >= 6,
    score: step5Score,
    detail: step5Detail,
    recommendation: step5Score >= 6 ? '200일선 돌파 확인 — 2차 비중 확대 후보' : '추세 전환 신호 후 추가 진입 검토',
    sources: [
      {
        label: 'Yahoo Finance — Chart',
        url: yahooUrl(''),
        metric: step5Metric,
        description: `현재가 $${currentPrice.toFixed(2)}와 200일 이동평균선의 위치 관계로 점수를 산정합니다. 200일선 5% 이상 위 + 50일선 골든크로스 → 10점, 200일선 위 → 7점, 200일선 아래 → 3점. 200일선은 "기관·장기 투자자들의 평균 매수 단가"로, 이 위에서 거래된다는 것은 대다수 장기 투자자가 수익 중이라는 의미입니다. 현재 ${step5Score}점입니다.`
      },
      {
        label: 'TradingView — 차트 분석',
        url: `https://www.tradingview.com/chart/?symbol=NASDAQ:${tk}`,
        metric: '200MA / 50MA 기술적 위치',
        description: `차트에 MA200(노란선)·MA50(파란선)을 표시했을 때, 50일선이 200일선을 아래에서 위로 돌파(골든크로스)한 시점이 최근인지 확인합니다. 골든크로스 직후 진입은 강한 추세 전환 신호로, Step 5 최고점(10점)의 핵심 근거가 됩니다.`
      },
      {
        label: 'Finviz — 기술 지표',
        url: finvizUrl(),
        metric: '200일선 / RSI / MACD',
        description: `RSI가 50 이상이면 매수 세력 우세, MACD 히스토그램이 0선 위면 단기 상승 추세를 의미합니다. 이 두 신호가 200일선 돌파와 겹칠 때 Step 5 점수의 신뢰도가 높아집니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 6: 거시 환경 (PEG / Forward PE)
  // ────────────────────────────────────
  const forwardPE = d.forwardPE;
  let step6Score = 6;
  let step6Detail = '';
  let step6Metric = '';
  if (forwardPE && revenueGrowth > 0) {
    const peg = forwardPE / (revenueGrowth * 100);
    step6Metric = `Forward PE ${forwardPE.toFixed(1)} / 성장률 ${(revenueGrowth * 100).toFixed(1)}% → PEG ${peg.toFixed(2)}`;
    if (peg < 1) { step6Score = 10; step6Detail = `PEG ${peg.toFixed(2)} — 성장 대비 저평가 (황금어장)`; }
    else if (peg < 2) { step6Score = 7; step6Detail = `PEG ${peg.toFixed(2)} — 합리적 밸류에이션`; }
    else { step6Score = 4; step6Detail = `PEG ${peg.toFixed(2)} — 성장 대비 고평가 주의`; }
  } else if (forwardPE) {
    step6Score = forwardPE < 20 ? 8 : forwardPE < 35 ? 5 : 3;
    step6Detail = `Forward PER ${forwardPE.toFixed(1)}`;
    step6Metric = `Forward PER ${forwardPE.toFixed(1)}`;
  } else {
    step6Score = 5; step6Detail = '밸류에이션 데이터 부족 (기본값 적용)';
    step6Metric = 'Forward PE 데이터 없음';
  }
  steps.push({
    step: 6,
    stepName: '거시 환경 (PEG 밸류에이션 확인)',
    passed: step6Score >= 5,
    score: step6Score,
    detail: step6Detail,
    recommendation: step6Score >= 7 ? '매크로 우호적 — 공격적 매수 고려' : step6Score >= 5 ? '평균 수준, 포지션 유지' : '밸류에이션 부담 큼 — 비중 축소 검토',
    sources: [
      {
        label: 'Yahoo Finance — Key Statistics',
        url: yahooUrl('/key-statistics'),
        metric: step6Metric,
        description: `PEG = Forward PER ÷ 매출성장률(%). ${step6Metric}. PEG < 1은 "성장 속도보다 저렴하게 거래 중(황금어장)" → 10점, PEG 1~2 → 7점, PEG > 2 → 4점. 현재 ${step6Score}점입니다. PEG가 낮을수록 빠르게 성장하는 기업을 싸게 살 수 있다는 의미입니다.`
      },
      {
        label: 'Macrotrends — PE Ratio 검색',
        url: `https://www.macrotrends.net/search?query=${tk}+pe+ratio`,
        metric: 'Forward / Trailing PE 추이',
        description: `${tk}의 과거 PER 범위를 보면 현재 PER이 역사적으로 비싼지 싼지 알 수 있습니다. 과거 평균 PER보다 현재가 낮으면 상대적 저평가, 높으면 고평가 구간입니다. 이 맥락으로 Step 6 밸류에이션 판단을 추가 검증합니다.`
      },
      {
        label: 'Seeking Alpha — 밸류에이션 분석',
        url: `https://seekingalpha.com/symbol/${tk}/valuation`,
        metric: 'Peer Comparison / PEG',
        description: `동종 경쟁사 대비 PER·PEG·EV/EBITDA를 비교합니다. ${tk}가 같은 업종 내 경쟁사보다 낮은 밸류에이션이라면 "시장이 아직 저평가 중"이라는 추가 근거가 됩니다.`
      },
    ],
  });

  // ────────────────────────────────────
  // Step 7: 최종 판단 & 실행
  // ────────────────────────────────────
  const prevTotal = steps.reduce((a, s) => a + s.score, 0);
  const step7Score = Math.round(Math.min(10, prevTotal / 6));
  const passedCount = steps.filter((s: TenbaggerStepResult) => s.passed).length;
  steps.push({
    step: 7,
    stepName: '최종 판단 및 실행 (비중 설정)',
    passed: passedCount >= 4,
    score: step7Score,
    detail: `1~6단계 중 ${passedCount}/6 단계 통과 — 종합 펀더멘털 ${step7Score >= 7 ? '우수' : step7Score >= 5 ? '보통' : '미흡'}`,
    recommendation: passedCount >= 5 ? '텐배거 후보 최종 확정 — 분할 매수 시작' : passedCount >= 3 ? '소액 매수 후 지속 관찰' : '관망 종목 등록만 권장',
    sources: [
      {
        label: 'Yahoo Finance — Summary',
        url: yahooUrl(''),
        metric: `종합 점수 ${step7Score}/10 (1~6단계 평균)`,
        description: `1~6단계 점수 합산(${prevTotal})을 6으로 나눈 평균이 ${step7Score}점입니다. ${passedCount}/6단계 통과. 통과 5개 이상 → 텐배거 후보 확정·풀 진입(60%), 4개 → 2차 확대(35%), 3개 → 1차 확대(15%), 2개 → 정찰병(5%), 1개 이하 → 관망. 이 점수가 최종 투자 비중 배분의 직접적 근거입니다.`
      },
      {
        label: 'Seeking Alpha — 뫰국 분석 리포트',
        url: `https://seekingalpha.com/symbol/${tk}`,
        metric: '기업 분석 리포트',
        description: `Quant 등급(A+~F)과 Wall Street 애널리스트 목표가를 확인합니다. Quant B 이상 + 매수 의견 70% 이상이면, 정량 분석(1~6단계)과 전문가 정성 분석이 일치하는 강한 매수 신호로 ${step7Score}점을 뒷받침합니다.`
      },
      {
        label: 'Macrotrends — Profit Margin 검색',
        url: `https://www.macrotrends.net/search?query=${tk}+profit+margin`,
        metric: '순이익률 종합 지표',
        description: `순이익률이 최근 3년간 지속 상승 중이라면 "규모의 경제 실현" 단계입니다. 매출이 늘어도 비용 증가속도가 느려지면 이익이 더 빠르게 증가합니다. 이 패턴이 확인될수록 주가 상승 속도도 가속됩니다.`
      },
    ],
  });

  const totalScore = steps.reduce((a, s) => a + s.score, 0);
  const maxScore = 7 * 10;
  const percentage = Math.round((totalScore / maxScore) * 100);
  const passedAll = steps.filter((s: TenbaggerStepResult) => s.passed).length;

  let recommendedAllocation: number;
  let allocationLabel: string;
  let investmentStage: TenbaggerScoreResult['investmentStage'];
  if (passedAll <= 1) { recommendedAllocation = 0; allocationLabel = '관망 등록'; investmentStage = 'watch'; }
  else if (passedAll <= 2) { recommendedAllocation = 5; allocationLabel = '정찰병 매수 (5%)'; investmentStage = 'scout'; }
  else if (passedAll <= 3) { recommendedAllocation = 15; allocationLabel = '1차 비중 확대 (15%)'; investmentStage = 'expand1'; }
  else if (passedAll <= 5) { recommendedAllocation = 35; allocationLabel = '2차 비중 확대 (35%)'; investmentStage = 'expand2'; }
  else { recommendedAllocation = 60; allocationLabel = '풀 진입 (60%)'; investmentStage = 'full'; }

  return { steps, totalScore, maxScore, percentage, recommendedAllocation, allocationLabel, investmentStage };
}

