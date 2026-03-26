import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { cancelLearningPipeline } from '@/lib/stock-analysis/ai-learning';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    // 학습은 보통 관리자 권한이 필요할 수 있지만, 현재는 유저 세션 확인만 수행
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    cancelLearningPipeline();
    return NextResponse.json({ success: true, message: '학습 중단 요청이 접수되었습니다.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '중단 처리 중 오류가 발생했습니다.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
