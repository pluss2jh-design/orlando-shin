'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Plan {
    id: string;
    name: string;
    price: number;
    weeklyAnalysisLimit: number;
    canSendEmail: boolean;
    isPopular?: boolean;
}

export default function MembershipPlanPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
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

    const handleSave = async () => {
        try {
            setSaving(true);
            setMessage(null);
            const res = await fetch('/api/admin/plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(plans),
            });

            if (res.ok) {
                setMessage({ type: 'success', text: '요금제 설정이 저장되었습니다.' });
            } else {
                setMessage({ type: 'error', text: '저장에 실패했습니다.' });
            }
        } catch (error) {
            setMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
        } finally {
            setSaving(false);
        }
    };

    const updatePlan = (planId: string, key: keyof Plan, value: any) => {
        setPlans(prev => prev.map(plan =>
            plan.id === planId ? { ...plan, [key]: value } : plan
        ));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">요금제 관리 (Membership & Plan)</h1>
                    <p className="text-gray-400">각 요금제별 가격 및 제한을 설정하세요</p>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                    {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    설정 저장하기
                </Button>
            </div>

            {message && (
                <Alert className={message.type === 'success' ? 'bg-green-500/10 border-green-500/50' : 'bg-red-500/10 border-red-500/50'}>
                    <AlertDescription className={message.type === 'success' ? 'text-green-500' : 'text-red-500'}>
                        {message.text}
                    </AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {plans.map((plan) => (
                    <Card key={plan.id} className="bg-gray-900 border-gray-800">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center justify-between">
                                <span>{plan.name}</span>
                                {plan.isPopular && <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full">Popular</span>}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-gray-400">월 이용료 (KRW)</Label>
                                <Input
                                    type="number"
                                    value={plan.price}
                                    onChange={(e) => updatePlan(plan.id, 'price', parseInt(e.target.value))}
                                    className="bg-gray-950 border-gray-800 text-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-gray-400">주당 분석 가능 횟수 (-1: 무제한)</Label>
                                <Input
                                    type="number"
                                    value={plan.weeklyAnalysisLimit}
                                    onChange={(e) => updatePlan(plan.id, 'weeklyAnalysisLimit', parseInt(e.target.value))}
                                    className="bg-gray-950 border-gray-800 text-white"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-950 border border-gray-800">
                                <span className="text-sm text-gray-300">분석 자료 이메일 전송</span>
                                <Switch
                                    checked={plan.canSendEmail}
                                    onCheckedChange={(checked) => updatePlan(plan.id, 'canSendEmail', checked)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
