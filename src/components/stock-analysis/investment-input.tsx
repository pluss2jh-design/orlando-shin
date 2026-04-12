'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Clock, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InvestmentConditions } from '@/types/stock-analysis';
import { cn } from '@/lib/utils';

interface ExtendedInvestmentConditions extends InvestmentConditions {
  companyCount?: number;
  newsAiModel?: string;
  fallbackAiModel?: string;
  newsApiKey?: string;
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
  const [selectedTimeId, setSelectedTimeId] = useState('now');
  const [universeType, setUniverseType] = useState<'sp500' | 'russell1000' | 'russell1000_exclude_sp500'>('russell1000_exclude_sp500');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedFallbackModel, setSelectedFallbackModel] = useState<string>('');
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [userFeatures, setUserFeatures] = useState<{
    plan: string;
    weeklyAnalysisLimit: number;
    usedAnalysisThisWeek: number;
    remainingAnalysis: number;
    canAnalyze: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [featuresRes, modelsRes] = await Promise.all([
          fetch('/api/user/features'),
          fetch('/api/admin/models')
        ]);
        if (featuresRes.ok) {
          const data = await featuresRes.json();
          setUserFeatures(data);
        }
        if (modelsRes.ok) {
          const data = await modelsRes.json();
          const loadedModels = data.models || [];
          setAvailableModels(loadedModels);
          if (loadedModels.length > 0) {
            setSelectedModel(prev => prev || loadedModels[0].value);
          }
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    fetchData();
  }, []);

  const handleAnalyze = () => {
    if (!selectedModel) {
      alert('분석에 사용할 AI 모델을 선택해주세요.');
      return;
    }
    const timeOffset = TIME_OFFSETS.find(t => t.id === selectedTimeId);
    let asOfDate: Date | undefined = undefined;
    if (timeOffset && timeOffset.months > 0) {
      asOfDate = new Date();
      asOfDate.setMonth(asOfDate.getMonth() - timeOffset.months);
    }
    onAnalyze?.({
      amount: 0,
      companyCount: 10,
      asOfDate,
      timeLabel: timeOffset?.label || '지금',
      universeType,
      excludeSP500: universeType === 'russell1000_exclude_sp500',
      newsAiModel: selectedModel,
      fallbackAiModel: selectedFallbackModel || undefined,
    });
  };

  const isLimitReached =
    userFeatures !== null &&
    userFeatures.weeklyAnalysisLimit !== -1 &&
    userFeatures.remainingAnalysis <= 0;

  const UNIVERSE_OPTIONS = [
    { id: 'sp500', label: 'S&P 500' },
    { id: 'russell1000', label: 'R1000' },
    { id: 'russell1000_exclude_sp500', label: 'R1000 (Exclude S&P)' },
  ];

  return (
    <div className="flex flex-wrap items-end gap-x-3 gap-y-5 w-full">
      {/* 분석 시점 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black text-gray-500 pl-1 uppercase tracking-tight">분석 기준 시점</span>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm h-11">
          <Clock className="h-3 w-3 text-gray-400 ml-0.5" />
          <div className="flex gap-0.5">
            {TIME_OFFSETS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTimeId(t.id)}
                className={cn(
                  "px-2.5 h-7 rounded-lg text-[10px] font-black transition-all whitespace-nowrap",
                  selectedTimeId === t.id ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 유니버스 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black text-gray-500 pl-1 uppercase tracking-tight">분석 대상 유니버스</span>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm h-11">
          <Search className="h-3 w-3 text-gray-400 ml-0.5" />
          <div className="flex gap-0.5">
            {UNIVERSE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setUniverseType(opt.id as any)}
                className={cn(
                  "px-2 h-7 rounded-lg text-[9px] font-black transition-all whitespace-nowrap uppercase tracking-tighter",
                  universeType === opt.id ? "bg-rose-500 text-white shadow-sm" : "text-gray-500 hover:bg-gray-100"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 1순위 모델 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black text-gray-500 pl-1 uppercase tracking-tight">1순위 AI 모델</span>
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-2 py-1 shadow-sm h-11">
          <Brain className="h-3 w-3 text-gray-400 ml-0.5" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={cn(
              "bg-transparent border-none outline-none focus:ring-0 text-[10px] font-black uppercase tracking-widest w-[160px] cursor-pointer appearance-none",
              !selectedModel ? "text-red-500" : "text-gray-900"
            )}
          >
            <option value="" disabled>⚠️ 모델 선택 필요</option>
            {availableModels.map(model => (
              <option key={model.value} value={model.value}>
                {model.label}{model.isRecommendedForNews ? ' (추천)' : ''}
              </option>
            ))}
            {availableModels.length === 0 && <option value="" disabled>모델 정보 없음</option>}
          </select>
        </div>
      </div>

      {/* 2순위 폴백 모델 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black text-gray-500 pl-1 uppercase tracking-tight">
          2순위 AI 모델 <span className="text-gray-400 normal-case font-medium">(429 폴백)</span>
        </span>
        <div className="flex items-center gap-1.5 bg-white border border-blue-100 rounded-xl px-2 py-1 shadow-sm h-11">
          <Brain className="h-3 w-3 text-blue-300 ml-0.5" />
          <select
            value={selectedFallbackModel}
            onChange={(e) => setSelectedFallbackModel(e.target.value)}
            className="bg-transparent border-none outline-none focus:ring-0 text-[10px] font-black uppercase tracking-widest w-[160px] cursor-pointer appearance-none text-gray-500"
          >
            <option value="">— 사용 안 함 —</option>
            {availableModels
              .filter(m => m.value !== selectedModel)
              .map(model => (
                <option key={model.value} value={model.value}>{model.label}</option>
              ))}
          </select>
        </div>
      </div>

      {/* 스캔 버튼 */}
      <div className="h-11 flex items-end">
        <Button
          onClick={handleAnalyze}
          disabled={disabled || isLimitReached || !selectedModel}
          className={cn(
            "min-w-[130px] h-11 font-black shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-[0.99] rounded-xl text-xs gap-2 px-6 uppercase tracking-widest",
            !selectedModel ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800 text-white shadow-black/10"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {disabled ? 'Scanning...' : 'Scan Alpha'}
        </Button>
      </div>
    </div>
  );
}