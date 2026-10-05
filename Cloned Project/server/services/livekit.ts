import {
  AccessToken,
  RoomServiceClient,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
  SegmentedFileOutput,
  TrackSource,
} from "livekit-server-sdk";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";
const LIVEKIT_URL = process.env.LIVEKIT_URL || "ws://134.209.159.166:7880";

// Derive HTTP URL from WS URL for API calls
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace("wss://", "https://").replace("ws://", "http://");

/** Sanitize a spaceId/channel into a valid LiveKit room name (only A-Z, a-z, 0-9, '-', '_') */
export function toLivekitRoomName(spaceId: string): string {
  return spaceId.replace(/[^A-Za-z0-9\-_]/g, "-");
}

// Guest UID range: 2,000,000 - 2,999,999 (kept for backward compatibility with existing DB records)
const GUEST_UID_MIN = 2000000;
const GUEST_UID_MAX = 2999999;
const usedGuestUids = new Set<number>();

/**
 * Generate a unique numeric UID for guest users.
 * Kept for backward compatibility with existing database models that store agoraUid.
 */
export function generateGuestUid(): number {
  let attempts = 0;
  const maxAttempts = 100;

  while (attempts < maxAttempts) {
    const uid = Math.floor(Math.random() * (GUEST_UID_MAX - GUEST_UID_MIN + 1)) + GUEST_UID_MIN;
    if (!usedGuestUids.has(uid)) {
      usedGuestUids.add(uid);
      setTimeout(() => { usedGuestUids.delete(uid); }, 24 * 60 * 60 * 1000);
      return uid;
    }
    attempts++;
  }

  const timestamp = Date.now() % 999999;
  return GUEST_UID_MIN + timestamp;
}

interface CreateRoomOptions {
  exp?: number;
  max_participants?: number;
  enable_chat?: boolean;
  enable_recording?: string;
}

interface CreateRoomResponse {
  name: string;
}

export function getRoomServiceClient(): RoomServiceClient | null {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error("[LIVEKIT] LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing");
    return null;
  }
  return new RoomServiceClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

function getEgressClient(): EgressClient | null {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error("[LIVEKIT] LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing");
    return null;
  }
  return new EgressClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
}

/**
 * Delete a LiveKit room by name.
 * Returns true if deleted successfully or room didn't exist.
 */
export async function deleteRoom(name: string): Promise<boolean> {
  const client = getRoomServiceClient();
  if (!client) return false;

  try {
    await client.deleteRoom(name);
    console.log(`[LIVEKIT] Deleted room: ${name}`);
    return true;
  } catch (error: any) {
    // Room not found is OK
    if (error?.message?.includes("not found") || error?.code === 5) {
      console.log(`[LIVEKIT] Room ${name} not found (already deleted)`);
      return true;
    }
    console.error("[LIVEKIT] Error deleting room:", error);
    return false;
  }
}

/**
 * Create a LiveKit room. If it already exists, returns the existing room name.
 * LiveKit rooms are created on-demand when a participant joins with a valid token,
 * but explicit creation lets us set max_participants and other options.
 */
export async function createRoom(
  name: string,
  options?: CreateRoomOptions
): Promise<CreateRoomResponse> {
  const client = getRoomServiceClient();
  if (!client) return { name: "" };

  try {
    const roomOptions: any = {
      name,
      emptyTimeout: 300, // 5 minutes empty timeout
      maxParticipants: options?.max_participants || 0, // 0 = unlimited
    };

    const room = await client.createRoom(roomOptions);
    console.log(`[LIVEKIT] Created room: ${room.name}`);
    return { name: room.name };
  } catch (error: any) {
    // Room already exists is not an error in LiveKit - it just returns the existing room
    console.error("[LIVEKIT] Error creating room:", error);
    return { name };
  }
}

