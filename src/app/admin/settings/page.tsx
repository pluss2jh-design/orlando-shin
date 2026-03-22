'use client';

import { useEffect, useState } from 'react';
import { Save, RefreshCw, Key, AlertCircle, CheckCircle, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';

interface ApiKeys {
    GEMINI_API_KEY: string;
    OPENAI_API_KEY: string;
    CLAUDE_API_KEY: string;
    YAHOO_FINANCE_API_KEY: string;
    NEWS_SCAN_AI_MODEL: string;
}

/** AI 모델 정보 */
interface AIModel {
    value: string;
    label: string;
    reqKey: string;
    supportsPDF: boolean;
    supportsVideo: boolean;
    provider: string; // 추가됨
}

export default function SettingsPage() {
    const [keys, setKeys] = useState<ApiKeys>({
        GEMINI_API_KEY: '',
        OPENAI_API_KEY: '',
        CLAUDE_API_KEY: '',
        YAHOO_FINANCE_API_KEY: '',
        NEWS_SCAN_AI_MODEL: '',
    });
    const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            await Promise.all([fetchSettings(), fetchModels()]);
            setLoading(false);
        };
        init();
    }, []);

    const fetchModels = async () => {
        try {
            const response = await fetch('/api/admin/models', { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                setAvailableModels(data.models || []);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        }
    };

    const fetchSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings');
            if (response.ok) {
                const data = await response.json();
                setKeys(data.keys || {});
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
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

    const toggleShowKey = (key: string) => {
        setShowKeys(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <div className="p-8 space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">시스템 설정</h1>
                <p className="text-gray-500 font-medium">API 키 및 시스템 설정을 관리하세요</p>
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
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                        Google API Key (Gemini)
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key className="h-4 w-4 text-gray-500 group-focus-within:text-blue-500 transition-colors" />
                                        </div>
                                        <Input
                                            type={showKeys['GEMINI_API_KEY'] ? 'text' : 'password'}
                                            value={keys.GEMINI_API_KEY}
                                            onChange={(e) => handleChange('GEMINI_API_KEY', e.target.value)}
                                            placeholder="AIza..."
                                            className="bg-gray-950 border-gray-800 text-white pl-10 pr-12 focus:ring-blue-500/50 focus:border-blue-500 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleShowKey('GEMINI_API_KEY')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                            title={showKeys['GEMINI_API_KEY'] ? "숨기기" : "보기"}
                                        >
                                            {showKeys['GEMINI_API_KEY'] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Google Drive 및 Gemini AI 모델 사용에 필요합니다
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                        OpenAI API Key
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key className="h-4 w-4 text-gray-500 group-focus-within:text-green-500 transition-colors" />
                                        </div>
                                        <Input
                                            type={showKeys['OPENAI_API_KEY'] ? 'text' : 'password'}
                                            value={keys.OPENAI_API_KEY}
                                            onChange={(e) => handleChange('OPENAI_API_KEY', e.target.value)}
                                            placeholder="sk-..."
                                            className="bg-gray-950 border-gray-800 text-white pl-10 pr-12 focus:ring-green-500/50 focus:border-green-500 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleShowKey('OPENAI_API_KEY')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                            title={showKeys['OPENAI_API_KEY'] ? "숨기기" : "보기"}
                                        >
                                            {showKeys['OPENAI_API_KEY'] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        GPT 모델 사용에 필요합니다 (선택사항)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                        Claude API Key
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key className="h-4 w-4 text-gray-500 group-focus-within:text-orange-500 transition-colors" />
                                        </div>
                                        <Input
                                            type={showKeys['CLAUDE_API_KEY'] ? 'text' : 'password'}
                                            value={keys.CLAUDE_API_KEY}
                                            onChange={(e) => handleChange('CLAUDE_API_KEY', e.target.value)}
                                            placeholder="sk-ant-..."
                                            className="bg-gray-950 border-gray-800 text-white pl-10 pr-12 focus:ring-orange-500/50 focus:border-orange-500 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleShowKey('CLAUDE_API_KEY')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                            title={showKeys['CLAUDE_API_KEY'] ? "숨기기" : "보기"}
                                        >
                                            {showKeys['CLAUDE_API_KEY'] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Claude 모델 사용에 필요합니다 (선택사항)
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-300">
                                        Yahoo Finance API Key
                                    </label>
                                    <div className="relative group">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Key className="h-4 w-4 text-gray-500 group-focus-within:text-purple-500 transition-colors" />
                                        </div>
                                        <Input
                                            type={showKeys['YAHOO_FINANCE_API_KEY'] ? 'text' : 'password'}
                                            value={keys.YAHOO_FINANCE_API_KEY}
                                            onChange={(e) => handleChange('YAHOO_FINANCE_API_KEY', e.target.value)}
                                            placeholder="API Key (선택사항)"
                                            className="bg-gray-950 border-gray-800 text-white pl-10 pr-12 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-mono"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => toggleShowKey('YAHOO_FINANCE_API_KEY')}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
                                            title={showKeys['YAHOO_FINANCE_API_KEY'] ? "숨기기" : "보기"}
                                        >
                                            {showKeys['YAHOO_FINANCE_API_KEY'] ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        Yahoo Finance는 기본적으로 무료로 사용 가능합니다
                                    </p>
                                </div>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            <div className="space-y-6">
            <Card className="bg-gray-900 border-gray-800">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-blue-500" />
                        AI 모델 설정
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">
                            기업 분석 후 뉴스 스캔용 AI 모델
                        </label>
                        <Select 
                            value={keys.NEWS_SCAN_AI_MODEL} 
                            onValueChange={(val) => handleChange('NEWS_SCAN_AI_MODEL', val)}
                        >
                            <SelectTrigger className="bg-gray-950 border-gray-800 text-white focus:ring-blue-500/50 focus:border-blue-500 transition-all">
                                <SelectValue placeholder="AI 모델을 선택해주세요" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 border-gray-800">
                                {availableModels.length > 0 ? (
                                    availableModels.map((model) => {
                                        const hasKey = keys[model.reqKey as keyof ApiKeys];
                                        const isMasked = typeof hasKey === 'string' && hasKey.startsWith('••••');
                                        const isRegistered = isMasked || (hasKey && hasKey.length > 0);
                                        
                                        return (
                                            <SelectItem 
                                                key={model.value} 
                                                value={model.value}
                                                disabled={!isRegistered}
                                                className="text-white hover:bg-gray-800 cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between gap-4 w-full">
                                                    <span>{model.label}</span>
                                                    {!isRegistered && (
                                                        <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-500">
                                                            API 키 미등록
                                                        </Badge>
                                                    )}
                                                </div>
                                            </SelectItem>
                                        );
                                    })
                                ) : (
                                    <div className="p-4 text-center text-sm text-gray-500">
                                        사용 가능한 모델이 없습니다. 먼저 API 키를 등록해주세요.
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-gray-500">
                            상위 n개 기업의 실시간 뉴스 분석 및 감성 점수 산정에 사용될 모델입니다
                        </p>
                    </div>
                </CardContent>
            </Card>

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
        </div>
    </div>
);
}
