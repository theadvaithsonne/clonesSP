// src/models/contentCampaign.model.ts
// Content Rewards campaign — founder creates a campaign with a budget and CPM rate.
// Affiliates create content for the campaign and earn per 1,000 views.

import mongoose, { Schema, Document, Types } from "mongoose";

export const CAMPAIGN_TYPES = ["clipping", "ugc"] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_CURRENCIES = ["USD", "INR"] as const;
export type CampaignCurrency = (typeof CAMPAIGN_CURRENCIES)[number];

export const SOCIAL_PLATFORMS = ["instagram", "youtube"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface ICampaignRequirements {
  minDuration?: number;   // Minimum video length in seconds
  maxDuration?: number;   // Maximum video length in seconds
  hashtags?: string[];    // Required hashtags
  mentions?: string[];    // Required mentions
  guidelines?: string;    // Free-form text guidelines
}

export interface ICampaignAsset {
  url: string;            // S3 URL or external link
  type: "video" | "image" | "document";
  description?: string;
}

export interface IResourceLink {
  url: string;            // Drive link, Dropbox, Notion, etc.
  label: string;          // "Raw Footage", "Brand Kit", "Script Template"
  type: "drive" | "dropbox" | "notion" | "video" | "other";
}

export interface IContentCampaign extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  founderId: Types.ObjectId;

  title: string;
  description: string;
  thumbnailUrl: string;
  campaignType: CampaignType;
  status: CampaignStatus;
  currency: CampaignCurrency;

  // Budget & rates (in cents to avoid floating-point issues)
  budget: number;             // Total budget in cents
  budgetSpent: number;        // Amount spent so far
  ratePerThousand: number;    // Payout per 1,000 views (in cents)
  minPayout: number;          // Min payout per submission (cents), 0 = no min
  maxPayout: number;          // Max payout per submission (cents), 0 = no max

  // Platform targeting
  platforms: SocialPlatform[];

  // Content requirements
  requirements: ICampaignRequirements;

  // Assets for clippers
  assets: ICampaignAsset[];

  // Resource links (Drive, Dropbox, etc.)
  resourceLinks: IResourceLink[];

  // Settings
  autoApprove: boolean;

  // Counters (denormalized for fast reads)
  totalSubmissions: number;
  approvedSubmissions: number;
  totalViews: number;

  // Participants
  participants: Types.ObjectId[];
  totalParticipants: number;

  // Escrow wallet linkage (set on creation; budget locked from founder StoreWallet)
  campaignWalletId: Types.ObjectId | null;
  lockedAmount: number;       // Mirror of CampaignWallet balance × 100 (cents) for fast UI reads

  // Set when the campaign is auto-completed because its CampaignWallet drained to zero.
  // (Distinct from `updatedAt`, which churns on every counter increment.)
  completedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const ContentCampaignSchema = new Schema<IContentCampaign>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    founderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    thumbnailUrl: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    campaignType: {
      type: String,
      enum: CAMPAIGN_TYPES,
      required: true,
      default: "ugc",
    },
    status: {
      type: String,
      enum: CAMPAIGN_STATUSES,
      default: "draft",
      index: true,
    },
    currency: {
      type: String,
      enum: CAMPAIGN_CURRENCIES,
      default: "USD",
    },

    // Budget & rates
    budget: { type: Number, required: true, min: 0 },
    budgetSpent: { type: Number, default: 0, min: 0 },
    ratePerThousand: { type: Number, required: true, min: 1 },
    minPayout: { type: Number, default: 0, min: 0 },
    maxPayout: { type: Number, default: 0, min: 0 },

    // Platforms
    platforms: {
      type: [String],
      enum: SOCIAL_PLATFORMS,
      default: ["youtube"],
    },

    // Requirements
    requirements: {
      minDuration: { type: Number, min: 0, default: 0 },
      maxDuration: { type: Number, min: 0, default: 0 },
      hashtags: { type: [String], default: [] },
      mentions: { type: [String], default: [] },
      guidelines: { type: String, maxlength: 5000, default: "" },
    },

    // Assets
    assets: [
      {
        url: { type: String, required: true },
        type: { type: String, enum: ["video", "image", "document"], default: "video" },
        description: { type: String, maxlength: 500, default: "" },
      },
    ],

    // Resource links
    resourceLinks: [
      {
        url: { type: String, required: true },
        label: { type: String, required: true, maxlength: 200 },
        type: { type: String, enum: ["drive", "dropbox", "notion", "video", "other"], default: "other" },
      },
    ],

    // Settings
    autoApprove: { type: Boolean, default: false },

    // Counters
    totalSubmissions: { type: Number, default: 0, min: 0 },
    approvedSubmissions: { type: Number, default: 0, min: 0 },
    totalViews: { type: Number, default: 0, min: 0 },

    // Participants
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    totalParticipants: { type: Number, default: 0, min: 0 },

    // Escrow wallet linkage
    campaignWalletId: {
      type: Schema.Types.ObjectId,
      ref: "CampaignWallet",
      default: null,
    },
    lockedAmount: { type: Number, default: 0, min: 0 },

    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────
// Org campaigns list (filtered by status, sorted by newest)
ContentCampaignSchema.index(
  { orgId: 1, status: 1, createdAt: -1 },
  { name: "org_campaigns_idx" }
);

// Active campaigns for affiliate discovery
ContentCampaignSchema.index(
  { status: 1, createdAt: -1 },
  { name: "active_campaigns_idx" }
);

export const ContentCampaign = mongoose.model<IContentCampaign>(
  "ContentCampaign",
  ContentCampaignSchema
);
