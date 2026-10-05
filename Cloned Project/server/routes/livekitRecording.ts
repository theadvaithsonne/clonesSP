import { Router, Request, Response } from "express";
import { WebhookReceiver } from "livekit-server-sdk";
import {
  getRecordingContext,
  startRoomCompositeEgress,
  stopEgress,
  getActiveEgress,
  clearActiveEgress,
  getRoomServiceClient,
  getConferencePolicy,
  setConferencePolicy,
  policyToSources,
  setParticipantPublishSources,
  TrackSource,
  type ConferencePolicy,
  createParticipantToken,
  generateGuestUid,
} from "../services/livekit";
import { BotManager as ConferenceBotManager } from "../note-taker/agents/bot-manager";
import { ensureConferenceNoteTaker } from "../realtime/socket";
import { getSocketInstance } from "../services/socket";
// The live webinar peer map — who is in the room and with what role. Used to
// check that only a host or panelist can grant/deny publish permission.
import { getRoom as getWebinarRoom } from "../services/mediasoup";
import { User } from "../models/user.model";
import { s3Service } from "../services/s3";
import {
  OrganizationCabinet,
  OrganizationFile,
} from "../models/cabinet.model";
import { compressVideo } from "../utils/videoCompression";
import { requireAuth } from "../middleware/auth";

const router = Router();

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || "";
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || "";

/**
 * POST /livekit/recording/start
 * Start recording a LiveKit room via Egress API.
 */
