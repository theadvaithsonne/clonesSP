"use client";

/**
 * The single gate the client checks before unlocking a module's admin console.
 *
 * `GET /rbac/me` already folds the founder bypass in — founders come back with
 * `isFounder: true` and every module `true` — so callers never have to check
 * role and permissions separately. Non-founders only read `true` for a module
 * once they have *accepted* the founder's offer.
 */

import { useCallback, useEffect, useState } from "react";
import {
  fetchModules,
  fetchMyPermissions,
  currentOrgId,
  RBAC_CHANGED_EVENT,
  type ModuleKey,
  type ModulePermissions,
  type RbacModule,
} from "@/lib/rbac-api";
import { getToken } from "@/lib/auth";

export type ModuleAccess = {
  /** Server-owned module catalog. Never hardcode the keys. */
  modules: RbacModule[];
  permissions: ModulePermissions;
  isFounder: boolean;
  guest: boolean;
  role: string | null;
  /** Offers awaiting my response — drives the inbox badge. */
  pendingCount: number;
  loading: boolean;
  /** `true` for founders on every module. */
  can: (module: ModuleKey) => boolean;
  /** True once at least one module is unlocked (founder or delegated). */
  hasAnyModule: boolean;
  refresh: () => void;
};

const EMPTY: ModulePermissions = {};

export function useModuleAccess(): ModuleAccess {
  const [modules, setModules] = useState<RbacModule[]>([]);
  const [permissions, setPermissions] = useState<ModulePermissions>(EMPTY);
  const [isFounder, setIsFounder] = useState(false);
  const [guest, setGuest] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  // Org switches replace the JWT; grant accept/revoke fires RBAC_CHANGED_EVENT.
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener("garage:token-change", onChange);
    window.addEventListener(RBAC_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener("garage:token-change", onChange);
      window.removeEventListener(RBAC_CHANGED_EVENT, onChange);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const token = getToken();
      const orgId = currentOrgId();
      if (!token || !orgId) {
        if (!cancelled) {
          setPermissions(EMPTY);
          setIsFounder(false);
          setPendingCount(0);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const [catalog, me] = await Promise.all([
          fetchModules().catch(() => [] as RbacModule[]),
          fetchMyPermissions(orgId),
        ]);
        if (cancelled) return;
        setModules(catalog);
        setPermissions(me.permissions || EMPTY);
        setIsFounder(!!me.isFounder);
        setGuest(!!me.guest);
        setRole(me.role || null);
        setPendingCount(me.pendingCount || 0);
      } catch {
        // 403 means "not a member of this org" — treat as no access rather
        // than surfacing an error; the rest of the app already handles the
        // not-a-member case at the layout level.
        if (cancelled) return;
        setPermissions(EMPTY);
        setIsFounder(false);
        setGuest(false);
        setRole(null);
        setPendingCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  const can = useCallback(
    (module: ModuleKey) => isFounder || permissions[module] === true,
    [isFounder, permissions]
  );

  const hasAnyModule =
    isFounder || Object.values(permissions).some((v) => v === true);

  return {
    modules,
    permissions,
    isFounder,
    guest,
    role,
    pendingCount,
    loading,
    can,
    hasAnyModule,
    refresh,
  };
}
