import { Schema, model, Document, Types } from "mongoose";

export interface IRoomBooking extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  // Optional for back-compat with the legacy single-conference-room
  // shape (every org had one implicit room). New bookings created
  // through the multi-room UI always carry this. Old rows without
  // it surface under the org's "default" conference room.
  conferenceRoomId?: Types.ObjectId;
  creatorId: Types.ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  invitedUserIds: Types.ObjectId[];
  status: "active" | "cancelled" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

const RoomBookingSchema = new Schema<IRoomBooking>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    conferenceRoomId: {
      type: Schema.Types.ObjectId,
      ref: "ConferenceRoom",
      // Sparse-indexed: legacy bookings have no value so don't get
      // a hit on the (conferenceRoomId, startTime) index below — they
      // fall through to the org-wide query path.
      required: false,
      index: { sparse: true },
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    invitedUserIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["active", "cancelled", "completed"],
      default: "active",
      index: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
RoomBookingSchema.index({ orgId: 1, startTime: 1, status: 1 });
RoomBookingSchema.index({ orgId: 1, endTime: 1, status: 1 });
// Per-room schedule + per-room conflict-detection. Sparse so old
// bookings without a conferenceRoomId don't bloat the index.
RoomBookingSchema.index(
  { conferenceRoomId: 1, startTime: 1, status: 1 },
  { sparse: true },
);

// Validate that endTime is after startTime
RoomBookingSchema.pre("save", function (next) {
  if (this.endTime <= this.startTime) {
    next(new Error("End time must be after start time"));
  } else {
    next();
  }
});

export const RoomBooking = model<IRoomBooking>("RoomBooking", RoomBookingSchema);
