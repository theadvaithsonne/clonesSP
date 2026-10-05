import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";

export interface MyOffice {
  id: string;
  name: string;
  icon?: string;
  role?: "founder" | "stakeholder";
  fullAccess?: boolean;
  guest?: boolean;
  /**
   * The viewer runs this office, so they may not rate it — the backend rejects
   * an owner's review of their own office outright. Mirrors `hasFounderAccess`
   * server-side: an explicit founder role, or a stakeholder granted full
   * access. The block is enforced there; this is only so the picker can say so
   * up front instead of failing on submit.
   */
  isFounder: boolean;
}

/**
 * The offices (organizations) the signed-in user has joined.
 *
 * Reads `/auth/me` on the main API — the same backend that owns `/reviews` —
 * so the ids here are the ones an `office` review is filed against. The
 * lookalike `fetchMyOffices` in `lib/api/garage.ts` talks to a different host
 * and is not interchangeable.
 *
 * Only fetches when `enabled`, so the dialog that uses it costs nothing until
 * it's opened.
 */
export function useMyOffices(enabled = true) {
  const [offices, setOffices] = useState<MyOffice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setOffices([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await api<{
        user: {
          organizations?: Array<{
            id?: string;
            _id?: string;
            name?: string;
            icon?: string;
            role?: "founder" | "stakeholder";
            fullAccess?: boolean;
            guest?: boolean;
          }>;
        };
      }>("/auth/me", {}, token);

      const mapped = (result.user?.organizations ?? [])
        .map((org) => ({
          id: String(org.id ?? org._id ?? ""),
          name: org.name || "Untitled office",
          icon: org.icon,
          role: org.role,
          fullAccess: org.fullAccess,
          guest: org.guest,
          isFounder: org.role === "founder" || org.fullAccess === true,
        }))
        .filter((org) => org.id);

      // A membership can be listed twice (legacy single-org field + the
      // organizations array). Reviews are one-per-office, so a duplicate row
      // would submit the same office twice and 409 against itself.
      const byId = new Map<string, MyOffice>();
      for (const org of mapped) {
        const seen = byId.get(org.id);
        // Founder access wins so the picker correctly greys the office out.
        if (!seen || (!seen.isFounder && org.isFounder)) byId.set(org.id, org);
      }
      setOffices([...byId.values()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your offices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { offices, loading, error, reload: load };
}
