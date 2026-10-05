import * as mediasoup from "mediasoup";
import { mediasoupConfig } from "../config/mediasoup";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface WebinarPeer {
  socket: any;
  userId: string;
  name: string;
  /** Profile picture URL — shown in tile when camera is off. Optional for guests. */
  avatar?: string;
  role: "host" | "panelist" | "attendee";
  /** Which client the peer joined from — drives the device icon in the
   *  participants list. Derived from the socket's user-agent, or overridden
   *  by an explicit deviceType in the join payload. */
  deviceType?: "web" | "mobile";
  /** Stable per-device id from the client — what tells a reconnect from a
   *  second device (realtime/webinarPresence.ts#isSameDevice). */
  deviceId?: string;
  /** Human name for the device ("iPhone 15", "Chrome on Mac"), client-supplied,
   *  shown to the same user on their OTHER device when asking which to use. */
  deviceLabel?: string;
  /** Epoch ms this seat was first taken; carried over on a reconnect. */
  joinedAt: number;
  producers: Map<string, any>;
  consumers: Map<string, any>;
  transports: Map<string, any>;
  handRaised: boolean;
  /**
   * Set when this peer's socket has dropped and its grace window is running
   * (realtime/webinarPresence.ts). The seat is still in the room and clients
   * have not been told anything yet. Null/undefined while connected.
   */
  disconnectedAt?: number | null;
  graceTimer?: NodeJS.Timeout | null;
}

export type PinnedItemType =
  | "product"
  | "store-product"
  | "channel"
  | "course"
  | "service"
  // Partner subscription sold through Garage Store (the $25 UP combo).
  | "garage-store"
  | "workshop";

export interface PinnedProductSnapshot {
  itemType: PinnedItemType;
  _id: string; // itemId of the sellable
  name: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  isDigital?: boolean;
  /** Storefront merch — true when isPhysicalProduct on the source.
   *  Drives the in-overlay shipping form vs. the invoice flow. */
  isPhysical?: boolean;
  /** Garage storefront slug. Needed by the buy form to hit
   *  /storefront/:storeSlug/cart/checkout. */
  storeSlug?: string;
  /** The session this pin belongs to (UTC day key, YYYY-MM-DD). Clients send
   *  it back with the purchase so the sale is credited to the right session —
   *  see liveWorkshopId/liveSessionDate on the invoice line. */
  sessionDate?: string;
  /** Pre-resolved storefront URL — opened as a fallback for
   *  storefront items that don't fit the invoice flow. */
  productUrl?: string;
  // Epoch ms when the pin should auto-expire. null = pin lasts the whole webinar.
  pinnedUntil: number | null;
}

export interface VirtualPeer {
  socketId: string;
  userId: string;
  name: string;
  /** Profile picture URL (optional — bots typically don't have one). */
  avatar?: string;
  role: "host" | "panelist" | "attendee";
  /** Same meaning as on WebinarPeer. Server-side bots report "web". */
  deviceType?: "web" | "mobile";
}

export interface WebinarRoom {
  router: any; // mediasoup Router
  peers: Map<string, WebinarPeer>;
  /**
   * Roles granted IN the room, by userId — the promotions a host hands out
   * while the session is running.
   *
   * Peers are keyed by socket.id and a promotion only ever touched that one
   * record, so anything that rebuilt it lost the grant. The mobile room screen
   * re-emits `webinar:joinRoom` every time the user walks back in from the
   * mini player, carrying the role from their JOIN LINK (attendee) — and the
   * handler wrote that straight over the co-host they had been made, so the
   * web room watched them drop off the stage. A reconnect is worse: the new
   * socket.id has no record to inherit from at all, which is why this is keyed
   * by user rather than by socket.
   *
   * A browser refresh has the same problem from the other end: it comes back
   * as a brand new peer with the default role, losing both the in-room
   * controls and the LiveKit publish grant. This outlives the connection, so
   * `webinar:joinRoom` and the LiveKit token endpoint can hand the role back.
   *
   * Written by promote/demote, read on join. Demotion deletes rather than
   * storing "attendee", so this only ever holds real elevation.
   *
   * Session-scoped on purpose: it dies with the room, because being made a
   * co-host of one broadcast should not make anyone a co-host of the next.
   */
  elevatedRoles: Map<string, "host" | "panelist">;
  // Participants that are not backed by a real socket (e.g. note-taker bot).
  // Broadcast to clients as regular peers so they show in the UI.
  virtualPeers: Map<string, VirtualPeer>;
  chatMessages: any[];
  qaQuestions: any[];
  polls: any[];
  recording: boolean;
  pinnedProduct: PinnedProductSnapshot | null;
  pinTimer: NodeJS.Timeout | null;
  /**
   * Users a host removed this session. A kick used to be just a disconnect,
   * which the join link undid one tap later.
   */
  bannedUserIds: Set<string>;
  /** Pending "is the room really empty?" check — see scheduleEmptyRoomTeardown. */
  emptyTimer: NodeJS.Timeout | null;
  /**
   * deviceId → the device that took its seat over this session. Lets a device
   * that comes back after being switched away from be told "you moved to X"
   * instead of being asked the question again.
   */
  takeovers: Map<string, { byDeviceId?: string; at: number }>;
  /**
   * Running while the host is gone for good and no co-host remains. Fires
   * the end of the session; cancelled by any host or panelist join.
   */
  hostAbsentTimer: NodeJS.Timeout | null;
  /**
   * Joins past getOrCreateRoom but not yet in `peers`. The empty-room check
   * waits for these, so a seat can't be torn down under someone mid-join.
   */
  joinsInFlight: number;
  /**
   * The session this room belongs to, as the override-row key — fixed at the
   * first join so write-through persistence (services/webinarLiveState.ts)
   * never has to re-resolve it. Null until then.
   */
  sessionKey: Date | null;
  /** One-shot restore of persisted live state into a freshly created room. */
  hydration: Promise<void> | null;
}

