import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com'];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { membershipTier } = body;

    if (!membershipTier) {
      return NextResponse.json(
        { error: 'Membership tier is required' },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { membershipTier },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user plan:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
