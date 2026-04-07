'use client';

import React, { useState, useEffect, useCallback } from 'react';

import { DataControl } from '@/components/stock-analysis/data-control';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { AnalysisReport } from '@/components/stock-analysis/analysis-report';
import {
  Phase1Panel, Phase2Panel, Phase3Panel
} from '@/components/stock-analysis/pipeline-phases';
import { Badge } from '@/components/ui/badge';
import {
  Brain, Sparkles, AlertCircle, CheckCircle2, BookOpen,
  ChevronRight, BarChart3, ArrowRight, ChevronDown, ChevronUp
} from 'lucide-react';
import { AnalysisState, InvestmentConditions } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';


/** Phase Header Step */
function PipelineStep({
  num, label, color, isActive, isCompleted, isLast, onClick
}: {
  num: number; label: string; color: string; isActive: boolean; isCompleted: boolean; isLast?: boolean; onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    amber: 'bg-amber-500 ring-amber-500/30 text-white',
    indigo: 'bg-indigo-500 ring-indigo-500/30 text-white',
    teal: 'bg-teal-500 ring-teal-500/30 text-white',
    blue: 'bg-blue-500 ring-blue-500/30 text-white',
  };
  const inactiveClass = 'bg-white/10 text-white/30';
  const activeClass = colorMap[color] || inactiveClass;

  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={onClick}
        disabled={!isCompleted && !isActive}
        className={cn(
          "flex items-center gap-2 transition-all transition-all outline-none",
          (!isCompleted && !isActive) ? "cursor-not-allowed opacity-50" : "hover:scale-105 active:scale-95"
        )}
      >
        <div className={cn(
          'w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black transition-all',
          isCompleted ? 'bg-emerald-500 text-white' : isActive ? `${activeClass} ring-2` : inactiveClass
        )}>
          {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : num}
        </div>
        <span className={cn(
          'text-xs font-black uppercase tracking-widest hidden sm:block',
          isActive || isCompleted ? 'text-white' : 'text-white/30'
        )}>
          {label}
        </span>
      </button>
      {!isLast && <ArrowRight className="h-3 w-3 text-white/20 shrink-0" />}
    </div>
  );
}



