'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Info, Zap, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InvestmentConditions } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';

interface ExtendedInvestmentConditions extends InvestmentConditions {
  companyCount?: number;
}

interface InvestmentInputProps {
  onAnalyze?: (conditions: ExtendedInvestmentConditions) => void;
  disabled?: boolean;
  activeKnowledge?: { title: string } | null;
}

const TIME_OFFSETS = [
  { id: 'now', label: '지금', months: 0 },
  { id: '1m', label: '1개월 전', months: 1 },
  { id: '3m', label: '3개월 전', months: 3 },
  { id: '6m', label: '6개월 전', months: 6 },
  { id: '1y', label: '1년 전', months: 12 },
];

export function InvestmentInput({ onAnalyze, disabled, activeKnowledge }: InvestmentInputProps) {
  const [companyCount, setCompanyCount] = useState(5);
  const [selectedTimeId, setSelectedTimeId] = useState('now');
  const [universeType, setUniverseType] = useState<'sp500' | 'russell1000' | 'russell1000_exclude_sp500'>('russell1000_exclude_sp500');
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

    fetchUserFeatures();
  }, []);

  const handleAnalyze = () => {
    const timeOffset = TIME_OFFSETS.find(t => t.id === selectedTimeId);
    let asOfDate: Date | undefined = undefined;
    
    if (timeOffset && timeOffset.months > 0) {
      asOfDate = new Date();
      asOfDate.setMonth(asOfDate.getMonth() - timeOffset.months);
    }

    onAnalyze?.({
      amount: 0,
      companyCount,
      asOfDate,
      universeType,
    });
  };

  const isLimitReached =
    userFeatures !== null &&
    userFeatures.weeklyAnalysisLimit !== -1 &&
    userFeatures.remainingAnalysis <= 0;

  const COUNTS = [3, 5, 10, 20];
  const UNIVERSE_OPTIONS = [
    { id: 'sp500', label: 'S&P 500' },
    { id: 'russell1000', label: 'R1000' },
    { id: 'russell1000_exclude_sp500', label: 'R1000 (Exclude S&P)' },
  ];

  return (
    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full">
      {/* 현재 로직 표시 */}
      {activeKnowledge && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50/50 rounded-xl border border-blue-100 shrink-0 h-12">
          <div className="p-1.5 bg-blue-600 rounded-lg shadow-sm">
             <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] text-blue-500 font-black uppercase tracking-widest leading-none mb-0.5">Expert Brain</span>
            <span className="text-[10px] text-gray-900 font-black uppercase truncate max-w-[120px]">
              {activeKnowledge.title}
            </span>
          </div>
          {userFeatures && (
            <div className="ml-1 pl-2 border-l border-blue-200">
               <span className={cn(
                 "text-[9px] font-black font-mono",
                 isLimitReached ? "text-rose-500" : "text-blue-600"
               )}>
                  {userFeatures.weeklyAnalysisLimit === -1 ? '∞' : userFeatures.remainingAnalysis}
               </span>
            </div>
          )}
        </div>
      )}

      {/* 분석 시점 선택 */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm h-12">
        <Clock className="h-3.5 w-3.5 text-gray-400 ml-1" />
        <div className="flex gap-1">
          {TIME_OFFSETS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTimeId(t.id)}
              className={cn(
                "px-3 h-8 rounded-lg text-[11px] font-black transition-all whitespace-nowrap",
                selectedTimeId === t.id
                  ? "bg-gray-900 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 유니버스 선택 */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm h-12">
        <Search className="h-3.5 w-3.5 text-gray-400 ml-1" />
        <div className="flex gap-1">
          {UNIVERSE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setUniverseType(opt.id as any)}
              className={cn(
                "px-2.5 h-8 rounded-lg text-[10px] font-black transition-all whitespace-nowrap uppercase tracking-tighter",
                universeType === opt.id
                  ? "bg-rose-500 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-100"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-1 lg:flex-initial">
        {/* 분석 기업 수 선택 */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-sm h-12">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">TOP</span>
          <div className="flex gap-1">
            {COUNTS.map((n) => (
              <button
                key={n}
                onClick={() => setCompanyCount(n)}
                className={cn(
                  "w-8 h-8 rounded-lg text-xs font-black transition-all",
                  companyCount === n
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* 메인 스캔 버튼 */}
        <Button
          onClick={handleAnalyze}
          disabled={disabled || isLimitReached}
          className="flex-1 lg:flex-none lg:min-w-[160px] h-12 bg-black hover:bg-gray-800 text-white font-black shadow-lg shadow-black/10 transition-all transform hover:-translate-y-0.5 active:scale-[0.99] rounded-xl text-sm gap-2 px-6 uppercase tracking-widest"
        >
          <Sparkles className="h-4 w-4" />
          {disabled ? 'Scanning...' : 'Scan Alpha'}
        </Button>
      </div>
    </div>
  );
}