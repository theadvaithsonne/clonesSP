import mongoose, { Schema, Document, Types } from "mongoose";

export interface IServiceReview extends Document {
  _id: Types.ObjectId;

  // References
  serviceId: Types.ObjectId;
  serviceOptId: Types.ObjectId; // Link to the specific opt-in
  userId: Types.ObjectId; // Employee who left the review
  organizationId: Types.ObjectId;

  // Review content
  rating: number; // 1-5 stars
  comment: string;

  // User info snapshot (denormalized for display)
  reviewerName: string;
  reviewerRole?: string;
  reviewerAvatar?: string;

  // Moderation
  isApproved: boolean;
  isPublic: boolean; // Can be shown on public pages

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const ServiceReviewSchema = new Schema<IServiceReview>(
  {
    // References
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    serviceOptId: {
      type: Schema.Types.ObjectId,
      ref: "ServiceOpt",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Review content
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
    },

    // User info snapshot
    reviewerName: {
      type: String,
      required: true,
      trim: true,
    },
    reviewerRole: {
      type: String,
      trim: true,
    },
    reviewerAvatar: {
      type: String,
      trim: true,
    },

    // Moderation
    isApproved: {
      type: Boolean,
      default: true, // Auto-approve by default
    },
    isPublic: {
      type: Boolean,
      default: true, // Visible on public pages by default
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per service
ServiceReviewSchema.index({ serviceId: 1, userId: 1 }, { unique: true });

// For fetching approved public reviews
ServiceReviewSchema.index({ serviceId: 1, isApproved: 1, isPublic: 1 });

// For fetching reviews sorted by date
ServiceReviewSchema.index({ serviceId: 1, isPublic: 1, createdAt: -1 });

export const ServiceReview = mongoose.model<IServiceReview>(
  "ServiceReview",
  ServiceReviewSchema
);
