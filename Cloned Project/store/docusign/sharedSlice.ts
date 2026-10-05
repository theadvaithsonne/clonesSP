// Store state serving BOTH flows: identity, the merged dashboard stats and analytics, the
// folder list (one collection holds internal and external documents alike), and the org
// member directory.
//
// fetchStats deliberately lives here rather than in either flow: it writes internal and
// external counts in a single set() from one Promise.all, and splitting it would either
// duplicate the call or tear the two halves apart.

import type { StateCreator } from "zustand";
import { toast } from "sonner";
import { getOrgId, getUserDataFromToken } from "@/lib/auth";
import type { DsFolder, DsUser, DsAnalyticsSummary, DsAnalyticsRange } from "@/lib/docusign/types";
import { getDocumentStats } from "@/lib/docusign/internal-api";
import { getExternalDocumentStats } from "@/lib/docusign/external-api";
import { syncDocusignProfile, listFolders, getDocusignAnalytics, type FolderScope } from "@/lib/docusign/shared-api";
import { canSendDocuments, isDocusignAdminUser } from "@/lib/docusign/access";
import type { DocusignState } from "./state";
import type { DocusignStats, ExternalStats, OrgMemberLite } from "./types";

// Per-slice stale-response guard — see the equivalent note in internalSlice.ts. The Dashboard's
// date-range toggle can fire overlapping analytics fetches, and an older range must not land last.
const latestRequest = { stats: 0, analytics: 0 };

export interface SharedSlice {
  me: DsUser | null;
  isSyncing: boolean;
  syncError: string | null;

  stats: DocusignStats | null;
  externalStats: ExternalStats | null;
  isLoadingStats: boolean;

  // The Dashboard tab's analytics widgets (KPI cards, donut, bar chart, top senders) — a
  // separate fetch from `stats` above since it's range-scoped and only loads when that tab is open.
  analytics: DsAnalyticsSummary | null;
  isLoadingAnalytics: boolean;

  // Founder/admin-managed folders (flat), kept per flow: Agreements and External have separate
  // folder sets (ds_folder.scope), so one list would show each tab the other's folders. `loaded`
  // lets callers fetch lazily, once per flow.
  folders: DsFolder[];
  externalFolders: DsFolder[];
  unfiledCount: number;
  externalUnfiledCount: number;
  maxFolders: number;
  foldersLoaded: boolean;
  externalFoldersLoaded: boolean;
  isLoadingFolders: boolean;
  isLoadingExternalFolders: boolean;

  orgMembers: OrgMemberLite[];
  isLoadingOrgMembers: boolean;

  // Admin-level access: Dashboard, folders, every document in the org, the Admin tab.
  isFounderOrAdmin: () => boolean;
  // Founder, admin or sender — may create/send documents and templates (lib/docusign/access.ts).
  canSendDocuments: () => boolean;

  // Which Docusign "tab" is showing — driven by the global bottom nav dock in
  // app/(dashboard)/layout.tsx, not local component state, since the dock and
  // DocusignPage are different parts of the React tree (same reason Taskroom's dock
  // shares `projectActiveItem` via its own store instead of a prop). One of
  // "Dashboard" | "Agreements" | "External" | "Templates" | "Admin" | "Assigned".
  activeTab: string | null;
  setActiveTab: (tab: string) => void;

  sync: () => Promise<DsUser | null>;
  // Resolves to false when the folders could not be loaded (a toast has already been shown unless `silent`).
  // scope is required for the same reason it is on listFolders/createFolder — see shared-api.ts.
  fetchFolders: (scope: FolderScope, opts?: { silent?: boolean }) => Promise<boolean>;
  fetchStats: () => Promise<void>;
  fetchAnalytics: (range?: DsAnalyticsRange) => Promise<void>;
  // page/size are sent as query params for forward-compatibility, but the org-users API
  // (verified live) ignores them and always returns every org member regardless — so the
  // store still always ends up holding the full list. Callers that need real pagination
  // (the Admin tab) slice this full list client-side themselves; callers that need
  // everyone (the recipient picker) just do not pass page/size at all.
  // Resolves to false when the members could not be loaded (a toast has already been shown).
  fetchOrgMembers: (page?: number, size?: number) => Promise<boolean>;
}

