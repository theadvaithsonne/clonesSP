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

    // Call our backend affiliate settings API
    const response = await fetch(`${BACKEND_URL}/affiliate/settings?orgId=${storeId}`, {
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
      settings: data.settings || {
        commissionRate: 5,
        cookieDuration: 30,
        isActive: true,
      },
    });
  } catch (error) {
    console.error('Error fetching affiliate settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get token from garage auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get request body
    const body = await request.json();
    const { storeId, ...settingsData } = body;

    if (!storeId) {
      return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
    }

    // Call our backend affiliate settings API
    const response = await fetch(`${BACKEND_URL}/affiliate/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        orgId: storeId,
        ...settingsData
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform to expected format
    return NextResponse.json({
      success: true,
      settings: data.settings || settingsData,
    });
  } catch (error) {
    console.error('Error updating affiliate settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
