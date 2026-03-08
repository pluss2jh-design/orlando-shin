import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        // 실제 운영 시에는 session.user.role === 'ADMIN' 등 권한 체크가 필요합니다.
        // 여기서는 마스터 권한 또는 특정 플랜으로 체크 가능
        if (!session?.user || (session.user as any).plan !== 'MASTER') {
            return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userName = searchParams.get('userName');
        const planId = searchParams.get('planId');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        const where: any = {};
        if (userName) {
            where.user = {
                name: { contains: userName, mode: 'insensitive' }
            };
        }
        if (planId) {
            where.planId = planId;
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const payments = await prisma.payment.findMany({
            where,
            include: {
                user: {
                    select: {
                        name: true,
                        email: true,
                    }
                }
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        return NextResponse.json(payments);
    } catch (error: any) {
        console.error('Fetch payments error:', error);
        return NextResponse.json({ error: '결제 내역을 불러오는데 실패했습니다.' }, { status: 500 });
    }
}