interface CreateParticipantTokenOptions {
  userId: string;
  userName?: string;
  isOwner?: boolean;
  exp?: number;
  enableScreenshare?: boolean;
  canPublish?: boolean; // Default: true. Set false for audience-only participants.
  // Fine-grained per-source publish allowlist. When provided, LiveKit only
  // lets the participant publish tracks whose Source is in this list — camera,
  // microphone, screen-share, and screen-share-audio can be toggled
  // independently. Used by the conference access-control policy (host locks
  // mic and/or screen-share until they approve a request).
  canPublishSources?: TrackSource[];
  // JSON-string metadata exposed to other participants on the LiveKit
  // `participant.metadata` field. Use it to convey role, isGuest, etc.
  metadata?: string;
}

/**
 * Create a LiveKit participant token (JWT).
 * The token encodes the room name, participant identity, and permissions.
 */
export async function createParticipantToken(
  roomName: string,
  options: CreateParticipantTokenOptions
): Promise<string> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    console.error("[LIVEKIT] LIVEKIT_API_KEY or LIVEKIT_API_SECRET is missing");
    return "";
  }

  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: options.userId,
      name: options.userName || options.userId,
      ttl: options.exp ? `${options.exp}s` : "6h",
      metadata: options.metadata,
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: options.canPublish !== false,
      canSubscribe: true,
      roomAdmin: options.isOwner || false,
      canPublishData: true, // For chat messages via DataChannel
      ...(options.canPublishSources && options.canPublishSources.length > 0
        ? { canPublishSources: options.canPublishSources }
        : {}),
    });

    const token = await at.toJwt();
    console.log(`[LIVEKIT] Created token for user ${options.userId} in room ${roomName} (owner=${options.isOwner || false})`);
    return token;
  } catch (error) {
    console.error("[LIVEKIT] Error creating participant token:", error);
    return "";
  }
}

// --- Recording tracking ---
// Maps LiveKit room names to recording context (org, user, meeting title)
// Populated when users join calls, used by webhook to know where to upload
export interface RecordingContext {
  organizationId: string;
  userId: string;
  meetingTitle: string;
  spaceId: string;
  // Set for webinar (workshop-backed) recordings so the egress webhook can
  // tag the OrganizationFile with the workshopId and a recordingSource the
  // Learn → Live Streams page recognises.
  workshopId?: string;
  recordingSource?: string;
}

const recordingContextMap = new Map<string, RecordingContext>();

export function setRecordingContext(roomName: string, context: RecordingContext) {
  recordingContextMap.set(roomName, context);
  // Auto-expire after 4 hours
  setTimeout(() => recordingContextMap.delete(roomName), 4 * 60 * 60 * 1000);
}

export function getRecordingContext(roomName: string) {
  return recordingContextMap.get(roomName) || null;
}

// --- Recording Egress ---

// Track active egress IDs per room
const activeEgressMap = new Map<string, string>();

export function setActiveEgress(roomName: string, egressId: string) {
  activeEgressMap.set(roomName, egressId);
}

export function getActiveEgress(roomName: string): string | null {
  return activeEgressMap.get(roomName) || null;
}

export function clearActiveEgress(roomName: string) {
  activeEgressMap.delete(roomName);
}

/**
 * Start a room composite egress (recording).
 * Records the entire room into a single file.
 *
 * `layout` controls the LiveKit egress template used to render the file:
 *   - "speaker"  (default) — large active speaker, side strip
 *   - "grid"     — Google-Meet style grid of every publisher
 *   - "grid-light" / "grid-dark" — themed grid variants
 *   - "single-speaker" — only the active speaker
 * For webinars we default to "grid" so every panelist appears in the file.
 *
 * `directS3Upload` (default false): when true, the LiveKit egress server
 * uploads the final MP4 directly to our S3 bucket instead of staging it on
 * its own disk and waiting for the webhook handler to download + reupload.
 * This is critical for local dev (where the webhook can't reach localhost)
 * and is also lower-latency in prod.
 */
