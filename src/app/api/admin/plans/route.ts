import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];
const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');

export async function GET() {
    try {
        const session = await auth();
        // Allow anyone to GET plans (for pricing page)
        const data = await fs.readFile(PLANS_FILE, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const plans = await request.json();
        await fs.mkdir(path.dirname(PLANS_FILE), { recursive: true });
        await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save plans' }, { status: 500 });
    }
}
