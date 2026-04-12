import { NextRequest, NextResponse } from 'next/server';
import { logFrontend } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const text = await req.text();

        // 빈 body는 조용히 무시 (쓰로틀링 경쟁 조건으로 발생 가능)
        if (!text || text.trim().length === 0) {
            return NextResponse.json({ success: true });
        }

        const body = JSON.parse(text);

        // 배치 포맷 처리: { batch: [{ level, args, ts }] }
        if (body.batch && Array.isArray(body.batch)) {
            for (const entry of body.batch) {
                const { level, args } = entry;
                if (level && args && Array.isArray(args)) {
                    logFrontend(level, ...args);
                }
            }
            return NextResponse.json({ success: true, count: body.batch.length });
        }

        // 레거시 단건 포맷 처리: { level, args }
        const { level, args } = body;
        if (!level || !args || !Array.isArray(args)) {
            return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
        }

        logFrontend(level, ...args);
        return NextResponse.json({ success: true });
    } catch (error) {
        // 파싱 오류는 warn으로 낮춰서 콘솔 노이즈 최소화
        console.warn('Log API: Failed to parse request body');
        return NextResponse.json({ error: 'Failed to write frontend log' }, { status: 500 });
    }
}
