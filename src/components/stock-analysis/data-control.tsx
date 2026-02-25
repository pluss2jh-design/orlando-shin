'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { Upload, File, Video, FileText, X, Cloud, Check, Loader2, BookOpen, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, formatFileSize, getFileType, generateId } from '@/lib/stock-analysis/utils';
import { UploadedFile, CloudSyncStatus, LearnedKnowledge } from '@/types/stock-analysis';

function getTotalRulesCount(knowledge: LearnedKnowledge): number {
  const criteria = knowledge.criteria;
  return (
    (criteria?.goodCompanyRules?.length || 0) +
    (criteria?.technicalRules?.length || 0) +
    (criteria?.marketSizeRules?.length || 0) +
    (criteria?.unitEconomicsRules?.length || 0) +
    (criteria?.lifecycleRules?.length || 0) +
    (criteria?.buyTimingRules?.length || 0)
  );
}

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
}

interface DataControlProps {
  onFilesChange?: (files: UploadedFile[]) => void;
  onSyncStatusChange?: (status: CloudSyncStatus) => void;
  onLearningComplete?: () => void;
}

export function DataControl({ onFilesChange, onSyncStatusChange, onLearningComplete }: DataControlProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({ status: 'idle' });
  const [isLearning, setIsLearning] = useState(false);
  const [learningStatus, setLearningStatus] = useState<string | null>(null);
  const [learnedKnowledge, setLearnedKnowledge] = useState<LearnedKnowledge | null>(null);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        const response = await fetch('/api/gdrive/learn');
        const data = await response.json();
        if (data.exists) {
          const knowledgeResponse = await fetch('/api/gdrive/knowledge');
          if (knowledgeResponse.ok) {
            const knowledgeData = await knowledgeResponse.json();
            setLearnedKnowledge(knowledgeData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch knowledge:', error);
      }
    };
    fetchKnowledge();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  }, []);

  const handleFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(file => {
      const type = getFileType(file.name);
      return type === 'pdf' || type === 'mp4';
    });

    const uploadedFiles: UploadedFile[] = validFiles.map(file => ({
      id: generateId(),
      name: file.name,
      type: getFileType(file.name),
      size: file.size,
      uploadedAt: new Date(),
      status: 'pending',
    }));

    const updatedFiles = [...files, ...uploadedFiles];
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);

    uploadedFiles.forEach((file, index) => {
      simulateUpload(file.id, index);
    });
  };

  const simulateUpload = (fileId: string, delay: number) => {
    setTimeout(() => {
      setFiles(prev => {
        const updated = prev.map(f => 
          f.id === fileId ? { ...f, status: 'uploading' as const } : f
        );
        onFilesChange?.(updated);
        return updated;
      });

      setTimeout(() => {
        setFiles(prev => {
          const updated = prev.map(f => 
            f.id === fileId ? { ...f, status: 'completed' as const } : f
          );
          onFilesChange?.(updated);
          return updated;
        });
      }, 1500 + Math.random() * 1000);
    }, delay * 200);
  };

  const removeFile = (fileId: string) => {
    const updated = files.filter(f => f.id !== fileId);
    setFiles(updated);
    onFilesChange?.(updated);
  };

  const handleSync = async () => {
    setSyncStatus({ status: 'syncing' });
    onSyncStatusChange?.({ status: 'syncing' });

    try {
      const response = await fetch('/api/gdrive/sync', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '동기화 실패');
      }

      const driveFiles: UploadedFile[] = (data.files as DriveFileInfo[]).map(
        (f: DriveFileInfo) => ({
          id: f.id,
          name: f.name,
          type: f.mimeType.includes('pdf')
            ? ('pdf' as const)
            : f.mimeType.includes('video')
              ? ('mp4' as const)
              : ('other' as const),
          size: parseInt(f.size || '0', 10),
          uploadedAt: new Date(f.modifiedTime),
          status: 'completed' as const,
          url: undefined,
        })
      );

      setFiles(driveFiles);
      onFilesChange?.(driveFiles);

      const newStatus: CloudSyncStatus = {
        status: 'synced',
        lastSync: new Date(),
        message: `Google Drive 동기화 완료 (${data.totalCount}개 파일)`,
      };
      setSyncStatus(newStatus);
      onSyncStatusChange?.(newStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : '동기화 실패';
      const errorStatus: CloudSyncStatus = {
        status: 'error',
        message,
      };
      setSyncStatus(errorStatus);
      onSyncStatusChange?.(errorStatus);
    }
  };

  const handleLearn = async () => {
    const confirmed = window.confirm('학습을 위해 AI 모델을 사용하며 비용이 발생할 수 있습니다. 계속하시겠습니까?');
    if (!confirmed) return;

    setIsLearning(true);
    setLearningStatus('Google Drive 자료를 AI가 학습 중입니다...');

    try {
      const response = await fetch('/api/gdrive/learn', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '학습 실패');
      }

      setLearningStatus(
        `학습 완료! ${data.filesAnalyzed}개 파일 분석, ${data.rulesLearned}개 투자 규칙 학습됨`
      );
      
      const knowledgeResponse = await fetch('/api/gdrive/knowledge');
      if (knowledgeResponse.ok) {
        const knowledgeData = await knowledgeResponse.json();
        setLearnedKnowledge(knowledgeData);
      }
      
      onLearningComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '학습 실패';
      setLearningStatus(`학습 실패: ${message}`);
    } finally {
      setIsLearning(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />;
      case 'mp4':
        return <Video className="h-5 w-5 text-blue-500" />;
      default:
        return <File className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">대기 중</Badge>;
      case 'uploading':
        return <Badge variant="outline" className="animate-pulse">업로드 중</Badge>;
      case 'completed':
        return <Badge variant="default" className="bg-green-500">완료</Badge>;
      case 'error':
        return <Badge variant="destructive">오류</Badge>;
    }
  };

  const completedCount = files.filter(f => f.status === 'completed').length;
  const canLearn = completedCount > 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            데이터 관리 (Data Control)
          </CardTitle>
          <div className="flex items-center gap-2">
            {syncStatus.status === 'synced' && (
              <span className="text-xs text-muted-foreground">
                마지막 동기화: {syncStatus.lastSync?.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncStatus.status === 'syncing'}
              className="flex items-center gap-2"
            >
              {syncStatus.status === 'syncing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : syncStatus.status === 'synced' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              {syncStatus.status === 'syncing' ? '동기화 중...' : 'Google Drive 동기화'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragging 
              ? "border-primary bg-primary/5" 
              : "border-border hover:border-primary/50"
          )}
        >
          <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground mb-2">
            파일을 여기에 드래그하거나 클릭하여 업로드하세요
          </p>
          <p className="text-xs text-muted-foreground mb-4">
            지원 형식: PDF, MP4 (최대 100MB)
          </p>
          <input
            type="file"
            accept=".pdf,.mp4"
            multiple
            onChange={handleFileInput}
            className="hidden"
            id="file-upload"
          />
          <Button
            variant="secondary"
            onClick={() => document.getElementById('file-upload')?.click()}
          >
            파일 선택
          </Button>
        </div>

        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">업로드된 파일 ({files.length})</h4>
              {canLearn && (
                <Button
                  size="sm"
                  onClick={handleLearn}
                  disabled={isLearning}
                  className="flex items-center gap-2"
                >
                  {isLearning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      학습 중...
                    </>
                  ) : (
                    '학습 시작'
                  )}
                </Button>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  {getFileIcon(file.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                    {file.status === 'uploading' && (
                      <Progress value={50} className="h-1 mt-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(file.status)}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )        }

        {syncStatus.message && (
          <div className={cn(
            "text-xs text-center p-2 rounded",
            syncStatus.status === 'synced' ? "bg-green-50 text-green-700" :
            syncStatus.status === 'error' ? "bg-red-50 text-red-700" : "bg-muted"
          )}>
            {syncStatus.message}
          </div>
        )}

        {learningStatus && (
          <div className={cn(
            "text-xs text-center p-2 rounded",
            learningStatus.startsWith('학습 완료') ? "bg-blue-50 text-blue-700" :
            learningStatus.startsWith('학습 실패') ? "bg-red-50 text-red-700" :
            "bg-yellow-50 text-yellow-700"
          )}>
            {learningStatus}
          </div>
        )}

        {learnedKnowledge && (
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">
                  학습된 투자 규칙 ({getTotalRulesCount(learnedKnowledge)}개)
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRules(!showRules)}
              >
                {showRules ? '접기' : '펼치기'}
              </Button>
            </div>
            
            {showRules && (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {learnedKnowledge.criteria?.goodCompanyRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">재무지표 규칙</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.goodCompanyRules.map((rule, index) => (
                        <div key={`fund-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learnedKnowledge.criteria?.technicalRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">기술적 분석 규칙 (스토캐스틱, RSI, MACD 등)</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.technicalRules.map((rule, index) => (
                        <div key={`tech-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">[{rule.indicator}] {rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learnedKnowledge.criteria?.marketSizeRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">시장 규모 규칙 (TAM/SAM/SOM)</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.marketSizeRules.map((rule, index) => (
                        <div key={`market-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learnedKnowledge.criteria?.unitEconomicsRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">단위 경제성 규칙 (CAC, LTV, 공헌이익률)</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.unitEconomicsRules.map((rule, index) => (
                        <div key={`unit-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-purple-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">[{rule.metric}] {rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learnedKnowledge.criteria?.lifecycleRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">기업 생애주기 규칙</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.lifecycleRules.map((rule, index) => (
                        <div key={`life-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">[{rule.stage}] {rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {learnedKnowledge.criteria?.buyTimingRules?.length > 0 && (
                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">매수 타이밍 규칙</h5>
                    <div className="space-y-1">
                      {learnedKnowledge.criteria.buyTimingRules.map((rule, index) => (
                        <div key={`timing-${index}`} className="flex items-start gap-2 p-2 rounded bg-muted/50 text-xs">
                          <ListChecks className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium">{rule.rule}</p>
                            <p className="text-muted-foreground mt-0.5">가중치: {(rule.weight * 100).toFixed(0)}%</p>
                            {rule.conditions && rule.conditions.length > 0 && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">조건: {rule.conditions.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {!showRules && (
              <p className="text-xs text-muted-foreground">
                총 {getTotalRulesCount(learnedKnowledge)}개의 투자 규칙이 학습되었습니다.
                '펼치기'를 클릭하여 모든 규칙을 확인하세요.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
