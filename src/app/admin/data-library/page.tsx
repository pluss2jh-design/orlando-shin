'use client';

import { useEffect, useState, useCallback } from 'react';
import {
    FileText,
    Film,
    RefreshCw,
    CheckCircle,
    Clock,
    AlertCircle,
    Brain,
    Database,
    Trash2,
    ChevronRight,
    Search,
    Sparkles,
    Eye,
    Pencil,
    X,
    StopCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: number;
    modifiedTime: string;
    durationMillis?: string;
    learnStatus: 'completed' | 'pending' | 'processing';
}

/** Prisma JSON 필드에서 조회한 지식 콘텐츠 구조 */
interface KnowledgeContent {
  fileAnalyses?: { fileName: string; keyConditions: string[] }[];
  criteria?: {
    goodCompanyRules?: unknown[];
    technicalRules?: unknown[];
    marketSizeRules?: unknown[];
    unitEconomicsRules?: unknown[];
    lifecycleRules?: unknown[];
    buyTimingRules?: unknown[];
  };
}

/** AI 모델 정보 */
interface AIModel {
  value: string;
  label: string;
  reqKey: string;
}

/** API 키 정보 */
interface APIKeys {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
}

interface LearnedKnowledgeRecord {
    id: string;
    title: string;
    isActive: boolean;
    createdAt: string;
    files: string[];
    content: KnowledgeContent;
}

/** 상태 폴링 주기 (밀리초) */
const POLLING_INTERVAL_MS = 5000;
// AI 모델 선택 컴포넌트
const ModelSelector = ({ ext, currentModel, models, keys, onSelect }: { ext: string; currentModel: string; models: AIModel[]; keys: APIKeys | null; onSelect: (val: string) => void }) => {
    return (
        <Select value={currentModel} onValueChange={onSelect}>
            <SelectTrigger className="w-full sm:w-[250px] bg-gray-950 border-gray-800 text-white font-bold h-9 text-xs">
                <SelectValue placeholder="모델을 선택하세요" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-800">
                {models.map(model => {
                    const hasKey = keys && keys[model.reqKey as keyof typeof keys];
                    return (
                        <SelectItem key={model.value} value={model.value} disabled={!hasKey} className="text-white focus:bg-gray-800">
                            <div className="flex items-center justify-between w-full gap-4">
                                <span>{model.label}</span>
                                {!hasKey && <span className="text-[10px] text-rose-500">API 키 미등록</span>}
                            </div>
                        </SelectItem>
                    );
                })}
            </SelectContent>
        </Select>
    );
};

// 제목 입력 컴포넌트
const TitleInput = ({ initialValue, onSave }: { initialValue: string, onSave: (val: string) => void }) => {
    const [val, setVal] = useState(initialValue);
    useEffect(() => { setVal(initialValue); }, [initialValue]);
    return (
        <div className="mb-6">
            <Label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">AI Engine Title</Label>
            <Input
                placeholder="지식 베이스 버전을 입력하세요 (예: 2024년 2분기 리포트)"
                className="bg-gray-950 border-gray-800 text-white font-medium"
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onBlur={() => onSave(val)}
            />
        </div>
    );
};

