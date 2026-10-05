"use client";

import { create } from "zustand";

// ── Types ───────────────────────────────────────────────────────────────────

export type WebinarRole = "host" | "panelist" | "attendee" | "pre-guest";

export interface PeerStreams {
  video?: MediaStream | null;
  audio?: MediaStream | null;
  screen?: MediaStream | null;
  screenAudio?: MediaStream | null;
}

/**
 * What kind of client this browser is, for the join payload and the local
 * user's own row in the participants list. Server-side detection reads the
 * user-agent header, but the client knows for certain, so we send it along.
 */
export function detectLocalDeviceType(): "web" | "mobile" {
  if (typeof window === "undefined") return "web";
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? "mobile"
    : "web";
}

export interface WebinarPeer {
  socketId: string;
  userId: string;
  name: string;
  /** Profile picture URL — shown in tile when camera is off. */
  avatar?: string;
  role: WebinarRole;
  /**
   * Which client this peer joined from. Set by the server at join time
   * (user-agent sniff, or the explicit hint the client sends) and shown as
   * a monitor/phone glyph beside the name in the participants list.
   */
  deviceType?: "web" | "mobile";
  streams?: PeerStreams;
  handRaised?: boolean;
  isMuted?: boolean;
  /**
   * Whether this peer has their camera enabled. Driven by the
   * explicit `webinar:peerCameraState` signal — falling back to
   * `true` when we haven't heard from the peer yet (treat the camera
   * as on by default; we'll learn otherwise from the next event).
   */
  cameraEnabled?: boolean;
  /**
   * LiveKit connection quality for this peer. Mirrors the LiveKit
   * `ConnectionQuality` enum values as strings — "excellent" | "good"
   * | "poor" | "lost" | "unknown" — so we don't have to leak
   * livekit-client into store consumers. Updated from the
   * RoomEvent.ConnectionQualityChanged listener in useWebinarLiveKit.
   */
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';
  /** Mirrors LiveKit's ActiveSpeakersChanged for this peer. */
  isSpeaking?: boolean;
  /**
   * The peer's SOCKET died but their LiveKit media is still flowing — a
   * permission prompt, app backgrounding or a reconnect kills the socket
   * while the media connection rides on. The row is kept (streams, tile,
   * role) as a "ghost" until either LiveKit reports them gone
   * (ParticipantDisconnected → truly left) or they re-join under a fresh
   * socketId (addPeer/syncPeers migrate this row onto it).
   */
  socketStale?: boolean;
}

/**
 * Snapshot of the message being replied to. Denormalised so the
 * quoted preview keeps rendering even after the original message is
 * deleted, edited, or paginated out of the cached chat history.
 */
export interface ChatReplyTo {
  id: string;
  userId: string;
  name: string;
  snippet: string;
}

export interface ChatMessage {
  id?: string;
  userId: string;
  name: string;
  text: string;
  replyTo?: ChatReplyTo;
  /** emoji → userIds who reacted. Mirrors the server's storage shape so
   *  both history rows and live `webinar:messageReaction` events drop in
   *  without translation. */
  reactions?: Record<string, string[]>;
  /**
   * userIds the sender tagged, resolved from the roster at send time and
   * re-checked server-side. Ids rather than names because people can rename
   * themselves mid-session and two of them can share a display name.
   */
  mentions?: string[];
  timestamp: string | number;
  [key: string]: unknown;
}

export interface QAQuestion {
  id: string;
  userId: string;
  name: string;
  text: string;
  answer?: string;
  answeredBy?: string;
  upvotes?: number;
  timestamp: string | number;
  [key: string]: unknown;
}

export interface Poll {
  id: string;
  question: string;
  options: { text: string; votes: number }[];
  createdBy: string;
  active: boolean;
  [key: string]: unknown;
}

/**
 * One in-flight floating reaction. Every motion parameter is baked in at
 * spawn time — re-randomising on render would make emojis jump mid-flight.
 */
export interface Reaction {
  id: string | number;
  name: string;
  emoji: string;
  /** Horizontal spawn lane, 15–85 (% of the stage width). */
  xPercent: number;
  /** -1 sways left first, 1 right first, 0 rises straight up. */
  swayDirection: number;
  /** Size multiplier, 0.9–1.25. */
  scale: number;
  /** Flight time, 3200–4000ms. */
  durationMs: number;
  /** Resting tilt, -8deg to +8deg. */
  rotationDeg: number;
  createdAt: number;
}

