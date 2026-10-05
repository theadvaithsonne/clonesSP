import { Schema, model, Types } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    orgId: {
      type: Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        "betty_chat",
        "leave_request",
        "todo_assigned",
        "system",
        "group_mention",
        "join_request",
        "post_mention",
        "comment_mention",
      ],
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal",
    }, // For mention notifications
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    data: { type: Schema.Types.Mixed }, // Additional data like leave request ID, etc.
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    // For Betty chat messages
    chatMessageId: { type: String }, // Unique identifier for chat messages
    senderType: {
      type: String,
      enum: ["user", "betty", "system"],
      default: "system",
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
NotificationSchema.index({ userId: 1, orgId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ orgId: 1, type: 1 });

export const Notification = model("Notification", NotificationSchema);
