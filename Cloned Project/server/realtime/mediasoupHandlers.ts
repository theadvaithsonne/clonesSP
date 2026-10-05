import type { Server, Socket } from "socket.io";
import mongoose from "mongoose";
import {
  getOrCreateRoom,
  getRoom,
  removeRoom,
  createWebRtcTransport,
  rooms,
} from "../services/mediasoup";
import {
  startServerRecording,
  stopServerRecording,
  isRecording as isServerRecording,
} from "../services/webinarRecording";
import {
  startWebinarLivekitRecording,
  stopWebinarLivekitRecording,
  isWebinarLivekitRecording,
  webinarRoomName,
  awaitWebinarRecordingFile,
} from "../services/webinarLivekitRecording";
import { countWebinarParticipants, getActiveEgress } from "../services/livekit";
import { setParticipantPublishGrant } from "../services/livekit";
import { BotManager as NoteTakerBotManager } from "../note-taker/agents/bot-manager";
import { NoteSession } from "../note-taker/models/note-session.model";
import { enqueueSummarize } from "../note-taker/jobs/queue";
import { WebinarMessage } from "../models/webinarMessage.model";
import { Workshop } from "../models/workshop.model";
import { Meet } from "../models/meet.model";
import { User } from "../models/user.model";
import { hasSessionAccess, isBilledSpeaker } from "../services/workshop";
import {
  claimSessionHost,
  isStreamStaff,
  releaseSessionHost,
  resolveSessionAnchor,
} from "../services/webinarHost";
import {
  clearLiveState,
  loadLiveState,
  saveLiveState,
} from "../services/webinarLiveState";
import {
  DEFAULT_PEER_GRACE_MS,
  isSameDevice,
  markDisconnected,
  pickActiveSeat,
  removePeer,
  seatsOfUser,
  takeSeat,
} from "./webinarPresence";
import type { LeaveReason, PresenceHooks } from "./webinarPresence";
import { endWebinarSession, dropLivekitRoom } from "./webinarEnd";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { sessionDayKey } from "../utils/workshopStatus";
import { emitWorkshopPreviewUpdate } from "../services/socket";
import { Invoice } from "../models/invoice.model";
import type { PinnedProductSnapshot, WebinarPeer, WebinarRoom } from "../services/mediasoup";
import { getSellable, type SellableItemType } from "../services/sellables";

// Bat246 funnel org — see demo-host-join in publicWebinar.ts for the
// name-only host bypass this constant gates in webinar:joinRoom below.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

/**
 * Room roles, weakest first. Used to answer one question: of the role a client
 * claims on join and the role this room has granted them, which is higher?
 */
const ROLE_RANK: Record<string, number> = {
  "pre-guest": 0,
  attendee: 1,
  panelist: 2,
  host: 3,
};

// ── Presence: grace, persistence, teardown ──────────────────────────────────
//
// The rule (realtime/webinarPresence.ts): a dropped socket keeps its seat for a
// grace window; only a leave, a kick, or the window closing announces
// `peerLeft`. The helpers below are the impure half — what to emit, what to
// persist, and when a room that LOOKS empty may actually be torn down.

