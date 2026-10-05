import mongoose, { Types } from "mongoose";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { sessionDayKey } from "../utils/workshopStatus";

/**
 * One host seat per webinar session, handed to whoever claims it first.
 *
 * A workshop used to have exactly one person who could run it — its creator —
 * so "am I the host?" was a field comparison. Now the founder can delegate the
 * `live_streams` module, and both the creator and the delegate are entitled to
 * ask for `role: "host"`. Without arbitration they both got it: two hosts, two
 * sets of host controls, and a Meet that each could rotate out from under the
 * other.
 *
 * The rule is first-come: the first authorised person to enter the room takes
 * the seat for that session, and everyone who arrives afterwards is an
 * attendee — the founder included, if the delegate got there first. The seat is
 * released when the session ends, so the next session starts open again.
 *
 * The claim lives on the session row rather than in memory because it has to
 * survive a page refresh (which re-mints a LiveKit token) and a server restart
 * mid-stream. Keyed per session so a recurring workshop can be run by a
 * different person each week.
 */

/** Shape we need off a Workshop — accepts hydrated docs and `.lean()` results. */
export interface WorkshopLike {
  _id: Types.ObjectId | string;
  date?: Date | null;
  isRecurring?: boolean;
  currentSessionDate?: Date | null;
}

/**
 * Is this user staff on this stream — its creator, or someone the founder
 * delegated `live_streams` to?
 *
 * Separate from "is this user the host". Exactly one person holds the host
 * seat, but everyone eligible to hold it still belongs in the room: when the
 * delegate starts the session the founder must still be able to walk in and
 * watch, and vice versa. Staff are never enrolled buyers, so every
 * enrolment / payment gate has to let them through or the second person is
 * told to buy a ticket to their own stream.
 */
export async function isStreamStaff(
  workshop: { createdBy?: unknown; orgId?: unknown } | null | undefined,
  userId: string | null | undefined
): Promise<boolean> {
  if (!workshop || !userId || !mongoose.isValidObjectId(userId)) return false;
  if ((workshop.createdBy as any)?.toString() === userId) return true;

  const orgId = (workshop.orgId as any)?.toString();
  if (!orgId) return false;

  // Lazy import keeps services → utils one-way; utils/rbac pulls in the User
  // model, which this module otherwise has no need for.
  const { isFounderOrModuleAdmin } = await import("../utils/rbac");
  return isFounderOrModuleAdmin(userId, orgId, "live_streams");
}

/**
 * Which session is in flight, as a normalised day key.
 *
 * Mirrors the anchor resolution in webinarRoutes#stampSessionStarted and the
 * `webinar:joinRoom` stamp block — all three must agree or the claim would be
 * written to a different row than the one the live badge reads.
 */
export function resolveSessionAnchor(workshop: WorkshopLike): Date {
  const anchor =
    workshop.currentSessionDate ||
    (workshop.isRecurring ? new Date() : workshop.date) ||
    new Date();
  return sessionDayKey(anchor);
}

/**
 * Has this session already been ended?
 *
 * A seat outlives a dropped connection on purpose — a refresh re-mints the
 * LiveKit token and must not hand the stream to whoever clicks next. It must
 * NOT outlive the session itself though: for a one-off workshop the session
 * row is keyed on `workshop.date`, so a stop-then-restart lands on the SAME
 * row, and a release that failed to write would lock the stream out of a host
 * permanently. Treating an ended session's seat as free is the backstop.
 */
function seatIsStale(row: {
  manualStartedAt?: Date | null;
  manualEndedAt?: Date | null;
}): boolean {
  if (!row.manualEndedAt) return false;
  return !row.manualStartedAt || row.manualEndedAt > row.manualStartedAt;
}

export interface HostClaim {
  /** Does the caller hold the seat? */
  isHost: boolean;
  /** Who holds it, claimed or pre-existing. Empty only if the write failed. */
  hostUserId: string;
  /** True when this call is what took the seat (vs. re-reading an existing hold). */
  claimed: boolean;
}

/**
 * Take the host seat for the current session, or report who already has it.
 *
 * Idempotent for the holder: a refresh re-mints a token and lands here again,
 * and gets `isHost: true` back rather than losing the seat.
 *
 * Only call this once the caller is ALREADY authorised to host (creator, or
 * `live_streams` admin). It arbitrates between eligible people; it does not
 * decide eligibility.
 */
export async function claimSessionHost(
  workshop: WorkshopLike,
  userId: string
): Promise<HostClaim> {
  const workshopId = new Types.ObjectId(workshop._id.toString());
  const sessionDate = resolveSessionAnchor(workshop);

  if (!userId || !mongoose.isValidObjectId(userId)) {
    return { isHost: false, hostUserId: "", claimed: false };
  }

  const existing = await WorkshopSessionOverride.findOne({
    workshopId,
    sessionDate,
  })
    .select("hostUserId manualStartedAt manualEndedAt")
    .lean();

  const stale = existing ? seatIsStale(existing) : false;

  if (existing?.hostUserId && !stale) {
    return {
      isHost: existing.hostUserId.toString() === userId,
      hostUserId: existing.hostUserId.toString(),
      claimed: false,
    };
  }

  if (stale) {
    // Previous run of this session is over — take the seat outright. No CAS
    // needed: the row already exists, so there is no insert to race on.
    await WorkshopSessionOverride.updateOne(
      { workshopId, sessionDate },
      { $set: { hostUserId: new Types.ObjectId(userId) } }
    );
  } else {
    // The filter matches only an unclaimed session, so two simultaneous starts
    // cannot both succeed. If a row was created in the gap since the read
    // above, the upsert violates the unique (workshopId, sessionDate) index —
    // that is the other person winning, not an error.
    try {
      await WorkshopSessionOverride.updateOne(
        { workshopId, sessionDate, hostUserId: { $exists: false } },
        {
          $set: { hostUserId: new Types.ObjectId(userId) },
          $setOnInsert: { workshopId, sessionDate },
        },
        { upsert: true }
      );
    } catch (err) {
      if ((err as { code?: number })?.code !== 11000) throw err;
    }
  }

  // Re-read rather than trusting the write: it settles both the duplicate-key
  // race above and the case where the filter matched nothing.
  const after = await WorkshopSessionOverride.findOne({
    workshopId,
    sessionDate,
  })
    .select("hostUserId")
    .lean();

  const holder = after?.hostUserId?.toString() || "";
  return {
    isHost: holder === userId,
    hostUserId: holder,
    claimed: holder === userId,
  };
}

/** Who holds the seat right now, without taking it. Null when open. */
export async function getSessionHost(
  workshop: WorkshopLike
): Promise<string | null> {
  const row = await WorkshopSessionOverride.findOne({
    workshopId: new Types.ObjectId(workshop._id.toString()),
    sessionDate: resolveSessionAnchor(workshop),
  })
    .select("hostUserId manualStartedAt manualEndedAt")
    .lean();

  if (!row?.hostUserId) return null;
  if (seatIsStale(row)) return null;
  return row.hostUserId.toString();
}

/**
 * Free the seat. Called when the session ends, so the next start is open to
 * whoever gets there first.
 */
export async function releaseSessionHost(workshop: WorkshopLike): Promise<void> {
  await WorkshopSessionOverride.updateOne(
    {
      workshopId: new Types.ObjectId(workshop._id.toString()),
      sessionDate: resolveSessionAnchor(workshop),
    },
    { $unset: { hostUserId: "" } }
  );
}
