'use client';

import React, { useState, useEffect } from 'react';
import { AdminSidebar } from '@/components/admin/sidebar';
import { DataControl } from '@/components/stock-analysis/data-control';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { Badge } from '@/components/ui/badge';
import { Brain, Sparkles, Target, Activity, FileText, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnalysisResult, AnalysisState, InvestmentConditions } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export default function ExpertAnalysisPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    progressMessage: '',
    results: null,
    error: null,
    excludedStockCount: 0,
    excludedDetails: [],
    conditions: null
  });

  const [universeStats, setUniverseStats] = useState<{
    russellCount: number;
    overlapCount: number;
    finalCount: number;
  } | null>(null);

  const handleAnalyze = async (conditions: InvestmentConditions) => {
    setAnalysisState(prev => ({
      ...prev,
      isAnalyzing: true,
      progress: 0,
      progressMessage: '분석 준비 중...',
      error: null,
      results: null,
      conditions
    }));

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });

      if (!response.ok) {
        throw new Error('분석 요청에 실패했습니다.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'progress') {
              setAnalysisState((prev: AnalysisState) => ({
                ...prev,
                progress: data.progress,
                progressMessage: data.message
              }));
              if (data.universeStats) {
                setUniverseStats(data.universeStats);
              }
              if (data.excludedCount !== undefined) {
                 setAnalysisState((prev: AnalysisState) => ({
                   ...prev,
                   excludedStockCount: data.excludedCount,
                   excludedDetails: data.excludedDetails || []
                 }));
              }
            } else if (data.type === 'result') {
              setAnalysisState((prev: AnalysisState) => ({
                ...prev,
                isAnalyzing: false,
                progress: 100,
                results: data.result,
              }));
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }
          } catch (e) {
            console.error('Failed to parse chunk:', e);
          }
        }
      }
    } catch (err) {
      setAnalysisState((prev: AnalysisState) => ({
        ...prev,
        isAnalyzing: false,
        error: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      }));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-blue-600 mb-1">
          <Brain className="h-5 w-5" />
          <span className="text-xs font-black uppercase tracking-[0.2em]">Alpha Expert Intelligence</span>
        </div>
        <h1 className="text-4xl font-black text-gray-900 tracking-tight">전문가 통합 투자 분석</h1>
        <p className="text-gray-500 font-medium max-w-2xl">
          원천 데이터에서 추출된 투자 철학과 실시간 시장 지표를 결합하여, 저자의 시각으로 시장을 전수 조사하고 최종 투자 결론을 도출합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Knowledge & Scan Control */}
        <div className="lg:col-span-4 space-y-6">
           <DataControl onLearningComplete={() => console.log('Learning Complete')} />
           
           <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-4">
             <h4 className="text-sm font-bold flex items-center gap-2">
               <Target className="h-4 w-4 text-blue-600" />
               전략 실행 가이드
             </h4>
             <div className="space-y-3">
               <div className="flex items-start gap-3">
                 <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</div>
                 <p className="text-[11px] text-gray-600 leading-relaxed">구글 드라이브의 원천 데이터를 학습하여 **저자의 투자 조건**을 먼저 추출하세요.</p>
               </div>
               <div className="flex items-start gap-3">
                 <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</div>
                 <p className="text-[11px] text-gray-600 leading-relaxed">우측 상단에서 **유니버스 및 시점**을 선택한 후 'Scan Alpha'를 클릭하세요.</p>
               </div>
               <div className="flex items-start gap-3">
                 <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</div>
                 <p className="text-[11px] text-gray-600 leading-relaxed">검색된 **후보 기업** 중 하나를 선택하여 저자의 관점에서 작성된 **심층 분석 보고서**를 확인하세요.</p>
               </div>
             </div>
           </div>
        </div>

        {/* Right: Analysis Engine & Results */}
        <div className="lg:col-span-8 space-y-6">
          <div className="sticky top-0 z-10 bg-[#f8fafc]/80 backdrop-blur-md pt-2 pb-4">
            <InvestmentInput onAnalyze={handleAnalyze} disabled={analysisState.isAnalyzing} />
          </div>

          {analysisState.isAnalyzing && (
            <div className="p-12 rounded-3xl bg-white border border-gray-100 shadow-2xl space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="relative">
                  <div className="h-24 w-24 rounded-full border-4 border-blue-50 animate-pulse" />
                  <Loader2 className="h-12 w-12 text-blue-600 animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">지능형 2단계 스캔 진행 중</h3>
                  <p className="text-sm text-gray-500 font-medium">{analysisState.progressMessage}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-black text-blue-600 uppercase tracking-widest">
                  <span>Analyzing Universe</span>
                  <span>{analysisState.progress}%</span>
                </div>
                <Progress value={analysisState.progress} className="h-2 bg-blue-50" />
              </div>

              {universeStats && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Total Pool</p>
                    <p className="text-xl font-black text-gray-900">{universeStats.russellCount}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[10px] font-black text-gray-400 uppercase mb-1">Excluded</p>
                    <p className="text-xl font-black text-rose-500">-{analysisState.excludedStockCount}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-blue-600 text-white">
                    <p className="text-[10px] font-black text-blue-200 uppercase mb-1">Qualified</p>
                    <p className="text-xl font-black">{universeStats.finalCount}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {analysisState.error && (
            <div className="p-6 rounded-2xl bg-rose-50 border border-rose-100 flex items-center gap-4 text-rose-700">
              <AlertCircle className="h-6 w-6 shrink-0" />
              <p className="text-sm font-bold">{analysisState.error}</p>
            </div>
          )}

          {analysisState.results && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">1단계 스캔 결과: 최적 후보군</h2>
                    <p className="text-sm text-gray-500 font-medium">저자의 공통 투자 원칙에 가장 부합하는 기업 리스트입니다.</p>
                  </div>
                </div>
                <Badge variant="outline" className="h-8 px-4 font-black border-gray-200">
                  FOUND {analysisState.results.candidates.length} CANDIDATES
                </Badge>
              </div>

              <AnalysisOutput 
                results={analysisState.results.candidates as any} 
                conditions={analysisState.conditions}
                isLoading={false}
              />
              
              <div className="p-8 rounded-3xl bg-blue-900 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Sparkles className="h-32 w-32" />
                </div>
                <div className="relative z-10 space-y-4">
                  <h3 className="text-2xl font-black tracking-tight">Next Step: 2단계 심층 리포트 확인</h3>
                  <p className="text-blue-100 font-medium max-w-xl text-sm leading-relaxed">
                    위 기업 카드 중 상세 정보가 필요한 기업을 선택하세요. 
                    AI 전문가 에이전트가 저자의 페르소나를 입고 뉴스, 매크로 상황, 비즈니스 경쟁력을 입체적으로 분석하여 **최종 투자 결론**을 내려줍니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!analysisState.isAnalyzing && !analysisState.results && !analysisState.error && (
            <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 rounded-3xl border-2 border-dashed border-gray-200 opacity-60">
              <div className="p-4 bg-gray-100 rounded-2xl mb-4">
                <CheckCircle2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">분석 대기 중</h3>
              <p className="text-sm text-gray-500 max-w-xs">상단의 조건 설정 후 스캔 버튼을 누르면 2단계 분석 엔진이 가동됩니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
