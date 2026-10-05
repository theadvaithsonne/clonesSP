/**
 * Room membership that survives a socket.
 *
 * A webinar peer used to BE a socket: the disconnect handler deleted the peer
 * the instant the transport closed and broadcast `peerLeft`, and when the map
 * emptied the room was torn down and the Meet marked ended. Every mobile
 * network blip, every iOS suspension, every deploy therefore looked like a
 * deliberate exit — a solo host locking their phone ended the stream for the
 * whole office, a reconnecting co-host came back an attendee, a pinned product
 * vanished from every late joiner's ack.
 *
 * This module holds the one rule that fixes that: a dropped socket puts its
 * peer into a GRACE window instead of deleting it. Inside the window the peer
 * is still in the room (nobody is told anything), and a re-join by the same
 * user takes the old record over — role, hand state and grants intact — with a
 * `reason: "reconnected"` leave for the dead socket so clients can migrate the
 * row instead of flashing "left". Only when the window expires is the peer
 * really gone, and only then may the room be empty.
 *
 * Pure on purpose: no socket.io, no mongoose, no mediasoup. Everything that
 * emits or persists sits behind `PresenceHooks`, which is what lets the timing
 * be unit-tested with fake timers (see __tests__/webinarPresence.test.ts).
 */

export const DEFAULT_PEER_GRACE_MS = 45_000;

/** Why a socket is being announced as gone from the roster. */
export type LeaveReason =
  /** The client asked to leave (`webinar:leaveRoom`). */
  | "left"
  /** Its socket dropped and nothing of theirs came back inside the window. */
  | "timeout"
  /** A host removed them. */
  | "removed"
  /** Its socket dropped and a NEW socket of the same DEVICE took the seat over —
   *  a `peerJoined` for that new socket follows immediately. */
  | "reconnected"
  /** The user chose ANOTHER device; that device's `peerJoined` follows. The
   *  replaced socket is told separately (`webinar:replacedByDevice`). */
  | "replaced";

export interface PresencePeer {
  userId: string;
  deviceType?: "web" | "mobile";
  /** Stable per-device id from the client, when it sent one. */
  deviceId?: string;
  /** Epoch ms the socket dropped; null/undefined while connected. */
  disconnectedAt?: number | null;
  graceTimer?: NodeJS.Timeout | null;
}

export interface PresenceRoom<P extends PresencePeer = PresencePeer> {
  peers: Map<string, P>;
}

export interface PresenceHooks<P extends PresencePeer = PresencePeer> {
  /** A socket is gone from the roster, for the given reason. */
  onPeerLeft(socketId: string, peer: P, reason: LeaveReason): void;
  /** The last peer — connected or in grace — just left the map. */
  onRoomEmpty(): void;
  /** Grace window; defaults to DEFAULT_PEER_GRACE_MS. */
  graceMs?: number;
  now?: () => number;
}

export function isConnected(peer: PresencePeer): boolean {
  return peer.disconnectedAt == null;
}

/** Peers whose socket is live right now. */
export function connectedPeers<P extends PresencePeer>(
  room: PresenceRoom<P>
): Array<[string, P]> {
  return Array.from(room.peers.entries()).filter(([, p]) => isConnected(p));
}

function clearTimer(peer: PresencePeer): void {
  if (peer.graceTimer) {
    clearTimeout(peer.graceTimer);
    peer.graceTimer = null;
  }
}

function afterRemoval<P extends PresencePeer>(
  room: PresenceRoom<P>,
  hooks: PresenceHooks<P>
): void {
  if (room.peers.size === 0) hooks.onRoomEmpty();
}

/**
 * The socket behind `socketId` closed. Keep the peer; start its grace clock.
 * Returns false when there was no such peer (already left, never joined).
 */
export function markDisconnected<P extends PresencePeer>(
  room: PresenceRoom<P>,
  socketId: string,
  hooks: PresenceHooks<P>
): boolean {
  const peer = room.peers.get(socketId);
  if (!peer) return false;
  clearTimer(peer);
  peer.disconnectedAt = (hooks.now ?? Date.now)();
  const graceMs = hooks.graceMs ?? DEFAULT_PEER_GRACE_MS;
  const timer = setTimeout(() => expirePeer(room, socketId, hooks), graceMs);
  // A grace clock must never keep the process alive on its own.
  timer.unref?.();
  peer.graceTimer = timer;
  return true;
}

