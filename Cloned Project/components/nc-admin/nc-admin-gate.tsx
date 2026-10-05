"use client";

/**
 * Blocks the NetworkChains admin section until elevation resolves.
 *
 * The NC data hooks gate on `enabled: !!token`, and elevation is async, so
 * children must not mount until it resolves. Same shape as the NC app's
 * app/(admin)/layout.tsx, minus the OTP branch: a Garage operator who isn't an
 * allowlisted garage-super-admin gets a plain refusal, never an OTP prompt.
 *
 * `ensureNcAdminToken()` resolves an `NcElevationResult`
 * (`{ ok: true; token } | { ok: false; reason: "unauthorized" | "unavailable" }`)
 * rather than a plain `string | null` — the two failure reasons are
 * deliberately distinct and must not be collapsed:
 *   - "unauthorized" — the operator genuinely isn't an allowlisted
 *     garage-super-admin. Render the refusal panel.
 *   - "unavailable" — contacts-backend is unreachable/erroring (or there was
 *     no Garage session to elevate from). Render a different panel with a
 *     retry affordance; never tell the operator they lack access when the
 *     backend is simply down.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, RotateCw, ShieldCheck, WifiOff } from "lucide-react";
import { ensureNcAdminToken, type NcElevationResult } from "@/lib/nc-admin-api/auth";

type GateStatus = "loading" | "ok" | "unauthorized" | "unavailable";

// This repo's tsconfig has `strict: false` (and thus `strictNullChecks`
// unset), so plain `if (!result.ok)` does not narrow NcElevationResult's
// boolean-literal discriminant. Use an explicit type predicate instead —
// the same approach lib/nc-admin-api/auth.ts uses internally for its own
// narrowing (see `isElevationFailure` there).
function isElevationOk(
  result: NcElevationResult,
): result is { ok: true; token: string } {
  return result.ok === true;
}

export function NcAdminGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<GateStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    ensureNcAdminToken().then((result) => {
      if (cancelled) return;
      if (isElevationOk(result)) {
        setStatus("ok");
      } else {
        setStatus(result.reason);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-12 text-center">
        <div className="mb-5 rounded-full border border-white/[0.08] bg-white/[0.03] p-4">
          <ShieldCheck className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">
          No access to NetworkChains admin
        </h2>
        <p className="max-w-md text-sm text-zinc-400">
          These pages are limited to allowlisted NetworkChains super admins. Ask a
          super admin to add your email, then sign in again.
        </p>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-12 text-center">
        <div className="mb-5 rounded-full border border-white/[0.08] bg-white/[0.03] p-4">
          <WifiOff className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">
          NetworkChains admin is temporarily unavailable
        </h2>
        <p className="mb-5 max-w-md text-sm text-zinc-400">
          We couldn&apos;t reach the NetworkChains admin service. This is
          usually transient — try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/[0.08] hover:text-white"
        >
          <RotateCw className="h-3.5 w-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
