'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCw, AlertCircle, CheckCircle, Brain } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function InvestmentLogicPage() {
    const [content, setContent] = useState('');
    const [originalContent, setOriginalContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [relearning, setRelearning] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchInvestmentLogic();
    }, []);

    const fetchInvestmentLogic = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/investment-logic');
            if (response.ok) {
                const data = await response.json();
                setContent(data.content || '');
                setOriginalContent(data.content || '');
            }
        } catch (error) {
            console.error('Failed to fetch investment logic:', error);
            setMessage({ type: 'error', text: '투자 로직을 불러오는데 실패했습니다' });
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);

            const response = await fetch('/api/admin/investment-logic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content }),
            });

            if (response.ok) {
                setOriginalContent(content);
                setMessage({ type: 'success', text: '투자 로직이 저장되었습니다' });
            } else {
                setMessage({ type: 'error', text: '저장에 실패했습니다' });
            }
        } catch (error) {
            console.error('Save failed:', error);
            setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다' });
        } finally {
            setSaving(false);
        }
    };

    const handleRelearn = async () => {
        if (!confirm('전체 파일을 다시 학습하시겠습니까? 이 작업은 시간이 걸릴 수 있습니다.')) {
            return;
        }

        try {
            setRelearning(true);
            setMessage(null);

            const response = await fetch('/api/gdrive/learn', { method: 'POST' });

            if (response.ok) {
                await fetchInvestmentLogic();
                setMessage({ type: 'success', text: '전체 학습이 완료되었습니다' });
            } else {
                setMessage({ type: 'error', text: '학습에 실패했습니다' });
            }
        } catch (error) {
            console.error('Relearn failed:', error);
            setMessage({ type: 'error', text: '학습 중 오류가 발생했습니다' });
        } finally {
            setRelearning(false);
        }
    };

    const hasChanges = content !== originalContent;

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">투자 로직 관리</h1>
                    <p className="text-gray-400">AI가 학습한 투자 기준을 확인하고 수정하세요</p>
                </div>
                <div className="flex gap-3">
                    <Button
                        onClick={handleRelearn}
                        disabled={relearning}
                        variant="outline"
                        className="border-gray-700 hover:bg-gray-800"
                    >
                        {relearning ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                학습 중...
                            </>
                        ) : (
                            <>
                                <Brain className="h-4 w-4 mr-2" />
                                전체 다시 학습하기
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {saving ? (
                            <>
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                저장 중...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                저장하기
                            </>
                        )}
                    </Button>
                </div>
            </div>

            {message && (
                <Alert className={message.type === 'success' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}>
                    {message.type === 'success' ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <AlertDescription className={message.type === 'success' ? 'text-green-500' : 'text-red-500'}>
                        {message.text}
                    </AlertDescription>
                </Alert>
            )}

            <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center justify-between">
                        <span>투자 기준 (learned-knowledge.json)</span>
                        {hasChanges && (
                            <span className="text-sm font-normal text-yellow-500">• 저장되지 않은 변경사항</span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto mb-4" />
                            <p className="text-gray-500">투자 로직을 불러오는 중...</p>
                        </div>
                    ) : (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full h-[600px] bg-gray-950 border border-gray-800 rounded-lg p-4 text-gray-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            placeholder="투자 로직이 여기에 표시됩니다..."
                        />
                    )}
                </CardContent>
            </Card>

            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <h3 className="text-white font-semibold mb-2">💡 사용 팁</h3>
                <ul className="text-gray-400 text-sm space-y-1">
                    <li>• JSON 형식을 유지하면서 투자 규칙을 수정할 수 있습니다</li>
                    <li>• 저장 후에는 즉시 분석 엔진에 반영됩니다</li>
                    <li>• "전체 다시 학습하기"를 클릭하면 Google Drive의 모든 파일을 재분석합니다</li>
                </ul>
            </div>
        </div>
    );
}
