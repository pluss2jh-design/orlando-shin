import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (session?.user?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { plan } = body;

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan is required' },
        { status: 400 }
      );
    }

    const VALID_PLANS = ['FREE', 'STANDARD', 'PREMIUM', 'MASTER'] as const;
    type PlanType = typeof VALID_PLANS[number];
    const upperPlan = plan.toUpperCase();
    if (!VALID_PLANS.includes(upperPlan as PlanType)) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { plan: upperPlan as PlanType },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('사용자 플랜 업데이트 오류:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
