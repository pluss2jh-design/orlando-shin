/**
 * 일시적인 API 오류에 대한 지수적 백오프 재시도 유틸리티
 *
 * [에러 구분 정책]
 * - 429 (RESOURCE_EXHAUSTED / quota): 재시도 없이 즉시 모델 전환 트리거
 * - 503 (UNAVAILABLE / high demand): 최대 3회 지수 대기 재시도, 실패 시 파이프라인 중단
 * - 기타 5xx: 최대 3회 재시도
 */

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  /** true를 반환하면 재시도 없이 즉시 throw */
  skipRetryOn?: (error: any) => boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 2000,    // 2초 시작
  maxDelayMs: 30000,       // 최대 30초
  backoffMultiplier: 2,    // 2배씩 증가 (2s → 4s → 8s)
};

/** 429 할당량 초과 여부 확인 */
export function is429Error(error: any): boolean {
  const message = (error?.message || '').toUpperCase();
  const status = error?.status || error?.code || 0;
  return (
    status === 429 ||
    message.includes('429') ||
    message.includes('EXHAUSTED') ||
    message.includes('QUOTA') ||
    message.includes('RESOURCE_EXHAUSTED')
  );
}

/** 503 서비스 불가(일시적 폭주) 여부 확인 */
function is503Error(error: any): boolean {
  const message = (error?.message || '').toUpperCase();
  const status = error?.status || error?.code || 0;
  return (
    status === 503 ||
    message.includes('503') ||
    message.includes('UNAVAILABLE')
  );
}

/** 재시도 가능한 오류인지 확인 (503, 500, 502, 504 등) */
function isRetryableError(error: any): boolean {
  // 429는 재시도 대신 모델 전환이므로 여기서는 false
  if (is429Error(error)) return false;
  const message = (error?.message || '').toUpperCase();
  const status = error?.status || error?.code || 0;
  if (is503Error(error)) return true;
  if (status >= 500 || message.includes('INTERNAL') || message.includes('TIMEOUT')) return true;
  return false;
}

/**
 * 지수적 백오프 재시도 래퍼
 * - 429는 skipRetryOn 콜백을 통해 즉시 throw (상위에서 모델 전환 처리)
 * - 503은 최대 maxRetries 회 재시도
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

      // skipRetryOn이 true면 즉시 throw (주로 429 처리용)
      if (fullConfig.skipRetryOn?.(error)) {
        throw error;
      }

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

/**
 * 이중 AI 모델 폴백 래퍼
 *
 * @param primaryModel   1순위 모델명
 * @param fallbackModel  2순위 모델명 (없으면 단일 모델만 시도)
 * @param fn             모델명을 인자로 받아 AI 호출을 수행하는 함수
 *
 * [동작 정책]
 * - 1순위 모델 429 → 즉시 2순위 모델로 전환
 * - 1순위 모델 503 → 최대 3회 재시도 후에도 실패 → 파이프라인 중단
 * - 2순위 모델도 429 → AI_ALL_QUOTA_EXCEEDED 에러로 파이프라인 중단
 * - 2순위 모델 503 → 최대 3회 재시도 후에도 실패 → 파이프라인 중단
 */
export async function callWithModelFallback<T>(
  primaryModel: string,
  fallbackModel: string | undefined,
  fn: (model: string) => Promise<T>
): Promise<T> {
  // 1순위 모델 시도 (429는 재시도 없이 즉시 throw)
  try {
    return await withRetry(() => fn(primaryModel), {
      skipRetryOn: (err) => is429Error(err),
    });
  } catch (primaryError: any) {
    // 1순위 429 → 2순위로 전환
    if (is429Error(primaryError) && fallbackModel) {
      console.warn(`[ModelFallback] 1순위 모델(${primaryModel}) 할당량 초과 → 2순위 모델(${fallbackModel})로 전환`);
      try {
        return await withRetry(() => fn(fallbackModel!), {
          skipRetryOn: (err) => is429Error(err),
        });
      } catch (fallbackError: any) {
        if (is429Error(fallbackError)) {
          throw new Error(`[ModelFallback] 모든 AI 모델의 할당량이 초과되었습니다. (1순위: ${primaryModel}, 2순위: ${fallbackModel})`);
        }
        // 2순위 503 실패 → 파이프라인 중단
        throw new Error(`[ModelFallback] 2순위 모델(${fallbackModel})도 응답 실패: ${fallbackError.message}`);
      }
    }

    // 1순위 503 3회 실패(폴백 없는 경우 포함) → 파이프라인 중단
    throw primaryError;
  }
}
