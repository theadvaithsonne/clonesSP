import { EventEmitter } from "events";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  Track,
  TrackKind,
  AudioStream,
} from "@livekit/rtc-node";

/*
 * LiveKit-backed BotSession for the webinar note-taker.
 *
 * Connects as a hidden, subscribe-only participant in the webinar's LiveKit
 * room, subscribes to every human's audio track, and emits the SAME events
 * that the legacy mediasoup-based session emitted so the rest of the
 * pipeline (TranscriptionManager → Deepgram → summarize/distribute workers)
 * works unmodified:
 *   - "participant-joined"  (info: ParticipantInfo)
 *   - "participant-left"    (info: ParticipantInfo)
 *   - "audio-frame"         (identity, { data: Int16Array, sampleRate, channels, samplesPerChannel })
 *   - "disconnected"
 */

export interface BotSessionOptions {
  /** External handle the rest of garagenew-backend uses (= workshopId). */
  webinarId: string;
  /** LiveKit room name (sanitized). */
  roomName: string;
  /** Bot's LiveKit identity (e.g. "notetaker-bot"). */
  botIdentity: string;
  /** LiveKit server URL (wss://...). */
  livekitUrl: string;
  /** LiveKit JWT for the bot — issued with canPublish=false, isBot metadata. */
  token: string;
}

export interface ParticipantInfo {
  identity: string;
  name?: string;
  metadata?: string;
}

export class BotSession extends EventEmitter {
  private room: Room;
  private opts: BotSessionOptions;
  private participants: Map<string, ParticipantInfo> = new Map();
  private audioStreams: Map<string, AudioStream> = new Map();
  private connected = false;

  constructor(opts: BotSessionOptions) {
    super();
    this.opts = opts;
    this.room = new Room();
    this.setupEventHandlers();
  }

  get roomName(): string {
    return this.opts.roomName;
  }

  get botIdentity(): string {
    return this.opts.botIdentity;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  getParticipants(): ParticipantInfo[] {
    return Array.from(this.participants.values());
  }

  getHumanParticipantCount(): number {
    return this.participants.size;
  }

  async connect(): Promise<void> {
    await this.room.connect(this.opts.livekitUrl, this.opts.token, {
      autoSubscribe: true,
      dynacast: false,
    });
    this.connected = true;
    console.log(`[NoteBot] connected to LiveKit room: ${this.opts.roomName}`);

    // Process participants who joined before us.
    for (const participant of this.room.remoteParticipants.values()) {
      this.handleParticipantConnected(participant);
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    this.connected = false;

    for (const [key, stream] of this.audioStreams) {
      try {
        stream.close();
      } catch {
        /* already closed */
      }
      this.audioStreams.delete(key);
    }

    await this.room.disconnect();
    console.log(`[NoteBot] disconnected from: ${this.opts.roomName}`);
    this.emit("disconnected");
  }

  private setupEventHandlers(): void {
    this.room.on(
      RoomEvent.TrackSubscribed,
      (
        track: Track,
        publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        this.handleTrackSubscribed(track, publication, participant);
      }
    );

    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (
        track: Track,
        _publication: RemoteTrackPublication,
        participant: RemoteParticipant
      ) => {
        this.handleTrackUnsubscribed(track, participant);
      }
    );

    this.room.on(
      RoomEvent.ParticipantConnected,
      (participant: RemoteParticipant) => {
        this.handleParticipantConnected(participant);
      }
    );

    this.room.on(
      RoomEvent.ParticipantDisconnected,
      (participant: RemoteParticipant) => {
        this.handleParticipantDisconnected(participant);
      }
    );

    this.room.on(RoomEvent.Disconnected, () => {
      console.log(`[NoteBot] room disconnected: ${this.opts.roomName}`);
      this.connected = false;
      this.emit("disconnected");
    });
  }

  private isOtherBot(participant: RemoteParticipant): boolean {
    if (!participant.metadata) return false;
    try {
      const meta = JSON.parse(participant.metadata);
      return !!meta.isBot;
    } catch {
      return false;
    }
  }

  private handleParticipantConnected(participant: RemoteParticipant): void {
    if (this.isOtherBot(participant)) return;

    const info: ParticipantInfo = {
      identity: participant.identity,
      name: participant.name || participant.identity,
      metadata: participant.metadata,
    };
    this.participants.set(participant.identity, info);
    this.emit("participant-joined", info);
  }

  private handleParticipantDisconnected(participant: RemoteParticipant): void {
    const info = this.participants.get(participant.identity);
    this.participants.delete(participant.identity);

    const stream = this.audioStreams.get(participant.identity);
    if (stream) {
      try {
        stream.close();
      } catch {
        /* already closed */
      }
      this.audioStreams.delete(participant.identity);
    }

    this.emit("participant-left", info || { identity: participant.identity });

    // Auto-disconnect when no humans remain (matches legacy behavior).
    if (this.participants.size === 0 && this.connected) {
      this.disconnect().catch(() => {});
    }
  }

  private handleTrackSubscribed(
    track: Track,
    _publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): void {
    if (track.kind !== TrackKind.KIND_AUDIO) return;
    if (this.isOtherBot(participant)) return;

    const audioStream = new AudioStream(track);
    this.audioStreams.set(participant.identity, audioStream);
    this.consumeAudioStream(participant.identity, audioStream);
  }

  private handleTrackUnsubscribed(
    track: Track,
    participant: RemoteParticipant
  ): void {
    if (track.kind !== TrackKind.KIND_AUDIO) return;
    const stream = this.audioStreams.get(participant.identity);
    if (stream) {
      try {
        stream.close();
      } catch {
        /* already closed */
      }
      this.audioStreams.delete(participant.identity);
    }
  }

  private async consumeAudioStream(
    identity: string,
    stream: AudioStream
  ): Promise<void> {
    try {
      for await (const frame of stream) {
        // frame: { data: Int16Array, sampleRate, channels, samplesPerChannel }
        this.emit("audio-frame", identity, frame);
      }
    } catch (err: any) {
      if (this.connected) {
        console.warn(
          `[NoteBot] audio-stream error for ${identity}: ${err?.message ?? err}`
        );
      }
    }
  }
}
