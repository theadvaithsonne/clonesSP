import { Server, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyJwt } from "../services/jwt";
import { Message } from "../models/message.model";
import { GlobalMessage } from "../models/globalMessage.model";
import { dmConvId } from "../utils/conv";
import { globalDmConvId } from "../utils/globalConv";
import { Types } from "mongoose";
import { Group } from "../models/group.model";
import { GroupMessage } from "../models/groupMessage.model";
import {
  createOnce,
  markPendingDMsDelivered,
  validClientMsgId,
} from "./idempotentSend";
import {
  P2P_PROTOCOL,
  getIceServers,
  hasTurnRelay,
  newCallId,
  noteCallSocket,
  p2pCalls,
  peerOf,
  registerP2PCall,
  type P2PCall,
} from "./p2pCalls";
import { User } from "../models/user.model";
import { Workshop } from "../models/workshop.model";
import { UserActivity } from "../models/userActivity.model";
import { Notification } from "../models/notification.model";
import { UserNotification } from "../models/userNotification.model";
import { MissedCall } from "../models/missedCall.model";
import { VoIPToken } from "../models/voipToken.model";
import { DeviceToken } from "../models/deviceToken.model";
import { FCMToken } from "../models/fcmToken.model";
import { setSocketInstance } from "../services/socket";
import {
  createRoom,
  createParticipantToken,
  deleteRoom,
  toLivekitRoomName,
  setRecordingContext,
  getLivekitUrl,
  getConferencePolicy,
  policyToSources,
} from "../services/livekit";
import { BotManager as ConferenceBotManager } from "../note-taker/agents/bot-manager";
import { NoteSession as ConferenceNoteSession } from "../note-taker/models/note-session.model";
import { registerMediasoupHandlers } from "./mediasoupHandlers";
import {
  markTyping as markGroupTyping,
  clearTyping as clearGroupTyping,
} from "../services/groupTypingPresence";
import {
  WorkspacePresenceService,
  initRedisClients,
  getRedisSub,
  isRedisAvailable,
} from "../services/redis-presence";
import {
  sendDMPushNotification,
  sendGroupPushNotification,
  sendKnockPushNotification,
  sendCallPushNotification,
  sendNetworkchainCallPush,
  sendNetworkchainCallCancelPush,
  sendMentionPushNotification,
} from "../services/pushNotification";
import { hasBlocked } from "../models/chatBlock.model";
import { processAttachmentMeta } from "../utils/attachmentMeta";
import { recordSupportMessage } from "../services/supportChat";
import {
  sendKnockVoIPPush,
  sendKnockVoIPCancelPush,
} from "../services/voipPushNotification";
import {
  sendKnockFCMPush,
  sendKnockCancelFCMPush,
} from "../services/fcmPushNotification";
import { callStateService } from "../services/call-state";
import { Event } from "../models/event.model";
import { CallBooking } from "../models/callBooking.model";

interface WorkspaceUser {
  id: string; // userId
  name?: string;
  email: string;
  profilePicture?: string;
  spaceId: string; // 'lobby' or another userId
  // "mobile" = logged in on mobile (has a registered push/VoIP token) but no
  // live socket — reachable via the knock push, synthesized below.
  status?: "available" | "busy" | "afk" | "mobile";
  isScreenSharing?: boolean;
  isRecording?: boolean;
  guest?: boolean; // Track if user is a guest in this organization
}

// Initialize Redis presence service
const presenceService = new WorkspacePresenceService();

// Fallback in-memory storage when Redis is unavailable
const workspaceUsers = new Map<string, WorkspaceUser>();

// Keep these in-memory (not suitable for Redis due to real-time nature)
const userIdToSocketId = new Map<string, string>();
const userSocketConnections = new Map<string, Set<string>>(); // userId -> Set of socketIds
const userPresenceState = new Map<
  string,
  { isOnline: boolean; lastActivity: Date }
>(); // userId -> presence state

// LiveKit room tracking: spaceId (channel) -> Set of userIds currently in the room
const livekitRoomUsers = new Map<string, Set<string>>();

// Community Stream avatar positions: spaceId -> odId -> { x, y }
const communityStreamPositions = new Map<string, Map<string, { x: number; y: number }>>();

// Track last Redis TTL refresh time per user (to throttle refreshes)
const lastTTLRefresh = new Map<string, number>();
const TTL_REFRESH_THROTTLE = 2 * 60 * 1000; // 2 minutes

// Throttle the `lastSeenAt` write on User docs. The heartbeat handler runs
// every ~30 s per client × every connected user — burning a Mongo write
// each time is wasteful when the "last seen X ago" UI only needs minute-
// level resolution. One write per user per LAST_SEEN_WRITE_THROTTLE_MS.
const lastSeenWriteThrottle = new Map<string, number>();
const LAST_SEEN_WRITE_THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * Update `User.lastSeenAt` for a connected user. Fire-and-forget; we don't
 * await this in hot paths since stale-by-a-minute is fine. Throttled per
 * userId so heartbeats don't hammer Mongo.
 */
function touchLastSeen(userId: string) {
  const now = Date.now();
  const last = lastSeenWriteThrottle.get(userId) || 0;
  if (now - last < LAST_SEEN_WRITE_THROTTLE_MS) return;
  lastSeenWriteThrottle.set(userId, now);
  User.updateOne(
    { _id: new Types.ObjectId(userId) },
    { $set: { lastSeenAt: new Date(now) } }
  ).catch((err) =>
    console.error(`[lastSeen] update failed for ${userId}:`, err.message)
  );
}

// Knock queue management for handling multiple simultaneous requests
interface KnockRequest {
  from: string;
  fromName: string;
  timestamp: number;
  /** Socket the knock originated from — the accepted call is routed back to this device. */
  socketId?: string;
  /** Knocker's app supports peer-to-peer calls (protocol version). */
  p2p?: number;
  /** The app the call was placed from; it rings only in that app. */
  app: CallApp;
}

// key: `${userId}:${webinarId}` → socketId that holds the current preview slot (1 per user per webinar)
const previewWatchers = new Map<string, string>();

const knockQueues = new Map<string, KnockRequest[]>(); // targetId -> queue of knock requests
const activeKnocks = new Map<string, Set<string>>(); // targetId -> Set of userIds who have active knock requests

/**
 * Auto-attach the note-taker bot to a conference (hq-room) when its owner
 * joins. The conference uses LiveKit directly (no mediasoup virtual peers), so
 * this is simpler than the webinar's ensureNoteTakerAttached — the bot appears
 * as a LiveKit participant which the client hides + replaces with a
 * "Listening" tile. Idempotent via hasBot + an in-flight NoteSession guard.
 * @param channelName the conference space id (e.g. "hq-room:<orgId>")
 */
export async function ensureConferenceNoteTaker(
  io: Server,
  channelName: string,
  orgId: string,
  ownerUserId: string
): Promise<void> {
  try {
    const roomName = toLivekitRoomName(channelName);
    const botManager = ConferenceBotManager.getInstance();
    if (botManager.hasBot(roomName)) return;

    let noteSession = await ConferenceNoteSession.findOne({
      roomName,
      status: { $in: ["recording", "transcribing", "summarizing"] },
    }).sort({ startedAt: -1 });

    if (!noteSession) {
      noteSession = await ConferenceNoteSession.create({
        roomName,
        roomId: channelName,
        source: "conference",
        orgId,
        botIdentity: "notetaker-bot",
        botJoinedAt: new Date(),
        startedAt: new Date(),
        title: "Conference Call",
        participants: [],
        status: "recording",
        settings: {
          autoJoin: true,
          language: "en",
          enableSummary: true,
          enableEmailDistribution: false,
        },
      });
    }

    // CRITICAL: pass roomName so the bot joins the conference room (not the
    // webinar-prefixed default). webinarId is just the Map key here.
    const session = await botManager.join({
      webinarId: roomName,
      roomName,
      sessionId: noteSession._id as any,
      language: "en",
    });

    const sessionIdStr = (noteSession._id as any).toString();
    session.once("disconnected", async () => {
      try {
        const ns = await ConferenceNoteSession.findById(noteSession!._id);
        if (ns && ns.status === "recording") {
          const now = new Date();
          ns.botLeftAt = now;
          ns.endedAt = now;
          ns.durationSeconds = Math.round((now.getTime() - ns.startedAt.getTime()) / 1000);
          ns.status = "transcribing";
          await ns.save();
          setTimeout(() => {
            import("../note-taker/jobs/queue")
              .then(({ enqueueSummarize }) => enqueueSummarize(sessionIdStr))
              .catch((err) => console.error("[Conference] enqueueSummarize failed:", err.message));
          }, 5000);
        }
      } catch (err: any) {
        console.error("[Conference] note-taker auto-finalize failed:", err.message);
      }
    });

    console.log(`[Conference] note-taker bot joined ${roomName} (owner=${ownerUserId}) sessionId=${noteSession._id}`);
  } catch (err: any) {
    console.error("[Conference] ensureConferenceNoteTaker failed (non-fatal):", err?.message ?? err);
  }
}

// Per-knock delivery state, keyed `${targetId}:${knockerId}`.
// - socketId: the knocker's originating socket, so the accepted call opens on
//   the device that knocked (not an arbitrary one of their sockets).
// - pushRung: whether we rang the target via VoIP/FCM push (no live mobile
//   socket at delivery time) — if so, resolving the knock must send a cancel
//   push to stop the native CallKit/Telecom ring.
interface KnockDeliveryState {
  socketId?: string;
  pushRung: boolean;
  /** Knocker's P2P protocol version, carried to the accept. */
  p2p?: number;
  /** Which app is ringing, so the cancel pushes go to that app only. */
  app: CallApp;
}
const knockDeliveries = new Map<string, KnockDeliveryState>();
const knockDeliveryKey = (targetId: string, knockerId: string) =>
  `${targetId}:${knockerId}`;

/**
 * NetworkChains and Garage HQ share this backend and its users, but a call
 * belongs to the app it was placed from: a NetworkChains call must not ring
 * Garage HQ (web or app), nor the other way round. Sockets say which app they
 * are at the handshake and join that app's call room; ring pushes are picked
 * per app the same way.
 */
type CallApp = "networkchain" | "garage";
const callRoom = (app: CallApp, userId: string) => `calls:${app}:${userId}`;
// Auto-expire timers for unanswered knocks, keyed `${targetId}:${knockerId}`.
// Without this a knock rings forever if the target never accepts/declines and
// the knocker never cancels.
const knockTimers = new Map<string, ReturnType<typeof setTimeout>>();
const KNOCK_TIMEOUT_MS = 45_000; // Ring for 45s, then auto-cancel everywhere.
const PROCESSING_DELAY = 300; // Delay between processing knock requests (ms)
const KNOCK_RATE_LIMIT = 3; // Maximum number of knocks from same user per minute
const knockRateLimits = new Map<
  string,
  { count: number; windowStart: number }
>(); // userId -> rate limit tracking

/** Count distinct users watching the preview card for a given webinarId. */
export function getPreviewWatcherCount(webinarId: string): number {
  let count = 0;
  for (const key of previewWatchers.keys()) {
    if (key.endsWith(`:${webinarId}`)) count++;
  }
  return count;
}

// Export function to get currently online user IDs
export function getOnlineUserIds(): Set<string> {
  const onlineIds = new Set<string>();
  for (const [userId, connections] of userSocketConnections.entries()) {
    if (connections.size > 0) {
      onlineIds.add(userId);
    }
  }
  return onlineIds;
}

