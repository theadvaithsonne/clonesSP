import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * Direct FCM device token for Android knock-call delivery.
 *
 * Distinct from `DeviceToken` (which stores Expo push tokens routed through
 * Expo's server). For killed-state ringing on Android we need to send a
 * data-only FCM message that wakes our custom FirebaseMessagingService —
 * Expo's API doesn't expose that shape, so we register the native FCM token
 * here and send directly via firebase-admin.
 */
export interface IFCMToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: "android"; // FCM-direct path is Android-only (iOS uses VoIP push)
  deviceId?: string;
  appVersion?: string;
  isActive: boolean;
  lastUsedAt: Date;
  failedAttempts: number;
  lastFailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FCMTokenSchema = new Schema<IFCMToken>(
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
      enum: ["android"],
      default: "android",
      required: true,
    },
    deviceId: {
      type: String,
    },
    appVersion: {
      type: String,
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

FCMTokenSchema.index({ userId: 1, isActive: 1 });

// TTL — auto-delete inactive tokens after 90 days (matches VoIPToken policy)
FCMTokenSchema.index(
  { lastUsedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const FCMToken =
  mongoose.models.FCMToken ||
  mongoose.model<IFCMToken>("FCMToken", FCMTokenSchema);
