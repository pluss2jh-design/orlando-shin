'use client';

import { useEffect, useState } from 'react';
import { Brain, RefreshCw } from 'lucide-react';

export function LearningStatusBadge() {
    const [isLearning, setIsLearning] = useState(false);

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/admin/learning-status');
                if (res.ok) {
                    const data = await res.json();
                    setIsLearning(data.isLearning);
                }
            } catch (err) {
                // Silently ignore errors for polling
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 30000); // Changed to 30s
        return () => clearInterval(interval);
    }, []);

    if (!isLearning) return null;

    return (
        <div className="flex items-center gap-2 bg-blue-500/10 text-blue-600 border border-blue-500/20 px-4 py-2 rounded-full shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 mr-4">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <Brain className="h-4 w-4" />
            <span className="text-sm font-bold tracking-tight">AI 엔진 코어 지식 학습 중... 화면을 벗어나도 안전합니다.</span>
        </div>
    );
}
