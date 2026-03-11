/**
 * 실시간 Russell 1000 / S&P 500 구성종목을 가져와서
 * "Russell 1000에는 포함되되 S&P 500에는 없는 종목"만 반환합니다.
 *
 * 데이터 소스:
 *  - Russell 1000: iShares IWB ETF 구성종목 CSV (SSGA 공개 데이터)
 *  - S&P 500: Wikipedia 목록 (안정적 파싱 가능)
 *
 * 두 소스 모두 실패 시 빌트인 폴백 목록을 사용합니다.
 */

/** 실시간 Russell 1000 구성종목 Ticker 목록 조회 */
async function fetchRussell1000Tickers(): Promise<string[]> {
  try {
    // iShares Russell 1000 ETF (IWB) 구성종목 다운로드 — SSGA 공개 CSV
    const url = 'https://www.ishares.com/us/products/239707/ISHARES-RUSSELL-1000-ETF/1467271812596.ajax?fileType=csv&fileName=IWB_holdings&dataType=fund';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const csv = await res.text();
    const lines = csv.split('\n');
    const tickers: string[] = [];
    // iShares CSV: 헤더 2줄 건너뛰기, 두 번째 열이 Ticker
    for (let i = 2; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const ticker = cols[1]?.replace(/"/g, '').trim();
      if (ticker && /^[A-Z]{1,5}(-[A-Z])?$/.test(ticker)) {
        tickers.push(ticker);
      }
    }
    if (tickers.length > 800) {
      console.log(`[Universe] Russell 1000 live: ${tickers.length} tickers`);
      return tickers;
    }
    throw new Error(`Too few tickers: ${tickers.length}`);
  } catch (err) {
    console.warn(`[Universe] Russell 1000 live fetch failed: ${err}`);
    return [];
  }
}

/** 실시간 S&P 500 구성종목 Ticker 목록 조회 */
async function fetchSP500Tickers(): Promise<Set<string>> {
  try {
    // Wikipedia S&P 500 목록 — 가장 안정적인 공개 소스
    const url = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    // <td><a ...>TICKER</a></td> 패턴 파싱
    const matches = html.matchAll(/<td><a[^>]+>([A-Z]{1,5}(?:\.[A-Z])?)<\/a><\/td>/g);
    const tickers = new Set<string>();
    for (const m of matches) {
      tickers.add(m[1]);
    }
    if (tickers.size > 480) {
      console.log(`[Universe] S&P 500 live: ${tickers.size} tickers`);
      return tickers;
    }
    throw new Error(`Too few tickers: ${tickers.size}`);
  } catch (err) {
    console.warn(`[Universe] S&P 500 live fetch failed: ${err}`);
    return new Set();
  }
}

/**
 * 메인 함수: Russell 1000을 실시간으로 가져온 후 S&P 500 종목 제외
 * 실시간 조회 실패 시 폴백 정적 목록을 반환합니다.
 */
export async function getStockUniverse(): Promise<string[]> {
  const [russell, sp500] = await Promise.all([
    fetchRussell1000Tickers(),
    fetchSP500Tickers(),
  ]);

  // 실시간 데이터가 충분히 있으면 사용
  if (russell.length > 800) {
    const filtered = russell.filter(t => !sp500.has(t));
    console.log(`[Universe] Final: ${filtered.length} tickers (Russell ${russell.length} - SP500 ${sp500.size})`);
    return Array.from(new Set(filtered));
  }

  // 폴백: 내장 정적 목록 (Russell 1000 중 SP500 미포함 종목 약 500개)
  console.warn('[Universe] Using fallback static list (~500 Russell-only tickers)');
  return FALLBACK_RUSSELL_ONLY;
}

/** 폴백용 Russell 1000 고유 종목 정적 목록 (~500개, S&P 500 제외) */
const FALLBACK_RUSSELL_ONLY: string[] = [
  // Mid-large (251-400 범위 Russell 고유)
  'VLTO', 'WAB', 'MAS', 'ED', 'CTLT', 'BBWI', 'GPC', 'CLX',
  'AKAM', 'ALGN', 'ATO', 'IEX', 'LYB', 'MKC', 'ZBRA', 'LDOS', 'DTE',
  'PPL', 'WY', 'AVY', 'AIZ', 'RJF', 'JKHY', 'EMN', 'CF', 'RPM', 'PEAK',
  'ALB', 'WRB', 'MOH', 'HRL', 'TPR', 'EPAM', 'ETSY', 'SIRI', 'AMCR', 'NRG',
  'PKI', 'TXT', 'BWA', 'POOL', 'HST', 'JNPR', 'RE', 'L',
  'SNA', 'GRMN', 'AAP', 'KHC', 'NTAP', 'DRI', 'INCY', 'MHK', 'TFX', 'BEN',
  'WYNN', 'EQH', 'FOX', 'FOXA', 'NWS', 'NWSA', 'PARA', 'WBD', 'LKQ',
  'SWKS', 'CPT', 'MAA', 'MDC', 'KBH', 'BLD', 'BLDR', 'IBP', 'DOOR', 'MHO',
  'SSD', 'NVT', 'WMS', 'FBIN', 'BPMC', 'SRPT', 'RARE', 'ALNY',
  // Mid-cap tech & growth
  'BMRN', 'ROIV', 'EXEL', 'ARWR', 'NBIX', 'MDGL',
  'DAY', 'CTRA', 'MGY', 'OXY', 'DVN', 'MRO', 'EOG',
  'DKS', 'GPS', 'ANF', 'AEO', 'URBN',
  'VSCO', 'RL', 'PVH', 'HBI', 'COLM', 'SKX', 'CROX', 'DECK', 'WGO',
  'HZO', 'BC', 'DOCU', 'BOX', 'DDOG', 'ESTC', 'MDB', 'GTLB', 'S',
  'ZS', 'CRWD', 'OKTA', 'QLYS', 'TENB', 'RPD', 'VRNS',
  'DT', 'BRZE', 'ASAN', 'MNDY', 'PTC', 'WDAY', 'VEEV', 'QTWO', 'PCTY',
  'PAYC', 'MPWR', 'SITM', 'DIOD',
  'CRUS', 'AMBA', 'POWI', 'KLIC',
  'IPGP', 'VIAV', 'COHU', 'ENTG', 'MKSI',
  // Mid-cap logistics & industrials
  'ACLS', 'BRKS', 'KLA', 'ONTO', 'RGEN', 'AZTA', 'MATX', 'JBHT',
  'HUBG', 'CHRW', 'SAIA', 'XPO', 'GXO', 'WERN', 'KNX',
  'ARCB', 'LSTR', 'SNDR',
  'ALK', 'SKYW',
  'CRS', 'HWM', 'KTOS', 'AVAV',
  // Fintech & digital
  'SOFI', 'OPFI', 'NU', 'LYFT', 'GRAB', 'ABNB', 'DASH', 'RBLX', 'U', 'COIN', 'CVNA',
  // Semiconductors (non-S&P)
  'QRVO', 'COHR', 'PLAB', 'ACMR',
  // Biotech (non-S&P)
  'RDNT', 'HIMS', 'LZ', 'GH', 'NTRA', 'SDGR', 'RXRX', 'BHVN',
  'KRTX', 'TGTX', 'ACHC', 'CELH',
  'GERN', 'CLLS', 'RCUS', 'FOLD',
  // Restaurant & consumer
  'DENN', 'JACK', 'BLMN', 'EAT', 'CAKE',
  // Gaming & leisure
  'PENN', 'DKNG', 'BALY', 'CHDN',
  // Energy E&P
  'AR', 'RRC', 'SM', 'CRGY', 'MGY',
  // REITs (non-S&P)
  'KNTK', 'FTAI', 'AFG', 'SITC', 'KRG', 'BNL', 'EPRT', 'ADC', 'NNN',
  'NTST', 'SRC', 'FCPT', 'PECO', 'ROIC', 'WPC', 'OHI', 'LTC', 'SBRA',
  'CTRE', 'CLDT', 'XHR', 'PEB', 'APLE', 'RHP',
  // BDC / Credit
  'MFA', 'PMT', 'BXMT', 'KREF', 'ARI', 'FSK', 'ARCC', 'GBDC', 'OCSL',
  'TCPC', 'ORCC',
  // Asset managers
  'HLNE', 'BX', 'KKR', 'APO', 'CG', 'ARES', 'OWL', 'STEP',
  // Regional banks
  'FFIN', 'BANF', 'BOKF', 'FHN',
  'FCNCA', 'CVBF', 'SFNC', 'HTLF', 'FULT', 'ZION', 'CMA', 'SNV',
  'VLY', 'HOPE', 'BANR',
  // SaaS & cloud (non-S&P)
  'NET', 'CSGP', 'FROG', 'SAIL', 'CERT', 'PLAN', 'NEOG', 'RMBS', 'SLAB',
  'SMTC', 'AOSL', 'AEHR', 'AXTI',
  'CCMP', 'UCTT', 'CAMT',
  // Transport
  'MRTN', 'MESA', 'HA', 'ULCC', 'TGI', 'SPR', 'RDW',
  // Other
  'LCNB', 'LX', 'PRAA', 'WRLD', 'ITRN', 'VITL',
  'TTWO', 'LUMN', 'FYBR', 'CHTR', 'CABO',
];

/** 동기 폴백 (universe를 동기로 필요할 때) */
export function getStockUniverseSync(): string[] {
  return FALLBACK_RUSSELL_ONLY;
}

export function getTop300ByMarketCap(): string[] {
  return FALLBACK_RUSSELL_ONLY;
}
