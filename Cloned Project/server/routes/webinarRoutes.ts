import { Router } from "express";
import { endWebinarSession } from "../realtime/webinarEnd";
import { Types } from "mongoose";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { requireAuth } from "../middleware/auth";
import { Workshop } from "../models/workshop.model";
import { isBilledSpeaker } from "../services/workshop";
import { Meet } from "../models/meet.model";
import { User } from "../models/user.model";
import { hasFounderAccess } from "../utils/accessCheck";
import { isFounderOrModuleAdmin } from "../utils/rbac";
import {
  claimSessionHost,
  getSessionHost,
  releaseSessionHost,
} from "../services/webinarHost";
import { getRoom, removeRoom } from "../services/mediasoup";
import {
  createParticipantToken,
  getLivekitUrl,
  toLivekitRoomName,
} from "../services/livekit";
import { generateMeetJoinCode, generateMeetAgoraChannel } from "../utils/meetCode";
import { env } from "../config/env";
import { emitWorkshopPreviewUpdate } from "../services/socket";
import { s3Service } from "../services/s3";
import { recordingStartedAt } from "../utils/recordingTime";
import {
  OrganizationCabinet,
  OrganizationFile,
} from "../models/cabinet.model";
import multer from "multer";
import { BotManager } from "../note-taker/agents/bot-manager";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { sessionDayKey } from "../utils/workshopStatus";
import { NoteSession } from "../note-taker/models/note-session.model";

// Bat246 funnel org — see demo-host-join in publicWebinar.ts for the
// name-only host bypass this constant gates in the livekit-token route below.
const BAT246_ORG_ID = "6a0d34e677323d1b81c6469b";

// ── FFmpeg path (bundled via @ffmpeg-installer/ffmpeg) ────────────────────────
let ffmpegBin = "ffmpeg";
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const installer = require("@ffmpeg-installer/ffmpeg") as { path: string };
  ffmpegBin = installer.path;
  console.log("[FFmpeg] Using bundled binary:", ffmpegBin);
} catch {
  console.log("[FFmpeg] @ffmpeg-installer not found, using system ffmpeg");
}

/** Convert a WebM buffer → MP4 buffer using server-side ffmpeg */
async function convertWebmToMp4(webmBuffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = `webinar_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const inputPath = path.join(tmpDir, `${id}.webm`);
  const outputPath = path.join(tmpDir, `${id}.mp4`);

  await fs.promises.writeFile(inputPath, webmBuffer);

  try {
    await new Promise<void>((resolve, reject) => {
      // -preset ultrafast + -threads 0 gives ~5-8x faster encode vs 'fast'.
      // -tune zerolatency disables lookahead for additional speed.
      // File size goes up a bit but client already caps bitrate to ~2.5Mbps
      // so the MP4 stays reasonable. Quality is visually indistinguishable
      // for screen-share / webcam content at -crf 23.
      const ff = spawn(ffmpegBin, [
        "-y",
        "-i", inputPath,
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-ac", "2",
        "-ar", "48000",
        "-movflags", "+faststart",
        "-threads", "0",
        outputPath,
      ]);

      let stderr = "";
      ff.stderr.on("data", (d: Buffer) => {
        stderr += d.toString();
        if (stderr.length > 8192) stderr = stderr.slice(-8192);
      });

      const timer = setTimeout(() => {
        ff.kill("SIGKILL");
        reject(new Error("FFmpeg timed out after 10 minutes"));
      }, 10 * 60 * 1000);

      ff.on("close", (code: number | null) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-600)}`));
      });

      ff.on("error", (err: Error) => {
        clearTimeout(timer);
        reject(new Error(`FFmpeg spawn error: ${err.message}`));
      });
    });

    const mp4Buffer = await fs.promises.readFile(outputPath);
    return mp4Buffer;
  } finally {
    await fs.promises.unlink(inputPath).catch(() => {});
    await fs.promises.unlink(outputPath).catch(() => {});
  }
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB max

/**
 * POST /webinar/:workshopId/guest-token
 * Generate a guest JWT for non-logged-in users to join a webinar via socket.
 * Public endpoint — no auth required.
 */
router.post("/:workshopId/guest-token", async (req, res) => {
  try {
    const { workshopId } = req.params;
    const displayName = `Guest${Math.floor(10000 + Math.random() * 90000)}`;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(workshopId).select("title").lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Webinar not found" });
    }

    const guestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const { signJwt } = await import("../services/jwt");

    const token = signJwt(
      {
        isGuest: true,
        guestId,
        eventId: workshopId,
        displayName,
        email: "",
      },
      { expiresIn: "12h" }
    );

    res.json({ success: true, token, guestId });
  } catch (error) {
    console.error("[Webinar] Error generating guest token:", error);
    res.status(500).json({ success: false, error: "Failed to generate guest token" });
  }
});

// Helper: check if user is the workshop creator
/**
 * May this user RUN this workshop — start it, stop it, record it, read its
 * attendee data?
 *
 * Was "is the creator". Now also true for anyone the founder delegated the
 * `live_streams` module to, plus founders and legacy `fullAccess` holders
 * (isFounderOrModuleAdmin folds both in). Whoever runs the stream is its host;
 * there is no lesser co-host tier.
 *
 * Strictly a relaxation — the creator branch is still checked first and still
 * returns true, so nobody who could run a stream before loses the ability.
 *
 * Gates POST /:id/start, /:id/stop, /:id/recording, the analytics read and the
 * attendee CSV export.
 */
async function isWorkshopHost(userId: string, workshopId: string): Promise<boolean> {
  const workshop = await Workshop.findById(workshopId)
    .select("createdBy orgId")
    .lean();
  if (!workshop) return false;
  if (workshop.createdBy?.toString() === userId) return true;

  const orgId = (workshop as any).orgId?.toString();
  if (!orgId || !userId) return false;
  return isFounderOrModuleAdmin(userId, orgId, "live_streams");
}

/** Deterministic LiveKit room name for a workshop. */
function webinarRoomName(workshopId: string): string {
  return toLivekitRoomName(`webinar-${workshopId}`);
}

/**
 * POST /webinar/:workshopId/livekit-token
 *
 * Issue a LiveKit JWT for joining the webinar room. Verifies the caller's
 * webinar role server-side (host / panelist / attendee) and signs the token
 * with the appropriate publish/admin grants.
 *
 * Auth: accepts EITHER a logged-in user JWT (Bearer header) OR a guest
 * webinar JWT issued by /webinar/:workshopId/guest-token.
 *
 * Body: { role?: "host", panelistToken?: string }
 *   - role="host" is honored only if the caller is the workshop creator
 *   - panelistToken, if it matches workshop.panelistLink, grants panelist
 *
 * Returns: { success, token, livekitUrl, room, identity, name, role }
 */
