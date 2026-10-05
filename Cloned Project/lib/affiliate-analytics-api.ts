// Affiliate Analytics API Client
// Calls backend directly with X-API-KEY

const ANALYTICS_BASE_URL = "https://test.garage.app";
const ANALYTICS_API_KEY = "aq_live_3af793dd5f63b117ca1baba3434568bd5170638eee917036320bae1dc100e8a0";

// ─── Interfaces ───────────────────────────────────────────────────

export interface AffiliateInfo {
  affiliateId: string;
  name: string | null;
  email: string | null;
}

export interface AffiliateItemStats {
  totalSalesVolumeCents: number;
  currency: string;
  salesCount: number;
  businessesCount: number;
  // New in v2:
  uniqueCustomers: number;
  uniqueProducts: number;
  commissionsDistributedCents: number;
  commissionsEarnedCents: number;
}

export interface UnilevelPlusSubscription {
  hasUnilevelPlus: true;
  amount: number;
  currency: string;
  status: "active";
  source: string | null;
  paymentId: string | null;
  purchasedAt: string | null;
}

export interface DirectReferralItem {
  affiliateId: string | null;
  userId: string;
  name: string | null;
  profilePicture: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  joinedAt: string | null;
  stats: AffiliateItemStats;
  subscription?: UnilevelPlusSubscription | null;
}

export interface IndirectReferralItem extends DirectReferralItem {
  level: number;
  directUplineId: string | null;
}

/** Mode A leaderboard row — extends direct with directReferralsCount */
export interface LeaderboardItem extends DirectReferralItem {
  directReferralsCount: number;
}

