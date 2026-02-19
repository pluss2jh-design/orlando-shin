import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');

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
    // Allow anyone to GET plans (for pricing page)
    try {
      const data = await fs.readFile(PLANS_FILE, 'utf-8');
      return NextResponse.json(JSON.parse(data));
    } catch (fileError) {
      return NextResponse.json(defaultPlans);
    }
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

    const plans = await request.json();
    await fs.mkdir(path.dirname(PLANS_FILE), { recursive: true });
    await fs.writeFile(PLANS_FILE, JSON.stringify(plans, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save plans' }, { status: 500 });
  }
}
