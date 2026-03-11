/**
 * Next.js instrumentation hook
 * 서버 시작 시 자동으로 날짜별 파일 로거를 활성화합니다.
 * 생성 경로: /logs/YYYY-MM-DD.log
 */
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { setupLogger } = await import('@/lib/logger');
        setupLogger();
        console.log('=== Logger initialized ===');
    }
}
