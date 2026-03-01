import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

export async function GET(
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
      include: {
        responses: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!inquiry) {
      return NextResponse.json(
        { error: '문의를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const isAdmin = session.user.email?.endsWith('@admin.com');
    if (inquiry.userId !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    return NextResponse.json({ inquiry });
  } catch (error) {
    console.error('문의 상세 조회 오류:', error);
    return NextResponse.json(
      { error: '문의 상세를 불러오는 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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

    if (inquiry.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, content, status } = body;

    const updatedInquiry = await prisma.inquiry.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(content && { content }),
        ...(status && { status }),
      },
    });

    return NextResponse.json({ inquiry: updatedInquiry, success: true });
  } catch (error) {
    console.error('문의 수정 오류:', error);
    return NextResponse.json(
      { error: '문의 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (inquiry.userId !== session.user.id) {
      return NextResponse.json(
        { error: '접근 권한이 없습니다' },
        { status: 403 }
      );
    }

    await prisma.inquiry.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('문의 삭제 오류:', error);
    return NextResponse.json(
      { error: '문의 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