router.post("/:workshopId/livekit-token", async (req, res) => {
  try {
    const { workshopId } = req.params;
    const { role: requestedRole, panelistToken } = req.body || {};

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid webinar ID" });
    }

    const workshop = await Workshop.findById(workshopId)
      // orgId resolves a delegated `live_streams` admin; the date fields
      // resolve which session the host seat is being claimed for.
      .select(
        "title createdBy panelistLink orgId date isRecurring currentSessionDate speakers"
      )
      .lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Webinar not found" });
    }

    // ── Authenticate caller (logged-in user OR guest) ──────────────────────
    const authHeader = req.headers.authorization || "";
    const rawToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!rawToken) {
      return res.status(401).json({ success: false, error: "Missing token" });
    }

    let identity = "";
    let displayName = "";
    let isGuest = false;
    let callerUserId = "";
    // Bat246 name-only demo-host bypass (demo-host-join in publicWebinar.ts)
    // — the token carries this claim, but it is only honored below if the
    // workshop itself belongs to BAT246_ORG_ID.
    let isDemoHost = false;

    try {
      const { verifyJwt } = await import("../services/jwt");
      const decoded: any = verifyJwt(rawToken);

      if (decoded?.isGuest) {
        // Guest must have been issued for THIS workshop.
        if (decoded.eventId !== workshopId) {
          return res
            .status(403)
            .json({ success: false, error: "Guest token does not match webinar" });
        }
        identity = decoded.guestId || `guest_${Date.now()}`;
        displayName = (decoded.displayName || "Guest").toString().slice(0, 80);
        isGuest = true;
      } else if (decoded?.userId) {
        callerUserId = String(decoded.userId);
        identity = callerUserId;
        displayName = (decoded.name || decoded.email || "User")
          .toString()
          .slice(0, 80);
        isDemoHost = !!decoded.demoHost;
      } else {
        return res.status(401).json({ success: false, error: "Invalid token" });
      }
    } catch {
      return res.status(401).json({ success: false, error: "Invalid token" });
    }

    // ── Verify webinar role (mirrors webinar:joinRoom socket handler) ──────
    let verifiedRole: "host" | "panelist" | "attendee" = "attendee";
    const workshopCreator = workshop.createdBy?.toString();
    const workshopOrgId = (workshop as any).orgId?.toString();

    // Whoever runs the stream is the host. That is the creator, and it is also
    // anyone the founder delegated the `live_streams` module to — they get the
    // same grants rather than a reduced co-host tier, which is what keeps every
    // existing host-gated control (pin, record, poll, mute, end) working
    // untouched. Delegation is checked only when "host" was actually asked for,
    // so a stream admin browsing in as a viewer still lands as an attendee.
    //
    // Being ELIGIBLE to host is not the same as BEING the host. Two people can
    // now be eligible, so the seat is claimed first-come per session: the
    // second arrival is an attendee even if they are the founder.
    if (requestedRole === "host" && callerUserId) {
      const eligible =
        workshopCreator === callerUserId ||
        (!!workshopOrgId &&
          (await isFounderOrModuleAdmin(
            callerUserId,
            workshopOrgId,
            "live_streams"
          ))) ||
        (isDemoHost && workshopOrgId === BAT246_ORG_ID);

      if (eligible) {
        const claim = await claimSessionHost(workshop as any, callerUserId);
        if (claim.isHost) verifiedRole = "host";
        else
          console.log(
            `[Webinar] livekit-token: ${callerUserId} is eligible but ` +
              `${claim.hostUserId} already holds the host seat for ${workshopId} — joining as attendee`
          );
      }
    }

    if (
      verifiedRole === "attendee" &&
      panelistToken &&
      typeof panelistToken === "string" &&
      (workshop as any).panelistLink === panelistToken
    ) {
      verifiedRole = "panelist";
    }

    // Billed speakers (Workshop.speakers) get the panelist grant, matching
    // the seat the socket join gives them — without this the token would
    // come back canPublish:false and they'd be a co-host who cannot
    // broadcast. Guests are forced to attendee just below, so a guest
    // identity never reaches this.
    if (verifiedRole === "attendee" && callerUserId && isBilledSpeaker(workshop as any, callerUserId)) {
      verifiedRole = "panelist";
    }

    // Guests can never be host or panelist. Force attendee.
    if (isGuest) verifiedRole = "attendee";

    // Bat246 (gotobigwin.com) seats everyone as a co-host — the mirror of the
    // rule in the webinar:joinRoom socket handler. Both decisions must agree:
    // the socket seats the caller, this route grants what that seat can do, so
    // a socket-side panelist with an attendee token is a co-host whose camera
    // and mic silently cannot publish.
    //
    // After the guest line on purpose. Bat246's audience arrives on invite
    // links as guests, so leaving it above would have upgraded almost nobody —
    // and left exactly the mismatch described above for everyone who matters.
    if (verifiedRole === "attendee" && workshopOrgId === BAT246_ORG_ID) {
      verifiedRole = "panelist";
    }

    // A co-host promoted earlier in this session gets their publish grant back.
    // The socket restores their role on rejoin, but a refresh also re-mints
    // this token — and without the same lookup it would come back with
    // canPublish false, leaving them a co-host who cannot broadcast.
    if (verifiedRole === "attendee" && callerUserId) {
      const granted = getRoom(workshopId)?.elevatedRoles.get(callerUserId);
      if (granted) {
        verifiedRole = granted;
        console.log(
          `[Webinar] livekit-token: restored ${granted} grant for ${callerUserId} in ${workshopId}`
        );
      }
    }

    console.log(
      `[Webinar] livekit-token resolution: workshop=${workshopId} ` +
        `requestedRole=${requestedRole} callerUserId=${callerUserId || "(guest)"} ` +
        `isGuest=${isGuest} workshopCreator=${workshopCreator} ` +
        `panelistTokenMatch=${
          panelistToken === (workshop as any).panelistLink
        } → verifiedRole=${verifiedRole}`
    );

    // ── Issue LiveKit token with grants matching the role ──────────────────
    const room = webinarRoomName(workshopId);
    const canPublish = verifiedRole === "host" || verifiedRole === "panelist";
    const isOwner = verifiedRole === "host";

    const metadata = JSON.stringify({
      role: verifiedRole,
      isGuest,
      userId: callerUserId || undefined,
      guestId: isGuest ? identity : undefined,
      name: displayName,
    });

    const lkToken = await createParticipantToken(room, {
      userId: identity,
      userName: displayName,
      isOwner,
      canPublish,
      metadata,
      exp: 6 * 60 * 60, // 6h
    });

    if (!lkToken) {
      return res
        .status(500)
        .json({ success: false, error: "Failed to mint LiveKit token" });
    }

    res.json({
      success: true,
      token: lkToken,
      livekitUrl: getLivekitUrl(),
      room,
      identity,
      name: displayName,
      role: verifiedRole,
      webinarTitle: workshop.title,
    });
  } catch (err: any) {
    console.error("[Webinar] livekit-token error:", err);
    res.status(500).json({ success: false, error: "Failed to issue token" });
  }
});

