// ───────────────────────────────────────────────────────────────────────
// Downline member profile → Live Streams tab, and its per-session drill-down.
//
// Rows are the live streams a MEMBER registered for, one row per stream.
// Clicking "See Session Level Data" on a recurring stream opens the same
// shape again, one row per SESSION of that stream.
//
// ⚠️ DELIBERATELY SEPARATE FROM `founderStreamTable.ts`.
//
// That service answers a different question — "every stream this ORG runs,
// for the founder console" — and the two tables are tuned independently.
// Nothing here imports from it, and the status rule below is a copy, not a
// shared helper, so a change to the founder console can never silently
// re-shape a downline profile (or the reverse). If you are tempted to
// de-duplicate them: don't. The duplication is the requirement.
//
// Shared, general-purpose primitives (models, `utils/workshopStatus`,
// `utils/sessionOverlay`) are fair game — those were already shared by many
// callers before this file existed.
//
// ── Row source ─────────────────────────────────────────────────────────
// WorkshopRegistration, NOT paid invoice lines. Registrations are the
// member's actual enrolment set and cover free streams; invoice lines miss
// most of it (one member has 48 registrations against 5 paid workshop
// lines, another has 17 against 0).
//
// A per-session enrolment writes one registration PER SESSION, carrying
// `sessionDate` — 59 of the 60 per-session registrations in prod have it.
// That is what the drill-down enumerates and numbers.
// ───────────────────────────────────────────────────────────────────────

import { Types } from "mongoose";

import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Workshop } from "../models/workshop.model";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { WebinarAttendance } from "../models/webinarAttendance.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { CombPlan } from "../models/combPlan.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { Review } from "../models/review.model";
import { ProductOrder } from "../models/productOrder.model";
import {
  computeSessionWindow,
  deriveSessionStatus,
  isSessionDeleted,
  sessionDayKey,
} from "../utils/workshopStatus";
import { calculateSessions } from "../utils/recurrence";
import { buildAffiliateItemUrl } from "./affiliateItemUrl";

/* ────────────────────────────── types ────────────────────────────── */

export type MemberStreamStatus =
  | "active"
  | "completed"
  | "deleted"
  | "not_started";

/** "One Time" vs "Recurring" — the Frequency column. */
export type MemberStreamFrequency = "one_time" | "recurring";

/** The Enrollment Type column. "na" renders as NA on a non-recurring row. */
export type MemberStreamEnrollment = "na" | "once" | "per_session";

export interface MemberLiveStreamRow {
  /** Workshop id on a stream row; `<workshopId>:<sessionISO>` on a session
   *  row, so keys stay unique in the drill-down. */
  id: string;
  workshopId: string;
  /** Session rows only — the Session # column and its date. */
  sessionNumber?: number;
  sessionDate?: string | null;

