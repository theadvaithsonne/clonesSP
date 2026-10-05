"use client";

/**
 * Member side of the 24-hour grant lifecycle: the offers waiting on me, and
 * the two answers I can give.
 *
 * Accepting is the moment access actually turns on, so both answers finish by
 * firing `RBAC_CHANGED_EVENT` — that is what makes the sidebar unlock the
 * module's console without a reload.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  acceptGrant,
  declineGrant,
  fetchMyGrants,
  isExpired,
  notifyRbacChanged,
  RbacError,
  RBAC_CHANGED_EVENT,
  type MyGrant,
} from "@/lib/rbac-api";
import { getToken } from "@/lib/auth";

/**
 * Re-poll often enough that a new offer surfaces — and an expiring one
 * disappears — without a reload. The window is 24h, so this does not need to
 * be tight.
 */
const POLL_MS = 90_000;

export function useMyGrants(options: { orgId?: string | null; poll?: boolean } = {}) {
  const { orgId, poll = true } = options;
  const [grants, setGrants] = useState<MyGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyGrantId, setBusyGrantId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const mounted = useRef(true);
  /** Grant ids this hook has already reported, so a poll only announces new offers. */
  const announced = useRef<Set<string> | null>(null);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
      if (!getToken()) {
        if (!cancelled) {
          setGrants([]);
          setLoading(false);
        }
        return;
      }
      try {
        const list = await fetchMyGrants(orgId);
        if (cancelled) return;
        // The sweeper only runs every 30 minutes, so a lapsed offer can still
        // come back in the list. Hide it client-side too.
        const live = list.filter((g) => !isExpired(g.expiresAt));
        setGrants(live);

        // Announce only *additions*. Removals come from accept/decline, which
        // already fire the event themselves — re-firing on them would loop.
        const seen = announced.current;
        const ids = new Set(live.map((g) => g.grantId));
        announced.current = ids;
        if (seen && live.some((g) => !seen.has(g.grantId))) {
          notifyRbacChanged();
        }
      } catch {
        if (!cancelled) setGrants([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    if (!poll) return () => {
      cancelled = true;
    };

    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tick, orgId, poll]);

  const handleGrantError = useCallback(
    (err: unknown, grantId: string) => {
      const e = err as RbacError;
      if (e?.code === "GRANT_EXPIRED" || e?.status === 410) {
        toast.error("This invite expired. Ask the founder to resend it.");
      } else if (e?.code === "GRANT_NOT_PENDING" || e?.status === 409) {
        toast.error("This invite was already answered or withdrawn.");
      } else if (e?.status === 403) {
        toast.error("This invite isn't yours.");
      } else if (e?.status === 404) {
        toast.error("This invite no longer exists.");
      } else {
        toast.error(e?.message || "Something went wrong.");
        return;
      }
      // Every branch above means the row is stale — drop it immediately.
      setGrants((prev) => prev.filter((g) => g.grantId !== grantId));
    },
    []
  );

  const accept = useCallback(
    async (grant: MyGrant) => {
      setBusyGrantId(grant.grantId);
      try {
        await acceptGrant(grant.grantId);
        if (mounted.current) {
          setGrants((prev) => prev.filter((g) => g.grantId !== grant.grantId));
        }
        toast.success(`${grant.moduleLabel} access is now active`);
        notifyRbacChanged();
        return true;
      } catch (err) {
        handleGrantError(err, grant.grantId);
        notifyRbacChanged();
        return false;
      } finally {
        if (mounted.current) setBusyGrantId(null);
      }
    },
    [handleGrantError]
  );

  const decline = useCallback(
    async (grant: MyGrant) => {
      setBusyGrantId(grant.grantId);
      try {
        await declineGrant(grant.grantId);
        if (mounted.current) {
          setGrants((prev) => prev.filter((g) => g.grantId !== grant.grantId));
        }
        toast.success(`Declined ${grant.moduleLabel} access`);
        notifyRbacChanged();
        return true;
      } catch (err) {
        handleGrantError(err, grant.grantId);
        notifyRbacChanged();
        return false;
      } finally {
        if (mounted.current) setBusyGrantId(null);
      }
    },
    [handleGrantError]
  );

  return { grants, loading, busyGrantId, accept, decline, refresh };
}
