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
                        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
                        .map((m: any) => {
                            const rawId = m.name.replace('models/', '');
                            const name = rawId.toLowerCase();
                            const isGeminiModel = name.includes('gemini');
                            const hasGenerateContent = (m.supportedGenerationMethods || []).includes('generateContent');
                            
                            return {
                                value: rawId,
                                label: m.displayName || rawId,
                                reqKey: 'GEMINI_API_KEY',
                                provider: 'google',
                                supportsPDF: isGeminiModel && hasGenerateContent,
                                supportsVideo: isGeminiModel && hasGenerateContent && (name.includes('flash') || name.includes('pro')),
                                isRecommendedForLearning: name.includes('pro'),
                                isRecommendedForNews: name.includes('flash') && !name.includes('8b')
                            };
                        });
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
