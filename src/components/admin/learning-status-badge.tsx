'use client';

import { useEffect, useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';

interface LearningStatusData {
    isLearning: boolean;
    totalFiles: number;
    completedFiles: number;
}

export function LearningStatusBadge() {
    const [status, setStatus] = useState<LearningStatusData>({
        isLearning: false,
        totalFiles: 0,
        completedFiles: 0,
    });

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/admin/learning-status');
                if (res.ok) {
                    const data = await res.json();
                    setStatus({
                        isLearning: data.isLearning ?? false,
                        totalFiles: data.totalFiles ?? 0,
                        completedFiles: data.completedFiles ?? 0,
                    });
                }
            } catch {
                // 폴링 에러 무시
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000); // 5초마다 갱신
        return () => clearInterval(interval);
    }, []);

    if (!status.isLearning) return null;

    const pct = status.totalFiles > 0
        ? Math.round((status.completedFiles / status.totalFiles) * 100)
        : 0;
    const progressText = status.totalFiles > 0
        ? ` (${status.completedFiles}/${status.totalFiles}개 • ${pct}%)`
        : '';

    return (
        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 border border-blue-500/20 px-4 py-2 rounded-full shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mr-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <Brain className="h-4 w-4" />
            <span className="text-sm font-bold tracking-tight">
                AI 학습 중{progressText} — 백그라운드에서 학습이 진행됩니다.
            </span>
            {status.totalFiles > 0 && (
                <div className="w-24 h-1.5 bg-blue-200/30 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
        </div>
    );
}
