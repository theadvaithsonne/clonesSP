// src/models/eventProgram.model.ts
//
// An "Event Program" is a founder-run conference / meetup / summit: a dated
// program with a venue (or a stream), a capacity, ticket tiers and a public
// landing page.
//
// Deliberately NOT the legacy `Event` model (models/event.model.ts) — that one
// backs the internal Agora calendar and is joined on by the workspace calendar
// code. The collection is pinned to `event_programs` so the two never share a
// namespace even if a future refactor renames the exported symbol.

import { Schema, model, Document, Types } from "mongoose";
import {
  founderAlertsSchemaField,
  type IFounderAlerts,
} from "./founderAlerts.schema";

export type EventFormat = "in_person" | "hybrid" | "virtual";
export type EventStreamType =
  | "garage_livestream"
  | "money_stream"
  | "external_link";
export type EventStatus =
  | "draft"
  | "published"
  | "ongoing"
  | "completed"
  | "cancelled";

export interface IEventVenue {
  name?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  coordinates?: { lat?: number; lng?: number };
}

export interface IEventStreaming {
  streamType?: EventStreamType;
  livekitRoomId?: string;
  externalUrl?: string;
}

export interface IEventProgram extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  creatorId: Types.ObjectId;
  name: string;
  slug: string;
  shortDescription?: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  timezone?: string;
  isRepeating: boolean;
  repeatRule?: string;
  category?: string;
  language: string;
  bannerUrl?: string;
  format: EventFormat;
  venue?: IEventVenue;
  streaming?: IEventStreaming;
  totalCapacity: number;
  requireApproval: boolean;
  isPrivate: boolean;
  payoutWalletId?: Types.ObjectId;
  addGstForIndianBuyers: boolean;
  /**
   * Whether the ticket prices already contain the 18% GST.
   *
   * `addGstForIndianBuyers` decides IF tax applies; this decides WHO absorbs
   * it. Inclusive means the buyer pays the listed price and the organizer
   * eats the tax out of it; exclusive adds it on top at checkout. Same
   * two-way question every other paid item in Garage asks.
   */
  gstInclusive: boolean;
  status: EventStatus;
  /**
   * "Notify me when someone registers" — organiser-side alert, fired on both
   * free registration and paid ticket checkout. See
   * models/founderAlerts.schema.ts.
   */
  founderAlerts?: IFounderAlerts;
  publishedAt?: Date;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const VenueSchema = new Schema<IEventVenue>(
  {
    name: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    postcode: { type: String, trim: true },
    country: { type: String, trim: true },
    coordinates: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { _id: false }
);

const StreamingSchema = new Schema<IEventStreaming>(
  {
    streamType: {
      type: String,
      enum: ["garage_livestream", "money_stream", "external_link"],
    },
    livekitRoomId: { type: String, trim: true },
    externalUrl: { type: String, trim: true },
  },
  { _id: false }
);

const EventProgramSchema = new Schema<IEventProgram>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    // Unique across the platform because it is the public URL key (/e/:slug).
    // Generated from `name` at create time and de-duped with a numeric suffix.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    shortDescription: { type: String, trim: true, maxlength: 140 },
    // Long-form copy for the About block on the public site. Not part of the
    // wizard — edited later from the Web Builder inspector.
    description: { type: String, trim: true, maxlength: 10000 },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    timezone: { type: String, trim: true },
    isRepeating: { type: Boolean, default: false },
    repeatRule: { type: String, trim: true },
    category: { type: String, trim: true },
    language: { type: String, trim: true, default: "English" },
    bannerUrl: { type: String, trim: true },
    format: {
      type: String,
      enum: ["in_person", "hybrid", "virtual"],
      default: "in_person",
    },
    venue: { type: VenueSchema, default: () => ({}) },
    streaming: { type: StreamingSchema, default: () => ({}) },
    totalCapacity: { type: Number, required: true, min: 1 },
    requireApproval: { type: Boolean, default: false },
    isPrivate: { type: Boolean, default: false },
    payoutWalletId: { type: Schema.Types.ObjectId, ref: "StoreWallet" },
    addGstForIndianBuyers: { type: Boolean, default: false },
    gstInclusive: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "published", "ongoing", "completed", "cancelled"],
      default: "draft",
      index: true,
    },
    // Organiser-side "someone registered" alert. No template — see
    // services/founderAlertEmail.ts.
    founderAlerts: founderAlertsSchemaField,
    publishedAt: { type: Date },
    // Soft delete — a public slug that 404s is better than a hard delete that
    // orphans registrations and their invoices.
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "event_programs" }
);

EventProgramSchema.index({ orgId: 1, status: 1, startsAt: -1 });
EventProgramSchema.index({ orgId: 1, deletedAt: 1 });

export const EventProgram = model<IEventProgram>(
  "EventProgram",
  EventProgramSchema
);
