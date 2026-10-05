import { Schema, model, Document, Types } from "mongoose";

export interface IGuestInvitation {
  email: string;
  name?: string;
  token?: string; // Optional - kept for backward compatibility with old events
  status: 'pending' | 'joined';
  joinedAt?: Date;
}

export interface IVideoCallInfo {
  agoraChannel: string;
  createdAt: Date;
}

export interface IEvent extends Document {
  _id: Types.ObjectId;
  orgId: Types.ObjectId;
  creatorId: Types.ObjectId;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  invitedUserIds: Types.ObjectId[];
  guestInvitations: IGuestInvitation[];
  publicJoinCode?: string; // Shareable code for guests to join (like Google Meet)
  videoCallInfo?: IVideoCallInfo;
  status: 'scheduled' | 'cancelled' | 'completed';
  isRepeating: boolean;
  isLive: boolean;
  liveStartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EventSchema = new Schema<IEvent>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true
    },
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
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
    invitedUserIds: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    guestInvitations: [{
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
      },
      name: {
        type: String,
        trim: true
      },
      token: {
        type: String,
        required: false // Optional - kept for backward compatibility
      },
      status: {
        type: String,
        enum: ['pending', 'joined'],
        default: 'pending'
      },
      joinedAt: {
        type: Date
      }
    }],
    publicJoinCode: {
      type: String,
      trim: true,
      index: true
    },
    videoCallInfo: {
      agoraChannel: {
        type: String,
        required: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    },
    status: {
      type: String,
      enum: ['scheduled', 'cancelled', 'completed'],
      default: 'scheduled',
      index: true
    },
    isRepeating: {
      type: Boolean,
      default: false
    },
    isLive: {
      type: Boolean,
      default: false,
      index: true
    },
    liveStartedAt: {
      type: Date,
      required: false
    }
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
EventSchema.index({ orgId: 1, startTime: 1, status: 1 });
EventSchema.index({ orgId: 1, invitedUserIds: 1, startTime: 1 });
EventSchema.index({ orgId: 1, creatorId: 1, startTime: 1 });
// Sparse index for guest token lookups - sparse prevents null/missing token conflicts (backward compat)
EventSchema.index({ 'guestInvitations.token': 1 }, { sparse: true });
// Sparse unique index for public join codes
EventSchema.index({ publicJoinCode: 1 }, { sparse: true, unique: true });

// Validate that endTime is after startTime
EventSchema.pre('save', function(next) {
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  } else {
    next();
  }
});

export const Event = model<IEvent>("Event", EventSchema);
