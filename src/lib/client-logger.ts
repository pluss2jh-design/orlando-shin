/**
 * 클라이언트 측 로그를 서버로 전송하는 유틸리티
 */
export async function remoteLog(level: 'LOG' | 'INFO' | 'WARN' | 'ERROR', ...args: unknown[]) {
    try {
        // 개발 환경에서만 또는 특정 조건에서만 전송하도록 설정 가능
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, args }),
        });
    } catch (e) {
        // 전송 실패는 무시
    }
}

/** 
 * 브라우저 콘솔을 래핑하여 서버로 전송 (필요 시 호출)
 * 주의: 너무 많은 로그가 발생할 수 있음
 */
export function setupClientLogger() {
    if (typeof window === 'undefined') return;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    console.log = (...args: unknown[]) => {
        origLog(...args);
        remoteLog('LOG', ...args);
    };
    console.warn = (...args: unknown[]) => {
        origWarn(...args);
        remoteLog('WARN', ...args);
    };
    console.error = (...args: unknown[]) => {
        origError(...args);
        remoteLog('ERROR', ...args);
    };
}
