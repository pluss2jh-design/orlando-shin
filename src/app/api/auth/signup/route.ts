import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { name, email, password, plan } = await request.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        const existingUser = await prisma.user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: '이미 존재하는 이메일입니다.' }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                plan: plan || 'free',
                membershipTier: plan === 'premium' ? 'PRO' : 'FREE', // For legacy compatibility
            }
        });

        return NextResponse.json({ success: true, userId: user.id });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json({ error: '회원가입 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
