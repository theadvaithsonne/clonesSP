import { EventEmitter } from "events";
import { Types } from "mongoose";
import { BotSession } from "./bot-session";
import { TranscriptionManager } from "../transcription/transcription-manager";
import {
  createParticipantToken,
  getLivekitUrl,
} from "../../services/livekit";
import { webinarRoomName } from "../../services/webinarLivekitRecording";

export interface BotJoinOptions {
  /**
   * Map key for this bot session. For webinars it's the workshopId; for the
   * conference pass the room/space id so the key is unique and matches leave().
   */
  webinarId: string;
  /**
   * Explicit LiveKit room to join. When omitted we derive it from webinarId via
   * webinarRoomName() (webinar behaviour). The conference MUST pass this
   * (toLivekitRoomName(spaceId)) — otherwise the bot joins "webinar-<spaceId>"
   * and transcribes silence.
   */
  roomName?: string;
  botIdentity?: string;
  botName?: string;
  /** NoteSession._id — links this run to its transcript/summary in DB. */
  sessionId?: Types.ObjectId;
  language?: string;
}

/**
 * One bot session per webinar (LiveKit room). Singleton across the process.
 */
export class BotManager extends EventEmitter {
  private sessions: Map<string, BotSession> = new Map();
  private transcriptionManagers: Map<string, TranscriptionManager> = new Map();
  private static instance: BotManager;

  static getInstance(): BotManager {
    if (!BotManager.instance) BotManager.instance = new BotManager();
    return BotManager.instance;
  }

  hasBot(webinarId: string): boolean {
    return this.sessions.has(webinarId);
  }

  getSession(webinarId: string): BotSession | undefined {
    return this.sessions.get(webinarId);
  }

  getActiveSessions(): Map<string, BotSession> {
    return this.sessions;
  }

  async join(opts: BotJoinOptions): Promise<BotSession> {
    if (this.sessions.has(opts.webinarId)) {
      throw new Error(`Bot already attached: ${opts.webinarId}`);
    }

    const identity = opts.botIdentity || "notetaker-bot";
    const roomName = opts.roomName ?? webinarRoomName(opts.webinarId);

    // Subscribe-only token, with isBot in metadata so other bots and the
    // frontend can filter the participant out of UIs/transcripts.
    const token = await createParticipantToken(roomName, {
      userId: identity,
      userName: opts.botName || "Note Taker",
      isOwner: false,
      canPublish: false,
      exp: 4 * 60 * 60, // 4h
      metadata: JSON.stringify({ isBot: true, botType: "note-taker" }),
    });

    if (!token) {
      throw new Error("Failed to mint LiveKit bot token");
    }

    const session = new BotSession({
      webinarId: opts.webinarId,
      roomName,
      botIdentity: identity,
      livekitUrl: getLivekitUrl(),
      token,
    });

    this.sessions.set(opts.webinarId, session);

    session.on("disconnected", () => {
      this.sessions.delete(opts.webinarId);
      this.transcriptionManagers.delete(opts.webinarId);
      this.emit("session-ended", opts.webinarId);
      console.log(`[BotManager] session ended: ${opts.webinarId}`);
    });

    // Wire transcription BEFORE connect so we catch existing peers' tracks.
    if (opts.sessionId) {
      const txManager = new TranscriptionManager(
        session,
        opts.sessionId,
        opts.language
      );
      this.transcriptionManagers.set(opts.webinarId, txManager);
    }

    await session.connect();
    console.log(`[BotManager] bot attached: ${opts.webinarId} (room ${roomName})`);
    this.emit("session-started", opts.webinarId, session);
    return session;
  }

  async leave(webinarId: string): Promise<void> {
    const session = this.sessions.get(webinarId);
    if (!session) throw new Error(`No bot in webinar: ${webinarId}`);
    await session.disconnect();
  }

  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.sessions.values()).map((s) =>
      s.disconnect()
    );
    await Promise.allSettled(promises);
    this.sessions.clear();
  }
}