  name: string;
  thumbnail: string | null;
  office: { id: string; name: string; icon: string | null } | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    avatar: string | null;
  } | null;
  /**
   * Everyone who fronted the stream — the host and every co-host.
   *
   * Sourced from WebinarAttendance `role`, which is where the room actually
   * records who ran a session: "host" for the seat holder, "panelist" for a
   * co-host, "attendee" for everyone else. That is the only place co-hosts
   * appear. `WorkshopSessionOverride.meta.startedBy` — the previous source —
   * only ever names whoever pressed Start, so a stream with five distinct
   * co-hosts still listed one person.
   *
   * The workshop's creator is included even without an attendance row: they
   * own the stream whether or not they showed up to a given session.
   *
   * A stream row lists everyone seen across its sessions; a session row lists
   * only that session's. A founder-set `speakerName` override is the stated
   * marketing identity and leads the list.
   */
  speakers: {
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
    avatar: string | null;
  }[];

  frequency: MemberStreamFrequency;
  enrollmentType: MemberStreamEnrollment;
  status: MemberStreamStatus;

  /** Null on a RECURRING stream row — a series has many dates, so the cell
   *  renders the "See Session Level Data" button instead. Always set on a
   *  session row and on a one-time row. */
  dateTime: {
    date: string;
    startTime: string;
    endTime: string;
    timezone: string;
  } | null;

  /** Null on a per-session stream row: the price is charged per session, so
   *  there is no single figure for the series. Set on its session rows. */
  enrollmentPrice: {
    isFree: boolean;
    price: number;
    currency: string;
  } | null;

  /** Enrollment Comp Plan — the levels behind the "20.00% / 4 Levels" cell. */
  compPlan: { level: number; percentage: number }[];
  /** Viewer's commission on this member's enrolment, in CENTS. */
  youEarnedFromEnrollment: number;
  earnedCurrency: string;
  affiliateUrl: string | null;

  /**
   * Did the member turn up.
   *
   * "not_applicable" for a session that has not run yet — a future date
   * cannot have been missed, and calling it "Not Attended" made a series
   * booked out to December read as 100+ no-shows.
   */
  attendance: "attended" | "not_attended" | "not_applicable";

  /** Purchases the member made DURING this stream. The attribution contract
   *  is ProductOrder `metadata.liveSelling` + `metadata.liveSales.workshopId`
   *  — real, but unwritten so far in prod, so these read 0 until live selling
   *  actually records against a workshop. */
  liveSelling: {
    purchases: number;
    volumeUsd: number;
    youEarnedUsd: number;
  };

  /**
   * The MEMBER's enrolment state — distinct from `status`, which describes
   * the stream. A cancelled enrolment is still shown: they paid for it, so
   * hiding it loses real history (one member has 7 registrations on a stream
   * of which 5 are cancelled, all hasPaid). On a stream row this is
   * "cancelled" only when EVERY registration for it was cancelled.
   */
  enrolment: "registered" | "cancelled" | "not_enrolled";

  rating: number | null;
  review: string | null;
}

/* ──────────────────────────── status rule ──────────────────────────── */

/**
 * INR → USD for live-selling revenue. Product orders are stored in their own
 * currency; the live-selling columns are labelled USD, so INR has to be
 * converted rather than summed as if it were dollars.
 */
const INR_PER_USD = 88;

function toUsd(amount: number, currency?: string | null): number {
  const n = Number(amount) || 0;
  return (currency || "USD").toUpperCase() === "INR" ? n / INR_PER_USD : n;
}

/** A start stamp older than this is a stream someone forgot to end. */
const MANUAL_START_STALE_MS = 8 * 60 * 60 * 1000;

function isWorkshopTrashed(w: any): boolean {
  if (!w?.deletedAt) return false;
  if (!w.restoredAt) return true;
  return new Date(w.restoredAt) < new Date(w.deletedAt);
}

/**
 * Status of the stream itself (not of the member's enrolment).
 *
 * COPIED from the founder console's rule rather than imported — see the
 * header note. The behaviour worth preserving: **the clock alone never
 * advances a row.** An earlier version flipped a 1pm stream to Active at
 * 1:00 and Completed at 2:00, so a stream nobody ever ran ended up reading
 * Completed. Here Active means someone is genuinely in the room:
 *
 *   1. founder pressed End                → completed
 *   2. started (or seat claimed), no End  → active
 *   3. started long ago, never ended      → completed (they forgot to stop)
 *   4. never started                      → not_started, forever
 *
 * Consequence: a stream whose window came and went untouched stays
 * "Yet To Start" indefinitely. Intended — it never ran, so it never
 * completed.
 */
function deriveMemberStreamStatus(
  w: any,
  ctx: {
    hasManualEnd: boolean;
    hasLiveSession: boolean;
    hasEverStarted: boolean;
    hasFutureSession: boolean;
  },
): MemberStreamStatus {
  // Trash outranks the clock.
  if (isWorkshopTrashed(w)) return "deleted";

  if (w.isRecurring) {
    const now = new Date();
    if (w.recurrenceEndDate && now > new Date(w.recurrenceEndDate)) {
      return "completed";
    }
    if (!w.isRecurrenceActive && !ctx.hasFutureSession) return "completed";
    if (ctx.hasLiveSession) return "active";
    return "not_started";
  }

  if (ctx.hasManualEnd) return "completed";
  if (ctx.hasLiveSession) return "active";
  if (ctx.hasEverStarted) return "completed";
  return "not_started";
}

