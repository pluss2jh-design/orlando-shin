/**
 * 클라이언트 측 로그를 서버로 일괄 전송하는 유틸리티
 *
 * [필터링 전략]
 * - console.error / console.warn → 항상 전송
 * - console.log → API 호출, 파이프라인 이벤트 등 핵심 키워드 포함 시에만 전송
 * - 단순 UI 렌더링, 폴링, 상태 변경 로그는 전송하지 않음
 *
 * [최적화 전략]
 * - 500ms 내의 로그들을 큐에 쌓았다가 한 번의 API 호출로 묶어서 전송 (배치 처리)
 */

interface LogEntry {
    level: 'LOG' | 'INFO' | 'WARN' | 'ERROR';
    args: unknown[];
    ts: number;
}

let logQueue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 500;
const MAX_QUEUE_SIZE = 50;

// 이 키워드를 포함한 LOG 레벨 메시지만 서버로 전송
const LOG_FORWARD_KEYWORDS = [
  '[AI Learning]',
  '[robustJsonParse]',
  'Pipeline',
];

/**
 * console.log 메시지를 서버로 전송할지 판단합니다.
 * WARN/ERROR는 이 함수를 거치지 않고 항상 전송됩니다.
 */
function shouldForwardLog(args: unknown[]): boolean {
  const message = args.map(a => {
    try { return typeof a === 'string' ? a : JSON.stringify(a); }
    catch { return String(a); }
  }).join(' ');

  return LOG_FORWARD_KEYWORDS.some(kw => message.includes(kw));
}

function scheduleFlush() {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(flushLogs, FLUSH_INTERVAL_MS);
}

async function flushLogs() {
    flushTimer = null;
    if (logQueue.length === 0) return;

    const batch = logQueue.splice(0, logQueue.length);
    try {
        await fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch }),
            keepalive: true,
        });
    } catch {
        // 전송 실패는 무시
    }
}

export function remoteLog(level: 'LOG' | 'INFO' | 'WARN' | 'ERROR', ...args: unknown[]) {
    // LOG 레벨은 키워드 필터 통과 시에만 전송
    if (level === 'LOG' && !shouldForwardLog(args)) return;

    logQueue.push({ level, args, ts: Date.now() });

    if (logQueue.length >= MAX_QUEUE_SIZE) {
        if (flushTimer !== null) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        flushLogs();
    } else {
        scheduleFlush();
    }
}

/**
 * 브라우저 콘솔을 래핑하여 서버로 전송
 * - console.error / console.warn → 항상 전송
 * - console.log → 핵심 키워드 포함 시에만 전송
 */
export function setupClientLogger() {
    if (typeof window === 'undefined') return;

    const origLog = console.log.bind(console);
    const origWarn = console.warn.bind(console);
    const origError = console.error.bind(console);

    // LOG: 필터링 후 전송
    console.log = (...args: unknown[]) => {
        origLog(...args);
        remoteLog('LOG', ...args);
    };

    // WARN: 항상 전송
    console.warn = (...args: unknown[]) => {
        origWarn(...args);
        remoteLog('WARN', ...args);
    };

    // ERROR: 항상 전송
    console.error = (...args: unknown[]) => {
        origError(...args);
        remoteLog('ERROR', ...args);
    };

    // 페이지 언로드 시 남은 큐 즉시 전송
    window.addEventListener('beforeunload', flushLogs);

    // ── 전역 런타임 오류 캐치 ──
    // console.error를 우회하는 오류(React 렌더링 TypeError 등)를 직접 포착
    window.onerror = (message, source, lineno, colno, error) => {
      const errMsg = error
        ? `${error.name}: ${error.message}\nStack: ${error.stack}`
        : String(message);
      const location = source ? ` (${source}:${lineno}:${colno})` : '';
      // 직접 큐에 추가 후 즉시 전송 (페이지가 죽을 수 있으므로)
      logQueue.push({ level: 'ERROR', args: [`[RuntimeError]${location} ${errMsg}`], ts: Date.now() });
      flushLogs();
      return false; // 브라우저 기본 오류 처리 유지
    };

    // Promise 거부(unhandled rejection) 캐치
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const msg = reason instanceof Error
        ? `${reason.name}: ${reason.message}\nStack: ${reason.stack}`
        : String(reason);
      logQueue.push({ level: 'ERROR', args: [`[UnhandledPromise] ${msg}`], ts: Date.now() });
      flushLogs();
    });
}
