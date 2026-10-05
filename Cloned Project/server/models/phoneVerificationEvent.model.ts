import { Schema, model, Document, Types } from "mongoose";

/**
 * A completed phone verification, and what the person was doing at the time.
 *
 * `User.phoneVerified` is a boolean with no history and no context, and the
 * OTP rows that produced it carry a TTL index — they are deleted the moment
 * they expire. So "who verified their number while trying to buy the product
 * we pinned in this webinar" had nothing to read: by the time anyone asked,
 * the evidence was already gone.
 *
 * This is the durable record. Written once per successful verification, with
 * the webinar and pinned item the client was in when it happened.
 *
 * `context` is client-supplied and reported, never trusted for authorization
 * — it decides which row a founder's report groups a verification under and
 * nothing more. The unverifiable case is a buyer naming the wrong webinar,
 * which skews a count; that is why sales figures key off the invoice's
 * server-verified `liveWorkshopId` instead of this.
 */
export interface IPhoneVerificationEvent extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  phone: string;
  email?: string;
  name?: string;
  /** The webinar the verification happened in, when it happened in one. */
  workshopId?: Types.ObjectId;
  /** UTC-midnight day key, matching WebinarAttendance and WebinarProductPin. */
  sessionDate?: Date;
  /** The pinned item being bought when the phone gate appeared. */
  itemType?: string;
  itemId?: string;
  itemName?: string;
  /** Where the gate was shown — "webinar-pin", "profile", etc. */
  source: string;
  /** True when this verification opened the user's 24-hour combo window. */
  startedComboWindow: boolean;
  verifiedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PhoneVerificationEventSchema = new Schema<IPhoneVerificationEvent>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    phone: { type: String, required: true },
    email: { type: String },
    name: { type: String },
    workshopId: { type: Schema.Types.ObjectId, ref: "Workshop", index: true },
    sessionDate: { type: Date },
    itemType: { type: String },
    itemId: { type: String },
    itemName: { type: String },
    source: { type: String, default: "profile" },
    startedComboWindow: { type: Boolean, default: false },
    verifiedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

export const PhoneVerificationEvent = model<IPhoneVerificationEvent>(
  "PhoneVerificationEvent",
  PhoneVerificationEventSchema
);
