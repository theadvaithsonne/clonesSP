import { Schema, model, Document, Types } from "mongoose";

export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";
export type BookingType = "single" | "range";

export interface ICoworkingSpaceBooking extends Document {
  // Who's booking
  founderId: Types.ObjectId;
  founderName: string;
  founderEmail: string;
  organizationId: Types.ObjectId;
  organizationName: string;

  // What's being booked
  coworkingSpaceId: Types.ObjectId;
  coworkingSpaceName: string;
  officeTypeId: Types.ObjectId;
  officeTypeName: string;
  pricePerSeat: number;

  // Booking details
  bookingType: BookingType;
  startDate: Date;
  endDate: Date;
  numberOfSeats: number;
  totalAmount: number;

  // Status & approval
  status: BookingStatus;
  statusNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

const CoworkingSpaceBookingSchema = new Schema(
  {
    // Founder info (denormalized for quick access)
    founderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    founderName: { type: String, required: true },
    founderEmail: { type: String, required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    organizationName: { type: String, required: true },

    // Coworking space info (denormalized)
    coworkingSpaceId: { type: Schema.Types.ObjectId, ref: "CoworkingSpace", required: true },
    coworkingSpaceName: { type: String, required: true },
    officeTypeId: { type: Schema.Types.ObjectId, required: true },
    officeTypeName: { type: String, required: true },
    pricePerSeat: { type: Number, required: true, min: 0 },

    // Booking details
    bookingType: {
      type: String,
      enum: ["single", "range"],
      required: true
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    numberOfSeats: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },

    // Status tracking
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending"
    },
    statusNote: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for efficient querying
CoworkingSpaceBookingSchema.index({ founderId: 1, status: 1 });
CoworkingSpaceBookingSchema.index({ organizationId: 1, status: 1 });
CoworkingSpaceBookingSchema.index({ coworkingSpaceId: 1, status: 1 });
CoworkingSpaceBookingSchema.index({ status: 1, createdAt: -1 });
CoworkingSpaceBookingSchema.index({ startDate: 1, endDate: 1 });

export const CoworkingSpaceBooking = model<ICoworkingSpaceBooking>(
  "CoworkingSpaceBooking",
  CoworkingSpaceBookingSchema
);
