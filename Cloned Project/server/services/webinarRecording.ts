import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { getRoom, WebinarRoom } from "./mediasoup";
import { s3Service } from "./s3";
import {
  OrganizationFile,
  OrganizationCabinet,
} from "../models/cabinet.model";
import { Workshop } from "../models/workshop.model";
import { Types } from "mongoose";

/*
 * Server-side webinar recording via mediasoup PlainTransport → FFmpeg.
 *
 * Approach (LiveKit Egress style):
 *   - FFmpeg writes 30-second WebM segments (codec copy — zero CPU).
 *   - A fs watcher uploads each finalized segment to S3 immediately, deletes
 *     the local file. File is safe in S3 within seconds of being captured;
 *     nothing is held in memory, server crash mid-recording loses ~30s at most.
 *   - On stop: upload the last in-progress segment, then write a manifest
 *     listing every segment for playback + (optionally) concat into one file.
 */

// Port range for RTP forwarding from mediasoup → FFmpeg (above WebRTC's 10000-10999)
const RECORDING_PORT_MIN = 11000;
const RECORDING_PORT_MAX = 11999;
const SEGMENT_DURATION_S = 30;

const usedPorts = new Set<number>();

function allocatePort(): number {
  for (let p = RECORDING_PORT_MIN; p <= RECORDING_PORT_MAX; p += 2) {
    if (!usedPorts.has(p) && !usedPorts.has(p + 1)) {
      usedPorts.add(p);
      usedPorts.add(p + 1);
      return p;
    }
  }
  throw new Error("No free RTP ports available for recording");
}

function releasePort(port: number) {
  usedPorts.delete(port);
  usedPorts.delete(port + 1);
}

interface RecordingInput {
  kind: "audio" | "video";
  producerId: string;
  consumer: any;
  transport: any;
  rtpPort: number;
  rtcpPort: number;
  payloadType: number;
  codec: string;
  clockRate: number;
}

interface UploadedSegment {
  index: number;
  s3Key: string;
  size: number;
  uploadedAt: Date;
}

interface RecordingSession {
  webinarId: string;
  workshopId: string;
  hostUserId: string;
  orgId: string;
  title: string;
  startedAt: Date;
  inputs: RecordingInput[];
  ffmpeg: ChildProcess;
  sessionDir: string;
  sdpPath: string;
  segmentPattern: string; // "segment_%03d.webm"
  uploadedSegments: UploadedSegment[];
  pendingUploads: Set<string>; // filenames currently uploading
  watcher?: fs.FSWatcher;
  keyframeInterval?: NodeJS.Timeout;
  finalized: boolean;
}

const recordings = new Map<string, RecordingSession>();

// ── Public API ───────────────────────────────────────────────────────────────

