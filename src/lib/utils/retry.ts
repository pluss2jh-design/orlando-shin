import { quotaTracker } from './quota-manager';

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
  maxRetries: 5,           // 3회에서 5회로 증가 (안정성 강화)
  initialDelayMs: 2000,    // 2초 시작
  maxDelayMs: 60000,       // 최대 30초에서 60초로 증가
  backoffMultiplier: 2.5,  // 2배에서 2.5배로 증가 (더 끈질기게 대기)
};

/** 서비스 한도 소모 또는 결제 한도 초과(429) 확인 */
export function is429Error(error: any): boolean {
  const message = (error?.message || '').toString().toUpperCase();
  const status = error?.status || error?.code || 0;
  
  const is429 = (
    status === 429 ||
    message.includes('429') ||
    message.includes('EXHAUSTED') ||
    message.includes('QUOTA') ||
    message.includes('RESOURCE_EXHAUSTED')
  );

  if (is429) {
    // 이미 가공된 메시지라면(대괄호로 시작) 중복 가공 방지
    const originalMessage = (error?.message || '').toString();
    if (originalMessage.startsWith('[')) return is429;

    const quotaStatus = quotaTracker.getQuotaStatus(error?.model || 'unknown');
    
    // 1. 결제 한도 초과 (우선순위 높음)
    if (message.includes('SPENDING CAP') || message.includes('BILLING')) {
      error.message = `[결제 완료 필요] 구글 AI Studio 월간 지출 한도에 도달했습니다. (${quotaStatus})`;
      console.error(`[Quota] ${error.message}`);
    } 
    // 2. 일일 한도 초과 (RPD)
    else if (message.includes('DAILY') || message.includes('RPD') || message.includes('PER DAY')) {
      error.message = `[일일 한도 초과] 오늘 사용 가능한 요청(RPD)을 모두 소모하였습니다. (${quotaStatus})`;
      console.error(`[Quota] ${error.message}`);
    }
    // 3. 분당 한도 초과 (RPM/TPM)
    else {
      const type = message.includes('TOKENS') ? 'TPM(토큰)' : 'RPM(요청)';
      error.message = `[분당 한도 초과] ${type} 한도에 도달했습니다. 잠시 후 다시 시도하거나 모델을 변경해주세요. (${quotaStatus})`;
      console.error(`[Quota] ${error.message}`);
    }
  }
  
  return is429;
}

/** 결제 한도 초과로 인한 치명적 에러인지 확인 */
export function isBillingError(error: any): boolean {
  const message = (error?.message || '').toString().toUpperCase();
  return (message.includes('SPENDING CAP') || message.includes('BILLING')) && (error?.status === 429 || error?.code === 429);
}

/** 지원 중단된 모델 또는 존재하지 않는 모델(404) 여부 확인 */
export function isFatalModelError(error: any): boolean {
  const message = (error?.message || '').toString().toUpperCase();
  const status = error?.status || error?.code || 0;
  return (
    status === 404 ||
    message.includes('NOT_FOUND') ||
    message.includes('NO LONGER AVAILABLE') ||
    message.includes('NOT_AVAILABLE') ||
    isBillingError(error) // 결제 한도 초과도 치명적 에러로 취급 (모델 전환해도 소용없음)
  );
}

/** 503 서비스 불가(일시적 폭주) 여부 확인 */
function is503Error(error: any): boolean {
  const message = (error?.message || '').toString().toUpperCase();
  const status = error?.status || error?.code || 0;
  return (
    status === 503 ||
    message.includes('503') ||
    message.includes('UNAVAILABLE')
  );
}

/** 재시도 가능한 오류인지 확인 (503, 500, 502, 504 등) */
function isRetryableError(error: any): boolean {
  // 429와 치명적 모델 오류(404)는 재시도해도 불가능하므로 false
  if (is429Error(error) || isFatalModelError(error)) return false;
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
 */
export async function callWithModelFallback<T>(
  primaryModel: string,
  fallbackModel: string | undefined,
  fn: (model: string) => Promise<T>
): Promise<T> {
  // 1순위 모델 시도
  try {
    // [신규] 할당량 체크 로직 추가
    // 일반적인 텍스트 요청은 약 5000 토큰으로 추정, 비디오/큰 파일은 더 클 수 있음
    const estimated = 5000;
    await quotaTracker.waitIfNecessary(primaryModel, estimated);

    const result: any = await withRetry(() => fn(primaryModel));
    
    // 실제 사용된 토큰 수량으로 보정
    if (result?.usageMetadata?.totalTokenCount) {
      quotaTracker.recordActualUsage(result.usageMetadata.totalTokenCount, estimated);
    }
    
    return result;
  } catch (error: any) {
    // 결제 한도 초과 또는 치명적 에러는 즉시 중단
    if (isBillingError(error)) {
      error.model = primaryModel; 
      is429Error(error); 
      throw error; 
    }
    if (isFatalModelError(error)) {
      console.error(`[ModelFallback] 1순위 모델(${primaryModel}) 치명적 에러 발생 → 파이프라인 중단`);
      throw new Error(`FATAL_MODEL_ERROR: ${error.message}`);
    }

    console.warn(`[ModelFallback] 1순위 모델(${primaryModel}) 처리 실패: ${error.message || error}`);
    
    if (fallbackModel) {
      console.log(`[ModelFallback] 2순위 모델(${fallbackModel})로 전환 시도...`);
      try {
        const fallbackEstimated = 5000;
        await quotaTracker.waitIfNecessary(fallbackModel, fallbackEstimated);
        
        const secResult: any = await withRetry(() => fn(fallbackModel));
        
        if (secResult?.usageMetadata?.totalTokenCount) {
          quotaTracker.recordActualUsage(secResult.usageMetadata.totalTokenCount, fallbackEstimated);
        }
        
        return secResult;
      } catch (secError: any) {
        if (isBillingError(secError)) {
          secError.model = fallbackModel;
          is429Error(secError); 
          throw secError;
        }
        secError.model = fallbackModel;
        if (is429Error(secError)) {
          throw secError; // 상세 메시지가 포함된 에러 던짐
        }
        if (isFatalModelError(secError)) {
          console.error(`[ModelFallback] 2순위 모델(${fallbackModel}) 치명적 에러 발생 → 파이프라인 중단`);
          throw new Error(`FATAL_MODEL_ERROR: ${secError.message}`);
        }
        
        console.error(`[ModelFallback] 모든 모델(${primaryModel}, ${fallbackModel}) 호출에 최종 실패했습니다. 마지막 에러: ${secError.message || secError}`);
        throw secError;
      }
    }
    
    // [보완] 1순위 모델만 사용하거나 폴백 실패 시 최종 429 에러 상세화
    if (is429Error({ ...error, model: primaryModel })) {
      throw error;
    }
    throw error;
  }
}
