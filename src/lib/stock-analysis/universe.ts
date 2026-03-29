import { normalizeTicker } from './market-context';

/**
 * 전역 fetch를 사용하여 Wikipedia에서 데이터를 가져오는 헬퍼 함수 (axios 미설치 환경 대비)
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
 * Wikipedia에서 Russell 1000 티커 목록을 실시간으로 가져옵니다.
 */
async function fetchRussell1000Tickers(): Promise<string[]> {
  try {
    const url = 'https://en.wikipedia.org/wiki/Russell_1000_Index';
    const html = await fetchWikiHtml(url, 15000);
    
    const tickers: string[] = [];
    const tableRegex = /<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/;
    const match = html.match(tableRegex);
    
    if (match) {
      const tableHtml = match[1];
      // Russell 1000: 1st column is Company, 2nd column is Ticker
      const rowRegex = /<tr>\s*<td>[\s\S]*?<\/td>\s*<td>([^<]+)<\/td>/g;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
        let ticker = rowMatch[1].trim()
          .replace(/<[^>]*>/g, '') // remove any internal tags
          .replace(/\./g, '-');
        
        if (ticker && ticker.length < 10 && !ticker.includes(' ')) {
          tickers.push(ticker);
        }
      }
    }
    
    console.log(`[Universe] Fetched ${tickers.length} tickers from Russell 1000 Wikipedia`);
    return tickers.length > 0 ? tickers : [];
  } catch (error) {
    console.error(`[Universe] Error fetching Russell 1000:`, error);
    return [];
  }
}

/**
 * Wikipedia에서 S&P 500 티커 목록을 실시간으로 가져옵니다.
 */
async function fetchSP500Tickers(): Promise<string[]> {
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
      
      // 만약 위 정규식이 실패하면 (위키피디아 구조 변경 대비) 더 범용적인 패턴 사용
      if (tickers.length === 0) {
        const fallbackRegex = /<td><a[^>]*class="external text"[^>]*>([^<]+)<\/a><\/td>/g;
        while ((rowMatch = fallbackRegex.exec(tableHtml)) !== null) {
          const ticker = rowMatch[1].trim().replace(/\./g, '-');
          if (ticker && ticker.length < 8 && !ticker.includes(' ')) {
            tickers.push(ticker);
          }
        }
      }
    }
    
    console.log(`[Universe] Fetched ${tickers.length} tickers from S&P 500 Wikipedia`);
    return tickers.length > 0 ? tickers : [];
  } catch (error) {
    console.error(`[Universe] Error fetching S&P 500:`, error);
    return [];
  }
}

/**
 * 메인 함수: 요청 타입에 따라 유니버스 반환 (타임아웃 및 폴백 적용)
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
  console.log(`[Universe] Determining universe for type: ${type}`);
  
  try {
    let finalTickers: string[] = [];
    let sp500Tickers: string[] = [];
    let russellTickers: string[] = [];
    let overlapCount = 0;

    // S&P 500만 필요한 경우 Russell 1000 조회를 생략하여 성능 최적화 및 0% 지연 방지
    if (type === 'sp500') {
      sp500Tickers = await fetchSP500Tickers();
      finalTickers = sp500Tickers;
    } else {
      // Russell 1000(전체 또는 차집합)이 필요한 경우
      const [r, s] = await Promise.all([
        fetchRussell1000Tickers(),
        fetchSP500Tickers(),
      ]);
      russellTickers = r;
      sp500Tickers = s;

      const normalizedSP500 = new Set(sp500Tickers.map(normalizeTicker));

      if (type === 'russell1000') {
        finalTickers = russellTickers;
      } else {
        // russell1000_exclude_sp500 (기본값)
        finalTickers = russellTickers.filter(t => !normalizedSP500.has(normalizeTicker(t)));
        overlapCount = russellTickers.length - finalTickers.length;
      }
    }

    // 최종 결과가 너무 적으면 (Wikipedia 크롤링 실패 시) 최소한의 기본 리스트 반환
    if (finalTickers.length < 5) {
      console.warn(`[Universe] Wikipedia fetch produced too few results (${finalTickers.length}). Using fallback.`);
      finalTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX', 'AMD', 'AVGO'];
    }

    return {
      tickers: finalTickers,
      universeCounts: {
        russellCount: russellTickers.length,
        sp500Count: sp500Tickers.length,
        overlapCount: overlapCount,
        finalCount: finalTickers.length
      }
    };
  } catch (error) {
    console.error(`[Universe] Fatal error in getStockUniverse:`, error);
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