export default function DataLibraryPage() {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);
    const [knowledgeList, setKnowledgeList] = useState<LearnedKnowledgeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [learning, setLearning] = useState(false);

    // 지식 수정 상태
    const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);
    const [editKnowledgeTitle, setEditKnowledgeTitle] = useState('');

    // UI 상태
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [title, setTitle] = useState('');
    const [aiModels, setAiModels] = useState<Record<string, string>>({});
    const [availableModels, setAvailableModels] = useState<{ value: string, label: string, reqKey: string }[]>([]);
    const [keys, setKeys] = useState<{ GEMINI_API_KEY?: string, OPENAI_API_KEY?: string, CLAUDE_API_KEY?: string } | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (syncing) {
            interval = setInterval(() => {
                fetchFiles();
            }, POLLING_INTERVAL_MS);
        }
        return () => { if (interval) clearInterval(interval); };
    }, [syncing]);

    // 학습 중일 때 상태 폴링
    useEffect(() => {
        let statusInterval: NodeJS.Timeout;
        if (learning) {
            statusInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/admin/learning-status');
                    if (response.ok) {
                        const data = await response.json();
                        if (!data.isLearning) {
                            setLearning(false);
                            fetchInitialData();
                        }
                    }
                } catch { /* 학습 상태 폴링 실패 무시 - 다음 폴링에서 재시도 */ }
            }, POLLING_INTERVAL_MS);
        }
        return () => { if (statusInterval) clearInterval(statusInterval); };
    }, [learning]);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([fetchFiles(), fetchKnowledge(), fetchKeys(), fetchModels(), fetchLearningStatus()]);
        setLoading(false);
    };

    const fetchLearningStatus = async () => {
        try {
            const response = await fetch('/api/admin/learning-status');
            if (response.ok) {
                const data = await response.json();
                if (data.isLearning) setLearning(true);
            }
        } catch (error) {
            console.error('학습 상태 조회 실패:', error);
        }
    };

    const fetchModels = async () => {
        try {
            const response = await fetch('/api/admin/models');
            if (response.ok) {
                const data = await response.json();
                setAvailableModels(data.models || []);
            }
        } catch (error) {
            console.error('모델 목록 조회 실패:', error);
        }
    };

    const fetchKeys = async () => {
        try {
            const response = await fetch('/api/admin/settings');
            if (response.ok) {
                const data = await response.json();
                setKeys(data.keys || {});
            }
        } catch (error) {
            console.error('API 키 조회 실패:', error);
        }
    };

    const fetchFiles = async () => {
        try {
            const response = await fetch('/api/admin/files');
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
                setSyncing(data.isSyncing || false);
            }
        } catch (error) {
            console.error('파일 목록 조회 실패:', error);
        }
    };

    const fetchKnowledge = async () => {
        try {
            const response = await fetch('/api/admin/knowledge');
            if (response.ok) {
                const data = await response.json();
                setKnowledgeList(data.knowledgeList || []);
            }
        } catch (error) {
            console.error('지식 목록 조회 실패:', error);
        }
    };

    const getFileExt = (name: string, mime: string) => {
        if (mime.includes('video') || name.toLowerCase().endsWith('.mp4')) return 'mp4';
        if (name.toLowerCase().endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
        if (name.toLowerCase().endsWith('.docx') || name.toLowerCase().endsWith('.doc')) return 'docx';
        if (name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls') || name.toLowerCase().endsWith('.csv')) return 'xlsx';
        return 'other';
    };

    const handleSync = async () => {
if (!confirm('구글 드라이브 동기화를 시작하시겠습니까?\n이 작업은 백그라운드에서 진행됩니다.')) return;
        try {
            setSyncing(true);
            const response = await fetch('/api/gdrive/sync', { method: 'POST' });
            if (!response.ok) {
                console.error('동기화 실패:', await response.text());
                setSyncing(false);
            }
        } catch (error) {
            console.error('동기화 실패:', error);
            setSyncing(false);
        }
    };

    const handleToggleFileSelection = (fileId: string) => {
        setSelectedFileIds(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedFileIds(new Set(files.map(f => f.id)));
        else setSelectedFileIds(new Set());
    };

    const handleSelectAllExt = (extFiles: DriveFile[], checked: boolean) => {
        setSelectedFileIds(prev => {
            const next = new Set(prev);
            extFiles.forEach(f => {
                if (checked) next.add(f.id);
                else next.delete(f.id);
            });
            return next;
        });
    };

    const handleRunLearning = async () => {
        if (selectedFileIds.size === 0) {
            alert('학습할 파일을 선택해주세요.');
            return;
        }
        const fileIdsArray = Array.from(selectedFileIds);
alert('백그라운드에서 AI 학습이 시작되었습니다.\n다른 메뉴로 이동하셔도 로직 처리는 계속 진행됩니다.\n완료 시 시스템에서 알려드립니다.');
        setLearning(true);
        setSelectedFileIds(new Set());
        const currentTitle = title;
        setTitle('');

        try {
            const response = await fetch('/api/gdrive/learn', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileIds: fileIdsArray, aiModels: aiModels, title: currentTitle }),
            });
            if (response.ok) {
                alert('AI 엔진 학습이 완료되었습니다!');
                await fetchInitialData();
            } else {
                const errorData = await response.json();
                alert(`학습 실패: ${errorData.error}`);
                setLearning(false);
            }
        } catch (error) {
            console.error('학습 실패:', error);
            alert('학습 엔진 실행 중 오류가 발생했습니다.');
            setLearning(false);
        }
    };

    const handleCancelLearning = async () => {
        if (!confirm('현재 진행중인 AI 학습을 강제로 중지하시겠습니까? 처리중이던 파일 분석 데이터는 모두 삭제됩니다.')) return;
        try {
            const response = await fetch('/api/admin/learning-status', { method: 'DELETE' });
            if (response.ok) {
                alert('학습을 강제로 중지하는 명령을 서버에 전달했습니다.');
                setLearning(false);
            } else {
                const err = await response.json();
                alert(`중지 요청 실패: ${err.error}`);
            }
        } catch (error) {
            console.error('중지 실패:', error);
            alert('중지 요청 중 오류가 발생했습니다.');
        }
    };

    const handleActivateKnowledge = async (id: string, active: boolean) => {
        try {
            const response = await fetch('/api/admin/knowledge', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: active }),
            });
            if (response.ok) await fetchKnowledge();
        } catch (error) { console.error('활성화 실패:', error); }
    };

    const handleUpdateKnowledgeTitle = async (id: string) => {
        try {
            const response = await fetch('/api/admin/knowledge', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, title: editKnowledgeTitle }),
            });
            if (response.ok) {
                await fetchKnowledge();
                setEditingKnowledgeId(null);
            }
        } catch (error) { console.error('제목 수정 실패:', error); }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        try {
            const response = await fetch(`/api/admin/knowledge?id=${id}`, { method: 'DELETE' });
            if (response.ok) await fetchKnowledge();
        } catch (error) { console.error('삭제 실패:', error); }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
        if (mimeType.includes('video')) return <Film className="h-5 w-5 text-purple-500" />;
        return <FileText className="h-5 w-5 text-gray-400" />;
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatDuration = (millisStr?: string) => {
        if (!millisStr) return null;
        const totalSeconds = Math.floor(parseInt(millisStr, 10) / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}분 ${seconds < 10 ? '0' : ''}${seconds}초`;
    };

    const isModelSelectionComplete = () => {
        if (selectedFileIds.size === 0) return true;
        const selectedExts = new Set<string>();
        for (const file of files) {
            if (selectedFileIds.has(file.id)) selectedExts.add(getFileExt(file.name, file.mimeType));
        }
        for (const ext of selectedExts) {
            if (ext !== 'mp4' && !aiModels[ext]) return false;
        }
        return true;
    };

    if (loading && files.length === 0) {
        return <div className="p-20 text-center text-white font-black">초기 데이터를 불러오는 중...</div>;
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">데이터 라이브러리</h1>
                    <p className="text-gray-400 font-medium">Google Drive 기반 AI 지식 베이스 구축 및 투자 로직 관리</p>
                </div>
                <div className="flex gap-3">
                    <Button onClick={handleSync} disabled={syncing} variant="outline" className="border-gray-800 text-gray-300 hover:bg-gray-800">
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        Drive 동기화
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                <div className="xl:col-span-2 space-y-8">
                    <Card className="bg-gray-900 border-gray-800 overflow-hidden shadow-2xl">
                        <CardHeader className="border-b border-gray-800 bg-gray-900/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="text-white text-xl flex items-center gap-2 font-black">
                                        <Database className="h-5 w-5 text-blue-500" />
                                        원천 데이터 스캔
                                    </CardTitle>
                                    <CardDescription className="text-gray-400">학습에 사용할 PDF 및 비디오 파일을 선택하세요</CardDescription>
                                </div>
                                <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-lg border border-gray-800">
                                    <div className="flex items-center gap-2">
                                        <Checkbox id="select-all" checked={selectedFileIds.size === files.length && files.length > 0} onCheckedChange={handleSelectAll} />
                                        <Label htmlFor="select-all" className="text-xs font-bold text-gray-300 cursor-pointer">전체 선택</Label>
                                    </div>
                                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 font-bold">{selectedFileIds.size}개 선택됨</Badge>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(() => {
                                const groupedFiles = files.reduce((acc, file) => {
                                    const ext = getFileExt(file.name, file.mimeType);
                                    if (!acc[ext]) acc[ext] = [];
                                    acc[ext].push(file);
                                    return acc;
                                }, {} as Record<string, DriveFile[]>);

                                const tabsKeys = Object.keys(groupedFiles);
                                if (tabsKeys.length === 0) {
                                    return (
                                        <div className="p-20 text-center">
                                            <Search className="h-12 w-12 text-gray-800 mx-auto mb-4" />
                                            <p className="text-gray-500 font-bold">동기화된 파일이 없습니다.</p>
                                        </div>
                                    );
                                }

                                return (
                                    <Tabs defaultValue={tabsKeys[0]} className="w-full">
                                        <div className="bg-gray-950 p-3 pb-0 border-b border-gray-800">
                                            <TabsList className="bg-transparent space-x-2">
                                                {tabsKeys.map(ext => (
                                                    <TabsTrigger key={ext} value={ext} className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-500 font-black uppercase text-xs">
                                                        {ext} ({groupedFiles[ext].length})
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </div>

                                        {tabsKeys.map(ext => (
                                            <TabsContent key={ext} value={ext} className="m-0">
                                                <div className="bg-gray-900/50 p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                    <div className="flex items-center gap-2">
                                                        <Brain className="h-4 w-4 text-blue-500" />
                                                        <span className="text-xs font-black text-white uppercase">{ext} 분석 AI 모델</span>
                                                    </div>
                                                    {ext === 'mp4' ? (
                                                        <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs py-1 px-3">
                                                            자동 폴백(Gemini 3.1 Pro ➔ 1.5 Pro) 사용
                                                        </Badge>
                                                    ) : (
                                                        <ModelSelector
                                                            ext={ext}
                                                            currentModel={aiModels[ext] || ''}
                                                            models={availableModels}
                                                            keys={keys}
                                                            onSelect={(val) => setAiModels(prev => ({ ...prev, [ext]: val }))}
                                                        />
                                                    )}
                                                </div>

                                                <div className="flex bg-gray-950 px-4 py-2 border-b border-gray-800 justify-between items-center">
                                                    <span className="text-xs text-gray-500 font-bold">{groupedFiles[ext].length}개 파일</span>
                                                    <Button variant="ghost" size="sm" className="h-7 text-xs font-bold text-blue-400 hover:text-blue-300"
                                                        onClick={() => {
                                                            const allExtIds = groupedFiles[ext].map(f => f.id);
                                                            const allExtSelected = allExtIds.every(id => selectedFileIds.has(id));
                                                            handleSelectAllExt(groupedFiles[ext], !allExtSelected);
                                                        }}>
                                                        {groupedFiles[ext].map(f => f.id).every(id => selectedFileIds.has(id)) ? '현재 확장자 전체 해제' : '현재 확장자 전체 선택'}
                                                    </Button>
                                                </div>

                                                <ScrollArea className="h-[380px]">
                                                    <div className="divide-y divide-gray-800/50">
                                                        {groupedFiles[ext].map((file) => (
                                                            <div key={file.id} className={`flex items-center gap-4 p-4 hover:bg-gray-800/20 transition-all cursor-pointer group ${selectedFileIds.has(file.id) ? 'bg-blue-500/5' : ''}`}
                                                                onClick={() => handleToggleFileSelection(file.id)}>
                                                                <Checkbox checked={selectedFileIds.has(file.id)} onCheckedChange={() => handleToggleFileSelection(file.id)} onClick={(e) => e.stopPropagation()} />
                                                                <div className="p-2 bg-gray-950 rounded-lg group-hover:scale-110 transition-transform">{getFileIcon(file.mimeType)}</div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-white font-bold truncate text-sm">{file.name}</h4>
                                                                    <p className="text-xs flex items-center gap-2 text-gray-500 font-medium">
                                                                        <span>{formatFileSize(file.size)}</span>
                                                                        <span>•</span>
                                                                        <span>{new Date(file.modifiedTime).toLocaleDateString('ko-KR')}</span>
                                                                    </p>
                                                                </div>
                                                                {file.learnStatus === 'completed' && (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none">
                                                                        <CheckCircle className="h-3 w-3 mr-1" /> PROCESSED
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </ScrollArea>
                                            </TabsContent>
                                        ))}
                                    </Tabs>
                                );
                            })()}
                        </CardContent>
                        <div className="p-6 border-t border-gray-800 bg-gray-900/80">
                            <TitleInput initialValue={title} onSave={setTitle} />
                            {learning ? (
                                <div className="flex gap-2">
                                    <Button disabled className="flex-1 h-14 bg-blue-600/50 text-white text-lg font-black">
                                        <RefreshCw className="h-5 w-5 mr-3 animate-spin" /> DEEP LEARNING IN PROGRESS...
                                    </Button>
                                    <Button onClick={handleCancelLearning} className="h-14 bg-rose-600 hover:bg-rose-700 text-white text-sm font-black w-24">
                                        <StopCircle className="h-5 w-5 mb-1" /> 강제 중지
                                    </Button>
                                </div>
                            ) : (
                                <Button onClick={handleRunLearning} disabled={selectedFileIds.size === 0 || !isModelSelectionComplete()}
                                    className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black shadow-lg transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    <Brain className="h-5 w-5 mr-3 text-white" /> 선택한 {selectedFileIds.size}개 파일로 지식 학습 시작
                                </Button>
                            )}
                        </div>
                    </Card>
                </div>

                <div className="space-y-8">
                    <Card className="bg-gray-900 border-gray-800 shadow-xl lg:sticky lg:top-8">
                        <CardHeader className="border-b border-gray-800">
                            <CardTitle className="text-white text-xl font-black flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-500" /> 통합 투자 로직 (DB)
                            </CardTitle>
                            <CardDescription className="text-gray-400">시스템이 사용할 활성 지식 베이스를 선택하세요</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[750px]">
                                <div className="p-4 space-y-4">
                                    {knowledgeList.map((kb) => (
                                        <div key={kb.id} className={`p-5 rounded-xl border transition-all ${kb.isActive ? 'bg-blue-600/10 border-blue-500 shadow-blue-500/10' : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}>
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className="min-w-0 flex-1">
                                                    {editingKnowledgeId === kb.id ? (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <Input value={editKnowledgeTitle} onChange={(e) => setEditKnowledgeTitle(e.target.value)} className="h-7 text-xs bg-gray-900 border-gray-700 text-white w-full" autoFocus onKeyDown={(e) => e.key === 'Enter' && handleUpdateKnowledgeTitle(kb.id)} />
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500 hover:bg-gray-800" onClick={() => handleUpdateKnowledgeTitle(kb.id)}><CheckCircle className="h-4 w-4" /></Button>
                                                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:bg-gray-800" onClick={() => setEditingKnowledgeId(null)}><X className="h-4 w-4" /></Button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="text-white font-black truncate text-sm">{kb.title || `Session ${kb.id.slice(-4)}`}</h4>
                                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => { setEditingKnowledgeId(kb.id); setEditKnowledgeTitle(kb.title || `Session ${kb.id.slice(-4)}`); }}>
                                                                <Pencil className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">CREATED : {new Date(kb.createdAt).toLocaleDateString()}</p>
                                                </div>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-400" onClick={() => handleDeleteKnowledge(kb.id)}><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 mt-4">
                                                <Button variant={kb.isActive ? "default" : "outline"} className={`h-10 font-black text-xs ${kb.isActive ? "bg-blue-600" : "border-gray-700 text-gray-300"}`} onClick={() => handleActivateKnowledge(kb.id, !kb.isActive)}>
                                                    {kb.isActive ? '현재 사용 중' : '로직 활성화'}
                                                </Button>
                                                <Button variant="outline" className="h-10 border-gray-700 text-gray-300 font-black text-xs" onClick={() => setExpandedKnowledgeId(expandedKnowledgeId === kb.id ? null : kb.id)}>
                                                    <Eye className="h-4 w-4 mr-1" /> {expandedKnowledgeId === kb.id ? '접기' : '상세 보기'}
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {knowledgeList.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl"><Sparkles className="h-8 w-8 text-gray-800 mx-auto mb-3" /><p className="text-gray-500 text-xs font-bold">아직 학습된 데이터가 없습니다.</p></div>}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