router.post("/recording/start", async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body;
    if (!roomName) {
      return res.status(400).json({ error: "roomName is required" });
    }

    const existing = getActiveEgress(roomName);
    if (existing) {
      return res.status(409).json({ error: "Recording already active", egressId: existing });
    }

    // Conference (hq-room) recordings MUST upload straight to the org S3 bucket
    // — the egress_ended webhook registers the OrganizationFile at
    // `recordings/<room>/<time>.mp4` and assumes it's there. Without
    // directS3Upload the egress writes to LK's own storage instead, so the key
    // never exists in our bucket (NoSuchKey / 0-byte file on download). Grid
    // layout captures every participant. Scoped to hq-room so other rooms keep
    // their existing behaviour.
    const isConference = typeof roomName === "string" && roomName.startsWith("hq-room");
    const egressId = await startRoomCompositeEgress(
      roomName,
      isConference ? { layout: "grid", directS3Upload: true } : undefined
    );
    if (!egressId) {
      return res.status(500).json({ error: "Failed to start recording" });
    }

    return res.json({ egressId, roomName });
  } catch (error) {
    console.error("[LIVEKIT RECORDING] Error starting recording:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /livekit/recording/stop
 * Stop an active recording.
 */
router.post("/recording/stop", async (req: Request, res: Response) => {
  try {
    const { egressId } = req.body;
    if (!egressId) {
      return res.status(400).json({ error: "egressId is required" });
    }

    const success = await stopEgress(egressId);
    if (!success) {
      return res.status(500).json({ error: "Failed to stop recording" });
    }

    return res.json({ stopped: true, egressId });
  } catch (error) {
    console.error("[LIVEKIT RECORDING] Error stopping recording:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /webhooks/livekit
 * Handles LiveKit webhook events, primarily egress_ended for recording uploads.
 */
export const livekitWebhookRouter = Router();

livekitWebhookRouter.post("/", async (req: Request, res: Response) => {
  try {
    let event: any;

    // Parse and verify webhook
    if (LIVEKIT_API_KEY && LIVEKIT_API_SECRET) {
      const receiver = new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
      const authHeader = req.headers.authorization as string;
      try {
        event = await receiver.receive(rawBody, authHeader);
      } catch (verifyError) {
        console.error("[LIVEKIT WEBHOOK] Signature verification failed:", verifyError);
        return res.status(401).json({ error: "Invalid signature" });
      }
    } else {
      // Dev mode — accept without verification
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : JSON.stringify(req.body);
      event = typeof req.body === "string" ? JSON.parse(req.body) :
              Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;
    }

    console.log(`[LIVEKIT WEBHOOK] Received event: ${event.event}`);

    // Handle egress finished (recording complete)
    if (event.event === "egress_ended" && event.egressInfo) {
      const egressInfo = event.egressInfo;
      const roomName = egressInfo.roomName;
      const egressId = egressInfo.egressId;

      console.log(`[LIVEKIT WEBHOOK] Egress ended: id=${egressId}, room=${roomName}`);

      // Clear active egress tracking
      if (roomName) clearActiveEgress(roomName);

      // Look up recording context
      const context = roomName ? getRecordingContext(roomName) : null;
      if (!context) {
        console.warn(`[LIVEKIT WEBHOOK] No recording context for room ${roomName}. Skipping upload.`);
        return res.status(200).json({ received: true, skipped: "no context" });
      }

      // Get the file result from egress
      const fileResult = egressInfo.fileResults?.[0];
      if (!fileResult) {
        console.warn(`[LIVEKIT WEBHOOK] No fileResult in egress for ${egressId}`);
        return res.status(200).json({ received: true, skipped: "no file result" });
      }

      // Process in background
      res.status(200).json({ received: true, processing: true });

      // Two paths:
      //   1. LK-temp upload (legacy): file is on LK's disk, fileResult has a
      //      downloadUrl — we download + reupload to S3 ourselves.
      //   2. Direct S3 upload (new): LK egress wrote straight to our bucket;
      //      `filename` is the S3 key. We just write the OrganizationFile row.
      const directS3Key = !fileResult.downloadUrl
        ? deriveS3KeyFromFileResult(fileResult)
        : null;

      if (directS3Key) {
        registerDirectS3Recording(directS3Key, fileResult, roomName, egressId, context).catch(
          (err) => console.error(`[LIVEKIT WEBHOOK] register direct-S3 failed:`, err)
        );
      } else if (fileResult.downloadUrl) {
        processRecording(fileResult.downloadUrl, roomName, egressId, context).catch(
          (err) => console.error(`[LIVEKIT WEBHOOK] processRecording failed:`, err)
        );
      } else {
        console.warn(`[LIVEKIT WEBHOOK] No downloadUrl AND no S3 key in egress ${egressId}`);
      }

      return;
    }

    // Garage TV / preview-card watchers of a live webinar. LiveKit gives them
    // an "audience-*" identity (see getWebinarViewerCount), so a joined event
    // with that shape is a viewer arriving from a reel. Recorded once per
    // identity on the session override — its length is the session's viewer
    // count in the founder analytics.
    if (event.event === "participant_joined" && event.participant?.identity) {
      recordGarageTvViewer(
        event.room?.name as string | undefined,
        event.participant.identity as string
      ).catch((err) =>
        console.warn("[LIVEKIT WEBHOOK] garageTv viewer record failed:", err)
      );
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[LIVEKIT WEBHOOK] Error handling webhook:", error);
    return res.status(200).json({ received: true, error: "processing failed" });
  }
});

/**
 * Append a Garage TV viewer to the live session's override document.
 *
 * Room names are `toLivekitRoomName("webinar-<workshopId>")`, which only
 * rewrites characters outside [A-Za-z0-9-_] — an ObjectId survives intact, so
 * the id can be read straight back off the name.
 *
 * The session it belongs to is the one the founder is running:
 * `workshop.currentSessionDate` (stamped when they go live), else today's UTC
 * midnight — the same anchor POST /webinar/:id/start uses.
 */
async function recordGarageTvViewer(roomName?: string, identity?: string) {
  if (!roomName || !identity || !identity.startsWith("audience-")) return;
  const match = /^webinar-([A-Fa-f0-9]{24})$/.exec(roomName);
  if (!match) return;

  const { Types } = await import("mongoose");
  const { Workshop } = await import("../models/workshop.model");
  const { WorkshopSessionOverride } = await import(
    "../models/workshopSessionOverride.model"
  );

  const workshopId = match[1];
  const workshop = await Workshop.findById(workshopId)
    .select(
      "currentSessionDate date isRecurring recurrencePattern recurrenceStartDate recurrenceEndDate startTime endTime timezone"
    )
    .lean();
  if (!workshop) return;

  const { resolveLiveSessionKey } = await import("../utils/workshopStatus");
  const sessionDate = await resolveLiveSessionKey(workshop as any);

  await WorkshopSessionOverride.findOneAndUpdate(
    { workshopId: new Types.ObjectId(workshopId), sessionDate },
    {
      $addToSet: { garageTvViewerIds: identity },
      $setOnInsert: {
        workshopId: new Types.ObjectId(workshopId),
        sessionDate,
      },
    },
    { upsert: true }
  );
}

/**
 * Pull the S3 key out of an egress fileResult when LiveKit uploaded directly
 * to our bucket. `filename` is the absolute path the egress server wrote to;
 * it equals the `filepath` we passed in `EncodedFileOutput`.
 */
function deriveS3KeyFromFileResult(fileResult: any): string | null {
  if (typeof fileResult.filename === "string" && fileResult.filename.length > 0) {
    return fileResult.filename.replace(/^\/+/, "");
  }
  if (typeof fileResult.location === "string") {
    // location is e.g. https://<bucket>.s3.<region>.amazonaws.com/<key>
    try {
      const url = new URL(fileResult.location);
      return url.pathname.replace(/^\/+/, "");
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * For direct-to-S3 egress uploads: the file is already in our bucket, so we
 * skip download + reupload and just persist the OrganizationFile row that
 * Learn → Live Streams (and the cabinet UI) read from.
 *
 * Idempotent — if a row already exists for this egressId we skip. That lets
 * us call this from BOTH the webhook handler AND the inline-after-stop path
 * in `awaitWebinarRecordingFile` without creating duplicate rows.
 */
export async function registerDirectS3Recording(
  s3Key: string,
  fileResult: { size?: number; duration?: number } | null,
  roomName: string,
  egressId: string,
  context: {
    organizationId: string;
    userId: string;
    meetingTitle: string;
    spaceId: string;
    workshopId?: string;
    recordingSource?: string;
  }
): Promise<void> {
  // Dedupe: if this egress already produced an OrganizationFile, do nothing.
  const existing = await OrganizationFile.findOne({
    "metadata.livekitEgressId": egressId,
  })
    .select("_id")
    .lean();
  if (existing) {
    console.log(
      `[LIVEKIT] OrganizationFile already exists for egress ${egressId} (${existing._id}) — skipping register`
    );
    return;
  }

  console.log(
    `[LIVEKIT] Registering direct-S3 recording for ${egressId}: ${s3Key}`
  );

  // Find / create the Recordings cabinet (same pattern as processRecording).
  let orgCabinet = await OrganizationCabinet.findOne({
    organization: context.organizationId,
    isRoot: true,
  });
  if (!orgCabinet) {
    orgCabinet = await OrganizationCabinet.create({
      name: "Organization Cabinet",
      description: "Shared cabinet for all organization members",
      owner: context.userId,
      organization: context.organizationId,
      path: "/organization",
      isRoot: true,
    });
  }
  let recordingsCabinet = await OrganizationCabinet.findOne({
    organization: context.organizationId,
    name: "Recordings",
    parentCabinet: orgCabinet._id,
  });
  if (!recordingsCabinet) {
    recordingsCabinet = await OrganizationCabinet.create({
      name: "Recordings",
      description: "Meeting and workspace recordings",
      owner: context.userId,
      organization: context.organizationId,
      parentCabinet: orgCabinet._id,
      path: `${orgCabinet.path}/Recordings`,
      isRoot: false,
    });
  }

  const friendlyName = `${context.meetingTitle || context.spaceId || "webinar"}_${new Date().toISOString()}.mp4`;
  const sizeBytes = Number(fileResult?.size || 0) || 0;

  const fileRecord = await OrganizationFile.create({
    name: friendlyName,
    originalName: friendlyName,
    owner: context.userId,
    organization: context.organizationId,
    cabinet: recordingsCabinet._id,
    s3Key,
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_S3_REGION || "",
    mimeType: "video/mp4",
    size: sizeBytes,
    extension: "mp4",
    path: `${recordingsCabinet.path}/${friendlyName}`,
    status: "ready",
    metadata: {
      livekitEgressId: egressId,
      livekitRoomName: roomName,
      recordingSource: context.recordingSource || "livekit-egress",
      ...(context.workshopId ? { workshopId: context.workshopId } : {}),
      ...(context.spaceId ? { spaceId: context.spaceId } : {}),
    },
  });

  console.log(
    `[LIVEKIT WEBHOOK] Registered direct-S3 file ${fileRecord._id}: ${friendlyName} (${s3Key})`
  );
}

/**
 * Download a LiveKit recording and upload it to the organization cabinet.
 */
async function processRecording(
  downloadUrl: string,
  roomName: string,
  egressId: string,
  context: {
    organizationId: string;
    userId: string;
    meetingTitle: string;
    spaceId: string;
    workshopId?: string;
    recordingSource?: string;
  }
) {
  console.log(`[LIVEKIT WEBHOOK] Processing recording ${egressId} for org ${context.organizationId}`);

  // 1. Download the recording file
  console.log(`[LIVEKIT WEBHOOK] Downloading recording...`);
  const downloadResponse = await fetch(downloadUrl);
  if (!downloadResponse.ok) {
    console.error(`[LIVEKIT WEBHOOK] Download failed: ${downloadResponse.status}`);
    return;
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const downloadedBuffer = Buffer.from(new Uint8Array(arrayBuffer));
  let mimeType = downloadResponse.headers.get("content-type") || "video/mp4";
  console.log(`[LIVEKIT WEBHOOK] Downloaded ${downloadedBuffer.length} bytes (${mimeType})`);

  // 2. Compress if needed
  let finalBuffer: Buffer = downloadedBuffer;
  try {
    const compressed = await compressVideo(downloadedBuffer, mimeType);
    finalBuffer = Buffer.from(compressed.buffer);
    mimeType = compressed.mimeType;
    console.log(`[LIVEKIT WEBHOOK] Compressed to ${finalBuffer.length} bytes`);
  } catch (e) {
    console.warn("[LIVEKIT WEBHOOK] Compression failed, using original:", e);
  }
  const buffer = finalBuffer;

  // 3. Find or create Organization Cabinet → Recordings folder
  let orgCabinet = await OrganizationCabinet.findOne({
    organization: context.organizationId,
    isRoot: true,
  });

  if (!orgCabinet) {
    orgCabinet = await OrganizationCabinet.create({
      name: "Organization Cabinet",
      description: "Shared cabinet for all organization members",
      owner: context.userId,
      organization: context.organizationId,
      path: "/organization",
      isRoot: true,
    });
  }

  let recordingsCabinet = await OrganizationCabinet.findOne({
    organization: context.organizationId,
    name: "Recordings",
    parentCabinet: orgCabinet._id,
  });

  if (!recordingsCabinet) {
    recordingsCabinet = await OrganizationCabinet.create({
      name: "Recordings",
      description: "Meeting and workspace recordings",
      owner: context.userId,
      organization: context.organizationId,
      parentCabinet: orgCabinet._id,
      path: `${orgCabinet.path}/Recordings`,
      isRoot: false,
    });
  }

  // 4. Upload to S3
  const extension = mimeType.includes("webm") ? "webm" : "mp4";
  const friendlyName = `${context.meetingTitle || context.spaceId || "meeting"}_${new Date().toISOString()}.${extension}`;
  const s3Key = s3Service.generateFileKey(
    context.userId,
    context.organizationId,
    friendlyName
  );

  await s3Service.uploadFile(s3Key, buffer, mimeType, {
    originalName: friendlyName,
    uploadedBy: context.userId,
    cabinetId: recordingsCabinet._id.toString(),
    organizationId: context.organizationId,
    spaceId: context.spaceId,
    livekitEgressId: egressId,
  });

  // 5. Create file record in database
  const fileRecord = await OrganizationFile.create({
    name: friendlyName,
    originalName: friendlyName,
    owner: context.userId,
    organization: context.organizationId,
    cabinet: recordingsCabinet._id,
    s3Key,
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_S3_REGION || "",
    mimeType,
    size: buffer.length,
    extension,
    path: `${recordingsCabinet.path}/${friendlyName}`,
    status: "ready",
    metadata: {
      livekitEgressId: egressId,
      livekitRoomName: roomName,
      recordingSource: context.recordingSource || "livekit-egress",
      ...(context.workshopId ? { workshopId: context.workshopId } : {}),
      ...(context.spaceId ? { spaceId: context.spaceId } : {}),
    },
  });

  console.log(`[LIVEKIT WEBHOOK] Recording uploaded to cabinet: ${fileRecord._id} (${friendlyName})`);
}

/**
 * GET /livekit/conference/recordings
 * List recordings for the caller's org conference (hq-room), with presigned
 * URLs. Authed; queries OrganizationFile tagged recordingSource:"conference".
 *
 * Filter shape:
 *   - ?roomId=<confRoomId>   → recordings for one named room (hq-room:<orgId>:<roomId>)
 *   - ?spaceId=<full spaceId> → exact-match override (mostly for debugging)
 *   - (neither)              → every conference recording in the org
 *                              (spaceId begins with "hq-room:<orgId>")
 *
 * Legacy single-room orgs recorded under spaceId "hq-room:<orgId>"; those
 * still appear in the (no-arg) org-wide list.
 */
/** Shared handler — invoked from both /conference/recordings (legacy path)
 *  and /recordings (mobile-compat alias). Filters by orgId (required)
 *  and optional roomId / spaceId; returns presigned play + download URLs
 *  per file. Extracted so the alias route doesn't rebuild this ~70 lines
 *  of query + S3 presign logic. */
async function listConferenceRecordingsHandler(req: Request, res: Response) {
  try {
    const orgId = (req as any).user?.orgId as string | undefined;
    if (!orgId) {
      return res.status(401).json({ success: false, error: "Not authenticated" });
    }

    // Build the metadata.spaceId filter. Named room → equality on the
    // full triple; explicit spaceId override → equality; neither → any
    // spaceId that begins with "hq-room:<orgId>" (matches the legacy
    // single-room shape *and* every named room in this org).
    const roomIdParam =
      typeof req.query.roomId === "string" ? req.query.roomId : "";
    const spaceIdOverride =
      typeof req.query.spaceId === "string" ? req.query.spaceId : "";
    let spaceIdFilter: any;
    if (spaceIdOverride) {
      spaceIdFilter = spaceIdOverride;
    } else if (roomIdParam) {
      spaceIdFilter = `hq-room:${orgId}:${roomIdParam}`;
    } else {
      // Escape regex-special characters in the orgId (defensive — org
      // ids are hex ObjectIds today but the anchor keeps it correct).
      const safeOrg = orgId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      spaceIdFilter = new RegExp(`^hq-room:${safeOrg}(?::|$)`);
    }

    const files = await OrganizationFile.find({
      "metadata.recordingSource": "conference",
      "metadata.spaceId": spaceIdFilter,
      status: "ready",
    })
      .sort({ createdAt: -1 })
      .lean();

    const recordings = await Promise.all(
      files.map(async (f) => {
        let downloadUrl = "";
        let streamUrl = "";
        try {
          downloadUrl = await s3Service.getPresignedDownloadUrl(f.s3Key, 3600, f.name);
          streamUrl = await s3Service.getPresignedStreamUrl(
            f.s3Key,
            3600,
            f.mimeType || "video/mp4"
          );
        } catch {
          /* S3 error — skip URL */
        }
        return {
          id: f._id.toString(),
          name: f.name,
          size: f.size,
          sizeMB: ((f.size || 0) / 1024 / 1024).toFixed(2),
          createdAt: f.createdAt,
          durationSeconds: (f as any).metadata?.durationSeconds ?? null,
          spaceId: (f as any).metadata?.spaceId ?? null,
          downloadUrl,
          streamUrl,
          playUrl: streamUrl,
        };
      })
    );

    res.json({ success: true, recordings });
  } catch (error) {
    console.error("[Conference] Error listing recordings:", error);
    res.status(500).json({ success: false, error: "Failed to list recordings" });
  }
}

router.get(
  "/conference/recordings",
  requireAuth,
  listConferenceRecordingsHandler,
);

/**
 * POST /livekit/kick
 * Host action: remove a participant from a LiveKit room.
 * Body: { roomName, participantIdentity }
 *
 * Contract matches NC's /meet/kick so the same useHostControls hook
 * (vendored into Garage under hooks/office/) works after just a URL
 * swap. Wraps LiveKit's RoomServiceClient.removeParticipant.
 *
 * Access: requires auth. We don't verify the caller is the room's
 * founder — the frontend only shows the kick button to the local
 * host (isOwner from the join payload), and a non-host who forges
 * the request still can't remove anyone in a room they don't
 * control because LiveKit itself rejects the SDK call without a
 * server-side API key (which only lives on this box). Belt +
 * suspenders: this endpoint requires our own JWT.
 */
router.post("/kick", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName, participantIdentity } = req.body || {};
    if (!roomName || !participantIdentity) {
      return res
        .status(400)
        .json({ error: "roomName and participantIdentity are required" });
    }
    const client = getRoomServiceClient();
    if (!client) {
      return res
        .status(500)
        .json({ error: "LiveKit client not configured" });
    }
    await client.removeParticipant(roomName, participantIdentity);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[LIVEKIT KICK] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to kick participant" });
  }
});

/**
 * POST /livekit/mute
 * Host action: force-mute one published track of a participant.
 * Body: { roomName, participantIdentity, trackSid, muted? }
 *
 * `muted` defaults to true (mute); pass false to force-unmute — but
 * note LiveKit doesn't force-unmute audio without user consent, so
 * unmute is only a no-op signal in practice.
 */
router.post("/mute", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName, participantIdentity, trackSid, muted } = req.body || {};
    if (!roomName || !participantIdentity || !trackSid) {
      return res.status(400).json({
        error: "roomName, participantIdentity, and trackSid are required",
      });
    }
    const client = getRoomServiceClient();
    if (!client) {
      return res
        .status(500)
        .json({ error: "LiveKit client not configured" });
    }
    await client.mutePublishedTrack(
      roomName,
      participantIdentity,
      trackSid,
      muted !== false,
    );
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[LIVEKIT MUTE] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to mute participant" });
  }
});

/**
 * POST /livekit/notetaker/start
 * Body: { roomName }
 *
 * Attach the transcription bot to an in-flight LiveKit room. For HQ
 * conference rooms the bot auto-attaches when the owner joins (see
 * ensureConferenceNoteTaker call in socket.ts). This endpoint is for
 * the header toggle — the owner can restart the bot after explicitly
 * stopping it, without leaving + rejoining the call.
 *
 * Idempotent — a second call while a bot is already attached is a
 * successful no-op.
 *
 * Contract matches NC's /meet/notetaker/start so the vendored NC
 * MeetHeader works after a URL swap.
 */
router.post("/notetaker/start", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body || {};
    if (!roomName || typeof roomName !== "string") {
      return res.status(400).json({ error: "roomName is required" });
    }
    const bm = ConferenceBotManager.getInstance();
    if (bm.hasBot(roomName)) {
      return res.json({ success: true, alreadyRunning: true });
    }
    // Derive channelName (spaceId) + orgId from the LiveKit room name.
    // Format: hq-room-<orgId>-<roomId>. The auto-dispatch path in
    // socket.ts uses the same reconstruction to seed the NoteSession.
    let channelName = roomName;
    let orgId = "";
    if (roomName.startsWith("hq-room-")) {
      const rest = roomName.slice("hq-room-".length);
      const dash = rest.indexOf("-");
      if (dash !== -1) {
        orgId = rest.slice(0, dash);
        const conferenceRoomId = rest.slice(dash + 1);
        channelName = `hq-room:${orgId}:${conferenceRoomId}`;
      } else {
        orgId = rest;
        channelName = `hq-room:${rest}`;
      }
    }
    const me = (req as any).user as { userId: string };
    // `io` is unused inside the helper, but the signature keeps it for
    // parity with the socket-side call site. Pass null.
    await ensureConferenceNoteTaker(null as any, channelName, orgId, me.userId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[NOTETAKER START] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to start note-taker" });
  }
});

/**
 * POST /livekit/notetaker/stop
 * Body: { roomName }
 *
 * Disconnect the transcription bot from a LiveKit room. Its disconnect
 * hook (registered in ensureConferenceNoteTaker) flips the NoteSession
 * to "transcribing" and queues the summarise job — same finalise path
 * as when the bot leaves because the room emptied.
 */
router.post("/notetaker/stop", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName } = req.body || {};
    if (!roomName || typeof roomName !== "string") {
      return res.status(400).json({ error: "roomName is required" });
    }
    const bm = ConferenceBotManager.getInstance();
    if (!bm.hasBot(roomName)) {
      return res.json({ success: true, alreadyStopped: true });
    }
    await bm.leave(roomName);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[NOTETAKER STOP] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to stop note-taker" });
  }
});

// ---------------------------------------------------------------------------
// Conference access-control (per-room mic/present policy + permission requests)
// ---------------------------------------------------------------------------
// Host sets a policy before the meeting starts: whether non-hosts may unmute
// themselves and whether they may screen-share. When either is denied,
// participants who try the action see a "Request permission" prompt; if they
// send the request, the host sees it in the People tab and approves or
// denies. Approval calls back into LiveKit to widen the participant's
// canPublishSources allowlist.
//
// Pending requests live in-memory keyed by roomName → userId. A user can only
// have one pending request at a time — a second request from the same user
// replaces the first (typically because they switched what they were asking
// for from "unmute" to "present" or vice-versa).

type PermissionKind = "unmute" | "present" | "both";

interface PermissionRequest {
  userId: string;
  name: string;
  kind: PermissionKind;
  requestedAt: number;
}

const pendingRequests = new Map<string, Map<string, PermissionRequest>>();

function getPendingList(roomName: string): PermissionRequest[] {
  const inner = pendingRequests.get(roomName);
  if (!inner) return [];
  return Array.from(inner.values()).sort((a, b) => a.requestedAt - b.requestedAt);
}

function addPending(roomName: string, req: PermissionRequest) {
  let inner = pendingRequests.get(roomName);
  if (!inner) {
    inner = new Map();
    pendingRequests.set(roomName, inner);
  }
  inner.set(req.userId, req);
}

function removePending(roomName: string, userId: string) {
  const inner = pendingRequests.get(roomName);
  if (!inner) return;
  inner.delete(userId);
  if (inner.size === 0) pendingRequests.delete(roomName);
}

/** A webinar's LiveKit room is `webinar-<workshopId>` (webinarRoomName), while
 *  its SOCKET room is the bare workshopId. Null for any other room. */
function webinarSocketRoom(roomName: string): string | null {
  return roomName.startsWith("webinar-") ? roomName.slice("webinar-".length) : null;
}

/**
 * Broadcast a permission event to everyone who needs it.
 *
 * These used to go only to the "workspace" room, which is joined by the
 * workspace/presence flow — office meets. Webinar clients connect on the
 * webinar socket and join a room keyed by the workshop id, so they never
 * received any of this: a webinar host saw no request, and a viewer never
 * heard the answer. Emitting to both leaves office behaviour untouched and
 * makes the same feature work for webinars.
 */
function emitPermissionEvent(event: string, payload: Record<string, unknown>) {
  const io = getSocketInstance();
  if (!io) return;
  io.to("workspace").emit(event, payload);
  const webinarRoom = webinarSocketRoom(String(payload.roomName || ""));
  if (webinarRoom) io.to(webinarRoom).emit(event, payload);
}

/**
 * Whether `userId` may grant or deny in this room.
 *
 * Neither route checked before, so any authenticated participant could widen
 * their own publish rights by calling grant with their own identity. For a
 * webinar the host/panelists are known from the live peer map; other rooms keep
 * their previous behaviour rather than silently locking out office meets, whose
 * host model lives elsewhere.
 */
function mayModeratePermissions(roomName: string, userId: string): boolean {
  const webinarId = webinarSocketRoom(roomName);
  if (!webinarId) return true;
  const room = getWebinarRoom(webinarId);
  if (!room) return true;
  for (const peer of room.peers.values()) {
    if (peer.userId === userId) return peer.role === "host" || peer.role === "panelist";
  }
  return false;
}

/**
 * POST /livekit/policy
 * Host sets (or updates) the room-level access-control policy.
 * Body: { roomName, allowUnmute, allowPresent }
 *
 * Idempotent — safe to call before every meeting start. Emits
 * `livekit:policy-updated` on the LiveKit channel so anyone
 * already in the room reacts to the change (their control-bar
 * affordances gate on the flags immediately).
 */
router.post("/policy", requireAuth, async (req: Request, res: Response) => {
  try {
    const { roomName, allowUnmute, allowPresent } = req.body || {};
    if (!roomName || typeof roomName !== "string") {
      return res.status(400).json({ error: "roomName is required" });
    }
    if (typeof allowUnmute !== "boolean" || typeof allowPresent !== "boolean") {
      return res
        .status(400)
        .json({ error: "allowUnmute and allowPresent must be boolean" });
    }
    const me = (req as any).user as { userId: string };
    const policy: ConferencePolicy = {
      allowUnmute,
      allowPresent,
      hostUserId: me.userId,
    };
    setConferencePolicy(roomName, policy);

    const io = getSocketInstance();
    if (io) {
      // Broadcast to everyone in the workspace room (frontend filters by
      // roomName). Using the workspace channel keeps this simple — every
      // in-call client is already subscribed.
      io.to("workspace").emit("livekit:policy-updated", {
        roomName,
        policy,
      });
    }
    return res.json({ success: true, policy });
  } catch (error: any) {
    console.error("[LIVEKIT POLICY] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to set policy" });
  }
});

