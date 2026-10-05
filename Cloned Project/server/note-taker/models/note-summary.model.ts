import mongoose, { Document, Schema, Types } from 'mongoose';
import { ActionItem } from '../types';

export interface INoteSummary extends Document {
  sessionId: Types.ObjectId;
  overview: string;
  keyTopics: string[];
  actionItems: ActionItem[];
  decisions: string[];
  questions: string[];
  markdownSummary: string;
  aiModel: string;
  promptTokens: number;
  completionTokens: number;
  createdAt: Date;
}

const actionItemSchema = new Schema(
  {
    description: { type: String, required: true },
    assignee: { type: String },
    deadline: { type: String },
  },
  { _id: false },
);

const noteSummarySchema = new Schema<INoteSummary>(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'NoteSession', required: true, index: true },
    overview: { type: String, default: '' },
    keyTopics: [{ type: String }],
    actionItems: [actionItemSchema],
    decisions: [{ type: String }],
    questions: [{ type: String }],
    markdownSummary: { type: String, default: '' },
    aiModel: { type: String, default: 'gpt-4o' },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const NoteSummary = mongoose.model<INoteSummary>('NoteSummary', noteSummarySchema);