/**
 * POST /webinar/:workshopId/start
 * Start a webinar session for the given workshop. Creates a Meet record if needed.
 */
/**
 * Record that the founder is running this workshop's current session.
 *
 * Clearing `manualEndedAt` is the point: a stop marks the session over, and
 * without clearing it a restart leaves the session reading "completed" — the
 * join gate (deriveClockStatus) checks that stamp first, so attendees are told
 * "This session has ended" while the room is live.
 *
 * Anchor resolution: the founder's own `currentSessionDate` when set (the
 * session picker / an early start), else today for a recurring workshop, else
 * the workshop's own date for a one-off.
 */
async function stampSessionStarted(
  workshop: { _id: Types.ObjectId; currentSessionDate?: Date | null; isRecurring?: boolean; date?: Date },
  userId: string
): Promise<void> {
  try {
    const sessionAnchor =
      workshop.currentSessionDate ||
      (workshop.isRecurring ? new Date() : workshop.date) ||
      new Date();
    const key = sessionDayKey(sessionAnchor);
    await WorkshopSessionOverride.findOneAndUpdate(
      { workshopId: workshop._id, sessionDate: key },
      {
        $set: {
          manualStartedAt: new Date(),
          "meta.startedBy": new Types.ObjectId(userId),
        },
        $unset: { manualEndedAt: "", "meta.endedBy": "" },
        $setOnInsert: {
          workshopId: workshop._id,
          sessionDate: key,
        },
      },
      { upsert: true }
    );
  } catch (overrideErr) {
    console.warn("[Webinar] Failed to stamp manualStartedAt override:", overrideErr);
  }
}

router.post("/:workshopId/start", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;

    if (!await isWorkshopHost(me.userId, workshopId)) {
      return res.status(403).json({ success: false, error: "Only the workshop creator can start a webinar" });
    }

    const workshop = await Workshop.findById(workshopId);
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found" });
    }

    // One host per session. If someone else already took the seat, starting
    // again would rotate the room out from under them — same guard as
    // workshops/:id/generate-meeting, which is the path the FE actually uses.
    const seatHolder = await getSessionHost(workshop as any);
    if (seatHolder && seatHolder !== me.userId) {
      return res.status(409).json({
        success: false,
        error: "Someone else is already hosting this session",
        code: "SESSION_ALREADY_HOSTED",
      });
    }

    // Check if there's an existing live meet
    if (workshop.meetingId) {
      const existingMeet = await Meet.findById(workshop.meetingId);
      if (existingMeet && existingMeet.status === "live") {
        const now = new Date();
        if (existingMeet.endTime && existingMeet.endTime > now) {
          // Genuinely still live. Re-stamp the session anyway: the host is
          // here, so a leftover manualEndedAt from an earlier stop must not
          // keep telling attendees the session is over.
          await stampSessionStarted(workshop, me.userId);
          return res.json({
            success: true,
            message: "Webinar is already live",
            webinarId: workshopId,
            meetId: existingMeet._id.toString(),
          });
        }
        // Stale — mark it ended so a fresh session can start
        await Meet.findByIdAndUpdate(existingMeet._id, {
          status: "ended",
          endedAt: now,
        });
      }
    }

    // Get host info
    const host = await User.findById(me.userId).select("email name").lean();
    if (!host) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Create a Meet record for the webinar session
    const joinCode = generateMeetJoinCode();
    const newMeet = await Meet.create({
      orgId: workshop.orgId,
      hostEmail: (host.email || "").toLowerCase().trim(),
      title: workshop.title,
      description: workshop.description || "",
      startTime: new Date(),
      endTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
      joinCode,
      agoraChannel: generateMeetAgoraChannel(joinCode),
      status: "live",
      isHostVerified: true,
      startedAt: new Date(),
    });

    // For per_session recurring workshops we MUST stamp currentSessionDate
    // so the socket join gate + prepare-join can enforce per-session
    // access. Without this the gate short-circuits and any logged-in user
    // gets through the paywall. Today (UTC midnight) is the anchor —
    // matches how the sessions accordion identifies "today's session".
    //
    // Also stamp `currentSessionDate` for enrol-once recurring workshops.
    // Without this the /start handler's override write below falls back
    // to `workshop.date` (the recurrence anchor date) and the wrong
    // session ends up flagged Live in the analytics table for up to 8h.
    if (
      (workshop.enrollmentType === "per_session" || workshop.isRecurring) &&
      !workshop.currentSessionDate
    ) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      workshop.currentSessionDate = today;
    }

    // Update workshop with meeting details
    workshop.meetingId = newMeet._id.toString();
    workshop.meetingUrl = `${env.FRONTEND_URL || "http://localhost:3000"}/webinar/${workshopId}?role=host`;
    await workshop.save();

    // Stamp manualStartedAt on the session override so the badge flips to
    // Live even before the scheduled start time. Resolution order:
    //   1. `workshop.currentSessionDate` — set above for per_session +
    //      enrol-once recurring workshops.
    //   2. Today's UTC midnight — for recurring workshops that somehow got
    //      here without `currentSessionDate` being set (defensive).
    //   3. `workshop.date` — for non-recurring (single-scheduled) workshops.
    //
    // The old fallback of `workshop.currentSessionDate || workshop.date`
    // stamped the anchor onto Session #1 of enrol-once recurring workshops
    // every time the founder started ANY session — sticky-flagging that
    // session Live for up to 8h.
    await stampSessionStarted(workshop, me.userId);

    // Notify workspace preview
    try {
      emitWorkshopPreviewUpdate(workshop.orgId?.toString() || "", "workshop:preview:live", { workshopId, title: workshop.title });
    } catch (e) {
      console.warn("[Webinar] Failed to emit preview update:", e);
    }

    console.log(`[Webinar] Started webinar for workshop ${workshopId}, meetId=${newMeet._id}`);

    // Kick off the note-taker bot in parallel with the host going live.
    // The bot joins the same LiveKit room, transcribes via Deepgram, and on
    // leave summarizes — the recorded webinar's notes modal then renders
    // the summary + transcript. Fire-and-forget so a bot failure can't
    // block the host from going live; the bot manager logs its own errors.
    (async () => {
      try {
        const roomName = webinarRoomName(workshopId);
        const botManager = BotManager.getInstance();
        if (botManager.hasBot(roomName)) {
          console.log(`[Webinar] note-taker bot already running for ${roomName}`);
          return;
        }

        // Reuse an in-flight NoteSession if one exists — the older
        // mediasoupHandlers ensureNoteTakerAttached path or a previous
        // /start might have already created it, and the collection has a
        // partial-unique index on roomName for active sessions. Creating
        // an unconditional duplicate would trip E11000.
        let noteSession = await NoteSession.findOne({
          roomName,
          status: { $in: ["recording", "transcribing", "summarizing"] },
        }).sort({ startedAt: -1 });

        if (!noteSession) {
          noteSession = await NoteSession.create({
            roomName,
            roomId: workshopId,
            orgId: workshop.orgId,
            meetSessionId: newMeet._id,
            botIdentity: "notetaker-bot",
            botJoinedAt: new Date(),
            startedAt: new Date(),
            title: workshop.title,
            participants: [],
            status: "recording",
            settings: {
              autoJoin: true,
              language: "en",
              enableSummary: true,
              enableEmailDistribution: true,
            },
          });
        }

        const session = await botManager.join({
          webinarId: roomName,
          sessionId: noteSession._id as Types.ObjectId,
          language: "en",
        });

        // BotManager's own `disconnected` listener only clears its internal
        // Maps — it doesn't transition NoteSession status or enqueue the
        // summarize job. Wire that explicitly so the session moves through
        // recording → transcribing and the summary pipeline actually runs.
        // 5s delay matches the existing mediasoupHandlers pattern: lets
        // Deepgram drain any in-flight frames before we read the transcript.
        const sessionIdStr = (noteSession._id as Types.ObjectId).toString();
        session.once("disconnected", async () => {
          try {
            const ns = await NoteSession.findById(noteSession!._id);
            if (ns && ns.status === "recording") {
              const now = new Date();
              ns.botLeftAt = now;
              ns.endedAt = now;
              ns.durationSeconds = Math.round(
                (now.getTime() - ns.startedAt.getTime()) / 1000,
              );
              ns.status = "transcribing";
              await ns.save();
              setTimeout(() => {
                import("../note-taker/jobs/queue")
                  .then(({ enqueueSummarize }) => enqueueSummarize(sessionIdStr))
                  .catch((err) =>
                    console.error("[Webinar] enqueueSummarize failed:", err.message),
                  );
              }, 5000);
            }
          } catch (err: any) {
            console.error("[Webinar] auto-finalize failed:", err.message);
          }
        });

        console.log(
          `[Webinar] note-taker bot joined ${roomName} sessionId=${noteSession._id}`,
        );
      } catch (err) {
        console.error("[Webinar] note-taker bot failed to start:", err);
      }
    })();

    res.json({
      success: true,
      webinarId: workshopId,
      meetId: newMeet._id.toString(),
      joinCode,
    });
  } catch (error) {
    console.error("[Webinar] Error starting webinar:", error);
    res.status(500).json({ success: false, error: "Failed to start webinar" });
  }
});

