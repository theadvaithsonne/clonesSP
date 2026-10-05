import type { NcScheduleStatus } from "../lib/ncMeetClient";

/**
 * contacts-backend caps a status batch at 100. The affiliates list is paged at
 * 20 in the UI but at 200 for CSV export, so chunking is required, not
 * defensive — without it an export would silently lose statuses.
 */
export const NC_STATUS_CHUNK = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface LiveCallLike {
  scheduledAt: Date;
  detachedAt?: Date | null;
}

/** The call the column reflects: the newest non-detached one. */
export function newestLiveCall<T extends LiveCallLike>(calls: T[]): T | null {
  let best: T | null = null;
  for (const c of calls) {
    if (c.detachedAt) continue;
    if (!best || c.scheduledAt > best.scheduledAt) best = c;
  }
  return best;
}

/**
 * Live status for a set of catch-ups, chunked and FAIL-SOFT.
 *
 * A NetworkChains outage must degrade the Ignite call column to its stored
 * snapshot, never fail the whole affiliates list. Batches are independent, so
 * one bad batch does not discard the others.
 */
export async function enrichStatuses(
  scheduleIds: string[],
  fetchStatuses: (batch: string[]) => Promise<NcScheduleStatus[]>,
): Promise<Map<string, NcScheduleStatus>> {
  const out = new Map<string, NcScheduleStatus>();
  if (scheduleIds.length === 0) return out;

  const batches = chunk(scheduleIds, NC_STATUS_CHUNK);
  const results = await Promise.allSettled(batches.map((b) => fetchStatuses(b)));

  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.error("[igniteCall] status batch failed:", r.reason);
      continue;
    }
    for (const s of r.value) out.set(s.scheduleId, s);
  }
  return out;
}

/**
 * Apply a manual "mark as completed" over the derived status.
 *
 * The derived status comes from the live catch-up and cannot see a call that
 * happened off-platform, or one whose session was never stamped. An operator
 * override therefore wins — but ONLY upward, to `completed`. It never drags a
 * call backwards: if NetworkChains reports the room is `started` right now,
 * that is live evidence the call is happening and it beats a stale override.
 */
export function applyManualCompletion(
  derived: "not_scheduled" | "scheduled" | "started" | "completed",
  manuallyCompletedAt?: Date | null,
): "not_scheduled" | "scheduled" | "started" | "completed" {
  if (!manuallyCompletedAt) return derived;
  if (derived === "not_scheduled") return derived;
  if (derived === "started") return derived;
  return "completed";
}
