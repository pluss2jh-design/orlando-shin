'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, BarChart3, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions } from '@/types/stock-analysis';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ExtendedInvestmentConditions extends InvestmentConditions {
  companyCount?: number;
}

interface InvestmentInputProps {
  onAnalyze?: (conditions: ExtendedInvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const [companyCount, setCompanyCount] = useState(5);
  const [periodMonths, setPeriodMonths] = useState(12);
  const [sector, setSector] = useState('ALL');
  const [strategyType, setStrategyType] = useState<'growth' | 'value' | 'all'>('all');
  const [activeKnowledge, setActiveKnowledge] = useState<{ title: string } | null>(null);
  const [userFeatures, setUserFeatures] = useState<{
    plan: string;
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

    const fetchActiveKnowledge = async () => {
      try {
        const res = await fetch('/api/gdrive/learn'); // This GET returns current knowledge status
        if (res.ok) {
          const data = await res.json();
          if (data.exists) {
            setActiveKnowledge({ title: data.title || '기본 AI 투자 로직' });
          }
        }
      } catch (error) {
        console.error('Failed to fetch active knowledge:', error);
      }
    };

    fetchUserFeatures();
    fetchActiveKnowledge();
  }, []);

  const handleAnalyze = () => {
    onAnalyze?.({
      amount: 0,
      periodMonths,
      companyCount,
      sector: sector === 'ALL' ? undefined : sector,
      strategyType,
    });
  };

  return (
    <Card className="w-full bg-white border-gray-200 shadow-xl overflow-hidden rounded-sm">
      <CardHeader className="pb-4 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-black flex items-center gap-3 text-gray-900">
            <Sparkles className="h-6 w-6 text-blue-600" />
            ALPHA SCANNER
          </CardTitle>
          {userFeatures && (
            <Badge variant={userFeatures.remainingAnalysis === 0 ? "destructive" : "secondary"} className="font-black px-3 py-1 bg-white border border-gray-200 text-gray-700 shadow-sm">
              {userFeatures.weeklyAnalysisLimit === -1
                ? 'UNLIMITED ACCESS'
                : `REMAINING: ${userFeatures.remainingAnalysis} / ${userFeatures.weeklyAnalysisLimit}`
              }
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-xs text-gray-600 font-bold">
            CURRENT LOGIC: <span className="text-blue-600 uppercase">{activeKnowledge?.title || '시스템 통합 로직'}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">분석 대상 기업 수 (TOP N)</label>
              <span className="text-xs font-bold text-blue-600">1 ~ 20 개 선택 가능</span>
            </div>
            <Input
              type="number"
              min={1}
              max={20}
              value={companyCount}
              onChange={(e) => setCompanyCount(Number(e.target.value))}
              className="w-full h-12 bg-gray-50 border-gray-200 text-gray-900 font-black text-lg focus:ring-blue-500 focus:border-blue-500 transition-all rounded-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">투자기간</label>
              <Select value={periodMonths.toString()} onValueChange={(val) => setPeriodMonths(Number(val))}>
                <SelectTrigger className="w-full h-10 border-gray-200 bg-gray-50 text-gray-800 font-bold text-sm">
                  <SelectValue placeholder="기간 선택" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl">
                  <SelectItem value="1">1개월</SelectItem>
                  <SelectItem value="3">3개월</SelectItem>
                  <SelectItem value="6">6개월</SelectItem>
                  <SelectItem value="12">1년 (12개월)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">섹터 (산업군)</label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="w-full h-10 border-gray-200 bg-gray-50 text-gray-800 font-bold text-sm">
                  <SelectValue placeholder="섹터 전체" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl">
                  <SelectItem value="ALL">전체 섹터</SelectItem>
                  <SelectItem value="Technology">테크 (Technology)</SelectItem>
                  <SelectItem value="Healthcare">헬스케어 (Healthcare)</SelectItem>
                  <SelectItem value="Energy">에너지 (Energy)</SelectItem>
                  <SelectItem value="Financial Services">금융 (Financials)</SelectItem>
                  <SelectItem value="Consumer Cyclical">임의소비재 (Consumer Cyclical)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">투자 스타일</label>
              <Select value={strategyType} onValueChange={(val: any) => setStrategyType(val)}>
                <SelectTrigger className="w-full h-10 border-gray-200 bg-gray-50 text-gray-800 font-bold text-sm">
                  <SelectValue placeholder="모두 탐색" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200 shadow-xl">
                  <SelectItem value="all">종합 분석 (기본)</SelectItem>
                  <SelectItem value="growth">성장주 (매출 고속 성장)</SelectItem>
                  <SelectItem value="value">가치주 (자산 대비 저평가)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-sm border border-gray-200">
            <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
              * 선택된 개수만큼의 S&P 500 / Russell 1000 기업을 AI가 전수 조사합니다.<br />
              * 분석에는 활성화된 <strong>{activeKnowledge?.title || '최신 투자 로직'}</strong>이 적용됩니다.
            </p>
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={disabled || (userFeatures !== null && userFeatures.weeklyAnalysisLimit !== -1 && userFeatures.remainingAnalysis <= 0)}
          className="w-full h-16 bg-black hover:bg-gray-800 text-white text-xl font-black shadow-lg shadow-black/10 transition-all transform hover:-translate-y-1 active:scale-[0.99] rounded-sm"
          size="lg"
        >
          <Search className="h-6 w-6 mr-3" />
          {userFeatures && userFeatures.weeklyAnalysisLimit !== -1 && userFeatures.remainingAnalysis <= 0
            ? 'WEEKLY LIMIT REACHED'
            : `SCAN FOR ALPHA (${companyCount} COMPANIES)`
          }
        </Button>
      </CardContent>
    </Card>
  );
}