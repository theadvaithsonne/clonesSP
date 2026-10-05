import { garageAdminApi } from "@/lib/api";

// Page-level RBAC for garage admins. Mirrors the backend's
// src/config/adminPages.ts — that file is the source of truth, and the
// catalogue below is fetched from it rather than duplicated here, so
// adding a page on the backend surfaces in this UI with no change.
//
// The one rule worth restating on the client: a super admin is not a
// permission set. Nothing a super admin can do is expressible as a page
// level, so no role built in this UI can reach a super-admin-only surface.
// The backend gate denies unmapped paths by default; hiding things here is
// only about not showing people doors they can't open.

export type AdminPageLevel = "none" | "view" | "manage";

/** An independently-grantable write on a page (mirrors the backend). */
export type AdminPageAction = {
  key: string;
  label: string;
  hint?: string;
};

export type AdminPage = {
  key: string;
  label: string;
  group: string;
  manageHint?: string;
  href?: string;
  /** Independent write actions, when a page has more than one write concern. */
  actions?: AdminPageAction[];
};

/** Storage/permission key for a page action — must match the backend. */
export function actionKey(page: string, action: string): string {
  return `${page}:${action}`;
}

export type AdminRolePreset = {
  id: string;
  role: string;
  description: string;
  permissions: Record<string, AdminPageLevel>;
};

export type AdminPageCatalogue = {
  levels: AdminPageLevel[];
  groupLabels: Record<string, string>;
  pages: AdminPage[];
  presets: AdminRolePreset[];
};

export type AdminRoleInUse = {
  role: string;
  adminCount: number;
  permissions: Record<string, AdminPageLevel>;
};

/**
 * What an admin holds when we don't know yet — i.e. their cached
 * `garage_admin_info` was written before this feature and carries no
 * permissions key. Mirrors LEGACY_ADMIN_PERMISSIONS on the backend, which
 * is the real answer the profile refetch is about to return; having the
 * same fallback here avoids a flash of empty sidebar in between.
 */
export const LEGACY_ADMIN_PERMISSIONS: Record<string, AdminPageLevel> = {
  users: "view",
  founders: "view",
  stakeholders: "view",
  organizations: "view",
  unilevel_plus_licenses: "view",
};

export const LEVEL_LABELS: Record<AdminPageLevel, string> = {
  none: "No access",
  view: "View only",
  manage: "Full access",
};

export async function getAdminPageCatalogue(): Promise<AdminPageCatalogue> {
  const res = await garageAdminApi<{ data: AdminPageCatalogue }>(
    "/garage-admin/admin-pages",
    { method: "GET" }
  );
  return res.data;
}

export async function getAdminRolesInUse(): Promise<AdminRoleInUse[]> {
  const res = await garageAdminApi<{ data: AdminRoleInUse[] }>(
    "/garage-admin/admin-roles",
    { method: "GET" }
  );
  return res.data || [];
}

/**
 * Define a role so it exists before anyone holds it.
 *
 * Roles used to be inferred from the admins who had them, so a name typed
 * into the invite dialog vanished on refresh unless an invite went out.
 * This persists the name plus the access grid as a template.
 */
export async function createAdminRole(
  name: string,
  permissions: Record<string, AdminPageLevel>
) {
  return garageAdminApi<{ data: { role: string } }>("/garage-admin/admin-roles", {
    method: "POST",
    body: JSON.stringify({ name, permissions }),
  });
}

/**
 * Edit a stored role — rename it, retemplate its access, or both.
 *
 * Editing the definition does not touch admins already holding the label
 * (access lives on each admin's own document), so this is safe to call
 * without re-permissioning anyone. `name` is the current name; pass
 * `newName` to rename.
 */
export async function updateAdminRole(
  name: string,
  changes: { newName?: string; permissions?: Record<string, AdminPageLevel> }
) {
  return garageAdminApi<{ data: { role: string } }>(
    `/garage-admin/admin-roles/${encodeURIComponent(name)}`,
    { method: "PATCH", body: JSON.stringify(changes) }
  );
}

/** Delete a stored role definition. Admins holding the label keep their access. */
export async function deleteAdminRole(name: string) {
  return garageAdminApi<{ data: { deleted: string } }>(
    `/garage-admin/admin-roles/${encodeURIComponent(name)}`,
    { method: "DELETE" }
  );
}

export async function updateAdminAccess(
  adminId: string,
  body: { role?: string; permissions?: Record<string, AdminPageLevel> }
) {
  return garageAdminApi(`/garage-admin/admins/${adminId}/access`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** Empty map keyed by every page in the catalogue. */
export function emptyPermissions(
  pages: AdminPage[]
): Record<string, AdminPageLevel> {
  return Object.fromEntries(pages.map((p) => [p.key, "none"]));
}

export function levelSatisfies(
  held: AdminPageLevel | undefined,
  required: AdminPageLevel
): boolean {
  if (required === "none") return true;
  if (required === "view") return held === "view" || held === "manage";
  return held === "manage";
}

/**
 * Where to send an admin after login.
 *
 * Super admins land on Analytics → Traction, the business overview that
 * answers "how are we doing" before anything operational. A delegated admin
 * can't open Traction (it's super-only, like every unmapped /garage-admin
 * path), so pick the first page they can actually view. The final fallback is
 * /roles (which shows a clear "super admin only" notice) rather than the old
 * /dashboard, which now just redirects there.
 */
export const SUPER_ADMIN_LANDING = "/garage-admin/analytics/traction";

export async function landingPathForAdmin(info: {
  role?: string;
  isSuperAdmin?: boolean;
  permissions?: Record<string, AdminPageLevel>;
}): Promise<string> {
  if (info.isSuperAdmin || info.role === "garage-super-admin") {
    return SUPER_ADMIN_LANDING;
  }
  try {
    const catalogue = await getAdminPageCatalogue();
    const first = catalogue.pages.find(
      (page) =>
        page.href && levelSatisfies(info.permissions?.[page.key], "view")
    );
    if (first?.href) return first.href;
  } catch {
    /* fall through */
  }
  return "/garage-admin/roles";
}

/**
 * Is the signed-in admin a super admin? Reads the cached info the layout
 * keeps in localStorage. For hiding super-admin-only controls — the API is
 * what actually enforces it.
 */
export function isSuperAdminClient(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem("garage_admin_info");
    if (!raw) return false;
    const info = JSON.parse(raw);
    return info?.role === "garage-super-admin" || !!info?.isSuperAdmin;
  } catch {
    return false;
  }
}

export function countGranted(
  permissions: Record<string, AdminPageLevel> | undefined
): number {
  if (!permissions) return 0;
  // Count PAGE grants only — action keys ("page:action") ride in the same map
  // but aren't sections, so they must not inflate the "N of M granted" count.
  return Object.entries(permissions).filter(
    ([key, value]) => value !== "none" && !key.includes(":")
  ).length;
}

/**
 * Does the admin's map authorise a write ACTION on `page`? Mirrors the
 * backend's permissionsSatisfy for writes: page-level manage is the superset,
 * else the specific action grant. For hiding controls the API still enforces.
 */
export function canDoActionWith(
  permissions: Record<string, AdminPageLevel> | undefined,
  page: string,
  action: string
): boolean {
  if (!permissions) return false;
  return (
    permissions[page] === "manage" ||
    permissions[actionKey(page, action)] === "manage"
  );
}
