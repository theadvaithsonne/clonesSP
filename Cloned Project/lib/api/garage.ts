import { getToken, getAdminToken } from "@/lib/auth";

const GARAGE_API_URL =
  process.env.NEXT_PUBLIC_GARAGE_API_URL || "https://test.garage.app";

export async function garageApi<T>(
  path: string,
  opts: RequestInit = {},
  authenticated = false
): Promise<T> {
  const isFormData = opts.body instanceof FormData;
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (authenticated) {
    // Consumer session first (unaffected — every consumer caller already has
    // one); fall back to the garage-admin console's token only when there is
    // no consumer session at all (e.g. the funnel CTA picker's
    // fetchMyAffiliateId call, made from the admin console). The backend
    // now accepts the garage-admin token on these routes, mapping it to the
    // admin's own user record (garagenew-backend 4aeb61dc).
    const token = getToken() ?? getAdminToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${GARAGE_API_URL}${path}`, {
    ...opts,
    headers: {
      ...headers,
      ...(opts.headers as Record<string, string> || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMyAffiliateId(): Promise<string | null> {
  try {
    const res = await garageApi<{ success: boolean; affiliateId: string | null }>(
      "/affiliate/my-affiliate-id",
      { method: "GET" },
      true
    );
    return res.affiliateId || null;
  } catch {
    return null;
  }
}

export interface GarageMeUser {
  id: string;
  email: string;
  name: string;
  profilePicture?: string;
}

/**
 * Pull the canonical profile (name + avatar) from Garage's /auth/me.
 * NC and Garage share JWT secret + user DB, so the NC token is accepted
 * here — this is how affiliate id is already fetched. The avatar URL
 * stored in Garage is what users actually maintain, so the header
 * prefers it over NC's own profile record.
 */
export async function fetchMyGarageProfile(): Promise<GarageMeUser | null> {
  try {
    const res = await garageApi<{ user: GarageMeUser }>(
      "/auth/me",
      { method: "GET" },
      true,
    );
    return res.user || null;
  } catch {
    return null;
  }
}

export interface GarageOffice {
  id: string;
  name: string;
}

/**
 * The offices (organizations) the current user belongs to — from `/auth/me`.
 * Used to populate the Leaderboard's office filter (NetworkChains has no single
 * "current office", so the user picks one; default is All Offices).
 */
export async function fetchMyOffices(): Promise<GarageOffice[]> {
  try {
    const res = await garageApi<{
      user: { organizations?: Array<{ id?: string; _id?: string; name?: string }> };
    }>("/auth/me", { method: "GET" }, true);
    return (res.user?.organizations ?? [])
      .map((o) => ({ id: String(o.id ?? o._id ?? ""), name: o.name ?? "Office" }))
      .filter((o) => o.id);
  } catch {
    return [];
  }
}
