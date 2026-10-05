import { Schema, model, Types } from "mongoose";

// ConferenceRoom — a named conference space inside an org. Founders
// create as many as they need ("Boardroom", "Huddle Space", "Pitch
// Room") and any org member can book a slot in one.
//
// We deliberately don't introduce a new Space model. The realtime layer
// already routes conference-room presence + LiveKit rooms through a
// synthetic spaceId convention (`hq-room:<orgId>` in socket.ts:274).
// Multiple rooms is just an extension of that convention:
//
//   hq-room:<orgId>                       — legacy "default" room
//   hq-room:<orgId>:<conferenceRoomId>    — additional named rooms
//
// So this model holds only the user-visible bits (name, who made it)
// and the rest of the system reads off the same `hq-room:...` spaceId
// scheme — no migration of presence / LiveKit pipes needed.
export interface IConferenceRoom {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  name: string;
  createdBy: Types.ObjectId;
  isActive: boolean;
  // When set, the room is "cancelled but paid through" — founder asked to
  // remove it but the rooms invoice for the current cycle has already been
  // paid. We keep the room usable until this date (= end of paid cycle)
  // then flip `isActive` to false during the next lazy prune in
  // `GET /conference-rooms`. Decoupled from the rooms invoice quantity,
  // which is decremented immediately so the NEXT cycle isn't billed.
  scheduledDeactivationAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConferenceRoomSchema = new Schema(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: { type: Boolean, default: true },
    scheduledDeactivationAt: { type: Date },
  },
  { timestamps: true },
);

// One name per org — no two "Boardroom"s. Sparse so soft-deleted
// (isActive=false) rooms don't block a re-create with the same name
// later; we filter by isActive on the list endpoint.
ConferenceRoomSchema.index({ orgId: 1, name: 1 }, { unique: true });
ConferenceRoomSchema.index({ orgId: 1, isActive: 1 });

export const ConferenceRoom = model<IConferenceRoom>(
  "ConferenceRoom",
  ConferenceRoomSchema,
);

// Helper used by socket + LiveKit code so the synthetic spaceId
// scheme isn't duplicated as a string template across the codebase.
export function conferenceRoomSpaceId(
  orgId: string | Types.ObjectId,
  conferenceRoomId?: string | Types.ObjectId,
): string {
  return conferenceRoomId
    ? `hq-room:${orgId.toString()}:${conferenceRoomId.toString()}`
    : `hq-room:${orgId.toString()}`;
}
