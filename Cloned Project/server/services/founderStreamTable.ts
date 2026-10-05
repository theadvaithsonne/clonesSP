/**
 * Founder Live Streams table — the dense, one-row-per-stream dataset behind
 * the founder console's Bigin-style grid (Founder → Live).
 *
 * The card list this replaced only ever needed enrolments + a headline revenue
 * figure, so `getOrgWorkshops` enriches for that. This view asks fifteen
 * questions per row — attendance, Garage TV reach, enrolment revenue AND its
 * transaction count, affiliate payouts on both the enrolment and the
 * live-selling side, what was sold on screen and to how many people — so it
 * gets its own reader rather than growing the list endpoint every other
 * surface already depends on.
 *
 * TWO VIEWS, ONE ROW SHAPE
 *   One Time   → one row per non-recurring stream.
 *   Recurring  → the founder first picks a series (see
 *                `getFounderRecurringSeries`), then the table shows one row
 *                per SESSION of that series. Same fifteen columns, same row
 *                type — every number is scoped to the session instead of the
 *                whole stream.
 *
 * Everything below is a batched read keyed by workshopId (or session-day key):
 * one query per fact, never one per row.
 *
 * WHERE EACH NUMBER COMES FROM
 *   Enrollments      WorkshopRegistration rows, cancelled excluded.
 *   Attendees        Distinct non-host MeetParticipant emails on the stream's
 *                    meeting. NOT `registration.status === "attended"` — no
 *                    backend code writes that value, so it is 0 everywhere.
 *   Garage TV views  WorkshopSessionOverride.garageTvViewerIds — the LiveKit
 *                    `audience-*` identities the participant_joined webhook
 *                    collects.
 *   Enrolment money  Sum of WorkshopRegistration.amountPaid (converted to
 *                    USD), with the legacy price × count estimate as the
 *                    fallback for rows written before amountPaid existed.
 *   Affiliates       CommissionDistribution — itemType "workshop" for the
 *                    enrolment side, itemType "product" +
 *                    metadata.liveWorkshopId for the live-selling side.
 *   Live selling     WebinarProductPin (what went on screen) and ProductOrder
 *                    metadata.liveSales (what it sold). Auction-vs-standard is
 *                    decided by whether an AuctionSettlement points at the
 *                    order — an auction win reaches the buyer as an ordinary
 *                    ProductOrder, so the settlement row is the only marker.
 */

import { Types } from "mongoose";
import { CombPlan } from "../models/combPlan.model";
import { Workshop } from "../models/workshop.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { User } from "../models/user.model";
import { getUsdToInrRate } from "../utils/exchangeRate";
import { calculateSessions, getNextSession } from "../utils/recurrence";
import { isSessionDeleted, sessionDayKey } from "../utils/workshopStatus";
import { resolveEffectiveSession } from "../utils/sessionOverlay";
import {
  getWorkshopStartDateTimeUTC,
  getWorkshopEndDateTimeUTC,
} from "./workshop";

/** A founder with more streams than this has a reporting problem, not a
 *  paging one — the aggregate footer needs the whole set in memory, so the
 *  read is capped and the truncation is logged rather than hidden. */
const MAX_STREAMS = 500;

/** Mirrors getOrgWorkshops: a Start with no Stop older than this is stale,
 *  so the row ages out to Completed instead of sitting on Active forever. */
const MANUAL_START_STALE_MS = 8 * 60 * 60 * 1000;

export type FounderStreamView = "one-time" | "recurring";

/**
 * The four series-level statuses the console renders.
 *
 * `active` is "under way right now" — the same thing `computedStatus: "live"`
 * means on the card list. `deleted` is a soft delete and stays in the table
 * wearing its own badge: it covers both a deleted stream and a single deleted
 * session of a series.
 */
export type FounderStreamStatus =
  | "active"
  | "completed"
  | "deleted"
  | "not_started";

export interface FounderStreamRow {
  /** Workshop id for a One Time row; `<workshopId>:<sessionISO>` for a
   *  recurring session row, so the table's row keys stay unique. */
  _id: string;
  /** Always the underlying workshop — what a row click needs to open. */
  workshopId: string;
  title: string;
  thumbnail?: string;
  isRecurring: boolean;
  /** Recurring session rows only: 1-indexed position in the series. */
  sessionNumber?: number;
  /** Recurring session rows only: the session's UTC day key. This is the
   *  canonical slot id — it does NOT move when a session is rescheduled. */
  sessionDate?: string;
  /** Recurring session rows only: this session carries per-session edits. */
  isEdited?: boolean;
  /** Set when the session was moved off its slot. Value is the ORIGINAL slot
   *  key (`sessionDate`); `schedule.date` is where it now runs. */
  rescheduledFrom?: string;
  /** Per-session speaker override, when the founder set one. `host` remains
   *  the series host either way. */
  sessionSpeaker?: { name: string; avatar?: string; bio?: string };
  host: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    country?: string;
    profilePicture?: string;
  } | null;
  communities: Array<{ id: string; title: string; icon?: string }>;
  schedule: {
    /** The row's own start instant — the session's for a recurring row. */
    date: string;
    startTime: string;
    endTime: string;
    timezone: string;
    /** One Time recurring-series metadata; null once a series is finished. */
    nextSessionDate: string | null;
    /** e.g. "Every Tuesday". Present on recurring rows. */
    recurrenceLabel?: string;
    totalSessions?: number;
    completedSessions?: number;
  };
  status: FounderStreamStatus;
  /** Who holds the host seat right now, null when it's open. */
  sessionHost: { id: string; name: string; email: string } | null;
  payment: {
    isFree: boolean;
    price: number;
    currency: string;
    /** Host's country — drives the flag next to the currency. */
    country?: string;
  };
  totalEnrollments: number;
  totalAttendees: number;
  garageTvViews: number;
  enrollmentRevenue: { amountUsd: number; transactions: number };
  enrollmentAffiliate: { amountUsd: number; affiliates: number; payments: number };
  liveSellingProducts: { products: number; customers: number };
  liveSellingStats: { revenueUsd: number; auctions: number; standardSales: number };
  liveSellingAffiliates: { amountUsd: number; affiliates: number; payments: number };
}

/**
 * The footer strip.
 *
 * The `unique*` figures exist because a recurring series double-counts by
 * design: the same person enrolling in six sessions is six enrolments and one
 * human, and both numbers are worth knowing (one is workload, the other is
 * reach). They are only computed on the RECURRING view — across a set of
 * unrelated One Time streams "unique" has no meaning, so they stay 0 there and
 * the footer doesn't render them.
 */
export interface FounderStreamTotals {
  /** One Time: streams. Recurring: sessions of the selected series. */
  streams: number;
  enrollments: number;
  uniqueEnrollments: number;
  attendees: number;
  uniqueAttendees: number;
  garageTvViews: number;
  uniqueGarageTvViews: number;
  enrollmentRevenueUsd: number;
  enrollmentAffiliateUsd: number;
  liveSellingRevenueUsd: number;
}

/** One entry in the "Recurring Live Streams" drill-down panel. */
export interface FounderRecurringSeries {
  _id: string;
  title: string;
  thumbnail?: string;
  host: { id: string; name: string; profilePicture?: string } | null;
  totalSessions: number;
  enrollmentType: "once" | "per_session";
}

/**
 * Everything the recurring view prints ABOVE the table.
 *
 * The session rows all belong to one series, so the facts that are the same on
 * every row — who hosts it, which communities it went to, whether it's paid —
 * are series facts, not row facts. Repeating them down a column would be 45
 * copies of one value. They move up here instead, and the columns that stay
 * are the ones that actually differ session to session.
 *
 * `payment` and `commission` are only meaningful on top when enrolment is
 * `once`: with `per_session` pricing each session is bought separately, so the
 * price belongs in the table where it can differ.
 */
