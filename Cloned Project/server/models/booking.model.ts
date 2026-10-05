import { Schema, model, Types } from "mongoose";

const BookingSchema = new Schema({
  orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
  bookerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  bookedWithId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' }
}, { timestamps: true });

BookingSchema.index({ orgId: 1, bookerId: 1, startTime: 1 });
BookingSchema.index({ orgId: 1, bookedWithId: 1, startTime: 1 });

export const Booking = model("Booking", BookingSchema);