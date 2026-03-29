// ===========================
// 기본 타입
// ===========================

export interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'mp4' | 'folder' | 'other';
  size: number;
  uploadedAt: Date;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  parentId?: string;
  isDriveFile?: boolean; // 구글 드라이브 파일 여부
}

export interface InvestmentConditions {
  amount: number;
  sector?: string;
  strategyType?: 'growth' | 'value' | 'all';
  asOfDate?: Date;
  excludeSP500?: boolean;
  universeType?: 'sp500' | 'russell1000' | 'russell1000_exclude_sp500';
}



export interface MatchRuleSource {
  label: string;
  url?: string;
  metric?: string;
  description?: string;
}

export interface MatchRuleResult {
  name: string;
  category: string;
  passed: boolean;
  score: number; // 0~10
  reason: string;
  weight: number;
  isCritical: boolean;
  source?: SourceReference;
}

export interface StrategyMatchScore {
  rules: MatchRuleResult[];
  totalScore: number;     // 0~100 (가중 평균)
  matchPercentage: number; // 0~100%
  passedCount: number;
  totalCount: number;
  investmentStage: 'watch' | 'scout' | 'expand1' | 'expand2' | 'full';
  allocationLabel: string;
}

// AnalysisResult는 아래에서 정의됩니다.

export interface ExpertVerdict {
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  title: string;
  summary: string;
  convictionScore: number;
  keyPoints: string[];
  risks: string[];
  authorCitations: { fileName: string; pageOrTimestamp?: string }[];
}



export interface SourceReference {
  fileName: string;
  folderPath?: string;
  type: 'pdf' | 'mp4';
  pageOrTimestamp: string;
  content: string;
}

export interface CloudSyncStatus {
  status: 'idle' | 'syncing' | 'synced' | 'completed' | 'error';
  lastSync?: Date;
  message?: string;
  progress?: {
    totalFiles: number;
    processedFolders: number;
    currentFolder?: string;
  };
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
  
  sentimentSummary?: string;
  macroStatus?: string;

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
  consensusScore?: number; // How consistent the advice is across sources
  criterias: {
    name: string;
    category: string;
    weight: number;
    description: string;
    quantification: {
      target_metric: string;
      condition: '>' | '<' | '>=' | '<=' | '==';
      benchmark: number | string; // 15 or 'sector_avg'
      benchmark_type?: 'absolute' | 'sector_relative' | 'sector_percentile';
      scoring_type: 'binary' | 'linear';
    };
    isCritical: boolean;
    source: SourceReference;
    visualEvidence?: string; // OCR data or Frame visual description
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
  consensusScore?: number; // How consistent the advice is across sources
}

export interface FileAnalysis {
  fileName: string;
  fileId: string;
  keyConditions: string[];
  visualHighlights?: { timestamp: string; description: string; imageUrl?: string }[];
  extractedAt: Date;
}

export interface LearnedKnowledge {
  fileAnalyses: FileAnalysis[];
  criteria: LearnedInvestmentCriteria;
  strategy: InvestmentStrategy;
  strategyType?: 'aggressive' | 'moderate' | 'stable';
  keyConditionsSummary?: string;
  rawSummaries: {
    fileName: string;
    summary: string
  }[];
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
  sector?: string;
  revenueGrowth?: number;

  priceHistory: PriceHistoryEntry[];
  financialHistory?: FinancialRecord[];
  returnRates?: {
    oneYear?: number;
    sixMonths?: number;
    threeMonths?: number;
    oneMonth?: number;
  };

  fetchedAt: Date;
}

export interface FinancialRecord {
  date: string;
  revenue: number;
  operatingIncome: number;
  operatingMargin: number;
  revenueGrowth?: number;
  operatingIncomeGrowth?: number;
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

export interface RuleScore extends MatchRuleResult {}

/** 필터링을 거친 후보 기업 */
export interface FilteredCandidate {
  company: ExtractedCompanyAnalysis;
  yahooData: YahooFinanceData;

  normalizedPrices: NormalizedPrices;
  filterResults: FilterStageResult[];
  passedAllFilters: boolean;
}

export interface AnalysisResult extends FilteredCandidate {
  companyName: string;
  ticker?: string;
  market?: StockMarket;
  sector?: string;
  reasoning: string;
  sources: SourceReference[];

  score: number;
  expectedReturnRate: number;
  confidenceScore: number;
  confidenceDetails?: string[];
  riskLevel: RiskLevel;
  ruleScores?: RuleScore[];
  totalRuleScore?: number;
  maxPossibleScore?: number;
  strategyMatch?: StrategyMatchScore;
  
  // 고도화 항목: 매크로, 감성, 예측
  macroContext?: MacroContext;
  sentiment?: SentimentAnalysis;
  prediction?: PredictiveAnalysis;
  expertVerdict?: ExpertVerdict;
  
  returnRates?: {
    oneYear?: number;
    sixMonths?: number;
    threeMonths?: number;
    oneMonth?: number;
  };

  backtestResult?: {
    pastOneYearReturn: number;
    winRateVsS_P500: number;
  };
}

export interface MacroContext {
  vix: number;
  vixStatus: 'Low' | 'Moderate' | 'High' | 'Extreme';
  treasuryYield10Y: number;
  yieldStatus: 'Bearish' | 'Neutral' | 'Bullish';
  sp500Trend: 'Uptrend' | 'Downtrend' | 'Sideways';
  marketMode: 'Greed' | 'Fear' | 'Neutral';
  dxy?: number;       // Dollar Index
  hySpread?: number;  // High Yield Spread Proxy
  extractedAt: Date;
}

export interface SentimentAnalysis {
  score: number; // -10 to 10
  label: 'Positive' | 'Negative' | 'Neutral';
  summary: string;
  recentHeadlines: { title: string; url?: string }[];
  riskHeadlines: { title: string; url?: string }[];
}

export interface PredictiveAnalysis {
  growthPotential: 'Bullish' | 'Neutral' | 'Bearish';
  sixMonthTargetPrice: number;
  expectedReturn: number;
  confidence?: number;
  logic: string;
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

export interface ExcludedStockDetail {
  ticker: string;
  reason: string;
  category?: string; // Grouping category
}

export interface RecommendationResult {
  candidates: AnalysisResult[];
  topPicks: AnalysisResult[];
  investmentConditions: InvestmentConditions;
  investmentStyle: InvestmentStyle;
  exchangeRate: ExchangeRate;
  processedAt: Date;
  summary: string;
  allSourcesUsed: SourceReference[];
  macroContext?: MacroContext;
  queriedTickers: string[];
  excludedStockCount?: number;
  excludedDetails?: ExcludedStockDetail[];
  universeCounts?: {
    russellCount: number;
    sp500Count: number;
    overlapCount: number;
  };
}



// ===========================
// G. 뉴스 및 공시 정보
// ===========================

export interface NewsItem {
  id: string;
  ticker: string;
  title: string;
  content: string;
  summary: string;
  source: string;
  publishedAt: Date;
  url?: string;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface NewsSummary {
  ticker: string;
  count: number;
  overallSentiment: number;
  summary: string;
}

// ===========================
// H. UI 전용 상태 타입
// ===========================

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  progressMessage: string;
  results: RecommendationResult | null;
  error: string | null;
  excludedStockCount: number;
  excludedDetails: ExcludedStockDetail[];
  conditions: InvestmentConditions | null;
  universeCounts?: {
    russellCount: number;
    sp500Count: number;
    overlapCount: number;
  };
  processedCount?: number;
}
