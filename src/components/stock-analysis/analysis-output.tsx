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
import { AnalysisResult, InvestmentConditions, StrategyMatchScore, MatchRuleResult, MatchRuleSource } from '@/types/stock-analysis';
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

  results: AnalysisResult[];
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
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i} className="w-full bg-white border-gray-200 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-pulse" />
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded bg-gray-100 border border-gray-200 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-100 rounded animate-pulse w-1/4" />
                  <div className="h-4 bg-gray-100 rounded animate-pulse w-1/6" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="h-32 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div className="h-32 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!conditions && results.length === 0) {
    return (
      <Card className="w-full bg-white border-gray-200 border-dashed py-16">
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

  if (results.length === 0) {
    return (
      <Card className="w-full bg-white border-rose-500/20 border-dashed py-16">
        <CardContent className="flex flex-col items-center text-center justify-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500/40 mb-2" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-rose-200 uppercase tracking-widest">Data Not Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              현재 조건에 부합하는 기업 리스트를 확보하지 못했습니다.<br />
              투자 기간이나 분석 모델을 변경해 보세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskBadge = (risk: AnalysisResult['riskLevel']) => {
    const config = {
      low: { label: 'LOW RISK', color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
      medium: { label: 'MID RISK', color: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
      high: { label: 'HIGH RISK', color: 'text-rose-400 border-rose-500/30 bg-rose-500/10' },
    };
    const { label, color } = config[risk];
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
    const sortedResults = [...results].sort((a, b) => {
      const bScore = b.strategyMatch?.matchPercentage ?? 0;
      const aScore = a.strategyMatch?.matchPercentage ?? 0;
      return bScore - aScore;
    });

    const stepColors = [
      'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500',
      'bg-orange-500', 'bg-rose-500', 'bg-cyan-500',
    ];
    const stepLabels = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7'];

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h3 className="text-xl font-black text-gray-900 px-4 py-2 bg-gradient-to-r from-blue-600/20 to-transparent border-l-4 border-blue-500 tracking-wide">
            ENTERPRISE SCAN RESULTS
          </h3>
          <Badge variant="outline" className="text-[10px] font-mono border-gray-200 text-gray-500 bg-gray-100/50">
            {new Date().toLocaleString()} SCANNED
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedResults.map((result, idx) => {
            const originalIdx = results.indexOf(result);
            return (
              <Card key={result.ticker || idx}
                className="cursor-pointer group bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
                onClick={() => setSelectedCompanyIndex(originalIdx)}
              >
                <div className="absolute left-0 top-0 h-full w-[3px] bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardContent className="p-5 flex flex-col gap-4">
                  {/* 헤더: 기업명 + 순번 */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                          {result.companyName}
                        </h3>
                        {(result as any).failedCritical && (
                          <Badge className="bg-rose-500 text-white border-none text-[9px] font-black animate-pulse">CRITICAL FAIL</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none px-2 text-[10px]">{result.ticker}</Badge>
                        <span className="text-gray-400 text-[10px] uppercase font-bold">{result.market}</span>
                        {getRiskBadge(result.riskLevel)}
                      </div>
                    </div>
                    <span className="text-3xl font-black text-gray-100 group-hover:text-blue-50 transition-colors shrink-0 ml-2">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>

                  {/* 섹터 */}
                  {result.sector && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sector</span>
                      <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{result.sector}</span>
                    </div>
                  )}

                  {/* 규칙 매칭 현황 (미니 뷰) */}
                  {result.strategyMatch && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Logic Matching</p>
                        <span className="text-[10px] font-bold text-gray-600">{result.strategyMatch.passedCount}/{result.strategyMatch.totalCount} passed</span>
                      </div>
                      <div className="flex gap-1">
                        {result.strategyMatch.rules.map((rule, si) => (
                          <div key={si} className={cn(
                            'h-1.5 flex-1 rounded-full transition-all',
                            rule.passed ? 'bg-emerald-500' : 'bg-gray-200'
                          )} title={rule.name} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 하단: 점수 + 화살표 */}
                  <div className="flex items-end justify-between pt-3 border-t border-gray-100">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">STRATEGY ALIGNMENT</p>
                      {result.strategyMatch ? (
                        <div className="flex items-baseline gap-1">
                          <p className={cn('text-2xl font-black font-mono leading-none',
                            result.strategyMatch.matchPercentage >= 80 ? 'text-blue-600' :
                              result.strategyMatch.matchPercentage >= 50 ? 'text-amber-500' : 'text-rose-400'
                          )}>{(result.strategyMatch.matchPercentage ?? 0).toFixed(0)}%</p>
                          <span className="text-xs text-gray-400">match</span>
                        </div>
                      ) : (
                        <p className="text-2xl font-black text-gray-900 font-mono leading-none">N/A</p>
                      )}
                      <p className="text-[10px] font-bold text-blue-500 mt-0.5">{result.strategyMatch?.allocationLabel || '분석 완료'}</p>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest border-blue-100 hover:bg-blue-50 text-blue-600 rounded-lg group/btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBacktestTicker(result.ticker || null);
                        }}
                      >
                        <History className="h-3.5 w-3.5 mr-1.5 transition-transform group-hover/btn:rotate-[-45deg]" />
                        Backtest
                      </Button>
                      <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm border border-gray-100 group-hover:border-blue-100 shrink-0">
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className={cn(
          "w-full bg-gradient-to-br from-gray-50 to-transparent border-gray-200 shadow-2xl overflow-hidden relative group mt-12",
          canSendEmail ? "border-blue-500/10 mt-12" : "border-gray-200 mt-12"
        )}>
          {!canSendEmail && (
            <div className="absolute inset-0 bg-gray-50/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-12 h-12 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-4">
                  <Lock className="h-5 w-5 text-gray-500" />
                </div>
                <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-1">Encrypted Feature</h4>
                <p className="text-xs text-gray-500 mb-6">분석 결과 이메일 자동 발송은 PREMIUM 전용입니다</p>
                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold border-gray-700 hover:border-blue-500 transition-colors">
                  UPGRADE SYSTEM
                </Button>
              </div>
            </div>
          )}
          <CardContent className="p-10">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 space-y-2">
                <h4 className="text-xl font-black text-gray-900 flex items-center gap-3">
                  <Mail className="h-6 w-6 text-blue-500" />
                  Data Export Protocol
                </h4>
                <p className="text-sm text-gray-500 max-w-md">
                  심층 분석 보고서를 지정된 이메일 주소로 즉시 전송합니다.<br />
                  모든 분석 근거와 재무 데이터가 매핑된 완성된 리포트입니다.
                </p>
              </div>
              <div className="w-full md:w-auto flex flex-col gap-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="AUTHORITY_EMAIL@SECURE.COM"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-gray-50 border-gray-200 text-gray-900 font-mono text-xs h-12 w-full md:w-72 focus:border-blue-500 transition-all"
                  />
                  <Button
                    onClick={handleSendEmail}
                    disabled={!email || isSendingEmail || !onSendEmail}
                    className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-gray-900 font-black uppercase text-xs tracking-widest transition-all"
                  >
                    {isSendingEmail ? 'SYNC...' : emailSent ? 'READY' : 'EXECUTE'}
                  </Button>
                </div>
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

  const result = results[selectedCompanyIndex];

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
                    {result.expertVerdict.authorCitations && result.expertVerdict.authorCitations.length > 0 && (
                      <div className="pt-6 border-t border-gray-50">
                        <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <FileText className="h-3 w-3" /> 증명된 원천 데이터 인용 (Author Citations)
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {result.expertVerdict.authorCitations.map((cite: any, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px] font-bold bg-gray-50 text-gray-500 border-gray-200 px-3 py-1">
                              {cite.fileName} {cite.pageOrTimestamp && `(${cite.pageOrTimestamp})`}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 수익률 분석 섹션 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: '1년 전', value: result.returnRates?.oneYear },
                  { label: '6개월 전', value: result.returnRates?.sixMonths },
                  { label: '3개월 전', value: result.returnRates?.threeMonths },
                  { label: '1개월 전', value: result.returnRates?.oneMonth },
                ].map((item, i) => (
                  <div key={i} className="bg-white p-4 rounded-xl border border-gray-200 text-center">
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mb-1">{item.label} 매수 시</p>
                    <p className={cn(
                      "text-xl font-black font-mono",
                      (item.value || 0) > 0 ? "text-emerald-500" : (item.value || 0) < 0 ? "text-rose-500" : "text-gray-400"
                    )}>
                      {item.value != null ? `${item.value > 0 ? '+' : ''}${item.value.toFixed(1)}%` : 'N/A'}
                    </p>
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
                    {result.reasoning}
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
                        {result.sentiment.recentHeadlines.slice(0, 3).map((h, idx) => (
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
                    {result.sources.slice(0, 4).map((source, sIdx) => {
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
