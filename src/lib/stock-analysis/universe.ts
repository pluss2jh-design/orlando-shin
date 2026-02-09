export const DOW_JONES_TICKERS = [
  'AAPL', 'AMGN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS', 'GS',
  'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
  'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT'
];

export const SP500_SAMPLE_TICKERS = [
  'AAPL', 'MSFT', 'AMZN', 'NVDA', 'GOOGL', 'GOOG', 'META', 'BRK-B', 'TSLA', 'UNH',
  'JPM', 'LLY', 'XOM', 'V', 'MA', 'AVGO', 'PG', 'HD', 'JNJ', 'COST',
  'ADBE', 'MRK', 'CRM', 'CVX', 'WMT', 'ABBV', 'PEP', 'AMD', 'BAC', 'ACN',
  'TMO', 'LIN', 'KO', 'NFLX', 'CSCO', 'DIS', 'MCD', 'ORCL', 'INTU', 'INTC',
  'AMAT', 'CAT', 'TXN', 'VZ', 'PFE', 'UNP', 'QCOM', 'AXP', 'PM', 'IBM',
  'GE', 'ISRG', 'HON', 'AMGN', 'INTU', 'LRCX', 'BKNG', 'SYK', 'T', 'MDLZ',
  'PLD', 'AMT', 'NOW', 'TJX', 'MMC', 'GILD', 'ADP', 'MDLZ', 'ADI', 'CVS',
  'LMT', 'BSX', 'ZTS', 'CI', 'EL', 'MO', 'SHW', 'REGN', 'WM', 'ITW',
  'EOG', 'SLB', 'APD', 'MPC', 'PH', 'GD', 'TDG', 'ORLY', 'MCK', 'CTAS'
];

export function getStockUniverse(): string[] {
  const combined = new Set([
    ...DOW_JONES_TICKERS,
    ...SP500_SAMPLE_TICKERS,
    'PLTR', 'SNOW', 'SQ', 'PYPL', 'SHOP', 'UBER', 'ABNB', 'TEAM', 'WDAY', 'DDOG',
    'ZS', 'OKTA', 'CRWD', 'MDB', 'NET', 'U', 'SE', 'MELI', 'TSM', 'ASML',
    'ARM', 'COIN', 'MSTR', 'SMCI', 'CELH', 'DKNG', 'HOOD', 'RDDT', 'COIN',
    '005930.KS', '000660.KS', '035420.KS', '035720.KS', '005380.KS',
    '373220.KS', '005490.KS', '068270.KS', '105560.KS', '055550.KS'
  ]);
  return Array.from(combined);
}

