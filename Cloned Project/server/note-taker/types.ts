import { Types } from 'mongoose';

// AuthRequest and JwtPayload are defined globally in src/types/index.ts and
// the auth middleware — import from there, not from here.

export interface NoteSessionParticipant {
  identity: string;
  name?: string;
  userId?: Types.ObjectId;
  email?: string;
}

export interface TranscriptSegment {
  speaker: string;
  speakerName?: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
}

export interface ActionItem {
  description: string;
  assignee?: string;
  deadline?: string;
}

export type NoteSessionStatus = 'recording' | 'transcribing' | 'summarizing' | 'ready' | 'failed';
