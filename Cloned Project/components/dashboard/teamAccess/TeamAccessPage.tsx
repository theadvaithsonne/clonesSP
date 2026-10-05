"use client";

/**
 * Team & Access — the founder's delegation console.
 *
 * This table is a list of *delegations*, not a directory. A member only earns a
 * row once they hold a module, have a live offer, or have one that lapsed.
 * Everyone else stays out of the way until they're invited — otherwise a
 * 400-person office buries the three people who actually have access.
 *
 * Two backend rules drive every action here:
 *   - Granting is an OFFER. It creates a pending grant with a 24h expiry and
 *     changes nothing until the member accepts.
 *   - Revoking is an ACT. It applies immediately and cancels any live offer for
 *     the same module.
 *
 * Three sources feed one row:
 *   permissions[mod] === true   -> Admin    (live access)
 *   pending[mod]                -> Pending  (unanswered, clock running)
 *   expired grant from the log  -> Expired  (`/rbac/members` only reports LIVE
 *                                            offers, so these come from
 *                                            `GET /rbac/grants?status=expired`)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  History,
  Info,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  ShieldOff,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  cancelGrant,
  createGrants,
  fetchAllMembers,
  fetchAuditTrail,
  hasAnyAccess,
  notifyRbacChanged,
  resendGrant,
  revokeAllModules,
  revokeModule,
  type GrantHistoryEntry,
  type MemberRow,
  type ModuleKey,
  type RbacError,
  type RbacModule,
} from "@/lib/rbac-api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AdminPill,
  ExpiredPill,
  MemberAvatar,
  moduleIcon,
  NoAccessPill,
  PendingPill,
  RoleBadge,
  StatusDot,
  type RowStatus,
} from "./shared";
import MemberAccessSheet from "./MemberAccessSheet";
import AccessAuditLogDialog from "./AccessAuditLog";
import InvitePeopleDialog from "./InvitePeopleDialog";

const PAGE_SIZE = 25;

type RoleFilter = "all" | "owner" | "member";
type StatusFilter = "all" | "active" | "pending" | "expired";

/** Expired grants keyed by user, then module. */
type ExpiredMap = Record<string, Record<ModuleKey, GrantHistoryEntry>>;

type PendingConfirm =
  | { kind: "revoke-module"; row: MemberRow; module: ModuleKey; label: string }
  | { kind: "revoke-all"; row: MemberRow }
  | null;

function rowStatus(
  row: MemberRow,
  expired: Record<string, unknown> | undefined
): RowStatus {
  if (!row.editable) return "active"; // owner — permanent full access
  if (Object.values(row.permissions || {}).some(Boolean)) return "active";
  if (Object.keys(row.pending || {}).length > 0) return "pending";
  if (expired && Object.keys(expired).length > 0) return "expired";
  return "none";
}

/* ------------------------------------------------------------------ */
/* Empty states                                                        */
/* ------------------------------------------------------------------ */

