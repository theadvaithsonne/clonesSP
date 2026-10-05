import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST(request: NextRequest) {
  try {
    // Get token from garage auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();

    // Transform storeId to orgId if present
    const transformedBody = { ...body };
    if (transformedBody.storeId) {
      transformedBody.orgId = transformedBody.storeId;
      delete transformedBody.storeId;
    }

    // Call our backend store wallet transfer API
    const response = await fetch(`${BACKEND_URL}/wallet/store/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(transformedBody),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      transfer: data.transfer || data,
    });
  } catch (error) {
    console.error('Error transferring credits:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