export async function startRoomCompositeEgress(
  roomName: string,
  opts: {
    layout?: string;
    directS3Upload?: boolean;
    s3KeyPrefix?: string;
    /**
     * When true, also produce HLS segments + manifest in addition to the
     * single MP4. The segments stream to S3 every ~6s during recording so
     * playback can begin before the egress completes and we keep partial
     * footage if the egress process crashes.
     */
    withSegments?: boolean;
  } = {}
): Promise<string | null> {
  const client = getEgressClient();
  if (!client) return null;

  try {
    const filepathPrefix = opts.s3KeyPrefix || `recordings/${roomName}`;
    const mp4Path = `${filepathPrefix}/{time}.mp4`;
    const hlsPlaylist = `${filepathPrefix}/hls/index.m3u8`;
    const hlsSegmentPrefix = `${filepathPrefix}/hls/seg`;

    // Build a reusable S3Upload spec from env. Missing creds → fall back to
    // LK temp storage for that output.
    const s3Spec = (() => {
      const accessKey = process.env.AWS_ACCESS_KEY_ID || "";
      const secret = process.env.AWS_SECRET_ACCESS_KEY || "";
      const bucket = process.env.AWS_S3_BUCKET || "";
      const region = process.env.AWS_S3_REGION || "";
      if (!accessKey || !secret || !bucket) return null;
      return new S3Upload({
        accessKey,
        secret,
        bucket,
        region,
        forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
        ...(process.env.AWS_S3_ENDPOINT
          ? { endpoint: process.env.AWS_S3_ENDPOINT }
          : {}),
      });
    })();

    if (opts.directS3Upload && !s3Spec) {
      console.error(
        "[LIVEKIT] Missing AWS credentials for direct S3 upload — falling back to LK temp storage"
      );
    }

    const fileOutputArgs: any = {
      fileType: EncodedFileType.MP4,
      filepath: mp4Path,
    };
    if (opts.directS3Upload && s3Spec) {
      fileOutputArgs.output = { case: "s3", value: s3Spec };
    }
    const fileOutput = new EncodedFileOutput(fileOutputArgs);

    let segmentsOutput: SegmentedFileOutput | undefined;
    if (opts.withSegments) {
      const segArgs: any = {
        // protocol 0 = HLS (default)
        filenamePrefix: hlsSegmentPrefix,
        playlistName: hlsPlaylist,
        segmentDuration: 6,
      };
      if (opts.directS3Upload && s3Spec) {
        segArgs.output = { case: "s3", value: s3Spec };
      }
      segmentsOutput = new SegmentedFileOutput(segArgs);
    }

    // EncodedOutputs lets a single egress request emit both the single MP4
    // and the HLS stream simultaneously. Same Chrome instance, same input —
    // no extra encoding cost beyond storage.
    const egress = await client.startRoomCompositeEgress(
      roomName,
      segmentsOutput
        ? { file: fileOutput, segments: segmentsOutput }
        : fileOutput,
      { layout: opts.layout }
    );
    const egressId = egress.egressId;
    console.log(
      `[LIVEKIT] Started recording for room ${roomName}, egressId: ${egressId}, layout: ${opts.layout || "(default)"}, directS3=${!!opts.directS3Upload}, segments=${!!opts.withSegments}, mp4=${mp4Path}`
    );
    setActiveEgress(roomName, egressId);
    return egressId;
  } catch (error) {
    console.error("[LIVEKIT] Error starting room composite egress:", error);
    return null;
  }
}

/**
 * Stop an active egress (recording).
 */
export async function stopEgress(egressId: string): Promise<boolean> {
  const client = getEgressClient();
  if (!client) return false;

  try {
    await client.stopEgress(egressId);
    console.log(`[LIVEKIT] Stopped egress: ${egressId}`);
    return true;
  } catch (error) {
    console.error("[LIVEKIT] Error stopping egress:", error);
    return false;
  }
}

export interface EgressFileInfo {
  s3Key: string | null;
  size: number;
  duration: number;
}

