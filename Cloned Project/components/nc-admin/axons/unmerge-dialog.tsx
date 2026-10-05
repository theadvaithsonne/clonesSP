"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, GitPullRequestArrow, AlertTriangle, X } from "lucide-react";
import {
  dryRunUnmerge,
  confirmUnmerge,
  isValidObjectId,
  type UnmergeResult,
  type MergeImpact,
  AxonSurfaceDisabledError,
} from "@/lib/nc-admin-api/admin-axons";
import { AdminUnauthorizedError, AdminApiError } from "@/lib/nc-admin-api/admin";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

/** Two-step unmerge flow: DRY-RUN (by merge-log id) → impact diff → CONFIRM.
 *
 * `logId` is the `axon_merge_log` id returned by a prior confirmed merge. */
export function UnmergeDialog({
  initialLogId = "",
  onClose,
  onUnmerged,
}: {
  initialLogId?: string;
  onClose: () => void;
  onUnmerged: (result: UnmergeResult) => void;
}) {
  const [logId, setLogId] = useState(initialLogId);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<MergeImpact | null>(null);
  const [dryRanFor, setDryRanFor] = useState<string | null>(null);
  const [result, setResult] = useState<UnmergeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const trimmed = logId.trim();
  const canDryRun = isValidObjectId(trimmed) && !loading;

  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the whole Garage
  // shell (and this dialog with it). Capped to one recovery attempt per
  // failure episode so a persistently-401ing endpoint can't loop forever.
  // lib/nc-admin-api/auth.ts already clears the stale NC token on every path
  // that throws this error, so no dialog-level clear is needed here.
  const recoveryAttempted = useRef(false);

  // The dialog is conditionally mounted by the parent (`showUnmerge && <UnmergeDialog .../>`),
  // so a Cancel/X during the elevation window below unmounts this component
  // before the retry fires. Guard against issuing the retry (a destructive
  // confirm-unmerge POST, in the worst case) after that.
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
      setError("The merge log was not found.");
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
      const res = await dryRunUnmerge(trimmed, reason || undefined);
      setImpact(res.result.impact ?? null);
      setDryRanFor(trimmed);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
      if (res.result.status === "not_applied") {
        setError("This merge log is missing or already reverted.");
      } else if (res.result.status === "state_mismatch") {
        setError(
          "State mismatch: survivor/retired are not in the expected post-merge state. Unmerge is blocked.",
        );
      }
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
      const res = await confirmUnmerge(trimmed, reason || undefined);
      setResult(res.result);
      onUnmerged(res.result);
      recoveryAttempted.current = false; // healthy again — re-arm for a future episode
    } catch (e) {
      handleErr(e, "Unmerge failed", runConfirm);
    } finally {
      setLoading(false);
    }
  }

  const confirmable = !!impact && dryRanFor === trimmed && !result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0f0f0f] p-6 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequestArrow className="h-4 w-4 text-brand" />
            <h3 className="text-base font-semibold">Unmerge</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-zinc-400">
          Revert a prior merge by its merge-log id. Deterministic and reversible.
          Dry-run first — nothing changes until you confirm.
        </p>

        <label className="mb-1 block text-xs text-zinc-400">
          Merge log id
        </label>
        <input
          type="text"
          value={logId}
          onChange={(e) => {
            setLogId(e.target.value);
            setImpact(null);
            setResult(null);
            setDryRanFor(null);
          }}
          placeholder="24-char ObjectId from the merge result"
          className="mb-1 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 font-mono text-xs text-white placeholder-zinc-600 outline-none focus:border-white/[0.2]"
        />
        {trimmed && !isValidObjectId(trimmed) && (
          <p className="mb-2 text-[10px] text-red-400">Not a valid ObjectId.</p>
        )}

        <label className="mb-1 mt-3 block text-xs text-zinc-400">
          Reason (optional, audited)
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. merge was wrong, legit second account"
          className="mb-4 w-full rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-white/[0.2]"
        />

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Impact diff */}
        {impact && !result && (
          <div className="mb-3 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-3 text-xs text-sky-200">
            <div className="mb-2 font-mono text-[11px] text-sky-300">
              survivor {impact.survivorId} · retired {impact.retiredId}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Contacts back" value={impact.contactsToMove} />
              <Metric label="Synapses back" value={impact.synapsesToMove} />
              <Metric label="Links back" value={impact.linksToMove} />
            </div>
            {impact.keysRemovedFromSurvivor.length > 0 && (
              <div className="mt-2">
                <div className="text-[10px] text-sky-300/70">
                  Keys removed from survivor
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {impact.keysRemovedFromSurvivor.map((k) => (
                    <span
                      key={k}
                      className="rounded bg-sky-500/15 px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Final result */}
        {result && (
          <div
            className={`mb-3 rounded-lg border px-3 py-3 text-xs ${
              result.status === "reverted"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {result.status !== "reverted" && (
                <AlertTriangle className="h-3.5 w-3.5" />
              )}
              Result: {result.status}
            </div>
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
              {confirmable && (
                <button
                  onClick={runConfirm}
                  disabled={loading}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand)_78%,white)] disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GitPullRequestArrow className="h-3.5 w-3.5" />
                  )}
                  Confirm unmerge
                </button>
              )}
            </>
          )}
        </div>
      </div>
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
