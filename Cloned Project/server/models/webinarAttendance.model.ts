import { Schema, model, Document, Types } from "mongoose";

/**
 * Someone who was actually in a live session.
 *
 * Nothing recorded this before. `WorkshopRegistration` says who signed up —
 * across the whole database not one row has ever been marked "attended" —
 * and `MeetParticipant` belongs to the standalone Meet product, not to
 * webinars. So "who watched this webinar" had no answer at all, and the
 * host's only proxies were registrations (which overstate: signing up is not
 * showing up) or chat authors (which understate: most people never type).
 *
 * One row per (workshopId, sessionDate, userId), matching WebinarProductPin
 * so attendance, pins and sales all key on the same session. `sessionDate` is
 * the UTC-midnight day key from `resolveLiveSessionKey`.
 *
 * A join is not a session: the mobile room screen is a pushed route, so
 * stepping out to the mini player and back re-runs the join handshake on the
 * same socket, and a flaky network reconnects repeatedly. Hence `joinCount`
 * and an accumulating `totalSeconds` rather than a single joined/left pair —
 * one person who dropped four times is one attendee, not four.
 *
 * Identity is snapshotted (`name`, `email`) because the export has to keep
 * working after someone renames themselves or deletes their account.
 */
export interface IWebinarAttendance extends Document {
  _id: Types.ObjectId;
  workshopId: Types.ObjectId;
  orgId: Types.ObjectId;
  sessionDate: Date;
  userId: Types.ObjectId;
  /** Snapshotted at join — survives a later rename or account deletion. */
  name?: string;
  email?: string;
  /** Highest role held during the session (host > panelist > attendee). */
  role: "host" | "panelist" | "attendee";
  firstJoinedAt: Date;
  lastJoinedAt: Date;
  lastLeftAt?: Date;
  /** Sum of every stint in the room, in seconds. */
  totalSeconds: number;
  joinCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WebinarAttendanceSchema = new Schema<IWebinarAttendance>(
  {
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    sessionDate: { type: Date, required: true },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String },
    email: { type: String },
    role: {
      type: String,
      enum: ["host", "panelist", "attendee"],
      default: "attendee",
    },
    firstJoinedAt: { type: Date, required: true },
    lastJoinedAt: { type: Date, required: true },
    lastLeftAt: { type: Date },
    totalSeconds: { type: Number, default: 0 },
    joinCount: { type: Number, default: 1 },
  },
  { timestamps: true }
);

// One row per person per session — rejoins bump joinCount / totalSeconds.
WebinarAttendanceSchema.index(
  { workshopId: 1, sessionDate: 1, userId: 1 },
  { unique: true }
);

export const WebinarAttendance = model<IWebinarAttendance>(
  "WebinarAttendance",
  WebinarAttendanceSchema
);
