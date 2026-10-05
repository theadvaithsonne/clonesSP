import { Schema, model, Document, Types } from "mongoose";

export interface IWorkshopRegistration extends Document {
  _id: Types.ObjectId;
  workshopId: Types.ObjectId;
  userId: Types.ObjectId;
  orgId: Types.ObjectId;
  status: "registered" | "attended" | "cancelled";
  hasPaid: boolean;
  paymentId?: string;
  orderId?: string;
  invoiceShortUrl?: string; // Public URL for Razorpay invoice
  amountPaid?: number;
  currency?: string;
  registeredAt: Date;
  attendedAt?: Date;
  // For recurring workshops
  enrollmentType: "full" | "session"; // 'full' = enrolled once, 'session' = per-session
  sessionDate?: Date; // For per-session: the specific session date
  enrolledAt: Date; // When user enrolled (for access date checking)
  grandfathered?: boolean; // If true, user retains full access even if enrollment type changes
  // Stamped when the user (or founder) cancels this registration row.
  // For `enrollmentType: "full"` this is the moment the whole-series
  // enrolment ended. For `enrollmentType: "session"` this is the moment
  // that specific session's row was cancelled — other session rows for
  // the same (userId, workshopId) are unaffected. Same semantic as
  // ChannelMembership.cancelledAt.
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkshopRegistrationSchema = new Schema<IWorkshopRegistration>(
  {
    workshopId: {
      type: Schema.Types.ObjectId,
      ref: "Workshop",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["registered", "attended", "cancelled"],
      default: "registered",
    },
    hasPaid: {
      type: Boolean,
      default: false,
    },
    paymentId: {
      type: String,
      trim: true,
    },
    orderId: {
      type: String,
      trim: true,
    },
    invoiceShortUrl: {
      type: String,
    },
    amountPaid: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    attendedAt: {
      type: Date,
    },
    // For recurring workshops
    enrollmentType: {
      type: String,
      enum: ["full", "session"],
      default: "full",
    },
    sessionDate: {
      type: Date,
      index: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
    grandfathered: {
      type: Boolean,
      default: false,
    },
    cancelledAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes
// Note: We remove the simple unique index since per-session registrations need sessionDate
// For non-recurring or 'full' enrollments, we enforce uniqueness via application logic
WorkshopRegistrationSchema.index({ workshopId: 1, userId: 1, sessionDate: 1 });
WorkshopRegistrationSchema.index({ userId: 1, status: 1 });
WorkshopRegistrationSchema.index({ workshopId: 1, status: 1 });
// Index for recurring workshop queries
WorkshopRegistrationSchema.index({ workshopId: 1, userId: 1, enrollmentType: 1 });
WorkshopRegistrationSchema.index({ workshopId: 1, sessionDate: 1, status: 1 });
WorkshopRegistrationSchema.index({ workshopId: 1, grandfathered: 1 });

export const WorkshopRegistration = model<IWorkshopRegistration>(
  "WorkshopRegistration",
  WorkshopRegistrationSchema
);
