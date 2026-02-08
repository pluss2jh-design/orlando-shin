import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedFiles = files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size,
    }));

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      message: 'Files uploaded successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload files' },
      { status: 500 }
    );
  }
}