function EmptyCard({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-white/10 bg-[#1c1c24] p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-zinc-400">{subtitle}</p>
      <div className="mt-5">{action}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Permission reference                                                */
/* ------------------------------------------------------------------ */

function PermissionReference({ modules }: { modules: RbacModule[] }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs text-zinc-400 transition-colors hover:text-white cursor-pointer">
          <Info className="h-3.5 w-3.5" />
          Permission reference
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 border-white/10 bg-[#1c1c24] p-4 text-zinc-300"
      >
        <p className="text-xs font-semibold text-white">
          Access is binary per module
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          Someone is a module admin or they are not — there is no viewer or
          editor tier. A module admin gets that module&rsquo;s full console;
          nothing else in the office changes.
        </p>
        <div className="mt-3 space-y-2">
          {modules.map((m) => {
            const Icon = moduleIcon(m.key);
            return (
              <div key={m.key} className="flex items-start gap-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#F87171]" />
                <span className="text-[11px] text-zinc-300">
                  <span className="font-medium text-white">{m.label}</span> — can
                  manage everything under the {m.label} console.
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 border-t border-white/10 pt-3 text-[11px] text-zinc-500">
          Owners hold every module permanently and can&rsquo;t be edited.
          Invites expire 24 hours after they&rsquo;re sent.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

function ConfirmRevoke({
  confirm,
  busy,
  onCancel,
  onConfirm,
}: {
  confirm: PendingConfirm;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirm) return null;
  const isAll = confirm.kind === "revoke-all";
  const who = confirm.row.name || confirm.row.email;

  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1c1c24] p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              {isAll ? "Revoke all access?" : `Revoke ${confirm.label}?`}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {isAll
                ? `${who} loses admin control of every module they hold. This applies immediately.`
                : `${who} loses admin control of ${confirm.label} immediately. Any unanswered invite for it is withdrawn too.`}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-600 disabled:opacity-50 cursor-pointer"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Revoke
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TeamAccessPage() {
  const [allRows, setAllRows] = useState<MemberRow[]>([]);
  const [modules, setModules] = useState<RbacModule[]>([]);
  const [expiredMap, setExpiredMap] = useState<ExpiredMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "">("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);

  /* --- load --------------------------------------------------------- */

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // The roster has to be complete: "who has access" can't be evaluated a
      // page at a time, and the invite dialog resolves typed emails against it
      // because /rbac/grants takes user ids only.
      const { rows, modules: catalog } = await fetchAllMembers();
      setAllRows(rows);
      setModules(catalog);

      // A lapsed invite leaves no trace on the member row, so pull expired
      // grants from the audit trail. That keeps those people visible and their
      // offers revivable via /resend instead of silently disappearing.
      try {
        const audit = await fetchAuditTrail({ status: "expired", limit: 200 });
        const map: ExpiredMap = {};
        for (const g of audit.grants || []) {
          const uid = g.member?.id;
          if (!uid) continue;
          map[uid] = map[uid] || {};
          const prev = map[uid][g.module];
          // Keep the most recent lapse per module — that's the one to revive.
          if (!prev || new Date(g.createdAt) > new Date(prev.createdAt)) {
            map[uid][g.module] = g;
          }
        }
        setExpiredMap(map);
      } catch {
        setExpiredMap({}); // audit is additive; the table works without it
      }
    } catch (err) {
      const e = err as RbacError;
      setError(
        e?.status === 403
          ? "Only owners can manage team access."
          : e?.message || "Couldn't load members."
      );
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* --- filtering ----------------------------------------------------- */

  /**
   * Rule 1: this is a delegation list. Owners always show (locked, and the
   * reference point for "who can do what"); everyone else earns a row only by
   * holding a module, having a live offer, or having one that lapsed.
   */
  const delegationRows = useMemo(
    () =>
      allRows.filter(
        (r) =>
          !r.editable ||
          hasAnyAccess(r) ||
          Object.keys(expiredMap[r.userId] || {}).length > 0
      ),
    [allRows, expiredMap]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return delegationRows.filter((r) => {
      if (q) {
        const hay = `${r.name || ""} ${r.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (roleFilter === "owner" && r.editable) return false;
      if (roleFilter === "member" && !r.editable) return false;

      if (moduleFilter) {
        const touchesModule =
          !r.editable ||
          r.permissions?.[moduleFilter] === true ||
          !!r.pending?.[moduleFilter] ||
          !!expiredMap[r.userId]?.[moduleFilter];
        if (!touchesModule) return false;
      }

      if (
        statusFilter !== "all" &&
        rowStatus(r, expiredMap[r.userId]) !== statusFilter
      ) {
        return false;
      }
      return true;
    });
  }, [delegationRows, search, roleFilter, moduleFilter, statusFilter, expiredMap]);

  // Any filter change can shrink the list past the current page.
  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, moduleFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pendingInviteCount = useMemo(
    () =>
      delegationRows.reduce(
        (acc, r) => acc + Object.keys(r.pending || {}).length,
        0
      ),
    [delegationRows]
  );

  /** Nobody has been delegated anything yet — only owner rows survive the filter. */
  const isJustYou = useMemo(
    () => delegationRows.every((r) => !r.editable),
    [delegationRows]
  );

  const hasFilters =
    !!search || roleFilter !== "all" || !!moduleFilter || statusFilter !== "all";

  /* --- actions -------------------------------------------------------- */

  const withRowBusy = useCallback(
    async (userId: string, fn: () => Promise<void>) => {
      setBusyRow(userId);
      try {
        await fn();
      } finally {
        setBusyRow(null);
      }
    },
    []
  );

  /**
   * Offer one module to one member, straight from the cell. This is the fast
   * path for topping someone up after they've accepted their first module —
   * no need to reopen the invite dialog for a person already in the table.
   */
  const handleGrant = useCallback(
    (row: MemberRow, module: ModuleKey, label: string) =>
      withRowBusy(row.userId, async () => {
        try {
          const res = await createGrants(row.userId, [module]);
          if (res.created.length) {
            toast.success(`Invited ${row.name || row.email} to admin ${label}`, {
              description: "They have 24 hours to accept. Access stays off until they do.",
            });
          } else if (res.alreadyPending.length) {
            // Idempotent by design — the existing clock is left untouched.
            toast.info(`${label} invite is already waiting`, {
              description: "Use Resend to restart the 24-hour clock.",
            });
          } else if (res.skipped.length) {
            const reason = res.skipped[0]?.reason;
            toast.info(
              reason === "ALREADY_GRANTED"
                ? `${row.name || row.email} already has ${label}`
                : `Skipped: ${reason}`
            );
          }
          await load();
          notifyRbacChanged();
        } catch (err) {
          const e = err as RbacError;
          toast.error(
            e?.code === "SELF_ASSIGN"
              ? "You can't assign modules to yourself."
              : e?.code === "NOT_ASSIGNABLE"
                ? "Owners and guests can't be assigned modules."
                : e?.code === "NOT_A_MEMBER"
                  ? "That person is no longer in this office."
                  : e?.message || "Couldn't send the invite."
          );
        }
      }),
    [load, withRowBusy]
  );

  const handleResend = useCallback(
    (row: MemberRow, grantId: string, label: string) =>
      withRowBusy(row.userId, async () => {
        try {
          await resendGrant(grantId);
          toast.success(`${label} invite resent`, {
            description: "The 24-hour clock restarts now.",
          });
          await load();
        } catch (err) {
          const e = err as RbacError;
          toast.error(
            e?.code === "GRANT_NOT_PENDING"
              ? "That invite was already answered."
              : e?.code === "GRANT_ALREADY_PENDING"
                ? "A newer invite for this module is already live."
                : e?.message || "Couldn't resend the invite."
          );
          await load();
        }
      }),
    [load, withRowBusy]
  );

  const handleWithdraw = useCallback(
    (row: MemberRow, grantId: string, label: string) =>
      withRowBusy(row.userId, async () => {
        try {
          await cancelGrant(grantId);
          toast.success(`${label} invite withdrawn`);
          await load();
          notifyRbacChanged();
        } catch (err) {
          const e = err as RbacError;
          toast.error(
            e?.status === 409
              ? "That invite was already answered."
              : e?.message || "Couldn't withdraw the invite."
          );
          await load();
        }
      }),
    [load, withRowBusy]
  );

  const runConfirm = useCallback(async () => {
    if (!confirm) return;
    setConfirmBusy(true);
    try {
      if (confirm.kind === "revoke-module") {
        await revokeModule(confirm.row.userId, confirm.module);
        toast.success(
          `Revoked ${confirm.label} from ${confirm.row.name || confirm.row.email}`
        );
      } else {
        const res = await revokeAllModules(confirm.row.userId);
        toast.success(
          res.revoked.length
            ? `Revoked ${res.revoked.length} module${res.revoked.length === 1 ? "" : "s"} from ${confirm.row.name || confirm.row.email}`
            : `${confirm.row.name || confirm.row.email} held no modules`
        );
      }
      setConfirm(null);
      await load();
      notifyRbacChanged();
    } catch (err) {
      toast.error((err as RbacError)?.message || "Couldn't revoke access.");
    } finally {
      setConfirmBusy(false);
    }
  }, [confirm, load]);

  /* --- render ---------------------------------------------------------- */

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setModuleFilter("");
    setStatusFilter("all");
  };

  const dropdownCls =
    "inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs text-zinc-300 transition-colors hover:text-white cursor-pointer";
  const menuCls = "border-white/10 bg-[#1c1c24] text-zinc-300";
  const itemCls = "cursor-pointer text-xs focus:bg-white/10 focus:text-white";

  return (
    <div className="flex min-h-full flex-col bg-[#121216]">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-5">
        <nav className="flex items-center gap-1 text-[11px] text-zinc-500">
          <span>Settings</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-zinc-300">Team &amp; access</span>
        </nav>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Team &amp; access</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Control who can manage each part of your business.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAuditOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-[#1c1c24] px-3.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
            >
              <History className="h-4 w-4" />
              View audit log
            </button>
            <button
              onClick={() => setInviteOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 cursor-pointer"
            >
              <UserPlus className="h-4 w-4" />
              Invite people
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-6 py-3">
        <div className="relative min-w-[220px] max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="h-9 w-full rounded-lg border border-white/10 bg-[#1c1c24] pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 focus:border-brand/40 focus:outline-none"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={dropdownCls}>
              Role:{" "}
              {roleFilter === "all"
                ? "All"
                : roleFilter === "owner"
                  ? "Owner"
                  : "Member"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuCls}>
            {(
              [
                ["all", "All"],
                ["owner", "Owner"],
                ["member", "Member"],
              ] as const
            ).map(([v, label]) => (
              <DropdownMenuItem
                key={v}
                onClick={() => setRoleFilter(v)}
                className={cn(itemCls, roleFilter === v && "text-brand")}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={dropdownCls}>
              Module:{" "}
              {moduleFilter
                ? modules.find((m) => m.key === moduleFilter)?.label || moduleFilter
                : "All"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuCls}>
            <DropdownMenuItem
              onClick={() => setModuleFilter("")}
              className={cn(itemCls, !moduleFilter && "text-brand")}
            >
              All
            </DropdownMenuItem>
            {modules.map((m) => {
              const Icon = moduleIcon(m.key);
              return (
                <DropdownMenuItem
                  key={m.key}
                  onClick={() => setModuleFilter(m.key)}
                  className={cn(
                    itemCls,
                    "gap-2",
                    moduleFilter === m.key && "text-brand"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {m.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(dropdownCls, "capitalize")}>
              Status: {statusFilter === "all" ? "All" : statusFilter}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className={menuCls}>
            {(["all", "active", "pending", "expired"] as const).map((v) => (
              <DropdownMenuItem
                key={v}
                onClick={() => setStatusFilter(v)}
                className={cn(
                  itemCls,
                  "capitalize",
                  statusFilter === v && "text-brand"
                )}
              >
                {v === "all" ? "All" : v}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex items-center gap-2">
          <PermissionReference modules={modules} />
          <button
            onClick={load}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#1c1c24] px-3 text-xs text-zinc-400 transition-colors hover:text-white cursor-pointer"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {error ? (
          <div className="mx-auto mt-16 max-w-sm rounded-2xl border border-white/10 bg-[#1c1c24] p-8 text-center">
            <ShieldOff className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-400">{error}</p>
          </div>
        ) : loading && allRows.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl border border-white/5 bg-[#1c1c24]"
              />
            ))}
          </div>
        ) : isJustYou && !hasFilters ? (
          <EmptyCard
            icon={<Users className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />}
            title={<>It&rsquo;s just you right now</>}
            subtitle="Invite your first team member to start sharing the load."
            action={
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground transition-opacity hover:opacity-90 cursor-pointer"
              >
                <UserPlus className="h-4 w-4" />
                Invite people
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyCard
              icon={<Search className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />}
              title={<>No one matches &ldquo;{search.trim()}&rdquo;</>}
              subtitle="Try checking the spelling or search by full email address."
              action={
                <button
                  onClick={() => setSearch("")}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Clear search
                </button>
              }
            />
          ) : (
            <EmptyCard
              icon={<Search className="h-6 w-6 text-zinc-500" strokeWidth={1.5} />}
              title="Nothing matches these filters"
              subtitle="Try widening the role, module or status filter."
              action={
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              }
            />
          )
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-[#1c1c24]">
                    <th className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Person
                    </th>
                    <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Role
                    </th>
                    {modules.map((m) => (
                      <th
                        key={m.key}
                        className="whitespace-nowrap px-3 py-3 text-center text-[11px] font-medium uppercase tracking-wide text-zinc-500"
                      >
                        <span className="inline-flex items-center gap-1">
                          {m.label}
                          <Info className="h-3 w-3 text-zinc-600" />
                        </span>
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                      Status
                    </th>
                    <th className="w-12 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const locked = !row.editable;
                    const expired = expiredMap[row.userId] || {};
                    const status = rowStatus(row, expired);
                    const busy = busyRow === row.userId;
                    const pendingEntries = Object.entries(row.pending || {});
                    const expiredEntries = Object.entries(expired);
                    const grantedKeys = Object.entries(row.permissions || {})
                      .filter(([, v]) => v === true)
                      .map(([k]) => k);
                    const labelOf = (key: string) =>
                      modules.find((m) => m.key === key)?.label || key;

                    return (
                      <tr
                        key={row.userId}
                        className="border-b border-white/5 bg-[#121216] transition-colors last:border-b-0 hover:bg-[#1c1c24]/60"
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setDetailUserId(row.userId)}
                            className="group/name flex items-center gap-3 text-left cursor-pointer"
                          >
                            <MemberAvatar
                              name={row.name}
                              email={row.email}
                              src={row.profilePicture}
                              size={34}
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-2">
                                <span className="truncate text-sm font-medium text-white group-hover/name:text-brand">
                                  {row.name || row.email}
                                </span>
                                {row.isSelf && (
                                  <span className="rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                                    You
                                  </span>
                                )}
                              </span>
                              <span className="block truncate text-xs text-zinc-500">
                                {row.email}
                              </span>
                            </span>
                          </button>
                        </td>

                        <td className="px-3 py-3">
                          <RoleBadge isOwner={locked} />
                        </td>

                        {/* Cells are the primary controls: click to offer,
                            resend, or revoke that one module without leaving
                            the table. Owner rows and your own row stay inert. */}
                        {modules.map((m) => {
                          const pending = row.pending?.[m.key];
                          const granted = row.permissions?.[m.key] === true;
                          const lapsed = expired[m.key];
                          const label = labelOf(m.key);

                          let pill: React.ReactNode;
                          let onClick: (() => void) | null = null;
                          let hint = "";

                          if (locked) {
                            pill = <AdminPill locked />;
                            hint = "Owners hold every module";
                          } else if (pending) {
                            pill = <PendingPill expiresAt={pending.expiresAt} />;
                            onClick = () => handleResend(row, pending.grantId, label);
                            hint = `Waiting on them — click to resend ${label} and restart the 24h clock`;
                          } else if (granted) {
                            pill = <AdminPill />;
                            onClick = () =>
                              setConfirm({
                                kind: "revoke-module",
                                row,
                                module: m.key,
                                label,
                              });
                            hint = `Click to revoke ${label} — takes effect immediately`;
                          } else if (lapsed) {
                            pill = <ExpiredPill />;
                            onClick = () => handleResend(row, lapsed.grantId, label);
                            hint = `Invite lapsed — click to send ${label} again`;
                          } else {
                            pill = <NoAccessPill />;
                            onClick = () => handleGrant(row, m.key, label);
                            hint = `Click to invite them to admin ${label} (expires in 24h)`;
                          }

                          return (
                            <td key={m.key} className="px-3 py-3 text-center">
                              {busy ? (
                                <Loader2 className="mx-auto h-4 w-4 animate-spin text-brand" />
                              ) : row.isSelf || !onClick ? (
                                pill
                              ) : (
                                <button
                                  onClick={onClick}
                                  title={hint}
                                  className="rounded-full transition-transform hover:scale-[1.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 cursor-pointer"
                                >
                                  {pill}
                                </button>
                              )}
                            </td>
                          );
                        })}

                        <td className="px-3 py-3">
                          <StatusDot status={status} />
                        </td>

                        <td className="px-3 py-3">
                          {locked || row.isSelf ? (
                            <span className="block h-4 w-4" />
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-white cursor-pointer">
                                  <MoreHorizontal className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className={menuCls}>
                                <DropdownMenuItem
                                  onClick={() => setDetailUserId(row.userId)}
                                  className={itemCls}
                                >
                                  View access &amp; history
                                </DropdownMenuItem>

                                {/* Resend restarts the 24h clock — and revives a lapsed offer */}
                                {(pendingEntries.length > 0 ||
                                  expiredEntries.length > 0) && (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-zinc-600">
                                      Resend invite
                                    </DropdownMenuLabel>
                                    {pendingEntries.map(([key, cell]) => (
                                      <DropdownMenuItem
                                        key={`p-${key}`}
                                        onClick={() =>
                                          handleResend(row, cell.grantId, labelOf(key))
                                        }
                                        className={itemCls}
                                      >
                                        {labelOf(key)}
                                      </DropdownMenuItem>
                                    ))}
                                    {expiredEntries.map(([key, g]) => (
                                      <DropdownMenuItem
                                        key={`e-${key}`}
                                        onClick={() =>
                                          handleResend(
                                            row,
                                            g.grantId,
                                            g.moduleLabel || labelOf(key)
                                          )
                                        }
                                        className={itemCls}
                                      >
                                        {g.moduleLabel || labelOf(key)}{" "}
                                        <span className="text-zinc-600">(expired)</span>
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}

                                {/* Withdraw an unanswered offer */}
                                {pendingEntries.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-zinc-600">
                                      Withdraw invite
                                    </DropdownMenuLabel>
                                    {pendingEntries.map(([key, cell]) => (
                                      <DropdownMenuItem
                                        key={`w-${key}`}
                                        onClick={() =>
                                          handleWithdraw(row, cell.grantId, labelOf(key))
                                        }
                                        className={itemCls}
                                      >
                                        {labelOf(key)}
                                      </DropdownMenuItem>
                                    ))}
                                  </>
                                )}

                                {/* Revoke — immediate */}
                                {grantedKeys.length > 0 && (
                                  <>
                                    <DropdownMenuSeparator className="bg-white/10" />
                                    <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-zinc-600">
                                      Revoke module
                                    </DropdownMenuLabel>
                                    {grantedKeys.map((key) => (
                                      <DropdownMenuItem
                                        key={`r-${key}`}
                                        onClick={() =>
                                          setConfirm({
                                            kind: "revoke-module",
                                            row,
                                            module: key,
                                            label: labelOf(key),
                                          })
                                        }
                                        className="cursor-pointer text-xs text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                                      >
                                        {labelOf(key)}
                                      </DropdownMenuItem>
                                    ))}
                                    <DropdownMenuItem
                                      onClick={() =>
                                        setConfirm({ kind: "revoke-all", row })
                                      }
                                      className="cursor-pointer text-xs font-medium text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
                                    >
                                      Revoke all access
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-500">
              <span>
                {filtered.length} {filtered.length === 1 ? "person" : "people"}
                {pendingInviteCount > 0 && (
                  <>
                    {" · "}
                    <span className="text-amber-400">
                      {pendingInviteCount} pending invite
                      {pendingInviteCount === 1 ? "" : "s"}
                    </span>
                  </>
                )}
              </span>

              {pageCount > 1 && (
                <div className="flex items-center gap-2">
                  <span>
                    Page {safePage} of {pageCount}
                  </span>
                  <button
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>
                  <button
                    disabled={safePage >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 transition-colors hover:text-white disabled:opacity-30 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {confirm && (
          <ConfirmRevoke
            confirm={confirm}
            busy={confirmBusy}
            onCancel={() => !confirmBusy && setConfirm(null)}
            onConfirm={runConfirm}
          />
        )}
      </AnimatePresence>

      <InvitePeopleDialog
        open={inviteOpen}
        modules={modules}
        members={allRows}
        onClose={() => setInviteOpen(false)}
        onInvited={load}
      />

      <AccessAuditLogDialog
        open={auditOpen}
        modules={modules}
        onClose={() => setAuditOpen(false)}
      />

      <MemberAccessSheet
        userId={detailUserId}
        modules={modules}
        onClose={() => setDetailUserId(null)}
        onChanged={load}
      />
    </div>
  );
}
