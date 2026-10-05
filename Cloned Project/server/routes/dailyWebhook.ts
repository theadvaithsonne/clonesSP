import { Router, Request, Response } from "express";
import crypto from "crypto";
import { getRecordingDownloadLink, getRecordingContext } from "../services/daily";
import { s3Service } from "../services/s3";
import {
  OrganizationCabinet,
  OrganizationFile,
} from "../models/cabinet.model";
import { compressVideo } from "../utils/videoCompression";

const router = Router();

const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET || "";

/**
 * Verify Daily.co webhook signature (HMAC-SHA256).
 */
function verifyDailySignature(rawBody: string, signature: string): boolean {
  if (!DAILY_WEBHOOK_SECRET) {
    console.warn("[DAILY WEBHOOK] No DAILY_WEBHOOK_SECRET set, skipping signature verification");
    return true; // Allow in dev without secret
  }

  const hmac = crypto.createHmac("sha256", DAILY_WEBHOOK_SECRET);
  hmac.update(rawBody);
  const expectedSignature = hmac.digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /webhooks/daily
 * Handles Daily.co webhook events, primarily recording.ready-to-download.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    // Parse raw body
    let rawBody: string;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
    } else {
      rawBody = JSON.stringify(req.body);
    }

    // Verify signature if secret is configured
    const signature = req.headers["x-daily-signature"] as string;
    if (DAILY_WEBHOOK_SECRET && signature) {
      if (!verifyDailySignature(rawBody, signature)) {
        console.error("[DAILY WEBHOOK] Invalid signature");
        return res.status(401).json({ error: "Invalid signature" });
      }
    }

    const event = typeof req.body === "string" ? JSON.parse(req.body) :
                  Buffer.isBuffer(req.body) ? JSON.parse(rawBody) : req.body;

    const eventType = event.type || event.event;
    console.log(`[DAILY WEBHOOK] Received event: ${eventType}`);

    // Handle recording ready
    if (
      eventType === "recording.ready-to-download" ||
      eventType === "recording.ready"
    ) {
      const payload = event.payload || event;
      const recordingId = payload.recording_id || payload.id;
      const roomName = payload.room_name;
      const duration = payload.duration;

      console.log(`[DAILY WEBHOOK] Recording ready: id=${recordingId}, room=${roomName}, duration=${duration}s`);

      if (!recordingId || !roomName) {
        console.error("[DAILY WEBHOOK] Missing recordingId or roomName in payload");
        return res.status(200).json({ received: true, skipped: "missing data" });
      }

      // Look up recording context (org, user, meeting title)
      const context = getRecordingContext(roomName);
      if (!context) {
        console.warn(`[DAILY WEBHOOK] No recording context found for room ${roomName}. Recording will not be uploaded to cabinet.`);
        return res.status(200).json({ received: true, skipped: "no context" });
      }

      // Process in background — respond immediately
      res.status(200).json({ received: true, processing: true });

      // Download and upload to cabinet
      processRecording(recordingId, roomName, context).catch((err) => {
        console.error(`[DAILY WEBHOOK] Failed to process recording ${recordingId}:`, err);
      });

      return;
    }

    // Acknowledge other events
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[DAILY WEBHOOK] Error handling webhook:", error);
    return res.status(200).json({ received: true, error: "processing failed" });
  }
});

/**
 * Download a Daily.co recording and upload it to the organization cabinet.
 */
async function processRecording(
  recordingId: string,
  roomName: string,
  context: {
    organizationId: string;
    userId: string;
    meetingTitle: string;
    spaceId: string;
  }
) {
  console.log(`[DAILY WEBHOOK] Processing recording ${recordingId} for org ${context.organizationId}`);

  // 1. Get download link from Daily.co
  const downloadLink = await getRecordingDownloadLink(recordingId);
  if (!downloadLink) {
    console.error(`[DAILY WEBHOOK] Could not get download link for recording ${recordingId}`);
    return;
  }

  // 2. Download the recording file
  console.log(`[DAILY WEBHOOK] Downloading recording from Daily.co...`);
  const downloadResponse = await fetch(downloadLink);
  if (!downloadResponse.ok) {
    console.error(`[DAILY WEBHOOK] Download failed: ${downloadResponse.status}`);
    return;
  }

  const arrayBuffer = await downloadResponse.arrayBuffer();
  const downloadedBuffer = Buffer.from(new Uint8Array(arrayBuffer));
  let mimeType = downloadResponse.headers.get("content-type") || "video/mp4";
  console.log(`[DAILY WEBHOOK] Downloaded ${downloadedBuffer.length} bytes (${mimeType})`);

  // 3. Compress if needed
  let finalBuffer: Buffer = downloadedBuffer;
  try {
    const compressed = await compressVideo(downloadedBuffer, mimeType);
    finalBuffer = Buffer.from(compressed.buffer);
    mimeType = compressed.mimeType;
    console.log(`[DAILY WEBHOOK] Compressed to ${finalBuffer.length} bytes`);
  } catch (e) {
    console.warn("[DAILY WEBHOOK] Compression failed, using original:", e);
  }
  const buffer = finalBuffer;

  // 4. Find or create Organization Cabinet → Recordings folder
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

  // 5. Upload to S3
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
    dailyRecordingId: recordingId,
  });

  // 6. Create file record in database
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
      dailyRecordingId: recordingId,
      dailyRoomName: roomName,
      recordingSource: "daily-cloud",
    },
  });

  console.log(`[DAILY WEBHOOK] Recording uploaded to cabinet: ${fileRecord._id} (${friendlyName})`);
}

export default router;
