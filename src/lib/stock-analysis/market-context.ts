import { MacroContext, SentimentAnalysis, PredictiveAnalysis, YahooFinanceData } from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { callWithModelFallback } from '@/lib/utils/retry';

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
  apiKey?: string,
  asOfDate?: Date,
  fallbackAiModel?: string
): Promise<SentimentAnalysis | null> {
  try {
    let headlines: { title: string, url?: string }[] = [];
    const isHistorical = asOfDate && (new Date().getTime() - asOfDate.getTime() > 1000 * 60 * 60 * 24 * 7); // 7일 이상 과거

    if (isHistorical && asOfDate) {
      const end = asOfDate.toISOString().split('T')[0];
      const startObj = new Date(asOfDate);
      startObj.setMonth(startObj.getMonth() - 2); 
      const start = startObj.toISOString().split('T')[0];
      
      const query = `${ticker}+stock+after:${start}+before:${end}`;
      const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
      
      console.log(`[Time Machine] Fetching deep historical news (35+ items) for filtering: ${rssUrl}`);
      
      try {
        const response = await fetch(rssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
          }
        });
        const xml = await response.text();
        const matches = xml.match(/<title>(.*?)<\/title>/g) || [];
        headlines = matches
          .slice(1, 40) // Increased limit to 40 for better filtering pool
          .map(m => ({ title: m.replace(/<title>|<\/title>/g, '').replace(/&amp;/g, '&'), url: '' }))
          .filter(h => h.title.length > 15);
      } catch (e) {
        console.warn('Historical news fetch failed, falling back to recent search');
      }
    }

    if (headlines.length === 0) {
      const searchResult = await yahooFinance.search(ticker, {}, { validateResult: false }) as any;
      const news = (searchResult.news || []).slice(0, 30); 
      headlines = news.map((n: any) => ({ title: n.title, url: n.link || n.url })).filter((n: any) => n.title);
    }

    if (headlines.length === 0) {
      return {
        score: 0,
        label: 'Neutral',
        summary: '최근 주요 뉴스 데이터가 없습니다.',
        recentHeadlines: [],
        riskHeadlines: [],
      };
    }

    const prompt = `You are a professional investment analyst tasked with identifying CRITICAL signals for ${ticker}.

    1. DATA INPUT: You are provided with ${headlines.length} news headlines related to ${ticker}. 
    2. SIGNAL EXTRACTION (MAP): Carefully read each headline and categorize it:
       - 'Signal': Direct impact on earnings, product launch, M&A, regulatory changes, or significant insider/institutional activity.
       - 'Noise': Generic market updates, sports/celebrities with similar names, simple price movements without reasons, or ads.
    3. SELECTION (REDUCE): From the 'Signals', select the TOP 10 most impactful headlines for long-term investors.
    4. ANALYSIS: Calculate a sentiment score (-10 to 10) based ONLY on these top 10 signals. 

    Return a JSON object with:
    - score: integer from -10 to 10 based on the net impact of the top 10 signals.
    - label: 'Positive', 'Neutral', 'Negative' or 'High Potential'
    - summary: A cohesive 2-sentence summary of the overall news tone (KOREAN)
    - topSignals: Array of objects { title: string, impact: string } where impact is a 1-sentence explanation (KOREAN). Max 10 items.
    - riskHeadlines: Array of strings representing headlines explicitly mentioning downsides (KOREAN).
    - focusKeywords: 3-5 keywords representing the core theme (KOREAN).
    
    Headlines to analyze:
    ${headlines.map((h: { title: string }) => h.title).join('\n- ')}
    
    Return ONLY JSON. All explanations, summaries, and impacts must be in Korean.`;

    const resultObj: any = await callWithModelFallback(
      aiModel || '',
      fallbackAiModel,
      async (model) => {
        if (!model) throw new Error('AI 모델이 선택되지 않았습니다.');
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
          const gptApiKey = apiKey || process.env.OPENAI_API_KEY;
          if (!gptApiKey) throw new Error('OPENAI_API_KEY is missing');
          const openai = new OpenAI({ apiKey: gptApiKey });
          const response = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          });
          return response.choices[0].message.content || '';
        } else if (modelLower.includes('claude-')) {
          const claudeApiKey = apiKey || process.env.CLAUDE_API_KEY;
          if (!claudeApiKey) throw new Error('CLAUDE_API_KEY is missing');
          const anthropic = new Anthropic({ apiKey: claudeApiKey });
          const response = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          });
          return (response.content[0] as any).text || '';
        } else {
          const geminiApiKey = apiKey || process.env.GEMINI_API_KEY;
          if (!geminiApiKey) throw new Error('GEMINI_API_KEY is missing');
          const genAI = new GoogleGenAI({ apiKey: geminiApiKey });
          const modelName = model.startsWith('models/') ? model : `models/${model}`;
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
          });
          return {
            text: result.text || '',
            usageMetadata: result.usageMetadata
          };
        }
      }
    );
    
    const text = typeof resultObj === 'string' ? resultObj : (resultObj?.text || '');
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
  apiKey?: string,
  fallbackAiModel?: string
): Promise<PredictiveAnalysis | null> {
  try {
    const prompt = `Predict the 6-month growth potential for ${ticker} based on these deep factors:
    1. Financial Quality: PER ${metrics.trailingPE}, PBR ${metrics.priceToBook}, ROE ${metrics.returnOnEquity}, Operating Margin ${metrics.operatingMargins}, Free Cash Flow ${metrics.freeCashFlow}
    2. Supply/Demand Context: Institutional Ownership ${metrics.heldPercentInstitutions}, Insider Ownership ${metrics.heldPercentInsiders}
    3. Macro Context: Market Mode ${macro.marketMode}, VIX ${macro.vixStatus}, 10Y Yield ${macro.yieldStatus}
    4. Sentiment Score: ${sentiment.score}/10 (${sentiment.label})
    
    Return a JSON object:
    - growthPotential: 'Bullish', 'Neutral', or 'Bearish'
    - sixMonthTargetPrice: numeric target price
    - expectedReturn: percentage (0-100+)
    - logic: brief explanation supporting the prediction (MUST BE IN KOREAN)
    
    Return ONLY JSON. All explanations must be in Korean.`;

    const resultObj: any = await callWithModelFallback(
      aiModel || '',
      fallbackAiModel,
      async (model) => {
        if (!model) throw new Error('AI 모델이 선택되지 않았습니다.');
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
          const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
          const res = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          });
          return res.choices[0].message.content || '';
        } else if (modelLower.includes('claude-')) {
          const anthropic = new Anthropic({ apiKey: apiKey || process.env.CLAUDE_API_KEY });
          const res = await anthropic.messages.create({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
          });
          return (res.content[0] as any).text || '';
        } else {
          const genAI = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
          const modelName = model.startsWith('models/') ? model : `models/${model}`;
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
          });
          return {
            text: result.text || '',
            usageMetadata: result.usageMetadata
          };
        }
      }
    );

    const text = typeof resultObj === 'string' ? resultObj : (resultObj?.text || '');

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
  apiKey?: string,
  fallbackAiModel?: string
): Promise<any> {
  try {
    const prompt = `You are the investment expert who curated the provided knowledge base. 
    Analyze stock "${ticker}" by synthesizing market news and your articles.
    
    Context:
    - Business Profile: Sector - ${metrics.sector}, Industry - ${metrics.industry}
    - Business Summary: ${metrics.businessSummary ? metrics.businessSummary.slice(0, 500) : 'N/A'}
    - Expert Articles/Knowledge: ${knowledge.keyConditionsSummary || 'N/A'}
    - Current News Sentiment: ${sentiment.score}/10 (${sentiment.label})
    - Stock Performance: 1m Return ${metrics.returnRates?.oneMonth}%, 1y Return ${metrics.returnRates?.oneYear}%
    - Key Metrics: PER ${metrics.trailingPE}, ROE ${metrics.returnOnEquity}, Institutional Prop ${metrics.heldPercentInstitutions}
    - Macro Environment: Market ${macro.marketMode}, VIX ${macro.vixStatus}
    
    Priority: If the news/articles suggest a breakthrough technology or market disruption, prioritize this over weak financial data.
    
    Return ONLY a JSON object with:
    - recommendation: 'BUY', 'HOLD', or 'SELL'
    - riskLevel: 'low', 'medium', or 'high'
    - convictionScore: 0-100 (high conviction if news/articles are strongly positive)
    - title: brief catchy title
    - summary: summary of verdict focusing on qualitative growth (KOREAN)
    - businessModel: 1-2 sentence core business description (what they make, how they make money, main products/innovation) (KOREAN)
    - keyPoints: array of 3-4 specific growth catalysts from news/articles (KOREAN)
    - risks: array of strings (KOREAN)
    - authorCitations: array of objects { fileName: string, pageOrTimestamp: string }
    
    All text descriptions must be in Korean.`;

    const resultObj: any = await callWithModelFallback(
      aiModel || '',
      fallbackAiModel,
      async (model) => {
        if (!model) throw new Error('AI 모델이 선택되지 않았습니다.');
        const modelLower = model.toLowerCase();
        if (modelLower.includes('gpt-') || modelLower.includes('o1-')) {
          const openai = new OpenAI({ apiKey: apiKey || process.env.OPENAI_API_KEY });
          const res = await openai.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
          });
          return res.choices[0].message.content || '';
        } else if (modelLower.includes('claude-')) {
          const anthropic = new Anthropic({ apiKey: apiKey || process.env.CLAUDE_API_KEY });
          const res = await anthropic.messages.create({
            model,
            max_tokens: 1500,
            messages: [{ role: 'user', content: prompt }]
          });
          return (res.content[0] as any).text || '';
        } else {
          const genAI = new GoogleGenAI({ apiKey: apiKey || process.env.GEMINI_API_KEY });
          const modelName = model.startsWith('models/') ? model : `models/${model}`;
          const result = await genAI.models.generateContent({
            model: modelName,
            contents: [{ role: 'user', parts: [{ text: prompt }] }] as any
          });
          return {
            text: result.text || '',
            usageMetadata: result.usageMetadata
          };
        }
      }
    );

    const text = typeof resultObj === 'string' ? resultObj : (resultObj?.text || '');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return null;
  } catch (error) {
    console.error(`Verdict failed for ${ticker}:`, error);
    return null;
  }
}