export const createSharedSlice: StateCreator<DocusignState, [], [], SharedSlice> = (set, get) => ({
  me: null,
  isSyncing: false,
  syncError: null,

  stats: null,
  externalStats: null,
  isLoadingStats: false,

  analytics: null,
  isLoadingAnalytics: false,

  folders: [],
  externalFolders: [],
  unfiledCount: 0,
  externalUnfiledCount: 0,
  maxFolders: 100,
  foldersLoaded: false,
  externalFoldersLoaded: false,
  isLoadingFolders: false,
  isLoadingExternalFolders: false,

  orgMembers: [],
  isLoadingOrgMembers: false,

  activeTab: null,
  setActiveTab: (tab) => set({ activeTab: tab }),

  isFounderOrAdmin: () => isDocusignAdminUser(get().me),
  canSendDocuments: () => canSendDocuments(get().me),

  sync: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      const res = await syncDocusignProfile();
      set({ me: res.data, isSyncing: false });
      // Resolve the landing tab once, the first time a profile loads — the dock
      // (layout.tsx) needs this to pick which pill highlights before the user has
      // clicked anything. Never overwrites a tab the user (or the dock) already set.
      // Senders have no Dashboard, so they land on their Agreements.
      const landingTab = isDocusignAdminUser(res.data) ? "Dashboard" : canSendDocuments(res.data) ? "Agreements" : "Assigned";
      set((s) => ({ activeTab: s.activeTab ?? landingTab }));
      return res.data;
    } catch (err: any) {
      set({ isSyncing: false, syncError: err.message || "Failed to sync Docusign profile" });
      return null;
    }
  },

  // One fetcher for both flows — the endpoint is the same, only the scope differs — writing into
  // whichever flow's slot was asked for.
  fetchFolders: async (scope, opts) => {
    const isExternal = scope === "external";
    set(isExternal ? { isLoadingExternalFolders: true } : { isLoadingFolders: true });
    try {
      const res = await listFolders(scope);
      // The backend already filters by scope, so `unfiledCount` is this flow's number. The
      // per-flow fields are only read as a fallback for a backend that predates the split.
      const unfiled =
        (isExternal ? res.data.externalUnfiledCount : res.data.internalUnfiledCount) ?? res.data.unfiledCount;
      set(
        isExternal
          ? {
              externalFolders: res.data.folders,
              externalUnfiledCount: unfiled,
              maxFolders: res.data.maxFolders,
              externalFoldersLoaded: true,
              isLoadingExternalFolders: false,
            }
          : {
              folders: res.data.folders,
              unfiledCount: unfiled,
              maxFolders: res.data.maxFolders,
              foldersLoaded: true,
              isLoadingFolders: false,
            }
      );
      return true;
    } catch (err: any) {
      set(isExternal ? { isLoadingExternalFolders: false } : { isLoadingFolders: false });
      if (!opts?.silent) toast.error(err.message || "Failed to load folders");
      return false;
    }
  },

  // Backs the Dashboard tab's stat tiles — both systems' counts fetched in parallel.
  fetchStats: async () => {
    const requestId = ++latestRequest.stats;
    set({ isLoadingStats: true });
    try {
      const [internal, external] = await Promise.all([getDocumentStats(), getExternalDocumentStats()]);
      if (requestId !== latestRequest.stats) return;
      set({ stats: internal.data, externalStats: external.data, isLoadingStats: false });
    } catch (err: any) {
      if (requestId !== latestRequest.stats) return;
      set({ isLoadingStats: false });
      toast.error(err.message || "Failed to load dashboard stats");
    }
  },

  // Backs the Dashboard tab's analytics widgets (KPI cards, status donut, signing-activity bar
  // chart, top senders). Re-fetches whenever the caller changes the date-range toggle.
  fetchAnalytics: async (range) => {
    const requestId = ++latestRequest.analytics;
    set({ isLoadingAnalytics: true });
    try {
      const res = await getDocusignAnalytics(range);
      if (requestId !== latestRequest.analytics) return;
      set({ analytics: res.data, isLoadingAnalytics: false });
    } catch (err: any) {
      if (requestId !== latestRequest.analytics) return;
      set({ isLoadingAnalytics: false });
      toast.error(err.message || "Failed to load dashboard analytics");
    }
  },

  fetchOrgMembers: async (page, size) => {
    set({ isLoadingOrgMembers: true });
    try {
      // garage_org_id can be briefly unset right after a fresh sign-in — fall back to
      // the orgId already embedded in the garage_tok claims rather than failing silently.
      const orgId = getOrgId() || getUserDataFromToken().orgId;
      if (!orgId) throw new Error("No organization selected");

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://test.garage.app";
      const qs = new URLSearchParams();
      if (page !== undefined) qs.set("page", String(page));
      if (size !== undefined) qs.set("size", String(size));
      const query = qs.toString() ? `?${qs.toString()}` : "";
      const res = await fetch(`${apiUrl.replace(/\/+$/, "")}/public/organizations/${orgId}/users${query}`);
      if (!res.ok) throw new Error(`Failed to load organization members (${res.status})`);
      const json = await res.json();
      // Each user's `_id` here (the main garage backend's canonical user id) is what
      // gets stored as ds_recipient.userId — see RecipientsPanel's addRecipient. Note:
      // the page/size params above are sent but not honored server-side (confirmed by
      // direct testing — every page returns the identical full list), so this always
      // ends up holding every org member regardless of what was requested.
      //
      // name/email are coerced to strings here rather than trusted from the payload.
      // The org genuinely contains members with neither (see RecipientPicker's
      // filterMembers), and OrgMemberLite declares `email: string` — so without this the
      // type is a lie and every consumer that calls a string method on it is one bad row
      // away from throwing. Normalising once at the boundary makes the declared type
      // true instead of pushing `?.` onto every call site. The picture is normalised the
      // same way: callers of this API across the app read it under three different keys
      // (see WorkspacePeopleDashboard), so it's resolved once here to `profilePicture` —
      // which the Members tab also sends to the backend when giving someone a role.
      const users: any[] = json?.data?.users || [];
      set({
        orgMembers: users.map((u) => ({
          ...u,
          name: u?.name || "",
          email: u?.email || "",
          profilePicture: u?.profilePicture || u?.image || u?.avatar || "",
        })),
        isLoadingOrgMembers: false,
      });
      return true;
    } catch (err: any) {
      set({ isLoadingOrgMembers: false });
      toast.error(err.message || "Failed to load organization members");
      return false;
    }
  },
});