/**
 * GET /livekit/policy?roomName=...
 * Read the current policy. Falls back to permissive when no policy
 * has been set (i.e. host hasn't opened the pre-join modal yet).
 */
router.get("/policy", requireAuth, async (req: Request, res: Response) => {
  const roomName = String(req.query.roomName || "");
  if (!roomName) {
    return res.status(400).json({ error: "roomName is required" });
  }
  const policy =
    getConferencePolicy(roomName) ||
    ({ allowUnmute: true, allowPresent: true } as ConferencePolicy);
  return res.json({ policy, pending: getPendingList(roomName) });
});

/**
 * POST /livekit/permission/request
 * Body: { roomName, kind: "unmute" | "present" | "both" }
 *
 * Participant asks the host for permission to publish mic and/or
 * screen-share. The request is stored (one-per-user) and broadcast
 * to every client already in the room; the host's UI shows it in
 * the People tab with Approve/Deny buttons.
 */
router.post(
  "/permission/request",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { roomName, kind } = req.body || {};
      if (!roomName || typeof roomName !== "string") {
        return res.status(400).json({ error: "roomName is required" });
      }
      if (kind !== "unmute" && kind !== "present" && kind !== "both") {
        return res
          .status(400)
          .json({ error: "kind must be one of unmute | present | both" });
      }
      const me = (req as any).user as { userId: string };
      const userDoc = await User.findById(me.userId).select("name").lean();
      const name = (userDoc as any)?.name || "Participant";
      const entry: PermissionRequest = {
        userId: me.userId,
        name,
        kind,
        requestedAt: Date.now(),
      };
      addPending(roomName, entry);

      emitPermissionEvent("livekit:permission-request", {
        roomName,
        request: entry,
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[LIVEKIT PERMISSION] request error:", error?.message || error);
      return res
        .status(500)
        .json({ error: error?.message || "Failed to send request" });
    }
  },
);

