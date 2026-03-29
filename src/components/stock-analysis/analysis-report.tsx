'use client';

import React, { useState, useMemo } from 'react';
import { 
  CheckCircle2, 
  Search, 
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronDown,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AnalysisResult, ExcludedStockDetail } from '@/types/stock-analysis';

interface AnalysisReportProps {
  candidates: AnalysisResult[];
  excludedDetails: ExcludedStockDetail[];
  totalUniverse: number;
}

export function AnalysisReport({ candidates, excludedDetails, totalUniverse }: AnalysisReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'all' | 'success' | 'excluded'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const successes = useMemo(() => candidates.map(c => ({
    ticker: c.ticker || 'Unknown',
    status: 'success' as const,
    reason: c.expertVerdict?.title || '분석 완료',
    score: c.totalRuleScore ?? (c.score / 10)
  })), [candidates]);

  const failures = useMemo(() => excludedDetails.map(f => ({
    ticker: f.ticker,
    status: 'excluded' as const,
    reason: f.reason || '알 수 없는 이유',
    category: f.category || '기타 제외 사유',
    score: 0
  })), [excludedDetails]);

  // 실패 항목 그룹화 (카테고리 기준)
  const groupedFailures = useMemo(() => {
    const groups: Record<string, typeof failures> = {};
    failures.forEach(f => {
      const groupKey = f.category;
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(f);
    });
    return groups;
  }, [failures]);

  const toggleGroup = (reason: string) => {
    setExpandedGroups(prev => ({ ...prev, [reason]: !prev[reason] }));
  };

  const filteredSuccesses = successes.filter(s => s.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const filteredGroupedFailures = useMemo(() => {
    const result: Record<string, typeof failures> = {};
    Object.entries(groupedFailures).forEach(([reason, items]) => {
      const filtered = items.filter(i => i.ticker.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filtered.length > 0) result[reason] = filtered;
    });
    return result;
  }, [groupedFailures, searchTerm]);

  return (
    <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden flex flex-col max-h-[700px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-50 bg-gray-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <h3 className="text-lg font-black text-gray-900 tracking-tight italic">Deep Scan Logistics Report</h3>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-black px-3 py-1">
              SUCCESS {successes.length}
            </Badge>
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-100 font-black px-3 py-1">
              FAILED {failures.length}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text"
              placeholder="티커 검색 (예: NVDA)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-100 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            />
          </div>
          <div className="flex bg-gray-100/80 p-1 rounded-2xl">
            {(['all', 'success', 'excluded'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  filter === f 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {f === 'all' ? '전체' : f === 'success' ? '성공' : '실패 항목'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-gray-50/30">
        <div className="space-y-6">
          
          {/* Succeeded Section */}
          {(filter === 'all' || filter === 'success') && filteredSuccesses.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analysis Completed</h4>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {filteredSuccesses.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 transition-all flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-900 uppercase">{item.ticker}</span>
                          <Badge className="bg-blue-600 text-[10px] font-black h-4 px-1.5">{item.score.toFixed(1)}</Badge>
                        </div>
                        <p className="text-[11px] text-emerald-700 font-medium">{item.reason}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Excluded Groups Section */}
          {(filter === 'all' || filter === 'excluded') && Object.keys(filteredGroupedFailures).length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <Layers className="h-4 w-4 text-rose-500" />
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Failure Categories</h4>
              </div>
              <div className="space-y-3">
                {Object.entries(filteredGroupedFailures).map(([reason, items]) => (
                  <div key={reason} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleGroup(reason)}
                      className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                          <AlertCircle className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-xs font-black text-gray-900">{reason}</p>
                          <p className="text-[10px] font-medium text-gray-500">{items.length}개 종목</p>
                        </div>
                      </div>
                      <div className={cn("transition-transform", expandedGroups[reason] ? "rotate-90" : "")}>
                         <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </button>
                    
                    {expandedGroups[reason] && (
                      <div className="p-4 bg-gray-50/50 border-t border-gray-50 space-y-3">
                        {items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-xl">
                            <span className="text-xs font-black text-gray-900 uppercase">{item.ticker}</span>
                            <span className="text-[10px] font-medium text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredSuccesses.length === 0 && Object.keys(filteredGroupedFailures).length === 0 && (
             <div className="py-20 text-center space-y-3">
                <Search className="h-10 w-10 text-gray-200 mx-auto" />
                <p className="text-sm font-black text-gray-400">데이터가 없습니다.</p>
             </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[9px] font-black text-gray-400 uppercase tracking-[0.2em]">
        <div className="flex gap-4">
           <span>Success: {successes.length}</span>
           <span>Failed: {failures.length}</span>
        </div>
        <span>Universe Total: {totalUniverse}</span>
      </div>
    </div>
  );
}
