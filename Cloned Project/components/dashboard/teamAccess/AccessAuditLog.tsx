"use client";

/**
 * Every grant and revoke ever made in this org (`GET /rbac/grants`).
 *
 * Grant rows are never deleted — expiry flips a status — so this is the full
 * record of who delegated what and whether it was taken up.
 */

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  History,
  Loader2,
  MinusCircle,
  PlusCircle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fetchAuditTrail,
  type GrantHistoryEntry,
  type GrantStatus,
  type ModuleKey,
  type RbacError,
  type RbacModule,
} from "@/lib/rbac-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MemberAvatar, moduleIcon, relativeTime, StatusChip } from "./shared";

const PAGE_SIZE = 50;

const STATUSES: (GrantStatus | "")[] = [
  "",
  "pending",
  "accepted",
  "declined",
  "expired",
  "cancelled",
  "applied",
];

export function AccessAuditLogBody({ modules }: { modules: RbacModule[] }) {
  const [entries, setEntries] = useState<GrantHistoryEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<GrantStatus | "">("");
  const [action, setAction] = useState<"grant" | "revoke" | "">("");
  const [moduleKey, setModuleKey] = useState<ModuleKey | "">("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAuditTrail({
        status: status || undefined,
        action: action || undefined,
        module: moduleKey || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setEntries(res.grants || []);
      setHasMore(!!res.hasMore);
      setTotal(res.total || 0);
    } catch (err) {
      setError((err as RbacError)?.message || "Couldn't load the activity log.");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [status, action, moduleKey, page]);

  useEffect(() => {
    load();
  }, [load]);

  const filterButton = (label: string, active: boolean, onClick: () => void) => (
    <DropdownMenuItem
      key={label}
      onClick={onClick}
      className={cn(
        "cursor-pointer text-xs capitalize focus:bg-white/10 focus:text-white",
        active && "text-brand"
      )}
    >
      {label}
    </DropdownMenuItem>
  );

  return (
    <div className="flex flex-1 flex-col">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs capitalize text-zinc-300 transition-colors hover:text-white cursor-pointer">
              {action || "All actions"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-white/10 bg-[#1c1c24] text-zinc-300">
            {(["", "grant", "revoke"] as const).map((a) =>
              filterButton(a || "All actions", action === a, () => {
                setAction(a);
                setPage(1);
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs capitalize text-zinc-300 transition-colors hover:text-white cursor-pointer">
              {status || "All statuses"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-white/10 bg-[#1c1c24] text-zinc-300">
            {STATUSES.map((s) =>
              filterButton(s || "All statuses", status === s, () => {
                setStatus(s);
                setPage(1);
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex h-9 items-center rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs text-zinc-300 transition-colors hover:text-white cursor-pointer">
              {moduleKey
                ? modules.find((m) => m.key === moduleKey)?.label || moduleKey
                : "All modules"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="border-white/10 bg-[#1c1c24] text-zinc-300">
            {filterButton("All modules", moduleKey === "", () => {
              setModuleKey("");
              setPage(1);
            })}
            {modules.map((m) =>
              filterButton(m.label, moduleKey === m.key, () => {
                setModuleKey(m.key);
                setPage(1);
              })
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto text-xs text-zinc-600">{total} events</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error ? (
          <p className="mt-16 text-center text-sm text-zinc-500">{error}</p>
        ) : loading && entries.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
          </div>
        ) : entries.length === 0 ? (
          <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/10 bg-[#1c1c24] p-8 text-center">
            <History className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm font-medium text-white">No activity yet</p>
            <p className="mt-1 text-xs text-zinc-500">
              Grants and revokes show up here as they happen.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {entries.map((e) => {
              const Icon = moduleIcon(e.module);
              const isRevoke = e.action === "revoke";
              return (
                <li
                  key={`${e.grantId}-${e.createdAt}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1c1c24] px-4 py-3"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                      isRevoke
                        ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                        : "border-brand/20 bg-brand/10 text-brand"
                    )}
                  >
                    {isRevoke ? (
                      <MinusCircle className="h-4 w-4" />
                    ) : (
                      <PlusCircle className="h-4 w-4" />
                    )}
                  </span>

                  <MemberAvatar
                    name={e.member?.name}
                    email={e.member?.email}
                    src={e.member?.profilePicture}
                    size={28}
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-white">
                      <span className="font-medium">
                        {e.member?.name || e.member?.email || "Member"}
                      </span>
                      <span className="text-zinc-400">
                        {" "}
                        {isRevoke ? "lost" : "was offered"}{" "}
                      </span>
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Icon className="h-3 w-3" />
                        {e.moduleLabel}
                      </span>
                    </p>
                    <p className="truncate text-[11px] text-zinc-500">
                      {e.grantedBy?.name ? `by ${e.grantedBy.name} · ` : ""}
                      {relativeTime(e.createdAt)}
                      {e.respondedAt ? ` · answered ${relativeTime(e.respondedAt)}` : ""}
                    </p>
                  </div>

                  <StatusChip status={e.status} />
                </li>
              );
            })}
          </ul>
        )}

        {(hasMore || page > 1) && (
          <div className="mt-4 flex items-center justify-end gap-2 text-xs text-zinc-500">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Prev
            </button>
            <button
              disabled={!hasMore || loading}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog wrapper                                                      */
/* ------------------------------------------------------------------ */

/**
 * The audit trail as a modal, opened from "View audit log" in the page header.
 * The body is kept separate so it can also be embedded inline if needed.
 */
export default function AccessAuditLogDialog({
  open,
  modules,
  onClose,
}: {
  open: boolean;
  modules: RbacModule[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121216] shadow-2xl shadow-black/60"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-5">
              <div className="flex items-start gap-3">
                <span className="rounded-xl border border-brand/20 bg-brand/10 p-2.5">
                  <History className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-white">Audit log</h2>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Every grant and revoke ever made in this office. Rows are
                    never deleted — expiry only flips a status.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <AccessAuditLogBody modules={modules} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
