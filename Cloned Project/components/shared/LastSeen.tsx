"use client";

import { useEffect, useState } from "react";

/**
 * Renders a human-readable "Active X ago" affordance that replaces the
 * green-dot online indicator across the workspace. Pure presentation —
 * caller supplies the timestamp via API, no socket subscription here.
 *
 * Decay:
 *   < 90s    → "Active now"
 *   < 60m    → "Active 5m ago"
 *   < 24h    → "Active 3h ago"
 *   < 7d     → "Active 4d ago"
 *   >= 7d    → "Active Mar 15"
 *   null     → "" (nothing rendered — see `fallback` to override)
 *
 * Re-computes itself on a 60s timer while mounted, so the label drifts
 * forward in place without needing a re-fetch.
 */
export function LastSeen({
  date,
  prefix = "Active ",
  fallback = "",
  className = "",
}: {
  date: Date | string | null | undefined;
  /** Text to prefix the duration with. Default "Active ". Pass "" to drop. */
  prefix?: string;
  /** Rendered when `date` is null / undefined. Default empty (renders nothing). */
  fallback?: string;
  className?: string;
}) {
  const [, force] = useState(0);

  // Drift the label forward without re-fetching. 60s feels right: matches the
  // smallest bucket boundary so users see "5m ago" → "6m ago" naturally.
  useEffect(() => {
    if (!date) return;
    const id = setInterval(() => force((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [date]);

  if (!date) {
    return fallback ? <span className={className}>{fallback}</span> : null;
  }

  const label = formatRelative(typeof date === "string" ? new Date(date) : date, prefix);
  return <span className={className}>{label}</span>;
}

function formatRelative(d: Date, prefix: string): string {
  const ms = Date.now() - d.getTime();
  if (ms < 0 || ms < 90_000) return `${prefix}now`.replace(/Active now/, "Active now");
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${prefix}${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${prefix}${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${prefix}${days}d ago`;
  // Past a week, an absolute date reads better than "47d ago"
  return `${prefix}${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}
