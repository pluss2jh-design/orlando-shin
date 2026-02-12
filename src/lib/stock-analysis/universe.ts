// S&P 500 시가총액 상위 100개 기업 (2024-2025 기준)
export const SP500_TICKERS = [
  // 상위 25
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'GOOG', 'AMZN', 'META', 'BRK-B', 'TSLA', 'AVGO',
  'WMT', 'JPM', 'V', 'MA', 'UNH', 'HD', 'PG', 'LLY', 'MRK', 'COST',
  'ABBV', 'KO', 'JNJ', 'ORCL', 'BAC',
  // 26-50
  'CRM', 'WFC', 'NFLX', 'ACN', 'TMO', 'LIN', 'DIS', 'ADBE', 'AMD', 'CAT',
  'VZ', 'CVX', 'MS', 'TXN', 'INTU', 'PM', 'GS', 'IBM', 'RTX', 'UNP',
  'AMGN', 'COP', 'GE', 'T', 'HON',
  // 51-75
  'QCOM', 'LOW', 'SPGI', 'UPS', 'AXP', 'PGR', 'BLK', 'NEE', 'SYK', 'SBUX',
  'AMAT', 'DHR', 'GILD', 'MMC', 'VRTX', 'MDT', 'LMT', 'CVS', 'TJX', 'REGN',
  'SCHW', 'NOW', 'BKNG', 'BA', 'TMUS',
  // 76-100
  'PLD', 'ADP', 'ADI', 'PANW', 'PYPL', 'MO', 'C', 'ZTS', 'SO', 'HCA',
  'SNOW', 'NKE', 'ETN', 'ABT', 'EQIX', 'PFE', 'ITW', 'SHW', 'AON', 'ISRG',
  'MDLZ', 'UBER', 'INTC', 'APD', 'LRCX'
];

// Dow Jones 30 기업
export const DOW_JONES_TICKERS = [
  'AAPL', 'AMGN', 'AXP', 'BA', 'CAT', 'CRM', 'CSCO', 'CVX', 'DIS', 'GS',
  'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KO', 'MCD', 'MMM', 'MRK',
  'MSFT', 'NKE', 'PG', 'TRV', 'UNH', 'V', 'VZ', 'WBA', 'WMT'
];

// Russell 1000 대형주 시가총액 상위 100개 (S&P500 외 대형주 포함)
export const RUSSELL1000_TICKERS = [
  // S&P500 외 Russell 1000 대형주들
  'LULU', 'ROP', 'MU', 'FDX', 'EL', 'ADSK', 'MMM', 'MAR', 'CTVA', 'NSC',
  'APH', 'GM', 'EMR', 'FIS', 'BDX', 'F', 'SLB', 'TGT', 'EW', 'CMCSA',
  'FCX', 'CEG', 'ECL', 'FTNT', 'JCI', 'CSX', 'STZ', 'CME', 'NOC', 'PXD',
  'ANET', 'PSX', 'VLO', 'D', 'GIS', 'SRE', 'OKE', 'TT', 'OXY', 'DXCM',
  'NXPI', 'CPRT', 'MPC', 'ON', 'AFL', 'USB', 'TRV', 'WM', 'MRNA', 'CDNS',
  'MSI', 'KLAC', 'ROK', 'ROST', 'MTD', 'CARR', 'PH', 'DELL', 'CTSH', 'HUM',
  'AZO', 'MCK', 'ODFL', 'TFC', 'IDXX', 'CCI', 'AMP', 'TDG', 'APTV', 'COR',
  'WMB', 'AJG', 'MNST', 'HES', 'PCAR', 'AEP', 'WELL', 'COF', 'SPG', 'VRSK',
  'ALL', 'EW', 'PRU', 'DLR', 'KMB', 'NEM', 'PEG', 'IQV', 'KR', 'OTIS',
  'URI', 'BK', 'EA', 'MET', 'RCL', 'GPN', 'EXC', 'STT', 'VICI', 'SYY'
];

// 전체 유니버스: S&P500 + Dow Jones + Russell 1000
export function getStockUniverse(): string[] {
  const combined = new Set([
    ...SP500_TICKERS,
    ...DOW_JONES_TICKERS,
    ...RUSSELL1000_TICKERS,
  ]);
  return Array.from(combined);
}

// 시가총액 기준 상위 300개 기업 (각 인덱스별 상위 100개씩)
export function getTop300ByMarketCap(): string[] {
  // 실제 구현에서는 Yahoo Finance에서 시가총액 데이터를 받아와야 함
  // 여기서는 미리 정의된 리스트에서 중복 제거하여 반환
  return getStockUniverse();
}
