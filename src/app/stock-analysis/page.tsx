'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles, User, MessageSquare, Lock } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { DataControl } from '@/components/stock-analysis/data-control';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { NewsSection } from '@/components/stock-analysis/news-section';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  UploadedFile,
  CloudSyncStatus,
  InvestmentConditions,
  AnalysisResult,
  NewsSummary
} from '@/types/stock-analysis';

export default function StockAnalysisPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [, setSyncStatus] = useState<CloudSyncStatus>({ status: 'idle' });
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

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/stock-analysis');
    }
  }, [status, router]);

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

  const handleFilesChange = (newFiles: UploadedFile[]) => {
    setFiles(newFiles);
  };

  const handleSyncStatusChange = (status: CloudSyncStatus) => {
    setSyncStatus(status);
  };

  const handleLearningComplete = () => {
    setIsLearned(true);
  };

  const handleSendEmail = async (email: string) => {
    const confirmed = window.confirm('이메일 발송 시 API 비용이 발생할 수 있습니다. 계속하시겠습니까?');
    if (!confirmed) return;

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
    const confirmed = window.confirm('기업 분석을 위해 실시간 데이터를 조회하며 API 비용이 발생할 수 있습니다. 계속하시겠습니까?');
    if (!confirmed) return;

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

  const hasCompletedFiles = files.filter(f => f.status === 'completed').length > 0;
  const canAnalyze = hasCompletedFiles || isLearned;

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex justify-end gap-2 mb-4">
          {session ? (
            <div className="flex items-center gap-3">
              {(session.user as any)?.role === 'ADMIN' && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => router.push('/admin/dashboard')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Lock className="mr-2 h-4 w-4" />
                  관리자 대시보드
                </Button>
              )}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 border">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={session.user?.image || ""} />
                  <AvatarFallback className="text-[10px]">
                    {session.user?.name?.[0] || session.user?.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-xs font-medium">
                    {session.user?.name || session.user?.email}
                  </span>
                  {session.user?.email && (
                    <span className="text-[10px] text-muted-foreground leading-none">
                      {session.user.email}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/inquiry'}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                1:1 문의
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/stock-analysis' })}
              >
                로그아웃
              </Button>
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

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            AI 기반 시장 유니버스 분석 시스템
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            주식 선생님
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Google Drive 자료를 학습하여 S&P 500, Russell 1000 기업 중 최적의 투자 대상을 찾아드립니다
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <DataControl
              onFilesChange={handleFilesChange}
              onSyncStatusChange={handleSyncStatusChange}
              onLearningComplete={handleLearningComplete}
            />

            <InvestmentInput
              onAnalyze={handleAnalyze}
              disabled={!canAnalyze || analysisState.isAnalyzing}
            />

            {(hasCompletedFiles || isLearned) && (
              <div className={`p-4 rounded-lg border ${isLearned ? 'bg-green-50 border-green-200' : 'bg-primary/5 border-primary/20'}`}>
                <div className="flex items-center gap-3">
                  <Brain className={`h-5 w-5 ${isLearned ? 'text-green-600' : 'text-primary'}`} />
                  <div>
                    <p className="text-sm font-medium">
                      {isLearned ? 'AI 전략 학습 완료' : '학습된 자료'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isLearned
                        ? '시장 유니버스에서 유망 기업을 선별하기 위한 전략 학습이 완료되었습니다.'
                        : `${files.filter(f => f.status === 'completed').length}개의 파일이 동기화되었습니다. 학습 시작 버튼을 클릭하세요.`
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            {queriedTickers.length > 0 && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <label className="text-sm font-medium mb-2 block">
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
                <p className="text-xs text-muted-foreground mt-2">
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
      </div>
    </div>
  );
}
