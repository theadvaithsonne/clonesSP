import mongoose, { Document, Schema, Types } from 'mongoose';
import { NoteSessionStatus } from '../types';

export type NoteSessionSource = 'meet' | 'webinar' | 'office' | 'conference' | 'manual';

export interface INoteSession extends Document {
  roomName: string;
  roomId: string;
  /** Which surface dispatched the bot. Lets us scope listings (e.g. conference-only). */
  source: NoteSessionSource;
  meetSessionId?: Types.ObjectId;
  orgId: Types.ObjectId;
  botIdentity?: string;
  botJoinedAt?: Date;
  botLeftAt?: Date;
  title?: string;
  startedAt: Date;
  endedAt?: Date;
  durationSeconds?: number;
  participants: {
    identity: string;
    name?: string;
    userId?: Types.ObjectId;
    email?: string;
  }[];
  status: NoteSessionStatus;
  error?: string;
  transcriptId?: Types.ObjectId;
  summaryId?: Types.ObjectId;
  audioFileKey?: string;
  emailsSentAt?: Date;
  emailRecipients: string[];
  settings: {
    autoJoin: boolean;
    language: string;
    enableSummary: boolean;
    enableEmailDistribution: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const participantSchema = new Schema(
  {
    identity: { type: String, required: true },
    name: { type: String },
    userId: { type: Schema.Types.ObjectId },
    email: { type: String },
  },
  { _id: false }
);

const noteSessionSchema = new Schema<INoteSession>(
  {
    roomName: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ['meet', 'webinar', 'office', 'conference', 'manual'],
      default: 'manual',
      index: true,
    },
    meetSessionId: { type: Schema.Types.ObjectId, ref: 'MeetSession' },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    botIdentity: { type: String },
    botJoinedAt: { type: Date },
    botLeftAt: { type: Date },
    title: { type: String },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date },
    durationSeconds: { type: Number },
    participants: [participantSchema],
    status: {
      type: String,
      enum: ['recording', 'transcribing', 'summarizing', 'ready', 'failed'],
      default: 'recording',
    },
    error: { type: String },
    transcriptId: { type: Schema.Types.ObjectId },
    summaryId: { type: Schema.Types.ObjectId },
    audioFileKey: { type: String },
    emailsSentAt: { type: Date },
    emailRecipients: [{ type: String }],
    settings: {
      autoJoin: { type: Boolean, default: true },
      language: { type: String, default: 'en' },
      enableSummary: { type: Boolean, default: true },
      enableEmailDistribution: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

noteSessionSchema.index({ orgId: 1, startedAt: -1 });
noteSessionSchema.index({ roomName: 1, startedAt: -1 });

export const NoteSession = mongoose.model<INoteSession>('NoteSession', noteSessionSchema);