/**
 * POST /webinar/:workshopId/stop
 * End the webinar session.
 */
router.post("/:workshopId/stop", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;

    if (!await isWorkshopHost(me.userId, workshopId)) {
      return res.status(403).json({ success: false, error: "Only the workshop creator can stop the webinar" });
    }

    const workshop = await Workshop.findById(workshopId).select("_id").lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found" });
    }

    // One end path for everyone. This route used to mark the session ended
    // and drop the room WITHOUT telling the sockets in it, so every viewer
    // stayed seated — LIVE badge, REC badge, "waiting for host video" —
    // until they gave up. endWebinarSession announces first.
    await endWebinarSession(workshopId, { endedBy: me.userId, reason: "stop-route" });

    console.log(`[Webinar] Stopped webinar for workshop ${workshopId}`);

    res.json({ success: true });
  } catch (error) {
    console.error("[Webinar] Error stopping webinar:", error);
    res.status(500).json({ success: false, error: "Failed to stop webinar" });
  }
});

/**
 * POST /webinar/:workshopId/recording
 * Upload a webinar recording (WebM from client MediaRecorder).
 */
router.post("/:workshopId/recording", requireAuth, upload.single("recording"), async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;

    if (!await isWorkshopHost(me.userId, workshopId)) {
      return res.status(403).json({ success: false, error: "Only the host can upload recordings" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "No recording file provided" });
    }

    // Accept WebM (from MediaRecorder) or MP4; convert WebM → MP4 server-side
    const isWebm = file.mimetype === "video/webm" || file.originalname.toLowerCase().endsWith(".webm");
    const isMp4  = file.mimetype === "video/mp4"  || file.originalname.toLowerCase().endsWith(".mp4");
    if (!isWebm && !isMp4) {
      return res.status(400).json({
        success: false,
        error: "Recording must be WebM or MP4.",
      });
    }

    const workshop = await Workshop.findById(workshopId).select("title orgId").lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found" });
    }

    const orgId = workshop.orgId?.toString() || "";

    // Convert WebM → MP4 via server-side ffmpeg
    let mp4Buffer: Buffer;
    if (isWebm) {
      console.log(`[Webinar] Converting WebM (${(file.buffer.length / 1024 / 1024).toFixed(1)} MB) → MP4 ...`);
      try {
        mp4Buffer = await convertWebmToMp4(file.buffer);
        console.log(`[Webinar] Conversion done — MP4 size: ${(mp4Buffer.length / 1024 / 1024).toFixed(1)} MB`);
      } catch (convErr: any) {
        console.error("[Webinar] FFmpeg conversion failed:", convErr.message);
        return res.status(500).json({ success: false, error: `MP4 conversion failed: ${convErr.message}` });
      }
    } else {
      mp4Buffer = file.buffer;
    }

    const extension = "mp4";
    const mimeType = "video/mp4";
    const friendlyName = `${workshop.title || "webinar"}_${new Date().toISOString()}.${extension}`;

    // Upload to S3 under garage-webinar/ folder
    const safeTitle = (workshop.title || "webinar").replace(/[^a-z0-9]/gi, "_").slice(0, 80);
    const s3Key = `garage-webinar/${orgId}/${workshopId}/${safeTitle}_${Date.now()}.${extension}`;
    await s3Service.uploadFile(s3Key, mp4Buffer, mimeType, {
      originalName: friendlyName,
      uploadedBy: me.userId,
      organizationId: orgId,
      workshopId,
      recordingSource: "webinar-mediasoup",
    });

    // Find or create Recordings cabinet
    let orgCabinet = await OrganizationCabinet.findOne({ organization: orgId, isRoot: true });
    if (!orgCabinet) {
      orgCabinet = await OrganizationCabinet.create({
        name: "Organization Cabinet",
        description: "Shared cabinet for all organization members",
        owner: me.userId,
        organization: orgId,
        path: "/organization",
        isRoot: true,
      });
    }

    let recordingsCabinet = await OrganizationCabinet.findOne({
      organization: orgId,
      name: "Recordings",
      parentCabinet: orgCabinet._id,
    });
    if (!recordingsCabinet) {
      recordingsCabinet = await OrganizationCabinet.create({
        name: "Recordings",
        description: "Meeting and workspace recordings",
        owner: me.userId,
        organization: orgId,
        parentCabinet: orgCabinet._id,
        path: `${orgCabinet.path}/Recordings`,
        isRoot: false,
      });
    }

    // Create file record
    const fileRecord = await OrganizationFile.create({
      name: friendlyName,
      originalName: friendlyName,
      owner: me.userId,
      organization: orgId,
      cabinet: recordingsCabinet._id,
      s3Key,
      s3Bucket: process.env.AWS_S3_BUCKET || "",
      s3Region: process.env.AWS_S3_REGION || "",
      mimeType,
      size: mp4Buffer.length,
      extension,
      path: `${recordingsCabinet.path}/${friendlyName}`,
      status: "ready",
      metadata: {
        workshopId,
        recordingSource: "webinar-mediasoup",
      },
    });

    console.log(`[Webinar] Recording uploaded for workshop ${workshopId}: ${fileRecord._id}`);

    // Generate a presigned download URL (24 hours) so the client can auto-download the MP4
    let downloadUrl: string | null = null;
    try {
      downloadUrl = await s3Service.getPresignedDownloadUrl(s3Key, 86400, friendlyName); // 24h, forces download
    } catch (urlErr) {
      console.warn("[Webinar] Could not generate presigned download URL:", urlErr);
    }

    res.json({
      success: true,
      fileId: fileRecord._id.toString(),
      filename: friendlyName,
      downloadUrl, // presigned S3 URL for the converted MP4
    });
  } catch (error) {
    console.error("[Webinar] Error uploading recording:", error);
    res.status(500).json({ success: false, error: "Failed to upload recording" });
  }
});

