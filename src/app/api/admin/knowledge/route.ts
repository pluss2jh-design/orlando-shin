import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const session = await auth();
        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const knowledgeList = await prisma.learnedKnowledge.findMany({
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json({ knowledgeList });
    } catch (error) {
        console.error('Fetch knowledge error:', error);
        return NextResponse.json({ error: '지식 목록 조회 실패' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const session = await auth();
        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const body = await request.json();
        const { id, isActive } = body;

        if (isActive) {
            // 다른 모든 항목 비활성화
            await prisma.learnedKnowledge.updateMany({
                where: { id: { not: id } },
                data: { isActive: false }
            });
        }

        const updated = await prisma.learnedKnowledge.update({
            where: { id },
            data: { isActive }
        });

        return NextResponse.json({ success: true, knowledge: updated });
    } catch (error) {
        console.error('Update knowledge error:', error);
        return NextResponse.json({ error: '지식 상태 변경 실패' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await auth();
        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'ID가 필요합니다' }, { status: 400 });
        }

        await prisma.learnedKnowledge.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete knowledge error:', error);
        return NextResponse.json({ error: '지식 삭제 실패' }, { status: 500 });
    }
}
