// src/models/callBooking.model.ts
import mongoose, { Schema, Document, Types } from "mongoose";

// Call Booking interface - separate from Event model
export interface ICallBooking extends Document {
  _id: Types.ObjectId;

  // References
  callOfferingId: Types.ObjectId;
  callPurchaseId: Types.ObjectId;
  organizationId: Types.ObjectId;

  // Participants
  founderId: Types.ObjectId; // Call creator (founder)
  bookerId: Types.ObjectId; // Person who booked (stakeholder)

  // Scheduling
  startTime: Date;
  endTime: Date; // Calculated: startTime + call duration

  // Status
  status: "scheduled" | "completed" | "cancelled" | "no_show";

  // Notes
  founderNotes?: string; // Private notes from founder
  bookingNotes?: string; // Notes from booker at time of booking

  // Cancellation
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;

  // Completion tracking
  completedAt?: Date;
  completedBy?: Types.ObjectId;

  // Rating (optional - after completion)
  rating?: number; // 1-5 stars
  review?: string;
  ratedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CallBookingSchema = new Schema<ICallBooking>(
  {
    // References
    callOfferingId: {
      type: Schema.Types.ObjectId,
      ref: "CallOffering",
      required: true,
      index: true,
    },
    callPurchaseId: {
      type: Schema.Types.ObjectId,
      ref: "CallPurchase",
      required: true,
      index: true,
    },
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    // Participants
    founderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bookerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Scheduling
    startTime: {
      type: Date,
      required: true,
      index: true,
    },
    endTime: {
      type: Date,
      required: true,
    },

    // Status
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "no_show"],
      default: "scheduled",
      index: true,
    },

    // Notes
    founderNotes: { type: String },
    bookingNotes: { type: String },

    // Cancellation
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String },

    // Completion tracking
    completedAt: { type: Date },
    completedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // Rating
    rating: { type: Number, min: 1, max: 5 },
    review: { type: String },
    ratedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries

// For founder's calendar view
CallBookingSchema.index({ founderId: 1, startTime: 1, status: 1 });

// For booker's scheduled calls
CallBookingSchema.index({ bookerId: 1, startTime: 1 });

// For tracking calls per purchase
CallBookingSchema.index({ callPurchaseId: 1 });

// For org-wide calendar aggregation
CallBookingSchema.index({ organizationId: 1, startTime: 1 });

// For finding overlapping bookings (conflict detection)
CallBookingSchema.index({ founderId: 1, startTime: 1, endTime: 1, status: 1 });

// Validate that endTime is after startTime
CallBookingSchema.pre("save", function (next) {
  if (this.endTime <= this.startTime) {
    next(new Error("End time must be after start time"));
  } else {
    next();
  }
});

export const CallBooking = mongoose.model<ICallBooking>(
  "CallBooking",
  CallBookingSchema
);
