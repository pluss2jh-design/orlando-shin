'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle, ChevronDown, ChevronUp, Mail, Lock, Sparkles, ArrowLeft, ArrowRight, Activity, TrendingDown, Target, Zap, ExternalLink, Newspaper, Brain, CheckCircle2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AnalysisResult, InvestmentConditions, StrategyMatchScore, MatchRuleResult, MatchRuleSource, RecommendationResult } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { BacktestDialog } from './backtest-dialog';
import { History } from 'lucide-react';

function StrategyMatchDashboard({ score }: { score: StrategyMatchScore }) {
  const [expandedSource, setExpandedSource] = React.useState<string | null>(null);
  
  const stageBg = {
    watch: 'from-gray-500/10 to-gray-400/5 border-gray-500/30',
    scout: 'from-sky-500/10 to-sky-400/5 border-sky-500/30',
    expand1: 'from-amber-500/10 to-amber-400/5 border-amber-500/30',
    expand2: 'from-orange-500/10 to-orange-400/5 border-orange-500/30',
    full: 'from-emerald-500/10 to-emerald-400/5 border-emerald-500/30',
  };
  
  const stageText = {
    watch: 'text-gray-400',
    scout: 'text-sky-400',
    expand1: 'text-amber-400',
    expand2: 'text-orange-400',
    full: 'text-emerald-400',
  };

  const CATEGORY_ICONS: Record<string, any> = {
    '성장성': TrendingUp,
    '수익성': Activity,
    '안정성': AlertCircle,
    '가치평가': Target,
    '수급': Zap,
  };

  return (
    <div className="space-y-6">
      {/* 요약 헤더 */}
      <div className={cn('p-6 rounded-2xl border bg-gradient-to-br flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-xl', stageBg[score.investmentStage])}>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 opacity-80">Strategy Alignment</p>
          <div className="flex items-baseline gap-3">
            <span className={cn('text-6xl font-black font-mono tracking-tighter', stageText[score.investmentStage])}>
              {(score.matchPercentage ?? 0).toFixed(0)}%
            </span>
            <span className="text-gray-400 text-sm font-bold">MATCHED</span>
          </div>
          <p className={cn('text-lg font-black tracking-tight', stageText[score.investmentStage])}>{score.allocationLabel}</p>
        </div>
        
        <div className="flex flex-col items-end gap-3">
          <div className="flex -space-x-2">
            {score.rules.map((r, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-8 h-8 rounded-full border-2 border-[#0a0f18] flex items-center justify-center text-[10px] font-black transition-transform hover:scale-110 hover:z-10 cursor-help",
                  r.passed ? "bg-emerald-500 text-white" : "bg-gray-800 text-gray-500"
                )}
                title={r.name}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className="text-right">
            <p className="text-[11px] font-bold text-gray-400">{score.passedCount} / {score.totalCount} 핵심 조건 충족</p>
            <Progress value={score.matchPercentage} className="h-1.5 w-32 mt-2 bg-gray-800" />
          </div>
        </div>
      </div>

      {/* 동적 규칙 리스트 */}
      <div className="grid grid-cols-1 gap-4">
        {score.rules.map((rule, i) => {
          const Icon = CATEGORY_ICONS[rule.category] || CheckCircle;
          return (
            <div key={i} className={cn(
              'group p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden',
              rule.passed 
                ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' 
                : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
            )}>
              {rule.isCritical && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-rose-500 text-white text-[9px] font-black uppercase tracking-widest rounded-bl-lg">
                  Critical Requirement
                </div>
              )}
              
              <div className="flex items-start gap-5">
                <div className={cn(
                  'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                  rule.passed ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-800 text-gray-500'
                )}>
                  <Icon className="h-6 w-6" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="text-[10px] font-black border-gray-700 text-gray-400 uppercase tracking-widest">{rule.category}</Badge>
                      <h5 className={cn('text-base font-black tracking-tight', rule.passed ? 'text-white' : 'text-gray-400')}>
                        {rule.name}
                      </h5>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        'text-xl font-black font-mono block',
                        rule.score >= 8 ? 'text-emerald-400' : rule.score >= 5 ? 'text-amber-400' : 'text-rose-400'
                      )}>{rule.score}<span className="text-xs opacity-50">/10</span></span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-400 leading-relaxed font-medium mb-3">{rule.reason}</p>
                  
                  {rule.source && (
                    <div className="flex flex-col gap-2 mt-4 pt-3 border-t border-emerald-500/10">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-emerald-500/60 uppercase tracking-widest">분석 근거:</span>
                        <Badge variant="outline" className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20 px-3 py-1 cursor-help">
                          {rule.source.fileName} {rule.source.pageOrTimestamp && rule.source.pageOrTimestamp !== '-' ? `| ${rule.source.pageOrTimestamp}` : ''}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10 italic">
                        "{rule.source.content}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}




interface AnalysisOutputProps {
  results: RecommendationResult | null;
  conditions: InvestmentConditions | null;
  isLoading?: boolean;
  onSendEmail?: (email: string) => Promise<void>;
}

export function AnalysisOutput({ results, conditions, isLoading, onSendEmail }: AnalysisOutputProps) {
  const { data: session } = useSession();
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [canSendEmail, setCanSendEmail] = useState(false);
  const [plan, setPlan] = useState<string>('FREE');
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number | null>(null);
  const [isScoreExpanded, setIsScoreExpanded] = useState(false);
  const [backtestTicker, setBacktestTicker] = useState<string | null>(null);

  useEffect(() => {
    const checkFeatures = async () => {
      try {
        const res = await fetch('/api/user/features');
        if (res.ok) {
          const data = await res.json();
          setCanSendEmail(data.canSendEmail);
          setPlan(data.plan);
        }
      } catch (error) {
        console.error('Failed to check features:', error);
      }
    };

    if (session?.user) {
      checkFeatures();
    }
  }, [session]);

  const handleSendEmail = async () => {
    if (!email || !onSendEmail || !canSendEmail) return;

    setIsSendingEmail(true);
    try {
      await onSendEmail(email);
      setEmailSent(true);
      setTimeout(() => setEmailSent(false), 3000);
    } catch (error) {
      console.error('Failed to send email:', error);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const getRuleScoreColor = (score: number) => {
    if (score >= 8) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (score >= 5) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-rose-400 border-rose-500/30 bg-rose-500/10";
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="h-24 bg-gray-100 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-50 rounded-2xl animate-pulse border border-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!conditions || !results) {
    return (
      <Card className="w-full bg-white border-blue-500/5 border-dashed py-16">
        <CardContent className="flex flex-col items-center text-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-blue-500/5 border border-blue-500/20 mb-2">
            <TrendingUp className="h-10 w-10 text-blue-500/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">READY TO ANALYZE</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              투자 조건을 설정하고 분석을 시작하세요.<br />
              AI가 수천 개의 데이터를 실시간으로 스캔합니다.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if ((results?.trackA?.length || 0) === 0 && (results?.trackB?.length || 0) === 0) {
    return (
      <Card className="w-full bg-white border-rose-500/20 border-dashed py-16">
        <CardContent className="flex flex-col items-center text-center justify-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500/40 mb-2" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900 uppercase tracking-widest">No Results Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              현재 조건에 부합하는 기업 리스트를 확보하지 못했습니다.<br />
              투자 기간이나 분석 유니버스를 변경해 보세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskBadge = (risk: string | undefined) => {
    // 위험 등급이 정의되지 않았거나 유효하지 않은 경우 (임의 할당 금지)
    if (!risk || !['low', 'medium', 'high'].includes(risk.toLowerCase())) {
       return <Badge variant="outline" className="px-3 py-1 font-mono tracking-tighter text-[10px] text-gray-400 border-gray-200 bg-gray-50">RISK N/A</Badge>;
    }

    const riskKey = risk.toLowerCase() as 'low' | 'medium' | 'high';
    
    const config = {
      low: { label: 'LOW RISK', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
      medium: { label: 'MID RISK', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
      high: { label: 'HIGH RISK', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
    };

    const { label, color } = config[riskKey];
    
    return <Badge variant="outline" className={cn("px-3 py-1 font-mono tracking-tighter text-[10px]", color)}>{label}</Badge>;
  };

  const getSourceIcon = (type: 'pdf' | 'mp4') => {
    return type === 'pdf' ? (
      <FileText className="h-3 w-3 text-rose-500" />
    ) : (
      <Video className="h-3 w-3 text-sky-500" />
    );
  };

  if (selectedCompanyIndex === null) {
    const renderTrack = (title: string, description: string | undefined, data: AnalysisResult[], accentColor: string, isTrackB = false) => (
      <div className="space-y-6">
        <div className={cn("p-6 rounded-3xl border bg-white shadow-sm relative overflow-hidden", accentColor)}>
          <div className="absolute top-0 right-0 p-12 bg-gray-50 opacity-50 -mr-6 -mt-6 rounded-full blur-3xl" />
          <CardHeader className="p-0 mb-2">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", isTrackB ? "bg-purple-600" : "bg-blue-600")}>
                {isTrackB ? <Sparkles className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
              </div>
              <CardTitle className="text-2xl font-black text-gray-900">{title}</CardTitle>
            </div>
          </CardHeader>
          <p className="text-sm text-gray-600 font-medium leading-relaxed relative z-10">
            {description}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((result, idx) => {
            const displayIdx = idx + 1;
            return (
              <Card key={result.ticker || idx}
                className={cn(
                  "cursor-pointer group bg-white border-gray-200 hover:shadow-2xl transition-all duration-500 relative overflow-hidden rounded-3xl",
                  isTrackB ? "hover:border-purple-500/40" : "hover:border-blue-500/40"
                )}
                onClick={() => setSelectedCompanyIndex(isTrackB ? (results?.trackA?.length || 0) + idx : idx)}
              >
                <div className={cn(
                  "absolute left-0 top-0 h-full w-1.5 opacity-0 group-hover:opacity-100 transition-opacity",
                  isTrackB ? "bg-purple-500" : "bg-blue-500"
                )} />
                <CardContent className="p-6 flex flex-col gap-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate mb-1">
                        {result.companyName}
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 border-none font-bold">{result.ticker}</Badge>
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{result.market || 'NYSE'}</span>
                      </div>
                    </div>
                    <span className="text-3xl font-black text-gray-50 group-hover:text-gray-100 transition-colors">
                      {String(displayIdx).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {result.expertVerdict?.businessModel && (
                      <div className="bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50 mb-1">
                        <p className="text-[10px] text-gray-700 font-bold leading-relaxed break-keep">
                          <span className="text-blue-600 bg-blue-100/50 px-1.5 py-0.5 rounded mr-1.5 uppercase tracking-widest text-[8px] font-black">Business</span>
                          {result.expertVerdict.businessModel}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-2 font-medium leading-relaxed">
                      {result.description}
                    </p>
                    <div className="flex gap-2 flex-wrap mb-4">
                      <span className={cn('text-[9px] font-black px-2 py-1 rounded-lg border',
                        result.expertVerdict?.recommendation === 'BUY' || result.recommendation === 'BUY' || result.recommendation === 'STRONG_BUY'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                          : result.expertVerdict?.recommendation === 'SELL' || result.recommendation === 'SELL'
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' 
                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      )}>
                        {(result.expertVerdict?.recommendation || result.recommendation || 'HOLD').replace('_', ' ')}
                      </span>
                      {result.sector && (
                        <span className="text-[9px] text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
                          {result.sector}
                        </span>
                      )}
                      {([...(result.rules || [])].sort((a, b) => b.weight - a.weight || b.score - a.score)).slice(0, 4).map((r: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg text-[9px]">
                          <span className="text-gray-600 truncate max-w-[90px] font-bold" title={r.name}>{r.name}</span>
                          <span className={cn("font-black", r.score >= 8 ? "text-emerald-500" : r.score >= 5 ? "text-amber-500" : "text-rose-500")}>
                            {r.score.toFixed(1)}점 (w{r.weight})
                          </span>
                        </div>
                      ))}
                      {(result.rules?.length || 0) > 4 && (
                         <span className="text-[9px] font-black text-gray-400 self-center">+{result.rules!.length - 4}</span>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">SCORE</p>
                        <div className="flex items-baseline gap-1">
                          <span className={cn("text-2xl font-black font-mono", isTrackB ? "text-purple-600" : "text-blue-600")}>
                            {result.score.toFixed(0)}
                          </span>
                          <span className="text-[10px] text-gray-400 font-bold">/100</span>
                        </div>
                      </div>
                      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all", isTrackB ? "bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white" : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white")}>
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );

    return (
      <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center space-y-3 py-10">
          <Badge className="bg-blue-600 text-white border-none py-1.5 px-6 font-black tracking-[0.3em] uppercase mb-4">
            Analysis Protocol complete
          </Badge>
          <h2 className="text-4xl font-black text-gray-900 tracking-tight">AI Dual-Track Investment Report</h2>
          <p className="text-gray-500 max-w-2xl mx-auto font-medium">
            전통적 계량 지표(A)와 지능형 유닛 경제성(B)을 결합한 하이브리드 포트폴리오 스캔 결과입니다.
          </p>
        </div>

        {renderTrack("Master Track A: Blue Chips", results.trackADescription, results.trackA, "border-blue-500/10")}
        {renderTrack("Alpha Track B: Growth Prospects", results.trackBDescription, results.trackB, "border-purple-500/10", true)}

        <BacktestDialog 
          ticker={backtestTicker || ''} 
          isOpen={!!backtestTicker} 
          onClose={() => setBacktestTicker(null)} 
        />
      </div>
    );
  }

  const allResults = [...(results?.trackA || []), ...(results?.trackB || [])];
  const result = allResults[selectedCompanyIndex];

  if (!result) return null;

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="text-gray-500 hover:text-gray-900 pl-0 hover:bg-transparent tracking-widest text-xs font-bold uppercase"
          onClick={() => setSelectedCompanyIndex(null)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Master List
        </Button>
        {result.expertVerdict && (
          <Badge className="bg-blue-600/10 text-blue-600 border border-blue-600/20 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-[0.2em] animate-pulse">
            Alpha Expert Intelligence Mode
          </Badge>
        )}
      </div>

      <Card className="w-full bg-white backdrop-blur-xl border-gray-200 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-32 bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />
        <CardHeader className="pb-6 pt-10 px-8 border-b border-gray-200/50 bg-gray-50/20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <CardTitle className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 leading-none">
                  {result.companyName}
                </CardTitle>
                {getRiskBadge(result.riskLevel)}
                {(result as any).failedCritical && (
                  <Badge className="bg-rose-500 text-white border-none py-1.5 px-3 font-black text-xs">CRITICAL CONDITION FAILED</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-gray-500 mt-3">
                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5">{result.ticker}</Badge>
                <span className="text-gray-600">•</span>
                <span className="uppercase font-bold tracking-wider">{result.market}</span>
                <span className="text-gray-600">•</span>
                <span className="text-emerald-500/80 flex items-center gap-1"><Activity className="h-3 w-3" /> LIVE DATA CONNECTED</span>
              </div>
            </div>

            <div className="flex gap-2">
            </div>


          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-10">
            <div className="space-y-6">

              {/* 전문가 최종 판정 (Phase 2 - Expert Verdict) */}
              {result.expertVerdict && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                     <Brain className="h-48 w-48" />
                  </div>
                  <div className="relative z-10 space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] flex items-center gap-2">
                        <Sparkles className="h-4 w-4" /> Alpha Expert Verdict
                      </h4>
                      <Badge className={cn(
                        "px-4 py-1 text-xs font-black border-none",
                        result.expertVerdict.recommendation === 'BUY' ? "bg-emerald-500 text-white" :
                        result.expertVerdict.recommendation === 'SELL' ? "bg-rose-500 text-white" :
                        "bg-gray-100 text-gray-900"
                      )}>
                        {result.expertVerdict.recommendation || 'HOLD'} OPINION
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-3xl font-black text-gray-900 tracking-tight leading-tight">
                        {result.expertVerdict.title || '분석 중인 주제가 없습니다.'}
                      </h3>
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <span>Conviction Score:</span>
                        <span className="text-blue-600 font-black">{result.expertVerdict.convictionScore || 0}%</span>
                        <div className="h-1 w-24 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600" style={{ width: `${result.expertVerdict.convictionScore || 0}%` }} />
                        </div>
                      </div>
                    </div>

                    {result.expertVerdict?.businessModel && (
                      <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/50">
                        <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2 mb-2">
                          <Target className="h-3 w-3" /> 비즈니스 모델 & 핵심 제품
                        </h5>
                        <p className="text-sm text-gray-700 leading-relaxed font-medium">
                          {result.expertVerdict.businessModel}
                        </p>
                      </div>
                    )}

                    <p className="text-lg text-gray-700 leading-relaxed font-serif italic border-l-4 border-blue-100 pl-6 py-2">
                      "{result.expertVerdict.summary || '상세 요약이 생성되지 않았습니다.'}"
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-50">
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <Target className="h-3 w-3" /> 결정적 매수 근거
                        </h5>
                        <ul className="space-y-3">
                          {(result.expertVerdict.keyPoints || []).map((p: string, idx: number) => (
                            <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              {p}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <AlertCircle className="h-3 w-3 text-rose-400" /> 리스크 점검 사항
                        </h5>
                        <ul className="space-y-3">
                          {(result.expertVerdict.risks || []).map((r: string, idx: number) => (
                            <li key={idx} className="flex gap-3 text-sm text-gray-700 font-medium">
                              <div className="h-1.5 w-1.5 rounded-full bg-rose-400 mt-2 shrink-0" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Citations from Source Material */}
                    {Array.isArray(result.expertVerdict.authorCitations) && result.expertVerdict.authorCitations.length > 0 && (
                      <div className="pt-6 border-t border-gray-50">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-3 w-3" /> 증명된 원천 데이터 인용 (Author Citations)
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {result.expertVerdict.authorCitations.map((cite: any, idx: number) => {
                            // 객체가 아닐 경우 (AI가 단순 문자열 배열을 준 경우) 방어 코드
                            const fileName = typeof cite === 'string' ? cite : cite?.fileName || 'Unknown Source';
                            const info = typeof cite === 'object' ? cite?.pageOrTimestamp : '';
                            
                            return (
                              <Badge key={idx} variant="outline" className="text-[10px] font-bold bg-gray-50 text-gray-500 border-gray-200 px-3 py-1">
                                {fileName} {info && `(${info})`}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 수익률 분석 섹션 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '1년 전', value: result.returnRates?.oneYear, price: result.returnRates?.prices?.oneYearAgo },
                  { label: '6개월 전', value: result.returnRates?.sixMonths, price: result.returnRates?.prices?.sixMonthsAgo },
                  { label: '3개월 전', value: result.returnRates?.threeMonths, price: result.returnRates?.prices?.threeMonthsAgo },
                  { label: '1개월 전', value: result.returnRates?.oneMonth, price: result.returnRates?.prices?.oneMonthAgo },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-between h-full relative overflow-hidden">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{item.label} 매수 시</p>
                      <p className={cn(
                        "text-xl font-black font-mono mb-2",
                        (item.value || 0) > 0 ? "text-emerald-500" : (item.value || 0) < 0 ? "text-rose-500" : "text-gray-400"
                      )}>
                        {item.value != null ? `${item.value > 0 ? '+' : ''}${item.value.toFixed(1)}%` : 'N/A'}
                      </p>
                    </div>
                    {item.price != null && result.returnRates?.prices?.current != null && (
                      <div className="border-t border-gray-100 pt-2.5 mt-1 flex justify-between items-center text-[9px] font-mono font-medium text-gray-500">
                        <div className="flex flex-col text-left">
                          <span className="text-gray-400 mb-0.5 tracking-tighter">당시</span>
                          <span>${item.price.toFixed(2)}</span>
                        </div>
                        <ArrowRight className="h-2.5 w-2.5 text-gray-300 mx-1" />
                        <div className="flex flex-col text-right">
                          <span className="text-gray-400 mb-0.5 tracking-tighter">현재</span>
                          <span className="text-gray-900 font-bold">${result.returnRates.prices.current.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 전략 매칭 대시보드 */}
              {result.strategyMatch && (
                <div className="bg-[#080b10] p-8 rounded-3xl border border-gray-800 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-32 bg-emerald-500/5 blur-[80px] pointer-events-none rounded-full" />
                  <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Customized Strategy Matching Analysis
                  </h4>
                  <StrategyMatchDashboard score={result.strategyMatch} />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 p-8 rounded-2xl bg-gray-50/80 border border-gray-200 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 to-transparent opacity-50" />
                  <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" /> Strategic Assessment & Narratives
                  </h4>
                  <p className="text-[15px] text-gray-700 leading-loose font-medium whitespace-pre-line">
                    {result.reasoning || result.investmentThesis || '조회된 AI 전략 상세 분석 내역이 없습니다.'}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Newspaper className="h-12 w-12" />
                    </div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Activity className="h-3 w-3" /> 시장 감성 (Market Sentiment)
                    </p>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="text-3xl font-black text-gray-900">{result.sentiment?.score}</div>
                      <Badge className={cn("px-2 py-0.5 text-[9px] font-black border-none shadow-none", result.sentiment?.score && result.sentiment.score >= 7 ? "bg-emerald-500/10 text-emerald-600" : "bg-blue-500/10 text-blue-600")}>
                        {result.sentiment?.label === 'Positive' ? '긍정적' : result.sentiment?.label === 'Negative' ? '부정적' : '중립'}
                      </Badge>
                    </div>
                    {result.sentiment?.summary && (
                      <p className="text-[11px] text-gray-600 mb-4 italic leading-relaxed">"{result.sentiment.summary}"</p>
                    )}
                    {result.sentiment?.recentHeadlines && result.sentiment.recentHeadlines.length > 0 && (
                      <div className="space-y-1.5 pt-3 border-t border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1.5 font-mono">분석 대상 뉴스 헤드라인 (Yahoo Finance)</p>
                        {result.sentiment.recentHeadlines.slice(0, 3).map((h: any, idx: number) => (
                           <a 
                             key={idx} 
                             href={h.url} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="flex gap-2 items-start group/news hover:bg-blue-50/50 p-1 rounded transition-colors"
                           >
                             <div className="mt-1.5 w-1 h-1 rounded-full bg-blue-400 shrink-0 group-hover/news:bg-blue-600 transition-colors" />
                             <span className="text-[10px] text-gray-500 line-clamp-1 group-hover/news:text-blue-600 transition-colors font-medium">{h.title}</span>
                             <ExternalLink className="h-2.5 w-2.5 text-gray-300 opacity-0 group-hover/news:opacity-100 transition-all shrink-0 mt-0.5" />
                           </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Target className="h-3 w-3" /> 성장 잠재력 (Growth Potential)
                    </p>
                    <div className="text-xl font-black text-blue-600 mb-1">
                      {result.prediction?.growthPotential === 'Bullish' ? '상승 전망' : result.prediction?.growthPotential === 'Bearish' ? '하락 전망' : '중립'}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                       <span className="text-[10px] text-gray-400 uppercase font-black tracking-widest">예상 수익률</span>
                       <span className="text-xs font-bold font-mono text-emerald-500">+{result.prediction?.expectedReturn}%</span>
                    </div>
                    <Progress value={result.prediction?.confidence || 70} className="h-1 mt-3 bg-gray-100" />
                    {result.prediction?.logic && (
                      <div className="mt-4 pt-3 border-t border-gray-100">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 font-mono underline decoration-blue-500/20 underline-offset-4">분석 모델 예측 근거</p>
                        <p className="text-[11px] text-gray-600 leading-relaxed italic">
                          {result.prediction.logic}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {result.sources && result.sources.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-gray-200/50">
                  <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3 w-3 text-gray-600" />
                    Reference Sources
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.sources.slice(0, 4).map((source: any, sIdx: number) => {
                      const hasAccess = (session?.user as any)?.features?.evidence_links || source.type === 'pdf';
                      return (
                        <div key={sIdx} className={cn(
                          "group/item p-4 rounded-xl border transition-all duration-300 relative",
                          hasAccess
                            ? "bg-gray-100/30 border-gray-200 hover:border-gray-700 hover:bg-gray-100"
                            : "bg-gray-50/20 border-gray-900 grayscale opacity-40"
                        )}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 overflow-hidden mr-2">
                              {getSourceIcon(source.type)}
                              <span className="text-[10px] font-bold text-gray-500 truncate">
                                {source.folderPath && source.folderPath !== '/' ? `${source.folderPath}/` : ''}{source.fileName}
                                {source.pageOrTimestamp && source.pageOrTimestamp !== '-' ? ` (${source.pageOrTimestamp})` : ''}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[8px] font-mono border-gray-200 text-gray-400 bg-gray-50 shrink-0">
                              REF
                            </Badge>
                          </div>
                          {hasAccess ? (
                            <p className="text-[11px] text-gray-500 line-clamp-3 italic leading-relaxed border-l-2 border-blue-500/20 pl-2">
                              "{source.content}"
                            </p>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-2 gap-2 opacity-60">
                              <Lock className="h-4 w-4 text-gray-500" />
                              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-center">Reference Locked<br />Premium access required</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <BacktestDialog 
        ticker={backtestTicker || ''} 
        isOpen={!!backtestTicker} 
        onClose={() => setBacktestTicker(null)} 
      />
    </div>
  );
}
