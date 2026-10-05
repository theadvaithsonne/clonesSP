import apiClient from "./client";
import type { FunnelPage, FunnelTheme } from "@/lib/funnel-pages";
import type { SiteStep } from "@/lib/ai-site/types";

export interface FunnelLink {
  itemType: string;
  itemId: string;
  category?: string;
  orgSlug?: string;
  name: string;
  image?: string;
  price?: number;
  currency?: string;
  commissionPct?: number;
  /** Ready-to-open URL for "general" platform products (NetworkChains/Garage)
   *  whose destination isn't derivable from itemType/itemId. */
  href?: string;
}

export interface Funnel {
  _id: string;
  name: string;
  description?: string;
  referralCode: string;
  link?: FunnelLink;
  content?: { mode: "default" | "custom" | "pages" | "site"; theme?: FunnelTheme };
  /** Set when adopted from the admin library (Garage Funnels). */
  adminFunnelId?: string;
  userId: string;
  orgId?: string;
  createdAt: string;
  updatedAt: string;
}

/** An admin library funnel an affiliate can adopt into Garage Funnels. */
export interface FunnelLibraryItem {
  id: string;
  name: string;
  isDefault: boolean;
  cta: {
    offeringKey?: string;
    offeringId?: string;
    itemType?: string;
    name?: string;
    priceMinor?: number | null;
  } | null;
}

export interface FunnelsResponse {
  ok: boolean;
  funnels: Funnel[];
}

export interface PublicFunnelVideo {
  id: string;
  key?: string;
  title: string;
  subtitle: string;
  videoUrl?: string;
  youtubeId?: string;
  thumbnailUrl?: string;
}

export interface PublicFunnelNode {
  id: string;
  key?: string;
  label: string;
  order: number;
  prompt?: string;
  videos: PublicFunnelVideo[];
  children: PublicFunnelNode[];
}

export interface PublicFunnelTemplate {
  rootQuestion: string;
  options: PublicFunnelNode[];
}

export interface FunnelResponse {
  ok: boolean;
  funnel: Funnel;
  template?: PublicFunnelTemplate | null;
  /** Set for page-designer funnels; null for video/default funnels. */
  pages?: FunnelPage[] | null;
  /** Set for AI-generated site funnels (content.mode "site"); null otherwise. */
  steps?: SiteStep[] | null;
}

export type TrackEvent =
  | "visit"
  | "survey_completed"
  | "option_selected"
  | "video_started"
  | "video_completed"
  | "registered"
  | "product_opened"
  | "page_viewed"
  | "cta_clicked"
  | "form_submitted"
  // C3 Task 7: fired on completion of every step but the last of a
  // pages-mode multi-step form. MUST always carry a per-step `meta` — see
  // `use-funnels.ts`'s `track()` dedupe (`${event}:${meta ?? ""}` per
  // session) and `buildOnPartialHandler` (public-pages.tsx). Mirrored on the
  // backend's `trackEventSchema`/`TRACK_EVENTS` (contacts-backend
  // src/routes/funnels.ts) — the two are independent hand-written unions and
  // must be kept in sync, or this event's POST 400s while `tsc` stays green
  // on both sides.
  | "form_step_completed";

export interface FunnelStep {
  label: string;
  count: number;
  rate: number;
  dropOff: number;
}

export interface FunnelVisitor {
  visitorId: string;
  email: string | null;
  name: string | null;
  lastPhase: string;
  visitedAt: string;
  registeredAt: string | null;
  productOpenedAt: string | null;
}

export interface FunnelVideoStat {
  key: string;
  title: string;
  started: number;
  completed: number;
}
export interface FunnelNodeStat {
  key: string;
  label: string;
  reached: number;
  videos: FunnelVideoStat[];
  children: FunnelNodeStat[];
}
export interface FunnelTreeStats {
  rootQuestion: string;
  visited: number;
  options: FunnelNodeStat[];
}

/** One page's view/drop-off counts, `mode:"pages"` only. Keyed on `slug`
 *  (never `order`/index — see D1's page-designer decision), author-ordered
 *  by the backend. `viewRate` is "% of tracked visitors who reached this
 *  page" — NOT a conversion rate, and its denominator excludes
 *  `instrumentation.untrackedVisitors` (see below). */
export interface FunnelPageStat {
  slug: string;
  title: string;
  views: number;
  viewRate: number;
  dropOff: number;
}

/** A slug with recorded traffic whose page no longer exists in
 *  `funnel.content.pages` (deleted since, or reordered/renamed without a
 *  slug carry-over). Traffic is preserved, not dropped. */
export interface FunnelRemovedPageStat {
  slug: string;
  views: number;
}

/** Per-page view tracking (D1 Task 2) only exists for visits recorded after
 *  it shipped. `untrackedVisitors` predate it (or never fired a qualifying
 *  `page_viewed`) and are excluded from every `FunnelPageStat.viewRate`
 *  denominator — surfaced here explicitly so a UI never presents a rate
 *  computed over a population it doesn't describe. */
export interface FunnelStatsInstrumentation {
  trackedVisitors: number;
  untrackedVisitors: number;
  note: string;
}