/**
 * Poll the egress until it's COMPLETE (or fails / times out) and return the
 * resulting file's S3 key. Used to surface a downloadable URL to the host
 * the moment the recording is finalized — no webhook required.
 *
 * Timeout defaults to 30 min. Composite egress on a single-CPU worker can
 * take 5–10 min for typical webinars (encoding finish + S3 upload) and
 * longer on weaker hardware, so we err on the side of waiting rather than
 * dropping the registration.
 */
export async function waitForEgressFile(
  egressId: string,
  timeoutMs = 30 * 60_000,
  intervalMs = 3_000
): Promise<EgressFileInfo | null> {
  const client = getEgressClient();
  if (!client) return null;

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const list = await client.listEgress({ egressId });
      const info = list?.[0];
      if (info) {
        // EGRESS_COMPLETE = 3, EGRESS_FAILED = 4 (handle both as terminal)
        if (info.status === 3 || info.status === 4) {
          const file = info.fileResults?.[0];
          if (!file) return { s3Key: null, size: 0, duration: 0 };
          let s3Key: string | null = null;
          if (file.filename) s3Key = file.filename.replace(/^\/+/, "");
          else if (file.location) {
            try {
              s3Key = new URL(file.location).pathname.replace(/^\/+/, "");
            } catch {
              s3Key = null;
            }
          }
          return {
            s3Key,
            size: Number(file.size || 0) || 0,
            duration: Number(file.duration || 0) || 0,
          };
        }
      }
    } catch (err: any) {
      console.warn(
        `[LIVEKIT] waitForEgressFile poll error for ${egressId}:`,
        err?.message ?? err
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  console.warn(`[LIVEKIT] waitForEgressFile timed out for ${egressId}`);
  return null;
}

/** Get the LiveKit server URL (for clients to connect to) */
export function getLivekitUrl(): string {
  return LIVEKIT_URL;
}

/**
 * Count participants in a LiveKit room whose identity starts with "audience-".
 * These are pre-guest viewers connected via the workshop-preview audience-token
 * endpoint. Returns 0 if the room doesn't exist or the API call fails.
 */
export async function getAudiencePreviewCount(roomName: string): Promise<number> {
  const client = getRoomServiceClient();
  if (!client) return 0;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("livekit_timeout")), 3000)
    );
    const participants = await Promise.race([client.listParticipants(roomName), timeout]);
    return participants.filter((p) => p.identity.startsWith("audience-")).length;
  } catch {
    return 0;
  }
}

/**
 * How many REAL participants a webinar's LiveKit room still has — everyone
 * except preview-card audience and the note-taker bot. This is the tie-breaker
 * when the socket room looks empty: phones in PiP and suspended tabs drop
 * their socket long before they drop their media, and tearing the session
 * down while people are still watching is the one thing we must not do.
 *
 * Returns null when LiveKit could not be asked (no client, timeout, error) so
 * the caller can fall back to the socket-only answer.
 */
export async function countWebinarParticipants(roomName: string): Promise<number | null> {
  const client = getRoomServiceClient();
  if (!client) return null;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("livekit_timeout")), 3000)
    );
    const participants = await Promise.race([client.listParticipants(roomName), timeout]);
    return participants.filter(
      (p) => !p.identity.startsWith("audience-") && !p.identity.includes("notetaker")
    ).length;
  } catch {
    return null;
  }
}

/**
 * Count active viewers in a webinar LiveKit room, excluding:
 * - The host (matched by hostUserId)
 * - Preview-card audience members (identity starts with "audience-")
 * Returns 0 if the room doesn't exist or the API call fails.
 * Times out after 3 s so it never blocks the /workshop-preview/live poll.
 */
export async function getWebinarViewerCount(roomName: string, hostUserId: string): Promise<number> {
  const client = getRoomServiceClient();
  if (!client) return 0;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("livekit_timeout")), 3000)
    );
    const participants = await Promise.race([client.listParticipants(roomName), timeout]);
    return participants.filter((p) => {
      if (p.identity === hostUserId) return false;
      if (p.identity === "notetaker-bot") return false;
      if (p.identity.startsWith("audience-")) return false;
      return true;
    }).length;
  } catch {
    return 0;
  }
}

