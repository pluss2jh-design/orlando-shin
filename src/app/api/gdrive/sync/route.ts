import { NextResponse } from 'next/server';
import { syncAllFiles } from '@/lib/google-drive';

export async function POST() {
  try {
    const result = await syncAllFiles();

    return NextResponse.json({
      status: 'synced',
      files: result.files.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        modifiedTime: f.modifiedTime,
        durationMillis: f.durationMillis,
      })),
      totalCount: result.totalCount,
      syncedAt: result.syncedAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '동기화 실패';
    console.error('Google Drive sync error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
