import { IWorkshop } from "../models/workshop.model";
import {
  IWorkshopSessionOverride,
  WorkshopSessionOverride,
} from "../models/workshopSessionOverride.model";
import { calculateSessions, WorkshopSession } from "./recurrence";
import {
  resolveSessionSchedule,
  sessionDayKey,
  type SessionOverlayFields,
} from "./sessionOverlay";
import { Types } from "mongoose";

// Re-exported from its new home so every existing importer keeps working.
// It moved to sessionOverlay.ts to break the import cycle this file would
// otherwise have with it.
export { sessionDayKey };

export type SessionStatus =
  | "yet-to-happen"
  | "live"
  | "completed"
  | "deleted";
export type WorkshopStatus = "active" | "completed" | "deleted";

type OverrideLite = Pick<
  IWorkshopSessionOverride,
  "deletedAt" | "restoredAt" | "manualStartedAt" | "manualEndedAt"
> &
  SessionOverlayFields;

type WorkshopLite = Pick<IWorkshop, "deletedAt" | "restoredAt">;

type SessionWindow = { startDateTime: Date; endDateTime: Date };

/**
 * A session is "in Trash" when deletedAt is set and either no restoredAt
 * exists or restoredAt is older than deletedAt (i.e. the delete happened
 * after the last restore).
 */
export function isSessionDeleted(o?: OverrideLite | null): boolean {
  if (!o?.deletedAt) return false;
  if (o.restoredAt && o.restoredAt > o.deletedAt) return false;
  return true;
}

export function isWorkshopDeleted(w: WorkshopLite): boolean {
  if (!w.deletedAt) return false;
  if (w.restoredAt && w.restoredAt > w.deletedAt) return false;
  return true;
}

/**
 * Pure derivation — no I/O, no globals besides `now`.
 *
 * Order of precedence:
 *   1. Trashed session (regardless of clock) → "deleted"
 *   2. Founder manually ended → "completed"
 *   3. Scheduled end passed → "completed"
 *   4. Founder manually started OR scheduled start passed → "live"
 *   5. Otherwise → "yet-to-happen"
 *
 * The Deleted status is only for the badge on the Trash page; if callers
 * want the natural clock-based badge for a Trashed row (e.g. to show
 * "would have been Live now"), they can pass `override` with `deletedAt`
 * cleared, or use `deriveClockStatus` below.
 */
export function deriveSessionStatus(
  session: SessionWindow,
  override?: OverrideLite | null,
  now: Date = new Date()
): SessionStatus {
  if (isSessionDeleted(override)) return "deleted";
  return deriveClockStatus(session, override, now);
}

// A session that was manually started but never manually ended is kept as
// Live for up to this window before we assume the founder forgot to Stop
// and flip to Completed on our own. Matches the MeetSweeper's 8h stale-
// live cutoff in index.ts.
const MANUAL_START_STALE_MS = 8 * 60 * 60 * 1000;

/**
 * Ignores the trash flag — always returns yet-to-happen / live / completed
 * based on the clock and manual events. Used by the Trash page so a
 * trashed row still shows "Live" while the timeline is running.
 *
 * Precedence:
 *   1. manualEndedAt → completed (founder explicitly ended)
 *   2. manualStartedAt (and not stale) → live, even past scheduledEnd
 *      — founder is still running the session; the clock does NOT
 *      override this signal. This is the fix for "webinar was still on
 *      but the row showed Completed."
 *   3. Clock end → completed (no manual signal, scheduled end passed)
 *   4. Clock start (or manualStartedAt stale-and-past-end) → live
 *   5. Else → yet-to-happen
 */
export function deriveClockStatus(
  session: SessionWindow,
  override?: OverrideLite | null,
  now: Date = new Date()
): Exclude<SessionStatus, "deleted"> {
  // A stop only ends the session until the founder starts it again. Comparing
  // the two stamps is what lets a restarted session read live — otherwise the
  // older end wins forever and every attendee is told the session has ended
  // while the room is running.
  if (
    override?.manualEndedAt &&
    !(
      override.manualStartedAt &&
      new Date(override.manualStartedAt).getTime() >
        new Date(override.manualEndedAt).getTime()
    )
  ) {
    return "completed";
  }

  if (override?.manualStartedAt) {
    const stale =
      now.getTime() - new Date(override.manualStartedAt).getTime() >
      MANUAL_START_STALE_MS;
    if (!stale) return "live";
    // Stale manual-start: fall through to clock. If clock end already
    // passed we'll return completed; otherwise still live-by-clock.
  }

  if (now >= session.endDateTime) return "completed";
  if (now >= session.startDateTime) return "live";
  return "yet-to-happen";
}