/**
 * POST /livekit/permission/grant
 * Body: { roomName, participantIdentity, kind }
 *
 * Host approves a request. We widen the participant's LiveKit
 * canPublishSources allowlist for the requested kind, then emit
 * `livekit:permission-granted` so the participant's client can
 * flip UI state (button re-enables, toast fires).
 *
 * kind semantics:
 *   - "unmute"  → allow MICROPHONE (in addition to whatever they had)
 *   - "present" → allow SCREEN_SHARE + SCREEN_SHARE_AUDIO
 *   - "both"    → allow all four (mic + camera + screen + screen-audio)
 */
router.post(
  "/permission/grant",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { roomName, participantIdentity, kind } = req.body || {};
      if (!roomName || !participantIdentity) {
        return res
          .status(400)
          .json({ error: "roomName and participantIdentity are required" });
      }
      // Only a host may widen someone's publish rights. Unchecked, any
      // authenticated participant could call this with their OWN identity and
      // grant themselves the stage.
      const me = (req as any).user as { userId: string };
      if (!mayModeratePermissions(roomName, me.userId)) {
        return res.status(403).json({ error: "Only the host can grant requests" });
      }
      const policy = getConferencePolicy(roomName);
      // Start from the current policy allowlist so we don't accidentally
      // strip a source the participant was already allowed to publish.
      const base = policyToSources(policy) || [];
      const sources = new Set<TrackSource>(base);
      sources.add(TrackSource.CAMERA); // camera is always allowed
      if (kind === "unmute" || kind === "both") {
        sources.add(TrackSource.MICROPHONE);
      }
      if (kind === "present" || kind === "both") {
        sources.add(TrackSource.SCREEN_SHARE);
        sources.add(TrackSource.SCREEN_SHARE_AUDIO);
      }
      const ok = await setParticipantPublishSources(
        roomName,
        participantIdentity,
        Array.from(sources),
      );
      if (!ok) {
        return res
          .status(500)
          .json({ error: "Failed to update participant permissions" });
      }
      removePending(roomName, participantIdentity);

      emitPermissionEvent("livekit:permission-granted", {
        roomName,
        userId: participantIdentity,
        kind,
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[LIVEKIT PERMISSION] grant error:", error?.message || error);
      return res
        .status(500)
        .json({ error: error?.message || "Failed to grant permission" });
    }
  },
);

