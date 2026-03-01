import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const FRAMES_DIR = path.join(UPLOAD_DIR, 'frames');

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileId: string; frameName: string }> }
) {
  try {
    const { fileId, frameName } = await params;
    const framePath = path.join(FRAMES_DIR, fileId, frameName);

    const normalizedPath = path.normalize(framePath);
    const normalizedFramesDir = path.normalize(FRAMES_DIR);
    
    if (!normalizedPath.startsWith(normalizedFramesDir)) {
      return NextResponse.json(
        { error: 'Invalid path' },
        { status: 403 }
      );
    }

    const fileBuffer = await fs.readFile(framePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('프레임 서빙 오류:', error);
    return NextResponse.json(
      { error: 'Frame not found' },
      { status: 404 }
    );
  }
}
