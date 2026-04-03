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
  MacroContext,
  AnalysisResult,
  SentimentAnalysis,
  PredictiveAnalysis,
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

  newsAiModel?: string,
  newsApiKey?: string,
  onProgress?: (progress: number, message: string, meta?: { 
    excludedStockCount?: number; 
    excludedDetails?: ExcludedStockDetail[];
    processedCount?: number;
    universeCounts?: { russellCount: number; sp500Count: number; overlapCount: number; };
    macroContext?: MacroContext;
  }) => void
): Promise<RecommendationResult> {

  if (onProgress) onProgress(1, '분석 환경 초기화 중...');
  console.log('Engine: Initializing analysis components...');

  const asOfDate = conditions.asOfDate || new Date();
  const isHistorical = !!conditions.asOfDate;

  console.log(`Starting analysis: Full Strategy Knowledge Matching (As of: ${asOfDate.toISOString()})...`);

  console.log(`[Engine] Input Conditions:`, { 
    universeType: conditions.universeType, 
    excludeSP500: conditions.excludeSP500,
    strategyType: conditions.strategyType,
    asOfDate: conditions.asOfDate 
  });
  // 3가지 명시적 경로 처리 (사용자 제안 로직 반영)
  let universeType: 'sp500' | 'russell1000' | 'russell1000_exclude_sp500';
  
  if (conditions.universeType === 'sp500') {
    universeType = 'sp500';
  } else if (conditions.universeType === 'russell1000') {
    universeType = 'russell1000';
  } else if (conditions.universeType === 'russell1000_exclude_sp500') {
    universeType = 'russell1000_exclude_sp500';
  } else {
    // 폴백: 이전 호환성용 (플래그 확인)
    universeType = conditions.excludeSP500 ? 'russell1000_exclude_sp500' : 'sp500';
  }
  
  console.log(`[Engine] High-Explicit Universe Selection: ${universeType}`);

  if (onProgress) onProgress(3, '환율 정보 동기화 중...');
  const exchangeRate = await fetchExchangeRate();
  console.log('Engine: Exchange rate synchronized');
  
  if (onProgress) onProgress(5, '시장 매크로 환경(VIX/금리) 분석 중...');
  const macroContext = await fetchMarketMacroContext(asOfDate);
  console.log('Engine: Macro context fetched');
  
  if (onProgress) onProgress(7, '매크로 시장 분위기 파악 완료', { macroContext });

  if (onProgress) onProgress(8, `${universeType === 'sp500' ? 'S&P 500' : 'Russell 1000'} 유니버스 데이터 수집 중...`);
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
    console.log(`[Engine] Batch Fetch ${i}/${totalCount} - Current total: ${allYahooData.length}`);
    
    const batch = universe.slice(i, i + batchSize);
    try {
      const quotes = await fetchBatchQuotes(batch);
      allYahooData.push(...quotes);
      
      // 실시간 카운트 리포팅
      if (onProgress) onProgress(pct, `[1/2] 유니버스 시세 수집 중... ${allYahooData.length} / ${totalCount}개`, {
        processedCount: allYahooData.length,
        universeCounts: universeCounts
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.warn(`[Engine] Batch error at index ${i}, falling back to individual fetches`);
      for (const ticker of batch) {
        try {
          const singleQuote = await fetchBatchQuotes([ticker]);
          allYahooData.push(...singleQuote);
        } catch (e) { 
          console.error(`[Engine] Failed to fetch individual ticker: ${ticker}`);
        }
      }
    }
  }

  const validStocks = allYahooData.filter(d => d.ticker && (d.currentPrice > 0 || d.previousClose > 0));
  const validTickerSet = new Set(validStocks.map(s => s.ticker));

  const excludedDetails: ExcludedStockDetail[] = [];
  universe.forEach(ticker => {
    if (!validTickerSet.has(ticker)) {
      excludedDetails.push({ ticker, reason: '시세 정보 누락', category: '기초 데이터 이슈' });
    }
  });

  let excludedStockCount = excludedDetails.length;
  if (onProgress) {
    onProgress(20, `[1/2] 기초 시세 수집 완료 (분석 가능 ${validStocks.length}개)`, { 
      excludedStockCount, 
      excludedDetails,
      universeCounts: universeCounts || { russellCount: universe.length, sp500Count: 0, overlapCount: 0, finalCount: universe.length }
    });
  }

  const stocksWithScores: Array<{
    ticker: string;
    yahooData: YahooFinanceData;
    periodReturn: number;
    company: any;
    ruleScores: RuleScore[];
    totalScore: number;
    failedCritical?: boolean;
    failureReason?: string;
    isSpeculative?: boolean;
  }> = [];

  const sectorStats = calculateSectorStats(validStocks);

  // ── Phase 2: 상세 재무 데이터 + 점수 산정 ──
  let analyzedCount = 0;
  const chunkSize = 5;
  for (let i = 0; i < validStocks.length; i += chunkSize) {
    const batch = validStocks.slice(i, i + chunkSize);
    await Promise.all(batch.map(async (stock) => {
      try {
        const fullData = await fetchYahooFinanceData(stock.ticker, asOfDate);
        if (!fullData) {
          excludedDetails.push({ ticker: stock.ticker, reason: '상세 재무 데이터 조회 실패', category: '재무 데이터 이슈' });
          excludedStockCount++;
          return;
        }

        // 섹터 필터 (단, 데이터가 부족한 Track B 후보군은 우선 통과시킨 후 AI가 판단)
        if (conditions.sector && conditions.sector !== 'ALL') {
          const stockSector = (fullData.sector || 'Unknown').toLowerCase().trim();
          const targetSector = conditions.sector.toLowerCase().trim();
          const isSectorMatch = stockSector.includes(targetSector) || targetSector.includes(stockSector);
          
          if (!isSectorMatch && stockSector !== 'unknown') {
            excludedDetails.push({ ticker: stock.ticker, reason: `업종 불일치 (${conditions.sector})`, category: '업종 필터링' });
            excludedStockCount++;
            return;
          }
        }

        analyzedCount++;
        const totalAttempted = analyzedCount + excludedStockCount;
        const progressPct = 20 + Math.floor((totalAttempted / universe.length) * 65);

        if (onProgress) onProgress(progressPct, `[2/2] 상세 지표 분석 중... ${totalAttempted} / ${universe.length}개 완료`, {
          processedCount: analyzedCount,
          excludedStockCount: excludedStockCount,
          excludedDetails: excludedDetails,
          universeCounts: universeCounts
        });

        let periodReturn = 0;
        if (fullData.priceHistory && fullData.priceHistory.length >= 2) {
          const startPrice = fullData.priceHistory[0].close;
          const endPrice = fullData.currentPrice;
          if (startPrice > 0) periodReturn = ((endPrice - startPrice) / startPrice) * 100;
        }

        const ruleScores: RuleScore[] = [];
        let weightedScoreSum = 0;
        let totalWeightSum = 0;
        let failedCritical = false;
        let failureReason = '';

        // [중요] 상황 및 섹터 기반 동적 규칙 필터링 (사용자 요청 반영)
        const activeRules = allRules.filter(rule => {
          // 1. 범용 규칙은 항상 활성화
          if (rule.isGeneral) return true;

          // 2. 섹터 적합성 체크
          if (rule.targetSectors && rule.targetSectors.length > 0) {
            const stockSector = (fullData.sector || '').toLowerCase();
            const sectorMatch = rule.targetSectors.some(s => stockSector.includes(s.toLowerCase()));
            if (!sectorMatch) return false;
          }

          // 3. 매크로 상황 적합성 체크
          if (rule.applicableContexts && rule.applicableContexts.length > 0) {
            const currentContexts: string[] = [];
            if (macroContext.marketMode === 'Fear') currentContexts.push('recession');
            if (macroContext.marketMode === 'Greed') currentContexts.push('bull_market');
            if (macroContext.vixStatus === 'High' || macroContext.vixStatus === 'Extreme') currentContexts.push('volatility_high');
            if (macroContext.yieldStatus === 'Bearish') currentContexts.push('high_interest');

            const contextMatch = rule.applicableContexts.some(c => currentContexts.includes(c.toLowerCase()));
            if (!contextMatch) return false;
          }

          return true;
        });

        for (const rule of activeRules) {
          const scoreResult = evaluateQuantifiedRule(rule, fullData, sectorStats, macroContext);
          ruleScores.push(scoreResult);
          weightedScoreSum += scoreResult.score * rule.weight;
          totalWeightSum += rule.weight;
        }

        const finalScore = totalWeightSum > 0 ? (weightedScoreSum / totalWeightSum) : 0;
        const isDataSparse = ruleScores.some(rs => rs.reason.includes('데이터 부재') && rs.weight >= 4);
        
        // Track B 편입 조건: 
        // 1. 데이터가 부족(isDataSparse)하더라도 
        // 2. 다른 룰에서 일정 점수 이상(finalScore >= 4)이거나 
        // 3. 최근 주가 상승률(periodReturn)이 시장 평균 이상(positive)인 경우
        const hasPotential = finalScore >= 4 || periodReturn > 0;

        stocksWithScores.push({
          ticker: stock.ticker,
          yahooData: fullData,
          periodReturn,
          company: { metrics: { roe: fullData.returnOnEquity } },
          ruleScores,
          totalScore: Number(finalScore.toFixed(2)),
          failedCritical: false,
          failureReason: isDataSparse ? '데이터 부재 및 잠재력 분석 대상' : '',
          isSpeculative: isDataSparse && hasPotential, 
        });
      } catch (err) {
        console.error(`[Engine] Analysis failed for ${stock.ticker}:`, err);
        analyzedCount++;
      }
    }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // ── Phase 3: 트랙별 후보군 분리 및 AI 정밀 분석 ──
  if (onProgress) onProgress(85, '트랙별(A/B) 후보군 분리 및 AI 정밀 분석 시작...');

  // Track A: 정량 룰 통과 + 데이터 충분 (상위 20개 후보 중 최종 10개 선정)
  const trackACandidates = stocksWithScores
    .filter(s => !s.failedCritical && !s.isSpeculative)
    .sort((a, b) => b.totalScore - a.totalScore || b.periodReturn - a.periodReturn)
    .slice(0, 20);

  // Track B: 데이터 부족 혹은 우량주 기준 미달 중 잠재력 있는 후보 (상위 20개 후보 중 최종 10개 선정)
  const trackBCandidates = stocksWithScores
    .filter(s => s.isSpeculative)
    .sort((a, b) => b.totalScore - a.totalScore || b.periodReturn - a.periodReturn)
    .slice(0, 20);
  
  console.log(`[Engine] Candidates: Track A(${trackACandidates.length}), Track B(${trackBCandidates.length})`);

  const trackAResults: AnalysisResult[] = [];
  const trackBResults: AnalysisResult[] = [];

  // Track A 분석 루프
  for (let i = 0; i < trackACandidates.length && trackAResults.length < 10; i++) {
    const stock = trackACandidates[i];
    const itemPct = 85 + Math.floor((i / trackACandidates.length) * 5);
    if (onProgress) onProgress(itemPct, `[Track A] AI 정밀 분석 중: ${stock.ticker} (${i + 1}/${trackACandidates.length})`);

    const result = await performDeepAnalysis(stock, knowledge, newsAiModel, newsApiKey, 'A');
    if (result) trackAResults.push(result);
  }

  // Track B 분석 루프 (유닛 경제성/성장성 중심)
  for (let i = 0; i < trackBCandidates.length && trackBResults.length < 10; i++) {
    const stock = trackBCandidates[i];
    const itemPct = 90 + Math.floor((i / trackBCandidates.length) * 5);
    if (onProgress) onProgress(itemPct, `[Track B] AI 유닛 경제성 분석 중: ${stock.ticker} (${i + 1}/${trackBCandidates.length})`);

    const result = await performDeepAnalysis(stock, knowledge, newsAiModel, newsApiKey, 'B');
    if (result) trackBResults.push(result);
  }

  if (onProgress) onProgress(98, '분석 완료! 결과 정리 중...');

  // 최종 점수 기준 내림차순 정렬 (Deep Analysis 결과 반영)
  const finalTrackA = [...trackAResults].sort((a, b) => (b.score || 0) - (a.score || 0));
  const finalTrackB = [...trackBResults].sort((a, b) => (b.score || 0) - (a.score || 0));

  return {
    trackA: finalTrackA,
    trackB: finalTrackB,
    trackADescription: "학습된 룰을 모두 통과한 전통적 우량주 및 검증된 기업 기반의 정교한 포트폴리오입니다.",
    trackBDescription: "정량 데이터는 부족하지만 AI가 원천 데이터(뉴스/리포트)에서 강력한 성장 잠재력(Unit Economics)을 발견한 잠재적 유망주입니다.",
    analysisDate: new Date(),
    summary: `시장 유니버스(${universeType}) 전수 조사를 통해 우량주 ${finalTrackA.length}개와 잠재유망주 ${finalTrackB.length}개를 선별했습니다.`,
    investmentConditions: conditions,
    universeCounts,
    excludedStockCount,
    excludedDetails,
    macroContext,
  };
}

/**
 * 기업에 대한 심층 AI 분석을 수행합니다. (A/B 트랙 공용)
 */
async function performDeepAnalysis(
  stock: any, 
  knowledge: LearnedKnowledge, 
  aiModel?: string, 
  apiKey?: string,
  track: 'A' | 'B' = 'A'
): Promise<AnalysisResult | null> {
  try {
    const exchangeRate = await fetchExchangeRate();
    const macroContext = await fetchMarketMacroContext(new Date());

    // 1. 감성 분석
    const sentiment = await analyzeStockSentiment(stock.ticker, aiModel, apiKey);
    if (!sentiment) return null;

    // 2. 주가 예측
    const prediction = await predictStockGrowth(stock.ticker, stock.yahooData, macroContext, sentiment, aiModel, apiKey);
    if (!prediction) return null;

    // 3. 전문가 판정 (트랙에 따른 가중치 조절)
    const expertVerdict = await generateExpertVerdict(
      stock.ticker,
      stock.yahooData,
      macroContext,
      sentiment,
      prediction,
      knowledge,
      aiModel,
      apiKey
    );
    if (!expertVerdict) return null;

    let adjustedScore = stock.totalScore;
    const sentimentImpact = (sentiment.score / 10);
    adjustedScore += sentimentImpact;
    adjustedScore = Math.max(0, Math.min(10, adjustedScore));

    const thesisExcerpt = track === 'B' 
      ? `[잠재력 분석] ${stock.ticker}는 재무 데이터가 불충분하나 AI가 뉴스/리포트에서 ${prediction.growthPotential} 성장 동력을 발견했습니다. `
      : `${stock.ticker}는 전통적 우량주 트랙으로 분류되었습니다. AI 분석 결과 ${prediction.growthPotential} 전망이며, `;

    const thesis = thesisExcerpt + sentiment.summary;

    return {
      ticker: stock.ticker,
      companyName: stock.ticker,
      price: stock.yahooData.currentPrice,
      change: stock.yahooData.previousClose ? ((stock.yahooData.currentPrice - stock.yahooData.previousClose) / stock.yahooData.previousClose) * 100 : 0,
      marketCap: stock.yahooData.marketCap || 0,
      pe: stock.yahooData.trailingPE,
      sector: stock.yahooData.sector,
      description: sentiment.summary.slice(0, 100),
      score: adjustedScore * 10,
      recommendation: adjustedScore >= 8 ? 'STRONG_BUY' : adjustedScore >= 6 ? 'BUY' : 'HOLD',
      metrics: stock.company.metrics,
      rules: stock.ruleScores,
      investmentThesis: thesis,
      returnRates: stock.yahooData.returnRates,
      market: stock.yahooData.market || 'NYSE',
      riskLevel: expertVerdict?.riskLevel,
      riskFactors: expertVerdict.risks,
      expertVerdict,
      sources: stock.ruleScores.map((r: any) => r.source).filter(Boolean),
      track,
      isSpeculative: track === 'B',
      sentiment,
      prediction,
      macroContext,
      extractedAt: new Date(),
    } as AnalysisResult;
  } catch (error) {
    console.error(`[DeepAnalysis] Error for ${stock.ticker}:`, error);
    return null;
  }
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
function evaluateQuantifiedRule(
  rule: any, 
  data: YahooFinanceData, 
  sectorStats?: Record<string, Record<string, { avg: number, p80: number }>>,
  macroContext?: MacroContext
): RuleScore {
  const q = rule.quantification;
  const metric = q.target_metric;
  const condition = q.condition;
  const benchmark = q.benchmark;
  const scoringType = q.scoring_type;

  let actualValue: number | undefined;

  // 1. 매크로 지표 우선 매핑 (종목 데이터가 아닌 시장 전체 데이터 활용)
  const metricLower = metric.toLowerCase();
  
  if (macroContext) {
    if (metricLower.includes('vix')) {
      actualValue = macroContext.vix;
    } else if (metricLower.includes('달러') || metricLower.includes('dxy') || metricLower.includes('dollar')) {
      actualValue = macroContext.dxy;
    } else if (metricLower.includes('금리') || metricLower.includes('yield') || metricLower.includes('10y')) {
      actualValue = macroContext.treasuryYield10Y;
    } else if (metricLower.includes('하이일드') || metricLower.includes('spread') || metricLower.includes('high yield')) {
      actualValue = macroContext.hySpread;
    } else if (metricLower.includes('공포') || metricLower.includes('fear') || metricLower.includes('greed')) {
      actualValue = macroContext.vix; // Fear is related to VIX
    }
  }

  // 2. 종목 지합 매핑 (매크로가 아닌 경우)
  if (actualValue === undefined) {
    switch (metricLower) {
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
      case 'market_cap': actualValue = data.marketCap ? data.marketCap / 1000000000 : undefined; break; // Billions
      default:
        if (metricLower.includes('revenue')) actualValue = (data as any).revenueGrowth !== undefined ? (data as any).revenueGrowth * 100 : undefined;
        else if (metricLower.includes('profit')) actualValue = (data as any).operatingMargins !== undefined ? (data as any).operatingMargins * 100 : undefined;
    }
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
