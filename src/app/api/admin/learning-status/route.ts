import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { learningStatus } from '@/lib/stock-analysis/ai-learning';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        return NextResponse.json({
            isLearning: learningStatus.isLearning,
            startTime: learningStatus.startTime
        });
    } catch (error) {
        return NextResponse.json({ error: '상태 조회 실패' }, { status: 500 });
    }
}
