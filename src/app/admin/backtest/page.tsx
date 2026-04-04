'use client';

import React, { useState, useCallback } from 'react';
import { 
  LineChart as LineChartIcon, Activity, Play, Settings, ArrowRight, Database, Sparkles, TrendingUp, Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ReferenceArea
} from 'recharts';

interface BacktestPoint {
  date: string;
  close: number;
}

export default function BacktestDashboard() {
  const [ticker, setTicker] = useState('AAPL');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [initialAmount, setInitialAmount] = useState(100000);

  const [isTesting, setIsTesting] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const [chartData, setChartData] = useState<BacktestPoint[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  
  // Interactive chart point selection
  const [pointA, setPointA] = useState<BacktestPoint | null>(null);
  const [pointB, setPointB] = useState<BacktestPoint | null>(null);

  const handleStartBacktest = async () => {
    if (!ticker) return;
    setIsTesting(true);
    setProgress(20);
    setPointA(null);
    setPointB(null);

    try {
      const res = await fetch(`/api/stock/backtest?ticker=${ticker}&startDate=${startDate}&endDate=${endDate}`);
      setProgress(60);
      
      if (!res.ok) {
        throw new Error('Failed to fetch data');
      }

      const data = await res.json();
      setChartData(data.history || []);
      setMetrics(data.metrics || null);
      setProgress(100);

    } catch (e) {
      alert((e as Error).message);
    } finally {
      setTimeout(() => setIsTesting(false), 500);
    }
  };

  const handleChartClick = useCallback((e: any) => {
    if (!e) return;
    
    let clickedPoint: Omit<BacktestPoint, ""> | null = null;
    if (e.activePayload && e.activePayload.length > 0) {
      clickedPoint = e.activePayload[0].payload as BacktestPoint;
    } else if (e.activeLabel) {
      clickedPoint = chartData.find(d => d.date === e.activeLabel) || null;
    }

    if (!clickedPoint) return;
    
    if (!pointA) {
      setPointA(clickedPoint);
    } else if (!pointB) {
      if (new Date(clickedPoint.date) > new Date(pointA.date)) {
        setPointB(clickedPoint);
      } else {
        // Swap if B is earlier than A
        setPointB(pointA);
        setPointA(clickedPoint);
      }
    } else {
      // Reset and set A
      setPointB(null);
      setPointA(clickedPoint);
    }
  }, [pointA, pointB, chartData]);

  // Calculate customized return
  let customReturn = 0;
  if (pointA && pointB) {
    customReturn = ((pointB.close - pointA.close) / pointA.close) * 100;
  }

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
              <p className="text-sm text-white/40 font-bold">과거 데이터 기반 투자 시뮬레이션 및 차트 검증</p>
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
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">기업 티커 (Ticker)</label>
                <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl flex items-center gap-3 focus-within:ring-1 focus-within:ring-indigo-500/50">
                  <Search className="h-4 w-4 text-white/30" />
                  <Input 
                    type="text" 
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    className="bg-transparent border-none text-base font-black text-white p-0 h-auto focus-visible:ring-0 uppercase placeholder:text-white/20" 
                    placeholder="AAPL, TSLA..."
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">시뮬레이션 대상 기간</label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl">
                    <p className="text-[9px] text-white/30 uppercase mb-1">시작일</p>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent border-none text-xs text-white p-0 h-auto focus-visible:ring-0" 
                    />
                  </div>
                  <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl">
                    <p className="text-[9px] text-white/30 uppercase mb-1">종료일</p>
                    <Input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent border-none text-xs text-white p-0 h-auto focus-visible:ring-0" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black text-white/40 mb-2 block">초기 자본금</label>
                <div className="bg-[#0f111a] border border-white/10 p-3 rounded-xl flex flex-col">
                  <Input 
                    type="number" 
                    value={initialAmount}
                    onChange={(e) => setInitialAmount(Number(e.target.value))}
                    className="bg-transparent border-none text-base font-mono font-bold text-white p-0 h-auto focus-visible:ring-0" 
                  />
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
              {isTesting ? '백테스트 실행 중...' : '데이터 수집 및 시뮬레이션 시작'}
            </button>
          </div>

          <div className="lg:col-span-2 space-y-6 flex flex-col">
            {/* Status output */}
            <div className="p-6 rounded-3xl bg-[#161b22] border border-white/5 flex-1 relative overflow-hidden group min-h-[500px] flex flex-col">
              <div className="absolute top-0 right-0 p-32 bg-indigo-500/5 blur-[80px] pointer-events-none rounded-full" />
              
              {!isTesting && chartData.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-70 flex-1">
                  <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <Database className="h-8 w-8 text-white/20" />
                  </div>
                  <h3 className="text-sm font-black text-white">조건 설정 후 시뮬레이션을 시작하세요</h3>
                  <p className="text-xs text-white/40 mt-2 max-w-sm">과거 데이터를 바탕으로 시장 성과를 실제로 측정해 볼 수 있습니다.</p>
                </div>
              ) : isTesting ? (
                <div className="h-full flex flex-col justify-center flex-1">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-sm font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                        <Activity className="h-4 w-4 animate-pulse" /> Running Backtest
                      </h3>
                      <p className="text-[10px] text-white/40 mt-1">야후 파이낸스 과거 데이터 수집 및 시뮬레이션 계산 중...</p>
                    </div>
                    <span className="text-2xl font-black font-mono text-white">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-indigo-950/50" />
                </div>
              ) : (
                <div className="animate-in fade-in zoom-in duration-500 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-8 shrink-0">
                    <div>
                      <h3 className="text-lg font-black text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-indigo-400" /> {ticker} Backtest Summary
                      </h3>
                      <p className="text-xs text-white/50">{startDate} ➔ {endDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/40 uppercase font-black mb-1">총 누적 수익률</p>
                      <p className={cn(
                        "text-3xl font-black font-mono",
                        metrics?.totalReturn > 0 ? "text-emerald-400" : "text-rose-400"
                      )}>
                        {metrics?.totalReturn > 0 ? '+' : ''}{metrics?.totalReturn}%
                      </p>
                    </div>
                  </div>

                  {/* Interactive Return Panel */}
                  <div className="bg-[#080b10] p-4 rounded-xl border border-indigo-500/30 mb-6 shrink-0 flex items-center justify-between shadow-lg shadow-indigo-900/10">
                    <div className="text-[11px] text-indigo-200 font-bold max-w-md">
                      <span className="text-indigo-400 font-black">인터랙티브 수익률 측정기:</span> 그래프에서 확인하고 싶은 두 시점 (왼쪽, 오른쪽)을 클릭하면 해당 구간 내의 실제 주가 차이를 즉석에서 계산해 보여줍니다.
                    </div>
                    {pointA && pointB ? (
                      <div className="flex items-center gap-4 bg-[#161b22] px-4 py-2 rounded-lg border border-white/5">
                        <div className="text-right">
                          <p className="text-[9px] text-white/40 uppercase font-black">선택 시점 A (매수)</p>
                          <p className="text-sm font-mono font-bold text-white">${pointA.close.toFixed(2)}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-white/20" />
                        <div className="text-left">
                          <p className="text-[9px] text-white/40 uppercase font-black">선택 시점 B (매도)</p>
                          <p className="text-sm font-mono font-bold text-white">${pointB.close.toFixed(2)}</p>
                        </div>
                        <div className="ml-4 pl-4 border-l border-white/10">
                          <p className={cn(
                            "text-xl font-mono font-black",
                            customReturn > 0 ? 'text-emerald-400' : 'text-rose-400'
                          )}>
                            {customReturn > 0 ? '+' : ''}{customReturn.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-xs text-white/40 font-black">
                        {pointA ? '시점 B를 클릭하세요...' : '시점 A를 클릭하세요...'}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 w-full min-h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={chartData} 
                        onClick={handleChartClick}
                        className="cursor-crosshair"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis 
                          dataKey="date" 
                          stroke="rgba(255,255,255,0.1)" 
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                          tickFormatter={(val) => val.substring(5)}
                          minTickGap={30}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          stroke="rgba(255,255,255,0.1)" 
                          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                          width={40}
                          tickFormatter={(val) => `$${val}`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f111a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                          labelStyle={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', marginBottom: '4px' }}
                          itemStyle={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}
                          formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Close']}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="close" 
                          stroke="#6366f1" 
                          strokeWidth={2} 
                          dot={false}
                          activeDot={{ r: 6, fill: '#818cf8', strokeWidth: 0 }}
                        />
                        {pointA && <ReferenceDot x={pointA.date} y={pointA.close} r={6} fill="#10b981" stroke="none" />}
                        {pointB && <ReferenceDot x={pointB.date} y={pointB.close} r={6} fill="#f43f5e" stroke="none" />}
                        {pointA && pointB && (
                          <ReferenceArea x1={pointA.date} x2={pointB.date} fill="rgba(255,255,255,0.05)" />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
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
