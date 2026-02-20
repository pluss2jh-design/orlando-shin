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

interface ExtendedInvestmentConditions extends InvestmentConditions {
  companyCount?: number;
}

interface InvestmentInputProps {
  onAnalyze?: (conditions: ExtendedInvestmentConditions) => void;
  disabled?: boolean;
}

export function InvestmentInput({ onAnalyze, disabled }: InvestmentInputProps) {
  const [companyCount, setCompanyCount] = useState(5);
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
      periodMonths: 0,
      companyCount,
    });
  };

  return (
    <Card className="w-full bg-gray-900 border-gray-800 shadow-2xl overflow-hidden">
      <CardHeader className="pb-4 bg-gray-900/50 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-black flex items-center gap-3 text-white">
            <Sparkles className="h-6 w-6 text-blue-500" />
            ALPHA SCANNER
          </CardTitle>
          {userFeatures && (
            <Badge variant={userFeatures.remainingAnalysis === 0 ? "destructive" : "secondary"} className="font-black px-3 py-1">
              {userFeatures.weeklyAnalysisLimit === -1
                ? 'UNLIMITED ACCESS'
                : `REMAINING: ${userFeatures.remainingAnalysis} / ${userFeatures.weeklyAnalysisLimit}`
              }
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-4 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20">
          <Info className="h-4 w-4 text-blue-400" />
          <span className="text-xs text-gray-300 font-bold">
            CURRENT LOGIC: <span className="text-blue-400 uppercase">{activeKnowledge?.title || '시스템 통합 로직'}</span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">분석 대상 기업 수 (TOP N)</label>
              <span className="text-xs font-bold text-blue-400">1 ~ 20 개 선택 가능</span>
            </div>
            <Input
              type="number"
              min={1}
              max={20}
              value={companyCount}
              onChange={(e) => setCompanyCount(Number(e.target.value))}
              className="w-full h-12 bg-gray-950 border-gray-800 text-white font-black text-lg focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          <div className="p-4 bg-gray-950 rounded-xl border border-gray-800">
            <p className="text-[11px] text-gray-400 font-medium leading-relaxed">
              * 선택된 개수만큼의 S&P 500 / Russell 1000 기업을 AI가 전수 조사합니다.<br />
              * 분석에는 활성화된 <strong>{activeKnowledge?.title || '최신 투자 로직'}</strong>이 적용됩니다.
            </p>
          </div>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={disabled || (userFeatures !== null && userFeatures.weeklyAnalysisLimit !== -1 && userFeatures.remainingAnalysis <= 0)}
          className="w-full h-16 bg-blue-600 hover:bg-blue-700 text-white text-xl font-black shadow-lg shadow-blue-500/20 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
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