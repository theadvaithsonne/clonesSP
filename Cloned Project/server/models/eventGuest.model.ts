import { Schema, model, Document, Types } from "mongoose";

export interface IEventGuest extends Document {
  _id: Types.ObjectId;
  eventId: Types.ObjectId;
  email: string;
  displayName: string;
  token?: string; // Optional - not used for public join code flow
  agoraUid?: number;
  joinedAt: Date;
  leftAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventGuestSchema = new Schema<IEventGuest>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    token: {
      type: String,
      required: false, // Optional - not used for public join code flow
      index: true,
      sparse: true // Sparse index to handle null/undefined values
    },
    agoraUid: {
      type: Number,
      required: false, // Legacy field from Agora migration — Daily.co uses string user_id from tokens
      default: () => Math.floor(Math.random() * 900000) + 100000,
      index: true
    },
    joinedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    leftAt: {
      type: Date
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
EventGuestSchema.index({ eventId: 1, email: 1 });
EventGuestSchema.index({ eventId: 1, joinedAt: 1 });
EventGuestSchema.index({ token: 1, eventId: 1 }, { sparse: true }); // Sparse for public join code flow

export const EventGuest = model<IEventGuest>("EventGuest", EventGuestSchema);
