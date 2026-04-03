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

/** ─── Phase 1: Knowledge Extraction ─────────────────────────────── */
export function Phase1Panel({ knowledge, isLearning, learningStatus }: {
  knowledge: any;
  isLearning: boolean;
  learningStatus: any;
}) {
  const [open, setOpen] = useState(true);
  const [showAllRules, setShowAllRules] = useState(false);
  const criterias = knowledge?.criteria?.criterias || [];
  const fileAnalyses = knowledge?.fileAnalyses || [];
  const isCompleted = criterias.length > 0;

  return (
    <PanelWrapper
      phase={1}
      title="Knowledge Extraction"
      subtitle="원천 데이터에서 투자 조건 추출"
      color="amber"
      isCompleted={isCompleted}
      isActive={isLearning}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={isCompleted ? `${fileAnalyses.length}개 파일 분석 · ${criterias.length}개 조건 추출` : undefined}
    >
      {/* Learning Progress */}
      {isLearning && learningStatus && (
        <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin" />
              <span className="text-sm font-black text-amber-300 uppercase tracking-widest">AI 분석 중</span>
            </div>
            <span className="text-sm font-black text-amber-400 font-mono">
              {learningStatus.completedFiles}/{learningStatus.totalFiles} FILES
            </span>
          </div>
          <Progress
            value={(learningStatus.completedFiles / Math.max(1, learningStatus.totalFiles)) * 100}
            className="h-1.5 bg-amber-950"
          />
          <p className="text-[10px] text-amber-500/70 font-medium mt-1.5 truncate">
            {learningStatus.message || '원천 데이터 분석 중...'}
          </p>
        </div>
      )}

      {/* Extracted Conditions */}
      {criterias.length > 0 ? (
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {criterias.slice(0, 15).map((rule: any, i: number) => (
            <RuleCard key={i} rule={rule} />
          ))}
          {criterias.length > 15 && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowAllRules(true);
              }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-base font-black text-amber-400 flex items-center justify-center gap-3 group"
            >
              <BookOpen className="h-5 w-5 group-hover:scale-110 transition-transform" />
              + {criterias.length - 15}개 규칙 더 보기 (전체 {criterias.length}개)
            </button>
          )}
        </div>
      ) : !isLearning ? (
        <EmptyState message="학습된 데이터가 없습니다. 상단 Data Library에서 원천 데이터를 학습해주세요." />
      ) : null}

      {/* All Rules Modal */}
      {showAllRules && (
        <RulesModal rules={criterias} onClose={() => setShowAllRules(false)} />
      )}
    </PanelWrapper>
  );
}

