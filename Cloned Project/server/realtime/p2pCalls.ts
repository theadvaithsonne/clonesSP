import crypto from "crypto";

/**
 * Peer-to-peer 1:1 calls (mobile ↔ mobile).
 *
 * The knock/ring flow is unchanged. At accept time, when both apps advertise
 * P2P support, the server skips LiveKit and hands both sides the ICE servers;
 * the audio then flows directly between the phones. The server only relays
 * signalling (SDP offer/answer, ICE candidates) through `call:signal`.
 *
 * When a direct path can't be found (symmetric NAT / carrier-grade NAT, common
 * on Indian mobile networks) and no TURN relay is configured, the caller asks
 * for `call:p2p-fallback` and the call moves onto LiveKit, the existing path.
 *
 * Web clients and older app versions never send the capability flag, so they
 * keep getting LiveKit exactly as before.
 */

/** Bump when the client/server P2P signalling contract changes. */
export const P2P_PROTOCOL = 1;

export interface P2PCall {
  callId: string;
  channelName: string;
  hostId: string; // accepted the knock (answerer)
  guestId: string; // knocked (offerer; pre-warmed while ringing)
  hostSocketId: string;
  guestSocketId: string;
  hostName: string;
  guestName: string;
  orgId?: string;
  fellBack: boolean;
  createdAt: number;
}

// Entries are removed on `call:end`; the timer only catches calls whose
// clients vanished without ending.
const MAX_CALL_AGE_MS = 6 * 60 * 60 * 1000;
export const p2pCalls = new Map<string, P2PCall>();

export function registerP2PCall(call: Omit<P2PCall, "fellBack" | "createdAt">): P2PCall {
  const full: P2PCall = { ...call, fellBack: false, createdAt: Date.now() };
  p2pCalls.set(call.callId, full);
  setTimeout(() => p2pCalls.delete(call.callId), MAX_CALL_AGE_MS).unref?.();
  return full;
}

/** The other participant, or null when `userId` isn't in the call. */
export function peerOf(call: P2PCall, userId: string): string | null {
  if (userId === call.hostId) return call.guestId;
  if (userId === call.guestId) return call.hostId;
  return null;
}

/**
 * A participant's socket id changes whenever it reconnects (a network switch
 * mid-call does exactly that). Track the latest one from their signalling,
 * so a LiveKit fallback reaches the phone on the call rather than every
 * device of the account, where another device could join under the same
 * identity and kick it out.
 */
export function noteCallSocket(call: P2PCall, userId: string, socketId: string): void {
  if (userId === call.hostId) call.hostSocketId = socketId;
  else if (userId === call.guestId) call.guestSocketId = socketId;
}

export function newCallId(): string {
  return crypto.randomUUID();
}

// ─── ICE servers ─────────────────────────────────────────────────────────
//
// STUN (free, public) lets most calls connect directly. TURN relays the rest.
// Configure one of, in order of precedence:
//
//   Cloudflare TURN   CLOUDFLARE_TURN_KEY_ID + CLOUDFLARE_TURN_API_TOKEN
//                     (short-lived credentials minted per call batch)
//   coturn            TURN_URLS + TURN_SECRET (REST-API ephemeral creds,
//                     `use-auth-secret` / `static-auth-secret` in coturn)
//   static            TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
//
// With none set, calls use STUN only and fall back to LiveKit when the direct
// path fails.

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

const DEFAULT_STUN = ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"];
const TURN_CREDENTIAL_TTL_S = 24 * 60 * 60;

function splitList(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

let cloudflareCache: { servers: IceServer[]; expiresAt: number } | null = null;

async function cloudflareTurn(): Promise<IceServer[] | null> {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (!keyId || !token) return null;

  // Reuse credentials for half their lifetime: minting per call would add a
  // network round trip to every call setup.
  if (cloudflareCache && cloudflareCache.expiresAt > Date.now()) {
    return cloudflareCache.servers;
  }
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TURN_CREDENTIAL_TTL_S }),
        signal: AbortSignal.timeout(3000),
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body: any = await res.json();
    const raw = body?.iceServers;
    const servers: IceServer[] = (Array.isArray(raw) ? raw : [raw]).filter(Boolean);
    cloudflareCache = {
      servers,
      expiresAt: Date.now() + (TURN_CREDENTIAL_TTL_S * 1000) / 2,
    };
    return servers;
  } catch (e: any) {
    console.error("[P2P] Cloudflare TURN credential request failed:", e?.message);
    return cloudflareCache?.servers ?? null;
  }
}

function coturnTurn(userId: string): IceServer[] | null {
  const urls = splitList(process.env.TURN_URLS);
  if (urls.length === 0) return null;

  const secret = process.env.TURN_SECRET;
  if (secret) {
    const username = `${Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_S}:${userId}`;
    const credential = crypto.createHmac("sha1", secret).update(username).digest("base64");
    return [{ urls, username, credential }];
  }
  const username = process.env.TURN_USERNAME;
  const credential = process.env.TURN_CREDENTIAL;
  if (username && credential) return [{ urls, username, credential }];
  return null;
}

export async function getIceServers(userId: string): Promise<IceServer[]> {
  const stun = splitList(process.env.STUN_URLS);
  const servers: IceServer[] = [{ urls: stun.length ? stun : DEFAULT_STUN }];
  const turn = (await cloudflareTurn()) ?? coturnTurn(userId);
  if (turn) servers.push(...turn);
  return servers;
}

/** True when a TURN relay is configured, so clients needn't fall back early. */
export function hasTurnRelay(): boolean {
  return (
    !!(process.env.CLOUDFLARE_TURN_KEY_ID && process.env.CLOUDFLARE_TURN_API_TOKEN) ||
    splitList(process.env.TURN_URLS).length > 0
  );
}
