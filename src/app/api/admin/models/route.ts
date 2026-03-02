import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';

// Claude doesn't have a public List Models endpoint in its SDK directly returning all models
// We hardcode the latest ones if the key exists.
const CLAUDE_MODELS = [
    { value: 'claude-opus-4-5', label: 'Claude Opus 4.5 (최신)' },
    { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5 (최신)' },
    { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet' },
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
];

export async function GET() {
    try {
        const session = await auth();

        if (session?.user?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const models = [];

        // 1. OpenAI Models - API로 실시간 조회, 최신 모델 fallback 포함
        const OPENAI_FALLBACK = [
            { value: 'gpt-4o', label: 'GPT-4o (최신)', reqKey: 'OPENAI_API_KEY' },
            { value: 'gpt-4o-mini', label: 'GPT-4o Mini', reqKey: 'OPENAI_API_KEY' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', reqKey: 'OPENAI_API_KEY' },
        ];
        if (process.env.OPENAI_API_KEY) {
            try {
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const list = await openai.models.list();
                const gptModels = list.data
                    .filter(m => m.id.startsWith('gpt-'))
                    .map(m => ({ value: m.id, label: m.id, reqKey: 'OPENAI_API_KEY' }));
                gptModels.sort((a, b) => b.value.localeCompare(a.value));
                const apiValues = new Set(gptModels.map(m => m.value));
                const missing = OPENAI_FALLBACK.filter(f => !apiValues.has(f.value));
                models.push(...missing, ...gptModels);
            } catch (err) {
                console.error('OpenAI 모델 목록 조회 오류:', err);
                models.push(...OPENAI_FALLBACK);
            }
        }

        // 2. Gemini Models - API로 실시간 조회, 최신 모델 보장
        const GEMINI_FALLBACK = [
            { value: 'gemini-2.5-pro-preview-06-05', label: 'Gemini 2.5 Pro Preview (최신)', reqKey: 'GEMINI_API_KEY' },
            { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', reqKey: 'GEMINI_API_KEY' },
            { value: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro Exp', reqKey: 'GEMINI_API_KEY' },
            { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', reqKey: 'GEMINI_API_KEY' },
            { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', reqKey: 'GEMINI_API_KEY' },
        ];
        if (process.env.GEMINI_API_KEY) {
            try {
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
                const data = await response.json();
                if (data.models) {
                    const geminiModels: { value: string; label: string; reqKey: string }[] = data.models
                        .filter((m: { name: string; supportedGenerationMethods?: string[] }) =>
                            m.name.includes('gemini') &&
                            (m.supportedGenerationMethods ?? []).includes('generateContent')
                        )
                        .map((m: { name: string; displayName?: string }) => ({
                            value: m.name.replace('models/', ''),
                            label: m.displayName || m.name.replace('models/', ''),
                            reqKey: 'GEMINI_API_KEY',
                        }));
                    geminiModels.sort((a, b) => b.value.localeCompare(a.value));
                    const apiValues = new Set(geminiModels.map(m => m.value));
                    const MUST_HAVE = ['gemini-2.5-pro-preview-06-05', 'gemini-2.0-flash'];
                    const missing = GEMINI_FALLBACK.filter(f => MUST_HAVE.includes(f.value) && !apiValues.has(f.value));
                    models.push(...missing, ...geminiModels);
                } else {
                    models.push(...GEMINI_FALLBACK);
                }
            } catch (err) {
                console.error('Gemini 모델 목록 조회 오류:', err);
                models.push(...GEMINI_FALLBACK);
            }
        }

        // 3. Claude Models
        if (process.env.CLAUDE_API_KEY) {
            models.push(...CLAUDE_MODELS.map(m => ({ ...m, reqKey: 'CLAUDE_API_KEY' })));
        }

        return NextResponse.json({ models });
    } catch (error) {
        console.error('API Models fetch error:', error);
        return NextResponse.json({ error: '모델 조회 실패' }, { status: 500 });
    }
}
