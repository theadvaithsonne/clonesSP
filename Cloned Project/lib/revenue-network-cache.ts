// Revenue Network Data Cache
// Stores storeId and customerId to avoid repeated API calls

// ─── In-Memory Page Cache (60s TTL) ──────────────────────────────────────────
// Keyed by page identifier (e.g. "workshops:orgId:upcoming") so navigating away
// and back shows data instantly while a background refresh runs silently.

const PAGE_CACHE_TTL = 60_000; // 60 seconds
const _pageCache = new Map<string, { data: unknown; expiresAt: number }>();

export function getPageCache<T>(key: string): T | null {
  const entry = _pageCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  return null;
}

export function setPageCache<T>(key: string, data: T): void {
  _pageCache.set(key, { data, expiresAt: Date.now() + PAGE_CACHE_TTL });
}

/** Remove all cache entries whose key starts with the given prefix */
export function invalidatePageCache(prefix: string): void {
  for (const key of _pageCache.keys()) {
    if (key.startsWith(prefix)) _pageCache.delete(key);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = "garage_revenue_network_cache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export interface RevenueNetworkCache {
  storeId: string | null;
  storeName: string | null;
  storeSlug: string | null;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  affiliateId: string | null;
  isNativeStore: boolean; // true = native store (use backend APIs), false = EarnGPT store (use Revenue Network APIs)
  timestamp: number;
}

export function getRevenueNetworkCache(): RevenueNetworkCache | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const data: RevenueNetworkCache = JSON.parse(cached);

    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

export function setRevenueNetworkCache(data: Omit<RevenueNetworkCache, "timestamp">): void {
  if (typeof window === "undefined") return;

  try {
    const cacheData: RevenueNetworkCache = {
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    console.log("[REVENUE-CACHE] Cached storeId:", data.storeId, "customerId:", data.customerId);
  } catch (error) {
    console.error("[REVENUE-CACHE] Failed to cache data:", error);
  }
}

export function clearRevenueNetworkCache(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CACHE_KEY);
  console.log("[REVENUE-CACHE] Cache cleared");
}

// Fetch and cache revenue network data (storeId, customerId)
export async function fetchAndCacheRevenueNetworkData(): Promise<RevenueNetworkCache | null> {
  // Check cache first
  const cached = getRevenueNetworkCache();
  if (cached?.storeId) {
    console.log("[REVENUE-CACHE] Using cached data");
    return cached;
  }

  try {
    const token =localStorage.getItem("garage_tok");
    const orgId = localStorage.getItem("garage_org_id");

    if (!token || !orgId) {
      console.warn("[REVENUE-CACHE] No token or orgId found");
      return null;
    }

    // Decode userId from token
    const payload = JSON.parse(
      atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    const userId = payload.userId;

    if (!userId) {
      console.warn("[REVENUE-CACHE] No userId in token");
      return null;
    }

    // Fetch org and profile data in PARALLEL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    console.log("[REVENUE-CACHE] Fetching org and profile data in parallel...");

    const [orgResponse, profileResponse] = await Promise.all([
      fetch(`${apiUrl}/org/${orgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${apiUrl}/profile?userId=${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);

    let storeId: string | null = null;
    let storeName: string | null = null;
    let storeSlug: string | null = null;
    let customerId: string | null = null;
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let affiliateId: string | null = null;
    let isNativeStore = false;

    if (orgResponse.ok) {
      const orgData = await orgResponse.json();
      // Use org._id as storeId since we're using internal backend APIs
      // The backend uses orgId to identify stores/organizations
      isNativeStore = true;
      storeId = orgData.org?._id || null;
      storeName = orgData.org?.store?.name || orgData.org?.name || null;
      storeSlug = orgData.org?.store?.slug || orgData.org?.slug || null;
    }

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      customerId = profileData.earngpt_employee?.customerId || null;
      customerName = profileData.name || null;
      customerEmail = profileData.email || null;
      affiliateId = profileData.earngpt_employee?.affiliateId || null;
    }

    // Cache the data
    const cacheData = { storeId, storeName, storeSlug, customerId, customerName, customerEmail, affiliateId, isNativeStore };
    setRevenueNetworkCache(cacheData);

    return { ...cacheData, timestamp: Date.now() };
  } catch (error) {
    console.error("[REVENUE-CACHE] Failed to fetch data:", error);
    return null;
  }
}

// Hook-friendly getter that returns cached data or fetches if needed
export async function getRevenueNetworkData(): Promise<RevenueNetworkCache | null> {
  const cached = getRevenueNetworkCache();
  if (cached?.storeId) {
    return cached;
  }
  return fetchAndCacheRevenueNetworkData();
}

// ─── Canonical storefront slug ────────────────────────────────────────────
// The slug that garage.app/store/[slug] actually resolves against lives in
// the e-commerce backend's Store record (garage-store), NOT in org.store —
// that org-level slug is a different namespace (used by my.garage.app
// affiliate links) and the two can disagree. Same bearer token works on
// both backends (shared JWT secret).
const ECOMMERCE_API_URL =
  process.env.NEXT_PUBLIC_ECOMMERCE_API_URL || "https://ecommerce.networkchains.com";

export async function getEcommerceStoreSlug(): Promise<string | null> {
  const cached = getPageCache<string>("ecom-store-slug");
  if (cached) return cached;
  try {
    const token = localStorage.getItem("garage_tok");
    if (!token) return null;
    const res = await fetch(`${ECOMMERCE_API_URL}/store`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    const slug: string | null = body?.data?.slug || null;
    if (slug) setPageCache("ecom-store-slug", slug);
    return slug;
  } catch {
    return null;
  }
}