/**
 * The grace window closed without a re-join: the peer is gone for real.
 * Safe to call on a peer that was already taken over or removed — it does
 * nothing unless the entry is still there and still disconnected.
 */
export function expirePeer<P extends PresencePeer>(
  room: PresenceRoom<P>,
  socketId: string,
  hooks: PresenceHooks<P>
): boolean {
  const peer = room.peers.get(socketId);
  if (!peer || isConnected(peer)) return false;
  clearTimer(peer);
  room.peers.delete(socketId);
  hooks.onPeerLeft(socketId, peer, "timeout");
  afterRemoval(room, hooks);
  return true;
}

/**
 * Remove a peer now — a deliberate leave or a host's kick. Works on connected
 * and in-grace peers alike, and silences the grace clock either way.
 */
export function removePeer<P extends PresencePeer>(
  room: PresenceRoom<P>,
  socketId: string,
  hooks: PresenceHooks<P>,
  reason: Exclude<LeaveReason, "timeout">
): P | undefined {
  const peer = room.peers.get(socketId);
  if (!peer) return undefined;
  clearTimer(peer);
  room.peers.delete(socketId);
  hooks.onPeerLeft(socketId, peer, reason);
  afterRemoval(room, hooks);
  return peer;
}

/** What a joining client says about the device it is on. */
export interface DeviceRef {
  deviceId?: string;
  deviceType?: "web" | "mobile";
}

/**
 * Is `seat` the same physical device as the joiner `me`?
 *
 * Exact when both sides carry a device id. Otherwise a heuristic for clients
 * that predate device ids: a seat of the same kind whose socket has dropped
 * is, in all likelihood, this device coming back — a refresh, a relaunch. A
 * seat that is still connected can only be the same device when the ids say
 * so; two tabs and two phones are different devices.
 */
export function isSameDevice(me: DeviceRef, seat: PresencePeer): boolean {
  if (me.deviceId && seat.deviceId) return me.deviceId === seat.deviceId;
  return !isConnected(seat) && !!me.deviceType && me.deviceType === seat.deviceType;
}

/** Every seat this user holds, connected or in grace, other than `exceptSocketId`. */
export function seatsOfUser<P extends PresencePeer>(
  room: PresenceRoom<P>,
  userId: string,
  exceptSocketId?: string
): Array<[string, P]> {
  if (!userId) return [];
  return Array.from(room.peers.entries()).filter(
    ([socketId, peer]) => peer.userId === userId && socketId !== exceptSocketId
  );
}

/**
 * Of several seats, the one to treat as "where they are": a connected seat
 * before one in grace, then the freshest drop.
 */
export function pickActiveSeat<P extends PresencePeer>(
  seats: Array<[string, P]>
): [string, P] | undefined {
  return [...seats].sort(([, a], [, b]) => {
    const ac = isConnected(a) ? 1 : 0;
    const bc = isConnected(b) ? 1 : 0;
    if (ac !== bc) return bc - ac;
    return (b.disconnectedAt ?? 0) - (a.disconnectedAt ?? 0);
  })[0];
}

/**
 * Pull a seat out of the map, silencing its grace clock, and hand it back so
 * a join can carry its state over onto a new socket. Announces nothing and
 * never reports the room empty: the caller re-installs the record itself,
 * synchronously, or announces the removal through `removePeer` instead.
 */
export function takeSeat<P extends PresencePeer>(
  room: PresenceRoom<P>,
  socketId: string
): P | undefined {
  const peer = room.peers.get(socketId);
  if (!peer) return undefined;
  clearTimer(peer);
  room.peers.delete(socketId);
  peer.disconnectedAt = null;
  return peer;
}

/** Drop every pending grace clock — the room is being torn down. */
export function clearGraceTimers(room: PresenceRoom): void {
  for (const peer of room.peers.values()) clearTimer(peer);
}
