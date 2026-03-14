/**
 * Next.js instrumentation hook
 * 서버 시작 시 자동으로 날짜별 파일 로거를 활성화합니다.
 * 생성 경로: /logs/backend/YYYY-MM-DD.log, /logs/frontend/YYYY-MM-DD.log
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { setupLogger, clearOldLogs } = await import('@/lib/logger');
        clearOldLogs(); // 기존 로그 파일들 초기화
        setupLogger();
        console.log('=== Logger initialized (Backend/Frontend split) ===');
    }
}

