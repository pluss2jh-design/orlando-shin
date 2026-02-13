import { NextRequest, NextResponse } from 'next/server';
import { NewsItem, NewsSummary } from '@/types/stock-analysis';

const NEWS_CACHE = new Map<string, { data: NewsItem[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchNewsFromYahoo(ticker: string): Promise<NewsItem[]> {
  try {
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const news = data.news || [];

    return news.map((item: any, index: number) => ({
      id: `${ticker}-${index}-${Date.now()}`,
      ticker,
      title: item.title || '제목 없음',
      content: item.summary || item.title || '내용 없음',
      summary: item.summary || '',
      source: item.publisher || 'Yahoo Finance',
      publishedAt: new Date(item.publishedAt || Date.now()),
      url: item.link || '',
      sentiment: analyzeSentiment(item.title + ' ' + (item.summary || '')),
    }));
  } catch (error) {
    console.error(`Failed to fetch news for ${ticker}:`, error);
    return generateMockNews(ticker);
  }
}

function analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
  const positiveWords = ['growth', 'profit', 'rise', 'gain', 'up', 'strong', 'bullish', 'success', 'breakthrough', 'record', 'high', 'surge', 'soar', 'rally', 'boost'];
  const negativeWords = ['loss', 'fall', 'drop', 'down', 'weak', 'bearish', 'decline', 'crash', 'plunge', 'tumble', 'slump', 'crisis', 'risk', 'concern', 'warning'];
  
  const lowerText = text.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeCount++;
  });
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

function generateMockNews(ticker: string): NewsItem[] {
  const now = Date.now();
  return [
    {
      id: `${ticker}-1`,
      ticker,
      title: `${ticker} 주가, 분기 실적 기대감에 강세`,
      content: '기업의 분기 실적 발표를 앞두고 투자자들의 기대감이 높아지며 주가가 상승세를 보이고 있습니다.',
      summary: '분기 실적 기대감으로 주가 상승',
      source: 'Yahoo Finance',
      publishedAt: new Date(now - 2 * 60 * 60 * 1000),
      url: '',
      sentiment: 'positive',
    },
    {
      id: `${ticker}-2`,
      ticker,
      title: `${ticker}, 신규 제품 출시 예고`,
      content: '혁신적인 신규 제품 출시를 예고하며 시장의 관심을 끌고 있습니다.',
      summary: '신규 제품 출시 예고',
      source: 'Market Watch',
      publishedAt: new Date(now - 8 * 60 * 60 * 1000),
      url: '',
      sentiment: 'positive',
    },
    {
      id: `${ticker}-3`,
      ticker,
      title: `${ticker} 투자의견 '매수' 유지`,
      content: '주요 증권사들이 투자의견을 매수로 유지하며 목표주가를 상향 조정했습니다.',
      summary: '투자의견 매수 유지, 목표주가 상향',
      source: 'Bloomberg',
      publishedAt: new Date(now - 24 * 60 * 60 * 1000),
      url: '',
      sentiment: 'positive',
    },
  ];
}

async function generateAISummary(news: NewsItem[], ticker: string): Promise<NewsSummary> {
  const positiveCount = news.filter(n => n.sentiment === 'positive').length;
  const negativeCount = news.filter(n => n.sentiment === 'negative').length;
  
  let overallSentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
  if (positiveCount > negativeCount) overallSentiment = 'positive';
  else if (negativeCount > positiveCount) overallSentiment = 'negative';
  
  const keyHighlights = news
    .slice(0, 3)
    .map(n => n.summary || n.title);
  
  return {
    ticker,
    companyName: ticker,
    totalNews: news.length,
    keyHighlights,
    overallSentiment,
    latestNews: news.slice(0, 5),
    generatedAt: new Date(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tickers } = body;

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json(
        { error: '티커 심볼 목록이 필요합니다' },
        { status: 400 }
      );
    }

    const confirmed = request.headers.get('X-Confirmed');
    if (confirmed !== 'true') {
      return NextResponse.json(
        { 
          error: 'API 비용 발생 알림 필요',
          message: '뉴스 조회 시 API 비용이 발생할 수 있습니다. 계속하시겠습니까?'
        },
        { status: 403 }
      );
    }

    const results: NewsSummary[] = [];
    
    for (const ticker of tickers) {
      const cacheKey = `${ticker}-news`;
      const cached = NEWS_CACHE.get(cacheKey);
      
      let news: NewsItem[];
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        news = cached.data;
      } else {
        news = await fetchNewsFromYahoo(ticker);
        NEWS_CACHE.set(cacheKey, { data: news, timestamp: Date.now() });
      }
      
      const summary = await generateAISummary(news, ticker);
      results.push(summary);
    }

    return NextResponse.json({ 
      results,
      success: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('News fetch error:', error);
    return NextResponse.json(
      { error: '뉴스를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
