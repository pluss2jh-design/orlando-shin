// ===========================
// 기본 타입
// ===========================

export interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'mp4' | 'other';
  size: number;
  uploadedAt: Date;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
}

export interface InvestmentConditions {
  amount: number;
  periodMonths: number;
}

export interface AnalysisResult {
  companyName: string;
  ticker?: string;
  market?: StockMarket;
  expectedReturnRate: number;
  confidenceScore: number;
  confidenceDetails?: string[];
  reasoning: string;
  sources: SourceReference[];
  riskLevel: RiskLevel;
  currentPrice?: number;
  targetPrice?: number;
  currency?: CurrencyCode;
}

export interface FilteredCandidate {
  company: ExtractedCompanyAnalysis;
  yahooData: YahooFinanceData;

  normalizedPrices: NormalizedPrices;
  filterResults: FilterStageResult[];
  passedAllFilters: boolean;

  score: number;
  expectedReturnRate: number;
  confidenceScore: number;
  confidenceDetails?: string[];
  riskLevel: RiskLevel;
}

export interface SourceReference {
  fileName: string;
  type: 'pdf' | 'mp4';
  pageOrTimestamp: string;
  content: string;
}

export interface CloudSyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'error';
  lastSync?: Date;
  message?: string;
}

// ===========================
// 공통 리터럴 타입
// ===========================

export type CurrencyCode = 'KRW' | 'USD';
export type StockMarket = 'KRX' | 'NYSE' | 'NASDAQ' | 'unknown';
export type RiskLevel = 'low' | 'medium' | 'high';
export type InvestmentStyle = 'conservative' | 'aggressive' | 'moderate';

// ===========================
// A. AI가 자료에서 추출한 기업 분석 데이터
// ===========================

/** AI가 PDF/MP4에서 추출한 개별 기업 분석 정보 */
export interface ExtractedCompanyAnalysis {
  companyName: string;
  ticker?: string;
  market: StockMarket;
  currency: CurrencyCode;

  recommendedBuyPrice?: number;
  targetPrice?: number;
  stopLossPrice?: number;

  metrics: ExtractedMetrics;

  investmentThesis: string;
  riskFactors: string[];
  sector?: string;

  investmentStyle: InvestmentStyle;
  sources: SourceReference[];

  extractedAt: Date;
  confidence: number;
}

export interface ExtractedMetrics {
  per?: number;
  pbr?: number;
  roe?: number;
  eps?: number;
  dividendYield?: number;
  debtRatio?: number;
  revenueGrowth?: number;
}

/** 교육 자료에서 학습한 투자 판단 기준 */
export interface LearnedInvestmentCriteria {
  goodCompanyRules: {
    rule: string;
    weight: number;
    source: SourceReference;
  }[];

  idealMetricRanges: {
    metric: string;
    min?: number;
    max?: number;
    description: string;
    source: SourceReference;
  }[];

  principles: {
    principle: string;
    category: 'entry' | 'exit' | 'risk' | 'general';
    source: SourceReference;
  }[];
}

export interface InvestmentStrategy {
  shortTermConditions: string[];
  longTermConditions: string[];
  winningPatterns: string[];
  riskManagementRules: string[];
}

export interface LearnedKnowledge {
  companies: ExtractedCompanyAnalysis[];
  criteria: LearnedInvestmentCriteria;
  strategy: InvestmentStrategy;
  rawSummaries: { fileName: string; summary: string }[];
  learnedAt: Date;
  sourceFiles: string[];
}

// ===========================
// B. Yahoo Finance 실시간 데이터
// ===========================

export interface YahooFinanceData {
  ticker: string;
  currency: CurrencyCode;

  currentPrice: number;
  previousClose: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;

  targetMeanPrice?: number;
  targetHighPrice?: number;
  targetLowPrice?: number;

  trailingPE?: number;
  forwardPE?: number;
  priceToBook?: number;
  returnOnEquity?: number;
  trailingEps?: number;
  dividendYield?: number;
  marketCap?: number;

  priceHistory: PriceHistoryEntry[];

  fetchedAt: Date;
}

export interface PriceHistoryEntry {
  date: Date;
  close: number;
  volume: number;
}

// ===========================
// C. 환율
// ===========================

export interface ExchangeRate {
  from: CurrencyCode;
  to: CurrencyCode;
  rate: number;
  fetchedAt: Date;
}

// ===========================
// D. 필터링 파이프라인
// ===========================

export interface FilterStageResult {
  stage: number;
  stageName: string;
  passed: boolean;
  reason: string;
}

/** 가격을 KRW로 통일한 정규화 가격 */
export interface NormalizedPrices {
  currentPriceKRW: number;
  targetPriceKRW: number;
  recommendedBuyPriceKRW: number;
  exchangeRateUsed?: number;
}

/** 필터링을 거친 후보 기업 */
export interface FilteredCandidate {
  company: ExtractedCompanyAnalysis;
  yahooData: YahooFinanceData;

  normalizedPrices: NormalizedPrices;
  filterResults: FilterStageResult[];
  passedAllFilters: boolean;

  score: number;
  expectedReturnRate: number;
  confidenceScore: number;
  confidenceDetails?: string[];
  riskLevel: RiskLevel;
}

// ===========================
// E. 근거 매핑 (Evidence Chain)
// ===========================

export interface EvidenceFactor {
  factor: string;
  value: string;
  source: SourceReference;
  weight: number;
}

export interface RealTimeCheck {
  metric: string;
  materialValue: string;
  realTimeValue: string;
  status: 'favorable' | 'neutral' | 'unfavorable';
}

export interface EvidenceChain {
  decision: string;
  factors: EvidenceFactor[];
  realTimeChecks: RealTimeCheck[];
}

// ===========================
// F. 최종 추천 결과
// ===========================

export interface RecommendationResult {
  candidates: FilteredCandidate[];
  topPicks: FilteredCandidate[];
  investmentConditions: InvestmentConditions;
  investmentStyle: InvestmentStyle;
  exchangeRate: ExchangeRate;
  processedAt: Date;
  summary: string;
  allSourcesUsed: SourceReference[];
}
