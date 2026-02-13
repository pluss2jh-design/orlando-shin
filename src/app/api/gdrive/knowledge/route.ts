import { NextResponse } from 'next/server';
import { getLearnedKnowledge } from '@/lib/stock-analysis/ai-learning';

export async function GET() {
  try {
    const knowledge = await getLearnedKnowledge();
    if (knowledge) {
      return NextResponse.json(knowledge);
    }
    return NextResponse.json({ error: 'No learned knowledge found' }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch knowledge';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
