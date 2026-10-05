import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Get token from garage auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call our backend affiliate links API
    const response = await fetch(`${BACKEND_URL}/affiliate/links?orgId=${storeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform to expected format
    return NextResponse.json({
      success: true,
      links: data.links || data || [],
    });
  } catch (error) {
    console.error('Error fetching affiliate links:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { storeId, channelId } = body;

    if (!storeId || !channelId) {
      return NextResponse.json({ error: 'Store ID and Channel ID are required' }, { status: 400 });
    }

    // Call our backend affiliate links API
    const response = await fetch(`${BACKEND_URL}/affiliate/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        orgId: storeId,
        channelId
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform to expected format
    return NextResponse.json({
      success: true,
      link: data.link || data,
    });
  } catch (error) {
    console.error('Error generating affiliate link:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
