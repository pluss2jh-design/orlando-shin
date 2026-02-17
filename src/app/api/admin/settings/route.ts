import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        // Return masked API keys for security
        const keys = {
            GOOGLE_API_KEY: process.env.GOOGLE_API_KEY ? '••••••••' + process.env.GOOGLE_API_KEY.slice(-4) : '',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ? '••••••••' + process.env.OPENAI_API_KEY.slice(-4) : '',
            YAHOO_FINANCE_API_KEY: process.env.YAHOO_FINANCE_API_KEY || '',
        };

        return NextResponse.json({ keys });
    } catch (error) {
        console.error('Get settings error:', error);
        return NextResponse.json({ error: '조회 실패' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const { keys } = await request.json();

        // Update .env file
        const envPath = path.join(process.cwd(), '.env');
        let envContent = '';

        try {
            envContent = await fs.readFile(envPath, 'utf-8');
        } catch (error) {
            // .env doesn't exist, create new
        }

        // Update or add keys
        const lines = envContent.split('\n');
        const updatedKeys = new Set<string>();

        for (const [key, value] of Object.entries(keys)) {
            const valueStr = value as string;
            if (!valueStr || valueStr.startsWith('••••')) continue; // Skip masked values

            let found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith(`${key}=`)) {
                    lines[i] = `${key}=${valueStr}`;
                    found = true;
                    updatedKeys.add(key);
                    break;
                }
            }

            if (!found) {
                lines.push(`${key}=${valueStr}`);
                updatedKeys.add(key);
            }
        }

        await fs.writeFile(envPath, lines.join('\n'), 'utf-8');

        return NextResponse.json({
            success: true,
            message: 'API 키가 저장되었습니다. 변경사항을 적용하려면 서버를 재시작해주세요.'
        });
    } catch (error) {
        console.error('Save settings error:', error);
        return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    }
}
