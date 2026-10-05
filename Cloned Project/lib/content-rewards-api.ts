// lib/content-rewards-api.ts
// API helpers for the Content Rewards system — campaigns, social accounts, submissions.

import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

// ── Types ──────────────────────────────────────────────────────────

export interface Campaign {
  _id: string;
  orgId: string;
  founderId: any;
  title: string;
  description: string;
  thumbnailUrl: string;
  campaignType: "clipping" | "ugc";
  status: "draft" | "active" | "paused" | "completed";
  budget: number;
  budgetSpent: number;
  budgetRemaining: number;
  ratePerThousand: number;
  currency: "USD" | "INR";
  minPayout: number;
  maxPayout: number;
  platforms: string[];
  requirements: {
    minDuration: number;
    maxDuration: number;
    hashtags: string[];
    mentions: string[];
    guidelines: string;
  };
  assets: { url: string; type: string; description: string }[];
  resourceLinks: { url: string; label: string; type: string }[];
  autoApprove: boolean;
  totalSubmissions: number;
  approvedSubmissions: number;
  totalViews: number;
  participants: string[];
  totalParticipants: number;
  campaignWalletId?: string | null;
  lockedAmount?: number;
  createdAt: string;
  updatedAt: string;
  userSubmissions?: any[];
}

export interface CampaignWalletInfo {
  balance: number;          // float USD
  totalLocked: number;      // float USD
  totalPaidOut: number;     // float USD
  totalRefunded: number;    // float USD
  status: "active" | "closed" | "missing";
  currency: string;
  lastTransactionAt?: string;
}

export interface CampaignWalletTransactionItem {
  _id: string;
  type: "credit" | "debit" | "refund";
  direction: "in" | "out";
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  relatedUserId?: any;
  relatedSubmissionId?: string | null;
  relatedPayoutId?: string | null;
  createdAt: string;
}

export interface ContentRewardsBalance {
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
}

export interface ContentRewardsOrgBalance {
  orgId: string;
  orgName: string;
  balance: number;
  totalEarnings: number;
  totalWithdrawn: number;
  currency: string;
}

export interface ContentRewardsTransactionItem {
  _id: string;
  type: "credit" | "debit" | "withdrawal";
  amount: number;
  currency: string;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  campaignId?: any;
  submissionId?: string | null;
  relatedPayoutId?: string | null;
  createdAt: string;
}

export interface StoreWalletBalance {
  balance: number;
  currency: string;
}

export interface SocialAccount {
  id: string;
  platform: string;
  username: string;
  profileUrl: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verificationCode?: string;
  oauthConnected?: boolean;
  createdAt: string;
}

export interface Submission {
  _id: string;
  campaignId: any;
  userId: any;
  socialAccountId: any;
  orgId: string;
  postUrl: string;
  platform: string;
  status: "pending" | "approved" | "rejected" | "flagged";
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string;
  viewsAtApproval: number;
  currentViews: number;
  netViews: number;
  earnedAmount: number;
  earnedDisplay: string;
  paidOutAmount: number;
  isPaidOut: boolean;
  paidOutAt: string | null;
  lastTrackedAt: string | null;
  viewSource: "oauth_api";
  platformPostId: string;
  lastFetchedAt: string | null;
  viewSnapshots: { views: number; timestamp: string; source?: string }[];
  // Populated by NC at submission time via YouTube oEmbed. Used by the
  // founder's review card to show a thumbnail + title rather than a raw URL.
  metadata?: {
    title: string;
    thumbnail: string;
    author: string;
  };
  createdAt: string;
}

export interface EarningsSummary {
  summary: {
    totalSubmissions: number;
    totalViews: number;
    totalEarned: number;
    totalPaidOut: number;
  };
  byCampaign: any[];
  byPlatform: any[];
}

export interface CampaignStats {
  campaign: Campaign;
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    totalViews: number;
    totalEarned: number;
  };
  topPerformers: any[];
  platformBreakdown: any[];
}

// ── Campaigns ──────────────────────────────────────────────────────

