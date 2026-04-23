import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';

// Claude 모델 목록 (수동 유지)
const CLAUDE_MODELS = [
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', provider: 'anthropic' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku', provider: 'anthropic' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', provider: 'anthropic' },
];

export async function GET() {
    try {
        const session = await auth();
        // 인증 체크 (로그인한 모든 사용자가 모델 목록을 볼 수 있도록 허용 - 일반 사용자도 모델 선택 필요하므로)
        if (!session?.user?.id) {
            return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
        }

        const models: any[] = [];

        // 1. OpenAI Models
        if (process.env.OPENAI_API_KEY) {
            try {
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const list = await openai.models.list();
                models.push(...list.data
                    .filter(m => m.id.startsWith('gpt-'))
                    .map(m => ({ 
                        value: m.id, 
                        label: m.id, 
                        reqKey: 'OPENAI_API_KEY', 
                        provider: 'openai',
                        supportsPDF: m.id.includes('4o'), // gpt-4o 계열만 PDF 지원 간주
                        supportsVideo: false,
                        isRecommendedForLearning: m.id.includes('4o') && !m.id.includes('mini'),
                        isRecommendedForNews: m.id.includes('mini')
                    })));
            } catch (err) {
                console.error('OpenAI 모델 목록 조회 오류:', err);
            }
        }

        // 2. Gemini Models - REST API 사용 및 역량 분석
        if (process.env.GEMINI_API_KEY) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
                const data = await response.json();
                if (data.models) {
                    const geminiModels = data.models
                        .filter((m: any) => {
                            const rawId = m.name.replace('models/', '');
                            const name = rawId.toLowerCase();
                            const hasGenerateContent = (m.supportedGenerationMethods || []).includes('generateContent');
                            
                            // 1. 기본적인 생성 능력이 없는 모델은 제외
                            if (!hasGenerateContent) return false;

                            // 2. 실험용, 프리뷰 등 모든 모델 공개 (사용자 계정 특수성 반영)
                            return true;
                        })
                        .map((m: any) => {
                            const rawId = m.name.replace('models/', '');
                            const name = rawId.toLowerCase();
                            
                            // 라벨 가공
                            let label = rawId.toUpperCase();
                            let priority = 100;

                            if (name.includes('1.5-flash-8b')) {
                                label = 'Gemini 1.5 Flash 8B (Ultra-Lightweight)';
                                priority = 3;
                            } else if (name.includes('1.5-flash')) {
                                label = 'Gemini 1.5 Flash (Recommended - Fastest)';
                                priority = 1; // 최상단
                            } else if (name.includes('1.5-pro')) {
                                label = 'Gemini 1.5 Pro (Recommended - Highly Intelligent)';
                                priority = 2;
                            } else if (name.includes('1.0-pro')) {
                                label = 'Gemini 1.0 Pro (Standard)';
                                priority = 4;
                            }

                            return {
                                value: rawId,
                                label: label,
                                priority: priority, 
                                reqKey: 'GEMINI_API_KEY',
                                provider: 'google',
                                supportsPDF: true,
                                supportsVideo: name.includes('flash') || name.includes('pro') || name.includes('3') || name.includes('2'),
                                isRecommendedForLearning: name.includes('pro'),
                                isRecommendedForNews: name.includes('flash')
                            };
                        })
                        .sort((a: any, b: any) => (a.priority || 100) - (b.priority || 100)); // 우선순위 정렬

                    models.push(...geminiModels);
                }
            } catch (err) {
                console.error('Gemini 모델 목록 조회 오류:', err);
            }
        }

        // 3. Claude Models
        if (process.env.CLAUDE_API_KEY) {
            models.push(...CLAUDE_MODELS.map(m => ({ 
                ...m, 
                reqKey: 'CLAUDE_API_KEY',
                supportsPDF: true, // Claude 3 계열 대부분 PDF 지원
                supportsVideo: false 
            })));
        }

        return NextResponse.json({ models });
    } catch (error) {
        console.error('API Models fetch error:', error);
        return NextResponse.json({ error: '모델 조회 실패' }, { status: 500 });
    }
}
