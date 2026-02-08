'use client';

import React, { useState } from 'react';
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
  const [conditions, setConditions] = useState<InvestmentConditions | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLearned, setIsLearned] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

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
    setConditions(newConditions);
    setIsAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditions: newConditions,
          style: 'moderate',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '분석 실패');
      }

      if (data.topPick) {
        const pick = data.topPick;
        const result: AnalysisResult = {
          companyName: pick.company.companyName,
          ticker: pick.yahooData?.ticker,
          market: pick.company.market,
          expectedReturnRate: pick.expectedReturnRate,
          confidenceScore: Math.round(pick.confidenceScore * 100),
          reasoning: data.summary + (pick.company.investmentThesis ? `\n\n${pick.company.investmentThesis}` : ''),
          sources: pick.company.sources || [],
          riskLevel: pick.riskLevel,
          currentPrice: pick.yahooData?.currentPrice,
          targetPrice: pick.company.targetPrice,
          currency: pick.yahooData?.currency,
        };
        setAnalysisResult(result);
      } else {
        setAnalysisResult(null);
        setAnalysisError(data.summary || '조건에 맞는 기업을 찾지 못했습니다.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '분석 실패';
      setAnalysisError(message);
      setAnalysisResult(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const hasCompletedFiles = files.filter(f => f.status === 'completed').length > 0;
  const canAnalyze = hasCompletedFiles || isLearned;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="h-4 w-4" />
            AI 기반 주식 투자 분석 시스템
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            주식 선생님
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            업로드한 자료를 학습한 AI가 투자 조건에 맞는 최적의 기업을 추천해드립니다
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <DataControl 
              onFilesChange={handleFilesChange}
              onSyncStatusChange={handleSyncStatusChange}
              onLearningComplete={handleLearningComplete}
            />
            
            <InvestmentInput 
              onAnalyze={handleAnalyze}
              disabled={!canAnalyze}
            />
          </div>

          <div className="space-y-4">
            <AnalysisOutput 
              result={analysisResult}
              conditions={conditions}
              isLoading={isAnalyzing}
            />
            {analysisError && !isAnalyzing && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {analysisError}
              </div>
            )}
          </div>
        </div>

        {(hasCompletedFiles || isLearned) && (
          <div className={`mt-8 p-4 rounded-lg border ${isLearned ? 'bg-green-50 border-green-200' : 'bg-primary/5 border-primary/20'}`}>
            <div className="flex items-center gap-3">
              <Brain className={`h-5 w-5 ${isLearned ? 'text-green-600' : 'text-primary'}`} />
              <div>
                <p className="text-sm font-medium">
                  {isLearned ? 'AI 학습 완료' : '학습된 자료'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isLearned 
                    ? 'Google Drive 자료를 기반으로 학습이 완료되었습니다. 투자 조건을 입력하고 분석하기를 클릭하세요.'
                    : `${files.filter(f => f.status === 'completed').length}개의 파일이 동기화되었습니다. 학습 시작 버튼을 클릭하세요.`
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
