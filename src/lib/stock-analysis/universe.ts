/**
 * Russell 1000 Index — 미국 대형주 + 중형주
 * S&P 500 종목은 제외하고 Russell 1000 고유 종목만 포함합니다.
 */

/** S&P 500 구성 종목 (제외 대상) */
export const SP500_TICKERS: ReadonlySet<string> = new Set([
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'BRK-B', 'TSLA', 'AVGO',
  'WMT', 'LLY', 'JPM', 'V', 'UNH', 'XOM', 'MA', 'JNJ', 'PG', 'HD',
  'COST', 'MRK', 'ABBV', 'BAC', 'CVX', 'NFLX', 'CRM', 'KO', 'AMD', 'PEP',
  'ORCL', 'ACN', 'WFC', 'TMO', 'LIN', 'ADBE', 'MS', 'MCD', 'DIS', 'GS',
  'CAT', 'IBM', 'INTU', 'PM', 'RTX', 'TXN', 'VZ', 'AMGN', 'AXP', 'NOW',
  'UNP', 'COP', 'GE', 'BKNG', 'T', 'HON', 'SPGI', 'PLD', 'SYK', 'SCHW',
  'LOW', 'QCOM', 'NEE', 'UPS', 'BLK', 'PGR', 'AMAT', 'ADP', 'ADI', 'PANW',
  'SBUX', 'MDLZ', 'GILD', 'MMC', 'VRTX', 'DHR', 'MDT', 'LMT', 'TJX', 'REGN',
  'CVS', 'PYPL', 'MO', 'CI', 'ZTS', 'ISRG', 'SO', 'ITW', 'SHW', 'HCA',
  'ETN', 'AON', 'ABT', 'CME', 'C', 'EQIX', 'SNOW', 'NKE', 'UBER', 'LRCX',
  'PFE', 'APD', 'INTC', 'TMUS', 'APH', 'MSI', 'KLAC', 'ECL', 'CDNS', 'FDX',
  'PH', 'NOC', 'MCK', 'WELL', 'EW', 'NSC', 'AJG', 'ROK', 'TDG', 'WM',
  'FCX', 'SRE', 'MCHP', 'ROP', 'OKE', 'CCI', 'FTNT', 'OTIS', 'TT', 'CTAS',
  'EMR', 'AFL', 'USB', 'TRV', 'PRU', 'DLR', 'CARR', 'MPC', 'PSX', 'VLO',
  'NXPI', 'ON', 'HES', 'VRSK', 'CPRT', 'AMP', 'AZO', 'IDXX', 'BDX', 'EL',
  'SPG', 'GIS', 'ROST', 'URI', 'CTSH', 'PCAR', 'MSCI', 'ODFL', 'MNST', 'KMB',
  'D', 'EXC', 'IQV', 'STZ', 'HUM', 'ACGL', 'MAR', 'DLTR', 'WMB',
  'COR', 'AMT', 'DXCM', 'PAYX', 'BK', 'FAST', 'PEG', 'DUK', 'ALL',
  'YUM', 'BIIB', 'NEM', 'STT', 'MET', 'CEG', 'KEYS', 'KR', 'EA',
  'RSG', 'PCG', 'VICI', 'SYY', 'RCL', 'GPN', 'IFF', 'LHX', 'FTV',
  'HSY', 'TRGP', 'AWK', 'LVS', 'CBOE', 'APTV', 'RMD', 'CNC', 'EFX', 'WTW',
  'FIS', 'GLW', 'ANSS', 'WST', 'ZBH', 'BALL', 'SBAC', 'MGM',
  'BAX', 'NDAQ', 'CFG', 'HAL', 'HOLX', 'CAG', 'J', 'PKG', 'XEL',
  'SWK', 'DGX', 'CINF', 'EQT', 'EXPE', 'ENPH', 'CHD', 'EXPD', 'COF', 'KEY',
  'MRNA', 'ILMN', 'TFC', 'RF', 'NTRS', 'AEP',
  'OMC', 'HIG', 'WAB', 'MAS', 'ED', 'GPC', 'CLX',
  'AKAM', 'ALGN', 'ATO', 'IEX', 'LYB', 'MKC', 'APA', 'ZBRA', 'LDOS', 'DTE',
  'PPL', 'WY', 'AVY', 'AIZ', 'RJF', 'JKHY', 'EMN', 'CF', 'RPM',
  'ALB', 'WRB', 'MOH', 'HRL', 'TPR', 'EPAM', 'ETSY', 'AMCR', 'NRG',
  'CTVA', 'TXT', 'BWA', 'POOL', 'HST', 'IPG', 'RE', 'L',
  'SNA', 'GRMN', 'KHC', 'NTAP', 'DRI', 'INCY', 'MHK', 'TFX', 'BEN',
  'WYNN', 'PARA', 'LKQ', 'SWKS', 'ARE', 'CPT', 'EXR', 'UDR', 'ESS', 'AVB', 'MAA',
  'NVR', 'PHM', 'DHI', 'LEN', 'TOL',
]);

