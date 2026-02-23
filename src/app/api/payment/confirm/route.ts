import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { imp_uid, merchant_uid, expectedAmount, targetPlan } = body;

        // 1. 포트원 API 액세스 토큰 발급
        const tokenRes = await fetch('https://api.iamport.kr/users/getToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imp_key: process.env.PORTONE_API_KEY,
                imp_secret: process.env.PORTONE_API_SECRET
            })
        });

        const tokenData = await tokenRes.json();
        if (tokenData.code !== 0) {
            throw new Error('PortOne Token Error: ' + tokenData.message);
        }

        const { access_token } = tokenData.response;

        // 2. imp_uid로 포트원 서버에서 결제 상세 건 조회
        const paymentRes = await fetch(`https://api.iamport.kr/payments/${imp_uid}`, {
            method: 'GET',
            headers: { Authorization: access_token }
        });

        const paymentData = await paymentRes.json();
        if (paymentData.code !== 0) {
            throw new Error('Payment Fetch Error: ' + paymentData.message);
        }

        const paymentInfo = paymentData.response;

        // 3. 결제 금액 위변조 검증 (클라이언트에서 요청한 금액 == 실제 결제된 금액)
        if (paymentInfo.amount === expectedAmount && paymentInfo.status === 'paid') {
            // 결제 금액이 일치하고 결제가 완료된 경우 DB 업데이트

            // TODO: 실제 결제 기록 DB 테이블이 있다면 insert

            // 유저 등급 업데이트
            await prisma.user.update({
                where: { id: session.user.id },
                data: {
                    plan: targetPlan // 'PRO', 'ELITE' 등
                }
            });

            return NextResponse.json({ success: true, message: '결제 검증 및 플랜 업데이트 완료' });
        } else {
            // 결제 금액이 맞지 않거나 위변조 의심됨
            return NextResponse.json({ error: '결제 검증 실패: 금액 불일치 또는 미결제 상태' }, { status: 400 });
        }

    } catch (error: any) {
        console.error('Payment confirm error:', error);
        return NextResponse.json({ error: error.message || '결제 검증 중 서버 에러 발생' }, { status: 500 });
    }
}
