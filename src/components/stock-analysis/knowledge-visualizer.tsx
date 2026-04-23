'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { 
  Zap, Brain, Target, Shield, CheckCircle2, 
  TrendingUp, Activity, BarChart3, 
  BarChart, Layers, Share2, Info, Move, 
  MousePointer2, RotateCcw, Sparkles, ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AIModel, APIKeys } from '@/types/stock-analysis';

/**
 * ─── 1. Nested Treemap (D3.js) ────────────────────────────────────
 * 가중치에 따라 실시간으로 타일 크기가 변하는 지능형 그룹 트리맵입니다.
 */
export function KnowledgeTreemap({ 
  data, 
  customWeights = {} 
}: { 
  data: any, 
  customWeights?: Record<string, number> 
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const criterias = data?.criteria?.criterias || [];

  useEffect(() => {
    if (!containerRef.current || criterias.length === 0) return;

    d3.select(containerRef.current).selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = 450;

    const categories = Array.from(new Set(criterias.map((c: any) => c.category)));
    
    // Create Hierarchy
    const hierarchyData = {
      name: 'root',
      children: categories.map(cat => ({
        name: cat,
        children: criterias
          .filter((c: any) => c.category === cat)
          .map((c: any) => ({
            name: c.name,
            // 실시간 반영 가중치 사용
            value: Math.pow(customWeights[c.name] || c.userWeight || c.weight || 1, 2.2) + 1 
          }))
      }))
    };

    const root = d3.hierarchy(hierarchyData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    (d3.treemap() as any)
      .size([width, height])
      .paddingOuter(12) // 카테고리 간 간격
      .paddingTop(32)   // 카테고리 제목 영역
      .paddingInner(4)  // 내부 항목 간 간격
      .round(true)(root);

    const svg = d3.select(containerRef.current)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height)
      .style('border-radius', '24px');

    // Categorical color scheme (Supports both English and Korean from AI extraction)
    const colors = {
      // English Keys
      'Growth': '#10b981', 'Value': '#6366f1', 'Profitability': '#f59e0b', 
      'Stability': '#0ea5e9', 'Momentum': '#ec4899', 'Macro': '#8b5cf6',
      // Korean Keys (Mapped from common AI extraction labels)
      '성장성': '#10b981',
      '밸류에이션': '#6366f1',
      '밸류에이션/리스크': '#4f46e5',
      '수익성': '#f59e0b',
      '수익성/성장성': '#fbbf24',
      '리스크 통제': '#0ea5e9',
      '재무건전성': '#2dd4bf',
      '해자': '#ec4899',
      '비즈니스 모델': '#8b5cf6',
      '매수 타이밍': '#f43f5e',
      '기타': '#94a3b8'
    };
    const getCatColor = (cat: string) => (colors as any)[cat] || '#94a3b8';

    // 1. Group (Category) Render
    const nodes = svg.selectAll('g')
      .data(root.descendants())
      .enter().append('g')
      .attr('transform', (d: any) => `translate(${d.x0},${d.y0})`);

    // Category BG
    nodes.filter(d => d.depth === 1)
      .append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d: any) => getCatColor(d.data.name))
      .attr('fill-opacity', 0.1)
      .attr('stroke', (d: any) => getCatColor(d.data.name))
      .attr('stroke-width', 2.5)
      .attr('stroke-opacity', 0.3)
      .attr('rx', 12);

    // Category Label
    nodes.filter(d => d.depth === 1)
      .append('text')
      .attr('x', 14)
      .attr('y', 20)
      .text((d: any) => d.data.name.toUpperCase())
      .attr('font-size', '11px')
      .attr('font-weight', '900')
      .attr('fill', (d: any) => getCatColor(d.data.name))
      .attr('letter-spacing', '0.1em');

    // 2. Leaf (Rule) Render
    const leaf = nodes.filter(d => d.depth === 2);

    leaf.append('rect')
      .attr('width', (d: any) => d.x1 - d.x0)
      .attr('height', (d: any) => d.y1 - d.y0)
      .attr('fill', (d: any) => getCatColor(d.parent.data.name))
      .attr('fill-opacity', (d: any) => {
        // 가중치에 따른 농도 조절 (더 뚜렷한 차이를 위해 지수 적용)
        // d.data.value는 이전에 Math.pow(w, 2.2)+1 로 계산됨
        const val = d.data.value || 0;
        // 범위를 0.2 ~ 0.85 사이로 조정하여 비중이 작아도 보이게, 커지면 아주 진하게 조절
        const opacity = 0.2 + (Math.min(val, 40) / 40) * 0.65;
        return opacity;
      })
      .attr('stroke', 'rgba(255,255,255,0.1)')
      .attr('stroke-width', 1)
      .attr('rx', 4);

    leaf.append('foreignObject')
      .attr('x', 4)
      .attr('y', 4)
      .attr('width', (d: any) => Math.max(0, d.x1 - d.x0 - 8))
      .attr('height', (d: any) => Math.max(0, d.y1 - d.y0 - 8))
      .append('xhtml:div')
      .attr('xmlns', 'http://www.w3.org/1999/xhtml')
      .style('width', '100%')
      .style('height', '100%')
      .style('color', 'white')
      .style('font-size', '10px')
      .style('font-weight', 'bold')
      .style('display', '-webkit-box')
      .style('-webkit-line-clamp', (d: any) => {
        const h = d.y1 - d.y0;
        if (h < 30) return 1;
        if (h < 50) return 2;
        return 3;
      })
      .style('-webkit-box-orient', 'vertical')
      .style('overflow', 'hidden')
      .style('text-overflow', 'ellipsis')
      .style('line-height', '1.2')
      .style('padding', '4px')
      .style('box-sizing', 'border-box')
      .style('pointer-events', 'none')
      .style('word-break', 'break-all')
      .text((d: any) => d.data.name);

  }, [criterias, customWeights]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
         <Layers className="h-5 w-5 text-indigo-400" />
         <span className="text-sm font-black text-indigo-300 uppercase tracking-widest font-mono">Strategy Hierarchy Treemap</span>
      </div>
      <div ref={containerRef} className="w-full bg-[#0a0c10]/40 rounded-3xl border border-white/5 overflow-hidden h-[450px] relative transition-all duration-700" />
      <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-start gap-4">
          <div className="p-1.5 bg-indigo-500/20 rounded-lg shrink-0"><Info className="h-4 w-4 text-indigo-400" /></div>
          <p className="text-[11px] text-white/40 leading-relaxed font-medium">
            영역의 크기는 해당 조건의 <strong>전략 내 영향력</strong>을 의미합니다. 카테고리별 그룹핑을 통해 특정 섹터에 편향되지 않았는지 확인하십시오. 하단의 슬라이더를 조절하면 트리맵 비중이 실시간으로 동기화됩니다.
          </p>
      </div>
    </div>
  );
}

