import mongoose, { Schema, Document, Types } from "mongoose";

// Milestone progress tracking
export interface IMilestoneProgress {
  milestoneId: Types.ObjectId;
  order: number;
  title: string;
  status: "pending" | "in_progress" | "completed";

  // Payment tracking
  paymentAmount: number;
  currency: string;
  // Snapshot of the milestone's payment timing at opt-in time. Undefined on
  // opt-ins created before per-milestone timing existed, in which case the
  // service-level `paymentTiming` decides.
  paymentTiming?: "advance" | "on_completion";
  paymentRequired: boolean; // Based on paymentTiming and completion status
  paymentStatus: "not_required" | "pending" | "paid";
  paymentId?: string; // Razorpay payment ID
  paidAt?: Date;

  // Files the founder submitted for this milestone (deliverable proof)
  attachments?: {
    name: string;
    url: string;
    size?: number;
    uploadedAt?: Date;
  }[];

  // Files the client uploaded for this milestone (briefs, assets, feedback)
  clientAttachments?: {
    name: string;
    url: string;
    size?: number;
    contentType?: string;
    uploadedAt?: Date;
    uploadedBy?: Types.ObjectId;
  }[];

  // Progress dates
  startedAt?: Date;
  completedAt?: Date;
  completedBy?: Types.ObjectId; // Founder who marked it complete
}

// Link to the Taskroom room provisioned for this engagement.
//
// Provisioning is best-effort and runs after the opt-in row is committed, so
// `status` records how far it got. A failed provision never blocks checkout —
// the engagement simply has no board until a retry succeeds.
export interface IServiceOptTaskroom {
  status: "pending" | "provisioning" | "ready" | "failed" | "skipped";
  workspaceId?: string;
  spaceId?: string;
  roomId?: string;
  // Taskroom stage ids the client must never receive. Taskroom v2 has no
  // per-stage visibility flag, so the internal/shared boundary is persisted
  // here at provision time and enforced by the board proxy.
  internalStageIds: string[];
  // Maps this service's milestone ids to the stage created for them, so the
  // board can be aligned with milestone progress.
  milestoneStages: {
    milestoneId: Types.ObjectId;
    stageId: string;
  }[];
  // The delivery team as it was actually added to the room, so the board proxy
  // can put a name and a face on a card's assignee. Names only — what each of
  // them is paid stays on the service, which no client-reachable route returns.
  teamMembers: {
    userId: string;
    taskroomUserId: string;
    name: string;
    image?: string;
    role?: string;
  }[];
  error?: string;
  attempts: number;
  provisionedAt?: Date;
}

// Main ServiceOpt interface
export interface IServiceOpt extends Document {
  _id: Types.ObjectId;

  // References
  serviceId: Types.ObjectId;
  userId: Types.ObjectId; // Employee who opted in
  organizationId: Types.ObjectId;

  // Overall status
  status: "opted" | "in_progress" | "completed" | "cancelled";
  optedAt: Date;
  completedAt?: Date;
  cancelledAt?: Date;

  // Payment summary
  totalAmount: number;
  amountPaid: number;
  amountPending: number;
  currency: string;

  // Milestone progress
  milestonesProgress: IMilestoneProgress[];
  completedMilestones: number;
  totalMilestones: number;
  progressPercentage: number;

  // Provisioned engagement room. Undefined on opt-ins created before the
  // Taskroom integration, and on services with no taskroom config.
  taskroom?: IServiceOptTaskroom;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const MilestoneProgressSchema = new Schema<IMilestoneProgress>(
  {
    milestoneId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },

    // Payment tracking
    paymentAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },
    paymentTiming: {
      type: String,
      enum: ["advance", "on_completion"],
    },
    paymentRequired: {
      type: Boolean,
      default: false,
    },
    paymentStatus: {
      type: String,
      enum: ["not_required", "pending", "paid"],
      default: "not_required",
    },
    paymentId: {
      type: String,
    },
    paidAt: {
      type: Date,
    },

    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    clientAttachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
        size: { type: Number },
        contentType: { type: String },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
      },
    ],

    // Progress dates
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { _id: false }
);

