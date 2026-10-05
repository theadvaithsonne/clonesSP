// Endpoints serving BOTH flows, because each is backed by a single collection: folders
// (ds_folder — one folder holds internal and external documents alike), templates
// (ds_template, with two instantiation endpoints), admin rights, the user profile, and the
// analytics summary, which deliberately merges both flows' totals.
//
// The two document types below are imported type-only, purely for the instantiate return
// shapes — this module calls nothing in either flow.

import { getOrgId } from "../auth";
import { api, url, withQuery } from "./client";
import type {
  DsAdminMember,
  DsAdminOverlay,
  DsAnalyticsRange,
  DsAnalyticsSummary,
  DsAssignableRole,
  DsBranding,
  DsBrandingEditor,
  DsBrandingPreview,
  DsEmailKind,
  DsFolder,
  DsPagination,
  DsRole,
  DsTemplate,
  DsUser,
} from "./types";
import type { DsDocument } from "./internal-api";
import type { DsExternalDocument } from "./external-api";

// ── Sync / identity ─────────────────────────────────────────────
export const syncDocusignProfile = () => api<{ status: boolean; data: DsUser }>(url("users/profile"));

// Founder-facing Dashboard tab's charts — one combined call backing the status donut, KPI
// trends, signing-activity bar chart, top-senders list, and recipient-status breakdown.
// Admin/founder only, like getDocumentStats above.
export const getDocusignAnalytics = (range: DsAnalyticsRange = "1m") =>
  api<{ status: boolean; data: DsAnalyticsSummary }>(url(withQuery("analytics/summary", { range })));

// ── Folders (founder/docusign-admin only, enforced server-side) ──────────────
// Folders are per-flow: Agreements and External each have their own set (ds_folder.scope).
//
// `scope` is REQUIRED on both calls below, deliberately. It used to default to "internal", and the
// External tab's own create call omitted it — so a folder made there was written as internal and
// then never appeared in the external list it refetched. A default turns that into silent wrong
// behaviour; making it required turns it into a compile error.
export type FolderScope = "internal" | "external";

export const listFolders = (scope: FolderScope) =>
  api<{
    status: boolean;
    data: {
      folders: DsFolder[];
      // Combined, then per flow — same reason as DsFolder's counts.
      unfiledCount: number;
      internalUnfiledCount?: number;
      externalUnfiledCount?: number;
      maxFolders: number;
    };
  }>(url(withQuery("folders", { scope })));

// 409 when the org already has a folder with that name (case-insensitive).
export const createFolder = (name: string, scope: FolderScope) =>
  api<{ status: boolean; data: DsFolder }>(url("folders"), {
    method: "POST",
    body: JSON.stringify({ name, scope, orgId: getOrgId() }),
  });

export const renameFolder = (id: string, name: string) =>
  api<{ status: boolean; data: DsFolder }>(url(`folders/${id}`), {
    method: "PATCH",
    body: JSON.stringify({ name, orgId: getOrgId() }),
  });

// Documents in the folder are not deleted: they go back to Global.
export const deleteFolder = (id: string) =>
  api<{ status: boolean; data: { documentsUnfiled: number } }>(url(`folders/${id}`), { method: "DELETE" });

// ── Templates ────────────────────────────────────────────────────
// Real server-side pagination + title search, newest first. `search` matches anywhere in the title,
// case-insensitively (the backend escapes it, so punctuation is literal).
export const listTemplates = (page = 1, limit = 20, search?: string) =>
  api<{ status: boolean; data: DsTemplate[]; pagination: DsPagination }>(
    url(withQuery("templates", { page, limit, search: search || undefined }))
  );

export const createTemplate = (data: {
  title: string;
  originalFileUrl: string;
  originalFileKey?: string;
  // SHA-256 of the template's PDF when it is known (copied onto documents made from the template).
  originalFileHash?: string;
  pageCount?: number;
  fields: DsTemplate["fields"];
}) =>
  api<{ status: boolean; data: DsTemplate }>(url("templates"), {
    method: "POST",
    // See createDocument above — orgId sent explicitly from garage_org_id.
    body: JSON.stringify({ ...data, orgId: getOrgId() }),
  });

