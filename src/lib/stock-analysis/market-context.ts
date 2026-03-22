import { MacroContext, SentimentAnalysis, PredictiveAnalysis, YahooFinanceData } from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenAI } from '@google/genai';

const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey'] 
});

// 야후 파이낸스 밸리데이션 에러 로그 억제 (로그 오염 방지)
try {
  (yahooFinance as any).setGlobalConfig({ validation: { logErrors: false } });
} catch (e) {
  console.warn('Failed to set global config for yahoo-finance2');
}

/**
 * 전세계 시장 거시 지표를 가져와 분석합니다.
 */
export async function fetchMarketMacroContext(): Promise<MacroContext> {
  try {
    const symbols = ['^VIX', '^TNX', '^GSPC', 'USDKRW=X'];
    const quotes = await yahooFinance.quote(symbols, {}, { validateResult: false }) as any[];
    
    const vixEntry = quotes.find((q: any) => q.symbol === '^VIX');
    const tnxEntry = quotes.find((q: any) => q.symbol === '^TNX');
    const sp500Entry = quotes.find((q: any) => q.symbol === '^GSPC');
    
    const vix = vixEntry?.regularMarketPrice || 15;
    const treasuryYield10Y = tnxEntry?.regularMarketPrice || 4.2;
    
    // VIX 상태
    let vixStatus: MacroContext['vixStatus'] = 'Moderate';
    if (vix < 13) vixStatus = 'Low';
    else if (vix > 25) vixStatus = 'High';
    else if (vix > 35) vixStatus = 'Extreme';
    
    // 금리 상태 (최근 추세 반영은 생략하고 절대치로 판정)
    let yieldStatus: MacroContext['yieldStatus'] = 'Neutral';
    if (treasuryYield10Y > 4.5) yieldStatus = 'Bearish';
    else if (treasuryYield10Y < 3.5) yieldStatus = 'Bullish';
    
    // S&P 500 추세 (간단히 전일 대비로 판정 - 실제론 이동평균선 확인 권장)
    const sp500Price = (sp500Entry as any)?.regularMarketPrice || 0;
    const sp500Prev = (sp500Entry as any)?.regularMarketPreviousClose || 0;
    const sp500Chg = sp500Prev > 0 ? (sp500Price - sp500Prev) / sp500Prev : 0;
    
    let sp500Trend: MacroContext['sp500Trend'] = 'Sideways';
    if (sp500Chg > 0.005) sp500Trend = 'Uptrend';
    else if (sp500Chg < -0.005) sp500Trend = 'Downtrend';
    
    // 공포 탐욕 지수 대용
    let marketMode: MacroContext['marketMode'] = 'Neutral';
    if (vixStatus === 'High' || sp500Trend === 'Downtrend') marketMode = 'Fear';
    if (vixStatus === 'Low' && sp500Trend === 'Uptrend') marketMode = 'Greed';

    return {
      vix,
      vixStatus,
      treasuryYield10Y,
      yieldStatus,
      sp500Trend,
      marketMode,
      extractedAt: new Date(),
    };
  } catch (error) {
    console.warn('Macro fetch failed, using fallback:', error);
    return {
      vix: 15,
      vixStatus: 'Moderate',
      treasuryYield10Y: 4.2,
      yieldStatus: 'Neutral',
      sp500Trend: 'Sideways',
      marketMode: 'Neutral',
      extractedAt: new Date(),
    };
  }
}

/**
 * 개별 기업의 최근 뉴스를 가져와 감성 분석을 수행합니다.
 */
export async function analyzeStockSentiment(
  ticker: string, 
  aiModel: string = 'gemini-1.5-flash',
  apiKey?: string
): Promise<SentimentAnalysis> {
  try {
    // 1. 뉴스 데이터 가져오기 (Yahoo Search 사용)
    const searchResult = await yahooFinance.search(ticker, {}, { validateResult: false }) as any;
    const news = (searchResult.news || []).slice(0, 5);
    const headlines = news.map((n: any) => n.title).filter(Boolean);

    if (headlines.length === 0) {
      return {
        score: 0,
        label: 'Neutral',
        summary: '최근 주요 뉴스 데이터가 없습니다.',
        recentHeadlines: [],
        riskHeadlines: [],
      };
    }

    // 2. AI 감성 분석
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (!finalApiKey) throw new Error('GEMINI_API_KEY is missing');
    
    const client = new GoogleGenAI({ apiKey: finalApiKey });
    
    const prompt = `Analyze the sentiment of the following news headlines for stock ticker ${ticker}. 
    Return a JSON object with:
    - score: integer from -10 (very negative) to 10 (very positive)
    - label: 'Positive', 'Neutral', or 'Negative'
    - summary: brief 1-sentence summary of the news impact
    - riskHeadlines: array of headlines that suggest potential risks
    
    Headlines:
    ${headlines.join('\n- ')}
    
    Return ONLY JSON.`;

    const result = await client.models.generateContent({
      model: aiModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
    });
    
    const text = (result as any).text || '';
    
    // JSON 추출
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        recentHeadlines: headlines,
      };
    }

    return {
      score: 2,
      label: 'Neutral',
      summary: '감성 분석 결과 파싱 실패 (기본값 적용)',
      recentHeadlines: headlines,
      riskHeadlines: [],
    };
  } catch (error) {
    console.error(`Sentiment analysis failed for ${ticker}:`, error);
    return {
      score: 0,
      label: 'Neutral',
      summary: '뉴스 분석 중 오류가 발생했습니다.',
      recentHeadlines: [],
      riskHeadlines: [],
    };
  }
}

/**
 * 미래 주가 예측 모델 (AI 브레인)
 */
export async function predictStockGrowth(
  ticker: string,
  metrics: YahooFinanceData,
  macro: MacroContext,
  sentiment: SentimentAnalysis,
  aiModel: string = 'gemini-1.5-flash',
  apiKey?: string
): Promise<PredictiveAnalysis> {
  try {
    const finalApiKey = apiKey || process.env.GEMINI_API_KEY || '';
    if (!finalApiKey) throw new Error('GEMINI_API_KEY is missing');
    
    const client = new GoogleGenAI({ apiKey: finalApiKey });

    const prompt = `Predict the 6-month growth potential for ${ticker} based on these factors:
    1. Financial Metrics: PER ${metrics.trailingPE}, PBR ${metrics.priceToBook}, ROE ${metrics.returnOnEquity}
    2. Macro Context: Market Mode ${macro.marketMode}, VIX ${macro.vixStatus}, 10Y Yield ${macro.yieldStatus}
    3. Sentiment Score: ${sentiment.score}/10 (${sentiment.label})
    
    Return a JSON object with:
    - growthPotential: 'Bullish', 'Neutral', or 'Bearish'
    - sixMonthTargetPrice: numeric target price
    - expectedReturn: percentage (0-100+)
    - logic: brief explanation supporting the prediction
    
    Current Price: ${metrics.currentPrice} ${metrics.currency}
    
    Return ONLY JSON.`;

    const result = await client.models.generateContent({
      model: aiModel,
      contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
    });
    
    const text = (result as any).text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Prediction JSON not found');
  } catch (error) {
    console.error(`Prediction failed for ${ticker}:`, error);
    return {
      growthPotential: 'Neutral',
      sixMonthTargetPrice: metrics.currentPrice * 1.05,
      expectedReturn: 5,
      logic: '시장 불확실성으로 인해 보수적인 예측을 유지합니다.',
    };
  }
}
