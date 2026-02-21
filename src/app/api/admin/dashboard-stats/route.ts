import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getSyncInfo } from '@/lib/google-drive';
import { prisma } from '@/lib/db';

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        // Check Google Drive sync info
        let gdriveConnected = false;
        let totalFiles = 0;
        let lastSyncTime = null;

        try {
            const syncInfo = await getSyncInfo();
            if (syncInfo) {
                gdriveConnected = true;
                totalFiles = syncInfo.files?.length || 0;
                lastSyncTime = syncInfo.syncedAt || null;
            }
        } catch (error) {
            // Sync info doesn't exist yet
        }

        // Check learned knowledge
        let learnedFiles = 0;

        try {
            const active = await prisma.learnedKnowledge.findFirst({
                where: { isActive: true },
                orderBy: { updatedAt: 'desc' }
            });
            if (active && active.content) {
                const data: any = active.content;
                learnedFiles = data.fileAnalyses?.length || 0;
            }
        } catch (error) {
            // Knowledge doesn't exist yet
        }

        // AI model status (check if GOOGLE_API_KEY exists)
        const aiModelStatus = process.env.GOOGLE_API_KEY ? 'active' : 'idle';

        return NextResponse.json({
            gdriveConnected,
            totalFiles,
            learnedFiles,
            aiModelStatus,
            lastSyncTime,
        });
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 });
    }
}
