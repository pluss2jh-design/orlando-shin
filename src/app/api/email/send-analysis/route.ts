import { NextRequest, NextResponse } from 'next/server';
import { sendAnalysisEmail } from '@/lib/email-service';
import { AnalysisResult } from '@/types/stock-analysis';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, results, conditions } = body;

    if (!email || !results || !Array.isArray(results)) {
      return NextResponse.json(
        { error: '이메일 주소와 분석 결과가 필요합니다' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '올바른 이메일 주소를 입력해주세요' },
        { status: 400 }
      );
    }

    await sendAnalysisEmail(email, results as AnalysisResult[], conditions || { periodMonths: 12 });

    return NextResponse.json({
      success: true,
      message: '분석 결과가 이메일로 발송되었습니다',
    });
  } catch (error) {
    console.error('Email send error:', error);
    const errorMessage = error instanceof Error ? error.message : '이메일 발송 중 오류가 발생했습니다';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