export default function ExpertAnalysisPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    progressMessage: '',
    results: null,
    error: null,
    excludedStockCount: 0,
    excludedDetails: [],
    conditions: null,
    processedCount: 0
  });

  const [activeKnowledge, setActiveKnowledge] = useState<{
    title: string;
    filesAnalyzed?: number;
    rulesLearned?: number;
    content?: any;
    learnedAt?: string;
  } | null>(null);

  const [universeStats, setUniverseStats] = useState<{
    russellCount: number; sp500Count: number; overlapCount: number; finalCount: number;
  } | null>(null);

  const [macroContext, setMacroContext] = useState<any>(null);
  const [showReport, setShowReport] = useState(false);
  const [activePhase, setActivePhase] = useState<number>(4);

  // ─── Fetch initial data ───────────────────────────────────────────
  useEffect(() => {
    fetchActiveKnowledge();
    checkInitialStatus();
  }, []);

  const fetchActiveKnowledge = async () => {
    try {
      const res = await fetch('/api/gdrive/learn');
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setActiveKnowledge({
            title: data.title || '기본 AI 투자 로직',
            filesAnalyzed: data.filesAnalyzed,
            rulesLearned: data.rulesLearned,
            content: data.content,
            learnedAt: data.learnedAt
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch active knowledge:', error);
    }
  };

  const checkInitialStatus = async () => {
    try {
      const res = await fetch('/api/analysis');
      if (!res.ok) return;
      const data = await res.json();

        if (data.status === 'completed' && data.result) {
          setAnalysisState({
            isAnalyzing: false,
            progress: 100,
            progressMessage: '분석 완료',
            results: data.result,
            error: null,
            conditions: data.result.investmentConditions || data.conditions || null,
            processedCount: (data.result.trackA?.length || 0) + (data.result.trackB?.length || 0),
            excludedStockCount: data.excludedStockCount || data.result.excludedStockCount || 0,
            excludedDetails: data.excludedDetails || data.result.excludedDetails || []
          });
          const macro = data.result.macroContext || data.macroContext;
          if (macro) setMacroContext(macro);
          const uCounts = data.universeCounts || data.result.universeCounts;
          if (uCounts) setUniverseStats({
            russellCount: uCounts.russellCount,
            sp500Count: uCounts.sp500Count,
            overlapCount: uCounts.overlapCount,
            finalCount: uCounts.finalCount
          });
        } else if (data.status === 'processing') {
          startPolling();
        }
      } catch (error) {
        console.error('Failed to check initial status:', error);
      }
    };
  
    const startPolling = useCallback(() => {
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch('/api/analysis');
          if (!res.ok) { clearInterval(pollInterval); return; }
          const data = await res.json();
  
          if (data.status === 'processing') {
            setAnalysisState(prev => ({
              ...prev,
              isAnalyzing: true,
              progress: data.progress || 0,
              progressMessage: data.progressMessage || '분석 중...',
              processedCount: data.processedCount || prev.processedCount,
              excludedStockCount: data.excludedStockCount || prev.excludedStockCount,
              excludedDetails: data.excludedDetails || prev.excludedDetails,
              conditions: data.conditions || prev.conditions
            }));
            if (data.universeCounts) setUniverseStats({
              russellCount: data.universeCounts.russellCount,
              sp500Count: data.universeCounts.sp500Count,
              overlapCount: data.universeCounts.overlapCount,
              finalCount: data.universeCounts.finalCount
            });
            if (data.macroContext) setMacroContext(data.macroContext);
          } else if (data.status === 'completed') {
            clearInterval(pollInterval);
            const macro = data.result?.macroContext || data.macroContext;
            setAnalysisState(prev => ({
              ...prev,
              isAnalyzing: false,
              progress: 100,
              results: data.result,
              conditions: data.result?.investmentConditions || data.conditions || prev.conditions,
              processedCount: data.processedCount || (data.result ? (data.result.trackA?.length || 0) + (data.result.trackB?.length || 0) : prev.processedCount),
              excludedStockCount: data.excludedStockCount || data.result?.excludedStockCount || prev.excludedStockCount,
              excludedDetails: data.excludedDetails || data.result?.excludedDetails || prev.excludedDetails
            }));
            if (macro) setMacroContext(macro);
          } else if (data.status === 'error') {
            clearInterval(pollInterval);
            setAnalysisState(prev => ({ ...prev, isAnalyzing: false, error: data.error }));
          } else if (data.status === 'idle') {
            clearInterval(pollInterval);
          }
        } catch { /* ignore */ }
      }, 1500);
      return pollInterval;
    }, []);

  const handleStopAnalysis = async () => {
    try {
      await fetch('/api/analysis', { method: 'DELETE' });
      setAnalysisState(prev => ({
        ...prev, isAnalyzing: false, progressMessage: '분석이 중단되었습니다.'
      }));
    } catch (error) { console.error('Failed to stop analysis:', error); }
  };

  const handleAnalyze = async (conditions: InvestmentConditions) => {
    setAnalysisState({
      isAnalyzing: true, progress: 0, progressMessage: '분석 준비 중...',
      error: null, results: null, conditions,
      processedCount: 0, excludedStockCount: 0, excludedDetails: []
    });
    setUniverseStats(null);
    setMacroContext(null);
    setActivePhase(4); // 분석 시작 시 4단계로 이동

    try {
      const response = await fetch('/api/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conditions),
      });
      if (!response.ok) throw new Error('분석 요청에 실패했습니다.');
      startPolling();
    } catch (err) {
      setAnalysisState(prev => ({
        ...prev, isAnalyzing: false,
        error: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.'
      }));
    }
  };

  // ─── Derived state ─────────────────────────────────────────────────
  const knowledge = activeKnowledge?.content;
  const criterias = knowledge?.criteria?.criterias || [];
  const trackA = analysisState.results?.trackA || [];
  const trackB = analysisState.results?.trackB || [];
  const allCandidates = [...trackA, ...trackB];

  const phase1Done = !!activeKnowledge; 
  const phase2Done = criterias.length > 0;
  const phase3Done = !!knowledge?.keyConditionsSummary;
  const phase4Done = allCandidates.length > 0 && !analysisState.isAnalyzing;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0f111a] text-white">
        {/* ── Top Bar ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-30 bg-[#0f111a]/90 backdrop-blur-xl border-b border-white/10">
          {/* Pipeline header */}
          <div className="px-6 pt-4 pb-3 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/20 rounded-2xl">
                <Brain className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <h1 className="text-xl font-black text-white tracking-tight">Alpha Intelligence Engine</h1>
                <p className="text-sm text-white/40 font-bold">원천 데이터 기반 상황 맞춤형 AI 주식 분석</p>
              </div>
            </div>

            {/* Phase Steps as Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <PipelineStep 
                num={1} label="Source Data" color="blue" 
                isActive={activePhase === 1} 
                isCompleted={phase1Done && activePhase !== 1} 
                onClick={() => setActivePhase(1)}
              />
              <PipelineStep 
                num={2} label="Extraction" color="amber" 
                isActive={activePhase === 2} 
                isCompleted={phase2Done && activePhase !== 2} 
                onClick={() => setActivePhase(2)}
              />
              <PipelineStep 
                num={3} label="Synthesis" color="indigo" 
                isActive={activePhase === 3} 
                isCompleted={phase3Done && activePhase !== 3} 
                onClick={() => setActivePhase(3)}
              />
              <PipelineStep 
                num={4} label="Sensing & Analysis" color="teal" 
                isActive={activePhase === 4} 
                isCompleted={phase4Done && activePhase !== 4} 
                isLast 
                onClick={() => setActivePhase(4)}
              />
            </div>
          </div>
        </div>

        {/* ── Main Content: Full Width ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-10 space-y-8 max-w-[1600px] mx-auto">
            {/* Error Banner */}
            {analysisState.error && (
              <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
                <p className="text-base font-bold text-rose-300">{analysisState.error}</p>
              </div>
            )}

            {/* Phase Panels - Tab Content */}
            <div className="animate-in fade-in duration-500">
              {activePhase === 1 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 bg-blue-500/20 rounded-2xl">
                      <BookOpen className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">Source Data Management</h2>
                      <p className="text-sm text-white/40">분석의 근거가 되는 원천 데이터를 업로드하고 AI 학습을 관리합니다</p>
                    </div>
                  </div>
                  <DataControl onLearningComplete={fetchActiveKnowledge} />
                </div>
              )}
              {activePhase === 2 && (
                <Phase1Panel knowledge={knowledge} isLearning={false} learningStatus={null} />
              )}
              {activePhase === 3 && (
                <Phase2Panel knowledge={knowledge} />
              )}
              {activePhase === 4 && (
                <Phase3Panel 
                  macroContext={macroContext}
                  isAnalyzing={analysisState.isAnalyzing}
                  progress={analysisState.progress}
                  progressMessage={analysisState.progressMessage}
                  results={analysisState.results}
                  processedCount={analysisState.processedCount}
                  excludedStockCount={analysisState.excludedStockCount}
                  totalRuleCount={criterias.length}
                  inputControls={
                    <div className="flex items-end gap-3 flex-wrap">
                      <InvestmentInput
                        onAnalyze={handleAnalyze}
                        disabled={analysisState.isAnalyzing}
                        activeKnowledge={activeKnowledge}
                      />
                      {analysisState.isAnalyzing && (
                        <button
                          onClick={handleStopAnalysis}
                          className="h-11 px-5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-900/30"
                        >
                          <AlertCircle className="h-3.5 w-3.5" />
                          STOP
                        </button>
                      )}
                    </div>
                  }
                >
                  {/* Final Results */}
                  {analysisState.results && !analysisState.isAnalyzing && (
                    <div className="space-y-5 pt-2">
                      {/* Completion banner */}
                      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-600/20 to-teal-600/10 border border-emerald-500/30 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-emerald-500/20 rounded-xl">
                            <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-base font-black text-white">전수 조사 완료</p>
                            <p className="text-sm text-emerald-300/70 font-medium">
                              {universeStats?.finalCount || 0}개 스캔 · {allCandidates.length}개 최종 선정
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <div className="px-5 py-3 bg-white/5 rounded-xl text-center border border-white/10">
                            <p className="text-[10px] text-white/40 font-black uppercase">SCANNED</p>
                            <p className="text-xl font-black text-white">{universeStats?.finalCount || 0}</p>
                          </div>
                          <div className="px-5 py-3 bg-white/5 rounded-xl text-center border border-white/10">
                            <p className="text-[10px] text-rose-400 font-black uppercase">EXCLUDED</p>
                            <p className="text-xl font-black text-rose-300">-{analysisState.excludedStockCount}</p>
                          </div>
                          <div className="px-5 py-3 bg-emerald-500/15 rounded-xl text-center border border-emerald-500/20">
                            <p className="text-[10px] text-emerald-400 font-black uppercase">SELECTED</p>
                            <p className="text-xl font-black text-emerald-300">{allCandidates.length}</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowReport(v => !v)}
                        className="flex items-center gap-2 text-sm font-black text-white/40 hover:text-white/70 transition-colors"
                      >
                        <BarChart3 className="h-4 w-4" />
                        {showReport ? '전수 리포트 닫기' : '전수 조사 상세 리포트 보기'}
                        <ChevronRight className={cn('h-4 w-4 transition-transform', showReport && 'rotate-90')} />
                      </button>
                      {showReport && (
                        <div className="animate-in slide-in-from-top-2 duration-300">
                          <AnalysisReport
                            candidates={analysisState.results?.trackA || []}
                            excludedDetails={analysisState.excludedDetails || []}
                            totalUniverse={universeStats?.finalCount || 0}
                          />
                        </div>
                      )}

                      <div className="rounded-2xl bg-[#161b22] border border-white/10 p-6 mt-4">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="p-2 bg-blue-500/20 rounded-xl">
                            <Sparkles className="h-5 w-5 text-blue-400" />
                          </div>
                          <div>
                            <h2 className="text-base font-black text-white">최종 후보 기업</h2>
                            <p className="text-sm text-white/40">기업 카드를 선택하면 AI 심층 분석 리포트를 확인할 수 있습니다</p>
                          </div>
                          <Badge className="ml-auto bg-blue-500/20 text-blue-300 border-blue-500/30 text-sm px-3 py-1">
                            {allCandidates.length} CANDIDATES
                          </Badge>
                        </div>
                        <AnalysisOutput
                          results={analysisState.results}
                          conditions={analysisState.conditions}
                          isLoading={false}
                        />
                      </div>
                    </div>
                  )}
                </Phase3Panel>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