const ServiceOptTaskroomSchema = new Schema<IServiceOptTaskroom>(
  {
    status: {
      type: String,
      enum: ["pending", "provisioning", "ready", "failed", "skipped"],
      default: "pending",
    },
    workspaceId: { type: String, trim: true },
    spaceId: { type: String, trim: true },
    roomId: { type: String, trim: true },
    internalStageIds: { type: [String], default: [] },
    milestoneStages: {
      type: [
        new Schema(
          {
            milestoneId: { type: Schema.Types.ObjectId, required: true },
            stageId: { type: String, required: true },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    teamMembers: {
      type: [
        new Schema(
          {
            userId: { type: String, required: true },
            taskroomUserId: { type: String, required: true },
            name: { type: String, default: "" },
            image: { type: String },
            role: { type: String },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    error: { type: String },
    attempts: { type: Number, default: 0 },
    provisionedAt: { type: Date },
  },
  { _id: false }
);

const ServiceOptSchema = new Schema<IServiceOpt>(
  {
    // References
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
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

    // Overall status
    status: {
      type: String,
      enum: ["opted", "in_progress", "completed", "cancelled"],
      default: "opted",
    },
    optedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },

    // Payment summary
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    amountPending: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
    },

    // Milestone progress
    milestonesProgress: {
      type: [MilestoneProgressSchema],
      default: [],
    },
    completedMilestones: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalMilestones: {
      type: Number,
      default: 0,
      min: 0,
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    taskroom: {
      type: ServiceOptTaskroomSchema,
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for unique opt-in per user per service
ServiceOptSchema.index({ serviceId: 1, userId: 1 }, { unique: true });

// Index for querying user's opt-ins
ServiceOptSchema.index({ userId: 1, organizationId: 1, status: 1 });

// Index for querying service opt-ins
ServiceOptSchema.index({ serviceId: 1, status: 1 });

// Index for the provisioning retry sweep
ServiceOptSchema.index({ "taskroom.status": 1, "taskroom.attempts": 1 });

// Index for resolving a room back to its engagement
ServiceOptSchema.index({ "taskroom.roomId": 1 });

// Index for pending payments query
ServiceOptSchema.index({
  organizationId: 1,
  "milestonesProgress.paymentStatus": 1,
});

// Pre-save hook to calculate progress percentage and payment amounts
ServiceOptSchema.pre("save", function (next) {
  // Calculate progress percentage
  if (this.totalMilestones > 0) {
    this.progressPercentage = Math.round(
      (this.completedMilestones / this.totalMilestones) * 100
    );

    // Mark as completed if all milestones are done
    if (
      this.completedMilestones >= this.totalMilestones &&
      this.status !== "completed" &&
      this.status !== "cancelled"
    ) {
      this.status = "completed";
      this.completedAt = new Date();
    }
  } else {
    this.progressPercentage = 0;
  }

  // Calculate payment amounts from milestones progress
  if (this.milestonesProgress && this.milestonesProgress.length > 0) {
    this.totalAmount = this.milestonesProgress.reduce(
      (sum, m) => sum + (m.paymentAmount || 0),
      0
    );
    this.amountPaid = this.milestonesProgress
      .filter((m) => m.paymentStatus === "paid")
      .reduce((sum, m) => sum + (m.paymentAmount || 0), 0);
    this.amountPending = this.milestonesProgress
      .filter((m) => m.paymentStatus === "pending")
      .reduce((sum, m) => sum + (m.paymentAmount || 0), 0);
  }

  next();
});

export const ServiceOpt = mongoose.model<IServiceOpt>(
  "ServiceOpt",
  ServiceOptSchema
);
