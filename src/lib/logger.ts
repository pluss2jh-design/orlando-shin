import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

function getLogFilePath(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    const dateStr = kst.toISOString().slice(0, 10); // "YYYY-MM-DD"
    return path.join(LOG_DIR, `${dateStr}.log`);
}

function formatTimestamp(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace('T', ' ').slice(0, 23);
}

function writeLog(level: string, args: unknown[]) {
    try {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
        const message = args
            .map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 0)))
            .join(' ');
        const line = `[${formatTimestamp()}] [${level.padEnd(5)}] ${message}\n`;
        fs.appendFileSync(getLogFilePath(), line, 'utf8');
    } catch {
        // 로그 쓰기 실패는 무시 (무한 루프 방지)
    }
}

/** Node 환경(서버 사이드)에서만 콘솔을 파일 로그로 래핑합니다. */
export function setupLogger() {
    if (typeof window !== 'undefined') return; // 브라우저 환경이면 스킵

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);
    const origInfo = console.info.bind(console);
    const origDebug = console.debug.bind(console);

    console.log = (...args: unknown[]) => {
        origLog(...args);
        writeLog('LOG', args);
    };
    console.info = (...args: unknown[]) => {
        origInfo(...args);
        writeLog('INFO', args);
    };
    console.warn = (...args: unknown[]) => {
        origWarn(...args);
        writeLog('WARN', args);
    };
    console.error = (...args: unknown[]) => {
        origError(...args);
        writeLog('ERROR', args);
    };
    console.debug = (...args: unknown[]) => {
        origDebug(...args);
        writeLog('DEBUG', args);
    };
}