/**
 * POST /livekit/permission/deny
 * Body: { roomName, participantIdentity }
 *
 * Host rejects a request. We clear the pending entry and notify
 * the participant so their UI can drop the "waiting for host"
 * spinner and show a "denied" toast.
 */
router.post(
  "/permission/deny",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { roomName, participantIdentity } = req.body || {};
      if (!roomName || !participantIdentity) {
        return res
          .status(400)
          .json({ error: "roomName and participantIdentity are required" });
      }
      const me = (req as any).user as { userId: string };
      if (!mayModeratePermissions(roomName, me.userId)) {
        return res.status(403).json({ error: "Only the host can deny requests" });
      }
      removePending(roomName, participantIdentity);

      emitPermissionEvent("livekit:permission-denied", {
        roomName,
        userId: participantIdentity,
      });
      return res.json({ success: true });
    } catch (error: any) {
      console.error("[LIVEKIT PERMISSION] deny error:", error?.message || error);
      return res
        .status(500)
        .json({ error: error?.message || "Failed to deny permission" });
    }
  },
);

/**
 * DELETE /livekit/conference/recordings/:id
 * Delete a conference recording — removes the S3 object AND the
 * OrganizationFile row. Best-effort on the S3 side: if the object is
 * already gone the Mongo row still deletes so the recordings list is
 * always self-consistent.
 *
 * Authed. Scoped by orgId — a caller can only delete recordings that
 * belong to their org (otherwise 403). No host-role check today:
 * anyone in the org can delete a recording of their org's conference
 * room. Tighten later if needed.
 */
