import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        // Get sync info
        const syncInfoPath = path.join(process.cwd(), 'uploads', 'gdrive', 'sync-info.json');
        const knowledgePath = path.join(process.cwd(), 'uploads', 'knowledge', 'learned-knowledge.json');

        let files: any[] = [];
        let learnedFileIds: Set<string> = new Set();

        try {
            const syncInfo = await fs.readFile(syncInfoPath, 'utf-8');
            const data = JSON.parse(syncInfo);
            files = data.files || [];
        } catch (error) {
            // No sync info yet
        }

        try {
            const knowledge = await fs.readFile(knowledgePath, 'utf-8');
            const data = JSON.parse(knowledge);
            if (data.fileAnalyses) {
                data.fileAnalyses.forEach((fa: any) => {
                    if (fa.fileId) learnedFileIds.add(fa.fileId);
                });
            }
        } catch (error) {
            // No knowledge yet
        }

        // Add learn status to files
        const filesWithStatus = files.map(file => ({
            ...file,
            learnStatus: learnedFileIds.has(file.id) ? 'completed' : 'pending',
        }));

        return NextResponse.json({ files: filesWithStatus });
    } catch (error) {
        console.error('Get files error:', error);
        return NextResponse.json({ error: '파일 목록 조회 실패' }, { status: 500 });
    }
}
