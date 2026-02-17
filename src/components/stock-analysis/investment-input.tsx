'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Key, Settings, Building2, Newspaper, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions } from '@/types/stock-analysis';

interface AIModelConfig {
  id: string;
  name: string;
  provider: string;
}

const AI_MODELS: AIModelConfig[] = [
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'gpt-4', name: 'GPT-4', provider: 'OpenAI' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'Google' },
  { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'Google' },
  { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'Mistral' },
  { id: 'mistral-medium-latest', name: 'Mistral Medium', provider: 'Mistral' },
  { id: 'mistral-small-latest', name: 'Mistral Small', provider: 'Mistral' },
  { id: 'command-r-plus', name: 'Command R+', provider: 'Cohere' },
  { id: 'command-r', name: 'Command R', provider: 'Cohere' },
  { id: 'llama-3.1-70b-versatile', name: 'Llama 3.1 70B', provider: 'Groq' },
  { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', provider: 'Groq' },
  { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: 'Groq' },
  { id: 'gemma-7b-it', name: 'Gemma 7B', provider: 'Groq' },
  { id: 'llama-3.1-sonar-large-128k-online', name: 'Llama 3.1 Sonar Large', provider: 'Perplexity' },
  { id: 'llama-3.1-sonar-small-128k-online', name: 'Llama 3.1 Sonar Small', provider: 'Perplexity' },
];

interface ExtendedInvestmentConditions extends InvestmentConditions {
  companyAiModel?: string;
  companyApiKey?: string;
  newsAiModel?: string;
  newsApiKey?: string;
  companyCount?: number;
}

interface InvestmentInputProps {
  onAnalyze?: (conditions: ExtendedInvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const [companyCount, setCompanyCount] = useState(5);
  const [companyAiModel, setCompanyAiModel] = useState('gpt-4o-mini');
  const [companyApiKey, setCompanyApiKey] = useState('');
  const [newsAiModel, setNewsAiModel] = useState('gpt-4o-mini');
  const [newsApiKey, setNewsApiKey] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userFeatures, setUserFeatures] = useState<{
    membershipTier: string;
    weeklyAnalysisLimit: number;
    usedAnalysisThisWeek: number;
    remainingAnalysis: number;
    canAnalyze: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchUserFeatures = async () => {
      try {
        const res = await fetch('/api/user/features');
        if (res.ok) {
          const data = await res.json();
          setUserFeatures(data);
        }
      } catch (error) {
        console.error('Failed to fetch user features:', error);
      }
    };
    fetchUserFeatures();
  }, []);

  const handleAnalyze = () => {
    onAnalyze?.({
      amount: 0,
      periodMonths: 0,
      companyAiModel,
      companyApiKey,
      newsAiModel,
      newsApiKey,
      companyCount,
    });
  };

  const renderModelOptions = () => {
    const providers = [...new Set(AI_MODELS.map(m => m.provider))];
    return (
      <>
        {providers.map(provider => (
          <optgroup key={provider} label={provider}>
            {AI_MODELS.filter(m => m.provider === provider).map(model => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </optgroup>
        ))}
      </>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          기업 찾기 (Find Companies)
        </CardTitle>
        {userFeatures && (
          <div className="flex items-center gap-2 mt-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              이번 주 남은 분석 횟수: 
            </span>
            <Badge variant={userFeatures.remainingAnalysis === 0 ? "destructive" : "secondary"}>
              {userFeatures.weeklyAnalysisLimit === -1 
                ? '무제한' 
                : `${userFeatures.remainingAnalysis}회 / ${userFeatures.weeklyAnalysisLimit}회`
              }
            </Badge>
          </div>
        )}
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
            <div className="space-y-4 p-3 bg-muted/50 rounded-lg">
              <div className="space-y-3 border-b border-border pb-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Building2 className="h-4 w-4" />
                  기업 분석용 AI 설정
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    AI 모델 (올랜도킴 자료 분석용)
                  </label>
                  <select
                    value={companyAiModel}
                    onChange={(e) => setCompanyAiModel(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    {renderModelOptions()}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    업로드한 자료를 분석하여 투자 규칙을 학습하는 데 사용됩니다
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    API 키 (기업 분석)
                  </label>
                  <Input
                    type="password"
                    value={companyApiKey}
                    onChange={(e) => setCompanyApiKey(e.target.value)}
                    placeholder="기업 분석용 API Key"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    미입력 시 기본 설정 사용
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Newspaper className="h-4 w-4" />
                  뉴스 분석용 AI 설정
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Settings className="h-3 w-3" />
                    AI 모델 (뉴스 분석)
                  </label>
                  <select
                    value={newsAiModel}
                    onChange={(e) => setNewsAiModel(e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    {renderModelOptions()}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    API 키 (뉴스 분석)
                  </label>
                  <Input
                    type="password"
                    value={newsApiKey}
                    onChange={(e) => setNewsApiKey(e.target.value)}
                    placeholder="뉴스 분석용 API Key"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    미입력 시 기본 설정 사용
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={disabled || !!(userFeatures && !userFeatures.canAnalyze)}
          className="w-full"
          size="lg"
        >
          <Search className="h-4 w-4 mr-2" />
          {userFeatures && !userFeatures.canAnalyze 
            ? '이번 주 분석 횟수 초과' 
            : `기업 ${companyCount}개 찾기`
          }
        </Button>
      </CardContent>
    </Card>
  );
}