export async function startServerRecording(
  webinarId: string,
  hostUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (recordings.has(webinarId)) {
      return { success: false, error: "Already recording" };
    }

    const room = getRoom(webinarId);
    if (!room) return { success: false, error: "Room not found" };

    const workshop = await Workshop.findById(webinarId).lean();
    if (!workshop) return { success: false, error: "Workshop not found" };

    // Capture ALL peers' audio and ALL peers' video (Google Meet / LiveKit
    // composite style). Videos get xstack'd into a grid, audios mixed.
    // Cap total video inputs at 4 to keep CPU reasonable (2x2 grid).
    const inputs: RecordingInput[] = [];
    let videoCount = 0;
    const MAX_VIDEOS = 4;
    for (const peer of room.peers.values()) {
      for (const producer of peer.producers.values()) {
        if (producer.closed) continue;
        if (producer.kind === "video") {
          if (videoCount >= MAX_VIDEOS) continue;
          videoCount++;
        }
        const input = await createRecordingInput(room, producer);
        if (input) inputs.push(input);
      }
    }

    if (inputs.length === 0) {
      return { success: false, error: "No active producers to record" };
    }

    // Per-session tmp dir so we can watch just this recording's segments
    const sessionId = `${webinarId}_${Date.now()}`;
    const sessionDir = path.join(os.tmpdir(), "webinar-recordings", sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });
    const sdpPath = path.join(sessionDir, "input.sdp");
    const segmentPattern = path.join(sessionDir, "segment_%03d.webm");

    fs.writeFileSync(sdpPath, buildSdp(inputs));

    const ffmpeg = spawnFfmpeg(sdpPath, segmentPattern, inputs);

    const session: RecordingSession = {
      webinarId,
      workshopId: webinarId,
      hostUserId,
      orgId: workshop.orgId.toString(),
      title: workshop.title || "webinar",
      startedAt: new Date(),
      inputs,
      ffmpeg,
      sessionDir,
      sdpPath,
      segmentPattern,
      uploadedSegments: [],
      pendingUploads: new Set(),
      finalized: false,
    };

    recordings.set(webinarId, session);

    // Watch for completed segments. When FFmpeg opens segment_N+1, segment_N
    // is guaranteed finalized — we upload it and delete the local file.
    session.watcher = watchSegments(session);

    // Wait for FFmpeg to bind UDP ports before resuming consumers (otherwise
    // the first keyframe is lost and video gets stuck).
    await new Promise((r) => setTimeout(r, 1000));

    for (const input of inputs) {
      await input.consumer.resume();
      if (input.kind === "video") {
        // Pin to the highest simulcast layer so resolution stays constant.
        // Without this, mediasoup swaps layers based on bandwidth/CPU, and
        // FFmpeg with `-c copy` ends up with segments at mixed resolutions →
        // playback lag + resize artifacts at segment boundaries.
        if (typeof input.consumer.setPreferredLayers === "function") {
          try {
            await input.consumer.setPreferredLayers({
              spatialLayer: 2,
              temporalLayer: 2,
            });
          } catch {
            // Producer may have fewer layers (single-layer encoder); ignore.
          }
        }
        if (typeof input.consumer.requestKeyFrame === "function") {
          try { await input.consumer.requestKeyFrame(); } catch { /* ignore */ }
        }
      }
    }

    // Periodic keyframe requests so segments mid-recording always start decodable
    session.keyframeInterval = setInterval(() => {
      const s = recordings.get(webinarId);
      if (!s || s.finalized) return;
      for (const inp of s.inputs) {
        if (inp.kind === "video" && typeof inp.consumer.requestKeyFrame === "function") {
          inp.consumer.requestKeyFrame().catch(() => {});
        }
      }
    }, 5_000);

    console.log(
      `[WebinarRecording] Started for webinar ${webinarId} | ${inputs.length} inputs | ${SEGMENT_DURATION_S}s segments`
    );
    return { success: true };
  } catch (err: any) {
    console.error("[WebinarRecording] startServerRecording error:", err);
    return { success: false, error: err.message };
  }
}