/**
 * GET /webinar/:workshopId/recordings
 * List all recordings for a webinar (with presigned download URLs)
 */
router.get("/:workshopId/recordings", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }

    // Find all recording files for this workshop (both legacy single-file
    // and new segmented-manifest recordings)
    const files = await OrganizationFile.find({
      "metadata.workshopId": workshopId,
      "metadata.recordingSource": {
        $in: [
          "webinar-mediasoup",
          "webinar-mediasoup-server",
          "webinar-livekit",
        ],
      },
      status: "ready",
    })
      .sort({ createdAt: -1 })
      .lean();

    const recordings = await Promise.all(
      files.map(async (f) => {
        const isManifest = f.mimeType === "application/x-webinar-manifest";
        let downloadUrl = "";
        let streamUrl = "";
        try {
          downloadUrl = await s3Service.getPresignedDownloadUrl(f.s3Key, 3600, f.name);
          // Separate inline URL so the Play button streams instead of downloads
          if (!isManifest) {
            streamUrl = await s3Service.getPresignedStreamUrl(
              f.s3Key,
              3600,
              f.mimeType || "video/mp4"
            );
          }
        } catch {
          /* S3 error — skip URL */
        }
        return {
          id: f._id.toString(),
          name: f.name,
          size: f.size,
          sizeMB: ((f.size || 0) / 1024 / 1024).toFixed(2),
          createdAt: f.createdAt,
          // When the egress STARTED — the anchor chat replay lines up
          // against. `createdAt` is upload time and can be hours later.
          startedAt: recordingStartedAt(f.s3Key, f.createdAt),
          downloadUrl,
          streamUrl,
          isSegmented: isManifest,
          segmentCount: isManifest ? (f.metadata as any)?.segmentCount : undefined,
          playUrl: isManifest
            ? `/webinar/${workshopId}/recordings/${f._id}/playlist`
            : streamUrl,
        };
      })
    );

    res.json({ success: true, recordings });
  } catch (error) {
    console.error("[Webinar] Error listing recordings:", error);
    res.status(500).json({ success: false, error: "Failed to list recordings" });
  }
});

/**
 * GET /webinar/:workshopId/recordings/:recordingId/playlist
 * For segmented recordings: returns the ordered list of segment URLs
 * (each presigned). Client concatenates or plays sequentially.
 */
router.get(
  "/:workshopId/recordings/:recordingId/playlist",
  requireAuth,
  async (req, res) => {
    try {
      const { recordingId } = req.params;
      if (!Types.ObjectId.isValid(recordingId)) {
        return res.status(400).json({ success: false, error: "Invalid recording ID" });
      }

      const file = await OrganizationFile.findById(recordingId).lean();
      if (!file) {
        return res.status(404).json({ success: false, error: "Recording not found" });
      }
      if (file.mimeType !== "application/x-webinar-manifest") {
        return res.status(400).json({ success: false, error: "Not a segmented recording" });
      }

      // Fetch manifest from S3
      const manifestUrl = await s3Service.getPresignedDownloadUrl(file.s3Key, 300);
      const resp = await fetch(manifestUrl);
      if (!resp.ok) {
        return res.status(502).json({ success: false, error: "Failed to fetch manifest" });
      }
      const manifest = await resp.json() as {
        segments: Array<{ index: number; s3Key: string; size: number }>;
        segmentDurationSeconds: number;
        startedAt: string;
        stoppedAt: string;
      };

      // Presign every segment
      const segments = await Promise.all(
        manifest.segments.map(async (s) => ({
          index: s.index,
          size: s.size,
          url: await s3Service.getPresignedDownloadUrl(s.s3Key, 3600),
        }))
      );

      res.json({
        success: true,
        segmentDurationSeconds: manifest.segmentDurationSeconds,
        startedAt: manifest.startedAt,
        stoppedAt: manifest.stoppedAt,
        segments,
      });
    } catch (error) {
      console.error("[Webinar] Error fetching playlist:", error);
      res.status(500).json({ success: false, error: "Failed to fetch playlist" });
    }
  }
);

/**
 * PATCH /webinar/:workshopId/recordings/:recordingId
 * Update display title / description for a webinar recording. The S3 key
 * and the underlying OrganizationFile.name are NOT changed — we only set
 * `metadata.displayTitle` / `metadata.displayDescription` /
 * `metadata.displayThumbnail` so Learn → Live Streams can render
 * founder-curated names + cover images per recording without affecting
 * the workshop's own title.
 *
 * Only the recording owner or an org founder/admin may update.
 *
 * Body: { displayTitle?: string, displayDescription?: string, displayThumbnail?: string }
 *   - Pass an empty string to clear a field (the override is removed).
 *   - displayThumbnail is the URL of an already-uploaded image (use the
 *     /upload endpoint or s3 helper to get a URL first).
 */
