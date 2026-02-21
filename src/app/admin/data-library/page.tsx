'use client';

import { useEffect, useState } from 'react';
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
    Eye
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
    learnStatus: 'completed' | 'pending' | 'processing';
}

interface LearnedKnowledgeRecord {
    id: string;
    title: string;
    isActive: boolean;
    createdAt: string;
    files: string[];
    content: any;
}

// Models are now fetched dynamically from /api/admin/models

export default function DataLibraryPage() {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [expandedKnowledgeId, setExpandedKnowledgeId] = useState<string | null>(null);
    const [knowledgeList, setKnowledgeList] = useState<LearnedKnowledgeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [learning, setLearning] = useState(false);

    // UI State
    const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
    const [title, setTitle] = useState('');
    const [aiModels, setAiModels] = useState<Record<string, string>>({});
    const [availableModels, setAvailableModels] = useState<{ value: string, label: string, reqKey: string }[]>([]);
    const [keys, setKeys] = useState<{ GOOGLE_API_KEY?: string, OPENAI_API_KEY?: string, CLAUDE_API_KEY?: string } | null>(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        await Promise.all([fetchKnowledge(), fetchKeys(), fetchModels()]);
        setLoading(false);
    };

    const fetchModels = async () => {
        try {
            const response = await fetch('/api/admin/models');
            if (response.ok) {
                const data = await response.json();
                setAvailableModels(data.models || []);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
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
            console.error('Failed to fetch keys:', error);
        }
    };

    const getFileExt = (name: string, mime: string) => {
        if (mime.includes('video') || name.toLowerCase().endsWith('.mp4')) return 'mp4';
        if (name.toLowerCase().endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
        if (name.toLowerCase().endsWith('.docx') || name.toLowerCase().endsWith('.doc')) return 'docx';
        if (name.toLowerCase().endsWith('.xlsx') || name.toLowerCase().endsWith('.xls') || name.toLowerCase().endsWith('.csv')) return 'xlsx';
        return 'other';
    };

    const fetchFiles = async () => {
        try {
            const response = await fetch('/api/admin/files');
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
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
            console.error('Failed to fetch knowledge:', error);
        }
    };

    const handleSync = async () => {
        try {
            setSyncing(true);
            const response = await fetch('/api/gdrive/sync', { method: 'POST' });
            if (response.ok) {
                await fetchFiles();
            }
        } catch (error) {
            console.error('Sync failed:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleFileSelection = (fileId: string) => {
        const next = new Set(selectedFileIds);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        setSelectedFileIds(next);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedFileIds(new Set(files.map(f => f.id)));
        } else {
            setSelectedFileIds(new Set());
        }
    };

    const handleRunLearning = () => {
        if (selectedFileIds.size === 0) {
            alert('학습할 파일을 선택해주세요.');
            return;
        }

        const fileIdsArray = Array.from(selectedFileIds);

        // Notify user early and run in background so they can navigate away safely
        alert('백그라운드에서 AI 학습이 시작되었습니다.\n다른 메뉴로 이동하셔도 로직 처리는 계속 진행됩니다.\n초기화 된 이 화면을 그대로 두시면 학습 완료 후 시스템 팝업을 통해 알려드립니다.');
        setLearning(true);
        setSelectedFileIds(new Set());
        const currentTitle = title;
        setTitle('');

        fetch('/api/gdrive/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileIds: fileIdsArray,
                aiModels: aiModels,
                title: currentTitle
            }),
        }).then(async (response) => {
            if (response.ok) {
                alert('AI 엔진 학습이 완료되었습니다!');
                await fetchInitialData();
            } else {
                const error = await response.json();
                alert(`학습 실패: ${error.error}`);
            }
        }).catch(error => {
            console.error('Learning failed:', error);
            alert('학습 엔진 실행 중 오류가 발생했습니다.');
        }).finally(() => {
            setLearning(false);
        });
    };

    const handleActivateKnowledge = async (id: string, active: boolean) => {
        try {
            const response = await fetch('/api/admin/knowledge', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: active }),
            });

            if (response.ok) {
                await fetchKnowledge();
            }
        } catch (error) {
            console.error('Activation failed:', error);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const response = await fetch(`/api/admin/knowledge?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                await fetchKnowledge();
            }
        } catch (error) {
            console.error('Deletion failed:', error);
        }
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

    const isModelSelectionComplete = () => {
        if (selectedFileIds.size === 0) return true; // Disabled handled by selectedFileIds.size === 0 anyway

        const selectedExts = new Set<string>();
        for (const file of files) {
            if (selectedFileIds.has(file.id)) {
                selectedExts.add(getFileExt(file.name, file.mimeType));
            }
        }

        for (const ext of selectedExts) {
            if (ext !== 'mp4' && ext !== 'other') {
                if (!aiModels[ext]) {
                    return false;
                }
            }
        }
        return true;
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-white mb-2 tracking-tighter">데이터 라이브러리</h1>
                    <p className="text-gray-400 font-medium">Google Drive 기반 AI 지식 베이스 구축 및 투자 로직 관리</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleSync}
                        disabled={syncing}
                        variant="outline"
                        className="border-gray-800 text-gray-300 hover:bg-gray-800"
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                        Drive 동기화
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* 1. 파일 목록 및 학습 설정 */}
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
                                        <Checkbox
                                            id="select-all"
                                            checked={selectedFileIds.size === files.length && files.length > 0}
                                            onCheckedChange={handleSelectAll}
                                        />
                                        <Label htmlFor="select-all" className="text-xs font-bold text-gray-300 cursor-pointer">전체 선택</Label>
                                    </div>
                                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 font-bold">
                                        {selectedFileIds.size}개 선택됨
                                    </Badge>
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
                                                    <TabsTrigger
                                                        key={ext}
                                                        value={ext}
                                                        className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-500 font-black uppercase text-xs"
                                                    >
                                                        {ext} ({groupedFiles[ext].length})
                                                    </TabsTrigger>
                                                ))}
                                            </TabsList>
                                        </div>

                                        {tabsKeys.map(ext => (
                                            <TabsContent key={ext} value={ext} className="m-0">
                                                {ext !== 'other' && (
                                                    <div className="bg-gray-900/50 p-4 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="flex items-center gap-2">
                                                            <Brain className="h-4 w-4 text-blue-500" />
                                                            <span className="text-xs font-black text-white uppercase">{ext} 분석 AI 모델</span>
                                                        </div>
                                                        {ext === 'mp4' ? (
                                                            <div className="flex flex-col">
                                                                <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs py-1 px-3 block">
                                                                    영상이 10분 이하일 경우엔 Gemini 3.1 Flash, 10분 초과일 경우엔 Gemini 3.1 Pro를 자동 사용합니다.
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <Select
                                                                value={aiModels[ext] || ''}
                                                                onValueChange={(val) => setAiModels({ ...aiModels, [ext]: val })}
                                                            >
                                                                <SelectTrigger className="w-full sm:w-[250px] bg-gray-950 border-gray-800 text-white font-bold h-9 text-xs">
                                                                    <SelectValue placeholder="모델을 선택하세요" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-gray-900 border-gray-800">
                                                                    {availableModels.map(model => {
                                                                        const hasKey = keys && keys[model.reqKey as keyof typeof keys];
                                                                        return (
                                                                            <SelectItem
                                                                                key={model.value}
                                                                                value={model.value}
                                                                                disabled={!hasKey}
                                                                                className="text-white focus:bg-gray-800"
                                                                            >
                                                                                <div className="flex items-center justify-between w-full gap-4">
                                                                                    <span>{model.label}</span>
                                                                                    {!hasKey && (
                                                                                        <span className="text-[10px] text-rose-500">API 키 미등록</span>
                                                                                    )}
                                                                                </div>
                                                                            </SelectItem>
                                                                        );
                                                                    })}
                                                                    {availableModels.length === 0 && (
                                                                        <div className="text-gray-500 text-xs p-3">모델 로딩 중이거나 사용가능한 모델이 없습니다.</div>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </div>
                                                )}

                                                <ScrollArea className="h-[430px]">
                                                    <div className="divide-y divide-gray-800/50">
                                                        {groupedFiles[ext].map((file) => (
                                                            <div
                                                                key={file.id}
                                                                className={`flex items-center gap-4 p-4 hover:bg-gray-800/20 transition-all cursor-pointer group ${selectedFileIds.has(file.id) ? 'bg-blue-500/5' : ''}`}
                                                                onClick={() => handleToggleFileSelection(file.id)}
                                                            >
                                                                <Checkbox
                                                                    checked={selectedFileIds.has(file.id)}
                                                                    onCheckedChange={() => handleToggleFileSelection(file.id)}
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                                <div className="p-2 bg-gray-950 rounded-lg group-hover:scale-110 transition-transform">
                                                                    {getFileIcon(file.mimeType)}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-white font-bold truncate text-sm">{file.name}</h4>
                                                                    <p className="text-xs text-gray-500 font-medium">
                                                                        {formatFileSize(file.size)} • {new Date(file.modifiedTime).toLocaleDateString('ko-KR')}
                                                                    </p>
                                                                </div>
                                                                {file.learnStatus === 'completed' && (
                                                                    <Badge className="bg-emerald-500/10 text-emerald-500 border-none">
                                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                                        PROCESSED
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
                            <div className="mb-6">
                                <Label className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2 block">AI Engine Title</Label>
                                <Input
                                    placeholder="지식 베이스 버전을 입력하세요 (예: 2024년 2분기 리포트)"
                                    className="bg-gray-950 border-gray-800 text-white font-medium"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <Button
                                onClick={handleRunLearning}
                                disabled={learning || selectedFileIds.size === 0 || !isModelSelectionComplete()}
                                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-lg font-black shadow-lg transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {learning ? (
                                    <>
                                        <RefreshCw className="h-5 w-5 mr-3 animate-spin" />
                                        DEEP LEARNING IN PROGRESS...
                                    </>
                                ) : (
                                    <>
                                        <Brain className="h-5 w-5 mr-3 text-white" />
                                        선택한 {selectedFileIds.size}개 파일로 지식 학습 시작
                                    </>
                                )}
                            </Button>
                        </div>
                    </Card>
                </div>

                {/* 2. 저장된 지식 베이스 목록 */}
                <div className="space-y-8">
                    <Card className="bg-gray-900 border-gray-800 shadow-xl lg:sticky lg:top-8">
                        <CardHeader className="border-b border-gray-800">
                            <CardTitle className="text-white text-xl font-black flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-500" />
                                통합 투자 로직 (DB)
                            </CardTitle>
                            <CardDescription className="text-gray-400">시스템이 사용할 활성 지식 베이스를 선택하세요</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <ScrollArea className="h-[750px]">
                                <div className="p-4 space-y-4">
                                    {knowledgeList.map((kb) => (
                                        <div
                                            key={kb.id}
                                            className={`p-5 rounded-xl border transition-all ${kb.isActive
                                                ? 'bg-blue-600/10 border-blue-500 shadow-blue-500/10'
                                                : 'bg-gray-950 border-gray-800 hover:border-gray-700'}`}
                                        >
                                            <div className="flex items-start justify-between gap-3 mb-4">
                                                <div className="min-w-0">
                                                    <h4 className="text-white font-black truncate text-sm mb-1">{kb.title || `Session ${kb.id.slice(-4)}`}</h4>
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                                                        CREATED : {new Date(kb.createdAt).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 shrink-0">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10"
                                                        onClick={() => handleDeleteKnowledge(kb.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mb-6">
                                                <Badge variant="outline" className="bg-gray-900 border-gray-700 text-gray-300 font-bold text-[10px]">
                                                    {kb.files.length} FILES
                                                </Badge>
                                                {kb.isActive && (
                                                    <Badge className="bg-blue-500 text-white font-black text-[10px] animate-pulse">
                                                        ACTIVE
                                                    </Badge>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant={kb.isActive ? "default" : "outline"}
                                                    className={`h-10 font-black text-xs ${kb.isActive ? "bg-blue-600" : "border-gray-700 text-gray-300 hover:bg-gray-800"}`}
                                                    onClick={() => handleActivateKnowledge(kb.id, !kb.isActive)}
                                                >
                                                    {kb.isActive ? '현재 사용 중' : '로직 활성화'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="h-10 border-gray-700 text-gray-300 font-black text-xs hover:bg-gray-800"
                                                    onClick={() => setExpandedKnowledgeId(expandedKnowledgeId === kb.id ? null : kb.id)}
                                                >
                                                    <Eye className="h-4 w-4 mr-1" /> {expandedKnowledgeId === kb.id ? '접기' : '상세 보기'}
                                                </Button>
                                            </div>
                                            {expandedKnowledgeId === kb.id && (
                                                <div className="mt-4 p-4 bg-gray-950 rounded-lg border border-gray-800 text-xs text-gray-300 space-y-4">
                                                    <div>
                                                        <h5 className="font-black text-blue-400 mb-2">단기 투자 조건</h5>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {kb.content?.strategy?.shortTermConditions?.map((c: string, idx: number) => (
                                                                <li key={idx}>{c}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-purple-400 mb-2">장기 투자 조건</h5>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            {kb.content?.strategy?.longTermConditions?.map((c: string, idx: number) => (
                                                                <li key={idx}>{c}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                    <div>
                                                        <h5 className="font-black text-emerald-400 mb-2">주요 분석 규칙 수</h5>
                                                        <ul className="space-y-1 mt-1 text-gray-400">
                                                            <li>펀더멘털: {kb.content?.criteria?.goodCompanyRules?.length || 0}개</li>
                                                            <li>기술적: {kb.content?.criteria?.technicalRules?.length || 0}개</li>
                                                            <li>시장규모: {kb.content?.criteria?.marketSizeRules?.length || 0}개</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {knowledgeList.length === 0 && (
                                        <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-xl">
                                            <Sparkles className="h-8 w-8 text-gray-800 mx-auto mb-3" />
                                            <p className="text-gray-500 text-xs font-bold leading-relaxed">
                                                아직 학습된 데이터가 없습니다.<br />
                                                왼쪽에서 파일을 선택해 학습을 시작하세요.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