/** Russell 1000 전체 목록 (S&P500 포함) */
const RUSSELL1000_ALL: string[] = [
  // Mega-cap (Top 50)
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'GOOG', 'BRK-B', 'TSLA', 'AVGO',
  'JPM', 'LLY', 'V', 'UNH', 'WMT', 'XOM', 'MA', 'JNJ', 'PG', 'HD',
  'COST', 'MRK', 'ABBV', 'BAC', 'CVX', 'NFLX', 'CRM', 'KO', 'AMD', 'PEP',
  'ORCL', 'ACN', 'WFC', 'TMO', 'LIN', 'ADBE', 'MS', 'MCD', 'DIS', 'GS',
  'CAT', 'IBM', 'INTU', 'PM', 'RTX', 'TXN', 'VZ', 'AMGN', 'AXP', 'NOW',

  // Large-cap 51-150
  'UNP', 'COP', 'GE', 'BKNG', 'T', 'HON', 'SPGI', 'PLD', 'SYK', 'SCHW',
  'LOW', 'QCOM', 'NEE', 'UPS', 'BLK', 'PGR', 'AMAT', 'ADP', 'ADI', 'PANW',
  'SBUX', 'MDLZ', 'GILD', 'MMC', 'VRTX', 'DHR', 'MDT', 'LMT', 'TJX', 'REGN',
  'CVS', 'PYPL', 'MO', 'CI', 'ZTS', 'ISRG', 'SO', 'ITW', 'SHW', 'HCA',
  'ETN', 'AON', 'ABT', 'CME', 'C', 'EQIX', 'SNOW', 'NKE', 'UBER', 'LRCX',
  'PFE', 'APD', 'INTC', 'TMUS', 'APH', 'MSI', 'KLAC', 'ECL', 'CDNS', 'FDX',
  'PH', 'NOC', 'MCK', 'WELL', 'EW', 'NSC', 'AJG', 'ROK', 'TDG', 'WM',
  'FCX', 'SRE', 'MCHP', 'ROP', 'OKE', 'CCI', 'FTNT', 'OTIS', 'TT', 'CTAS',
  'EMR', 'AFL', 'USB', 'TRV', 'PRU', 'DLR', 'CARR', 'MPC', 'PSX', 'VLO',
  'NXPI', 'ON', 'HES', 'VRSK', 'CPRT', 'AMP', 'AZO', 'IDXX', 'BDX', 'EL',

  // Large-cap 151-250
  'SPG', 'GIS', 'ROST', 'URI', 'CTSH', 'PCAR', 'MSCI', 'ODFL', 'MNST', 'KMB',
  'D', 'EXC', 'IQV', 'MTDR', 'STZ', 'HUM', 'ACGL', 'MAR', 'DLTR', 'WMB',
  'COR', 'AMT', 'FANG', 'DXCM', 'PAYX', 'BK', 'FAST', 'PEG', 'DUK', 'ALL',
  'YUM', 'BIIB', 'TTWO', 'NEM', 'STT', 'MET', 'CEG', 'KEYS', 'KR', 'EA',
  'RSG', 'PCG', 'VICI', 'SYY', 'RCL', 'GPN', 'IFF', 'LHX', 'FTV', 'WBA',
  'HSY', 'TRGP', 'AWK', 'LVS', 'CBOE', 'APTV', 'RMD', 'CNC', 'EFX', 'WTW',
  'FIS', 'GLW', 'CSGP', 'NET', 'ANSS', 'WST', 'ZBH', 'BALL', 'SBAC', 'MGM',
  'BAX', 'NDAQ', 'CFG', 'FRT', 'HAL', 'HOLX', 'CAG', 'J', 'PKG', 'XEL',
  'SWK', 'DGX', 'CINF', 'EQT', 'EXPE', 'ENPH', 'CHD', 'EXPD', 'COF', 'KEY',
  'BEAM', 'PODD', 'MTCH', 'HUBS', 'MRNA', 'ILMN', 'TFC', 'RF', 'NTRS', 'AEP',

  // Mid-large 251-400 (Russell-only 비중 높음)
  'OMC', 'HIG', 'VLTO', 'WAB', 'MAS', 'ED', 'CTLT', 'BBWI', 'GPC', 'CLX',
  'AKAM', 'ALGN', 'ATO', 'IEX', 'LYB', 'MKC', 'APA', 'ZBRA', 'LDOS', 'DTE',
  'PPL', 'WY', 'AVY', 'AIZ', 'RJF', 'JKHY', 'EMN', 'CF', 'RPM', 'PEAK',
  'ALB', 'WRB', 'MOH', 'HRL', 'TPR', 'EPAM', 'ETSY', 'SIRI', 'AMCR', 'NRG',
  'CTVA', 'PKI', 'TXT', 'BWA', 'POOL', 'HST', 'IPG', 'JNPR', 'RE', 'L',
  'SNA', 'GRMN', 'AAP', 'KHC', 'NTAP', 'DRI', 'INCY', 'MHK', 'TFX', 'BEN',
  'WYNN', 'EQH', 'FOX', 'FOXA', 'NWS', 'NWSA', 'PARA', 'WBD', 'LKQ',
  'SWKS', 'ARE', 'CPT', 'EXR', 'UDR', 'ESS', 'AVB', 'MAA', 'NVR', 'PHM',
  'DHI', 'LEN', 'TOL', 'MDC', 'KBH', 'BLD', 'BLDR', 'IBP', 'DOOR', 'MHO',
  'SSD', 'NVT', 'WMS', 'FBIN', 'BPMC', 'SRPT', 'RARE', 'ALNY',

  // Mid-cap 401-550
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

  // Mid-cap 551-700
  'ACLS', 'BRKS', 'KLA', 'ONTO', 'RGEN', 'AZTA', 'MATX', 'JBHT',
  'HUBG', 'CHRW', 'SAIA', 'XPO', 'GXO', 'WERN', 'KNX',
  'ARCB', 'ODFL', 'LSTR', 'SNDR',
  'ALK', 'SKYW',
  'CRS', 'HWM', 'KTOS', 'AVAV',
  'SOFI', 'OPFI',
  'QRVO', 'COHR', 'PLAB', 'ACMR', 'SSYS',
  'RDNT', 'HIMS', 'LZ', 'GH', 'NTRA', 'SDGR', 'RXRX', 'BHVN',
  'KRTX', 'TGTX', 'ACHC',
  'CELH', 'VITL', 'DENN', 'JACK', 'BLMN', 'EAT', 'CAKE',

  // Mid-cap 701-850
  'PENN', 'DKNG', 'BALY', 'CHDN',
  'AR', 'RRC', 'SM', 'CRGY',
  'KNTK', 'FTAI', 'AFG', 'SITC', 'KRG', 'BNL', 'EPRT', 'ADC', 'NNN',
  'NTST', 'SRC', 'FCPT', 'PECO', 'ROIC', 'WPC', 'OHI', 'LTC', 'SBRA',
  'CTRE', 'CLDT', 'XHR', 'PEB', 'APLE', 'RHP',
  'MFA', 'PMT', 'BXMT',
  'KREF', 'ARI', 'FSK', 'ARCC', 'GBDC', 'OCSL',
  'TCPC', 'ORCC', 'HLNE', 'BX', 'KKR', 'APO', 'CG', 'ARES', 'OWL', 'STEP',

  // Smaller Russell-only 851-1000
  'TTWO', 'LUMN', 'FYBR', 'CHTR', 'CABO',
  'FFIN', 'BANF', 'BOKF', 'FHN',
  'FCNCA', 'CVBF', 'SFNC', 'HTLF', 'FULT', 'ZION', 'CMA', 'SNV',
  'VLY', 'HOPE', 'BANR',
  'LYFT', 'GRAB', 'ABNB',
  'DASH', 'RBLX', 'U', 'COIN', 'CVNA',
  'NDAQ', 'NET', 'CSGP', 'MNDY', 'FROG', 'SAIL', 'CERT',
  'PLAN', 'HCM', 'NEOG', 'RMBS', 'SLAB', 'FORM',
  'SMTC', 'AOSL', 'AEHR', 'AXTI',
  'CCMP', 'UCTT', 'CAMT', 'LAM',
  'RTLR', 'TRMK', 'HUBG', 'MRTN',
  'MESA', 'HA', 'ULCC',
  'TGI', 'SPR', 'RDW', 'NU',
  'LCNB', 'NRDS', 'LX', 'CURO', 'CASH', 'PRAA', 'WRLD',
  'ITRN', 'DDD', 'VLD',
  'GERN', 'AGEN', 'CLLS', 'RCUS', 'FOLD',
  'BMRN', 'EXEL', 'ARWR', 'NBIX',
];

/**
 * Russell 1000 유니버스에서 S&P 500 종목을 제외한 목록을 반환합니다.
 * 이 방식으로 상대적으로 덜 알려진 중형주에서 텐배거 후보를 발굴합니다.
 */
export function getStockUniverse(): string[] {
  const unique = Array.from(new Set(RUSSELL1000_ALL));
  return unique.filter(ticker => !SP500_TICKERS.has(ticker));
}

export function getTop300ByMarketCap(): string[] {
  return getStockUniverse();
}
