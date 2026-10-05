import { Schema, model, Document, Types } from "mongoose";

export interface IMeet extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  hostEmail: string;
  hostName?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  joinCode: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  isHostVerified: boolean;
  agoraChannel: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  screenSharingByUid?: number; // Agora UID of the user currently screen sharing (only host can share)
}

const MeetSchema = new Schema<IMeet>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    hostEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    hostName: {
      type: String,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    // No maxlength — deliberately.
    //
    // A workshop's description is uncapped rich text and is copied verbatim
    // into the Meet by three separate paths (routes/workshop.ts
    // /generate-meeting, routes/webinarRoutes.ts /webinar/:id/start, and the
    // socket host-join in realtime/mediasoupHandlers.ts). A cap here doesn't
    // shorten anything — it makes Meet.create throw, which left workshops
    // permanently stuck in Draft and, worse, stopped the founder from
    // starting the stream at all. Repro: "CapCut Creator Bootcamp" with a
    // 1396-char description.
    //
    // The hand-typed field on POST /meet keeps its own z.string().max(1000)
    // guard, which returns a clean 400 instead of a 500.
    description: {
      type: String,
      trim: true
    },
    startTime: {
      type: Date,
      required: true,
      index: true
    },
    endTime: {
      type: Date,
      required: true
    },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'ended', 'cancelled'],
      default: 'scheduled',
      index: true
    },
    isHostVerified: {
      type: Boolean,
      default: false
    },
    agoraChannel: {
      type: String,
      required: true
    },
    startedAt: {
      type: Date
    },
    endedAt: {
      type: Date
    },
    screenSharingByUid: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
MeetSchema.index({ orgId: 1, startTime: 1, status: 1 });
MeetSchema.index({ hostEmail: 1, startTime: 1 });
MeetSchema.index({ joinCode: 1, status: 1 });

// Validate that endTime is after startTime
// Note: Midnight-crossing meetings (e.g., 11:50 PM - 12:30 AM) are valid
// so we skip this validation — the route handler handles day-rollover
MeetSchema.pre('save', function(next) {
  next();
});

export const Meet = model<IMeet>("Meet", MeetSchema);
