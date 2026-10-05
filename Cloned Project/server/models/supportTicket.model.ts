import { Schema, model, Types } from "mongoose";

export interface ISupportTicket {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  createdBy: Types.ObjectId;
  subject: string;
  description: string;
  module: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  attachments: string[]; // Array of file URLs
  // Assignment fields (for global admin to assign to Garage HQ team)
  assignedTo?: Types.ObjectId; // Assigned to a specific user
  assignedToFloor?: Types.ObjectId; // Assigned to a floor (any floor member can handle)
  assignedAt?: Date;
  assignedBy?: Types.ObjectId;
  responses: Array<{
    respondedBy: Types.ObjectId;
    message: string;
    attachments: string[];
    createdAt: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const SupportTicketSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    module: {
      type: String,
      required: true,
      trim: true,
      default: "General",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    attachments: {
      type: [String],
      default: [],
    },
    // Assignment fields
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    assignedToFloor: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      index: true,
    },
    assignedAt: {
      type: Date,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    responses: [
      {
        respondedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: {
          type: String,
          required: true,
          trim: true,
          maxlength: 5000,
        },
        attachments: {
          type: [String],
          default: [],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// Compound index for efficient queries
SupportTicketSchema.index({ orgId: 1, status: 1 });
SupportTicketSchema.index({ orgId: 1, createdBy: 1 });
SupportTicketSchema.index({ orgId: 1, createdAt: -1 });

export const SupportTicket = model<ISupportTicket>(
  "SupportTicket",
  SupportTicketSchema
);
