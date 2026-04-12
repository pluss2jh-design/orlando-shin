'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, User, MessageSquare, Lock, Building2, Globe } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { SingleCompanyBar } from '@/components/stock-analysis/single-company-bar';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { NewsSection } from '@/components/stock-analysis/news-section';
import { BacktestDialog } from '@/components/stock-analysis/backtest-dialog';
import { Badge } from '@/components/ui/badge';
import { AnalysisReport } from '@/components/stock-analysis/analysis-report';
import { Button } from '@/components/ui/button';
import { History, Search, X, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InvestmentConditions,
  AnalysisResult,
  NewsSummary,
  ExcludedStockDetail
} from '@/types/stock-analysis';

import { UserMenu } from '@/components/shared/user-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


export default function StockAnalysisPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [analysisState, setAnalysisState] = useState<{
    conditions: InvestmentConditions | null;
    results: AnalysisResult[];
    isAnalyzing: boolean;
    error: string | null;
    progress: number;
    progressMessage: string;
    excludedStockCount: number;
    excludedDetails: ExcludedStockDetail[];
  }>({
    conditions: null,
    results: [],
    isAnalyzing: false,
    error: null,
    progress: 0,
    progressMessage: '',
    excludedStockCount: 0,
    excludedDetails: []
  });



  const [newsState, setNewsState] = useState<{
    summaries: NewsSummary[];
    isLoading: boolean;
  }>({
    summaries: [],
    isLoading: false,
  });
  const [universeStats, setUniverseStats] = useState<{
    russellCount: number;
    sp500Count: number;
    overlapCount: number;
    finalCount: number;
  } | null>(null);

  const [backtestTicker, setBacktestTicker] = useState<string | null>(null);
  const [showManualBacktest, setShowManualBacktest] = useState(false);
  const [manualTicker, setManualTicker] = useState('');

  // ── 분석 모드 (유니버스 vs 단일 기업) ──
  const [analysisMode, setAnalysisMode] = useState<'universe' | 'single'>('universe');
  const [singleTicker, setSingleTicker] = useState('');
  const [singleAnalysisModel, setSingleAnalysisModel] = useState<{ newsAiModel?: string; fallbackAiModel?: string; conditions?: any }>({});
  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDetailReport, setShowDetailReport] = useState(false);
  const analysisAlerted = useRef(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/stock-analysis');
    }
  }, [status, router]);

  useEffect(() => {
    const fetchUserPlan = async () => {
      try {
        const res = await fetch('/api/user/features');
        if (res.ok) {
          const data = await res.json();
          setUserPlan(data.plan);
        }
      } catch (error) {
        console.error('Failed to fetch user plan:', error);
      }
    };
    const fetchUniverseStats = async () => {
      try {
        const res = await fetch('/api/universe/counts');
        if (res.ok) {
          const data = await res.json();
          setUniverseStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch universe stats:', error);
      }
    };

    if (session?.user) {
      fetchUserPlan();
      fetchUniverseStats();
    }

  }, [session]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const pollStatus = async () => {
      try {
        const response = await fetch('/api/analysis', { method: 'GET' });
        if (response.ok) {
          const data = await response.json();
            if (data.status === 'processing') {
              setAnalysisState(prev => ({
                ...prev,
                isAnalyzing: true,
                error: null,
                progress: data.progress || 0,
                progressMessage: data.progressMessage || '분석 중...',
                excludedStockCount: data.excludedStockCount || 0,
                excludedDetails: data.excludedDetails || []
              }));

              // 1.5초 간격 상시 폴링 활성화 (상태가 processing인 동안)
              if (!interval) {
                interval = setInterval(pollStatus, 1500);
              }
            } else if (data.status === 'completed' && data.result) {
              if (interval) { clearInterval(interval); interval = null; }
              setAnalysisState(prev => ({
                ...prev,
                isAnalyzing: false,
                progress: 100,
                progressMessage: '분석 완료'
              }));
              if (data.result.trackA && data.result.trackA.length > 0) {
                // onProgress(100, `분석 완료: ${data.result.trackA.length}개 추천 종목 추출됨`);
              }
              if (!analysisAlerted.current) {
                analysisAlerted.current = true;
                alert('기업 분석이 완료되었습니다!');
                processAnalysisData(data.result);
              }
            } else if (data.status === 'error') {
            if (interval) { clearInterval(interval); interval = null; }
            setAnalysisState(prev => ({ ...prev, isAnalyzing: false, error: data.error }));
          }
        }
      } catch (e) {
        console.error('Polling error:', e);
      }
    };

    if (session?.user) {
      pollStatus();
      // 수동 트리거 이벤트 수신을 위한 리스너 추가
      const triggerPoll = () => pollStatus();
      window.addEventListener('trigger-analysis-poll', triggerPoll);
      return () => {
        if (interval) clearInterval(interval);
        window.removeEventListener('trigger-analysis-poll', triggerPoll);
      };
    }
    return () => { if (interval) clearInterval(interval); };
  }, [session]);

  const handleSendEmail = async (email: string) => {
    const response = await fetch('/api/email/send-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Confirmed': 'true' },
      body: JSON.stringify({ email, results: analysisState.results, conditions: analysisState.conditions }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '이메일 발송 실패');
    }
  };

  /* [TOKEN_SAVE] 개별 기업 뉴스 조회 일시 중지
  const fetchNewsForTickers = async (tickers: string[]) => {
    setNewsState(prev => ({ ...prev, isLoading: true }));
    try {
      const response = await fetch('/api/stock/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Confirmed': 'true' },
        body: JSON.stringify({ tickers }),
      });
      if (!response.ok) throw new Error('뉴스 조회 실패');
      const data = await response.json();
      setNewsState({ summaries: data.results || [], isLoading: false });
    } catch (error) {
      console.error('News fetch error:', error);
      setNewsState(prev => ({ ...prev, isLoading: false }));
    }
  };
  */


  const processAnalysisData = (data: any) => {
    const picks = data.trackA || data.topPicks || [];
    if (picks && Array.isArray(picks) && picks.length > 0) {
      const results: AnalysisResult[] = picks.map((pick: any) => ({
        companyName: pick.company.companyName,
        ticker: pick.yahooData?.ticker,
        market: pick.company.market,
        expectedReturnRate: pick.expectedReturnRate,
        confidenceScore: Math.round(pick.confidenceScore * 100),
        confidenceDetails: pick.confidenceDetails,
        reasoning: pick.company.investmentThesis || '시장 지표 및 재무 분석 결과 우수한 성장 잠재력이 확인되었습니다.',
        sources: pick.company.sources || [],
        riskLevel: pick.riskLevel,
        currentPrice: pick.yahooData?.currentPrice,
        targetPrice: pick.company.targetPrice,
        currency: pick.yahooData?.currency,
        ruleScores: pick.ruleScores,
        totalRuleScore: pick.totalRuleScore,
        maxPossibleScore: pick.maxPossibleScore,
        financialHistory: pick.yahooData?.financialHistory,
        returnRates: pick.yahooData?.returnRates,
        tenbaggerScore: pick.tenbaggerScore,
        strategyMatch: pick.strategyMatch,
        macroContext: pick.macroContext,
        sentiment: pick.sentiment,
        prediction: pick.prediction,
        backtestResult: pick.backtestResult,
        sector: pick.yahooData?.sector || pick.company?.sector,

      }));

      setAnalysisState(prev => ({
        ...prev,
        results,
        isAnalyzing: false,
        excludedStockCount: data.excludedStockCount || prev.excludedStockCount,
        excludedDetails: data.excludedDetails || prev.excludedDetails
      }));

      if (data.universeCounts) {
        setUniverseStats(data.universeCounts);
      }



      // [TOKEN_SAVE] 개별 기업 뉴스 조회 호출 주석 처리
      // const tickers = results.map(r => r.ticker).filter(Boolean) as string[];
      // if (tickers.length > 0) fetchNewsForTickers(tickers);


      if (data.queriedTickers && Array.isArray(data.queriedTickers)) {
        // setQueriedTickers(data.queriedTickers); — removed (unused)
      }
    } else {
      setAnalysisState(prev => ({
        ...prev,
        results: [],
        isAnalyzing: false,
        error: data.summary || '추천 대상 기업을 찾지 못했습니다. 잠시 후 다시 시도하거나 학습 데이터를 확인해주세요.',
      }));
    }
  };

  const handleAnalyze = async (newConditions: InvestmentConditions & {
    newsAiModel?: string; newsApiKey?: string; companyCount?: number; fallbackAiModel?: string;
  }) => {
    analysisAlerted.current = false;
    setAnalysisState(prev => ({
      ...prev, conditions: newConditions, isAnalyzing: true, error: null, results: [], progress: 0, excludedStockCount: 0, excludedDetails: []
    }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: 'moderate',
          conditions: {
            companyCount: newConditions.companyCount || 5,
            newsAiModel: newConditions.newsAiModel,
            fallbackAiModel: newConditions.fallbackAiModel,
            newsApiKey: newConditions.newsApiKey,
            asOfDate: newConditions.asOfDate,
            excludeSP500: newConditions.excludeSP500,
            universeType: newConditions.universeType,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403) {
          setShowUpgradeModal(true);
          setAnalysisState(prev => ({ ...prev, isAnalyzing: false }));
          return;
        }
        throw new Error(data.error || '분석 실패');
      }

      alert('AI 엔진 분석 요청이 접수되었습니다. 백그라운드에서 진행됩니다.');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('trigger-analysis-poll'));
      }, 500);
    } catch (error) {
      console.error('Analysis error:', error);
      const message = error instanceof Error ? error.message : '분석 실패';
      setAnalysisState(prev => ({ ...prev, results: [], isAnalyzing: false, error: message }));
    }
  };

  const handleStopAnalysis = async () => {
    if (!confirm('분석을 중단하시겠습니까? 지금까지의 진행 상황이 초기화됩니다.')) return;
    
    try {
      await fetch('/api/analysis/cancel', { method: 'POST' });
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
        error: '사용자에 의해 분석이 중단되었습니다.',
        progress: 0
      }));
    } catch (err) {
      console.error('Stop analysis failed:', err);
    }
  };

  // ── 단일 기업 분석 ──
  const handleSingleAnalyze = async () => {
    if (!singleTicker.trim()) { alert('티커를 입력해주세요.'); return; }
    if (!singleAnalysisModel.newsAiModel) { alert('AI 모델을 선택해주세요.'); return; }
    setSingleLoading(true); setSingleError(null); setSingleResult(null);
    try {
      const res = await fetch('/api/analysis/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: singleTicker.trim().toUpperCase(),
          conditions: singleAnalysisModel.conditions || {},
          newsAiModel: singleAnalysisModel.newsAiModel,
          fallbackAiModel: singleAnalysisModel.fallbackAiModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setSingleResult(data.result);
    } catch (e: any) {
      setSingleError(e.message);
    } finally {
      setSingleLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">로그인이 필요합니다</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">분석 기능을 이용하려면 로그인이 필요합니다.</p>
            <Button className="w-full" onClick={() => router.push('/login?callbackUrl=/stock-analysis')}>
              로그인하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 font-sans">

      {/* ── 스티키 헤더 (로고 + 우측 메뉴만) ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="mx-auto px-6 max-w-screen-2xl">
          <div className="flex items-center justify-between h-14">
            {/* 로고 */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors"
            >
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span className="font-black tracking-tighter text-base">
                ORLANDO <span className="text-blue-600">ANALYSIS</span>
              </span>
            </button>

            {/* 우측 메뉴 */}
            <div className="flex items-center gap-2">
              {session && !isAdmin && (
                <Button variant="ghost" size="sm" onClick={() => router.push('/pricing')}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-xs hidden md:flex">
                  플랜 업그레이드
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => router.push('/inquiry')}
                className="font-bold text-xs gap-1.5 hidden sm:flex">
                <MessageSquare className="h-3.5 w-3.5" /> 문의
              </Button>
              {session ? <UserMenu /> : (
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/login'}
                  className="font-bold text-xs gap-1.5">
                  <User className="h-3.5 w-3.5" /> 로그인
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 스캠 및 시뮬레이션 컨트롤 통합 서브바 ── */}
      <div className="sticky top-14 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="mx-auto px-6 max-w-screen-2xl flex flex-col gap-3 py-3">

          {/* 모드 토글 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnalysisMode('universe')}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                analysisMode === 'universe' ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              <Globe className="h-3 w-3" />유니버스 스캐닝
            </button>
            <button
              onClick={() => setAnalysisMode('single')}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                analysisMode === 'single' ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              <Building2 className="h-3 w-3" />단일 기업 분석
            </button>
          </div>

          {analysisMode === 'universe' ? (
            <div className="flex xl:flex-row flex-col items-stretch xl:items-center gap-3">
              <div className="flex-1 w-full">
                <InvestmentInput onAnalyze={handleAnalyze} disabled={analysisState.isAnalyzing} />
              </div>
              <div className="flex items-center gap-3 shrink-0 h-12">
                <div className="hidden xl:block h-6 w-px bg-gray-200" />
                {showManualBacktest ? (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-3 duration-300 w-full xl:w-auto">
                    <Input
                      placeholder="Ticker (e.g. TSLA)"
                      value={manualTicker}
                      onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
                      className="w-full xl:w-40 h-12 bg-gray-50 font-black uppercase text-xs tracking-widest border-blue-100 focus:border-blue-500 rounded-xl"
                      onKeyDown={(e) => { if (e.key === 'Enter' && manualTicker) { setBacktestTicker(manualTicker); setShowManualBacktest(false); } }}
                    />
                    <Button size="sm" className="h-12 px-6 bg-blue-600 hover:bg-blue-500 font-black text-xs uppercase tracking-widest rounded-xl"
                      onClick={() => { if (manualTicker) { setBacktestTicker(manualTicker); setShowManualBacktest(false); } }}>
                      <Search className="h-4 w-4 mr-2" />시뮬레이션
                    </Button>
                    <Button size="icon" variant="ghost" className="h-12 w-12 rounded-xl text-gray-400 shrink-0" onClick={() => setShowManualBacktest(false)}>
                      <X className="h-5 w-5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline"
                    className="h-12 px-6 border-blue-100 text-blue-600 hover:bg-blue-50 font-black uppercase text-xs tracking-widest gap-2 rounded-xl w-full xl:w-auto"
                    onClick={() => setShowManualBacktest(true)}>
                    <History className="h-4 w-4" />Manual Backtest
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* ── 단일 기업 검색 모드 ── */
            <SingleCompanyBar
              onSearchModel={(model) => setSingleAnalysisModel(model)}
              onRunAnalysis={handleSingleAnalyze}
              singleTicker={singleTicker}
              onTickerChange={setSingleTicker}
              isLoading={singleLoading}
            />
          )}
        </div>
      </div>

      {/* ── 메인 콘텐츠 (전체 폭 활용) ── */}
      <main className="mx-auto px-6 py-8 max-w-screen-2xl">

        {/* 분석 진행 상태 */}
        {analysisState.isAnalyzing && (
          <div className="mb-6 p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm text-gray-900">
                        {analysisState.conditions?.universeType === 'sp500' ? (
                          'S&P 500 지수 전략 매칭 스캔 중'
                        ) : analysisState.conditions?.universeType === 'russell1000' ? (
                          'Russell 1000 전체 전략 매칭 스캔 중'
                        ) : (
                          'Russell 1000 (S&P 500 제외) 전략 매칭 스캔 중'
                        )}
                      </p>
                      {universeStats && (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] py-0 px-2 font-bold">
                            UNIVERSE: {analysisState.conditions?.universeType === 'sp500' ? (
                              `S&P 500 (${universeStats.finalCount})`
                            ) : analysisState.conditions?.universeType === 'russell1000' ? (
                              `R1000 (${universeStats.finalCount})`
                            ) : (
                              `R1000(${universeStats.russellCount}) - Overlap(${universeStats.overlapCount}) = ${universeStats.finalCount}`
                            )}
                          </Badge>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={`${analysisState.excludedStockCount > 0 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-gray-50 text-gray-500 border-gray-200'} text-[10px] py-0 px-2 font-bold cursor-help`}>
                                  EXCLUDED: {analysisState.excludedStockCount}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-[300px] p-0 overflow-hidden border-red-100">
                                <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                                  <p className="text-[11px] font-bold text-red-800">분석 제외 종목 리스트</p>
                                </div>
                                <div className="max-h-[200px] overflow-y-auto p-2 bg-white">
                                  {analysisState.excludedDetails.length > 0 ? (
                                    analysisState.excludedDetails.map((item, idx) => (
                                      <div key={idx} className="flex justify-between gap-4 py-1 border-b border-gray-50 last:border-0">
                                        <span className="text-[10px] font-bold text-gray-900">{item.ticker}</span>
                                        <span className="text-[10px] text-gray-500">{item.reason}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-[10px] text-gray-400 p-2 text-center">제외된 종목이 없습니다.</p>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                        </div>
                      )}


                    </div>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      {analysisState.progressMessage || '초기화 중...'}
                    </p>
                  </div>

                  <span className="text-2xl font-black text-blue-600 tabular-nums">{analysisState.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden relative">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${analysisState.progress}%` }}
                  />
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="ml-4 h-10 px-4 font-black uppercase text-[10px] tracking-widest rounded-xl shadow-lg shadow-rose-500/10"
                onClick={handleStopAnalysis}
              >
                STOP
              </Button>
            </div>
          </div>
        )}


        {/* 에러 */}
        {analysisState.error && !analysisState.isAnalyzing && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {analysisState.error}
          </div>
        )}

        {universeStats && !analysisState.isAnalyzing && (
          <div className="mb-6 flex flex-col items-center gap-2">
            <Badge variant="outline" className="bg-white/50 text-gray-500 border-gray-200 text-xs py-1.5 px-4 font-bold shadow-sm">
              분석 유니버스: {analysisState.conditions?.universeType === 'sp500' ? (
                `S&P 500 지수 (${universeStats?.finalCount}개 기업)`
              ) : analysisState.conditions?.universeType === 'russell1000' ? (
                `Russell 1000 지수 (${universeStats?.finalCount}개 기업)`
              ) : (
                `Russell 1000 (${universeStats?.russellCount}) - S&P 500 제외 = ${universeStats?.finalCount}개 기업`
              )}
            </Badge>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-[10px] text-gray-400 font-medium cursor-help hover:text-gray-600 transition-colors">
                    * (API 조회불가 / 신규 상장주 / 거래정지 및 데이터 오염) 종목 <span className={`${analysisState.excludedStockCount > 0 ? 'text-red-500' : 'text-gray-500'} font-bold`}>{analysisState.excludedStockCount}개</span> 제외 완료 (마우스를 올려 상세 확인)
                  </p>
                </TooltipTrigger>
                <TooltipContent className="max-w-[300px] p-0 overflow-hidden border-red-100">
                  <div className="bg-red-50 px-3 py-2 border-b border-red-100">
                    <p className="text-[11px] font-bold text-red-800">분석 제외 종목 상세</p>
                  </div>
                  <div className="max-h-[250px] overflow-y-auto p-2 bg-white">
                    {analysisState.excludedDetails.length > 0 ? (
                      analysisState.excludedDetails.map((item, idx) => (
                        <div key={idx} className="flex justify-between gap-4 py-1.5 border-b border-gray-50 last:border-0">
                          <span className="text-[10px] font-bold text-gray-900">{item.ticker}</span>
                          <span className="text-[10px] text-gray-500">{item.reason}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-[10px] text-gray-400 p-2 text-center">제외된 종목이 없습니다.</p>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

          </div>
        )}




        {/* 분석 결과 */}
        <AnalysisOutput
          results={analysisState.results}
          conditions={analysisState.conditions}
          isLoading={analysisState.isAnalyzing}
          onSendEmail={handleSendEmail}
        />

        {/* 상세 리포트 토글 버튼 - 분석 결과가 있을 때만 표시 */}
        {!analysisState.isAnalyzing && analysisState.results.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowDetailReport(!showDetailReport)}
                className="h-10 px-8 border-gray-200 text-gray-600 hover:bg-white hover:text-blue-600 font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl shadow-sm"
              >
                <Search className="h-3.5 w-3.5" />
                {showDetailReport ? '상세 리포트 닫기' : '전수 조사 성공/제외 현황 상세 보기'}
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", showDetailReport ? "rotate-90" : "animate-bounce-x")} />
              </Button>
            </div>

            {showDetailReport && (
              <div className="animate-in slide-in-from-top-3 duration-500">
                <AnalysisReport 
                  candidates={analysisState.results} 
                  excludedDetails={analysisState.excludedDetails} 
                  totalUniverse={universeStats?.finalCount || 0}
                />
              </div>
            )}
          </div>
        )}

        {/* 뉴스 섹션 */}
        {analysisState.results.length > 0 && (
          <div className="mt-8">
            <NewsSection
              summaries={newsState.summaries}
              isLoading={newsState.isLoading}
            />
          </div>
        )}
      </main>

      {/* 업그레이드 모달 */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="text-xl text-center">플랜 업그레이드 필요</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-gray-600">
                기업 분석 가능 횟수를 초과했거나 더 높은 권한이 필요합니다.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>닫기</Button>
                <Button onClick={() => router.push('/pricing')}>플랜 보기</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <BacktestDialog
        ticker={backtestTicker || ''}
        isOpen={!!backtestTicker}
        onClose={() => setBacktestTicker(null)}
      />
    </div>
  );
}
