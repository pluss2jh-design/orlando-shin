'use client';

import React, { useState } from 'react';
import { DollarSign, Calendar, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions } from '@/types/stock-analysis';

interface InvestmentInputProps {
  onAnalyze?: (conditions: InvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const [period, setPeriod] = useState<number>(12);

  const handleAnalyze = () => {
    if (period > 0) {
      onAnalyze?.({
        amount: 0,
        periodMonths: period,
      });
    }
  };

  const isValid = period > 0;

  const getPeriodLabel = (months: number) => {
    if (months < 12) return `${months}개월`;
    if (months === 12) return '1년';
    if (months < 24) return `1년 ${months - 12}개월`;
    if (months === 24) return '2년';
    if (months < 36) return `2년 ${months - 24}개월`;
    return `${Math.floor(months / 12)}년`;
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          투자 조건 설정 (Investment Input)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              투자 기간
            </label>
            <Badge variant="secondary" className="font-semibold">
              {getPeriodLabel(period)}
            </Badge>
          </div>
          <Slider
            value={[period]}
            onValueChange={(value) => setPeriod(value[0])}
            min={1}
            max={60}
            step={1}
            disabled={disabled}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1개월</span>
            <span>1년</span>
            <span>2년</span>
            <span>3년</span>
            <span>5년</span>
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={!isValid || disabled}
          className="w-full"
          size="lg"
        >
          분석하기
        </Button>
      </CardContent>
    </Card>
  );
}
