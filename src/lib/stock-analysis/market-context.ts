import { MacroContext, SentimentAnalysis, PredictiveAnalysis, YahooFinanceData } from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { withRetry } from '@/lib/utils/retry';

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

    // 병렬로 데이터 수집
    const symbols = ['^VIX', '^TNX', '^IRX', '^TYX', '^GSPC', 'DX-Y.NYB', 'HYG'];
    
    const results = await Promise.all(symbols.map(async (s) => {
      try {
        const chart = await yahooFinance.chart(s, { 
          period1: period1Str, 
          period2: effectiveEndStr, 
          interval: '1d' 
        }, { validateResult: false }) as any;
        
        const quotes = chart?.quotes || [];
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
    const dxyData = results.find(r => r.symbol === 'DX-Y.NYB');
    const sp500Data = results.find(r => r.symbol === '^GSPC');

    const vix = vixData?.price || 15;
    const treasuryYield10Y = tnxData?.price || 4.2;
    const dxy = dxyData?.price || 104.0;
    const hySpread = (vix / 5) + 2.0; 
    
    let vixStatus: MacroContext['vixStatus'] = 'Moderate';
    if (vix < 13) vixStatus = 'Low';
    else if (vix > 25) vixStatus = 'High';
    else if (vix > 35) vixStatus = 'Extreme';
    
    let yieldStatus: MacroContext['yieldStatus'] = 'Neutral';
    if (treasuryYield10Y > 4.5) yieldStatus = 'Bearish';
    else if (treasuryYield10Y < 3.5) yieldStatus = 'Bullish';
    
    const sp500Price = sp500Data?.price || 0;
    const sp500Prev = sp500Data?.prevPrice || 0;
    const sp500Chg = sp500Prev > 0 ? (sp500Price - sp500Prev) / sp500Prev : 0;
    
    let sp500Trend: MacroContext['sp500Trend'] = 'Sideways';
    if (sp500Chg > 0.005) sp500Trend = 'Uptrend';
    else if (sp500Chg < -0.005) sp500Trend = 'Downtrend';
    
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
      dxy,
      hySpread,
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
  aiModel?: string,
  apiKey?: string
): Promise<SentimentAnalysis | null> {
  try {
    const searchResult = await yahooFinance.search(ticker, {}, { validateResult: false }) as any;
    const news = (searchResult.news || []).slice(0, 5);
    const headlines = news.map((n: any) => ({ title: n.title, url: n.link || n.url })).filter((n: any) => n.title);

    if (headlines.length === 0) {
      return {
        score: 0,
        label: 'Neutral',
        summary: '최근 주요 뉴스 데이터가 없습니다.',
        recentHeadlines: [],
        riskHeadlines: [],
      };
    }

    const prompt = `Analyze the sentiment of the following news headlines for stock ticker ${ticker}. 
    Return a JSON object with:
    - score: integer from -10 (very negative) to 10 (very positive)
    - label: 'Positive', 'Neutral', or 'Negative'
    - summary: brief 1-sentence summary of the news impact (MUST BE IN KOREAN)
    - riskHeadlines: array of headlines that suggest potential risks (MUST BE IN KOREAN)
    
    Headlines:
    ${headlines.map((h: { title: string }) => h.title).join('\n- ')}
    
    Return ONLY JSON. All text descriptions must be in Korean.`;

    const text = await withRetry(async () => {
      if (!aiModel) throw new Error('AI 모델이 선택되지 않았습니다.');
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
        return response.choices[0].message.content || '';
      } else if (modelLower.includes('claude-')) {
        const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;
        if (!claudeApiKey) throw new Error('CLAUDE_API_KEY is missing');
        const anthropic = new Anthropic({ apiKey: claudeApiKey });
        const response = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        });
        return (response.content[0] as any).text || '';
      } else {
        const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
        if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');
        const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
        const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
        try {
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
          });
          return (result as any).text || '';
        } catch (aiErr: any) {
          if (aiErr.status === 429 || aiErr.message?.includes('429') || aiErr.message?.includes('quota')) {
            throw new Error('AI_QUOTA_EXCEEDED');
          }
          throw aiErr;
        }
      }
    });
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Match AI identified risks back to their original URLs if possible
      const riskHeadlines = (parsed.riskHeadlines || []).map((riskTitle: string) => {
        const found = headlines.find((h: { title: string }) => riskTitle.includes(h.title) || h.title.includes(riskTitle));
        return { title: riskTitle, url: found?.url };
      });

      return { 
        ...parsed, 
        recentHeadlines: headlines,
        riskHeadlines: riskHeadlines
      };
    }

    throw new Error('Sentiment JSON parse failed');
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') {
      throw error;
    }
    console.error(`Sentiment analysis failed for ${ticker}:`, error);
    return null; // 실패 시 null 반환 (임의 등급 부여 방지)
  }
}