/**
 * Atomically update a participant's publish/subscribe permissions in an
 * already-joined room. Used by the webinar promote/demote flow so a hosted
 * attendee can become a panelist (gaining canPublish) without reconnecting
 * to LiveKit.
 *
 * NOTE: LiveKit applies permissions atomically — every desired flag must be
 * set on each call.
 */
export async function setParticipantPublishGrant(
  roomName: string,
  identity: string,
  canPublish: boolean
): Promise<boolean> {
  const client = getRoomServiceClient();
  if (!client) return false;

  try {
    await client.updateParticipant(roomName, identity, {
      permission: {
        canPublish,
        canSubscribe: true,
        canPublishData: true,
      },
    });
    console.log(
      `[LIVEKIT] Updated participant ${identity} in ${roomName}: canPublish=${canPublish}`
    );
    return true;
  } catch (error: any) {
    console.error(
      `[LIVEKIT] updateParticipant failed for ${identity} in ${roomName}:`,
      error?.message ?? error
    );
    return false;
  }
}

/**
 * Update the fine-grained per-source publish allowlist for a joined
 * participant. Used by the conference access-control flow to grant a
 * previously-locked participant permission to publish mic and/or
 * screen-share after the host approves their request.
 */
export async function setParticipantPublishSources(
  roomName: string,
  identity: string,
  sources: TrackSource[]
): Promise<boolean> {
  const client = getRoomServiceClient();
  if (!client) return false;

  try {
    await client.updateParticipant(roomName, identity, {
      permission: {
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canPublishSources: sources,
      },
    });
    console.log(
      `[LIVEKIT] Updated participant ${identity} in ${roomName}: sources=[${sources.join(",")}]`
    );
    return true;
  } catch (error: any) {
    console.error(
      `[LIVEKIT] updateParticipant (sources) failed for ${identity} in ${roomName}:`,
      error?.message ?? error
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Conference access-control policy store
// ---------------------------------------------------------------------------
// Room-level policy set by the host BEFORE starting the conference. Governs
// what a non-host participant may publish without asking. When either flag is
// false, the participant's join token is minted with a canPublishSources
// allowlist that excludes the corresponding LiveKit sources — they can still
// see and hear everyone, they just can't unmute or share until the host
// grants it via setParticipantPublishSources().
//
// In-memory only (auto-expires with the room). If the box restarts the
// policy resets to permissive — acceptable since the meeting will have
// already ended.
export interface ConferencePolicy {
  allowUnmute: boolean;   // default true
  allowPresent: boolean;  // default true
  hostUserId?: string;    // who set it — informational
}

const conferencePolicyMap = new Map<string, ConferencePolicy>();

export function setConferencePolicy(roomName: string, policy: ConferencePolicy) {
  conferencePolicyMap.set(roomName, policy);
  // Auto-expire after 8 hours (well beyond a normal meeting)
  setTimeout(() => conferencePolicyMap.delete(roomName), 8 * 60 * 60 * 1000);
}

export function getConferencePolicy(roomName: string): ConferencePolicy | null {
  return conferencePolicyMap.get(roomName) || null;
}

/**
 * Given a policy, return the LiveKit source allowlist for a NON-host joiner.
 * Camera is always allowed (video isn't "unmute" in the product sense).
 * When both flags are true this returns null → no allowlist, i.e. full
 * publish rights.
 */
export function policyToSources(
  policy: ConferencePolicy | null
): TrackSource[] | null {
  if (!policy) return null;
  if (policy.allowUnmute && policy.allowPresent) return null;

  const sources: TrackSource[] = [TrackSource.CAMERA];
  if (policy.allowUnmute) sources.push(TrackSource.MICROPHONE);
  if (policy.allowPresent) {
    sources.push(TrackSource.SCREEN_SHARE);
    sources.push(TrackSource.SCREEN_SHARE_AUDIO);
  }
  return sources;
}

export { TrackSource };