// ── State ─────────────────────────────────────────────────────────────────────

let worker: any = null; // mediasoup Worker

/** Map of webinarId -> WebinarRoom */
export const rooms = new Map<string, WebinarRoom>();

/** Pending room creation promises — prevents duplicate routers on concurrent joins */
const pendingRooms = new Map<string, Promise<WebinarRoom>>();

// ── Worker ────────────────────────────────────────────────────────────────────

export async function createWorker(): Promise<any> {
  worker = await mediasoup.createWorker({
    rtcMinPort: mediasoupConfig.worker.rtcMinPort,
    rtcMaxPort: mediasoupConfig.worker.rtcMaxPort,
    logLevel: mediasoupConfig.worker.logLevel,
    logTags: mediasoupConfig.worker.logTags,
  } as any);

  worker.on("died", (error: any) => {
    console.error(
      "mediasoup Worker died, exiting in 2 seconds... [pid:%d] [error:%o]",
      worker.pid,
      error
    );
    setTimeout(() => process.exit(1), 2000);
  });

  console.log("mediasoup Worker created [pid:%d]", worker.pid);
  return worker;
}

// ── Room Management ───────────────────────────────────────────────────────────

export async function getOrCreateRoom(webinarId: string): Promise<WebinarRoom> {
  if (rooms.has(webinarId)) return rooms.get(webinarId)!;
  if (pendingRooms.has(webinarId)) return pendingRooms.get(webinarId)!;

  const promise = (async (): Promise<WebinarRoom> => {
    if (!worker) {
      throw new Error("mediasoup Worker not initialized - call createWorker() first");
    }

    const router = await worker.createRouter({
      mediaCodecs: mediasoupConfig.router.mediaCodecs,
    });

    const room: WebinarRoom = {
      router,
      peers: new Map(),
      elevatedRoles: new Map(),
      virtualPeers: new Map(),
      chatMessages: [],
      qaQuestions: [],
      polls: [],
      recording: false,
      pinnedProduct: null,
      pinTimer: null,
      bannedUserIds: new Set(),
      emptyTimer: null,
      takeovers: new Map(),
      hostAbsentTimer: null,
      joinsInFlight: 0,
      sessionKey: null,
      hydration: null,
    };

    rooms.set(webinarId, room);
    pendingRooms.delete(webinarId);
    console.log("Room created for webinar:", webinarId);
    return room;
  })();

  pendingRooms.set(webinarId, promise);
  return promise;
}

export function getRoom(webinarId: string): WebinarRoom | undefined {
  return rooms.get(webinarId);
}

export function removeRoom(webinarId: string): void {
  const room = rooms.get(webinarId);
  if (room) {
    if (room.pinTimer) {
      clearTimeout(room.pinTimer);
      room.pinTimer = null;
    }
    if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
    }
    if (room.hostAbsentTimer) {
      clearTimeout(room.hostAbsentTimer);
      room.hostAbsentTimer = null;
    }
    // Grace clocks of peers still in the map must not fire into a dead room.
    for (const peer of room.peers.values()) {
      if (peer.graceTimer) {
        clearTimeout(peer.graceTimer);
        peer.graceTimer = null;
      }
    }
    room.router.close();
    rooms.delete(webinarId);
    console.log("Room removed for webinar:", webinarId);
  }
}

// ── Transport ─────────────────────────────────────────────────────────────────

export async function createWebRtcTransport(
  router: any
): Promise<{
  transport: any;
  params: {
    id: string;
    iceParameters: any;
    iceCandidates: any;
    dtlsParameters: any;
  };
}> {
  const transport = await router.createWebRtcTransport(
    mediasoupConfig.webRtcTransport as any
  );

  if (mediasoupConfig.webRtcTransport.maxIncomingBitrate) {
    try {
      await transport.setMaxIncomingBitrate(
        mediasoupConfig.webRtcTransport.maxIncomingBitrate
      );
    } catch {
      // ignore
    }
  }

  return {
    transport,
    params: {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    },
  };
}

// Alias for backward compatibility with index.ts import
export { createWorker as createMediasoupWorker };
