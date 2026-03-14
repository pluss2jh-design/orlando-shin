import { NextRequest, NextResponse } from 'next/server';
import { logFrontend } from '@/lib/logger';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { level, args } = body;

        if (!level || !args || !Array.isArray(args)) {
            return NextResponse.json({ error: 'Invalid log format' }, { status: 400 });
        }

        logFrontend(level, ...args);
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to write frontend log' }, { status: 500 });
    }
}
