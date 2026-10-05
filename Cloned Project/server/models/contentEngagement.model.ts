// src/models/contentEngagement.model.ts
// Session-summary model for content engagement tracking.
// One document per viewer-session per content piece — upserted on each heartbeat.
// Designed for affiliate attribution across all content reward types.

import mongoose, { Schema, Document, Types } from "mongoose";

// ── Enums ──────────────────────────────────────────────────────────

export const CONTENT_TYPES = ["video", "drop", "article", "recording", "testimonial"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const DEVICE_TYPES = ["mobile", "tablet", "desktop", "unknown"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

// ── Interfaces ─────────────────────────────────────────────────────

/** Interaction counters — each field is $inc'd on upsert */
export interface IInteractions {
  plays: number;
  pauses: number;
  seeks: number;
  replays: number;
  mutes: number;
  unmutes: number;
  fullscreens: number;
  linkClicks: number;
}

/** A watched/read range segment [startSeconds, endSeconds] */
export type WatchedRange = [number, number];

export interface IContentEngagement extends Document {
  _id: Types.ObjectId;

  // ── Identity ──────────────────────────────────────────
  sessionId: string; // Client-generated UUID — primary idempotency key
  contentId: Types.ObjectId; // Video/Drop/Post/Recording ID
  contentType: ContentType;
  orgId: Types.ObjectId;

  // ── Affiliate attribution ─────────────────────────────
  affiliateId: string | null; // referCode from URL
  affiliateUserId: Types.ObjectId | null; // Resolved user._id of the affiliate

  // ── Viewer identity (at least one should be present) ──
  userId: Types.ObjectId | null; // Authenticated user
  guestId: string | null; // guest_user_id from localStorage

  // ── Accumulated metrics (video/recording/drop) ────────
  totalWatchTime: number; // Seconds of actual playback
  watchedRanges: WatchedRange[]; // Exactly which segments were watched
  completionPercent: number; // 0-100
  maxPlaybackRate: number; // Fastest playback rate used

  // ── Accumulated metrics (article) ─────────────────────
  totalReadTime: number; // Seconds of active reading
  scrollDepthMax: number; // 0-100 max scroll depth reached

  // ── Interaction counts ────────────────────────────────
  interactions: IInteractions;

  // ── Session context ───────────────────────────────────
  deviceType: DeviceType;
  userAgent: string;
  referrerUrl: string;
  contentTitle: string; // Denormalized for reporting without joins

  // ── Lifecycle ─────────────────────────────────────────
  sessionStart: Date;
  lastUpdate: Date;
  heartbeatCount: number;
  isComplete: boolean; // Did the viewer finish the content

  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ─────────────────────────────────────────────────────────

const ContentEngagementSchema = new Schema<IContentEngagement>(
  {
    // ── Identity ──────────────────────────────────────────
    sessionId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    contentId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    contentType: {
      type: String,
      enum: CONTENT_TYPES,
      required: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // ── Affiliate attribution ─────────────────────────────
    affiliateId: {
      type: String,
      default: null,
      index: true,
    },
    affiliateUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // ── Viewer identity ───────────────────────────────────
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    guestId: {
      type: String,
      default: null,
    },

    // ── Accumulated metrics (video/recording/drop) ────────
    totalWatchTime: { type: Number, default: 0, min: 0 },
    watchedRanges: {
      type: [[Number]],
      default: [],
    },
    completionPercent: { type: Number, default: 0, min: 0, max: 100 },
    maxPlaybackRate: { type: Number, default: 1 },

    // ── Accumulated metrics (article) ─────────────────────
    totalReadTime: { type: Number, default: 0, min: 0 },
    scrollDepthMax: { type: Number, default: 0, min: 0, max: 100 },

    // ── Interaction counts ────────────────────────────────
    interactions: {
      plays: { type: Number, default: 0, min: 0 },
      pauses: { type: Number, default: 0, min: 0 },
      seeks: { type: Number, default: 0, min: 0 },
      replays: { type: Number, default: 0, min: 0 },
      mutes: { type: Number, default: 0, min: 0 },
      unmutes: { type: Number, default: 0, min: 0 },
      fullscreens: { type: Number, default: 0, min: 0 },
      linkClicks: { type: Number, default: 0, min: 0 },
    },

    // ── Session context ───────────────────────────────────
    deviceType: {
      type: String,
      enum: DEVICE_TYPES,
      default: "unknown",
    },
    userAgent: { type: String, default: "" },
    referrerUrl: { type: String, default: "" },
    contentTitle: { type: String, default: "" },

    // ── Lifecycle ─────────────────────────────────────────
    sessionStart: { type: Date, default: Date.now },
    lastUpdate: { type: Date, default: Date.now },
    heartbeatCount: { type: Number, default: 0, min: 0 },
    isComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ── Indexes ────────────────────────────────────────────────────────

// Primary idempotency: one doc per session per content
ContentEngagementSchema.index(
  { sessionId: 1, contentId: 1 },
  { unique: true, name: "session_content_unique" }
);

// Content-level analytics (how is a specific video/article performing?)
ContentEngagementSchema.index(
  { orgId: 1, contentType: 1, contentId: 1, sessionStart: -1 },
  { name: "content_analytics_idx" }
);

// Affiliate performance (how much engagement did an affiliate drive?)
ContentEngagementSchema.index(
  { orgId: 1, affiliateId: 1, sessionStart: -1 },
  { name: "affiliate_perf_idx" }
);

// Affiliate + content type breakdown
ContentEngagementSchema.index(
  { orgId: 1, affiliateId: 1, contentType: 1, sessionStart: -1 },
  { name: "affiliate_type_idx" }
);

// Time-range queries for dashboards
ContentEngagementSchema.index(
  { orgId: 1, sessionStart: -1 },
  { name: "org_timeline_idx" }
);

// Viewer history (what has a specific user/guest watched?)
ContentEngagementSchema.index(
  { userId: 1, sessionStart: -1 },
  { name: "user_history_idx", sparse: true }
);
ContentEngagementSchema.index(
  { guestId: 1, sessionStart: -1 },
  { name: "guest_history_idx", sparse: true }
);

export const ContentEngagement = mongoose.model<IContentEngagement>(
  "ContentEngagement",
  ContentEngagementSchema
);
