import { Schema, model, Types } from "mongoose";

const VALID_POSITIONS = [
  "thirdBase", "secondBaseA", "secondBaseB",
  "1stA", "1stB", "1stC", "1stD",
  "atBat-0", "atBat-1", "atBat-2", "atBat-3",
  "atBat-4", "atBat-5", "atBat-6", "atBat-7",
];

const schema = new Schema({
  boardId:          { type: Types.ObjectId, ref: "Bat246Board", required: true },
  position:         { type: String, enum: VALID_POSITIONS, required: true },
  reservedByUserId: { type: Types.ObjectId, ref: "User", required: true },
  reservedByEmail:  { type: String, required: true },
  productId:        { type: Types.ObjectId, ref: "Product", default: null },
  reservedAt:       { type: Date, default: () => new Date() },
  expiresAt:        { type: Date, required: true },
  status:           { type: String, enum: ["active", "used", "expired"], default: "active" },
}, { timestamps: false });

// Enforce one active reservation per board+position at a time
schema.index({ boardId: 1, position: 1, status: 1 });
// Unique: only one active reservation per board+position
schema.index({ boardId: 1, position: 1 }, { unique: true, partialFilterExpression: { status: "active" } });
// TTL index — MongoDB auto-marks as expired (we still flip status manually for clarity)
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Bat246PositionReservation = model("bat246PositionReservations", schema);
export { VALID_POSITIONS as RESERVATION_POSITIONS };
