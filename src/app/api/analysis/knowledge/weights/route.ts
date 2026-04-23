import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { weights } = await req.json();

    if (!weights) {
      return NextResponse.json({ error: 'Weights are required' }, { status: 400 });
    }

    // 1. 현재 활성화된 지식 찾기
    const activeKnowledge = await prisma.learnedKnowledge.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!activeKnowledge) {
      return NextResponse.json({ error: 'No active knowledge found' }, { status: 404 });
    }

    // 2. 가중치 업데이트
    const content = activeKnowledge.content as any;
    if (content && content.criteria && Array.isArray(content.criteria.criterias)) {
      content.criteria.criterias = content.criteria.criterias.map((c: any) => ({
        ...c,
        userWeight: weights[c.name] !== undefined ? weights[c.name] : (c.userWeight || c.weight)
      }));
    }

    // 3. DB 저장
    await prisma.learnedKnowledge.update({
      where: { id: activeKnowledge.id },
      data: { content: content }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error saving weights:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
