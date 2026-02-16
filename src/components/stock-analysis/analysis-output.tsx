'use client';

import React, { useState } from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle, ChevronDown, ChevronUp, Mail, Newspaper } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSendEmail = async () => {
    if (!email || !onSendEmail) return;
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
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 animate-pulse" />
            시장 유니버스 분석 중...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 border-b pb-4 last:border-0">
                <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!conditions) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            분석 결과 (Analysis Result)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>투자 기간을 설정하고 분석하기 버튼을 클릭하세요</p>
            <p className="text-sm mt-2">AI 전략을 바탕으로 S&P 500, Russell 1000, Dow Jones 기업 중 최적의 TOP 5를 추천합니다</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (results.length === 0) {
    return (
      <Card className="w-full border-dashed">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-5 w-5" />
            분석 결과 없음
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-30" />
            <p className="font-medium text-foreground">조건에 부합하는 기업을 찾지 못했습니다</p>
            <p className="text-sm mt-2 max-w-xs mx-auto">
              학습된 전략이나 시장 상황에 따라 추천 대상이 없을 수 있습니다. 
              학습 데이터가 충분한지 확인하거나 투자 기간을 조정해보세요.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getRiskBadge = (risk: AnalysisResult['riskLevel']) => {
    const config = {
      low: { label: '낮은 위험', variant: 'default', className: 'bg-green-500' },
      medium: { label: '중간 위험', variant: 'default', className: 'bg-yellow-500' },
      high: { label: '높은 위험', variant: 'destructive', className: '' },
    };
    const { label, variant, className } = config[risk];
    return <Badge variant={variant as any} className={className}>{label}</Badge>;
  };

  const getSourceIcon = (type: 'pdf' | 'mp4') => {
    return type === 'pdf' ? (
      <FileText className="h-4 w-4 text-red-500" />
    ) : (
      <Video className="h-4 w-4 text-blue-500" />
    );
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2 px-1">
        <TrendingUp className="h-6 w-6 text-primary" />
        AI 추천 TOP 5 기업
      </h3>
      
      {results.map((result, idx) => (
        <Card key={result.ticker || idx} className="w-full overflow-hidden border-l-4 border-l-primary">
          <CardHeader className="pb-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-lg font-bold px-3 py-1">#{idx + 1}</Badge>
                <div>
                  <CardTitle className="text-xl font-bold">{result.companyName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{result.ticker} • {result.market}</p>
                </div>
              </div>

            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <span className="text-sm font-medium">리스크 평가</span>
                  {getRiskBadge(result.riskLevel)}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  투자 논거
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {result.reasoning}
                </p>
              </div>
              
              {result.totalRuleScore !== undefined && result.maxPossibleScore !== undefined && (
                <Collapsible className="space-y-4 p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                      <span className="text-sm font-bold flex items-center gap-2">
                        종합 평가 점수
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </span>
                      <span className="text-xl font-black text-primary">
                        {result.totalRuleScore} / {result.maxPossibleScore}점
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <Progress value={(result.totalRuleScore / result.maxPossibleScore) * 100} className="h-2" />
                  
                  <CollapsibleContent>
                    <div className="space-y-2 mt-4 pt-4 border-t border-primary/10">
                      <h5 className="text-xs font-bold text-muted-foreground uppercase">투자 규칙별 상세 평가 내역</h5>
                      <div className="grid grid-cols-1 gap-2">
                        {result.ruleScores?.map((rule, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between gap-3 p-2 rounded bg-background/50 border text-xs">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate text-foreground/80">{rule.rule.split(':')[0]}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{rule.reason}</p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "font-mono font-bold",
                                rule.score >= 8 ? "border-green-500 text-green-600 bg-green-50" :
                                rule.score >= 5 ? "border-yellow-500 text-yellow-600 bg-yellow-50" :
                                "border-red-500 text-red-600 bg-red-50"
                              )}
                            >
                              {rule.score}점
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {result.sources.length > 0 && (
              <div className="pt-4 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  학습 근거 및 위치 (Source & Location)
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {result.sources.slice(0, 3).map((source, sIdx) => (
                    <div
                      key={sIdx}
                      className="flex items-start gap-3 p-3 rounded border bg-muted/20 text-xs"
                    >
                      {getSourceIcon(source.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold truncate">{source.fileName}</p>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {source.pageOrTimestamp !== '-' ? `P/T.${source.pageOrTimestamp}` : '전략 분석'}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 italic">"{source.content}"</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card className="w-full border-dashed border-2 border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            분석 결과 이메일로 받기
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Input
              type="email"
              placeholder="이메일 주소를 입력하세요"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button 
              onClick={handleSendEmail}
              disabled={!email || isSendingEmail || !onSendEmail}
            >
              {isSendingEmail ? '전송 중...' : emailSent ? '전송 완료!' : '이메일 발송'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            * 분석 결과를 이메일로 받아보실 수 있습니다. API 사용으로 비용이 발생할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


