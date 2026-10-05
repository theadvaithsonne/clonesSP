import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDeviceToken extends Document {
  userId: Types.ObjectId;
  token: string;
  platform: "ios" | "android" | "web";
  deviceId?: string;
  appVersion?: string;
  /**
   * Which app registered this token. Absent/null = garage-chat (rows predate
   * the field). Read by `services/pushNotification.ts`'s audience filter:
   * knock/call pushes go to garage-chat alone, message pushes (DM/group/
   * mention) go to garage-chat AND NetworkChains — the same office threads live
   * in both — and wallet money pushes go to every registered app.
   */
  app?: "garage-chat" | "networkchain";
  /**
   * What this install can do with a push beyond the Expo defaults, as it
   * reported at registration. Re-sent on every registration, so a build that
   * stops advertising a feature loses it on its next launch.
   *
   *  - "native-chat": an Android build that draws chat notifications itself
   *    (conversation-grouped, the sender's face with the app badge). It is
   *    sent chat pushes DATA-ONLY — a push with a title/body is drawn by the
   *    OS while the app is backgrounded, and no app code ever sees it.
   */
  features?: string[];
  isActive: boolean;
  lastUsedAt: Date;
  failedAttempts: number;
  lastFailedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceTokenSchema = new Schema<IDeviceToken>(
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
      enum: ["ios", "android", "web"],
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
    features: {
      type: [String],
      default: undefined,
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
DeviceTokenSchema.index({ userId: 1, isActive: 1 });

// TTL index to auto-delete inactive tokens after 90 days
DeviceTokenSchema.index(
  { lastUsedAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export const DeviceToken =
  mongoose.models.DeviceToken ||
  mongoose.model<IDeviceToken>("DeviceToken", DeviceTokenSchema);
