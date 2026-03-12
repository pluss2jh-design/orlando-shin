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
    
    // Components 테이블 또는 링크를 통한 종목 파싱
    const tickers = new Set<string>();
    for (const re of [
      /<td[^>]*><a[^>]+>([A-Z]{1,5}(?:\.[A-Z])?)<\/a><\/td>/g,
      /<td>\s*([A-Z]{1,5}(?:\.[A-Z])?)\s*<\/td>/g,
    ]) {
      for (const m of html.matchAll(re)) {
        tickers.add(m[1].replace('.', '-')); // BRK.B -> BRK-B 변환
      }
    }

    if (tickers.size < 500) {
      throw new Error(`조회된 기업 수가 너무 적습니다 (${tickers.size}개)`);
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
    
    // S&P 500 components stocks 테이블
    const tickers = new Set<string>();
    for (const re of [
      /<td[^>]*><a[^>]+>([A-Z]{1,5}(?:\.[A-Z])?)<\/a><\/td>/g,
      /<td>\s*([A-Z]{1,5}(?:\.[A-Z])?)\s*<\/td>/g,
    ]) {
      for (const m of html.matchAll(re)) {
        tickers.add(m[1].replace('.', '-')); // BRK.B -> BRK-B 변환
      }
    }

    if (tickers.size < 400) {
      throw new Error(`조회된 기업 수가 너무 적습니다 (${tickers.size}개)`);
    }

    console.log(`[Universe] S&P 500 live: ${tickers.size} tickers`);
    return tickers;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`S&P 500 기업 목록 조회 실패: ${msg}\n- 다음 링크를 확인하세요: ${url}`);
  }
}

/**
 * 메인 함수: Russell 1000 실시간 조회 → S&P 500 차집합 반환
 * 실패 시 fallback 없이 error throw
 */
export async function getStockUniverse(): Promise<string[]> {
  const [russell, sp500] = await Promise.all([
    fetchRussell1000Tickers(),
    fetchSP500Tickers(),
  ]);

  const filtered = russell.filter(t => !sp500.has(t));
  const unique = Array.from(new Set(filtered));
  console.log(`[Universe] Final: ${unique.length} tickers (Russell ${russell.length} - SP500 ${sp500.size})`);
  return unique;
}
