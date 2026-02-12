'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { DataControl } from '@/components/stock-analysis/data-control';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { 
  UploadedFile, 
  CloudSyncStatus, 
  InvestmentConditions, 
  AnalysisResult 
} from '@/types/stock-analysis';

export default function StockAnalysisPage() {
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
  const [isLearned, setIsLearned] = useState(false);

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

  const handleAnalyze = async (newConditions: InvestmentConditions) => {
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
          conditions: { periodMonths: newConditions.periodMonths },
          style: 'moderate',
        }),
      });

      const data = await response.json();
      console.log('API Response data:', data);

      if (!response.ok) {
        throw new Error(data.error || '분석 실패');
      }

      if (data.topPicks && Array.isArray(data.topPicks)) {
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
      } else {
        setAnalysisState(prev => ({
          ...prev,
          results: [],
          isAnalyzing: false,
          error: data.summary || '조건에 맞는 기업을 찾지 못했습니다.',
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
