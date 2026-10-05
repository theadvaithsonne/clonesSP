import { Types } from 'mongoose';
import { BotSession, ParticipantInfo } from '../agents/bot-session';
import { DeepgramStream } from './deepgram-stream';
import { SegmentAccumulator } from './segment-accumulator';
import { buildAndSaveTranscript } from './transcript-builder';
import { NoteSession } from '../models/note-session.model';

// Mediasoup audio frame shape emitted by BotSession
interface AudioFrame {
  data: Int16Array;
  sampleRate: number;
  channels: number;
  samplesPerChannel: number;
}

/**
 * Manages real-time transcription for a single bot session.
 * Creates one DeepgramStream per participant, feeds audio frames,
 * accumulates segments, and builds the final transcript on disconnect.
 */
export class TranscriptionManager {
  private streams: Map<string, DeepgramStream> = new Map();
  private accumulator: SegmentAccumulator;
  private session: BotSession;
  private sessionId: Types.ObjectId;
  private language: string;

  constructor(session: BotSession, sessionId: Types.ObjectId, language = 'en') {
    this.session = session;
    this.sessionId = sessionId;
    this.language = language;
    this.accumulator = new SegmentAccumulator();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // When a participant joins, register their name and persist to DB.
    // This listener is registered BEFORE session.connect() so we catch
    // all participants including those already in the room.
    this.session.on('participant-joined', (info: ParticipantInfo) => {
      this.accumulator.setSpeakerName(info.identity, info.name || info.identity);
      this.addParticipantToSession(info);
      console.log(`[TranscriptionManager] Tracked participant: ${info.name} (${info.identity})`);
    });

    // When audio frames arrive, route them to the participant's Deepgram stream
    this.session.on('audio-frame', (participantIdentity: string, frame: AudioFrame) => {
      this.handleAudioFrame(participantIdentity, frame);
    });

    // When a participant leaves, close their Deepgram stream
    this.session.on('participant-left', (info: ParticipantInfo) => {
      this.closeStream(info.identity);
    });

    // When the bot disconnects, finalize the transcript
    this.session.on('disconnected', () => {
      this.finalizeTranscript();
    });
  }

  /** Add a participant to the NoteSession in MongoDB if not already tracked. */
  private async addParticipantToSession(info: ParticipantInfo): Promise<void> {
    // Extract userId from LiveKit participant metadata if available
    let userId: string | undefined;
    try {
      if (info.metadata) {
        const meta = JSON.parse(info.metadata);
        if (meta.userId) userId = meta.userId;
      }
    } catch {}

    try {
      await NoteSession.updateOne(
        {
          _id: this.sessionId,
          'participants.identity': { $ne: info.identity },
        },
        {
          $push: {
            participants: {
              identity: info.identity,
              name: info.name || info.identity,
              ...(userId && { userId }),
            },
          },
        },
      );
    } catch (error) {
      console.warn(`[TranscriptionManager] Failed to add participant ${info.identity}:`, error);
    }
  }

  private handleAudioFrame(participantIdentity: string, frame: AudioFrame): void {
    let stream = this.streams.get(participantIdentity);

    // Lazily create a Deepgram stream for this participant
    if (!stream || stream.isClosed) {
      stream = new DeepgramStream(
        participantIdentity,
        (result) => {
          this.accumulator.addResult(participantIdentity, result);
        },
        this.language,
      );
      this.streams.set(participantIdentity, stream);

      // Register speaker name if we know it
      const participants = this.session.getParticipants();
      const info = participants.find((p) => p.identity === participantIdentity);
      if (info?.name) {
        this.accumulator.setSpeakerName(participantIdentity, info.name);
      }
    }

    // Send the PCM data to Deepgram
    stream.send(Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength));
  }

  private closeStream(identity: string): void {
    const stream = this.streams.get(identity);
    if (stream) {
      stream.close();
      this.streams.delete(identity);
    }
  }

  /** Close all Deepgram streams and build the final transcript. */
  private async finalizeTranscript(): Promise<void> {
    // Close all remaining streams
    for (const [identity, stream] of this.streams) {
      stream.close();
      this.streams.delete(identity);
    }

    // Finalize the session timing
    const now = new Date();
    const session = await NoteSession.findById(this.sessionId);
    if (session) {
      session.endedAt = now;
      session.botLeftAt = now;
      session.durationSeconds = Math.round(
        (now.getTime() - session.startedAt.getTime()) / 1000,
      );
      await session.save();
    }

    // Wait briefly for any last Deepgram results to arrive
    await new Promise((r) => setTimeout(r, 2000));

    const segments = this.accumulator.getSegments();
    if (segments.length === 0) {
      console.log(`[TranscriptionManager] No segments to save for session ${this.sessionId}`);
      return;
    }

    try {
      await buildAndSaveTranscript(this.sessionId, this.accumulator, this.language);
      console.log(`[TranscriptionManager] Transcript saved for session ${this.sessionId}`);
    } catch (error) {
      console.error(`[TranscriptionManager] Failed to save transcript for session ${this.sessionId}:`, error);
    }
  }

  /** Get current segment count (for monitoring). */
  getSegmentCount(): number {
    return this.accumulator.getSegments().length;
  }

  /** Force close all streams without building transcript. */
  destroy(): void {
    for (const [, stream] of this.streams) {
      stream.close();
    }
    this.streams.clear();
  }
}
