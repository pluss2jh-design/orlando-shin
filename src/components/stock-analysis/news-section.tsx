'use client';

import React, { useState } from 'react';
import { Newspaper, ChevronDown, ChevronUp, ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NewsSummary } from '@/types/stock-analysis';

interface NewsSectionProps {
  summaries: NewsSummary[];
  isLoading?: boolean;
}

export function NewsSection({ summaries, isLoading }: NewsSectionProps) {
  const [expandedTickers, setExpandedTickers] = useState<Set<string>>(new Set());

  const toggleTicker = (ticker: string) => {
    const newSet = new Set(expandedTickers);
    if (newSet.has(ticker)) {
      newSet.delete(ticker);
    } else {
      newSet.add(ticker);
    }
    setExpandedTickers(newSet);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'negative':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSentimentBadge = (sentiment: string) => {
    const configs = {
      positive: { label: '긍정적', className: 'bg-green-100 text-green-700 border-green-300' },
      negative: { label: '부정적', className: 'bg-red-100 text-red-700 border-red-300' },
      neutral: { label: '중립적', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    };
    const config = configs[sentiment as keyof typeof configs] || configs.neutral;
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Newspaper className="h-5 w-5 animate-pulse" />
            뉴스 및 공시 정보 로딩 중...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summaries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold flex items-center gap-2 px-1">
        <Newspaper className="h-6 w-6 text-primary" />
        최신 뉴스 및 공시
      </h3>

      {summaries.map((summary) => (
        <Card key={summary.ticker} className="w-full overflow-hidden">
          <CardHeader className="pb-3 bg-muted/30">
            <Collapsible>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
                  <div className="flex items-center gap-3">
                    {getSentimentIcon(summary.overallSentiment)}
                    <div className="text-left">
                      <CardTitle className="text-lg font-bold">{summary.companyName}</CardTitle>
                      <p className="text-sm text-muted-foreground">{summary.ticker}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getSentimentBadge(summary.overallSentiment)}
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="bg-primary/5 p-4 rounded-lg mb-4">
                    <h4 className="text-sm font-bold text-primary mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      AI 요약 핵심 사항
                    </h4>
                    <ul className="space-y-2">
                      {summary.keyHighlights.map((highlight, idx) => (
                        <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                          <span className="text-primary font-bold">{idx + 1}.</span>
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-muted-foreground uppercase">
                      최신 뉴스 ({summary.latestNews.length}건)
                    </h4>
                    {summary.latestNews.map((news) => (
                      <div
                        key={news.id}
                        className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm mb-1">{news.title}</h5>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {news.content}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{news.source}</span>
                              <span>•</span>
                              <span>{new Date(news.publishedAt).toLocaleDateString('ko-KR')}</span>
                              {news.url && (
                                <a
                                  href={news.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  원문 보기
                                </a>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              news.sentiment === 'positive'
                                ? 'border-green-500 text-green-600'
                                : news.sentiment === 'negative'
                                ? 'border-red-500 text-red-600'
                                : 'border-gray-500 text-gray-600'
                            }
                          >
                            {news.sentiment === 'positive' ? '긍정' : news.sentiment === 'negative' ? '부정' : '중립'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