export function deriveWorkshopStatus(
  workshop: WorkshopLite,
  enrichedSessions: Array<{ status: SessionStatus }>,
  _now: Date = new Date()
): WorkshopStatus {
  if (isWorkshopDeleted(workshop)) return "deleted";
  const anyOpen = enrichedSessions.some(
    (s) => s.status !== "completed" && s.status !== "deleted"
  );
  return anyOpen ? "active" : "completed";
}

export interface EnrichedSession extends WorkshopSession {
  status: SessionStatus;
  override?: OverrideLite | null;
}

/**
 * Compute [startDateTime, endDateTime] for a single session, given its
 * calendar date (UTC midnight). Handles both:
 *   - Recurring per_session: uses `calculateSessions` so it respects
 *     recurrencePattern + timezone offset.
 *   - Non-recurring / enrol-once: derives directly from workshop.date +
 *     startTime + endTime + timezone, matching how calculateSessions does
 *     the offset math.
 *
 * Returns null when the target date isn't a valid session for a recurring
 * workshop (e.g. wrong day-of-week). Prepare-join can then fall through
 * to the picker.
 *
 * `override` shifts the window when the founder has rescheduled this session
 * or given it its own times. `targetDate` stays the canonical slot key either
 * way — a moved session is still identified by the day the rule produced.
 */
export function computeSessionWindow(
  workshop: Pick<
    IWorkshop,
    | "isRecurring"
    | "recurrencePattern"
    | "recurrenceStartDate"
    | "recurrenceEndDate"
    | "startTime"
    | "endTime"
    | "timezone"
    | "date"
  >,
  targetDate: Date,
  override?: SessionOverlayFields | null
): { startDateTime: Date; endDateTime: Date } | null {
  if (
    workshop.isRecurring &&
    workshop.recurrencePattern &&
    workshop.recurrenceStartDate
  ) {
    const sessions = calculateSessions(
      workshop.recurrencePattern,
      workshop.recurrenceStartDate,
      workshop.startTime,
      workshop.endTime,
      new Date(),
      500,
      true,
      workshop.timezone,
      workshop.recurrenceEndDate
    );
    const targetKey = sessionDayKey(targetDate).toISOString();
    const match = sessions.find(
      (s) => sessionDayKey(s.date).toISOString() === targetKey
    );
    if (!match) return null;
    const { startDateTime, endDateTime } = resolveSessionSchedule(
      workshop as any,
      match.date,
      override,
      { startDateTime: match.startDateTime, endDateTime: match.endDateTime }
    );
    return { startDateTime, endDateTime };
  }

  // Non-recurring: derive from the target day + startTime + endTime + tz.
  const { startDateTime, endDateTime } = resolveSessionSchedule(
    workshop as any,
    targetDate,
    override
  );
  return { startDateTime, endDateTime };
}

/**
 * Anchor two dates on the same UTC calendar day (ignores hours/mins).
 * Used to match a session's date to its override row's sessionDate.
 */
export function sameSessionDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Which session is this live-room event about?
 *
 * Events that arrive while a stream is running (a Garage TV viewer joining, a
 * product being pinned) have to be filed against one session day. Resolution
 * order, most to least trustworthy:
 *
 *   1. the occurrence whose scheduled window contains `now` — if a session is
 *      running by the clock, that is the one being streamed;
 *   2. `workshop.currentSessionDate`, when it matches a real occurrence — the
 *      founder's own pick, and what an early start stamps;
 *   3. the occurrence starting closest to `now`.
 *
 * Non-recurring workshops resolve to their single date. Anything unresolvable
 * falls back to today's UTC midnight.
 *
 * Order matters: `currentSessionDate` is only cleared on a clean stop, so a
 * stale value from a previous run must not outrank a session that is actually
 * on air right now.
 */
