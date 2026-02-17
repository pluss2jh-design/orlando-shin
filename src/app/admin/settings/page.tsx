'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCw, Key, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ApiKeys {
    GOOGLE_API_KEY: string;
    OPENAI_API_KEY: string;
    YAHOO_FINANCE_API_KEY: string;
}

export default function SettingsPage() {
    const [keys, setKeys] = useState<ApiKeys>({
        GOOGLE_API_KEY: '',
        OPENAI_API_KEY: '',
        YAHOO_FINANCE_API_KEY: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/settings');
            if (response.ok) {
                const data = await response.json();
                setKeys(data.keys || {});
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);

            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keys }),
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'API 키가 저장되었습니다' });
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

    const handleChange = (key: keyof ApiKeys, value: string) => {
        setKeys(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">시스템 설정</h1>
                <p className="text-gray-400">API 키 및 시스템 설정을 관리하세요</p>
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
                    <CardTitle className="text-white flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API 키 설정
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? (
                        <div className="text-center py-12">
                            <RefreshCw className="h-8 w-8 text-gray-500 animate-spin mx-auto mb-4" />
                            <p className="text-gray-500">설정을 불러오는 중...</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Google API Key (Gemini)
                                </label>
                                <Input
                                    type="password"
                                    value={keys.GOOGLE_API_KEY}
                                    onChange={(e) => handleChange('GOOGLE_API_KEY', e.target.value)}
                                    placeholder="AIza..."
                                    className="bg-gray-950 border-gray-800 text-white"
                                />
                                <p className="text-xs text-gray-500">
                                    Google Drive 및 Gemini AI 모델 사용에 필요합니다
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    OpenAI API Key
                                </label>
                                <Input
                                    type="password"
                                    value={keys.OPENAI_API_KEY}
                                    onChange={(e) => handleChange('OPENAI_API_KEY', e.target.value)}
                                    placeholder="sk-..."
                                    className="bg-gray-950 border-gray-800 text-white"
                                />
                                <p className="text-xs text-gray-500">
                                    GPT 모델 사용에 필요합니다 (선택사항)
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-300">
                                    Yahoo Finance API Key
                                </label>
                                <Input
                                    type="password"
                                    value={keys.YAHOO_FINANCE_API_KEY}
                                    onChange={(e) => handleChange('YAHOO_FINANCE_API_KEY', e.target.value)}
                                    placeholder="API Key (선택사항)"
                                    className="bg-gray-950 border-gray-800 text-white"
                                />
                                <p className="text-xs text-gray-500">
                                    Yahoo Finance는 기본적으로 무료로 사용 가능합니다
                                </p>
                            </div>

                            <div className="pt-4">
                                <Button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-blue-600 hover:bg-blue-700 w-full"
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
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
                <div className="flex gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-yellow-500 font-semibold mb-1">보안 주의사항</h3>
                        <p className="text-yellow-500/80 text-sm">
                            API 키는 암호화되어 서버에 저장됩니다. 절대 다른 사람과 공유하지 마세요.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
