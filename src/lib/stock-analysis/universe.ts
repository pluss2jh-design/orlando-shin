import { normalizeTicker } from './market-context';

// 메모리 캐싱을 위한 데이터 구조
interface UniverseCache {
  tickers: string[];
  lastFetched: number;
}

const CACHE_LIFETIME = 24 * 60 * 60 * 1000; // 24시간 캐시 유지
const sp500Cache: UniverseCache = { tickers: [], lastFetched: 0 };
const russellCache: UniverseCache = { tickers: [], lastFetched: 0 };

/**
 * 전역 fetch를 사용하여 Wikipedia에서 데이터를 가져오는 헬퍼 함수
 */
async function fetchWikiHtml(url: string, timeoutMs: number = 15000): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    clearTimeout(id);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.text();
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Wikipedia에서 Russell 1000 티커 목록을 실시간으로 가져오거나 캐시에서 반환합니다.
 */
async function fetchRussell1000Tickers(): Promise<string[]> {
  const now = Date.now();
  if (russellCache.tickers.length > 0 && (now - russellCache.lastFetched < CACHE_LIFETIME)) {
    console.log(`[Universe] Returning ${russellCache.tickers.length} Russell 1000 tickers from cache`);
    return russellCache.tickers;
  }

  try {
    const url = 'https://en.wikipedia.org/wiki/Russell_1000_Index';
    const html = await fetchWikiHtml(url, 15000);
    
    const tickers: string[] = [];
    const tableRegex = /<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/;
    let match = html.match(tableRegex);
    
    if (!match) {
      match = html.match(/<table[^>]*class="wikitable[^>]*>([\s\S]*?)<\/table>/);
    }
    
    if (match) {
      const tableHtml = match[1];
      const rowRegex = /<tr>\s*<td>[\s\S]*?<\/td>\s*<td>\s*(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?\s*<\/td>/g;
      
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        let ticker = rowMatch[1].trim()
          .replace(/<[^>]*>/g, '') 
          .replace(/\./g, '-');
        
        if (ticker && ticker.length < 10 && !ticker.includes(' ')) {
          tickers.push(ticker);
        }
      }
    }
    
    if (tickers.length > 0) {
      russellCache.tickers = tickers;
      russellCache.lastFetched = now;
      console.log(`[Universe] Fetched and cached ${tickers.length} Russell 1000 tickers`);
    }
    return tickers;
  } catch (error) {
    console.error(`[Universe] Error fetching Russell 1000:`, error);
    return russellCache.tickers; 
  }
}

/**
 * Wikipedia에서 S&P 500 티커 목록을 실시간으로 가져오거나 캐시에서 반환합니다.
 */
async function fetchSP500Tickers(): Promise<string[]> {
  const now = Date.now();
  if (sp500Cache.tickers.length > 0 && (now - sp500Cache.lastFetched < CACHE_LIFETIME)) {
    console.log(`[Universe] Returning ${sp500Cache.tickers.length} S&P 500 tickers from cache`);
    return sp500Cache.tickers;
  }

  try {
    const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
    const html = await fetchWikiHtml(url, 10000);
    
    const tickers: string[] = [];
    const tableRegex = /<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/;
    const match = html.match(tableRegex);
    
    if (match) {
      const tableHtml = match[1];
      const rowRegex = /<tr>\s*<td>\s*<a[^>]*>([^<]+)<\/a>\s*<\/td>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        const ticker = rowMatch[1].trim()
          .replace(/<[^>]*>/g, '') 
          .replace(/\./g, '-');
        if (ticker && ticker.length < 10 && !ticker.includes(' ')) {
          tickers.push(ticker);
        }
      }
    }
    
    if (tickers.length > 0) {
      sp500Cache.tickers = tickers;
      sp500Cache.lastFetched = now;
      console.log(`[Universe] Fetched and cached ${tickers.length} S&P 500 tickers`);
    }
    return tickers;
  } catch (error) {
    console.error(`[Universe] Error fetching S&P 500:`, error);
    return sp500Cache.tickers;
  }
}

/**
 * 메인 함수: 요청 타입에 따라 유니버스 반환 (캐싱 및 폴백 적용)
 */
export async function getStockUniverse(type: 'sp500' | 'russell1000' | 'russell1000_exclude_sp500' = 'russell1000_exclude_sp500'): Promise<{ 
  tickers: string[]; 
  universeCounts: { 
    russellCount: number; 
    sp500Count: number; 
    overlapCount: number;
    finalCount?: number; 
  } 
}> {
  console.log(`[Universe] Rapid Universe Fetch for type: ${type}`);
  
  try {
    let finalTickers: string[] = [];
    let sp500Tickers: string[] = [];
    let russellTickers: string[] = [];
    let overlapCount = 0;

    if (type === 'sp500') {
      sp500Tickers = await fetchSP500Tickers();
      finalTickers = sp500Tickers;
    } else if (type === 'russell1000') {
      const [r, s] = await Promise.all([
        fetchRussell1000Tickers(),
        fetchSP500Tickers(),
      ]);
      russellTickers = r;
      sp500Tickers = s;
      finalTickers = russellTickers;
    } else {
      const [r, s] = await Promise.all([
        fetchRussell1000Tickers(),
        fetchSP500Tickers(),
      ]);
      russellTickers = r;
      sp500Tickers = s;
      const normalizedSP500 = new Set(sp500Tickers.map(normalizeTicker));
      finalTickers = russellTickers.filter(t => !normalizedSP500.has(normalizeTicker(t)));
      overlapCount = russellTickers.length - finalTickers.length;
    }

    if (finalTickers.length < 5) {
      console.warn(`[Universe] Universe data too small (${finalTickers.length}). Using emergency fallback.`);
      finalTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX', 'AMD', 'AVGO'];
    }

    return {
      tickers: finalTickers,
      universeCounts: {
        russellCount: russellTickers.length || finalTickers.length,
        sp500Count: sp500Tickers.length,
        overlapCount: overlapCount,
        finalCount: finalTickers.length
      }
    };
  } catch (error) {
    console.error(`[Universe] Critical error in getStockUniverse:`, error);
    return {
      tickers: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA'],
      universeCounts: { russellCount: 0, sp500Count: 0, overlapCount: 0 }
    };
  }
}

/**
 * 지수 구성을 위한 티커 개수 정보를 반환합니다.
 */
export async function getUniverseCounts() {
  const result = await getStockUniverse('russell1000_exclude_sp500');
  return result.universeCounts;
}
