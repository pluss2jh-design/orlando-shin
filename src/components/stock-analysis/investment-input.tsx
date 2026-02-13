'use client';

import React from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InvestmentConditions } from '@/types/stock-analysis';

interface InvestmentInputProps {
  onAnalyze?: (conditions: InvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const handleAnalyze = () => {
    onAnalyze?.({
      amount: 0,
      periodMonths: 0,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          기업 찾기 (Find Companies)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          학습된 투자 규칙에 따라 지금 당장 매수하기 좋은 기업 5개를 찾습니다.
        </p>

        <Button
          onClick={handleAnalyze}
          disabled={disabled}
          className="w-full"
          size="lg"
        >
          <Search className="h-4 w-4 mr-2" />
          기업 찾기
        </Button>
      </CardContent>
    </Card>
  );
}
