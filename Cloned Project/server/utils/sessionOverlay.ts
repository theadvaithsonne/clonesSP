/**
 * Merging one session's overrides over its parent Workshop.
 *
 * Sessions of a recurring workshop are computed, not stored: utils/recurrence.ts
 * walks the recurrence rule and produces occurrences. A founder editing ONE of
 * them writes a WorkshopSessionOverride keyed by (workshopId, sessionDate), and
 * every read path then has to answer the same question — "what does this
 * session actually say?" This module is that answer, and the only place the
 * fallback rules live.
 *
 * Three invariants hold the design together:
 *
 *   1. NO OVERRIDE ⇒ THE SERIES, VERBATIM. Every resolver below returns exactly
 *      the parent Workshop's values when handed a null override, so a series
 *      created before per-session editing existed behaves identically. Override
 *      documents are upserted on demand; nothing is backfilled.
 *
 *   2. `sessionDate` IS IMMUTABLE. It is the UTC-midnight day key the
 *      recurrence rule produced, and it identifies the slot for registrations,
 *      orders, access gating and webinar routing. Moving a session to another
 *      day sets `rescheduledDate`, which changes when it is DELIVERED, never
 *      what it IS.
 *
 *   3. PRICE IS RESOLVED, NEVER READ RAW. In `per_session` mode the amount a
 *      buyer is charged, the amount recorded on the registration and the
 *      commission base all come from `resolveSessionPricing`, so a session
 *      priced differently from its series can't be bought at the series price.
 */