export interface PaginationInfo {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

export type AnalyticsRange = "1d" | "7d" | "30d" | "90d" | "all";

// ─── Response Types ───────────────────────────────────────────────

export interface DirectReferralsResponse {
  success: boolean;
  data: {
    mode: "affiliate-downline";
    affiliate: AffiliateInfo;
    directReferralsCount: number;
    items: DirectReferralItem[];
    pagination: PaginationInfo;
    limit: number;
    offset: number;
    total: number;
  };
}

export interface LeaderboardResponse {
  success: boolean;
  data: {
    mode: "leaderboard";
    affiliate: null;
    items: LeaderboardItem[];
    pagination: PaginationInfo;
    limit: number;
    offset: number;
    total: number;
  };
}

export interface IndirectReferralsResponse {
  success: boolean;
  data: {
    affiliate: AffiliateInfo;
    indirectReferralsCount: number;
    maxDepth: number;
    items: IndirectReferralItem[];
    pagination: PaginationInfo;
    limit: number;
    offset: number;
    total: number;
  };
}

export interface CategoriesResponse {
  success: boolean;
  data: {
    categories: string[];
    count: number;
  };
}

// Unified row type used by the leaderboard UI (covers all modes)
export type UnifiedLeaderboardRow = DirectReferralItem & {
  /** Only present for indirect referrals */
  level?: number;
  /** Only present for indirect referrals */
  directUplineId?: string | null;
  /** Only present in leaderboard mode (Mode A) */
  directReferralsCount?: number;
  /** "direct", "indirect", or "leaderboard" — set client-side after fetch */
  source: "direct" | "indirect" | "leaderboard";
};

// ─── Fetch Helpers ────────────────────────────────────────────────

/**
 * Mode A: Platform-wide leaderboard — call /affiliate/direct WITHOUT affiliateId.
 * Each row's stats = sum of sales by that user's direct downline.
 */
export async function fetchLeaderboard(params: {
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
  limit?: number;
  offset?: number;
}): Promise<LeaderboardResponse> {
  const qs = new URLSearchParams();
  if (params.officeId) qs.set("officeId", params.officeId);
  if (params.country) qs.set("country", params.country);
  if (params.category) qs.set("category", params.category);
  if (params.range) qs.set("range", params.range);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${ANALYTICS_BASE_URL}/public/analytics/affiliate/direct?${qs.toString()}`, {
    headers: {
      "x-api-key": ANALYTICS_API_KEY,    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

/**
 * Mode B: Affiliate-downline — call /affiliate/direct WITH affiliateId.
 * Each row's stats = that downline user's OWN seller activity.
 */
export async function fetchDirectReferrals(params: {
  affiliateId: string;
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
  limit?: number;
  offset?: number;
}): Promise<DirectReferralsResponse> {
  const qs = new URLSearchParams();
  qs.set("affiliateId", params.affiliateId);
  if (params.officeId) qs.set("officeId", params.officeId);
  if (params.country) qs.set("country", params.country);
  if (params.category) qs.set("category", params.category);
  if (params.range) qs.set("range", params.range);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${ANALYTICS_BASE_URL}/public/analytics/affiliate/direct?${qs.toString()}`, {
    headers: {
      "x-api-key": ANALYTICS_API_KEY,    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

export async function fetchIndirectReferrals(params: {
  affiliateId: string;
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
  level?: number;
  maxDepth?: number;
  limit?: number;
  offset?: number;
}): Promise<IndirectReferralsResponse> {
  const qs = new URLSearchParams();
  qs.set("affiliateId", params.affiliateId);
  if (params.officeId) qs.set("officeId", params.officeId);
  if (params.country) qs.set("country", params.country);
  if (params.category) qs.set("category", params.category);
  if (params.range) qs.set("range", params.range);
  if (params.level) qs.set("level", String(params.level));
  if (params.maxDepth) qs.set("maxDepth", String(params.maxDepth));
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.offset) qs.set("offset", String(params.offset));

  const res = await fetch(`${ANALYTICS_BASE_URL}/public/analytics/affiliate/indirect?${qs.toString()}`, {
    headers: {
      "x-api-key": ANALYTICS_API_KEY,    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch organization categories for the filter dropdown.
 */
export async function fetchCategories(): Promise<string[]> {
  const res = await fetch(`${ANALYTICS_BASE_URL}/public/analytics/categories`, {
    headers: {
      "x-api-key": ANALYTICS_API_KEY,    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  const data: CategoriesResponse = await res.json();
  return data.data.categories;
}

/**
 * Fetches a single page of leaderboard rows (Mode A). Does NOT
 * paginate through all platform users — the leaderboard shows the
 * top results for the given filters, not an exhaustive list.
 */
export async function fetchLeaderboardPage(params: {
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
  limit?: number;
}): Promise<{ items: LeaderboardItem[]; total: number }> {
  const res = await fetchLeaderboard({
    ...params,
    limit: params.limit ?? 200,
    offset: 0,
  });

  return { items: res.data.items, total: res.data.total };
}

/**
 * Fetches EVERY affiliate (Mode A) by looping through all pages until
 * `hasMore` is false. Unlike `fetchLeaderboardPage`, this returns the
 * exhaustive list of all users the API exposes — used to show every
 * affiliate in the "Affiliate Details" view, not just the top page.
 */
export async function fetchAllLeaderboard(params: {
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
}): Promise<{ items: LeaderboardItem[]; total: number }> {
  const pageSize = 200;
  let allItems: LeaderboardItem[] = [];
  let total = 0;
  let offset = 0;

  while (true) {
    const res = await fetchLeaderboard({
      ...params,
      limit: pageSize,
      offset,
    });

    total = res.data.total;
    allItems = [...allItems, ...res.data.items];

    if (!res.data.pagination.hasMore) break;
    offset = res.data.pagination.nextOffset ?? offset + pageSize;
  }

  return { items: allItems, total };
}

/**
 * Fetches ALL pages of direct referrals (Mode B) by looping until hasMore is false.
 */
export async function fetchAllDirectReferrals(params: {
  affiliateId: string;
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
}): Promise<{ items: DirectReferralItem[]; total: number; affiliate: AffiliateInfo }> {
  const pageSize = 200;
  let allItems: DirectReferralItem[] = [];
  let total = 0;
  let affiliate: AffiliateInfo = { affiliateId: "", name: null, email: null };
  let offset = 0;

  while (true) {
    const res = await fetchDirectReferrals({
      ...params,
      limit: pageSize,
      offset,
    });

    affiliate = res.data.affiliate;
    total = res.data.directReferralsCount;
    allItems = [...allItems, ...res.data.items];

    if (!res.data.pagination.hasMore) break;
    offset = res.data.pagination.nextOffset ?? offset + pageSize;
  }

  return { items: allItems, total, affiliate };
}

/**
 * Fetches ALL pages of indirect referrals by looping until hasMore is false.
 */
export async function fetchAllIndirectReferrals(params: {
  affiliateId: string;
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
}): Promise<{ items: IndirectReferralItem[]; total: number }> {
  const pageSize = 200;
  let allItems: IndirectReferralItem[] = [];
  let total = 0;
  let offset = 0;

  while (true) {
    const res = await fetchIndirectReferrals({
      ...params,
      limit: pageSize,
      offset,
    });

    total = res.data.indirectReferralsCount;
    allItems = [...allItems, ...res.data.items];

    if (!res.data.pagination.hasMore) break;
    offset = res.data.pagination.nextOffset ?? offset + pageSize;
  }

  return { items: allItems, total };
}

// ─── Details API Types & Fetcher ───────────────────────────────────

export interface DetailUser {
  _id: string;
  name: string | null;
  email: string | null;
  affiliateId: string | null;
  country: string | null;
  profilePicture: string | null;
  joinedAt: string | null;
}

export interface AffiliateDetailResponse {
  success: boolean;
  data: {
    user: DetailUser | null;
    mode: "leaderboard" | "affiliate-downline";
    detail: "transactions" | "products" | "customers" | "businesses";
    stats: AffiliateItemStats;
    items: any[];
    pagination: PaginationInfo;
  };
}

export async function fetchAffiliateDetails(params: {
  userId: string;
  detail: "transactions" | "products" | "customers" | "businesses";
  mode: "leaderboard" | "affiliate-downline";
  officeId?: string;
  country?: string;
  category?: string;
  range?: AnalyticsRange;
  limit?: number;
  offset?: number;
}): Promise<AffiliateDetailResponse> {
  const { userId, ...rest } = params;
  const qs = new URLSearchParams();
  qs.set("detail", rest.detail);
  qs.set("mode", rest.mode);
  if (rest.officeId) qs.set("officeId", rest.officeId);
  if (rest.country) qs.set("country", rest.country);
  if (rest.category) qs.set("category", rest.category);
  if (rest.range) qs.set("range", rest.range);
  if (rest.limit) qs.set("limit", String(rest.limit ?? 50));
  if (rest.offset) qs.set("offset", String(rest.offset ?? 0));

  const res = await fetch(`${ANALYTICS_BASE_URL}/public/analytics/affiliate/${userId}/details?${qs.toString()}`, {
    headers: {
      "x-api-key": ANALYTICS_API_KEY,    },
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API Error: ${res.status}`);
  }
  return res.json();
}

