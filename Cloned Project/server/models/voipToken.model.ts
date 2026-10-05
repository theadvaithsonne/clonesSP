import mongoose, { Schema, Document, Types } from "mongoose";

export interface IVoIPToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: "ios"; // VoIP tokens are iOS only
  /** Stable per-device id (matches the socket handshake deviceId) for per-device push targeting. */
  deviceId?: string;
  appVersion?: string;
  /** Which app registered it — decides the APNs VoIP topic. Absent = garage-chat. */
  app?: "garage-chat" | "networkchain";
  isActive: boolean;
  lastUsedAt: Date;
  failedAttempts: number;
  lastFailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const VoIPTokenSchema = new Schema<IVoIPToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    platform: {
      type: String,
      enum: ["ios"],
      default: "ios",
      required: true,
    },
    deviceId: {
      type: String,
    },
    appVersion: {
      type: String,
    },
    app: {
      type: String,
      enum: ["garage-chat", "networkchain"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    lastFailedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound index for efficient lookups
VoIPTokenSchema.index({ userId: 1, isActive: 1 });

// TTL index to auto-delete inactive tokens after 90 days
VoIPTokenSchema.index(
  { lastUsedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const VoIPToken =
  mongoose.models.VoIPToken ||
  mongoose.model<IVoIPToken>("VoIPToken", VoIPTokenSchema);
