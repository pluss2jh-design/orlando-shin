import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const userId = session.user.id;
    const isAdmin = session.user.email?.endsWith('@admin.com');

    const inquiries = await prisma.inquiry.findMany({
      where: isAdmin ? {} : { userId },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ inquiries });
  } catch (error) {
    console.error('Inquiry list error:', error);
    return NextResponse.json(
      { error: '문의 목록을 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: '제목과 내용을 입력해주세요' },
        { status: 400 }
      );
    }

    const inquiry = await prisma.inquiry.create({
      data: {
        userId: session.user.id,
        title,
        content,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ inquiry, success: true });
  } catch (error) {
    console.error('Inquiry create error:', error);
    return NextResponse.json(
      { error: '문의 등록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
