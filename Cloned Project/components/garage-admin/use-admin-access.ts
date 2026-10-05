"use client";

// What the signed-in garage admin is allowed to do, for hiding controls
// they can't use. The API gate is the enforcement — this is about not
// showing someone a Delete button that will only ever answer 403.
//
// Read through the hook rather than localStorage directly: the value is
// resolved in an effect so the server render and the first client render
// agree (reading localStorage during render would make them differ).

import { useEffect, useState } from "react";
import {
  LEGACY_ADMIN_PERMISSIONS,
  canDoActionWith,
  levelSatisfies,
  type AdminPageLevel,
} from "@/lib/admin-api/permissions";

export type AdminAccess = {
  /** Null until the effect has run — treat as "not yet known". */
  ready: boolean;
  isSuperAdmin: boolean;
  permissions: Record<string, AdminPageLevel>;
  /** Can open the page. */
  canView: (page: string) => boolean;
  /** Can perform ANY write on it. Super admins always can. */
  canManage: (page: string) => boolean;
  /** Can perform one specific write action — page manage OR the action grant. */
  canDoAction: (page: string, action: string) => boolean;
};

export function useAdminAccess(): AdminAccess {
  const [state, setState] = useState<{
    ready: boolean;
    isSuperAdmin: boolean;
    permissions: Record<string, AdminPageLevel>;
  }>({ ready: false, isSuperAdmin: false, permissions: {} });

  useEffect(() => {
    try {
      const raw = localStorage.getItem("garage_admin_info");
      const info = raw ? JSON.parse(raw) : null;
      setState({
        ready: true,
        isSuperAdmin:
          info?.role === "garage-super-admin" || !!info?.isSuperAdmin,
        // Info cached before page-RBAC has no permissions key; fall back to
        // the same legacy set the backend applies for those admins.
        permissions: info?.permissions ?? LEGACY_ADMIN_PERMISSIONS,
      });
    } catch {
      setState({ ready: true, isSuperAdmin: false, permissions: {} });
    }
  }, []);

  return {
    ready: state.ready,
    isSuperAdmin: state.isSuperAdmin,
    permissions: state.permissions,
    canView: (page: string) =>
      state.isSuperAdmin || levelSatisfies(state.permissions[page], "view"),
    canManage: (page: string) =>
      state.isSuperAdmin || levelSatisfies(state.permissions[page], "manage"),
    canDoAction: (page: string, action: string) =>
      state.isSuperAdmin || canDoActionWith(state.permissions, page, action),
  };
}
