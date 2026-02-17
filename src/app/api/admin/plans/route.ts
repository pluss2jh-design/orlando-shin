import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const ADMIN_EMAILS = ['pluss2.jh@gmail.com', 'pluss2@kakao.com'];
const PLANS_FILE = path.join(process.cwd(), 'uploads', 'config', 'plans.json');

const defaultPlans = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      { id: 'analysis', name: '기업 분석', enabled: false },
      { id: 'news', name: '뉴스 조회', enabled: false },
      { id: 'email', name: '분석 자료 이메일 전송 기능', enabled: false },
      { id: 'support', name: '고객 지원', enabled: false },
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: 10000,
    features: [
      { id: 'analysis', name: '기업 분석', enabled: true },
      { id: 'news', name: '뉴스 조회', enabled: false },
      { id: 'email', name: '분석 자료 이메일 전송 기능', enabled: false },
      { id: 'support', name: '고객 지원', enabled: true },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 29000,
    isPopular: true,
    features: [
      { id: 'analysis', name: '기업 분석', enabled: true },
      { id: 'news', name: '뉴스 조회', enabled: true },
      { id: 'email', name: '분석 자료 이메일 전송 기능', enabled: true },
      { id: 'support', name: '고객 지원', enabled: true },
    ],
  },
  {
    id: 'master',
    name: 'Master',
    price: 0,
    isAdmin: true,
    features: [
      { id: 'analysis', name: '기업 분석', enabled: true },
      { id: 'news', name: '뉴스 조회', enabled: true },
      { id: 'email', name: '분석 자료 이메일 전송 기능', enabled: true },
      { id: 'support', name: '고객 지원', enabled: true },
    ],
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
        if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
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
