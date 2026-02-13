import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/app/api/auth/[...nextauth]/route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
    });

    if (!inquiry) {
      return NextResponse.json(
        { error: '문의를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const isAdmin = session.user.email?.endsWith('@admin.com');
    const isOwner = inquiry.userId === session.user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json(
        { error: '내용을 입력해주세요' },
        { status: 400 }
      );
    }

    const response = await prisma.inquiryResponse.create({
      data: {
        inquiryId: id,
        content,
        isAdmin,
      },
    });

    if (isAdmin && inquiry.status === 'OPEN') {
      await prisma.inquiry.update({
        where: { id },
        data: { status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json({ response, success: true });
  } catch (error) {
    console.error('Response create error:', error);
    return NextResponse.json(
      { error: '답변 등록 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
