/**
 * Garage-admin office-KYC client. Uses `garageAdminApi()` (admin JWT), and
 * shares its record shape with the founder-facing `lib/org-kyc.ts`.
 */
import { garageAdminApi } from "@/lib/api";
import type { OrgKycRecord, OrgKycRequirement, OrgKycStatus } from "@/lib/org-kyc";

export interface AdminOrgKycFounder {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  profilePicture?: string;
}

export interface AdminOrgKycListItem {
  orgId: string;
  orgName: string;
  orgSlug?: string;
  orgIcon?: string;
  orgCoverPhoto?: string;
  orgDescription?: string;
  orgCategory?: string;
  /** "City, State, Country" — already joined server-side. */
  orgLocation?: string | null;
  /** Newest office first is the list's default order. */
  orgCreatedAt: string;
  /** First founder, for the row. `founders` has all of them. */
  founder: AdminOrgKycFounder | null;
  /** Optional: an API older than this field omits it entirely. */
  founders?: AdminOrgKycFounder[];
  status: OrgKycStatus;
  requirementCount: number;
  submissionCount: number;
  submittedAt: string | null;
  verifiedAt: string | null;
  updatedAt: string;
}

export const adminOrgKycApi = {
  /** The built-in requirement catalog the picker renders. */
  defaults: () =>
    garageAdminApi<{ data: { requirements: OrgKycRequirement[] } }>(
      "/garage-admin/org-kyc/defaults",
    ).then((r) => r.data.requirements),

  /**
   * Every office, newest first — including ones nobody has requested KYC
   * from yet (they come back as "not_requested"), since picking one of those
   * is the whole point of the console page.
   */
  list: (opts?: { status?: OrgKycStatus; q?: string }) => {
    const qs = new URLSearchParams();
    if (opts?.status) qs.set("status", opts.status);
    if (opts?.q) qs.set("q", opts.q);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return garageAdminApi<{ data: { items: AdminOrgKycListItem[] } }>(
      `/garage-admin/org-kyc${suffix}`,
    ).then((r) => r.data.items);
  },

  /**
   * How many offices are waiting on a reviewer — for the sidebar badge.
   *
   * Counted from the existing status-filtered list rather than a dedicated
   * count endpoint, so the badge needs no API change. `status=submitted`
   * narrows it server-side, so this is not the whole office table.
   */
  pendingCount: async (): Promise<number> => {
    const res = await garageAdminApi<{
      data: { items: AdminOrgKycListItem[] };
    }>("/garage-admin/org-kyc?status=submitted");
    return res.data.items.length;
  },

  get: (orgId: string) =>
    garageAdminApi<{ data: OrgKycRecord }>(
      `/garage-admin/org-kyc/${orgId}`,
    ).then((r) => r.data),

  setRequirements: (orgId: string, requirements: OrgKycRequirement[]) =>
    garageAdminApi<{ data: OrgKycRecord }>(
      `/garage-admin/org-kyc/${orgId}/requirements`,
      { method: "PUT", body: JSON.stringify({ requirements }) },
    ).then((r) => r.data),

  decideSubmission: (
    orgId: string,
    submissionId: string,
    status: "approved" | "rejected",
    note?: string,
  ) =>
    garageAdminApi<{ data: OrgKycRecord }>(
      `/garage-admin/org-kyc/${orgId}/submissions/${submissionId}/decision`,
      { method: "POST", body: JSON.stringify({ status, note }) },
    ).then((r) => r.data),

  verify: (orgId: string, note?: string) =>
    garageAdminApi<{ data: OrgKycRecord }>(
      `/garage-admin/org-kyc/${orgId}/verify`,
      { method: "POST", body: JSON.stringify({ note }) },
    ).then((r) => r.data),

  reject: (orgId: string, note: string) =>
    garageAdminApi<{ data: OrgKycRecord }>(
      `/garage-admin/org-kyc/${orgId}/reject`,
      { method: "POST", body: JSON.stringify({ note }) },
    ).then((r) => r.data),
};