/* ─────────────────────────── override index ─────────────────────────── */

interface OverrideIndex {
  manualEnd: Set<string>;
  live: Set<string>;
  everStarted: Set<string>;
  /** `<workshopId>:<sessionISO>` → the override doc, for session rows. */
  bySessionKey: Map<string, any>;
  /** workshopId → every user who hosted or co-hosted any of its sessions. */
  coHostsByWorkshop: Map<string, Set<string>>;
  /** `<workshopId>:<sessionISO>` → that session's hosts + co-hosts. */
  coHostsBySession: Map<string, Set<string>>;
}

function sessionKeyOf(workshopId: string, date: Date): string {
  return `${workshopId}:${sessionDayKey(date).toISOString()}`;
}

async function loadOverrides(
  workshopIds: Types.ObjectId[],
): Promise<OverrideIndex> {
  const [docs, crew] = await Promise.all([
    WorkshopSessionOverride.find({ workshopId: { $in: workshopIds } }).lean(),
    // Who ran each session. "host" is the seat holder, "panelist" a co-host;
    // everyone else is an "attendee" and not a speaker.
    WebinarAttendance.find(
      { workshopId: { $in: workshopIds }, role: { $in: ["host", "panelist"] } },
      { workshopId: 1, userId: 1, sessionDate: 1, role: 1 },
    ).lean(),
  ]);

  const idx: OverrideIndex = {
    manualEnd: new Set(),
    live: new Set(),
    everStarted: new Set(),
    bySessionKey: new Map(),
    coHostsByWorkshop: new Map(),
    coHostsBySession: new Map(),
  };
  const now = Date.now();

  for (const o of docs as any[]) {
    const wsId = String(o.workshopId);
    idx.bySessionKey.set(sessionKeyOf(wsId, new Date(o.sessionDate)), o);

    // A trashed session keeps its own row but must not colour the stream.
    if (isSessionDeleted(o)) continue;

    if (o.manualEndedAt) idx.manualEnd.add(wsId);
    // A claimed host seat counts as started: the LiveKit token claims it a
    // moment before the socket join stamps manualStartedAt, so a stream can
    // be genuinely live with only hostUserId set.
    if (o.manualStartedAt || o.hostUserId) idx.everStarted.add(wsId);
    if (
      !o.manualEndedAt &&
      ((o.manualStartedAt &&
        now - new Date(o.manualStartedAt).getTime() <= MANUAL_START_STALE_MS) ||
        (!o.manualStartedAt && o.hostUserId))
    ) {
      idx.live.add(wsId);
    }
  }

  for (const c of crew as any[]) {
    const wsId = String(c.workshopId);
    const uid = String(c.userId);
    const byWs = idx.coHostsByWorkshop.get(wsId) || new Set<string>();
    byWs.add(uid);
    idx.coHostsByWorkshop.set(wsId, byWs);
    if (c.sessionDate) {
      const k = sessionKeyOf(wsId, new Date(c.sessionDate));
      const byS = idx.coHostsBySession.get(k) || new Set<string>();
      byS.add(uid);
      idx.coHostsBySession.set(k, byS);
    }
  }
  return idx;
}

/* ──────────────────────────── shared build ──────────────────────────── */

interface BuildDeps {
  memberId: Types.ObjectId;
  viewerId?: string;
}

