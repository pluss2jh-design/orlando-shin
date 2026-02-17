'use client';

import { useEffect, useState } from 'react';
import { FileText, Film, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    size?: number;
    modifiedTime: string;
    learnStatus: 'completed' | 'pending' | 'processing';
}

export default function DataLibraryPage() {
    const [files, setFiles] = useState<DriveFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [learningFileId, setLearningFileId] = useState<string | null>(null);

    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/files');
            if (response.ok) {
                const data = await response.json();
                setFiles(data.files || []);
            }
        } catch (error) {
            console.error('Failed to fetch files:', error);
        } finally {
            setLoading(false);
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

    const handleLearnFile = async (fileId: string) => {
        try {
            setLearningFileId(fileId);
            const response = await fetch('/api/admin/learn-file', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId }),
            });

            if (response.ok) {
                await fetchFiles();
            }
        } catch (error) {
            console.error('Learn file failed:', error);
        } finally {
            setLearningFileId(null);
        }
    };

    const getFileIcon = (mimeType: string) => {
        if (mimeType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
        if (mimeType.includes('video')) return <Film className="h-5 w-5 text-purple-500" />;
        return <FileText className="h-5 w-5 text-gray-500" />;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium">
                        <CheckCircle className="h-3 w-3" />
                        학습완료
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 text-xs font-medium">
                        <RefreshCw className="h-3 w-3 animate-spin" />
                        처리중
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
                        <Clock className="h-3 w-3" />
                        대기
                    </span>
                );
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '-';
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">데이터 라이브러리</h1>
                    <p className="text-gray-400">Google Drive에서 불러온 파일 목록</p>
                </div>
                <Button
                    onClick={handleSync}
                    disabled={syncing}
                    className="bg-blue-600 hover:bg-blue-700"
                >
                    {syncing ? (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            동기화 중...
                        </>
                    ) : (
                        <>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Google Drive 동기화
                        </>
                    )}
                </Button>
            </div>

            <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                    <CardTitle className="text-white">파일 목록 ({files.length}개)</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto mb-4" />
                            <p className="text-gray-500">파일 목록을 불러오는 중...</p>
                        </div>
                    ) : files.length === 0 ? (
                        <div className="text-center py-12">
                            <AlertCircle className="h-12 w-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-500 mb-4">파일이 없습니다</p>
                            <Button onClick={handleSync} variant="outline">
                                Google Drive 동기화하기
                            </Button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-gray-800">
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">파일</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">크기</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">수정일</th>
                                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">상태</th>
                                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">작업</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {files.map((file) => (
                                        <tr key={file.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    {getFileIcon(file.mimeType)}
                                                    <span className="text-white font-medium">{file.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">
                                                {formatFileSize(file.size)}
                                            </td>
                                            <td className="py-3 px-4 text-gray-400 text-sm">
                                                {new Date(file.modifiedTime).toLocaleDateString('ko-KR')}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStatusBadge(file.learnStatus)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleLearnFile(file.id)}
                                                    disabled={learningFileId === file.id || file.learnStatus === 'processing'}
                                                    className="border-gray-700 hover:bg-gray-800"
                                                >
                                                    {learningFileId === file.id ? (
                                                        <>
                                                            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                                            학습 중
                                                        </>
                                                    ) : (
                                                        '개별 학습'
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
