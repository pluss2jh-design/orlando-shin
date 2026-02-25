import { NextRequest, NextResponse } from 'next/server';
import { videoProcessingService } from '@/lib/video-processing/processor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const query = searchParams.get('query');

    if (!fileId || !query) {
      return NextResponse.json(
        { error: 'fileId and query are required' },
        { status: 400 }
      );
    }

    const matches = await videoProcessingService.searchInTranscript(fileId, query);

    return NextResponse.json({
      success: true,
      fileId,
      query,
      matches,
      count: matches.length,
    });
  } catch (error) {
    console.error('Search transcript error:', error);
    return NextResponse.json(
      { error: 'Failed to search transcript' },
      { status: 500 }
    );
  }
}
