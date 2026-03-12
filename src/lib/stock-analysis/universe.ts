/**
 * 실시간 Russell 1000 / S&P 500 구성종목을 가져와서
 * "Russell 1000에는 포함되되 S&P 500에는 없는 종목"만 반환합니다.
 *
 * 데이터 소스 (사용자 지정):
 *  - Russell 1000: https://en.wikipedia.org/wiki/Russell_1000_Index
 *  - S&P 500: https://en.wikipedia.org/wiki/List_of_S%26P_500_companies
 *
 * 두 소스 모두 실패 시 폴백 없이 예외를 발생시키고 링크를 안내합니다.
 */

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TenbaggerBot/1.0)',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// ── Russell 1000 실시간 조회 ────────────────────────────────────────────────
async function fetchRussell1000Tickers(): Promise<string[]> {
  const url = 'https://en.wikipedia.org/wiki/Russell_1000_Index';
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    
    // constituents ID를 가진 테이블 섹션만 추출
    const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) throw new Error('Russell 1000 구성종목 테이블(id="constituents")을 찾을 수 없습니다.');
    
    const tableHtml = tableMatch[1];
    const tickers = new Set<string>();
    
    // Russell 1000: 2번째 열(Index 1)에 티커가 있음
    const rowMatches = tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g);
    for (const rowMatch of rowMatches) {
      const cells = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g);
      const cellList = Array.from(cells);
      if (cellList.length >= 2) {
        // 2번째 열 데이터 추출 (태그 제거)
        const rawTicker = cellList[1][1].replace(/<[^>]*>/g, '').trim();
        // 티커 형식 검증 (1-5자 대문자)
        if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(rawTicker)) {
          tickers.add(rawTicker.replace('.', '-'));
        }
      }
    }

    if (tickers.size < 500) {
      throw new Error(`Russell 1000 조회된 기업 수가 너무 적습니다 (${tickers.size}개)`);
    }

    console.log(`[Universe] Russell 1000 live: ${tickers.size} tickers`);
    return Array.from(tickers);

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`러셀 1000 기업 목록 조회 실패: ${msg}\n- 다음 링크를 확인하세요: ${url}`);
  }
}

// ── S&P 500 실시간 조회 ────────────────────────────────────────────────────
async function fetchSP500Tickers(): Promise<Set<string>> {
  const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    
    // constituents ID를 가진 테이블 섹션만 추출
    const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/);
    if (!tableMatch) throw new Error('S&P 500 구성종목 테이블(id="constituents")을 찾을 수 없습니다.');

    const tableHtml = tableMatch[1];
    const tickers = new Set<string>();

    // S&P 500: 1번째 열(Index 0)에 티커가 있음
    const rowMatches = tableHtml.matchAll(/<tr>([\s\S]*?)<\/tr>/g);
    for (const rowMatch of rowMatches) {
      const cells = rowMatch[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g);
      const cellList = Array.from(cells);
      if (cellList.length >= 1) {
        // 1번째 열 데이터 추출 (태그 제거)
        const rawTicker = cellList[0][1].replace(/<[^>]*>/g, '').trim();
        if (/^[A-Z]{1,5}(\.[A-Z])?$/.test(rawTicker)) {
          tickers.add(rawTicker.replace('.', '-'));
        }
      }
    }

    if (tickers.size < 400) {
      throw new Error(`S&P 500 조회된 기업 수가 너무 적습니다 (${tickers.size}개)`);
    }

    console.log(`[Universe] S&P 500 live: ${tickers.size} tickers. Has NVDA? ${tickers.has('NVDA')}`);
    return tickers;

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`S&P 500 기업 목록 조회 실패: ${msg}\n- 다음 링크를 확인하세요: ${url}`);
  }
}


/**
 * 티커를 비교하기 위해 정규화합니다. (영문자만 추출)
 */
function normalizeTicker(ticker: string): string {
  return ticker.replace(/[^A-Z]/g, '').trim();
}

/**
 * 메인 함수: Russell 1000 실시간 조회 → S&P 500 차집합 반환
 * 실패 시 fallback 없이 error throw
 */
export async function getStockUniverse(): Promise<{ tickers: string[]; universeCounts: { russellCount: number; sp500Count: number; overlapCount: number; finalCount: number } }> {
  const [russell, sp500] = await Promise.all([
    fetchRussell1000Tickers(),
    fetchSP500Tickers(),
  ]);

  const normalizedSP500 = new Set(Array.from(sp500).map(normalizeTicker));
  const filtered = russell.filter(t => !normalizedSP500.has(normalizeTicker(t)));
  const unique = Array.from(new Set(filtered));

  const overlapCount = russell.length - unique.length;
  const universeCounts = {
    russellCount: russell.length,
    sp500Count: sp500.size,
    overlapCount,
    finalCount: unique.length,
  };

  console.log(`[Universe] Final Selection: ${unique.length} tickers (Russell ${russell.length} - ${overlapCount} overlap)`);
  return { tickers: unique, universeCounts };
}

export async function getUniverseCounts(): Promise<{ russellCount: number; sp500Count: number; overlapCount: number; finalCount: number }> {
  try {
    const { universeCounts } = await getStockUniverse();
    return universeCounts;
  } catch (error) {
    console.error('Failed to get universe counts:', error);
    return { russellCount: 0, sp500Count: 0, overlapCount: 0, finalCount: 0 };
  }
}




