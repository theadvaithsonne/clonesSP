'use client';

import { useState, useEffect } from 'react';
import { Copy, ExternalLink, Eye, EyeOff, Settings, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getToken } from '@/lib/auth';
import { getRevenueNetworkData } from '@/lib/revenue-network-cache';
import { toast } from 'sonner';

interface Channel {
  _id: string;
  title: string;
  description?: string;
  slug?: string;
  isActive: boolean;
  affiliateId?: string;
  affiliateLink?: string;
}

interface AffiliateSettings {
  commissionRate: number;
  cookieDuration: number;
  isActive: boolean;
  customDomain?: string;
}

interface AffiliateLink {
  _id: string;
  channelId: string;
  affiliateId: string;
  affiliateUrl: string;
  isActive: boolean;
}

export function AffiliateSettingsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings>({
    commissionRate: 5,
    cookieDuration: 30,
    isActive: true
  });
  const [loading, setLoading] = useState(true);
  const [visibleLinks, setVisibleLinks] = useState<Set<string>>(new Set());
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>('');

  // Get storeId from cache (or fetch if not cached)
  useEffect(() => {
    const loadRevenueNetworkData = async () => {
      try {
        const token = getToken();
        if (!token) {
          toast.error('Not authenticated');
          setLoading(false);
          return;
        }

        // Use cached data if available, otherwise fetch and cache
        const cachedData = await getRevenueNetworkData();

        if (!cachedData?.storeId) {
          toast.error('No store associated with this organization');
          setLoading(false);
          return;
        }

        setStoreId(cachedData.storeId);
        setStoreName(cachedData.storeName || '');
        setLoading(false);
      } catch (error) {
        console.error('Error loading revenue network data:', error);
        toast.error('Failed to fetch organization data');
        setLoading(false);
      }
    };

    loadRevenueNetworkData();
  }, []);

  useEffect(() => {
    if (storeId) {
      fetchChannels();
      fetchAffiliateSettings();
    }
  }, [storeId]);

  const fetchChannels = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      // First fetch all channels
      const channelsResponse = await fetch(`/api/revenue-network/channels?storeId=${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (!channelsResponse.ok) {
        throw new Error('Failed to fetch channels');
      }

      const channelsData = await channelsResponse.json();
      const channels = channelsData.channels || [];

      // Then fetch all existing affiliate links for this store
      const linksResponse = await fetch(`/api/revenue-network/affiliate/links?storeId=${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      let existingLinks = [];
      if (linksResponse.ok) {
        const linksData = await linksResponse.json();
        existingLinks = linksData.links || [];
      }

      // Auto-generate affiliate links for channels that don't have them
      const channelsWithAffiliateInfo = await Promise.all(
        channels.map(async (channel: Channel) => {
          const affiliateLink = existingLinks.find((link: AffiliateLink) =>
            link.channelId === channel._id
          );

          if (affiliateLink) {
            return {
              ...channel,
              affiliateId: affiliateLink.affiliateId,
              affiliateLink: affiliateLink.affiliateUrl
            };
          } else {
            // Auto-generate affiliate link for this channel
            try {
              const generateResponse = await fetch('/api/revenue-network/affiliate/links', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  storeId: storeId,
                  channelId: channel._id
                })
              });

              if (generateResponse.ok) {
                const generateData = await generateResponse.json();
                const { link } = generateData;
                return {
                  ...channel,
                  affiliateId: link.affiliateId,
                  affiliateLink: link.affiliateUrl
                };
              }
            } catch (error) {
              console.error('Failed to auto-generate affiliate link for channel:', channel._id, error);
            }
            return channel;
          }
        })
      );

      setChannels(channelsWithAffiliateInfo);
    } catch (error) {
      console.error('Failed to fetch channels:', error);
      toast.error('Failed to fetch channels');
    }
  };

  const fetchAffiliateSettings = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch(`/api/revenue-network/affiliate/settings?storeId=${storeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch affiliate settings:', response.status, errorText);
      }
    } catch (error) {
      console.error('Failed to fetch affiliate settings:', error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const toggleLinkVisibility = (channelId: string) => {
    setVisibleLinks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(channelId)) {
        newSet.delete(channelId);
      } else {
        newSet.add(channelId);
      }
      return newSet;
    });
  };

  const updateSettings = async (newSettings: Partial<AffiliateSettings>) => {
    try {
      const token = getToken();
      if (!token) {
        toast.error('Not authenticated');
        return;
      }

      const response = await fetch('/api/revenue-network/affiliate/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          storeId: storeId,
          ...newSettings
        })
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Affiliate settings updated successfully!');
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    }
  };

  if (loading) {
    return (
      <div className="h-full w-full bg-[#0a0a0a] text-white p-6 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-10 bg-gray-800 rounded w-1/3"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
                <div className="h-6 bg-gray-800 rounded"></div>
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-800 rounded"></div>
                  ))}
                </div>
              </div>
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-4">
                <div className="h-6 bg-gray-800 rounded"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-800 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0a0a0a] text-white p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Affiliate Settings</h1>
            <p className="text-gray-400 mt-1">
              Manage your affiliate links and configuration for {storeName}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Channel Affiliate Links */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Link2 className="w-5 h-5" />
                <span>Channel Affiliate Links</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {channels.length === 0 ? (
                <div className="text-center py-8">
                  <Link2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">No Channels Found</h3>
                  <p className="text-gray-400">Create channels in your store to generate affiliate links.</p>
                </div>
              ) : (
                channels.map((channel) => (
                  <div key={channel._id} className="border border-gray-800 rounded-lg p-4 space-y-3 bg-gray-950">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white truncate">{channel.title}</h3>
                        <p className="text-sm text-gray-400 truncate">/{channel.slug || channel._id}</p>
                        {!channel.isActive && (
                          <span className="inline-block mt-1 px-2 py-1 text-xs bg-red-900/30 text-red-400 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {channel.affiliateLink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                            onClick={() => toggleLinkVisibility(channel._id)}
                          >
                            {visibleLinks.has(channel._id) ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {channel.affiliateLink && (
                      <div className="space-y-3">
                        {/* App.revenue.network Link */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">App Affiliate Link (app.revenue.network)</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              value={visibleLinks.has(channel._id) ? channel.affiliateLink : '••••••••••••••••••••••••••••'}
                              readOnly
                              className="font-mono text-sm bg-gray-950 border-gray-800 text-gray-300"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-gray-800 hover:bg-gray-800"
                              onClick={() => copyToClipboard(channel.affiliateLink!, 'App affiliate link')}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-gray-800 hover:bg-gray-800"
                              onClick={() => window.open(channel.affiliateLink, '_blank')}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* revenue.network Link */}
                        <div className="space-y-2">
                          <Label className="text-xs text-gray-400">Main Affiliate Link (revenue.network)</Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              value={visibleLinks.has(channel._id) ? channel.affiliateLink?.replace('app.revenue.network', 'revenue.network') : '••••••••••••••••••••••••••••'}
                              readOnly
                              className="font-mono text-sm bg-gray-950 border-gray-800 text-gray-300"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-gray-800 hover:bg-gray-800"
                              onClick={() => {
                                const mainLink = channel.affiliateLink?.replace('app.revenue.network', 'revenue.network');
                                if (mainLink) copyToClipboard(mainLink, 'Main affiliate link');
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-gray-800 hover:bg-gray-800"
                              onClick={() => {
                                const mainLink = channel.affiliateLink?.replace('app.revenue.network', 'revenue.network');
                                if (mainLink) window.open(mainLink, '_blank');
                              }}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {channel.affiliateId && (
                          <div className="flex items-center space-x-2">
                            <Label className="text-xs text-gray-400">Affiliate ID:</Label>
                            <code className="text-xs bg-gray-950 border border-gray-800 px-2 py-1 rounded text-gray-300">
                              {channel.affiliateId}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-400 hover:text-white"
                              onClick={() => copyToClipboard(channel.affiliateId!, 'Affiliate ID')}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Affiliate Configuration */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-white">
                <Settings className="w-5 h-5" />
                <span>Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-white">
                    Affiliate Program
                  </Label>
                  <p className="text-xs text-gray-400 mt-1">
                    Enable or disable the affiliate program
                  </p>
                </div>
                <Switch
                  checked={settings.isActive}
                  onCheckedChange={(checked) =>
                    updateSettings({ isActive: checked })
                  }
                />
              </div>

              {/* Commission Rate */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">
                  Commission Rate (%)
                </Label>
                <Input
                  type="number"
                  value={settings.commissionRate}
                  onChange={(e) =>
                    updateSettings({
                      commissionRate: parseFloat(e.target.value) || 0,
                    })
                  }
                  placeholder="Enter commission rate"
                  min="0"
                  max="100"
                  step="0.1"
                  className="bg-gray-950 border-gray-800 text-white"
                />
                <p className="text-xs text-gray-400">
                  Percentage commission for successful referrals
                </p>
              </div>

              {/* Cookie Duration */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">
                  Cookie Duration (days)
                </Label>
                <Input
                  type="number"
                  value={settings.cookieDuration}
                  onChange={(e) =>
                    updateSettings({
                      cookieDuration: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="Enter cookie duration"
                  min="1"
                  max="365"
                  className="bg-gray-950 border-gray-800 text-white"
                />
                <p className="text-xs text-gray-400">
                  How long to track referrals after initial click
                </p>
              </div>

              {/* Custom Domain */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-white">
                  Custom Domain (Optional)
                </Label>
                <Input
                  value={settings.customDomain || ""}
                  onChange={(e) =>
                    updateSettings({ customDomain: e.target.value })
                  }
                  placeholder="your-domain.com"
                  className="bg-gray-950 border-gray-800 text-white"
                />
                <p className="text-xs text-gray-400">
                  Use your own domain for affiliate links
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
