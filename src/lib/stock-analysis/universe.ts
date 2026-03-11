/**
 * 실시간 Russell 1000 / S&P 500 구성종목을 가져와서
 * "Russell 1000에는 포함되되 S&P 500에는 없는 종목"만 반환합니다.
 *
 * 데이터 소스 (우선순위 순):
 *  - Russell 1000: stockanalysis.com IWB ETF JSON 또는 iShares CSV
 *  - S&P 500: GitHub raw CSV(datahub.io) 또는 Wikipedia HTML
 *  - 폴백: 내장 정적 목록 (~240개)
 */

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; TenbaggerBot/1.0)',
  'Accept': 'text/html,application/xhtml+xml,application/json,text/csv,*/*',
};

// ── Russell 1000 실시간 조회 ────────────────────────────────────────────────
async function fetchRussell1000Tickers(): Promise<string[]> {
  const sources: Array<() => Promise<string[]>> = [
    // 소스 1: StockAnalysis IWB ETF JSON API
    async () => {
      const res = await fetch(
        'https://stockanalysis.com/api/etf/iwb/holdings/?p=annual',
        { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as any;
      const data: any[] = json?.data ?? json?.holdings ?? [];
      const tickers = data.map((h: any) => (h.s ?? h.symbol ?? '') as string)
        .filter(t => /^[A-Z]{1,5}$/.test(t));
      if (tickers.length < 500) throw new Error(`Too few: ${tickers.length}`);
      return tickers;
    },
    // 소스 2: iShares IWB CSV (직접 다운로드)
    async () => {
      const res = await fetch(
        'https://www.ishares.com/us/products/239707/ISHARES-RUSSELL-1000-ETF/1467271812596.ajax?fileType=csv&fileName=IWB_holdings&dataType=fund',
        { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      const lines = csv.split('\n');
      let dataStart = 0;
      for (let i = 0; i < Math.min(10, lines.length); i++) {
        if (lines[i].includes('Ticker') || lines[i].includes('Symbol')) {
          dataStart = i + 1; break;
        }
      }
      const tickers: string[] = [];
      for (let i = dataStart; i < lines.length; i++) {
        const cols = lines[i].replace(/"/g, '').split(',');
        for (let c = 0; c <= 2 && c < cols.length; c++) {
          const t = cols[c].trim();
          if (/^[A-Z]{1,5}(-[A-Z])?$/.test(t)) { tickers.push(t); break; }
        }
      }
      if (tickers.length < 500) throw new Error(`Too few: ${tickers.length}`);
      return tickers;
    },
  ];

  for (const fn of sources) {
    try {
      const tickers = await fn();
      console.log(`[Universe] Russell 1000 live: ${tickers.length} tickers`);
      return tickers;
    } catch (e) {
      console.warn(`[Universe] Russell 1000 source failed: ${(e as Error).message?.slice(0, 80)}`);
    }
  }
  return [];
}

// ── S&P 500 실시간 조회 ────────────────────────────────────────────────────
async function fetchSP500Tickers(): Promise<Set<string>> {
  const sources: Array<() => Promise<Set<string>>> = [
    // 소스 1: datahub.io GitHub raw CSV
    async () => {
      const res = await fetch(
        'https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv',
        { headers: FETCH_HEADERS, signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const csv = await res.text();
      const tickers = new Set<string>();
      csv.split('\n').slice(1).forEach(line => {
        const symbol = line.split(',')[0].replace(/"/g, '').trim();
        if (/^[A-Z]{1,5}$/.test(symbol)) tickers.add(symbol);
      });
      if (tickers.size < 480) throw new Error(`Too few: ${tickers.size}`);
      return tickers;
    },
    // 소스 2: Wikipedia HTML 파싱
    async () => {
      const res = await fetch(
        'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies',
        { headers: FETCH_HEADERS, signal: AbortSignal.timeout(20000) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      const tickers = new Set<string>();
      for (const re of [
        /<td[^>]*><a[^>]+>([A-Z]{1,5}(?:\.[A-Z])?)<\/a><\/td>/g,
        /<td>\s*([A-Z]{1,5})\s*<\/td>/g,
      ]) {
        for (const m of html.matchAll(re)) tickers.add(m[1]);
      }
      if (tickers.size < 480) throw new Error(`Too few: ${tickers.size}`);
      return tickers;
    },
  ];

  for (const fn of sources) {
    try {
      const result = await fn();
      console.log(`[Universe] S&P 500 live: ${result.size} tickers`);
      return result;
    } catch (e) {
      console.warn(`[Universe] S&P 500 source failed: ${(e as Error).message?.slice(0, 80)}`);
    }
  }
  return new Set();
}

/**
 * 메인 함수: Russell 1000 실시간 조회 → S&P 500 차집합 반환
 * 실시간 조회 실패 시 내장 폴백 사용
 */
export async function getStockUniverse(): Promise<string[]> {
  const [russell, sp500] = await Promise.all([
    fetchRussell1000Tickers(),
    fetchSP500Tickers(),
  ]);

  if (russell.length > 500) {
    const filtered = russell.filter(t => !sp500.has(t));
    const unique = Array.from(new Set(filtered));
    console.log(`[Universe] Final: ${unique.length} tickers (Russell ${russell.length} - SP500 ${sp500.size})`);
    return unique;
  }

  console.warn('[Universe] Live fetch insufficient, using fallback list');
  const sp500Set = sp500.size > 0 ? sp500 : FALLBACK_SP500;
  return FALLBACK_RUSSELL_ONLY.filter(t => !sp500Set.has(t));
}

// ── 폴백 S&P 500 Set ──────────────────────────────────────────────────────
const FALLBACK_SP500 = new Set([
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'BRK-B', 'TSLA', 'AVGO',
  'WMT', 'LLY', 'JPM', 'V', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'HD', 'COST', 'MRK', 'ABBV',
  'BAC', 'CVX', 'NFLX', 'CRM', 'KO', 'AMD', 'PEP', 'ORCL', 'ACN', 'WFC', 'TMO', 'LIN',
  'ADBE', 'MS', 'MCD', 'DIS', 'GS', 'CAT', 'IBM', 'INTU', 'PM', 'RTX', 'TXN', 'VZ',
  'AMGN', 'AXP', 'NOW', 'UNP', 'COP', 'GE', 'BKNG', 'T', 'HON', 'SPGI', 'PLD', 'SYK',
  'SCHW', 'LOW', 'QCOM', 'NEE', 'UPS', 'BLK', 'PGR', 'AMAT', 'ADP', 'ADI', 'PANW',
  'SBUX', 'MDLZ', 'GILD', 'MMC', 'VRTX', 'DHR', 'MDT', 'LMT', 'TJX', 'REGN', 'CVS',
  'PYPL', 'MO', 'CI', 'ZTS', 'ISRG', 'SO', 'ITW', 'SHW', 'HCA', 'ETN', 'AON', 'ABT',
  'CME', 'C', 'EQIX', 'SNOW', 'NKE', 'UBER', 'LRCX', 'PFE', 'APD', 'INTC', 'TMUS',
  'APH', 'MSI', 'KLAC', 'ECL', 'CDNS', 'FDX', 'PH', 'NOC', 'MCK', 'WELL', 'EW', 'NSC',
  'AJG', 'ROK', 'TDG', 'WM', 'FCX', 'SRE', 'MCHP', 'ROP', 'OKE', 'CCI', 'FTNT', 'OTIS',
  'TT', 'CTAS', 'EMR', 'AFL', 'USB', 'TRV', 'PRU', 'DLR', 'CARR', 'MPC', 'PSX', 'VLO',
  'NXPI', 'ON', 'HES', 'VRSK', 'CPRT', 'AMP', 'AZO', 'IDXX', 'BDX', 'EL', 'SPG', 'GIS',
  'ROST', 'URI', 'CTSH', 'PCAR', 'MSCI', 'ODFL', 'MNST', 'KMB', 'D', 'EXC', 'IQV',
  'STZ', 'HUM', 'ACGL', 'MAR', 'DLTR', 'WMB', 'COR', 'AMT', 'DXCM', 'PAYX', 'BK',
  'FAST', 'PEG', 'DUK', 'ALL', 'YUM', 'BIIB', 'NEM', 'STT', 'MET', 'CEG', 'KEYS', 'KR',
  'EA', 'RSG', 'PCG', 'VICI', 'SYY', 'RCL', 'GPN', 'IFF', 'LHX', 'FTV', 'HSY', 'TRGP',
  'AWK', 'LVS', 'CBOE', 'APTV', 'RMD', 'CNC', 'EFX', 'WTW', 'FIS', 'GLW', 'ANSS', 'WST',
  'ZBH', 'BALL', 'SBAC', 'MGM', 'BAX', 'NDAQ', 'CFG', 'HAL', 'HOLX', 'CAG', 'J', 'PKG',
  'XEL', 'SWK', 'DGX', 'CINF', 'EQT', 'EXPE', 'ENPH', 'CHD', 'EXPD', 'COF', 'KEY',
  'MRNA', 'ILMN', 'TFC', 'RF', 'NTRS', 'AEP', 'OMC', 'HIG', 'WAB', 'MAS', 'ED',
]);

// ── 폴백 Russell-only 목록 ────────────────────────────────────────────────
const FALLBACK_RUSSELL_ONLY: string[] = [
  'VLTO', 'CTLT', 'BBWI', 'GPC', 'CLX', 'AKAM', 'ALGN', 'ATO', 'IEX', 'LYB', 'MKC',
  'ZBRA', 'LDOS', 'DTE', 'PPL', 'WY', 'AVY', 'AIZ', 'RJF', 'JKHY', 'EMN', 'CF', 'RPM',
  'ALB', 'WRB', 'MOH', 'HRL', 'TPR', 'EPAM', 'ETSY', 'SIRI', 'AMCR', 'NRG', 'PKI',
  'TXT', 'BWA', 'POOL', 'HST', 'JNPR', 'RE', 'L', 'SNA', 'GRMN', 'AAP', 'KHC', 'NTAP',
  'DRI', 'INCY', 'MHK', 'TFX', 'BEN', 'WYNN', 'EQH', 'FOX', 'FOXA', 'NWS', 'NWSA',
  'PARA', 'WBD', 'LKQ', 'SWKS', 'CPT', 'MAA', 'MDC', 'KBH', 'BLD', 'BLDR', 'IBP',
  'DOOR', 'MHO', 'SSD', 'NVT', 'WMS', 'FBIN', 'BPMC', 'SRPT', 'RARE', 'ALNY',
  'BMRN', 'ROIV', 'EXEL', 'ARWR', 'NBIX', 'MDGL', 'DAY', 'CTRA', 'MGY', 'OXY',
  'DVN', 'MRO', 'EOG', 'DKS', 'GPS', 'ANF', 'AEO', 'URBN', 'VSCO', 'RL', 'PVH',
  'HBI', 'COLM', 'SKX', 'CROX', 'DECK', 'WGO', 'HZO', 'BC', 'DOCU', 'BOX', 'DDOG',
  'ESTC', 'MDB', 'GTLB', 'S', 'ZS', 'CRWD', 'OKTA', 'QLYS', 'TENB', 'RPD', 'VRNS',
  'DT', 'BRZE', 'ASAN', 'MNDY', 'PTC', 'WDAY', 'VEEV', 'QTWO', 'PCTY', 'PAYC',
  'MPWR', 'SITM', 'DIOD', 'CRUS', 'AMBA', 'POWI', 'KLIC', 'IPGP', 'VIAV', 'COHU',
  'ENTG', 'MKSI', 'ACLS', 'BRKS', 'ONTO', 'RGEN', 'AZTA', 'MATX', 'JBHT', 'HUBG',
  'CHRW', 'SAIA', 'XPO', 'GXO', 'WERN', 'KNX', 'ARCB', 'LSTR', 'SNDR', 'ALK', 'SKYW',
  'CRS', 'HWM', 'KTOS', 'AVAV', 'SOFI', 'OPFI', 'NU', 'LYFT', 'GRAB', 'ABNB', 'DASH',
  'RBLX', 'U', 'COIN', 'CVNA', 'QRVO', 'COHR', 'PLAB', 'ACMR', 'RDNT', 'HIMS', 'LZ',
  'GH', 'NTRA', 'SDGR', 'RXRX', 'BHVN', 'KRTX', 'TGTX', 'ACHC', 'CELH', 'GERN',
  'CLLS', 'RCUS', 'FOLD', 'DENN', 'JACK', 'BLMN', 'EAT', 'CAKE', 'PENN', 'DKNG',
  'BALY', 'CHDN', 'AR', 'RRC', 'SM', 'CRGY', 'KNTK', 'FTAI', 'AFG', 'SITC', 'KRG',
  'BNL', 'EPRT', 'ADC', 'NNN', 'NTST', 'SRC', 'FCPT', 'PECO', 'ROIC', 'WPC', 'OHI',
  'LTC', 'SBRA', 'CTRE', 'CLDT', 'XHR', 'PEB', 'APLE', 'RHP', 'MFA', 'PMT', 'BXMT',
  'KREF', 'ARI', 'FSK', 'ARCC', 'GBDC', 'OCSL', 'TCPC', 'ORCC', 'HLNE', 'BX', 'KKR',
  'APO', 'CG', 'ARES', 'OWL', 'STEP', 'FFIN', 'BANF', 'BOKF', 'FHN', 'FCNCA', 'CVBF',
  'SFNC', 'HTLF', 'FULT', 'ZION', 'CMA', 'SNV', 'VLY', 'HOPE', 'BANR', 'SAIL', 'CSGP',
  'FROG', 'NET', 'CERT', 'NEOG', 'RMBS', 'SLAB', 'SMTC', 'AOSL', 'AEHR', 'AXTI',
  'CAMT', 'UCTT', 'MRTN', 'LX', 'RDW', 'VITL', 'TTWO', 'LUMN', 'FYBR', 'CHTR', 'CABO',
  'PEAK', 'NVR', 'PHM', 'DHI', 'LEN', 'TOL',
];

export function getStockUniverseSync(): string[] {
  return FALLBACK_RUSSELL_ONLY;
}

export function getTop300ByMarketCap(): string[] {
  return FALLBACK_RUSSELL_ONLY;
}