export interface FunnelStatsResponse {
  ok: boolean;
  stats: {
    /** Present and `"pages"` only for a `mode:"pages"` (Custom Funnel)
     *  funnel's stats; absent for the legacy video funnel branch. */
    mode?: "pages";
    totalVisitors: number;
    steps: FunnelStep[];
    recentVisitors: FunnelVisitor[];
    tree: FunnelTreeStats;
    /** `mode:"pages"` only, from here down. Optional because the legacy
     *  branch never sends them — treat their absence as "not available",
     *  never as zero. */
    instrumentation?: FunnelStatsInstrumentation;
    pages?: FunnelPageStat[];
    removedPages?: FunnelRemovedPageStat[];
    /** Completion count sourced from `Contact` (D3) — NOT derived from
     *  `FunnelVisit.registeredAt`, which is not unconditionally set on the
     *  pages-mode lead path (only inside `if (visitorId)` in `POST
     *  /:id/lead`, and `visitorId` is optional in `leadSchema`). */
    completedLeads?: number;
  };
}

export const funnelsApi = {
  // Authenticated - list user's funnels
  list: async (): Promise<FunnelsResponse> => {
    const { data } = await apiClient.get<FunnelsResponse>("/funnels");
    return data;
  },

  // Authenticated - the admin funnel library (raw, for admin/debug use)
  getLibrary: async (): Promise<{ ok: boolean; funnels: FunnelLibraryItem[] }> => {
    const { data } = await apiClient.get<{ ok: boolean; funnels: FunnelLibraryItem[] }>(
      "/funnels/library"
    );
    return data;
  },

  // Authenticated - the affiliate's Garage Funnels: all admin funnels shown
  // directly (auto-provisioned per-affiliate refs) with their own attribution.
  garage: async (ref: string): Promise<{ ok: boolean; funnels: Funnel[] }> => {
    const { data } = await apiClient.get<{ ok: boolean; funnels: Funnel[] }>(
      `/funnels/garage?ref=${encodeURIComponent(ref)}`
    );
    return data;
  },

  // Authenticated - create a funnel
  create: async (body: {
    name: string;
    description?: string;
    referralCode: string;
    link?: FunnelLink;
    mode?: "default" | "custom" | "pages" | "site";
    adminFunnelId?: string;
    /** Auto-attaches the opportunity's matched product as the funnel's link,
     *  server-side, when no explicit `link` is supplied. */
    opportunityId?: string;
  }): Promise<FunnelResponse> => {
    const { data } = await apiClient.post<FunnelResponse>("/funnels", body);
    return data;
  },

  // Authenticated - set / change / remove a funnel's product link
  updateLink: async (
    id: string,
    link: FunnelLink | null
  ): Promise<FunnelResponse> => {
    const { data } = await apiClient.patch<FunnelResponse>(`/funnels/${id}`, {
      link,
    });
    return data;
  },

  // Authenticated - delete a funnel
  delete: async (id: string): Promise<{ ok: boolean }> => {
    const { data } = await apiClient.delete<{ ok: boolean }>(
      `/funnels/${id}`
    );
    return data;
  },

  // Public - get funnel by ID (no auth required on backend)
  getPublic: async (id: string): Promise<FunnelResponse> => {
    const { data } = await apiClient.get<FunnelResponse>(
      `/funnels/public/${id}`
    );
    return data;
  },

  // Public - track a visitor event (no auth)
  track: async (
    funnelId: string,
    body: {
      visitorId: string;
      event: TrackEvent;
      referralCode?: string;
      email?: string;
      name?: string;
      meta?: string;
    }
  ): Promise<{ ok: boolean }> => {
    const { data } = await apiClient.post<{ ok: boolean }>(
      `/funnels/${funnelId}/track`,
      body
    );
    return data;
  },

  // Public - submit an opt-in form from a page or site funnel (no auth)
  submitLead: async (
    funnelId: string,
    body: {
      visitorId?: string;
      name?: string;
      email?: string;
      phone?: string;
      /** Arbitrary form fields from a site funnel's lead form (persisted as Rolodex customFields). */
      fields?: Record<string, string>;
      /** true = auto-saved partial (visitor typing, not yet submitted). */
      partial?: boolean;
    }
  ): Promise<{ ok: boolean; created: boolean }> => {
    const { data } = await apiClient.post<{ ok: boolean; created: boolean }>(
      `/funnels/${funnelId}/lead`,
      body
    );
    return data;
  },

  // Authenticated - get funnel stats
  getStats: async (id: string): Promise<FunnelStatsResponse> => {
    const { data } = await apiClient.get<FunnelStatsResponse>(
      `/funnels/${id}/stats`
    );
    return data;
  },
  getSubmissions: async (
    id: string,
    page = 1
  ): Promise<{ submissions: FunnelSubmission[]; total: number }> => {
    const { data } = await apiClient.get<{
      ok: boolean;
      submissions: FunnelSubmission[];
      total: number;
    }>(`/funnels/${id}/submissions?page=${page}`);
    return { submissions: data.submissions ?? [], total: data.total ?? 0 };
  },
};

export interface FunnelSubmission {
  _id: string;
  funnelId: string;
  name?: string;
  email?: string;
  phone?: string;
  fields: Record<string, string>;
  /** "partial" = auto-saved as the visitor typed but never submitted.
   *  Missing on legacy rows (predate auto-save) → treat as completed. */
  status?: "partial" | "complete";
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
}