export async function stopServerRecording(
  webinarId: string
): Promise<{ success: boolean; error?: string; segmentsCount?: number; combinedKey?: string | null; downloadUrl?: string }> {
  const session = recordings.get(webinarId);
  if (!session) return { success: false, error: "No active recording" };
  if (session.finalized) return { success: false, error: "Already finalized" };
  session.finalized = true;
  if (session.keyframeInterval) clearInterval(session.keyframeInterval);

  console.log(`[WebinarRecording] Stopping recording for ${webinarId}`);

  // Graceful FFmpeg shutdown (flushes in-progress segment to disk)
  try {
    if (session.ffmpeg.stdin && !session.ffmpeg.stdin.destroyed) {
      session.ffmpeg.stdin.write("q\n");
      session.ffmpeg.stdin.end();
    }
  } catch { /* ignore */ }

  // Wait for ffmpeg exit (cap at 30s)
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      try { session.ffmpeg.kill("SIGKILL"); } catch { /* ignore */ }
      resolve();
    }, 30_000);
    session.ffmpeg.once("exit", (code) => {
      clearTimeout(timer);
      console.log(`[WebinarRecording] FFmpeg exited with code ${code}`);
      resolve();
    });
  });

  // Close mediasoup transports and consumers
  for (const input of session.inputs) {
    try { input.consumer.close(); } catch { /* ignore */ }
    try { input.transport.close(); } catch { /* ignore */ }
    releasePort(input.rtpPort);
  }

  // Upload any remaining segments (including the last one FFmpeg just finished)
  const remaining = fs.readdirSync(session.sessionDir)
    .filter((f) => /^segment_\d+\.webm$/.test(f))
    .sort();
  for (const filename of remaining) {
    await uploadSegment(session, filename).catch((err) =>
      console.error(`[WebinarRecording] final upload of ${filename} failed:`, err)
    );
  }

  // Wait for any in-flight uploads
  let waits = 0;
  while (session.pendingUploads.size > 0 && waits < 60) {
    await new Promise((r) => setTimeout(r, 500));
    waits++;
  }

  // Stop the watcher
  session.watcher?.close();

  // Concat all segments into one file + register in DB
  const combinedKey = await concatAndRegister(session).catch((err) => {
    console.error("[WebinarRecording] concat failed:", err);
    return null;
  });

  // Clean up local session dir (segments, concat list, combined file)
  try { fs.rmSync(session.sessionDir, { recursive: true, force: true }); } catch { /* ignore */ }

  recordings.delete(webinarId);

  console.log(
    `[WebinarRecording] Finalized ${webinarId} | ${session.uploadedSegments.length} segments | combined=${combinedKey}`
  );

  // Presign the combined file so the host can auto-download it
  let downloadUrl: string | undefined;
  if (combinedKey) {
    try {
      downloadUrl = await s3Service.getPresignedDownloadUrl(combinedKey, 3600);
    } catch (err) {
      console.error("[WebinarRecording] failed to presign combined file:", err);
    }
  }

  return {
    success: true,
    segmentsCount: session.uploadedSegments.length,
    combinedKey,
    downloadUrl,
  };
}

export function isRecording(webinarId: string): boolean {
  return recordings.has(webinarId);
}

// ── Watcher: upload finalized segments on-the-fly ──────────────────────────

function watchSegments(session: RecordingSession): fs.FSWatcher {
  // When FFmpeg creates segment_N+1, segment_N is fully written. fs.watch
  // fires "rename" on both new-file and delete; we filter to new .webm files,
  // then upload all segments with lower indices than the newest.
  const watcher = fs.watch(session.sessionDir, (event, filename) => {
    if (event !== "rename" || !filename) return;
    const match = filename.match(/^segment_(\d+)\.webm$/);
    if (!match) return;
    if (!fs.existsSync(path.join(session.sessionDir, filename))) return; // deleted

    const currentIndex = parseInt(match[1], 10);

    // Upload all previous segments that are still on disk and not already uploaded/pending
    const files = fs.readdirSync(session.sessionDir)
      .filter((f) => /^segment_\d+\.webm$/.test(f))
      .sort();
    for (const f of files) {
      const idx = parseInt(f.match(/^segment_(\d+)/)![1], 10);
      if (idx >= currentIndex) continue; // the current one is still being written
      if (session.pendingUploads.has(f)) continue;
      if (session.uploadedSegments.some((s) => s.index === idx)) continue;

      session.pendingUploads.add(f);
      uploadSegment(session, f).catch((err) => {
        console.error(`[WebinarRecording] segment upload failed (${f}):`, err);
        session.pendingUploads.delete(f);
      });
    }
  });
  return watcher;
}

