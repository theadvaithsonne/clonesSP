"use client";

/** Small pieces shared across the Team & Access surfaces. */

import { useEffect, useState } from "react";
import {
  Boxes,
  Briefcase,
  Crown,
  GraduationCap,
  Lock,
  Package,
  Radio,
  Rss,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatTimeLeft,
  formatTimeLeftShort,
  type GrantStatus,
  type ModuleKey,
} from "@/lib/rbac-api";

/**
 * Icons are cosmetic only — the module *list* always comes from
 * `GET /rbac/modules`, so a module the backend adds later still renders
 * (it just falls back to the generic box icon).
 */
const MODULE_ICONS: Record<string, LucideIcon> = {
  community: Rss,
  courses: GraduationCap,
  live_streams: Radio,
  digital_products: Package,
  services: Briefcase,
};

export function moduleIcon(key: ModuleKey): LucideIcon {
  return MODULE_ICONS[key] || Boxes;
}

export function getInitials(name?: string, email?: string) {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function MemberAvatar({
  name,
  email,
  src,
  size = 36,
  className,
}: {
  name?: string;
  email?: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const usable = src && !broken && (src.startsWith("http") || src.startsWith("/"));

  return usable ? (
    <img
      src={src}
      alt={name || email || ""}
      width={size}
      height={size}
      onError={() => setBroken(true)}
      className={cn(
        "rounded-full object-cover border border-white/10 shrink-0",
        className
      )}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-brand to-brand-2 text-brand-foreground font-bold flex items-center justify-center shrink-0 select-none",
        className
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
    >
      {getInitials(name, email)}
    </div>
  );
}

/** Live "23h 12m left" label — recomputed every 30s. */
export function useCountdown(expiresAt?: string | null, short = false) {
  const format = short ? formatTimeLeftShort : formatTimeLeft;
  const [label, setLabel] = useState(() => format(expiresAt));

  useEffect(() => {
    const fmt = short ? formatTimeLeftShort : formatTimeLeft;
    setLabel(fmt(expiresAt));
    if (!expiresAt) return;
    const id = setInterval(() => setLabel(fmt(expiresAt)), 30_000);
    return () => clearInterval(id);
  }, [expiresAt, short]);

  return label;
}

/* ------------------------------------------------------------------ */
/* Permission cell pills                                               */
/* ------------------------------------------------------------------ */

/**
 * Admin is the elevated state, so it reads red — the same weight the console it
 * unlocks deserves. Yellow stays reserved for primary actions, amber for the
 * pending clock.
 *
 * Access is binary — `Admin` or `No access`. A pending offer is neither: it is
 * an unanswered request, so it gets its own pill with the clock on it rather
 * than a half-on version of Admin.
 */
export const ADMIN_ACCENT = {
  text: "text-[#F87171]",
  dot: "bg-[#F87171]",
  chip: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]",
  /** Owner rows: same red, dialled back since it can never be changed. */
  chipLocked: "border-[#EF4444]/20 bg-[#EF4444]/[0.07] text-[#F87171]/80",
};

export function AdminPill({ locked }: { locked?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        locked ? ADMIN_ACCENT.chipLocked : ADMIN_ACCENT.chip
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          locked ? "bg-[#F87171]/70" : ADMIN_ACCENT.dot
        )}
      />
      Admin
      {locked && <Lock className="h-3 w-3" />}
    </span>
  );
}

export function PendingPill({ expiresAt }: { expiresAt?: string }) {
  const left = useCountdown(expiresAt, true);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
      Pending
      {left && <span className="text-amber-400/70">· {left}</span>}
    </span>
  );
}

export function ExpiredPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
      Expired
    </span>
  );
}

export function NoAccessPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] px-2.5 py-1 text-[11px] text-zinc-600">
      <span className="h-1.5 w-1.5 rounded-full border border-zinc-600" />
      No access
    </span>
  );
}

/** Row-level roll-up shown in the STATUS column. */
export type RowStatus = "active" | "pending" | "expired" | "none";

export function StatusDot({ status }: { status: RowStatus }) {
  const map: Record<RowStatus, { dot: string; text: string; label: string }> = {
    active: { dot: "bg-emerald-400", text: "text-emerald-300", label: "Active" },
    pending: { dot: "bg-amber-400", text: "text-amber-300", label: "Pending" },
    expired: { dot: "bg-zinc-500", text: "text-zinc-400", label: "Expired" },
    none: { dot: "bg-zinc-700", text: "text-zinc-600", label: "No access" },
  };
  const s = map[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", s.text)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function RoleBadge({ isOwner }: { isOwner: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        isOwner
          ? "border-brand/25 bg-brand/10 text-brand"
          : "border-white/10 bg-white/[0.04] text-zinc-400"
      )}
    >
      {isOwner && <Crown className="h-3 w-3" />}
      {isOwner ? "Owner" : "Member"}
    </span>
  );
}

const STATUS_STYLES: Record<string, string> = {
  pending: "text-amber-300 bg-amber-500/10 border-amber-500/25",
  accepted: "text-emerald-300 bg-emerald-500/10 border-emerald-500/25",
  applied: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  declined: "text-rose-300 bg-rose-500/10 border-rose-500/25",
  expired: "text-zinc-400 bg-white/5 border-white/10",
  cancelled: "text-zinc-400 bg-white/5 border-white/10",
};

export function StatusChip({
  status,
  className,
}: {
  status: GrantStatus | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
        STATUS_STYLES[status] || "text-zinc-400 bg-white/5 border-white/10",
        className
      )}
    >
      {status}
    </span>
  );
}

export function FounderBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[#EF4444]/25 bg-[#EF4444]/10 px-2 py-0.5 text-[10px] font-medium text-[#F87171]",
        className
      )}
    >
      <ShieldCheck className="h-3 w-3" />
      Full access
    </span>
  );
}

export function relativeTime(iso?: string) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
