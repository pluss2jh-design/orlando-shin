import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        // Check Google Drive sync info
        const syncInfoPath = path.join(process.cwd(), 'uploads', 'sync-info.json');
        let gdriveConnected = false;
        let totalFiles = 0;
        let lastSyncTime = null;

        try {
            const syncInfo = await fs.readFile(syncInfoPath, 'utf-8');
            const data = JSON.parse(syncInfo);
            gdriveConnected = true;
            totalFiles = data.files?.length || 0;
            lastSyncTime = data.lastSync || null;
        } catch (error) {
            // Sync info doesn't exist yet
        }

        // Check learned knowledge
        const knowledgePath = path.join(process.cwd(), 'uploads', 'knowledge', 'learned-knowledge.json');
        let learnedFiles = 0;

        try {
            const knowledge = await fs.readFile(knowledgePath, 'utf-8');
            const data = JSON.parse(knowledge);
            learnedFiles = data.fileAnalyses?.length || 0;
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