async function uploadSegment(session: RecordingSession, filename: string): Promise<void> {
  const match = filename.match(/^segment_(\d+)\.webm$/);
  if (!match) return;
  const index = parseInt(match[1], 10);
  const localPath = path.join(session.sessionDir, filename);

  if (!fs.existsSync(localPath)) {
    session.pendingUploads.delete(filename);
    return;
  }

  const stats = fs.statSync(localPath);
  if (stats.size < 512) {
    console.log(`[WebinarRecording] skipping tiny segment ${filename} (${stats.size}B)`);
    fs.unlinkSync(localPath);
    session.pendingUploads.delete(filename);
    return;
  }

  const buffer = fs.readFileSync(localPath);
  const safeTitle = session.title.replace(/[^a-z0-9]/gi, "_").slice(0, 80);
  const s3Key = `garage-webinar/${session.orgId}/${session.workshopId}/segments/${safeTitle}_${session.startedAt.getTime()}_${String(index).padStart(3, "0")}.webm`;

  await s3Service.uploadFile(s3Key, buffer, "video/webm", {
    organizationId: session.orgId,
    workshopId: session.workshopId,
    recordingSource: "webinar-mediasoup-server",
    segmentIndex: String(index),
  });

  session.uploadedSegments.push({
    index,
    s3Key,
    size: stats.size,
    uploadedAt: new Date(),
  });
  session.pendingUploads.delete(filename);

  // Keep local file — we'll concat all segments at stop time into one file.
  // S3 upload above provides crash-safety; if the server dies we have each
  // segment in S3 already and can rebuild from the manifest later.

  console.log(
    `[WebinarRecording] Segment ${index} uploaded (${(stats.size / 1024 / 1024).toFixed(2)}MB) → ${s3Key}`
  );
}

// ── Concat segments → single file + DB registration ──────────────────────

