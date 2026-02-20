'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, User, MessageSquare, Lock } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
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
  }>({
    conditions: null,
    results: [],
    isAnalyzing: false,
    error: null,
  });
  const [newsState, setNewsState] = useState<{
    summaries: NewsSummary[];
    isLoading: boolean;
  }>({
    summaries: [],
    isLoading: false,
  });
  const [isLearned, setIsLearned] = useState(false);
  const [queriedTickers, setQueriedTickers] = useState<string[]>([]);
  const [userPlan, setUserPlan] = useState<string>('FREE');
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

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

    if (session?.user) {
      fetchUserPlan();
    }
  }, [session]);

  useEffect(() => {
    const checkKnowledge = async () => {
      try {
        const response = await fetch('/api/gdrive/learn');
        const data = await response.json();
        if (data.exists) {
          setIsLearned(true);
        }
      } catch (error) {
        console.error('Failed to check existing knowledge:', error);
      }
    };
    checkKnowledge();
  }, []);

  const handleSendEmail = async (email: string) => {
    const response = await fetch('/api/email/send-analysis', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Confirmed': 'true'
      },
      body: JSON.stringify({
        email,
        results: analysisState.results,
        conditions: analysisState.conditions,
      }),
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
        headers: {
          'Content-Type': 'application/json',
          'X-Confirmed': 'true'
        },
        body: JSON.stringify({ tickers }),
      });

      if (!response.ok) {
        throw new Error('뉴스 조회 실패');
      }

      const data = await response.json();
      setNewsState({
        summaries: data.results || [],
        isLoading: false,
      });
    } catch (error) {
      console.error('News fetch error:', error);
      setNewsState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAnalyze = async (newConditions: InvestmentConditions & { companyAiModel?: string; companyApiKey?: string; newsAiModel?: string; newsApiKey?: string; companyCount?: number }) => {
    console.log('Starting analysis with:', newConditions);
    setAnalysisState(prev => ({
      ...prev,
      conditions: newConditions,
      isAnalyzing: true,
      error: null,
    }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: 'moderate',
          conditions: {
            periodMonths: newConditions.periodMonths,
            companyCount: newConditions.companyCount || 5,
            companyAiModel: newConditions.companyAiModel,
            companyApiKey: newConditions.companyApiKey,
            newsAiModel: newConditions.newsAiModel,
            newsApiKey: newConditions.newsApiKey,
          },
        }),
      });

      const data = await response.json();
      console.log('API Response data:', data);

      if (!response.ok) {
        if (response.status === 403) {
          setShowUpgradeModal(true);
          setAnalysisState(prev => ({ ...prev, isAnalyzing: false }));
          return;
        }
        throw new Error(data.error || '분석 실패');
      }

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
        }));

        setAnalysisState(prev => ({
          ...prev,
          results,
          isAnalyzing: false,
        }));

        const tickers = results.map(r => r.ticker).filter(Boolean) as string[];
        if (tickers.length > 0) {
          fetchNewsForTickers(tickers);
        }

        if (data.queriedTickers && Array.isArray(data.queriedTickers)) {
          setQueriedTickers(data.queriedTickers);
        }
      } else {
        setAnalysisState(prev => ({
          ...prev,
          results: [],
          isAnalyzing: false,
          error: data.summary || '추천 대상 기업을 찾지 못했습니다. 잠시 후 다시 시도하거나 학습 데이터를 확인해주세요.',
        }));
      }
    } catch (error) {
      console.error('Analysis error:', error);
      const message = error instanceof Error ? error.message : '분석 실패';
      setAnalysisState(prev => ({
        ...prev,
        results: [],
        isAnalyzing: false,
        error: message,
      }));
    }
  };


  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
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
            <p className="text-center text-muted-foreground">
              주식 분석 기능을 이용하려면 로그인이 필요합니다.
            </p>
            <Button
              className="w-full"
              onClick={() => router.push('/login?callbackUrl=/stock-analysis')}
            >
              로그인하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-[#05070a] text-gray-100 relative overflow-hidden">
      {/* Background Digital Grid Effect */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-emerald-500/5" />

      <div className="container mx-auto px-4 py-8 max-w-7xl relative z-10">
        <div className="flex justify-end gap-3 mb-12">
          {session ? (
            <div className="flex items-center gap-3">
              {!isAdmin && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/pricing')}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  플랜 업그레이드
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/inquiry')}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                1:1 문의
              </Button>
              <UserMenu />
            </div>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/login'}
              >
                <User className="mr-2 h-4 w-4" />
                로그인 / 회원가입
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/inquiry'}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                1:1 문의
              </Button>
            </>
          )}
        </div>

        <div className="text-center mb-16 relative">
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-blue-500/10 text-blue-400 text-xs font-black uppercase tracking-[0.3em] border border-blue-500/20 mb-8 animate-pulse">
            <Sparkles className="h-4 w-4" />
            AI Market Intelligence System
          </div>
          <h1 className="text-6xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-200">
            ORLANDO <span className="text-blue-500">ANALYSIS</span>
          </h1>
          <p className="text-gray-200 max-w-2xl mx-auto font-bold tracking-tight text-lg">
            Google Drive 기반의 독자적인 AI 학습 모델을 통해 S&P 500, Russell 1000 기업 중<br />
            실시간 재무 지표를 기반으로 최적의 투자 Alpha를 발굴합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <InvestmentInput
              onAnalyze={handleAnalyze}
              disabled={analysisState.isAnalyzing}
            />
          </div>

          <div className="lg:col-span-8 space-y-6">
            {analysisState.isAnalyzing && (
              <Card className="bg-card/50 border-dashed">
                <CardContent className="py-20">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">시장 유니버스 분석 중...</h3>
                    <p className="text-gray-200 font-bold whitespace-pre-line text-lg leading-relaxed">
                      {isLearned
                        ? '학습된 투자 규칙을 바탕으로 S&P 500, Russell 1000, Dow Jones 기업들을 비교 분석하고 있습니다.\n각 기업의 재무 상태와 시장 지표를 추출하는 중입니다.'
                        : 'Google Drive 자료에서 투자 인사이트를 도출하고 시장 데이터를 수집하고 있습니다.\n잠시만 기다려 주세요.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {queriedTickers.length > 0 && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <label className="text-sm font-bold mb-2 block text-white">
                  조회된 기업 목록 ({queriedTickers.length}개)
                </label>
                <select
                  className="w-full p-2 text-sm border rounded-md bg-background"
                  onChange={(e) => {
                    if (e.target.value) {
                      window.open(`https://finance.yahoo.com/quote/${e.target.value}`, '_blank');
                    }
                  }}
                >
                  <option value="">티커 선택...</option>
                  {queriedTickers.map((ticker) => (
                    <option key={ticker} value={ticker}>
                      {ticker}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-300 font-medium mt-2">
                  분석 대상이 된 전체 기업 티커 목록입니다.
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            {analysisState.error && !analysisState.isAnalyzing && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {analysisState.error}
              </div>
            )}

            <AnalysisOutput
              results={analysisState.results}
              conditions={analysisState.conditions}
              isLoading={analysisState.isAnalyzing}
              onSendEmail={handleSendEmail}
            />

            {analysisState.results.length > 0 && (
              <NewsSection
                summaries={newsState.summaries}
                isLoading={newsState.isLoading}
              />
            )}
          </div>
        </div>

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
                  <Button variant="outline" onClick={() => setShowUpgradeModal(false)}>
                    닫기
                  </Button>
                  <Button onClick={() => router.push('/pricing')}>
                    플랜 보기
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
