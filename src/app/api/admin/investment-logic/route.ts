import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com'];

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const knowledgePath = path.join(process.cwd(), 'uploads', 'knowledge', 'learned-knowledge.json');

        try {
            const content = await fs.readFile(knowledgePath, 'utf-8');
            return NextResponse.json({ content });
        } catch (error) {
            return NextResponse.json({ content: '' });
        }
    } catch (error) {
        console.error('Get investment logic error:', error);
        return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const { content } = await request.json();

        // Validate JSON
        try {
            JSON.parse(content);
        } catch (error) {
            return NextResponse.json({ error: '유효하지 않은 JSON 형식입니다' }, { status: 400 });
        }

        const knowledgePath = path.join(process.cwd(), 'uploads', 'knowledge', 'learned-knowledge.json');
        const knowledgeDir = path.dirname(knowledgePath);

        // Ensure directory exists
        await fs.mkdir(knowledgeDir, { recursive: true });

        // Save content
        await fs.writeFile(knowledgePath, content, 'utf-8');

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Save investment logic error:', error);
        return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    }
}
