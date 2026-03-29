import { NextResponse } from 'next/server';
import { syncAllFiles, getDriveSyncStatus, getSyncInfo } from '@/lib/google-drive';

export const dynamic = 'force-dynamic';

/**
 * GET: 현재 동기화 상태 및 결과 조회
 */
export async function GET() {
  const status = getDriveSyncStatus();
  const syncInfo = await getSyncInfo(); // 캐시된 파일 정보 (있을 경우)
  
  return NextResponse.json({
    ...status,
    files: syncInfo?.files || [],
    totalCount: syncInfo?.totalCount || 0,
    syncedAt: syncInfo?.syncedAt || null
  });
}

/**
 * POST: 동기화 시작 (백그라운드)
 */
export async function POST() {
  try {
    // 1. 이미 동기화 중인지 확인
    const current = getDriveSyncStatus();
    if (current.isSyncing) {
      return NextResponse.json({ status: 'already_syncing', progress: current.progress });
    }

    // 2. 백그라운드에서 동기화 시작
    (async () => {
      try {
        await syncAllFiles();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    })();

    return NextResponse.json({ 
      status: 'started', 
      message: '파일 동기화가 백그라운드에서 시작되었습니다.' 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '동기화 시작 실패';
    console.error('Sync start error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE: 동기화 중지
 */
export async function DELETE() {
  const { stopDriveSync } = await import('@/lib/google-drive');
  stopDriveSync();
  return NextResponse.json({ status: 'cancelling', message: '동기화 중지 명령을 보냈습니다.' });
}
