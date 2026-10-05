'use client';

import { useState, useEffect } from 'react';
import { Users, Share2, Eye, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AffiliateNetworkCanvas } from './AffiliateNetworkCanvas';

interface AffiliateNode {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  level: number;
  totalReferrals: number;
  directReferrals: number;
  status: 'active' | 'inactive';
  avatar?: string;
  children?: AffiliateNode[];
}

interface NetworkStats {
  totalNetworkSize: number;
  directReferrals: number;
  monthlyEarnings: number;
  networkDepth: number;
}

export function AffiliatePage() {
  const [networkData, setNetworkData] = useState<AffiliateNode | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    totalNetworkSize: 0,
    directReferrals: 0,
    monthlyEarnings: 0,
    networkDepth: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNetworkData();
    fetchNetworkStats();
  }, []);

  const fetchNetworkData = async () => {
    try {
      const response = await fetch('/api/revenue-network/affiliate/network');
      if (response.ok) {
        const data = await response.json();
        setNetworkData(data.network || null);
      } else {
        console.error('Failed to fetch network data');
        setNetworkData(null);
      }
    } catch (error) {
      console.error('Error fetching network data:', error);
      setNetworkData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworkStats = async () => {
    try {
      const response = await fetch('/api/revenue-network/affiliate/stats');
      if (response.ok) {
        const data = await response.json();
        const stats = data.stats;

        setNetworkStats({
          totalNetworkSize: stats.totalReferrals || 0,
          directReferrals: stats.activeReferrals || 0,
          monthlyEarnings: stats.monthlyEarnings || 0,
          networkDepth: stats.networkDepth || 0
        });
      } else {
        console.error('Failed to fetch network stats');
      }
    } catch (error) {
      console.error('Error fetching network stats:', error);
    }
  };


  const statsCards = [
    {
      title: 'Total Network Size',
      value: networkStats.totalNetworkSize,
      icon: <Users className="w-5 h-5" />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Direct Referrals',
      value: networkStats.directReferrals,
      icon: <Share2 className="w-5 h-5" />,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Monthly Earnings',
      value: `$${networkStats.monthlyEarnings.toFixed(2)}`,
      icon: <DollarSign className="w-5 h-5" />,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Network Depth',
      value: `${networkStats.networkDepth} levels`,
      icon: <Eye className="w-5 h-5" />,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  if (loading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-1/4"></div>
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-900">1Network</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Build Your Network Once & Get Paid Forever
          </p>
        </div>
      </div>

      {/* Stats Cards - Mobile View */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {statsCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center space-x-2">
              <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                <div className={stat.color}>{stat.icon}</div>
              </div>
              <div>
                <p className="text-xs text-gray-600">{stat.title}</p>
                <p className="text-sm font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Network Tree Canvas */}
      <Card className="border-gray-200 p-0 pt-2 gap-1">
        <CardHeader className="px-4 md:px-6">
          <CardTitle className="flex flex-col md:flex-row md:items-center md:justify-between space-y-3 md:space-y-0 text-gray-900">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-gray-700" />
              <span className="text-base md:text-lg">Your Affiliate Network</span>
            </div>
            {/* Stats Cards - Desktop View */}
            <div className="hidden md:flex items-center space-x-2 overflow-x-auto">
              {statsCards.map((stat) => (
                <div key={stat.title} className="bg-white rounded-lg border border-gray-200 p-3 min-w-fit">
                  <div className="flex items-center space-x-2">
                    <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                      <div className={stat.color}>{stat.icon}</div>
                    </div>

                    <div>
                      <p className="text-xs text-gray-600 whitespace-nowrap">{stat.title}</p>
                      <p className="text-lg font-bold text-gray-900">{stat.value}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AffiliateNetworkCanvas
            networkData={networkData}
            loading={loading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
