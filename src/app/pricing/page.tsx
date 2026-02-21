'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Sparkles } from 'lucide-react';

interface Feature {
    id: string;
    name: string;
    enabled: boolean;
}

interface Plan {
    id: string;
    name: string;
    price: number;
    weeklyAnalysisLimit: number;
    canSendEmail: boolean;
    isPopular?: boolean;
}

export default function PricingPage() {
    const { data: session, update } = useSession();
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const res = await fetch('/api/admin/plans');
                if (res.ok) {
                    setPlans(await res.json());
                }
            } catch (error) {
                console.error('Fetch plans failed:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchPlans();
    }, []);

    const handleSelectPlan = async (planId: string) => {
        if (!session) {
            router.push(`/signup?plan=${planId}`);
            return;
        }

        const confirmed = window.confirm(`${planId.toUpperCase()} 플랜으로 변경하시겠습니까? (테스트 결제)`);
        if (!confirmed) return;

        try {
            const res = await fetch('/api/payment/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ planId, paymentId: 'mock_pay_' + Date.now() }),
            });

            if (res.ok) {
                const data = await res.json();
                // 세션 즉시 업데이트 요청
                await update({ plan: data.plan });
                alert('플랜이 성공적으로 변경되었습니다!');
                router.push('/stock-analysis');
            } else {
                alert('플랜 변경에 실패했습니다.');
            }
        } catch (error) {
            console.error('Payment error:', error);
            alert('결제 처리 중 오류가 발생했습니다.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f3f4f6] py-20 px-4 font-sans text-gray-900">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-start mb-8">
                    <Button variant="ghost" onClick={() => router.push('/')} className="text-gray-500 hover:text-black">
                        &larr; 홈으로 돌아가기
                    </Button>
                </div>
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-black text-gray-900 sm:text-5xl tracking-tight">
                        Pricing Plans
                    </h1>
                    <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto font-medium">
                        당신에게 가장 잘 맞는 플랜을 선택하고 지금 바로 AI 분석을 시작하세요.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative border border-gray-200 transition-all hover:-translate-y-2 hover:shadow-2xl bg-white rounded-none ${plan.isPopular ? 'scale-105 z-10 border-blue-200' : ''
                                }`}
                        >
                            {plan.isPopular && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black text-white px-4 py-1 text-xs font-bold tracking-widest uppercase shadow-lg z-10">
                                    Popular
                                </div>
                            )}

                            <CardHeader className="text-center pb-2 pt-10">
                                <CardTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">
                                    {plan.name}
                                </CardTitle>
                                <div className="mt-6 flex items-baseline justify-center gap-1">
                                    <span className="text-4xl font-black tracking-tighter text-gray-900">
                                        ₩{plan.price.toLocaleString()}
                                    </span>
                                    <span className="text-gray-500 font-medium">/ 1 Month</span>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-8">
                                <div className="space-y-4 px-4 text-sm text-gray-600 font-medium">
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span>주간 분석 한도</span>
                                        <span className="font-bold text-black">{plan.weeklyAnalysisLimit === -1 ? '무제한' : `${plan.weeklyAnalysisLimit}회`}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                                        <span>이메일 리포트 전송</span>
                                        <span className="font-bold text-black">{plan.canSendEmail ? '가능' : '불가'}</span>
                                    </div>
                                </div>
                            </CardContent>

                            <CardFooter className="pt-8 pb-10">
                                <Button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    className={`w-full h-14 rounded-none font-black text-sm tracking-widest uppercase ${plan.isPopular ? 'bg-black hover:bg-black/90 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'
                                        }`}
                                >
                                    Select Plan
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}