const PEER_GRACE_MS = (() => {
  const raw = Number(process.env.WEBINAR_PEER_GRACE_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_PEER_GRACE_MS;
})();

/** The override-row key this room persists under, once a join has fixed it. */
function liveStateKey(webinarId: string, room: WebinarRoom) {
  return room.sessionKey
    ? { workshopId: webinarId, sessionDate: room.sessionKey }
    : null;
}

/** Write-through of the bits of a room that must outlive the process. */
function persistLiveState(
  webinarId: string,
  room: WebinarRoom,
  what: "elevatedRoles" | "pinnedProduct" | "bannedUserIds"
): void {
  const key = liveStateKey(webinarId, room);
  if (!key) return;
  const patch =
    what === "elevatedRoles"
      ? { elevatedRoles: Object.fromEntries(room.elevatedRoles) }
      : what === "pinnedProduct"
        ? { pinnedProduct: room.pinnedProduct }
        : { bannedUserIds: Array.from(room.bannedUserIds) };
  saveLiveState(key, patch).catch((err) =>
    console.warn(
      `[webinar:presence] ${what} not persisted for ${webinarId}:`,
      err?.message
    )
  );
}

/**
 * Auto-unpin clock for a timed pin. Shared by `webinar:pinProduct` and the
 * restore path, which re-arms whatever time the pin had left.
 */
function armPinTimer(io: Server, webinarId: string, room: WebinarRoom): void {
  if (room.pinTimer) {
    clearTimeout(room.pinTimer);
    room.pinTimer = null;
  }
  const pin = room.pinnedProduct;
  if (!pin || pin.pinnedUntil == null) return;
  const pinnedProductId = pin._id;
  room.pinTimer = setTimeout(() => {
    // Guard: only auto-unpin if this product is still the pinned one.
    const current = getRoom(webinarId);
    if (!current || current.pinnedProduct?._id !== pinnedProductId) return;
    current.pinnedProduct = null;
    current.pinTimer = null;
    persistLiveState(webinarId, current, "pinnedProduct");
    io.to(webinarId).emit("webinar:productUnpinned", {});
  }, Math.max(0, pin.pinnedUntil - Date.now()));
}

/**
 * Bring a freshly created room back to where the session left it. Runs once
 * per room object; every join awaits the same promise, so a second joiner can
 * never read the grants before they are back.
 */
function hydrateRoom(io: Server, webinarId: string, room: WebinarRoom): Promise<void> {
  if (room.hydration) return room.hydration;
  room.hydration = (async () => {
    const key = liveStateKey(webinarId, room);
    if (!key) return;
    const saved = await loadLiveState(key);
    if (!saved) return;
    for (const [uid, role] of Object.entries(saved.elevatedRoles || {})) {
      if (role === "host" || role === "panelist") room.elevatedRoles.set(uid, role);
    }
    for (const uid of saved.bannedUserIds || []) room.bannedUserIds.add(uid);
    const pin = saved.pinnedProduct;
    if (pin && (pin.pinnedUntil == null || pin.pinnedUntil > Date.now())) {
      room.pinnedProduct = pin;
      armPinTimer(io, webinarId, room);
    } else if (pin) {
      // Expired while nobody was here to unpin it.
      persistLiveState(webinarId, room, "pinnedProduct");
    }
    console.log(
      `[webinar:presence] restored ${webinarId}: ${room.elevatedRoles.size} grant(s), ` +
        `${room.bannedUserIds.size} ban(s), pin=${room.pinnedProduct?._id ?? "none"}`
    );
  })().catch((err) =>
    console.warn(`[webinar:presence] restore failed for ${webinarId}:`, err?.message)
  );
  return room.hydration;
}

/** Everyone is gone: drop the room and mark the session's Meet ended. */
async function teardownEmptyRoom(webinarId: string): Promise<void> {
  removeRoom(webinarId);
  console.log(`[Mediasoup] Room ${webinarId} removed - no peers remaining`);
  try {
    const ws = await Workshop.findById(webinarId)
      .select("meetingId orgId currentSessionDate date isRecurring")
      .lean();
    if (ws?.meetingId) {
      await Meet.findByIdAndUpdate(ws.meetingId, {
        $set: { status: "ended", endedAt: new Date() },
      });
      emitWorkshopPreviewUpdate(
        ws.orgId?.toString() || "",
        "workshop:preview:ended",
        { workshopId: webinarId }
      );
    }

    // Mirror the session-row bookkeeping that the explicit "End webinar"
    // button and the stop-route/host-absent path (endWebinarSession) both
    // already do. Without this, a room that empties out silently (everyone
    // just closes the tab, nobody clicks End) leaves the host seat
    // (WorkshopSessionOverride) held with no manualEndedAt stamp — so
    // claimSessionHost's staleness check never frees it. The next join
    // that needs to claim host (e.g. Bat246's "05" demo-host code, which
    // mints a brand-new random userId every time — see demo-host-join)
    // can never match the old holder, silently falls back to "attendee",
    // and then trips the ENDED gate above (Meet.status is already "ended"
    // from the $set above) with "This webinar has ended" — even though
    // nobody explicitly ended anything and the person joining is fully
    // eligible to host.
    if (ws) {
      const sessionDate = resolveSessionAnchor(ws as any);
      const workshopId = new mongoose.Types.ObjectId(webinarId);
      await WorkshopSessionOverride.findOneAndUpdate(
        { workshopId, sessionDate },
        {
          $set: { manualEndedAt: new Date() },
          $setOnInsert: { workshopId, sessionDate },
        },
        { upsert: true }
      );
      await releaseSessionHost(ws as any);
      await Workshop.updateOne({ _id: ws._id }, { $unset: { currentSessionDate: 1 } });
    }
  } catch (e) {
    console.warn("[Mediasoup disconnect] Failed to mark meet ended:", e);
  }
}

/**
 * The room has no peers left, connected or in grace. Before ending the
 * session, ask LiveKit: media outlives sockets (PiP, suspended tabs), and a
 * room with people still watching is not empty. Re-checks on the grace
 * cadence while LiveKit still has someone, or while a join is mid-flight;
 * tears down otherwise.
 */
function scheduleEmptyRoomTeardown(io: Server, webinarId: string, room: WebinarRoom): void {
  if (room.emptyTimer) {
    clearTimeout(room.emptyTimer);
    room.emptyTimer = null;
  }
  const stillEmpty = () => rooms.get(webinarId) === room && room.peers.size === 0;
  const later = (ms: number) => {
    room.emptyTimer = setTimeout(() => void check(), ms);
    room.emptyTimer.unref?.();
  };
  const check = async () => {
    room.emptyTimer = null;
    if (!stillEmpty()) return;
    if (room.joinsInFlight > 0) return later(1_000);
    const watching = await countWebinarParticipants(webinarRoomName(webinarId));
    if (!stillEmpty()) return;
    if (watching && watching > 0) {
      console.log(
        `[webinar:presence] ${webinarId} has no sockets but ${watching} LiveKit participant(s) — holding`
      );
      return later(PEER_GRACE_MS);
    }
    await teardownEmptyRoom(webinarId);
  };
  void check();
}

/** The roster as every ack lists it: everyone but the asking socket, bots included. */
function rosterFor(room: WebinarRoom, exceptSocketId: string) {
  return [
    ...Array.from(room.peers.entries())
      .filter(([id]) => id !== exceptSocketId)
      .map(([id, p]) => ({
        socketId: id,
        userId: p.userId,
        name: p.name,
        avatar: p.avatar,
        role: p.role,
        deviceType: p.deviceType,
        // Their socket has dropped and its grace window is running. Still
        // listed, because everyone else still lists them.
        ...(p.disconnectedAt != null ? { disconnected: true } : {}),
      })),
    ...Array.from(room.virtualPeers.values()),
  ];
}

const HOST_ABSENT_MS = (() => {
  const raw = Number(process.env.WEBINAR_HOST_ABSENT_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 120_000;
})();

/** Is anyone who can run the stream still here — connected or in grace? */
function hasStreamStaffSeat(room: WebinarRoom): boolean {
  for (const p of room.peers.values()) {
    if (p.role === "host" || p.role === "panelist") return true;
  }
  return false;
}

function cancelHostAbsentClock(room: WebinarRoom): void {
  if (room.hostAbsentTimer) {
    clearTimeout(room.hostAbsentTimer);
    room.hostAbsentTimer = null;
  }
}

/**
 * The host's seat is gone for good (grace expired, they left, or were
 * removed) and nobody who can run the stream remains. A host who merely
 * closed the app used to leave the room running for as long as the last
 * viewer stayed — "waiting for host video" with the LIVE badge on. Give
 * them a window to come back, then end the session for everyone.
 */
function maybeStartHostAbsentClock(io: Server, webinarId: string, room: WebinarRoom): void {
  if (room.hostAbsentTimer || hasStreamStaffSeat(room)) return;
  console.log(`[webinar:presence] ${webinarId} has no host; ending in ${HOST_ABSENT_MS}ms unless one returns`);
  room.hostAbsentTimer = setTimeout(() => {
    room.hostAbsentTimer = null;
    if (rooms.get(webinarId) !== room || hasStreamStaffSeat(room)) return;
    endWebinarSession(webinarId, { reason: "host-absent" }).catch((err) =>
      console.error("[webinar:presence] host-absent end failed:", err)
    );
  }, HOST_ABSENT_MS);
  room.hostAbsentTimer.unref?.();
}

/** How a device is named to its own user on their other device. */
function describeDevice(d: { deviceLabel?: string; deviceType?: "web" | "mobile" }): string {
  return d.deviceLabel || (d.deviceType === "mobile" ? "your phone" : "your browser");
}

/** The impure half of the presence rule, for one room. */
function presenceHooks(
  io: Server,
  webinarId: string,
  room: WebinarRoom
): PresenceHooks<WebinarPeer> {
  return {
    graceMs: PEER_GRACE_MS,
    onPeerLeft: (socketId, peer, reason: LeaveReason) => {
      console.log(`[webinar:presence] ${peer.userId} (${socketId}) left ${webinarId}: ${reason}`);
      io.to(webinarId).emit("webinar:peerLeft", { socketId, userId: peer.userId, reason });
      // Reconnected / replaced are the same person on a new socket, which
      // is being installed right now — not an absence.
      if (
        (peer.role === "host" || peer.role === "panelist") &&
        reason !== "reconnected" &&
        reason !== "replaced"
      ) {
        maybeStartHostAbsentClock(io, webinarId, room);
      }
    },
    onRoomEmpty: () => scheduleEmptyRoomTeardown(io, webinarId, room),
  };
}

// ── Simple per-socket rate limiter ──────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  reset: number;
}

function makeRateLimiter(maxPerMin: number) {
  const counts = new Map<string, RateLimitEntry>();

  function check(socketId: string): boolean {
    const now = Date.now();
    const entry = counts.get(socketId) || { count: 0, reset: now + 60000 };
    if (now > entry.reset) {
      entry.count = 0;
      entry.reset = now + 60000;
    }
    entry.count++;
    counts.set(socketId, entry);
    return entry.count <= maxPerMin;
  }

  check.cleanup = (socketId: string) => counts.delete(socketId);
  return check;
}

const msgRateLimit = makeRateLimiter(30);  // 30 chat msgs / min
// Reactions get their own budget. They shared the chat one, so tapping a
// few hearts spent the allowance for talking — and a rejected send used to
// vanish without a word, which reads as "my message disappeared".
const reactRateLimit = makeRateLimiter(60); // 60 reactions / min
const qaRateLimit = makeRateLimiter(10);   // 10 questions / min
const voteRateLimit = makeRateLimiter(20); // 20 votes / min

// ── Bat246 "knock" — attendee join requests awaiting host approval ──────────
//
// In-memory only, same lifetime/risk profile as the `rooms` registry in
// services/mediasoup.ts (single Node process, no persistence needed — a
// pending request that outlives a restart was never going to be answered
// anyway). Gated to the Bat246 org at creation time (webinar:requestJoin
// below) — this whole mechanism is invisible to every other org.
interface PendingJoinRequest {
  webinarId: string;
  socketId: string;
  name: string;
  createdAt: number;
  timeout: NodeJS.Timeout;
}
const pendingJoinRequests = new Map<string, PendingJoinRequest>(); // requestId -> request
const JOIN_REQUEST_TTL_MS = 15 * 60 * 1000; // safety sweep only — not a UX timeout

// ── Allowed emoji reactions ─────────────────────────────────────────────────

const ALLOWED_EMOJIS = [
  "\u{1F44D}", // thumbs up
  "\u2764\uFE0F", // red heart
  "\u{1F602}", // joy
  "\u{1F62E}", // open mouth
  "\u{1F44F}", // clap
  "\u{1F525}", // fire
  "\u{1F389}", // party
  "\u{1F4AF}", // 100
];

// ── Chat attachments ────────────────────────────────────────────────────────

/**
 * Whitelist an attachment envelope coming off the wire. Clients upload
 * straight to S3 with a presigned PUT and then send us only the metadata,
 * so every field here is untrusted: we bound the strings, force the URL to
 * be an absolute http(s) one, and collapse any unknown `kind` to "file"
 * (which renders as a plain download row). Anything malformed is dropped
 * rather than failing the whole send.
 */
function sanitizeAttachments(
  input: unknown,
): Array<{
  url: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "audio" | "file";
  durationMs?: number;
}> {
  if (!Array.isArray(input)) return [];
  const out: any[] = [];
  for (const a of input.slice(0, MAX_ATTACHMENTS)) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    if (typeof o.url !== "string" || !/^https?:\/\//i.test(o.url)) continue;
    const kindRaw = typeof o.kind === "string" ? o.kind : "";
    const durationMs =
      typeof o.durationMs === "number" && Number.isFinite(o.durationMs)
        ? Math.max(0, Math.round(o.durationMs))
        : undefined;
    out.push({
      url: o.url.slice(0, 2048),
      name: typeof o.name === "string" ? o.name.slice(0, 200) : "attachment",
      mime:
        typeof o.mime === "string"
          ? o.mime.slice(0, 120)
          : "application/octet-stream",
      size:
        typeof o.size === "number" && Number.isFinite(o.size)
          ? Math.max(0, Math.round(o.size))
          : 0,
      kind: kindRaw === "image" || kindRaw === "audio" ? kindRaw : "file",
      ...(durationMs != null ? { durationMs } : {}),
    });
  }
  return out;
}

const MAX_ATTACHMENTS = 5;

// ── Handler Registration ────────────────────────────────────────────────────

// Deterministic virtual peer identity for the note-taker bot, so clients that
// joined before the bot attached and clients that joined after both see the
// same entry in their participant list.
function botPeerIdentity(webinarId: string) {
  return {
    socketId: `bot:notetaker:${webinarId}`,
    userId: "notetaker-bot",
    name: "Note Taker",
    role: "panelist" as const,
    deviceType: "web" as const,
  };
}

/**
 * Best-effort client-kind detection from the socket's user-agent.
 *
 * The native app ships through Expo/React Native, whose HTTP stacks identify
 * as okhttp (Android) or CFNetwork/Darwin (iOS) rather than a browser UA, so
 * plain platform-token matching alone would file them as web. Anything we
 * can't place falls back to "web" — the desktop icon is the safer default for
 * an unknown client than claiming a phone.
 */
function detectDeviceType(userAgent?: string): "web" | "mobile" {
  if (!userAgent) return "web";
  return /Expo|React ?Native|okhttp|CFNetwork|Darwin|Android|iPhone|iPad|iPod|Mobile/i.test(
    userAgent
  )
    ? "mobile"
    : "web";
}

/**
 * Attach the note-taker bot to a webinar if not already attached. Safe to
 * call multiple times — idempotent via BotManager.hasBot().
 */
async function ensureNoteTakerAttached(
  io: Server,
  webinarId: string,
  workshopOrgId: mongoose.Types.ObjectId | undefined,
  hostUserId: string
): Promise<void> {
  try {
    const botManager = NoteTakerBotManager.getInstance();
    if (botManager.hasBot(webinarId)) return;

    // Register the bot as a virtual peer immediately — independent of LiveKit.
    // This ensures the bot tile appears even when LiveKit is not configured.
    const room = getRoom(webinarId);
    const bot = botPeerIdentity(webinarId);
    if (room && !room.virtualPeers.has(bot.socketId)) {
      room.virtualPeers.set(bot.socketId, bot);
      io.to(webinarId).emit("webinar:peerJoined", bot);
    }

    const noteSession = await NoteSession.create({
      roomName: webinarId,
      roomId: webinarId,
      orgId: workshopOrgId,
      botIdentity: "notetaker-bot",
      botJoinedAt: new Date(),
      startedAt: new Date(),
      participants: [],
      status: "recording",
      settings: {
        autoJoin: true,
        language: "en",
        enableSummary: true,
        enableEmailDistribution: true,
      },
    });

    // LiveKit join is best-effort — if credentials are missing the bot tile
    // still shows (registered above) but transcription will be skipped.
    let session: Awaited<ReturnType<typeof botManager.join>> | null = null;
    try {
      session = await botManager.join({
        webinarId,
        sessionId: noteSession._id as mongoose.Types.ObjectId,
        language: "en",
      });
    } catch (joinErr: any) {
      console.warn("[NoteTaker] LiveKit join failed (transcription disabled):", joinErr.message);
      noteSession.status = "failed" as any;
      noteSession.error = joinErr.message;
      await noteSession.save();
    }

    // When the bot auto-detaches, finalize the session + remove virtual peer.
    if (session) {
      session.once("disconnected", async () => {
        try {
          const r = getRoom(webinarId);
          if (r?.virtualPeers.delete(bot.socketId)) {
            io.to(webinarId).emit("webinar:peerLeft", {
              socketId: bot.socketId,
              userId: bot.userId,
              reason: "left",
            });
          }
          const ns = await NoteSession.findById(noteSession._id);
          if (ns && ns.status === "recording") {
            const now = new Date();
            ns.botLeftAt = now;
            ns.endedAt = now;
            ns.durationSeconds = Math.round(
              (now.getTime() - ns.startedAt.getTime()) / 1000
            );
            ns.status = "transcribing";
            await ns.save();
            setTimeout(() => {
              enqueueSummarize((ns._id as mongoose.Types.ObjectId).toString()).catch((err) =>
                console.error("[NoteTaker] enqueueSummarize failed:", err.message)
              );
            }, 5000);
          }
        } catch (err: any) {
          console.error("[NoteTaker] auto-finalize failed:", err.message);
        }
      });
    }

    console.log(`[NoteTaker] auto-attached to webinar ${webinarId} (host=${hostUserId}, livekit=${!!session})`);
  } catch (err: any) {
    console.error("[NoteTaker] ensureNoteTakerAttached failed (non-fatal):", err.message);
  }
}

/**
 * Persist "this item was on screen during this session" for the founder's
 * live-selling figures. The session is the one the workshop is running
 * (`currentSessionDate`), else today's UTC midnight — the same anchor the
 * start route and the viewer webhook use.
 */
async function recordPinnedSellable(
  webinarId: string,
  orgId: mongoose.Types.ObjectId,
  sessionDate: Date,
  snapshot: { itemType: string; _id: string; name?: string; price?: number; currency?: string }
): Promise<void> {
  // Garage Store ids carry the term ("<catalogId>:<termMonths>"); the pin
  // row keys on an ObjectId, so record it against the catalog half. All
  // terms of one plan therefore roll up to a single item in the figures —
  // which is what the founder wants to see anyway.
  const catalogId = String(snapshot._id).split(":")[0];
  if (!mongoose.isValidObjectId(catalogId)) return;
  const { WebinarProductPin } = await import("../models/webinarProductPin.model");
  const now = new Date();

  await WebinarProductPin.findOneAndUpdate(
    {
      workshopId: new mongoose.Types.ObjectId(webinarId),
      sessionDate,
      itemType: snapshot.itemType,
      itemId: new mongoose.Types.ObjectId(catalogId),
    },
    {
      $set: {
        orgId,
        itemName: snapshot.name,
        price: snapshot.price,
        currency: snapshot.currency,
        lastPinnedAt: now,
      },
      $setOnInsert: { firstPinnedAt: now },
      $inc: { pinCount: 1 },
    },
    { upsert: true }
  );
}

/**
 * Open attendance stints, keyed by socket id.
 *
 * Elapsed time has to be measured from the join THIS socket made, not from
 * whatever `lastJoinedAt` holds: the same socket can re-run the join
 * handshake (the mobile room screen is a pushed route), which overwrites the
 * stored stamp and would silently lose the earlier stint. Kept in memory
 * because it dies with the process anyway — a restart mid-session loses the
 * tail of that stint, which is the right trade against a database write on
 * every heartbeat.
 */
const openStints = new Map<
  string,
  { webinarId: string; sessionDate: Date; joinedAt: Date }
>();

/**
 * Record that someone is in the room. Best-effort by design: attendance is a
 * reporting concern and must never stop anyone joining a webinar.
 */
async function recordAttendanceJoin(
  webinarId: string,
  orgId: mongoose.Types.ObjectId,
  sessionDate: Date,
  socketId: string,
  who: {
    userId: string;
    name?: string;
    email?: string;
    role: "host" | "panelist" | "attendee";
  }
): Promise<void> {
  // Guests have no User document and no stable identity to report on.
  if (!mongoose.isValidObjectId(who.userId)) return;

  const now = new Date();
  // A same-socket re-join is a handshake refresh, not an arrival. The mobile
  // screen re-runs joinRoom on re-entry and on every return to the foreground
  // (its presence resync) — counting each as a join inflated joinCount, and
  // resetting joinedAt threw away the stint watched so far, so the report
  // only ever saw the tail since the last refresh.
  const prior = openStints.get(socketId);
  const sameStint =
    !!prior &&
    prior.webinarId === webinarId &&
    prior.sessionDate.getTime() === sessionDate.getTime();
  openStints.set(socketId, {
    webinarId,
    sessionDate,
    joinedAt: sameStint ? prior.joinedAt : now,
  });

  const { WebinarAttendance } = await import("../models/webinarAttendance.model");
  const key = {
    workshopId: new mongoose.Types.ObjectId(webinarId),
    sessionDate,
    userId: new mongoose.Types.ObjectId(who.userId),
  };

  // Reuses the room's own role ranking (declared at the top of this file) so
  // "which role outranks which" has one definition.
  const existing = await WebinarAttendance.findOne(key).select("role").lean();
  const keepRole =
    !!existing &&
    (ROLE_RANK[(existing as any).role] ?? 0) >= (ROLE_RANK[who.role] ?? 0);

  await WebinarAttendance.findOneAndUpdate(
    key,
    {
      $set: {
        orgId,
        lastJoinedAt: now,
        ...(who.name ? { name: who.name } : {}),
        ...(who.email ? { email: who.email } : {}),
        ...(keepRole ? {} : { role: who.role }),
      },
      $setOnInsert: { firstJoinedAt: now },
      $inc: { joinCount: sameStint ? 0 : 1 },
    },
    { upsert: true }
  );
}

/**
 * Close the stint this socket opened and add its seconds to the total.
 * A socket with no open stint (a guest, or one that joined before this
 * shipped) is a no-op.
 */
async function recordAttendanceLeave(
  socketId: string,
  userId: string
): Promise<void> {
  const stint = openStints.get(socketId);
  if (!stint) return;
  openStints.delete(socketId);
  if (!mongoose.isValidObjectId(userId)) return;

  const now = new Date();
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - stint.joinedAt.getTime()) / 1000)
  );

  const { WebinarAttendance } = await import("../models/webinarAttendance.model");
  await WebinarAttendance.updateOne(
    {
      workshopId: new mongoose.Types.ObjectId(stint.webinarId),
      sessionDate: stint.sessionDate,
      userId: new mongoose.Types.ObjectId(userId),
    },
    { $set: { lastLeftAt: now }, $inc: { totalSeconds: seconds } }
  );
}

