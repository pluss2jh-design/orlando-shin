import { NextRequest, NextResponse } from 'next/server';
import { getPaymentDataV2 } from '@/lib/portone';
import { prisma } from '@/lib/db';

/**
 * PortOne V2 Webhook 수신 엔드포인트
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        console.log('PortOne Webhook Received:', JSON.stringify(body, null, 2));

        // 1. 웹훅 타입 확인 (V2 기준)
        // 참고: V2 타입은 Transaction.Paid, Payment.Finished 등 종류가 다를 수 있음
        if (body.type !== 'Transaction.Paid' && body.type !== 'Payment.Finished') {
            return NextResponse.json({ received: true }, { status: 200 });
        }

        const { paymentId } = body.data;
        if (!paymentId) {
            return NextResponse.json({ error: 'paymentId missing' }, { status: 400 });
        }

        // 2. 보안을 위해 포트원 서버에서 해당 결제건을 재조회하여 검증 (웹훅 위조 방지)
        const paymentData = await getPaymentDataV2(paymentId);

        // 3. 결제 완료 상태인지 최종 확인
        if (paymentData.status !== 'PAID') {
            console.log(`Payment ${paymentId} is not PAID (status: ${paymentData.status})`);
            return NextResponse.json({ received: true }, { status: 200 });
        }

        // 4. customData(또는 metadata) 파싱하여 유저 ID 및 플랜 정보 추출
        // V2에서는 customData가 JSON 객체 형태로 들어올 수 있음
        let customData = paymentData.customData || {};
        if (typeof customData === 'string') {
            try {
                customData = JSON.parse(customData);
            } catch (e) {
                console.error('customData parsing failed', e);
            }
        }

        const { userId, planId } = customData;

        if (!userId || !planId) {
            console.warn(`UserId or PlanId missing in customData for payment ${paymentId}`);
            return NextResponse.json({ error: 'Metadata missing' }, { status: 400 });
        }

        // 5. DB 업데이트 (사용자 플랜 업그레이드 + 결제 내역 기록)
        const upperPlanId = planId.toUpperCase() as any;

        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { plan: upperPlanId },
            }),
            prisma.payment.upsert({
                where: { paymentId: paymentId },
                update: {
                    status: paymentData.status,
                    amount: paymentData.amount?.total,
                },
                create: {
                    userId: userId,
                    paymentId: paymentId,
                    merchantUid: paymentData.merchant_uid,
                    amount: paymentData.amount?.total,
                    planId: upperPlanId,
                    status: paymentData.status,
                    pgProvider: paymentData.pgProvider,
                    payMethod: paymentData.payMethod,
                    paidAt: paymentData.paidAt ? new Date(paymentData.paidAt) : new Date(),
                }
            })
        ]);
        console.log(`User ${userId} upgraded to ${upperPlanId} via Webhook.`);

        return NextResponse.json({ success: true, received: true }, { status: 200 });

    } catch (error: any) {
        console.error('PortOne Webhook API 오류:', error);
        return NextResponse.json({ error: error.message || 'Webhook internal error' }, { status: 500 });
    }
}