export async function fetchCampaigns(status?: string) {
  const qs = status ? `?status=${status}` : "";
  return api<{ success: boolean; campaigns: Campaign[] }>(
    `/content-campaigns${qs}`,
    {},
    getToken()!
  );
}

export async function fetchActiveCampaigns(orgId?: string) {
  const qs = orgId ? `?orgId=${orgId}` : "";
  return api<{ success: boolean; campaigns: Campaign[] }>(
    `/content-campaigns/active${qs}`,
    {},
    getToken()!
  );
}

export async function createCampaign(data: Partial<Campaign>) {
  return api<{ success: boolean; campaign: Campaign }>(
    "/content-campaigns",
    { method: "POST", body: JSON.stringify(data) },
    getToken()!
  );
}

export async function updateCampaign(id: string, data: Partial<Campaign>) {
  return api<{ success: boolean; campaign: Campaign }>(
    `/content-campaigns/${id}`,
    { method: "PATCH", body: JSON.stringify(data) },
    getToken()!
  );
}

export async function deleteCampaign(id: string) {
  return api<{ success: boolean }>(
    `/content-campaigns/${id}`,
    { method: "DELETE" },
    getToken()!
  );
}

export async function fetchCampaignStats(id: string) {
  return api<CampaignStats>(
    `/content-campaigns/${id}/stats`,
    {},
    getToken()!
  );
}

export async function joinCampaign(id: string) {
  return api<{ success: boolean; joined: boolean }>(
    `/content-campaigns/${id}/join`,
    { method: "POST" },
    getToken()!
  );
}

export async function leaveCampaign(id: string) {
  return api<{ success: boolean }>(
    `/content-campaigns/${id}/leave`,
    { method: "POST" },
    getToken()!
  );
}

// ── Social Accounts ────────────────────────────────────────────────

export async function fetchSocialAccounts() {
  return api<{ success: boolean; accounts: SocialAccount[] }>(
    "/social-accounts",
    {},
    getToken()!
  );
}

export async function connectSocialAccount(platform: string, profileUrl: string) {
  return api<{
    success: boolean;
    account: SocialAccount;
    instructions: string;
  }>(
    "/social-accounts/connect",
    { method: "POST", body: JSON.stringify({ platform, profileUrl }) },
    getToken()!
  );
}

export async function verifySocialAccount(id: string) {
  return api<{
    success: boolean;
    message?: string;
    error?: string;
    account?: SocialAccount;
    verificationCode?: string;
  }>(
    `/social-accounts/${id}/verify`,
    { method: "POST" },
    getToken()!
  );
}



export async function removeSocialAccount(id: string) {
  return api<{ success: boolean }>(
    `/social-accounts/${id}`,
    { method: "DELETE" },
    getToken()!
  );
}

// ── Social OAuth ─────────────────────────────────────────────────

export async function getOAuthUrl(platform: string) {
  return api<{ success: boolean; authUrl: string }>(
    `/social-oauth/${platform}/authorize`,
    {},
    getToken()!
  );
}

export async function disconnectOAuth(platform: string) {
  return api<{ success: boolean }>(
    `/social-oauth/${platform}/disconnect`,
    { method: "POST" },
    getToken()!
  );
}

export async function refreshOAuthToken(platform: string) {
  return api<{ success: boolean }>(
    `/social-oauth/${platform}/refresh`,
    { method: "POST" },
    getToken()!
  );
}

// ── Submissions ────────────────────────────────────────────────────

export async function submitContent(campaignId: string, postUrl: string) {
  return api<{ success: boolean; submission: any }>(
    "/content-submissions",
    { method: "POST", body: JSON.stringify({ campaignId, postUrl }) },
    getToken()!
  );
}

export async function fetchMySubmissions(opts?: { status?: string; campaignId?: string }) {
  const params: Record<string, string> = {};
  if (opts?.status) params.status = opts.status;
  if (opts?.campaignId) params.campaignId = opts.campaignId;
  const qs = new URLSearchParams(params).toString();
  return api<{ success: boolean; submissions: Submission[] }>(
    `/content-submissions${qs ? `?${qs}` : ""}`,
    {},
    getToken()!
  );
}

