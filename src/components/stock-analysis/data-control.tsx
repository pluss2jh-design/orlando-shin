'use client';

import React, { useCallback, useState, useEffect, useMemo } from 'react';
import { 
  Upload, File, Video, FileText, X, Cloud, Check, Loader2, BookOpen, ListChecks, 
  Settings2, ChevronUp, ChevronDown, AlertCircle, Eye, Folder, ChevronRight, Brain, Clock, StopCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatFileSize, getFileType, generateId } from '@/lib/stock-analysis/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { UploadedFile, CloudSyncStatus, LearnedKnowledge } from '@/types/stock-analysis';

interface AIModel {
  value: string;
  label: string;
  reqKey: string;
  supportsPDF: boolean;
  supportsVideo: boolean;
  provider: string;
  isRecommendedForLearning?: boolean;
}

interface APIKeys {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
}

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
  onLearningStart?: () => void;
  onLearningComplete?: () => void;
}

export function DataControl({ onFilesChange, onSyncStatusChange, onLearningStart, onLearningComplete }: DataControlProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>({ status: 'idle' });
  const [isLearning, setIsLearning] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false); // NEW
  const [learningStatus, setLearningStatus] = useState<string | null>(null);
  const [learnedKnowledge, setLearnedKnowledge] = useState<LearnedKnowledge | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootFolderId, setRootFolderId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  const [keys, setKeys] = useState<APIKeys | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-1.5-flash');
  const [forceFullAnalysis, setForceFullAnalysis] = useState(false);
  const [backendLearningStatus, setBackendLearningStatus] = useState<{
    isLearning: boolean;
    totalFiles: number;
    completedFiles: number;
    failedFiles: number;
    startTime: string | null;
    error: string | null;
  } | null>(null);

  const processDriveFiles = (files: any[]) => {
    if (!files || files.length === 0) return [];
    
    const driveFiles: UploadedFile[] = files.map((f: any) => ({
      id: f.id,
      name: f.name,
      type: f.mimeType.includes('pdf') ? 'pdf' : f.mimeType.includes('video') ? 'mp4' : f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'other',
      size: parseInt(f.size || '0', 10),
      uploadedAt: new Date(f.modifiedTime),
      status: 'completed',
      parentId: f.parentId,
      isDriveFile: true
    }));
    
    // Determine root
    const ids = new Set(driveFiles.map(f => f.id));
    const firstParentId = driveFiles.find(f => f.parentId && !ids.has(f.parentId))?.parentId;
    if (firstParentId) setRootFolderId(firstParentId);
    
    return driveFiles;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Fetch knowledge existence and AI models
        const resG = await fetch('/api/gdrive/learn');
        const dataG = await resG.json();
        if (dataG.exists) {
          const resK = await fetch('/api/gdrive/knowledge');
          if (resK.ok) {
            const dataK = await resK.json();
            setLearnedKnowledge(dataK.knowledge);
          }
        }
        
        const [modelsRes, keysRes] = await Promise.all([
          fetch('/api/admin/models', { cache: 'no-store' }),
          fetch('/api/admin/settings', { cache: 'no-store' })
        ]);

        if (modelsRes.ok) {
          const mData = await modelsRes.json();
          setAvailableModels(mData.models || []);
        }

        if (keysRes.ok) {
          const kData = await keysRes.json();
          setKeys(kData.keys || {});
        }

        // 3. Check for active sync task and initial file list (Persistence)
        const syncRes = await fetch('/api/gdrive/sync', { cache: 'no-store' });
        if (syncRes.ok) {
          const sData = await syncRes.json();
          
          if (sData.isSyncing) {
            setSyncStatus({
              status: 'syncing',
              progress: sData.progress,
              message: sData.progress.message
            });
          }

          if (sData.files && sData.files.length > 0) {
            const driveFiles = processDriveFiles(sData.files);
            setFiles(driveFiles);
            onFilesChange?.(driveFiles);
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data:', error);
      }
    };
    fetchInitialData();
  }, []);

  // Poll for sync status
  useEffect(() => {
    let interval: any;
    if (syncStatus.status === 'syncing') {
      interval = setInterval(async () => {
        try {
          const res = await fetch('/api/gdrive/sync', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            
            setSyncStatus(prev => ({
              ...prev,
              progress: data.progress,
              status: data.isSyncing ? 'syncing' : (data.progress.status === 'completed' ? 'synced' : data.progress.status),
              message: data.progress.message,
              lastSync: data.syncedAt ? new Date(data.syncedAt) : prev.lastSync
            }));

            if (!data.isSyncing) {
              if (data.files && data.files.length > 0) {
                const driveFiles = processDriveFiles(data.files);
                setFiles(driveFiles);
                onFilesChange?.(driveFiles);
                
                // 기본적으로 아무것도 선택하지 않음 (사용자가 명시적으로 선택하게 유도)
                setSelectedIds(new Set());
              }
              
              if (data.progress.status === 'completed') {
                onSyncStatusChange?.({
                  status: 'synced',
                  lastSync: new Date(data.syncedAt),
                  message: data.progress.message
                });
              }
            }
          }
        } catch (error) {
          console.error('Sync polling error:', error);
        }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [syncStatus.status, onFilesChange, onSyncStatusChange]);

  // Poll for learning status
  useEffect(() => {
    let interval: any;
    let pollCount = 0;
    
    if (isLearning) {
      interval = setInterval(async () => {
        pollCount++;
        try {
          const res = await fetch('/api/admin/learning-status', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            setBackendLearningStatus(data);
            
            // Wait for backend to set isLearning: true (Ignore polls if still requesting or pollCount <= 2)
            if (!data.isLearning && !isRequesting && pollCount > 2) {
              setIsLearning(false);
              const message = data.error 
                ? `학습 중단됨: ${data.error}`
                : `학습 완료! (성공: ${data.completedFiles}개, 실패: ${data.failedFiles}개)`;
              setLearningStatus(message);
              onLearningComplete?.();
              
              const resK = await fetch('/api/gdrive/knowledge');
              if (resK.ok) {
                const dataK = await resK.json();
                setLearnedKnowledge(dataK.knowledge);
              }
            }
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isLearning, isRequesting, onLearningComplete]);

  const estimatedTime = useMemo(() => {
    if (!backendLearningStatus || !backendLearningStatus.startTime || backendLearningStatus.completedFiles === 0) return null;
    
    const startTime = new Date(backendLearningStatus.startTime).getTime();
    const now = Date.now();
    const elapsed = now - startTime;
    const timePerFile = elapsed / backendLearningStatus.completedFiles;
    const remainingFiles = backendLearningStatus.totalFiles - backendLearningStatus.completedFiles;
    const remainingTime = timePerFile * remainingFiles;
    
    if (remainingTime <= 0) return '곧 완료됨';
    
    const minutes = Math.floor(remainingTime / (60 * 1000));
    const seconds = Math.floor((remainingTime % (60 * 1000)) / 1000);
    
    return minutes > 0 ? `${minutes}분 ${seconds}초 남음` : `${seconds}초 남음`;
  }, [backendLearningStatus]);

  // Local file upload logic removed as per user request.
  // Using only Google Drive files for learning.

  const handleSync = async () => {
    setSyncStatus({ status: 'syncing', message: '동기화 시작 중...' });
    onSyncStatusChange?.({ status: 'syncing' });

    try {
      const response = await fetch('/api/gdrive/sync', { method: 'POST' });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '동기화 시작 패');
      }

      setSyncStatus(prev => ({ ...prev, status: 'syncing', message: '서버와 연결됨...' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : '동기화 실패';
      const errorStatus: CloudSyncStatus = {
        status: 'error',
        message,
      };
      setSyncStatus(errorStatus);
    }
  };

  const handleStopSync = async () => {
    setSyncStatus(prev => ({ ...prev, status: 'idle', message: '동기화 중지됨' }));
    onSyncStatusChange?.({ status: 'idle' });
    try {
      await fetch('/api/gdrive/sync', { method: 'DELETE' });
      // 중지된 직후의 캐시 데이터를 가져오기 위해 마지막으로 한 번 더 호출
      setTimeout(async () => {
        const res = await fetch('/api/gdrive/sync');
        if (res.ok) {
          const data = await res.json();
          if (data.files && data.files.length > 0) {
            const mappedFiles: UploadedFile[] = data.files.map((f: any) => ({
              id: f.id,
              name: f.name,
              type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : (f.mimeType === 'application/pdf' ? 'pdf' : 'mp4'),
              size: Number(f.size) || 0,
              modifiedTime: f.modifiedTime,
              parentId: f.parentId
            }));
            setFiles(mappedFiles);
            onFilesChange?.(mappedFiles);
          }
        }
      }, 1200);
    } catch (error) {
      console.error('Stop sync error:', error);
    }
  };

  const handleStopLearning = async () => {
    if (!window.confirm('현재 진행중인 AI 학습을 중지하시겠습니까?')) return;
    setIsLearning(false); // 낙관적 업데이트
    try {
      await fetch('/api/admin/learning-status', { method: 'DELETE' });
    } catch (error) {
      console.error('Stop learning error:', error);
    }
  };

  const handleLearn = async () => {
    const confirmed = window.confirm('학습을 위해 AI 모델을 사용하며 비용이 발생할 수 있습니다. 계속하시겠습니까?');
    if (!confirmed) return;

    onLearningStart?.();
    setIsLearning(true);
    setIsRequesting(true);
    setLearningStatus('학습 요청을 보내는 중...');

    const driveOnlyFiles = files.filter(f => f.type !== 'folder' && selectedIds.has(f.id));
    const selectedFileIds = driveOnlyFiles.map(f => f.id);
    
    console.log(`[Frontend] Attempting to learn with ${selectedFileIds.length} selected files.`);
    console.log(`[Frontend] Selected IDs:`, selectedFileIds.slice(0, 5), '...');

    if (selectedFileIds.length === 0) {
      alert('학습을 시작하려면 최소 하나 이상의 파일을 선택해야 합니다.');
      setIsLearning(false);
      return;
    }


    try {
      const response = await fetch('/api/gdrive/learn', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileIds: selectedFileIds,
          aiModel: selectedModel,
          forceFullAnalysis,
          title: `Expert Session ${new Date().toLocaleDateString()}`
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || '학습 실패');
      }

      setLearningStatus('학습이 시작되었습니다. 원격 서버에서 진행률을 추적합니다...');
    } catch (error) {
      const message = error instanceof Error ? error.message : '학습 실패';
      setLearningStatus(`학습 실패: ${message}`);
      setIsLearning(false);
    } finally {
      setIsRequesting(false);
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

  const toggleSelection = (id: string, isFolder: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      
      const getRecursiveFileIds = (folderId: string): string[] => {
        const children = files.filter(f => f.parentId === folderId);
        let ids: string[] = [];
        children.forEach(child => {
          if (child.type === 'folder') {
            ids.push(...getRecursiveFileIds(child.id));
          } else {
            ids.push(child.id);
          }
        });
        return ids;
      };

      if (isFolder) {
        const targetIds = getRecursiveFileIds(id);
        if (targetIds.length === 0) return prev; // 하위에 파일이 없으면 변화 없음

        const areAllSelected = targetIds.every(tid => next.has(tid));
        if (areAllSelected) {
          targetIds.forEach(tid => next.delete(tid));
        } else {
          targetIds.forEach(tid => next.add(tid));
        }
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const getFolderSelectionState = (folderId: string): 'checked' | 'unchecked' | 'indeterminate' => {
      const children = files.filter(f => f.parentId === folderId);
      if (children.length === 0) return 'unchecked';

      const getRecursiveFiles = (fid: string): string[] => {
          const innerChildren = files.filter(f => f.parentId === fid);
          let results: string[] = [];
          innerChildren.forEach(c => {
              if (c.type === 'folder') results.push(...getRecursiveFiles(c.id));
              else results.push(c.id);
          });
          return results;
      };

      const allFileIds = getRecursiveFiles(folderId);
      if (allFileIds.length === 0) return 'unchecked';

      const selectedCount = allFileIds.filter(id => selectedIds.has(id)).length;
      if (selectedCount === 0) return 'unchecked';
      if (selectedCount === allFileIds.length) return 'checked';
      return 'indeterminate';
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

    return itemsToRender.map(file => {
      const isFolder = file.type === 'folder';
      const selectionState = isFolder ? getFolderSelectionState(file.id) : (selectedIds.has(file.id) ? 'checked' : 'unchecked');
      const isExpanded = expandedFolders.has(file.id);

      return (
        <React.Fragment key={file.id}>
          <div 
            className={cn(
              "group flex items-center justify-between py-2.5 px-3 rounded-xl transition-all duration-200 relative",
              isFolder ? "hover:bg-muted/60 cursor-pointer" : "hover:bg-muted/40 border border-transparent hover:border-muted/50",
            )}
            style={{ paddingLeft: `${level * 40 + 12}px` }}
          >
            {/* 트리 라인 (부모와의 연결선) */}
            {level > 0 && (
                <div 
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-muted/20" 
                    style={{ left: `${(level - 1) * 40 + 26}px` }} 
                />
            )}

            <div className="flex items-center gap-3 overflow-hidden flex-1 relative z-10">
              <div className="flex items-center gap-2 shrink-0">
                <Checkbox 
                  checked={selectionState === 'checked' ? true : (selectionState === 'indeterminate' ? 'indeterminate' : false)}
                  onCheckedChange={() => toggleSelection(file.id, isFolder)}
                  className="w-4 h-4 rounded-md"
                  onClick={(e) => e.stopPropagation()}
                />
                {isFolder && (
                    <div 
                        onClick={(e) => { e.stopPropagation(); toggleFolder(file.id); }} 
                        className="hover:bg-muted p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                        {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </div>
                )}
              </div>

              <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => isFolder && toggleFolder(file.id)}>
                <div className={cn(
                  "p-2 rounded-xl shrink-0 shadow-sm",
                  file.type === 'mp4' ? "bg-blue-600/10 text-blue-600" : 
                  file.type === 'pdf' ? "bg-rose-600/10 text-rose-600" :
                  file.type === 'folder' ? "bg-amber-500/10 text-amber-500" :
                  "bg-slate-500/10 text-slate-600"
                )}>
                  {file.type === 'mp4' ? <Video className="h-4 w-4" /> : 
                   file.type === 'pdf' ? <FileText className="h-4 w-4" /> : 
                   file.type === 'folder' ? <Folder className="h-4 w-4" /> :
                   <File className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium whitespace-nowrap">{file.name}</p>
                  {file.type !== 'folder' && (
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap">{formatFileSize(file.size)} • {file.type.toUpperCase()}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {file.type !== 'folder' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFiles(files.filter(f => f.id !== file.id));
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {isFolder && isExpanded && (
            <div className="mt-0.5">
              {renderFileTree(file.id, level + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
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
        <div className="bg-muted/30 border-2 border-dashed border-muted-foreground/10 rounded-xl p-6 text-center">
          {syncStatus.status === 'syncing' ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <p className="text-sm font-semibold text-primary">지식 베이스 동기화 중...</p>
              </div>
              
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase pb-1 border-b border-muted-foreground/10">
                  <span>발견된 파일: {syncStatus.progress?.totalFiles || 0}개</span>
                  <span>폴더: {syncStatus.progress?.processedFolders || 0}개</span>
                </div>
                <Progress value={Math.min(100, (syncStatus.progress?.totalFiles || 0) / 10)} className="h-1.5" />
                {syncStatus.progress?.currentFolder && (
                  <p className="text-[10px] text-muted-foreground truncate italic">
                    탐색: {syncStatus.progress.currentFolder}
                  </p>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4 h-8 text-[10px] font-black border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleStopSync}
                >
                  <StopCircle className="h-3 w-3 mr-2" />
                  동기화 중지 (STOP)
                </Button>
              </div>
          ) : (
            <p className="text-xs text-muted-foreground font-medium">
              구글 드라이브(Research 폴더)의 파일을 읽어와 분석합니다.<br />
              파일을 추가하고 싶다면 구글 드라이브 앱/웹에서 직접 업로드 후 아래 [동기화] 버튼을 눌러주세요.
            </p>
          )}
        </div>

        {files.length > 0 && (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">원천 데이터 원격 저장소 ({files.length})</h4>
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{selectedIds.size}개 선택됨</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="xs" 
                    onClick={() => setSelectedIds(new Set(files.filter(f => f.type !== 'folder').map(f => f.id)))} 
                    className="h-6 text-[10px]"
                  >
                    전체 선택
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="xs" 
                    onClick={() => setSelectedIds(new Set())} 
                    className="h-6 text-[10px]"
                  >
                    전체 해제
                  </Button>
                </div>
              </div>
              <div className="max-h-[350px] overflow-auto pr-1 custom-scrollbar space-y-1 border border-muted/20 rounded-xl p-2 bg-muted/5">
                <div className="min-w-max">
                  {renderFileTree(null)}
                </div>
              </div>
            </div>

            {availableModels.length > 0 && (
              <div className="space-y-3 bg-muted/30 p-4 rounded-xl border border-muted-foreground/10">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-4 w-4 text-blue-500" />
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI 분석 모델 설정</h4>
                </div>
                
                <Select 
                  value={selectedModel} 
                  onValueChange={setSelectedModel}
                >
                  <SelectTrigger className="w-full h-11 bg-background border-muted-foreground/20 rounded-xl">
                    <SelectValue placeholder="분석에 사용할 모델 선택 (예: Gemini 2.5 Flash Lite)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    {availableModels
                      .map((model) => {
                        const hasKey = keys && keys[model.reqKey as keyof APIKeys];
                        return (
                          <SelectItem 
                            key={model.value} 
                            value={model.value} 
                            disabled={!hasKey}
                            className="py-3 px-4"
                          >
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center justify-between w-full gap-8">
                                <span className={cn("font-bold text-sm", model.isRecommendedForLearning && "text-blue-600")}>
                                  {model.label}
                                  {model.isRecommendedForLearning && <span className="ml-2 text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">Recommended</span>}
                                </span>
                                {!hasKey && <span className="text-[10px] text-red-500 font-medium">Key 미등록</span>}
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                {model.provider.toUpperCase()} • {model.supportsPDF && model.supportsVideo ? "PDF & Video 지원" : (model.supportsPDF ? "PDF 전용" : "텍스트 전용")}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>

                <div className="flex items-center space-x-2 pt-2 border-t border-muted-foreground/5 mt-2">
                  <Checkbox 
                    id="force-full" 
                    checked={forceFullAnalysis} 
                    onCheckedChange={(v) => setForceFullAnalysis(v === true)} 
                  />
                  <div className="grid gap-1.5 leading-none">
                    <label
                      htmlFor="force-full"
                      className="text-[11px] font-black leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-amber-600 cursor-pointer flex items-center gap-1.5"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {forceFullAnalysis ? "기존 데이터 무시하고 전체 파일 분석 (Full Re-analysis)" : "기존 데이터 유지 후 분석 안된 파일만 분석 (Incremental)"}
                    </label>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {forceFullAnalysis 
                        ? "체크 해제 시: 이미 분석된 파일은 건너뛰고 새로운 파일만 분석합니다. (추천: 빠른 업데이트)"
                        : "체크 시: 이미 분석된 파일도 현재 모델로 처음부터 다시 분석합니다. (추천: AI 모델 변경 시)"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 w-full">
          <Button 
            className="flex-1 h-11 font-bold shadow-lg shadow-primary/20"
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
        </div>

        {syncStatus.status !== 'idle' && (
          <div className={cn(
            "text-xs p-3 rounded-lg flex items-center gap-2 border animate-in fade-in slide-in-from-top-1",
            syncStatus.status === 'syncing' ? "bg-yellow-50/50 border-yellow-100 text-yellow-700" : "bg-green-50/50 border-green-100 text-green-700"
          )}>
            {syncStatus.status === 'syncing' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            {syncStatus.message}
          </div>
        )}

        {isLearning && backendLearningStatus && (
          <div className="space-y-3 p-4 bg-blue-50/50 border border-blue-100 rounded-xl animate-in fade-in slide-in-from-top-2">
             <div className="flex justify-between items-end">
               <div className="space-y-1">
                 <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest">AI Phase 1: Deep Learning</h4>
                 <p className="text-[10px] text-blue-400 font-bold">원천 데이터에서 투자 논리를 추출하고 있습니다</p>
               </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className="text-lg font-black text-blue-600 font-mono flex items-baseline gap-2">
                    {Math.round((backendLearningStatus.completedFiles / Math.max(1, backendLearningStatus.totalFiles)) * 100)}%
                    <span className="text-[10px] text-blue-400">({backendLearningStatus.completedFiles}/{backendLearningStatus.totalFiles})</span>
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[9px] font-black text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1 px-2 border border-rose-100"
                    onClick={handleStopLearning}
                  >
                    중지 (CANCEL)
                  </Button>
                </div>
              </div>
             
             <Progress 
               value={(backendLearningStatus.completedFiles / backendLearningStatus.totalFiles) * 100} 
               className="h-1.5 bg-blue-100" 
             />

             <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-tighter">
               <div className="flex items-center gap-3">
                 <div className="flex items-center gap-1.5 text-blue-500">
                   <Check className="h-3 w-3" />
                   <span>{backendLearningStatus.completedFiles} SUCCESS</span>
                 </div>
                  {backendLearningStatus.failedFiles > 0 && (
                    <div className="flex items-center gap-1.5 text-rose-500 group relative cursor-help">
                      <AlertCircle className="h-3 w-3" />
                      <span>{backendLearningStatus.failedFiles} FAILED</span>
                      
                      {/* Hover Tooltip for Failed Files */}
                      <div className="absolute bottom-full left-0 mb-2 w-80 p-3 bg-[#1c2128] border border-rose-500/30 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 transform translate-y-1 group-hover:translate-y-0">
                        <p className="text-[10px] font-black text-rose-400 mb-2 border-b border-rose-500/20 pb-1.5 uppercase tracking-widest flex items-center gap-2">
                          <AlertCircle className="h-3 w-3" />
                          분석 실패 파일 상세 원인
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                          {(backendLearningStatus as any).failedDetails?.map((fd: any, idx: number) => (
                            <div key={idx} className="text-[10px] leading-relaxed border-b border-white/5 pb-1.5 last:border-0">
                              <span className="text-rose-300 font-bold block truncate mb-0.5">{fd.fileName}</span>
                              <span className="text-white/40 block italic">{fd.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                 <div className="flex items-center gap-1.5 text-muted-foreground animate-pulse">
                   <Loader2 className="h-3 w-3 animate-spin" />
                   <span>PROCESSING {backendLearningStatus.completedFiles + backendLearningStatus.failedFiles} / {backendLearningStatus.totalFiles}</span>
                 </div>
               </div>
               <div className="text-blue-400 flex items-center gap-1">
                 <Clock className="h-3 w-3" />
                 <span>{estimatedTime || '계산 중...'}</span>
               </div>
             </div>
          </div>
        )}

        {learningStatus && !isLearning && (
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
