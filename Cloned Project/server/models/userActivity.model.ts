import { Schema, model, models, Types } from "mongoose";

const UserActivitySchema = new Schema(
  {
    userId: { 
      type: Types.ObjectId, 
      ref: "User", 
      required: true, 
      index: true 
    },
    orgId: { 
      type: Types.ObjectId, 
      ref: "Organization", 
      required: true, 
      index: true 
    },
    type: {
      type: String,
      enum: [
        "login",
        "logout", 
        "online",
        "offline",
        "task_created",
        "task_completed",
        "task_assigned",
        "booking_created",
        "booking_cancelled",
        "message_sent",
        "file_uploaded",
        "profile_updated",
        "floor_assigned",
        "group_joined",
        "group_left",
        "system"
      ],
      required: true,
      index: true
    },
    title: { 
      type: String, 
      required: true, 
      trim: true 
    },
    description: { 
      type: String, 
      required: true, 
      trim: true 
    },
    metadata: { 
      type: Schema.Types.Mixed, 
      default: {} 
    }, // Additional data like task ID, booking ID, etc.
    isRead: { 
      type: Boolean, 
      default: false, 
      index: true 
    },
    readAt: { 
      type: Date 
    },
    // For activity grouping and filtering
    category: {
      type: String,
      enum: ["auth", "task", "booking", "communication", "file", "profile", "system", "presence"],
      required: true,
      index: true
    },
    // Priority for sorting and highlighting
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      index: true
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
UserActivitySchema.index({ userId: 1, orgId: 1, createdAt: -1 });
UserActivitySchema.index({ userId: 1, isRead: 1 });
UserActivitySchema.index({ orgId: 1, type: 1, createdAt: -1 });
UserActivitySchema.index({ userId: 1, category: 1, createdAt: -1 });

export const UserActivity = models.UserActivity || model("UserActivity", UserActivitySchema);
