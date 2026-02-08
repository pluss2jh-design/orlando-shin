import { NextRequest, NextResponse } from 'next/server';
import { videoProcessingService } from '@/lib/video-processing/processor';
import { VideoProcessingOptions } from '@/types/video-processing';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.mp4')) {
      return NextResponse.json(
        { error: 'Only MP4 files are supported' },
        { status: 400 }
      );
    }

    const options: VideoProcessingOptions = {
      extractAudio: formData.get('extractAudio') !== 'false',
      performStt: formData.get('performStt') !== 'false',
      captureFrames: formData.get('captureFrames') !== 'false',
      frameInterval: parseInt(formData.get('frameInterval') as string) || 5,
      keyMomentDetection: formData.get('keyMomentDetection') !== 'false',
    };

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileId = await videoProcessingService.processVideo(
      buffer,
      file.name,
      options
    );

    return NextResponse.json({
      success: true,
      fileId,
      message: 'Video processing started',
      options,
    });
  } catch (error) {
    console.error('Video processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process video' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (fileId) {
      const result = videoProcessingService.getProcessingResult(fileId);
      if (!result) {
        return NextResponse.json(
          { error: 'Video not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, result });
    }

    const allResults = videoProcessingService.getAllResults();
    return NextResponse.json({ success: true, results: allResults });
  } catch (error) {
    console.error('Get video status error:', error);
    return NextResponse.json(
      { error: 'Failed to get video status' },
      { status: 500 }
    );
  }
}