export interface FounderSeriesHeader {
  _id: string;
  title: string;
  thumbnail?: string;
  host: {
    id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  enrollmentType: "once" | "per_session";
  status: FounderStreamStatus;
  communities: Array<{ id: string; title: string; icon?: string }>;
  payment: { isFree: boolean; price: number; currency: string; country?: string };
  /**
   * The active CombPlan's total affiliate share, and what that works out to on
   * one enrolment. `null` when the series has no plan — which is different
   * from a plan paying 0%, so the chip can be hidden rather than showing "0%".
   */
  commission: { percent: number; amount: number } | null;
  totalSessions: number;
}

export interface FounderStreamTableResult {
  rows: FounderStreamRow[];
  /** Rows matching the filters — what the footer counts, not the page. */
  total: number;
  totals: FounderStreamTotals;
  /** Both view sizes, so "Switch View" can label One Time (6) /
   *  Recurring (7) without a second round trip. */
  counts: { oneTime: number; recurring: number };
  /** Populated on the recurring view so the drill-down panel can render
   *  without its own request. */
  series: FounderRecurringSeries[];
  /** Which series the returned session rows belong to (recurring view). */
  selectedSeriesId: string | null;
  /** The header block above the recurring table. Null on the One Time view,
   *  and when the org has no recurring series to select. */
  selectedSeries: FounderSeriesHeader | null;
}

export interface FounderStreamTableOptions {
  view?: FounderStreamView;
  /**
   * Per-column "contains" filters from the grid's header popovers, keyed by
   * column id (`name`, `host`, `communities`).
   *
   * Applied HERE rather than in the browser: the table paginates server-side,
   * so filtering the rows already delivered would search one page out of
   * many and quietly report "no matches" for a row two pages away.
   */
  columnFilters?: Record<string, string>;
  /** Recurring view: which series' sessions to list. Defaults to the most
   *  recently scheduled series. */
  seriesId?: string;
  search?: string;
  status?: "all" | FounderStreamStatus | "draft";
  payment?: "all" | "free" | "paid";
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

const EMPTY_TOTALS: FounderStreamTotals = {
  streams: 0,
  enrollments: 0,
  uniqueEnrollments: 0,
  attendees: 0,
  uniqueAttendees: 0,
  garageTvViews: 0,
  uniqueGarageTvViews: 0,
  enrollmentRevenueUsd: 0,
  enrollmentAffiliateUsd: 0,
  liveSellingRevenueUsd: 0,
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** A soft-deleted stream is one whose `deletedAt` has not been superseded by a
 *  later `restoredAt`. Deleted streams are NOT hidden from this table — they
 *  stay in place with a "Deleted" status badge, which is the whole point of the
 *  status column. (There used to be a separate Trash page; the founder console
 *  now shows the trashed rows inline instead.) */
function isWorkshopTrashed(w: any): boolean {
  if (!w?.deletedAt) return false;
  if (!w.restoredAt) return true;
  return new Date(w.restoredAt) < new Date(w.deletedAt);
}

/* ────────────────────────────── helpers ────────────────────────────── */

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** "Every Tuesday", "Every Mon, Wed, Fri", "Monthly on the 1st and 15th" —
 *  the first line of the Date/Time cell for a recurring row.
 *
 *  Reads `type` and the `daysOfWeek` / `daysOfMonth` / `excludedDays` shape
 *  a Workshop's `recurrencePattern` actually carries (see
 *  models/workshop.model.ts), with the singular `dayOfWeek` / `dayOfMonth`
 *  as the fallback every pre-multi-day series uses. */
function recurrenceLabel(pattern: any): string | undefined {
  if (!pattern) return undefined;

  const names = (days: number[]) =>
    days
      .slice()
      .sort((a, b) => a - b)
      .map((d) => DAY_NAMES[d] ?? "")
      .filter(Boolean)
      .join(", ");

  switch (pattern.type) {
    case "daily": {
      const skipped: number[] = Array.isArray(pattern.excludedDays)
        ? pattern.excludedDays
        : [];
      return skipped.length
        ? `Every day except ${names(skipped)}`
        : "Every day";
    }
    case "weekly": {
      const days: number[] = pattern.daysOfWeek?.length
        ? pattern.daysOfWeek
        : pattern.dayOfWeek === undefined
          ? []
          : [pattern.dayOfWeek];
      return days.length ? `Every ${names(days)}` : "Every week";
    }
    case "monthly": {
      const days: number[] = pattern.daysOfMonth?.length
        ? pattern.daysOfMonth
        : pattern.dayOfMonth
          ? [pattern.dayOfMonth]
          : [];
      if (!days.length) return "Monthly";
      const sorted = days.slice().sort((a, b) => a - b).map(ordinal);
      const list =
        sorted.length === 1
          ? sorted[0]
          : `${sorted.slice(0, -1).join(", ")} and ${sorted[sorted.length - 1]}`;
      return `Monthly on the ${list}`;
    }
    default:
      return undefined;
  }
}

/** INR is the only non-USD currency these collections write; anything else
 *  passes through rather than being silently zeroed. */
function toUsd(amount: number, currency: string | undefined, rate: number) {
  if (!amount) return 0;
  return (currency || "USD").toUpperCase() === "INR" ? amount / rate : amount;
}

/** Flatten the `commissions[].userId` arrays an aggregation $push produces
 *  (an array of arrays) into a distinct set of paid affiliates. */
function distinctRecipients(pushed: any): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(pushed)) return out;
  for (const group of pushed) {
    if (Array.isArray(group)) {
      for (const uid of group) if (uid) out.add(String(uid));
    } else if (group) {
      out.add(String(group));
    }
  }
  return out;
}

function emptyAffiliate() {
  return { amountUsd: 0, affiliates: 0, payments: 0 };
}

function sumTotals(rows: FounderStreamRow[]): FounderStreamTotals {
  return rows.reduce<FounderStreamTotals>(
    (acc, r) => ({
      streams: acc.streams + 1,
      enrollments: acc.enrollments + r.totalEnrollments,
      // Not summable from rows — a headcount of distinct people needs the
      // identities, which the rows don't carry. The recurring view fills
      // these in via totalsOverride; everywhere else they stay 0.
      uniqueEnrollments: acc.uniqueEnrollments,
      attendees: acc.attendees + r.totalAttendees,
      uniqueAttendees: acc.uniqueAttendees,
      garageTvViews: acc.garageTvViews + r.garageTvViews,
      uniqueGarageTvViews: acc.uniqueGarageTvViews,
      enrollmentRevenueUsd:
        acc.enrollmentRevenueUsd + r.enrollmentRevenue.amountUsd,
      enrollmentAffiliateUsd:
        acc.enrollmentAffiliateUsd + r.enrollmentAffiliate.amountUsd,
      liveSellingRevenueUsd:
        acc.liveSellingRevenueUsd + r.liveSellingStats.revenueUsd,
    }),
    { ...EMPTY_TOTALS }
  );
}

/**
 * Status for a One Time row.
 *
 * DELIBERATELY NOT the clock-driven ladder `getOrgWorkshops.computedStatus`
 * and the session accordion use. Those treat "the scheduled start time has
 * passed" as Active, which reports what was *supposed* to happen rather than
 * what did: a stream scheduled for 1pm that nobody ever started flipped to
 * Active at 1:00 and then to Completed at 2:00, so a stream that never
 * happened ended up labelled Completed.
 *
 * Here Active means someone is genuinely in the room, and the clock alone
 * never advances a row:
 *   1. founder pressed End                → completed
 *   2. started (or seat claimed), no End  → active
 *   3. started long ago, never ended      → completed (they forgot to stop)
 *   4. never started                      → not_started, forever
 *
 * Consequence worth knowing: a stream whose window came and went untouched
 * stays "Yet To Start" indefinitely. That is the intended reading — it never
 * ran, so it never completed — but it does mean abandoned streams accumulate
 * in the Yet To Start filter rather than ageing out.
 *
 * Because this diverges from `computedStatus`, the same workshop can read
 * differently here than on a buyer-facing surface. That is a deliberate,
 * founder-table-only change.
 */
