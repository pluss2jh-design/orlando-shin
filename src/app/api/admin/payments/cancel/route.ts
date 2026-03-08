import { NextRequest, NextResponse } from 'next/server';
import { cancelPaymentV2 } from '@/lib/portone';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        // 관리자 또는 마스터 권한 체크
        if (!session?.user || (session.user as any).plan !== 'MASTER') {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const { paymentId, reason } = await req.json();

        if (!paymentId) {
            return NextResponse.json({ error: '결제 ID가 누락되었습니다.' }, { status: 400 });
        }

        // 1. 포트원 서버에 취소 요청
        const cancelResult = await cancelPaymentV2(paymentId, reason || '관리자 취소');

        // 2. DB 업데이트 (결제 내역 상태 변경 및 사용자 플랜 초기화)
        // 먼저 결제 테이블에서 사용자 ID를 찾습니다.
        const paymentRecord = await prisma.payment.findUnique({
            where: { paymentId: paymentId },
        });

        if (paymentRecord) {
            await prisma.$transaction([
                prisma.payment.update({
                    where: { paymentId: paymentId },
                    data: {
                        status: 'CANCELLED',
                        cancelReason: reason || '관리자 취소'
                    },
                }),
                // 유저의 현재 플랜이 환불하려는 플랜과 같다면 FREE로 강등
                prisma.user.update({
                    where: { id: paymentRecord.userId },
                    data: { plan: 'FREE' },
                })
            ]);
        }

        return NextResponse.json({
            success: true,
            message: '결제가 성공적으로 취소되었습니다.',
        });

    } catch (error: any) {
        console.error('Cancel payment error:', error);
        return NextResponse.json({ error: error.message || '취소 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
