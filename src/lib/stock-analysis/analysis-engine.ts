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
  ExcludedStockDetail,
  StrategyMatchScore,
  MatchRuleResult,
} from '@/types/stock-analysis';
import { fetchExchangeRate } from './currency';
import {
  fetchYahooFinanceData,
  fetchBatchQuotes,
} from './yahoo-finance';
import { getStockUniverse } from './universe';
import {
  fetchMarketMacroContext,
  analyzeStockSentiment,
  predictStockGrowth,
  generateExpertVerdict
} from './market-context';

/**
 * 기업 분석 엔진 메인 함수
 * Russell 1000 유니버스를 대상으로 학습된 지식 기반의 전략 매칭 점수를 산정하여 TOP N을 추천합니다.
 */
export async function runAnalysisEngine(
  conditions: InvestmentConditions,
  knowledge: LearnedKnowledge,
  style: InvestmentStyle = 'moderate',
  companyCount: number = 5,

  newsAiModel?: string,
  newsApiKey?: string,
  onProgress?: (progress: number, message: string, meta?: { excludedStockCount?: number; excludedDetails?: ExcludedStockDetail[] }) => void
): Promise<RecommendationResult> {

  const asOfDate = conditions.asOfDate || new Date();
  const isHistorical = !!conditions.asOfDate;

  console.log(`Starting analysis: Full Strategy Knowledge Matching (As of: ${asOfDate.toISOString()})...`);

  const universeType = conditions.universeType || (conditions.excludeSP500 === false ? 'russell1000' : 'russell1000_exclude_sp500');

  if (onProgress) onProgress(2, `${universeType === 'sp500' ? 'S&P 500' : 'Russell 1000'} 유니버스 데이터 수집 중 (${isHistorical ? asOfDate.toLocaleDateString() : '현재'})`);
  const exchangeRate = await fetchExchangeRate();
  const macroContext = await fetchMarketMacroContext(asOfDate);

  // Russell 1000 실시간 조회 (S&P 500 제외 여부 선택) — async
  const { tickers: universe, universeCounts } = await getStockUniverse(universeType as any);
  const totalCount = universe.length;
  console.log(`Universe size: ${totalCount} tickers (Type: ${universeType})`);


  // 모든 규칙 카테고리 통합
  const allRules = knowledge.criteria.criterias || [];

  // ── Phase 1: 배치 시세 조회 (과거 분석 시에도 유니버스 필터링용으로 최신 시세 일단 활용) ──
  const batchSize = 25;
  const allYahooData: YahooFinanceData[] = [];

  for (let i = 0; i < universe.length; i += batchSize) {
    const pct = 3 + Math.floor((i / totalCount) * 15);
    if (onProgress) onProgress(pct, `[1/2] 유니버스 시세 수집 중... ${i} / ${totalCount}개`);
    const batch = universe.slice(i, i + batchSize);
    try {
      const quotes = await fetchBatchQuotes(batch);
      allYahooData.push(...quotes);
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      for (const ticker of batch) {
        try {
          const singleQuote = await fetchBatchQuotes([ticker]);
          allYahooData.push(...singleQuote);
        } catch (e) { }
      }
    }
  }

  const validStocks = allYahooData.filter(d => d.ticker && (d.currentPrice > 0 || d.previousClose > 0));
  const validTickerSet = new Set(validStocks.map(s => s.ticker));

  const excludedDetails: ExcludedStockDetail[] = [];
  universe.forEach(ticker => {
    if (!validTickerSet.has(ticker)) {
      excludedDetails.push({ ticker, reason: '시세 정보 누락' });
    }
  });

  const excludedStockCount = excludedDetails.length;
  if (onProgress) {
    onProgress(20, `[1/2] 기초 시세 수집 완료 (분석 가능 ${validStocks.length}개)`, { excludedStockCount, excludedDetails });
  }

  const stocksWithScores: Array<{
    ticker: string;
    yahooData: YahooFinanceData;
    periodReturn: number;
    company: ExtractedCompanyAnalysis;
    ruleScores: RuleScore[];
    totalScore: number;
    failedCritical?: boolean;
    failureReason?: string;
    sentiment?: any;
    prediction?: any;
  }> = [];

  const sectorStats = calculateSectorStats(validStocks);

  // ── Phase 2: 상세 재무 데이터 + 점수 산정 ──
  let analyzedCount = 0;
  const chunkSize = 5;
  for (let i = 0; i < validStocks.length; i += chunkSize) {
    const chunk = validStocks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (stock) => {
      try {
        const fullData = await fetchYahooFinanceData(stock.ticker, asOfDate);

        // 섹터 필터
        if (conditions.sector && conditions.sector !== 'ALL') {
          const stockSector = (fullData.sector || '').toLowerCase().trim();
          const targetSector = conditions.sector.toLowerCase().trim();
          if (!stockSector.includes(targetSector) && !targetSector.includes(stockSector)) {
            analyzedCount++;
            return;
          }
        }

        analyzedCount++;
        const donePct = 18 + Math.floor((analyzedCount / validStocks.length) * 79);
        if (onProgress) onProgress(donePct, `[2/2] ${isHistorical ? '과거' : '상세'} 지표 분석 중... ${analyzedCount} / ${validStocks.length}개 완료`);

        let periodReturn = 0;
        if (fullData.priceHistory && fullData.priceHistory.length >= 2) {
          // asOfDate 시점 기준 1년 전 수익률 계산 (백엔드 로직 일치)
          const startIdx = Math.max(0, fullData.priceHistory.length - 250); // 약 1년치
          const startPrice = fullData.priceHistory[startIdx].close;
          const endPrice = fullData.currentPrice; // fetchYahooFinanceData에서 asOfDate 가격으로 이미 설정됨
          if (startPrice > 0) periodReturn = ((endPrice - startPrice) / startPrice) * 100;
        }

        const company: ExtractedCompanyAnalysis = {
          companyName: stock.ticker,
          ticker: stock.ticker,
          market: stock.ticker.endsWith('.KS') || stock.ticker.endsWith('.KQ') ? 'KRX' : 'NYSE',
          currency: stock.currency,
          metrics: {
            per: fullData.trailingPE,
            pbr: fullData.priceToBook,
            roe: fullData.returnOnEquity ? fullData.returnOnEquity * 100 : undefined,
          },
          sentimentSummary: '', // Added for display
          macroStatus: macroContext.marketMode,
          investmentThesis: '',
          riskFactors: [],
          investmentStyle: style,
          sources: [],
          extractedAt: new Date(),
          confidence: 0.8,
        };

        // 1단계 점수 산정: 오직 학습된 JSON 규칙(Criteria)에 기반
        const ruleScores: RuleScore[] = [];
        let weightedScoreSum = 0;
        let totalWeightSum = 0;
        let failedCritical = false;
        let failureReason = '';
 
        for (const rule of allRules) {
          const scoreResult = evaluateQuantifiedRule(rule, fullData, sectorStats);
          ruleScores.push(scoreResult);
 
          if (rule.isCritical && scoreResult.score < 5) {
            failedCritical = true;
            failureReason = `필수 조건 미달(${rule.name}): ${scoreResult.reason}`;
            break;
          }
 
          weightedScoreSum += scoreResult.score * rule.weight;
          totalWeightSum += rule.weight;
        }
 
        // 최종 점수는 학습된 규칙의 가중 평균 (10점 만점 기준)
        const finalScore = totalWeightSum > 0 ? (weightedScoreSum / totalWeightSum) : 0;
 
        stocksWithScores.push({
          ticker: stock.ticker,
          yahooData: fullData,
          periodReturn,
          company,
          ruleScores,
          totalScore: failedCritical ? 0 : Number(finalScore.toFixed(2)),
          failedCritical,
          failureReason,
        });
      } catch (err) {
        console.error(`Analysis failed for ${stock.ticker}:`, err);
        analyzedCount++;
      }
    }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // ── Phase 3: 상위권 선별 및 AI 정밀 분석 (비용 절감 핵심) ──
  if (onProgress) onProgress(85, '상위권 기업 선별 완료. AI 정밀 분석(뉴스/예측) 시작 중...');

  const preSorted = stocksWithScores
    .sort((a, b) => b.totalScore - a.totalScore || b.periodReturn - a.periodReturn)
    .slice(0, Math.min(companyCount + 10, 20)); // 상위 20개 선정

  const topPicks: any[] = [];

  for (let i = 0; i < preSorted.length; i++) {
    const stock = preSorted[i];
    const itemPct = 85 + Math.floor((i / preSorted.length) * 10);
    if (onProgress) onProgress(itemPct, `AI 정밀 분석 진행 중 (${newsAiModel || 'default'}): ${stock.ticker} (${i + 1}/${preSorted.length})`);

    try {
      // 상위권에게만 AI 감성 분석 및 주가 예측 수행
      const [sentiment, prediction] = await Promise.all([
        analyzeStockSentiment(stock.ticker, newsAiModel, newsApiKey),
        predictStockGrowth(stock.ticker, stock.yahooData, macroContext, { score: 0, label: 'Neutral', summary: '', recentHeadlines: [], riskHeadlines: [] }, newsAiModel, newsApiKey)
      ]);

      // 전문가 최종 판정 생성 (결론 도출형)
      const expertVerdict = await generateExpertVerdict(
        stock.ticker,
        stock.yahooData,
        macroContext,
        sentiment,
        prediction,
        knowledge,
        newsAiModel,
        newsApiKey
      );

      // 감성 점수로 최종 메인 스코어 보정 (가중치 강화)
      let adjustedScore = stock.totalScore;
      const sentimentImpact = (sentiment.score / 10) * 1.0;
      adjustedScore += sentimentImpact;
      adjustedScore = Math.max(0, Math.min(10, adjustedScore));

      const riskLevel = stock.periodReturn > 50 ? 'high' : stock.periodReturn > 20 ? 'medium' : 'low';
      const backtestResult = calculateBacktestResult(stock.yahooData);
      
      // 동적 전략 매칭 스코어 계산
      const strategyMatch = calculateStrategyMatch(stock.ruleScores, knowledge.strategyType || 'moderate');

      let thesis = '';
      if (stock.failedCritical) {
        thesis = `[투자 주의] ${stock.failureReason}. 필수 조건을 충족하지 못했습니다.`;
      } else {
        const topRules = [...stock.ruleScores].sort((a, b) => b.score - a.score).slice(0, 3);
        const sentimentInfo = `\n[시장 분위기] ${sentiment.label} (${sentiment.score}/10) - ${sentiment.summary}`;
        const macroInfo = `\n[매크로 환경] 시장 ${macroContext.marketMode} 모드, VIX ${macroContext.vixStatus} 상태.`;

        thesis = `${stock.ticker}는 통합 투자 로직 점수 ${adjustedScore.toFixed(1)}점입니다. ` +
          `${topRules.map(r => r.name).join(', ')} 분야에서 강력하며, AI 예측 결과 ${prediction.growthPotential} 전망입니다. ` +
          sentimentInfo + macroInfo;
      }

      topPicks.push({
        company: { ...stock.company, investmentThesis: thesis },
        yahooData: stock.yahooData,
        normalizedPrices: {
          currentPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          targetPriceKRW: prediction.sixMonthTargetPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          recommendedBuyPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          exchangeRateUsed: exchangeRate.rate,
        },
        filterResults: [
          { stage: 1, stageName: '필수 조건 검증', passed: !stock.failedCritical, reason: stock.failedCritical ? '필수 조건 미달' : '통과' },
          { stage: 2, stageName: 'AI 정밀 검증', passed: sentiment.score >= 0, reason: `AI가 분석한 감성 점수: ${sentiment.score}` }
        ],
        passedAllFilters: !stock.failedCritical && adjustedScore >= 7,
        score: adjustedScore * 10,
        expectedReturnRate: prediction.expectedReturn || stock.periodReturn,
        confidenceScore: Math.min(98, adjustedScore * 10),
        riskLevel,
        ruleScores: stock.ruleScores,
        totalRuleScore: adjustedScore,
        maxPossibleScore: 10,
        strategyMatch,
        macroContext,
        sentiment,
        prediction,
        expertVerdict,
        backtestResult,
      } as any);
    } catch (err) {
      console.error(`AI Enrichment failed for ${stock.ticker}:`, err);
    }
  }

  if (onProgress) onProgress(98, '분석 완료! 결과 정렬 중...');

  const finalTopPicks = topPicks
    .sort((a, b) => (b.totalRuleScore || 0) - (a.totalRuleScore || 0))
    .slice(0, companyCount);

  return {
    candidates: finalTopPicks,
    topPicks: finalTopPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `시장 유니버스에서 필수 조건을 검증하고 동적 로직으로 상위 기업을 선별했습니다.`,
    allSourcesUsed: deduplicateSources(allRules.map(r => r.source).filter(Boolean)),
    macroContext,
    queriedTickers: universe,
    excludedStockCount,
    excludedDetails,
    universeCounts
  };
}

/**
 * 과거 1년치 수익률과 S&P 500 대비 성과를 계산합니다. (백테스팅)
 */
function calculateBacktestResult(data: YahooFinanceData) {
  const history = data.priceHistory || [];
  if (history.length < 2) return undefined;

  const now = history[history.length - 1].close;

  // 1년 전 데이터 찾기
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const entryOneYearAgo = history.find(h => h.date >= oneYearAgo) || history[0];
  const pastPrice = entryOneYearAgo.close;

  if (pastPrice <= 0) return undefined;

  const pastOneYearReturn = ((now - pastPrice) / pastPrice) * 100;

  // S&P 500 1년 수익률 (간단히 15%로 가정하거나 나중에 실시간 연동)
  const sp500OneYearReturn = 15;
  const winRateVsS_P500 = pastOneYearReturn - sp500OneYearReturn;

  return {
    pastOneYearReturn: Number(pastOneYearReturn.toFixed(2)),
    winRateVsS_P500: Number(winRateVsS_P500.toFixed(2))
  };
}

/**
 * 업종별 지표 통계를 계산합니다. (상대적 점수 산정용)
 */
function calculateSectorStats(allData: YahooFinanceData[]): Record<string, Record<string, { avg: number, p80: number }>> {
  const stats: Record<string, Record<string, number[]>> = {};

  allData.forEach(d => {
    const sector = d.sector || 'Unknown';
    if (!stats[sector]) stats[sector] = {};

    const metrics = {
      revenue_growth: (d as any).revenueGrowth !== undefined ? (d as any).revenueGrowth * 100 : undefined,
      roe: d.returnOnEquity !== undefined ? d.returnOnEquity * 100 : undefined,
      per: d.trailingPE,
      pbr: d.priceToBook,
      operating_margin: (d as any).operatingMargins !== undefined ? (d as any).operatingMargins * 100 : undefined,
    };

    Object.entries(metrics).forEach(([m, v]) => {
      if (v !== undefined && !isNaN(v)) {
        if (!stats[sector][m]) stats[sector][m] = [];
        stats[sector][m].push(v);
      }
    });
  });

  const finalStats: Record<string, Record<string, { avg: number, p80: number }>> = {};
  Object.keys(stats).forEach(sector => {
    finalStats[sector] = {};
    Object.keys(stats[sector]).forEach(metric => {
      const vals = stats[sector][metric].sort((a, b) => a - b);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const p80 = vals[Math.floor(vals.length * 0.8)] || avg;
      finalStats[sector][metric] = { avg, p80 };
    });
  });

  return finalStats;
}

/**
 * AI가 추출한 계량화된 규칙을 바탕으로 실시간 데이터를 평가합니다.
 */
function evaluateQuantifiedRule(rule: any, data: YahooFinanceData, sectorStats?: Record<string, Record<string, { avg: number, p80: number }>>): RuleScore {
  const q = rule.quantification;
  const metric = q.target_metric;
  const condition = q.condition;
  const benchmark = q.benchmark;
  const scoringType = q.scoring_type;

  let actualValue: number | undefined;

  // 지표 매핑 로직
  switch (metric.toLowerCase()) {
    case 'revenue_growth': actualValue = (data as any).revenueGrowth !== undefined ? (data as any).revenueGrowth * 100 : undefined; break;
    case 'net_income_growth': actualValue = (data as any).netIncomeGrowth !== undefined ? (data as any).netIncomeGrowth * 100 : undefined; break;
    case 'roe': actualValue = data.returnOnEquity !== undefined ? data.returnOnEquity * 100 : undefined; break;
    case 'per': actualValue = data.trailingPE; break;
    case 'pbr': actualValue = data.priceToBook; break;
    case 'debt_ratio': actualValue = (data as any).debtToEquity; break;
    case 'operating_margin': actualValue = (data as any).operatingMargins !== undefined ? (data as any).operatingMargins * 100 : undefined; break;
    case 'dividend_yield': actualValue = data.dividendYield !== undefined ? data.dividendYield * 100 : undefined; break;
    case 'current_ratio': actualValue = (data as any).currentRatio; break;
    case 'quick_ratio': actualValue = (data as any).quickRatio; break;
    case 'eps_growth': actualValue = (data as any).epsGrowth !== undefined ? (data as any).epsGrowth * 100 : undefined; break;
    default:
      // 이름이 정확히 일치하지 않는 경우 유사어 매칭 시도
      if (metric.includes('revenue')) actualValue = (data as any).revenueGrowth !== undefined ? (data as any).revenueGrowth * 100 : undefined;
      else if (metric.includes('profit')) actualValue = (data as any).operatingMargins !== undefined ? (data as any).operatingMargins * 100 : undefined;
  }

  if (actualValue === undefined || isNaN(actualValue)) {
    return { 
      name: rule.name,
      category: rule.category,
      passed: false,
      score: 5,
      reason: `데이터 부재 (${metric})`,
      weight: rule.weight,
      isCritical: rule.isCritical,
      source: rule.source
    };
  }

  let targetBenchmark = benchmark;

  // 상대적 벤치마크 처리
  if (q.benchmark_type === 'sector_relative' || q.benchmark_type === 'sector_percentile') {
    const s = data.sector || 'Unknown';
    const m = metric.toLowerCase();
    const stats = sectorStats?.[s]?.[m];
    if (stats) {
      targetBenchmark = q.benchmark_type === 'sector_relative' ? stats.avg : stats.p80;
    }
  }

  const passed = (function () {
    switch (condition) {
      case '>': return actualValue > targetBenchmark;
      case '<': return actualValue < targetBenchmark;
      case '>=': return actualValue >= targetBenchmark;
      case '<=': return actualValue <= targetBenchmark;
      case '==': return actualValue === targetBenchmark;
      default: return false;
    }
  })();

  const benchmarkDisplay = q.benchmark_type === 'sector_relative' ? '업종평균' :
    q.benchmark_type === 'sector_percentile' ? '업종상위20%' : targetBenchmark;

  if (scoringType === 'binary') {
    return {
      name: rule.name,
      category: rule.category,
      passed: passed,
      score: passed ? 10 : 0,
      reason: `${actualValue.toFixed(1)} ${condition} ${benchmarkDisplay} (${passed ? '만족' : '미달'})`,
      weight: rule.weight,
      isCritical: rule.isCritical,
      source: rule.source
    };
  } else {
    // Linear
    let score = 5;
    if (condition === '>' || condition === '>=') {
      score = actualValue >= targetBenchmark ? 10 : (actualValue / (targetBenchmark || 1)) * 10;
    } else {
      score = actualValue <= targetBenchmark ? 10 : (targetBenchmark / (actualValue || 1)) * 10;
    }
    return {
      name: rule.name,
      category: rule.category,
      passed: passed,
      score: Math.min(10, Math.max(0, Number(score.toFixed(1)))),
      reason: `${actualValue.toFixed(1)} (기준: ${benchmarkDisplay})`,
      weight: rule.weight,
      isCritical: rule.isCritical,
      source: rule.source
    };
  }
}

/**
 * 학습된 규칙들을 바탕으로 종합 전략 매칭 점수를 산정합니다.
 */
function calculateStrategyMatch(rules: RuleScore[], strategyType: string): StrategyMatchScore {
  const totalCount = rules.length;
  // RuleScore는 MatchRuleResult를 상속받으므로 passed 속성이 있음
  const passedCount = rules.filter((r: RuleScore) => r.passed).length;
  
  // 가중치 반영 평균 점수 (10점 만점을 100점으로 환산)
  let weightedScoreSum = 0;
  let weightSum = 0;
  
  rules.forEach(r => {
    weightedScoreSum += r.score * r.weight;
    weightSum += r.weight;
  });
  
  const totalScore = weightSum > 0 ? (weightedScoreSum / weightSum) * 10 : 0;
  const matchPercentage = totalScore; // 0~100

  // 투자 단계 결정 (Match %에 따른 동적 배분)
  let investmentStage: StrategyMatchScore['investmentStage'];
  let allocationLabel: string;

  if (matchPercentage >= 85) {
    investmentStage = 'full';
    allocationLabel = '풀 매수 권고 (자료와 완벽히 일치)';
  } else if (matchPercentage >= 70) {
    investmentStage = 'expand2';
    allocationLabel = '2차 비중 확대 (강력한 매칭)';
  } else if (matchPercentage >= 50) {
    investmentStage = 'expand1';
    allocationLabel = '1차 비중 확대 (양호한 매칭)';
  } else if (matchPercentage >= 30) {
    investmentStage = 'scout';
    allocationLabel = '정찰병 진입 (관심 단계)';
  } else {
    investmentStage = 'watch';
    allocationLabel = '관람 및 대기 (부적합)';
  }

  return {
    rules,
    totalScore,
    matchPercentage,
    passedCount,
    totalCount,
    investmentStage,
    allocationLabel
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

