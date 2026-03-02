/**
 * 일시적인 API 오류에 대한 지수적 백오프 재시도 유틸리티
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 2000,    // 2초 시작
  maxDelayMs: 30000,       // 최대 30초
  backoffMultiplier: 2,    // 2배씩 증가 (2s -> 4s -> 8s)
};

/**
 * 재시도 가능한 오류인지 확인 (503, 429, 500 등)
 */
function isRetryableError(error: any): boolean {
  const message = error.message?.toUpperCase() || '';
  const status = error.status || error.code || 0;
  
  // 503 UNAVAILABLE (High demand)
  if (message.includes('503') || message.includes('UNAVAILABLE')) return true;
  // 429 RESOURCE_EXHAUSTED (Rate limit)
  if (message.includes('429') || message.includes('EXHAUSTED')) return true;
  // 500, 502, 504 (Server errors)
  if (status >= 500 || message.includes('INTERNAL') || message.includes('TIMEOUT')) return true;
  
  return false;
}

/**
 * 지수적 백오프 재시도 래퍼
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const fullConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: any;
  
  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      if (!isRetryableError(error) || attempt === fullConfig.maxRetries) {
        throw error;
      }
      
      const delay = Math.min(
        fullConfig.initialDelayMs * Math.pow(fullConfig.backoffMultiplier, attempt),
        fullConfig.maxDelayMs
      );
      
      console.warn(`[Retry] API 호출 실패 (시도 ${attempt + 1}/${fullConfig.maxRetries}). ${Math.round(delay)}ms 후 다시 시도합니다. 에러: ${error.message}`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}
