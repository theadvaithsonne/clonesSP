import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Get token from garage auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Forward query params (convert storeId to orgId if present)
    const storeId = searchParams.get('storeId');
    const params = new URLSearchParams();
    if (storeId) {
      params.append('orgId', storeId);
    }

    // Call our backend store users API
    const response = await fetch(`${BACKEND_URL}/wallet/store-users?${params.toString()}`, {
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

    return NextResponse.json({
      success: true,
      users: data.users || data || [],
    });
  } catch (error) {
    console.error('Error fetching store users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
