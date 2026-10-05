// src/models/eventAgendaSession.model.ts
//
// One slot on the schedule. Multi-day is derived from `startTime` rather than
// stored as a day index — the organizer can move a session across days without
// anything else having to be re-keyed.

import { Schema, model, Document, Types } from "mongoose";

export interface IEventAgendaSession extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  title: string;
  description?: string;
  /** The track/stage column this sits in on the schedule grid. */
  stageName: string;
  /** Physical room for the track, shown under the track name. */
  room?: string;
  /**
   * A "break" is not owned by one track — coffee, lunch, registration. The
   * grid renders it as a single row spanning every column, which is why it
   * needs to be a type rather than just another session in track 1.
   */
  sessionType: "session" | "break";
  /** Track dot colour. Falls back to a palette slot when unset. */
  trackColor?: string;
  /**
   * Drives the LIMITED SEATS badge. Written together with
   * `requiresRegistration` — a session you have to sign up for separately is
   * by definition capped, so the organizer answers one question, not two.
   */
  isLimitedSeats: boolean;
  /** How this session runs, independently of the event's own format. */
  format: "in_person" | "virtual" | "hybrid";
  /** Attendees must claim a seat for this session on top of their ticket. */
  requiresRegistration: boolean;
  /** Seat cap when `requiresRegistration`. 0 means uncapped. */
  seatsAvailable: number;
  isRecorded: boolean;
  enableQa: boolean;
  enablePolls: boolean;
  startTime: Date;
  endTime: Date;
  speakerIds: Types.ObjectId[];
  isLivestreamed: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventAgendaSessionSchema = new Schema<IEventAgendaSession>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, trim: true, maxlength: 3000 },
    stageName: { type: String, trim: true, default: "Main Stage" },
    room: { type: String, trim: true, maxlength: 120 },
    sessionType: {
      type: String,
      enum: ["session", "break"],
      default: "session",
      index: true,
    },
    trackColor: { type: String, trim: true, maxlength: 32 },
    isLimitedSeats: { type: Boolean, default: false },
    format: {
      type: String,
      enum: ["in_person", "virtual", "hybrid"],
      default: "in_person",
    },
    requiresRegistration: { type: Boolean, default: false },
    seatsAvailable: { type: Number, default: 0, min: 0 },
    isRecorded: { type: Boolean, default: false },
    enableQa: { type: Boolean, default: false },
    enablePolls: { type: Boolean, default: false },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    speakerIds: [{ type: Schema.Types.ObjectId, ref: "EventSpeaker" }],
    isLivestreamed: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "event_agenda_sessions" }
);

EventAgendaSessionSchema.index({ eventId: 1, startTime: 1 });

export const EventAgendaSession = model<IEventAgendaSession>(
  "EventAgendaSession",
  EventAgendaSessionSchema
);
