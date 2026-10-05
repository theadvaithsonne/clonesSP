import { Schema, model, Document, Types } from "mongoose";

/**
 * Per-session events AND per-session edits for a workshop session identified
 * by (workshopId, sessionDate). Sessions themselves are computed on the fly
 * from `Workshop.recurrencePattern` via utils/recurrence.ts — this doc
 * exists only when the founder acted on a specific session (trashed,
 * restored, manually started, manually ended, or edited it).
 *
 * Absent override ⇒ "no events, no edits: follow the Workshop template and
 * the clock only." That is what keeps every series created before per-session
 * editing shipped working unchanged — the doc is upserted on demand the first
 * time a founder touches one session, and never backfilled.
 *
 * `sessionDate` is the CANONICAL slot identifier: UTC midnight of the day the
 * recurrence rule produced. Registrations, orders, access checks and webinar
 * room routing all key off it, so it is never rewritten by an edit. Moving a
 * session to another day sets `rescheduledDate` (a display/delivery shift)
 * and leaves the slot id alone.
 *
 * See utils/workshopStatus.ts for the pure derivation function that turns
 * these events + the current time into the four session states
 * (yet-to-happen | live | completed | deleted), and utils/sessionOverlay.ts
 * for the merge of these fields over the parent Workshop.
 */
export interface IWorkshopSessionOverride extends Document {
  _id: Types.ObjectId;
  workshopId: Types.ObjectId;
  /** Canonical UTC-midnight anchor for the slot. Never altered by an edit. */
  sessionDate: Date;
  deletedAt?: Date;
  restoredAt?: Date;
  manualStartedAt?: Date;
  manualEndedAt?: Date;
  /**
   * Who holds the host seat for this session — first claimer wins.
   *
   * A workshop can now be run by its creator OR by anyone the founder
   * delegated `live_streams` to, which means two authorised people can both
   * ask for `role: "host"`. Exactly one seat exists per session: whoever
   * enters first takes it, and everyone after joins as an attendee, founder
   * included. Cleared when the session ends so the next one starts open.
   *
   * Distinct from `meta.startedBy`, which is an audit stamp of the most
   * recent start and is overwritten freely.
   */
  hostUserId?: Types.ObjectId;
  /** Unique LiveKit "audience-*" identities that watched this session from a
   *  Garage TV reel / preview card. Appended by the LiveKit
   *  participant_joined webhook; length is the session's viewer count. */
  garageTvViewerIds?: string[];
  /**
   * Live-room state that must survive the process: in-session promotions,
   * the pinned item, removed users. Written through by the socket handlers
   * and read back when a room is (re)created — see services/webinarLiveState.ts,
   * which owns the shape. Mixed here because that shape belongs to the room
   * code, not to this row.
   */
  liveState?: Record<string, unknown>;

  /* ── Per-session customisation (all optional) ────────────────────────────
   *
   * Every field here is an OVERRIDE of the parent Workshop's value. Unset ⇒
   * inherit. Read them through utils/sessionOverlay.ts rather than directly,
   * so the fallback rules stay in one place.
   *
   * `hostUserId` above is deliberately NOT part of this block: it is the live
   * host seat for the room, claimed at runtime. The speaker fields below are
   * the billing/marketing identity shown on the session, which a founder can
   * change without touching who may run it.
   */
  title?: string;
  description?: string;
  thumbnail?: string;
  /** Day this session is actually delivered on, when it has been moved off
   *  its recurrence slot. Display + scheduling only — `sessionDate` above
   *  stays the identifier for money and access. */
  rescheduledDate?: Date;
  startTime?: string; // "HH:mm" in `timezone`
  endTime?: string; // "HH:mm" in `timezone`
  timezone?: string;
  /** Session-level pricing. Honoured by order creation and payment
   *  verification in `per_session` enrolment mode. */
  isFree?: boolean;
  price?: number;
  speakerName?: string;
  speakerBio?: string;
  speakerAvatar?: string;
  agenda?: Array<{ title: string; duration: string; topics: string[] }>;
  /** Cached "this session differs from the series" marker, kept in step with
   *  the fields above on every write. Derivable (see hasSessionEdits), but
   *  stored so list queries can flag edited sessions without re-deriving. */
  isEdited?: boolean;

  meta?: {
    deletedBy?: Types.ObjectId;
    restoredBy?: Types.ObjectId;
    startedBy?: Types.ObjectId;
    endedBy?: Types.ObjectId;
    /** Last founder / delegated live_streams admin to edit this session. */
    updatedBy?: Types.ObjectId;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SessionAgendaItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
  },
  { _id: false }
);

const WorkshopSessionOverrideSchema = new Schema<IWorkshopSessionOverride>(
  {
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },
    sessionDate: {
      type: Date,
      required: true,
    },
    deletedAt: { type: Date, index: true },
    restoredAt: { type: Date },
    manualStartedAt: { type: Date },
    manualEndedAt: { type: Date },
    hostUserId: { type: Schema.Types.ObjectId, ref: "User" },
    garageTvViewerIds: { type: [String], default: undefined },
    liveState: { type: Schema.Types.Mixed },

    // Per-session customisation. No defaults anywhere in this block: an
    // absent key has to stay absent so the overlay can tell "not overridden"
    // apart from "overridden to empty/zero/false".
    title: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    thumbnail: { type: String, trim: true },
    rescheduledDate: { type: Date },
    startTime: {
      type: String,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    timezone: { type: String, trim: true },
    isFree: { type: Boolean },
    price: { type: Number, min: 0 },
    speakerName: { type: String, trim: true },
    speakerBio: { type: String, trim: true },
    speakerAvatar: { type: String, trim: true },
    agenda: { type: [SessionAgendaItemSchema], default: undefined },
    isEdited: { type: Boolean },

    meta: {
      deletedBy: { type: Schema.Types.ObjectId, ref: "User" },
      restoredBy: { type: Schema.Types.ObjectId, ref: "User" },
      startedBy: { type: Schema.Types.ObjectId, ref: "User" },
      endedBy: { type: Schema.Types.ObjectId, ref: "User" },
      updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    },
  },
  { timestamps: true }
);

WorkshopSessionOverrideSchema.index(
  { workshopId: 1, sessionDate: 1 },
  { unique: true }
);

export const WorkshopSessionOverride = model<IWorkshopSessionOverride>(
  "WorkshopSessionOverride",
  WorkshopSessionOverrideSchema
);
