// src/models/socialAccount.model.ts
// Verified social media accounts — affiliates connect their TikTok/Instagram/YouTube/Twitter
// via a bio-code verification flow to prove account ownership.

import mongoose, { Schema, Document, Types } from "mongoose";
import { SOCIAL_PLATFORMS, SocialPlatform } from "./contentCampaign.model";

export interface ISocialAccount extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  platform: SocialPlatform;
  profileUrl: string;       // Full profile URL
  username: string;         // Extracted username (e.g., @user)

  // Verification (legacy bio-code flow)
  verificationCode: string; // Random code user puts in bio
  isVerified: boolean;
  verifiedAt: Date | null;

  // OAuth tokens (new — for API-based view tracking)
  oauthConnected: boolean;       // Whether connected via OAuth
  accessToken: string | null;    // Platform access token
  refreshToken: string | null;   // Platform refresh token
  tokenExpiresAt: Date | null;   // When access token expires
  platformUserId: string | null; // Platform-specific user ID

  // Cached metadata
  followerCount: number;

  createdAt: Date;
  updatedAt: Date;
}

const SocialAccountSchema = new Schema<ISocialAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    platform: {
      type: String,
      enum: SOCIAL_PLATFORMS,
      required: true,
    },
    profileUrl: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },

    // Verification
    verificationCode: {
      type: String,
      default: "",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },

    // OAuth tokens
    oauthConnected: {
      type: Boolean,
      default: false,
    },
    accessToken: {
      type: String,
      default: null,
    },
    refreshToken: {
      type: String,
      default: null,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    platformUserId: {
      type: String,
      default: null,
    },

    // Cached metadata
    followerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────
// One account per platform per user
SocialAccountSchema.index(
  { userId: 1, platform: 1 },
  { unique: true, name: "user_platform_unique" }
);

// Lookup by username + platform (for verifying post ownership)
SocialAccountSchema.index(
  { platform: 1, username: 1 },
  { name: "platform_username_idx" }
);

export const SocialAccount = mongoose.model<ISocialAccount>(
  "SocialAccount",
  SocialAccountSchema
);
