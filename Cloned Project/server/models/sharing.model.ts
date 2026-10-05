import { Schema, model } from "mongoose";

// SHARED ITEMS - For sharing personal cabinet files/folders with other users
const SharedItemSchema = new Schema(
  {
    // The item being shared (file or cabinet)
    itemId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    itemType: {
      type: String,
      enum: ["file", "cabinet"],
      required: true,
    },
    // The owner who is sharing the item
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // The user who receives the shared item
    sharedWith: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    // Permissions for the shared item
    permissions: {
      canView: {
        type: Boolean,
        default: true,
      },
      canDownload: {
        type: Boolean,
        default: true,
      },
      canEdit: {
        type: Boolean,
        default: false,
      },
      canDelete: {
        type: Boolean,
        default: false,
      },
    },
    // Optional message from the sharer
    message: {
      type: String,
      trim: true,
    },
    // Status of the share
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "revoked"],
      default: "pending",
    },
    // When the share was accepted/declined
    respondedAt: {
      type: Date,
    },
    // Expiration date (optional)
    expiresAt: {
      type: Date,
    },
    // Metadata
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// SHARED ACCESS LOG - Track who accessed shared items
const SharedAccessLogSchema = new Schema(
  {
    sharedItem: {
      type: Schema.Types.ObjectId,
      ref: "SharedItem",
      required: true,
    },
    accessedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: ["view", "download", "edit", "delete"],
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// Indexes for SharedItem
SharedItemSchema.index({ owner: 1, organization: 1 });
SharedItemSchema.index({ sharedWith: 1, organization: 1 });
SharedItemSchema.index({ itemId: 1, itemType: 1 });
SharedItemSchema.index({ status: 1 });
SharedItemSchema.index({ expiresAt: 1 });

// Indexes for SharedAccessLog
SharedAccessLogSchema.index({ sharedItem: 1 });
SharedAccessLogSchema.index({ accessedBy: 1 });
SharedAccessLogSchema.index({ action: 1 });
SharedAccessLogSchema.index({ createdAt: 1 });

// Ensure unique sharing per item per user
SharedItemSchema.index(
  { itemId: 1, itemType: 1, sharedWith: 1 },
  { unique: true }
);

export const SharedItem = model("SharedItem", SharedItemSchema);
export const SharedAccessLog = model("SharedAccessLog", SharedAccessLogSchema);
