'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle, ChevronDown, ChevronUp, Mail, Newspaper, Lock, Sparkles, ArrowLeft, ArrowRight, Activity } from 'lucide-react';
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
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState<number | null>(null);
  const [isScoreExpanded, setIsScoreExpanded] = useState(false);

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

  if (!conditions) {
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
          {results.map((result, idx) => (
            <Card key={result.ticker || idx}
              className="cursor-pointer group bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-500/40 hover:shadow-lg transition-all duration-300 relative overflow-hidden"
              onClick={() => setSelectedCompanyIndex(idx)}
            >
              <div className="absolute left-0 top-0 h-full w-[3px] bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-black text-gray-900 group-hover:text-blue-600 transition-colors flex items-center gap-2 mb-2 line-clamp-1">
                      {result.companyName}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none px-2 text-[10px]">{result.ticker}</Badge>
                      <span className="text-gray-500 text-[10px] uppercase font-bold">{result.market}</span>
                      {getRiskBadge(result.riskLevel)}
                    </div>
                  </div>
                  <span className="text-3xl font-black text-gray-100 group-hover:text-blue-50 transition-colors">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-end justify-between mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Total Score</p>
                    <p className="text-2xl font-black text-gray-900 font-mono leading-none">
                      {result.totalRuleScore}<span className="text-sm text-gray-400 font-medium">/{result.maxPossibleScore}</span>
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-blue-50 flex items-center justify-center transition-colors shadow-sm border border-gray-100 group-hover:border-blue-100">
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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
      </div>
    );
  }

  const result = results[selectedCompanyIndex];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-right-4 duration-500">
      <Button
        variant="ghost"
        className="text-gray-500 hover:text-gray-900 pl-0 hover:bg-transparent tracking-widest text-xs font-bold uppercase"
        onClick={() => setSelectedCompanyIndex(null)}
      >
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Master List
      </Button>

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
              </div>
              <div className="flex items-center gap-2 text-sm font-mono text-gray-500 mt-3">
                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold px-2 py-0.5">{result.ticker}</Badge>
                <span className="text-gray-600">•</span>
                <span className="uppercase font-bold tracking-wider">{result.market}</span>
                <span className="text-gray-600">•</span>
                <span className="text-emerald-500/80 flex items-center gap-1"><Activity className="h-3 w-3" /> LIVE DATA CONNECTED</span>
              </div>
            </div>

            <div className="text-left sm:text-right bg-gray-50/50 p-4 rounded-xl border border-gray-200/50 backdrop-blur-sm">
              <p className="text-[10px] font-mono text-gray-500 tracking-widest mb-1 uppercase font-black">AI Assessment Score</p>
              <div className="flex items-baseline gap-1 justify-start sm:justify-end">
                <span className="text-4xl font-black text-blue-400 font-mono tracking-tighter">{result.totalRuleScore}</span>
                <span className="text-lg text-gray-600 font-mono">/{result.maxPossibleScore}</span>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-8 space-y-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-1 gap-10">
            <div className="space-y-6">

              <div className="p-8 rounded-2xl bg-gray-50/80 border border-gray-200 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 to-transparent" />
                <h4 className="text-xs font-black text-blue-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Strategic Context & Assessment
                </h4>
                <p className="text-[15px] text-gray-600 leading-loose font-medium whitespace-pre-line text-justify">
                  {result.reasoning}
                </p>
              </div>

              {result.totalRuleScore !== undefined && result.maxPossibleScore !== undefined && (
                <div className="w-full">
                  <Collapsible
                    open={isScoreExpanded}
                    onOpenChange={setIsScoreExpanded}
                    className="border border-gray-200 rounded-2xl bg-gray-50/30 overflow-hidden"
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full p-6 h-auto flex items-center justify-between hover:bg-gray-100 hover:text-gray-900 group">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-emerald-500/70" />
                          <span className="font-black text-xs uppercase tracking-widest text-gray-600 group-hover:text-blue-600 transition-colors">
                            Detailed Evidence & Score Breakdown
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="bg-gray-100 border-gray-700 text-gray-500 font-mono text-[10px]">
                            {result.ruleScores?.length || 0} POINTS ANALYZED
                          </Badge>
                          {isScoreExpanded ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
                        </div>
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="p-6 border-t border-gray-200 bg-gray-50/80">
                        <div className="space-y-4">
                          {result.ruleScores?.map((rule, rIdx) => (
                            <div key={rIdx} className="p-4 rounded-xl border border-gray-200/80 bg-[#0c0f14] hover:border-gray-700 transition-colors">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                                <span className="text-gray-300 font-bold text-sm leading-relaxed max-w-3xl border-l-2 border-blue-500/30 pl-3">
                                  {rule.rule}
                                </span>
                                <Badge className={cn("shrink-0 uppercase font-black tracking-widest text-[9px]",
                                  rule.score >= 8 ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30" :
                                    rule.score >= 5 ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30" : "bg-rose-500/20 text-rose-400 hover:bg-rose-500/30"
                                )}>
                                  Score: {rule.score}
                                </Badge>
                              </div>
                              <div className="text-[11px] text-gray-400 italic bg-gray-800/50 border border-gray-700 p-3 rounded-md line-clamp-3 mt-3">
                                {rule.reason || 'AI System calculated this score based on learned models.'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              )}

              {result.sources.length > 0 && (
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
                            {getSourceIcon(source.type)}
                            <Badge variant="outline" className="text-[9px] font-mono border-gray-700 text-gray-500 bg-gray-50">
                              {source.pageOrTimestamp !== '-' ? `ID.${source.pageOrTimestamp}` : 'SYS.REF'}
                            </Badge>
                          </div>
                          {hasAccess ? (
                            <p className="text-[11px] text-gray-500 line-clamp-2 italic leading-relaxed">
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
    </div>
  );
}
