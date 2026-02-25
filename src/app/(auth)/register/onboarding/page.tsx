'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Sparkles, User, Mail, Lock, ShieldCheck } from 'lucide-react';

function OnboardingContent() {
    const router = useRouter();
    const { update } = useSession();
    const searchParams = useSearchParams();
    const email = searchParams.get('email') || '';
    const name = searchParams.get('name') || '';
    const provider = searchParams.get('provider') || '';
    const providerAccountId = searchParams.get('providerAccountId') || '';

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        nickname: name,
        email: email,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.nickname || !formData.email) {
            setError('모든 필수 항목을 입력해주세요.');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/onboarding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    provider,
                    providerAccountId,
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || '회원가입 실패');
            }

            // 세션 정보 갱신 (닉네임 반영)
            await update({ name: formData.nickname });

            // 가입 성공 후 기업 분석 화면으로 바로 이동
            alert('회원가입이 완료되었습니다!');
            router.push('/stock-analysis');
        } catch (err) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#05070a] p-4 relative overflow-hidden">
            {/* Background patterns */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-emerald-500/5" />

            <Card className="w-full max-w-md relative z-10 bg-black/60 border-gray-800 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-2">
                    <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-2 border border-blue-500/20">
                        <ShieldCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tight text-white uppercase">추가 정보 입력</CardTitle>
                    <CardDescription className="text-gray-400 font-medium">
                        {provider.toUpperCase()} 계정과 연결을 위해 정보를 완성해주세요.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {error && (
                            <Alert variant="destructive" className="bg-red-500/10 border-red-500/20 text-red-400">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="space-y-2">
                            <Label className="text-gray-400 text-xs font-bold uppercase tracking-widest">이메일</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                <Input
                                    type="email"
                                    value={formData.email}
                                    disabled
                                    className="pl-10 bg-gray-900/50 border-gray-800 text-gray-500 cursor-not-allowed"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-gray-400 text-xs font-bold uppercase tracking-widest">닉네임</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                                <Input
                                    placeholder="사용할 닉네임을 입력하세요"
                                    value={formData.nickname}
                                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                                    className="pl-10 bg-gray-900/50 border-gray-800 text-white focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all transform hover:scale-[1.02]"
                            disabled={isLoading}
                        >
                            {isLoading ? '처리 중...' : '회원가입 완료'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#05070a] text-gray-400">Loading...</div>}>
            <OnboardingContent />
        </Suspense>
    );
}
