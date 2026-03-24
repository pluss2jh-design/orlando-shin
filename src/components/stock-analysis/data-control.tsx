'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Upload, File, Video, FileText, X, Cloud, Check, Loader2, BookOpen, ListChecks, 
  Settings2, ChevronUp, ChevronDown, AlertCircle, Eye, Folder, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn, formatFileSize, getFileType, generateId } from '@/lib/stock-analysis/utils';
import { UploadedFile, CloudSyncStatus, LearnedKnowledge } from '@/types/stock-analysis';

function getTotalRulesCount(knowledge: LearnedKnowledge): number {
  return (knowledge.criteria?.criterias?.length || 0);
}

interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  modifiedTime: string;
  parentId?: string;
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
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);

  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        const response = await fetch('/api/gdrive/learn');
        const data = await response.json();
        if (data.exists) {
          const knowledgeResponse = await fetch('/api/gdrive/knowledge');
          if (knowledgeResponse.ok) {
            const knowledgeData = await knowledgeResponse.json();
            setLearnedKnowledge(knowledgeData.knowledge);
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
      type: getFileType(file.name) as any,
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
              : f.mimeType === 'application/vnd.google-apps.folder'
                ? ('folder' as const)
                : ('other' as const),
          size: parseInt(f.size || '0', 10),
          uploadedAt: new Date(f.modifiedTime),
          status: 'completed' as const,
          url: undefined,
          parentId: f.parentId,
        })
      );

      // Determine root folder ID (the one that is not a parent of anyone in the current list, or the parent of the first few items)
      // Actually, listDriveFiles returns items with parentId. The very first items' parentId is the root folder.
      if (driveFiles.length > 0) {
        // We find the parentId that is not present in the list of IDs
        const ids = new Set(driveFiles.map(f => f.id));
        const firstParentId = driveFiles.find(f => f.parentId && !ids.has(f.parentId))?.parentId;
        if (firstParentId) setRootFolderId(firstParentId);
      }

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
      const response = await fetch('/api/gdrive/learn', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: files.filter(f => f.type !== 'folder').map(f => f.id)
        })
      });
      
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
        setLearnedKnowledge(knowledgeData.knowledge);
      }
      
      onLearningComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : '학습 실패';
      setLearningStatus(`학습 실패: ${message}`);
    } finally {
      setIsLearning(false);
    }
  };

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFileTree = (parentId: string | null, level: number = 0) => {
    const children = files
      .filter(f => f.parentId === parentId || (parentId === rootFolderId && f.parentId === parentId) || (!f.parentId && parentId === null))
      .sort((a, b) => {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        return a.name.localeCompare(b.name);
      });

    // If we're at the very root and the filter above didn't catch anything (e.g. because rootFolderId is set but parentId mismatch)
    // We try to find items whose parentId is not in the set of IDs
    let itemsToRender = children;
    if (level === 0 && children.length === 0 && files.length > 0) {
      const ids = new Set(files.map(f => f.id));
      itemsToRender = files.filter(f => !f.parentId || !ids.has(f.parentId)).sort((a,b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return a.name.localeCompare(b.name);
      });
    }

    return itemsToRender.map(file => (
      <React.Fragment key={file.id}>
        <div 
          className={cn(
            "flex items-center justify-between p-2 rounded-lg transition-colors group",
            file.type === 'folder' ? "hover:bg-muted/50 cursor-pointer" : "hover:bg-muted/30 border border-transparent hover:border-muted",
            level > 0 && "ml-4 border-l pl-4"
          )}
          onClick={() => file.type === 'folder' && toggleFolder(file.id)}
        >
          <div className="flex items-center gap-2 overflow-hidden">
            {file.type === 'folder' && (
              expandedFolders.has(file.id) ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <div className={cn(
              "p-1.5 rounded-md shrink-0",
              file.type === 'mp4' ? "bg-blue-500/10 text-blue-500" : 
              file.type === 'pdf' ? "bg-red-500/10 text-red-500" :
              file.type === 'folder' ? "bg-yellow-500/10 text-yellow-500" :
              "bg-gray-500/10 text-gray-500"
            )}>
              {file.type === 'mp4' ? <Video className="h-3.5 w-3.5" /> : 
               file.type === 'pdf' ? <FileText className="h-3.5 w-3.5" /> : 
               file.type === 'folder' ? <Folder className="h-3.5 w-3.5" /> :
               <File className="h-3.5 w-3.5" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium truncate">{file.name}</p>
              {file.type !== 'folder' && (
                <p className="text-[10px] text-muted-foreground">{formatFileSize(file.size)} • {file.type.toUpperCase()}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {file.type !== 'folder' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  setFiles(files.filter(f => f.id !== file.id));
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {file.type === 'folder' && expandedFolders.has(file.id) && (
          <div className="mt-1">
            {renderFileTree(file.id, level + 1)}
          </div>
        )}
      </React.Fragment>
    ));
  };

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

      <CardContent className="space-y-6">
        <div 
          className={cn(
            "border-2 border-dashed rounded-xl p-8 transition-all duration-200 text-center relative overflow-hidden group",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">드래그하여 파일 업로드</p>
              <p className="text-xs text-muted-foreground">PDF, MP4 파일 지원 (최대 100MB)</p>
            </div>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              multiple
              accept=".pdf,.mp4"
              onChange={handleFileInput}
            />
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              파일 선택하기
            </Button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">원천 데이터 원격 저장소 ({files.length})</h4>
              <Button variant="ghost" size="xs" onClick={() => setFiles([])} className="h-6 text-[10px]">전체 삭제</Button>
            </div>
            <div className="max-h-[300px] overflow-y-auto pr-1 custom-scrollbar space-y-1">
              {renderFileTree(null)}
            </div>
          </div>
        )}

        <Button 
          className="w-full h-11 font-bold shadow-lg shadow-primary/20"
          disabled={files.length === 0 || isLearning}
          onClick={handleLearn}
        >
          {isLearning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              분석 중...
            </>
          ) : (
            <>
              <Cloud className="mr-2 h-4 w-4 text-white" />
              원천 데이터 학습 (Learning Event)
            </>
          )}
        </Button>

        {syncStatus.status !== 'idle' && (
          <div className={cn(
            "text-xs p-3 rounded-lg flex items-center gap-2 border animate-in fade-in slide-in-from-top-1",
            syncStatus.status === 'syncing' ? "bg-yellow-50/50 border-yellow-100 text-yellow-700" : "bg-green-50/50 border-green-100 text-green-700"
          )}>
            {syncStatus.status === 'syncing' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {syncStatus.message}
          </div>
        )}

        {learningStatus && (
          <div className={cn(
            "text-xs text-center p-3 rounded-lg border",
            learningStatus.includes('완료') ? "bg-blue-50/50 border-blue-100 text-blue-700 font-medium" :
            learningStatus.includes('실패') ? "bg-red-50/50 border-red-100 text-red-700" :
            "bg-muted/50 border-muted text-muted-foreground"
          )}>
            {learningStatus}
          </div>
        )}

        {learnedKnowledge && (
          <div className="border rounded-lg p-4 space-y-4 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="text-sm font-bold">
                    합성된 투자 알고리즘 (추출 정확도: {learnedKnowledge.criteria?.consensusScore || 80}%)
                  </h4>
                  <p className="text-[10px] text-muted-foreground">전문가 자료들의 논리적 정합성 기반 도출</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? <Check className="h-3 w-3" /> : <Settings2 className="h-3 w-3" />}
                  {isEditMode ? '완료' : '로직 수정'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  onClick={() => setShowRules(!showRules)}
                >
                  {showRules ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            
            {(showRules || isEditMode) && (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {learnedKnowledge.criteria?.criterias?.map((rule, idx) => (
                  <div key={idx} className={cn(
                    "p-3 rounded-lg border transition-all",
                    rule.isCritical ? "border-red-200 bg-red-50/30" : "bg-muted/20",
                    isEditMode && "ring-2 ring-primary/20 border-primary/50"
                  )}>
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        {rule.isCritical && <AlertCircle className="h-3 w-3 text-red-500" />}
                        <span className="text-[11px] font-bold">{rule.name}</span>
                        <Badge variant="outline" className="text-[8px] h-4 uppercase">{rule.category}</Badge>
                      </div>
                      <div className="text-[9px] text-muted-foreground truncate max-w-[120px]">
                        {rule.source?.fileName}
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed line-clamp-2">
                      {rule.description}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-muted-foreground uppercase">가중치</label>
                        {isEditMode ? (
                          <input 
                            type="range" 
                            min="0.1" max="1.0" step="0.1" 
                            className="w-full h-1 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
                            value={rule.weight}
                            onChange={(e) => {
                              const newRules = [...(learnedKnowledge.criteria?.criterias || [])];
                              newRules[idx] = { ...newRules[idx], weight: parseFloat(e.target.value) };
                              setLearnedKnowledge({
                                ...learnedKnowledge, 
                                criteria: { ...(learnedKnowledge.criteria || {}), criterias: newRules } as any
                              });
                            }}
                          />
                        ) : (
                          <div className="h-1 w-full bg-muted/50 rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${rule.weight * 100}%` }} />
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label className="text-[9px] font-medium text-muted-foreground uppercase">기준치</label>
                        <div className="flex items-center gap-1">
                          {isEditMode ? (
                            <input 
                              type="text"
                              className="w-full text-[10px] h-6 p-1 border rounded bg-background focus:ring-1 focus:ring-primary outline-none"
                              value={rule.quantification?.benchmark || ''}
                              onChange={(e) => {
                                const newRules = [...(learnedKnowledge.criteria?.criterias || [])];
                                newRules[idx] = { 
                                  ...(newRules[idx] || {}), 
                                  quantification: { ...(newRules[idx]?.quantification || {}), benchmark: e.target.value } as any
                                };
                                setLearnedKnowledge({
                                  ...learnedKnowledge, 
                                  criteria: { ...(learnedKnowledge.criteria || {}), criterias: newRules } as any
                                });
                              }}
                            />
                          ) : (
                            <span className="text-[10px] font-mono font-bold text-primary">
                              {rule.quantification?.condition} {rule.quantification?.benchmark}
                              {rule.quantification?.benchmark_type === 'sector_relative' && ' (업종)'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {rule.visualEvidence && (
                      <div className="mt-2 pt-2 border-t border-dashed border-muted flex items-center gap-1.5 opacity-60">
                        <Eye className="h-3 w-3" />
                        <span className="text-[9px] italic">영상 근거 확인됨 ({rule.visualEvidence})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {!showRules && !isEditMode && (
              <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
                <p>총 {getTotalRulesCount(learnedKnowledge)}개의 지능형 추출 로직 적용 중</p>
                <Button variant="link" className="h-auto p-0 text-primary text-[10px]" onClick={() => setShowRules(true)}>자세히 보기</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
