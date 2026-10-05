"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, GitMerge, AlertTriangle, ArrowRight, X } from "lucide-react";
import {
  dryRunMerge,
  confirmMerge,
  isValidObjectId,
  type RawAxon,
  type ForwardMergeImpact,
  type MergeResult,
  AxonSurfaceDisabledError,
} from "@/lib/nc-admin-api/admin-axons";
import { AdminUnauthorizedError, AdminApiError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

/** Two-step merge flow: DRY-RUN → impact diff → CONFIRM.
 *
 * `aId` is pre-filled with the axon you're viewing; the admin pastes the other
 * axon id (`bId`). The dry-run never mutates; only the explicit Confirm button
 * (visible after a "merge" outcome) calls the backend with confirm:true. */
export function MergeDialog({
  axon,
  onClose,
  onMerged,
}: {
  axon: RawAxon;
  onClose: () => void;
  onMerged: (result: MergeResult) => void;
}) {
  const [bId, setBId] = useState("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<ForwardMergeImpact | null>(null);
  const [result, setResult] = useState<MergeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const aId = axon._id;
  const bTrimmed = bId.trim();
  const canDryRun =
    isValidObjectId(bTrimmed) && bTrimmed !== aId && !loading;

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the whole Garage
  // shell (and this dialog with it). Capped to one recovery attempt per
  // failure episode so a persistently-401ing endpoint can't loop forever.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no dialog-level clear is needed here.
  const recoveryAttempted = useRef(false);

  // The dialog is conditionally mounted by the parent (`showMerge && <MergeDialog .../>`),
  // so a Cancel/X during the elevation window below unmounts this component
  // before the retry fires. Guard against issuing the retry (a destructive
  // confirm-merge POST, in the worst case) after that.
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function handleErr(e: unknown, fallback: string, retry: () => void) {
    if (e instanceof AdminUnauthorizedError) {
      if (recoveryAttempted.current) {
        setError("Session expired. Please try again.");
        return;
      }
      recoveryAttempted.current = true;
      ensureNcAdminToken().then((result) => {
        if (!mountedRef.current) return; // dismissed during elevation — no request, no state update
        if (result.ok === true) {
          retry();
        } else {
          setError("Session expired. Please try again.");
        }
      });
      return;
    }
    if (e instanceof AxonSurfaceDisabledError) {
      setError("The axon was not found.");
      return;
    }
    if (e instanceof AdminApiError) {
      setError(e.message);
      return;
    }
    setError(fallback);
  }

  async function runDryRun() {
    setLoading(true);
    setError("");
    setResult(null);
    setImpact(null);
    try {
      const res = await dryRunMerge(aId, bTrimmed, reason || undefined);
      setImpact(res.impact);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, "Dry-run failed", runDryRun);
    } finally {
      setLoading(false);
    }
  }

  async function runConfirm() {
    setLoading(true);
    setError("");
    try {
      const res = await confirmMerge(aId, bTrimmed, reason || undefined);
      setResult(res.result);
      onMerged(res.result);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, "Merge failed", runConfirm);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0f0f0f] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-brand" />
            <h3 className="text-base font-semibold">Merge axons</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-400">
          Merge another axon into / out of this one. Survivor is chosen by the
          backend (oldest createdAt). This is a dry-run first — nothing changes
          until you confirm.
        </p>

        {/* This axon */}
        <div className="mb-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs">
          <div className="text-zinc-500">This axon (A)</div>
          <div className="font-mono text-zinc-300">{aId}</div>
        </div>

        {/* Other axon id */}
        <label className="mb-1 block text-xs text-zinc-400">
          Other axon id (B)
        </label>
        <input
          type="text"
          value={bId}
          onChange={(e) => {
            setBId(e.target.value);
            setImpact(null);
            setResult(null);
          }}
          placeholder="24-char ObjectId"
          className="mb-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-xs text-white placeholder-zinc-600 outline-none focus:border-white/[0.2]"
        />
        {bTrimmed && !isValidObjectId(bTrimmed) && (
          <p className="mb-2 text-[10px] text-red-400">Not a valid ObjectId.</p>
        )}
        {bTrimmed === aId && (
          <p className="mb-2 text-[10px] text-red-400">
            That is the same axon.
          </p>
        )}

        <label className="mb-1 mt-3 block text-xs text-zinc-400">
          Reason (optional, audited)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. duplicate from CSV import"
          className="mb-4 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-white/[0.2]"
        />

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Impact diff */}
        {impact && !result && <ImpactView impact={impact} />}

        {/* Final result */}
        {result && (
          <div
            className={`mb-3 rounded-lg border px-3 py-3 text-xs ${
              result.status === "merged"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <div className="font-semibold">Result: {result.status}</div>
            {result.survivorId && (
              <div className="mt-1 font-mono text-[11px]">
                survivor {result.survivorId}
              </div>
            )}
            {result.retiredId && (
              <div className="font-mono text-[11px]">
                retired {result.retiredId}
              </div>
            )}
            {result.logId && (
              <div className="mt-1 font-mono text-[11px]">
                log {result.logId} (use to unmerge)
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          {result ? (
            <button
              onClick={onClose}
              className="rounded-lg bg-white/[0.08] px-4 py-2 text-xs font-medium text-white hover:bg-white/[0.12]"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-lg border border-white/[0.08] px-4 py-2 text-xs text-zinc-300 hover:bg-white/[0.04]"
              >
                Cancel
              </button>
              <button
                onClick={runDryRun}
                disabled={!canDryRun}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white hover:bg-white/[0.08] disabled:opacity-30"
              >
                {loading && !impact ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                Dry run
              </button>
              {impact?.outcome === "merge" && (
                <button
                  onClick={runConfirm}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_78%,white)] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitMerge className="h-3.5 w-3.5" />
                  )}
                  Confirm merge
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactView({ impact }: { impact: ForwardMergeImpact }) {
  if (impact.outcome === "noop_same") {
    return (
      <div className="mb-3 rounded-lg border border-zinc-500/30 bg-zinc-500/10 px-3 py-2 text-xs text-zinc-300">
        Same axon — nothing to merge.
      </div>
    );
  }
  if (impact.outcome === "missing") {
    return (
      <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
        One or both axons were not found.
      </div>
    );
  }
  if (impact.outcome === "disputed") {
    return (
      <div className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs text-amber-300">
        <div className="flex items-center gap-1.5 font-semibold">
          <AlertTriangle className="h-3.5 w-3.5" />
          Disputed — conflicting strong keys
        </div>
        <p className="mt-1 text-amber-200/80">
          These axons carry conflicting strong identity keys (e.g. two different
          LinkedIn profiles). A confirm would be quarantined to manual review,
          not merged.
        </p>
        {impact.survivorId && (
          <div className="mt-2 font-mono text-[11px]">
            survivor {impact.survivorId}
          </div>
        )}
        {impact.retiredId && (
          <div className="font-mono text-[11px]">
            retired {impact.retiredId}
          </div>
        )}
      </div>
    );
  }
  // outcome === "merge"
  return (
    <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-200">
      <div className="mb-2 flex items-center gap-2 font-mono text-[11px] text-emerald-300">
        <span>{impact.retiredId}</span>
        <ArrowRight className="h-3 w-3" />
        <span>{impact.survivorId}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Contacts" value={impact.contactsToMove ?? 0} />
        <Metric label="Synapses" value={impact.synapsesToMove ?? 0} />
        <Metric label="Links" value={impact.linksToMove ?? 0} />
      </div>
      {impact.keysAddedToSurvivor && impact.keysAddedToSurvivor.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] text-emerald-300/70">
            Keys added to survivor
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {impact.keysAddedToSurvivor.map((k) => (
              <span
                key={k}
                className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px]"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
      <div className="text-base font-semibold text-white">{value}</div>
      <div className="text-[10px] text-zinc-400">{label}</div>
    </div>
  );
}
