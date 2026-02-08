import { NextRequest, NextResponse } from 'next/server';
import { videoProcessingService } from '@/lib/video-processing/processor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const timestamp = searchParams.get('timestamp');
    const tolerance = searchParams.get('tolerance');

    if (!fileId || !timestamp) {
      return NextResponse.json(
        { error: 'fileId and timestamp are required' },
        { status: 400 }
      );
    }

    const ts = parseFloat(timestamp);
    const tol = tolerance ? parseFloat(tolerance) : 2;

    const frames = await videoProcessingService.getFramesAtTimestamp(fileId, ts, tol);

    return NextResponse.json({
      success: true,
      fileId,
      timestamp: ts,
      tolerance: tol,
      frames,
      count: frames.length,
    });
  } catch (error) {
    console.error('Get frames error:', error);
    return NextResponse.json(
      { error: 'Failed to get frames' },
      { status: 500 }
    );
  }
}
