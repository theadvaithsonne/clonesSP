// src/services/cronLease.ts
// Acquire/release helpers for distributed cron leases. Atomic via
// findOneAndUpdate + unique index on jobName; safe under concurrent
// callers.

import os from "os";
import { CronLease } from "../models/cronLease.model";

const HOSTNAME = os.hostname();

/**
 * Try to acquire the lease for `jobName`. Returns a session ID on
 * success or null if another replica already holds an unexpired lease.
 *
 * Caller is expected to:
 *   - run the job after a non-null return,
 *   - call releaseLease(jobName, sessionId) in a finally block,
 *   - finish before ttlMs elapses (otherwise another replica may grab
 *     the lease and double-run).
 */
export async function acquireLease(
  jobName: string,
  ttlMs: number
): Promise<string | null> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const sessionId = `${HOSTNAME}-${process.pid}-${now.getTime()}`;

  try {
    const result = await CronLease.findOneAndUpdate(
      {
        jobName,
        $or: [
          { leaseExpiresAt: null },
          { leaseExpiresAt: { $lt: now } },
        ],
      },
      {
        $set: {
          leaseHolder: sessionId,
          leaseExpiresAt: expiresAt,
        },
        $setOnInsert: { jobName },
      },
      { upsert: true, new: true }
    );
    return result && result.leaseHolder === sessionId ? sessionId : null;
  } catch (err: any) {
    // E11000: another replica raced us into the upsert path. Not an
    // error condition — they hold the lease, we move on.
    if (err && err.code === 11000) return null;
    throw err;
  }
}

/**
 * Release the lease only if we still hold it. Safe to call after the
 * lease has already expired or been re-acquired by someone else — the
 * conditional update just no-ops.
 */
export async function releaseLease(
  jobName: string,
  sessionId: string
): Promise<void> {
  await CronLease.updateOne(
    { jobName, leaseHolder: sessionId },
    { $set: { leaseHolder: "", leaseExpiresAt: null } }
  );
}
