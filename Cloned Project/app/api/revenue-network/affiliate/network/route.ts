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

    // Call our backend affiliate network API
    const response = await fetch(`${BACKEND_URL}/affiliate/network`, {
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

    // Transform the backend response to match the expected frontend format
    // Backend returns: { success, network: AffiliateNode[], affiliateId, currentUser }
    // Frontend expects: { network: AffiliateNode (tree with root user) }

    // Helper to count all nodes in a tree
    const countAllNodes = (nodes: any[]): number => {
      if (!nodes || nodes.length === 0) return 0;
      return nodes.reduce((sum, node) => {
        return sum + 1 + countAllNodes(node.children || []);
      }, 0);
    };

    const network = data.network || [];
    const directReferrals = network.length;
    const totalReferrals = countAllNodes(network);

    console.log(`[FRONTEND API] Direct referrals: ${directReferrals}, Total network: ${totalReferrals}`);
    // Log first few children to see if they have nested children
    if (network.length > 0) {
      console.log(`[FRONTEND API] First child has ${network[0].children?.length || 0} children`);
    }

    // Build root user node with their referrals as children
    const rootNode = {
      id: 'root',
      name: data.currentUser?.name || 'You',
      email: data.currentUser?.email || '',
      avatar: data.currentUser?.avatar || '',
      joinedAt: new Date().toISOString(),
      level: 0,
      totalReferrals,
      directReferrals,
      status: 'active',
      userType: 'admin' as const,
      children: network,
    };

    return NextResponse.json({
      success: true,
      network: rootNode
    });
  } catch (error) {
    console.error('Error fetching affiliate network:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
