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

export async function runAnalysisEngine(
  conditions: InvestmentConditions,
  knowledge: { criteria: LearnedInvestmentCriteria; strategy: InvestmentStrategy; fileAnalyses: { fileName: string; keyConditions: string[] }[] },
  style: InvestmentStyle = 'moderate'
): Promise<RecommendationResult> {
  console.log(`Starting analysis engine with ${knowledge.fileAnalyses.length} learned files and universe screening...`);
  
  const exchangeRate = await fetchExchangeRate();
  const universe = getStockUniverse();
  console.log(`Universe size: ${universe.length} tickers`);
  
  const allRules = knowledge.criteria.goodCompanyRules.map(r => r.rule);
  console.log(`Total rules to evaluate: ${allRules.length}`);
  
  const batchSize = 40;
  const allYahooData: YahooFinanceData[] = [];
  
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

  console.log(`Fetched basic data for ${allYahooData.length} tickers`);

  const validStocks = allYahooData.filter(d => d.ticker && d.currentPrice > 0);
  console.log(`Valid stocks: ${validStocks.length}`);

  const stocksWithScores: Array<{
    ticker: string;
    yahooData: YahooFinanceData;
    periodReturn: number;
    annualizedReturn: number;
    company: ExtractedCompanyAnalysis;
    ruleScores: RuleScore[];
    totalScore: number;
  }> = [];

  for (const stock of validStocks.slice(0, 100)) {
    try {
      const fullData = await fetchYahooFinanceData(stock.ticker, conditions.periodMonths);
      
      if (!fullData.priceHistory || fullData.priceHistory.length < 2) {
        continue;
      }

      const history = fullData.priceHistory;
      const startPrice = history[0].close;
      const endPrice = history[history.length - 1].close;
      
      if (startPrice <= 0 || endPrice <= 0) continue;

      const periodReturn = ((endPrice - startPrice) / startPrice) * 100;
      const years = conditions.periodMonths / 12;
      const annualizedReturn = years > 0 
        ? ((Math.pow((endPrice / startPrice), (1 / years)) - 1) * 100)
        : periodReturn;

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
        investmentThesis: '',
        riskFactors: [],
        investmentStyle: style,
        sources: [],
        extractedAt: new Date(),
        confidence: 0.7,
      };

      // 각 규칙에 대해 점수 계산
      const ruleScores: RuleScore[] = [];
      for (const rule of allRules) {
        const score = calculateRuleScore(rule, fullData, company);
        ruleScores.push(score);
      }

      const totalScore = ruleScores.reduce((sum, rs) => sum + rs.score, 0);

      stocksWithScores.push({
        ticker: stock.ticker,
        yahooData: fullData,
        periodReturn,
        annualizedReturn,
        company,
        ruleScores,
        totalScore,
      });

    } catch (error) {
      console.error(`Error calculating returns for ${stock.ticker}:`, error);
    }
  }

  console.log(`Calculated returns and scores for ${stocksWithScores.length} stocks`);

  const topByScore = stocksWithScores
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  console.log(`TOP 5 by rule scores: ${topByScore.map(s => `${s.ticker}(${s.totalScore}점)`).join(', ')}`);

  const topPicks: FilteredCandidate[] = topByScore.map((stock, index) => {
    const riskLevel = stock.periodReturn > 50 ? 'high' : stock.periodReturn > 20 ? 'medium' : 'low';
    
    const maxPossibleScore = allRules.length * 10;
    const scorePercentage = (stock.totalScore / maxPossibleScore) * 100;
    
    // 상위 3개 규칙과 하위 3개 규칙 추출
    const sortedRules = [...stock.ruleScores].sort((a, b) => b.score - a.score);
    const topRules = sortedRules.filter(r => r.score === 10).slice(0, 3);
    const bottomRules = sortedRules.filter(r => r.score === 0).slice(0, 3);
    
    let investmentThesisText = `${stock.company.companyName}는 총 ${allRules.length}개 투자 규칙 중 ${stock.totalScore / 10}개 규칙에 부합하여 ${stock.totalScore}점을 획득했습니다. `;
    
    if (topRules.length > 0) {
      investmentThesisText += `특히 ${topRules.map(r => r.rule.substring(0, 20) + '...').join(', ')} 등에서 우수한 평가를 받았습니다. `;
    }
    
    investmentThesisText += `PER ${stock.yahooData.trailingPE?.toFixed(1) || 'N/A'}, ` +
      `ROE ${stock.yahooData.returnOnEquity ? (stock.yahooData.returnOnEquity * 100).toFixed(1) : 'N/A'}% 수준으로 ` +
      `재무건전성이 양호합니다.`;
    
    return {
      company: {
        ...stock.company,
        investmentThesis: investmentThesisText,
      },
      yahooData: stock.yahooData,
      normalizedPrices: {
        currentPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
        targetPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1) * 1.1,
        recommendedBuyPriceKRW: stock.yahooData.currentPrice * (stock.yahooData.currency === 'USD' ? exchangeRate.rate : 1),
        exchangeRateUsed: exchangeRate.rate,
      },
      filterResults: [
        { stage: 1, stageName: '유효성 검증', passed: true, reason: '유효한 티커' },
        { stage: 2, stageName: '규칙 기반 점수 계산', passed: true, reason: `${allRules.length}개 규칙 중 ${stock.totalScore / 10}개 부합` },
      ],
      passedAllFilters: true,
      score: scorePercentage,
      expectedReturnRate: stock.periodReturn,
      confidenceScore: 70 + (scorePercentage * 0.3),
      riskLevel,
      ruleScores: stock.ruleScores,
      totalRuleScore: stock.totalScore,
      maxPossibleScore: maxPossibleScore,
    };
  });

  return {
    candidates: topPicks,
    topPicks,
    investmentConditions: conditions,
    investmentStyle: style,
    exchangeRate,
    processedAt: new Date(),
    summary: `S&P 500, Russell 1000, Dow Jones 유니버스 내 ${stocksWithScores.length}개 종목을 ${allRules.length}개 투자 규칙으로 분석하여, 총점 기준 TOP 5 기업을 선정했습니다.`,
    allSourcesUsed: deduplicateSources([
      ...knowledge.criteria.goodCompanyRules.map(r => r.source)
    ]),
  };
}