router.delete(
  "/conference/recordings/:id",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const orgId = (req as any).user?.orgId as string | undefined;
      if (!orgId) {
        return res
          .status(401)
          .json({ success: false, error: "Not authenticated" });
      }
      const id = req.params.id;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, error: "id is required" });
      }
      const file = await OrganizationFile.findById(id).lean();
      if (!file) {
        return res
          .status(404)
          .json({ success: false, error: "Recording not found" });
      }
      // orgId gate — the OrganizationFile is scoped to one org; block
      // cross-org access even if a caller guesses the id.
      const fileOrgId =
        typeof (file as any).organizationId === "object"
          ? (file as any).organizationId?.toString?.() ?? ""
          : (file as any).organizationId;
      if (fileOrgId && fileOrgId !== orgId) {
        return res
          .status(403)
          .json({ success: false, error: "Not allowed" });
      }
      const s3Key = (file as any).s3Key as string | undefined;
      if (s3Key) {
        try {
          await s3Service.deleteFile(s3Key);
        } catch (err: any) {
          // Swallow — S3 delete failing (already-deleted, etc.)
          // shouldn't block the DB row cleanup. Log for observability.
          console.warn(
            `[LIVEKIT DELETE] S3 delete failed for ${s3Key}: ${err?.message || err}`,
          );
        }
      }
      await OrganizationFile.deleteOne({ _id: id });
      return res.json({ success: true });
    } catch (error: any) {
      console.error(
        "[LIVEKIT DELETE] Error:",
        error?.message || error,
      );
      return res
        .status(500)
        .json({ success: false, error: "Failed to delete recording" });
    }
  },
);