export type PinnedItemType =
  | "product"
  | "store-product"
  | "channel"
  | "course"
  | "service"
  | "workshop"
  // Garage Store plan — priced per-viewer at buy time, not from the pin.
  | "garage-store";

export interface PinnedProduct {
  itemType: PinnedItemType;
  _id: string; // itemId of the sellable
  name: string;
  description?: string;
  price: number;
  currency: string;
  images: string[];
  isDigital?: boolean;
  /** Storefront merch flag — true for store-product items whose
   *  source has isPhysicalProduct === true. Drives the in-overlay
   *  shipping form when buying. */
  isPhysical?: boolean;
  /** Garage storefront slug — needed to hit
   *  /storefront/:storeSlug/cart/checkout from the buy form. */
  storeSlug?: string;
  /** Pre-resolved storefront product URL — opened as a fallback
   *  for storefront items that don't fit the invoice flow. */
  productUrl?: string;
  // Epoch ms when the pin expires. null = pinned for the whole webinar.
  pinnedUntil?: number | null;
  /** AI-generated product ad video URL (Grok Imagine 1.5, kicked off on
   *  pin). Undefined at first pin — filled in by the socket event
   *  webinar:pinVideoReady once the Kie.ai render completes. When present
   *  the pin overlay swaps its still image for a video, screen-share style. */
  videoUrl?: string;
  /** Lifecycle of the ad render. Lets the overlay show a "generating…"
   *  state instead of a blank frame while we wait. */
  videoStatus?: "pending" | "processing" | "ready" | "failed";
}

// ── Reaction spawn lanes ────────────────────────────────────────────────────
// Fixed columns across the stage, walked in order so a burst fans out
// instead of stacking. Jitter is added per-spawn on top of these.

const REACTION_LANES = [18, 31, 44, 56, 69, 82];
let laneCursor = 0;

// ── Store interface ─────────────────────────────────────────────────────────

/** One fabricated attendee. Name only — they have no stream, socket or rights. */
export interface SimulatedPerson {
  name: string;
}

export interface WebinarState {
  // Room info
  webinarId: string | null;
  webinarTitle: string;
  /** The stream's cover art, headlining the room header instead of a face. */
  webinarThumbnail: string;
  role: WebinarRole;

  // Peers
  peers: WebinarPeer[];

  /**
   * The host's scripted audience, kept deliberately OUT of `peers`.
   *
   * `peers` drives the video grid and is rewritten wholesale by `syncPeers`
   * from the server's participant list — anything fabricated that were put
   * there would either render an empty video tile or be wiped on the next
   * sync. These are display-only names for the People list and its count.
   */
  simulatedPeople: SimulatedPerson[];

  // Local streams
  localStream: MediaStream | null;
  screenStream: MediaStream | null;

  // Media state
  micEnabled: boolean;
  camEnabled: boolean;
  screenSharing: boolean;
  isRecording: boolean;
  isUploadingRecording: boolean;
  handRaised: boolean;
  /** Local speaker (playback) mute — silences every RemoteAudio element.
   *  Independent of micEnabled: muting your mic never touches playback,
   *  and muting your speaker never touches the mic. */
  speakerMuted: boolean;

  // Chat
  messages: ChatMessage[];
  unreadChatCount: number;
  chatTabActive: boolean;

  // Q&A
  qaQuestions: QAQuestion[];

  // Polls
  polls: Poll[];

  // Emoji reactions (transient, for animation)
  reactions: Reaction[];

  // Pinned product (host-pinned spotlight card)
  pinnedProduct: PinnedProduct | null;

  // ── Actions ─────────────────────────────────────────────────────────────

  setWebinarId: (id: string | null) => void;
  setWebinarTitle: (title: string) => void;
  setWebinarThumbnail: (url: string) => void;
  setRole: (role: WebinarRole) => void;

  setLocalStream: (stream: MediaStream | null) => void;
  setScreenStream: (stream: MediaStream | null) => void;

  setMicEnabled: (v: boolean) => void;
  setCamEnabled: (v: boolean) => void;
  setScreenSharing: (v: boolean) => void;
  setIsRecording: (v: boolean) => void;
  setIsUploadingRecording: (v: boolean) => void;
  setHandRaised: (v: boolean) => void;
  setSpeakerMuted: (v: boolean) => void;

