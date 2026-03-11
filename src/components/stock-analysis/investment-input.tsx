'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Info, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions } from '@/types/stock-analysis';

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
        const res = await fetch('/api/gdrive/learn');
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
      companyCount,
    });
  };


  const isLimitReached =
    userFeatures !== null &&
    userFeatures.weeklyAnalysisLimit !== -1 &&
    userFeatures.remainingAnalysis <= 0;

  const COUNTS = [3, 5, 10, 20];

  return (
    <div className="flex flex-col gap-4">
      {/* 현재 로직 표시 */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-xl border border-blue-100">
        <Info className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs text-gray-600 font-semibold">
          ACTIVE LOGIC:{' '}
          <span className="text-blue-600 uppercase font-black">
            {activeKnowledge?.title || '시스템 통합 로직'}
          </span>
        </span>
        {userFeatures && (
          <Badge
            variant={isLimitReached ? 'destructive' : 'secondary'}
            className="ml-auto font-black text-[10px] px-2 py-0.5 bg-white border border-gray-200 text-gray-700 shadow-sm shrink-0"
          >
            {userFeatures.weeklyAnalysisLimit === -1
              ? '∞ UNLIMITED'
              : `${userFeatures.remainingAnalysis} / ${userFeatures.weeklyAnalysisLimit} 남음`}
          </Badge>
        )}
      </div>

      {/* 분석 기업 수 선택 + 스캔 버튼 (한 줄) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm">
          <span className="text-xs font-black text-gray-500 uppercase tracking-widest whitespace-nowrap">TOP</span>
          <div className="flex gap-1">
            {COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setCompanyCount(n)}
                className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${companyCount === n
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          <span className="text-xs font-bold text-gray-400 ml-1">개사</span>
        </div>

        <Button
          onClick={handleAnalyze}
          disabled={disabled || isLimitReached}
          className="flex-1 h-12 bg-black hover:bg-gray-800 text-white font-black shadow-lg shadow-black/10 transition-all transform hover:-translate-y-0.5 active:scale-[0.99] rounded-xl text-base gap-2"
        >
          <Zap className="h-5 w-5" />
          {disabled
            ? '분석 중...'
            : isLimitReached
              ? 'WEEKLY LIMIT REACHED'
              : `SCAN FOR ALPHA`}
        </Button>
      </div>
    </div>
  );
}