"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import type { DependentCount } from "@/lib/admin-api/danger-zone";

/** One person a destructive action will hit. */
export interface AffectedUser {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
}

/**
 * Confirmation for a permanent delete.
 *
 * The dependent counts are the point of this dialog. Deleting a user or a
 * company cascades nothing — their invoices, wallets and subscriptions stay
 * in the database pointing at an id that no longer resolves — so the operator
 * needs the blast radius on screen before they decide, not a generic "are you
 * sure".
 *
 * Typing the name/email is deliberate friction. The realistic mistake here
 * isn't misunderstanding the dialog, it's having the wrong row selected, and
 * a plain OK button does nothing to catch that.
 */
export default function DangerConfirmDialog({
  open,
  title,
  subject,
  confirmValue,
  confirmLabel,
  dependents,
  totalDependents,
  countsCapped,
  affected,
  extraNote,
  loading,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  /** What's being deleted, shown prominently. */
  subject: string;
  /** The exact string the operator must type. */
  confirmValue: string;
  confirmLabel: string;
  dependents: DependentCount[];
  totalDependents: number;
  /** Any count hit the server cap — totals render as "N+". */
  countsCapped?: boolean;
  /**
   * Exactly who this acts on, shown in full.
   *
   * The realistic mistake in a bulk action isn't misreading the dialog, it's
   * having the wrong rows selected — and a count ("Delete 12 users") can't
   * catch that. Faces and addresses can: an operator recognises a row that
   * shouldn't be there far faster than they parse a list of ids.
   *
   * Every entry is listed; the list scrolls rather than truncating, because
   * the one row you can't see is the one you needed to notice.
   */
  affected?: AffectedUser[];
  /** e.g. "12 members will lose access to this workspace." */
  extraNote?: string | null;
  /** Preview still loading. */
  loading?: boolean;
  /** Delete in flight. */
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");

  // Clear between openings, or the previous subject's confirmation would
  // still be sitting in the box and satisfy the next delete.
  useEffect(() => {
    if (open) setTyped("");
  }, [open, confirmValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const matches =
    typed.trim().toLowerCase() === confirmValue.trim().toLowerCase() &&
    confirmValue.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-red-500/25 bg-[#141419] shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-red-500/10 p-2">
              <AlertTriangle className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{title}</h2>
              <p className="mt-0.5 truncate text-xs text-zinc-500">{subject}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            </div>
          ) : (
            <>
              <p className="mb-3 text-[13px] leading-relaxed text-zinc-300">
                This is permanent and cannot be undone.
              </p>

              {affected && affected.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
                  <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                      {affected.length === 1 ? "Account affected" : "Accounts affected"}
                    </span>
                    <span className="tabular-nums text-[11px] text-zinc-300">
                      {affected.length.toLocaleString()}
                    </span>
                  </div>
                  {/* Caps at ~5 rows tall and scrolls. Every row stays reachable —
                      truncating to "and 20 more" hides exactly the rows an
                      operator needs to spot a mis-selection. */}
                  <ul className="max-h-[220px] overflow-y-auto">
                    {affected.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-2.5 border-b border-white/[0.04] px-3 py-2 last:border-b-0"
                      >
                        <AffectedAvatar src={u.profilePicture} name={u.name || u.email || "?"} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] text-white">
                            {u.name || <span className="text-zinc-500">No name</span>}
                          </div>
                          <div className="truncate text-[11px] text-zinc-400">
                            {u.email || <span className="text-zinc-600">No email</span>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {totalDependents > 0 ? (
                <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3">
                  <p className="mb-2 text-xs font-medium text-amber-300">
                    {totalDependents.toLocaleString()}
                    {countsCapped ? "+" : ""} related record
                    {totalDependents === 1 ? "" : "s"} will be left orphaned
                  </p>
                  <ul className="space-y-1">
                    {dependents.map((d) => (
                      <li
                        key={d.label}
                        className="flex items-center justify-between text-[11px] text-zinc-400"
                      >
                        <span>{d.label}</span>
                        <span className="tabular-nums text-zinc-300">
                          {d.count.toLocaleString()}
                          {d.capped ? "+" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[10px] leading-snug text-zinc-500">
                    These are not deleted — financial and historical records
                    are kept on purpose. They will point at an id that no
                    longer exists.
                  </p>
                </div>
              ) : (
                <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                  <p className="text-xs text-zinc-400">
                    No significant related records found.
                  </p>
                </div>
              )}

              {extraNote && (
                <p className="mb-3 text-[11px] leading-snug text-amber-300/90">
                  {extraNote}
                </p>
              )}

              <label className="mb-1.5 block text-[11px] text-zinc-400">
                {confirmLabel}
              </label>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches && !busy) onConfirm();
                }}
                placeholder={confirmValue}
                className="h-9 w-full rounded-lg border border-white/[0.1] bg-[#0e0e12] px-3 text-sm text-white placeholder-zinc-700 focus:border-red-500/50 focus:outline-none"
              />

              {error && (
                <p className="mt-2 text-[11px] text-red-400">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg border border-white/[0.1] bg-white/[0.03] px-4 text-[13px] text-zinc-200 hover:bg-white/[0.06] disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!matches || busy || loading}
            className="flex h-9 items-center gap-2 rounded-lg bg-red-600 px-4 text-[13px] font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small avatar for the affected list. Mirrors the users table's own Avatar so
 * a row looks the same here as it does in the grid the operator selected it
 * from — recognising a face is the whole point, and a different treatment
 * would undercut that.
 */
function AffectedAvatar({ src, name }: { src: string | null; name: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full border border-white/[0.08] object-cover"
      />
    );
  }
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FFC200] to-[#FFA800] text-[11px] font-semibold text-black">
      {(name || "?").trim().charAt(0).toUpperCase()}
    </div>
  );
}