function deriveWorkshopRowStatus(
  w: any,
  ctx: {
    nextSession: any;
    hasManualEnd: boolean;
    hasLiveSession: boolean;
    hasEverStarted: boolean;
  }
): FounderStreamStatus {
  // Trash outranks the clock: a deleted stream is deleted whether or not its
  // slot has passed or a session is somehow still live.
  if (isWorkshopTrashed(w)) return "deleted";

  if (w.isRecurring) {
    // A series is done once its recurrence is exhausted, whether or not any
    // individual session ran — there is nothing left to start.
    const now = new Date();
    if (w.recurrenceEndDate && now > new Date(w.recurrenceEndDate)) {
      return "completed";
    }
    if (!w.isRecurrenceActive && !ctx.nextSession) return "completed";
    if (ctx.hasLiveSession) return "active";
    return "not_started";
  }

  if (ctx.hasManualEnd) return "completed";
  if (ctx.hasLiveSession) return "active";
  if (ctx.hasEverStarted) return "completed";
  return "not_started";
}

/** Plain-text value each filterable column matches on. Column ids are the
 *  grid's, so a rename has to happen in both places at once. */
const COLUMN_FILTER_ACCESSORS: Record<string, (r: FounderStreamRow) => string> = {
  name: (r) => r.title,
  host: (r) => `${r.host?.name || ""} ${r.host?.email || ""}`,
  communities: (r) => r.communities.map((c) => c.title).join(" "),
};

/** Sort keys map 1:1 to the table's column ids. */
function sortValue(r: FounderStreamRow, key: string): string | number {
  switch (key) {
    case "name":
      return r.title.toLowerCase();
    // Recurring view only — the session's position in the series. Falls back
    // to the date so a One Time row sorted by this key doesn't collapse to 0.
    case "session":
      return r.sessionNumber ?? new Date(r.schedule.date).getTime();
    case "host":
      return (r.host?.name || r.host?.email || "").toLowerCase();
    case "communities":
      return (r.communities[0]?.title || "").toLowerCase();
    case "dateTime":
      return new Date(r.schedule.nextSessionDate || r.schedule.date).getTime();
    case "status":
      return r.status;
    case "payment":
      return r.payment.isFree ? -1 : r.payment.price;
    case "totalEnrollments":
      return r.totalEnrollments;
    case "totalAttendees":
      return r.totalAttendees;
    case "garageTvViews":
      return r.garageTvViews;
    case "enrollmentRevenue":
      return r.enrollmentRevenue.amountUsd;
    case "enrollmentAffiliateStats":
      return r.enrollmentAffiliate.amountUsd;
    case "liveSellingProducts":
      return r.liveSellingProducts.products;
    case "liveSellingStats":
      return r.liveSellingStats.revenueUsd;
    case "liveSellingAffiliates":
      return r.liveSellingAffiliates.amountUsd;
    default:
      return r.title.toLowerCase();
  }
}

/** Search + status + payment narrowing, then footer totals, then sort, then
 *  slice. Totals deliberately come BEFORE the slice: the footer describes the
 *  whole filtered set, which is the only reading that makes it a total. */