export async function fetchMyEarnings(campaignId?: string) {
  const qs = campaignId ? `?campaignId=${campaignId}` : "";
  return api<{ success: boolean } & EarningsSummary>(
    `/content-submissions/earnings${qs}`,
    {},
    getToken()!
  );
}

export async function fetchCampaignSubmissions(campaignId: string, status?: string) {
  const qs = status ? `?status=${status}` : "";
  return api<{ success: boolean; submissions: Submission[] }>(
    `/content-submissions/campaign/${campaignId}${qs}`,
    {},
    getToken()!
  );
}

/**
 * Founder-only: fetch the current live view count for a submission so the
 * review screen can show actual numbers (instead of the stored 0 on a
 * pending submission, which hasn't been view-fetched yet).
 *
 * Cheap one-shot — no rate limit. Backend resolves the affiliate's social
 * account and hits the platform API directly.
 */
export async function fetchLivePreviewViews(submissionId: string) {
  return api<{
    success: boolean;
    views: number;
    source?: string;
    error?: string;
  }>(
    `/content-submissions/${submissionId}/live-views`,
    {},
    getToken()!
  );
}

/**
 * Approve or reject a submission. When approving, `payoutBasis` controls
 * how the affiliate earns:
 *   - "net"   (default) → only views accrued after approval count
 *   - "total"           → every view ever counts, including the pre-approval backlog
 * `payoutBasis` is ignored when action is "reject".
 */
export async function reviewSubmission(
  id: string,
  action: "approve" | "reject",
  options?: { reason?: string; payoutBasis?: "total" | "net" }
) {
  const body: Record<string, unknown> = { action };
  if (options?.reason !== undefined) body.reason = options.reason;
  if (action === "approve" && options?.payoutBasis) body.payoutBasis = options.payoutBasis;
  return api<{ success: boolean; submission: any }>(
    `/content-submissions/${id}/review`,
    { method: "PATCH", body: JSON.stringify(body) },
    getToken()!
  );
}



// ── Wallet — campaign escrow & content-rewards earnings ─────────────

/**
 * Founder's StoreWallet balance for the active org (used to gate campaign
 * creation). orgId comes from the active session in the dashboard layout.
 */
export async function fetchStoreWalletBalance(orgId: string) {
  return api<{ success: boolean } & StoreWalletBalance>(
    `/wallet/store/balance?orgId=${encodeURIComponent(orgId)}`,
    {},
    getToken()!
  );
}

/**
 * Per-campaign escrow wallet snapshot + paginated audit log.
 * Founder-only on the backend.
 */
export async function fetchCampaignWallet(
  campaignId: string,
  opts?: { limit?: number; offset?: number }
) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
  const qs = params.toString();
  return api<{
    success: boolean;
    wallet: CampaignWalletInfo;
    transactions?: CampaignWalletTransactionItem[];
    total?: number;
  }>(
    `/content-campaigns/${campaignId}/wallet${qs ? `?${qs}` : ""}`,
    {},
    getToken()!
  );
}

/**
 * Affiliate's Content Rewards balance.
 *
 * With `orgId`  → the balance held in that ONE org's `OrgRewardsWallet`
 *                 row. Use this from the Wallet page so the number
 *                 matches the org selected in the org switcher.
 * Without       → legacy sum across every org the user has activity in
 *                 (kept for callers that haven't been updated to pass
 *                 an orgId). See also `fetchContentRewardsBalancesPerOrg()`
 *                 for the per-org array breakdown.
 */
export async function fetchContentRewardsBalance(orgId?: string) {
  const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
  return api<{ success: boolean } & ContentRewardsBalance>(
    `/wallet/content-rewards/balance${qs}`,
    {},
    getToken()!
  );
}