router.patch(
  "/:workshopId/recordings/:recordingId",
  requireAuth,
  async (req, res) => {
    try {
      const { workshopId, recordingId } = req.params;
      const me = (req as any).user as { userId: string };
      const { displayTitle, displayDescription, displayThumbnail } =
        req.body || {};

      if (!Types.ObjectId.isValid(recordingId)) {
        return res.status(400).json({ success: false, error: "Invalid recording ID" });
      }
      if (
        typeof displayTitle === "undefined" &&
        typeof displayDescription === "undefined" &&
        typeof displayThumbnail === "undefined"
      ) {
        return res.status(400).json({
          success: false,
          error: "displayTitle, displayDescription, or displayThumbnail required",
        });
      }
      if (
        typeof displayTitle !== "undefined" &&
        (typeof displayTitle !== "string" || displayTitle.length > 200)
      ) {
        return res.status(400).json({
          success: false,
          error: "displayTitle must be a string (max 200 chars)",
        });
      }
      if (
        typeof displayDescription !== "undefined" &&
        (typeof displayDescription !== "string" || displayDescription.length > 2000)
      ) {
        return res.status(400).json({
          success: false,
          error: "displayDescription must be a string (max 2000 chars)",
        });
      }
      if (
        typeof displayThumbnail !== "undefined" &&
        (typeof displayThumbnail !== "string" || displayThumbnail.length > 2048)
      ) {
        return res.status(400).json({
          success: false,
          error: "displayThumbnail must be a URL string (max 2048 chars)",
        });
      }

      const file = await OrganizationFile.findById(recordingId);
      if (!file) {
        return res.status(404).json({ success: false, error: "Recording not found" });
      }

      const fileWorkshopId = (file.metadata as any)?.workshopId;
      if (fileWorkshopId && String(fileWorkshopId) !== String(workshopId)) {
        return res.status(400).json({
          success: false,
          error: "Recording does not belong to this workshop",
        });
      }

      // Permission: owner OR founder/admin of the file's org.
      // Mirrors the DELETE handler below.
      let allowed = String(file.owner) === String(me.userId);
      if (!allowed) {
        const user = await User.findById(me.userId)
          .select("role organization organizations")
          .lean();
        if (user) {
          const fileOrgId = String(file.organization);
          if (
            user.organization?.toString() === fileOrgId &&
            ["admin", "founder"].includes(user.role || "")
          ) {
            allowed = true;
          }
          if (!allowed && user.organizations) {
            const membership = user.organizations.find(
              (m: any) => m.organization.toString() === fileOrgId
            );
            if (membership && hasFounderAccess(membership)) {
              allowed = true;
            }
          }
        }
      }
      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to edit this recording",
        });
      }

      const meta = (file.metadata as any) || {};
      if (typeof displayTitle === "string") {
        const trimmed = displayTitle.trim();
        if (trimmed) meta.displayTitle = trimmed;
        else delete meta.displayTitle;
      }
      if (typeof displayDescription === "string") {
        // Description preserves user line breaks but strips outer whitespace.
        const trimmed = displayDescription.trim();
        if (trimmed) meta.displayDescription = trimmed;
        else delete meta.displayDescription;
      }
      if (typeof displayThumbnail === "string") {
        const trimmed = displayThumbnail.trim();
        if (trimmed) meta.displayThumbnail = trimmed;
        else delete meta.displayThumbnail;
      }
      file.metadata = meta;
      file.markModified("metadata");
      await file.save();

      res.json({
        success: true,
        recording: {
          _id: String(file._id),
          displayTitle: meta.displayTitle || "",
          displayDescription: meta.displayDescription || "",
          displayThumbnail: meta.displayThumbnail || "",
        },
      });
    } catch (err: any) {
      console.error("[Webinar] PATCH recording error:", err?.message || err);
      res.status(500).json({ success: false, error: "Failed to update recording" });
    }
  }
);

/**
 * DELETE /webinar/:workshopId/recordings/:recordingId
 * Permanently delete a webinar recording (S3 object + DB row).
 * Only the recording owner or an org founder/admin may delete.
 */
router.delete(
  "/:workshopId/recordings/:recordingId",
  requireAuth,
  async (req, res) => {
    try {
      const { workshopId, recordingId } = req.params;
      const me = (req as any).user as { userId: string };

      if (!Types.ObjectId.isValid(recordingId)) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid recording ID" });
      }

      const file = await OrganizationFile.findById(recordingId);
      if (!file) {
        return res
          .status(404)
          .json({ success: false, error: "Recording not found" });
      }

      // Verify the recording actually belongs to the stated workshop
      const fileWorkshopId = (file.metadata as any)?.workshopId;
      if (fileWorkshopId && String(fileWorkshopId) !== String(workshopId)) {
        return res.status(400).json({
          success: false,
          error: "Recording does not belong to this workshop",
        });
      }

      // Permission: owner OR founder/admin of the file's org
      let allowed = String(file.owner) === String(me.userId);
      if (!allowed) {
        const user = await User.findById(me.userId)
          .select("role organization organizations")
          .lean();
        if (user) {
          const fileOrgId = String(file.organization);
          if (
            user.organization?.toString() === fileOrgId &&
            ["admin", "founder"].includes(user.role || "")
          ) {
            allowed = true;
          }
          if (!allowed && user.organizations) {
            const membership = user.organizations.find(
              (m: any) => m.organization.toString() === fileOrgId
            );
            if (membership && hasFounderAccess(membership)) {
              allowed = true;
            }
          }
        }
      }

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: "Not authorized to delete this recording",
        });
      }

      // If segmented manifest, remove all underlying segment objects too.
      try {
        if (file.mimeType === "application/x-webinar-manifest") {
          const manifestUrl = await s3Service.getPresignedDownloadUrl(
            file.s3Key,
            300
          );
          const resp = await fetch(manifestUrl);
          if (resp.ok) {
            const manifest = (await resp.json()) as {
              segments?: Array<{ s3Key: string }>;
            };
            await Promise.all(
              (manifest.segments || []).map((s) =>
                s3Service.deleteFile(s.s3Key).catch(() => null)
              )
            );
          }
        }
      } catch (err) {
        console.warn("[Webinar] segment cleanup failed:", err);
      }

      try {
        await s3Service.deleteFile(file.s3Key);
      } catch (err) {
        console.warn("[Webinar] S3 delete failed (continuing):", err);
      }

      await OrganizationFile.findByIdAndDelete(recordingId);

      res.json({ success: true, message: "Recording deleted" });
    } catch (error) {
      console.error("[Webinar] Error deleting recording:", error);
      res
        .status(500)
        .json({ success: false, error: "Failed to delete recording" });
    }
  }
);

