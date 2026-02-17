import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { runAnalysisEngine } from '@/lib/stock-analysis/analysis-engine';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';
import type {
  InvestmentConditions,
  InvestmentStyle,
} from '@/types/stock-analysis';

interface AnalysisRequestBody {
  conditions?: { periodMonths?: number; companyCount?: number; companyAiModel?: string; companyApiKey?: string; newsAiModel?: string; newsApiKey?: string };
  style?: InvestmentStyle;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const planLimits: Record<string, { weeklyAnalysisLimit: number }> = {
  FREE: { weeklyAnalysisLimit: 3 },
  STANDARD: { weeklyAnalysisLimit: 7 },
  PREMIUM: { weeklyAnalysisLimit: 10 },
  MASTER: { weeklyAnalysisLimit: -1 },
};

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { membershipTier: true }
    });

    if (!user) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const planConfig = planLimits[user.membershipTier] || planLimits.FREE;

    if (planConfig.weeklyAnalysisLimit !== -1) {
      const weekStart = getWeekStart(new Date());
      
      const analysisUsage = await prisma.$queryRaw`
        SELECT count FROM "AnalysisUsage" 
        WHERE "userId" = ${session.user.id} 
        AND "weekStart" = ${weekStart}
        LIMIT 1
      `;

      const currentCount = (analysisUsage as any[])?.[0]?.count || 0;

      if (currentCount >= planConfig.weeklyAnalysisLimit) {
        return NextResponse.json(
          { 
            error: '이번 주 분석 횟수를 모두 사용했습니다.',
            weeklyLimit: planConfig.weeklyAnalysisLimit,
            usedCount: currentCount,
            remainingCount: 0,
          },
          { status: 403 }
        );
      }
    }

    const body = (await request.json()) as AnalysisRequestBody;

    const knowledge = await getLearnedKnowledge();
    if (!knowledge) {
      return NextResponse.json(
        { error: '학습된 데이터가 없습니다. 먼저 Google Drive 동기화 후 학습을 시작해주세요.' },
        { status: 400 }
      );
    }

    const result = await runAnalysisEngine(
      { amount: 0, periodMonths: body.conditions?.periodMonths || 12 },
      knowledge,
      body.style ?? 'moderate',
      body.conditions?.companyCount || 5,
      body.conditions?.companyAiModel,
      body.conditions?.companyApiKey,
      body.conditions?.newsAiModel,
      body.conditions?.newsApiKey
    );

    if (planConfig.weeklyAnalysisLimit !== -1) {
      const weekStart = getWeekStart(new Date());
      await prisma.$executeRaw`
        INSERT INTO "AnalysisUsage" (id, "userId", "weekStart", count, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), ${session.user.id}, ${weekStart}, 1, NOW(), NOW())
        ON CONFLICT ("userId", "weekStart")
        DO UPDATE SET count = "AnalysisUsage".count + 1, "updatedAt" = NOW()
      `;
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
    console.error('Analysis API error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
