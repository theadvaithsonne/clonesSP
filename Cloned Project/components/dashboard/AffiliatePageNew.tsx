"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Share2,
  Eye,
  DollarSign,
  Copy,
  ExternalLink,
  EyeOff,
  Settings,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AffiliateGlobeView } from "@/components/affiliate/globe";
import { getToken } from "@/lib/auth";
import { getRevenueNetworkData } from "@/lib/revenue-network-cache";
import {
  getAffiliateStats,
  type AffiliateStats,
} from "@/lib/revenue-network-api";
import { toast } from "sonner";

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


type TabType = "tree" | "links";

export function AffiliatePage() {
  const [activeTab, setActiveTab] = useState<TabType>("tree");
  const [networkStats, setNetworkStats] = useState<AffiliateStats>({
    totalReferrals: 0,
    directReferrals: 0,
    activeReferrals: 0,
    monthlyEarnings: 0,
    networkDepth: 0,
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings>({
    commissionRate: 5,
    cookieDuration: 30,
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("");
  const [storeSlug, setStoreSlug] = useState<string>("");
  const [affiliateId, setAffiliateId] = useState<string>("");
  const [visibleLinks, setVisibleLinks] = useState<Set<string>>(new Set());
  const [storeShareLinkVisible, setStoreShareLinkVisible] = useState(false);

  // Get storeId from cache (or fetch if not cached)
  // This is only needed for stats and links tab, not for the globe/tree tab
  useEffect(() => {
    const loadRevenueNetworkData = async () => {
      try {
        const token = getToken();
        if (!token) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        // Use cached data if available, otherwise fetch and cache
        const cachedData = await getRevenueNetworkData();

        if (cachedData?.storeId) {
          setStoreId(cachedData.storeId);
          setStoreName(cachedData.storeName || "");
          setStoreSlug(cachedData.storeSlug || "");
          if (cachedData.affiliateId) {
            setAffiliateId(cachedData.affiliateId);
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Error loading revenue network data:", error);
        // Don't block the page - the tree tab works without storeId
        setLoading(false);
      }
    };

    loadRevenueNetworkData();
  }, []);

  useEffect(() => {
    if (storeId) {
      fetchNetworkStats();
      if (activeTab === "links") {
        fetchChannels();
        fetchAffiliateSettings();
      }
    }
  }, [storeId, activeTab]);

  const fetchNetworkStats = async () => {
    if (!storeId) return;

    try {
      const token = getToken();
      if (!token) return;

      const data = await getAffiliateStats(token, storeId);

      // @ts-ignore
      const stats = data.stats || data;
      setNetworkStats({
        totalReferrals: stats.totalReferrals || 0,
        directReferrals: stats.directReferrals || 0,
        activeReferrals: stats.activeReferrals || 0,
        monthlyEarnings: stats.monthlyEarnings || 0,
        networkDepth: stats.networkDepth || 0,
      });
    } catch (error) {
      console.error("Error fetching network stats:", error);
    }
  };

  const fetchChannels = async () => {
    setLinksLoading(true);
    try {
      const token = getToken();
      if (!token) {
        toast.error("Not authenticated");
        setLinksLoading(false);
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL;

      // Get orgId from localStorage (same as ChannelsPage)
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        throw new Error("No organization ID found");
      }

      // Fetch channels from backend using /feed/channels endpoint (same as ChannelsPage)
      const channelsResponse = await fetch(
        `${apiUrl}/feed/channels?orgId=${orgId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!channelsResponse.ok) {
        throw new Error("Failed to fetch channels");
      }

      const channelsData = await channelsResponse.json();
      const channels = channelsData.channels || [];

      // Fetch user's affiliate ID from backend if not already set
      let userAffiliateId = affiliateId;
      if (!userAffiliateId) {
        const affiliateResponse = await fetch(
          `${apiUrl}/affiliate/my-affiliate-id`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (affiliateResponse.ok) {
          const affiliateData = await affiliateResponse.json();
          userAffiliateId = affiliateData.affiliateId || "";
          if (userAffiliateId) {
            setAffiliateId(userAffiliateId);
          }
        }
      }

      // Generate affiliate links locally using store slug and user's affiliate ID
      // URL format: /{orgSlug}/{channelId}?ref={affiliateId}
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const channelsWithAffiliateInfo = channels.map((channel: Channel) => {
        const affiliateLink = userAffiliateId && storeSlug
          ? `${baseUrl}/${storeSlug}/${channel._id}?ref=${userAffiliateId}`
          : "";

        return {
          ...channel,
          affiliateId: userAffiliateId,
          affiliateLink,
        };
      });

      setChannels(channelsWithAffiliateInfo);
    } catch (error) {
      console.error("Failed to fetch channels:", error);
      toast.error("Failed to fetch channels");
    } finally {
      setLinksLoading(false);
    }
  };

  const fetchAffiliateSettings = async () => {
    try {
      const token = getToken();
      if (!token) {
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch(
        `/api/revenue-network/affiliate/settings?storeId=${storeId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
      }
    } catch (error) {
      console.error("Failed to fetch affiliate settings:", error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const toggleLinkVisibility = (channelId: string) => {
    setVisibleLinks((prev) => {
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
        toast.error("Not authenticated");
        return;
      }

      const response = await fetch("/api/revenue-network/affiliate/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          storeId: storeId,
          ...newSettings,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success("Affiliate settings updated successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update settings");
      }
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast.error("Failed to update settings");
    }
  };

  const statsCards = [
    {
      title: "Total Network Size",
      value: networkStats.totalReferrals,
      icon: <Users className="w-5 h-5" />,
      color: "text-blue-400",
      bgColor: "bg-blue-900/30",
    },
    {
      title: "Direct Referrals",
      value: networkStats.directReferrals,
      icon: <Share2 className="w-5 h-5" />,
      color: "text-green-400",
      bgColor: "bg-green-900/30",
    },
    {
      title: "Monthly Earnings",
      value: `$${networkStats.monthlyEarnings.toFixed(2)}`,
      icon: <DollarSign className="w-5 h-5" />,
      color: "text-purple-400",
      bgColor: "bg-purple-900/30",
    },
    {
      title: "Network Depth",
      value: `${networkStats.networkDepth} levels`,
      icon: <Eye className="w-5 h-5" />,
      color: "text-orange-400",
      bgColor: "bg-orange-900/30",
    },
  ];

  if (loading) {
    return (
      <div className="p-4 sm:p-5 space-y-4">
        <div className="mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Affiliate Program
          </h1>
          <p className="text-xs text-[#a5a6bf]">
            Loading your affiliate network...
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-[#111116] rounded-lg border border-[#2a2a35] p-6"
            >
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-[#2a2a35] rounded"></div>
                <div className="h-8 bg-[#2a2a35] rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-5 space-y-4">
        <div className="mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
            Affiliate Program
          </h1>
          <p className="text-xs text-[#a5a6bf]">
            Manage your affiliate network
          </p>
        </div>
        {error === "Not authenticated" ? (
          <Card className="border border-[#2a2a35] bg-[#111116]">
            <CardContent className="p-8 text-center">
              <div className="text-red-400 text-lg font-medium mb-2">
                Error Loading Affiliate Data
              </div>
              <div className="text-red-300/80 text-sm mb-4">{error}</div>
            </CardContent>
          </Card>
        ) : (
          <div className="h-[calc(100vh-190px)] overflow-hidden min-h-[300px] md:min-h-[500px] rounded-lg border border-[#2a2a35]">
            <AffiliateGlobeView />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-112px)] overflow-hidden px-2 pt-1 md:block md:h-auto md:overflow-x-hidden md:p-4 lg:p-5 md:space-y-4 md:pb-5">
      {/* Header */}
      <div className="hidden md:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="mb-1">
          <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">1Network</h1>
          <p className="text-xs text-[#a5a6bf]">
            Build Your Network Once & Get Paid Forever
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-semibold text-white/90 leading-tight">Need Help Growing Your Network?</p>
            <p className="text-xs text-[#a5a6bf] mt-0.5">Access NetworkChains & Get AI To Help You Prospect</p>
          </div>
          <a
            href="https://networkchains.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-5 py-2.5 bg-gradient-to-r from-[#6b3fa0] to-[#8b5fc8] hover:from-[#7a4db5] hover:to-[#9b6fd8] text-white text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap"
          >
            Go To NetworkChains
          </a>
        </div>
      </div>


      {/* Tab Content */}
      {activeTab === "tree" ? (
        <div className="flex-1 min-h-0 md:block md:space-y-4">
          {/* Globe with integrated sidebar (sidebar shows above map on mobile, beside map on desktop) */}
          <div className="h-full md:h-[calc(100vh-190px)] overflow-hidden min-h-[300px] md:min-h-[500px] rounded-lg border border-[#2a2a35]">
            <AffiliateGlobeView />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
          {/* Channel Affiliate Links */}
          <Card className="border border-[#2a2a35] bg-[#111116] shadow-xl">
            <CardHeader className="border-b border-[#2a2a35] px-3 sm:px-4">
              <CardTitle className="flex items-center space-x-2 text-white text-sm sm:text-base">
                <Link2 className="w-4 h-4 text-[#e6d7ff]" />
                <span>Channel Affiliate Links</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-3 sm:px-4">
              {linksLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2a2a35] border-t-[#4c2e8f] mx-auto mb-4"></div>
                  <p className="text-[#9fa0b8] text-sm">
                    Loading affiliate links...
                  </p>
                </div>
              ) : channels.length === 0 ? (
                <div className="text-center py-8">
                  <Link2 className="w-12 h-12 text-[#4c2e8f] mx-auto mb-4 opacity-50" />
                  <h3 className="text-base font-medium text-white mb-2">
                    No Channels Found
                  </h3>
                  <p className="text-[#9fa0b8] text-sm">
                    Create channels in your store to generate affiliate links.
                  </p>
                </div>
              ) : (
                channels.map((channel) => (
                  <div
                    key={channel._id}
                    className="border border-[#2c2c3a] rounded-lg p-3 space-y-3 bg-[#14141a] hover:border-[#4c2e8f] transition-all duration-200"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-white text-sm truncate">
                          {channel.title}
                        </h3>
                        <p className="text-xs text-[#9fa0b8] truncate">
                          /{channel.slug || channel._id}
                        </p>
                        {channel.isActive === false && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[9px] bg-red-900/30 text-red-400 rounded-full border border-red-800/50">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {channel.affiliateLink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#9fa0b8] hover:text-white hover:bg-[#2a1752]"
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
                      <div className="space-y-2">
                        <div className="space-y-2">
                          <Label className="text-[10px] text-[#9fa0b8] uppercase tracking-wider">
                            Affiliate Link (my.garage.app)
                          </Label>
                          <div className="flex items-center space-x-2">
                            <Input
                              value={
                                visibleLinks.has(channel._id)
                                  ? channel.affiliateLink
                                  : "••••••••••••••••••••••••••••"
                              }
                              readOnly
                              className="font-mono text-xs bg-[#0d0d11] border-[#2c2c3a] text-[#e6d7ff]"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-[#2c2c3a] hover:bg-[#2a1752] hover:border-[#4c2e8f]"
                              onClick={() =>
                                copyToClipboard(
                                  channel.affiliateLink!,
                                  "Affiliate link"
                                )
                              }
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-[#2c2c3a] hover:bg-[#2a1752] hover:border-[#4c2e8f]"
                              onClick={() =>
                                window.open(channel.affiliateLink, "_blank")
                              }
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {channel.affiliateId && (
                          <div className="flex items-center space-x-2">
                            <Label className="text-[10px] text-[#9fa0b8] uppercase tracking-wider">
                              Affiliate ID:
                            </Label>
                            <code className="text-[10px] bg-[#0d0d11] border border-[#2c2c3a] px-2 py-1 rounded text-[#e6d7ff]">
                              {channel.affiliateId}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#9fa0b8] hover:text-white hover:bg-[#2a1752]"
                              onClick={() =>
                                copyToClipboard(
                                  channel.affiliateId!,
                                  "Affiliate ID"
                                )
                              }
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

          <div className="space-y-4">
            {linksLoading ? (
              <Card className="border border-[#2a2a35] bg-[#111116]">
                <CardContent className="py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2a2a35] border-t-[#4c2e8f] mx-auto mb-4"></div>
                    <p className="text-[#9fa0b8] text-sm">Loading...</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Store Share Link */}
                <Card className="border border-[#2a2a35] bg-[#111116] shadow-xl">
                  <CardHeader className="border-b border-[#2a2a35] px-3 sm:px-4">
                    <CardTitle className="flex items-center space-x-2 text-white text-sm sm:text-base">
                      <Share2 className="w-4 h-4 text-[#e6d7ff]" />
                      <span>Store Share Link</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 px-3 sm:px-4">
                    <p className="text-xs text-[#9fa0b8]">
                      Share your entire store with customers using your
                      affiliate link
                    </p>

                    {affiliateId && storeSlug ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label className="text-[10px] text-[#9fa0b8] uppercase tracking-wider">
                            Store Affiliate Link
                          </Label>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                            <Input
                              value={
                                storeShareLinkVisible
                                  ? `https://my.garage.app/${storeSlug}?ref=${affiliateId}`
                                  : "••••••••••••••••••••••••••••"
                              }
                              readOnly
                              className="font-mono text-xs bg-[#0d0d11] border-[#2c2c3a] text-[#e6d7ff] flex-1"
                            />
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="shrink-0 text-[#9fa0b8] hover:text-white hover:bg-[#2a1752] h-8 sm:h-9"
                                onClick={() =>
                                  setStoreShareLinkVisible(!storeShareLinkVisible)
                                }
                              >
                                {storeShareLinkVisible ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-[#2c2c3a] hover:bg-[#2a1752] hover:border-[#4c2e8f] h-8 sm:h-9"
                                onClick={() =>
                                  copyToClipboard(
                                    `https://my.garage.app/${storeSlug}?ref=${affiliateId}`,
                                    "Store share link"
                                  )
                                }
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-[#2c2c3a] hover:bg-[#2a1752] hover:border-[#4c2e8f] h-8 sm:h-9"
                                onClick={() =>
                                  window.open(
                                    `https://my.garage.app/${storeSlug}?ref=${affiliateId}`,
                                    "_blank"
                                  )
                                }
                              >
                                <ExternalLink className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Label className="text-[10px] text-[#9fa0b8] uppercase tracking-wider">
                            Your Affiliate ID:
                          </Label>
                          <code className="text-[10px] bg-[#0d0d11] border border-[#2c2c3a] px-2 py-1 rounded text-[#e6d7ff]">
                            {affiliateId}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#9fa0b8] hover:text-white hover:bg-[#2a1752]"
                            onClick={() =>
                              copyToClipboard(affiliateId, "Affiliate ID")
                            }
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-[#9fa0b8]">
                          Generate at least one channel link to get your store
                          share link
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Affiliate Configuration */}
                <Card className="border border-[#2a2a35] bg-[#111116] shadow-xl">
                  <CardHeader className="border-b border-[#2a2a35] px-3 sm:px-4">
                    <CardTitle className="flex items-center space-x-2 text-white text-sm sm:text-base">
                      <Settings className="w-4 h-4 text-[#e6d7ff]" />
                      <span>Configuration</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-3 sm:px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-xs font-medium text-white">
                          Affiliate Program
                        </Label>
                        <p className="text-[10px] text-[#9fa0b8] mt-0.5">
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

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-white">
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
                        className="bg-[#0d0d11] border-[#2c2c3a] text-white"
                      />
                      <p className="text-[10px] text-[#9fa0b8]">
                        Percentage commission for successful referrals
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-white">
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
                        className="bg-[#0d0d11] border-[#2c2c3a] text-white"
                      />
                      <p className="text-[10px] text-[#9fa0b8]">
                        How long to track referrals after initial click
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-white">
                        Custom Domain (Optional)
                      </Label>
                      <Input
                        value={settings.customDomain || ""}
                        onChange={(e) =>
                          updateSettings({ customDomain: e.target.value })
                        }
                        placeholder="your-domain.com"
                        className="bg-[#0d0d11] border-[#2c2c3a] text-white"
                      />
                      <p className="text-[10px] text-[#9fa0b8]">
                        Use your own domain for affiliate links
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
