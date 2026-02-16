'use client';

import React, { useState } from 'react';
import { Search, Sparkles, Key, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InvestmentConditions } from '@/types/stock-analysis';

interface ExtendedInvestmentConditions extends InvestmentConditions {
  aiModel?: string;
  apiKey?: string;
  companyCount?: number;
}

interface InvestmentInputProps {
  onAnalyze?: (conditions: ExtendedInvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const [companyCount, setCompanyCount] = useState(5);
  const [aiModel, setAiModel] = useState('gpt-4o-mini');
  const [apiKey, setApiKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleAnalyze = () => {
    onAnalyze?.({
      amount: 0,
      periodMonths: 0,
      aiModel,
      apiKey,
      companyCount,
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
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-2 block">찾을 기업 개수</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={companyCount}
              onChange={(e) => setCompanyCount(Number(e.target.value))}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">
              1~20개 사이의 값을 입력하세요
            </p>
          </div>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 w-full justify-center py-2"
          >
            <Settings className="h-4 w-4" />
            {showAdvanced ? '고급 설정 닫기' : 'AI 모델 및 API 키 설정'}
          </button>

          {showAdvanced && (
            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                  <Settings className="h-3 w-3" />
                  AI 모델
                </label>
                <select
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                >
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                  <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                  <option value="gemini-pro">Gemini Pro</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                  <Key className="h-3 w-3" />
                  API 키
                </label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="OpenAI / Anthropic / Google API Key"
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  API 키를 입력하지 않으면 기본 설정이 사용됩니다
                </p>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={disabled}
          className="w-full"
          size="lg"
        >
          <Search className="h-4 w-4 mr-2" />
          기업 {companyCount}개 찾기
        </Button>
      </CardContent>
    </Card>
  );
}