/**
 * Affiliate's Content Rewards balances broken down per org. One row per
 * org the user has any CR activity in. Use this for the per-org cards in
 * the Vault.
 */
export async function fetchContentRewardsBalancesPerOrg() {
  return api<{ success: boolean; orgs: ContentRewardsOrgBalance[] }>(
    "/wallet/content-rewards/balance?breakdown=1",
    {},
    getToken()!
  );
}

/**
 * Affiliate's ContentRewardsWallet transaction history.
 *
 * With `orgId` → transactions from that one org's OrgRewardsWallet
 *                embedded ledger only. Matches the balance shown by
 *                `fetchContentRewardsBalance(orgId)`.
 * Without     → cross-org rollup from the legacy sources (kept for
 *                un-updated callers).
 */
export async function fetchContentRewardsTransactions(opts?: {
  limit?: number;
  offset?: number;
  type?: "credit" | "debit" | "withdrawal";
  orgId?: string;
}) {
  const params = new URLSearchParams();
  if (opts?.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts?.offset !== undefined) params.set("offset", String(opts.offset));
  if (opts?.type) params.set("type", opts.type);
  if (opts?.orgId) params.set("orgId", opts.orgId);
  const qs = params.toString();
  return api<{
    success: boolean;
    transactions: ContentRewardsTransactionItem[];
    total: number;
  }>(
    `/wallet/content-rewards/transactions${qs ? `?${qs}` : ""}`,
    {},
    getToken()!
  );
}

export interface ContentRewardsTransferResult {
  destination: "store" | "affiliate";
  amountCents: number;
  amountUsd: number;
  contentRewardsBalanceAfter: number;
  destinationBalanceAfter: number;
  walletTransactionId: string;
}

/**
 * Earner self-transfer from per-org Content Rewards (OrgRewardsWallet)
 * into their own Store or Affiliate wallet. Source + destination both key
 * on me.userId, so safe for any authenticated user.
 *
 * `orgId` is the SOURCE bucket — which org's Content Rewards balance to
 * debit. Required for the new per-org system; if omitted the backend
 * falls back to the session orgId for compat.
 */
export async function transferContentRewards(body: {
  destination: "store" | "affiliate";
  amountCents: number;
  orgId?: string;
  note?: string;
}) {
  return api<{ success: boolean; transfer: ContentRewardsTransferResult }>(
    "/wallet/content-rewards/transfer",
    { method: "POST", body: JSON.stringify(body) },
    getToken()!
  );
}

// ── View Refresh ──────────────────────────────────────────────────

export async function refreshSubmissionViews(id: string) {
  return api<{
    success: boolean;
    views: number;
    netViews?: number;
    earnedAmount?: number;
    viewSource?: string;
    cached?: boolean;
    error?: string;
  }>(
    `/content-submissions/${id}/refresh-views`,
    { method: "POST" },
    getToken()!
  );
}

export async function refreshCampaignViews(campaignId: string) {
  return api<{
    success: boolean;
    updated: number;
    total: number;
    results: any[];
  }>(
    `/content-submissions/campaign/${campaignId}/refresh-views`,
    { method: "POST" },
    getToken()!
  );
}

// ── Link Preview & YouTube Ownership ──────────────────────────────

export async function fetchLinkPreview(url: string) {
  return api<{
    success: boolean;
    meta: {
      title: string;
      author: string;
      authorUrl: string;
      thumbnail: string;
      thumbnailWidth?: number;
      thumbnailHeight?: number;
      provider: string;
      description?: string;
    };
  }>(
    `/link-preview?url=${encodeURIComponent(url)}`,
    {},
    getToken()!
  );
}

export async function verifyYouTubeOwnership(videoUrl: string) {
  return api<{
    success: boolean;
    matched: boolean;
    videoChannelId?: string;
    videoChannelTitle?: string;
    userChannelId?: string;
    username?: string;
    error?: string;
  }>(
    `/link-preview/youtube-channel-check?videoUrl=${encodeURIComponent(videoUrl)}`,
    {},
    getToken()!
  );
}