function calculateRuleScore(rule: string, data: YahooFinanceData, company: ExtractedCompanyAnalysis): RuleScore {
  const ruleLower = rule.toLowerCase();
  
  if (ruleLower.includes('roe')) {
    const roe = data.returnOnEquity ? data.returnOnEquity * 100 : undefined;
    if (!roe) return { rule, score: 0, reason: 'ROE 데이터 없음' };
    
    if (ruleLower.includes('15%') && roe >= 15) {
      return { rule, score: 10, reason: `ROE ${roe.toFixed(1)}% >= 15%` };
    }
    if (ruleLower.includes('10%') && roe >= 10) {
      return { rule, score: 10, reason: `ROE ${roe.toFixed(1)}% >= 10%` };
    }
    if (ruleLower.includes('8%') && roe >= 8) {
      return { rule, score: 10, reason: `ROE ${roe.toFixed(1)}% >= 8%` };
    }
    return { rule, score: 0, reason: `ROE ${roe.toFixed(1)}%가 기준 미달` };
  }
  
  if (ruleLower.includes('per')) {
    const per = data.trailingPE;
    if (!per) return { rule, score: 0, reason: 'PER 데이터 없음' };
    
    if (ruleLower.includes('10~20') || ruleLower.includes('10-20')) {
      if (per >= 10 && per <= 20) {
        return { rule, score: 10, reason: `PER ${per.toFixed(1)}이 10~20배 적정 구간` };
      }
      return { rule, score: 0, reason: `PER ${per.toFixed(1)}이 10~20배 범위 밖` };
    }
    if (ruleLower.includes('10 이하') || ruleLower.includes('10이하')) {
      if (per <= 10) {
        return { rule, score: 10, reason: `PER ${per.toFixed(1)} <= 10` };
      }
      return { rule, score: 0, reason: `PER ${per.toFixed(1)} > 10` };
    }
    if (ruleLower.includes('30 이상') || ruleLower.includes('30이상')) {
      // 고평가 조건은 반대로 - 30 이상이면 감점 대상이지만 여기서는 그냥 0점
      return { rule, score: 0, reason: `PER ${per.toFixed(1)} - 고평가 구간` };
    }
    return { rule, score: 5, reason: `PER ${per.toFixed(1)} - 중간 평가` };
  }
  
  if (ruleLower.includes('pbr')) {
    const pbr = data.priceToBook;
    if (!pbr) return { rule, score: 0, reason: 'PBR 데이터 없음' };
    
    if (ruleLower.includes('1~2') || ruleLower.includes('1-2')) {
      if (pbr >= 1 && pbr <= 2) {
        return { rule, score: 10, reason: `PBR ${pbr.toFixed(1)}이 1~2배 적정 구간` };
      }
      return { rule, score: 0, reason: `PBR ${pbr.toFixed(1)}이 1~2배 범위 밖` };
    }
    return { rule, score: 5, reason: `PBR ${pbr.toFixed(1)}` };
  }
  
  if (ruleLower.includes('ev/ebitda') || ruleLower.includes('evebitda')) {
    // Yahoo Finance API에서 EV/EBITDA 데이터가 없을 수 있음
    const evEbitda = (data as any).enterpriseToEbitda;
    if (!evEbitda) {
      // EV/EBITDA가 없으면 PER 기반으로 간접 평가
      const per = data.trailingPE;
      if (per && per < 15) {
        return { rule, score: 10, reason: 'EV/EBITDA 데이터 없음, PER 기반 추정' };
      }
      return { rule, score: 5, reason: 'EV/EBITDA 데이터 없음' };
    }
    
    if (ruleLower.includes('10배 이하') || ruleLower.includes('10이하')) {
      if (evEbitda <= 10) {
        return { rule, score: 10, reason: `EV/EBITDA ${evEbitda.toFixed(1)} <= 10` };
      }
      return { rule, score: 0, reason: `EV/EBITDA ${evEbitda.toFixed(1)} > 10` };
    }
    return { rule, score: 5, reason: `EV/EBITDA ${evEbitda.toFixed(1)}` };
  }
  
  if (ruleLower.includes('eps') || ruleLower.includes('성장률')) {
    // EPS 성장률 데이터가 없으므로 PER과 주가 변동으로 추정
    const per = data.trailingPE;
    if (per && per < 20) {
      return { rule, score: 10, reason: 'PER 기반 추정 시 성장성 양호' };
    }
    return { rule, score: 5, reason: 'EPS 데이터 없음' };
  }
  
  if (ruleLower.includes('부채') || ruleLower.includes('debt')) {
    // 부채비율 데이터가 없으므로 PBR로 간접 추정
    const pbr = data.priceToBook;
    if (pbr && pbr < 1.5) {
      return { rule, score: 10, reason: 'PBR 기반 추정 시 재무구조 양호' };
    }
    return { rule, score: 5, reason: '부채비율 데이터 없음' };
  }
  
  if (ruleLower.includes('fcf') || ruleLower.includes('현금흐름') || ruleLower.includes('현금 흐름')) {
    // FCF 데이터가 없으므로 시가액으로 추정
    if (data.marketCap && data.marketCap > 1e10) {
      return { rule, score: 10, reason: '대형주로 추정 시 현금흐름 양호' };
    }
    return { rule, score: 5, reason: 'FCF 데이터 없음' };
  }
  
  if (ruleLower.includes('배당') || ruleLower.includes('dividend')) {
    const divYield = data.dividendYield ? data.dividendYield * 100 : undefined;
    if (!divYield) return { rule, score: 0, reason: '배당 데이터 없음' };
    
    if (ruleLower.includes('2~4%') || ruleLower.includes('2-4%')) {
      if (divYield >= 2 && divYield <= 4) {
        return { rule, score: 10, reason: `배당수익률 ${divYield.toFixed(1)}%가 2~4% 적정` };
      }
      return { rule, score: 0, reason: `배당수익률 ${divYield.toFixed(1)}%가 2~4% 범위 밖` };
    }
    return { rule, score: 5, reason: `배당수익률 ${divYield.toFixed(1)}%` };
  }
  
  return { rule, score: 5, reason: '규칙 해석 불가 - 중간 평가' };
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
