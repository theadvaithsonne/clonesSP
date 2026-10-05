import { Schema, model, Document, Types } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";
import {
  IEmailAlerts,
  emailAlertsSchemaField,
} from "./emailAlerts.schema";
import {
  IFounderAlerts,
  founderAlertsSchemaField,
} from "./founderAlerts.schema";

// Sub-interfaces for workshop detail page fields
export interface IWorkshopAgendaItem {
  title: string;
  duration: string;
  topics: string[];
}

export interface IWorkshopBonus {
  icon: string;
  title: string;
  description: string;
}

export interface IWorkshopReview {
  _id: Types.ObjectId;
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;
  rating: number;
  text: string;
  helpfulCount: number;
  createdAt: Date;
}

export interface IWorkshopFaq {
  question: string;
  answer: string;
}

export interface IRecurrencePattern {
  type: "daily" | "weekly" | "monthly";
  excludedDays?: number[]; // For daily: days to exclude (0=Sunday, 6=Saturday)
  dayOfWeek?: number; // For weekly: which day (0-6)
  dayOfMonth?: number; // For monthly: which date (1-31)
  /**
   * Multi-day recurrence. Both are additive and optional: when absent the
   * singular `dayOfWeek` / `dayOfMonth` above are read exactly as before, so
   * every series created before multi-day selection existed is unchanged and
   * needs no migration.
   *
   * When present they WIN over the singular field. `dayOfWeek` / `dayOfMonth`
   * are still written alongside (set to the earliest selected day) so any
   * consumer that only knows the old shape still resolves to a real session
   * day rather than to nothing.
   */
  daysOfWeek?: number[]; // For weekly: every day it runs on (0-6)
  daysOfMonth?: number[]; // For monthly: every date it runs on (1-31)
}

export interface IWorkshop extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  thumbnail?: string;
  /** Cumulative watch-starts across every live session — previews and joins
   *  both count, once per watching session (see realtime/socket.ts). */
  totalViews?: number;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  date: Date;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  timezone: string;
  meetingUrl?: string;
  meetingId?: string;
  meetingPassword?: string;
  maxParticipants?: number;
  channelIds: Types.ObjectId[];
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  isFree: boolean;
  price: number;
  currency: string;
  /**
   * Post-registration email the host opted into, same config products,
   * courses and communities carry — see models/emailAlerts.schema.ts. Sent by
   * services/orderEmail.ts on both free registration and paid checkout.
   */
  emailAlerts?: IEmailAlerts;
  /**
   * "Notify me when someone registers" — the host-side alert, fired on both
   * free registration and paid checkout. See models/founderAlerts.schema.ts.
   */
  founderAlerts?: IFounderAlerts;
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  isActive: boolean;
  // Recurrence fields
  isRecurring: boolean;
  recurrencePattern?: IRecurrencePattern;
  recurrenceStartDate?: Date;
  // Bound for per_session recurring workshops — sessions stop after this
  // date (inclusive of the day). Required for per_session at
  // create/update; ignored for enrol-once + non-recurring. Legacy
  // per_session workshops without this stay unbounded (safety-capped by
  // the sessions endpoint's 500 cap).
  recurrenceEndDate?: Date;
  isRecurrenceActive: boolean;
  enrollmentType: "once" | "per_session";
  // Which recurring-workshop session the host most recently started
  // streaming. Rotated by generate-meeting. Read by the webinar join gate
  // to enforce per-session access — an attendee enrolled for a different
  // session gets denied. Undefined for non-recurring workshops or before
  // the founder has ever started a session.
  currentSessionDate?: Date;
  // Subscription settings
  isSubscription?: boolean;
  subscriptionPeriod?: "weekly" | "monthly" | "quarterly" | "yearly";
  // Recording behavior set at workshop creation — host sees no prompt, the
  // webinar page just honours this setting when they join.
  recordingMode?: "manual" | "automatic";
  /** Evergreen (pre-recorded, scheduled) playback. Absent/disabled = this
   *  workshop behaves exactly as a normal live webinar; see
   *  docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md. */
  /** Fabricated attendees and chat, shown alongside the real ones. Applies to
   *  LIVE webinars as well as evergreen — `evergreen.simulatedChat` stays as
   *  the evergreen-only script and is untouched. */
  simulatedAudience?: {
    enabled?: boolean;
    people?: { name: string }[];
    chat?: { atSec: number; name: string; message: string }[];
    viewers?: { enabled?: boolean; peak?: number };
  };
  evergreen?: {
    enabled?: boolean;
    source?: "upload" | "recording";
    videoUrl?: string;
    videoS3Key?: string;
    durationSec?: number;
    joinWindowMin?: number | null;
    loop?: boolean;
    simulatedChat?: { atSec: number; name: string; message: string }[];
    simulatedViewers?: { enabled?: boolean; peak?: number };
  };
  // Workshop detail page fields
  rating?: number;
  ratingCount?: number;
  aboutText?: string;
  learningPoints?: string[];
  agenda?: IWorkshopAgendaItem[];
  bonuses?: IWorkshopBonus[];
  reviews?: IWorkshopReview[];
  faqs?: IWorkshopFaq[];
  requirements?: string[];
  whatsIncluded?: string[];
  hostRating?: number;
  hostStudents?: string;
  hostWebinars?: string;
  hostExperience?: string;
  /**
   * Office members billed as the session's speakers, picked by the founder
   * at creation. Shown under "About" on the webinar page. Display only —
   * being listed grants no seat in the room; that is still the host's call
   * (promote) or the affiliate/host roles at join.
   */
  speakers?: Types.ObjectId[];
  // Soft-delete (Trash). deletedAt set → workshop is in Trash.
  // restoredAt > deletedAt → restored. See utils/workshopStatus.ts.
  deletedAt?: Date;
  restoredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Sub-schemas for detail page
