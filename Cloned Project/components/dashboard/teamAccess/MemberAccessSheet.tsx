"use client";

/**
 * One member's access, plus the audit trail of every grant and revoke that
 * produced it (`GET /rbac/members/:userId` returns the last 100 events).
 *
 * Same rules as the table: inviting creates a 24h offer, revoking is instant.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Clock,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  cancelGrant,
  createGrants,
  fetchMemberDetail,
  notifyRbacChanged,
  resendGrant,
  revokeModule,
  type MemberDetail,
  type ModuleKey,
  type RbacError,
  type RbacModule,
} from "@/lib/rbac-api";
import {
  FounderBadge,
  MemberAvatar,
  moduleIcon,
  relativeTime,
  StatusChip,
  useCountdown,
} from "./shared";

function PendingRow({
  expiresAt,
  onResend,
  onWithdraw,
  busy,
}: {
  expiresAt: string;
  onResend: () => void;
  onWithdraw: () => void;
  busy: boolean;
}) {
  const countdown = useCountdown(expiresAt);
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-medium text-amber-300">
        <Clock className="h-3 w-3" />
        {countdown}
      </span>
      <button
        onClick={onResend}
        disabled={busy}
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-40 cursor-pointer"
        title="Resend — restarts the 24-hour clock"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onWithdraw}
        disabled={busy}
        className="rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-40 cursor-pointer"
        title="Withdraw the invite"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function MemberAccessSheet({
  userId,
  modules,
  onClose,
  onChanged,
}: {
  userId: string | null;
  /** Catalog from `/rbac/members` so labels match the table exactly. */
  modules?: RbacModule[];
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyModule, setBusyModule] = useState<ModuleKey | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setDetail(await fetchMemberDetail(userId));
    } catch (err) {
      toast.error((err as RbacError)?.message || "Couldn't load this member.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setDetail(null);
      return;
    }
    load();
  }, [userId, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (userId) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  const act = useCallback(
    async (module: ModuleKey, fn: () => Promise<void>, done: string) => {
      setBusyModule(module);
      try {
        await fn();
        toast.success(done);
        await load();
        onChanged?.();
        notifyRbacChanged();
      } catch (err) {
        toast.error((err as RbacError)?.message || "That didn't work.");
        await load();
      } finally {
        setBusyModule(null);
      }
    },
    [load, onChanged]
  );

  // The detail route returns a row, not the catalog. Prefer the catalog the
  // table already fetched; fall back to the permission map's own keys so a
  // module the backend adds later still shows up.
  const moduleList: RbacModule[] = detail
    ? modules && modules.length
      ? modules
      : Object.keys(detail.permissions || {}).map((key) => ({
          key,
          label: key
            .split("_")
            .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
            .join(" "),
        }))
    : [];
  const locked = detail ? !detail.editable || detail.isSelf : false;

  return (
    <AnimatePresence>
      {userId && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#121216] shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              {detail ? (
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={detail.name}
                    email={detail.email}
                    src={detail.profilePicture}
                    size={44}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-white">
                        {detail.name || detail.email}
                      </h2>
                      {!detail.editable && <FounderBadge />}
                    </div>
                    <p className="truncate text-xs text-zinc-500">{detail.email}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-zinc-600">
                      {detail.role}
                      {detail.guest ? " · guest" : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <h2 className="text-base font-semibold text-white">Member access</h2>
              )}
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && !detail ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" />
                </div>
              ) : !detail ? (
                <p className="text-sm text-zinc-500">Nothing to show.</p>
              ) : (
                <>
                  {/* Modules */}
                  <h3 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    Module admin
                  </h3>
                  <div className="space-y-2">
                    {moduleList.map(({ key, label }) => {
                      const Icon = moduleIcon(key);
                      const granted = detail.permissions[key] === true;
                      const pending = detail.pending?.[key];
                      const busy = busyModule === key;

                      return (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#1c1c24] px-4 py-3"
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={cn(
                                "h-4 w-4",
                                granted ? "text-[#F87171]" : "text-zinc-500"
                              )}
                            />
                            <span className="text-sm text-white">{label}</span>
                          </div>

                          {locked ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[#F87171]">
                              <ShieldCheck className="h-3 w-3" />
                              {detail.isSelf ? "You" : "Owner"}
                            </span>
                          ) : busy ? (
                            <Loader2 className="h-4 w-4 animate-spin text-brand" />
                          ) : pending ? (
                            <PendingRow
                              expiresAt={pending.expiresAt}
                              busy={busy}
                              onResend={() =>
                                act(
                                  key,
                                  async () => {
                                    await resendGrant(pending.grantId);
                                  },
                                  `${label} invite resent — 24h clock restarted`
                                )
                              }
                              onWithdraw={() =>
                                act(
                                  key,
                                  async () => {
                                    await cancelGrant(pending.grantId);
                                  },
                                  `${label} invite withdrawn`
                                )
                              }
                            />
                          ) : granted ? (
                            <button
                              onClick={() =>
                                act(
                                  key,
                                  async () => {
                                    await revokeModule(detail.userId, key);
                                  },
                                  `Revoked ${label}`
                                )
                              }
                              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 cursor-pointer"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                act(
                                  key,
                                  async () => {
                                    const res = await createGrants(detail.userId, [key]);
                                    if (!res.created.length && res.alreadyPending.length) {
                                      throw new Error(
                                        "An invite is already waiting — use Resend."
                                      );
                                    }
                                  },
                                  `${label} invite sent — expires in 24h`
                                )
                              }
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand transition-colors hover:bg-brand/20 cursor-pointer"
                            >
                              <Send className="h-3 w-3" />
                              Invite
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* History */}
                  <h3 className="mb-3 mt-7 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                    <History className="h-3.5 w-3.5" />
                    History
                  </h3>
                  {(detail.history || []).length === 0 ? (
                    <p className="text-xs text-zinc-600">
                      Nothing granted or revoked yet.
                    </p>
                  ) : (
                    <ol className="relative space-y-3 border-l border-white/10 pl-4">
                      {detail.history.map((h) => (
                        <li key={h.grantId + h.createdAt} className="relative">
                          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[#2a2a35] ring-4 ring-[#121216]" />
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-white">
                              {h.action === "revoke" ? "Revoked" : "Granted"}{" "}
                              {h.moduleLabel}
                            </span>
                            <StatusChip status={h.status} />
                          </div>
                          <p className="mt-0.5 text-[11px] text-zinc-500">
                            {h.grantedBy?.name ? `by ${h.grantedBy.name} · ` : ""}
                            {relativeTime(h.createdAt)}
                            {h.respondedAt
                              ? ` · answered ${relativeTime(h.respondedAt)}`
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
