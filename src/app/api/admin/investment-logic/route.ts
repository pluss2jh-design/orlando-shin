import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        try {
            const active = await prisma.learnedKnowledge.findFirst({
                where: { isActive: true },
                orderBy: { updatedAt: 'desc' }
            });
            if (active) {
                return NextResponse.json({ content: JSON.stringify(active.content, null, 2) });
            }
            return NextResponse.json({ content: '' });
        } catch (error) {
            return NextResponse.json({ content: '' });
        }
    } catch (error) {
        console.error('Get investment logic error:', error);
        return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const { content } = await request.json();

        // Validate JSON
        try {
            JSON.parse(content);
        } catch (error) {
            return NextResponse.json({ error: '유효하지 않은 JSON 형식입니다' }, { status: 400 });
        }

        await prisma.learnedKnowledge.create({
            data: {
                title: `Manual Update ${new Date().toLocaleString()}`,
                content: JSON.parse(content),
                isActive: true
            }
        });

        // 기존에 isActive true였던 것들이 있다면 false로 업데이트 (가장 최신 1개만 제외하고) 처리할 수도 있지만,
        // 여기선 새로 만들고 기존 것은 그대로 두는 등으로 처리, 
        // 혹은 모든 기존 레코드 비활성화 후 새로 생성.
        await prisma.learnedKnowledge.updateMany({
            where: { isActive: true, NOT: { title: `Manual Update ${new Date().toLocaleString()}` } }, // 대략적인 기존것 비활성화 로직
            data: { isActive: false }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Save investment logic error:', error);
        return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    }
}
