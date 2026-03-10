'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, User, MessageSquare, Lock } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { NewsSection } from '@/components/stock-analysis/news-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  InvestmentConditions,
  AnalysisResult,
  NewsSummary
} from '@/types/stock-analysis';
import { UserMenu } from '@/components/shared/user-menu';

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
  }>({
    conditions: null,
    results: [],
    isAnalyzing: false,
    error: null,
    progress: 0,
    progressMessage: ''
  });
  const [newsState, setNewsState] = useState<{
    summaries: NewsSummary[];
    isLoading: boolean;
  }>({
    summaries: [],
    isLoading: false,
  });
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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
    if (session?.user) fetchUserPlan();
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
              progressMessage: data.progressMessage || '분석 중...'
            }));
            if (!interval) interval = setInterval(pollStatus, 1500);
          } else if (data.status === 'completed' && data.result) {
            if (interval) { clearInterval(interval); interval = null; }
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

    if (session?.user) pollStatus();
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

  const processAnalysisData = (data: any) => {
    if (data.topPicks && Array.isArray(data.topPicks) && data.topPicks.length > 0) {
      const results: AnalysisResult[] = data.topPicks.map((pick: any) => ({
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
      }));

      setAnalysisState(prev => ({ ...prev, results, isAnalyzing: false }));

      const tickers = results.map(r => r.ticker).filter(Boolean) as string[];
      if (tickers.length > 0) fetchNewsForTickers(tickers);

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
    companyAiModel?: string; companyApiKey?: string;
    newsAiModel?: string; newsApiKey?: string; companyCount?: number;
  }) => {
    analysisAlerted.current = false;
    setAnalysisState(prev => ({
      ...prev, conditions: newConditions, isAnalyzing: true, error: null, results: [],
    }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: 'moderate',
          conditions: {
            periodMonths: newConditions.periodMonths || 12,
            companyCount: newConditions.companyCount || 5,
            companyAiModel: newConditions.companyAiModel,
            companyApiKey: newConditions.companyApiKey,
            newsAiModel: newConditions.newsAiModel,
            newsApiKey: newConditions.newsApiKey,
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
    } catch (error) {
      console.error('Analysis error:', error);
      const message = error instanceof Error ? error.message : '분석 실패';
      setAnalysisState(prev => ({ ...prev, results: [], isAnalyzing: false, error: message }));
    }
  };

  // ── 로딩/미인증 상태 ──
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

      {/* ── 스티키 헤더 (로고 + 스캔 컨트롤 + 우측 메뉴) ── */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="mx-auto px-6 max-w-screen-2xl">
          <div className="flex items-center gap-4 h-16">
            {/* 로고 */}
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 text-gray-900 hover:text-blue-600 transition-colors shrink-0"
            >
              <Sparkles className="h-5 w-5 text-blue-600" />
              <span className="font-black tracking-tighter text-lg hidden sm:inline">
                ORLANDO <span className="text-blue-600">ANALYSIS</span>
              </span>
            </button>

            <div className="h-6 w-px bg-gray-200 hidden sm:block" />

            {/* 스캔 컨트롤 — 나머지 공간 전체 */}
            <div className="flex-1 min-w-0">
              <InvestmentInput
                onAnalyze={handleAnalyze}
                disabled={analysisState.isAnalyzing}
              />
            </div>

            {/* 우측 액션 버튼 */}
            <div className="flex items-center gap-2 shrink-0">
              {session && !isAdmin && (
                <Button
                  variant="ghost" size="sm"
                  onClick={() => router.push('/pricing')}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-bold text-xs hidden md:flex"
                >
                  플랜 업그레이드
                </Button>
              )}
              <Button
                variant="outline" size="sm"
                onClick={() => router.push('/inquiry')}
                className="font-bold text-xs gap-1.5 hidden sm:flex"
              >
                <MessageSquare className="h-3.5 w-3.5" /> 문의
              </Button>
              {session ? (
                <UserMenu />
              ) : (
                <Button
                  variant="outline" size="sm"
                  onClick={() => window.location.href = '/login'}
                  className="font-bold text-xs gap-1.5"
                >
                  <User className="h-3.5 w-3.5" /> 로그인
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── 메인 콘텐츠 (전체 폭 활용) ── */}
      <main className="mx-auto px-6 py-8 max-w-screen-2xl">

        {/* 분석 진행 상태 */}
        {analysisState.isAnalyzing && (
          <div className="mb-6 p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-black text-sm text-gray-900">AI 분석 진행 중</p>
                  <span className="text-sm font-black text-blue-600">{analysisState.progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${analysisState.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5 font-medium">
                  {analysisState.progressMessage || '초기화 중...'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 에러 */}
        {analysisState.error && !analysisState.isAnalyzing && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
            {analysisState.error}
          </div>
        )}

        {/* 분석 결과 */}
        <AnalysisOutput
          results={analysisState.results}
          conditions={analysisState.conditions}
          isLoading={analysisState.isAnalyzing}
          onSendEmail={handleSendEmail}
        />

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
    </div>
  );
}
