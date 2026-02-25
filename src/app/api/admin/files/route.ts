import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSyncInfo, getDriveSyncStatus } from '@/lib/google-drive';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        let files: any[] = [];
        let learnedFileIds: Set<string> = new Set();

        try {
            const syncInfo = await getSyncInfo();
            if (syncInfo) {
                files = syncInfo.files || [];
            }
        } catch (error) {
            // No sync info yet
        }

        try {
            const active = await prisma.learnedKnowledge.findFirst({
                where: { isActive: true },
                orderBy: { updatedAt: 'desc' }
            });
            if (active && active.content) {
                const data: any = active.content;
                if (data.fileAnalyses) {
                    data.fileAnalyses.forEach((fa: any) => {
                        if (fa.fileId) learnedFileIds.add(fa.fileId);
                    });
                }
            }
        } catch (error) {
            // No knowledge yet
        }

        // Add learn status to files
        const filesWithStatus = files.map(file => ({
            ...file,
            learnStatus: learnedFileIds.has(file.id) ? 'completed' : 'pending',
        }));

        return NextResponse.json({
            files: filesWithStatus,
            isSyncing: getDriveSyncStatus()
        });
    } catch (error) {
        console.error('Get files error:', error);
        return NextResponse.json({ error: '파일 목록 조회 실패' }, { status: 500 });
    }
}
