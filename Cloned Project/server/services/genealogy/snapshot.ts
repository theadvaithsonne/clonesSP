// Freezes every user's NC status / UP qualification / monthly volume when a
// month closes. Hourly tick, distributed lease, idempotent upserts — same shape
// as services/rankBonus/run.ts.
import { acquireLease, releaseLease } from "../cronLease";
import { periodKeyFor, previousPeriodKeyFor } from "../../models/rankRun.model";
import { GenealogySnapshot, GenealogySnapshotRun } from "../../models/genealogySnapshot.model";
import { statusSets, ncOf, volumeUsdByUser } from "./data";
import { monthRange } from "./pure";

const JOB = "genealogy-monthly-snapshot";
const LEASE_MS = 30 * 60 * 1000;
const CHUNK = 1000;

export function firstSnapshotPeriod(): string {
  const v = process.env.GENEALOGY_SNAPSHOT_FIRST_PERIOD;
  return v && /^\d{4}-\d{2}$/.test(v) ? v : "2026-09";
}

export async function snapshotMonth(periodKey: string) {
  const done = await GenealogySnapshotRun.findOne({ periodKey, status: "completed" }).lean();
  if (done) return { status: "already_done" as const };
  const lease = await acquireLease(JOB, LEASE_MS);
  if (!lease) return { status: "skipped_locked" as const };
  try {
    await GenealogySnapshotRun.updateOne(
      { periodKey },
      { $setOnInsert: { periodKey, status: "running" } },
      { upsert: true },
    );
    const { from, to } = monthRange(periodKey);
    const [sets, vol] = await Promise.all([statusSets(), volumeUsdByUser(from, to)]);
    const ids = new Set<string>([...sets.hasChain, ...sets.active, ...sets.qualified, ...vol.keys()]);
    const ops = [...ids].map((id) => ({
      updateOne: {
        filter: { periodKey, userId: id },
        update: {
          $set: {
            nc: ncOf(id, sets),
            qualified: sets.qualified.has(id),
            volumeUsd: vol.get(id) || 0,
          },
        },
        upsert: true,
      },
    }));
    for (let i = 0; i < ops.length; i += CHUNK) {
      await GenealogySnapshot.bulkWrite(ops.slice(i, i + CHUNK) as any, { ordered: false });
    }
    await GenealogySnapshotRun.updateOne(
      { periodKey },
      { $set: { status: "completed", users: ops.length, completedAt: new Date() } },
    );
    return { status: "completed" as const, users: ops.length };
  } finally {
    await releaseLease(JOB, lease);
  }
}

/** Hourly: make sure the month that just closed has a snapshot. */
export async function genealogySnapshotTick(): Promise<void> {
  const periodKey = previousPeriodKeyFor(new Date());
  if (periodKey < firstSnapshotPeriod()) return;
  await snapshotMonth(periodKey);
}

export { periodKeyFor };
