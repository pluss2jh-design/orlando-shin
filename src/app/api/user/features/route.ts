import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membershipTier: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const canSendEmail = ['PREMIUM', 'MASTER'].includes(user.membershipTier);

    return NextResponse.json({
      membershipTier: user.membershipTier,
      canSendEmail,
    });
  } catch (error) {
    console.error('Error checking user features:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
