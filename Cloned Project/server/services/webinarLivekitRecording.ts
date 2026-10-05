import { Types } from "mongoose";
import { Workshop } from "../models/workshop.model";
import {
  startRoomCompositeEgress,
  stopEgress,
  getActiveEgress,
  clearActiveEgress,
  setRecordingContext,
  getRecordingContext,
  toLivekitRoomName,
  waitForEgressFile,
} from "./livekit";
import { s3Service } from "./s3";
import { registerDirectS3Recording } from "../routes/livekitRecording";

/**
 * Deterministic LiveKit room name for a workshop. Mirrors the same convention
 * used by the /webinar/:id/livekit-token endpoint so backend + frontend agree
 * on the room identity.
 */
export function webinarRoomName(workshopId: string): string {
  return toLivekitRoomName(`webinar-${workshopId}`);
}

interface StartWebinarRecordingResult {
  success: boolean;
  egressId?: string;
  error?: string;
}

/**
 * Start a LiveKit Composite Egress for a webinar room. The egress is rendered
 * server-side (grid + mixed audio), uploaded by LiveKit to its temp storage,
 * and on egress_ended our existing /webhooks/livekit handler downloads it,
 * persists it to S3, and writes an OrganizationFile row. The metadata fields
 * we set in the recording context are what makes the resulting file appear
 * under Learn → Live Streams.
 */
export async function startWebinarLivekitRecording(
  workshopId: string,
  hostUserId: string
): Promise<StartWebinarRecordingResult> {
  if (!Types.ObjectId.isValid(workshopId)) {
    return { success: false, error: "Invalid workshopId" };
  }

  const workshop = await Workshop.findById(workshopId)
    .select("title orgId")
    .lean();
  if (!workshop) return { success: false, error: "Workshop not found" };

  const room = webinarRoomName(workshopId);

  if (getActiveEgress(room)) {
    return { success: false, error: "Already recording" };
  }

  setRecordingContext(room, {
    organizationId: workshop.orgId.toString(),
    userId: hostUserId,
    meetingTitle: workshop.title || "Webinar",
    spaceId: workshopId,
    workshopId,
    recordingSource: "webinar-livekit",
  });

  // "grid" → LiveKit composes every publisher into a Google-Meet style
  // tile layout. Without this the default "speaker" template only renders
  // the currently-active speaker, which is why earlier recordings only
  // captured the host's video.
  //
  // directS3Upload: LK egress server writes the final MP4 straight to our S3
  // bucket. Avoids the webhook download+reupload round-trip and means local
  // dev still gets recordings even when the webhook can't reach localhost.
  const egressId = await startRoomCompositeEgress(room, {
    layout: "grid",
    directS3Upload: true,
    s3KeyPrefix: `webinar-recordings/${workshopId}`,
    // HLS segments (~6s each) stream to S3 alongside the single MP4. Gives
    // crash resilience and lets the player scrub / start playback before
    // the full egress finalises.
    withSegments: true,
  });
  if (!egressId) return { success: false, error: "Failed to start egress" };

  return { success: true, egressId };
}

/**
 * Stop the currently active webinar egress. The /webhooks/livekit handler
 * picks up the egress_ended event and finalizes the OrganizationFile.
 */
export async function stopWebinarLivekitRecording(
  workshopId: string
): Promise<StartWebinarRecordingResult> {
  const room = webinarRoomName(workshopId);
  const egressId = getActiveEgress(room);
  if (!egressId) return { success: false, error: "Not recording" };

  const ok = await stopEgress(egressId);
  // Clear in-memory tracking eagerly. The webhook also clears it, but in
  // local dev (and any time the webhook can't reach this process) the map
  // would otherwise stay "active" and block the next start with
  // "Already recording".
  clearActiveEgress(room);
  if (!ok) return { success: false, error: "Failed to stop egress" };

  return { success: true, egressId };
}

/** Whether a webinar room currently has an active LiveKit egress. */
export function isWebinarLivekitRecording(workshopId: string): boolean {
  return getActiveEgress(webinarRoomName(workshopId)) !== null;
}

export interface FinalizedRecording {
  s3Key: string;
  size: number;
  duration: number;
  downloadUrl: string;
  streamUrl: string;
  /**
   * Presigned URL of the HLS manifest (`index.m3u8`). Players can begin
   * scrubbing / streaming via HLS while the MP4 is also available for
   * download. Empty string if HLS wasn't requested or the manifest isn't
   * yet in S3.
   */
  hlsUrl: string;
  filename: string;
}

/**
 * Wait for the egress to finalize and produce its file in S3, then:
 *  1. Persist the OrganizationFile DB row inline (so Workshop Analytics +
 *     Learn → Live Streams show the recording immediately, with no need for
 *     the LiveKit webhook to reach this process).
 *  2. Return presigned URLs (download + stream) the host can use right away.
 *
 * The webhook still fires on prod for the same egress, but registerDirectS3
 * is idempotent so it just no-ops when called twice.
 */
export async function awaitWebinarRecordingFile(
  workshopId: string,
  egressId: string
): Promise<FinalizedRecording | null> {
  const info = await waitForEgressFile(egressId);
  if (!info?.s3Key) return null;

  // Persist DB row inline. Looks up the recording context we set in
  // startWebinarLivekitRecording for orgId / userId / workshopId.
  try {
    const room = webinarRoomName(workshopId);
    const ctx = getRecordingContext(room);
    if (ctx) {
      await registerDirectS3Recording(
        info.s3Key,
        { size: info.size, duration: info.duration },
        room,
        egressId,
        ctx
      );
    } else {
      console.warn(
        `[webinarLivekitRecording] no recording context for ${room} — skipping DB register`
      );
    }
  } catch (err: any) {
    console.error(
      "[webinarLivekitRecording] inline DB register failed:",
      err?.message ?? err
    );
    // Non-fatal — webhook will still try later in prod, and the file is in
    // S3 either way.
  }

  const filename = info.s3Key.split("/").pop() || `webinar-${workshopId}.mp4`;
  // The HLS manifest path mirrors the convention in startRoomCompositeEgress
  // → `<s3KeyPrefix>/hls/index.m3u8`. Derived from the MP4's S3 key so we
  // don't need a separate egress-info lookup.
  const hlsKey = `webinar-recordings/${workshopId}/hls/index.m3u8`;
  let downloadUrl = "";
  let streamUrl = "";
  let hlsUrl = "";
  try {
    downloadUrl = await s3Service.getPresignedDownloadUrl(
      info.s3Key,
      3600,
      filename
    );
    streamUrl = await s3Service.getPresignedStreamUrl(
      info.s3Key,
      3600,
      "video/mp4"
    );
    try {
      hlsUrl = await s3Service.getPresignedStreamUrl(
        hlsKey,
        3600,
        "application/vnd.apple.mpegurl"
      );
    } catch {
      /* HLS manifest may not have been requested — leave hlsUrl empty */
    }
  } catch (err: any) {
    console.error(
      "[webinarLivekitRecording] presign failed:",
      err?.message ?? err
    );
    return null;
  }

  return {
    s3Key: info.s3Key,
    size: info.size,
    duration: info.duration,
    downloadUrl,
    streamUrl,
    hlsUrl,
    filename,
  };
}
