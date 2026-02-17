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
  knowledge: { criteria: LearnedInvestmentCriteria; strategy: InvestmentStrategy; fileAnalyses: { fileName: string; keyConditions: string[] }[] },
  style: InvestmentStyle = 'moderate',
  companyCount: number = 5,
  companyAiModel?: string,
  companyApiKey?: string,
  newsAiModel?: string,
  newsApiKey?: string
): Promise<RecommendationResult> {
  console.log(`Starting analysis engine with universe screening...`);
  
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
  ];

  console.log(`Evaluating ${allRules.length} rules for each company.`);
  
  // 기본 시세 데이터 1차 조회 (배치 처리)
  const batchSize = 25;
  const allYahooData: YahooFinanceData[] = [];
  
  for (let i = 0; i < universe.length; i += batchSize) {
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
        } catch (e) {}
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
    const chunk = validStocks.slice(i, i + chunkSize);
    await Promise.all(chunk.map(async (stock) => {
      try {
        const fullData = await fetchYahooFinanceData(stock.ticker, conditions.periodMonths || 12);
        
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

        // 0-10점 척도로 정규화 (AGENTS.md Rule 5 준수)
        const finalScore = totalWeightSum > 0 ? (weightedScoreSum / totalWeightSum) : 5;

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

  const topPicks: FilteredCandidate[] = stocksWithScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, Math.min(companyCount, 20))
    .map((stock) => {
      const riskLevel = stock.periodReturn > 50 ? 'high' : stock.periodReturn > 20 ? 'medium' : 'low';
      const sortedRules = [...stock.ruleScores].sort((a, b) => b.score - a.score);
      const topRules = sortedRules.slice(0, 3);
      
      const thesis = `${stock.ticker}는 종합 분석 결과 10점 만점 중 ${stock.totalScore}점으로 평가되었습니다. ` +
        `특히 ${topRules.map(r => r.rule.split(':')[0]).join(', ')} 등의 지표에서 긍정적인 신호를 보였습니다. ` +
        `실시간 데이터 기반 PER ${stock.yahooData.trailingPE?.toFixed(1) || 'N/A'}, ROE ${stock.yahooData.returnOnEquity ? (stock.yahooData.returnOnEquity * 100).toFixed(1) : 'N/A'}%를 기록하고 있어 투자 매력도가 우수합니다.`;

      return {
        company: { ...stock.company, investmentThesis: thesis },
        yahooData: stock.yahooData,
        normalizedPrices: {
          currentPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          targetPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1) * 1.2,
          recommendedBuyPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
          exchangeRateUsed: exchangeRate.rate,
        },
        filterResults: [
          { stage: 1, stageName: '분석 완료', passed: true, reason: '실시간 데이터 기반 규칙 평가 완료' }
        ],
        passedAllFilters: true,
        score: (stock.totalScore / 10) * 100, // 백분율 점수
        expectedReturnRate: stock.periodReturn,
        confidenceScore: Math.min(98, 65 + (stock.totalScore * 3)),
        riskLevel,
        ruleScores: stock.ruleScores,
        totalRuleScore: stock.totalScore, // 이제 0-10점
        maxPossibleScore: 10,
      };
    });

  return {
    candidates: topPicks,
    topPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `시장 유니버스 ${stocksWithScores.length}개 종목을 분석하여 투자 규칙 부합도가 가장 높은 TOP ${companyCount} 기업을 선정했습니다.`,
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
    return { rule, score: 3, reason: '성장 정체 또는 데이터 부재' };
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