async function concatAndRegister(session: RecordingSession): Promise<string | null> {
  session.uploadedSegments.sort((a, b) => a.index - b.index);
  if (session.uploadedSegments.length === 0) {
    console.log("[WebinarRecording] no segments to concat");
    return null;
  }

  // Verify local segment files exist for concat. If a segment file was lost
  // (e.g. disk full, accidental delete), we still have it in S3 — fall back
  // to downloading it. For the happy path we use local files directly.
  const localSegments: string[] = [];
  for (const seg of session.uploadedSegments) {
    const localPath = path.join(
      session.sessionDir,
      `segment_${String(seg.index).padStart(3, "0")}.webm`
    );
    if (fs.existsSync(localPath)) {
      localSegments.push(localPath);
    } else {
      // Download from S3 as fallback (rare — only if local was cleaned up)
      console.log(`[WebinarRecording] segment ${seg.index} not local, downloading from S3`);
      const url = await s3Service.getPresignedDownloadUrl(seg.s3Key, 300);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch segment ${seg.index} from S3`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(localPath, buf);
      localSegments.push(localPath);
    }
  }

  // FFmpeg concat demuxer: feed it a text file listing each segment
  const concatListPath = path.join(session.sessionDir, "concat.txt");
  fs.writeFileSync(
    concatListPath,
    localSegments.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
  );

  // Output container matches the segments (WebM with VP8/VP9 + Opus). Using
  // `-c copy` skips re-encoding entirely — concat takes ~1s instead of minutes
  // and avoids the "More than 10000 frames duplicated" hang from libx264
  // trying to reconcile per-segment timing. Trade-off: we lose .mp4. All
  // modern browsers play .webm natively; if an MP4 is needed later, that
  // can run as a background job, not on the critical path of stop.
  const combinedPath = path.join(session.sessionDir, "combined.webm");

  let ffmpegBin = "ffmpeg";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffmpegBin = require("@ffmpeg-installer/ffmpeg").path;
  } catch { /* use system ffmpeg */ }

  console.log(`[WebinarRecording] Concatenating ${localSegments.length} segments (stream copy, no re-encode)...`);
  await new Promise<void>((resolve, reject) => {
    const p = spawn(ffmpegBin, [
      "-loglevel", "warning",
      "-fflags", "+genpts",
      "-f", "concat",
      "-safe", "0",
      "-i", concatListPath,
      "-c", "copy",
      "-avoid_negative_ts", "make_zero",
      "-y", combinedPath,
    ]);
    p.stderr?.on("data", (d) => {
      const m = d.toString().trim();
      if (m) console.log(`[ffmpeg concat] ${m}`);
    });
    p.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`concat exited ${code}`))
    );
    p.on("error", reject);
  });

  const stats = fs.statSync(combinedPath);
  const combinedSize = stats.size;
  if (combinedSize < 1024) throw new Error("Combined file too small");

  // Stream-upload so files >2 GiB don't hit Node's Buffer cap.
  const safeTitle = session.title.replace(/[^a-z0-9]/gi, "_").slice(0, 80);
  const combinedKey = `garage-webinar/${session.orgId}/${session.workshopId}/${safeTitle}_${session.startedAt.getTime()}.webm`;
  const readStream = fs.createReadStream(combinedPath);

  await s3Service.uploadStream(combinedKey, readStream, "video/webm", {
    originalName: `${session.title}_${session.startedAt.toISOString()}.webm`,
    uploadedBy: session.hostUserId,
    organizationId: session.orgId,
    workshopId: session.workshopId,
    recordingSource: "webinar-mediasoup-server",
  });

  console.log(
    `[WebinarRecording] Combined recording uploaded (${(combinedSize / 1024 / 1024).toFixed(2)}MB) → ${combinedKey}`
  );

  // Register as OrganizationFile — the combined file is the user-facing recording
  const orgObjId = new Types.ObjectId(session.orgId);
  let orgCabinet = await OrganizationCabinet.findOne({
    organization: orgObjId,
    isRoot: true,
  });
  if (!orgCabinet) {
    orgCabinet = await OrganizationCabinet.create({
      name: "Organization Cabinet",
      description: "Shared cabinet for all organization members",
      owner: new Types.ObjectId(session.hostUserId),
      organization: orgObjId,
      path: "/organization",
      isRoot: true,
    });
  }

  let recordingsCabinet = await OrganizationCabinet.findOne({
    organization: orgObjId,
    name: "Recordings",
    parentCabinet: orgCabinet._id,
  });
  if (!recordingsCabinet) {
    recordingsCabinet = await OrganizationCabinet.create({
      name: "Recordings",
      description: "Meeting and workspace recordings",
      owner: new Types.ObjectId(session.hostUserId),
      organization: orgObjId,
      parentCabinet: orgCabinet._id,
      path: `${orgCabinet.path}/Recordings`,
      isRoot: false,
    });
  }

  const friendlyName = `${session.title}_${session.startedAt.toISOString()}.webm`;
  await OrganizationFile.create({
    name: friendlyName,
    originalName: friendlyName,
    owner: new Types.ObjectId(session.hostUserId),
    organization: orgObjId,
    cabinet: recordingsCabinet._id,
    s3Key: combinedKey,
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    s3Region: process.env.AWS_S3_REGION || "",
    mimeType: "video/webm",
    size: combinedSize,
    extension: "webm",
    path: `${recordingsCabinet.path}/${friendlyName}`,
    status: "ready",
    metadata: {
      workshopId: session.workshopId,
      recordingSource: "webinar-mediasoup-server",
      segmentCount: session.uploadedSegments.length,
      segmentDurationSeconds: SEGMENT_DURATION_S,
    },
  });

  // Only delete segments after BOTH the combined upload AND the DB registration
  // succeed. If we get here, the combined recording is safely persisted in S3
  // AND the user can see it in the UI. If any earlier step failed, this code
  // never runs → segments stay on S3 and can be recovered manually (or by the
  // 2-day orphan sweeper below).
  await Promise.all(
    session.uploadedSegments.map((seg) =>
      s3Service.deleteFile(seg.s3Key).catch((err) =>
        console.warn(`[WebinarRecording] failed to delete segment ${seg.s3Key}:`, err.message)
      )
    )
  );
  console.log(`[WebinarRecording] Deleted ${session.uploadedSegments.length} segment files from S3`);

  return combinedKey;
}

/**
 * Orphan sweeper — deletes segment files older than 2 days. These accumulate
 * when a recording session fails mid-upload (combined upload crashed, server
 * restart during concat, etc). Runs every 6 hours after server boot.
 *
 * Segments for successful recordings are already cleaned up inline
 * (see concatAndRegister). This only catches orphans.
 */
export async function sweepOrphanSegments(olderThanMs = 2 * 24 * 60 * 60 * 1000) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ListObjectsV2Command, DeleteObjectCommand } = require("@aws-sdk/client-s3");
    // Reuse the shared s3 client by going through s3Service's internals
    // via a listing call. We page through garage-webinar/**/segments/*.
    const bucket = process.env.AWS_S3_BUCKET || "";
    if (!bucket) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { S3Client } = require("@aws-sdk/client-s3");
    const client = new S3Client({
      region: process.env.AWS_S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
    const cutoff = Date.now() - olderThanMs;
    let token: string | undefined;
    let deleted = 0;
    let scanned = 0;
    do {
      const res: any = await client.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "garage-webinar/",
        ContinuationToken: token,
      }));
      for (const obj of res.Contents || []) {
        scanned++;
        if (!obj.Key?.includes("/segments/")) continue;
        if (obj.LastModified && obj.LastModified.getTime() < cutoff) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: obj.Key }));
          deleted++;
        }
      }
      token = res.NextContinuationToken;
    } while (token);
    if (deleted > 0) {
      console.log(`[WebinarRecording] Orphan sweep: scanned ${scanned}, deleted ${deleted} old segments`);
    }
  } catch (err: any) {
    console.error("[WebinarRecording] Orphan sweep failed:", err.message);
  }
}

// ── Internal: build consumer + plain transport ─────────────────────────────

async function createRecordingInput(
  room: WebinarRoom,
  producer: any
): Promise<RecordingInput | null> {
  try {
    const rtpPort = allocatePort();
    const rtcpPort = rtpPort + 1;

    const transport = await room.router.createPlainTransport({
      listenIp: { ip: "127.0.0.1", announcedIp: undefined },
      rtcpMux: false,
      comedia: false,
    });

    await transport.connect({
      ip: "127.0.0.1",
      port: rtpPort,
      rtcpPort,
    });

    const consumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities: room.router.rtpCapabilities,
      paused: true,
    });

    const codec = consumer.rtpParameters.codecs[0];
    return {
      kind: producer.kind,
      producerId: producer.id,
      consumer,
      transport,
      rtpPort,
      rtcpPort,
      payloadType: codec.payloadType,
      codec: codec.mimeType.split("/")[1],
      clockRate: codec.clockRate,
    };
  } catch (err) {
    console.error("[WebinarRecording] createRecordingInput failed:", err);
    return null;
  }
}

// ── Internal: build SDP ─────────────────────────────────────────────────────

function buildSdp(inputs: RecordingInput[]): string {
  const lines: string[] = [];
  lines.push("v=0");
  lines.push("o=- 0 0 IN IP4 127.0.0.1");
  lines.push("s=Webinar Recording");
  lines.push("c=IN IP4 127.0.0.1");
  lines.push("t=0 0");

  for (const input of inputs) {
    if (input.kind === "audio") {
      lines.push(`m=audio ${input.rtpPort} RTP/AVP ${input.payloadType}`);
      lines.push(`a=rtpmap:${input.payloadType} opus/${input.clockRate}/2`);
      lines.push(`a=fmtp:${input.payloadType} minptime=10;useinbandfec=1`);
      lines.push("a=recvonly");
    } else {
      const codecName = input.codec.toLowerCase().includes("vp9")
        ? "VP9"
        : input.codec.toLowerCase().includes("h264")
        ? "H264"
        : "VP8";
      lines.push(`m=video ${input.rtpPort} RTP/AVP ${input.payloadType}`);
      lines.push(`a=rtpmap:${input.payloadType} ${codecName}/${input.clockRate}`);
      lines.push("a=recvonly");
    }
  }

  return lines.join("\n") + "\n";
}

// ── Internal: spawn FFmpeg with segment muxer ─────────────────────────────

function spawnFfmpeg(
  sdpPath: string,
  segmentPattern: string,
  inputs: RecordingInput[]
): ChildProcess {
  const videoInputs = inputs.filter((i) => i.kind === "video");
  const audioInputs = inputs.filter((i) => i.kind === "audio");
  const videoCount = videoInputs.length;
  const audioCount = audioInputs.length;

  const args: string[] = [
    "-loglevel", "warning",
    "-protocol_whitelist", "file,udp,rtp",
    "-max_delay", "500000",
    "-reorder_queue_size", "500",
    "-fflags", "+genpts+discardcorrupt",
    "-i", sdpPath,
  ];

  // Build filter_complex for video composite + audio mix.
  // Video: xstack grid for 2-4 participants, single stream for 1.
  // Audio: amix all inputs into one track.
  const filterParts: string[] = [];

  // Map SDP stream indices: inputs[] order = stream order. Find video/audio
  // indices in that sequence.
  const videoIndices = inputs
    .map((inp, idx) => (inp.kind === "video" ? idx : -1))
    .filter((idx) => idx !== -1);
  const audioIndices = inputs
    .map((inp, idx) => (inp.kind === "audio" ? idx : -1))
    .filter((idx) => idx !== -1);

  if (videoCount === 1) {
    // Single video — re-encode to normalize but keep simple (no grid).
    filterParts.push(
      `[0:${videoIndices[0]}]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1[vout]`
    );
  } else if (videoCount >= 2) {
    // xstack layouts (Google Meet style grid):
    //  2 videos: side-by-side (2x1)     — layout="0_0|w0_0"
    //  3 videos: top row 2, bottom 1    — layout="0_0|w0_0|0_h0"
    //  4 videos: 2x2 grid               — layout="0_0|w0_0|0_h0|w0_h0"
    const cellW = 640, cellH = 360;
    videoIndices.forEach((srcIdx, i) => {
      filterParts.push(
        `[0:${srcIdx}]scale=${cellW}:${cellH}:force_original_aspect_ratio=decrease,pad=${cellW}:${cellH}:(ow-iw)/2:(oh-ih)/2,setsar=1[v${i}]`
      );
    });
    const layouts: Record<number, string> = {
      2: "0_0|w0_0",
      3: "0_0|w0_0|0_h0",
      4: "0_0|w0_0|0_h0|w0_h0",
    };
    const n = Math.min(videoCount, 4);
    const stackInputs = Array.from({ length: n }, (_, i) => `[v${i}]`).join("");
    filterParts.push(
      `${stackInputs}xstack=inputs=${n}:layout=${layouts[n]}:fill=black[vout]`
    );
  }

  if (audioCount > 1) {
    const labels = audioIndices.map((i) => `[0:${i}]`).join("");
    filterParts.push(
      `${labels}amix=inputs=${audioCount}:duration=longest:dropout_transition=0[aout]`
    );
  }

  if (filterParts.length > 0) {
    args.push("-filter_complex", filterParts.join(";"));
  }

  if (videoCount > 0) {
    args.push("-map", "[vout]");
    // Video must be re-encoded because xstack produces a new raw stream.
    // libvpx-vp8 keeps WebM container. Use realtime preset for low CPU.
    args.push(
      "-c:v", "libvpx",
      "-b:v", "2M",
      "-deadline", "realtime",
      "-cpu-used", "4",
      "-threads", "2"
    );
  }
  if (audioCount > 1) {
    args.push("-map", "[aout]", "-c:a", "libopus", "-b:a", "128k");
  } else if (audioCount === 1) {
    args.push("-map", `0:${audioIndices[0]}`, "-c:a", "copy");
  }

  // Segment muxer: rotates files every SEGMENT_DURATION_S seconds. Each segment
  // is a self-contained WebM — playable on its own, uploadable immediately.
  args.push(
    "-f", "segment",
    "-segment_time", String(SEGMENT_DURATION_S),
    "-segment_format", "webm",
    "-reset_timestamps", "1",
    "-y", segmentPattern,
  );

  // Prefer bundled ffmpeg binary if available
  let ffmpegBin = "ffmpeg";
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffmpegBin = require("@ffmpeg-installer/ffmpeg").path;
  } catch { /* use system ffmpeg */ }

  console.log(`[WebinarRecording] Spawning ${ffmpegBin}: ${args.join(" ")}`);

  const ffmpeg = spawn(ffmpegBin, args, {
    stdio: ["pipe", "pipe", "pipe"],
  });

  ffmpeg.stderr?.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`[ffmpeg] ${msg}`);
  });

  ffmpeg.on("error", (err) => {
    console.error("[WebinarRecording] ffmpeg spawn error:", err);
  });

  return ffmpeg;
}
