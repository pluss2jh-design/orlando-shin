import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { synthesizeCustomKnowledge } from '@/lib/stock-analysis/ai-learning';

export async function POST(req: Request) {
  try {
    const { weights, knowledgeId, aiModel, fallbackAiModel } = await req.json();

    if (!weights || !knowledgeId) {
      return NextResponse.json({ error: 'Weights and knowledgeId are required' }, { status: 400 });
    }

    // 1. 현재 지식 데이터 가져오기
    const learnedKnowledge = await prisma.learnedKnowledge.findUnique({
      where: { id: knowledgeId }
    });

    if (!learnedKnowledge) {
      return NextResponse.json({ error: 'Learned knowledge not found' }, { status: 404 });
    }

    // 2. AI를 통한 맞춤형 지식 합성 실행 (ai-learning.ts의 전용함수 호출)
    const currentContent = learnedKnowledge.content as any;
    const synthesizedKnowledge = await synthesizeCustomKnowledge(weights, currentContent, aiModel, fallbackAiModel);

    // 3. DB 업데이트 (합성된 최신 지식으로 갱신 및 가중치 영구 저장)
    const updated = await prisma.learnedKnowledge.update({
      where: { id: knowledgeId },
      data: { 
        content: synthesizedKnowledge as any,
        isActive: true // 실제 분석에 사용될 최종 활성 지식으로 설정
      }
    });

    return NextResponse.json({ success: true, knowledge: synthesizedKnowledge });
  } catch (error: any) {
    console.error('Error in custom synthesis API:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
