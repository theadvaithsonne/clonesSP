import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function GET(request: NextRequest) {
  try {
    // Get token from garage auth
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ||
                  request.cookies.get('auth-token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Call our backend affiliate stats API
    const response = await fetch(`${BACKEND_URL}/affiliate/stats`, {
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

    // Return stats in expected format
    return NextResponse.json({
      success: true,
      stats: data.stats || {
        totalReferrals: 0,
        directReferrals: 0,
        activeReferrals: 0,
        foundedOrgsCount: 0,
      },
      affiliateId: data.affiliateId,
    });
  } catch (error) {
    console.error('Error fetching affiliate stats:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