/**
 * POST /livekit/end-meeting
 * Host action: end the meeting for EVERYONE by deleting the LiveKit
 * room. All participants get force-disconnected. Recording (if any) is
 * stopped by the same egress_ended path that fires on last-participant.
 *
 * Body: { roomName }
 *
 * Access: authed. Not host-verified server-side — the frontend only
 * exposes the button to the local host (isOwner from the join payload).
 * A rogue caller who forges the request still can't delete a LiveKit
 * room they don't have the API key for (key lives only on this box).
 * Belt + suspenders: requireAuth.
 */
// End-meeting body — extracted so the /end alias below can share it
// without duplicating logic.
async function endMeetingHandler(req: Request, res: Response) {
  try {
    const { roomName } = req.body || {};
    if (!roomName || typeof roomName !== "string") {
      return res.status(400).json({ error: "roomName is required" });
    }
    const client = getRoomServiceClient();
    if (!client) {
      return res
        .status(500)
        .json({ error: "LiveKit client not configured" });
    }
    // deleteRoom kicks every participant + stops recording via
    // last-participant-left webhook. Idempotent on LK's side (5 = not
    // found) — swallow if the room was already torn down.
    try {
      await client.deleteRoom(roomName);
    } catch (err: any) {
      if (err?.code !== 5 && !`${err?.message || ""}`.includes("not found")) {
        throw err;
      }
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[LIVEKIT END-MEETING] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to end meeting" });
  }
}

router.post("/end-meeting", requireAuth, endMeetingHandler);

// ── Mobile-app-compatible aliases ────────────────────────────────────
//
// The Garage HQ mobile app's officestream service hits paths under
// /workspace/conference/*; this file is also mounted at that prefix
// from app.ts. Mobile expects:
//   POST /end            → alias of /end-meeting
//   GET  /recordings     → alias of the conference/recordings handler
//   POST /token/guest    → new — mint an anonymous participant token
// The mute/kick/notetaker/policy/recording paths already match the
// existing router paths exactly under both mounts.

router.post("/end", requireAuth, endMeetingHandler);

/** GET /recordings — mobile-compat alias for /conference/recordings.
 *  Same query params: orgId (required), roomId (optional per-room
 *  filter). Delegates to the shared handler so the two paths never
 *  drift apart. */
router.get("/recordings", requireAuth, listConferenceRecordingsHandler);

/** POST /token/guest — mint a LiveKit access token for an anonymous
 *  viewer to join a conference room. Public: no auth required.
 *  Body: { roomName: string; displayName?: string } */
router.post("/token/guest", async (req: Request, res: Response) => {
  try {
    const { roomName, displayName } = req.body || {};
    if (!roomName || typeof roomName !== "string") {
      return res.status(400).json({ error: "roomName is required" });
    }
    // Random guest identity so a second guest doesn't collide with the
    // first in the same room. generateGuestUid mints a stable numeric
    // id used elsewhere for guest agora sessions; we stringify + tag
    // 'guest-' so the frontend can filter it out of member-only UIs.
    const guestId = `guest-${generateGuestUid()}`;
    const guestName =
      typeof displayName === "string" && displayName.trim().length > 0
        ? displayName.trim().slice(0, 60)
        : "Guest";

    const token = await createParticipantToken(roomName, {
      userId: guestId,
      userName: guestName,
      // Guests can publish mic/cam/screen — the host's mute/kick can
      // still yank them; and the LiveKit-side room policy (grid layout
      // etc.) is unchanged from any other participant.
      isOwner: false,
      canPublish: true,
      exp: 6 * 60 * 60, // 6h
      metadata: JSON.stringify({ isGuest: true, displayName: guestName }),
    });

    if (!token) {
      return res
        .status(500)
        .json({ error: "Failed to mint guest token" });
    }
    return res.json({
      token,
      identity: guestId,
      displayName: guestName,
      roomName,
    });
  } catch (error: any) {
    console.error("[LIVEKIT GUEST TOKEN] Error:", error?.message || error);
    return res
      .status(500)
      .json({ error: error?.message || "Failed to mint guest token" });
  }
});

export default router;