/**
 * GET /webinar/:workshopId/analytics
 *
 * The host's post-webinar report: who attended, who bought what, who verified
 * a phone number to buy, and the chat.
 *
 * Host-only. This exposes attendee emails and purchase history, which is the
 * founder's own audience data but nobody else's business.
 *
 * `?sessionDate=YYYY-MM-DD` narrows to one session of a recurring workshop.
 * Omitted, it reports every session the workshop has ever run.
 *
 * A note on what these numbers can and cannot say: attendance is only
 * recorded from the day WebinarAttendance shipped. Sessions that ran before
 * that return an empty `attendees` array — not zero attendees, but no data.
 * `attendanceRecorded` says which of the two it is, so a caller never has to
 * guess whether an empty list means "nobody came" or "we weren't looking".
 */
router.get("/:workshopId/analytics", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const userId = (req as any).user.userId as string;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }
    if (!(await isWorkshopHost(userId, workshopId))) {
      return res
        .status(403)
        .json({ success: false, error: "Only the host can view this" });
    }

    const wsOid = new Types.ObjectId(workshopId);
    const sessionDateParam = (req.query.sessionDate as string) || "";
    const sessionFilter = /^\d{4}-\d{2}-\d{2}$/.test(sessionDateParam)
      ? new Date(`${sessionDateParam}T00:00:00.000Z`)
      : null;

    const { WebinarAttendance } = await import(
      "../models/webinarAttendance.model"
    );
    const { PhoneVerificationEvent } = await import(
      "../models/phoneVerificationEvent.model"
    );
    const { WebinarMessage } = await import("../models/webinarMessage.model");
    const { WebinarProductPin } = await import(
      "../models/webinarProductPin.model"
    );
    const { Invoice } = await import("../models/invoice.model");

    const attendanceQuery: any = { workshopId: wsOid };
    if (sessionFilter) attendanceQuery.sessionDate = sessionFilter;

    const [attendanceRows, verifications, messages, pins] = await Promise.all([
      WebinarAttendance.find(attendanceQuery)
        .sort({ firstJoinedAt: 1 })
        .limit(5000)
        .lean(),
      PhoneVerificationEvent.find({
        workshopId: wsOid,
        ...(sessionFilter ? { sessionDate: sessionFilter } : {}),
      })
        .sort({ verifiedAt: 1 })
        .limit(2000)
        .lean(),
      WebinarMessage.find({ workshopId: wsOid })
        .sort({ timestamp: 1 })
        .limit(5000)
        .lean(),
      WebinarProductPin.find({
        workshopId: wsOid,
        ...(sessionFilter ? { sessionDate: sessionFilter } : {}),
      })
        .sort({ firstPinnedAt: 1 })
        .lean(),
    ]);

    /**
     * Purchases credited to this webinar.
     *
     * Matched on the invoice line's `liveWorkshopId`, which the invoice
     * service only sets after checking the item really was pinned in that
     * session — so a buyer cannot credit a sale to a webinar it didn't come
     * from. `liveSessionDate` is a YYYY-MM-DD string on the line, not a Date.
     */
    const invoiceQuery: any = { "lineItems.liveWorkshopId": wsOid };
    if (sessionFilter) {
      invoiceQuery["lineItems.liveSessionDate"] = sessionDateParam;
    }
    const invoices = await Invoice.find(invoiceQuery)
      .sort({ createdAt: -1 })
      .limit(2000)
      .lean();

    const purchases: any[] = [];
    for (const inv of invoices as any[]) {
      for (const li of inv.lineItems || []) {
        if (!li.liveWorkshopId || String(li.liveWorkshopId) !== workshopId) continue;
        if (sessionFilter && li.liveSessionDate !== sessionDateParam) continue;
        purchases.push({
          invoiceId: String(inv._id),
          invoiceNumber: inv.invoiceNumber || null,
          // Draft means generated but not paid — counting it as revenue
          // would overstate the webinar.
          status: inv.status,
          paid: inv.status === "paid",
          buyerUserId: inv.userId ? String(inv.userId) : null,
          buyerEmail: inv.customerEmail || null,
          buyerName: inv.customerName || null,
          itemType: li.itemType || null,
          itemId: li.itemId ? String(li.itemId) : null,
          itemName: li.itemName || null,
          itemImage: li.itemImage || null,
          quantity: li.quantity ?? 1,
          /**
           * Line prices are stored in the currency's smallest unit
           * (paise/cents) — see IInvoiceLineItem.unitPrice. Reported in major
           * units so a ₹552 sale doesn't come back as 55200.
           */
          amount: (li.totalPrice ?? 0) / 100,
          amountMinor: li.totalPrice ?? 0,
          // Currency lives on the line, not the invoice: a multi-HQ invoice
          // can mix them, and the invoice document has no currency field.
          currency: li.originalCurrency || "USD",
          sessionDate: li.liveSessionDate || null,
          purchasedAt: inv.createdAt,
        });
      }
    }

    const attendees = attendanceRows.map((a: any) => ({
      userId: String(a.userId),
      name: a.name || null,
      email: a.email || null,
      role: a.role,
      sessionDate: a.sessionDate,
      firstJoinedAt: a.firstJoinedAt,
      lastLeftAt: a.lastLeftAt || null,
      totalSeconds: a.totalSeconds || 0,
      minutes: Math.round((a.totalSeconds || 0) / 60),
      joinCount: a.joinCount || 1,
    }));

    const paid = purchases.filter((p) => p.paid);

    res.json({
      success: true,
      workshopId,
      sessionDate: sessionDateParam || null,
      summary: {
        attendees: attendees.length,
        // Distinguishes "nobody came" from "we weren't recording yet".
        attendanceRecorded: attendees.length > 0,
        messages: messages.length,
        chatParticipants: new Set(messages.map((m: any) => String(m.userId))).size,
        phoneVerifications: verifications.length,
        comboWindowsStarted: verifications.filter(
          (v: any) => v.startedComboWindow
        ).length,
        productsPinned: pins.length,
        purchases: purchases.length,
        purchasesPaid: paid.length,
        /**
         * Keyed by currency rather than one total. A storefront can sell in
         * INR and USD in the same session, and adding those together would
         * produce a number that means nothing — there are no FX rates here
         * to convert with.
         */
        revenuePaid: paid.reduce<Record<string, number>>((acc, p) => {
          const cur = p.currency || "USD";
          acc[cur] = (acc[cur] || 0) + (Number(p.amount) || 0);
          return acc;
        }, {}),
      },
      attendees,
      purchases,
      phoneVerifications: verifications.map((v: any) => ({
        userId: String(v.userId),
        name: v.name || null,
        email: v.email || null,
        phone: v.phone,
        itemType: v.itemType || null,
        itemId: v.itemId || null,
        itemName: v.itemName || null,
        source: v.source,
        startedComboWindow: !!v.startedComboWindow,
        verifiedAt: v.verifiedAt,
      })),
      pinnedProducts: pins.map((p: any) => ({
        itemType: p.itemType,
        itemId: String(p.itemId),
        name: p.itemName || null,
        price: p.price ?? 0,
        currency: p.currency || "USD",
        firstPinnedAt: p.firstPinnedAt,
        lastPinnedAt: p.lastPinnedAt,
        pinCount: p.pinCount ?? 1,
      })),
      messages: messages.map((m: any) => ({
        id: String(m._id),
        userId: String(m.userId),
        name: m.userName,
        text: m.text,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error("[Webinar] Error building analytics:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to build analytics" });
  }
});

/** RFC-4180 escaping — a name with a comma must not shift every column. */
function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * GET /webinar/:workshopId/attendees.csv
 *
 * The attendee list as a download. Host-only, same rules as the analytics
 * route above.
 *
 * `?include=chat` appends people who only ever appeared in chat. They are
 * marked `source=chat` and carry no duration, because a chat message proves
 * presence but says nothing about how long anyone stayed. Kept opt-in so the
 * default export is one clean definition of "attended" rather than two
 * silently mixed together.
 */
router.get("/:workshopId/attendees.csv", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    const userId = (req as any).user.userId as string;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }
    if (!(await isWorkshopHost(userId, workshopId))) {
      return res
        .status(403)
        .json({ success: false, error: "Only the host can export this" });
    }

    const wsOid = new Types.ObjectId(workshopId);
    const sessionDateParam = (req.query.sessionDate as string) || "";
    const sessionFilter = /^\d{4}-\d{2}-\d{2}$/.test(sessionDateParam)
      ? new Date(`${sessionDateParam}T00:00:00.000Z`)
      : null;

    const { WebinarAttendance } = await import(
      "../models/webinarAttendance.model"
    );
    const rows = await WebinarAttendance.find({
      workshopId: wsOid,
      ...(sessionFilter ? { sessionDate: sessionFilter } : {}),
    })
      .sort({ firstJoinedAt: 1 })
      .limit(20000)
      .lean();

    const out: string[][] = [
      [
        "Name",
        "Email",
        "Role",
        "Session date",
        "First joined",
        "Last left",
        "Minutes",
        "Join count",
        "Source",
      ],
    ];

    const seen = new Set<string>();
    for (const a of rows as any[]) {
      seen.add(String(a.userId));
      out.push([
        a.name || "",
        a.email || "",
        a.role || "attendee",
        a.sessionDate ? new Date(a.sessionDate).toISOString().slice(0, 10) : "",
        a.firstJoinedAt ? new Date(a.firstJoinedAt).toISOString() : "",
        a.lastLeftAt ? new Date(a.lastLeftAt).toISOString() : "",
        String(Math.round((a.totalSeconds || 0) / 60)),
        String(a.joinCount ?? 1),
        "room",
      ]);
    }

    if (req.query.include === "chat") {
      const { WebinarMessage } = await import("../models/webinarMessage.model");
      const messages = await WebinarMessage.find({ workshopId: wsOid })
        .select("userId userName timestamp")
        .sort({ timestamp: 1 })
        .limit(5000)
        .lean();
      const firstSeen = new Map<string, any>();
      for (const m of messages as any[]) {
        const id = String(m.userId);
        if (seen.has(id) || firstSeen.has(id)) continue;
        firstSeen.set(id, m);
      }
      for (const [id, m] of firstSeen) {
        out.push([
          m.userName || "",
          "",
          "attendee",
          "",
          m.timestamp ? new Date(m.timestamp).toISOString() : "",
          "",
          "",
          "",
          "chat",
        ]);
        seen.add(id);
      }
    }

    const csv = out.map((r) => r.map(csvCell).join(",")).join("\r\n");
    const suffix = sessionDateParam ? `-${sessionDateParam}` : "";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendees-${workshopId}${suffix}.csv"`
    );
    // BOM so Excel opens UTF-8 names correctly rather than as mojibake.
    res.send("﻿" + csv);
  } catch (error) {
    console.error("[Webinar] Error exporting attendees:", error);
    res.status(500).json({ success: false, error: "Failed to export attendees" });
  }
});

