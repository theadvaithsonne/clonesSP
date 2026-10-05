// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm', 'video/quicktime',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip', 'application/x-rar-compressed'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 });
    }

    // For now, we'll use a mock upload since we need to set up the backend integration
    // In a real implementation, you would forward this to your backend S3 service
    console.log('File upload request:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Mock response - replace with actual S3 upload
    const mockUrl = `https://mock-s3-bucket.com/uploads/${Date.now()}-${file.name}`;

    return NextResponse.json({
      url: mockUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
