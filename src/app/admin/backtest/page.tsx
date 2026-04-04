'use client';

import React, { useState } from 'react';
import { 
  LineChart, Activity, Calendar, Play, Settings, Filter, ArrowRight, Save, Database, Sparkles, TrendingUp, BarChart4 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export default function BacktestDashboard() {
  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleStartBacktest = () => {
    setIsTesting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((v) => {
        if (v >= 100) {
          clearInterval(interval);
          setIsTesting(false);
          return 100;
        }
        return v + 10;
      });
    }, 400);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0f111a] text-white overflow-y-auto">
      {/* ── Top Bar ──────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#0f111a]/90 backdrop-blur-xl border-b border-white/10">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-indigo-600/20 rounded-2xl">
              <Activity className="h-6 w-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight">AI Strategy Backtesting Engine</h1>
              <p className="text-sm text-white/40 font-bold">과거 데이터 기반 투자 전략 검증 및 성과 측정</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 lg:p-10 max-w-[1600px] mx-auto w-full space-y-6">
        
        {/* Settings Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 p-6 rounded-3xl bg-[#161b22] border border-white/5 space-y-6">
            <div className="flex items-center gap-2 pb-4 border-b border-white/5">
              <Settings className="h-5 w-5 text-indigo-400" />
              <h2 className="text-sm font-black uppercase tracking-widest text-indigo-100">Test Configuration</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">전략 환경 (Universe)</label>
                <div className="flex gap-2">
                  <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 py-1.5 px-3">S&P 500</Badge>
                  <Badge className="bg-white/5 text-white/40 border-white/10 hover:bg-white/10 py-1.5 px-3 cursor-pointer transition-colors">NASDAQ 100</Badge>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">백테스트 대상 기간</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl">
                    <p className="text-[9px] text-white/30 uppercase mb-1">시작일</p>
                    <Input type="date" className="bg-transparent border-none text-xs text-white p-0 h-auto focus-visible:ring-0" defaultValue="2023-01-01" />
                  </div>
                  <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl">
                    <p className="text-[9px] text-white/30 uppercase mb-1">종료일</p>
                    <Input type="date" className="bg-transparent border-none text-xs text-white p-0 h-auto focus-visible:ring-0" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">초기 투자 금액</label>
                <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl flex flex-col">
                  <Input type="number" className="bg-transparent border-none text-base font-mono font-bold text-white p-0 h-auto focus-visible:ring-0" defaultValue={100000} />
                  <p className="text-[9px] text-white/30 uppercase mt-1">USD ($)</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleStartBacktest}
              disabled={isTesting}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/30 disabled:opacity-50"
            >
              {isTesting ? <Activity className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {isTesting ? '백테스트 실행 중...' : '시뮬레이션 시작'}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-6 flex flex-col">
            {/* Status output */}
            <div className="p-6 rounded-3xl bg-[#161b22] border border-white/5 flex-1 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[80px] pointer-events-none rounded-full" />
              
              {!isTesting && progress === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Database className="h-8 w-8 text-white/20" />
                  </div>
                  <h3 className="text-sm font-black text-white">조건 설정 후 시뮬레이션을 시작하세요</h3>
                  <p className="text-xs text-white/40 mt-2 max-w-sm">과거의 AI 판단 데이터를 바탕으로 시장 성과를 실제로 측정해 볼 수 있습니다.</p>
                </div>
              ) : isTesting ? (
                <div className="h-full flex flex-col justify-center">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="h-4 w-4 animate-pulse" /> Running Backtest
                      </h3>
                      <p className="text-[10px] text-white/40 mt-1">가상의 시장 환경에서 AI 투자 시뮬레이션 계산 중...</p>
                    </div>
                    <span className="text-2xl font-black font-mono text-white">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-indigo-950/50" />
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in duration-500">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-400" /> Backtest Results Summary
                      </h3>
                      <p className="text-xs text-white/50">2023-01-01 ➔ {new Date().toISOString().split('T')[0]}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase font-black mb-1">Final Portfolio Value</p>
                      <p className="text-3xl font-black font-mono text-emerald-400">$245,600.50</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 font-black uppercase mb-1 flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-400" /> 총 누적 수익률</p>
                      <p className="text-xl font-mono font-black text-emerald-400">+145.6%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 font-black uppercase mb-1">연평균 수익률 (CAGR)</p>
                      <p className="text-xl font-mono font-black text-white">41.2%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 font-black uppercase mb-1">최대 낙폭 (MDD)</p>
                      <p className="text-xl font-mono font-black text-rose-400">-12.4%</p>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-[10px] text-white/40 font-black uppercase mb-1">S&P 500 대비 초과수익</p>
                      <p className="text-xl font-mono font-black text-blue-400">+78.1%</p>
                    </div>
                  </div>
                  
                  <div className="mt-8 flex h-48 items-center justify-center border border-dashed border-white/10 rounded-2xl bg-black/20">
                     <div className="flex flex-col items-center opacity-40">
                         <LineChart className="h-10 w-10 mb-2"/>
                         <p className="text-xs font-bold font-mono">CHART PLACEHOLDER</p>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