export const getTemplate = (id: string) => api<{ status: boolean; data: DsTemplate }>(url(`templates/${id}`));

export const deleteTemplate = (id: string) =>
  api<{ status: boolean; message: string }>(url(`templates/${id}`), { method: "DELETE" });

// Creates a new draft document (internal) from a template's file, reusing the template's field layout —
// the fields still use the template's abstract recipientSlot numbers, not real recipient ids, so the
// caller maps recipientSlot -> a real recipient once recipients are added, then saves via setFields.
export const instantiateTemplate = (id: string, data?: { title?: string }) =>
  api<{ status: boolean; data: { document: DsDocument; templateFields: DsTemplate["fields"] } }>(url(`templates/${id}/instantiate`), {
    method: "POST",
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

// Same as instantiateTemplate, but creates an external (esign) document instead.
export const instantiateExternalTemplate = (id: string, data?: { title?: string }) =>
  api<{ status: boolean; data: { document: DsExternalDocument; templateFields: DsTemplate["fields"] } }>(url(`templates/${id}/instantiate-external`), {
    method: "POST",
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

// ── Admin ────────────────────────────────────────────────────────
// scope=roles (default) — everyone holding a docusign role (founder, admin, sender). Real
// server-side pagination, fully self-contained in the docusign backend (no garage platform
// call). orgId is required and validated server-side against the caller's own token — a
// founder/admin can only ever query their own organization, never another one.
export const listDocusignRoleHolders = (orgId: string, page = 1, limit = 20, search?: string) =>
  api<{ status: boolean; data: DsAdminMember[]; pagination: DsPagination }>(
    url(withQuery("admin/members", { orgId, scope: "roles", page, limit, search }))
  );

// scope=all — unbounded, docusign-only overlay (role + counts, no name/email), for merging
// client-side against the live org member list — see DsAdminOverlay above for why this
// shape is different from listDocusignRoleHolders'.
export const listDocusignAdminOverlay = (orgId: string) =>
  api<{ status: boolean; data: DsAdminOverlay[] }>(url(withQuery("admin/members", { orgId, scope: "all" })));

// Founders/admins only. "none" removes the role (they can still sign what's sent to them).
// email/name/profilePicture (from the org's member list) fill in the member's Docusign profile when
// they have never opened Docusign, or it's missing any of them — so the Members tab shows their
// photo right away. The backend never overwrites what the member's own sync stored, and needs an
// email to create a profile at all.
export const setDocusignMemberRole = (
  userId: string,
  role: DsAssignableRole,
  profile: { email?: string; name?: string; profilePicture?: string } = {}
) =>
  api<{
    status: boolean;
    data: {
      userId: string;
      name: string;
      email: string;
      profilePicture: string;
      docusignRole: DsRole;
      isDocusignAdmin: boolean;
      isDocusignSender: boolean;
    };
  }>(url(`admin/members/${encodeURIComponent(userId)}/role`), {
    method: "PUT",
    body: JSON.stringify({ role, ...profile }),
  });

// ── Branding (Admin → Branding; founders/admins only) ─────────────────────────────

// The org's branding plus everything the editor needs (email catalog, default wording, limits). Before
// the first save, `branding` is prefilled with the org's own name and logo.
export const getDocusignBranding = () => api<{ status: boolean; data: DsBrandingEditor }>(url("branding"));

// Saves the whole form. A 400 carries every problem at once on the thrown error's `errors`.
export const updateDocusignBranding = (branding: DsBranding) =>
  api<{ status: boolean; data: DsBrandingEditor }>(url("branding"), {
    method: "PUT",
    body: JSON.stringify(branding),
  });

// Renders the unsaved form as that email would really go out (same builders as the real emails).
export const previewDocusignBranding = (branding: DsBranding, kind: DsEmailKind, signal?: AbortSignal) =>
  api<{ status: boolean; data: DsBrandingPreview }>(url("branding/preview"), {
    method: "POST",
    body: JSON.stringify({ branding, kind }),
    signal,
  });
