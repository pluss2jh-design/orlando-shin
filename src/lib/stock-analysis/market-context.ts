import { MacroContext, SentimentAnalysis, PredictiveAnalysis, YahooFinanceData } from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

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
 * 티커 심볼을 표준화합니다 (예: BRK.B -> BRK-B)
 */
export function normalizeTicker(ticker: string): string {
  if (!ticker) return '';
  return ticker.trim().toUpperCase().replace(/\./g, '-');
}

/**
 * 전세계 시장 거시 지표를 가져와 분석합니다.
 */
export async function fetchMarketMacroContext(asOfDate?: Date): Promise<MacroContext> {
  try {
    const effectiveEnd = asOfDate || new Date();
    const effectiveEndStr = effectiveEnd.toISOString().split('T')[0];
    
    // 1개월치 데이터를 가져와서 asOfDate 당일의 값을 찾음
    const period1 = new Date(effectiveEnd);
    period1.setMonth(period1.getMonth() - 1);
    const period1Str = period1.toISOString().split('T')[0];

    // 병렬로 데이터 수집하되, 하나라도 멈추는 것을 방지하기 위해 개별 타임아웃 고려
    // yahoo-finance2는 내부적으로 fetch를 사용하므로 g_timeout 등을 활용할 수 있음
    const symbols = ['^VIX', '^TNX', '^IRX', '^TYX', '^GSPC'];
    
    const results = await Promise.all(symbols.map(async (s) => {
      try {
        // chart 호출 시 validateResult: false로 하여 엄격한 검증 생략 (속도 개선)
        const chart = await yahooFinance.chart(s, { 
          period1: period1Str, 
          period2: effectiveEndStr, 
          interval: '1d' 
        }, { validateResult: false }) as any;
        
        const quotes = chart?.quotes || [];
        // asOfDate 이전 또는 당일 마지막 데이터 찾기
        const past = quotes.filter((q: any) => q.close != null && q.date <= effectiveEnd).sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
        if (past.length > 0) {
          return { symbol: s, price: past[0].close, prevPrice: past[1]?.close || past[0].close };
        }
        return { symbol: s, price: 0, prevPrice: 0 };
      } catch (e) {
        return { symbol: s, price: 0, prevPrice: 0 };
      }
    }));

    const vixData = results.find(r => r.symbol === '^VIX');
    const tnxData = results.find(r => r.symbol === '^TNX');
    const sp500Data = results.find(r => r.symbol === '^GSPC');

    const vix = vixData?.price || 15;
    const treasuryYield10Y = tnxData?.price || 4.2;
    
    // VIX 상태
    let vixStatus: MacroContext['vixStatus'] = 'Moderate';
    if (vix < 13) vixStatus = 'Low';
    else if (vix > 25) vixStatus = 'High';
    else if (vix > 35) vixStatus = 'Extreme';
    
    // 금리 상태 (절대치로 판정)
    let yieldStatus: MacroContext['yieldStatus'] = 'Neutral';
    if (treasuryYield10Y > 4.5) yieldStatus = 'Bearish';
    else if (treasuryYield10Y < 3.5) yieldStatus = 'Bullish';
    
    // S&P 500 추세
    const sp500Price = sp500Data?.price || 0;
    const sp500Prev = sp500Data?.prevPrice || 0;
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
      extractedAt: effectiveEnd,
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
    const prompt = `Analyze the sentiment of the following news headlines for stock ticker ${ticker}. 
    Return a JSON object with:
    - score: integer from -10 (very negative) to 10 (very positive)
    - label: 'Positive', 'Neutral', or 'Negative'
    - summary: brief 1-sentence summary of the news impact (MUST BE IN KOREAN)
    - riskHeadlines: array of headlines that suggest potential risks (MUST BE IN KOREAN)
    
    Headlines:
    ${headlines.join('\n- ')}
    
    Return ONLY JSON. All text descriptions must be in Korean.`;

    let text = '';
    const modelLower = aiModel.toLowerCase();

    // Provider 분기
    if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
      const gptApiKey = apiKey || process.env.OPENAI_API_KEY;
      if (!gptApiKey) throw new Error('OPENAI_API_KEY is missing');
      const openai = new OpenAI({ apiKey: gptApiKey });
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      text = response.choices[0].message.content || '';
    } else if (modelLower.includes('claude-')) {
      const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;
      if (!claudeApiKey) throw new Error('CLAUDE_API_KEY is missing');
      const anthropic = new Anthropic({ apiKey: claudeApiKey });
      const response = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      text = (response.content[0] as any).text || '';
    } else {
      // Default: Gemini (@google/genai 공식 SDK 방식)
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');
      
      const genAI = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        // apiVersion: 'v1' // 필요 시 v1 지정
      });
      
      // `@google/genai`는 모델명에서 'models/' 유무를 신중하게 다뤄야 함
      // listResources 확인 결과 'models/gemini-1.5-flash'가 정식 명칭임
      const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
      
      try {
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
        });
        text = (result as any).text || '';
      } catch (aiErr: any) {
        console.error(`[AI_ERROR] Gemini call failed for ${ticker}:`, aiErr);
        // 사용자에게 노출되지 않도록 로그파일에만 남김
        throw aiErr;
      }
    }
    
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
    const prompt = `Predict the 6-month growth potential for ${ticker} based on these factors:
    1. Financial Metrics: PER ${metrics.trailingPE}, PBR ${metrics.priceToBook}, ROE ${metrics.returnOnEquity}
    2. Macro Context: Market Mode ${macro.marketMode}, VIX ${macro.vixStatus}, 10Y Yield ${macro.yieldStatus}
    3. Sentiment Score: ${sentiment.score}/10 (${sentiment.label})
    
    Return a JSON object:
    - growthPotential: 'Bullish', 'Neutral', or 'Bearish'
    - sixMonthTargetPrice: numeric target price
    - expectedReturn: percentage (0-100+)
    - logic: brief explanation supporting the prediction (MUST BE IN KOREAN)
    
    Current Price: ${metrics.currentPrice} ${metrics.currency}
    
    Return ONLY JSON. All explanations must be in Korean.`;

    let text = '';
    const modelLower = aiModel.toLowerCase();

    if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
      const gptApiKey = apiKey || process.env.OPENAI_API_KEY;
      if (!gptApiKey) throw new Error('OPENAI_API_KEY is missing');
      const openai = new OpenAI({ apiKey: gptApiKey });
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      text = response.choices[0].message.content || '';
    } else if (modelLower.includes('claude-')) {
      const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;
      if (!claudeApiKey) throw new Error('CLAUDE_API_KEY is missing');
      const anthropic = new Anthropic({ apiKey: claudeApiKey });
      const response = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      text = (response.content[0] as any).text || '';
    } else {
      // Default: Gemini
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');
      
      const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
      const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
      
      console.log(`[AI] Calling Gemini with model: ${modelName}`);
      
      try {
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
        });
        text = (result as any).text || '';
      } catch (aiErr: any) {
        console.error(`[AI_ERROR] Prediction failed for ${ticker}:`, aiErr);
        throw aiErr;
      }
    }
    
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

