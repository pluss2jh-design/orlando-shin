'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle, ChevronDown, ChevronUp, Mail, Newspaper, Lock, Sparkles } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AnalysisResult, InvestmentConditions } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';

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

    const confirmed = window.confirm('이메일 발송을 위해 API 비용이 발생할 수 있습니다. 계속하시겠습니까?');
    if (!confirmed) return;

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
          <Card key={i} className="w-full bg-[#0a0c10] border-gray-800 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent animate-pulse" />
            <CardContent className="p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded bg-gray-900 border border-gray-800 animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 bg-gray-900 rounded animate-pulse w-1/4" />
                  <div className="h-4 bg-gray-900 rounded animate-pulse w-1/6" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="h-32 bg-gray-900 rounded animate-pulse" />
                </div>
                <div className="space-y-4">
                  <div className="h-32 bg-gray-900 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!conditions) {
    return (
      <Card className="w-full bg-[#0a0c10] border-gray-800 border-dashed py-16">
        <CardContent className="flex flex-col items-center text-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-blue-500/5 border border-blue-500/20 mb-2">
            <TrendingUp className="h-10 w-10 text-blue-500/40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-200">READY TO ANALYZE</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
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
      <Card className="w-full bg-[#0a0c10] border-rose-500/20 border-dashed py-16">
        <CardContent className="flex flex-col items-center text-center justify-center space-y-4">
          <AlertCircle className="h-12 w-12 text-rose-500/40 mb-2" />
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-rose-200 uppercase tracking-widest">Data Not Found</h3>
            <p className="text-gray-400 max-w-sm mx-auto">
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

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black text-blue-500 uppercase tracking-[0.2em] flex items-center gap-3">
          <div className="w-8 h-[1px] bg-blue-500" />
          AI Analysis Core Output
        </h3>
        <Badge variant="outline" className="text-[10px] font-mono border-gray-800 text-gray-400">
          U_D.{new Date().toLocaleTimeString()}
        </Badge>
      </div>

      {results.map((result, idx) => (
        <Card key={result.ticker || idx} className="w-full bg-[#0d1117]/80 backdrop-blur-xl border-gray-800 hover:border-blue-500/30 transition-all duration-500 overflow-hidden group shadow-2xl">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-20 group-hover:opacity-100 transition-opacity" />

          <CardHeader className="pb-4 pt-8 px-8 border-b border-gray-800/50 bg-gradient-to-r from-blue-500/5 to-transparent">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="absolute -inset-2 bg-blue-500/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-16 h-16 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center text-2xl font-black text-blue-500 shadow-inner group-hover:border-blue-500/50 transition-colors">
                    {idx + 1}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <CardTitle className="text-2xl font-black tracking-tight text-white group-hover:text-blue-400 transition-colors">
                      {result.companyName}
                    </CardTitle>
                    {getRiskBadge(result.riskLevel)}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span className="text-blue-500/70">$</span> {result.ticker}
                    <span className="text-gray-700">•</span>
                    <span className="uppercase">{result.market}</span>
                    <span className="text-gray-700">•</span>
                    <span className="text-emerald-500/80">LIVE DATA CONNECTED</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] font-mono text-gray-400 tracking-tighter mb-1 uppercase">Confidence Level</p>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                    <div
                      className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
                      style={{ width: `${result.confidenceScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-black text-blue-400 font-mono">{result.confidenceScore}%</span>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-7 space-y-6">
                <div className="p-6 rounded-2xl bg-gray-950/50 border border-gray-800/50 relative overflow-hidden group/box">
                  <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-blue-500/50" />
                    Strategic Thesis
                  </h4>
                  <p className="text-sm text-gray-300 leading-relaxed font-medium">
                    {result.reasoning}
                  </p>
                </div>

                {result.sources.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Lock className="h-3 w-3 text-rose-500/50" />
                      Evidence Matrix
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.sources.slice(0, 4).map((source, sIdx) => {
                        const hasAccess = (session?.user as any)?.features?.evidence_links || source.type === 'pdf';
                        return (
                          <div key={sIdx} className={cn(
                            "group/item p-4 rounded-xl border transition-all duration-300 relative",
                            hasAccess
                              ? "bg-gray-900/30 border-gray-800 hover:border-gray-700"
                              : "bg-gray-950/20 border-gray-900 grayscale opacity-40"
                          )}>
                            <div className="flex items-center justify-between mb-2">
                              {getSourceIcon(source.type)}
                              <span className="text-[10px] font-mono text-gray-400">
                                {source.pageOrTimestamp !== '-' ? `ID.${source.pageOrTimestamp}` : 'GEN_ANALYSIS'}
                              </span>
                            </div>
                            {hasAccess ? (
                              <p className="text-[11px] text-gray-400 line-clamp-2 italic leading-relaxed">
                                "{source.content}"
                              </p>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-1 gap-1">
                                <Lock className="h-3 w-3 text-gray-600" />
                                <span className="text-[9px] text-gray-700 font-bold uppercase tracking-tighter">Encrypted</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-5 space-y-6">
                {result.totalRuleScore !== undefined && result.maxPossibleScore !== undefined && (
                  <div className="p-6 rounded-2xl bg-blue-500/[0.02] border border-blue-500/10 shadow-inner">
                    <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] font-black text-blue-500/70 uppercase tracking-widest">Score Breakdown</h4>
                      <div className="text-2xl font-black text-blue-400 font-mono tracking-tighter">
                        {result.totalRuleScore}<span className="text-gray-700 text-sm mx-1">/</span>{result.maxPossibleScore}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {result.ruleScores?.map((rule, rIdx) => (
                        <div key={rIdx} className="group/rule relative">
                          <div className="flex items-center justify-between mb-1 text-[11px]">
                            <span className="text-gray-300 font-medium">{rule.rule.split(':')[0]}</span>
                            <span className={cn("font-mono font-black",
                              rule.score >= 8 ? "text-emerald-400" :
                                rule.score >= 5 ? "text-amber-400" : "text-rose-400"
                            )}>
                              {rule.score}.0
                            </span>
                          </div>
                          <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full transition-all duration-700",
                                rule.score >= 8 ? "bg-emerald-500/50" :
                                  rule.score >= 5 ? "bg-amber-500/50" : "bg-rose-500/50"
                              )}
                              style={{ width: `${(rule.score / 10) * 100}%` }}
                            />
                          </div>
                          <div className="opacity-0 group-hover/rule:opacity-100 absolute -top-10 left-0 bg-gray-900 text-[10px] p-2 rounded border border-gray-800 pointer-events-none transition-opacity z-10 w-full shadow-2xl">
                            {rule.reason}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-6 rounded-2xl bg-emerald-500/[0.02] border border-emerald-500/10 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest">ROI Estimate</p>
                    <p className="text-xs text-gray-400 italic">Projected Performance</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">
                      +{result.expectedReturnRate}%
                    </div>
                    <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500 py-0 h-4 uppercase">Target HIT</Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className={cn(
        "w-full bg-gradient-to-br from-[#0c0f14] to-transparent border-gray-800 shadow-2xl overflow-hidden relative group",
        canSendEmail ? "border-blue-500/10" : "border-gray-800"
      )}>
        {!canSendEmail && (
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-12 h-12 rounded-full bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto mb-4">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest mb-1">Encrypted Feature</h4>
              <p className="text-xs text-gray-400 mb-6">분석 결과 이메일 자동 발송은 PREMIUM 전용입니다</p>
              <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold border-gray-700 hover:border-blue-500 transition-colors">
                UPGRADE SYSTEM
              </Button>
            </div>
          </div>
        )}
        <CardContent className="p-10">
          <div className="flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1 space-y-2">
              <h4 className="text-xl font-black text-white flex items-center gap-3">
                <Mail className="h-6 w-6 text-blue-500" />
                Data Export Protocol
              </h4>
              <p className="text-sm text-gray-400 max-w-md">
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
                  className="bg-gray-950 border-gray-800 text-white font-mono text-xs h-12 w-full md:w-72 focus:border-blue-500 transition-all"
                />
                <Button
                  onClick={handleSendEmail}
                  disabled={!email || isSendingEmail || !onSendEmail}
                  className="h-12 px-8 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-widest transition-all"
                >
                  {isSendingEmail ? 'SYNC...' : emailSent ? 'READY' : 'EXECUTE'}
                </Button>
              </div>
              <p className="text-[10px] text-gray-600 font-mono text-center md:text-right">
                ! WARNING: API USAGE COSTS MAY APPLY
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


