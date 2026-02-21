import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';


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
    const session = await auth();
    // Return hardcoded default plans
    return NextResponse.json(defaultPlans);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch plans' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if ((session?.user as any)?.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Since we removed local file storage, just return success
    // In actual production this could write to a real database table
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
