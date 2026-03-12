import { NextResponse } from 'next/server';
import { getUniverseCounts } from '@/lib/stock-analysis/universe';

export async function GET() {
  try {
    const counts = await getUniverseCounts();
    return NextResponse.json(counts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch universe counts' }, { status: 500 });
  }
}
