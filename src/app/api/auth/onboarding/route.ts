import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const { nickname, email, provider, providerAccountId } = await request.json();

        if (!email || !nickname) {
            return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
        }

        // 기존 유저가 있는지 확인 (provider, providerAccountId, email)
        const existingUser = await prisma.user.findFirst({
            where: {
                email,
                provider: provider || 'credentials',
                providerAccountId: providerAccountId || ''
            },
            include: { accounts: true }
        });

        if (existingUser) {
            // 소셜 로그인으로 생성되었으나 정보가 부족했던 유저 업데이트
            const updatedUser = await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                    name: nickname,
                    // 기본 플랜 부여
                    plan: 'FREE'
                }
            });

            return NextResponse.json({ success: true, userId: updatedUser.id });
        } else {
            // 아직 유저가 생성되지 않은 경우
            const newUser = await prisma.user.create({
                data: {
                    name: nickname,
                    email,
                    provider: provider || 'credentials',
                    providerAccountId: providerAccountId || '',
                    role: 'USER',
                    plan: 'FREE'
                }
            });
            return NextResponse.json({ success: true, userId: newUser.id });
        }
    } catch (error) {
        console.error('Onboarding API error:', error);
        return NextResponse.json({ error: '온보딩 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
