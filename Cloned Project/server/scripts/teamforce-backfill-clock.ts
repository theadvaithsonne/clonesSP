/**
 * Teamforce historical clock-in / clock-out backfill.
 *
 * One-shot script that fills in missing TimeTracking sessions for the
 * configured users for every IST calendar day between START (default
 * 2026-06-10) and END (default yesterday IST). Same randomisation as the
 * live daemon: clock-in is picked uniformly inside 09:45–10:00 IST and
 * clock-out inside 19:00–19:15 IST. Idempotent — skips days the user
 * already has a session for, so reruns are safe.
 *
 * Usage:
 *   # Dev (tsx)
 *   npx tsx src/scripts/teamforce-backfill-clock.ts
 *
 *   # Prod (after npm run build)
 *   node dist/scripts/teamforce-backfill-clock.js
 *
 *   # Custom range
 *   TF_BACKFILL_START=2026-06-10 TF_BACKFILL_END=2026-06-14 \
 *     npx tsx src/scripts/teamforce-backfill-clock.ts
 *
 *   # Dry-run (writes nothing)
 *   TF_BACKFILL_DRY_RUN=1 npx tsx src/scripts/teamforce-backfill-clock.ts
 *
 * Env:
 *   MONGODB_URI                — required, same as the API
 *   TF_BACKFILL_START          — YYYY-MM-DD, default 2026-06-10
 *   TF_BACKFILL_END            — YYYY-MM-DD, default yesterday IST
 *   TF_BACKFILL_INCLUDE_TODAY  — "1" to include today
 *   TF_BACKFILL_DRY_RUN        — "1" to skip writes
 *   TF_CLOCK_ORG_ID            — pin a specific org
 */

import mongoose, { Types } from "mongoose";
import path from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig({ path: path.join(__dirname, "../../.env") });

import { TimeTracking } from "../models/timeTracking.model";
import { User } from "../models/user.model";

const TZ = "Asia/Kolkata";

/** Hardcoded participant list — identical to the daemon. */
const PARTICIPANT_EMAILS = [
  "abhay@garage.app",
  "usmani@garage.app",
  "suhailali@garage.app",
  "dhyanesh@garage.app",
  "mayur@garage.app",
];

const DEFAULT_START = "2026-06-10";
const MORNING_BASE = "09:45";
const MORNING_WINDOW_MIN = 15;
const EVENING_BASE = "19:00";
const EVENING_WINDOW_MIN = 15;

const DRY_RUN = process.env.TF_BACKFILL_DRY_RUN === "1";
const PINNED_ORG_ID = (process.env.TF_CLOCK_ORG_ID || "").trim();
const INCLUDE_TODAY = process.env.TF_BACKFILL_INCLUDE_TODAY === "1";

const START_DATE = (process.env.TF_BACKFILL_START || DEFAULT_START).trim();
const END_DATE_OVERRIDE = (process.env.TF_BACKFILL_END || "").trim();

function istTodayKey(): string {
  return new Date()
    .toLocaleString("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/[^\d-]/g, "");
}

function istYesterdayKey(): string {
  const todayKey = istTodayKey();
  const t = new Date(`${todayKey}T00:00:00+05:30`);
  t.setUTCDate(t.getUTCDate() - 1);
  const y = t.getUTCFullYear();
  const m = String(t.getUTCMonth() + 1).padStart(2, "0");
  const d = String(t.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function dayRange(startKey: string, endKey: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${startKey}T00:00:00Z`);
  const end = new Date(`${endKey}T00:00:00Z`);
  while (cur.getTime() <= end.getTime()) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function randomIstMoment(
  dayKey: string,
  baseHhMm: string,
  windowMin: number
): Date {
  const [h, m] = baseHhMm.split(":").map(Number);
  const baseSec = h * 3600 + m * 60;
  const offsetSec = Math.floor(Math.random() * windowMin * 60);
  const total = baseSec + offsetSec;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return new Date(`${dayKey}T${hh}:${mm}:${ss}+05:30`);
}

interface Participant {
  email: string;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  displayName: string;
}

async function resolveParticipant(email: string): Promise<Participant | null> {
  const user = (await User.findOne({
    email: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
  }).lean()) as any;

  if (!user) return null;

  let orgId: string | undefined = PINNED_ORG_ID || undefined;
  if (!orgId) {
    const orgs: Array<{ organization?: any }> = user.organizations || [];
    const firstOrg = orgs.find((o) => o.organization)?.organization;
    if (firstOrg) orgId = String(firstOrg);
  }
  if (!orgId) return null;

  return {
    email,
    userId: new Types.ObjectId(String(user._id)),
    orgId: new Types.ObjectId(orgId),
    displayName: user.name || user.email || email,
  };
}

function istDayBoundaries(dayKey: string): { start: Date; end: Date } {
  return {
    start: new Date(`${dayKey}T00:00:00+05:30`),
    end: new Date(`${dayKey}T23:59:59.999+05:30`),
  };
}

async function hasSessionOnDay(
  p: Participant,
  dayKey: string
): Promise<boolean> {
  const { start, end } = istDayBoundaries(dayKey);
  const existing = await TimeTracking.findOne({
    userId: p.userId,
    orgId: p.orgId,
    clockInTime: { $gte: start, $lte: end },
  })
    .select("_id")
    .lean();
  return !!existing;
}

interface BackfillStats {
  daysScanned: number;
  perUser: Record<string, { inserted: number; skipped: number }>;
  inserted: number;
  skipped: number;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const endKey = END_DATE_OVERRIDE
    ? END_DATE_OVERRIDE
    : INCLUDE_TODAY
      ? istTodayKey()
      : istYesterdayKey();

  const startTime = new Date(`${START_DATE}T00:00:00Z`).getTime();
  const endTime = new Date(`${endKey}T00:00:00Z`).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) {
    await mongoose.disconnect();
    process.exit(1);
  }
  if (endTime < startTime) {
    await mongoose.disconnect();
    process.exit(1);
  }

  const participants = (
    await Promise.all(PARTICIPANT_EMAILS.map(resolveParticipant))
  ).filter((p): p is Participant => !!p);

  if (participants.length === 0) {
    await mongoose.disconnect();
    return;
  }

  const days = dayRange(START_DATE, endKey);

  const stats: BackfillStats = {
    daysScanned: days.length,
    perUser: Object.fromEntries(
      participants.map((p) => [p.email, { inserted: 0, skipped: 0 }])
    ),
    inserted: 0,
    skipped: 0,
  };

  for (const dayKey of days) {
    for (const p of participants) {
      try {
        if (await hasSessionOnDay(p, dayKey)) {
          stats.skipped += 1;
          stats.perUser[p.email].skipped += 1;
          continue;
        }
        const clockInTime = randomIstMoment(
          dayKey,
          MORNING_BASE,
          MORNING_WINDOW_MIN
        );
        const clockOutTime = randomIstMoment(
          dayKey,
          EVENING_BASE,
          EVENING_WINDOW_MIN
        );
        const durationInSeconds =
          (clockOutTime.getTime() - clockInTime.getTime()) / 1000;

        if (!DRY_RUN) {
          await TimeTracking.create({
            userId: p.userId,
            orgId: p.orgId,
            clockInTime,
            clockOutTime,
            durationInSeconds,
          });
        }
        stats.inserted += 1;
        stats.perUser[p.email].inserted += 1;
      } catch {
        /* swallow */
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(() => {
  process.exit(1);
});
