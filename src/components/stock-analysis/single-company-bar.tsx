'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Brain, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { InvestmentConditions } from '@/types/stock-analysis';

interface SingleCompanyBarProps {
  onSearchModel: (model: { newsAiModel?: string; fallbackAiModel?: string; conditions?: InvestmentConditions }) => void;
  onRunAnalysis: () => void;
  singleTicker: string;
  onTickerChange: (ticker: string) => void;
  isLoading: boolean;
}

const TIME_OFFSETS = [
  { id: 'now', label: '지금', months: 0 },
  { id: '1m', label: '1개월 전', months: 1 },
  { id: '3m', label: '3개월 전', months: 3 },
  { id: '6m', label: '6개월 전', months: 6 },
  { id: '1y', label: '1년 전', months: 12 },
];

export function SingleCompanyBar({ onSearchModel, onRunAnalysis, singleTicker, onTickerChange, isLoading }: SingleCompanyBarProps) {
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedFallbackModel, setSelectedFallbackModel] = useState('');
  const [selectedTimeId, setSelectedTimeId] = useState('now');
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/models')
      .then(res => res.json())
      .then(data => {
        const loadedModels = data.models || [];
        setAvailableModels(loadedModels);
        if (loadedModels.length > 0) {
          setSelectedModel(loadedModels[0].value);
        }
      })
      .catch(err => console.error('Failed to load models:', err));
  }, []);

  useEffect(() => {
    const timeOffset = TIME_OFFSETS.find(t => t.id === selectedTimeId);
    let asOfDate: Date | undefined = undefined;
    if (timeOffset && timeOffset.months > 0) {
      asOfDate = new Date();
      asOfDate.setMonth(asOfDate.getMonth() - timeOffset.months);
    }
    
    onSearchModel({
      newsAiModel: selectedModel,
      fallbackAiModel: selectedFallbackModel,
      conditions: {
        amount: 0,
        strategyType: 'all',
        asOfDate,
        timeLabel: timeOffset?.label || '지금',
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, selectedFallbackModel, selectedTimeId]);

  return (
    <div className="flex flex-wrap items-stretch xl:items-end gap-3 p-1 animate-in fade-in slide-in-from-top-2 duration-300">
      
      {/* 종목 직접 검색란 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black pl-1 uppercase tracking-tight text-gray-500">종목 직접 검색</span>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 h-11 xl:w-56 focus-within:ring-2 focus-within:ring-indigo-100 transition-all shadow-sm shrink-0">
          <Search className="h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Ticker (e.g. AAPL)" 
            value={singleTicker}
            onChange={(e) => onTickerChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRunAnalysis();
            }}
            className="border-none bg-transparent shadow-none h-full focus-visible:ring-0 px-1 font-black uppercase text-sm tracking-widest text-gray-900 placeholder:normal-case placeholder:font-medium placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* 분석 시점 선택 */}
      <div className="flex flex-col gap-1.5 min-w-0">
        <span className="text-[10px] font-black text-gray-500 pl-1 uppercase tracking-tight">기준 시점</span>
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
            <option value="" disabled>사용 모델 선택</option>
            {availableModels.map(model => (
              <option key={model.value} value={model.value}>{model.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 2순위 모델 */}
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

      {/* 실행 버튼 */}
      <div className="h-11 flex items-end">
        <Button
          onClick={onRunAnalysis}
          disabled={isLoading || !singleTicker.trim() || !selectedModel}
          className={cn(
            "min-w-[130px] h-11 font-black shadow-lg transition-all transform hover:-translate-y-0.5 active:scale-[0.99] rounded-xl text-xs gap-2 px-6 uppercase tracking-widest",
            (!singleTicker.trim() || !selectedModel) ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-black hover:bg-gray-800 text-white shadow-black/10"
          )}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
              <span>Scanning</span>
            </div>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" />
              <span>Scan Alpha</span>
            </>
          )}
        </Button>
      </div>

    </div>
  );
}
