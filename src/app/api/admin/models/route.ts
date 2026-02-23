import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Claude doesn't have a public List Models endpoint in its SDK directly returning all models
// We hardcode the latest ones if the key exists.
const CLAUDE_MODELS = [
    { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' }
];

export async function GET() {
    try {
        const session = await auth();

        if ((session?.user as any)?.role !== 'ADMIN') {
            return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
        }

        const models = [];

        // 1. OpenAI Models
        if (process.env.OPENAI_API_KEY) {
            try {
                const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
                const list = await openai.models.list();
                const gptModels = list.data
                    .filter(m => m.id.includes('gpt-'))
                    .map(m => ({ value: m.id, label: m.id, reqKey: 'OPENAI_API_KEY' }));

                // Sort roughly by novelty
                gptModels.sort((a, b) => b.value.localeCompare(a.value));
                models.push(...gptModels);
            } catch (err) {
                console.error('Error fetching OpenAI models:', err);
            }
        }

        // 2. Gemini Models
        if (process.env.GEMINI_API_KEY) {
            try {
                // we can't fetch easily without REST call or specific trick, but standard google API exists
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
                const data = await response.json();
                if (data.models) {
                    const geminiModels = data.models
                        .filter((m: any) => m.name.includes('gemini') && m.supportedGenerationMethods.includes('generateContent'))
                        .map((m: any) => ({
                            value: m.name.replace('models/', ''),
                            label: m.displayName || m.name.replace('models/', ''),
                            reqKey: 'GEMINI_API_KEY'
                        }));

                    // Sort string desc
                    geminiModels.sort((a: any, b: any) => b.value.localeCompare(a.value));
                    models.push(...geminiModels);
                }
            } catch (err) {
                console.error('Error fetching Gemini models:', err);
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
