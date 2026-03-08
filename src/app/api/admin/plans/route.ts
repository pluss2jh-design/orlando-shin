import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';


export const defaultPlans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    weeklyAnalysisLimit: 3,
    canSendEmail: false,
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 10000,
    weeklyAnalysisLimit: 7,
    canSendEmail: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 29000,
    isPopular: true,
    weeklyAnalysisLimit: 10,
    canSendEmail: true,
  },
  {
    id: 'master',
    name: 'Master',
    price: 0,
    isAdmin: true,
    weeklyAnalysisLimit: -1,
    canSendEmail: true,
  },
];

export async function GET() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { price: 'asc' }
    });

    // Convert DB records back to frontend format if necessary
    // But our schema matches the expected shape

    return NextResponse.json(plans, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      }
    });
  } catch (error) {
    console.error('Fetch plans error:', error);
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const plans = await request.json();
    if (!Array.isArray(plans)) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    // Update each plan in transaction
    await prisma.$transaction(
      plans.map((p: any) =>
        prisma.membershipPlan.update({
          where: { id: p.id.toUpperCase() },
          data: {
            price: p.price,
            weeklyAnalysisLimit: p.weeklyAnalysisLimit,
            canSendEmail: p.canSendEmail,
            isPopular: p.isPopular || false,
          }
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save plans error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
