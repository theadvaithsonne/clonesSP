"use client";

import { useEffect, useRef } from "react";

/** Fired after lead create/update so the CRM dashboard can refetch counts & conversion rate. */
export const DEALS_CRM_STATS_REFRESH_EVENT = "deals:crm-stats-refresh";

/** Fired when CRM leads list should refetch (e.g. after Facebook import). */
export const DEALS_LEADS_REFRESH_EVENT = "deals:leads-refresh";

export function dispatchDealsLeadsRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DEALS_LEADS_REFRESH_EVENT));
}

/** Optimistically add a follow-up to Activities & Follow-ups before/without API lag. */
export const DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT = "deals:activity-followup-append";

export function dispatchDealsActivityFollowUpAppend(
  activity: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DEALS_ACTIVITY_FOLLOWUP_APPEND_EVENT, {
      detail: { activity },
    })
  );
}

export type DealsInlineSection =
  | "dashboard"
  | "leads"
  | "leads-detail"
  | "funnel"
  | "contacts"
  | "companies"
  | "products"
  | "cms";

/** Fired from BackOffice Deals header refresh button (no full page reload). */
export const DEALS_INLINE_REFRESH_EVENT = "deals:inline-refresh";

/** Fired from Deals mobile nav to switch inline section without closing the app. */
export const DEALS_INLINE_NAVIGATE_EVENT = "deals:inline-navigate";

export type DealsInlineNavigateSection = Exclude<DealsInlineSection, "leads-detail">;

export function dispatchDealsInlineNavigate(section: DealsInlineNavigateSection) {
  if (typeof window === "undefined") return;
  const navigate = () => {
    window.dispatchEvent(
      new CustomEvent(DEALS_INLINE_NAVIGATE_EVENT, {
        detail: { section },
      })
    );
  };
  if (section === "cms") {
    // Lazy import avoids pulling CMS gate into every deals bundle consumer at module init.
    void import("@/lib/cms/accessGate").then(({ requestCmsAccess }) => {
      requestCmsAccess(navigate);
    });
    return;
  }
  navigate();
}

export function dispatchDealsInlineRefresh(section: DealsInlineSection) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(DEALS_INLINE_REFRESH_EVENT, {
      detail: { section },
    })
  );
}

export function isDealsInlineMode(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).__garageDealsInline);
}

/** Open a lead inside the Deals inline overlay (no route navigation). */
export function openDealsLeadInline(leadId: string) {
  if (typeof window === "undefined" || !leadId) return false;
  if (!isDealsInlineMode()) return false;

  try {
    sessionStorage.setItem("deals:inline-pending-lead-id", String(leadId));
  } catch {
    // ignore storage errors
  }

  window.dispatchEvent(
    new CustomEvent("deals:open-lead-inline", {
      detail: { leadId: String(leadId) },
    })
  );
  return true;
}

/** Refetch active Deals section when inline refresh is triggered. */
export function useDealsInlineRefresh(
  section: DealsInlineSection,
  onRefresh: () => void | Promise<void>
) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!isDealsInlineMode()) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: DealsInlineSection }>).detail;
      if (detail?.section !== section) return;
      void onRefreshRef.current();
    };

    window.addEventListener(DEALS_INLINE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(DEALS_INLINE_REFRESH_EVENT, handler);
  }, [section]);
}
