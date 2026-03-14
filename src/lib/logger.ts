import * as fs from 'fs';
import * as path from 'path';

const LOG_BASE_DIR = path.join(process.cwd(), 'logs');
const BACKEND_LOG_DIR = path.join(LOG_BASE_DIR, 'backend');
const FRONTEND_LOG_DIR = path.join(LOG_BASE_DIR, 'frontend');

/** 기존 로그 파일 삭제 및 폴더 초기화 */
export function clearOldLogs() {
    try {
        if (fs.existsSync(LOG_BASE_DIR)) {
            const files = fs.readdirSync(LOG_BASE_DIR);
            for (const file of files) {
                const fullPath = path.join(LOG_BASE_DIR, file);
                // backend, frontend 폴더는 남겨두고 하위 파일들만 정리하거나, 통째로 삭제 후 재구성
                if (fs.lstatSync(fullPath).isDirectory()) {
                    if (file !== 'backend' && file !== 'frontend') {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    }
                } else {
                    fs.unlinkSync(fullPath);
                }
            }
        }
    } catch (e) {
        console.error('Failed to clear old logs:', e);
    }
}

function getLogFilePath(type: 'backend' | 'frontend'): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC+9
    const dateStr = kst.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const targetDir = type === 'backend' ? BACKEND_LOG_DIR : FRONTEND_LOG_DIR;
    
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    return path.join(targetDir, `${dateStr}.log`);
}

function formatTimestamp(): string {
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().replace('T', ' ').slice(0, 23);
}

function writeLog(type: 'backend' | 'frontend', level: string, args: unknown[]) {
    try {
        const message = args
            .map(a => (typeof a === 'string' ? a : JSON.stringify(a, null, 0)))
            .join(' ');
        const line = `[${formatTimestamp()}] [${level.padEnd(5)}] ${message}\n`;
        fs.appendFileSync(getLogFilePath(type), line, 'utf8');
    } catch {
        // 로그 쓰기 실패는 무시
    }
}

/** 프론트엔드 로그 저장용 API 등에서 호출 */
export function logFrontend(level: string, ...args: unknown[]) {
    writeLog('frontend', level, args);
}

/** Node 환경(서버 사이드)에서만 콘솔을 파일 로그로 래핑합니다. (Backend) */
export function setupLogger() {
    if (typeof window !== 'undefined') return;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);
    const origInfo = console.info.bind(console);
    const origDebug = console.debug.bind(console);

    console.log = (...args: unknown[]) => {
        origLog(...args);
        writeLog('backend', 'LOG', args);
    };
    console.info = (...args: unknown[]) => {
        origInfo(...args);
        writeLog('backend', 'INFO', args);
    };
    console.warn = (...args: unknown[]) => {
        origWarn(...args);
        writeLog('backend', 'WARN', args);
    };
    console.error = (...args: unknown[]) => {
        origError(...args);
        writeLog('backend', 'ERROR', args);
    };
    console.debug = (...args: unknown[]) => {
        origDebug(...args);
        writeLog('backend', 'DEBUG', args);
    };
}

