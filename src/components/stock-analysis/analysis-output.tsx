'use client';

import React from 'react';
import { TrendingUp, AlertCircle, FileText, Video, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AnalysisResult, InvestmentConditions } from '@/types/stock-analysis';

interface AnalysisOutputProps {
  result: AnalysisResult | null;
  conditions: InvestmentConditions | null;
  isLoading?: boolean;
}

export function AnalysisOutput({ result, conditions, isLoading }: AnalysisOutputProps) {
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 animate-pulse" />
            분석 중...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
            <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
            <div className="h-4 bg-muted rounded animate-pulse w-2/3" />
          </div>
          <div className="space-y-2">
            <div className="h-20 bg-muted rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!result || !conditions) {
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
            <p>투자 조건을 입력하고 분석하기 버튼을 클릭하세요</p>
            <p className="text-sm mt-2">AI가 업로드된 자료를 학습하여 최적의 기업을 추천해드립니다</p>
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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            분석 결과 (Analysis Result)
          </CardTitle>
          {getRiskBadge(result.riskLevel)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-primary/5 border">
            <p className="text-sm text-muted-foreground mb-1">추천 기업</p>
            <p className="text-2xl font-bold">{result.companyName}</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-muted-foreground mb-1">예상 수익률</p>
            <p className="text-2xl font-bold text-green-600">
              +{result.expectedReturnRate.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">AI 신뢰도</span>
            <span className="text-sm text-muted-foreground">{result.confidenceScore}%</span>
          </div>
          <Progress value={result.confidenceScore} className="h-2" />
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">분석 근거</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {result.reasoning}
          </p>
        </div>

        {result.sources.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              참고 자료
            </h4>
            <div className="space-y-2">
              {result.sources.map((source, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50"
                >
                  {getSourceIcon(source.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{source.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {source.type === 'pdf' ? `페이지 ${source.pageOrTimestamp}` : `타임스탬프 ${source.pageOrTimestamp}`}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {source.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">투자 금액</span>
            <span className="font-medium">{conditions.amount.toLocaleString()}원</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-muted-foreground">투자 기간</span>
            <span className="font-medium">{conditions.periodMonths}개월</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t">
            <span className="text-muted-foreground">예상 수익</span>
            <span className="font-bold text-green-600">
              +{Math.round(conditions.amount * (result.expectedReturnRate / 100)).toLocaleString()}원
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
