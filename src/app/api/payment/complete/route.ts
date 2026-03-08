import { NextRequest, NextResponse } from 'next/server';
import { getPaymentDataV2, verifyPaymentAmount } from '@/lib/portone';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
        }

        const { paymentId, planId, amount } = await req.json();

        if (!paymentId) {
            return NextResponse.json({ error: '결제 ID(paymentId)가 누락되었습니다.' }, { status: 400 });
        }

        // 1. 포트원 서버에서 결제 데이터 조회 (V2)
        const paymentData = await getPaymentDataV2(paymentId);

        // 2. 결제 상태 확인 (PAID 인지 확인)
        if (paymentData.status !== 'PAID') {
            return NextResponse.json({
                success: false,
                error: `결제가 완료되지 않았습니다. (상태: ${paymentData.status})`
            }, { status: 400 });
        }

        // 3. 금액 위변조 검증
        const isAmountValid = verifyPaymentAmount(paymentData, amount);
        if (!isAmountValid) {
            console.error(`금액 위변조 의심: 요청금액 ${amount}, 실제결제금액 ${paymentData.amount?.total}`);
            return NextResponse.json({ success: false, error: '결제 금액 정보가 일치하지 않습니다.' }, { status: 400 });
        }

        // 4. DB 업데이트 (사용자 플랜 업그레이드 + 결제 내역 기록)
        // Prisma Enum (FREE, STANDARD, PREMIUM, MASTER)은 대문자이므로 변환 후 저장합니다.
        const upperPlanId = planId.toUpperCase() as any;

        await prisma.$transaction([
            prisma.user.update({
                where: { id: session.user.id },
                data: {
                    plan: upperPlanId,
                },
            }),
            prisma.payment.upsert({
                where: { paymentId: paymentId },
                update: {
                    status: paymentData.status,
                    amount: paymentData.amount?.total ?? amount,
                },
                create: {
                    userId: session.user.id,
                    paymentId: paymentId,
                    merchantUid: paymentData.merchant_uid,
                    amount: paymentData.amount?.total ?? amount,
                    planId: upperPlanId,
                    status: paymentData.status,
                    pgProvider: paymentData.pgProvider,
                    payMethod: paymentData.payMethod,
                    paidAt: paymentData.paidAt ? new Date(paymentData.paidAt) : new Date(),
                }
            })
        ]);

        return NextResponse.json({
            success: true,
            message: '결제 및 플랜 업그레이드가 완료되었습니다.',
        });

    } catch (error: any) {
        console.error('Payment complete API error:', error);
        return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