  // Peers
  addPeer: (peer: WebinarPeer & { previousSocketId?: string }) => void;
  removePeer: (socketId: string) => void;
  /** Keep the row but flag its socket as dead — see WebinarPeer.socketStale. */
  markPeerSocketStale: (socketId: string) => void;
  /** Drop every ghost row for this user — their LiveKit leg ended too. */
  removeStalePeersByUserId: (userId: string) => void;
  /**
   * Reconcile the roster against the server's joinRoom snapshot without
   * rebuilding it. Rows the server still lists are merged in place (streams
   * and everything else the room has learned survive); a ghost row whose
   * user re-joined under a new socketId is migrated onto it; rows the
   * server dropped are removed — unless their LiveKit identity is in
   * `liveIdentities`, in which case they stay as ghosts.
   */
  syncPeers: (serverPeers: WebinarPeer[], liveIdentities?: string[]) => void;
  updatePeerStream: (
    socketId: string,
    stream: MediaStream | null,
    kind: keyof PeerStreams
  ) => void;
  updatePeerRole: (socketId: string, role: WebinarRole) => void;
  updatePeerName: (socketId: string, name: string) => void;
  updateHandRaised: (socketId: string, raised: boolean) => void;
  updatePeerMuted: (socketId: string, muted: boolean) => void;
  updatePeerCamera: (socketId: string, enabled: boolean) => void;
  /** Update a peer's network quality (driven by RoomEvent.ConnectionQualityChanged). */
  updatePeerConnectionQuality: (
    /**
     * LiveKit identity (matches `WebinarPeer.userId`) — peers are
     * keyed by socketId in the local store, so we resolve identity →
     * socketId inside the action.
     */
    identity: string,
    quality: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown',
  ) => void;
  /** Connection quality of the local participant (you). */
  localConnectionQuality: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown';
  setLocalConnectionQuality: (
    q: 'excellent' | 'good' | 'poor' | 'lost' | 'unknown',
  ) => void;
  /**
   * Replace the entire speaking set in one shot. Driven by LiveKit's
   * ActiveSpeakersChanged — passing the userIds (LiveKit identities) that
   * are currently active. Anyone not in the set has isSpeaking = false.
   */
  setActiveSpeakers: (userIds: string[]) => void;
  /** True when the local participant is in the active-speaker set. */
  isLocalSpeaking: boolean;
  setIsLocalSpeaking: (v: boolean) => void;
  /** Local user's profile picture URL (echoed from the backend joinRoom
   * response so the self-tile can show it when the camera is off). */
  localAvatar: string;
  setLocalAvatar: (v: string) => void;

