// src/models/eventSpeaker.model.ts
import { Schema, model, Document, Types } from "mongoose";

export interface IEventSpeaker extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  name: string;
  role?: string;
  company?: string;
  bio?: string;
  avatarUrl?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
    website?: string;
    instagram?: string;
  };
  isKeynote: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const EventSpeakerSchema = new Schema<IEventSpeaker>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "EventProgram",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    role: { type: String, trim: true, maxlength: 200 },
    company: { type: String, trim: true, maxlength: 200 },
    bio: { type: String, trim: true, maxlength: 2000 },
    avatarUrl: { type: String, trim: true },
    socials: {
      twitter: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      website: { type: String, trim: true },
      instagram: { type: String, trim: true },
    },
    isKeynote: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "event_speakers" }
);

EventSpeakerSchema.index({ eventId: 1, sortOrder: 1 });

export const EventSpeaker = model<IEventSpeaker>(
  "EventSpeaker",
  EventSpeakerSchema
);
