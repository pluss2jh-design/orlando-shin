import type { CurrencyCode, ExchangeRate } from '@/types/stock-analysis';
import YahooFinance from 'yahoo-finance2';

const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_RATE = 1350;

let cachedRate: ExchangeRate | null = null;
const yahooFinance = new YahooFinance();

export async function fetchExchangeRate(): Promise<ExchangeRate> {
  if (cachedRate && Date.now() - cachedRate.fetchedAt.getTime() < CACHE_TTL_MS) {
    return cachedRate;
  }

  try {
    const result = await yahooFinance.quote('KRW=X');
    const rate = result.regularMarketPrice ?? FALLBACK_RATE;

    cachedRate = {
      from: 'USD',
      to: 'KRW',
      rate,
      fetchedAt: new Date(),
    };

    return cachedRate;
  } catch {
    if (cachedRate) return cachedRate;

    return {
      from: 'USD',
      to: 'KRW',
      rate: FALLBACK_RATE,
      fetchedAt: new Date(),
    };
  }
}

export function convertCurrency(
  amount: number,
  from: CurrencyCode,
  to: CurrencyCode,
  exchangeRate: ExchangeRate
): number {
  if (from === to) return amount;

  if (from === 'USD' && to === 'KRW') {
    return amount * exchangeRate.rate;
  }

  if (from === 'KRW' && to === 'USD') {
    return amount / exchangeRate.rate;
  }

  return amount;
}

export function convertToKRW(
  amount: number,
  currency: CurrencyCode,
  exchangeRate: ExchangeRate
): number {
  return convertCurrency(amount, currency, 'KRW', exchangeRate);
}

const KRW_INDICATORS = ['원', '₩', 'KRW', '만원', '억원'];
const USD_INDICATORS = ['$', 'USD', 'dollar', 'Dollar'];

export function detectCurrency(text: string): CurrencyCode {
  const lowerText = text.toLowerCase();

  for (const indicator of USD_INDICATORS) {
    if (lowerText.includes(indicator.toLowerCase())) return 'USD';
  }

  for (const indicator of KRW_INDICATORS) {
    if (text.includes(indicator)) return 'KRW';
  }

  const numberMatch = text.match(/[\d,]+/);
  if (numberMatch) {
    const num = parseInt(numberMatch[0].replace(/,/g, ''), 10);
    if (num >= 10000) return 'KRW';
  }

  return 'KRW';
}

export function clearExchangeRateCache(): void {
  cachedRate = null;
}
