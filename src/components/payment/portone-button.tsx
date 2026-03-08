'use client';

import React, { useState } from 'react';
import Script from 'next/script';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface PortOneButtonProps {
    userId: string;    // 사용자 ID
    planId: string;    // 'PREMIUM', 'STANDARD'
    amount: number;    // 총액
    planName: string;  // 상품명
    buyerName: string;
    buyerEmail: string;
}

export function PortOneButton({ userId, planId, amount, planName, buyerName, buyerEmail }: PortOneButtonProps) {
    const router = useRouter();
    const { update } = useSession();
    const [isProcessing, setIsProcessing] = useState(false);

    const handlePayment = async () => {
        setIsProcessing(true);

        const { PortOne } = window as any;
        if (!PortOne) {
            alert('결제 모듈 로딩 중입니다. 잠시 후 다시 시도해주세요.');
            setIsProcessing(false);
            return;
        }

        const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
        const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

        if (!storeId || !channelKey) {
            alert('가맹점 설정(Store ID 또는 Channel Key)이 누락되었습니다.');
            setIsProcessing(false);
            return;
        }

        const paymentId = `payment-${crypto.randomUUID()}`;

        try {
            // 1. 포트원 V2 결제창 호출
            const response = await PortOne.requestPayment({
                storeId: storeId,
                channelKey: channelKey,
                paymentId: paymentId,
                orderName: planName,
                totalAmount: amount,
                currency: 'CURRENCY_KRW',
                // 주의: 채널 키가 간편결제 전용(카카오페이 등)인 경우 'EASY_PAY'를 사용해야 합니다.
                // 현재 발생한 에러(payMethod violates the rule EQUALS("EASY_PAY"))에 맞춰 수정합니다.
                payMethod: 'EASY_PAY',
                customer: {
                    fullName: buyerName,
                    email: buyerEmail,
                },
                customData: {
                    userId: userId,
                    planId: planId,
                },
            });

            // 2. 응답 코드 확인 (null이면 성공, 값이 있으면 오류)
            if (response.code != null) {
                // 결제 실패 (사용자 취소 등)
                setIsProcessing(false);
                alert(`결제 실패: ${response.message || '알 수 없는 오류'}`);
                return;
            }

            // 3. 백엔드 검증 API 호출
            const verifyRes = await fetch('/api/payment/complete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentId: paymentId,
                    planId: planId,
                    amount: amount,
                }),
            });

            const result = await verifyRes.json();
            setIsProcessing(false);

            if (verifyRes.ok && result.success) {
                // 세션 즉시 업데이트 요청 (DB에 반영된 정보를 JWT에 다시 반영)
                await update({ plan: planId.toUpperCase() });
                alert('결제가 완료되었습니다. 구독 플랜이 업데이트되었습니다!');
                router.refresh();
                router.push('/stock-analysis');
            } else {
                alert(`결제 검증 실패: ${result.error || '나중에 다시 시도해 주세요.'}`);
            }
        } catch (error: any) {
            setIsProcessing(false);
            console.error('Payment process error:', error);
            alert(`결제 중 예상치 못한 오류가 발생했습니다: ${error.message || error}`);
        }
    };

    return (
        <>
            {/* V2 브라우저 SDK 스크립트 */}
            <Script src="https://cdn.portone.io/v2/browser-sdk.js" strategy="lazyOnload" />
            <Button
                onClick={handlePayment}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl transition-all active:scale-95"
            >
                {isProcessing ? (
                    <span className="flex items-center gap-2">
                        <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                        처리 중...
                    </span>
                ) : (
                    `${planName} 가입 및 ₩${amount.toLocaleString()} 결제`
                )}
            </Button>
        </>
    );
}
