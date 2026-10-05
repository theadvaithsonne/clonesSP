import { api } from "@/lib/api";

/** An office as `/discover/organizations` returns it. */
export type DiscoverOffice = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  coverPhoto?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  createdAt?: string;
  memberCount?: number;
};

export type DiscoverCategory = { name: string; count: number };

export type DiscoverPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/** One office's public profile — the only place `office_public` is exposed. */
export type PublicOfficeDetails = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  coverPhoto?: string;
  category?: string;
  office_public?: boolean;
  founders?: { _id: string; name?: string; profilePicture?: string }[];
};

// The backend drops `search` and `category` straight into a Mongo $regex, so
// a stray "(" or "+" would 500 instead of matching literally.
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Every office on Garage, newest first. The backend matches `search` against
 * the office name only, and lists private offices too — joining one of those
 * goes through a request instead (see requestToJoinOffice).
 */
export function fetchDiscoverOffices(params: {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set("search", escapeRegex(params.search));
  // Office categories are free text, so "Creative" is also stored as
  // "Creative " — tolerate the stray whitespace (case is already ignored).
  if (params.category) qs.set("category", `\\s*${escapeRegex(params.category.trim())}\\s*`);
  qs.set("page", String(params.page ?? 1));
  qs.set("limit", String(params.limit ?? 12));
  return api<{ organizations: DiscoverOffice[]; pagination: DiscoverPagination }>(
    `/discover/organizations?${qs.toString()}`
  );
}

/**
 * Categories that at least one office uses, most used first. The backend
 * groups by the exact stored string, so "Marketing", "marketing" and
 * "Marketing " arrive separately; they're merged here under the most used
 * spelling.
 */
export async function fetchDiscoverCategories(): Promise<DiscoverCategory[]> {
  const res = await api<{ categories: DiscoverCategory[] }>("/discover/categories");
  const merged = new Map<string, DiscoverCategory>();
  for (const c of res.categories || []) {
    const name = (c.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = merged.get(key);
    if (existing) existing.count += c.count;
    else merged.set(key, { name, count: c.count });
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}

export async function fetchPublicOffice(orgId: string): Promise<PublicOfficeDetails> {
  const res = await api<{ organization: PublicOfficeDetails }>(
    `/public/hq-organizations/${orgId}`
  );
  return res.organization;
}

/** An office ranked by how many people joined it in the window. */
export type TrendingOffice = DiscoverOffice & { recentJoins: number };

/**
 * Offices that gained the most members in the last `days`, most first.
 * Offices nobody joined in that window aren't included.
 */
export async function fetchTrendingOffices({ days = 7, limit = 6 } = {}) {
  const res = await api<{ days?: number; organizations: TrendingOffice[] }>(
    `/discover/trending?days=${days}&limit=${limit}`
  );
  return { days: res.days ?? days, offices: res.organizations || [] };
}

/** Join an open office (`office_public`). Private ones answer 403. */
export function joinPublicOffice(userId: string, orgId: string) {
  return api<{ alreadyMember?: boolean }>("/guest-auth/public-join", {
    method: "POST",
    body: JSON.stringify({ guestUserId: userId, orgId }),
  });
}

/** Ask a private office's founders to let you in. */
export function requestToJoinOffice(userId: string, orgId: string, name?: string) {
  return api<{ message?: string }>("/guest-auth/request-join", {
    method: "POST",
    body: JSON.stringify({ guestUserId: userId, orgId, name }),
  });
}
