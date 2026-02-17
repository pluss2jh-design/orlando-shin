'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

function SignUpForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const selectedPlanId = searchParams.get('plan') || 'free';

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('비밀번호가 일치하지 않습니다.');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    plan: selectedPlanId,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                // Automatically sign in or redirect to login
                router.push('/login?message=signup_success');
            } else {
                setError(data.error || '회원가입에 실패했습니다.');
            }
        } catch (err) {
            setError('오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card className="w-full max-w-md mx-auto shadow-2xl">
            <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                    <Badge variant="outline" className="px-3 py-1 border-blue-600 text-blue-600 bg-blue-50">
                        선택된 플랜: {selectedPlanId.toUpperCase()}
                    </Badge>
                </div>
                <CardTitle className="text-3xl font-extrabold text-gray-900">회원가입</CardTitle>
                <CardDescription>
                    주식 선생님의 프리미엄 분석 서비스를 시작하세요
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="name">이름</Label>
                        <Input
                            id="name"
                            type="text"
                            placeholder="홍길동"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">이메일 주소</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="name@example.com"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">비밀번호</Label>
                        <Input
                            id="password"
                            type="password"
                            required
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword">비밀번호 확인</Label>
                        <Input
                            id="confirmPassword"
                            type="password"
                            required
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                            className="h-12 border-gray-300 focus:border-blue-600 focus:ring-blue-600"
                        />
                    </div>

                    <Button
                        type="submit"
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all"
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                처리 중...
                            </>
                        ) : (
                            '회원가입 완료'
                        )}
                    </Button>

                    <div className="text-center text-sm text-gray-500 mt-6">
                        이미 계정이 있으신가요? <a href="/login" className="text-blue-600 hover:underline font-semibold">로그인하기</a>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}

export default function SignUpPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-4">
            <Suspense fallback={<div className="text-gray-500">로딩 중...</div>}>
                <SignUpForm />
            </Suspense>
        </div>
    );
}