import { IWorkshop } from "../models/workshop.model";
import { IWorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { getTimezoneOffsetMinutes } from "./recurrence";

/**
 * UTC day-anchor for a Date (midnight UTC of the same day). This is the
 * canonical key stored on WorkshopSessionOverride.sessionDate.
 *
 * Lives here rather than in workshopStatus.ts so this module has no import
 * cycle with it; workshopStatus re-exports it, so existing callers are
 * unaffected.
 */
export function sessionDayKey(d: Date): Date {
  const k = new Date(d);
  k.setUTCHours(0, 0, 0, 0);
  return k;
}

/** The subset of a Workshop the overlay reads. Accepts lean docs. */
export type WorkshopTemplate = Pick<
  IWorkshop,
  | "title"
  | "description"
  | "thumbnail"
  | "startTime"
  | "endTime"
  | "timezone"
  | "isFree"
  | "price"
  | "currency"
> &
  Partial<Pick<IWorkshop, "agenda" | "date">>;

/** The overridable half of a session override document. */
export type SessionOverlayFields = Partial<
  Pick<
    IWorkshopSessionOverride,
    | "title"
    | "description"
    | "thumbnail"
    | "rescheduledDate"
    | "startTime"
    | "endTime"
    | "timezone"
    | "isFree"
    | "price"
    | "speakerName"
    | "speakerBio"
    | "speakerAvatar"
    | "agenda"
    | "isEdited"
  >
>;

/** What resolvers accept: a (possibly lean) override doc, or nothing. */
export type SessionOverlaySource = SessionOverlayFields | null | undefined;

/**
 * Every field a per-session edit may write.
 *
 * Used by the update endpoint to build its $set/$unset, and by "revert to
 * series defaults" to clear exactly these and nothing else — the lifecycle
 * fields (deletedAt, manualStartedAt, hostUserId, garageTvViewerIds…) are
 * history and survive a revert.
 */
export const SESSION_EDITABLE_FIELDS = [
  "title",
  "description",
  "thumbnail",
  "rescheduledDate",
  "startTime",
  "endTime",
  "timezone",
  "isFree",
  "price",
  "speakerName",
  "speakerBio",
  "speakerAvatar",
  "agenda",
] as const;

export type SessionEditableField = (typeof SESSION_EDITABLE_FIELDS)[number];

/** Does this override actually differ from its series? Derived, not trusted:
 *  the stored `isEdited` flag is a cache and a revert may race an edit. */
export function hasSessionEdits(override: SessionOverlaySource): boolean {
  if (!override) return false;
  return SESSION_EDITABLE_FIELDS.some((f) => {
    const v = (override as any)[f];
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  });
}

/* ── schedule ───────────────────────────────────────────────────────────── */

export interface SessionSchedule {
  /** Canonical slot id — UTC midnight of the recurrence day. Immutable. */
  sessionDate: Date;
  /** The day it is delivered on: rescheduledDate when moved, else the slot. */
  displayDate: Date;
  startTime: string;
  endTime: string;
  timezone: string;
  startDateTime: Date;
  endDateTime: Date;
  isRescheduled: boolean;
}

/**
 * Turn a calendar day + "HH:mm" wall-clock times + an IANA zone into the two
 * UTC instants the session runs between.
 *
 * Mirrors calculateSessions' offset handling exactly (see recurrence.ts:219):
 * setUTCHours writes the wall-clock reading as if it were UTC, so the zone's
 * offset is subtracted afterwards to land on the real instant. An end at or
 * before the start means the session crosses midnight.
 */
export function windowFromDayAndTimes(
  day: Date,
  startTime: string | undefined,
  endTime: string | undefined,
  timezone?: string
): { startDateTime: Date; endDateTime: Date } {
  const base = sessionDayKey(day);
  const [sh, sm] = (startTime || "00:00").split(":").map(Number);
  const [eh, em] = (endTime || "00:00").split(":").map(Number);

  const startDateTime = new Date(base);
  startDateTime.setUTCHours(sh || 0, sm || 0, 0, 0);
  const endDateTime = new Date(base);
  endDateTime.setUTCHours(eh || 0, em || 0, 0, 0);
  if (endDateTime <= startDateTime) {
    endDateTime.setUTCDate(endDateTime.getUTCDate() + 1);
  }

  if (timezone) {
    const offset = getTimezoneOffsetMinutes(startDateTime, timezone);
    startDateTime.setMinutes(startDateTime.getMinutes() - offset);
    endDateTime.setMinutes(endDateTime.getMinutes() - offset);
  }

  return { startDateTime, endDateTime };
}

/**
 * When and for how long this specific session runs.
 *
 * `fallbackWindow` is the window the recurrence engine already computed for
 * this occurrence. It is used verbatim when nothing schedule-related is
 * overridden, so an unedited session keeps byte-identical timings to what it
 * had before this feature existed — including any quirk of calculateSessions
 * this helper doesn't reproduce.
 */
export function resolveSessionSchedule(
  workshop: WorkshopTemplate,
  canonicalDate: Date,
  override: SessionOverlaySource,
  fallbackWindow?: { startDateTime: Date; endDateTime: Date } | null
): SessionSchedule {
  const sessionDate = sessionDayKey(canonicalDate);
  const rescheduled = override?.rescheduledDate
    ? sessionDayKey(new Date(override.rescheduledDate))
    : null;
  const isRescheduled =
    !!rescheduled && rescheduled.getTime() !== sessionDate.getTime();

  const startTime = override?.startTime || workshop.startTime;
  const endTime = override?.endTime || workshop.endTime;
  const timezone = override?.timezone || workshop.timezone;

  const touched =
    isRescheduled ||
    !!override?.startTime ||
    !!override?.endTime ||
    !!override?.timezone;

  const window =
    !touched && fallbackWindow
      ? {
          startDateTime: new Date(fallbackWindow.startDateTime),
          endDateTime: new Date(fallbackWindow.endDateTime),
        }
      : windowFromDayAndTimes(
          rescheduled || sessionDate,
          startTime,
          endTime,
          timezone
        );

  return {
    sessionDate,
    displayDate: rescheduled || sessionDate,
    startTime,
    endTime,
    timezone,
    ...window,
    isRescheduled,
  };
}

/* ── pricing ────────────────────────────────────────────────────────────── */

export interface SessionPricing {
  isFree: boolean;
  price: number;
  currency: string;
  /** True when this session is priced differently from its series. */
  isOverridden: boolean;
}

/**
 * What this session costs.
 *
 * Rules, in order:
 *   - an explicit session `isFree: true` wins outright and zeroes the price;
 *   - an explicit session `price` replaces the series price;
 *   - `isFree` and `price` are then reconciled, so "paid at 0" and "free with
 *     a price" both collapse to free rather than producing a ₹0 Razorpay order;
 *   - with neither set, the series answer is returned unchanged — the same
 *     `workshop.isFree || price <= 0` reading every call site used before.
 *
 * Currency is NOT per-session: mixing currencies inside one series would break
 * the invoice, commission and USD-conversion paths that all assume one.
 */
export function resolveSessionPricing(
  workshop: Pick<WorkshopTemplate, "isFree" | "price" | "currency">,
  override: SessionOverlaySource
): SessionPricing {
  const currency = (workshop.currency || "USD").toUpperCase();
  const basePrice = Number(workshop.price) || 0;
  const baseFree = !!workshop.isFree || basePrice <= 0;

  const hasPrice =
    typeof override?.price === "number" && Number.isFinite(override.price);
  const hasFree = typeof override?.isFree === "boolean";

  if (!hasPrice && !hasFree) {
    return { isFree: baseFree, price: basePrice, currency, isOverridden: false };
  }

  let price = hasPrice ? Math.max(0, Number(override!.price)) : basePrice;
  let isFree = hasFree ? !!override!.isFree : price <= 0;
  if (isFree) price = 0;
  else if (price <= 0) isFree = true;

  return {
    isFree,
    price,
    currency,
    isOverridden: isFree !== baseFree || price !== basePrice,
  };
}

/* ── full view ──────────────────────────────────────────────────────────── */

export interface EffectiveSession extends SessionSchedule, SessionPricing {
  title: string;
  description?: string;
  thumbnail?: string;
  speakerName?: string;
  speakerBio?: string;
  speakerAvatar?: string;
  agenda?: Array<{ title: string; duration: string; topics: string[] }>;
  /** Any per-session edit is present (derived, not the stored flag). */
  isEdited: boolean;
}

/**
 * Everything one session says, after its overrides are applied. This is what
 * founder tables, session pickers and detail endpoints render.
 */
export function resolveEffectiveSession(
  workshop: WorkshopTemplate,
  canonicalDate: Date,
  override: SessionOverlaySource,
  fallbackWindow?: { startDateTime: Date; endDateTime: Date } | null
): EffectiveSession {
  const schedule = resolveSessionSchedule(
    workshop,
    canonicalDate,
    override,
    fallbackWindow
  );
  const pricing = resolveSessionPricing(workshop, override);

  return {
    ...schedule,
    ...pricing,
    title: override?.title || workshop.title,
    description: override?.description ?? workshop.description,
    thumbnail: override?.thumbnail || workshop.thumbnail,
    speakerName: override?.speakerName,
    speakerBio: override?.speakerBio,
    speakerAvatar: override?.speakerAvatar,
    agenda:
      override?.agenda && override.agenda.length
        ? (override.agenda as EffectiveSession["agenda"])
        : (workshop.agenda as EffectiveSession["agenda"]),
    isEdited: hasSessionEdits(override),
  };
}

/**
 * Index a workshop's override docs by their UTC day key, for row builders that
 * load the whole set in one query and then walk the occurrences.
 */
export function indexOverridesByDay<T extends { sessionDate: Date }>(
  docs: T[]
): Map<string, T> {
  const byKey = new Map<string, T>();
  for (const doc of docs || []) {
    if (!doc?.sessionDate) continue;
    byKey.set(sessionDayKey(new Date(doc.sessionDate)).toISOString(), doc);
  }
  return byKey;
}
