import mongoose, { Document, Schema, Types } from 'mongoose';
import { TranscriptSegment } from '../types';

export interface INoteTranscript extends Document {
  sessionId: Types.ObjectId;
  fullText: string;
  segments: TranscriptSegment[];
  language: string;
  wordCount: number;
  speakerCount: number;
  sttProvider: string;
  createdAt: Date;
}

const transcriptSegmentSchema = new Schema(
  {
    speaker: { type: String, required: true },
    speakerName: { type: String },
    startTime: { type: Number, required: true },
    endTime: { type: Number, required: true },
    text: { type: String, required: true },
    confidence: { type: Number },
  },
  { _id: false },
);

const noteTranscriptSchema = new Schema<INoteTranscript>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'NoteSession', required: true, index: true },
    fullText: { type: String, default: '' },
    segments: [transcriptSegmentSchema],
    language: { type: String, default: 'en' },
    wordCount: { type: Number, default: 0 },
    speakerCount: { type: Number, default: 0 },
    sttProvider: { type: String, default: 'deepgram' },
  },
  { timestamps: true },
);

// Text index for full-text search
noteTranscriptSchema.index({ fullText: 'text' });

export const NoteTranscript = mongoose.model<INoteTranscript>('NoteTranscript', noteTranscriptSchema);