export function initSocket(httpServer: HttpServer, origin: string) {
  const io = new Server(httpServer, {
    cors: {
      origin: (o, cb) => cb(null, true),
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    path: "/socket.io",
    // Notice a dead client in ~30s worst case instead of 45s (defaults are
    // 25s/20s). Pongs are replies, not timers, so throttled background tabs
    // are unaffected; anything that does drop lands in the webinar grace
    // window (realtime/webinarPresence.ts) rather than being announced.
    pingInterval: 10_000,
    pingTimeout: 20_000,
  });

  // Set the io instance for use in routes
  setSocketInstance(io);

  // Initialize Redis clients
  initRedisClients();

  // Subscribe to Redis presence events
  const redisSub = getRedisSub();
  if (redisSub) {
    redisSub.subscribe("workspace:presence", (err) => {
      if (err) {
        console.error("[REDIS] Failed to subscribe to workspace:presence:", err);
      } else {
        console.log("[REDIS] Subscribed to workspace:presence channel");
      }
    });

    redisSub.on("message", (channel, message) => {
      if (channel === "workspace:presence") {
        try {
          const update = JSON.parse(message);
          console.log(`[REDIS] Received message on channel ${channel}:`, update.type);

          // Broadcast updates to all workspace clients
          switch (update.type) {
            case "user-joined":
              console.log(`[REDIS] Broadcasting user-joined to workspace room for user:`, update.user.id);
              io.to("workspace").emit("workspace:user-joined", update.user);
              break;
            case "user-status-changed":
              io.to("workspace").emit("workspace:user-status-changed", {
                userId: update.userId,
                status: update.status,
              });
              break;
            case "user-moved-space":
              io.to("workspace").emit("workspace:user-moved-space", {
                userId: update.userId,
                spaceId: update.spaceId,
              });
              break;
            case "screen-share-state":
              io.to("workspace").emit("workspace:screen-share-state", {
                userId: update.userId,
                isSharing: update.isSharing,
              });
              break;
            case "user-recording-changed":
              io.to("workspace").emit("workspace:user-recording-changed", {
                userId: update.userId,
                isRecording: update.isRecording,
              });
              break;
            case "user-left":
              io.to("workspace").emit("workspace:user-left", { id: update.userId });
              break;
          }
        } catch (error) {
          console.error("[REDIS] Error processing message:", error);
        }
      }
    });
  }

  // Presence reconciliation broadcast - every 30 seconds
  setInterval(async () => {
    try {
      const allUsers = await getAllWorkspaceUsers();
      io.to("workspace").emit("workspace:presence-sync", {
        users: allUsers,
        timestamp: Date.now()
      });
      console.log(`[WORKSPACE] Presence sync broadcast sent to all users (${allUsers.length} online)`);
    } catch (error) {
      console.error("[WORKSPACE] Error broadcasting presence sync:", error);
    }
  }, 30 * 1000); // Run every 30 seconds

  // HQ Room auto-kick: complete expired bookings and move users to lobby
  setInterval(async () => {
    try {
      const { RoomBooking } = require("../models/roomBooking.model");
      const now = new Date();

      // Find active bookings that have expired
      const expiredBookings = await RoomBooking.find({
        status: "active",
        endTime: { $lte: now },
      }).lean();

      for (const booking of expiredBookings) {
        // Mark as completed
        await RoomBooking.updateOne({ _id: booking._id }, { status: "completed" });

        const hqRoomSpaceId = `hq-room:${booking.orgId}`;

        // Find users still in this room
        const allWorkspaceUsers = await getAllWorkspaceUsers();
        const usersInRoom = allWorkspaceUsers.filter((u) => u.spaceId === hqRoomSpaceId);

        // Move each user to lobby
        for (const user of usersInRoom) {
          await updateWorkspaceUserSpace(user.id, "lobby");
          io.to(`user:${user.id}`).emit("livekit:leave-call");
          io.to(`user:${user.id}`).emit("room-booking:auto-kick", {
            message: "Your booking time has ended. You have been moved to the lobby.",
            bookingId: booking._id,
          });

          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-moved-space", {
              userId: user.id,
              spaceId: "lobby",
            });
          }
        }

        // Clean up LiveKit room
        if (livekitRoomUsers.has(hqRoomSpaceId)) {
          livekitRoomUsers.delete(hqRoomSpaceId);
          // Detach the note-taker bot first so its disconnect finalizer runs
          // (transcribing → summarize). Deleting the room would also disconnect
          // it, but an explicit leave is more reliable.
          const confRoomName = toLivekitRoomName(hqRoomSpaceId);
          if (ConferenceBotManager.getInstance().hasBot(confRoomName)) {
            ConferenceBotManager.getInstance()
              .leave(confRoomName)
              .catch((err) => console.error("[Conference] note-taker leave failed:", err?.message ?? err));
          }
          deleteRoom(toLivekitRoomName(hqRoomSpaceId)).catch((err) =>
            console.error(`[HQ-ROOM] Failed to delete LiveKit room for ${hqRoomSpaceId}:`, err)
          );
        }

        // Notify workspace
        io.to("workspace").emit("room-booking:ended", {
          bookingId: booking._id,
          orgId: booking.orgId.toString(),
        });

        if (usersInRoom.length > 0) {
          console.log(`[HQ-ROOM] Auto-kicked ${usersInRoom.length} users from expired booking ${booking._id}`);
        }
      }
    } catch (error) {
      console.error("[HQ-ROOM] Error in auto-kick interval:", error);
    }
  }, 30 * 1000); // Check every 30 seconds

  // Cleanup stale presence states every 10 minutes
  setInterval(() => {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes

    for (const [userId, state] of userPresenceState.entries()) {
      if (now.getTime() - state.lastActivity.getTime() > staleThreshold) {
        userPresenceState.delete(userId);
      }
    }

    // Also cleanup Redis stale users
    if (isRedisAvailable()) {
      presenceService.cleanupStaleUsers().catch((err) => {
        console.error("[REDIS] Error cleaning up stale users:", err);
      });
    }
  }, 10 * 60 * 1000); // Run every 10 minutes

  // Backup: Refresh TTL for all connected users every 5 minutes
  // This catches any edge cases where ping/pong listener might miss
  setInterval(async () => {
    if (!isRedisAvailable()) return;

    const now = Date.now();
    let refreshedCount = 0;

    for (const [userId, connections] of userSocketConnections.entries()) {
      if (connections.size > 0) {
        const lastRefresh = lastTTLRefresh.get(userId) || 0;
        // Only refresh if not recently refreshed by ping/pong
        if (now - lastRefresh > TTL_REFRESH_THROTTLE) {
          try {
            await presenceService.refreshUser(userId);
            lastTTLRefresh.set(userId, now);
            refreshedCount++;
          } catch (error) {
            console.error(`[PRESENCE] Backup TTL refresh error for ${userId}:`, error);
          }
        }
      }
    }

    if (refreshedCount > 0) {
      console.log(`[PRESENCE] Backup TTL refresh: refreshed ${refreshedCount} of ${userSocketConnections.size} connected users`);
    }
  }, 5 * 60 * 1000); // Every 5 minutes

  // Helper function to get/set workspace user with Redis fallback
  const getWorkspaceUser = async (userId: string): Promise<WorkspaceUser | null> => {
    if (isRedisAvailable()) {
      return await presenceService.getUser(userId);
    }
    return workspaceUsers.get(userId) || null;
  };

  // Add a NEW user to workspace (initial join only)
  const addWorkspaceUser = async (userId: string, userData: WorkspaceUser): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.addUser(userId, userData);
    } else {
      workspaceUsers.set(userId, userData);
    }
  };

  // Update existing user data (for full object updates without triggering "user-joined" event)
  // This only updates the Redis hash without publishing an event
  const setWorkspaceUser = async (userId: string, userData: WorkspaceUser): Promise<void> => {
    if (isRedisAvailable()) {
      // Use addUser for storage but note: this publishes "user-joined" event
      // For specific field updates, use the dedicated update methods below
      await presenceService.addUser(userId, userData);
    } else {
      workspaceUsers.set(userId, userData);
    }
  };

  // Update user's space (publishes "user-moved-space" event via Redis)
  const updateWorkspaceUserSpace = async (userId: string, spaceId: string): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.updateUserSpace(userId, spaceId);
    } else {
      const user = workspaceUsers.get(userId);
      if (user) {
        user.spaceId = spaceId;
      }
    }
  };

  // Update user's status (publishes "user-status-changed" event via Redis)
  const updateWorkspaceUserStatus = async (userId: string, status: "available" | "busy" | "afk" | "mobile"): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.updateUserStatus(userId, status);
    } else {
      const user = workspaceUsers.get(userId);
      if (user) {
        user.status = status;
      }
    }
  };

  // Update user's screen share state (publishes "screen-share-state" event via Redis)
  const updateWorkspaceUserScreenShare = async (userId: string, isSharing: boolean): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.updateScreenShare(userId, isSharing);
    } else {
      const user = workspaceUsers.get(userId);
      if (user) {
        user.isScreenSharing = isSharing;
      }
    }
  };

  // Update user's recording state (publishes "user-recording-changed" event via Redis)
  const updateWorkspaceUserRecording = async (userId: string, isRecording: boolean): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.updateRecording(userId, isRecording);
    } else {
      const user = workspaceUsers.get(userId);
      if (user) {
        user.isRecording = isRecording;
      }
    }
  };

  // Users who don't have a live socket but ARE logged in on mobile with a
  // registered VoIP/push token — reachable via the knock push (WhatsApp model).
  // Excludes anyone already in live presence so the caller can union the lists
  // without duplicates.
  const getMobileReachableUsers = async (
    excludeUserIds: Set<string>
  ): Promise<WorkspaceUser[]> => {
    try {
      const [deviceUserIds, voipUserIds] = await Promise.all([
        DeviceToken.distinct("userId", {
          isActive: true,
          platform: { $in: ["ios", "android"] },
          // Chat pushes never target other apps' tokens (NetworkChains
          // registers here for wallet pushes only), so those rows don't
          // make a user knock-reachable. `$in: [null, ...]` keeps legacy
          // rows written before the `app` field existed.
          app: { $in: [null, "garage-chat"] },
        }),
        VoIPToken.distinct("userId", { isActive: true }),
      ]);
      const mobileUserIds = new Set<string>();
      for (const id of [...deviceUserIds, ...voipUserIds]) {
        const s = id?.toString();
        if (s && !excludeUserIds.has(s)) mobileUserIds.add(s);
      }
      if (mobileUserIds.size === 0) return [];

      const users = await User.find({ _id: { $in: Array.from(mobileUserIds) } })
        .select("name email profilePicture")
        .lean();

      return users.map((u: any) => ({
        id: u._id.toString(),
        name: u.name || "",
        email: u.email,
        profilePicture: u.profilePicture || undefined,
        spaceId: "lobby",
        status: "mobile" as const,
        isScreenSharing: false,
        isRecording: false,
        guest: false,
      }));
    } catch (err) {
      console.error("[WORKSPACE] Error fetching mobile-reachable users:", err);
      return [];
    }
  };

  const getAllWorkspaceUsers = async (): Promise<WorkspaceUser[]> => {
    const liveUsers = isRedisAvailable()
      ? await presenceService.getAllUsers()
      : Array.from(workspaceUsers.values());
    const liveIds = new Set(liveUsers.map((u) => u.id));
    const mobileUsers = await getMobileReachableUsers(liveIds);
    return [...liveUsers, ...mobileUsers];
  };

  const removeWorkspaceUser = async (userId: string): Promise<void> => {
    if (isRedisAvailable()) {
      await presenceService.removeUser(userId);
    } else {
      workspaceUsers.delete(userId);
    }
  };

  const updateWorkspaceUserField = async (
    userId: string,
    field: keyof WorkspaceUser,
    value: any
  ): Promise<void> => {
    if (isRedisAvailable()) {
      const user = await presenceService.getUser(userId);
      if (user) {
        (user as any)[field] = value;
        await presenceService.addUser(userId, user);
      }
    } else {
      const user = workspaceUsers.get(userId);
      if (user) {
        (user as any)[field] = value;
      }
    }
  };

  // === MULTI-DEVICE CALL STATE HELPERS ===

  /**
   * Detect device type from socket handshake user-agent
   */
  const getDeviceType = (socket: Socket): "web" | "mobile" | "unknown" => {
    const userAgent = socket.handshake.headers["user-agent"] || "";
    if (
      userAgent.includes("Expo") ||
      userAgent.includes("React Native") ||
      userAgent.includes("okhttp") ||
      userAgent.includes("Darwin") // iOS
    ) {
      return "mobile";
    }
    if (
      userAgent.includes("Mozilla") ||
      userAgent.includes("Chrome") ||
      userAgent.includes("Safari") ||
      userAgent.includes("Firefox")
    ) {
      return "web";
    }
    return "unknown";
  };

  /**
   * Does the user currently have at least one live socket from a mobile
   * client? Used to decide whether a knock needs a VoIP/FCM push or can be
   * delivered purely through the in-app socket event.
   */
  const hasLiveMobileSocket = (userId: string): boolean => {
    const socketIds = userSocketConnections.get(userId);
    if (!socketIds || socketIds.size === 0) return false;
    for (const socketId of socketIds) {
      const s = io.sockets.sockets.get(socketId);
      if (s && getDeviceType(s) === "mobile") return true;
    }
    return false;
  };

  /**
   * The set of deviceIds for the user's currently-live mobile sockets. A knock
   * push is suppressed for any device in this set (it gets the in-app socket
   * event instead), while every other registered device still rings.
   */
  const getConnectedMobileDeviceIds = (userId: string): Set<string> => {
    const ids = new Set<string>();
    const socketIds = userSocketConnections.get(userId);
    if (!socketIds) return ids;
    for (const socketId of socketIds) {
      const s = io.sockets.sockets.get(socketId);
      if (s && getDeviceType(s) === "mobile") {
        const did = (s as any).deviceId;
        if (did) ids.add(did);
      }
    }
    return ids;
  };

  /**
   * Tell a user's OTHER devices that an incoming knock was handled (accepted
   * or declined) on this device, so their ringing UI dismisses.
   */
  const notifyKnockHandled = (
    userId: string,
    handledSocketId: string,
    knockerId: string,
    action: "accepted" | "declined"
  ) => {
    const userSockets = userSocketConnections.get(userId);
    if (!userSockets) return;
    userSockets.forEach((socketId) => {
      if (socketId !== handledSocketId) {
        io.to(socketId).emit("workspace:knock-handled", {
          from: knockerId,
          action,
        });
      }
    });
  };

  /**
   * If a knock was delivered via VoIP/FCM push (target had no live mobile
   * socket), the phone is ringing a native CallKit/Telecom UI that socket
   * events can't reach. Send cancel pushes to stop that ring, then clear the
   * delivery record.
   */
  const resolveKnockDelivery = (targetId: string, knockerId: string) => {
    const key = knockDeliveryKey(targetId, knockerId);
    const delivery = knockDeliveries.get(key);
    knockDeliveries.delete(key);
    if (!delivery?.pushRung) return;

    // Only cancel the devices that could actually be ringing via push — i.e.
    // those WITHOUT a live socket. A device that's foregrounded (live socket)
    // never got a ring push, and sending it a spurious VoIP cancel would add it
    // to the client's cancel-suppression window and could swallow a later knock.
    const excludeDeviceIds = getConnectedMobileDeviceIds(targetId);
    sendKnockVoIPCancelPush(targetId, knockerId, {
      excludeDeviceIds,
      app: delivery.app,
    }).catch((err) => console.error("[VOIP] Knock cancel push error:", err));
    if (delivery.app === "networkchain") {
      sendNetworkchainCallCancelPush(targetId, knockerId, excludeDeviceIds).catch(
        (err) => console.error("[PUSH] NetworkChains call cancel push error:", err)
      );
    } else {
      sendKnockCancelFCMPush(targetId, knockerId, { excludeDeviceIds }).catch(
        (err) => console.error("[FCM] Knock cancel push error:", err)
      );
    }
  };

  /** Cancel the auto-expire timer for a knock (it was accepted/declined/cancelled). */
  const clearKnockTimer = (targetId: string, knockerId: string) => {
    const key = knockDeliveryKey(targetId, knockerId);
    const timer = knockTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      knockTimers.delete(key);
    }
  };

  /**
   * Auto-expire an unanswered knock after KNOCK_TIMEOUT_MS: stop the ring on the
   * target's live devices (socket) and killed devices (cancel push), drop the
   * server-side state, and clear the knocker's outgoing "Calling…" UI.
   */
  const expireKnock = (targetId: string, knockerId: string) => {
    knockTimers.delete(knockDeliveryKey(targetId, knockerId));

    // Only act if the knock is still in flight (not already handled).
    const activeSet = activeKnocks.get(targetId);
    if (!activeSet || !activeSet.has(knockerId)) return;

    console.log(`[KNOCK] Auto-expiring unanswered knock ${knockerId} -> ${targetId}`);

    // Write a MissedCall row so the recipient sees the unanswered knock
    // on next app open (WhatsApp-style "X tried to call you"). Snapshot
    // the caller's name + avatar so the entry stays meaningful if they
    // later rename. Fire-and-forget — knock expiry shouldn't block on
    // a DB write, and a failed write just means no badge (loud failures
    // would cascade into the entire knock-cleanup path).
    (async () => {
      try {
        const knocker = await User.findById(knockerId)
          .select("name profilePicture")
          .lean();
        await MissedCall.create({
          toUserId: new Types.ObjectId(targetId),
          fromUserId: new Types.ObjectId(knockerId),
          kind: "knock",
          fromName: (knocker as any)?.name || undefined,
          fromAvatar: (knocker as any)?.profilePicture || undefined,
          occurredAt: new Date(),
        });
        // Live nudge to the recipient's open sockets so the badge
        // count increments without waiting for a poll.
        io.to(`user:${targetId}`).emit("missed-call:new", {
          from: knockerId,
          fromName: (knocker as any)?.name || undefined,
          fromAvatar: (knocker as any)?.profilePicture || undefined,
          occurredAt: new Date().toISOString(),
        });
      } catch (err) {
        console.warn(
          `[KNOCK] Failed to write MissedCall for ${knockerId} -> ${targetId}:`,
          err,
        );
      }
    })();

    // Stop ringing on the target's live devices, and cancel the native
    // CallKit/Telecom ring on any backgrounded/killed device.
    io.to(`user:${targetId}`).emit("workspace:knock-cancelled", {
      by: knockerId,
      from: knockerId,
    });
    resolveKnockDelivery(targetId, knockerId);

    // Drop server-side knock state.
    activeSet.delete(knockerId);
    if (activeSet.size === 0) activeKnocks.delete(targetId);
    const queue = knockQueues.get(targetId);
    if (queue) {
      const idx = queue.findIndex((req) => req.from === knockerId);
      if (idx !== -1) queue.splice(idx, 1);
    }

    // Clear the knocker's outgoing "Calling…" UI (reuses the unreachable event,
    // which every client already handles to dismiss the outgoing state).
    io.to(`user:${knockerId}`).emit("workspace:knock-unreachable", { targetId });
  };

  /**
   * Notify user's OTHER devices that a call was answered on a specific device
   */
  const notifyCallAnsweredElsewhere = (
    userId: string,
    answeredSocketId: string,
    channelName: string,
    deviceType: string
  ) => {
    const userSockets = userSocketConnections.get(userId);
    if (userSockets) {
      userSockets.forEach((socketId) => {
        if (socketId !== answeredSocketId) {
          io.to(socketId).emit("livekit:call-answered-elsewhere", {
            channel: channelName,
            answeredOn: deviceType,
            message: `Call answered on ${deviceType === "web" ? "web browser" : deviceType === "mobile" ? "mobile device" : "another device"}`,
          });
          console.log(
            `[CALL-STATE] Notified socket ${socketId} that call answered on ${deviceType}`
          );
        }
      });
    }
  };

  // === END MULTI-DEVICE CALL STATE HELPERS ===

  io.use((socket, next) => {
    const token =
      (socket.handshake.auth as any)?.token ||
      socket.handshake.headers["authorization"]?.toString().split(" ")[1];
    if (!token) return next(new Error("Missing auth"));
    try {
      const payload = verifyJwt<{
        userId?: string;
        orgId?: string;
        name?: string;
        email?: string;
        // Guest-specific fields
        isGuest?: boolean;
        guestId?: string;
        eventId?: string;
        displayName?: string;
        // Bat246 name-only demo-host bypass — see demo-host-join in
        // publicWebinar.ts and the eligibility check in
        // mediasoupHandlers.ts's webinar:joinRoom.
        demoHost?: boolean;
      }>(token);

      // Check if this is a guest token
      if (payload.isGuest && payload.guestId && payload.eventId) {
        (socket as any).isGuest = true;
        (socket as any).guestId = payload.guestId;
        (socket as any).eventId = payload.eventId;
        (socket as any).displayName = payload.displayName;
        (socket as any).userEmail = payload.email;
        // For consistency, use guestId as userId for guest sockets
        (socket as any).userId = payload.guestId;
      } else {
        // Regular user token
        if (!payload.userId) {
          return next(new Error("Invalid token: missing userId"));
        }
        (socket as any).isGuest = false;
        (socket as any).userId = payload.userId;
        (socket as any).orgId = payload.orgId;
        (socket as any).userName = payload.name;
        (socket as any).userEmail = payload.email;
        (socket as any).isDemoHost = !!payload.demoHost;
      }
      // Optional stable per-device id from the client handshake. Lets knock
      // pushes target only the devices that DON'T have a live socket, so a
      // backgrounded/killed phone still rings even when another device is in the
      // foreground (per-device dedup instead of all-or-nothing).
      (socket as any).deviceId =
        (socket.handshake.auth as any)?.deviceId ||
        (socket.handshake.query as any)?.deviceId ||
        undefined;
      // NetworkChains names itself; everything else is Garage HQ (see callRoom).
      (socket as any).app =
        (socket.handshake.auth as any)?.app === "networkchain" ? "networkchain" : "garage";
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket: Socket) => {
    const userId: string = (socket as any).userId;
    const userOrgId: string = (socket as any).orgId; // Get orgId from JWT token
    userIdToSocketId.set(userId, socket.id);

    // Track multiple socket connections per user
    if (!userSocketConnections.has(userId)) {
      userSocketConnections.set(userId, new Set());
    }
    userSocketConnections.get(userId)!.add(socket.id);

    const personalRoom = `user:${userId}`;
    socket.join(personalRoom);
    socket.join(callRoom((socket as any).app, userId));

    // Their device is reachable again: flip pending DMs to delivered and
    // tell the senders (second grey tick).
    markPendingDMsDelivered(io, userId).catch((e) =>
      console.error("[SOCKET] delivery sweep failed", e)
    );

    // Refresh the User.lastSeenAt timestamp on every connect — feeds the
    // "Active X ago" UI that replaced the green-dot online indicator.
    touchLastSeen(userId);

    // Register Mediasoup webinar handlers for this socket
    registerMediasoupHandlers(io, socket);

    // Join organization room for activity updates
    if (userOrgId) {
      socket.join(`org:${userOrgId}`);
    }

    // Listen to Socket.IO ping/pong packets to refresh Redis TTL
    // This keeps users online even when browser tabs are backgrounded
    socket.conn.on("packet", async (packet: { type: number }) => {
      // packet.type: 2 = ping, 3 = pong
      if (packet.type === 2 || packet.type === 3) {
        const now = Date.now();
        const lastRefresh = lastTTLRefresh.get(userId) || 0;

        // Only refresh TTL if more than 2 minutes since last refresh
        if (now - lastRefresh > TTL_REFRESH_THROTTLE) {
          if (isRedisAvailable()) {
            try {
              await presenceService.refreshUser(userId);
              lastTTLRefresh.set(userId, now);
            } catch (error) {
              console.error(`[PRESENCE] Error refreshing TTL on ping/pong for user ${userId}:`, error);
            }
          }
        }
      }
    });

    // Track user coming online - only if this is the first connection for this user
    try {
      const user = await User.findById(userId).lean();
      console.log(
        `[PRESENCE] User ${userId} connected, connections: ${
          userSocketConnections.get(userId)?.size || 0
        }`
      );

      if (user && userOrgId && userSocketConnections.get(userId)!.size === 1) {
        // Only create online activity if this is the first connection
        const currentState = userPresenceState.get(userId);
        const now = new Date();

        // Always create online activity - no filtering or deduplication
        console.log(`[PRESENCE] Creating online activity for user ${userId}`);
        const activity = await UserActivity.create({
          userId: new Types.ObjectId(userId),
          orgId: new Types.ObjectId(userOrgId),
          type: "online",
          title: `${user.name || user.email} came online`,
          description: `${user.name || user.email} is now online and active`,
          category: "presence",
          priority: "low",
          metadata: { userId, userName: user.name, userEmail: user.email },
        });

        // Update presence state
        userPresenceState.set(userId, { isOnline: true, lastActivity: now });

        // `activity:new` broadcast retired with the Team Activity FE.
        // The UserActivity.create row above still lands in Mongo for the
        // OnlineActivityTab analytics dashboard — only the realtime
        // fan-out to client sockets is silenced. Kept commented so revert
        // is one-line.
        void activity;
        // const populatedActivity = {
        //   ...activity.toObject(),
        //   userId: {
        //     _id: user._id,
        //     name: user.name,
        //     email: user.email,
        //   },
        // };
        // io.to(`org:${userOrgId}`).emit("activity:new", {
        //   activity: populatedActivity,
        // });
      }
    } catch (error) {
      console.error("Error tracking online status:", error);
    }

    // DM handlers - scoped by organization
    socket.on("dm:join", ({ otherId }: { otherId: string }) => {
      const convId = dmConvId(userId, otherId);
      // Join org-scoped room for DMs
      const roomName = userOrgId ? `${convId}:${userOrgId}` : convId;
      socket.join(roomName);
    });

    // Typing indicators. The conversation room is named after the TYPIST's
    // token org, which a user in two or more offices doesn't have — so when
    // the two sides' tokens differ, so do their room names, and typing never
    // arrived. The other person's own room always reaches them (DM messages
    // already go there too); one emit to both, so a socket in both gets it once.
    socket.on("dm:typing", ({ otherId }: { otherId: string }) => {
      if (!otherId || typeof otherId !== "string") return;
      const convId = dmConvId(userId, otherId);
      const roomName = userOrgId ? `${convId}:${userOrgId}` : convId;
      socket.to([roomName, `user:${otherId}`]).emit("dm:typing", {
        userId,
        userName: (socket as any).userName || "User",
      });
    });

    socket.on("dm:stopTyping", ({ otherId }: { otherId: string }) => {
      if (!otherId || typeof otherId !== "string") return;
      const convId = dmConvId(userId, otherId);
      const roomName = userOrgId ? `${convId}:${userOrgId}` : convId;
      socket.to([roomName, `user:${otherId}`]).emit("dm:stopTyping", {
        userId,
      });
    });

    // Group typing. The apps have long emitted + listened for these, but there
    // was no server handler, so nothing was ever relayed — group typing simply
    // didn't work. Broadcast to the group room, and record it so the
    // socket-less support-chats admin console can poll who's typing.
    // `groupId` rides along because a socket stays in every group room it has
    // joined: without it a client can't tell which group someone is typing in,
    // and typing in one group showed up in whichever chat happened to be open.
    socket.on("group:typing", ({ groupId }: { groupId: string }) => {
      if (!groupId || typeof groupId !== "string") return;
      socket.to(`group:${groupId}`).emit("group:typing", {
        groupId,
        userId,
        userName: (socket as any).userName || "User",
      });
      markGroupTyping(groupId, userId);
    });

    socket.on("group:stopTyping", ({ groupId }: { groupId: string }) => {
      if (!groupId || typeof groupId !== "string") return;
      socket.to(`group:${groupId}`).emit("group:stopTyping", {
        groupId,
        userId,
      });
      clearGroupTyping(groupId, userId);
    });

    // The recipient's app received DMs (second grey tick for the sender).
    // With messageIds, only those; without, everything pending in the thread.
    socket.on(
      "dm:delivered",
      async ({ otherId, messageIds }: { otherId: string; messageIds?: string[] }) => {
        try {
          if (!Types.ObjectId.isValid(otherId)) return;
          const convId = dmConvId(userId, otherId);
          const ids = (Array.isArray(messageIds) ? messageIds : [])
            .filter((id) => typeof id === "string" && Types.ObjectId.isValid(id))
            .slice(0, 200);
          const q: any = {
            convId,
            from: new Types.ObjectId(otherId),
            to: new Types.ObjectId(userId),
            deliveredAt: null,
          };
          if (ids.length) q._id = { $in: ids.map((id) => new Types.ObjectId(id)) };

          const deliveredAt = new Date();
          const res = await Message.updateMany(q, { $set: { deliveredAt } });
          if (res.modifiedCount > 0) {
            io.to(`user:${otherId}`).emit("dm:delivered", {
              convId,
              by: userId,
              deliveredAt,
              ...(ids.length ? { messageIds: ids } : {}),
            });
          }
        } catch (e) {
          console.error("[SOCKET] dm:delivered error", e);
        }
      }
    );

    socket.on(
      "dm:message",
      async (
        {
          otherId,
          text,
          tempId,
          clientMsgId,
          attachments,
          replyTo,
        }: {
          otherId: string;
          text: string;
          tempId?: string;
          clientMsgId?: string;
          attachments?: Array<{
            fileName: string;
            fileSize: number;
            fileType: string;
            fileUrl: string;
          }>;
          replyTo?: string;
        },
        ack?: Function
      ) => {
        try {
          if (
            !Types.ObjectId.isValid(userId) ||
            !Types.ObjectId.isValid(otherId)
          ) {
            return ack?.({ ok: false, error: "Invalid user id(s)" });
          }
          const convId = dmConvId(userId, otherId);

          // Process attachments to include S3 keys
          const processedAttachments = attachments?.map((att) => ({
            fileName: att.fileName,
            fileSize: att.fileSize,
            fileType: att.fileType,
            fileUrl: att.fileUrl,
            fileKey: att.fileUrl.split("/").pop() || "", // Extract key from URL
            uploadedAt: new Date(),
            // Playback/layout metadata passes through untouched — see
            // utils/attachmentMeta for why a whitelist here was a bug.
            ...processAttachmentMeta(att as any),
          }));

          const sent = await createOnce(
            Message,
            {
              convId,
              orgId: userOrgId ? new Types.ObjectId(userOrgId) : undefined,
              from: userId,
              to: otherId,
              text,
              attachments: processedAttachments,
              replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
            },
            userId,
            validClientMsgId(clientMsgId)
          );
          if (sent.existing) {
            // A retry of a send that already landed: ack only. The broadcast
            // and push already went out with the first copy.
            return ack?.({ ok: true, msg: { ...sent.existing, tempId } });
          }
          const msg = sent.created;

          let populatedReplyTo = null;
          if (msg.replyTo) {
            populatedReplyTo = await Message.findById(msg.replyTo).lean();
          }

          const out = {
            _id: msg.id,
            convId,
            orgId: userOrgId,
            from: userId,
            to: otherId,
            text,
            attachments: msg.attachments,
            replyTo: populatedReplyTo || msg.replyTo,
            editedAt: msg.editedAt,
            createdAt: msg.createdAt,
            readAt: msg.readAt,
            deliveredAt: msg.deliveredAt,
            tempId,
          };

          // Create UserNotification for the recipient
          try {
            const sender = await User.findById(userId)
              .select("name email profilePicture")
              .lean();
            const orgId = (socket as any).orgId;

            await UserNotification.create({
              userId: new Types.ObjectId(otherId),
              orgId: orgId ? new Types.ObjectId(orgId) : undefined,
              type: "dm",
              dmFrom: new Types.ObjectId(userId),
              dmFromName: sender?.name,
              dmFromEmail: sender?.email,
              dmFromPicture: sender?.profilePicture,
              dmText: text,
              dmConvId: convId,
              dmMessageId: msg._id,
              read: false,
              cleared: false,
            });
          } catch (notifError) {
            console.error(
              `Failed to create UserNotification for DM to ${otherId}:`,
              notifError
            );
          }

          // Blocking is enforced at DELIVERY, not at write. The message is
          // already persisted above and the sender is acked `ok: true` below
          // exactly as normal — a sender must never be able to tell they have
          // been blocked. What changes is that it is not routed to the blocker
          // and no push is sent.
          const recipientBlockedMe = await hasBlocked(otherId, userId).catch(
            () => false
          );

          // Emit to org-scoped DM room
          const roomName = userOrgId ? `${convId}:${userOrgId}` : convId;
          if (recipientBlockedMe) {
            // The conversation room holds BOTH parties, so broadcasting to it
            // would reach the blocker anyway. Echo to the sender alone.
            io.to(`user:${userId}`).emit("dm:message", out);
          } else {
            io.to(roomName).emit("dm:message", out);
            io.to(`user:${otherId}`).emit("dm:message", out);
          }

          ack?.({ ok: true, msg: out });

          // Send push notification to recipient (fire-and-forget, don't block ack)
          // Mobile app handles deduplication - only shows if app is backgrounded
          (async () => {
            try {
              // profilePicture rides along for the notification's large
              // icon — the sender's face beside their name. It only works
              // from here: a push landing on a killed app is built by the
              // OS from the payload, so an image the payload lacks can
              // never be added on the device.
              const senderForPush = await User.findById(userId)
                .select("name email profilePicture")
                .lean();
              await sendDMPushNotification(
                otherId,
                userId,
                senderForPush?.name || senderForPush?.email || "Someone",
                text || "",
                convId,
                msg._id.toString(),
                senderForPush?.profilePicture || null
              );
            } catch (err) {
              console.error("[PUSH] DM notification error:", err);
            }
          })();
        } catch (e: any) {
          console.error("[SOCKET] dm:message error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    // ── DM reactions ────────────────────────────────────────────────────
    // Toggle an emoji reaction on a DM message. Authoritative on the server
    // so all participants see the same state.
    socket.on(
      "dm:react",
      async (
        {
          messageId,
          emoji,
        }: { messageId: string; emoji: string },
        ack?: Function
      ) => {
        try {
          if (!Types.ObjectId.isValid(messageId)) {
            return ack?.({ ok: false, error: "Invalid message id" });
          }
          if (!emoji || typeof emoji !== "string" || emoji.length > 16) {
            return ack?.({ ok: false, error: "Invalid emoji" });
          }

          const msg = await Message.findById(messageId);
          if (!msg) return ack?.({ ok: false, error: "Message not found" });

          // Only participants of the conversation may react
          const fromStr = msg.from.toString();
          const toStr = msg.to.toString();
          if (userId !== fromStr && userId !== toStr) {
            return ack?.({ ok: false, error: "Not a participant" });
          }

          // Don't allow reactions on deleted messages
          if (msg.deletedAt) {
            return ack?.({ ok: false, error: "Message was deleted" });
          }

          // Toggle: clicking the same emoji removes; switching emojis replaces
          // the user's previous reaction.
          const reactions: Map<string, string[]> =
            (msg.reactions as any) || new Map();
          let removingOwnSame = false;
          for (const [e, users] of reactions.entries()) {
            const filtered = (users || []).filter((u: string) => u !== userId);
            if (e === emoji && (users || []).includes(userId)) {
              removingOwnSame = true;
            }
            if (filtered.length > 0) reactions.set(e, filtered);
            else reactions.delete(e);
          }
          if (!removingOwnSame) {
            const arr = reactions.get(emoji) || [];
            arr.push(userId);
            reactions.set(emoji, arr);
          }

          msg.reactions = reactions as any;
          msg.markModified("reactions");
          await msg.save();

          // Serialize Map to plain object for the wire
          const serialized: Record<string, string[]> = {};
          for (const [e, users] of reactions.entries()) {
            serialized[e] = users;
          }

          const payload = {
            messageId: msg._id.toString(),
            convId: msg.convId,
            reactions: serialized,
          };

          const orgIdStr = msg.orgId ? msg.orgId.toString() : undefined;
          const roomName = orgIdStr ? `${msg.convId}:${orgIdStr}` : msg.convId;
          io.to(roomName).emit("dm:message-reactions", payload);
          io.to(`user:${fromStr}`).emit("dm:message-reactions", payload);
          io.to(`user:${toStr}`).emit("dm:message-reactions", payload);

          ack?.({ ok: true, reactions: serialized });
        } catch (e: any) {
          console.error("[SOCKET] dm:react error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    // Global DM handlers - NOT scoped by organization (cross-org messaging)
    socket.on("global-dm:join", ({ otherId }: { otherId: string }) => {
      const convId = globalDmConvId(userId, otherId);
      socket.join(convId);
    });

    socket.on("global-dm:leave", ({ otherId }: { otherId: string }) => {
      const convId = globalDmConvId(userId, otherId);
      socket.leave(convId);
    });

    // ── Global DM reactions ─────────────────────────────────────────────
    // Same contract as dm:react: { messageId, emoji }, toggling; the same
    // emoji again removes it, a different one replaces the user's previous
    // reaction. Global DMs had no reaction handler at all, so every reaction
    // on one was lost.
    socket.on(
      "global-dm:react",
      async (
        { messageId, emoji }: { messageId: string; emoji: string },
        ack?: Function
      ) => {
        try {
          if (!Types.ObjectId.isValid(messageId)) {
            return ack?.({ ok: false, error: "Invalid message id" });
          }
          if (!emoji || typeof emoji !== "string" || emoji.length > 16) {
            return ack?.({ ok: false, error: "Invalid emoji" });
          }

          const msg = await GlobalMessage.findById(messageId);
          if (!msg) return ack?.({ ok: false, error: "Message not found" });

          const fromStr = msg.from.toString();
          const toStr = msg.to.toString();
          if (userId !== fromStr && userId !== toStr) {
            return ack?.({ ok: false, error: "Not a participant" });
          }

          const reactions: Map<string, string[]> =
            (msg.reactions as any) || new Map();
          let removingOwnSame = false;
          for (const [e, users] of reactions.entries()) {
            const filtered = (users || []).filter((u: string) => u !== userId);
            if (e === emoji && (users || []).includes(userId)) {
              removingOwnSame = true;
            }
            if (filtered.length > 0) reactions.set(e, filtered);
            else reactions.delete(e);
          }
          if (!removingOwnSame) {
            const arr = reactions.get(emoji) || [];
            arr.push(userId);
            reactions.set(emoji, arr);
          }

          msg.reactions = reactions as any;
          msg.markModified("reactions");
          await msg.save();

          const serialized: Record<string, string[]> = {};
          for (const [e, users] of reactions.entries()) {
            serialized[e] = users;
          }
          const payload = {
            messageId: msg._id.toString(),
            convId: msg.convId,
            reactions: serialized,
          };
          io.to(msg.convId).emit("global-dm:message-reactions", payload);
          io.to(`user:${fromStr}`).emit("global-dm:message-reactions", payload);
          io.to(`user:${toStr}`).emit("global-dm:message-reactions", payload);

          ack?.({ ok: true, reactions: serialized });
        } catch (e: any) {
          console.error("[SOCKET] global-dm:react error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    socket.on("global-dm:typing", ({ otherId }: { otherId: string }) => {
      const convId = globalDmConvId(userId, otherId);
      socket.to(convId).emit("global-dm:typing", {
        userId,
        userName: (socket as any).userName || "User",
      });
    });

    socket.on("global-dm:stopTyping", ({ otherId }: { otherId: string }) => {
      const convId = globalDmConvId(userId, otherId);
      socket.to(convId).emit("global-dm:stopTyping", { userId });
    });

    socket.on(
      "global-dm:message",
      async (
        {
          otherId,
          text,
          tempId,
          clientMsgId,
          attachments,
          replyTo,
        }: {
          otherId: string;
          text: string;
          tempId?: string;
          clientMsgId?: string;
          attachments?: Array<{
            fileName: string;
            fileSize: number;
            fileType: string;
            fileUrl: string;
          }>;
          replyTo?: string;
        },
        ack?: Function
      ) => {
        try {
          if (
            !Types.ObjectId.isValid(userId) ||
            !Types.ObjectId.isValid(otherId)
          ) {
            return ack?.({ ok: false, error: "Invalid user id(s)" });
          }
          const convId = globalDmConvId(userId, otherId);

          // Process attachments to include S3 keys
          const processedAttachments = attachments?.map((att) => ({
            fileName: att.fileName,
            fileSize: att.fileSize,
            fileType: att.fileType,
            fileUrl: att.fileUrl,
            fileKey: att.fileUrl.split("/").pop() || "",
            uploadedAt: new Date(),
            ...processAttachmentMeta(att as any),
          }));

          const sent = await createOnce(
            GlobalMessage,
            {
              convId,
              from: userId,
              to: otherId,
              text,
              attachments: processedAttachments,
              replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
            },
            userId,
            validClientMsgId(clientMsgId)
          );
          if (sent.existing) {
            return ack?.({ ok: true, msg: { ...sent.existing, tempId } });
          }
          const msg = sent.created;

          let populatedReplyTo = null;
          if (msg.replyTo) {
            populatedReplyTo = await GlobalMessage.findById(msg.replyTo).lean();
          }

          const out = {
            _id: msg.id,
            convId,
            from: userId,
            to: otherId,
            text,
            attachments: msg.attachments,
            replyTo: populatedReplyTo || msg.replyTo,
            editedAt: msg.editedAt,
            createdAt: msg.createdAt,
            readAt: msg.readAt,
            tempId,
          };

          // Create UserNotification for the recipient (no orgId for global DM)
          try {
            const sender = await User.findById(userId)
              .select("name email profilePicture")
              .lean();

            await UserNotification.create({
              userId: new Types.ObjectId(otherId),
              // No orgId for global DMs
              type: "global_dm",
              globalDmFrom: new Types.ObjectId(userId),
              globalDmFromName: sender?.name,
              globalDmFromEmail: sender?.email,
              globalDmFromPicture: sender?.profilePicture,
              globalDmText: text,
              globalDmConvId: convId,
              globalDmMessageId: msg._id,
              read: false,
              cleared: false,
            });
          } catch (notifError) {
            console.error(
              `Failed to create UserNotification for Global DM to ${otherId}:`,
              notifError
            );
          }

          // Emit to global DM room (no org scope)
          io.to(convId).emit("global-dm:message", out);
          // Also emit to recipient's personal room for notifications
          io.to(`user:${otherId}`).emit("global-dm:message", out);
          ack?.({ ok: true, msg: out });

          // Send push notification for global DM (fire-and-forget)
          (async () => {
            try {
              // profilePicture rides along for the notification's large
              // icon — the sender's face beside their name. It only works
              // from here: a push landing on a killed app is built by the
              // OS from the payload, so an image the payload lacks can
              // never be added on the device.
              const senderForPush = await User.findById(userId)
                .select("name email profilePicture")
                .lean();
              await sendDMPushNotification(
                otherId,
                userId,
                senderForPush?.name || senderForPush?.email || "Someone",
                text || "",
                convId,
                msg._id.toString(),
                senderForPush?.profilePicture || null
              );
            } catch (err) {
              console.error("[PUSH] Global DM notification error:", err);
            }
          })();
        } catch (e: any) {
          console.error("[SOCKET] global-dm:message error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    socket.on("group:join", async ({ groupId }: { groupId: string }) => {
      socket.join(`group:${groupId}`);
    });

    socket.on(
      "group:message",
      async (
        {
          groupId,
          text,
          tempId,
          clientMsgId,
          attachments,
          replyTo,
          threadId,
        }: {
          groupId: string;
          text?: string;
          tempId?: string;
          clientMsgId?: string;
          attachments?: Array<{
            fileName: string;
            fileSize: number;
            fileType: string;
            fileUrl: string;
            fileKey?: string;
          }>;
          replyTo?: string;
          threadId?: string;
        },
        ack?: Function
      ) => {
        try {
          const from = (socket as any).userId as string;

          // Validate: either text or attachments must be present
          if (
            (!text || text.trim() === "") &&
            (!attachments || attachments.length === 0)
          ) {
            return ack?.({
              ok: false,
              error: "Message must have text or attachments",
            });
          }

          // Get group info and members for mention matching
          const groupDoc = await Group.findById(groupId).lean();
          if (!groupDoc) {
            return ack?.({ ok: false, error: "Group not found" });
          }
          const group = groupDoc as any;

          // Admin-control enforcement: broadcastOnly + adminOnlyFiles.
          // These must run before any DB writes — server is the source of truth.
          {
            const senderMember = (group.members || []).find(
              (m: any) => m.userId.toString() === from
            );
            const senderIsAdmin =
              group.createdBy?.toString() === from ||
              senderMember?.role === "admin";

            if (group.broadcastOnly && !senderIsAdmin) {
              socket.emit("group:message-rejected", {
                tempId,
                groupId,
                reason: "broadcast_only",
              });
              return ack?.({ ok: false, error: "broadcast_only" });
            }

            if (
              group.adminOnlyFiles &&
              !senderIsAdmin &&
              attachments &&
              attachments.length > 0
            ) {
              socket.emit("group:message-rejected", {
                tempId,
                groupId,
                reason: "admin_only_files",
              });
              return ack?.({ ok: false, error: "admin_only_files" });
            }
          }

          // Get all group member user IDs
          const groupMemberIds = (group as any).members.map((m: any) =>
            m.userId.toString()
          );

          // Members' names and emails, for resolving "@Name" below. Fetched
          // only when the text can hold a mention, and only those two fields —
          // this used to load every member's full document on every message.
          const groupMembers: any[] =
            text && text.includes("@")
              ? await User.find({
                  _id: {
                    $in: groupMemberIds.map(
                      (id: string) => new Types.ObjectId(id)
                    ),
                  },
                })
                  .select("name email")
                  .lean()
              : [];

          // Parse mentions from text - match full names with spaces
          const mentionedUserIds = new Set<string>();
          if (text) {
            // Check for special @all and @here keywords FIRST
            const textLower = text.toLowerCase();
            if (textLower.includes("@all")) {
              // @all — add ALL group members (except sender) to mentions
              for (const memberId of groupMemberIds) {
                if (memberId !== from) {
                  mentionedUserIds.add(memberId);
                }
              }
            }
            if (textLower.includes("@here")) {
              // @here — add only currently ONLINE group members (except sender)
              for (const memberId of groupMemberIds) {
                if (memberId === from) continue;
                // Check if the user has an active socket connection
                const userRoom = `user:${memberId}`;
                const sockets = io.sockets.adapter.rooms.get(userRoom);
                if (sockets && sockets.size > 0) {
                  mentionedUserIds.add(memberId);
                }
              }
            }

            // Find all @ symbols and try to match full names/emails
            let textIndex = 0;
            while (textIndex < text.length) {
              const atIndex = text.indexOf("@", textIndex);
              if (atIndex === -1) break;

              const textAfterAt = text.substring(atIndex + 1);

              // Skip special keywords (already handled above)
              const specialKeywordMatch = textAfterAt.match(/^(all|here)(\s|$|[.,!?;:])/i);
              if (specialKeywordMatch) {
                textIndex = atIndex + 1 + specialKeywordMatch[1].length;
                continue;
              }

              let bestMatch: { user: any; matchedText: string } | null = null;

              // Check all group members to find the best (longest) match
              for (const user of groupMembers) {
                const userName = (user.name || "").trim();
                const userEmail = (user.email || "").trim();

                // Try matching full name (with spaces)
                if (userName) {
                  const nameLower = userName.toLowerCase();
                  // Match name followed by space, punctuation, or end of string
                  const nameRegex = new RegExp(
                    `^${nameLower.replace(
                      /[.*+?^${}()|[\]\\]/g,
                      "\\$&"
                    )}(?:\\s|$|[.,!?;:])`,
                    "i"
                  );
                  const nameMatch = textAfterAt.match(nameRegex);
                  if (nameMatch) {
                    const matchedLength = nameMatch[0].trimEnd().length;
                    if (
                      !bestMatch ||
                      matchedLength > bestMatch.matchedText.length
                    ) {
                      bestMatch = { user, matchedText: userName };
                    }
                  }
                }

                // Try matching email
                if (userEmail) {
                  const emailLower = userEmail.toLowerCase();
                  const emailRegex = new RegExp(
                    `^${emailLower.replace(
                      /[.*+?^${}()|[\]\\]/g,
                      "\\$&"
                    )}(?:\\s|$|[.,!?;:])`,
                    "i"
                  );
                  const emailMatch = textAfterAt.match(emailRegex);
                  if (emailMatch) {
                    const matchedLength = emailMatch[0].trimEnd().length;
                    if (
                      !bestMatch ||
                      matchedLength > bestMatch.matchedText.length
                    ) {
                      bestMatch = { user, matchedText: userEmail };
                    }
                  }
                }

                // Also try matching by ID (single word)
                const userId = user._id.toString().toLowerCase();
                const idMatch = textAfterAt.match(
                  new RegExp(`^${userId}(?:\\s|$|[.,!?;:])`, "i")
                );
                if (idMatch) {
                  const matchedLength = idMatch[0].trimEnd().length;
                  if (
                    !bestMatch ||
                    matchedLength > bestMatch.matchedText.length
                  ) {
                    bestMatch = { user, matchedText: userId };
                  }
                }
              }

              if (bestMatch) {
                mentionedUserIds.add(bestMatch.user._id.toString());
                textIndex = atIndex + 1 + bestMatch.matchedText.length;
              } else {
                // No match, move past the @
                textIndex = atIndex + 1;
              }
            }
          }

          // Process attachments to include S3 keys
          const processedAttachments = attachments?.map((att) => ({
            fileName: att.fileName,
            fileSize: att.fileSize,
            fileType: att.fileType,
            fileUrl: att.fileUrl,
            fileKey: att.fileKey || att.fileUrl.split("/").pop() || "",
            uploadedAt: new Date(),
            ...processAttachmentMeta(att as any),
          }));

          // Get sender info
          const sender = await User.findById(from)
            .select("name email profilePicture")
            .lean();
          const senderName = sender?.name || sender?.email || "Someone";

          // Create message with mentions
          const sent = await createOnce(
            GroupMessage,
            {
              groupId: new Types.ObjectId(groupId),
              from: new Types.ObjectId(from),
              text: text ? text.trim() : "",
              attachments: processedAttachments,
              mentions: Array.from(mentionedUserIds).map(
                (id) => new Types.ObjectId(id)
              ),
              replyTo: replyTo ? new Types.ObjectId(replyTo) : null,
              threadId: threadId ? new Types.ObjectId(threadId) : null,
            },
            from,
            validClientMsgId(clientMsgId)
          );
          if (sent.existing) {
            return ack?.({
              ok: true,
              msg: { ...sent.existing, groupId, tempId },
            });
          }
          const msg = sent.created;

          // Support chats: auto-raise a ticket from a member's message (async,
          // best-effort — never blocks the send). No-op for non-support groups
          // and for staff messages; the service checks. Top-level only.
          if (!threadId) {
            setImmediate(() => {
              import("../services/supportTicketAuto")
                .then(({ maybeAutoCreateTicket }) =>
                  maybeAutoCreateTicket(String(groupId), String(from)),
                )
                .catch(() => {});
            });
            // Groups linked to a Taskroom board: the AI files work items from
            // the chat as tasks (async, best-effort, never blocks the send).
            // Gated on the group doc already in hand so unlinked, disabled,
            // broken and support groups never load the module or touch the
            // DB; the service re-checks everything. Top-level only.
            const taskroomLink = group.taskroom;
            if (
              group.kind !== "support" &&
              taskroomLink?.roomId &&
              taskroomLink.enabled !== false &&
              taskroomLink.status !== "broken"
            ) {
              setImmediate(() => {
                import("../services/groupTaskAuto")
                  .then(({ maybeCaptureGroupTask }) =>
                    maybeCaptureGroupTask(String(groupId), String(msg._id)),
                  )
                  // The service never throws; this only fires if the module
                  // itself fails to load — say so rather than go silent.
                  .catch((e) =>
                    console.warn("[group-task-ai] hook failed:", e?.message || e),
                  );
              });
            }
          }

          // If this is a thread reply, update the parent message and emit
          // thread-specific events instead of the normal group:message flow.
          if (threadId) {
            try {
              const replyPreview = text ? text.trim().substring(0, 200) : "";
              const updatedParent = await GroupMessage.findOneAndUpdate(
                {
                  _id: new Types.ObjectId(threadId),
                  groupId: new Types.ObjectId(groupId),
                },
                {
                  $inc: { replyCount: 1 },
                  $set: {
                    lastThreadReply: {
                      text: replyPreview,
                      from: new Types.ObjectId(from),
                      createdAt: msg.createdAt,
                    },
                  },
                  $addToSet: {
                    threadParticipants: new Types.ObjectId(from),
                  },
                },
                { new: true }
              ).lean();

              let populatedReplyTo = null;
              if (msg.replyTo) {
                populatedReplyTo = await GroupMessage.findById(msg.replyTo).lean();
              }

              const out = {
                _id: msg.id,
                groupId,
                from,
                text: msg.text || "",
                attachments: msg.attachments,
                mentions: msg.mentions?.map((m: any) => m.toString()) || [],
                replyTo: populatedReplyTo || msg.replyTo,
                threadId,
                editedAt: msg.editedAt,
                createdAt: msg.createdAt,
                readAt: msg.readAt,
                tempId,
              };

              // Emit reply to all group members (thread panel listens for this)
              io.to(`group:${groupId}`).emit("group:thread-reply", out);

              // Emit update so the main feed's thread preview indicator refreshes
              if (updatedParent) {
                io.to(`group:${groupId}`).emit("group:thread-update", {
                  groupId,
                  messageId: threadId,
                  replyCount: (updatedParent as any).replyCount,
                  lastThreadReply: (updatedParent as any).lastThreadReply,
                  threadParticipants:
                    (updatedParent as any).threadParticipants?.map((id: any) =>
                      id.toString()
                    ) || [],
                  threadResolved: (updatedParent as any).threadResolved,
                });
              }

              return ack?.({ ok: true, msg: out });
            } catch (e: any) {
              console.error("[SOCKET] group:thread-reply error", e);
              return ack?.({
                ok: false,
                error: e?.message || "Failed to post thread reply",
              });
            }
          }

          // Support chats keep their last message on the group (list preview,
          // sort order, "awaiting reply"). No-op for every other group.
          if (group.kind === "support") {
            void recordSupportMessage(group, msg);
          }

          // Send notifications to mentioned users (if any)
          if (mentionedUserIds.size > 0 && group?.createdBy) {
            // The GROUP's org, not the socket's.
            //
            // `socket.orgId` comes straight off the JWT (`payload.orgId`) with
            // no fallback, and `POST /auth/login` only puts an `orgId` in the
            // token when the user belongs to EXACTLY ONE organization — 0 or
            // 2+ get a user-scoped token with the claim absent (see the comment
            // at routes/auth.ts). So every mention by anyone in more than one
            // office was silently dropped here: the message sent, the mention
            // highlighted in the client, and no row, no socket event and no
            // push was ever produced.
            //
            // REST did not show the bug because `requireAuth` falls back to
            // `dbUser.organization` (middleware/auth.ts); the socket has no
            // such fallback. The group's own `orgId` is required on the schema
            // and is the authoritative answer anyway — a notification about a
            // message in group X belongs to X's org, whatever offices its
            // author happens to be in.
            const orgId =
              (group as any).orgId?.toString() || (socket as any).orgId;
            if (orgId) {
              const groupName = (group as any).name || "a group";
              const preview = text
                ? text.substring(0, 100) + (text.length > 100 ? "..." : "")
                : "Shared a file";
              // Don't notify the sender
              const mentionRecipients = Array.from(mentionedUserIds).filter(
                (id) => id !== from
              );

              // One bulk write. This was an awaited insert per mentioned user,
              // all before the message was broadcast — so an @all held the
              // message back by one database round trip per member.
              try {
                await Notification.insertMany(
                  mentionRecipients.map((mentionedUserId) => ({
                    userId: new Types.ObjectId(mentionedUserId),
                    orgId: new Types.ObjectId(orgId),
                    type: "group_mention",
                    priority: "high", // High priority for mentions
                    title: `${senderName} mentioned you`,
                    message: preview,
                    data: {
                      groupId: groupId,
                      groupName: groupName,
                      messageId: msg._id.toString(),
                      senderId: from,
                      senderName: senderName,
                    },
                    isRead: false,
                  })),
                  { ordered: false }
                );
              } catch (notifError) {
                console.error(
                  `Failed to create mention notifications for group ${groupId}:`,
                  notifError
                );
              }

              for (const mentionedUserId of mentionRecipients) {
                // Emit real-time notification to the mentioned user
                io.to(`user:${mentionedUserId}`).emit("notification:new", {
                  type: "group_mention",
                  priority: "high",
                  title: `${senderName} mentioned you`,
                  message: preview,
                  data: {
                    groupId: groupId,
                    groupName: groupName,
                    messageId: msg._id.toString(),
                  },
                });

                // Send push notification for mention (fire-and-forget)
                sendMentionPushNotification(
                  mentionedUserId,
                  from,
                  senderName,
                  groupId,
                  groupName,
                  text || "",
                  msg._id.toString(),
                  (sender as any)?.profilePicture || null,
                  group.picture || null
                ).catch((err) =>
                  console.error("[PUSH] Mention notification error:", err)
                );
              }
            }
          }

          let populatedReplyTo = null;
          if (msg.replyTo) {
            populatedReplyTo = await GroupMessage.findById(msg.replyTo).lean();
          }

          const out = {
            _id: msg.id,
            groupId,
            from,
            text: msg.text || "",
            attachments: msg.attachments,
            mentions: msg.mentions?.map((m: any) => m.toString()) || [],
            replyTo: populatedReplyTo || msg.replyTo,
            threadId: null,
            replyCount: 0,
            threadResolved: false,
            editedAt: msg.editedAt,
            createdAt: msg.createdAt,
            readAt: msg.readAt,
            tempId,
          };

          // Create UserNotification for all group members (except sender).
          //
          // One bulk write, still before the broadcast so a client reacting to
          // the message already finds its notification row. This was an
          // awaited insert per member (after re-reading the group we already
          // had), and nobody got the message — nor the sender their ack —
          // until the last one finished: in a big group, seconds of lag.
          // The GROUP's org, not the socket's — same reason as the mention
          // notifications above: a sender in two or more offices has no orgId
          // on their token, their rows were written without one, and the
          // office-scoped notification list (`?orgId=`) never showed them.
          const orgId =
            (group as any).orgId?.toString() || (socket as any).orgId;
          const groupName = (group as any).name || "a group";
          const recipientIds: string[] = groupMemberIds.filter(
            (uid: string) => uid !== from
          );

          try {
            await UserNotification.insertMany(
              recipientIds.map((uid) => ({
                userId: new Types.ObjectId(uid),
                orgId: orgId ? new Types.ObjectId(orgId) : undefined,
                type: "group_message",
                groupId: new Types.ObjectId(groupId),
                groupName: groupName,
                groupFrom: new Types.ObjectId(from),
                groupFromName: sender?.name,
                groupFromEmail: sender?.email,
                groupFromPicture: sender?.profilePicture,
                groupText: text,
                groupMessageId: msg._id,
                read: false,
                cleared: false,
              })),
              { ordered: false }
            );
          } catch (notifError) {
            console.error(
              `Failed to create UserNotifications for group message in ${groupId}:`,
              notifError
            );
          }

          // One emit to the group room plus every other member's user room.
          // Socket.IO delivers a single copy to a socket that sits in several.
          io.to([
            `group:${groupId}`,
            ...recipientIds.map((uid) => `user:${uid}`),
          ]).emit("group:message", out);
          ack?.({ ok: true, msg: out });

          // Send push notification to all group members (fire-and-forget)
          // Mobile app handles deduplication - only shows if app is backgrounded
          (async () => {
            try {
              const memberIds = groupMemberIds;
              await sendGroupPushNotification(
                memberIds,
                from,
                sender?.name || sender?.email || "Someone",
                groupId,
                groupName,
                text || "",
                msg._id.toString(),
                // The sender's face, not the group's icon — the shade has to
                // answer who is talking.
                (sender as any)?.profilePicture || null,
                group.picture || null
              );
            } catch (err) {
              console.error("[PUSH] Group notification error:", err);
            }
          })();
        } catch (e: any) {
          console.error("[SOCKET] group:message error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    // ── Group reactions ─────────────────────────────────────────────────
    socket.on(
      "group:react",
      async (
        {
          messageId,
          emoji,
        }: { messageId: string; emoji: string },
        ack?: Function
      ) => {
        try {
          if (!Types.ObjectId.isValid(messageId)) {
            return ack?.({ ok: false, error: "Invalid message id" });
          }
          if (!emoji || typeof emoji !== "string" || emoji.length > 16) {
            return ack?.({ ok: false, error: "Invalid emoji" });
          }

          const msg = await GroupMessage.findById(messageId);
          if (!msg) return ack?.({ ok: false, error: "Message not found" });
          if (msg.deletedAt) {
            return ack?.({ ok: false, error: "Message was deleted" });
          }

          // Caller must be a member of the group
          const groupId = msg.groupId.toString();
          const group = await Group.findOne({
            _id: msg.groupId,
            "members.userId": new Types.ObjectId(userId),
          }).lean();
          if (!group) {
            return ack?.({ ok: false, error: "Not a group member" });
          }

          const reactions: Map<string, string[]> =
            (msg.reactions as any) || new Map();
          let removingOwnSame = false;
          for (const [e, users] of reactions.entries()) {
            const filtered = (users || []).filter((u: string) => u !== userId);
            if (e === emoji && (users || []).includes(userId)) {
              removingOwnSame = true;
            }
            if (filtered.length > 0) reactions.set(e, filtered);
            else reactions.delete(e);
          }
          if (!removingOwnSame) {
            const arr = reactions.get(emoji) || [];
            arr.push(userId);
            reactions.set(emoji, arr);
          }

          msg.reactions = reactions as any;
          msg.markModified("reactions");
          await msg.save();

          const serialized: Record<string, string[]> = {};
          for (const [e, users] of reactions.entries()) {
            serialized[e] = users;
          }

          io.to(`group:${groupId}`).emit("group:message-reactions", {
            messageId: msg._id.toString(),
            groupId,
            reactions: serialized,
          });

          ack?.({ ok: true, reactions: serialized });
        } catch (e: any) {
          console.error("[SOCKET] group:react error", e);
          ack?.({ ok: false, error: e?.message || "Server error" });
        }
      }
    );

    // WebRTC handlers remain the same
    socket.on(
      "video:call-user",
      async ({ to, offer }: { to: string; offer: any }) => {
        io.to(`user:${to}`).emit("video:incoming-call", {
          from: userId,
          offer,
          // Ensure frontend reliably knows this is a video call
          callType: "video",
        });

        // Send push notification for incoming video call (fire-and-forget)
        (async () => {
          try {
            const caller = await User.findById(userId)
              .select("name email")
              .lean();
            await sendCallPushNotification(
              to,
              userId,
              caller?.name || caller?.email || "Someone",
              "video"
            );
          } catch (err) {
            console.error("[PUSH] Video call notification error:", err);
          }
        })();
      }
    );
    socket.on(
      "video:call-answered",
      ({ to, answer }: { to: string; answer: any }) => {
        io.to(`user:${to}`).emit("video:call-accepted", {
          from: userId,
          answer,
        });
      }
    );
    socket.on(
      "video:ice-candidate",
      ({ to, candidate }: { to: string; candidate: any }) => {
        io.to(`user:${to}`).emit("video:ice-candidate", {
          from: userId,
          candidate,
        });
      }
    );
    socket.on("video:call-ended", ({ to }: { to: string }) => {
      io.to(`user:${to}`).emit("video:call-ended", { from: userId });
    });
    socket.on("video:call-declined", ({ to }: { to: string }) => {
      io.to(`user:${to}`).emit("video:call-declined", { from: userId });
    });

    // Audio call handlers
    socket.on(
      "audio:call-user",
      async ({
        to,
        offer,
        callType,
      }: {
        to: string;
        offer: any;
        callType: string;
      }) => {
        io.to(`user:${to}`).emit("audio:incoming-call", {
          from: userId,
          offer,
          callType,
        });

        // Send push notification for incoming audio call (fire-and-forget)
        (async () => {
          try {
            const caller = await User.findById(userId)
              .select("name email")
              .lean();
            await sendCallPushNotification(
              to,
              userId,
              caller?.name || caller?.email || "Someone",
              "audio"
            );
          } catch (err) {
            console.error("[PUSH] Audio call notification error:", err);
          }
        })();
      }
    );
    socket.on(
      "audio:call-answered",
      ({ to, answer }: { to: string; answer: any }) => {
        io.to(`user:${to}`).emit("audio:call-accepted", {
          from: userId,
          answer,
        });
      }
    );
    socket.on(
      "audio:ice-candidate",
      ({ to, candidate }: { to: string; candidate: any }) => {
        io.to(`user:${to}`).emit("audio:ice-candidate", {
          from: userId,
          candidate,
        });
      }
    );
    socket.on("audio:call-ended", ({ to }: { to: string }) => {
      io.to(`user:${to}`).emit("audio:call-ended", { from: userId });
    });
    socket.on("audio:call-declined", ({ to }: { to: string }) => {
      io.to(`user:${to}`).emit("audio:call-declined", { from: userId });
    });

    // --- NEW: Renegotiation Handlers ---
    socket.on("renegotiation-needed", ({ to, offer }) => {
      io.to(`user:${to}`).emit("renegotiation-needed", { from: userId, offer });
    });

    socket.on("renegotiation-accepted", ({ to, answer }) => {
      io.to(`user:${to}`).emit("renegotiation-accepted", {
        from: userId,
        answer,
      });
    });

    // --- WORKSPACE LOGIC ---
    socket.on("workspace:join", async () => {
      try {
        console.log(`[WORKSPACE] Processing workspace:join for user ${userId}`);
        const orgId = (socket as any).orgId;
        const userDoc = await User.findById(userId).select("name email profilePicture guest organizations").lean();
        if (!userDoc) {
          console.error(`[WORKSPACE] User ${userId} not found in database`);
          return;
        }

        // Determine if user is a guest for this organization
        let isGuest = userDoc.guest || false;
        if (orgId && userDoc.organizations && Array.isArray(userDoc.organizations)) {
          const orgMembership = userDoc.organizations.find(
            (org: any) => org.organization?.toString() === orgId
          );
          if (orgMembership) {
            isGuest = orgMembership.guest || false;
          }
        }

        // Clean up any stale presence from previous session first
        const existingUser = await getWorkspaceUser(userId);
        if (existingUser) {
          console.log(`[WORKSPACE] Cleaning up stale presence for user ${userId} before joining`);
          await removeWorkspaceUser(userId);
        }

        // CRITICAL FIX: Join workspace room and add small delay to ensure completion
        // This prevents the race condition where Redis pub/sub broadcasts before socket is in room
        console.log(`[WORKSPACE] About to join workspace room for user ${userId}`);
        await socket.join("workspace");
        console.log(`[WORKSPACE] User ${userId} joined workspace room (confirmed)`);

        // Get all workspace users (from Redis or in-memory)
        const allUsers = await getAllWorkspaceUsers();
        console.log(`[WORKSPACE] Emitting workspace:users to ${userId}, count: ${allUsers.length}`);
        socket.emit("workspace:users", allUsers);

        const newUser: WorkspaceUser = {
          id: userId,
          name: userDoc.name || "",
          email: userDoc.email as string,
          profilePicture: userDoc.profilePicture || undefined,
          spaceId: "lobby",
          status: "available",
          isScreenSharing: false,
          isRecording: false,
          guest: isGuest,
        };

        // Add user to workspace (Redis or in-memory)
        // This will trigger Redis pub/sub broadcast ("user-joined") to all users in "workspace" room
        // NOW SAFE: Room join is guaranteed to be complete before this executes
        await addWorkspaceUser(userId, newUser);

        // Check if Redis is available and log
        const redisAvailable = isRedisAvailable();
        console.log(`[WORKSPACE] Redis available: ${redisAvailable}`);

        if (!redisAvailable) {
          // If Redis is NOT available, manually broadcast to in-memory users
          console.log(`[WORKSPACE] Broadcasting user-joined via in-memory to workspace room`);
          socket.to("workspace").emit("workspace:user-joined", newUser);
        } else {
          // Redis pub/sub will handle the broadcast
          console.log(`[WORKSPACE] Redis pub/sub will broadcast user-joined event`);
        }

        // Send confirmation to the joining user that they're successfully online
        console.log(`[WORKSPACE] About to emit workspace:join-confirmed to ${userId}`);
        socket.emit("workspace:join-confirmed", {
          success: true,
          user: newUser,
          timestamp: Date.now()
        });

        console.log(`[WORKSPACE] User ${userId} successfully joined and broadcasted, confirmation sent`);
      } catch (error) {
        console.error(`[WORKSPACE] Error in workspace:join handler for user ${userId}:`, error);
        // Send error confirmation to client
        socket.emit("workspace:join-confirmed", {
          success: false,
          error: "Failed to join workspace",
          timestamp: Date.now()
        });
      }
    });

    // === CALL STATE MANAGEMENT EVENTS ===

    // Check call state (for app resume / page refresh)
    socket.on(
      "call:check-state",
      async (
        data: { channelName?: string },
        callback: (response: any) => void
      ) => {
        try {
          const currentCall = await callStateService.getUserCurrentCall(userId);
          const isInRequestedCall = data.channelName
            ? await callStateService.isUserInCall(data.channelName, userId)
            : false;

          const response = {
            success: true,
            currentCall,
            isInRequestedCall,
            canJoin: !currentCall || currentCall === data.channelName,
          };

          console.log(`[CALL-STATE] Check state for ${userId}:`, response);

          if (typeof callback === "function") {
            callback(response);
          }
        } catch (error) {
          console.error("[CALL-STATE] Error checking state:", error);
          if (typeof callback === "function") {
            callback({ success: false, currentCall: null, canJoin: true });
          }
        }
      }
    );

    // Explicit leave call
    socket.on("call:leave", async (data: { channelName: string }) => {
      try {
        await callStateService.leaveCall(data.channelName, userId);
        console.log(
          `[CALL-STATE] User ${userId} explicitly left call ${data.channelName}`
        );
      } catch (error) {
        console.error("[CALL-STATE] Error leaving call:", error);
      }
    });

    // The mobile/web clients emit `livekit:leave-call` when they leave a knock
    // call — including on a FAILED LiveKit connect (e.g. the iOS audio-session
    // error). Previously nothing handled it, so the failed call's slot leaked in
    // callStateService and the NEXT knock got a bogus "already answered on
    // another device". Free the user's current call slot here so state never
    // goes stale. (forceRejoin on accept is the backstop; this is the source fix.)
    socket.on("livekit:leave-call", async () => {
      try {
        const currentCall = await callStateService.getUserCurrentCall(userId);
        if (currentCall) {
          await callStateService.leaveCall(currentCall, userId);
          console.log(
            `[CALL-STATE] User ${userId} left call ${currentCall} via livekit:leave-call`
          );
        }
      } catch (error) {
        console.error("[CALL-STATE] Error handling livekit:leave-call:", error);
      }
    });

    // === END CALL STATE MANAGEMENT EVENTS ===

    socket.on("workspace:leave", async () => {
      console.log(`[WORKSPACE] User ${userId} leaving workspace explicitly`);

      const user = await getWorkspaceUser(userId);
      if (user) {
        // Clean up LiveKit room tracking if user was in a meeting
        if (user.spaceId && livekitRoomUsers.has(user.spaceId)) {
          const roomUsers = livekitRoomUsers.get(user.spaceId)!;
          roomUsers.delete(userId);

          // If there are still users in the meeting, broadcast updated participants
          if (roomUsers.size > 0) {
            const allWorkspaceUsers = await getAllWorkspaceUsers();
            const participants = allWorkspaceUsers
              .filter((u) => u.spaceId === user.spaceId)
              .map((u) => ({
                userId: u.id,
                name: u.name,
                email: u.email,
              }));

            // Broadcast to remaining users
            participants.forEach((p) => {
              io.to(`user:${p.userId}`).emit("livekit:participants-update", {
                channel: user.spaceId,
                participants,
              });
            });

            console.log(
              `[LIVEKIT] Broadcasted participant update after user ${userId} left ${user.spaceId}`
            );
          } else {
            // No more users, delete the room tracking and clean up the LiveKit room
            livekitRoomUsers.delete(user.spaceId);
            deleteRoom(toLivekitRoomName(user.spaceId)).catch((err) =>
              console.error(`[LIVEKIT] Failed to delete room ${user.spaceId}:`, err)
            );
          }
        }

        // Clean up knock call room if user was in a private knock call
        if (
          user.spaceId &&
          !user.spaceId.startsWith("floor-meeting:") &&
          !user.spaceId.startsWith("booking:") &&
          !user.spaceId.startsWith("event:") &&
          !user.spaceId.startsWith("community-stream:") &&
          user.spaceId !== "lobby"
        ) {
          const allWorkspaceUsers = await getAllWorkspaceUsers();
          const usersStillInRoom = allWorkspaceUsers.filter(
            (u) => u.spaceId === user.spaceId && u.id !== userId
          );
          if (usersStillInRoom.length === 0) {
            const knockRoomName = `private-room-${user.spaceId}`;
            deleteRoom(knockRoomName).catch((err) =>
              console.error(`[LIVEKIT] Failed to delete knock room ${knockRoomName}:`, err)
            );
          }
        }

        // Remove from workspace storage (Redis or in-memory)
        await removeWorkspaceUser(userId);

        // Leave the workspace room
        socket.leave("workspace");

        // Broadcast removed immediately (Redis pub/sub will handle if available)
        if (!isRedisAvailable()) {
          io.to("workspace").emit("workspace:user-left", { id: userId });
        }

        console.log(`[WORKSPACE] User ${userId} removed from workspace successfully`);
      }
    });

    // Heartbeat handler to keep presence alive
    socket.on("workspace:heartbeat", async () => {
      // Same trigger as the presence TTL refresh — piggyback the
      // `lastSeenAt` write so we don't need a separate timer. Throttled
      // internally to one Mongo write per minute per user.
      touchLastSeen(userId);

      const userExists = await presenceService.userExists(userId);

      if (userExists) {
        if (isRedisAvailable()) {
          await presenceService.refreshUser(userId);
        }
        // Send acknowledgment with presence confirmed
        socket.emit("workspace:heartbeat-ack", {
          timestamp: Date.now(),
          presenceValid: true,
          userId
        });
        console.log(`[WORKSPACE] Heartbeat received from user ${userId}, TTL refreshed`);
      } else {
        // User's presence has expired - tell client they need to rejoin
        socket.emit("workspace:heartbeat-ack", {
          timestamp: Date.now(),
          presenceValid: false,
          userId,
          reason: "presence_expired"
        });
        console.log(`[WORKSPACE] Heartbeat from user ${userId} - presence expired, needs rejoin`);
      }
    });

    // Request full presence reconciliation (self-healing)
    socket.on("workspace:request-sync", async () => {
      const allUsers = await getAllWorkspaceUsers();
      const selfPresence = await getWorkspaceUser(userId);
      socket.emit("workspace:full-sync", {
        users: allUsers,
        selfPresenceValid: !!selfPresence,
        selfPresence: selfPresence || null,
        timestamp: Date.now()
      });
      console.log(`[WORKSPACE] Full presence sync sent to user ${userId}, selfPresenceValid: ${!!selfPresence}`);
    });

    // Check own presence status (called when tab becomes visible)
    socket.on("workspace:check-presence", async (_, ack) => {
      const selfPresence = await getWorkspaceUser(userId);
      const isInWorkspaceRoom = socket.rooms.has("workspace");

      const response = {
        presenceValid: !!selfPresence,
        inWorkspaceRoom: isInWorkspaceRoom,
        presence: selfPresence || null,
        timestamp: Date.now()
      };

      console.log(`[WORKSPACE] Presence check for user ${userId}: valid=${!!selfPresence}, inRoom=${isInWorkspaceRoom}`);

      // Use acknowledgment if provided, otherwise emit event
      if (typeof ack === 'function') {
        ack(response);
      } else {
        socket.emit("workspace:presence-status", response);
      }
    });

    // Rejoin workspace after presence expired (called when tab becomes visible and presence is stale)
    // This is similar to workspace:join but designed for seamless reconnection
    socket.on("workspace:rejoin", async (_, ack) => {
      try {
        console.log(`[WORKSPACE] Processing workspace:rejoin for user ${userId}`);
        const orgId = (socket as any).orgId;
        const userDoc = await User.findById(userId).select("name email profilePicture guest organizations").lean();
        if (!userDoc) {
          console.error(`[WORKSPACE] Rejoin failed - User ${userId} not found in database`);
          const errorResponse = { success: false, error: "User not found" };
          if (typeof ack === 'function') ack(errorResponse);
          else socket.emit("workspace:rejoin-result", errorResponse);
          return;
        }

        // Determine if user is a guest for this organization
        let isGuest = userDoc.guest || false;
        if (orgId && userDoc.organizations && Array.isArray(userDoc.organizations)) {
          const orgMembership = userDoc.organizations.find(
            (org: any) => org.organization?.toString() === orgId
          );
          if (orgMembership) {
            isGuest = orgMembership.guest || false;
          }
        }

        // Clean up any stale presence from previous session first
        const existingUser = await getWorkspaceUser(userId);
        if (existingUser) {
          console.log(`[WORKSPACE] Cleaning up stale presence for user ${userId} before rejoin`);
          await removeWorkspaceUser(userId);
        }

        // Ensure socket is in workspace room
        if (!socket.rooms.has("workspace")) {
          await socket.join("workspace");
          console.log(`[WORKSPACE] User ${userId} rejoined workspace room`);
        }

        // Get all workspace users
        const allUsers = await getAllWorkspaceUsers();

        const newUser: WorkspaceUser = {
          id: userId,
          name: userDoc.name || "",
          email: userDoc.email as string,
          profilePicture: userDoc.profilePicture || undefined,
          spaceId: "lobby", // Always rejoin to lobby
          status: "available",
          isScreenSharing: false,
          isRecording: false,
          guest: isGuest,
        };

        // Add user to workspace (publishes "user-joined" event via Redis)
        await addWorkspaceUser(userId, newUser);

        // Broadcast to other users (only needed if Redis is NOT available)
        if (!isRedisAvailable()) {
          socket.to("workspace").emit("workspace:user-joined", newUser);
        }

        const successResponse = {
          success: true,
          user: newUser,
          users: allUsers,
          timestamp: Date.now()
        };

        // Send response
        if (typeof ack === 'function') {
          ack(successResponse);
        } else {
          socket.emit("workspace:rejoin-result", successResponse);
        }

        // Also send confirmation event
        socket.emit("workspace:join-confirmed", {
          success: true,
          user: newUser,
          isRejoin: true,
          timestamp: Date.now()
        });

        console.log(`[WORKSPACE] User ${userId} successfully rejoined workspace`);
      } catch (error) {
        console.error(`[WORKSPACE] Error in workspace:rejoin handler for user ${userId}:`, error);
        const errorResponse = { success: false, error: "Failed to rejoin workspace" };
        if (typeof ack === 'function') ack(errorResponse);
        else socket.emit("workspace:rejoin-result", errorResponse);
      }
    });

    socket.on("workspace:move-to-space", async ({ spaceId }: { spaceId: string }) => {
      console.log(`[WORKSPACE] User ${userId} attempting to move to space: ${spaceId}`);
      const user = await getWorkspaceUser(userId);
      if (user) {
        const wasScreenSharing = !!user.isScreenSharing;
        const previousSpaceId = user.spaceId;

        // Update space using dedicated method (publishes "user-moved-space" via Redis)
        await updateWorkspaceUserSpace(userId, spaceId);

        // If user was screen sharing, also update that state
        if (wasScreenSharing) {
          await updateWorkspaceUserScreenShare(userId, false);
        }

        // Only emit directly if Redis is NOT available (fallback mode)
        if (!isRedisAvailable()) {
          io.to("workspace").emit("workspace:user-moved-space", {
            userId,
            spaceId,
          });
          if (wasScreenSharing) {
            io.to("workspace").emit("workspace:screen-share-state", {
              userId,
              isSharing: false,
            });
          }
        }

        // Always emit livekit-specific event (not part of Redis pub/sub)
        if (wasScreenSharing) {
          io.to("workspace").emit("livekit:screen-share-state", {
            userId,
            isSharing: false,
          });
        }

        // --- LIVEKIT: Floor Meeting, Booking Meeting, Event Meeting, HQ Room & Community Stream Support ---
        const isFloorMeeting = spaceId.startsWith("floor-meeting:");
        const isBookingMeeting = spaceId.startsWith("booking:");
        const isEventMeeting = spaceId.startsWith("event:");
        const isCommunityStream = spaceId.startsWith("community-stream:");
        const isHqRoom = spaceId.startsWith("hq-room:");
        const isLeavingMeeting =
          (previousSpaceId?.startsWith("floor-meeting:") ||
            previousSpaceId?.startsWith("booking:") ||
            previousSpaceId?.startsWith("event:") ||
            previousSpaceId?.startsWith("community-stream:") ||
            previousSpaceId?.startsWith("hq-room:")) &&
          spaceId === "lobby";

        // Also detect leaving a knock call (previousSpaceId is a userId, not a meeting prefix)
        const isLeavingKnockCall =
          previousSpaceId &&
          previousSpaceId !== "lobby" &&
          !previousSpaceId.startsWith("floor-meeting:") &&
          !previousSpaceId.startsWith("booking:") &&
          !previousSpaceId.startsWith("event:") &&
          !previousSpaceId.startsWith("community-stream:") &&
          !previousSpaceId.startsWith("hq-room:") &&
          spaceId === "lobby";

        // Clean up knock call state when moving to lobby
        if (isLeavingKnockCall && previousSpaceId) {
          const knockChannel = `private-room-${previousSpaceId}`;
          await callStateService.leaveCall(knockChannel, userId);
          // Also try with the user's own ID as the room host
          await callStateService.leaveCall(`private-room-${userId}`, userId);
          io.to(`user:${userId}`).emit("livekit:leave-call");
          console.log(
            `[LIVEKIT] User ${userId} left knock call (previousSpaceId=${previousSpaceId}), cleaned up call state`
          );
        }

        // If user is leaving a floor/booking meeting, emit leave-call event
        if (isLeavingMeeting) {
          io.to(`user:${userId}`).emit("livekit:leave-call");
          console.log(
            `[LIVEKIT] User ${userId} left meeting ${previousSpaceId}, emitting leave-call`
          );

          // Clean up community stream position when leaving
          if (previousSpaceId?.startsWith("community-stream:")) {
            const channelPositions = communityStreamPositions.get(previousSpaceId);
            if (channelPositions) {
              channelPositions.delete(userId);
              // Notify others in the channel
              io.to(previousSpaceId).emit("community-stream:user-left", { odId: userId });
              console.log(`[COMMUNITY-STREAM] Cleaned up position for ${userId} in ${previousSpaceId}`);
              // Clean up empty maps
              if (channelPositions.size === 0) {
                communityStreamPositions.delete(previousSpaceId);
              }
            }
            // Clean up cached channel on socket
            delete (socket as any).communityStreamChannel;
          }

          // Clean up call state in Redis/memory
          if (previousSpaceId) {
            await callStateService.leaveCall(previousSpaceId, userId);
            console.log(
              `[CALL-STATE] Cleaned up ${userId} from call ${previousSpaceId}`
            );

            // Also clean up call state for knock call room name format
            await callStateService.leaveCall(`private-room-${previousSpaceId}`, userId);
          }

          // Clean up LiveKit room for knock calls (spaceId is just the hostId, room name is private-room-{hostId})
          // Knock calls don't use livekitRoomUsers, so check if this was a knock call (spaceId is a plain userId, not a meeting prefix)
          if (
            previousSpaceId &&
            !previousSpaceId.startsWith("floor-meeting:") &&
            !previousSpaceId.startsWith("booking:") &&
            !previousSpaceId.startsWith("event:") &&
            !previousSpaceId.startsWith("community-stream:") &&
            !previousSpaceId.startsWith("hq-room:") &&
            previousSpaceId !== "lobby"
          ) {
            // This was likely a knock call — check if the other person has also left
            const allWorkspaceUsers = await getAllWorkspaceUsers();
            const usersStillInRoom = allWorkspaceUsers.filter(
              (u) => u.spaceId === previousSpaceId
            );
            if (usersStillInRoom.length === 0) {
              const knockRoomName = `private-room-${previousSpaceId}`;
              deleteRoom(knockRoomName).catch((err) =>
                console.error(`[LIVEKIT] Failed to delete knock room ${knockRoomName}:`, err)
              );
            }
          }

          // Clean up LiveKit room tracking for this user in the previous meeting
          if (previousSpaceId && livekitRoomUsers.has(previousSpaceId)) {
            const roomUsers = livekitRoomUsers.get(previousSpaceId)!;
            roomUsers.delete(userId);

            // If there are still users in the meeting, broadcast updated participants
            if (roomUsers.size > 0) {
              const allWorkspaceUsers = await getAllWorkspaceUsers();
              const participants = allWorkspaceUsers
                .filter((u) => u.spaceId === previousSpaceId)
                .map((u) => ({
                  userId: u.id,
                  name: u.name,
                  email: u.email,
                }));

              // Broadcast to remaining users
              participants.forEach((p) => {
                io.to(`user:${p.userId}`).emit("livekit:participants-update", {
                  channel: previousSpaceId,
                  participants,
                });
              });

              console.log(
                `[LIVEKIT] Broadcasted participant update after user ${userId} left ${previousSpaceId}`
              );
            } else {
              // No more users, delete the room tracking and clean up the LiveKit room
              livekitRoomUsers.delete(previousSpaceId);
              deleteRoom(toLivekitRoomName(previousSpaceId)).catch((err) =>
                console.error(`[LIVEKIT] Failed to delete room ${previousSpaceId}:`, err)
              );
            }
          }
        }

        // HQ Room access control + spaceId parse.
        //
        // Two shapes:
        //   • Legacy:  hq-room:<orgId>                       (one room per org)
        //   • Named:   hq-room:<orgId>:<conferenceRoomId>    (multi-room — see
        //                                                    src/models/conferenceRoom.model.ts)
        //
        // The previous code did spaceId.replace("hq-room:", "") which for the
        // named shape returned "<orgId>:<conferenceRoomId>" — passed straight to
        // new Types.ObjectId(), which throws BSONError, caught upstream as a
        // silent socket join failure. The frontend never received
        // livekit:join-error OR livekit:join-call, so its recovery effect
        // re-emitted workspace:move-to-space every 4 seconds in a tight loop.
        //
        // Parse properly + relax the booking-required check for named rooms.
        // Named rooms are drop-in joinable by any org member (the conference-
        // room CRUD already gates create on founder); the booking surface on
        // top of them is for scheduling visibility, not access control. The
        // legacy single-room behaviour (booking required) is preserved so
        // existing orgs that haven't migrated keep their schedule semantics.
        let hqOrgId: string = "";
        let hqConferenceRoomId: string | null = null;
        if (isHqRoom) {
          const rest = spaceId.slice("hq-room:".length);
          const colonIdx = rest.indexOf(":");
          if (colonIdx === -1) {
            hqOrgId = rest;
          } else {
            hqOrgId = rest.slice(0, colonIdx);
            hqConferenceRoomId = rest.slice(colonIdx + 1) || null;
          }

          // Only legacy single-room joins get gated on an active booking.
          // Named rooms skip the gate entirely; the founder created the
          // room, any org member can hop in.
          if (!hqConferenceRoomId) {
            const now = new Date();
            const { RoomBooking } = require("../models/roomBooking.model");
            const currentBooking = await RoomBooking.findOne({
              orgId: new (require("mongoose").Types.ObjectId)(hqOrgId),
              status: "active",
              startTime: { $lte: now },
              endTime: { $gte: now },
            }).lean();

            if (!currentBooking) {
              console.log(`[HQ-ROOM] No active booking for org ${hqOrgId}, rejecting join`);
              socket.emit("livekit:join-error", {
                error: "No active booking for this room right now.",
                spaceId,
              });
              await updateWorkspaceUserSpace(userId, "lobby");
              if (!isRedisAvailable()) {
                io.to("workspace").emit("workspace:user-moved-space", { userId, spaceId: "lobby" });
              }
              return;
            }

            const isInvited =
              currentBooking.creatorId.toString() === userId ||
              (currentBooking.invitedUserIds || []).some((id: any) => id.toString() === userId);

            if (!isInvited) {
              console.log(`[HQ-ROOM] User ${userId} not invited to current booking in org ${hqOrgId}`);
              socket.emit("livekit:join-error", {
                error: "You don't have access to this room during this time slot.",
                spaceId,
              });
              await updateWorkspaceUserSpace(userId, "lobby");
              if (!isRedisAvailable()) {
                io.to("workspace").emit("workspace:user-moved-space", { userId, spaceId: "lobby" });
              }
              return;
            }

            console.log(`[HQ-ROOM] User ${userId} authorized for booking ${currentBooking._id}`);
          } else {
            console.log(`[HQ-ROOM] Named room join (org ${hqOrgId}, room ${hqConferenceRoomId}) — booking gate skipped`);
          }
        }

        // If joining a floor meeting, booking meeting, event meeting, hq room, or community stream, set up LiveKit call
        if (isFloorMeeting || isBookingMeeting || isEventMeeting || isCommunityStream || isHqRoom) {
          const meetingType = isFloorMeeting ? 'floor' : isBookingMeeting ? 'booking' : isEventMeeting ? 'event' : isHqRoom ? 'hq-room' : 'community-stream';
          console.log(`[LIVEKIT] Detected ${meetingType} meeting join for spaceId: ${spaceId}`);
          const channelName = spaceId; // Use the spaceId as the channel name
          const livekitRoomName = toLivekitRoomName(spaceId);

          // Get all users currently in this meeting room (excluding the joining user)
          const allWorkspaceUsers = await getAllWorkspaceUsers();
          const existingOccupants = allWorkspaceUsers.filter(
            (u) => u.spaceId === spaceId && u.id !== userId
          );
          console.log(`[LIVEKIT] Existing occupants in ${channelName}: ${existingOccupants.length}`);

          // Fetch user name. LiveKit auto-creates rooms when the first participant joins,
          // so explicit createRoom() is not required (matches contact-backend pattern).
          const userDoc = await User.findById(userId).select("name").lean();
          const joiningUserName = (userDoc as any)?.name || "";
          const room = { name: livekitRoomName };

          // Determine isOwner based on call type:
          // - Floor: no owner (all equal)
          // - Booking: founder is owner
          // - Event: creator is owner
          // - Community stream: no owner
          // Recording is room-level (any participant can call startRecording),
          // frontend enforces who can start/stop via recordingStartedByMe logic.
          let isOwner = false;
          if (isBookingMeeting) {
            const bookingId = spaceId.replace("booking:", "");
            try {
              const booking = await CallBooking.findById(bookingId).select("founderId").lean();
              if (booking && (booking as any).founderId?.toString() === userId) {
                isOwner = true;
              }
            } catch (e) {
              console.warn(`[LIVEKIT] Could not look up booking ${bookingId}:`, e);
            }
          } else if (isEventMeeting) {
            const eventId = spaceId.replace("event:", "");
            try {
              const event = await Event.findById(eventId).select("creatorId").lean();
              if (event && (event as any).creatorId?.toString() === userId) {
                isOwner = true;
              }
            } catch (e) {
              console.warn(`[LIVEKIT] Could not look up event ${eventId}:`, e);
            }
          } else if (isHqRoom) {
            // Reuse the orgId/roomId parsed by the access-control block
            // above. For the legacy single-room shape ownership is the
            // booking creator; for a named room the founder who created
            // the ConferenceRoom row owns it. Falling back to the
            // legacy booking lookup when no roomId is present keeps the
            // existing behaviour intact.
            try {
              if (hqConferenceRoomId) {
                const { ConferenceRoom } = require("../models/conferenceRoom.model");
                const room = await ConferenceRoom.findById(hqConferenceRoomId)
                  .select("createdBy")
                  .lean();
                if (room && (room as any).createdBy?.toString() === userId) {
                  isOwner = true;
                }
              } else {
                const { RoomBooking } = require("../models/roomBooking.model");
                const now = new Date();
                const booking = await RoomBooking.findOne({
                  orgId: new (require("mongoose").Types.ObjectId)(hqOrgId),
                  status: "active",
                  startTime: { $lte: now },
                  endTime: { $gte: now },
                }).select("creatorId").lean();
                if (booking && (booking as any).creatorId?.toString() === userId) {
                  isOwner = true;
                }
              }
            } catch (e) {
              console.warn(`[LIVEKIT] Could not look up hq-room owner for ${spaceId}:`, e);
            }
          }

          // Access-control policy: for conference (hq-room) joins, honour the
          // host's pre-join settings. Non-hosts get a token whose
          // canPublishSources allowlist reflects the policy — locked-down mic
          // means the participant can't even press "unmute" client-side until
          // the host approves their request (setParticipantPublishSources).
          // Host always gets an unrestricted token.
          let joinerSources: ReturnType<typeof policyToSources> = null;
          if (isHqRoom && !isOwner) {
            joinerSources = policyToSources(getConferencePolicy(room.name));
          }

          const joiningUserToken = await createParticipantToken(room.name, {
            userId,
            userName: joiningUserName,
            isOwner: isOwner || undefined,
            ...(joinerSources ? { canPublishSources: joinerSources } : {}),
          });
          if (!joiningUserToken) {
            console.error(`[LIVEKIT] Failed to create participant token for user ${userId} in room ${room.name}`);
            socket.emit("livekit:join-error", {
              error: "Failed to generate meeting credentials. Please try again.",
              spaceId,
            });
            return;
          }
          console.log(`[LIVEKIT] Created room and token for user ${userId}: room=${room.name}, token=TOKEN_EXISTS`);

          // Set recording context so webhook can upload to correct org cabinet.
          // For the conference (hq-room) we tag recordingSource:"conference" so
          // the recordings list can find them; floor/knock recordings stay
          // untagged (unchanged behaviour).
          if (userOrgId) {
            setRecordingContext(room.name, {
              organizationId: userOrgId,
              // Clean name for the conference recording file; non-hq rooms keep
              // their existing "<type>-<spaceId>" title (unchanged).
              meetingTitle: isHqRoom ? "Conference Call" : `${meetingType}-${spaceId}`,
              userId,
              spaceId: channelName,
              ...(isHqRoom ? { recordingSource: "conference" } : {}),
            });
          }

          // Auto-attach the note-taker when the conference OWNER joins (opt-out
          // model). Fire-and-forget; never blocks the join.
          if (isHqRoom && isOwner && userOrgId) {
            ensureConferenceNoteTaker(io, channelName, userOrgId, userId).catch((err) =>
              console.error("[Conference] note-taker dispatch failed:", err?.message ?? err)
            );
          }

          // Track user in the room
          if (!livekitRoomUsers.has(channelName)) {
            livekitRoomUsers.set(channelName, new Set());
          }
          livekitRoomUsers.get(channelName)!.add(userId);

          // Build participants list for all users in the meeting
          const participants = allWorkspaceUsers
            .filter((u) => u.spaceId === spaceId)
            .map((u) => ({
              userId: u.id,
              name: u.name,
              email: u.email,
              isScreenSharing: !!u.isScreenSharing,
            }));

          console.log(
            `[LIVEKIT] Channel ${channelName} participants:`,
            participants
          );

          // Join the event channel room so internal user can receive guest join broadcasts
          if (isEventMeeting) {
            socket.join(channelName);
            console.log(`[LIVEKIT] Internal user socket joined event room: ${channelName}`);
          }

          // === MULTI-DEVICE CHECK ===
          const deviceType = getDeviceType(socket);
          let joinResult = await callStateService.tryJoinCall(
            channelName,
            userId,
            socket.id,
            deviceType
          );

          if (!joinResult.allowed) {
            // Check if the existing socket is still active
            // A socket is stale if: disconnected from io, OR no longer in userSocketConnections
            // (handles page reload race where new socket connects before old disconnect fires)
            if (joinResult.existingSocketId) {
              const existingSocket = io.sockets.sockets.get(joinResult.existingSocketId);
              const existingSocketInUserConns = userSocketConnections.get(userId)?.has(joinResult.existingSocketId) ?? false;
              const isStale = !existingSocket || !existingSocket.connected || !existingSocketInUserConns;

              if (isStale) {
                console.log(
                  `[LIVEKIT] Existing socket ${joinResult.existingSocketId} is stale (connected=${existingSocket?.connected}, inUserConns=${existingSocketInUserConns}), cleaning up for ${userId}`
                );
                await callStateService.leaveCall(channelName, userId);
                joinResult = await callStateService.tryJoinCall(
                  channelName,
                  userId,
                  socket.id,
                  deviceType
                );
              }
            }

            // If still not allowed after cleanup, block the join
            if (!joinResult.allowed) {
              socket.emit("livekit:call-answered-elsewhere", {
                channel: channelName,
                answeredOn: joinResult.existingDevice || "another device",
                message: "You're already in this call on another device",
              });
              console.log(
                `[LIVEKIT] Blocked ${userId} from ${channelName} - already on ${joinResult.existingDevice}`
              );
              return; // Don't proceed with join
            }
          }

          // Notify OTHER devices that THIS device is joining the call
          notifyCallAnsweredElsewhere(userId, socket.id, channelName, deviceType);
          // === END MULTI-DEVICE CHECK ===

          if (existingOccupants.length > 0) {
            // Someone is already in the meeting - join existing call
            console.log(`[LIVEKIT] Emitting livekit:join-call to user ${userId} for channel ${channelName}`);
            // Use socket.emit() to send to THIS socket only, not all user sockets
            socket.emit("livekit:join-call", {
              serverUrl: getLivekitUrl(),
              roomName: room.name,
              channel: channelName,
              token: joiningUserToken,
              meetingType: meetingType,
              participants,
              isOwner: isOwner || false,
              ...(isHqRoom ? { policy: getConferencePolicy(room.name) || { allowUnmute: true, allowPresent: true } } : {}),
            });
            console.log(`[LIVEKIT] Emitted livekit:join-call with ${participants.length} participants`);

            // IMPORTANT: Also broadcast updated participants list to everyone already in the meeting
            existingOccupants.forEach((occupant) => {
              io.to(`user:${occupant.id}`).emit("livekit:participants-update", {
                channel: channelName,
                participants,
              });
            });

            // For event meetings, also broadcast to the event channel room
            // This ensures guests (who aren't tracked as workspace occupants) receive the update
            if (isEventMeeting) {
              io.to(channelName).emit("livekit:participants-update", {
                channel: channelName,
                participants,
              });
              console.log(`[LIVEKIT] Broadcast participants-update to event channel ${channelName} for guests`);
            }

            console.log(
              `[LIVEKIT] User ${userId} joining existing meeting ${channelName} with ${existingOccupants.length} participants. Broadcasted participant update to existing users.`
            );
          } else {
            // First person in the meeting - init call
            console.log(`[LIVEKIT] Emitting livekit:init-call to user ${userId} for channel ${channelName} (first person)`);
            console.log(`[LIVEKIT] Call data:`, {
              serverUrl: getLivekitUrl(),
              roomName: room.name,
              channel: channelName,
              meetingType: meetingType,
              participantsCount: participants.length
            });
            // Use socket.emit() to send to THIS socket only, not all user sockets
            socket.emit("livekit:init-call", {
              serverUrl: getLivekitUrl(),
              roomName: room.name,
              channel: channelName,
              token: joiningUserToken,
              meetingType: meetingType,
              participants,
              isOwner: isOwner || false,
              ...(isHqRoom ? { policy: getConferencePolicy(room.name) || { allowUnmute: true, allowPresent: true } } : {}),
            });

            // For event meetings, also broadcast to the event channel room for any guests already there
            if (isEventMeeting) {
              io.to(channelName).emit("livekit:participants-update", {
                channel: channelName,
                participants,
              });
              console.log(`[LIVEKIT] Broadcast participants-update to event channel ${channelName} for guests`);
            }

            console.log(
              `[LIVEKIT] User ${userId} is first in meeting ${channelName}, init-call emitted successfully`
            );
          }

          // Community Stream: Send existing positions to newly joined user
          if (isCommunityStream && communityStreamPositions.has(channelName)) {
            const channelPositions = communityStreamPositions.get(channelName)!;
            const positions = Array.from(channelPositions.entries()).map(([odId, pos]) => ({
              odId,
              x: pos.x,
              y: pos.y,
            }));
            socket.emit("community-stream:positions-sync", { positions });
            console.log(`[COMMUNITY-STREAM] Sent ${positions.length} existing positions to user ${userId}`);
          }

          // Community Stream: Join the channel room for position broadcasts and store spaceId on socket
          if (isCommunityStream) {
            socket.join(channelName);
            (socket as any).communityStreamChannel = channelName; // Store for quick access in position updates
            console.log(`[COMMUNITY-STREAM] User ${userId} joined room ${channelName}`);
          }
        }
      }
    });

    // Community Stream Position Events
    socket.on("community-stream:position-update", (data: { x: number; y: number }) => {
      // Use cached channel from socket (set when joining community stream)
      const spaceId = (socket as any).communityStreamChannel as string | undefined;
      if (!spaceId?.startsWith("community-stream:")) return;

      // Get or create position map for this channel
      if (!communityStreamPositions.has(spaceId)) {
        communityStreamPositions.set(spaceId, new Map());
      }
      const channelPositions = communityStreamPositions.get(spaceId)!;

      // Update position
      channelPositions.set(userId, { x: data.x, y: data.y });

      // Broadcast to all others in the same channel
      socket.to(spaceId).emit("community-stream:position-changed", {
        odId: userId,
        x: data.x,
        y: data.y,
      });
    });

    socket.on(
      "workspace:recording-state",
      async ({ isRecording }: { isRecording: boolean }) => {
        const user = await getWorkspaceUser(userId);
        if (user) {
          // Update recording state using dedicated method (publishes "user-recording-changed" via Redis)
          await updateWorkspaceUserRecording(userId, isRecording);

          // Broadcast only if Redis is NOT available (fallback mode)
          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-recording-changed", {
              userId,
              isRecording,
            });
          }
        }
      }
    );

    // --- STATUS CHANGE HANDLER ---
    socket.on(
      "workspace:status-change",
      async ({ status }: { status: "available" | "busy" | "afk" | "mobile" }) => {
        const user = await getWorkspaceUser(userId);
        if (user) {
          // Update status using dedicated method (publishes "user-status-changed" via Redis)
          await updateWorkspaceUserStatus(userId, status);

          // Broadcast only if Redis is NOT available (fallback mode)
          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-status-changed", {
              userId,
              status,
            });
          }
        }
      }
    );

    socket.on(
      "workspace:signal",
      (payload: { to: string; from: string; signal: any }) => {
        // Signal directly to the user's personal room for reliability
        io.to(`user:${payload.to}`).emit("workspace:signal", payload);
      }
    );

    socket.on(
      "workspace:screen-share-state",
      async ({ isSharing }: { isSharing: boolean }) => {
        const user = await getWorkspaceUser(userId);
        if (!user) return;

        // Update screen share state using dedicated method (publishes "screen-share-state" via Redis)
        await updateWorkspaceUserScreenShare(userId, isSharing);

        // Broadcast only if Redis is NOT available (fallback mode)
        if (!isRedisAvailable()) {
          io.to("workspace").emit("workspace:screen-share-state", {
            userId,
            isSharing,
          });
        }
      }
    );

    // --- LIVEKIT SCREEN SHARE STATE ---
    socket.on(
      "livekit:screen-share-state",
      async ({ isSharing }: { isSharing: boolean }) => {
        // Update user's screen share state in storage (important for late joiners)
        const user = await getWorkspaceUser(userId);
        if (user) {
          await updateWorkspaceUserScreenShare(userId, isSharing);

          // If user is in an event meeting, broadcast to the event channel
          // This ensures guests (who aren't in workspace room) receive the update
          if (user.spaceId?.startsWith("event:")) {
            const channelName = user.spaceId;

            // Broadcast screen share state to event channel
            io.to(channelName).emit("livekit:screen-share-state", {
              userId,
              isSharing,
            });
            console.log(`[LIVEKIT] Broadcast screen share state to event channel: ${channelName}`);

            // Also send full participants update with current screen share states
            try {
              const { EventGuest } = require("../models/eventGuest.model");
              const eventId = channelName.replace("event:", "");

              // Get all workspace users with FRESH data
              const allWorkspaceUsers = await getAllWorkspaceUsers();

              // Get internal participants with current screen share state
              const internalParticipants = allWorkspaceUsers
                .filter((u) => u.spaceId === channelName)
                .map((u) => ({
                  userId: u.id,
                  name: u.name,
                  email: u.email,
                  isGuest: false,
                  isScreenSharing: !!u.isScreenSharing,
                }));

              // Get guests (they can't screen share)
              const guests = await EventGuest.find({ eventId, leftAt: null }).lean();
              const guestParticipants = (guests as any[]).map((g: any) => ({
                userId: g._id.toString(),
                name: g.displayName,
                email: g.email,
                isGuest: true,
                isScreenSharing: false,
              }));

              const allParticipants = [...internalParticipants, ...guestParticipants];

              // Broadcast full participant update to ensure consistency
              io.to(channelName).emit("livekit:participants-update", {
                channel: channelName,
                participants: allParticipants,
              });
              console.log(`[LIVEKIT] Broadcast participants-update to event channel with ${allParticipants.length} participants`);
            } catch (error) {
              console.error(`[LIVEKIT] Error broadcasting participants update for event:`, error);
            }
          }
        }

        // Always broadcast livekit-specific event to workspace room for internal users
        io.to("workspace").emit("livekit:screen-share-state", {
          userId,
          isSharing,
        });
        console.log(`[LIVEKIT] User ${userId} screen share state: ${isSharing}`);
      }
    );

    // --- IMPROVED: Knock Queue Management ---
    // Rate limiting check
    const checkRateLimit = (knockerId: string): boolean => {
      const now = Date.now();
      const limitData = knockRateLimits.get(knockerId);

      if (!limitData || now - limitData.windowStart > 60000) {
        // New window or expired window
        knockRateLimits.set(knockerId, { count: 1, windowStart: now });
        return true;
      }

      if (limitData.count >= KNOCK_RATE_LIMIT) {
        return false; // Rate limit exceeded
      }

      limitData.count++;
      return true;
    };

    // Process knock queue for a target user.
    //
    // A knock is delivered to anyone *reachable* — whether their app is in the
    // foreground (live socket) OR backgrounded/terminated but still logged in
    // with a registered push/VoIP token. The three transports below cover both:
    //   • socket emit  → reaches a live foreground app (in-app knock screen)
    //   • VoIP push    → wakes a backgrounded/killed iOS app to ring via CallKit
    //   • FCM push     → wakes a backgrounded/killed Android app to ring
    // We no longer gate on live workspace presence; that was silently dropping
    // every knock to a backgrounded phone before any push could be sent.
    const processKnockQueue = async (targetId: string) => {
      const queue = knockQueues.get(targetId);
      if (!queue || queue.length === 0) {
        return;
      }

      const knock = queue.shift()!;

      // Don't double-process an in-flight knock from the same user.
      const activeSet = activeKnocks.get(targetId) || new Set();
      if (!activeSet.has(knock.from)) {
        activeSet.add(knock.from);
        activeKnocks.set(targetId, activeSet);

        // Current presence — may be null if the target's app is backgrounded.
        // Used only to tag the notification's space; delivery does not depend on it.
        const targetUser = await getWorkspaceUser(targetId);

        // Get knocker info for notifications
        const knocker = await User.findById(knock.from)
          .select("name email profilePicture")
          .lean();

        // Create UserNotification for the knock — Garage HQ's notification
        // list; NetworkChains has no such list, so its calls skip it.
        if (knock.app === "garage") {
          try {
            await UserNotification.create({
              userId: new Types.ObjectId(targetId),
              orgId: userOrgId ? new Types.ObjectId(userOrgId) : undefined,
              type: "knock",
              knockFrom: new Types.ObjectId(knock.from),
              knockFromName: knocker?.name,
              knockFromEmail: knocker?.email,
              knockFromPicture: knocker?.profilePicture,
              knockSpaceId: targetUser?.spaceId,
              read: false,
              cleared: false,
            });
          } catch (notifError) {
            console.error(
              `Failed to create UserNotification for knock from ${knock.from} to ${targetId}:`,
              notifError
            );
          }
        }

        // Emit knock request to ALL of the target's live sockets (web AND
        // mobile) — every logged-in device should ring; whichever one answers
        // first wins, and the rest are dismissed via `workspace:knock-handled`.
        //
        // Only the calling app's sockets, though (see callRoom).
        io.to(callRoom(knock.app, targetId)).emit("workspace:knock-request", {
          from: knock.from,
          fromName: knock.fromName,
          fromProfilePicture: knocker?.profilePicture,
        });

        // Native ring pushes are sent PER DEVICE: any device whose deviceId
        // currently has a live socket is skipped (it already got the in-app
        // `workspace:knock-request` above; a push there would force a
        // CallKit/Telecom ring on top of the in-app UI — the dual-UI bug). Every
        // OTHER registered device (backgrounded/killed, no live socket) still
        // rings — so a knock reaches all devices even when one is in the
        // foreground. Legacy tokens with no deviceId fall back to the old
        // all-or-nothing gate to avoid double-ringing.
        const targetHasLiveMobileSocket = hasLiveMobileSocket(targetId);
        const connectedMobileDeviceIds = getConnectedMobileDeviceIds(targetId);
        const pushTargeting = {
          excludeDeviceIds: connectedMobileDeviceIds,
          allowLegacyTokens: !targetHasLiveMobileSocket,
          app: knock.app,
        };

        // Record delivery state. `pushRung` starts false and is flipped true
        // once a native push actually goes out, so resolving the knock only
        // sends a cancel push when something is really ringing.
        const delivery: KnockDeliveryState = {
          socketId: knock.socketId,
          pushRung: false,
          p2p: knock.p2p,
          app: knock.app,
        };
        knockDeliveries.set(knockDeliveryKey(targetId, knock.from), delivery);

        // VoIP push for iOS devices (CallKit) — rings even when terminated.
        sendKnockVoIPPush(
          targetId,
          knock.from,
          knock.fromName,
          knocker?.profilePicture || undefined,
          pushTargeting
        )
          .then((r) => {
            if (r.sent > 0) delivery.pushRung = true;
          })
          .catch((err) => console.error("[VOIP] Knock VoIP push error:", err));

        // Direct FCM data-only push for Android — wakes our custom
        // FirebaseMessagingService so the full-screen incoming-call UI shows
        // even when the app is killed / phone locked. Garage HQ's app only.
        if (knock.app === "garage") sendKnockFCMPush(
          targetId,
          {
            knockerId: knock.from,
            knockerName: knock.fromName,
            knockerProfilePicture: knocker?.profilePicture || undefined,
            hasVideo: false,
          },
          pushTargeting
        )
          .then((r) => {
            if (r.sent > 0) delivery.pushRung = true;
          })
          .catch((err) => console.error("[FCM] Knock FCM push error:", err));

        // Expo push is only a fallback banner (no forced ring), so keep the
        // simple gate: only when the target has no live mobile socket at all.
        if (knock.app === "garage" && !targetHasLiveMobileSocket) {
          sendKnockPushNotification(targetId, knock.from, knock.fromName).catch(
            (err) => console.error("[PUSH] Knock notification error:", err)
          );
        }

        // NetworkChains rings its own way: a full-screen incoming call
        // (Android) or CallKit via the VoIP push above (iOS) on builds with
        // native call UI, a notification otherwise. Per device, like the ring
        // pushes above: a device with the app open got the socket event.
        if (knock.app === "networkchain") sendNetworkchainCallPush(
          targetId,
          {
            id: knock.from,
            name: knock.fromName,
            picture: knocker?.profilePicture || undefined,
          },
          connectedMobileDeviceIds
        )
          .then((r) => {
            if (r.sent > 0) delivery.pushRung = true;
          })
          .catch((err) => console.error("[PUSH] NetworkChains call push error:", err));

        // Arm the auto-expire timer so an ignored knock stops ringing on its
        // own instead of ringing forever.
        clearKnockTimer(targetId, knock.from);
        knockTimers.set(
          knockDeliveryKey(targetId, knock.from),
          setTimeout(() => expireKnock(targetId, knock.from), KNOCK_TIMEOUT_MS)
        );

        console.log(
          `[SOCKET] Processed knock from ${knock.from} to ${targetId} (presence=${
            targetUser ? "online" : "push-only"
          }, app=${knock.app}, mobileSocket=${targetHasLiveMobileSocket ? "live" : "none"}, excludedDevices=${connectedMobileDeviceIds.size})`
        );
      }

      // Schedule next knock processing if queue is not empty
      if (queue.length > 0) {
        setTimeout(() => processKnockQueue(targetId), PROCESSING_DELAY);
      }
    };

    socket.on("workspace:knock", async ({ targetId, p2p }: { targetId: string; p2p?: number }) => {
      // Rate limiting
      if (!checkRateLimit(userId)) {
        console.log(`[SOCKET] Knock rate limit exceeded for user ${userId}`);
        return;
      }

      // Reachability check. The target is reachable if ANY of:
      //   • they're in workspace presence (foreground office page), OR
      //   • they have ANY live socket — e.g. a web tab on a non-office page
      //     (mail, feeds, games…); delivery goes to the `user:{id}` room which
      //     every socket joins at connect, so no workspace presence is needed
      //     to ring them in-app, OR
      //   • they're logged in with a registered push/VoIP token (backgrounded/
      //     terminated app we can wake via push — the WhatsApp model).
      // Only a fully logged-out target with no token is truly unreachable.
      //
      // All of it within the calling app: a NetworkChains call can only ring
      // NetworkChains, so Garage HQ being open doesn't make the target
      // reachable (see callRoom). NetworkChains identifies itself at the
      // handshake; its builds from before that are recognised by `p2p`,
      // which only NetworkChains sends.
      const callApp: CallApp =
        (socket as any).app === "networkchain" || typeof p2p === "number"
          ? "networkchain"
          : "garage";
      const targetUser =
        callApp === "garage" ? await getWorkspaceUser(targetId) : null;
      const targetSocketIds = userSocketConnections.get(targetId);
      const targetHasLiveSocket =
        !!targetSocketIds &&
        Array.from(targetSocketIds).some((sid) => {
          const s = io.sockets.sockets.get(sid);
          return !!s?.connected && (s as any).app === callApp;
        });
      if (!targetUser && !targetHasLiveSocket) {
        const [hasVoip, hasPush] = await Promise.all([
          VoIPToken.exists({
            userId: targetId,
            isActive: true,
            app: callApp === "networkchain" ? "networkchain" : { $ne: "networkchain" },
          }),
          DeviceToken.exists({
            userId: targetId,
            isActive: true,
            // Rung by push on garage-chat (knock) or NetworkChains (call);
            // other apps' tokens can't receive a ring.
            app: callApp === "networkchain" ? "networkchain" : { $in: [null, "garage-chat"] },
          }),
        ]);
        if (!hasVoip && !hasPush) {
          console.log(
            `[SOCKET] Knock failed: user ${targetId} not online and has no push/VoIP token.`
          );
          // Tell the knocker so their UI can show "unavailable" instead of hanging.
          io.to(`user:${userId}`).emit("workspace:knock-unreachable", { targetId });
          return;
        }
        console.log(
          `[SOCKET] Target ${targetId} is backgrounded — delivering knock via push/VoIP.`
        );
      }

      // Check if there's already an active knock from this user
      const activeSet = activeKnocks.get(targetId) || new Set();
      if (activeSet.has(userId)) {
        console.log(
          `[SOCKET] Knock request from ${userId} to ${targetId} already active, ignoring duplicate.`
        );
        return;
      }

      // Get knocker info
      const knocker = await User.findById(userId).select("name email").lean();
      const fromName = knocker?.name || knocker?.email || "Someone";

      // Add to queue
      let queue = knockQueues.get(targetId);
      if (!queue) {
        queue = [];
        knockQueues.set(targetId, queue);
      }

      // Check if this knock is already in the queue
      const alreadyQueued = queue.some((req) => req.from === userId);
      if (!alreadyQueued) {
        queue.push({
          from: userId,
          fromName: fromName,
          timestamp: Date.now(),
          socketId: socket.id,
          p2p: typeof p2p === "number" ? p2p : undefined,
          app: callApp,
        });

        // If this is the first item in queue, start processing
        if (queue.length === 1) {
          setTimeout(() => processKnockQueue(targetId), PROCESSING_DELAY);
        }
      }
    });
    socket.on(
      "workspace:knock-accept",
      async ({
        targetId,
        byName,
        by,
        p2p,
      }: {
        targetId: string;
        byName: string;
        by: string;
        /** Accepter's app supports peer-to-peer calls (protocol version). */
        p2p?: number;
      }) => {
        console.log(`[KNOCK-ACCEPT] ========== KNOCK ACCEPT HANDLER ENTERED ==========`);
        console.log(`[KNOCK-ACCEPT] Host (me): ${userId}, Knocker (target): ${targetId}, byName: ${byName}`);

        // Only a knock that is still ringing can be answered. After it expired,
        // was declined or cancelled, or was already answered on another
        // device, an accept (a late tap on a push, say) would pull the caller
        // into a call they already gave up on.
        if (!activeKnocks.get(userId)?.has(targetId)) {
          console.log(`[KNOCK-ACCEPT] Ignoring accept of inactive knock ${targetId} -> ${userId}`);
          socket.emit("livekit:join-error", { error: "This call has ended." });
          return;
        }

        // Grab delivery state BEFORE resolving it — we need the knocker's
        // originating socket to route the call back to the device that knocked.
        const knockDelivery = knockDeliveries.get(
          knockDeliveryKey(userId, targetId)
        );

        // Dismiss the ringing UI on the host's other devices and cancel any
        // native push ring (CallKit/Telecom) on a backgrounded phone.
        clearKnockTimer(userId, targetId);
        notifyKnockHandled(userId, socket.id, targetId, "accepted");
        resolveKnockDelivery(userId, targetId);

        // Remove from active knocks
        const activeSet = activeKnocks.get(userId);
        if (activeSet) {
          activeSet.delete(targetId);
          if (activeSet.size === 0) {
            activeKnocks.delete(userId);
          }
        }

        // Remove from queue if still pending
        const queue = knockQueues.get(userId);
        if (queue) {
          const index = queue.findIndex((req) => req.from === targetId);
          if (index !== -1) {
            queue.splice(index, 1);
          }
        }

        // --- START OF FIX: Move the host into their own room ---
        const hostUser = await getWorkspaceUser(userId); // The host (me)
        const guestUser = await getWorkspaceUser(targetId); // The guest who knocked

        if (hostUser && guestUser) {
          const channelName = `private-room-${userId}`; // Unique channel based on host's ID

          // === HOST JOINS THE CALL ===
          // Accepting a knock is a deliberate "take this call here, now" action,
          // so force-rejoin instead of blocking. Any leftover call-state for this
          // channel is stale (e.g. a previous call that failed to connect and
          // never freed its slot) and must NOT reject a fresh accept with a bogus
          // "you already answered on another device" — the knocker just knocked,
          // there is no genuine concurrent answer to protect.
          const hostDeviceType = getDeviceType(socket);
          await callStateService.forceRejoin(
            channelName,
            userId,
            socket.id,
            hostDeviceType
          );

          // Notify host's other devices to dismiss their ringing/incoming UI.
          notifyCallAnsweredElsewhere(
            userId,
            socket.id,
            channelName,
            hostDeviceType
          );

          // === MULTI-DEVICE CHECK FOR GUEST ===
          // Prefer the socket the knock originated from, so the call opens on
          // the device the knocker actually used. Fall back to any live socket.
          const guestSockets = userSocketConnections.get(targetId);
          let guestSocketId = "";

          const originSocketId = knockDelivery?.socketId;
          if (
            originSocketId &&
            guestSockets?.has(originSocketId) &&
            io.sockets.sockets.get(originSocketId)?.connected
          ) {
            guestSocketId = originSocketId;
          } else if (guestSockets && guestSockets.size > 0) {
            guestSocketId = Array.from(guestSockets)[0];
          }

          if (guestSocketId) {
            // Force the guest (knocker) into the call too — same reasoning as the
            // host: a fresh knock-accept clears any stale state rather than
            // blocking on it.
            await callStateService.forceRejoin(
              channelName,
              targetId,
              guestSocketId,
              "unknown"
            );

            // Notify guest's other devices to dismiss their outgoing "Calling…" UI.
            notifyCallAnsweredElsewhere(
              targetId,
              guestSocketId,
              channelName,
              "unknown"
            );
          }
          // === END MULTI-DEVICE CHECK ===

          // Notify the knocker IMMEDIATELY that their knock was accepted
          // This clears the "Knocking..." overlay before any async work
          console.log(`[LIVEKIT KNOCK] Sending knock-accepted to knocker ${targetId}, guestSocketId="${guestSocketId}"`);
          if (guestSocketId) {
            io.to(guestSocketId).emit("workspace:knock-accepted", {
              by: userId,
              byName: hostUser.name || "A colleague",
            });
          }
          // Always also emit to the user room as fallback
          io.to(`user:${targetId}`).emit("workspace:knock-accepted", {
            by: userId,
            byName: hostUser.name || "A colleague",
          });
          console.log(`[LIVEKIT KNOCK] knock-accepted sent to knocker ${targetId}`);

          // === PEER-TO-PEER PATH ===
          // Both apps speak P2P: hand them ICE servers and let the audio flow
          // phone-to-phone. No LiveKit tokens, no room — and none of the
          // awaits below sit between "accept" and the call starting.
          // P2P_CALLS_ENABLED=false is the kill switch: every call goes back
          // to LiveKit without an app update.
          // The P2P flag came from the knocking socket, so only that socket
          // may take the P2P call. If the call fell back to another of the
          // knocker's sockets (a web tab, say), it goes the LiveKit way.
          if (
            process.env.P2P_CALLS_ENABLED !== "false" &&
            knockDelivery?.p2p === P2P_PROTOCOL &&
            p2p === P2P_PROTOCOL &&
            guestSocketId &&
            guestSocketId === knockDelivery.socketId
          ) {
            const call = registerP2PCall({
              callId: newCallId(),
              channelName,
              hostId: userId,
              guestId: targetId,
              hostSocketId: socket.id,
              guestSocketId,
              hostName: hostUser.name || "A colleague",
              guestName: guestUser.name || "A colleague",
              orgId: userOrgId,
            });
            const [hostIce, guestIce] = await Promise.all([
              getIceServers(userId),
              getIceServers(targetId),
            ]);
            const relay = hasTurnRelay();

            // The knocker is the offerer: its app pre-warmed the mic and the
            // offer while ringing, so it can send the offer immediately.
            socket.emit("call:p2p-start", {
              callId: call.callId,
              channel: channelName,
              role: "answerer",
              peerId: targetId,
              peerName: guestUser.name,
              iceServers: hostIce,
              relay,
            });
            io.to(guestSocketId).emit("call:p2p-start", {
              callId: call.callId,
              channel: channelName,
              role: "offerer",
              peerId: userId,
              peerName: hostUser.name,
              iceServers: guestIce,
              relay,
            });

            await Promise.all([
              updateWorkspaceUserSpace(userId, userId),
              updateWorkspaceUserSpace(targetId, userId),
            ]);
            if (!isRedisAvailable()) {
              io.to("workspace").emit("workspace:user-moved-space", {
                userId: userId,
                spaceId: userId,
              });
              io.to("workspace").emit("workspace:user-moved-space", {
                userId: targetId,
                spaceId: userId,
              });
            }
            console.log(
              `[P2P] Call ${call.callId} started between ${userId} and ${targetId} (relay=${relay})`
            );
            return;
          }

          // Generate both tokens in parallel. LiveKit auto-creates rooms on first join.
          const room = { name: channelName };
          const [hostToken, guestToken] = await Promise.all([
            createParticipantToken(room.name, {
              userId,
              userName: hostUser.name,
              isOwner: true,
            }),
            createParticipantToken(room.name, {
              userId: targetId,
              userName: guestUser.name,
            }),
          ]);

          // Set recording context so webhook can upload to correct org cabinet
          if (userOrgId) {
            setRecordingContext(room.name, {
              organizationId: userOrgId,
              userId,
              meetingTitle: `knock-${hostUser.name}-${guestUser.name}`,
              spaceId: channelName,
            });
          }

          // Move both users into the private space in parallel
          await Promise.all([
            updateWorkspaceUserSpace(userId, userId),
            updateWorkspaceUserSpace(targetId, userId),
          ]);

          // Only emit directly if Redis is NOT available (fallback mode)
          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-moved-space", {
              userId: userId,
              spaceId: userId,
            });
            io.to("workspace").emit("workspace:user-moved-space", {
              userId: targetId,
              spaceId: userId,
            });
          }

          // --- Emit LiveKit details to both clients ---

          // Build participants array for 1-1 knock calls (consistent with floor/booking meetings)
          const knockParticipants = [
            { userId: userId, name: hostUser.name, email: hostUser.email, isScreenSharing: false },
            { userId: targetId, name: guestUser.name, email: guestUser.email, isScreenSharing: false },
          ];

          // 1. To the host who accepted the knock - use socket.emit() for THIS socket only
          socket.emit("livekit:init-call", {
            serverUrl: getLivekitUrl(),
            roomName: room.name,
            channel: channelName,
            token: hostToken,
            partnerId: targetId,
            participants: knockParticipants,
          });

          // 2. To the guest who is joining the call - emit to ONE of their sockets
          if (guestSocketId) {
            io.to(guestSocketId).emit("livekit:join-call", {
              serverUrl: getLivekitUrl(),
              roomName: room.name,
              channel: channelName,
              token: guestToken,
              hostId: userId,
              hostName: byName,
              participants: knockParticipants,
            });
          } else {
            // Fallback: if no specific socket found, emit to all (shouldn't happen normally)
            io.to(`user:${targetId}`).emit("livekit:join-call", {
              serverUrl: getLivekitUrl(),
              roomName: room.name,
              channel: channelName,
              token: guestToken,
              hostId: userId,
              hostName: byName,
              participants: knockParticipants,
            });
          }

          console.log(
            `[LIVEKIT] Call setup for channel ${channelName} between ${userId} and ${targetId}`
          );
        } else {
          console.error(
            "Could not find host or guest user for LiveKit call setup"
          );
        }
      }
    );
    // ── Peer-to-peer call signalling ─────────────────────────────────────
    // Relayed to the peer's user room (not a socket id) so a peer whose
    // socket reconnected mid-call still receives ICE restarts. The peer's
    // other devices ignore callIds they don't hold.
    socket.on(
      "call:signal",
      ({ callId, data }: { callId: string; data: unknown }) => {
        const call = typeof callId === "string" ? p2pCalls.get(callId) : undefined;
        const peerId = call ? peerOf(call, userId) : null;
        if (!call || !peerId) return;
        // SDP is a few KB; anything much larger isn't signalling.
        if (JSON.stringify(data ?? null).length > 32_000) return;
        noteCallSocket(call, userId, socket.id);
        io.to(`user:${peerId}`).emit("call:signal", { callId, from: userId, data });
      }
    );

    // No direct path could be found (and no TURN relay got through): move
    // this call onto LiveKit. Either side may ask; only the first counts.
    socket.on("call:p2p-fallback", async ({ callId }: { callId: string }) => {
      const call = typeof callId === "string" ? p2pCalls.get(callId) : undefined;
      if (!call || !peerOf(call, userId) || call.fellBack) return;
      noteCallSocket(call, userId, socket.id);
      call.fellBack = true;
      try {
        await startLiveKitForP2PCall(call);
        console.log(`[P2P] Call ${callId} fell back to LiveKit (requested by ${userId})`);
      } catch (e) {
        console.error(`[P2P] LiveKit fallback for ${callId} failed:`, e);
        io.to(`user:${call.hostId}`).emit("call:end", { callId, from: userId, reason: "failed" });
        io.to(`user:${call.guestId}`).emit("call:end", { callId, from: userId, reason: "failed" });
        p2pCalls.delete(callId);
      }
    });

    socket.on("call:end", ({ callId, reason }: { callId: string; reason?: string }) => {
      const call = typeof callId === "string" ? p2pCalls.get(callId) : undefined;
      const peerId = call ? peerOf(call, userId) : null;
      if (!call || !peerId) return;
      p2pCalls.delete(callId);
      io.to(`user:${peerId}`).emit("call:end", { callId, from: userId, reason });
    });

    // Same LiveKit room, tokens and payloads as a normal knock call, so the
    // apps' existing LiveKit call handling takes over unchanged.
    const startLiveKitForP2PCall = async (call: P2PCall) => {
      const [hostToken, guestToken] = await Promise.all([
        createParticipantToken(call.channelName, {
          userId: call.hostId,
          userName: call.hostName,
          isOwner: true,
        }),
        createParticipantToken(call.channelName, {
          userId: call.guestId,
          userName: call.guestName,
        }),
      ]);
      const participants = [
        { userId: call.hostId, name: call.hostName, isScreenSharing: false },
        { userId: call.guestId, name: call.guestName, isScreenSharing: false },
      ];
      const liveSocket = (id: string) => io.sockets.sockets.get(id)?.connected;
      io.to(liveSocket(call.hostSocketId) ? call.hostSocketId : `user:${call.hostId}`).emit(
        "livekit:init-call",
        {
          serverUrl: getLivekitUrl(),
          roomName: call.channelName,
          channel: call.channelName,
          token: hostToken,
          partnerId: call.guestId,
          participants,
          p2pCallId: call.callId,
        }
      );
      io.to(liveSocket(call.guestSocketId) ? call.guestSocketId : `user:${call.guestId}`).emit(
        "livekit:join-call",
        {
          serverUrl: getLivekitUrl(),
          roomName: call.channelName,
          channel: call.channelName,
          token: guestToken,
          hostId: call.hostId,
          hostName: call.hostName,
          participants,
          p2pCallId: call.callId,
        }
      );
    };

    socket.on(
      "workspace:knock-decline",
      ({ targetId, byName }: { targetId: string; byName: string }) => {
        // Dismiss the ringing UI on the decliner's other devices and cancel
        // any native push ring on a backgrounded phone.
        clearKnockTimer(userId, targetId);
        notifyKnockHandled(userId, socket.id, targetId, "declined");
        resolveKnockDelivery(userId, targetId);

        // Remove from active knocks
        const activeSet = activeKnocks.get(userId);
        if (activeSet) {
          activeSet.delete(targetId);
          if (activeSet.size === 0) {
            activeKnocks.delete(userId);
          }
        }

        // Remove from queue if still pending
        const queue = knockQueues.get(userId);
        if (queue) {
          const index = queue.findIndex((req) => req.from === targetId);
          if (index !== -1) {
            queue.splice(index, 1);
          }
        }

        // Emit to the personal room for reliability
        io.to(`user:${targetId}`).emit("workspace:knock-declined", {
          by: userId,
          byName: byName,
        });
      }
    );

    socket.on(
      "workspace:knock-cancel",
      ({ targetId }: { targetId: string }) => {
        // Cancel any native push ring on the target's backgrounded phone.
        clearKnockTimer(targetId, userId);
        resolveKnockDelivery(targetId, userId);

        // Remove from active knocks
        const activeSet = activeKnocks.get(targetId);
        if (activeSet) {
          activeSet.delete(userId);
          if (activeSet.size === 0) {
            activeKnocks.delete(targetId);
          }
        }

        // Remove from queue if still pending
        const queue = knockQueues.get(targetId);
        if (queue) {
          const index = queue.findIndex((req) => req.from === userId);
          if (index !== -1) {
            queue.splice(index, 1);
          }
        }

        // Notify the target user that the knock was cancelled.
        // `from` and `by` are the same value — web historically read `by`,
        // mobile reads `from`; send both for compatibility.
        io.to(`user:${targetId}`).emit("workspace:knock-cancelled", {
          by: userId,
          from: userId,
        });
        console.log(
          `[SOCKET] Knock cancelled: user ${userId} cancelled knock request to user ${targetId}`
        );
      }
    );

    socket.on("workspace:end-meeting", async () => {
      const hostId = userId;
      const hostUser = await getWorkspaceUser(hostId);
      const meetingSpaceId = hostUser?.spaceId;

      const allUsers = await getAllWorkspaceUsers();

      // Track the room name to delete after all users are moved out
      let roomToDelete: string | null = null;

      for (const user of allUsers) {
        // End meeting for users in host's private room OR in the same floor/booking meeting
        const isInHostRoom = user.spaceId === hostId;
        const isInSameMeeting =
          meetingSpaceId &&
          (meetingSpaceId.startsWith("floor-meeting:") ||
            meetingSpaceId.startsWith("booking:")) &&
          user.spaceId === meetingSpaceId;

        if (isInHostRoom || isInSameMeeting) {
          const wasScreenSharing = !!user.isScreenSharing;

          // Determine the LiveKit room name to clean up
          if (!roomToDelete) {
            if (isInHostRoom) {
              roomToDelete = `private-room-${hostId}`;
            } else if (meetingSpaceId) {
              roomToDelete = meetingSpaceId;
            }
          }

          // Update using dedicated methods (publishes correct events via Redis)
          await updateWorkspaceUserSpace(user.id, "lobby");
          if (wasScreenSharing) {
            await updateWorkspaceUserScreenShare(user.id, false);
          }

          // Broadcast only if Redis is NOT available (fallback mode)
          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-moved-space", {
              userId: user.id,
              spaceId: "lobby",
            });
            if (wasScreenSharing) {
              io.to("workspace").emit("workspace:screen-share-state", {
                userId: user.id,
                isSharing: false,
              });
            }
          }

          // Emit leave call event to end LiveKit call
          io.to(`user:${user.id}`).emit("livekit:leave-call");
          console.log(
            `[LIVEKIT] End meeting - emitting leave-call to user ${user.id}`
          );
        }
      }

      // Clean up the LiveKit room after all users have been moved out
      if (roomToDelete) {
        livekitRoomUsers.delete(roomToDelete);
        deleteRoom(toLivekitRoomName(roomToDelete)).catch((err) =>
          console.error(`[LIVEKIT] Failed to delete room ${roomToDelete}:`, err)
        );
      }
    });

    // Activity room join/leave disabled with the Team Activity FE
    // retirement — no client emits these events any more. Kept commented
    // for one-line revert.
    // socket.on("activity:join", ({ orgId }: { orgId: string }) => {
    //   socket.join(`org:${orgId}`);
    // });
    // socket.on("activity:leave", ({ orgId }: { orgId: string }) => {
    //   socket.leave(`org:${orgId}`);
    // });

    // ============= Feed Events =============
    // Join a channel room to receive real-time feed updates
    socket.on("feed:join-channel", ({ channelId }: { channelId: string }) => {
      socket.join(`channel:${channelId}`);
      console.log(`[FEED] User ${userId} joined channel:${channelId}`);
    });

    // Leave a channel room
    socket.on("feed:leave-channel", ({ channelId }: { channelId: string }) => {
      socket.leave(`channel:${channelId}`);
      console.log(`[FEED] User ${userId} left channel:${channelId}`);
    });

    // Join multiple channels at once
    socket.on("feed:join-channels", ({ channelIds }: { channelIds: string[] }) => {
      channelIds.forEach((channelId) => {
        socket.join(`channel:${channelId}`);
      });
      console.log(`[FEED] User ${userId} joined ${channelIds.length} channels`);
    });

    // Join org feed room (for founders to see all posts)
    socket.on("feed:join-org", ({ orgId }: { orgId: string }) => {
      socket.join(`org:${orgId}:feed`);
      console.log(`[FEED] User ${userId} joined org:${orgId}:feed`);
    });

    // Leave org feed room
    socket.on("feed:leave-org", ({ orgId }: { orgId: string }) => {
      socket.leave(`org:${orgId}:feed`);
      console.log(`[FEED] User ${userId} left org:${orgId}:feed`);
    });

    // Join a post room (for receiving like/comment updates)
    socket.on("feed:join-post", ({ postId }: { postId: string }) => {
      socket.join(`post:${postId}`);
    });

    // Leave a post room
    socket.on("feed:leave-post", ({ postId }: { postId: string }) => {
      socket.leave(`post:${postId}`);
    });

    // ============= Support Ticket Events =============
    // Join org support room to receive ticket notifications for that org
    socket.on("support:join-org", ({ orgId }: { orgId: string }) => {
      socket.join(`support:org:${orgId}`);
      console.log(`[SUPPORT] User ${userId} joined support:org:${orgId}`);
    });

    // Leave org support room
    socket.on("support:leave-org", ({ orgId }: { orgId: string }) => {
      socket.leave(`support:org:${orgId}`);
      console.log(`[SUPPORT] User ${userId} left support:org:${orgId}`);
    });

    // Join specific ticket room to receive real-time messages
    socket.on("support:join-ticket", ({ ticketId }: { ticketId: string }) => {
      socket.join(`support:ticket:${ticketId}`);
      console.log(`[SUPPORT] User ${userId} joined support:ticket:${ticketId}`);
    });

    // Leave specific ticket room
    socket.on("support:leave-ticket", ({ ticketId }: { ticketId: string }) => {
      socket.leave(`support:ticket:${ticketId}`);
      console.log(`[SUPPORT] User ${userId} left support:ticket:${ticketId}`);
    });

    // Join global support room (for Garage HQ admins to receive all ticket updates)
    socket.on("support:join-global", () => {
      socket.join("support:global");
      console.log(`[SUPPORT] User ${userId} joined support:global (admin)`);
    });

    // Leave global support room
    socket.on("support:leave-global", () => {
      socket.leave("support:global");
      console.log(`[SUPPORT] User ${userId} left support:global`);
    });

    // Guest event call join handler
    socket.on("guest:join-event-call", async () => {
      const isGuest = (socket as any).isGuest;
      const guestId = (socket as any).guestId;
      const eventId = (socket as any).eventId;
      const displayName = (socket as any).displayName;

      if (!isGuest || !guestId || !eventId) {
        console.error("[GUEST] Invalid guest join attempt - missing credentials");
        socket.emit("guest:join-error", { message: "Invalid guest credentials" });
        return;
      }

      try {
        const { Event } = require("../models/event.model");
        const { EventGuest } = require("../models/eventGuest.model");

        // Get event details
        const event = await Event.findById(eventId)
          .populate('creatorId', 'name email')
          .populate('invitedUserIds', 'name email')
          .lean();

        if (!event) {
          console.error(`[GUEST] Event ${eventId} not found`);
          socket.emit("guest:join-error", { message: "Event not found" });
          return;
        }

        // Get guest record
        const guest = await EventGuest.findById(guestId).lean();
        if (!guest) {
          console.error(`[GUEST] Guest ${guestId} not found`);
          socket.emit("guest:join-error", { message: "Guest record not found" });
          return;
        }

        const channelName = `event:${eventId}`;
        const livekitRoomName = toLivekitRoomName(channelName);

        // Generate participant token for guest. LiveKit auto-creates rooms on first join.
        const room = { name: livekitRoomName };
        const guestToken = await createParticipantToken(room.name, {
          userId: guestId,
          userName: displayName,
        });

        // Join the event room for real-time updates
        socket.join(channelName);

        // Track guest in room
        if (!livekitRoomUsers.has(channelName)) {
          livekitRoomUsers.set(channelName, new Set());
        }
        livekitRoomUsers.get(channelName)!.add(guestId);

        // Get internal workspace users in this event
        const allWorkspaceUsers = await getAllWorkspaceUsers();
        const internalParticipants = allWorkspaceUsers
          .filter((u) => u.spaceId === channelName)
          .map((u) => ({
            userId: u.id,
            name: u.name,
            email: u.email,
            isGuest: false,
            isScreenSharing: !!u.isScreenSharing
          }));

        // Get other guests in this event
        const otherGuests = await EventGuest.find({
          eventId,
          _id: { $ne: guestId },
          leftAt: null
        }).lean();

        const guestParticipants = otherGuests.map((g: any) => ({
          userId: g._id.toString(),
          name: g.displayName,
          email: g.email,
          isGuest: true,
          isScreenSharing: false
        }));

        // Add current guest
        const currentGuest = {
          userId: guestId,
          name: displayName,
          email: guest.email,
          isGuest: true,
          isScreenSharing: false
        };

        const allParticipants = [...internalParticipants, ...guestParticipants, currentGuest];

        console.log(`[GUEST] Guest ${guestId} (${displayName}) joining event ${eventId}`);
        console.log(`[GUEST] Channel ${channelName} participants:`, allParticipants);

        // Join the event channel room so guest can receive screen share state broadcasts
        socket.join(channelName);
        console.log(`[GUEST] Guest socket joined room: ${channelName}`);

        // Send LiveKit credentials to guest
        socket.emit("livekit:init-call", {
          serverUrl: getLivekitUrl(),
          roomName: room.name,
          channel: channelName,
          token: guestToken,
          meetingType: 'event',
          participants: allParticipants
        });

        // Broadcast to all participants (internal users and guests) that guest joined
        io.to(channelName).emit("livekit:participant-update", {
          type: 'joined',
          participant: currentGuest,
          participants: allParticipants
        });

        // Also broadcast full participants list to ensure all participants have consistent state
        io.to(channelName).emit("livekit:participants-update", {
          channel: channelName,
          participants: allParticipants
        });

        console.log(`[GUEST] Guest ${displayName} successfully joined event call with ${allParticipants.length} participants`);
      } catch (error) {
        console.error("[GUEST] Error joining event call:", error);
        socket.emit("guest:join-error", { message: "Failed to join event call" });
      }
    });

    // ── Preview-card watcher presence ────────────────────────────────────────
    socket.on("webinar:previewWatch", ({ webinarId, avatar }: { webinarId: string; avatar?: string }) => {
      // Skip if this user already has a real participant socket in the webinar room
      const room = io.sockets.adapter.rooms.get(webinarId);
      if (room) {
        for (const sid of room) {
          if (sid === socket.id) continue;
          const other = io.sockets.sockets.get(sid);
          if (other && (other as any).userId === userId) return; // user is host/attendee — no pre-guest entry
        }
      }

      // Enforce 1 pre-guest slot per user per webinar — evict any prior slot
      const key = `${userId}:${webinarId}`;
      const prevSocketId = previewWatchers.get(key);
      if (prevSocketId && prevSocketId !== socket.id) {
        io.to(webinarId).emit("webinar:peerLeft", { socketId: `preview-${prevSocketId}` });
        const prevSocket = io.sockets.sockets.get(prevSocketId);
        if (prevSocket) delete (prevSocket as any)._previewWebinarId;
      }
      previewWatchers.set(key, socket.id);

      // A view = a watch-start. A brand-new slot or a new device counts; the
      // same socket re-announcing (reconnect, re-render) does not. Closing
      // and watching again is a fresh socket or slot, so it counts again —
      // deliberately: this is a views odometer, not a uniques count.
      if (prevSocketId !== socket.id && Types.ObjectId.isValid(webinarId)) {
        Workshop.updateOne({ _id: webinarId }, { $inc: { totalViews: 1 } }).catch(() => {});
      }

      const name = (socket as any).userName || (socket as any).displayName || "Anonymous";
      io.to(webinarId).emit("webinar:peerJoined", {
        socketId: `preview-${socket.id}`,
        userId,
        name,
        avatar,
        role: "pre-guest",
      });
      (socket as any)._previewWebinarId = webinarId;
    });

    socket.on("webinar:previewLeave", ({ webinarId }: { webinarId: string }) => {
      const key = `${userId}:${webinarId}`;
      if (previewWatchers.get(key) === socket.id) previewWatchers.delete(key);
      io.to(webinarId).emit("webinar:peerLeft", { socketId: `preview-${socket.id}` });
      delete (socket as any)._previewWebinarId;
    });

    // When this socket joins the webinar for real, evict any preview-card ghost for this user
    socket.on("webinar:joinRoom", ({ webinarId }: { webinarId: string }) => {
      const key = `${userId}:${webinarId}`;
      const prevSocketId = previewWatchers.get(key);
      // Joining without having previewed is a watch-start of its own; a
      // preview→join hand-off already counted at previewWatch.
      if (!prevSocketId && Types.ObjectId.isValid(webinarId)) {
        Workshop.updateOne({ _id: webinarId }, { $inc: { totalViews: 1 } }).catch(() => {});
      }
      if (prevSocketId) {
        io.to(webinarId).emit("webinar:peerLeft", { socketId: `preview-${prevSocketId}` });
        const prevSocket = io.sockets.sockets.get(prevSocketId);
        if (prevSocket) delete (prevSocket as any)._previewWebinarId;
        previewWatchers.delete(key);
      }
    });
    // ─────────────────────────────────────────────────────────────────────────

    socket.on("disconnect", async () => {
      // Clean up preview-card presence if still active
      const previewRoom = (socket as any)._previewWebinarId;
      if (previewRoom) {
        const key = `${userId}:${previewRoom}`;
        if (previewWatchers.get(key) === socket.id) previewWatchers.delete(key);
        io.to(previewRoom).emit("webinar:peerLeft", { socketId: `preview-${socket.id}` });
      }

      userIdToSocketId.delete(userId);

      // Clean up knock state ONLY when this was the user's last live socket —
      // with multi-device ringing, one device dropping (e.g. phone backgrounds)
      // must not kill a knock still ringing on another device.
      const remainingSockets =
        (userSocketConnections.get(userId)?.size || 0) - 1;
      if (remainingSockets <= 0) {
        // Clean up knock queues and active knocks for this user
        knockQueues.delete(userId);
        activeKnocks.delete(userId);

        // Remove this user from all active knock sets
        for (const [targetId, activeSet] of activeKnocks.entries()) {
          activeSet.delete(userId);
          if (activeSet.size === 0) {
            activeKnocks.delete(targetId);
          }
        }

        // Drop per-knock delivery records and pending auto-expire timers
        // involving this user.
        for (const key of knockDeliveries.keys()) {
          const [tId, kId] = key.split(":");
          if (tId === userId || kId === userId) {
            knockDeliveries.delete(key);
          }
        }
        for (const [key, timer] of knockTimers.entries()) {
          const [tId, kId] = key.split(":");
          if (tId === userId || kId === userId) {
            clearTimeout(timer);
            knockTimers.delete(key);
          }
        }
      }

      // === CALL STATE CLEANUP WITH GRACE PERIOD ===
      // Check if user is in a call and clean up after grace period
      // IMPORTANT: Don't await here - fire and forget to avoid blocking disconnect handler
      callStateService
        .getUserCurrentCall(userId)
        .then((userCurrentCall) => {
          if (userCurrentCall) {
            console.log(
              `[CALL-STATE] User ${userId} disconnected while in call ${userCurrentCall}, starting grace period`
            );
            // Grace period for reconnection (e.g., page refresh, network hiccup)
            setTimeout(async () => {
              try {
                const stillConnected =
                  userSocketConnections.get(userId)?.size || 0;
                if (stillConnected === 0) {
                  await callStateService.leaveCall(userCurrentCall, userId);
                  console.log(
                    `[CALL-STATE] Cleaned up disconnected user ${userId} from call ${userCurrentCall} after grace period`
                  );
                } else {
                  console.log(
                    `[CALL-STATE] User ${userId} reconnected, keeping call state for ${userCurrentCall}`
                  );
                }
              } catch (error) {
                console.error(
                  `[CALL-STATE] Error cleaning up disconnected user ${userId}:`,
                  error
                );
              }
            }, 10000); // 10 second grace period
          }
        })
        .catch((err) => {
          console.error(
            `[CALL-STATE] Error getting current call for ${userId}:`,
            err
          );
        });
      // === END CALL STATE CLEANUP ===

      // Clean up rate limiting data after a delay
      setTimeout(() => {
        knockRateLimits.delete(userId);
      }, 120000); // 2 minutes

      // Remove this socket connection from the user's connections
      const userConnections = userSocketConnections.get(userId);
      if (userConnections) {
        userConnections.delete(socket.id);

        // Track user going offline - only if this was the last connection
        try {
          const user = await User.findById(userId).lean();
          console.log(
            `[PRESENCE] User ${userId} disconnected, remaining connections: ${userConnections.size}`
          );

          if (user && userOrgId && userConnections.size === 0) {
            // Only create offline activity if this was the last connection
            const currentState = userPresenceState.get(userId);
            const now = new Date();

            // Always create offline activity - no filtering or deduplication
            console.log(
              `[PRESENCE] Creating offline activity for user ${userId}`
            );
            const activity = await UserActivity.create({
              userId: new Types.ObjectId(userId),
              orgId: new Types.ObjectId(userOrgId),
              type: "offline",
              title: `${user.name || user.email} went offline`,
              description: `${user.name || user.email} is now offline`,
              category: "presence",
              priority: "low",
              metadata: { userId, userName: user.name, userEmail: user.email },
            });

            // Update presence state
            userPresenceState.set(userId, {
              isOnline: false,
              lastActivity: now,
            });

            // `activity:new` broadcast retired with the Team Activity FE.
            // Offline UserActivity row above still lands for OnlineActivityTab.
            void activity;
            // const populatedActivity = {
            //   ...activity.toObject(),
            //   userId: {
            //     _id: user._id,
            //     name: user.name,
            //     email: user.email,
            //   },
            // };
            // io.to(`org:${userOrgId}`).emit("activity:new", {
            //   activity: populatedActivity,
            // });
          }

          // Clean up empty connection sets and presence state
          if (userConnections.size === 0) {
            userSocketConnections.delete(userId);
            lastTTLRefresh.delete(userId); // Clean up TTL refresh tracking
            // Keep presence state for a while to handle rapid reconnections
            // It will be updated when user reconnects
          }
        } catch (error) {
          console.error("Error tracking offline status:", error);
        }
      }

      // CRITICAL: Always check and clean up workspace presence on disconnect
      // Check both in-memory and Redis directly to ensure cleanup
      const user = await getWorkspaceUser(userId);

      // Even if user not found in local map, check Redis directly
      let shouldCleanup = false;
      if (user) {
        shouldCleanup = true;
        console.log(`[DISCONNECT] Found user ${userId} in workspace, cleaning up`);
      } else if (isRedisAvailable()) {
        // Double-check Redis directly in case of sync issues
        const redisUser = await presenceService.getUser(userId);
        if (redisUser) {
          shouldCleanup = true;
          console.log(`[DISCONNECT] Found user ${userId} in Redis (not in local map), forcing cleanup`);
        }
      }

      if (shouldCleanup) {
        // Clean up LiveKit room tracking if user was in a meeting
        const userSpaceId = user?.spaceId;
        if (userSpaceId && livekitRoomUsers.has(userSpaceId)) {
          const roomUsers = livekitRoomUsers.get(userSpaceId)!;
          roomUsers.delete(userId);

          // If there are still users in the meeting, broadcast updated participants
          if (roomUsers.size > 0) {
            const allWorkspaceUsers = await getAllWorkspaceUsers();
            const participants = allWorkspaceUsers
              .filter((u) => u.spaceId === userSpaceId)
              .map((u) => ({
                userId: u.id,
                name: u.name,
                email: u.email,
              }));

            // Broadcast to remaining users
            participants.forEach((p) => {
              io.to(`user:${p.userId}`).emit("livekit:participants-update", {
                channel: userSpaceId,
                participants,
              });
            });

            console.log(
              `[LIVEKIT] Broadcasted participant update after user ${userId} disconnected from ${userSpaceId}`
            );
          } else {
            // No more users, delete the room tracking and clean up the LiveKit room
            livekitRoomUsers.delete(userSpaceId);
            deleteRoom(toLivekitRoomName(userSpaceId)).catch((err) =>
              console.error(`[LIVEKIT] Failed to delete room ${userSpaceId}:`, err)
            );
          }
        }

        // Clean up knock call room on disconnect
        if (
          userSpaceId &&
          !userSpaceId.startsWith("floor-meeting:") &&
          !userSpaceId.startsWith("booking:") &&
          !userSpaceId.startsWith("event:") &&
          !userSpaceId.startsWith("community-stream:") &&
          userSpaceId !== "lobby"
        ) {
          const allWorkspaceUsers = await getAllWorkspaceUsers();
          const usersStillInRoom = allWorkspaceUsers.filter(
            (u) => u.spaceId === userSpaceId && u.id !== userId
          );
          if (usersStillInRoom.length === 0) {
            const knockRoomName = `private-room-${userSpaceId}`;
            deleteRoom(knockRoomName).catch((err) =>
              console.error(`[LIVEKIT] Failed to delete knock room ${knockRoomName}:`, err)
            );
          }
        }

        // If the user is still logged in on mobile, transition them to status
        // 'mobile' instead of removing. This emits a single
        // `workspace:user-status-changed` event — avoiding the race where a
        // remove (via Redis pub/sub) and a re-add (via direct emit) arrived in
        // the wrong order and made the card vanish on web.
        //
        // "Mobile reachable" = (a) we have an active VoIP/push token row,
        // OR (b) the disconnecting socket was itself a mobile client. (b) is a
        // safety net for cases where token registration didn't land yet
        // (PushKit timing, missing entitlement, denied permission) so the
        // workspace UI stays accurate even if a real push wouldn't reach them.
        let isMobileReachable = false;
        try {
          const [hasVoip, hasPush, hasFcm] = await Promise.all([
            VoIPToken.exists({ userId, isActive: true }),
            DeviceToken.exists({
              userId,
              isActive: true,
              platform: { $in: ["ios", "android"] },
              // Chat-audience pushes skip other apps' tokens, so only
              // garage-chat rows (or legacy rows without `app`) count.
              app: { $in: [null, "garage-chat"] },
            }),
            FCMToken.exists({ userId, isActive: true }),
          ]);
          isMobileReachable = !!(hasVoip || hasPush || hasFcm);
        } catch (err) {
          console.error("[DISCONNECT] Mobile reachability check failed:", err);
        }
        if (!isMobileReachable && getDeviceType(socket) === "mobile") {
          isMobileReachable = true;
          console.log(
            `[DISCONNECT] User ${userId} disconnected from mobile device (no token row) — treating as mobile-reachable`
          );
        }

        if (isMobileReachable) {
          // Move them to lobby (in case they were in a space/meeting) and flip
          // status to 'mobile'. Keep them in Redis so the card stays put.
          if (user?.spaceId && user.spaceId !== "lobby") {
            await updateWorkspaceUserSpace(userId, "lobby");
          }
          await updateWorkspaceUserStatus(userId, "mobile");
          console.log(
            `[DISCONNECT] User ${userId} mobile-reachable, transitioned to 'mobile' status`
          );
        } else {
          // No mobile reachability — fully remove from workspace storage.
          await removeWorkspaceUser(userId);
          console.log(`[DISCONNECT] Removed user ${userId} from workspace storage`);

          // Broadcast user left (Redis pub/sub will handle if available)
          if (!isRedisAvailable()) {
            io.to("workspace").emit("workspace:user-left", { id: userId });
          }
        }
      } else {
        console.log(`[DISCONNECT] User ${userId} not in workspace, no cleanup needed`);
      }
    });

    // ── Auction real-time room ───────────────────────────────────────────
    socket.on("auction:subscribe", () => {
      socket.join("auction:global");
    });

    socket.on("auction:unsubscribe", () => {
      socket.leave("auction:global");
    });
  });

  return io;
}
