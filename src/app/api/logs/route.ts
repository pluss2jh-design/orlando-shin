import { NextRequest, NextResponse } from 'next/server';
import { logFrontend } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const text = await req.text();
        const body = JSON.parse(text);
        const { level, args } = body;

        if (!level || !args || !Array.isArray(args)) {
            return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
        }

        logFrontend(level, ...args);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Log API Error:', error);
        return NextResponse.json({ error: 'Failed to write frontend log' }, { status: 500 });
    }
}
