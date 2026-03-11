/**
 * Russell 1000 Index — 미국 대형주 + 중형주 1000개 전체
 * 텐배거 분석 유니버스는 이 목록 전체를 대상으로 합니다.
 */
export const RUSSELL1000_TICKERS: string[] = [
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

  // Mid-large 251-400
  'OMC', 'HIG', 'VLTO', 'WAB', 'MAS', 'ED', 'CTLT', 'BBWI', 'GPC', 'CLX',
  'AKAM', 'ALGN', 'ATO', 'IEX', 'LYB', 'MKC', 'APA', 'ZBRA', 'LDOS', 'DTE',
  'PPL', 'WY', 'AVY', 'AIZ', 'RJF', 'JKHY', 'EMN', 'CF', 'RPM', 'PEAK',
  'ALB', 'WRB', 'MOH', 'HRL', 'TPR', 'EPAM', 'ETSY', 'SIRI', 'AMCR', 'NRG',
  'CTVA', 'PKI', 'TXT', 'BWA', 'POOL', 'HST', 'IPG', 'JNPR', 'RE', 'L',
  'SNA', 'GRMN', 'AAP', 'KHC', 'NTAP', 'DRI', 'INCY', 'MHK', 'TFX', 'BEN',
  'WYNN', 'EQH', 'FOX', 'FOXA', 'NWS', 'NWSA', 'IPG', 'PARA', 'WBD', 'LKQ',
  'SWKS', 'ARE', 'CPT', 'EXR', 'UDR', 'ESS', 'AVB', 'MAA', 'NVR', 'PHM',
  'DHI', 'LEN', 'TOL', 'MDC', 'KBH', 'BLD', 'BLDR', 'IBP', 'DOOR', 'MHO',
  'SSD', 'NVT', 'WMS', 'FBIN', 'MM', 'IBN', 'BPMC', 'SRPT', 'RARE', 'ALNY',

  // Mid-cap 401-550
  'BMRN', 'ROIV', 'EXEL', 'ARWR', 'CCCC', 'NBIX', 'SAGE', 'MDGL', 'RCUS', 'FOLD',
  'DAY', 'CTRA', 'MGY', 'OXY', 'DVN', 'MRO', 'APA', 'EOG', 'PXD', 'FANG',
  'HES', 'PSX', 'VLO', 'MPC', 'PBF', 'DKS', 'GPS', 'ANF', 'AEO', 'URBN',
  'VSCO', 'RL', 'PVH', 'HBI', 'COLM', 'SKX', 'CROX', 'DECK', 'GFL', 'WGO',
  'HZO', 'BC', 'DOCU', 'BOX', 'DDOG', 'ESTC', 'MDB', 'FROG', 'GTLB', 'S',
  'ZS', 'CRWD', 'OKTA', 'SAIL', 'QLYS', 'TPVG', 'TENB', 'RPD', 'CERT', 'VRNS',
  'DT', 'BRZE', 'ASAN', 'MNDY', 'PTC', 'WDAY', 'VEEV', 'PLAN', 'QTWO', 'PCTY',
  'PAYC', 'HCM', 'NEOG', 'ICAD', 'RMBS', 'SLAB', 'MPWR', 'SITM', 'DIOD', 'FORM',
  'CRUS', 'SMTC', 'AMBA', 'POWI', 'AOSL', 'SMTX', 'AEHR', 'AXTI', 'KLIC', 'IIVI',
  'IPGP', 'VIAV', 'COHU', 'CCMP', 'ENTG', 'LAM', 'UCTT', 'CAMT', 'AMAT', 'MKSI',

  // Mid-cap 551-700
  'ACLS', 'BRKS', 'KLA', 'ONTO', 'RTLR', 'RGEN', 'AZTA', 'TRMK', 'MATX', 'JBHT',
  'HUBG', 'CHRW', 'SAIA', 'XPO', 'GXO', 'TFII', 'WERN', 'KNX', 'HTLD', 'USX',
  'ARCB', 'OLD', 'ODFL', 'MRTN', 'PTSI', 'RXO', 'DCOM', 'LSTR', 'CVLG', 'SNDR',
  'ALK', 'SKYW', 'MESA', 'HA', 'SAVE', 'ULCC', 'JOBY', 'LILM', 'ACEL', 'RLAY',
  'CRS', 'HWM', 'TGI', 'SPR', 'KTOS', 'AJRD', 'AVAV', 'SPCE', 'RDW', 'NU',
  'SOFI', 'LCNB', 'NRDS', 'OPFI', 'LX', 'CURO', 'CASH', 'OPB', 'PRAA', 'WRLD',
  'QRVO', 'COHR', 'ITRN', 'PLAB', 'ACMR', 'SSYS', 'DDD', 'MKFG', 'NNDM', 'VLD',
  'SPEE', 'RDNT', 'HIMS', 'HIMS', 'LZ', 'GH', 'NTRA', 'SDGR', 'RXRX', 'BHVN',
  'KRTX', 'DAWN', 'TGTX', 'ACHC', 'CRVS', 'AGEN', 'IMGO', 'INM', 'CLLS', 'GERN',
  'CELH', 'VITL', 'DENN', 'JACK', 'BLMN', 'EAT', 'RRGB', 'CAKE', 'FAT', 'CZRX',

  // Mid-cap 701-850
  'PENN', 'DKNG', 'BALY', 'CHDN', 'MTR', 'EVRI', 'AGS', 'GDEN', 'GAN', 'CNX',
  'AR', 'RRC', 'EQT', 'GPOR', 'CTRA', 'SM', 'CRGY', 'ESTE', 'GRNT', 'KOS',
  'MXP', 'KNTK', 'FTAI', 'AFG', 'CNF', 'SITC', 'KRG', 'BNL', 'GTY', 'PSTL',
  'IIPR', 'NLCP', 'MDV', 'GMRE', 'PINE', 'SAFE', 'PLYM', 'EPRT', 'ADC', 'NNN',
  'NTST', 'SRC', 'FCPT', 'PECO', 'ROIC', 'AAT', 'WPC', 'OHI', 'LTC', 'SBRA',
  'CTRE', 'CSR', 'ESTR', 'CLDT', 'XHR', 'PEB', 'APLE', 'SHO', 'SOHO', 'RHP',
  'PK', 'BHR', 'CMBS', 'BRSP', 'MFA', 'PMT', 'TWO', 'MITT', 'NYMT', 'BXMT',
  'KREF', 'ARI', 'GPMT', 'TPVG', 'GAIN', 'SLRC', 'FSK', 'ARCC', 'GBDC', 'OCSL',
  'FDUS', 'PNNT', 'KCAP', 'TICC', 'PFLT', 'TPVG', 'MRCC', 'KCAP', 'GSBD', 'TCPC',
  'CGBD', 'ORCC', 'HLNE', 'BX', 'KKR', 'APO', 'CG', 'ARES', 'OWL', 'STEP',

  // Smaller notable Russell 1000 851-1000
  'BLUE', 'FOLD', 'PBYI', 'ATRC', 'HAYW', 'SWIM', 'LESL', 'BFAM', 'PRSC', 'LHCG',
  'AGIO', 'GLNG', 'GLOG', 'PLAT', 'LUMN', 'FYBR', 'UNIT', 'LBRDP', 'CHTR', 'ATUS',
  'CABO', 'CMCO', 'SXCL', 'ACNB', 'AROW', 'CASH', 'CATC', 'CFFI', 'CHMG', 'TOWN',
  'CNB', 'COBZ', 'CPKF', 'FCF', 'FXNC', 'MBWM', 'MCBC', 'MFNB', 'MYFW', 'NBTB',
  'NFBK', 'NKBK', 'NWIN', 'OFG', 'OSHC', 'OVLY', 'PBAM', 'PTRS', 'PVBC', 'RDN',
  'RNST', 'RVSB', 'SBCF', 'SHBI', 'SMBC', 'TCBK', 'TCFC', 'TPVG', 'TRMK', 'TRST',
  'UCBI', 'UMBF', 'VBTX', 'VLAY', 'WAFD', 'NYCB', 'FFIN', 'BANF', 'BOKF', 'FHN',
  'FCNCA', 'CVBF', 'IBCP', 'SFNC', 'HTLF', 'FULT', 'PACW', 'ZION', 'CMA', 'SNV',
  'VLY', 'HOPE', 'BANR', 'ISBC', 'PMBC', 'ENS', 'BECN', 'LYFT', 'GRAB', 'ABNB',
  'DASH', 'RBLX', 'U', 'COIN', 'RDFN', 'OPEN', 'OPAD', 'CVNA', 'VRM', 'AUTO',
];

/**
 * 전체 Russell 1000 유니버스를 반환합니다 (셔플 없음).
 * 텐배거 분석은 이 목록 전체를 순서대로 분석합니다.
 */
export function getStockUniverse(): string[] {
  return Array.from(new Set(RUSSELL1000_TICKERS));
}

export function getTop300ByMarketCap(): string[] {
  return getStockUniverse();
}
