import { Schema, model, Document, Types } from "mongoose";

export interface IMeetParticipant extends Document {
  _id: Types.ObjectId;
  meetId: Types.ObjectId;
  email: string;
  displayName: string;
  isHost: boolean;
  agoraUid?: number;
  joinedAt: Date;
  leftAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MeetParticipantSchema = new Schema<IMeetParticipant>(
  {
    meetId: {
      type: Schema.Types.ObjectId,
      ref: "Meet",
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
    isHost: {
      type: Boolean,
      default: false,
      index: true
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
MeetParticipantSchema.index({ meetId: 1, email: 1 });
MeetParticipantSchema.index({ meetId: 1, isHost: 1 });
MeetParticipantSchema.index({ meetId: 1, joinedAt: 1 });

export const MeetParticipant = model<IMeetParticipant>("MeetParticipant", MeetParticipantSchema);
