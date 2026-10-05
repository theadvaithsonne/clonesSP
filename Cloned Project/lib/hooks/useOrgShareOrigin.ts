"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * The origin an office's PUBLIC links should use.
 *
 * Affiliate and share links were built from `window.location.origin`, so they
 * echoed whichever host the founder happened to be browsing. A white-label
 * office working inside my.garage.app therefore handed out my.garage.app
 * links — sending its own customers to Garage rather than to its brand.
 *
 * Resolving the office's own *verified* domain fixed that but introduced a
 * worse failure: verification only proves DNS + SSL. A domain still attached
 * to an old deployment answers 200 for every path — its stale catch-all route
 * renders instead of 404ing — so links to routes that build never had came
 * back as the generic landing page, dead for every recipient and silent to us.
 *
 * The backend now owns the decision: GET /initial-setup/share-origin returns
 * the office's domain only when a deployment probe (GET /api/app-health on
 * that host) says it is serving the current build, and the canonical Garage
 * origin otherwise. See services/appDomainHealth.ts.
 */
/**
 * @param orgIdOverride resolve for this office instead of the active one.
 *   Callers that already hold an orgId (share dialogs opened for a specific
 *   office) must pass it — the active org in localStorage is not always the
 *   office the link is for.
 */
export function useOrgShareOrigin(orgIdOverride?: string | null): string {
  const [origin, setOrigin] = useState<string>(
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    const orgId =
      orgIdOverride ||
      (typeof window !== "undefined"
        ? localStorage.getItem("garage_org_id")
        : null);
    if (!orgId) return;

    let cancelled = false;
    api<{ origin?: string; domain?: string | null; reason?: string }>(
      `/initial-setup/share-origin?orgId=${encodeURIComponent(orgId)}`
    )
      .then((res) => {
        if (cancelled || !res?.origin) return;
        setOrigin(res.origin.replace(/\/+$/, ""));
      })
      .catch(() => {
        // Backend unreachable or older than this endpoint — keep the current
        // origin, which is the behaviour that shipped before white-labelling.
      });

    return () => {
      cancelled = true;
    };
  }, [orgIdOverride]);

  return origin;
}

/**
 * One-shot form of the hook, for code that needs the origin at a moment (a
 * popup opening) rather than for a whole render. Falls back to the current
 * origin exactly as the hook does.
 */
export async function fetchOrgShareOrigin(orgIdOverride?: string | null): Promise<string> {
  const fallback = typeof window !== "undefined" ? window.location.origin : "";
  const orgId =
    orgIdOverride ||
    (typeof window !== "undefined" ? localStorage.getItem("garage_org_id") : null);
  if (!orgId) return fallback;
  try {
    const res = await api<{ origin?: string }>(
      `/initial-setup/share-origin?orgId=${encodeURIComponent(orgId)}`
    );
    return res?.origin ? res.origin.replace(/\/+$/, "") : fallback;
  } catch {
    return fallback;
  }
}