export function registerMediasoupHandlers(io: Server, socket: Socket): void {
  const userId: string = (socket as any).userId;
  const userName: string = (socket as any).userName || (socket as any).displayName || "Anonymous";
  // Bat246 name-only demo-host bypass — see BAT246_ORG_ID usage below.
  const isDemoHost: boolean = !!(socket as any).isDemoHost;

  // ── JOIN ROOM ───────────────────────────────────────────────────────────
  socket.on(
    "webinar:joinRoom",
    async (
      {
        webinarId,
        role,
        panelistToken,
        displayName,
        deviceType: clientDeviceType,
        deviceId: clientDeviceId,
        deviceLabel: clientDeviceLabel,
        takeover,
        features,
      }: {
        webinarId: string;
        role?: string;
        panelistToken?: string;
        // Optional buyer-typed display name from the name-entry screen.
        // Takes precedence over the JWT's userName (which for brand-new
        // OTP-verified users is the email local-part placeholder). Never
        // used for authorization — attendees can only impersonate their
        // own displayed name, and the socket auth's userId still gates
        // access to the room.
        displayName?: string;
        // Explicit client-kind hint. Trusted over the user-agent sniff — the
        // native app knows what it is, the header only implies it.
        deviceType?: "web" | "mobile";
        // Stable per-device id and a human label for it. What separates "my
        // phone reconnecting" from "me, on a second device" — see the seat
        // resolution below.
        deviceId?: string;
        deviceLabel?: string;
        // The user, asked which device to use, chose this one: replace any
        // seat their other devices hold.
        takeover?: boolean;
        // Protocol capabilities. "deviceChoice": understands the
        // ALREADY_CONNECTED answer and `webinar:replacedByDevice`. Clients
        // without it keep the old behaviour (devices coexist).
        features?: string[];
      },
      callback: (res: any) => void
    ) => {
      // Set once the room is known; the empty-room check waits for it.
      let joiningRoom: WebinarRoom | null = null;
      try {
        console.log(`[webinar:joinRoom] userId=${userId}, webinarId=${webinarId}, role=${role}, hasCallback=${typeof callback === 'function'}`);

        if (!webinarId || !mongoose.isValidObjectId(webinarId)) {
          console.log(`[webinar:joinRoom] Invalid webinarId: ${webinarId}`);
          return callback({ success: false, error: "Invalid webinarId" });
        }

        // Verify role server-side
        let verifiedRole: "host" | "panelist" | "attendee" | "pre-guest" = "attendee";
        const workshop = await Workshop.findById(webinarId);
        if (!workshop) {
          console.log(`[webinar:joinRoom] Workshop not found: ${webinarId}`);
          return callback({ success: false, error: "Webinar not found" });
        }
        console.log(`[webinar:joinRoom] Workshop found: ${workshop.title}, createdBy=${workshop.createdBy}`);

        // Host = whoever runs the stream: the creator, or anyone the founder
        // delegated the `live_streams` module to (isStreamStaff folds in
        // founders and legacy fullAccess). Granting the real host role rather
        // than a co-host tier is deliberate — every downstream check in this
        // file (Meet→live, manualStartedAt, endWebinar, pinProduct,
        // startRecording, createPoll, muteUser) already keys off
        // `verifiedRole === "host"` and needs no change.
        //
        // Eligibility is not the seat. Two people can now be eligible, so the
        // host seat is claimed first-come per session — a founder who clicks
        // Start after the delegate has already gone live joins as an attendee,
        // and vice versa. One host, always.
        //
        // Staff is computed independently of the requested role, because it is
        // also what lets the person who DIDN'T start the session walk in and
        // watch — they were never an enrolled buyer, so the enrolment gate
        // below would otherwise turn them away from their own stream.
        const streamStaff = await isStreamStaff(workshop as any, userId);
        // Bat246 name-only demo-host bypass (demo-host-join in
        // publicWebinar.ts) — the synthetic identity is treated as staff
        // ONLY for this specific org's webinars, same boundary enforced at
        // token-mint time.
        const isDemoHostEligible =
          isDemoHost && (workshop as any).orgId?.toString() === BAT246_ORG_ID;

        if (role === "host" && (streamStaff || isDemoHostEligible)) {
          const claim = await claimSessionHost(workshop as any, userId);
          if (claim.isHost) {
            verifiedRole = "host";
          } else if (isDemoHostEligible) {
            // Bat246 name-only ("05" code) entry: everyone holding the code
            // comes in AS A HOST, so a second presenter isn't silently
            // demoted to attendee just because someone else started the
            // session first. The claim above still decides who OWNS the
            // session (stream/recording ownership) — losing that race means
            // you don't own it, not that you can't present.
            //
            // Deliberately gated on isDemoHostEligible, which is itself
            // limited to the Bat246 org, so every real webinar keeps
            // "one host, always" exactly as before.
            verifiedRole = "host";
            console.log(
              `[webinar:joinRoom] demo host ${userId} joining ${webinarId} as ` +
                `co-host — ${claim.hostUserId} owns the session seat`
            );
          } else {
            console.log(
              `[webinar:joinRoom] ${userId} is eligible to host ${webinarId} but ` +
                `${claim.hostUserId} already holds the seat — joining as attendee`
            );
          }
        } else if (panelistToken) {
          // Verify panelist token against workshop
          // The panelistToken is a pre-shared token the host provides to panelists
          if ((workshop as any).panelistLink === panelistToken) {
            verifiedRole = "panelist";
          }
        } else if (role === "pre-guest") {
          verifiedRole = "pre-guest";
        }

        // Billed speakers are seated as co-hosts. The founder named them on
        // the webinar (Workshop.speakers, shown under About); rather than
        // having to be promoted by hand after they walk in as attendees,
        // they arrive with the panelist seat — the same one a panelist link
        // grants. Never outranks a seat already decided above (a speaker
        // who is also the host keeps host), and a guest identity is never a
        // billed speaker since the list holds office members' user ids.
        if (verifiedRole === "attendee" && isBilledSpeaker(workshop as any, userId)) {
          verifiedRole = "panelist";
          console.log(`[webinar:joinRoom] ${userId} is a billed speaker of ${webinarId} — seating as panelist`);
        }

        // Per-session join gate — enforced for ALL per_session workshops.
        // The gate previously short-circuited when currentSessionDate was
        // unset, which meant any logged-in user could bypass the paywall
        // if the founder started via /webinar/:id/start (that path did
        // not stamp currentSessionDate). Now: no live session = nobody
        // (other than host/panelist/pre-guest) can join.
        //
        // Host + panelist bypass — they need to be able to join to run
        // the session. Pre-guest is a preview role for the pre-meeting
        // waiting room and is also exempt.
        // Staff bypass alongside host/panelist/pre-guest: the founder joining
        // a session their delegate started (or vice versa) arrives here as a
        // plain attendee and holds no enrolment, which this gate would read as
        // "hasn't paid".
        if (
          (workshop as any).enrollmentType === "per_session" &&
          !streamStaff &&
          verifiedRole !== "host" &&
          verifiedRole !== "panelist" &&
          verifiedRole !== "pre-guest"
        ) {
          try {
            if (!userId || !mongoose.isValidObjectId(userId)) {
              return callback({
                success: false,
                error: "You aren't enrolled for this session",
              });
            }
            const currentSessionDate = (workshop as any).currentSessionDate as
              | Date
              | undefined;
            if (!currentSessionDate) {
              console.log(
                `[webinar:joinRoom] No currentSessionDate on per_session workshop ${webinarId} — rejecting non-host join for user ${userId}`
              );
              return callback({
                success: false,
                error: "No session is currently live",
              });
            }
            const { hasAccess } = await hasSessionAccess(
              userId,
              webinarId,
              currentSessionDate
            );
            if (!hasAccess) {
              console.log(
                `[webinar:joinRoom] Per-session access denied for user ${userId} on workshop ${webinarId} session ${currentSessionDate}`
              );
              return callback({
                success: false,
                error: "You aren't enrolled for this session",
              });
            }
          } catch (gateErr: any) {
            console.warn(
              "[webinar:joinRoom] Per-session access check failed:",
              gateErr?.message
            );
            return callback({
              success: false,
              error: "Unable to verify session access",
            });
          }
        }

        // Bat246 (gotobigwin.com) seats EVERYONE as a co-host.
        //
        // Its webinars are run as open rooms where people are meant to speak
        // and turn a camera on, not watch. The host is excluded — they keep
        // the host seat, which outranks panelist and owns the controls.
        //
        // Deliberately placed AFTER the per-session join gate above. That gate
        // exempts host/panelist, so upgrading earlier would have handed every
        // Bat246 visitor a free pass through the enrolment check: they must
        // still qualify as an attendee first, and only then get the seat.
        //
        // The same rule is mirrored in the livekit-token route — the two role
        // decisions have to agree, or the socket seats a co-host whose token
        // says canPublish:false.
        //
        // Note what this grants: on a Bat246 webinar anyone who clears the
        // join gate can publish audio and video, including link-only guests.

        // An ended session must not be resurrected by a viewer's late
        // re-join. A viewer whose socket missed `webinarEnded` re-joins on
        // reconnect, and getOrCreateRoom would happily build a fresh room —
        // one with no host, that the office then lists as live. Staff and
        // the lobby preview are exempt: they are how a session starts.
        if (
          !getRoom(webinarId) &&
          !streamStaff &&
          verifiedRole !== "host" &&
          verifiedRole !== "panelist" &&
          verifiedRole !== "pre-guest" &&
          workshop.meetingId
        ) {
          const meet = await Meet.findById(workshop.meetingId).select("status").lean();
          if (meet?.status === "ended") {
            console.log(`[webinar:joinRoom] ${userId} tried to join ended session ${webinarId} — refusing`);
            return callback({ success: false, code: "ENDED", error: "This webinar has ended" });
          }
        }

        // Bat246 (gotobigwin.com) seats EVERYONE as a co-host.
        //
        // Its webinars are open floors: people are meant to speak and turn a
        // camera on, not watch. The host is excluded — they keep the host seat,
        // which outranks panelist and owns the controls.
        //
        // Placed LAST on purpose, after every gate above. Both the per-session
        // enrolment gate and the ended-session guard exempt panelists, so
        // upgrading earlier let a Bat246 visitor skip the paywall and
        // resurrect a session that had already ended. The rule is a grant of
        // publishing rights, not a key past the door: qualify as an attendee
        // first, get the seat second.
        //
        // Mirrored in the livekit-token route — the two role decisions must
        // agree, or the socket seats a co-host whose token says
        // canPublish:false.
        //
        // Note what this grants: anyone who clears the gates above can publish
        // audio and video here, including link-only guests.
        if (
          verifiedRole === "attendee" &&
          (workshop as any).orgId?.toString() === BAT246_ORG_ID
        ) {
          verifiedRole = "panelist";
        }

        console.log(`[webinar:joinRoom] Creating/getting room for ${webinarId}...`);
        const room = await getOrCreateRoom(webinarId);
        joiningRoom = room;
        room.joinsInFlight += 1;
        // Which session this room persists under. Fixed once, at the first
        // join, from the same anchor the host seat is keyed by — so the grants
        // and the pin land on the row the seat lives on.
        if (!room.sessionKey) room.sessionKey = resolveSessionAnchor(workshop as any);
        // A brand-new room object (first join, or the first after a restart or
        // an empty-room teardown) gets the session's grants, pin and bans back
        // before anyone reads them.
        await hydrateRoom(io, webinarId, room);
        if (userId && room.bannedUserIds.has(userId)) {
          console.log(`[webinar:joinRoom] ${userId} was removed from ${webinarId} this session — refusing`);
          return callback({ success: false, error: "You were removed from this webinar" });
        }

        // ── Seats: a reconnect, a second device, or a switch? ──────────────
        const resolvedDeviceType: "web" | "mobile" =
          clientDeviceType === "mobile" || clientDeviceType === "web"
            ? clientDeviceType
            : detectDeviceType(
                socket.handshake.headers["user-agent"] as string | undefined
              );
        const deviceId =
          typeof clientDeviceId === "string" && clientDeviceId.trim()
            ? clientDeviceId.trim().slice(0, 64)
            : undefined;
        const deviceLabel =
          typeof clientDeviceLabel === "string" && clientDeviceLabel.trim()
            ? clientDeviceLabel.trim().slice(0, 40)
            : undefined;
        const me = { deviceId, deviceType: resolvedDeviceType, deviceLabel };
        const supportsDeviceChoice =
          !!takeover || (Array.isArray(features) && features.includes("deviceChoice"));
        const hooks = presenceHooks(io, webinarId, room);

        // Same socket re-joining keeps everything (the mobile room screen
        // re-runs this handshake on every return from the mini player).
        const existing = room.peers.get(socket.id);
        /** The seat this join carries over from this device's previous socket. */
        let reclaimed: WebinarPeer | null = null;
        let previousSocketId: string | undefined;
        if (!existing) {
          const others = seatsOfUser(room, userId, socket.id);
          const mine = others.filter(([, p]) => isSameDevice(me, p));
          const foreign = others.filter(([, p]) => !isSameDevice(me, p));

          // This device coming back — a refresh, a relaunch, a socket that died
          // under it. Carry the seat over (hand state included) and tell the
          // room the old socket is gone *because* of this join, so clients
          // migrate the row rather than flash "left". Any other socket this
          // device still holds is a stale duplicate and goes the same way.
          const keep = pickActiveSeat(mine);
          for (const [sid] of mine) {
            if (keep && sid === keep[0]) continue;
            room.peers.get(sid)?.socket?.leave?.(webinarId);
            removePeer(room, sid, hooks, "reconnected");
          }
          if (keep) {
            previousSocketId = keep[0];
            keep[1].socket?.leave?.(webinarId);
            reclaimed = takeSeat(room, keep[0]) ?? null;
            console.log(
              `[webinar:presence] ${userId} back in ${webinarId} on ${socket.id} (was ${keep[0]})`
            );
            socket.to(webinarId).emit("webinar:peerLeft", {
              socketId: keep[0],
              userId,
              reason: "reconnected",
            });
          }

          if (foreign.length && supportsDeviceChoice) {
            if (!takeover) {
              // Another device of theirs holds a seat. Don't decide for them:
              // answer with the question — and without a seat, so this device
              // does not go on to connect media and evict the other one before
              // the person has chosen.
              const [, active] = pickActiveSeat(foreign)!;
              const moved = deviceId ? room.takeovers.get(deviceId) : undefined;
              const youMoved =
                !!moved?.byDeviceId &&
                foreign.some(([, p]) => !!p.deviceId && p.deviceId === moved.byDeviceId);
              console.log(
                `[webinar:presence] ${userId} asked which device for ${webinarId}: ` +
                  `${describeDevice(me)} vs ${describeDevice(active)}${youMoved ? " (moved)" : ""}`
              );
              return callback({
                success: false,
                code: "ALREADY_CONNECTED",
                error: `You're already in this webinar on ${describeDevice(active)}`,
                activeDevice: {
                  deviceType: active.deviceType,
                  deviceLabel: active.deviceLabel,
                  label: describeDevice(active),
                  connected: active.disconnectedAt == null,
                  since: active.joinedAt,
                },
                // This device's own seat was switched away from earlier — word
                // it as "you moved to X", not as a question.
                youMoved,
              });
            }
            // They chose this device. The other seats go now and are told why;
            // their media follows when this device connects, since LiveKit
            // evicts the older holder of the identity.
            for (const [sid, p] of foreign) {
              console.log(
                `[webinar:presence] ${userId} switched to ${describeDevice(me)} in ${webinarId}; ` +
                  `replacing ${sid} (${describeDevice(p)})`
              );
              p.socket?.emit?.("webinar:replacedByDevice", {
                deviceType: resolvedDeviceType,
                deviceLabel,
                label: describeDevice(me),
              });
              p.socket?.leave?.(webinarId);
              removePeer(room, sid, hooks, "replaced");
              if (p.deviceId) {
                room.takeovers.set(p.deviceId, { byDeviceId: deviceId, at: Date.now() });
              }
            }
          }
          // Clients without the feature flag coexist with their other devices,
          // exactly as before this flow existed; LiveKit still arbitrates media.
          if (!foreign.length && deviceId) room.takeovers.delete(deviceId);
        }

        console.log(`[webinar:joinRoom] Room ready, joining socket room`);
        socket.join(webinarId);

        // Fetch profile picture so other participants can show the avatar
        // when this peer's camera is off. Best-effort — guests won't have a
        // User document, in which case we silently skip.
        //
        // Name precedence (highest wins):
        //   1. Client-supplied displayName (buyer just typed this on the
        //      name-entry screen — the freshest and most user-intended).
        //   2. User.name from the DB (persisted profile).
        //   3. JWT's userName (may be an email-local-part placeholder for
        //      brand-new OTP-verified users).
        //   4. "Anonymous".
        // Also persist a fresh client-supplied name onto User.name so
        // future joins for the same user don't need re-entry.
        let avatar: string | undefined;
        let resolvedName = userName;
        const clientName = displayName?.trim();
        try {
          if (mongoose.isValidObjectId(userId)) {
            const u = await User.findById(userId)
              .select("profilePicture name")
              .lean();
            if (u?.profilePicture) avatar = u.profilePicture;
            // Prefer stored User.name over JWT placeholder.
            if ((u as any)?.name) resolvedName = (u as any).name;
            // Prefer client-supplied name over everything (freshest).
            if (clientName) {
              resolvedName = clientName;
              // Persist if the user's DB name is missing or differs.
              if (!(u as any)?.name || (u as any).name !== clientName) {
                try {
                  await User.updateOne(
                    { _id: userId },
                    { $set: { name: clientName } }
                  );
                } catch (updateErr: any) {
                  console.warn(
                    "[webinar:joinRoom] failed to persist client name:",
                    updateErr?.message
                  );
                }
              }
            }
          } else if (clientName) {
            // Guest peer (no User record) — still honor the client name.
            resolvedName = clientName;
          }
        } catch (err: any) {
          console.warn("[webinar:joinRoom] avatar lookup failed:", err?.message);
        }

        /**
         * A join is not always a first join.
         *
         * The mobile room screen is a pushed route: stepping out to the mini
         * player unmounts it and walking back in mounts a fresh one, which
         * re-runs this whole handshake on the SAME socket. What it sends is
         * the role from the join link — attendee — because the link is all a
         * new screen knows. Rebuilding the peer from that undid everything the
         * room had granted since: an in-room promotion lived only on this
         * record, so the co-host quietly became an attendee again and every
         * other client was told so.
         *
         * The room's own grant wins over whatever the link says. Only ever
         * upwards: a host demoting someone clears the grant, so the next join
         * settles back to the verified role.
         */
        const granted = userId ? room.elevatedRoles.get(userId) : undefined;
        const effectiveRole =
          granted && ROLE_RANK[granted] > ROLE_RANK[verifiedRole]
            ? granted
            : verifiedRole;

        // Same socket re-joining keeps its media plumbing. Handing it empty
        // maps orphaned every transport and producer it already had — the
        // server forgot how to close them, and `webinar:stopProducing` and
        // disconnect cleanup both quietly no-op'd on them afterwards. A seat
        // carried over from this device's previous socket keeps its hand and
        // its clock; the plumbing died with that socket.
        const carried = existing ?? reclaimed;
        room.peers.set(socket.id, {
          socket,
          userId,
          name: resolvedName,
          avatar,
          role: effectiveRole as any,
          deviceType: resolvedDeviceType,
          deviceId,
          deviceLabel,
          joinedAt: carried?.joinedAt ?? Date.now(),
          producers: existing?.producers ?? new Map(),
          consumers: existing?.consumers ?? new Map(),
          transports: existing?.transports ?? new Map(),
          handRaised: carried?.handRaised ?? false,
          disconnectedAt: null,
          graceTimer: null,
        });
        if (effectiveRole === "host" || effectiveRole === "panelist") cancelHostAbsentClock(room);

        /**
         * Durable attendance, for the host's post-webinar report. The peer
         * map above is live-room state and vanishes with the room.
         *
         * `pre-guest` is excluded: that's someone sitting in the lobby
         * preview who never entered the session, and counting them would
         * inflate the attendee list with people who only looked at the door.
         *
         * Fire-and-forget — a reporting write must never break a join.
         */
        if (effectiveRole !== "pre-guest") {
          (async () => {
            const { resolveLiveSessionKey } = await import(
              "../utils/workshopStatus"
            );
            const sessionDate = await resolveLiveSessionKey(workshop as any);
            let email: string | undefined;
            if (mongoose.isValidObjectId(userId)) {
              const u = await User.findById(userId).select("email").lean();
              email = (u as any)?.email;
            }
            await recordAttendanceJoin(
              webinarId,
              workshop.orgId,
              sessionDate,
              socket.id,
              {
                userId,
                name: resolvedName,
                email,
                role: effectiveRole as "host" | "panelist" | "attendee",
              }
            );
          })().catch((err) =>
            console.warn("[webinar:joinRoom] attendance not recorded:", err?.message)
          );
        }

        // If a real participant joins, kick any dangling pre-guest preview
        // connection from the same user (avoids duplicate entries in the list).
        if (verifiedRole !== "pre-guest") {
          const toKick: Array<[string, WebinarPeer]> = [];
          for (const [peerId, p] of room.peers) {
            if (p.userId === userId && (p.role as string) === "pre-guest" && peerId !== socket.id) {
              toKick.push([peerId, p]);
            }
          }
          for (const [peerId, p] of toKick) {
            // Remove the seat outright: a bare disconnect would now park the
            // preview in the grace window for no reason.
            removePeer(room, peerId, presenceHooks(io, webinarId, room), "left");
            try { p.socket.disconnect(true); } catch { }
          }
        }

        // When host joins, mark the Meet record live so live-all can surface it
        if (verifiedRole === "host") {
          try {
            const now = new Date();
            const fourHours = new Date(now.getTime() + 4 * 60 * 60 * 1000);
            console.log(`[webinar:joinRoom] Host joined. workshop.meetingId=${workshop.meetingId}`);

            let activeMeetId: string | null = workshop.meetingId || null;

            if (activeMeetId) {
              /**
               * `startedAt` is the SESSION's start — the clock every
               * participant reads — so a host who is already live must not
               * restamp it. Their room screen re-joins on every return from
               * the mini player, and stamping `now` each time restarted the
               * webinar's elapsed time for the whole room.
               */
              const live = await Meet.findById(activeMeetId)
                .select("status startedAt")
                .lean();
              const alreadyRunning = live?.status === "live" && !!live?.startedAt;
              const updated = await Meet.findByIdAndUpdate(
                activeMeetId,
                {
                  $set: {
                    status: "live",
                    endTime: fourHours,
                    ...(alreadyRunning ? {} : { startedAt: now }),
                  },
                },
                { new: true }
              );
              if (updated) {
                console.log(`[webinar:joinRoom] Marked Meet ${activeMeetId} as live`);
              } else {
                // Document was deleted — clear so we fall through to create
                console.warn(`[webinar:joinRoom] Meet ${activeMeetId} not found in DB, will create new`);
                activeMeetId = null;
              }
            }

            if (!activeMeetId) {
              // No meetingId on workshop (REST /start was never called) — create one now
              const host = await User.findById(userId).select("email").lean();
              const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
              const newMeet = await Meet.create({
                orgId: workshop.orgId,
                hostEmail: (host?.email || "").toLowerCase().trim(),
                title: workshop.title,
                description: workshop.description || "",
                startTime: now,
                endTime: fourHours,
                joinCode,
                agoraChannel: `ws_${webinarId}_${joinCode}`,
                status: "live",
                isHostVerified: true,
                startedAt: now,
              });
              activeMeetId = newMeet._id.toString();
              // Persist meetingId on the workshop document
              await Workshop.findByIdAndUpdate(webinarId, { $set: { meetingId: activeMeetId } });
              console.log(`[webinar:joinRoom] Created new Meet ${activeMeetId} for workshop ${webinarId}`);
            }

            emitWorkshopPreviewUpdate(
              workshop.orgId?.toString() || "",
              "workshop:preview:live",
              { workshopId: webinarId, title: workshop.title }
            );
          } catch (e) {
            console.warn("[webinar:joinRoom] Failed to mark meet live:", e);
          }
        }

        // Stamp the founder's go-live signal on the session override so the
        // prepare-join timing gate (deriveClockStatus) lets attendees in as
        // soon as the founder is actually in the room — not only once the
        // scheduled clock start passes. This stamp used to live in
        // /workshops/:id/generate-meeting, but that route also fires on
        // workshop CREATE (pre-generating the meeting URL), which false-
        // flagged Session 1 of every new workshop as Live; it was removed
        // there (workshop.ts:2786) assuming POST /webinar/:id/start covers
        // it — a route the FE never calls. Host join IS the authoritative
        // "founder is in the room" signal (it already flips Meet to live
        // just above), and it cannot false-fire at creation time.
        // Mirrors stampSessionStarted in routes/webinarRoutes.ts:324 —
        // keep the two in sync.
        if (verifiedRole === "host") {
          try {
            // For recurring / per_session workshops with no session in
            // flight, anchor to today (UTC midnight) and persist it —
            // the per-session attendee gate above reads
            // workshop.currentSessionDate, and falling back to
            // workshop.date (the recurrence seed) would sticky-flag
            // Session 1 as Live (the "Ask Chamak Live" bug).
            if (
              ((workshop as any).enrollmentType === "per_session" ||
                workshop.isRecurring) &&
              !(workshop as any).currentSessionDate
            ) {
              const today = new Date();
              today.setUTCHours(0, 0, 0, 0);
              (workshop as any).currentSessionDate = today;
              await Workshop.updateOne(
                { _id: workshop._id },
                { $set: { currentSessionDate: today } }
              );
            }
            const sessionAnchor =
              (workshop as any).currentSessionDate ||
              (workshop.isRecurring ? new Date() : workshop.date) ||
              new Date();
            const key = sessionDayKey(sessionAnchor);
            await WorkshopSessionOverride.findOneAndUpdate(
              { workshopId: workshop._id, sessionDate: key },
              {
                $set: {
                  manualStartedAt: new Date(),
                  "meta.startedBy": mongoose.isValidObjectId(userId)
                    ? new mongoose.Types.ObjectId(userId)
                    : undefined,
                },
                // A restart after an early Stop must clear the end stamp,
                // or deriveClockStatus keeps answering "completed" and
                // attendees are told the session has ended while the room
                // is live (same rationale as webinarRoutes.ts:315).
                $unset: { manualEndedAt: "", "meta.endedBy": "" },
                $setOnInsert: {
                  workshopId: workshop._id,
                  sessionDate: key,
                },
              },
              { upsert: true }
            );
            console.log(
              `[webinar:joinRoom] Stamped manualStartedAt for workshop ${webinarId} session ${key.toISOString().slice(0, 10)}`
            );
          } catch (stampErr) {
            console.warn(
              "[webinar:joinRoom] Failed to stamp manualStartedAt override:",
              stampErr
            );
          }
        }

        /**
         * When the SESSION went live, for the room's clock.
         *
         * Every client used to count from its own join, so the host saw 40:00
         * while someone who walked in late saw 0:12 — of the same webinar. The
         * elapsed time is a property of the session, not of your arrival, so
         * it has to come from the one place that knows: the Meet the host
         * stamped live.
         */
        let sessionStartedAt: string | null = null;
        try {
          if (workshop.meetingId) {
            const meet = await Meet.findById(workshop.meetingId)
              .select("startedAt")
              .lean();
            if (meet?.startedAt) {
              sessionStartedAt = new Date(meet.startedAt).toISOString();
            }
          }
        } catch (startErr: any) {
          console.warn(
            "[webinar:joinRoom] session start lookup failed:",
            startErr?.message
          );
        }

        // Auto-start note-taker on every webinar (bot attaches when the host
        // first joins; subsequent host/panelist joins are no-ops).
        if (verifiedRole === "host") {
          ensureNoteTakerAttached(
            io,
            webinarId,
            workshop.orgId as mongoose.Types.ObjectId | undefined,
            userId
          );
        }

        // Notify existing peers with `effectiveRole`, NOT `verifiedRole`.
        // Preserving the grant on the peer record was only half of it: this
        // broadcast is what every other client relabels from, so announcing
        // "attendee" demoted the co-host on their screens while the server and
        // LiveKit both still had them publishing as one.
        socket.to(webinarId).emit("webinar:peerJoined", {
          socketId: socket.id,
          userId,
          name: resolvedName,
          avatar,
          role: effectiveRole,
          deviceType: resolvedDeviceType,
          // Set when this join carried a seat over from this device's
          // previous socket.
          ...(previousSocketId ? { previousSocketId } : {}),
        });

        /**
         * Chat history for THIS session only.
         *
         * The thread is no longer wiped when a webinar ends, so a recurring
         * workshop now accumulates every night's chat under one id. Scoping
         * the load is what keeps a new session's room empty.
         *
         * Messages with no `sessionDate` are included: they pre-date the field
         * (or were written while the session key couldn't be resolved), and a
         * session in flight when this deploys must not have its chat vanish
         * mid-conversation.
         */
        let historyFilter: Record<string, unknown> = { workshopId: webinarId };
        try {
          const { resolveLiveSessionKey } = await import(
            "../utils/workshopStatus"
          );
          const key = await resolveLiveSessionKey(workshop as any);
          if (key) {
            historyFilter = {
              workshopId: webinarId,
              $or: [{ sessionDate: key }, { sessionDate: { $exists: false } }],
            };
          }
        } catch {
          /* fall back to the whole thread rather than showing none */
        }

        /**
         * Bat246 (gotobigwin) shows only the last hour of chat.
         *
         * Its rooms run long and are joined by strangers mid-flow, so an
         * hour-old conversation is noise to whoever just walked in.
         *
         * This filters on READ rather than deleting rows: the observable
         * behaviour is the same — older messages stop appearing for everyone,
         * including a rejoin — but it is reversible, and it cannot destroy a
         * message that is still on someone's screen. Say the word if the rows
         * themselves should actually be purged and I'll add a sweep.
         */
        if ((workshop as any).orgId?.toString() === BAT246_ORG_ID) {
          historyFilter = {
            ...historyFilter,
            timestamp: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
          };
        }

        /**
         * The LAST 100, not the first. Sorting ascending and taking 100 hands
         * back the opening of the session and nothing since — so past a
         * hundred messages every joiner (and every client whose post-gap
         * resync REPLACES its list from this) landed in a room showing a
         * conversation from hours ago, with their own messages nowhere in it.
         * Sorted descending to take the tail, then flipped back to oldest-first
         * because that's the order clients render in.
         */
        const messages = (
          await WebinarMessage.find(historyFilter)
            .sort({ timestamp: -1 })
            .limit(100)
            .lean()
        ).reverse();

        /**
         * Sender pictures for the history.
         *
         * A stored message keeps only userId and userName, so replayed chat
         * arrived with no avatar and the client had to hope the sender was
         * still in the room to borrow one from the roster. Anyone who had left
         * — or every message at all, on a fresh join before the roster filled
         * — rendered as bare initials.
         *
         * One query for the distinct authors, not one per message.
         */
        const avatarByUserId = new Map<string, string>();
        try {
          const authorIds = Array.from(
            new Set(
              messages
                .map((m: any) => m.userId?.toString())
                .filter((id: string | undefined): id is string =>
                  !!id && mongoose.isValidObjectId(id)
                )
            )
          );
          if (authorIds.length) {
            const authors = await User.find({ _id: { $in: authorIds } })
              .select("profilePicture")
              .lean();
            for (const a of authors) {
              if ((a as any).profilePicture) {
                avatarByUserId.set(a._id.toString(), (a as any).profilePicture);
              }
            }
          }
        } catch (avatarErr: any) {
          console.warn(
            "[webinar:joinRoom] chat avatar lookup failed:",
            avatarErr?.message
          );
        }

        /**
         * What THIS session is called.
         *
         * A recurring series can name each occurrence separately, so the room
         * header, the recording tag and the attendee tiles have to read the
         * session, not the template. Same key the chat history above scopes on
         * — `resolveLiveSessionKey` picks the occurrence actually on air.
         *
         * Falls back to the workshop's own title/cover on any failure and on
         * every unedited session, so nothing about existing rooms changes.
         */
        let sessionTitle = workshop.title;
        let sessionThumbnail = (workshop as any).thumbnail || "";
        try {
          const { resolveLiveSessionKey } = await import(
            "../utils/workshopStatus"
          );
          const { resolveEffectiveSession } = await import(
            "../utils/sessionOverlay"
          );
          const liveKey = await resolveLiveSessionKey(workshop as any);
          const liveOverride = await WorkshopSessionOverride.findOne({
            workshopId: workshop._id,
            sessionDate: liveKey,
          }).lean();
          if (liveOverride) {
            const effective = resolveEffectiveSession(
              workshop as any,
              liveKey,
              liveOverride as any
            );
            sessionTitle = effective.title;
            sessionThumbnail = effective.thumbnail || sessionThumbnail;
          }
        } catch (overlayErr: any) {
          console.warn(
            "[webinar:joinRoom] session overlay lookup failed:",
            overlayErr?.message
          );
        }

        const responseData = {
          // What the room says they are, so a re-joining co-host is told they
          // are still a co-host rather than having to infer it from LiveKit.
          success: true,
          role: effectiveRole,
          webinarTitle: sessionTitle,
          // The stream's own cover art. The room header used to headline the
          // host's face, which changes with whoever started the session — the
          // cover is a property of the stream, so it stays put.
          webinarThumbnail: sessionThumbnail,
          recordingMode: (workshop as any).recordingMode || "manual",
          // ISO string, or null if the host has not started it yet.
          startedAt: sessionStartedAt,
          // Whether a recording is running RIGHT NOW. Only the start/stop
          // broadcasts carried this, so anyone who joined mid-recording was
          // never told — they sat through a recorded session with no badge.
          recording: room.recording || isServerRecording(webinarId),
          // Echo the caller's resolved avatar so their own self-tile in the
          // grid can render the profile picture when their camera is off.
          // The auth-store User type doesn't carry profilePicture, so we
          // surface it here once at join time.
          myAvatar: avatar,
          // As the room has it — the client's own toggle is optimistic, and a
          // seat taken over from a dropped socket keeps the hand it had.
          handRaised: room.peers.get(socket.id)?.handRaised ?? false,
          previousSocketId,
          rtpCapabilities: room.router.rtpCapabilities,
          chatHistory: messages.map((m: any) => ({
            id: m._id.toString(),
            userId: m.userId.toString(),
            name: m.userName,
            avatar: avatarByUserId.get(m.userId.toString()),
            text: m.text,
            replyTo: m.replyTo,
            attachments: m.attachments,
            // Emitted as-is (emoji -> userIds) so a joiner sees existing
            // reaction chips, and their own "you reacted" state, straight
            // from history rather than waiting for the next live event.
            reactions: m.reactions,
            // Lets a re-joining user still see which messages tagged them.
            mentions: m.mentions,
            timestamp: m.timestamp,
          })),
          qaQuestions: room.qaQuestions,
          polls: room.polls,
          peers: rosterFor(room, socket.id),
          pinnedProduct: room.pinnedProduct,
        };

        // Serialize rtpCapabilities to ensure it's plain JSON (no mediasoup internal refs)
        const safeRtpCapabilities = JSON.parse(JSON.stringify(room.router.rtpCapabilities));
        responseData.rtpCapabilities = safeRtpCapabilities;

        console.log(`[webinar:joinRoom] Sending callback - success, role=${verifiedRole}, peers=${room.peers.size - 1}`);
        callback(responseData);
      } catch (err: any) {
        console.error("[webinar:joinRoom] error:", err);
        callback({ success: false, error: err.message });
      } finally {
        if (joiningRoom) {
          joiningRoom.joinsInFlight = Math.max(0, joiningRoom.joinsInFlight - 1);
        }
      }
    }
  );

  // ── BAT246 KNOCK: REQUEST TO JOIN ────────────────────────────────────────
  //
  // Sent by WebinarPreJoin BEFORE it ever calls webinar:joinRoom, once OTP
  // is verified and the webinar is confirmed live. Does not itself grant
  // room access — it only asks the current host to let this visitor
  // through. The actual join still runs the full, unmodified
  // webinar:joinRoom flow above once approved. Org-gated: this is a no-op
  // for every workshop outside Bat246.
  socket.on(
    "webinar:requestJoin",
    async (
      { webinarId, displayName }: { webinarId: string; displayName?: string },
      callback: (res: any) => void
    ) => {
      try {
        if (!webinarId || !mongoose.isValidObjectId(webinarId)) {
          return callback({ success: false, error: "Invalid webinarId" });
        }
        const workshop = await Workshop.findById(webinarId).select("orgId").lean();
        if (!workshop) {
          return callback({ success: false, error: "Webinar not found" });
        }
        if ((workshop as any).orgId?.toString() !== BAT246_ORG_ID) {
          return callback({ success: false, error: "Not available for this webinar" });
        }

        // Dedupe: this socket already has a pending request for this
        // webinar — hand back the same requestId instead of spamming the
        // host with duplicates (e.g. a double-click, or a re-mount).
        for (const [existingId, req] of pendingJoinRequests) {
          if (req.socketId === socket.id && req.webinarId === webinarId) {
            return callback({ success: true, requestId: existingId });
          }
        }

        const name = (displayName || userName || "Guest").trim().slice(0, 80) || "Guest";

        const findHostSocketId = async (): Promise<string | null> => {
          const room = await getOrCreateRoom(webinarId);
          for (const [sid, peer] of room.peers) {
            if ((peer as any).role === "host" && peer.disconnectedAt == null) return sid;
          }
          return null;
        };

        let hostSocketId = await findHostSocketId();
        if (!hostSocketId) {
          // Host briefly disconnected (network blip) even though the
          // webinar is marked live — give it one short retry before
          // failing closed.
          await new Promise((r) => setTimeout(r, 2000));
          hostSocketId = await findHostSocketId();
        }
        if (!hostSocketId) {
          return callback({ success: false, error: "NO_HOST" });
        }

        const requestId = new mongoose.Types.ObjectId().toString();
        const timeout = setTimeout(() => {
          const pending = pendingJoinRequests.get(requestId);
          if (!pending) return;
          pendingJoinRequests.delete(requestId);
          io.to(pending.socketId).emit("webinar:joinDenied", {
            requestId,
            reason: "timeout",
          });
        }, JOIN_REQUEST_TTL_MS);

        pendingJoinRequests.set(requestId, {
          webinarId,
          socketId: socket.id,
          name,
          createdAt: Date.now(),
          timeout,
        });

        io.to(hostSocketId).emit("webinar:joinRequest", { requestId, name });
        callback({ success: true, requestId });
      } catch (err: any) {
        console.error("[webinar:requestJoin] error:", err);
        callback({ success: false, error: "Failed to request to join" });
      }
    }
  );

  // ── BAT246 KNOCK: HOST RESPONDS ──────────────────────────────────────────
  socket.on(
    "webinar:respondJoinRequest",
    async (
      { requestId, approve }: { requestId: string; approve: boolean },
      callback?: (res: any) => void
    ) => {
      try {
        const pending = pendingJoinRequests.get(requestId);
        if (!pending) {
          return callback?.({ success: false, error: "Request expired" });
        }
        // Same authorization shape as every other host-only action in this
        // file (mute, remove, promote): the responder must hold the host
        // seat in THIS room right now.
        const room = await getOrCreateRoom(pending.webinarId);
        const responder = room.peers.get(socket.id);
        if (!responder || (responder as any).role !== "host") {
          return callback?.({ success: false, error: "Not authorized" });
        }

        clearTimeout(pending.timeout);
        pendingJoinRequests.delete(requestId);
        io.to(pending.socketId).emit(
          approve ? "webinar:joinApproved" : "webinar:joinDenied",
          { requestId }
        );
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:respondJoinRequest] error:", err);
        callback?.({ success: false, error: "Failed to respond" });
      }
    }
  );

  // ── BAT246 KNOCK: VISITOR CANCELS ────────────────────────────────────────
  socket.on(
    "webinar:cancelJoinRequest",
    ({ requestId }: { requestId: string }) => {
      const pending = pendingJoinRequests.get(requestId);
      if (!pending || pending.socketId !== socket.id) return;
      clearTimeout(pending.timeout);
      pendingJoinRequests.delete(requestId);
    }
  );

  // ── CREATE WEBRTC TRANSPORT ─────────────────────────────────────────────
  socket.on(
    "webinar:createWebRtcTransport",
    async (
      { webinarId, consuming }: { webinarId: string; consuming: boolean },
      callback: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback({ success: false, error: "Room not found" });

        const peer = room.peers.get(socket.id);
        if (!peer) return callback({ success: false, error: "Peer not found in room" });

        const { transport, params } = await createWebRtcTransport(room.router);
        peer.transports.set(transport.id, transport);

        console.log(`[webinar:createWebRtcTransport] created id=${transport.id} consuming=${consuming} for socket=${socket.id}`);

        transport.on("dtlsstatechange", (state: string) => {
          console.log(`[mediasoup] transport ${transport.id} (consuming=${consuming}) DTLS state: ${state}`);
          if (state === "closed") transport.close();
        });
        transport.on("icestatechange", (state: string) => {
          console.log(`[mediasoup] transport ${transport.id} (consuming=${consuming}) ICE state: ${state}`);
        });

        callback({ success: true, params });
      } catch (err: any) {
        console.error("[webinar:createWebRtcTransport] error:", err);
        callback({ success: false, error: err.message });
      }
    }
  );

  // ── CONNECT TRANSPORT ───────────────────────────────────────────────────
  socket.on(
    "webinar:connectTransport",
    async (
      {
        webinarId,
        transportId,
        dtlsParameters,
      }: { webinarId: string; transportId: string; dtlsParameters: any },
      callback: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback({ success: false, error: "Room not found" });

        const peer = room.peers.get(socket.id);
        const transport = peer?.transports.get(transportId);
        if (!transport) return callback({ success: false, error: "Transport not found" });

        await transport.connect({ dtlsParameters });
        callback({ success: true });
      } catch (err: any) {
        console.error("[webinar:connectTransport] error:", err);
        callback({ success: false, error: err.message });
      }
    }
  );

  // ── PRODUCE ─────────────────────────────────────────────────────────────
  socket.on(
    "webinar:produce",
    async (
      {
        webinarId,
        transportId,
        kind,
        rtpParameters,
        appData,
      }: {
        webinarId: string;
        transportId: string;
        kind: "audio" | "video";
        rtpParameters: any;
        appData?: any;
      },
      callback: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback({ success: false, error: "Room not found" });

        const peer = room.peers.get(socket.id);
        if (!peer) return callback({ success: false, error: "Peer not found" });

        // Only host/panelist can produce media
        if (!["host", "panelist"].includes(peer.role)) {
          return callback({ success: false, error: "Attendees cannot produce media" });
        }

        const transport = peer.transports.get(transportId);
        if (!transport) return callback({ success: false, error: "Transport not found" });

        const producer = await (transport as any).produce({
          kind,
          rtpParameters,
          appData: appData || {},
        });
        peer.producers.set(producer.id, producer);

        console.log(`[webinar:produce] created producer ${producer.id} kind=${kind} appData=${JSON.stringify(appData || {})} socket=${socket.id}`);

        producer.on("transportclose", () => {
          producer.close();
          peer.producers.delete(producer.id);
        });

        // Notify other peers about the new producer
        const room2 = getRoom(webinarId);
        const otherCount = room2 ? room2.peers.size - 1 : 0;
        console.log(`[webinar:produce] broadcasting newProducer to ${otherCount} other peer(s) in room ${webinarId}`);
        socket.to(webinarId).emit("webinar:newProducer", {
          producerId: producer.id,
          producerSocketId: socket.id,
          kind,
          appData,
        });

        callback({ success: true, producerId: producer.id });
      } catch (err: any) {
        console.error("[webinar:produce] error:", err);
        callback({ success: false, error: err.message });
      }
    }
  );

  // ── CONSUME ─────────────────────────────────────────────────────────────
  socket.on(
    "webinar:consume",
    async (
      {
        webinarId,
        transportId,
        producerId,
        rtpCapabilities,
      }: {
        webinarId: string;
        transportId: string;
        producerId: string;
        rtpCapabilities: any;
      },
      callback: (res: any) => void
    ) => {
      try {
        if (!producerId || !rtpCapabilities) {
          return callback({ success: false, error: "Missing producerId or rtpCapabilities" });
        }

        const room = getRoom(webinarId);
        if (!room) return callback({ success: false, error: "Room not found" });

        if (!room.router.canConsume({ producerId, rtpCapabilities })) {
          return callback({ success: false, error: "Cannot consume this producer" });
        }

        const peer = room.peers.get(socket.id);
        const transport = peer?.transports.get(transportId);
        if (!transport) return callback({ success: false, error: "Transport not found" });

        // Look up producer's appData so the consumer inherits it
        let producerAppData: any = {};
        for (const [, p] of room.peers) {
          const prod = p.producers.get(producerId);
          if (prod) {
            producerAppData = prod.appData || {};
            break;
          }
        }

        // Create consumer as paused, then resume immediately server-side
        // This avoids the unreliable two-step resume flow
        const consumer = await (transport as any).consume({
          producerId,
          rtpCapabilities,
          paused: true,
          appData: producerAppData,
        });
        peer!.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          consumer.close();
          peer!.consumers.delete(consumer.id);
        });

        consumer.on("producerclose", () => {
          // Find which peer owned this producer so the client can clean up the right stream
          let producerSocketId: string | null = null;
          for (const [sid, p] of room.peers) {
            if (p.producers.has(producerId)) {
              producerSocketId = sid;
              break;
            }
          }
          consumer.close();
          peer!.consumers.delete(consumer.id);
          socket.emit("webinar:consumerClosed", {
            consumerId: consumer.id,
            producerSocketId,
            kind: consumer.kind,
            appData: consumer.appData,
          });
        });

        // Resume immediately on server side so RTP flows as soon as
        // the client's recv transport DTLS connects
        await consumer.resume();
        console.log(`[webinar:consume] consumer ${consumer.id} created+resumed for producer ${producerId} (${consumer.kind})`);

        callback({
          success: true,
          params: {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
            appData: consumer.appData,
          },
        });
      } catch (err: any) {
        console.error("[webinar:consume] error:", err);
        callback({ success: false, error: err.message });
      }
    }
  );

  // ── CLOSE PRODUCER (client explicitly stops a producer) ─────────────────
  socket.on(
    "webinar:closeProducer",
    ({ webinarId, producerId }: { webinarId: string; producerId: string }) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return;
        const peer = room.peers.get(socket.id);
        if (!peer) return;
        const producer = peer.producers.get(producerId);
        if (producer) {
          const appDataType = (producer.appData as any)?.type;
          producer.close();
          peer.producers.delete(producerId);
          // Direct broadcast for screen share — don't rely on consumer close chain
          if (appDataType === "screen" || appDataType === "screenAudio") {
            socket.to(webinarId).emit("webinar:screenShareStopped", {
              producerSocketId: socket.id,
              type: appDataType,
            });
          }
        }
      } catch (err: any) {
        console.error("[webinar:closeProducer] error:", err.message);
      }
    }
  );

  // ── RESUME CONSUMER ─────────────────────────────────────────────────────
  socket.on(
    "webinar:resumeConsumer",
    async (
      { webinarId, consumerId }: { webinarId: string; consumerId: string },
      callback?: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        const peer = room?.peers.get(socket.id);
        const consumer = peer?.consumers.get(consumerId);
        if (!consumer) {
          console.warn(`[webinar:resumeConsumer] consumer ${consumerId} not found for socket ${socket.id}`);
          callback?.({ success: false, error: "Consumer not found" });
          return;
        }
        await consumer.resume();
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── GET PRODUCERS ───────────────────────────────────────────────────────
  socket.on(
    "webinar:getProducers",
    (
      { webinarId }: { webinarId: string },
      callback: (producers: any[]) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback([]);

      const producers: any[] = [];
      room.peers.forEach((peer, socketId) => {
        if (socketId !== socket.id) {
          peer.producers.forEach((producer) => {
            producers.push({
              producerId: producer.id,
              producerSocketId: socketId,
              kind: producer.kind,
              appData: producer.appData,
            });
          });
        }
      });
      console.log(`[webinar:getProducers] socket=${socket.id} returning ${producers.length} producers (room has ${room.peers.size} peers)`);
      callback(producers);
    }
  );

  // ── CHAT ────────────────────────────────────────────────────────────────
  socket.on(
    "webinar:sendMessage",
    async (
      {
        webinarId,
        text,
        replyTo,
        attachments,
        mentions,
      }: {
        webinarId: string;
        text: string;
        // Files already uploaded to S3 by the client (presigned PUT).
        // We only store the metadata envelope, never proxy the bytes.
        attachments?: Array<Record<string, unknown>>;
        // userIds the sender tagged. Resolved client-side from the roster,
        // then checked against the room here — see below.
        mentions?: unknown;
        // Optional reply-to snapshot. Sender denormalises a copy of the
        // original message so quoted previews survive even if the
        // original is deleted or paginated out.
        replyTo?: {
          id?: string;
          userId?: string;
          name?: string;
          snippet?: string;
        };
      },
      callback?: (res: any) => void
    ) => {
      try {
        if (!msgRateLimit(socket.id)) {
          return callback?.({ success: false, error: "Sending too fast. Slow down." });
        }
        const clean = (text || "").trim().slice(0, 1000);
        const cleanAttachments = sanitizeAttachments(attachments);
        // A message must carry something — text or at least one file.
        if (!clean && cleanAttachments.length === 0) {
          return callback?.({ success: false, error: "Empty message" });
        }

        // Validate the reply target. We only accept a fully-formed snapshot —
        // missing fields drop the reply silently rather than failing the send.
        const cleanReply =
          replyTo &&
            typeof replyTo.id === "string" &&
            typeof replyTo.userId === "string" &&
            typeof replyTo.name === "string" &&
            typeof replyTo.snippet === "string"
            ? {
              id: replyTo.id.slice(0, 64),
              userId: replyTo.userId.slice(0, 64),
              name: replyTo.name.slice(0, 80),
              snippet: replyTo.snippet.slice(0, 200),
            }
            : undefined;

        // Tagged users. The client resolves "@Name" against its roster, but
        // the ids are still checked against who is actually in the room —
        // otherwise a crafted payload could ping anyone on the platform, and
        // the mention alert is a notification primitive. Capped, deduped,
        // and self-mentions dropped so nobody pings themselves.
        const roomPeers = getRoom(webinarId)?.peers;
        const inRoom = new Set<string>();
        if (roomPeers) {
          for (const p of roomPeers.values()) {
            if (p.userId) inRoom.add(String(p.userId));
          }
        }
        const cleanMentions = Array.isArray(mentions)
          ? Array.from(
            new Set(
              mentions
                .filter((m): m is string => typeof m === "string")
                .map((m) => m.trim())
                .filter((m) => m && m !== userId && inRoom.has(m))
            )
          ).slice(0, 20)
          : [];

        // Which run of a recurring workshop this belongs to. Stamped so the
        // live room can load one session's thread without the chat history
        // having to be deleted between runs (see webinar:endWebinar).
        // Best-effort: a message is worth more than its session label, so a
        // failure here stores it unstamped rather than dropping it.
        let msgSessionDate: Date | undefined;
        try {
          const { resolveLiveSessionKey } = await import(
            "../utils/workshopStatus"
          );
          const ws = await Workshop.findById(webinarId).lean();
          if (ws) msgSessionDate = await resolveLiveSessionKey(ws as any);
        } catch {
          /* unstamped — still readable, just not session-scoped */
        }

        const msg = await WebinarMessage.create({
          workshopId: webinarId,
          userId,
          userName,
          text: clean,
          replyTo: cleanReply,
          attachments: cleanAttachments.length ? cleanAttachments : undefined,
          mentions: cleanMentions.length ? cleanMentions : undefined,
          sessionDate: msgSessionDate,
        });

        const payload = {
          id: msg._id.toString(),
          userId,
          name: userName,
          // The sender's picture, resolved once at join and held on the peer.
          // Clients had to guess it by cross-referencing the roster, so a
          // message from anyone who had since left showed a blank avatar.
          avatar: getRoom(webinarId)?.peers.get(socket.id)?.avatar,
          text: clean,
          replyTo: cleanReply,
          attachments: cleanAttachments.length ? cleanAttachments : undefined,
          mentions: cleanMentions.length ? cleanMentions : undefined,
          timestamp: msg.timestamp,
        };
        io.to(webinarId).emit("webinar:newMessage", payload);
        /**
         * The sender may not be IN the room they just posted to, and then
         * `io.to(...)` above is the one place their own message doesn't reach.
         *
         * Room membership belongs to the socket, so it dies with the
         * connection and is only restored by an acked webinar:joinRoom. A
         * client that emits during a reconnect gets there first: socket.io
         * flushes packets buffered during the outage BEFORE it fires the
         * `connect` event the client re-joins from. No client renders its own
         * message locally — every one of them waits for this echo — so the
         * whole room saw a message its author never did, and the ack below
         * told them it was fine. Reported, reasonably, as "I'm sending
         * messages but they don't appear".
         *
         * The message is stored and delivered either way; this only makes
         * sure the person who wrote it is told so too.
         */
        if (!socket.rooms.has(webinarId)) {
          socket.emit("webinar:newMessage", payload);
        }
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:sendMessage] error:", err);
        callback?.({ success: false, error: "Failed to send message" });
      }
    }
  );

  /**
   * Toggle an emoji reaction on a chat message.
   *
   * Storage is emoji -> userIds, and the write is a single atomic
   * $addToSet/$pull on the dotted path so two people reacting at the same
   * instant can't overwrite each other (a read-modify-write of the whole
   * map would lose one of them). The toggle direction is decided from the
   * document we just read; a duplicate/retried event is harmless because
   * $addToSet and $pull are both idempotent.
   *
   * We broadcast the full reactions map for the message rather than a
   * delta, so a client that missed an earlier event still converges.
   */
  socket.on(
    "webinar:reactToMessage",
    async (
      {
        webinarId,
        messageId,
        emoji,
      }: { webinarId: string; messageId: string; emoji: string },
      callback?: (res: any) => void
    ) => {
      try {
        if (!reactRateLimit(socket.id)) {
          return callback?.({ success: false, error: "Too fast. Slow down." });
        }
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) {
          return callback?.({ success: false, error: "Invalid message" });
        }
        // Bounded set only — `reactions` is a Mixed map, so an arbitrary
        // key here would let a client write anything into the document.
        if (!ALLOWED_EMOJIS.includes(emoji)) {
          return callback?.({ success: false, error: "Unsupported emoji" });
        }

        const existing = await WebinarMessage.findOne({
          _id: messageId,
          workshopId: webinarId,
        })
          .select({ reactions: 1 })
          .lean();
        if (!existing) {
          return callback?.({ success: false, error: "Message not found" });
        }

        const current: string[] =
          ((existing as any).reactions || {})[emoji] || [];
        const hasReacted = current.includes(userId);
        const path = `reactions.${emoji}`;

        await WebinarMessage.updateOne(
          { _id: messageId, workshopId: webinarId },
          hasReacted
            ? { $pull: { [path]: userId } }
            : { $addToSet: { [path]: userId } }
        );

        const updated = await WebinarMessage.findById(messageId)
          .select({ reactions: 1 })
          .lean();

        // Drop emptied buckets so clients never render a zero-count chip.
        const reactions: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(
          ((updated as any)?.reactions || {}) as Record<string, string[]>
        )) {
          if (Array.isArray(v) && v.length) reactions[k] = v;
        }

        io.to(webinarId).emit("webinar:messageReaction", {
          messageId,
          reactions,
        });
        callback?.({ success: true, reactions });
      } catch (err: any) {
        console.error("[webinar:reactToMessage] error:", err);
        callback?.({ success: false, error: "Failed to react" });
      }
    }
  );

  // ── Q&A ─────────────────────────────────────────────────────────────────
  socket.on(
    "webinar:sendQA",
    (
      { webinarId, question }: { webinarId: string; question: string },
      callback?: (res: any) => void
    ) => {
      try {
        if (!qaRateLimit(socket.id)) {
          return callback?.({ success: false, error: "Too many questions" });
        }
        if (!question?.trim()) {
          return callback?.({ success: false, error: "Empty question" });
        }
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });

        const qa = {
          id: `${socket.id}-${Date.now()}`,
          userId,
          userName,
          question: question.trim().slice(0, 500),
          upvotes: 0,
          upvotedBy: [] as string[],
          answered: false,
          timestamp: new Date(),
        };
        room.qaQuestions.push(qa);
        io.to(webinarId).emit("webinar:newQA", qa);
        callback?.({ success: true, qa });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on(
    "webinar:upvoteQA",
    (
      { webinarId, questionId }: { webinarId: string; questionId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const qa = room.qaQuestions.find((q: any) => q.id === questionId);
      if (qa && !qa.upvotedBy.includes(userId)) {
        qa.upvotes++;
        qa.upvotedBy.push(userId);
        io.to(webinarId).emit("webinar:qaUpdated", qa);
        callback?.({ success: true });
      } else {
        callback?.({ success: false, error: "Already upvoted" });
      }
    }
  );

  socket.on(
    "webinar:answerQA",
    (
      { webinarId, questionId }: { webinarId: string; questionId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (!peer || !["host", "panelist"].includes(peer.role)) {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      const qa = room.qaQuestions.find((q: any) => q.id === questionId);
      if (qa) {
        qa.answered = true;
        io.to(webinarId).emit("webinar:qaUpdated", qa);
      }
      callback?.({ success: true });
    }
  );

  // ── POLLS ───────────────────────────────────────────────────────────────
  socket.on(
    "webinar:createPoll",
    (
      {
        webinarId,
        question,
        options,
      }: { webinarId: string; question: string; options: string[] },
      callback?: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });
        const peer = room.peers.get(socket.id);
        if (!peer || peer.role !== "host") {
          return callback?.({ success: false, error: "Host only" });
        }

        if (!question?.trim()) {
          return callback?.({ success: false, error: "Question required" });
        }
        if (!Array.isArray(options) || options.length < 2 || options.length > 10) {
          return callback?.({ success: false, error: "2-10 options required" });
        }

        const poll = {
          id: `poll-${Date.now()}`,
          question: question.trim().slice(0, 300),
          options: options
            .filter((o) => typeof o === "string" && o.trim())
            .slice(0, 10)
            .map((opt, i) => ({
              id: i.toString(),
              text: opt.trim().slice(0, 200),
              votes: 0,
            })),
          votedBy: [] as string[],
          createdAt: new Date(),
        };
        room.polls.push(poll);
        io.to(webinarId).emit("webinar:newPoll", poll);
        callback?.({ success: true, poll });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  socket.on(
    "webinar:submitVote",
    (
      {
        webinarId,
        pollId,
        optionId,
      }: { webinarId: string; pollId: string; optionId: string },
      callback?: (res: any) => void
    ) => {
      if (!voteRateLimit(socket.id)) {
        return callback?.({ success: false, error: "Too fast" });
      }
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const poll = room.polls.find((p: any) => p.id === pollId);
      if (!poll) return callback?.({ success: false, error: "Poll not found" });
      if (poll.votedBy.includes(userId)) {
        return callback?.({ success: false, error: "Already voted" });
      }
      const option = poll.options.find((o: any) => o.id === optionId);
      if (!option) return callback?.({ success: false, error: "Option not found" });
      option.votes++;
      poll.votedBy.push(userId);
      io.to(webinarId).emit("webinar:pollUpdated", poll);
      callback?.({ success: true });
    }
  );

  // ── HOST CONTROLS ───────────────────────────────────────────────────────

  socket.on(
    "webinar:muteParticipant",
    (
      { webinarId, targetSocketId }: { webinarId: string; targetSocketId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (!peer || !["host", "panelist"].includes(peer.role)) {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      io.to(targetSocketId).emit("webinar:forceMuted");
      callback?.({ success: true });
    }
  );

  socket.on(
    "webinar:removeParticipant",
    (
      { webinarId, targetSocketId }: { webinarId: string; targetSocketId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (!peer || !["host", "panelist"].includes(peer.role)) {
        return callback?.({ success: false, error: "Unauthorized" });
      }

      const target = room.peers.get(targetSocketId);
      // The seat is arbitrated elsewhere (claimSessionHost); a co-host must not
      // be able to end the host's session with a tap.
      if (target?.role === "host") {
        return callback?.({ success: false, error: "The host cannot be removed" });
      }

      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.emit("webinar:removedFromRoom");
        targetSocket.leave(webinarId);
        setTimeout(() => targetSocket.disconnect(true), 500);
      }
      // Being removed ends the grant too — otherwise a kicked co-host walks
      // back in through the join link still elevated. It also ends their
      // session: the join link is one tap away, and a kick that only closed
      // a socket was undone by it.
      const removed = removePeer(
        room,
        targetSocketId,
        presenceHooks(io, webinarId, room),
        "removed"
      );
      if (removed?.userId) {
        room.elevatedRoles.delete(removed.userId);
        persistLiveState(webinarId, room, "elevatedRoles");
        room.bannedUserIds.add(removed.userId);
        persistLiveState(webinarId, room, "bannedUserIds");
      }
      callback?.({ success: true });
    }
  );

  socket.on(
    "webinar:promoteToHost",
    async (
      { webinarId, targetSocketId }: { webinarId: string; targetSocketId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (!peer || !["host", "panelist"].includes(peer.role)) {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      const targetPeer = room.peers.get(targetSocketId);
      if (targetPeer) {
        targetPeer.role = "panelist";
        // Remember it against the USER, not just this socket: their room
        // screen re-joins on every return from the mini player, and a
        // reconnect brings a whole new socket.id. Both used to land back at
        // the join link's attendee.
        if (targetPeer.userId) {
          room.elevatedRoles.set(targetPeer.userId, "panelist");
          persistLiveState(webinarId, room, "elevatedRoles");
        }
        // Upgrade their LiveKit grant in-place so they can publish without
        // reconnecting. Identity in LiveKit is the user's userId.
        setParticipantPublishGrant(
          webinarRoomName(webinarId),
          targetPeer.userId,
          true
        ).catch(() => { });
        io.to(targetSocketId).emit("webinar:roleChanged", { role: "panelist" });
        io.to(webinarId).emit("webinar:peerRoleChanged", {
          socketId: targetSocketId,
          role: "panelist",
        });
      }
      callback?.({ success: true });
    }
  );

  socket.on(
    "webinar:demoteToAttendee",
    async (
      { webinarId, targetSocketId }: { webinarId: string; targetSocketId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (!peer || !["host", "panelist"].includes(peer.role)) {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      // A co-host standing down passes their own socket. That was always
      // permitted by the check above, but the client had no way to tell the
      // difference, so a voluntary step-down was announced as if someone had
      // done it TO them. The flag below lets it be worded honestly.
      const isSelf = targetSocketId === socket.id;
      const targetPeer = room.peers.get(targetSocketId);
      if (targetPeer) {
        targetPeer.role = "attendee";
        // Drop the grant, so the next join settles back to the verified role
        // instead of inheriting a co-host they no longer are.
        if (targetPeer.userId) {
          room.elevatedRoles.delete(targetPeer.userId);
          persistLiveState(webinarId, room, "elevatedRoles");
        }
        // Revoke publish on LiveKit. Their already-published tracks will be
        // unpublished by the server.
        setParticipantPublishGrant(
          webinarRoomName(webinarId),
          targetPeer.userId,
          false
        ).catch(() => { });
        io.to(targetSocketId).emit("webinar:roleChanged", {
          role: "attendee",
          self: isSelf,
        });
        io.to(webinarId).emit("webinar:peerRoleChanged", {
          socketId: targetSocketId,
          role: "attendee",
        });
      }
      callback?.({ success: true });
    }
  );

  // ── HAND RAISE ──────────────────────────────────────────────────────────
  socket.on(
    "webinar:raiseHand",
    (
      { webinarId }: { webinarId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false });
      const peer = room.peers.get(socket.id);
      if (peer) {
        peer.handRaised = !peer.handRaised;
        io.to(webinarId).emit("webinar:handRaised", {
          socketId: socket.id,
          userId,
          name: userName,
          raised: peer.handRaised,
        });
      }
      callback?.({ success: true });
    }
  );

  // ── MIC STATE (broadcast to peers) ──────────────────────────────────────
  socket.on(
    "webinar:micState",
    ({ webinarId, muted }: { webinarId: string; muted: boolean }) => {
      socket.to(webinarId).emit("webinar:peerMicState", {
        socketId: socket.id,
        muted: !!muted,
      });
    }
  );

  // ── CAMERA STATE (broadcast to peers) ───────────────────────────────────
  // Mediasoup pauses tracks rather than ending them when the producer
  // toggles camera off, and the inbound `mute`/`unmute` events don't
  // always reach the receiver in time on flaky networks. Relaying the
  // explicit on/off signal lets viewers swap to the avatar overlay
  // immediately instead of holding on the last frozen frame.
  socket.on(
    "webinar:cameraState",
    ({ webinarId, enabled }: { webinarId: string; enabled: boolean }) => {
      socket.to(webinarId).emit("webinar:peerCameraState", {
        socketId: socket.id,
        enabled: !!enabled,
      });
    }
  );

  // ── UPDATE DISPLAY NAME ─────────────────────────────────────────────────
  socket.on(
    "webinar:updateName",
    (
      { webinarId, name }: { webinarId: string; name: string },
      callback?: (res: any) => void
    ) => {
      try {
        const cleanName = (name || "").trim().slice(0, 50);
        if (!cleanName) {
          return callback?.({ success: false, error: "Name cannot be empty" });
        }
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });
        const peer = room.peers.get(socket.id);
        if (!peer) return callback?.({ success: false, error: "Peer not found" });
        peer.name = cleanName;
        io.to(webinarId).emit("webinar:peerNameChanged", {
          socketId: socket.id,
          name: cleanName,
        });
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── EMOJI REACTION ──────────────────────────────────────────────────────
  socket.on(
    "webinar:sendReaction",
    ({ webinarId, emoji }: { webinarId: string; emoji: string }) => {
      if (!ALLOWED_EMOJIS.includes(emoji)) return;
      const room = getRoom(webinarId);
      if (!room) return;
      const peer = room.peers.get(socket.id);
      io.to(webinarId).emit("webinar:reaction", {
        socketId: socket.id,
        name: peer?.name || "Someone",
        emoji,
      });
    }
  );

  // ── RECORDING ───────────────────────────────────────────────────────────
  // Recording is done client-side via MediaRecorder (tab capture) and
  // uploaded as WebM. These handlers only broadcast recording state.

  socket.on(
    "webinar:startRecording",
    async (
      { webinarId }: { webinarId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false, error: "Room not found" });
      const peer = room.peers.get(socket.id);
      if (!peer || peer.role !== "host") {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      if (
        room.recording ||
        isServerRecording(webinarId) ||
        isWebinarLivekitRecording(webinarId)
      ) {
        return callback?.({ success: false, error: "Already recording" });
      }

      // LiveKit Composite Egress renders the grid + mixed audio server-side
      // and uploads the result via the /webhooks/livekit egress_ended handler.
      const result = await startWebinarLivekitRecording(webinarId, peer.userId);
      if (!result.success) {
        return callback?.({ success: false, error: result.error });
      }

      // Note-taker already auto-attached on host join — no action needed here.

      room.recording = true;
      io.to(webinarId).emit("webinar:recordingStarted");
      callback?.({ success: true });
    }
  );

  socket.on(
    "webinar:stopRecording",
    async (
      { webinarId }: { webinarId: string },
      callback?: (res: any) => void
    ) => {
      const room = getRoom(webinarId);
      if (!room) return callback?.({ success: false, error: "Room not found" });
      const peer = room.peers.get(socket.id);
      if (!peer || peer.role !== "host") {
        return callback?.({ success: false, error: "Unauthorized" });
      }
      if (
        !room.recording &&
        !isServerRecording(webinarId) &&
        !isWebinarLivekitRecording(webinarId)
      ) {
        return callback?.({ success: false, error: "Not recording" });
      }

      room.recording = false;
      io.to(webinarId).emit("webinar:recordingStopped");

      // Capture the egressId BEFORE stop clears it — we need it to poll for
      // the finalized file so we can hand the host a download URL.
      const liveEgressId = getActiveEgress(webinarRoomName(webinarId));
      const hostUserId = peer.userId;

      // Finalize in background so callback returns quickly. Stop both paths —
      // whichever was active will succeed; the other returns a no-op error.
      callback?.({ success: true });
      stopWebinarLivekitRecording(webinarId).catch((err) =>
        console.error("[webinar:stopRecording] livekit finalize error:", err)
      );
      stopServerRecording(webinarId).catch(() => {
        /* mediasoup path inactive in LiveKit-mode — ignore */
      });

      // Wait for the egress to finalize, then push a download URL to the
      // host. Best-effort — if the host left the page they can grab the
      // recording later from Workshop Analytics.
      if (liveEgressId) {
        (async () => {
          const file = await awaitWebinarRecordingFile(webinarId, liveEgressId);
          if (!file) {
            console.warn(
              `[webinar:recordingReady] egress did not finalize for ${liveEgressId}`
            );
            return;
          }
          io.to(webinarId).emit("webinar:recordingReady", {
            hostUserId,
            workshopId: webinarId,
            ...file,
          });
          console.log(
            `[webinar:recordingReady] sent to room ${webinarId} (host ${hostUserId}, ${file.size} bytes, ${file.duration}s)`
          );
        })().catch((err) =>
          console.error(
            "[webinar:recordingReady] background error:",
            err?.message ?? err
          )
        );
      }

      // Note-taker keeps running until the webinar ends (endWebinar or
      // all host/panelists leave) — transcribing independently of recording.
    }
  );

  // ── PIN PRODUCT (host only) ─────────────────────────────────────────────
  socket.on(
    "webinar:pinProduct",
    async (
      payload: {
        webinarId: string;
        // New-style: unified sellable reference
        itemType?: SellableItemType;
        itemId?: string;
        // Legacy: productId only (kept for backward compatibility)
        productId?: string;
        durationMinutes: number | null;
      },
      callback?: (res: any) => void
    ) => {
      try {
        const { webinarId, durationMinutes } = payload;
        const itemType: SellableItemType = payload.itemType || "product";
        const itemId = payload.itemId || payload.productId;

        if (!webinarId || !mongoose.isValidObjectId(webinarId)) {
          return callback?.({ success: false, error: "Invalid webinarId" });
        }
        // Garage Store ids are composite ("<catalogId>:<termMonths>") so the
        // pinned plan carries its term — validate the catalog half only.
        // getSellable() does the real lookup and rejects anything unknown.
        const itemIdCore =
          itemType === "garage-store" ? String(itemId).split(":")[0] : itemId;
        if (!itemId || !itemIdCore || !mongoose.isValidObjectId(itemIdCore)) {
          return callback?.({ success: false, error: "Invalid itemId" });
        }

        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });

        const peer = room.peers.get(socket.id);
        if (!peer || peer.role !== "host") {
          return callback?.({ success: false, error: "Unauthorized" });
        }

        // Fetch the webinar's org so we can scope the sellable lookup.
        const workshop = await Workshop.findById(webinarId)
          .select(
            "orgId currentSessionDate date isRecurring recurrencePattern recurrenceStartDate recurrenceEndDate startTime endTime timezone"
          )
          .lean();
        if (!workshop) {
          return callback?.({ success: false, error: "Webinar not found" });
        }

        const sellable = await getSellable(
          workshop.orgId.toString(),
          itemType,
          itemId
        );
        if (!sellable) {
          return callback?.({
            success: false,
            error: "Item not found or not active",
          });
        }

        const pinnedUntil =
          typeof durationMinutes === "number" && durationMinutes > 0
            ? Date.now() + durationMinutes * 60_000
            : null;

        // Resolve storefront slug + URL for store-product pins so
        // the client can drive Garage Store's /cart/checkout API
        // (or open the storefront page as a fallback) instead of
        // attempting the regular invoice flow — /api/invoices
        // /generate doesn't accept itemType:store-product.
        let storeSlug: string | undefined;
        let productUrl: string | undefined;
        if (itemType === "store-product") {
          const { Store } = await import("../models/store.model");
          const { StoreProduct } = await import("../models/storeProduct.model");
          const storeDoc = await Store.findOne(
            { orgId: workshop.orgId },
            { slug: 1 },
          ).lean();
          const productDoc = await StoreProduct.findById(sellable.itemId, {
            slug: 1,
          }).lean();
          if (storeDoc?.slug) {
            storeSlug = storeDoc.slug;
            const base = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
            productUrl = productDoc?.slug
              ? `${base}/store/${storeDoc.slug}/products/${productDoc.slug}`
              : `${base}/store/${storeDoc.slug}`;
          }
        }

        // Which session is on air — stamped on the snapshot so a buyer's
        // checkout can name the session that sold them the item.
        const { resolveLiveSessionKey } = await import("../utils/workshopStatus");
        const pinSessionDate = await resolveLiveSessionKey(workshop as any);

        const snapshot: PinnedProductSnapshot = {
          itemType,
          _id: sellable.itemId,
          sessionDate: pinSessionDate.toISOString().slice(0, 10),
          name: sellable.name,
          description: sellable.description,
          price: sellable.price,
          currency: sellable.currency,
          images: sellable.image ? [sellable.image] : [],
          isPhysical: sellable.isPhysical,
          storeSlug,
          productUrl,
          pinnedUntil,
        };

        room.pinnedProduct = snapshot;
        // Replaces any previous auto-unpin clock, and arms one for a timed pin.
        armPinTimer(io, webinarId, room);
        // The pin has to outlive the room object: a late joiner's ack reads it
        // from the room, and the room can be rebuilt mid-session.
        persistLiveState(webinarId, room, "pinnedProduct");

        // Durable trace of what was sold from — the live pin above vanishes
        // with the room. Fire-and-forget: a write failure must not break the
        // host's pin.
        recordPinnedSellable(webinarId, workshop.orgId, pinSessionDate, snapshot).catch((err) =>
          console.warn("[webinar:pinProduct] pin not recorded:", err?.message)
        );

        io.to(webinarId).emit("webinar:productPinned", { product: snapshot });
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:pinProduct] error:", err);
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── UNPIN PRODUCT (host/panelist) ───────────────────────────────────────
  socket.on(
    "webinar:unpinProduct",
    ({ webinarId }: { webinarId: string }, callback?: (res: any) => void) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });

        const peer = room.peers.get(socket.id);
        if (!peer || peer.role !== "host") {
          return callback?.({ success: false, error: "Unauthorized" });
        }

        if (room.pinTimer) {
          clearTimeout(room.pinTimer);
          room.pinTimer = null;
        }
        room.pinnedProduct = null;
        persistLiveState(webinarId, room, "pinnedProduct");

        io.to(webinarId).emit("webinar:productUnpinned", {});
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:unpinProduct] error:", err);
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── AUCTION PING (any peer in the room) ─────────────────────────────────
  //
  // "The lot on the block changed — go re-read it." Carries NO auction state
  // and is never trusted for any: the Garage Store backend is the arbiter of
  // price, bid order and settlement, so a forged ping costs a client one wasted
  // GET and nothing else. That is why any peer may send it — the bidder is an
  // attendee, and their bid is what everyone else needs to hear about.
  //
  // Twin of the `nc:bid` LiveKit data-channel packet the clients also publish.
  // Both exist because they fail differently: the data channel is dead for a
  // participant whose media transport is mid-reconnect, and this leg keeps
  // their price moving. Duplicate delivery is harmless — each one triggers the
  // same idempotent refetch.
  socket.on(
    "webinar:auctionPing",
    (
      { webinarId, productId }: { webinarId: string; productId?: string | null },
      callback?: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false, error: "Room not found" });
        if (!room.peers.has(socket.id)) {
          return callback?.({ success: false, error: "Not in this room" });
        }
        // `socket.to` excludes the sender, who already knows and has refetched.
        socket
          .to(webinarId)
          .emit("webinar:auctionPing", { productId: productId ?? null });
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:auctionPing] error:", err);
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── PRODUCT PURCHASED (any authenticated client, re-verified server-side) ─
  socket.on(
    "webinar:productPurchased",
    async ({
      webinarId,
      invoiceId,
    }: {
      webinarId: string;
      invoiceId: string;
    }) => {
      try {
        if (!webinarId || !invoiceId) return;
        if (!mongoose.isValidObjectId(invoiceId)) return;
        if (!getRoom(webinarId)) return;

        // Re-verify rather than trusting the client's claim.
        const invoice = await Invoice.findById(invoiceId).lean();
        if (!invoice || invoice.status !== "paid") return;

        const primaryItem = invoice.lineItems?.[0];
        if (!primaryItem || primaryItem.itemType !== "product") return;

        const buyerName =
          invoice.customerName ||
          invoice.customerEmail?.split("@")[0] ||
          "Someone";
        const productName = primaryItem.itemName || "a product";

        io.to(webinarId).emit("webinar:productPurchased", {
          buyerName,
          productName,
          productId: primaryItem.itemId?.toString(),
        });
      } catch (err: any) {
        console.error("[webinar:productPurchased] error:", err);
      }
    }
  );

  // ── END WEBINAR ─────────────────────────────────────────────────────────
  socket.on(
    "webinar:endWebinar",
    async (
      { webinarId }: { webinarId: string },
      callback?: (res: any) => void
    ) => {
      try {
        const room = getRoom(webinarId);
        if (!room) return callback?.({ success: false });
        const peer = room.peers.get(socket.id);
        if (!peer || peer.role !== "host") {
          return callback?.({ success: false, error: "Unauthorized" });
        }

        if (room.recording || isServerRecording(webinarId)) {
          room.recording = false;
          io.to(webinarId).emit("webinar:recordingStopped");
          stopServerRecording(webinarId).catch((err) =>
            console.error("[webinar:endWebinar] finalize recording error:", err)
          );
        }

        // Note-taker finalize
        try {
          const botManager = NoteTakerBotManager.getInstance();
          if (botManager.hasBot(webinarId)) {
            await botManager.leave(webinarId);
            const noteSession = await NoteSession.findOne({
              roomName: webinarId,
              status: "recording",
            }).sort({ startedAt: -1 });
            if (noteSession) {
              const now = new Date();
              noteSession.botLeftAt = now;
              noteSession.endedAt = now;
              noteSession.durationSeconds = Math.round(
                (now.getTime() - noteSession.startedAt.getTime()) / 1000
              );
              noteSession.status = "transcribing";
              await noteSession.save();
              setTimeout(() => {
                enqueueSummarize((noteSession._id as mongoose.Types.ObjectId).toString()).catch(() => { });
              }, 5000);
            }
          }
        } catch (err: any) {
          console.error("[webinar:endWebinar] note-taker stop failed:", err.message);
        }

        io.to(webinarId).emit("webinar:webinarEnded");
        // And the media room — so a viewer whose socket missed the event
        // above is still disconnected (ROOM_DELETED) instead of sitting on
        // "Waiting for host video…". The note-taker has already been asked
        // to leave, so it is not kicked mid-finalise.
        dropLivekitRoom(webinarId);

        // Mark Meet as ended in DB
        try {
          const ws = await Workshop.findById(webinarId)
            .select("meetingId orgId currentSessionDate date isRecurring")
            .lean();
          if (ws?.meetingId) {
            await Meet.findByIdAndUpdate(ws.meetingId, {
              $set: { status: "ended", endedAt: new Date() },
            });
            emitWorkshopPreviewUpdate(
              ws.orgId?.toString() || "",
              "workshop:preview:ended",
              { workshopId: webinarId }
            );
          }

          // Stamp manualEndedAt on the session override so the accordion
          // badge flips to Completed immediately. This handler is what
          // the FE ControlBar's "End webinar" button hits (via socket),
          // NOT the HTTP /webinar/:id/stop route — the HTTP route stamps
          // its own override; both paths need to write the event.
          //
          // Also clear currentSessionDate so the next session's /start
          // re-anchors it to today (the /start guard skips the stamp if
          // currentSessionDate is already set).
          if (ws) {
            // Anchor resolution must MATCH the host-join stamp above and
            // /webinar/:id/stop (webinarRoutes.ts:600): picked session
            // first, else today for recurring, else the one-off's date.
            // The old `currentSessionDate || ws.date` fallback stamped
            // manualEndedAt on the recurrence SEED date for recurring
            // workshops with no currentSessionDate — a different row than
            // the start stamp, leaving the real session "live" for 8h.
            const sessionAnchor =
              (ws as any).currentSessionDate ||
              ((ws as any).isRecurring ? new Date() : ws.date) ||
              new Date();
            const key = sessionDayKey(sessionAnchor);
            await WorkshopSessionOverride.findOneAndUpdate(
              { workshopId: new mongoose.Types.ObjectId(webinarId), sessionDate: key },
              {
                $set: {
                  manualEndedAt: new Date(),
                  "meta.endedBy": mongoose.isValidObjectId(userId)
                    ? new mongoose.Types.ObjectId(userId)
                    : undefined,
                },
                $setOnInsert: {
                  workshopId: new mongoose.Types.ObjectId(webinarId),
                  sessionDate: key,
                },
              },
              { upsert: true }
            );
            // Free the host seat before currentSessionDate is unset — the
            // release has to resolve the SAME session row the stamp above
            // wrote to, and unsetting it first would re-anchor to today.
            await releaseSessionHost(ws as any);
            // The session's grants, pin and bans die with it.
            if (room.sessionKey) {
              await clearLiveState({ workshopId: webinarId, sessionDate: room.sessionKey }).catch(
                (err) => console.warn("[webinar:endWebinar] live state not cleared:", err?.message)
              );
            }
            await Workshop.updateOne(
              { _id: new mongoose.Types.ObjectId(webinarId) },
              { $unset: { currentSessionDate: 1 } }
            );
          }
        } catch (e) {
          console.warn("[webinar:endWebinar] Failed to mark meet ended:", e);
        }

        // Chat is deliberately NOT deleted here.
        //
        // This used to `deleteMany({ workshopId })` so the next session opened
        // with an empty room. A workshop keeps one id across every run, so at
        // the time that was the only way to tell one night from the next — but
        // it also meant every webinar that ended cleanly lost its chat for
        // good, and a recording's chat replay had nothing left to show.
        //
        // The room still starts fresh: messages carry `sessionDate` and the
        // live history load scopes to the current session. Nothing has to be
        // destroyed to get that.

        // Clean up room from memory
        removeRoom(webinarId);
        callback?.({ success: true });
      } catch (err: any) {
        console.error("[webinar:endWebinar] error:", err);
        callback?.({ success: false, error: err.message });
      }
    }
  );

  // ── SYNC (cheap snapshot) ────────────────────────────────────────────────
  //
  // What a re-join ack carries, minus the database: the roster, the pin,
  // the recording flag, our role and hand. Clients call it on every return
  // to the foreground and on a slow timer so a missed event costs seconds,
  // not the rest of the session. A socket the server does not have seated
  // is told so, and does the full join instead.
  socket.on(
    "webinar:sync",
    ({ webinarId }: { webinarId: string }, callback?: (res: any) => void) => {
      const room = webinarId ? getRoom(webinarId) : undefined;
      const peer = room?.peers.get(socket.id);
      if (!room || !peer || peer.disconnectedAt != null) {
        return callback?.({ success: false, code: "NOT_IN_ROOM" });
      }
      callback?.({
        success: true,
        role: peer.role,
        handRaised: peer.handRaised,
        recording:
          room.recording || isServerRecording(webinarId) || isWebinarLivekitRecording(webinarId),
        pinnedProduct: room.pinnedProduct,
        peers: rosterFor(room, socket.id),
      });
    }
  );

  // ── LEAVE (deliberate) ───────────────────────────────────────────────────
  //
  // A disconnect is ambiguous — a crash, a tunnel, a locked phone — so it gets
  // a grace window. A leave is not: the client said goodbye, so the seat goes
  // now and the room hears `reason: "left"`. The socket itself stays up; the
  // client may be on its way into another room.
  socket.on(
    "webinar:leaveRoom",
    ({ webinarId }: { webinarId: string }, callback?: (res: any) => void) => {
      try {
        const room = webinarId ? getRoom(webinarId) : undefined;
        const peer = room?.peers.get(socket.id);
        if (!room || !peer) return callback?.({ success: true });
        peer.transports.forEach((t) => {
          try {
            t.close();
          } catch { }
        });
        socket.leave(webinarId);
        removePeer(room, socket.id, presenceHooks(io, webinarId, room), "left");
        recordAttendanceLeave(socket.id, userId).catch((err) =>
          console.warn("[webinar:leaveRoom] attendance not closed:", err?.message)
        );
        callback?.({ success: true });
      } catch (err: any) {
        callback?.({ success: false, error: err?.message });
      }
    }
  );

  // ── DISCONNECT ──────────────────────────────────────────────────────────
  socket.on("disconnect", async () => {
    console.log(`[Mediasoup] Disconnected: ${socket.id}`);

    // Clean up rate limiter entries for this socket
    msgRateLimit.cleanup(socket.id);
    reactRateLimit.cleanup(socket.id);
    qaRateLimit.cleanup(socket.id);
    voteRateLimit.cleanup(socket.id);

    // Close the attendance stint before the room teardown below, which
    // deletes the peer and (when the room empties) the room itself.
    recordAttendanceLeave(socket.id, userId).catch((err) =>
      console.warn("[Mediasoup disconnect] attendance not closed:", err?.message)
    );

    // Bat246 knock — a visitor who closes the tab while waiting for the
    // host shouldn't leave a stray "wants to join" row for the host.
    for (const [requestId, req] of pendingJoinRequests) {
      if (req.socketId === socket.id) {
        clearTimeout(req.timeout);
        pendingJoinRequests.delete(requestId);
      }
    }

    try {
      for (const [webinarId, room] of rooms.entries()) {
        const peer = room.peers.get(socket.id);
        if (!peer) continue;

        // Close all transports (closes producers/consumers too). The media
        // plumbing is per-socket and dead with it; the SEAT is not.
        peer.transports.forEach((t) => {
          try {
            t.close();
          } catch { }
        });
        peer.transports.clear();
        peer.producers.clear();
        peer.consumers.clear();

        // A dropped socket is not a leave. Keep the peer for the grace window
        // — nobody is told anything yet — and let webinarPresence decide
        // whether it expires (peerLeft: timeout) or the user's next socket
        // takes the seat over (webinar:joinRoom). Room teardown and the Meet
        // "ended" stamp now sit behind that same window, so a solo host
        // locking their phone no longer ends the stream for the office.
        markDisconnected(room, socket.id, presenceHooks(io, webinarId, room));
        console.log(
          `[webinar:presence] ${peer.userId} (${socket.id}) dropped from ${webinarId}; ` +
            `grace ${PEER_GRACE_MS}ms`
        );
      }
    } catch (err) {
      console.error("[Mediasoup disconnect] cleanup error:", err);
    }
  });
}
