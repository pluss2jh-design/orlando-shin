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
    features: Feature[];
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
        <div className="min-h-screen bg-gray-50 py-20 px-4">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
                        합리적인 요금제로 주식 투자의 수준을 높이세요
                    </h1>
                    <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
                        당신에게 가장 잘 맞는 플랜을 선택하고 지금 바로 AI 분석을 시작하세요.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={`relative border-2 transition-all hover:shadow-xl ${plan.isPopular ? 'border-blue-600 scale-105 z-10' : 'border-gray-200'
                                }`}
                        >
                            {plan.isPopular && (
                                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg">
                                    <Sparkles className="h-4 w-4" />
                                    가장 인기 있음
                                </div>
                            )}

                            <CardHeader className="text-center pb-2">
                                <CardTitle className="text-2xl font-bold text-gray-900">
                                    {plan.name}
                                </CardTitle>
                                <div className="mt-4 flex items-baseline justify-center gap-1">
                                    <span className="text-4xl font-extrabold tracking-tight text-gray-900 font-mono">
                                        ₩{plan.price.toLocaleString()}
                                    </span>
                                    <span className="text-gray-500">/월</span>
                                </div>
                            </CardHeader>

                            <CardContent className="pt-8">
                                <ul className="space-y-4">
                                    {plan.features.map((feature) => (
                                        <li key={feature.id} className="flex items-start gap-3">
                                            <div className={`mt-0.5 rounded-full p-0.5 ${feature.enabled ? 'bg-blue-100' : 'bg-gray-100'}`}>
                                                <Check className={`h-4 w-4 ${feature.enabled ? 'text-blue-600' : 'text-gray-300'}`} />
                                            </div>
                                            <span className={`text-sm ${feature.enabled ? 'text-gray-900 font-medium' : 'text-gray-400 line-through'}`}>
                                                {feature.name}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter className="pt-8">
                                <Button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    className={`w-full py-6 text-lg font-bold shadow-md transition-all active:scale-95 ${plan.isPopular
                                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                        : 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50'
                                        }`}
                                >
                                    시작하기
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                <div className="mt-16 text-center">
                    <p className="text-gray-500">
                        모든 요금제는 부가세가 포함된 금액입니다. 언제든지 구독을 취소할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