const WorkshopAgendaItemSchema = new Schema<IWorkshopAgendaItem>(
  {
    title: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    topics: { type: [String], default: [] },
  },
  { _id: false }
);

const WorkshopBonusSchema = new Schema<IWorkshopBonus>(
  {
    icon: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const WorkshopReviewSchema = new Schema<IWorkshopReview>(
  {
    _id: { type: Schema.Types.ObjectId, default: () => new Types.ObjectId() },
    reviewerName: { type: String, required: true, trim: true },
    reviewerRole: { type: String, trim: true },
    reviewerAvatar: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true },
    helpfulCount: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkshopFaqSchema = new Schema<IWorkshopFaq>(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const WorkshopSchema = new Schema<IWorkshop>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: String,
      trim: true,
    },
    totalViews: { type: Number, default: 0, min: 0 },
    galleryImages: {
      type: [String],
      default: undefined,
    },
    videoUrl: {
      type: String,
      trim: true,
    },
    videoFile: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    startTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    endTime: {
      type: String,
      required: true,
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
    meetingUrl: {
      type: String,
      trim: true,
    },
    meetingId: {
      type: String,
      trim: true,
    },
    meetingPassword: {
      type: String,
      trim: true,
    },
    maxParticipants: {
      type: Number,
      min: 1,
      default: 300,
    },
    channelIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Channel",
      },
    ],
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isFree: {
      type: Boolean,
      default: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["INR", "USD"],
      default: "USD",
    },
    emailAlerts: emailAlertsSchemaField,
    founderAlerts: founderAlertsSchemaField,
    gstInclusive: {
      type: Boolean,
      default: true,
    },
    requireIosPayment: {
      type: Boolean,
      default: false,
    },
    appleFeeInclusive: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Recurrence fields
    isRecurring: {
      type: Boolean,
      default: false,
      index: true,
    },
    recurrencePattern: {
      type: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
      },
      excludedDays: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
      dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
      },
      dayOfMonth: {
        type: Number,
        min: 1,
        max: 31,
      },
      // Multi-day selection. Absent ⇒ fall back to the singular fields above,
      // which is what every pre-existing series has.
      daysOfWeek: [
        {
          type: Number,
          min: 0,
          max: 6,
        },
      ],
      daysOfMonth: [
        {
          type: Number,
          min: 1,
          max: 31,
        },
      ],
    },
    recurrenceStartDate: {
      type: Date,
      index: true,
    },
    recurrenceEndDate: {
      type: Date,
    },
    isRecurrenceActive: {
      type: Boolean,
      default: true,
    },
    enrollmentType: {
      type: String,
      enum: ["once", "per_session"],
      default: "once",
    },
    currentSessionDate: {
      type: Date,
    },
    recordingMode: {
      type: String,
      enum: ["manual", "automatic"],
      default: "manual",
    },
    // ── Evergreen (pre-recorded, scheduled) ──────────────────────────────
    // Purely additive: `enabled` defaults false and every consumer branches
    // on it, so a workshop without this block takes the unchanged live path.
    // The clock lives on the server (see routes/publicWebinar.ts
    // /evergreen-state) — nothing here is trusted from a client.
    simulatedAudience: {
      enabled: { type: Boolean, default: false },
      people: [{ name: { type: String, required: true, maxlength: 80 } }],
      chat: [
        {
          // Seconds after the host actually starts the session, not after the
          // scheduled time — a live webinar starts when the host says so.
          atSec: { type: Number, required: true, min: 0 },
          name: { type: String, required: true, maxlength: 80 },
          message: { type: String, required: true, maxlength: 500 },
        },
      ],
      viewers: {
        enabled: { type: Boolean, default: false },
        peak: { type: Number, default: 0, min: 0 },
      },
    },
    evergreen: {
      enabled: { type: Boolean, default: false },
      source: { type: String, enum: ["upload", "recording"] },
      videoUrl: { type: String },
      // Kept so the object can be deleted from S3 when replaced.
      videoS3Key: { type: String },
      // REQUIRED whenever enabled — without it the clock cannot decide when a
      // session has ended, so `validateEvergreen` refuses to turn it on.
      durationSec: { type: Number, min: 1 },
      // Late-join cutoff in minutes. null/absent = joinable for the whole run.
      joinWindowMin: { type: Number, min: 0, default: null },
      // Repeat the video for the session's whole scheduled slot instead of
      // ending when the video does — a 2-minute clip on a 2-hour session
      // plays ~52 times rather than leaving the session "ended" for 1h58m.
      //
      // Default ON, and the clock reads `loop !== false`, so webinars
      // configured before this field existed loop too without a migration.
      loop: { type: Boolean, default: true },
      // Host-authored, replayed off the same clock so every viewer sees the
      // same backlog. Never generated by the system.
      simulatedChat: [
        {
          _id: false,
          atSec: { type: Number, required: true, min: 0 },
          name: { type: String, required: true, trim: true },
          message: { type: String, required: true, trim: true },
        },
      ],
      simulatedViewers: {
        enabled: { type: Boolean, default: false },
        peak: { type: Number, min: 0 },
      },
    },
    // Subscription settings (for recurring workshops with recurring billing)
    isSubscription: {
      type: Boolean,
      default: false,
    },
    subscriptionPeriod: {
      type: String,
      enum: ["weekly", "monthly", "quarterly", "yearly"],
    },
    // Workshop detail page fields
    rating: { type: Number, min: 0, max: 5 },
    ratingCount: { type: Number, min: 0, default: 0 },
    aboutText: { type: String, trim: true },
    learningPoints: { type: [String], default: undefined },
    agenda: { type: [WorkshopAgendaItemSchema], default: undefined },
    bonuses: { type: [WorkshopBonusSchema], default: undefined },
    reviews: { type: [WorkshopReviewSchema], default: undefined },
    faqs: { type: [WorkshopFaqSchema], default: undefined },
    requirements: { type: [String], default: undefined },
    whatsIncluded: { type: [String], default: undefined },
    hostRating: { type: Number, min: 0, max: 5 },
    hostStudents: { type: String, trim: true },
    hostWebinars: { type: String, trim: true },
    hostExperience: { type: String, trim: true },
    speakers: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: undefined },
    deletedAt: { type: Date, index: true },
    restoredAt: { type: Date },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
WorkshopSchema.index({ orgId: 1, date: 1, isActive: 1 });
WorkshopSchema.index({ orgId: 1, channelIds: 1, date: 1 });
WorkshopSchema.index({ createdBy: 1, date: 1 });
// Index for recurring workshops
WorkshopSchema.index({
  orgId: 1,
  isRecurring: 1,
  isRecurrenceActive: 1,
  isActive: 1,
});

installCatalogHooks(WorkshopSchema, "workshop");

export const Workshop = model<IWorkshop>("Workshop", WorkshopSchema);