/** Everything the rows need, fetched once for a page of workshops. */
async function loadContext(
  workshopIds: Types.ObjectId[],
  { memberId, viewerId }: BuildDeps,
) {
  const viewerObj =
    viewerId && Types.ObjectId.isValid(viewerId)
      ? new Types.ObjectId(viewerId)
      : null;

  const workshops = await Workshop.find({ _id: { $in: workshopIds } }).lean();
  const orgIds = [...new Set(workshops.map((w: any) => String(w.orgId)))]
    .filter(Boolean)
    .map((id) => new Types.ObjectId(id));
  // Co-hosts have to be resolved before the user lookup, so the same query
  // covers both them and the creators.
  const preOverrides = await loadOverrides(workshopIds);
  const coHostIds = [
    ...new Set(
      [...preOverrides.coHostsByWorkshop.values()].flatMap((s) => [...s]),
    ),
  ];
  const hostIds = [
    ...new Set([
      ...workshops.map((w: any) => String(w.createdBy)),
      ...coHostIds,
    ]),
  ]
    .filter((id) => id && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const [orgs, hosts, overrides, attendance, comps, earnings, reviews, member, liveEarnings, liveOrders] =
    await Promise.all([
      Organization.find({ _id: { $in: orgIds } }, { name: 1, icon: 1 }).lean(),
      User.find(
        { _id: { $in: hostIds } },
        { name: 1, email: 1, phone: 1, country: 1, profilePicture: 1 },
      ).lean(),
      Promise.resolve(preOverrides),
      WebinarAttendance.find(
        { userId: memberId, workshopId: { $in: workshopIds } },
        { workshopId: 1, sessionDate: 1, totalSeconds: 1, joinCount: 1 },
      ).lean(),
      CombPlan.find(
        { itemType: "workshop", itemId: { $in: workshopIds }, isActive: true },
        { itemId: 1, levels: 1 },
      ).lean(),
      viewerObj
        ? CommissionDistribution.aggregate([
            {
              $match: {
                customerId: memberId,
                itemType: "workshop",
                itemId: { $in: workshopIds },
                status: "completed",
                "commissions.userId": viewerObj,
              },
            },
            { $unwind: "$commissions" },
            { $match: { "commissions.userId": viewerObj } },
            {
              $group: {
                _id: "$itemId",
                earned: { $sum: "$commissions.amount" },
                currency: { $first: "$currency" },
              },
            },
          ])
        : Promise.resolve([] as any[]),
      Review.find(
        {
          userId: memberId,
          targetType: "workshop",
          targetId: { $in: workshopIds },
        },
        { targetId: 1, rating: 1, comment: 1 },
      ).lean(),
      User.findById(memberId, { affiliateId: 1 }).lean(),
      // The viewer's cut of what the member bought DURING these streams.
      // Live-sold products carry the stream on the distribution's metadata
      // (`metadata.liveWorkshopId`), which is how the founder console splits
      // live-selling commission from ordinary product commission.
      viewerObj
        ? CommissionDistribution.aggregate([
            {
              $match: {
                customerId: memberId,
                itemType: "product",
                status: "completed",
                "metadata.liveWorkshopId": {
                  $in: workshopIds.map((id) => String(id)),
                },
                "commissions.userId": viewerObj,
              },
            },
            { $unwind: "$commissions" },
            { $match: { "commissions.userId": viewerObj } },
            {
              $group: {
                _id: "$metadata.liveWorkshopId",
                earned: { $sum: "$commissions.amount" },
              },
            },
          ])
        : Promise.resolve([] as any[]),
      // Live-selling attribution: orders the MEMBER placed inside one of
      // these streams. Contract mirrors the founder console's.
      ProductOrder.find(
        {
          userId: memberId,
          status: { $nin: ["cancelled", "refunded", "failed"] },
          "metadata.liveSelling": true,
          "metadata.liveSales.workshopId": {
            $in: workshopIds.map((id) => String(id)),
          },
        },
        { total: 1, currency: 1, metadata: 1 },
      ).lean(),
    ]);

  const orgM = new Map((orgs as any[]).map((o) => [String(o._id), o]));
  const hostM = new Map((hosts as any[]).map((h) => [String(h._id), h]));
  const compM = new Map((comps as any[]).map((c) => [String(c.itemId), c.levels || []]));
  const earnM = new Map((earnings as any[]).map((e) => [String(e._id), e]));
  const reviewM = new Map((reviews as any[]).map((r) => [String(r.targetId), r]));

  // Attendance is per (workshop, session). Keep both rollups so a stream row
  // can say "attended at least once" and a session row can be exact.
  const attendedWorkshop = new Set<string>();
  const attendedSession = new Set<string>();
  // The distinct session days this member attended, deduped. Used to fill in
  // sessions of a recurring/once series that left no override row.
  const attendedDayKeys = new Map<string, Date>();
  for (const a of attendance as any[]) {
    const wsId = String(a.workshopId);
    attendedWorkshop.add(wsId);
    if (a.sessionDate) {
      const day = sessionDayKey(new Date(a.sessionDate));
      attendedSession.add(sessionKeyOf(wsId, new Date(a.sessionDate)));
      attendedDayKeys.set(day.toISOString(), day);
    }
  }

  // `metadata.liveSales` is an ARRAY of claims — one per live-sold line, each
  // carrying its own workshopId. One order can therefore span two streams; it
  // counts once against each, which is what "purchases made in this stream"
  // means. Reading it as an object silently attributed nothing.
  const liveByWorkshop = new Map<
    string,
    { purchases: number; volumeUsd: number }
  >();
  for (const o of liveOrders as any[]) {
    const claims: any[] = Array.isArray(o?.metadata?.liveSales)
      ? o.metadata.liveSales
      : [];
    const wsIds = [
      ...new Set(claims.map((c) => String(c?.workshopId || "")).filter(Boolean)),
    ];
    for (const wsId of wsIds) {
      const cur = liveByWorkshop.get(wsId) || { purchases: 0, volumeUsd: 0 };
      cur.purchases += 1;
      cur.volumeUsd += toUsd(o.total, o.currency);
      liveByWorkshop.set(wsId, cur);
    }
  }

  const liveEarnM = new Map(
    (liveEarnings as any[]).map((e) => [String(e._id), Number(e.earned) || 0]),
  );

  return {
    liveEarnM,
    workshops: new Map((workshops as any[]).map((w) => [String(w._id), w])),
    orgM,
    hostM,
    compM,
    earnM,
    reviewM,
    overrides,
    attendedWorkshop,
    attendedSession,
    attendedSessionDates: [...attendedDayKeys.values()],
    liveByWorkshop,
    affiliateId: (member as any)?.affiliateId || "",
  };
}

type Ctx = Awaited<ReturnType<typeof loadContext>>;

function frequencyOf(w: any): MemberStreamFrequency {
  return w?.isRecurring ? "recurring" : "one_time";
}

/** A workshop that isn't recurring can't be per-session — `isRecurring`
 *  decides first. One prod row carries the contradictory
 *  {isRecurring:false, enrollmentType:"per_session"} and 8 legacy rows have
 *  neither field; all read as a non-recurring "na". */
function enrollmentOf(w: any): MemberStreamEnrollment {
  if (!w?.isRecurring) return "na";
  return w.enrollmentType === "per_session" ? "per_session" : "once";
}

function buildRow(
  w: any,
  ctx: Ctx,
  opts: {
    sessionDate?: Date | null;
    sessionNumber?: number;
    enrolment?: MemberLiveStreamRow["enrolment"];
    /** Precomputed [start, end] for this session. The caller expands the
     *  recurrence ONCE for the whole page; without this, computeSessionWindow
     *  re-expands it per row — 110 rows meant 110 full expansions and a
     *  21-second response. */
    sessionWindow?: { startDateTime: Date; endDateTime: Date } | null;
  } = {},
): MemberLiveStreamRow {
  const wsId = String(w._id);
  const org = ctx.orgM.get(String(w.orgId));
  const host = ctx.hostM.get(String(w.createdBy));
  const freq = frequencyOf(w);
  const enrollment = enrollmentOf(w);
  const isSessionRow = !!opts.sessionDate;

  const override = opts.sessionDate
    ? ctx.overrides.bySessionKey.get(sessionKeyOf(wsId, opts.sessionDate))
    : null;

  // A SESSION row states its OWN status. Using the series status made every
  // one of a 110-session run read "Yet To Start" — including the six that had
  // already been delivered.
  const sessionWindow = isSessionRow
    ? opts.sessionWindow !== undefined
      ? opts.sessionWindow
      : // Fallback for a day the recurrence didn't generate — a rescheduled
        // or manually-run session. Rare, so the cost stays bounded.
        computeSessionWindow(w, opts.sessionDate as Date, override)
    : null;
  const sessionStatus = sessionWindow
    ? deriveSessionStatus(sessionWindow, override)
    : null;

  const status: MemberStreamStatus = sessionStatus
    ? sessionStatus === "live"
      ? "active"
      : sessionStatus === "yet-to-happen"
        ? "not_started"
        : sessionStatus
    : deriveMemberStreamStatus(w, {
    hasManualEnd: ctx.overrides.manualEnd.has(wsId),
    hasLiveSession: ctx.overrides.live.has(wsId),
    hasEverStarted: ctx.overrides.everStarted.has(wsId),
    hasFutureSession: !!(
      w.recurrenceEndDate && new Date(w.recurrenceEndDate) > new Date()
    ),
      });

  const earn = ctx.earnM.get(wsId);
  const review = ctx.reviewM.get(wsId);
  const live = ctx.liveByWorkshop.get(wsId) || { purchases: 0, volumeUsd: 0 };

  // Date & Time: a recurring STREAM row has many dates, so it defers to the
  // drill-down. A session row states its own date.
  const dateTime =
    isSessionRow || freq === "one_time"
      ? {
          date: (opts.sessionDate ?? w.date)?.toISOString?.() ?? String(w.date),
          startTime: override?.startTime || w.startTime || "",
          endTime: override?.endTime || w.endTime || "",
          timezone: w.timezone || "UTC",
        }
      : null;

  // Enrollment price: per-session series charge per session, so the series
  // row has no single figure; its session rows do.
  const showPrice = isSessionRow || enrollment !== "per_session";
  const enrollmentPrice = showPrice
    ? {
        isFree: override?.isFree ?? !!w.isFree,
        price: override?.price ?? (Number(w.price) || 0),
        currency: override?.currency || w.currency || "USD",
      }
    : null;

  // Host first, then co-hosts — the users who actually claimed the live host
  // seat. A session row shows only that session's; a stream row shows every
  // co-host across its sessions.
  const coHostIdsForRow = isSessionRow
    ? [
        ...(ctx.overrides.coHostsBySession.get(
          sessionKeyOf(wsId, opts.sessionDate as Date),
        ) || []),
      ]
    : [...(ctx.overrides.coHostsByWorkshop.get(wsId) || [])];

  const speakers: MemberLiveStreamRow["speakers"] = [];
  const seen = new Set<string>();
  // A founder-set speaker override is the session's stated identity; it leads.
  if (override?.speakerName) {
    speakers.push({
      name: override.speakerName,
      email: "",
      phone: null,
      country: null,
      avatar: override.speakerAvatar || null,
    });
  }
  for (const uid of [String(w.createdBy || ""), ...coHostIdsForRow]) {
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    const u = ctx.hostM.get(uid);
    if (u) {
      speakers.push({
        name: u.name || "Unknown",
        email: u.email || "",
        phone: u.phone || null,
        country: u.country || null,
        avatar: u.profilePicture || null,
      });
    }
  }

  return {
    id: isSessionRow
      ? `${wsId}:${sessionDayKey(opts.sessionDate as Date).toISOString()}`
      : wsId,
    workshopId: wsId,
    ...(isSessionRow
      ? {
          sessionNumber: opts.sessionNumber,
          sessionDate: (opts.sessionDate as Date).toISOString(),
        }
      : {}),
    name: override?.title || w.title || "Untitled",
    thumbnail: w.thumbnail || null,
    office: org
      ? { id: String(org._id), name: org.name || "Unknown", icon: org.icon || null }
      : null,
    createdBy: host
      ? {
          id: String(host._id),
          name: host.name || "Unknown",
          email: host.email || "",
          phone: host.phone || null,
          country: host.country || null,
          avatar: host.profilePicture || null,
        }
      : null,
    speakers,
    frequency: freq,
    enrollmentType: enrollment,
    status,
    dateTime,
    enrollmentPrice,
    compPlan: (ctx.compM.get(wsId) || []).map((l: any) => ({
      level: l.level,
      percentage: l.percentage,
    })),
    youEarnedFromEnrollment: Math.round((earn?.earned || 0) * 100),
    earnedCurrency: earn?.currency || "USD",
    affiliateUrl: buildAffiliateItemUrl(
      { itemType: "workshop", itemId: wsId },
      ctx.affiliateId,
    ),
    attendance: (() => {
      const attended = isSessionRow
        ? ctx.attendedSession.has(sessionKeyOf(wsId, opts.sessionDate as Date))
        : ctx.attendedWorkshop.has(wsId);
      if (attended) return "attended" as const;
      // Nothing to have missed until the session has been delivered. Only a
      // session row can know this; a stream row spans many sessions.
      if (isSessionRow && (status === "not_started" || status === "deleted")) {
        return "not_applicable" as const;
      }
      return "not_attended" as const;
    })(),
    liveSelling: {
      purchases: live.purchases,
      volumeUsd: live.volumeUsd,
      youEarnedUsd: ctx.liveEarnM.get(wsId) || 0,
    },
    enrolment: opts.enrolment ?? "registered",
    rating: review?.rating ?? null,
    review: review?.comment || null,
  };
}

/* ──────────────────────────── public API ──────────────────────────── */

/**
 * The Live Streams tab — one row per live stream the member registered for.
 *
 * Cancelled registrations are excluded: the member is no longer enrolled, and
 * the table's Status column describes the STREAM, so a cancelled enrolment
 * would show as a live row with no way to tell it apart.
 */
export async function listMemberLiveStreams(params: {
  userId: string;
  viewerId?: string;
}): Promise<{ rows: MemberLiveStreamRow[] }> {
  const memberId = new Types.ObjectId(params.userId);

  const regs = await WorkshopRegistration.find(
    { userId: memberId },
    { workshopId: 1, status: 1, registeredAt: 1 },
  ).lean();
  if (!regs.length) return { rows: [] };

  // One row per stream, however many sessions were registered for. A stream
  // reads as cancelled only when EVERY registration on it was cancelled —
  // someone who dropped 5 of 7 sessions is still enrolled in the stream.
  const anyActive = new Set<string>();
  for (const r of regs as any[]) {
    if (r.status !== "cancelled") anyActive.add(String(r.workshopId));
  }
  const workshopIds = [
    ...new Set((regs as any[]).map((r) => String(r.workshopId))),
  ].map((id) => new Types.ObjectId(id));

  const ctx = await loadContext(workshopIds, {
    memberId,
    viewerId: params.viewerId,
  });

  const rows: MemberLiveStreamRow[] = [];
  for (const id of workshopIds) {
    const w = ctx.workshops.get(String(id));
    // A registration can outlive its workshop; skip rather than emit a row
    // with no name, office or schedule.
    if (w) {
      rows.push(
        buildRow(w, ctx, {
          enrolment: anyActive.has(String(id)) ? "registered" : "cancelled",
        }),
      );
    }
  }
  return { rows };
}

/**
 * The "See Session Level Data" drill-down — one row per SESSION of a single
 * recurring stream that this member registered for.
 *
 * Sessions come from the member's own registrations, so the list is what THEY
 * enrolled in, not every occurrence the series generated. Numbering follows
 * session date so Session # is stable as more are added.
 */
export async function listMemberLiveStreamSessions(params: {
  userId: string;
  workshopId: string;
  viewerId?: string;
}): Promise<{ rows: MemberLiveStreamRow[]; workshopTitle: string | null }> {
  const memberId = new Types.ObjectId(params.userId);
  const workshopId = new Types.ObjectId(params.workshopId);

  const regs = await WorkshopRegistration.find(
    { userId: memberId, workshopId },
    { sessionDate: 1, status: 1, registeredAt: 1 },
  )
    .sort({ sessionDate: 1, registeredAt: 1 })
    .lean();
  if (!regs.length) return { rows: [], workshopTitle: null };

  const ctx = await loadContext([workshopId], {
    memberId,
    viewerId: params.viewerId,
  });
  const w = ctx.workshops.get(String(workshopId));
  if (!w) return { rows: [], workshopTitle: null };

  // EVERY session of the series is listed, not just the ones this member
  // touched — the view is the stream's schedule, with the member's standing
  // marked on each row.
  //
  // Sessions come from `calculateSessions`, the same expander the rest of the
  // app uses to turn a recurrence pattern into dates, so this list matches
  // what a founder sees. Override rows and attended days are unioned in on
  // top: a rescheduled or manually-run session may sit off the pattern.
  //
  // This replaces enumerating the member's registrations, which returned
  // NOTHING for an enrol-once series — one registration covers the whole run
  // and carries no sessionDate ("Your Freedom Webinar": 70 registrations, 0
  // with a sessionDate, 6 real sessions, 165 attendances).
  const dayKeys = new Map<string, Date>();
  // Session windows from the SAME expansion, so each row gets its start/end
  // without re-expanding the recurrence.
  const windows = new Map<string, { startDateTime: Date; endDateTime: Date }>();

  if (w.isRecurring && w.recurrencePattern && w.recurrenceStartDate) {
    const generated = calculateSessions(
      w.recurrencePattern,
      new Date(w.recurrenceStartDate),
      w.startTime || "00:00",
      w.endTime || "23:59",
      new Date(w.recurrenceStartDate),
      // A hard cap: a daily series with no end date would otherwise expand
      // forever. 500 is far past anything real and keeps one bad row from
      // hanging the request.
      500,
      true,
      w.timezone,
      w.recurrenceEndDate ? new Date(w.recurrenceEndDate) : undefined,
    );
    for (const g of generated) {
      const d = sessionDayKey(new Date(g.date));
      dayKeys.set(d.toISOString(), d);
      windows.set(d.toISOString(), {
        startDateTime: g.startDateTime,
        endDateTime: g.endDateTime,
      });
    }
  }
  for (const o of ctx.overrides.bySessionKey.values()) {
    if (String(o.workshopId) !== String(workshopId)) continue;
    const d = sessionDayKey(new Date(o.sessionDate));
    dayKeys.set(d.toISOString(), d);
  }
  for (const d of ctx.attendedSessionDates) dayKeys.set(d.toISOString(), d);

  // How the member stands on each session.
  //
  //   per_session → they buy sessions one at a time, so a session is theirs
  //                 only if a registration names it. The rest are listed but
  //                 marked not enrolled.
  //   once        → the single enrolment covers the whole run, so every
  //                 session carries that enrolment's state.
  const perSession = enrollmentOf(w) === "per_session";
  const byDay = new Map<string, "registered" | "cancelled">();
  for (const r of regs as any[]) {
    if (!r.sessionDate) continue;
    const k = sessionDayKey(new Date(r.sessionDate)).toISOString();
    // A later active registration outranks an earlier cancelled one.
    if (byDay.get(k) === "registered") continue;
    byDay.set(k, r.status === "cancelled" ? "cancelled" : "registered");
  }
  const seriesState: "registered" | "cancelled" = (regs as any[]).every(
    (r) => r.status === "cancelled",
  )
    ? "cancelled"
    : "registered";

  const rows = [...dayKeys.values()]
    .sort((a, b) => a.getTime() - b.getTime())
    .map((date, i) =>
      buildRow(w, ctx, {
        sessionDate: date,
        sessionNumber: i + 1,
        enrolment: perSession
          ? byDay.get(date.toISOString()) ?? "not_enrolled"
          : seriesState,
        sessionWindow: windows.get(date.toISOString()),
      }),
    );

  return { rows, workshopTitle: w.title || null };
}