/**
 * GET /webinar/:workshopId/messages
 *
 * The room's chat history, oldest first, for replaying alongside a
 * recording. Chat lives here (Mongo) rather than in the video: LiveKit's
 * composite egress only ever sees the participant grid, so the messages
 * have to be re-synced at playback time against `recordingStartedAt`.
 */
router.get("/:workshopId/messages", requireAuth, async (req, res) => {
  try {
    const { workshopId } = req.params;
    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshopId" });
    }

    const { WebinarMessage } = await import("../models/webinarMessage.model");
    const messages = await WebinarMessage.find({ workshopId })
      .sort({ timestamp: 1 })
      .limit(5000)
      .lean();

    res.json({
      success: true,
      messages: messages.map((m: any) => ({
        id: m._id.toString(),
        userId: String(m.userId),
        name: m.userName,
        text: m.text,
        replyTo: m.replyTo,
        attachments: m.attachments,
        reactions: m.reactions,
        mentions: m.mentions,
        timestamp: m.timestamp,
      })),
    });
  } catch (error) {
    console.error("[Webinar] Error fetching messages:", error);
    res.status(500).json({ success: false, error: "Failed to fetch messages" });
  }
});

/**
 * POST /webinar/chat/attach
 *
 * Hand back a presigned S3 PUT so the browser uploads chat files directly —
 * the bytes never touch this server. The client then sends only the
 * resulting metadata over the socket (`webinar:sendMessage`), where it is
 * re-validated before being stored.
 *
 * Deliberately permissive on MIME (people share PDFs, zips, docs) but hard
 * capped on size. `kind` is derived here so every client renders the same
 * way and a tampered client can't claim a .exe is an image.
 */
const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25 MB

router.post("/chat/attach", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const fileName = String(req.body?.fileName || "").slice(0, 255);
    const contentType = String(
      req.body?.contentType || "application/octet-stream",
    ).slice(0, 120);
    const fileSize = Number(req.body?.fileSize);

    if (!fileName) {
      return res.status(400).json({ error: "fileName is required" });
    }
    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return res.status(400).json({ error: "fileSize is required" });
    }
    if (fileSize > MAX_CHAT_ATTACHMENT_BYTES) {
      return res.status(400).json({ error: "File must be 25 MB or smaller" });
    }

    const kind: "image" | "audio" | "file" = /^image\//i.test(contentType)
      ? "image"
      : /^audio\//i.test(contentType)
        ? "audio"
        : "file";

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 10);
    const sanitized = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `webinar-chat/${me.userId}/${timestamp}_${randomId}_${sanitized}`;

    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      contentType,
      600, // 10-min window; the FE uploads immediately after receiving
    );
    const publicUrl = s3Service.getPublicUrl(s3Key);

    return res.json({
      uploadUrl,
      publicUrl,
      s3Key,
      kind,
      expiresIn: 600,
    });
  } catch (err: any) {
    console.error("[webinar] chat/attach error:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

export default router;
