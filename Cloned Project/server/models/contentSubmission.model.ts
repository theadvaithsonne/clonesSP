// src/models/contentSubmission.model.ts
// A single social media post submitted by an affiliate for a Content Rewards campaign.
// Tracks review status, view count snapshots, and earned payouts.

import mongoose, { Schema, Document, Types } from "mongoose";

export const SUBMISSION_STATUSES = ["pending", "approved", "rejected", "flagged"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export interface IViewSnapshot {
  views: number;
  timestamp: Date;
}

export interface IContentSubmission extends Document {
  _id: Types.ObjectId;
  campaignId: Types.ObjectId;
  userId: Types.ObjectId;
  socialAccountId: Types.ObjectId;
  orgId: Types.ObjectId;

  // Post details
  postUrl: string;            // URL to the social media post
  platform: string;           // tiktok, instagram, youtube, twitter

  // Review
  status: SubmissionStatus;
  reviewedBy: Types.ObjectId | null;
  reviewedAt: Date | null;
  rejectionReason: string;

  // View tracking
  viewsAtApproval: number;    // Baseline when approved
  currentViews: number;       // Latest tracked count
  viewSnapshots: IViewSnapshot[];
  lastTrackedAt: Date | null;

  // API-based tracking metadata
  viewSource: "oauth_api"; // Views are tracked exclusively via platform APIs
  platformPostId: string;     // Extracted video/media ID for API lookups
  lastFetchedAt: Date | null; // When views were last fetched via API (for cache)

  // Earnings
  earnedAmount: number;       // Calculated earnings in cents (running total based on net views)
  paidOutAmount: number;      // Cents already paid out across one or more ContentPayout rows
  isPaidOut: boolean;         // Means "fully settled" — flips true only when campaign closes
  paidOutAt: Date | null;     // Last payout timestamp

  // Founder's payout basis decision at approval time.
  //   "net"   → only views accrued AFTER approval earn (default; viewsAtApproval = currentViews at approve)
  //   "total" → every view from the video's existence earns (viewsAtApproval = 0 at approve)
  // The sweeper math (netViews = currentViews - viewsAtApproval) is basis-agnostic;
  // we persist the basis for audit only.
  payoutBasis: "total" | "net";

  createdAt: Date;
  updatedAt: Date;
}

const ContentSubmissionSchema = new Schema<IContentSubmission>(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "ContentCampaign",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    socialAccountId: {
      type: Schema.Types.ObjectId,
      ref: "SocialAccount",
      default: null,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Post
    postUrl: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      required: true,
      index: true,
    },

    // Review
    status: {
      type: String,
      enum: SUBMISSION_STATUSES,
      default: "pending",
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    // View tracking
    viewsAtApproval: { type: Number, default: 0, min: 0 },
    currentViews: { type: Number, default: 0, min: 0 },
    viewSnapshots: [
      {
        views: { type: Number, required: true },
        timestamp: { type: Date, required: true, default: Date.now },
      },
    ],
    lastTrackedAt: { type: Date, default: null },

    // API-based tracking metadata
    viewSource: {
      type: String,
      enum: ["oauth_api"],
      default: "oauth_api",
    },
    platformPostId: { type: String, default: "" },
    lastFetchedAt: { type: Date, default: null },

    // Earnings
    earnedAmount: { type: Number, default: 0, min: 0 },
    paidOutAmount: { type: Number, default: 0, min: 0 },
    isPaidOut: { type: Boolean, default: false },
    paidOutAt: { type: Date, default: null },

    // Founder's payout basis selected at approval time.
    payoutBasis: { type: String, enum: ["total", "net"], default: "net" },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────
// Campaign submissions list
ContentSubmissionSchema.index(
  { campaignId: 1, status: 1, createdAt: -1 },
  { name: "campaign_submissions_idx" }
);

// User's own submissions
ContentSubmissionSchema.index(
  { userId: 1, createdAt: -1 },
  { name: "user_submissions_idx" }
);

// For cron: find approved submissions that need view tracking
ContentSubmissionSchema.index(
  { status: 1, lastTrackedAt: 1 },
  { name: "tracking_queue_idx" }
);

// Prevent duplicate submissions (same post URL per campaign)
ContentSubmissionSchema.index(
  { campaignId: 1, postUrl: 1 },
  { unique: true, name: "campaign_post_unique" }
);

// Org-wide submissions
ContentSubmissionSchema.index(
  { orgId: 1, status: 1, createdAt: -1 },
  { name: "org_submissions_idx" }
);

export const ContentSubmission = mongoose.model<IContentSubmission>(
  "ContentSubmission",
  ContentSubmissionSchema
);
