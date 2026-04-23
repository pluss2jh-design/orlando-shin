/**
 * Google AI Studio Tier 1 한도 기반 쿼타 매니저
 */

export interface ModelQuota {
  rpm: number;
  tpm: number;
  rpd: number;
}

export const MODEL_QUOTAS: Record<string, ModelQuota> = {
  'gemini-3.1-flash-lite': { rpm: 4000, tpm: 4000000, rpd: 150000 },
  'gemini-3.1-pro': { rpm: 25, tpm: 2000000, rpd: 250 },
  'gemini-3-flash': { rpm: 1000, tpm: 2000000, rpd: 10000 },
  'gemini-2.0-flash-lite': { rpm: 4000, tpm: 4000000, rpd: 150000 },
  'gemini-2.0-flash': { rpm: 2000, tpm: 4000000, rpd: 150000 },
  'gemini-2.0-pro': { rpm: 25, tpm: 2000000, rpd: 250 },
  'gemini-1.5-flash-8b': { rpm: 4000, tpm: 1000000, rpd: 150000 },
  'gemini-1.5-flash': { rpm: 2000, tpm: 4000000, rpd: 150000 },
  'gemini-1.5-pro': { rpm: 360, tpm: 2000000, rpd: 10000 }, // Tier 1 기준
  'gpt-4o-mini': { rpm: 3, tpm: 200000, rpd: 1000 }, // 기본 폴백용 보수적 수치
  'gpt-4o': { rpm: 3, tpm: 30000, rpd: 500 },
};

class QuotaTracker {
  public lastMinuteRequests: number = 0;
  public lastMinuteTokens: number = 0;
  public windowStartTime: number = Date.now();

  /**
   * 할당량을 체크하고 필요시 대기합니다.
   */
  async waitIfNecessary(modelName: string, estimatedTokens: number = 100000) {
    const model = modelName.toLowerCase().replace('models/', '');
    // 가장 유사한 모델의 쿼타 찾기
    const quotaKey = Object.keys(MODEL_QUOTAS).find(key => model.includes(key)) || 'gemini-1.5-flash';
    const quota = MODEL_QUOTAS[quotaKey];

    const now = Date.now();
    
    // 1분 윈도우가 지났으면 리셋
    if (now - this.windowStartTime > 60000) {
      this.lastMinuteRequests = 0;
      this.lastMinuteTokens = 0;
      this.windowStartTime = now;
    }

    // RPM 또는 TPM의 90%에 도달했는지 확인 (안전 마진 10%)
    const isRpmLimit = this.lastMinuteRequests >= quota.rpm * 0.9;
    const isTpmLimit = (this.lastMinuteTokens + estimatedTokens) >= quota.tpm * 0.9;

    if (isRpmLimit || isTpmLimit) {
      const waitTime = Math.max(1000, 60000 - (now - this.windowStartTime) + 1000);
      const modelDisplayName = modelName.toLowerCase().replace('models/', '');
      console.log(`[QuotaManager] ${modelDisplayName} 한도 근접 (RPM: ${this.lastMinuteRequests}/${quota.rpm}, TPM: ${this.lastMinuteTokens + estimatedTokens}/${quota.tpm}). ${Math.round(waitTime/1000)}초 대기합니다...`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // 대기 후 리셋 (동시성 고려: 대기 중에 다른 놈이 리셋했을 수 있음)
      const afterWait = Date.now();
      if (afterWait - this.windowStartTime > 60000) {
        this.lastMinuteRequests = 0;
        this.lastMinuteTokens = 0;
        this.windowStartTime = afterWait;
      }
    }

    // 요청 기록 업데이트
    this.lastMinuteRequests++;
    this.lastMinuteTokens += estimatedTokens;
  }

  /**
   * 응답을 받은 후 실제 사용된 토큰으로 보정
   */
  recordActualUsage(actualTokens: number, estimatedTokens: number) {
    // 이미 더해진 예상치를 빼고 실제치를 더함 (최소 0 유지)
    this.lastMinuteTokens = Math.max(0, this.lastMinuteTokens - estimatedTokens + actualTokens);
  }

  /**
   * 현재 모델별 할당량 상태를 문자열로 반환합니다.
   */
  getQuotaStatus(modelName: string, estimatedTokens: number = 0): string {
    const model = modelName.toLowerCase().replace('models/', '');
    const quotaKey = Object.keys(MODEL_QUOTAS).find(key => model.includes(key));
    
    // 쿼타 설정이 있는 경우 해당 한도 표시, 없으면 1.5-flash 기준으로 표시하되 이름은 원래 이름 유지
    const quota = quotaKey ? MODEL_QUOTAS[quotaKey] : MODEL_QUOTAS['gemini-1.5-flash'];
    const label = quotaKey || model; // 설정이 없으면 원래 모델명 표시
    
    return `${label} [RPM: ${this.lastMinuteRequests}/${quota.rpm}, TPM: ${this.lastMinuteTokens + estimatedTokens}/${quota.tpm}]`;
  }
}

export const quotaTracker = new QuotaTracker();