function finish(
  rows: FounderStreamRow[],
  opts: Required<
    Pick<FounderStreamTableOptions, "search" | "status" | "payment" | "page" | "limit" | "sortOrder">
  > & {
    sortBy?: string;
    draftIds?: Set<string>;
    /**
     * Footer fields that must NOT be a sum of the rows.
     *
     * Enrol-once recurring series are the case: every enrolee is entitled to
     * every session, so each session row shows the full headcount — summing
     * 31 enrolees across 45 sessions would report 1,395 people who don't
     * exist. Money has no such problem (it is split evenly across sessions
     * and sums back to the series total), so only the counts are overridden.
     */
    totalsOverride?: (rows: FounderStreamRow[]) => Partial<FounderStreamTotals>;
    columnFilters?: Record<string, string>;
  }
): { rows: FounderStreamRow[]; total: number; totals: FounderStreamTotals } {
  let out = rows;

  if (opts.payment === "free") out = out.filter((r) => r.payment.isFree);
  else if (opts.payment === "paid") out = out.filter((r) => !r.payment.isFree);

  if (opts.status === "draft") {
    const draftIds = opts.draftIds ?? new Set<string>();
    out = out.filter((r) => draftIds.has(r.workshopId));
  } else if (opts.status !== "all") {
    out = out.filter((r) => r.status === opts.status);
  }

  const q = opts.search.trim().toLowerCase();
  if (q) {
    out = out.filter((r) =>
      [r.title, r.host?.name, r.host?.email, ...r.communities.map((c) => c.title)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  for (const [columnId, raw] of Object.entries(opts.columnFilters || {})) {
    const needle = (raw || "").trim().toLowerCase();
    if (!needle) continue;
    const accessor = COLUMN_FILTER_ACCESSORS[columnId];
    // An unknown column id must not silently narrow to nothing — a filter
    // that matches everything is a no-op; one that matches nothing looks
    // like an empty table.
    if (!accessor) continue;
    out = out.filter((r) => accessor(r).toLowerCase().includes(needle));
  }

  const totals = { ...sumTotals(out), ...(opts.totalsOverride?.(out) || {}) };

  if (opts.sortBy) {
    const dir = opts.sortOrder === "asc" ? 1 : -1;
    const key = opts.sortBy;
    out = [...out].sort((a, b) => {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  const total = out.length;
  const start = Math.max(0, (opts.page - 1) * opts.limit);
  return { rows: out.slice(start, start + opts.limit), total, totals };
}

/* ─────────────────────── shared batched readers ─────────────────────── */

/**
 * Everything the fifteen columns need for a set of workshops, read once.
 *
 * Both views call this — the One Time view uses the workshop-level totals
 * directly, the recurring view uses the per-session breakdowns.
 */
async function loadStreamFacts(
  orgObjectId: Types.ObjectId,
  workshops: any[],
  usdToInrRate: number
) {
  const workshopIds = workshops.map((w) => w._id);
  const workshopIdStrings = workshopIds.map((id) => String(id));
  const meetingIds = workshops
    .map((w) => w.meetingId)
    .filter((id) => id && Types.ObjectId.isValid(String(id)))
    .map((id) => new Types.ObjectId(String(id)));

  const { MeetParticipant } = await import("../models/meetParticipant.model");
  const { CommissionDistribution } = await import(
    "../models/commissionDistribution.model"
  );
  const { WebinarProductPin } = await import("../models/webinarProductPin.model");

  const [registrations, participants, overrideDocs, enrollmentCommissions, pinRows] =
    await Promise.all([
      // Raw rows, not an aggregate: the recurring view needs to bucket the
      // same rows by session date, which a $group by workshopId throws away.
      WorkshopRegistration.find({
        workshopId: { $in: workshopIds },
        status: { $ne: "cancelled" },
      })
        .select("workshopId userId hasPaid amountPaid currency enrollmentType sessionDate")
        .lean(),
      meetingIds.length
        ? MeetParticipant.find({
            meetId: { $in: meetingIds },
            isHost: { $ne: true },
          })
            .select("meetId email joinedAt")
            .lean()
        : Promise.resolve([] as any[]),
      // Session overrides drive the status ladder AND Garage TV views.
      WorkshopSessionOverride.find({ workshopId: { $in: workshopIds } })
        .select(
          "workshopId sessionDate manualStartedAt manualEndedAt hostUserId deletedAt restoredAt garageTvViewerIds"
        )
        .lean(),
      // Enrolment-side affiliate payouts, kept per session date so the
      // recurring view can attribute them.
      CommissionDistribution.aggregate([
        {
          $match: {
            itemType: "workshop",
            itemId: { $in: workshopIds },
            status: "completed",
          },
        },
        {
          $group: {
            _id: {
              itemId: "$itemId",
              sessionDate: { $ifNull: ["$metadata.sessionDate", null] },
            },
            amountUsd: { $sum: "$totalCommissionAmount" },
            // One "payment" = one commissionable sale that paid out.
            payments: { $sum: 1 },
            recipients: { $push: "$commissions.userId" },
          },
        },
      ]),
      WebinarProductPin.find({ workshopId: { $in: workshopIds } })
        .select("workshopId sessionDate itemId")
        .lean(),
    ]);

  // ── Live selling ──────────────────────────────────────────────────────
  // Pins gate everything downstream: fulfillment only stamps `liveSales`
  // after matching a pin, so a table with no pins can have no attributed
  // orders and the order / settlement / commission reads are skipped.
  let liveOrders: any[] = [];
  let auctionOrderIds = new Set<string>();
  let liveCommissions: any[] = [];

  if (pinRows.length) {
    const { ProductOrder } = await import("../models/productOrder.model");
    const { AuctionSettlement } = await import(
      "../models/auctionSettlement.model"
    );

    liveOrders = await ProductOrder.find({
      organizationId: orgObjectId,
      status: { $nin: ["cancelled", "refunded", "failed"] },
      "metadata.liveSelling": true,
      "metadata.liveSales.workshopId": { $in: workshopIdStrings },
    })
      .select("userId total currency metadata")
      .lean();

    const orderIds = liveOrders.map((o: any) => o._id);
    if (orderIds.length) {
      const settlements = await AuctionSettlement.find({
        orgId: orgObjectId,
        productOrderId: { $in: orderIds },
      })
        .select("productOrderId")
        .lean();
      auctionOrderIds = new Set(
        (settlements as any[])
          .filter((s) => s.productOrderId)
          .map((s) => String(s.productOrderId))
      );
    }

    liveCommissions = await CommissionDistribution.aggregate([
      {
        $match: {
          orgId: orgObjectId,
          itemType: "product",
          status: "completed",
          "metadata.liveWorkshopId": { $in: workshopIdStrings },
        },
      },
      {
        $group: {
          _id: {
            workshopId: "$metadata.liveWorkshopId",
            sessionDate: { $ifNull: ["$metadata.liveSessionDate", null] },
          },
          amountUsd: { $sum: "$totalCommissionAmount" },
          payments: { $sum: 1 },
          recipients: { $push: "$commissions.userId" },
        },
      },
    ]);
  }

  return {
    registrations,
    participants,
    overrideDocs,
    enrollmentCommissions,
    pinRows,
    liveOrders,
    auctionOrderIds,
    liveCommissions,
    usdToInrRate,
  };
}

type StreamFacts = Awaited<ReturnType<typeof loadStreamFacts>>;

/** Overrides indexed for the status ladder + Garage TV counts. */
function indexOverrides(overrideDocs: any[]) {
  const now = Date.now();
  const garageTvByWorkshop = new Map<string, number>();
  const garageTvBySession = new Map<string, number>();
  const manualEndByWorkshop = new Set<string>();
  const liveByWorkshop = new Set<string>();
  /** Someone pressed Start at some point — however long ago, ended or not.
   *  This is what separates "ran and wasn't stopped" from "never ran". */
  const everStartedByWorkshop = new Set<string>();
  const hostIdByWorkshop = new Map<string, string>();
  const bySessionKey = new Map<string, any>();

  for (const o of overrideDocs) {
    const wsId = String(o.workshopId);
    const sessionKey = `${wsId}:${sessionDayKey(new Date(o.sessionDate)).toISOString()}`;
    bySessionKey.set(sessionKey, o);

    const views = Array.isArray(o.garageTvViewerIds)
      ? o.garageTvViewerIds.length
      : 0;
    if (views) garageTvBySession.set(sessionKey, views);

    // A trashed session's numbers stay on its own row (it still shows in the
    // recurring view as Deleted) but must not inflate the workshop rollup.
    if (isSessionDeleted(o)) continue;

    if (views) {
      garageTvByWorkshop.set(wsId, (garageTvByWorkshop.get(wsId) || 0) + views);
    }
    if (o.manualEndedAt) manualEndByWorkshop.add(wsId);
    // A claimed host seat counts as started: the LiveKit token claims the seat
    // a moment before the socket join stamps manualStartedAt, so a stream can
    // be genuinely live with only hostUserId set.
    if (o.manualStartedAt || o.hostUserId) everStartedByWorkshop.add(wsId);
    if (
      !o.manualEndedAt &&
      ((o.manualStartedAt &&
        now - new Date(o.manualStartedAt).getTime() <= MANUAL_START_STALE_MS) ||
        // Seat claimed but no start stamp yet — the room is being entered.
        (!o.manualStartedAt && o.hostUserId))
    ) {
      liveByWorkshop.add(wsId);
    }
    if (o.hostUserId && !o.manualEndedAt) {
      hostIdByWorkshop.set(wsId, String(o.hostUserId));
    }
  }

  return {
    garageTvByWorkshop,
    garageTvBySession,
    manualEndByWorkshop,
    liveByWorkshop,
    everStartedByWorkshop,
    hostIdByWorkshop,
    bySessionKey,
  };
}

async function resolveSeatHolders(hostIdByWorkshop: Map<string, string>) {
  const ids = [...new Set(hostIdByWorkshop.values())];
  const byId = new Map<string, { id: string; name: string; email: string }>();
  if (!ids.length) return byId;
  const users = await User.find({ _id: { $in: ids } })
    .select("name email")
    .lean();
  for (const u of users as any[]) {
    byId.set(String(u._id), {
      id: String(u._id),
      name: u.name || "",
      email: u.email || "",
    });
  }
  return byId;
}

function hostOf(w: any) {
  const h = w.createdBy;
  if (!h || !h._id) return null;
  return {
    id: String(h._id),
    name: h.name || "",
    email: h.email || "",
    phone: h.phone || undefined,
    country: h.country || undefined,
    profilePicture: h.profilePicture || undefined,
  };
}

function communitiesOf(w: any) {
  return (w.channelIds || [])
    .filter((c: any) => c && c._id)
    .map((c: any) => ({
      id: String(c._id),
      title: c.title || "Community",
      // Communities have no dedicated icon field — the cell falls back to a
      // lettered avatar when neither image is set.
      icon: c.logo || c.coverImage || undefined,
    }));
}

/**
 * The recurring series a founder can pick from, for the "Recurring Live
 * Streams" drill-down.
 *
 * Loaded on BOTH views, not just the recurring one. The One Time view used to
 * return `series: []`, which made the picker unreachable: One Time is the
 * default view, so a founder opening Switch View → Recurring was always shown
 * "No recurring live streams yet" — the panel had no list to render and there
 * was no way to get to the recurring table at all.
 *
 * Cheap enough to always pay for: one indexed query plus in-memory recurrence
 * expansion, and it saves the panel a second round trip on open.
 */
async function loadRecurringSeries(
  baseFilter: any
): Promise<FounderRecurringSeries[]> {
  const workshops = await Workshop.find({ ...baseFilter, isRecurring: true })
    .populate("createdBy", "name profilePicture")
    .sort({ date: -1 })
    .limit(MAX_STREAMS)
    .lean();

  return workshops.map((w: any) => ({
    _id: String(w._id),
    title: w.title,
    thumbnail: w.thumbnail,
    host: w.createdBy?._id
      ? {
          id: String(w.createdBy._id),
          name: w.createdBy.name || "",
          profilePicture: w.createdBy.profilePicture || undefined,
        }
      : null,
    totalSessions: w.recurrencePattern
      ? calculateSessions(
          w.recurrencePattern,
          w.recurrenceStartDate || w.date,
          w.startTime,
          w.endTime,
          new Date(),
          500,
          true,
          w.timezone,
          w.recurrenceEndDate
        ).length
      : 0,
    enrollmentType: w.enrollmentType === "per_session" ? "per_session" : "once",
  }));
}

/* ───────────────────────────── One Time view ───────────────────────────── */

export async function getFounderStreamTable(
  orgId: string,
  options: FounderStreamTableOptions = {}
): Promise<FounderStreamTableResult> {
  const {
    view = "one-time",
    seriesId,
    columnFilters = {},
    search = "",
    status = "all",
    payment = "all",
    page = 1,
    limit = 20,
    sortBy,
    sortOrder = "desc",
  } = options;

  const orgObjectId = new Types.ObjectId(orgId);
  // No trash predicate: soft-deleted streams stay in the table as "Deleted"
  // rows rather than disappearing into a separate page.
  const baseFilter: any = {
    orgId: orgObjectId,
    isActive: true,
  };

  // Both view sizes in one round trip — "Switch View" labels each option with
  // its count even before you switch to it.
  const [oneTimeCount, recurringCount] = await Promise.all([
    Workshop.countDocuments({ ...baseFilter, isRecurring: { $ne: true } }),
    Workshop.countDocuments({ ...baseFilter, isRecurring: true }),
  ]);
  const counts = { oneTime: oneTimeCount, recurring: recurringCount };

  if (view === "recurring") {
    return getRecurringSessionTable(orgId, orgObjectId, baseFilter, counts, {
      seriesId,
      columnFilters,
      search,
      status,
      payment,
      page,
      limit,
      sortBy,
      sortOrder,
    });
  }

  const usdToInrRate = await getUsdToInrRate();
  // The picker's list is fetched here too — see loadRecurringSeries. Without
  // it the Switch View panel opens onto an empty Recurring step.
  const [workshops, series] = await Promise.all([
    Workshop.find({ ...baseFilter, isRecurring: { $ne: true } })
      .populate("channelIds", "title logo coverImage")
      .populate("createdBy", "name email profilePicture phone country")
      .sort({ date: -1 })
      .limit(MAX_STREAMS)
      .lean(),
    loadRecurringSeries(baseFilter),
  ]);

  if (workshops.length === MAX_STREAMS) {
    console.warn(
      `[founderStreamTable] org ${orgId} has at least ${MAX_STREAMS} one-time streams — showing the ${MAX_STREAMS} most recent; footer totals cover only those.`
    );
  }

  if (!workshops.length) {
    return {
      rows: [],
      total: 0,
      totals: { ...EMPTY_TOTALS },
      counts,
      series,
      selectedSeriesId: null,
      selectedSeries: null,
    };
  }

  const facts = await loadStreamFacts(orgObjectId, workshops, usdToInrRate);
  const overrides = indexOverrides(facts.overrideDocs as any[]);
  const seatHolders = await resolveSeatHolders(overrides.hostIdByWorkshop);

  // Roll the raw facts up per workshop.
  const regByWorkshop = new Map<
    string,
    { enrollments: number; transactions: number; paidRows: number; revenueUsd: number }
  >();
  for (const r of facts.registrations as any[]) {
    const id = String(r.workshopId);
    const acc =
      regByWorkshop.get(id) ||
      { enrollments: 0, transactions: 0, paidRows: 0, revenueUsd: 0 };
    acc.enrollments += 1;
    if (r.hasPaid) acc.paidRows += 1;
    if ((r.amountPaid || 0) > 0) {
      acc.transactions += 1;
      acc.revenueUsd += toUsd(r.amountPaid, r.currency, usdToInrRate);
    }
    regByWorkshop.set(id, acc);
  }

  const attendeesByMeet = new Map<string, Set<string>>();
  for (const p of facts.participants as any[]) {
    const id = String(p.meetId);
    if (!attendeesByMeet.has(id)) attendeesByMeet.set(id, new Set());
    attendeesByMeet.get(id)!.add(p.email);
  }

  const enrollmentAffiliateByWorkshop = new Map<
    string,
    { amountUsd: number; payments: number; affiliates: Set<string> }
  >();
  for (const r of facts.enrollmentCommissions as any[]) {
    const id = String(r._id.itemId);
    const acc =
      enrollmentAffiliateByWorkshop.get(id) ||
      { amountUsd: 0, payments: 0, affiliates: new Set<string>() };
    acc.amountUsd += r.amountUsd || 0;
    acc.payments += r.payments || 0;
    for (const uid of distinctRecipients(r.recipients)) acc.affiliates.add(uid);
    enrollmentAffiliateByWorkshop.set(id, acc);
  }

  const pinnedByWorkshop = new Map<string, Set<string>>();
  for (const p of facts.pinRows as any[]) {
    const id = String(p.workshopId);
    if (!pinnedByWorkshop.has(id)) pinnedByWorkshop.set(id, new Set());
    pinnedByWorkshop.get(id)!.add(String(p.itemId));
  }

  const liveByWorkshopSales = new Map<
    string,
    { orders: Set<string>; auctions: Set<string>; buyers: Set<string>; revenueUsd: number }
  >();
  const workshopIdSet = new Set(workshops.map((w: any) => String(w._id)));
  for (const o of facts.liveOrders as any[]) {
    // One order can carry lines pinned in several streams; credit each
    // stream once, not once per line.
    const streams = new Set<string>(
      (o.metadata?.liveSales || [])
        .map((l: any) => String(l.workshopId))
        .filter((id: string) => workshopIdSet.has(id))
    );
    for (const wsId of streams) {
      const acc =
        liveByWorkshopSales.get(wsId) ||
        {
          orders: new Set<string>(),
          auctions: new Set<string>(),
          buyers: new Set<string>(),
          revenueUsd: 0,
        };
      acc.orders.add(String(o._id));
      acc.revenueUsd += toUsd(o.total || 0, o.currency, usdToInrRate);
      if (o.userId) acc.buyers.add(String(o.userId));
      if (facts.auctionOrderIds.has(String(o._id))) acc.auctions.add(String(o._id));
      liveByWorkshopSales.set(wsId, acc);
    }
  }

  const liveAffiliateByWorkshop = new Map<
    string,
    { amountUsd: number; payments: number; affiliates: Set<string> }
  >();
  for (const r of facts.liveCommissions as any[]) {
    const id = String(r._id.workshopId);
    const acc =
      liveAffiliateByWorkshop.get(id) ||
      { amountUsd: 0, payments: 0, affiliates: new Set<string>() };
    acc.amountUsd += r.amountUsd || 0;
    acc.payments += r.payments || 0;
    for (const uid of distinctRecipients(r.recipients)) acc.affiliates.add(uid);
    liveAffiliateByWorkshop.set(id, acc);
  }

  const rows: FounderStreamRow[] = workshops.map((w: any) => {
    const id = String(w._id);
    const reg = regByWorkshop.get(id);
    const unitUsd = toUsd(w.price || 0, w.currency, usdToInrRate);
    // Prefer the money actually recorded on the registrations. Rows written
    // before amountPaid existed have none, so fall back to the same
    // price × paid-rows estimate the card list has always shown, rather than
    // reporting $0.00 for a stream that demonstrably sold.
    const recorded = reg?.revenueUsd || 0;
    const paidRows = reg?.paidRows || 0;
    const revenueUsd = w.isFree ? 0 : recorded > 0 ? recorded : paidRows * unitUsd;
    const transactions = reg?.transactions || (recorded > 0 ? 0 : paidRows);

    const sales = liveByWorkshopSales.get(id);
    const enrollAff = enrollmentAffiliateByWorkshop.get(id);
    const liveAff = liveAffiliateByWorkshop.get(id);

    return {
      _id: id,
      workshopId: id,
      title: w.title,
      thumbnail: w.thumbnail,
      isRecurring: false,
      host: hostOf(w),
      communities: communitiesOf(w),
      schedule: {
        date: new Date(w.date).toISOString(),
        startTime: w.startTime || "",
        endTime: w.endTime || "",
        timezone: w.timezone || "UTC",
        nextSessionDate: null,
      },
      status: deriveWorkshopRowStatus(w, {
        nextSession: null,
        hasManualEnd: overrides.manualEndByWorkshop.has(id),
        hasLiveSession: overrides.liveByWorkshop.has(id),
        hasEverStarted: overrides.everStartedByWorkshop.has(id),
      }),
      sessionHost: seatHolders.get(overrides.hostIdByWorkshop.get(id) || "") || null,
      payment: {
        isFree: !!w.isFree,
        price: w.price || 0,
        currency: (w.currency || "USD").toUpperCase(),
        country: w.createdBy?.country || undefined,
      },
      totalEnrollments: reg?.enrollments || 0,
      totalAttendees: w.meetingId
        ? attendeesByMeet.get(String(w.meetingId))?.size || 0
        : 0,
      garageTvViews: overrides.garageTvByWorkshop.get(id) || 0,
      enrollmentRevenue: { amountUsd: revenueUsd, transactions },
      enrollmentAffiliate: enrollAff
        ? {
            amountUsd: enrollAff.amountUsd,
            affiliates: enrollAff.affiliates.size,
            payments: enrollAff.payments,
          }
        : emptyAffiliate(),
      liveSellingProducts: {
        products: pinnedByWorkshop.get(id)?.size || 0,
        customers: sales?.buyers.size || 0,
      },
      liveSellingStats: {
        revenueUsd: sales?.revenueUsd || 0,
        auctions: sales?.auctions.size || 0,
        standardSales: sales ? sales.orders.size - sales.auctions.size : 0,
      },
      liveSellingAffiliates: liveAff
        ? {
            amountUsd: liveAff.amountUsd,
            affiliates: liveAff.affiliates.size,
            payments: liveAff.payments,
          }
        : emptyAffiliate(),
    };
  });

  const draftIds = new Set(
    workshops.filter((w: any) => !w.meetingUrl).map((w: any) => String(w._id))
  );

  const finished = finish(rows, {
    search,
    status,
    payment,
    page,
    limit,
    sortBy,
    sortOrder,
    draftIds,
    columnFilters,
  });

  return {
    ...finished,
    counts,
    series,
    selectedSeriesId: null,
    selectedSeries: null,
  };
}

/* ──────────────────────────── Recurring view ──────────────────────────── */

/**
 * One row per SESSION of a single recurring series.
 *
 * The series list ships alongside the rows so the "Recurring Live Streams"
 * drill-down renders from the same response the table was loaded with.
 */
async function getRecurringSessionTable(
  orgId: string,
  orgObjectId: Types.ObjectId,
  baseFilter: any,
  counts: { oneTime: number; recurring: number },
  opts: {
    seriesId?: string;
    columnFilters: Record<string, string>;
    search: string;
    status: FounderStreamTableOptions["status"];
    payment: FounderStreamTableOptions["payment"];
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder: "asc" | "desc";
  }
): Promise<FounderStreamTableResult> {
  const usdToInrRate = await getUsdToInrRate();

  const seriesWorkshops = await Workshop.find({
    ...baseFilter,
    isRecurring: true,
  })
    .populate("channelIds", "title logo coverImage")
    .populate("createdBy", "name email profilePicture phone country")
    .sort({ date: -1 })
    .limit(MAX_STREAMS)
    .lean();

  // Same list the One Time view returns, built by the same code — two copies
  // of this mapping had already started to drift.
  const series = await loadRecurringSeries(baseFilter);

  // Default to the most recently scheduled series so the view always has
  // something to show — an empty table behind a picker reads as broken.
  const selected =
    seriesWorkshops.find((w: any) => String(w._id) === opts.seriesId) ||
    seriesWorkshops[0];

  if (!selected) {
    return {
      rows: [],
      total: 0,
      totals: { ...EMPTY_TOTALS },
      counts,
      series,
      selectedSeriesId: null,
      selectedSeries: null,
    };
  }

  const workshopId = String(selected._id);
  const seriesTrashed = isWorkshopTrashed(selected);
  const facts = await loadStreamFacts(orgObjectId, [selected], usdToInrRate);
  const overrides = indexOverrides(facts.overrideDocs as any[]);
  const seatHolders = await resolveSeatHolders(overrides.hostIdByWorkshop);
  const seatHolder =
    seatHolders.get(overrides.hostIdByWorkshop.get(workshopId) || "") || null;

  const sessions = selected.recurrencePattern
    ? calculateSessions(
        selected.recurrencePattern,
        selected.recurrenceStartDate || selected.date,
        selected.startTime,
        selected.endTime,
        new Date(),
        500,
        true,
        selected.timezone,
        selected.recurrenceEndDate
      )
    : [];

  const perSession = selected.enrollmentType === "per_session";

  // ── Bucket every fact by the session's UTC day key ─────────────────────
  const dayKey = (d: Date | string) =>
    sessionDayKey(new Date(d)).toISOString().slice(0, 10);

  const regByDay = new Map<
    string,
    { enrollments: number; transactions: number; paidRows: number; revenueUsd: number }
  >();
  // Enrol-once buyers hold access to EVERY session, so their single row is
  // credited to each one rather than to the day they happened to buy.
  const seriesWide = { enrollments: 0, transactions: 0, paidRows: 0, revenueUsd: 0 };
  // Who enrolled, per session — the footer's "Unique Enrollment" is the size
  // of the union of these, which a sum of the per-session counts can't give:
  // one person in six sessions is six enrolments and one person.
  const enrolleeIdsByDay = new Map<string, Set<string>>();
  const seriesWideEnrolleeIds = new Set<string>();
  for (const r of facts.registrations as any[]) {
    const money = toUsd(r.amountPaid || 0, r.currency, usdToInrRate);
    const who = String(r.userId || "");
    const bump = (acc: typeof seriesWide) => {
      acc.enrollments += 1;
      if (r.hasPaid) acc.paidRows += 1;
      if ((r.amountPaid || 0) > 0) {
        acc.transactions += 1;
        acc.revenueUsd += money;
      }
    };
    if (perSession && r.enrollmentType === "session" && r.sessionDate) {
      const k = dayKey(r.sessionDate);
      const acc =
        regByDay.get(k) ||
        { enrollments: 0, transactions: 0, paidRows: 0, revenueUsd: 0 };
      bump(acc);
      regByDay.set(k, acc);
      if (who) {
        if (!enrolleeIdsByDay.has(k)) enrolleeIdsByDay.set(k, new Set());
        enrolleeIdsByDay.get(k)!.add(who);
      }
    } else {
      bump(seriesWide);
      if (who) seriesWideEnrolleeIds.add(who);
    }
  }

  const attendeesByDay = new Map<string, Set<string>>();
  const sessionWindows = sessions.map((s: any) => ({
    key: dayKey(s.date),
    start: new Date(s.startDateTime).getTime(),
    end: new Date(s.endDateTime).getTime(),
  }));
  for (const p of facts.participants as any[]) {
    const t = new Date(p.joinedAt).getTime();
    // A join is credited to the session whose window contains it. Joins
    // before the scheduled start are common (people arrive early), so the
    // window opens 30 minutes ahead of time.
    const win = sessionWindows.find(
      (w) => t >= w.start - 30 * 60 * 1000 && t <= w.end + 60 * 60 * 1000
    );
    if (!win) continue;
    if (!attendeesByDay.has(win.key)) attendeesByDay.set(win.key, new Set());
    attendeesByDay.get(win.key)!.add(p.email);
  }

  // Garage TV viewer identities per session, for the footer's unique count.
  // Note the identities are minted as `audience-<timestamp>`, so "unique"
  // here means a distinct JOIN, not a distinct person — one viewer who
  // refreshes twice is two.
  const tvViewerIdsByDay = new Map<string, Set<string>>();
  for (const o of facts.overrideDocs as any[]) {
    const ids: string[] = Array.isArray(o.garageTvViewerIds)
      ? o.garageTvViewerIds
      : [];
    if (!ids.length || !o.sessionDate) continue;
    const k = dayKey(o.sessionDate);
    if (!tvViewerIdsByDay.has(k)) tvViewerIdsByDay.set(k, new Set());
    const set = tvViewerIdsByDay.get(k)!;
    for (const id of ids) set.add(id);
  }

  const enrollAffByDay = new Map<
    string,
    { amountUsd: number; payments: number; affiliates: Set<string> }
  >();
  const enrollAffSeriesWide = {
    amountUsd: 0,
    payments: 0,
    affiliates: new Set<string>(),
  };
  for (const r of facts.enrollmentCommissions as any[]) {
    const sd = r._id.sessionDate;
    const target = sd
      ? enrollAffByDay.get(String(sd).slice(0, 10)) ||
        { amountUsd: 0, payments: 0, affiliates: new Set<string>() }
      : enrollAffSeriesWide;
    target.amountUsd += r.amountUsd || 0;
    target.payments += r.payments || 0;
    for (const uid of distinctRecipients(r.recipients)) target.affiliates.add(uid);
    if (sd) enrollAffByDay.set(String(sd).slice(0, 10), target);
  }

  const pinnedByDay = new Map<string, Set<string>>();
  for (const p of facts.pinRows as any[]) {
    const k = dayKey(p.sessionDate);
    if (!pinnedByDay.has(k)) pinnedByDay.set(k, new Set());
    pinnedByDay.get(k)!.add(String(p.itemId));
  }

  const salesByDay = new Map<
    string,
    { orders: Set<string>; auctions: Set<string>; buyers: Set<string>; revenueUsd: number }
  >();
  for (const o of facts.liveOrders as any[]) {
    const days = new Set<string>(
      (o.metadata?.liveSales || [])
        .filter((l: any) => String(l.workshopId) === workshopId)
        .map((l: any) => String(l.sessionDate).slice(0, 10))
    );
    for (const day of days) {
      const acc =
        salesByDay.get(day) ||
        {
          orders: new Set<string>(),
          auctions: new Set<string>(),
          buyers: new Set<string>(),
          revenueUsd: 0,
        };
      acc.orders.add(String(o._id));
      acc.revenueUsd += toUsd(o.total || 0, o.currency, usdToInrRate);
      if (o.userId) acc.buyers.add(String(o.userId));
      if (facts.auctionOrderIds.has(String(o._id))) acc.auctions.add(String(o._id));
      salesByDay.set(day, acc);
    }
  }

  const liveAffByDay = new Map<
    string,
    { amountUsd: number; payments: number; affiliates: Set<string> }
  >();
  for (const r of facts.liveCommissions as any[]) {
    if (String(r._id.workshopId) !== workshopId || !r._id.sessionDate) continue;
    const k = String(r._id.sessionDate).slice(0, 10);
    const acc =
      liveAffByDay.get(k) ||
      { amountUsd: 0, payments: 0, affiliates: new Set<string>() };
    acc.amountUsd += r.amountUsd || 0;
    acc.payments += r.payments || 0;
    for (const uid of distinctRecipients(r.recipients)) acc.affiliates.add(uid);
    liveAffByDay.set(k, acc);
  }

  const host = hostOf(selected);
  const communities = communitiesOf(selected);
  const label = recurrenceLabel(selected.recurrencePattern);
  const nextSession =
    selected.isRecurrenceActive && selected.recurrencePattern
      ? getNextSession(
          selected.recurrencePattern,
          selected.recurrenceStartDate || selected.date,
          selected.startTime,
          selected.endTime,
          selected.timezone,
          selected.recurrenceEndDate
        )
      : null;
  const completedSessions = sessions.filter((s: any) => s.date < new Date()).length;
  const unitUsd = toUsd(selected.price || 0, selected.currency, usdToInrRate);

  const rows: FounderStreamRow[] = sessions.map((s: any, idx: number) => {
    const k = dayKey(s.date);
    const isoKey = sessionDayKey(new Date(s.date)).toISOString();
    const override = overrides.bySessionKey.get(`${workshopId}:${isoKey}`) || null;
    // What this session says after its own edits. Unedited sessions resolve
    // to the series values, so nothing about existing rows changes.
    const effective = resolveEffectiveSession(selected, s.date, override, {
      startDateTime: new Date(s.startDateTime),
      endDateTime: new Date(s.endDateTime),
    });

    // Enrol-once revenue belongs to the series, not to any one session —
    // spreading it evenly is the only reading that makes the session column
    // sum back to the series total.
    const perDay = regByDay.get(k);
    const share = sessions.length || 1;
    // Enrol-once: a headcount is not divisible. Everyone enrolled in the
    // series is entitled to THIS session, so the row shows the full figure
    // and `totalsOverride` below stops the footer from multiplying it.
    // Money is different — it is recognised evenly across the sessions being
    // delivered, so the revenue column still sums back to the series total.
    const enrollments = perSession
      ? perDay?.enrollments || 0
      : seriesWide.enrollments;
    const transactions = perSession
      ? perDay?.transactions || 0
      : seriesWide.transactions;
    const paidRows = perSession ? perDay?.paidRows || 0 : seriesWide.paidRows / share;
    const recorded = perSession
      ? perDay?.revenueUsd || 0
      : seriesWide.revenueUsd / share;
    // The estimate for rows with no recorded amount uses THIS session's
    // price — a session repriced to $50 shouldn't be valued at the series'
    // $20. `unitUsd` (the series price) still covers enrol-once, where the
    // sale is series-wide and per-session pricing doesn't apply.
    const sessionUnitUsd = perSession
      ? toUsd(effective.price, effective.currency, usdToInrRate)
      : unitUsd;
    const revenueUsd = (perSession ? effective.isFree : selected.isFree)
      ? 0
      : recorded > 0
        ? recorded
        : paidRows * sessionUnitUsd;

    const sales = salesByDay.get(k);
    const enrollAff = perSession
      ? enrollAffByDay.get(k)
      : {
          // Same rule as above: dollars split, headcounts repeated.
          amountUsd: enrollAffSeriesWide.amountUsd / share,
          payments: enrollAffSeriesWide.payments,
          affiliates: enrollAffSeriesWide.affiliates,
        };
    const liveAff = liveAffByDay.get(k);

    // Same rule as the One Time rows, applied per session — see
    // deriveWorkshopRowStatus. `deriveSessionStatus` is NOT used here because
    // its clock rungs would mark a session Active the moment its window opened
    // and Completed once it closed, whether or not anyone ran it.
    const status: FounderStreamStatus = (() => {
      // Trashing the series trashes every session under it, including ones
      // that never got their own override document.
      if (seriesTrashed) return "deleted";
      if (isSessionDeleted(override)) return "deleted";
      if (!override) return "not_started";

      const startedAt = override.manualStartedAt
        ? new Date(override.manualStartedAt).getTime()
        : null;
      const endedAt = override.manualEndedAt
        ? new Date(override.manualEndedAt).getTime()
        : null;

      // A stop only ends the session until it is started again — comparing
      // the two stamps is what lets a restarted session read Active instead
      // of being stuck on the older end.
      if (endedAt !== null && !(startedAt !== null && startedAt > endedAt)) {
        return "completed";
      }
      if (startedAt !== null) {
        return Date.now() - startedAt <= MANUAL_START_STALE_MS
          ? "active"
          : "completed";
      }
      // Seat claimed but no start stamp yet — the room is being entered.
      if (override.hostUserId) return "active";
      return "not_started";
    })();

    return {
      _id: `${workshopId}:${isoKey}`,
      workshopId,
      title: effective.title,
      thumbnail: effective.thumbnail,
      isRecurring: true,
      sessionNumber: idx + 1,
      sessionDate: isoKey,
      isEdited: effective.isEdited,
      // Set only when the session was moved off its slot, so the cell can say
      // "moved from <slot day>" instead of silently showing a date that
      // doesn't match the recurrence rule.
      rescheduledFrom: effective.isRescheduled ? isoKey : undefined,
      // The speaker override is a per-session identity; the series host stays
      // in `host` so the column never goes blank.
      sessionSpeaker: effective.speakerName
        ? {
            name: effective.speakerName,
            avatar: effective.speakerAvatar,
            bio: effective.speakerBio,
          }
        : undefined,
      host,
      communities,
      schedule: {
        date: effective.startDateTime.toISOString(),
        startTime: effective.startTime || "",
        endTime: effective.endTime || "",
        timezone: effective.timezone || "UTC",
        nextSessionDate: nextSession
          ? new Date(nextSession.startDateTime).toISOString()
          : null,
        recurrenceLabel: label,
        totalSessions: sessions.length,
        completedSessions,
      },
      status,
      // Only the session actually running has a seat holder.
      sessionHost: status === "active" ? seatHolder : null,
      payment: {
        // Per-session pricing, which in per_session mode is what a buyer is
        // actually charged for this row.
        isFree: effective.isFree,
        price: effective.price,
        currency: effective.currency,
        country: host?.country || undefined,
      },
      totalEnrollments: enrollments,
      totalAttendees: attendeesByDay.get(k)?.size || 0,
      garageTvViews:
        overrides.garageTvBySession.get(`${workshopId}:${isoKey}`) || 0,
      enrollmentRevenue: { amountUsd: revenueUsd, transactions },
      enrollmentAffiliate: enrollAff
        ? {
            amountUsd: enrollAff.amountUsd,
            affiliates: enrollAff.affiliates.size,
            payments: enrollAff.payments,
          }
        : emptyAffiliate(),
      liveSellingProducts: {
        products: pinnedByDay.get(k)?.size || 0,
        customers: sales?.buyers.size || 0,
      },
      liveSellingStats: {
        revenueUsd: sales?.revenueUsd || 0,
        auctions: sales?.auctions.size || 0,
        standardSales: sales ? sales.orders.size - sales.auctions.size : 0,
      },
      liveSellingAffiliates: liveAff
        ? {
            amountUsd: liveAff.amountUsd,
            affiliates: liveAff.affiliates.size,
            payments: liveAff.payments,
          }
        : emptyAffiliate(),
    };
  });

  // Built from the UNFILTERED rows on purpose: the header describes the
  // series, so filtering the table down to Completed sessions must not make
  // the series itself read Completed.
  const seriesHeader = await buildSeriesHeader(selected, {
    host,
    nextSession,
    hasLiveSession: rows.some((r) => r.status === "active"),
    hasManualEnd: overrides.manualEndByWorkshop.has(workshopId),
    hasEverStarted: overrides.everStartedByWorkshop.has(workshopId),
    totalSessions: sessions.length,
  });

  const draftIds = new Set(selected.meetingUrl ? [] : [workshopId]);
  const finished = finish(rows, {
    search: opts.search,
    status: opts.status ?? "all",
    payment: opts.payment ?? "all",
    page: opts.page,
    limit: opts.limit,
    sortBy: opts.sortBy,
    sortOrder: opts.sortOrder,
    draftIds,
    columnFilters: opts.columnFilters,
    // Headcounts of distinct people can't be summed out of the rows, so they
    // are unioned here over the sessions that survived the filters — a footer
    // that ignored the filters would describe a table nobody is looking at.
    totalsOverride: (visible) => {
      const days = visible.map((r) => (r.sessionDate || "").slice(0, 10));
      const union = (byDay: Map<string, Set<string>>) => {
        const out = new Set<string>();
        for (const d of days) {
          const set = byDay.get(d);
          if (set) for (const v of set) out.add(v);
        }
        return out.size;
      };

      return {
        // Enrol-once: the series has ONE set of enrolees no matter how many
        // sessions are in view, so the footer reports that rather than the sum
        // of the (identical) row figures — and every one of them is unique by
        // definition, since you can only buy the series once.
        ...(perSession
          ? { uniqueEnrollments: union(enrolleeIdsByDay) }
          : {
              enrollments: seriesWide.enrollments,
              uniqueEnrollments: seriesWideEnrolleeIds.size,
            }),
        uniqueAttendees: union(attendeesByDay),
        uniqueGarageTvViews: union(tvViewerIdsByDay),
      };
    },
  });

  return {
    ...finished,
    counts,
    series,
    selectedSeriesId: workshopId,
    selectedSeries: seriesHeader,
  };
}

/**
 * The series-level block the recurring view renders above its table.
 *
 * The commission figure is the workshop's active CombPlan total — the same
 * number the card list shows — applied to the enrolment price, so a founder
 * reads "40% ($8.00)" rather than having to do the arithmetic on a percentage
 * of a price shown three chips away.
 */
async function buildSeriesHeader(
  w: any,
  ctx: {
    host: FounderStreamRow["host"];
    nextSession: any;
    hasLiveSession: boolean;
    hasManualEnd: boolean;
    hasEverStarted: boolean;
    totalSessions: number;
  }
): Promise<FounderSeriesHeader> {
  const combPlan = await CombPlan.findOne({
    itemType: "workshop",
    itemId: w._id,
    isActive: true,
  })
    .select("totalPercentage")
    .lean();

  const price = w.price || 0;
  const percent = (combPlan as any)?.totalPercentage ?? null;

  return {
    _id: String(w._id),
    title: w.title,
    thumbnail: w.thumbnail || undefined,
    host: ctx.host
      ? {
          id: ctx.host.id,
          name: ctx.host.name,
          email: ctx.host.email,
          profilePicture: ctx.host.profilePicture,
        }
      : null,
    enrollmentType: w.enrollmentType === "per_session" ? "per_session" : "once",
    status: deriveWorkshopRowStatus(w, {
      nextSession: ctx.nextSession,
      hasManualEnd: ctx.hasManualEnd,
      hasLiveSession: ctx.hasLiveSession,
      hasEverStarted: ctx.hasEverStarted,
    }),
    communities: communitiesOf(w),
    payment: {
      isFree: !!w.isFree,
      price,
      currency: (w.currency || "USD").toUpperCase(),
      country: ctx.host?.country || undefined,
    },
    commission:
      percent === null
        ? null
        : { percent, amount: (price * percent) / 100 },
    totalSessions: ctx.totalSessions,
  };
}
