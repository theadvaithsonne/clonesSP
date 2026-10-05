// src/models/eventSponsor.model.ts
import { Schema, model, Document, Types } from "mongoose";

export type EventSponsorTier = "platinum" | "gold" | "silver" | "community";

/** Render order of the sponsor wall — highest tier first. */
export const SPONSOR_TIER_RANK: Record<EventSponsorTier, number> = {
  platinum: 0,
  gold: 1,
  silver: 2,
  community: 3,
};

export interface IEventSponsor extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  name: string;
  tier: EventSponsorTier;
  logoUrl?: string;
  boothNumber?: string;
  websiteUrl?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSponsorSchema = new Schema<IEventSponsor>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    tier: {
      type: String,
      enum: ["platinum", "gold", "silver", "community"],
      default: "community",
    },
    logoUrl: { type: String, trim: true },
    boothNumber: { type: String, trim: true, maxlength: 40 },
    websiteUrl: { type: String, trim: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "event_sponsors" }
);

EventSponsorSchema.index({ eventId: 1, tier: 1, sortOrder: 1 });

export const EventSponsor = model<IEventSponsor>(
  "EventSponsor",
  EventSponsorSchema
);
