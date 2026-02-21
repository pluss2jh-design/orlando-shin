import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
        }

        const { planId, paymentId } = await request.json();

        if (!planId) {
            return NextResponse.json({ error: '플랜 정보가 필요합니다.' }, { status: 400 });
        }

        // 실제 환경에서는 여기서 paymentId를 이용해 PG사 API로 결제 검증을 수행해야 합니다.
        console.log(`Payment confirmed for user ${session.user.id}, Plan: ${planId}, PaymentID: ${paymentId}`);

        // DB 유저 플랜 업데이트 (Plan enum 값에 맞춰 대문자로 저장)
        const updatedUser = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                plan: planId.toUpperCase() as any
            }
        });

        return NextResponse.json({
            success: true,
            plan: updatedUser.plan,
            message: `${planId} 플랜으로 성공적으로 변경되었습니다.`
        });
    } catch (error) {
        console.error('Payment confirmation error:', error);
        return NextResponse.json({ error: '결제 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
