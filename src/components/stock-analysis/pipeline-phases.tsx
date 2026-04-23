'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BookOpen, Zap, Activity, Target, ChevronDown, ChevronUp, CheckCircle2, Loader2,
  FileText, Video, AlertCircle, TrendingUp, TrendingDown, Minus, Brain, Shield,
  BarChart3, Clock, Sparkles, Filter, ArrowRight, CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  KnowledgeTreemap, 
  KnowledgeTuningCenter
} from './knowledge-visualizer';
import { AIModel, APIKeys } from '@/types/stock-analysis';

/** ─── Phase 1: Knowledge Extraction ─────────────────────────────── */
export function Phase1Panel({ knowledge, isLearning, learningStatus, hasError }: {
  knowledge: any;
  isLearning: boolean;
  learningStatus: any;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const criterias = knowledge?.criteria?.criterias || [];
  const fileAnalyses = knowledge?.fileAnalyses || [];
  const isCompleted = criterias.length > 0;

  return (
    <div className="space-y-3">
      {/* Learning Progress - Shown as a standalone card (No Orange Panel) */}
      {isLearning && learningStatus && (
        <div className="p-6 rounded-[32px] bg-[#141720] border border-amber-500/30 shadow-2xl shadow-amber-500/5 animate-in fade-in zoom-in duration-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Loader2 className="h-5 w-5 text-amber-400 animate-spin" />
              </div>
              <div>
                <span className="text-sm font-black text-amber-300 uppercase tracking-[0.2em] block">AI Knowledge Mining</span>
                <span className="text-[10px] text-amber-500/50 font-bold uppercase">{learningStatus.message || '원천 데이터 분석 중...'}</span>
              </div>
            </div>
            <div className="px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
              <span className="text-xs font-black text-amber-400 font-mono">
                {learningStatus.completedFiles} / {learningStatus.totalFiles} FILES
              </span>
            </div>
          </div>
          
          <div className="space-y-2">
            <Progress
              value={(learningStatus.completedFiles / Math.max(1, learningStatus.totalFiles)) * 100}
              className="h-2 bg-amber-950/50"
            />
            <div className="flex justify-between text-[10px] font-bold text-amber-500/40 uppercase tracking-tighter">
              <span>Initializing Engine</span>
              <span>Extracting Core Alpha</span>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message - Showed ONLY the success message without any orange components */}
      {isCompleted && !isLearning && !hasError && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 animate-in slide-in-from-top-2 duration-500 shadow-lg shadow-emerald-500/5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <span className="text-sm font-black text-emerald-300">원천 데이터 학습 완료. 하단 2단계에서 전략 비중을 설정하십시오.</span>
        </div>
      )}
    </div>
  );
}

/** ─── Phase 2: Strategy Tuning ────────────────────────────────────── */
export function Phase2Panel({ 
  knowledge, 
  onSynthesize,
  isSynthesizing,
  availableModels = [],
  apiKeys = {},
  selectedModel,
  onModelChange,
  selectedModelSecondary,
  onModelChangeSecondary,
  learnedAt
}: { 
  knowledge: any;
  onSynthesize: (weights: Record<string, number>, aiModel?: string, fallbackAiModel?: string) => void;
  isSynthesizing: boolean;
  availableModels?: AIModel[];
  apiKeys?: APIKeys;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  selectedModelSecondary?: string;
  onModelChangeSecondary?: (model: string) => void;
  learnedAt?: string | Date;
}) {
  const [open, setOpen] = useState(true);
  const isCompleted = !!knowledge?.keyConditionsSummary;
  const criterias = knowledge?.criteria?.criterias || [];

  return (
    <PanelWrapper
      phase={2}
      title="Strategy Designing"
      subtitle="지표별 가중치 조절 및 전략 밸런스 튜닝"
      color="indigo"
      isCompleted={isCompleted}
      isActive={isSynthesizing}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={criterias.length > 0 ? `현재 ${criterias.length}개 지표 구성 중` : undefined}
      learnedAt={learnedAt}
    >
      {criterias.length > 0 ? (
        <KnowledgeTuningCenter 
          knowledge={knowledge} 
          onSynthesisTrigger={onSynthesize} 
          availableModels={availableModels}
          apiKeys={apiKeys}
          selectedModel={selectedModel}
          onModelChange={onModelChange}
          selectedModelSecondary={selectedModelSecondary}
          onModelChangeSecondary={onModelChangeSecondary}
        />
      ) : (
        <EmptyState message="Phase 1 학습이 완료되면 전략 설계 도구가 활성화됩니다." />
      )}
    </PanelWrapper>
  );
}

/** ─── Phase 3: Custom Knowledge Synthesis ─────────────────────────── */
export function Phase3Panel({ 
  knowledge, 
  isSynthesizing,
  onStartCompanyAnalysis,
  learnedAt
}: { 
  knowledge: any;
  isSynthesizing: boolean;
  onStartCompanyAnalysis?: () => void;
  learnedAt?: string | Date;
}) {
  const [open, setOpen] = useState(true);
  const isCompleted = !!knowledge?.keyConditionsSummary;
  const principles = knowledge?.criteria?.principles || [];

  return (
    <PanelWrapper
      phase={3}
      title="Knowledge Synthesis"
      subtitle="맞춤형 투자 전략 및 핵심 원칙 최종 수립"
      color="blue"
      isCompleted={isCompleted}
      isActive={isSynthesizing}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={isCompleted ? `합의 점수: ${knowledge.consensusScore ?? '—'}% · 전략 유형: ${knowledge.strategyType === 'moderate' ? '중립형' : knowledge.strategyType === 'aggressive' ? '공격형' : '보수형'}` : undefined}
      learnedAt={learnedAt}
    >
      {isSynthesizing ? (
        <div className="py-12 space-y-6 flex flex-col items-center">
           <div className="relative">
              <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              <Sparkles className="absolute inset-0 m-auto h-6 w-6 text-amber-400 animate-pulse" />
           </div>
           <div className="text-center">
              <h3 className="text-lg font-black text-white mb-2 uppercase tracking-widest">AI 투자 전략 합성 중</h3>
              <p className="text-sm text-white/40 font-medium">사용자가 설정한 가중치를 바탕으로 최적의 투자 로직을 구성하고 있습니다...</p>
           </div>
        </div>
      ) : isCompleted ? (
        <div className="space-y-6 animate-in fade-in duration-1000">
          <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600/20 to-indigo-600/10 border border-blue-500/20 shadow-2xl">
            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.4em] mb-4">맞춤형 통합 투자 가이드라인</p>
            <p className="text-base text-white/90 font-bold leading-relaxed italic">
              &ldquo;{knowledge.keyConditionsSummary}&rdquo;
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-400" /> 수립된 핵심 투자 원칙
              </p>
              <div className="space-y-3">
                {principles.map((p: any, i: number) => {
                  const content = typeof p === 'string' ? p : (p?.principle || p?.text || p?.description || p?.title);
                  if (!content) return null;
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-sm text-white/70">
                      <CheckCircle2 className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>{content}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="flex flex-col justify-center items-center p-8 rounded-3xl border border-white/5 bg-black/20">
               <div className="text-center mb-6">
                 <p className="text-[10px] font-black text-white/40 uppercase mb-1">AI 정합성 합의 점수</p>
                 <p className="text-5xl font-black text-blue-400 font-mono">{knowledge.consensusScore}%</p>
               </div>
               <Button 
                 onClick={onStartCompanyAnalysis}
                 className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black flex items-center gap-3 transition-all active:scale-95"
               >
                 기업 정밀 분석 시작 (4단계 이동) <ArrowRight className="h-4 w-4" />
               </Button>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState message="2단계에서 [지식 합성 시작] 버튼을 누르면 AI 전략 보고서가 생성됩니다." />
      )}
    </PanelWrapper>
  );
}

/** ─── Phase 4: Real-time Sensing ────────────────────────────────── */
export function Phase4Panel({
  macroContext,
  isAnalyzing,
  progress,
  progressMessage,
  results,
  processedCount,
  excludedStockCount,
  activeRuleCount,
  children,
  inputControls,
}: {
  macroContext: any;
  isAnalyzing?: boolean;
  progress?: number;
  progressMessage?: string;
  results?: any;
  processedCount?: number;
  excludedStockCount?: number;
  activeRuleCount?: number;
  children?: React.ReactNode;
  inputControls?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const trackA = results?.trackA || [];
  const trackB = results?.trackB || [];
  const allCandidates = [...trackA, ...trackB];
  const isCompleted = !!macroContext && allCandidates.length > 0 && !isAnalyzing;

  return (
    <PanelWrapper
      phase={4}
      title="Dynamic Company Scan"
      subtitle="수립된 전략 기반 실시간 시장 상황 진단 및 기업 필터링"
      color="teal"
      isCompleted={isCompleted}
      isActive={isAnalyzing || false}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={isCompleted ? `${allCandidates.length}개 최종 분석 결과 도출` : undefined}
    >
      <div className="space-y-6">
        {inputControls && (
          <div className="bg-[#0f111a] p-4 rounded-2xl border border-white/5">
            {inputControls}
          </div>
        )}

        {macroContext && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroCard label="VIX" value={macroContext.vix?.toFixed(1)} status={macroContext.vixStatus} color={macroContext.vixStatus === 'Low' ? 'teal' : 'amber'} />
            <MacroCard label="10Y Yield" value={`${macroContext.treasuryYield10Y?.toFixed(2)}%`} status={macroContext.yieldStatus} color="teal" />
            <MacroCard label="Market Mode" value={macroContext.marketMode} status={macroContext.marketMode} color="teal" isHighlight />
            <div className="p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center flex flex-col justify-center">
               <p className="text-[9px] font-black text-teal-400 uppercase mb-1">ACTIVE RULES</p>
               <p className="text-xl font-black text-white font-mono">{activeRuleCount || 0}</p>
            </div>
          </div>
        )}

        {isAnalyzing && (
          <div className="space-y-4 pt-6 mt-6 border-t border-white/5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 text-teal-400 animate-spin" />
                <span className="text-xs font-black text-teal-300 uppercase tracking-widest">기업 정밀 스캐닝 중</span>
              </div>
              <span className="text-xs font-black text-teal-400 font-mono">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5 bg-teal-900" />
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10">
                <p className="text-[10px] text-teal-400 font-black uppercase">PROCESSED</p>
                <p className="text-2xl font-black text-white font-mono">{processedCount || 0}</p>
              </div>
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                <p className="text-[10px] text-rose-400 font-black uppercase">EXCLUDED</p>
                <p className="text-2xl font-black text-white font-mono">-{excludedStockCount || 0}</p>
              </div>
            </div>
          </div>
        )}

        {children}
      </div>
    </PanelWrapper>
  );
}

/** ─── Shared UI Helpers ────────────────────────────────────────── */

function PanelWrapper({
  phase, title, subtitle, color, isCompleted, isActive,
  open, onToggle, stats, learnedAt, children
}: {
  phase: number; title: string; subtitle: string;
  color: 'amber' | 'indigo' | 'teal' | 'blue';
  isCompleted: boolean; isActive: boolean;
  open: boolean; onToggle: () => void;
  stats?: string; learnedAt?: string | Date; children: React.ReactNode;
}) {
  const colorMap = {
    amber: { border: 'border-amber-500/30', glow: 'bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300', num: 'text-amber-400', dot: 'bg-amber-400' },
    indigo: { border: 'border-indigo-500/30', glow: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 text-indigo-300', num: 'text-indigo-400', dot: 'bg-indigo-400' },
    teal: { border: 'border-teal-500/30', glow: 'bg-teal-500/10', badge: 'bg-teal-500/20 text-teal-300', num: 'text-teal-400', dot: 'bg-teal-400' },
    blue: { border: 'border-blue-500/30', glow: 'bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300', num: 'text-blue-400', dot: 'bg-blue-400' },
  };
  const c = colorMap[color];

  return (
    <div className={cn(
      'rounded-[32px] border bg-[#11141b] overflow-hidden transition-all duration-500',
      c.border,
      isActive && 'ring-2 ring-offset-2 ring-offset-[#0d0f14]'
    )}>
      <button onClick={onToggle} className="w-full flex items-center gap-5 p-7 hover:bg-white/[0.02] transition-colors text-left">
        <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0', c.glow, c.num)}>
          {phase}
        </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-black text-white flex items-center gap-2">
              {title}
              {isCompleted && !isActive && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              )}
            </h3>
            <p className="text-sm text-white/40 font-medium">{subtitle}</p>
            <div className="flex items-center gap-4 mt-1">
              {stats && <p className={cn('text-sm font-black', c.num)}>{stats}</p>}
              {learnedAt && (
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 shrink-0">
                  <Clock className="h-3 w-3 text-white/40" />
                  <span className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">
                    Last Learned: {new Date(learnedAt).toLocaleString('ko-KR', {
                      year: 'numeric', month: '2-digit', day: '2-digit',
                      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

        {/* Toggle */}
        {open ? <ChevronUp className="h-5 w-5 text-white/30 shrink-0" /> : <ChevronDown className="h-5 w-5 text-white/30 shrink-0" />}
      </button>

      {/* Panel Body */}
      {open && (
        <div className="px-5 pb-5 border-t border-white/5">
          <div className="pt-5">{children}</div>
        </div>
      )}
    </div>
  );
}

function MacroCard({ label, value, status, color, isHighlight }: {
  label: string; value: string; status: string; color: string; isHighlight?: boolean;
}) {
  const colorClass = {
    teal: 'text-teal-300 bg-teal-500/10 border-teal-500/20',
    amber: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
    rose: 'text-rose-300 bg-rose-500/10 border-rose-500/20',
    white: 'text-white/60 bg-white/5 border-white/10',
  }[color] || 'text-white/60 bg-white/5 border-white/10';

  const TrendIcon = status === 'Uptrend' || status === 'Bullish' || status === 'Greed' ? TrendingUp :
    status === 'Downtrend' || status === 'Bearish' || status === 'Fear' ? TrendingDown : Minus;

  return (
    <div className={cn('p-3 rounded-xl border text-center', colorClass, isHighlight && 'ring-1 ring-current ring-opacity-30')}>
      <p className="text-[9px] font-black text-white/40 uppercase tracking-tighter mb-1">{label}</p>
      <p className={cn('text-base font-black font-mono', colorClass.split(' ')[0])}>{value}</p>
      <div className={cn('flex items-center justify-center gap-0.5 text-[9px] font-bold mt-0.5', colorClass.split(' ')[0])}>
        <TrendIcon className="h-2.5 w-2.5" />
        <span>{status}</span>
      </div>
    </div>
  );
}

function CandidateRow({ result, rank }: { result: any; rank: number }) {
  const score = result.score || 0;
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-rose-400';
  const verdict = result.recommendation || result.expertVerdict?.recommendation || 'HOLD';
  const verdictColor = verdict === 'STRONG_BUY' || verdict === 'BUY' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    verdict === 'SELL' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
    'bg-amber-500/20 text-amber-300 border-amber-500/30';

  const riskLevel = result.riskLevel;
  const riskColor = riskLevel === 'low' ? 'text-emerald-400' : riskLevel === 'high' ? 'text-rose-400' : 'text-amber-400';

  const activeRules = result.rules?.filter((r: any) => r.score >= 5) || [];

  return (
    <div className="p-3 rounded-xl bg-white/4 border border-white/10 hover:bg-white/6 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-[9px] font-black text-white/30 w-4 shrink-0">#{rank}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-black text-white font-mono">{result.ticker}</span>
              <span className="text-[10px] text-white/40 truncate max-w-[140px]">{result.companyName}</span>
              {result.track && (
                <span className={cn(
                  'text-[8px] font-black px-1.5 py-0.5 rounded',
                  result.track === 'A' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'
                )}>
                  TRACK {result.track}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {result.sector && (
                <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">{result.sector}</span>
              )}
              {activeRules.length > 0 && (
                <span className="text-[9px] text-blue-300 flex items-center gap-1">
                  <Filter className="h-2.5 w-2.5" /> {activeRules.length} rules matched
                </span>
              )}
              {riskLevel && (
                <span className={cn('text-[9px] font-black flex items-center gap-0.5', riskColor)}>
                  <Shield className="h-2.5 w-2.5" />
                  {riskLevel ? riskLevel.toUpperCase() : 'N/A'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Score */}
          <div className="text-right">
            <p className={cn('text-xl font-black font-mono leading-none', scoreColor)}>{Math.round(score)}</p>
            <p className="text-[8px] text-white/30 font-bold">SCORE</p>
          </div>

          {/* Score bar */}
          <div className="w-1 h-10 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn('w-full rounded-full transition-all', scoreColor.replace('text-', 'bg-'))}
              style={{ height: `${score}%`, marginTop: `${100 - score}%` }}
            />
          </div>

          {/* Verdict */}
          <span className={cn('text-[9px] font-black px-2 py-1 rounded-lg border', verdictColor)}>
            {verdict.replace('_', '\n')}
          </span>
        </div>
      </div>

      {/* Expert Verdict summary */}
      {result.expertVerdict?.summary && (
        <p className="text-[10px] text-white/35 mt-2 leading-relaxed line-clamp-2 pl-6">
          {result.expertVerdict.summary}
        </p>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-10 flex flex-col items-center text-center gap-3">
      <div className="p-3 rounded-xl bg-white/5">
        <Brain className="h-7 w-7 text-white/20" />
      </div>
      <p className="text-sm text-white/30 font-medium max-w-xs leading-relaxed">{message}</p>
    </div>
  );
}

/** ─── RuleCard: used in both panel and modal ──────────────────── */
function RuleCard({ rule, expanded = false }: { rule: any; expanded?: boolean }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-black px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 uppercase tracking-tighter shrink-0 border border-amber-500/20">
            {rule.category}
          </span>
          <p className={cn('font-black text-white text-base', expanded ? 'text-lg' : 'text-base')}>{rule.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rule.isGeneral && (
            <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 uppercase border border-blue-500/20">일반</span>
          )}
          <div className="text-center bg-black/20 p-1 px-2 rounded-lg border border-white/5">
            <p className="text-[10px] text-white/30 font-black uppercase">WEIGHT</p>
            <p className="text-lg font-black text-amber-400 font-mono leading-none">×{rule.weight}</p>
          </div>
        </div>
      </div>

      {/* Description */}
      {rule.description && (
        <p className="text-base text-white/70 leading-relaxed mb-4 font-medium">{rule.description}</p>
      )}

      {/* Quantification */}
      {rule.quantification && (
        <div className="mb-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Target className="h-3.5 w-3.5" /> 정량 지표 매핑
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-black font-mono text-emerald-300">
              {rule.quantification.target_metric}
            </span>
            <span className="text-white/40 font-black">{rule.quantification.condition}</span>
            <span className="text-lg font-black text-amber-300">{rule.quantification.benchmark || rule.quantification.value}</span>
            <span className="text-xs text-white/30 font-bold ml-auto">{rule.quantification.benchmark_type?.toUpperCase() || 'ABSOLUTE'}</span>
          </div>
        </div>
      )}

      {/* Rationale */}
      {rule.weightRationale && (
        <div className="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-2.5">
          <Brain className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-300/80 font-medium leading-relaxed italic">
            &ldquo;{rule.weightRationale}&rdquo;
          </p>
        </div>
      )}

      {/* Tags row */}
      <div className="flex flex-wrap gap-2">
        {rule.applicableContexts?.map((ctx: string, ci: number) => (
          <span key={ci} className="text-xs font-black px-3 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 uppercase">
            ⚡ {ctx.replace(/_/g, ' ')}
          </span>
        ))}
        {rule.targetSectors?.map((sec: string, si: number) => (
          <span key={si} className="text-xs font-black px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
            🏢 {sec}
          </span>
        ))}
        {rule.source?.fileName && (
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/5 text-white/40 border border-white/10 truncate max-w-[280px]">
            📄 {rule.source.fileName}
            {rule.source.pageOrTimestamp && <span className="ml-2 text-white/20 font-mono">@{rule.source.pageOrTimestamp}</span>}
          </span>
        )}
      </div>
    </div>
  );
}

/** ─── RulesModal: Full-screen overlay with all rules ────────────── */
function RulesModal({ rules, onClose }: { rules: any[]; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterCtx, setFilterCtx] = useState<string>('all');

  const categories = ['all', ...[...new Set(rules.map((r: any) => r.category).filter(Boolean))]];
  const contexts = ['all', ...[...new Set(rules.flatMap((r: any) => r.applicableContexts || []).filter(Boolean))]];

  const filtered = rules.filter((r: any) => {
    const matchSearch = !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.description?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'all' || r.category === filterCat;
    const matchCtx = filterCtx === 'all' || r.applicableContexts?.includes(filterCtx);
    return matchSearch && matchCat && matchCtx;
  });

  // Close on ESC
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-[#0f111a] border border-amber-500/30 rounded-2xl shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 bg-[#0f111a] border-b border-white/10 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/15 rounded-xl">
                <BookOpen className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">학습된 투자 규칙 전체 보기</h2>
                <p className="text-sm text-white/40">총 <span className="text-amber-300 font-black">{rules.length}</span>개 규칙 · 필터링 결과: <span className="text-blue-300 font-black">{filtered.length}</span>개</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Search + Filters */}
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="규칙 이름 또는 설명 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-48 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50"
            />
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              {categories.map(c => (
                <option key={c} value={c} className="bg-[#0f111a]">{c === 'all' ? '전체 카테고리' : c}</option>
              ))}
            </select>
            <select
              value={filterCtx}
              onChange={e => setFilterCtx(e.target.value)}
              className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white/70 focus:outline-none focus:border-amber-500/50 cursor-pointer"
            >
              {contexts.map(c => (
                <option key={c} value={c} className="bg-[#0f111a]">{c === 'all' ? '전체 마켓 상황' : c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Rules Grid */}
        <div className="p-6 space-y-3">
          {filtered.length > 0 ? filtered.map((rule: any, i: number) => (
            <div key={i} className="flex items-start gap-3">
              <span className="shrink-0 w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-black text-white/30 mt-1">
                {i + 1}
              </span>
              <div className="flex-1">
                <RuleCard rule={rule} expanded />
              </div>
            </div>
          )) : (
            <div className="py-16 text-center">
              <p className="text-white/30 text-sm">일치하는 규칙이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
