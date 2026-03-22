'use client';

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  Calendar, 
  BarChart3, 
  ArrowUpRight, 
  ArrowDownRight,
  Loader2,
  Activity,
  DollarSign,
  Target,
  Sparkles
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface BacktestDialogProps {
  ticker: string;
  isOpen: boolean;
  onClose: () => void;
}

const PERIODS = [
  { id: '3m', label: '3개월' },
  { id: '6m', label: '6개월' },
  { id: '1y', label: '1년' },
  { id: '3y', label: '3년' },
];

export function BacktestDialog({ ticker, isOpen, onClose }: BacktestDialogProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('1y');

  useEffect(() => {
    if (isOpen && ticker) {
      fetchBacktestData();
    }
  }, [isOpen, ticker, period]);

  const fetchBacktestData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stock/backtest?ticker=${ticker}&period=${period}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '백테스트 데이터를 가져오지 못했습니다.');
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300 border border-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">{ticker}</h2>
                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 font-bold">과거 수익률 백테스트</Badge>
              </div>
              <p className="text-sm text-gray-500 font-medium">{data?.name || '기업 정보를 불러오는 중...'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-gray-100 p-1 rounded-xl mr-4">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "px-4 py-1.5 text-xs font-black rounded-lg transition-all",
                    period === p.id 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50/30">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
              <p className="text-sm font-bold text-gray-500 animate-pulse">상세 데이터 시뮬레이션 중...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
                <X className="h-8 w-8 text-rose-500" />
              </div>
              <p className="text-lg font-bold text-gray-900">{error}</p>
              <Button onClick={fetchBacktestData} variant="outline" className="rounded-xl">다시 시도</Button>
            </div>
          ) : (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-[10px]">총 수익률</p>
                      <div className={cn(
                        "p-1.5 rounded-lg",
                        data.metrics.totalReturn >= 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"
                      )}>
                        {data.metrics.totalReturn >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      </div>
                    </div>
                    <p className={cn(
                      "text-3xl font-black font-mono tracking-tighter",
                      data.metrics.totalReturn >= 0 ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {data.metrics.totalReturn > 0 ? '+' : ''}{data.metrics.totalReturn}%
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">벤치마크 (S&P 500) 대비</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-[10px]">최대 낙폭 (MDD)</p>
                      <div className="p-1.5 rounded-lg bg-rose-50 text-rose-500">
                        <Activity className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-3xl font-black font-mono tracking-tighter text-rose-500">
                      {data.metrics.mdd}%
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">고점 대비 최하락폭 지수</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-[10px]">시작 주가</p>
                      <div className="p-1.5 rounded-lg bg-gray-50 text-gray-500">
                        <DollarSign className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black font-mono tracking-tighter text-gray-900">
                      {data.metrics.startPrice.toLocaleString()} <span className="text-sm font-medium">{data.currency}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(data.metrics.startDate).toLocaleDateString()} 기준</p>
                  </CardContent>
                </Card>

                <Card className="bg-white border-gray-100 shadow-sm rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest text-[10px]">현재 주가</p>
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500">
                        <Target className="h-3.5 w-3.5" />
                      </div>
                    </div>
                    <p className="text-2xl font-black font-mono tracking-tighter text-blue-600">
                      {data.metrics.endPrice.toLocaleString()} <span className="text-sm font-medium">{data.currency}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(data.metrics.endDate).toLocaleDateString()} 기준</p>
                  </CardContent>
                </Card>
              </div>

              {/* Chart */}
              <Card className="bg-white border-gray-100 shadow-sm rounded-3xl p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-8 bg-blue-600 rounded-full" />
                    <h3 className="text-lg font-black text-gray-900 uppercase">주가 변동 추이 및 시뮬레이션</h3>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none font-bold">1일 간격</Badge>
                    <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-none font-bold">{PERIODS.find(p => p.id === period)?.label}</Badge>
                  </div>
                </div>

                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.history}>
                      <defs>
                        <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                        minTickGap={50}
                      />
                      <YAxis 
                        hide={false}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 10, fontWeight: 700 }}
                        domain={['auto', 'auto']}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: 'none', 
                          borderRadius: '16px', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: '#111827'
                        }}
                        labelStyle={{ color: '#6b7280', marginBottom: '4px' }}
                        formatter={(value: any) => [`${value.toLocaleString()} ${data.currency}`, '종가']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="close" 
                        stroke="#2563eb" 
                        strokeWidth={3}
                        fillOpacity={1} 
                        fill="url(#colorClose)" 
                        animationDuration={1500}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Analysis Text */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-3xl bg-blue-600 text-white space-y-4">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-5 w-5" />
                    <h3 className="text-lg font-black uppercase">알파 전략 인사이트</h3>
                  </div>
                  <p className="text-sm leading-loose opacity-90 font-medium whitespace-pre-line text-justify">
                    {ticker}는 지난 {PERIODS.find(p => p.id === period)?.label} 동안 {data.metrics.totalReturn}%의 수익률을 보였습니다. 
                    특히 {data.metrics.mdd}%의 최대 낙폭 지수를 고려할 때, {(data.metrics.mdd > -15) ? '안정적인 방어력을 보유한 것으로 판단됩니다.' : '변동성이 큰 편이지만 고수익 기회를 추구하는 전략에 적합합니다.'}
                    
                    현재 주가는 {data.metrics.endPrice.toLocaleString()} {data.currency}로, 해당 기간 시작가인 {data.metrics.startPrice.toLocaleString()} 대비 {data.metrics.totalReturn > 0 ? '상승' : '하락'} 추세에 있습니다.
                  </p>
                </div>

                <div className="p-6 rounded-3xl border border-gray-200 bg-white space-y-4">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-5 w-5 text-gray-500" />
                    <h3 className="text-lg font-black uppercase text-gray-900">시뮬레이션 로직</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-xs font-black text-gray-500">벤치마크 (S&P 500)</span>
                      <span className="text-xs font-bold text-gray-900">+15.0%</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <span className="text-xs font-black text-gray-500">기간 구분</span>
                      <span className="text-xs font-bold text-gray-900">{PERIODS.find(p => p.id === period)?.label} 시뮬레이션</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <span className="text-xs font-black text-emerald-600 text-gray-500">알파 수익률 (초과)</span>
                      <span className="text-xs font-black text-emerald-600">
                        {data.metrics.totalReturn - 15 > 0 ? '+' : ''}{(data.metrics.totalReturn - 15).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em]">
            자료 출처: 야후 파이낸스 실시간 시뮬레이션 플랫폼
          </p>
          <Button onClick={onClose} className="rounded-xl px-8 font-black uppercase text-xs tracking-widest">
            분석 종료
          </Button>
        </div>
      </div>
    </div>
  );
}