  // Chat
  addMessage: (msg: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setSimulatedPeople: (people: SimulatedPerson[]) => void;
  /** Replace one message's full reactions map (server broadcasts the whole
   *  map, not a delta, so a missed event still converges). */
  setMessageReactions: (
    messageId: string,
    reactions: Record<string, string[]>
  ) => void;
  setChatTabActive: (v: boolean) => void;

  // Q&A
  addQuestion: (qa: QAQuestion) => void;
  updateQuestion: (qa: QAQuestion) => void;
  setQuestions: (qaQuestions: QAQuestion[]) => void;

  // Reactions — callers pass identity only; the store owns the motion.
  addReaction: (
    reaction: Pick<Reaction, "id" | "name" | "emoji">
  ) => void;

  // Polls
  addPoll: (poll: Poll) => void;
  updatePoll: (poll: Poll) => void;
  setPolls: (polls: Poll[]) => void;

  // Pinned product
  setPinnedProduct: (product: PinnedProduct | null) => void;
  /** Called when the pin's ad video finishes rendering — the room may
   *  have unpinned by then, in which case we no-op instead of resurrecting
   *  a stale pin overlay. */
  setPinnedProductVideo: (itemType: string, itemId: string, videoUrl: string) => void;

  // Reset
  resetRoom: () => void;
}

// ── Store implementation ────────────────────────────────────────────────────

const useWebinarStore = create<WebinarState>((set, get) => ({
  // Room info
  webinarId: null,
  webinarTitle: "",
  webinarThumbnail: "",
  role: "attendee",

  // Peers
  peers: [],
  simulatedPeople: [],

  // Local streams
  localStream: null,
  screenStream: null,

  // Media state
  micEnabled: false,
  camEnabled: false,
  screenSharing: false,
  isRecording: false,
  isUploadingRecording: false,
  handRaised: false,
  speakerMuted: false,

  // Chat
  messages: [],
  unreadChatCount: 0,
  chatTabActive: true,

  // Q&A
  qaQuestions: [],

  // Polls
  polls: [],

  // Emoji reactions
  reactions: [],

  // Pinned product
  pinnedProduct: null,

  // ── Setters ─────────────────────────────────────────────────────────────

  setWebinarId: (id) => set({ webinarId: id }),
  setWebinarTitle: (title) => set({ webinarTitle: title }),
  setWebinarThumbnail: (url) => set({ webinarThumbnail: url }),
  setRole: (role) => set({ role }),

  setLocalStream: (stream) => set({ localStream: stream }),
  setScreenStream: (stream) => set({ screenStream: stream }),

  setMicEnabled: (v) => set({ micEnabled: v }),
  setCamEnabled: (v) => set({ camEnabled: v }),
  setScreenSharing: (v) => set({ screenSharing: v }),
  setIsRecording: (v) => set({ isRecording: v }),
  setIsUploadingRecording: (v) => set({ isUploadingRecording: v }),
  setSpeakerMuted: (v) => set({ speakerMuted: v }),
  setHandRaised: (v) => set({ handRaised: v }),

  // ── Peers ───────────────────────────────────────────────────────────────

  /**
   * Add a peer, or MERGE into the one already here.
   *
   * `webinar:peerJoined` fires again whenever a peer re-runs the join
   * handshake on the same socket — which the mobile room does every time the
   * user steps out to the picture-in-picture player and taps back in. The old
   * implementation dropped the existing entry and stored the raw payload, and
   * that payload carries only identity: socketId, userId, name, avatar, role.
   *
   * Everything the room had LEARNED about the peer went with it — above all
   * `streams`, the live LiveKit tracks wired in by updatePeerStream. Their
   * tile went black and silent mid-session while they were still publishing
   * happily, because the store no longer held anything to render.
   *
   * So: identity fields update (a re-join is also how a promotion reaches us),
   * and everything else — streams, mute, camera, hand, quality — is kept.
   * `??` rather than a spread so an absent field in the payload never blanks
   * what we already knew.
   */
  addPeer: (peer) =>
    set((state) => {
      const existing = state.peers.find((p) => p.socketId === peer.socketId);
      if (!existing) {
        // The same person coming back under a fresh socket (their old one
        // died mid-session while their media lived on): migrate the ghost
        // row onto the new socketId so streams and learned state carry over
        // instead of starting a blank duplicate.
        // `previousSocketId` names the exact row the server carried this
        // seat over from (a reconnect, or a switch to this device); a stale
        // ghost of the same user is the fallback for older servers.
        const previous = peer.previousSocketId;
        const ghost =
          (previous && state.peers.find((p) => p.socketId === previous)) ||
          state.peers.find(
            (p) => p.socketStale && !!p.userId && p.userId === peer.userId
          );
        if (ghost) {
          return {
            peers: state.peers.map((p) =>
              p === ghost
                ? {
                    ...p,
                    socketId: peer.socketId,
                    userId: peer.userId ?? p.userId,
                    name: peer.name ?? p.name,
                    avatar: peer.avatar ?? p.avatar,
                    role: peer.role ?? p.role,
                    deviceType: peer.deviceType ?? p.deviceType,
                    socketStale: false,
                  }
                : p
            ),
          };
        }
        return { peers: [...state.peers, peer] };
      }
      return {
        peers: state.peers.map((p) =>
          p.socketId === peer.socketId
            ? {
                ...p,
                userId: peer.userId ?? p.userId,
                name: peer.name ?? p.name,
                avatar: peer.avatar ?? p.avatar,
                role: peer.role ?? p.role,
                deviceType: peer.deviceType ?? p.deviceType,
                socketStale: false,
              }
            : p
        ),
      };
    }),

  removePeer: (socketId) =>
    set((state) => ({
      peers: state.peers.filter((p) => p.socketId !== socketId),
    })),

  markPeerSocketStale: (socketId) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, socketStale: true } : p
      ),
    })),

  removeStalePeersByUserId: (userId) =>
    set((state) => ({
      peers: state.peers.filter(
        (p) => !(p.socketStale && p.userId === userId)
      ),
    })),

  syncPeers: (serverPeers, liveIdentities = []) =>
    set((state) => {
      const live = new Set(liveIdentities);
      const bySocketId = new Map(state.peers.map((p) => [p.socketId, p]));
      const serverIds = new Set(serverPeers.map((p) => p.socketId));
      const consumed = new Set<string>();

      const next: WebinarPeer[] = serverPeers.map((sp) => {
        const existing = bySocketId.get(sp.socketId);
        if (existing) {
          consumed.add(existing.socketId);
          return {
            ...existing,
            userId: sp.userId ?? existing.userId,
            name: sp.name ?? existing.name,
            avatar: sp.avatar ?? existing.avatar,
            role: sp.role ?? existing.role,
            deviceType: sp.deviceType ?? existing.deviceType,
            socketStale: false,
          };
        }
        const ghost = state.peers.find(
          (p) =>
            p.socketStale &&
            !!p.userId &&
            p.userId === sp.userId &&
            !serverIds.has(p.socketId) &&
            !consumed.has(p.socketId)
        );
        if (ghost) {
          consumed.add(ghost.socketId);
          return {
            ...ghost,
            socketId: sp.socketId,
            userId: sp.userId ?? ghost.userId,
            name: sp.name ?? ghost.name,
            avatar: sp.avatar ?? ghost.avatar,
            role: sp.role ?? ghost.role,
            deviceType: sp.deviceType ?? ghost.deviceType,
            socketStale: false,
          };
        }
        return sp;
      });

      // Rows the server no longer lists: keep only the ones whose media is
      // demonstrably still up and whose user has no other row — those stay
      // as ghosts until LiveKit settles their fate.
      for (const p of state.peers) {
        if (consumed.has(p.socketId) || serverIds.has(p.socketId)) continue;
        const mediaAlive = !!p.userId && live.has(p.userId);
        const userListed = serverPeers.some(
          (sp) => !!sp.userId && sp.userId === p.userId
        );
        if (mediaAlive && !userListed) next.push({ ...p, socketStale: true });
      }

      return { peers: next };
    }),

  updatePeerStream: (socketId, stream, kind) =>
    set((state) => ({
      peers: state.peers.map((p) => {
        if (p.socketId !== socketId) return p;
        const streams = p.streams || {};
        const existing = streams[kind];

        // Reuse existing MediaStream and swap tracks to keep the reference
        // stable — prevents PIP video elements from losing their srcObject.
        if (existing && stream) {
          const oldTracks = existing.getTracks();
          const newTracks = stream.getTracks();
          const same =
            oldTracks.length === newTracks.length &&
            oldTracks.every((t, i) => t === newTracks[i]);
          if (same) return p;
          oldTracks.forEach((t) => existing.removeTrack(t));
          newTracks.forEach((t) => existing.addTrack(t));
          return { ...p, streams: { ...streams } };
        }

        return { ...p, streams: { ...streams, [kind]: stream } };
      }),
    })),

  updatePeerRole: (socketId, role) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, role } : p
      ),
    })),

  updatePeerName: (socketId, name) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, name } : p
      ),
    })),

  updateHandRaised: (socketId, raised) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, handRaised: raised } : p
      ),
    })),

  updatePeerMuted: (socketId, muted) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, isMuted: muted } : p
      ),
    })),

  updatePeerCamera: (socketId, enabled) =>
    set((state) => ({
      peers: state.peers.map((p) =>
        p.socketId === socketId ? { ...p, cameraEnabled: enabled } : p
      ),
    })),

  updatePeerConnectionQuality: (identity, quality) =>
    set((state) => {
      // Skip if no peer matches — the bot or a stale identity will fall through.
      if (!state.peers.some((p) => p.userId === identity)) return {};
      return {
        peers: state.peers.map((p) =>
          p.userId === identity ? { ...p, connectionQuality: quality } : p,
        ),
      };
    }),

  setActiveSpeakers: (userIds: string[]) =>
    set((state) => {
      const speaking = new Set(userIds);
      let changed = false;
      const next = state.peers.map((p) => {
        const isSpeaking = speaking.has(p.userId);
        if (!!p.isSpeaking !== isSpeaking) {
          changed = true;
          return { ...p, isSpeaking };
        }
        return p;
      });
      return changed ? { peers: next } : {};
    }),

  isLocalSpeaking: false,
  setIsLocalSpeaking: (v: boolean) =>
    set((state) =>
      state.isLocalSpeaking === v ? {} : { isLocalSpeaking: v }
    ),

  localConnectionQuality: 'unknown',
  setLocalConnectionQuality: (q) =>
    set((state) =>
      state.localConnectionQuality === q ? {} : { localConnectionQuality: q },
    ),

  localAvatar: "",
  setLocalAvatar: (v: string) =>
    set((state) => (state.localAvatar === v ? {} : { localAvatar: v })),

  // ── Chat ────────────────────────────────────────────────────────────────

  addMessage: (msg) =>
    set((state) => ({
      messages: [...state.messages, msg],
      unreadChatCount: state.chatTabActive
        ? 0
        : state.unreadChatCount + 1,
    })),

  setMessages: (messages) => set({ messages }),
  setSimulatedPeople: (simulatedPeople) => set({ simulatedPeople }),

  setMessageReactions: (messageId, reactions) =>
    set((state) => {
      if (!state.messages.some((m) => m.id === messageId)) return {};
      return {
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      };
    }),

  setChatTabActive: (v) =>
    set({ chatTabActive: v, ...(v ? { unreadChatCount: 0 } : {}) }),

  // ── Q&A ─────────────────────────────────────────────────────────────────

  addQuestion: (qa) =>
    set((state) => ({ qaQuestions: [...state.qaQuestions, qa] })),

  updateQuestion: (qa) =>
    set((state) => ({
      qaQuestions: state.qaQuestions.map((q) => (q.id === qa.id ? qa : q)),
    })),

  setQuestions: (qaQuestions) => set({ qaQuestions }),

  // ── Reactions ───────────────────────────────────────────────────────────

  addReaction: (reaction) => {
    // Round-robin the lanes rather than picking at random: a pure random
    // spread clumps visibly when several people react at once, which is
    // exactly the moment the fountain is supposed to look wide.
    const lane = REACTION_LANES[laneCursor++ % REACTION_LANES.length];
    const xPercent = Math.min(
      85,
      Math.max(15, lane + (Math.random() * 8 - 4))
    );

    const spawned: Reaction = {
      ...reaction,
      xPercent,
      // Mostly wobble; the occasional straight riser keeps the group from
      // looking like it's moving in formation.
      swayDirection: Math.random() < 0.12 ? 0 : Math.random() < 0.5 ? -1 : 1,
      scale: 0.9 + Math.random() * 0.35,
      durationMs: 3200 + Math.random() * 800,
      rotationDeg: Math.random() * 16 - 8,
      createdAt: Date.now(),
    };

    set((state) => ({ reactions: [...state.reactions, spawned] }));

    // Cull just after this emoji's own flight ends, not on a fixed 4s
    // timer — otherwise the slowest ones pop out before reaching the top.
    setTimeout(() => {
      set((state) => ({
        reactions: state.reactions.filter((r) => r.id !== spawned.id),
      }));
    }, spawned.durationMs + 250);
  },

  // ── Polls ───────────────────────────────────────────────────────────────

  addPoll: (poll) => set((state) => ({ polls: [...state.polls, poll] })),

  updatePoll: (poll) =>
    set((state) => ({
      polls: state.polls.map((p) => (p.id === poll.id ? poll : p)),
    })),

  setPolls: (polls) => set({ polls }),

  // ── Pinned product ──────────────────────────────────────────────────────

  setPinnedProduct: (product) => set({ pinnedProduct: product }),

  setPinnedProductVideo: (itemType, itemId, videoUrl) =>
    set((state) => {
      const p = state.pinnedProduct;
      // Only patch the currently pinned item — a webinar:pinVideoReady for
      // an item that's already unpinned or replaced must not resurrect it.
      if (!p || p.itemType !== itemType || p._id !== itemId) return {};
      return {
        pinnedProduct: { ...p, videoUrl, videoStatus: "ready" },
      };
    }),

  // ── Reset ───────────────────────────────────────────────────────────────

  resetRoom: () => {
    const { localStream, screenStream } = get();
    try {
      localStream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    try {
      screenStream?.getTracks().forEach((t) => t.stop());
    } catch {
      /* ignore */
    }
    set({
      webinarId: null,
      webinarTitle: "",
      webinarThumbnail: "",
      role: "attendee",
      peers: [],
      localStream: null,
      screenStream: null,
      micEnabled: false,
      camEnabled: false,
      screenSharing: false,
      isRecording: false,
      handRaised: false,
      speakerMuted: false,
      messages: [],
      unreadChatCount: 0,
      chatTabActive: true,
      qaQuestions: [],
      polls: [],
      reactions: [],
      pinnedProduct: null,
    });
  },
}));

export default useWebinarStore;
