"use client";

/**
 * Member side of Team & Access: the offers waiting on me.
 *
 * This is where the 24-hour lifecycle actually resolves — accepting here is the
 * moment `modulePermissions[module]` flips to `true` and the module's admin
 * console unlocks in the sidebar.
 *
 * Mounted once in the dashboard layout. It opens when:
 *   - a `rbac:open-inbox` event fires (notification click, sidebar badge), or
 *   - a new offer arrives that this browser session hasn't shown yet.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Clock, KeyRound, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyGrants } from "@/lib/hooks/useMyGrants";
import { MemberAvatar, moduleIcon, useCountdown } from "./shared";
import type { MyGrant } from "@/lib/rbac-api";

export const OPEN_ACCESS_INBOX_EVENT = "rbac:open-inbox";

/** Fire from anywhere to pop the inbox (notification row, sidebar badge, …). */
export function openAccessInbox() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_ACCESS_INBOX_EVENT));
  }
}

const SEEN_KEY = "garage_rbac_seen_grants";

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(ids));
  } catch {
    /* private mode */
  }
}

function GrantCard({
  grant,
  busy,
  onAccept,
  onDecline,
}: {
  grant: MyGrant;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const countdown = useCountdown(grant.expiresAt);
  const Icon = moduleIcon(grant.module);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className="overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c24] p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-gradient-to-br from-brand/20 to-brand-2/5">
          <Icon className="h-5 w-5 text-brand" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">
            Admin access to {grant.moduleLabel}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {grant.orgName ? `${grant.orgName} · ` : ""}
            You&rsquo;ll be able to manage everything in this module.
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <MemberAvatar
                name={grant.grantedBy?.name}
                email={grant.grantedBy?.email}
                src={grant.grantedBy?.profilePicture}
                size={18}
              />
              from {grant.grantedBy?.name || grant.grantedBy?.email || "a founder"}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                countdown === "Expired"
                  ? "border-white/10 bg-white/5 text-zinc-400"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              )}
            >
              <Clock className="h-3 w-3" />
              {countdown}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2">
        <button
          onClick={onAccept}
          disabled={busy}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3 py-2 text-xs font-semibold text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </button>
        <button
          onClick={onDecline}
          disabled={busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300 disabled:opacity-50 cursor-pointer"
        >
          Decline
        </button>
      </div>
    </motion.li>
  );
}

export default function AccessInboxModal() {
  const [open, setOpen] = useState(false);
  const { grants, loading, busyGrantId, accept, decline } = useMyGrants();

  // Manual open — notification click, sidebar badge.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ACCESS_INBOX_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ACCESS_INBOX_EVENT, onOpen);
  }, []);

  // Auto-open for offers this session hasn't shown yet. A 24h window is short
  // enough that surfacing it once, unprompted, is the point of the feature.
  useEffect(() => {
    if (loading || grants.length === 0) return;
    const seen = readSeen();
    const fresh = grants.filter((g) => !seen.includes(g.grantId));
    if (fresh.length === 0) return;
    writeSeen([...seen, ...fresh.map((g) => g.grantId)]);
    setOpen(true);
  }, [grants, loading]);

  // Close once the queue empties (last offer answered).
  useEffect(() => {
    if (open && !loading && grants.length === 0) {
      const id = setTimeout(() => setOpen(false), 350);
      return () => clearTimeout(id);
    }
  }, [open, loading, grants.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const count = grants.length;
  const title = useMemo(
    () =>
      count === 1
        ? "You've been given module access"
        : `${count} access invites waiting`,
    [count]
  );

  const close = useCallback(() => setOpen(false), []);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] shadow-2xl shadow-black/60"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl border border-brand/20 bg-brand/10 p-2.5">
                  <KeyRound className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {count === 0 ? "All caught up" : title}
                  </h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {count === 0
                      ? "No access invites waiting on you."
                      : "Accept to turn the access on. Unanswered invites expire 24 hours after they're sent."}
                  </p>
                </div>
              </div>
              <button
                onClick={close}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading && count === 0 ? (
                <div className="flex h-24 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-brand" />
                </div>
              ) : (
                <ul className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {grants.map((g) => (
                      <GrantCard
                        key={g.grantId}
                        grant={g}
                        busy={busyGrantId === g.grantId}
                        onAccept={() => accept(g)}
                        onDecline={() => decline(g)}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
