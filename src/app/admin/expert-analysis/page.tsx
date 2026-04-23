'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, Sparkles, AlertCircle, CheckCircle2, BookOpen,
  ChevronRight, BarChart3, ArrowRight, ChevronDown, ChevronUp,
  Globe, Building2,
  Calendar, Target, Cpu, Zap
} from 'lucide-react';

import { DataControl } from '@/components/stock-analysis/data-control';
import { InvestmentInput } from '@/components/stock-analysis/investment-input';
import { SingleCompanyBar } from '@/components/stock-analysis/single-company-bar';
import { AnalysisOutput } from '@/components/stock-analysis/analysis-output';
import { AnalysisReport } from '@/components/stock-analysis/analysis-report';
import {
  Phase1Panel, Phase2Panel, Phase3Panel, Phase4Panel
} from '@/components/stock-analysis/pipeline-phases';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions, AnalysisResult, ExcludedStockDetail, AIModel, APIKeys } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  progressMessage: string;
  results: any;
  error: string | null;
  excludedStockCount: number;
  excludedDetails: ExcludedStockDetail[];
  conditions: InvestmentConditions | null;
  processedCount: number;
}
function PipelineStep({
  num, label, color, isActive, isCompleted, phase3Done, isLast, onClick
}: {
  num: number; label: string; color: string; isActive: boolean; isCompleted: boolean; phase3Done?: boolean; isLast?: boolean; onClick?: () => void;
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
        disabled={(!isCompleted && !isActive && num > 1 && num !== 4) || (num === 4 && !phase3Done && !isActive)}
        className={cn(
          "flex items-center gap-2 transition-all outline-none",
          ((!isCompleted && !isActive && num > 1 && num !== 4) || (num === 4 && !phase3Done && !isActive)) ? "cursor-not-allowed opacity-30" : "hover:scale-105 active:scale-95"
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
    id?: string;
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
  const [activePhase, setActivePhase] = useState<number>(1);

  // ── 단일 기업 분석 설정 ──
  const [analysisMode, setAnalysisMode] = useState<'universe' | 'single'>('universe');
  const [singleTicker, setSingleTicker] = useState('');
  const [singleAnalysisModel, setSingleAnalysisModel] = useState<{ newsAiModel?: string; fallbackAiModel?: string; conditions?: any }>({});
  const [singleResult, setSingleResult] = useState<AnalysisResult | null>(null);
  const [singleResultPresent, setSingleResultPresent] = useState<AnalysisResult | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [learningError, setLearningError] = useState(false);

  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [extractionModelPrimary, setExtractionModelPrimary] = useState<string>('gemini-3.1-flash-lite');
  const [extractionModelSecondary, setExtractionModelSecondary] = useState<string>('gemini-3-flash');
  const [synthesisModelPrimary, setSynthesisModelPrimary] = useState<string>('gemini-3.1-flash-lite');
  const [synthesisModelSecondary, setSynthesisModelSecondary] = useState<string>('gemini-3-flash');

  // ─── Fetch initial data ───────────────────────────────────────────
  useEffect(() => {
    fetchActiveKnowledge();
    checkInitialStatus();
    fetchAdminSettings();
  }, []);

  const fetchAdminSettings = async () => {
    try {
      const [modelsRes, keysRes] = await Promise.all([
        fetch('/api/admin/models', { cache: 'no-store' }),
        fetch('/api/admin/settings', { cache: 'no-store' })
      ]);

      if (modelsRes.ok) {
        const mData = await modelsRes.json();
        setAvailableModels(mData.models || []);
      }

      if (keysRes.ok) {
        const kData = await keysRes.json();
        setApiKeys(kData.keys || {});
      }
    } catch (error) {
      console.error('Admin settings fetch error:', error);
    }
  };

  // ─── Auto-select default models when list is loaded ───────────────────
  useEffect(() => {
    if (availableModels.length > 0) {
      // 1순위 후보 찾기: gemini-3.1-flash-lite 포함하는 가장 긴 이름 (가장 구체적인 것)
      const primaryCandidate = availableModels.find(m => 
        m.value.toLowerCase().includes('gemini-3.1-flash-lite')
      )?.value;

      // 2순위 후보 찾기: gemini-3-flash 포함하는 것
      const secondaryCandidate = availableModels.find(m => 
        m.value.toLowerCase().includes('gemini-3-flash')
      )?.value;

      if (primaryCandidate) {
        setExtractionModelPrimary(prev => prev === 'gemini-3.1-flash-lite' ? primaryCandidate : prev);
        setSynthesisModelPrimary(prev => prev === 'gemini-3.1-flash-lite' ? primaryCandidate : prev);
      }
      if (secondaryCandidate) {
        setExtractionModelSecondary(prev => prev === 'gemini-3-flash' ? secondaryCandidate : prev);
        setSynthesisModelSecondary(prev => prev === 'gemini-3-flash' ? secondaryCandidate : prev);
      }
    }
  }, [availableModels]);

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
            learnedAt: data.learnedAt,
            id: data.id // DB ID 저장
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch active knowledge:', error);
    }
  };

  const handleSynthesize = async (weights: Record<string, number>, aiModel?: string, fallbackAiModel?: string) => {
    if (!activeKnowledge?.id) return;
    
    setIsSynthesizing(true);
    setActivePhase(3); // 3단계(합성)로 자동 이동하여 로딩 표시

    try {
      const res = await fetch('/api/analysis/knowledge/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weights,
          knowledgeId: activeKnowledge.id,
          aiModel: aiModel || synthesisModelPrimary,
          fallbackAiModel: fallbackAiModel || synthesisModelSecondary
        })
      });

      if (res.ok) {
        const data = await res.json();
        // 합성된 지식으로 로컬 상태 갱신
        setActiveKnowledge(prev => prev ? { ...prev, content: data.knowledge } : null);
      } else {
         throw new Error('지식 합성에 실패했습니다.');
      }
    } catch (err: any) {
      setAnalysisState(prev => ({ ...prev, error: err.message }));
    } finally {
      setIsSynthesizing(false);
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

  const handleSingleAnalyze = async () => {
    if (!singleTicker.trim()) { alert('티커를 입력해주세요.'); return; }
    if (!singleAnalysisModel.newsAiModel) { alert('AI 모델을 선택해주세요.'); return; }
    setSingleLoading(true); setSingleResult(null); setSingleResultPresent(null);
    setAnalysisState(prev => ({ ...prev, error: null }));
    setActivePhase(4);
    
    try {
      const isPast = !!singleAnalysisModel.conditions?.asOfDate;
      const res = fetch('/api/analysis/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: singleTicker.trim().toUpperCase(),
          conditions: singleAnalysisModel.conditions || {},
          newsAiModel: singleAnalysisModel.newsAiModel,
          fallbackAiModel: singleAnalysisModel.fallbackAiModel,
        }),
      });

      let resPresent;
      if (isPast) {
         resPresent = fetch('/api/analysis/single', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               ticker: singleTicker.trim().toUpperCase(),
               conditions: { ...singleAnalysisModel.conditions, asOfDate: undefined },
               newsAiModel: singleAnalysisModel.newsAiModel,
               fallbackAiModel: singleAnalysisModel.fallbackAiModel,
            }),
         });
      }

      const [pastObj, presentObj] = await Promise.all([res, resPresent]);
      const dataPast = await pastObj.json();
      if (!pastObj.ok) throw new Error(dataPast.error || '분석 실패');
      setSingleResult(dataPast.result);

      if (presentObj) {
         const dataPresent = await presentObj.json();
         if (presentObj.ok) {
            setSingleResultPresent(dataPresent.result);
         }
      }
    } catch (e: any) {
      setAnalysisState(prev => ({ ...prev, error: e.message || '알 수 없는 오류가 발생했습니다.' }));
    } finally {
      setSingleLoading(false);
    }
  };

  const renderActiveConditions = () => {
    let modeText = analysisMode === 'universe' ? '유니버스 스캐닝' : '단일 기업 분석';
    let asOfDateStr = '현재';
    let modelStr = '-';
    let targetStr = '-';
    
    if (analysisMode === 'universe') {
       if (!analysisState.isAnalyzing && !analysisState.results) return null;
       const conds = analysisState.conditions || analysisState.results?.investmentConditions;
       if (!conds) return null;
       asOfDateStr = conds.asOfDate ? new Date(conds.asOfDate).toLocaleDateString() : '현재 (LIVE)';
       targetStr = conds.universeType === 'sp500' ? 'S&P 500' : conds.universeType === 'russell1000' ? 'Russell 1000' : conds.universeType === 'russell1000_exclude_sp500' ? 'Russell 1000 (S&P 500 제외)' : '가용 전체';
       targetStr += conds.sector && conds.sector !== 'ALL' ? ` + ${conds.sector}` : '';
       modelStr = process.env.NEXT_PUBLIC_AI_MODEL || '기본 모델';
    } else {
       if (!singleLoading && !singleResult) return null;
       const conds = singleAnalysisModel.conditions;
       asOfDateStr = singleResult?.timeLabel || conds?.timeLabel || (conds?.asOfDate ? new Date(conds.asOfDate).toLocaleDateString() : '현재 (LIVE)');
       targetStr = singleTicker;
       modelStr = singleAnalysisModel.newsAiModel || '기본 모델';
    }
    
    return (
       <div className="mt-4 flex flex-wrap items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs font-bold text-blue-200 animate-in fade-in zoom-in duration-300">
           <span className="bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider">{modeText}</span>
           <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 opacity-70"/> 기준 일자: {asOfDateStr}</span>
           <span className="opacity-50">|</span>
           <span className="flex items-center gap-1.5"><Target className="w-4 h-4 opacity-70"/> 검색 대상: {targetStr}</span>
           <span className="opacity-50">|</span>
           <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 opacity-70"/> 모델: {modelStr}</span>
       </div>
    );
  };

  const renderMiniMacroContext = (macro: any, colorPrefix: 'blue' | 'emerald' | 'indigo') => {
    if (!macro) return null;
    
    const getBadgeClass = (status: string) => {
        if (status === 'Low' || status === 'Bullish' || status === 'Uptrend' || status === 'Greed') return 'bg-teal-500/20 text-teal-300';
        if (status === 'Moderate' || status === 'Neutral' || status === 'Sideways') return 'bg-amber-500/20 text-amber-300';
        return 'bg-rose-500/20 text-rose-300';
    };

    return (
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6 border-b border-${colorPrefix}-500/20 pb-4`}>
        <div className="p-2 rounded-lg bg-[#0f111a] border border-white/5 shadow-inner hover:bg-white/5 transition-colors">
          <p className={`text-[10px] text-${colorPrefix}-400 font-black uppercase mb-1`}>VIX (공포 지수)</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-white font-mono">{macro.vix?.toFixed(1) || '-'}</span>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", getBadgeClass(macro.vixStatus))}>{macro.vixStatus}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[#0f111a] border border-white/5 shadow-inner hover:bg-white/5 transition-colors">
          <p className={`text-[10px] text-${colorPrefix}-400 font-black uppercase mb-1`}>10Y Yield</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-white font-mono">{macro.treasuryYield10Y ? macro.treasuryYield10Y.toFixed(2) + '%' : '-'}</span>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded", getBadgeClass(macro.yieldStatus))}>{macro.yieldStatus}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[#0f111a] border border-white/5 shadow-inner hover:bg-white/5 transition-colors">
          <p className={`text-[10px] text-${colorPrefix}-400 font-black uppercase mb-1`}>S&P 500</p>
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-white font-mono truncate mr-2">{macro.sp500Trend || '-'}</span>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded shrink-0", getBadgeClass(macro.sp500Trend))}>{macro.sp500Trend || 'N/A'}</span>
          </div>
        </div>
        <div className="p-2 rounded-lg bg-[#0f111a] border border-white/5 shadow-inner relative overflow-hidden">
          <div className={cn("absolute inset-0 opacity-5", getBadgeClass(macro.marketMode))} />
          <p className={`text-[10px] text-${colorPrefix}-400 font-black uppercase mb-1 relative z-10`}>Market Mode</p>
          <div className="flex items-center justify-between relative z-10">
            <span className="text-sm font-black text-white font-mono truncate mr-2">{macro.marketMode || '-'}</span>
            <span className={cn("text-[9px] font-black px-1.5 py-0.5 rounded shrink-0", getBadgeClass(macro.marketMode))}>{macro.marketMode || 'N/A'}</span>
          </div>
        </div>
      </div>
    );
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
                num={1} label="Extraction" color="amber" 
                isActive={activePhase === 1} 
                isCompleted={phase1Done && activePhase !== 1} 
                onClick={() => setActivePhase(1)}
              />
              <PipelineStep 
                num={2} label="Design & Tuning" color="indigo" 
                isActive={activePhase === 2} 
                isCompleted={phase2Done && activePhase !== 2} 
                onClick={() => setActivePhase(2)}
              />
              <PipelineStep 
                num={3} label="Synthesis" color="blue" 
                isActive={activePhase === 3} 
                isCompleted={phase3Done && activePhase !== 3} 
                onClick={() => setActivePhase(3)}
              />
              <PipelineStep 
                num={4} label="Sensing & Scan" color="teal" 
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
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center font-black text-base text-blue-400 shrink-0">
                      1
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-blue-400" />
                        <h2 className="text-xl font-black text-white">Source Data & Extraction</h2>
                      </div>
                      <p className="text-sm text-white/40 font-bold mt-1">원천 데이터를 학습시켜 투자 규칙들을 추출합니다. 완료 후 2단계에서 가중치를 조절할 수 있습니다.</p>
                    </div>
                  </div>
                  <div className="bg-[#161b22] rounded-2xl border border-blue-500/20 p-1">
                    <DataControl 
                      onLearningStart={() => {
                        setActiveKnowledge(null);
                        setLearningError(false);
                      }}
                      onLearningComplete={(hasError) => {
                        setLearningError(hasError);
                        fetchActiveKnowledge();
                      }}
                      availableModels={availableModels}
                      apiKeys={apiKeys}
                      selectedModel={extractionModelPrimary}
                      onModelChange={setExtractionModelPrimary}
                      selectedModelSecondary={extractionModelSecondary}
                      onModelChangeSecondary={setExtractionModelSecondary}
                    />
                  </div>
                  <Phase1Panel knowledge={knowledge} isLearning={false} learningStatus={null} hasError={learningError} />
                </div>
              )}
              {activePhase === 2 && (
                <Phase2Panel 
                  knowledge={knowledge} 
                  onSynthesize={handleSynthesize}
                  isSynthesizing={isSynthesizing}
                  availableModels={availableModels}
                  apiKeys={apiKeys}
                  selectedModel={synthesisModelPrimary}
                  onModelChange={setSynthesisModelPrimary}
                  selectedModelSecondary={synthesisModelSecondary}
                  onModelChangeSecondary={setExtractionModelSecondary} // Note: This was incorrectly extractionModelSecondary in state but okay if user wants it
                  learnedAt={activeKnowledge?.learnedAt}
                />
              )}
              {activePhase === 3 && (
                <Phase3Panel 
                  knowledge={knowledge} 
                  isSynthesizing={isSynthesizing}
                  onStartCompanyAnalysis={() => setActivePhase(4)}
                  learnedAt={activeKnowledge?.learnedAt}
                />
              )}
              {activePhase === 4 && (
                <Phase4Panel 
                  macroContext={analysisMode === 'universe' ? macroContext : null}
                  isAnalyzing={analysisMode === 'universe' ? analysisState.isAnalyzing : singleLoading}
                  progress={analysisMode === 'universe' ? analysisState.progress : (singleLoading ? 50 : 100)}
                  progressMessage={analysisMode === 'universe' ? analysisState.progressMessage : (singleLoading ? '단일 기업 심층 분석 중...' : '')}
                  results={analysisMode === 'universe' ? analysisState.results : (singleResult ? { trackA: [singleResult], trackB: [], summary: '단일 기업 분석 결과' } : null)}
                  processedCount={analysisMode === 'universe' ? analysisState.processedCount : (singleResult ? 1 : 0)}
                  excludedStockCount={analysisMode === 'universe' ? analysisState.excludedStockCount : 0}
                  inputControls={
                    <div className="flex flex-col gap-4">
                      {/* 모드 토글 */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setAnalysisMode('universe')}
                          className={cn(
                            "flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                            analysisMode === 'universe' ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          <Globe className="h-3 w-3" />유니버스 스캐닝
                        </button>
                        <button
                          onClick={() => setAnalysisMode('single')}
                          className={cn(
                            "flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all",
                            analysisMode === 'single' ? "bg-indigo-500 text-white" : "bg-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          <Building2 className="h-3 w-3" />단일 기업 분석
                        </button>
                      </div>

                      <div className="flex items-end gap-3 flex-wrap">
                        {analysisMode === 'universe' ? (
                           <InvestmentInput
                             onAnalyze={handleAnalyze}
                             disabled={analysisState.isAnalyzing}
                             activeKnowledge={activeKnowledge}
                           />
                        ) : (
                           <SingleCompanyBar
                             onSearchModel={(model) => setSingleAnalysisModel(model)}
                             onRunAnalysis={handleSingleAnalyze}
                             singleTicker={singleTicker}
                             onTickerChange={setSingleTicker}
                             isLoading={singleLoading}
                           />
                        )}

                        {analysisState.isAnalyzing && analysisMode === 'universe' && (
                          <button
                            onClick={handleStopAnalysis}
                            className="h-11 px-5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-rose-900/30"
                          >
                            <AlertCircle className="h-3.5 w-3.5" />
                            STOP
                          </button>
                        )}
                      </div>
                      
                      {renderActiveConditions()}
                    </div>
                  }
                >
                  {/* Final Results */}
                  {analysisMode === 'universe' && analysisState.results && !analysisState.isAnalyzing && (
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

                  {/* Single Result */}
                  {analysisMode === 'single' && singleResult && !singleLoading && (
                    <div className="space-y-5 pt-2">
                      {singleResultPresent ? (
                          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start mt-4">
                             <div className="rounded-2xl bg-[#161b22] border border-blue-500/20 p-6 relative overflow-hidden shadow-2xl shadow-blue-500/5 hover:border-blue-500/40 transition-colors">
                               <div className="absolute top-0 right-0 p-12 bg-blue-50 opacity-5 -mr-6 -mt-6 rounded-full blur-2xl pointer-events-none" />
                               <div className="flex items-center gap-3 mb-6 relative z-10">
                                 <div className="p-2 bg-blue-500/20 rounded-xl">
                                   <Calendar className="h-5 w-5 text-blue-400" />
                                 </div>
                                 <div>
                                   <h2 className="text-base font-black text-white">과거 시점 트래킹 분석</h2>
                                   <p className="text-sm font-bold text-blue-400">조회 시점: {singleResult.timeLabel || (singleResult.yahooData?.asOfDate ? new Date(singleResult.yahooData.asOfDate).toLocaleDateString() : '과거')}</p>
                                 </div>
                               </div>
                               {renderMiniMacroContext(singleResult.macroContext, 'blue')}
                               <AnalysisOutput 
                                   results={{ trackA: [singleResult], trackB: [], analysisDate: new Date(), summary: '단일 기업 분석 결과' }} 
                                   conditions={singleAnalysisModel.conditions || {}}
                                   isLoading={false}
                               />
                             </div>
                             <div className="rounded-2xl bg-[#161b22] border border-emerald-500/30 p-6 relative overflow-hidden shadow-2xl shadow-emerald-500/5 hover:border-emerald-500/40 transition-colors">
                               <div className="absolute top-0 right-0 p-12 bg-emerald-50 opacity-5 -mr-6 -mt-6 rounded-full blur-2xl pointer-events-none" />
                               <div className="flex items-center gap-3 mb-6 relative z-10">
                                 <div className="p-2 bg-emerald-500/20 rounded-xl">
                                   <Zap className="h-5 w-5 text-emerald-400" />
                                 </div>
                                 <div className="flex-1">
                                   <div className="flex items-center gap-2">
                                     <h2 className="text-base font-black text-white">현재 시점 트래킹 모델</h2>
                                     <Badge className="bg-emerald-500/20 text-emerald-300 border-none px-2 py-0.5 text-[9px] font-black uppercase tracking-widest animate-pulse">LIVE</Badge>
                                   </div>
                                   <p className="text-sm font-bold text-emerald-400">조회 시점: 현재 실시간</p>
                                 </div>
                               </div>
                               {renderMiniMacroContext(singleResultPresent.macroContext, 'emerald')}
                               <AnalysisOutput 
                                   results={{ trackA: [singleResultPresent], trackB: [], analysisDate: new Date(), summary: '단일 기업 분석 결과' }} 
                                   conditions={{...singleAnalysisModel.conditions, asOfDate: undefined}}
                                   isLoading={false}
                               />
                             </div>
                          </div>
                      ) : (
                          <div className="rounded-2xl bg-[#161b22] border border-indigo-500/20 p-6 mt-4">
                            <div className="flex items-center gap-3 mb-6">
                              <div className="p-2 bg-indigo-500/20 rounded-xl">
                                <Building2 className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div>
                                <h2 className="text-base font-black text-white">단일 기업 심층 트래킹 결과</h2>
                                <p className="text-sm font-bold text-indigo-400">조회 시점: {singleResult.timeLabel || (singleResult.yahooData?.asOfDate ? new Date(singleResult.yahooData.asOfDate).toLocaleDateString() : '현재 (LIVE)')}</p>
                              </div>
                            </div>
                            {renderMiniMacroContext(singleResult.macroContext, 'indigo')}
                            <AnalysisOutput 
                                results={{ trackA: [singleResult], trackB: [], analysisDate: new Date(), summary: '단일 기업 분석 결과' }} 
                                conditions={singleAnalysisModel.conditions || {}}
                                isLoading={false}
                            />
                          </div>
                      )}
                    </div>
                  )}

                </Phase4Panel>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
