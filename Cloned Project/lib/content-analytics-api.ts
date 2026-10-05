import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface ContentTypeStats {
  contentType: string; totalSessions: number; uniqueViewers: number;
  totalWatchTime: number; totalReadTime: number; avgCompletion: number;
  completedCount: number; affiliateDriven: number;
}
export interface TopAffiliate {
  affiliateId: string; name: string; email?: string; profilePicture?: string;
  totalSessions: number; contentTypes: string[]; avgCompletion: number;
}
export interface TopContentItem {
  contentId: string; contentType: string; contentTitle: string;
  totalSessions: number; uniqueViewers: number; totalWatchTime: number;
  totalReadTime: number; avgCompletion: number; completedCount: number;
  affiliateDriven: number;
}
export interface OverviewData {
  success: boolean; byType: ContentTypeStats[]; topAffiliates: TopAffiliate[];
  topContent: TopContentItem[];
}
export interface LeaderboardItem {
  contentId: string; contentTitle: string; totalSessions: number;
  uniqueViewersCount: number; totalWatchTime: number; avgWatchTime: number;
  totalReadTime: number; avgReadTime: number; avgCompletion: number;
  completedCount: number; affiliateDriven: number; affiliatePercent: number;
  topDevice: string; lastActivity: string;
}
export interface LeaderboardAffiliate {
  affiliateId: string; name: string; email?: string; profilePicture?: string;
  sessions: number; avgCompletion: number; totalWatchTime: number; totalReadTime: number;
}
export interface LeaderboardData {
  success: boolean; contentType: string; items: LeaderboardItem[];
  aggregated: {
    totalSessions: number; uniqueViewers: number; totalWatchTime: number;
    totalReadTime: number; avgCompletion: number; completedCount: number;
    affiliateDriven: number;
  };
  topAffiliates: LeaderboardAffiliate[];
}

export async function fetchOverview(from?: string, to?: string, myPostsOnly?: boolean): Promise<OverviewData> {
  const params: Record<string, string> = {};
  if (from) params.from = from;
  if (to) params.to = to;
  if (myPostsOnly) params.myPostsOnly = "true";
  const qs = new URLSearchParams(params).toString();
  return api<OverviewData>(`/content-engagement/overview${qs ? `?${qs}` : ""}`, {}, getToken()!);
}

export async function fetchLeaderboard(
  contentType: string,
  opts?: { from?: string; to?: string; limit?: number; sortBy?: string; myPostsOnly?: boolean }
): Promise<LeaderboardData> {
  const params: Record<string, string> = {};
  if (opts?.from) params.from = opts.from;
  if (opts?.to) params.to = opts.to;
  if (opts?.limit) params.limit = String(opts.limit);
  if (opts?.sortBy) params.sortBy = opts.sortBy;
  if (opts?.myPostsOnly) params.myPostsOnly = "true";
  const qs = new URLSearchParams(params).toString();
  return api<LeaderboardData>(
    `/content-engagement/leaderboard/${contentType}${qs ? `?${qs}` : ""}`, {}, getToken()!
  );
}
