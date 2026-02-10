'use client';

import React from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult, InvestmentConditions } from '@/types/stock-analysis';

interface AnalysisOutputProps {
  results: AnalysisResult[];
  conditions: InvestmentConditions | null;
  isLoading?: boolean;
}

export function AnalysisOutput({ results, conditions, isLoading }: AnalysisOutputProps) {
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
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">예상 수익률</p>
                <p className="text-2xl font-black text-green-600">
                  +{result.expectedReturnRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">AI 분석 신뢰도</span>
                    <span className="font-bold">{result.confidenceScore}%</span>
                  </div>
                  <Progress value={result.confidenceScore} className="h-2" />
                  {result.confidenceDetails && result.confidenceDetails.length > 0 && (
                    <ul className="text-[10px] text-muted-foreground list-disc list-inside mt-1 space-y-0.5">
                      {result.confidenceDetails.map((detail, dIdx) => (
                        <li key={dIdx}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>
                
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
    </div>
  );
}
