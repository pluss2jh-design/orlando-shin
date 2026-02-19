import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const planLimits: Record<string, { weeklyAnalysisLimit: number; canSendEmail: boolean }> = {
  FREE: { weeklyAnalysisLimit: 1, canSendEmail: false },
  STANDARD: { weeklyAnalysisLimit: 7, canSendEmail: true },
  PREMIUM: { weeklyAnalysisLimit: 10, canSendEmail: true },
  MASTER: { weeklyAnalysisLimit: -1, canSendEmail: true },
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [user, adminUser] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, email: true }
      }),
      prisma.adminUser.findUnique({
        where: { email: session.user.email as string }
      })
    ]);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isMaster = !!adminUser || user.email === 'pluss2.jh@gmail.com';
    const effectivePlan = isMaster ? 'MASTER' : user.plan;
    const planConfig = planLimits[effectivePlan] || planLimits.FREE;
    const weekStart = getWeekStart(new Date());

    const analysisUsage = await prisma.$queryRaw`
      SELECT count FROM "AnalysisUsage" 
      WHERE "userId" = ${session.user.id} 
      AND "weekStart" = ${weekStart}
      LIMIT 1
    `;

    const currentCount = (analysisUsage as any[])?.[0]?.count || 0;

    const remainingAnalysis = planConfig.weeklyAnalysisLimit === -1
      ? -1
      : Math.max(0, planConfig.weeklyAnalysisLimit - currentCount);

    return NextResponse.json({
      plan: effectivePlan,
      weeklyAnalysisLimit: planConfig.weeklyAnalysisLimit,
      usedAnalysisThisWeek: currentCount,
      remainingAnalysis,
      canSendEmail: planConfig.canSendEmail,
      canAnalyze: planConfig.weeklyAnalysisLimit === -1 || remainingAnalysis > 0,
    });
  } catch (error) {
    console.error('Error checking user features:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