/** ─── Phase 2: Knowledge Synthesis ────────────────────────────────── */
export function Phase2Panel({ knowledge }: { knowledge: any }) {
  const [open, setOpen] = useState(true);
  const isCompleted = !!knowledge?.keyConditionsSummary;
  const strategy = knowledge?.strategy || {};
  const principles = knowledge?.criteria?.principles || [];

  const contextGroups: Record<string, string[]> = {
    bull_market: ['green', '강세장'],
    recession: ['rose', '약세장/침체'],
    high_inflation: ['orange', '고물가'],
    high_interest: ['red', '고금리'],
    pivot_expected: ['purple', '금리 전환 예상'],
    low_vix: ['teal', '저변동성'],
  };

  const sectorMappings: Record<string, string[]> = {};
  (knowledge?.criteria?.criterias || []).forEach((r: any) => {
    (r.targetSectors || []).forEach((sec: string) => {
      if (!sectorMappings[sec]) sectorMappings[sec] = [];
      if (r.quantification?.target_metric && !sectorMappings[sec].includes(r.quantification.target_metric)) {
        sectorMappings[sec].push(r.quantification.target_metric);
      }
    });
  });

  return (
    <PanelWrapper
      phase={2}
      title="Knowledge Synthesis"
      subtitle="지식 합성 및 상황별 트리거 매핑"
      color="indigo"
      isCompleted={isCompleted}
      isActive={false}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={isCompleted ? `전략 유형: ${knowledge.strategyType || '—'} · 합의 점수: ${knowledge.consensusScore || '—'}%` : undefined}
    >
      {isCompleted ? (
        <div className="space-y-4">
          {/* Philosophy Quote */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-600/20 to-purple-600/10 border border-indigo-500/20">
            <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-2">SYNTHESIS PHILOSOPHY</p>
            <p className="text-sm text-white/80 font-medium leading-relaxed italic">
              &ldquo;{knowledge.keyConditionsSummary?.slice(0, 200)}...&rdquo;
            </p>
          </div>

          {/* Trigger Classification */}
          <div>
            <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> 상황별 트리거
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(contextGroups).map(([ctx, [color, label]]) => {
                const count = (knowledge?.criteria?.criterias || []).filter(
                  (r: any) => r.applicableContexts?.includes(ctx)
                ).length;
                if (count === 0) return null;
                return (
                  <div key={ctx} className={cn(
                    "px-3 py-2 rounded-xl border text-xs font-black flex items-center gap-2",
                    color === 'green' ? 'bg-green-500/10 border-green-500/20 text-green-300' :
                    color === 'rose' ? 'bg-rose-500/10 border-rose-500/20 text-rose-300' :
                    color === 'orange' ? 'bg-orange-500/10 border-orange-500/20 text-orange-300' :
                    color === 'red' ? 'bg-red-500/10 border-red-500/20 text-red-300' :
                    color === 'purple' ? 'bg-purple-500/10 border-purple-500/20 text-purple-300' :
                    'bg-teal-500/10 border-teal-500/20 text-teal-300'
                  )}>
                    <CircleDot className="h-2.5 w-2.5" />
                    {label}
                    <span className="font-mono ml-1 opacity-60">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sector Mappings */}
          {Object.keys(sectorMappings).length > 0 && (
            <div>
              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Filter className="h-3 w-3" /> 섹터별 핵심 지표 매핑
              </p>
              <div className="space-y-1.5">
                {Object.entries(sectorMappings).slice(0, 5).map(([sector, metrics]) => (
                  <div key={sector} className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-white/60 shrink-0 w-36 truncate">{sector}</span>
                    <ArrowRight className="h-3 w-3 text-white/20 shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {metrics.slice(0, 4).map((m, i) => (
                        <span key={i} className="text-[9px] font-bold text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded font-mono">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strategy Principles */}
          {principles.length > 0 && (
            <div>
              <p className="text-xs font-black text-white/40 uppercase tracking-widest mb-3">핵심 투자 원칙</p>
              <div className="space-y-2">
                {principles.slice(0, 4).map((p: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-white/60">
                    <CheckCircle2 className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <span>{p.principle}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <EmptyState message="Phase 1 학습이 완료되면 지식 합성 결과가 표시됩니다." />
      )}
    </PanelWrapper>
  );
}

/** ─── Phase 3: Real-time Sensing ────────────────────────────────── */
export function Phase3Panel({ macroContext }: { macroContext: any }) {
  const [open, setOpen] = useState(true);
  const isCompleted = !!macroContext;

  const vixColor = !macroContext ? 'white' :
    macroContext.vixStatus === 'Low' ? 'teal' :
    macroContext.vixStatus === 'Moderate' ? 'amber' : 'rose';

  const yieldColor = !macroContext ? 'white' :
    macroContext.yieldStatus === 'Bullish' ? 'teal' :
    macroContext.yieldStatus === 'Neutral' ? 'amber' : 'rose';

  const sp500Color = !macroContext ? 'white' :
    macroContext.sp500Trend === 'Uptrend' ? 'teal' :
    macroContext.sp500Trend === 'Sideways' ? 'amber' : 'rose';

  const modeColor = !macroContext ? 'white' :
    macroContext.marketMode === 'Greed' ? 'teal' :
    macroContext.marketMode === 'Neutral' ? 'amber' : 'rose';

  // Derived active contexts from macro
  const activeContexts: string[] = [];
  if (macroContext) {
    if (macroContext.marketMode === 'Fear') activeContexts.push('recession');
    if (macroContext.marketMode === 'Greed') activeContexts.push('bull_market');
    if (macroContext.vixStatus === 'High' || macroContext.vixStatus === 'Extreme') activeContexts.push('volatility_high');
    if (macroContext.yieldStatus === 'Bearish') activeContexts.push('high_interest');
    if (macroContext.vixStatus === 'Low') activeContexts.push('low_vix');
  }

  return (
    <PanelWrapper
      phase={3}
      title="Real-time Sensing"
      subtitle="현시점 시장 상황 진단"
      color="teal"
      isCompleted={isCompleted}
      isActive={false}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={macroContext ? `시장 모드: ${macroContext.marketMode}` : undefined}
    >
      {isCompleted ? (
        <div className="space-y-4">
          {/* Macro Metrics Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MacroCard label="VIX" value={macroContext.vix?.toFixed(1)} status={macroContext.vixStatus} color={vixColor} />
            <MacroCard label="10Y Yield" value={`${macroContext.treasuryYield10Y?.toFixed(2)}%`} status={macroContext.yieldStatus} color={yieldColor} />
            <MacroCard label="S&P 500 Trend" value={macroContext.sp500Trend} status={macroContext.sp500Trend} color={sp500Color} />
            <MacroCard
              label="Market Mode"
              value={macroContext.marketMode}
              status={macroContext.marketMode}
              color={modeColor}
              isHighlight
            />
          </div>

          {/* Active Context Tags */}
          <div>
            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-teal-400" /> 활성화된 시장 상황 태그
            </p>
            <div className="flex flex-wrap gap-2">
              {activeContexts.length > 0 ? activeContexts.map((ctx, i) => (
                <div key={i} className="px-3 py-1.5 rounded-full text-[10px] font-black bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1.5 animate-pulse">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-400" />
                  {ctx.replace(/_/g, ' ').toUpperCase()}
                </div>
              )) : (
                <span className="text-xs text-white/30">확인된 특수 상황 없음 (중립 상태)</span>
              )}
            </div>
          </div>

          {/* Supplementary */}
          {(macroContext.dxy || macroContext.hySpread) && (
            <div className="grid grid-cols-2 gap-2">
              {macroContext.dxy && (
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-[9px] text-white/40 font-black uppercase">Dollar Index (DXY)</p>
                  <p className="text-sm font-black text-white font-mono">{macroContext.dxy?.toFixed(1)}</p>
                </div>
              )}
              {macroContext.hySpread && (
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-[9px] text-white/40 font-black uppercase">HY Spread Proxy</p>
                  <p className="text-sm font-black text-white font-mono">{macroContext.hySpread?.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <EmptyState message="분석을 시작하면 실시간 시장 지표가 표시됩니다." />
      )}
    </PanelWrapper>
  );
}

/** ─── Phase 4: Dynamic Analysis ────────────────────────────────── */
export function Phase4Panel({
  isAnalyzing,
  progress,
  progressMessage,
  results,
  processedCount,
  excludedStockCount,
  activeRuleCount,
  totalRuleCount,
  children
}: {
  isAnalyzing: boolean;
  progress: number;
  progressMessage: string;
  results: any;
  processedCount?: number;
  excludedStockCount?: number;
  activeRuleCount?: number;
  totalRuleCount?: number;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  const trackA = results?.trackA || [];
  const trackB = results?.trackB || [];
  const allCandidates = [...trackA, ...trackB];
  const isCompleted = allCandidates.length > 0 && !isAnalyzing;

  return (
    <PanelWrapper
      phase={4}
      title="Dynamic Analysis"
      subtitle="상황 맞춤형 기업 분석 실행"
      color="blue"
      isCompleted={isCompleted}
      isActive={isAnalyzing}
      open={open}
      onToggle={() => setOpen(v => !v)}
      stats={isCompleted ? `${allCandidates.length}개 최종 선정` :
        isAnalyzing ? `처리 중 ${processedCount || 0}개 / 제외 ${excludedStockCount || 0}개` : undefined}
    >
      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="mb-4 space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
              <span className="text-xs font-black text-blue-300 uppercase tracking-widest">분석 진행 중</span>
            </div>
            <span className="text-xs font-black text-blue-400 font-mono">{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5 bg-blue-950" />
          <p className="text-[10px] text-blue-400/70 font-medium">{progressMessage}</p>

          {/* Active rule count indicator */}
          {totalRuleCount && (
            <div className="flex items-center gap-2 text-[10px] font-black text-white/40">
              <Filter className="h-3 w-3" />
              <span>학습 규칙 {totalRuleCount}개 중</span>
              <span className="text-blue-400">{activeRuleCount || totalRuleCount}개 활성화</span>
              <span>(상황+섹터 필터링 적용)</span>
            </div>
          )}

          {/* Real-time counters */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-[9px] text-blue-400 font-black uppercase">PROCESSED</p>
              <p className="text-lg font-black text-blue-200 font-mono">{processedCount || 0}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <p className="text-[9px] text-rose-400 font-black uppercase">EXCLUDED</p>
              <p className="text-lg font-black text-rose-200 font-mono">-{excludedStockCount || 0}</p>
            </div>
          </div>
        </div>
      )}

      {/* Results from Children */}
      {!isAnalyzing && children}

      {!isAnalyzing && allCandidates.length === 0 && (
        <EmptyState message="분석을 시작하면 기업별 점수와 판정 결과가 실시간으로 표시됩니다." />
      )}
    </PanelWrapper>
  );
}

/** ─── Sub-components ────────────────────────────────────────────── */

function PanelWrapper({
  phase, title, subtitle, color, isCompleted, isActive,
  open, onToggle, stats, children
}: {
  phase: number; title: string; subtitle: string;
  color: 'amber' | 'indigo' | 'teal' | 'blue';
  isCompleted: boolean; isActive: boolean;
  open: boolean; onToggle: () => void;
  stats?: string; children: React.ReactNode;
}) {
  const colorMap = {
    amber: { border: 'border-amber-500/40', glow: 'bg-amber-500/10', badge: 'bg-amber-500/20 text-amber-300', num: 'text-amber-400', dot: 'bg-amber-400' },
    indigo: { border: 'border-indigo-500/40', glow: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 text-indigo-300', num: 'text-indigo-400', dot: 'bg-indigo-400' },
    teal: { border: 'border-teal-500/40', glow: 'bg-teal-500/10', badge: 'bg-teal-500/20 text-teal-300', num: 'text-teal-400', dot: 'bg-teal-400' },
    blue: { border: 'border-blue-500/40', glow: 'bg-blue-500/10', badge: 'bg-blue-500/20 text-blue-300', num: 'text-blue-400', dot: 'bg-blue-400' },
  };
  const c = colorMap[color];

  return (
    <div className={cn(
      'rounded-2xl border bg-[#161b22] overflow-hidden transition-all',
      c.border,
      isActive && 'ring-1 ring-offset-1 ring-offset-[#0f111a]',
      isActive && color === 'amber' ? 'ring-amber-500/30' :
      isActive && color === 'indigo' ? 'ring-indigo-500/30' :
      isActive && color === 'teal' ? 'ring-teal-500/30' :
      isActive ? 'ring-blue-500/30' : ''
    )}>
      {/* Panel Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 hover:bg-white/3 transition-colors text-left"
      >
        {/* Phase Number */}
        <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center font-black text-base shrink-0', c.glow, c.num)}>
          {phase}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-white text-base">{title}</span>
            {isActive && (
              <div className="flex items-center gap-1">
                <div className={cn('h-1.5 w-1.5 rounded-full animate-pulse', c.dot)} />
                <span className={cn('text-[10px] font-black uppercase tracking-widest', c.num)}>Live</span>
              </div>
            )}
            {isCompleted && !isActive && (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            )}
          </div>
          <p className="text-sm text-white/40 font-medium">{subtitle}</p>
          {stats && <p className={cn('text-sm font-black mt-0.5', c.num)}>{stats}</p>}
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
            <span className="text-lg font-black text-amber-300">{rule.quantification.benchmark}</span>
            <span className="text-xs text-white/30 font-bold ml-auto">{rule.quantification.benchmark_type?.toUpperCase()}</span>
          </div>
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