/**
 * ─── 2. Card Library with Weight Control & Action Buttons ──────────
 */
export function KnowledgeTuningCenter({ 
  knowledge, 
  onSynthesisTrigger,
  availableModels = [],
  apiKeys = {},
  selectedModel,
  onModelChange,
  selectedModelSecondary,
  onModelChangeSecondary
}: { 
  knowledge: any; 
  onSynthesisTrigger: (weights: Record<string, number>, aiModel?: string, fallbackAiModel?: string) => void;
  availableModels?: AIModel[];
  apiKeys?: APIKeys;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  selectedModelSecondary?: string;
  onModelChangeSecondary?: (model: string) => void;
}) {
  const initialCriterias = knowledge?.criteria?.criterias || [];
  const [localWeights, setLocalWeights] = useState<Record<string, number>>({});

  // Initialize
  useEffect(() => {
    const initial: Record<string, number> = {};
    initialCriterias.forEach((c: any) => {
      initial[c.name] = c.userWeight || c.weight || 3;
    });
    setLocalWeights(initial);
  }, [initialCriterias]);

  const handleWeightChange = (name: string, value: number) => {
    setLocalWeights(prev => ({ ...prev, [name]: value }));
  };

  const handleReset = () => {
    const reset: Record<string, number> = {};
    initialCriterias.forEach((c: any) => {
      reset[c.name] = c.weight || 3;
    });
    setLocalWeights(reset);
  };

  return (
    <div className="space-y-8 mt-12">
      {/* Real-time Linked Treemap */}
      <KnowledgeTreemap data={knowledge} customWeights={localWeights} />

      {/* Control Header */}
      <div className="flex items-center justify-between pt-8 border-t border-white/10">
        <div className="flex items-center gap-2">
           <BarChart className="h-5 w-5 text-amber-400" />
           <span className="text-sm font-black text-amber-300 uppercase tracking-widest font-mono">Weight Configuration Area</span>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleReset}
          className="h-8 border-white/20 text-white/70 hover:text-white text-[10px] font-black hover:bg-white/10 gap-2 uppercase tracking-widest bg-white/5 shadow-lg"
        >
          <RotateCcw className="h-3 w-3" /> AI 추천값 초기화
        </Button>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
        {initialCriterias.map((rule: any, i: number) => (
          <div key={i} className="p-6 rounded-3xl bg-[#141720] border border-white/5 hover:border-amber-500/40 transition-all flex flex-col gap-3 group">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                 <Badge className="mb-2 text-[8px] font-black uppercase tracking-widest bg-amber-500/20 text-amber-300 border-none px-2 rounded-md">
                   {rule.category}
                 </Badge>
                 <h4 className="text-[14px] font-black text-white truncate">{rule.name}</h4>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-2 -mr-2 text-white/20 hover:text-amber-400 cursor-help transition-colors">
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px] p-4 bg-[#0a0c10] border-white/10 text-white rounded-xl shadow-2xl">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">AI 추천 근거</p>
                    <p className="text-xs leading-relaxed text-white/80 whitespace-pre-wrap">
                      {rule.weightRationale || "원천 데이터 분석을 통해 도출된 핵심 투자 전략 요인입니다."}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="mt-4 space-y-3 bg-black/20 p-4 rounded-2xl border border-white/5">
               <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-white/30 uppercase">반영 가중치</span>
                  <span className="text-sm font-black text-amber-400 font-mono">× {localWeights[rule.name] || 3}</span>
               </div>
               <Slider 
                 value={[localWeights[rule.name] || 3]} 
                 min={1} 
                 max={5} 
                 step={1}
                 onValueChange={(val) => handleWeightChange(rule.name, val[0])}
                 className="py-1"
               />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-8 pt-12 border-t border-white/10 max-w-4xl mx-auto w-full">
        {availableModels.length > 0 && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 bg-indigo-500/5 p-8 rounded-[40px] border border-indigo-500/10">
            <div className="md:col-span-2 flex items-center gap-2 mb-2">
              <Brain className="h-5 w-5 text-indigo-400" />
              <h4 className="text-sm font-black text-white/60 uppercase tracking-[0.3em]">AI Strategy Synthesis Engine</h4>
            </div>
            
            <div className="space-y-3">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest pl-1">Primary Engine (1순위)</p>
              <Select 
                value={selectedModel} 
                onValueChange={onModelChange}
              >
                <SelectTrigger className="w-full h-14 bg-[#0a0c10] border-white/5 rounded-2xl text-white font-bold focus:ring-amber-500/30">
                  <SelectValue placeholder="1순위 모델 선택" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f111a] border-white/10 text-white">
                  {availableModels.map((model) => {
                    const hasKey = apiKeys && apiKeys[model.reqKey as keyof APIKeys];
                    return (
                      <SelectItem 
                        key={model.value} 
                        value={model.value} 
                        disabled={!hasKey}
                        className="py-4 px-6 focus:bg-white/5 focus:text-white"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between w-full gap-8">
                            <span className={cn("font-bold text-base", model.isRecommendedForLearning && "text-amber-400")}>
                              {model.label}
                            </span>
                            {!hasKey && <span className="text-xs text-rose-500 font-black">KEY 미등록</span>}
                          </div>
                          <span className="text-xs text-white/30 uppercase tracking-tighter">
                            {model.provider} • CORE KNOWLEDGE ENGINE
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest pl-1">Fallback Engine (2순위)</p>
              <Select 
                value={selectedModelSecondary} 
                onValueChange={onModelChangeSecondary}
              >
                <SelectTrigger className="w-full h-14 bg-[#0a0c10] border-white/5 rounded-2xl text-white font-bold focus:ring-amber-500/30">
                  <SelectValue placeholder="2순위(폴백) 모델 선택" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f111a] border-white/10 text-white">
                  {availableModels.map((model) => {
                    const hasKey = apiKeys && apiKeys[model.reqKey as keyof APIKeys];
                    return (
                      <SelectItem 
                        key={model.value} 
                        value={model.value} 
                        disabled={!hasKey}
                        className="py-4 px-6 focus:bg-white/5 focus:text-white"
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between w-full gap-8">
                            <span className="font-bold text-base">
                              {model.label}
                            </span>
                            {!hasKey && <span className="text-xs text-rose-500 font-black">KEY 미등록</span>}
                          </div>
                          <span className="text-xs text-white/30 italic">
                            1순위 실패(3회 시도) 시 자동 전환
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <p className="md:col-span-2 text-xs text-white/30 text-center font-medium italic pt-2">
              설정된 가중치와 선택된 AI 엔진들을 통해 최종 투자 지식을 합성합니다. (1순위 모델 3회 시도 후 실패 시 2순위로 자동 전환)
            </p>
          </div>
        )}

        <Button 
          onClick={() => onSynthesisTrigger(localWeights, selectedModel, selectedModelSecondary)}
          className="h-16 px-12 rounded-[24px] bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-lg font-black text-white shadow-2xl shadow-orange-500/20 flex items-center gap-4 group transition-all"
        >
          <Sparkles className="h-6 w-6 animate-pulse" />
          투자 지식 합성 시작
          <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