/**
 * 미래 주가 예측 모델
 */
export async function predictStockGrowth(
  ticker: string,
  metrics: YahooFinanceData,
  macro: MacroContext,
  sentiment: SentimentAnalysis,
  aiModel?: string,
  apiKey?: string
): Promise<PredictiveAnalysis | null> {
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
    
    Return ONLY JSON. All explanations must be in Korean.`;

    const text = await withRetry(async () => {
      if (!aiModel) throw new Error('AI 모델이 선택되지 않았습니다.');
      const modelLower = aiModel.toLowerCase();
      if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
        const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        return res.choices[0].message.content || '';
      } else if (modelLower.includes('claude-')) {
        const anthropic = new Anthropic({ apiKey: apiKey || process.env.CLAUDE_API_KEY });
        const res = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }]
        });
        return (res.content[0] as any).text || '';
      } else {
        const genAI = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
        const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
        try {
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
          });
          return (result as any).text || '';
        } catch (aiErr: any) {
          if (aiErr.status === 429 || aiErr.message?.includes('429') || aiErr.message?.includes('quota')) {
            throw new Error('AI_QUOTA_EXCEEDED');
          }
          throw aiErr;
        }
      }
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw new Error('Prediction JSON not found');
  } catch (error) {
    if (error instanceof Error && error.message === 'AI_QUOTA_EXCEEDED') {
      throw error;
    }
    console.error(`Prediction failed for ${ticker}:`, error);
    return null; // 실패 시 null 반환 (임의 점수 부여 방지)
  }
}

/**
 * 전문가 페르소나 기반 최종 판정 생성
 */
export async function generateExpertVerdict(
  ticker: string,
  metrics: YahooFinanceData,
  macro: MacroContext,
  sentiment: SentimentAnalysis,
  prediction: PredictiveAnalysis,
  knowledge: any,
  aiModel?: string,
  apiKey?: string
): Promise<any> {
  try {
    const prompt = `You are the specific investment expert who wrote the following source materials. 
    Expert Verdict for stock "${ticker}".
    Knowledge Base: ${knowledge.keyConditionsSummary || 'N/A'}
    Stock Data: PER ${metrics.trailingPE}, Sentiment ${sentiment.score}, Macro ${macro.marketMode}
    
    Return ONLY a JSON object with:
    - recommendation: 'BUY', 'HOLD', or 'SELL'
    - riskLevel: 'low', 'medium', or 'high'
    - convictionScore: 0-100
    - title: brief catchy title
    - summary: summary of verdict (KOREAN)
    - keyPoints: array of strings (KOREAN)
    - risks: array of strings (KOREAN)
    - authorCitations: array of objects { fileName: string, pageOrTimestamp: string }
    
    All text descriptions must be in Korean.`;

    const text = await withRetry(async () => {
      if (!aiModel) throw new Error('AI 모델이 선택되지 않았습니다.');
      const modelLower = aiModel.toLowerCase();
      if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
        const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
          model: aiModel,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' }
        });
        return res.choices[0].message.content || '';
      } else if (modelLower.includes('claude-')) {
        const anthropic = new Anthropic({ apiKey: apiKey || process.env.CLAUDE_API_KEY });
        const res = await anthropic.messages.create({
          model: aiModel,
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }]
        });
        return (res.content[0] as any).text || '';
      } else {
        const genAI = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
        const modelName = aiModel.startsWith('models/') ? aiModel : `models/${aiModel}`;
        const result = await genAI.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
        });
        return (result as any).text || '';
      }
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (error) {
    console.error(`Verdict failed for ${ticker}:`, error);
    return null;
  }
}