export async function resolveLiveSessionKey(
  workshop: {
    date?: Date;
    isRecurring?: boolean;
    currentSessionDate?: Date | null;
    recurrencePattern?: any;
    recurrenceStartDate?: Date;
    recurrenceEndDate?: Date;
    startTime?: string;
    endTime?: string;
    timezone?: string;
  },
  now: Date = new Date()
): Promise<Date> {
  const anchor = workshop.currentSessionDate || workshop.date || now;
  if (!workshop.isRecurring || !workshop.recurrencePattern) {
    return sessionDayKey(anchor);
  }

  const { calculateSessions } = await import("./recurrence");
  const occurrences = calculateSessions(
    workshop.recurrencePattern,
    (workshop.recurrenceStartDate || workshop.date) as Date,
    workshop.startTime as string,
    workshop.endTime as string,
    now,
    500,
    true,
    workshop.timezone,
    workshop.recurrenceEndDate
  );
  if (!occurrences.length) return sessionDayKey(anchor);

  const running = occurrences.find(
    (o) => o.startDateTime <= now && now <= o.endDateTime
  );
  if (running) return sessionDayKey(running.date);

  const anchorKey = sessionDayKey(anchor).getTime();
  const onAnchor = occurrences.find(
    (o) => sessionDayKey(o.date).getTime() === anchorKey
  );
  if (onAnchor) return sessionDayKey(onAnchor.date);

  const nearest = occurrences.reduce((best, o) =>
    Math.abs(o.startDateTime.getTime() - now.getTime()) <
    Math.abs(best.startDateTime.getTime() - now.getTime())
      ? o
      : best
  );
  return sessionDayKey(nearest.date);
}

/**
 * Look up an override by (workshopId, sessionDate). Case-neutral on the
 * time-of-day component — sessionDate is stored as UTC midnight.
 */
export async function findSessionOverride(
  workshopId: Types.ObjectId | string,
  sessionDate: Date
): Promise<IWorkshopSessionOverride | null> {
  const key = sessionDayKey(sessionDate);
  return WorkshopSessionOverride.findOne({
    workshopId: new Types.ObjectId(workshopId.toString()),
    sessionDate: key,
  });
}

/**
 * Enrich a set of computed sessions with their override + derived status.
 * Loads all overrides for the workshop in one query.
 */
export async function enrichSessionsWithStatus(
  workshop: Pick<
    IWorkshop,
    | "_id"
    | "isRecurring"
    | "recurrencePattern"
    | "recurrenceStartDate"
    | "recurrenceEndDate"
    | "startTime"
    | "endTime"
    | "timezone"
    | "date"
  >,
  opts: {
    fromDate?: Date;
    limit?: number;
    includePast?: boolean;
  } = {}
): Promise<EnrichedSession[]> {
  const now = new Date();
  let sessions: WorkshopSession[] = [];

  if (workshop.isRecurring && workshop.recurrencePattern && workshop.recurrenceStartDate) {
    sessions = calculateSessions(
      workshop.recurrencePattern,
      workshop.recurrenceStartDate,
      workshop.startTime,
      workshop.endTime,
      opts.fromDate ?? now,
      opts.limit ?? 50,
      opts.includePast ?? true,
      workshop.timezone,
      workshop.recurrenceEndDate
    );
  } else {
    // Non-recurring: single session anchored on workshop.date
    const [sh, sm] = (workshop.startTime || "00:00").split(":").map((n) => parseInt(n));
    const [eh, em] = (workshop.endTime || "00:00").split(":").map((n) => parseInt(n));
    const base = new Date(workshop.date);
    const start = new Date(base);
    start.setUTCHours(sh || 0, sm || 0, 0, 0);
    const end = new Date(base);
    end.setUTCHours(eh || 0, em || 0, 0, 0);
    // Handle end-before-start (crossed midnight)
    if (end <= start) end.setUTCDate(end.getUTCDate() + 1);
    sessions = [
      {
        date: sessionDayKey(base),
        startDateTime: start,
        endDateTime: end,
        isPast: end < now,
        isToday: sameSessionDay(base, now),
        dateString: sessionDayKey(base).toISOString().slice(0, 10),
      },
    ];
  }

  if (sessions.length === 0) return [];

  const overrides = await WorkshopSessionOverride.find({
    workshopId: workshop._id,
  }).lean();

  const byKey = new Map<string, IWorkshopSessionOverride>();
  for (const o of overrides as any as IWorkshopSessionOverride[]) {
    byKey.set(sessionDayKey(o.sessionDate).toISOString(), o);
  }

  return sessions.map((s) => {
    const key = sessionDayKey(s.date).toISOString();
    const override = byKey.get(key) || null;
    // A rescheduled session, or one given its own times, is judged against the
    // window it will actually run in — not the slot the rule produced.
    const schedule = resolveSessionSchedule(workshop as any, s.date, override, {
      startDateTime: s.startDateTime,
      endDateTime: s.endDateTime,
    });
    const enriched: WorkshopSession = {
      ...s,
      startDateTime: schedule.startDateTime,
      endDateTime: schedule.endDateTime,
      isPast: schedule.endDateTime < now,
    };
    return {
      ...enriched,
      override,
      status: deriveSessionStatus(enriched, override, now),
    };
  });
}