/**
 * 전문가 페르소나 기반 최종 판정 생성 (Phase 2)
 */
export async function generateExpertVerdict(
  ticker: string,
  metrics: YahooFinanceData,
  macro: MacroContext,
  sentiment: SentimentAnalysis,
  prediction: PredictiveAnalysis,
  knowledge: any, // LearnedKnowledge
  aiModel: string = 'gemini-1.5-flash',
  apiKey?: string
): Promise<any> {
  try {
    const prompt = `You are the specific investment expert who wrote the following source materials. 
    Your goal is to provide a "Conclusion-oriented Analysis" (Expert Verdict) for the stock "${ticker}".
    
    [Your Investment Philosophy / Knowledge Base]:
    ${knowledge.keyConditionsSummary || 'N/A'}
    
    [Stock Data]:
    - Financials: PER ${metrics.trailingPE}, PBR ${metrics.priceToBook}, ROE ${metrics.returnOnEquity}
    - Recent News Sentiment: ${sentiment.score}/10 (${sentiment.summary})
    - Macro Context: ${macro.marketMode} mode, VIX ${macro.vixStatus}
    - AI Prediction: ${prediction.growthPotential} with ${prediction.expectedReturn}% return
    
    [Task]:
    Based on your unique worldview (Knowledge Base), deliver the final verdict. 
    1. Recommendation: Choose from 'BUY', 'SELL', 'HOLD', 'WATCH'.
    2. Conviction Score: 0 to 100.
    3. Title: A sharp, professional headline (MUST BE IN KOREAN).
    4. Summary: A deep, authoritative reasoning (MUST BE IN KOREAN, 3-4 sentences).
    5. Key Points: 3 clear reasons to support your verdict (MUST BE IN KOREAN).
    6. Risks: 2 potential risks (MUST BE IN KOREAN).
    7. Author Citations: List 2 references to your own material (FileName and context).
    
    Return ONLY a JSON object:
    {
      "recommendation": "BUY",
      "convictionScore": 85,
      "title": "엔비디아: AI 인프라의 절대적 지배력과 저평가 해소",
      "summary": "저자의 성장주 투자 원칙에 부합하며...",
      "keyPoints": ["AI 수요 폭증", "강력한 현금 흐름", "업종 내 독점적 지위"],
      "risks": ["금리 인상 리스크", "지정학적 불안"],
      "authorCitations": [{"fileName": "2024_Strategy.pdf", "pageOrTimestamp": "14", "context": "독점적 지위 강조"}]
    }
    
    Return ONLY JSON. All explanations must be in Korean.`;

    let text = '';
    const modelLower = aiModel.toLowerCase();

    if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
      const gptApiKey = apiKey || process.env.OPENAI_API_KEY;
      if (!gptApiKey) throw new Error('OPENAI_API_KEY is missing');
      const openai = new OpenAI({ apiKey: gptApiKey });
      const response = await openai.chat.completions.create({
        model: aiModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      text = response.choices[0].message.content || '';
    } else if (modelLower.includes('claude-')) {
      const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;
      if (!claudeApiKey) throw new Error('CLAUDE_API_KEY is missing');
      const anthropic = new Anthropic({ apiKey: claudeApiKey });
      const response = await anthropic.messages.create({
        model: aiModel,
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });
      text = (response.content[0] as any).text || '';
    } else {
      // Default: Gemini
      const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');
      
      const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
      const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
      
      try {
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
        });
        text = (result as any).text || '';
      } catch (aiErr: any) {
        console.error(`[AI_ERROR] Verdict failed for ${ticker}:`, aiErr);
        throw aiErr;
      }
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Expert Verdict JSON not found');
  } catch (error) {
    console.error(`Verdict failed for ${ticker}:`, error);
    return null;
  }
}
