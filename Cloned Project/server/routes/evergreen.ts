// Evergreen (pre-recorded, scheduled) webinar configuration — founder-facing.
//
// The HOST configures their own webinar here, so these routes use the same
// guard as the rest of workshop editing: requireAuth + isUserFounder(orgId).
// Playback itself is public and lives in publicWebinar.ts (/evergreen-state);
// nothing here is reachable without founder rights.
//
// Purely additive: none of this touches the live-webinar path. A workshop that
// never calls these keeps `evergreen.enabled === false` and behaves exactly as
// it does today. See docs/superpowers/specs/2026-09-07-evergreen-webinars-design.md
import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Workshop } from "../models/workshop.model";
import { isUserFounder } from "../services/review";
import { s3Service } from "../services/s3";
import { OrganizationFile } from "../models/cabinet.model";

const router = Router();

/** Founder-of-this-workshop guard, shared by every route below. */
async function loadOwnedWorkshop(req: Request, res: Response) {
  const me = (req as any).user as { userId: string };
  const { workshopId } = req.params;
  if (!Types.ObjectId.isValid(workshopId)) {
    res.status(400).json({ success: false, error: "Invalid workshop id" });
    return null;
  }
  const workshop: any = await Workshop.findById(workshopId);
  if (!workshop) {
    res.status(404).json({ success: false, error: "Workshop not found" });
    return null;
  }
  const isFounder = await isUserFounder(me.userId, String(workshop.orgId));
  if (!isFounder) {
    res.status(403).json({ success: false, error: "Only founders can configure this webinar" });
    return null;
  }
  return workshop;
}

// ── POST /evergreen/:workshopId/upload-url ────────────────────────────────
// Presigned S3 PUT so the browser uploads the recording directly. The file
// never passes through this server — a webinar recording is far too large to
// buffer through Node.
router.post("/:workshopId/upload-url", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const { contentType, fileName } = z
      .object({
        contentType: z.string().regex(/^video\//, "Only video uploads are allowed"),
        fileName: z.string().min(1).max(200),
      })
      .parse(req.body);

    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
    const key = `evergreen/${workshop._id}/${Date.now()}-${safe}`;
    const uploadUrl = await s3Service.getPresignedUploadUrl(key, contentType, 3600);

    return res.json({ success: true, uploadUrl, key });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[Evergreen] upload-url error:", error);
    return res.status(500).json({ success: false, error: "Failed to create upload URL" });
  }
});

// ── POST /evergreen/:workshopId/attach ────────────────────────────────────
// Records the finished upload. `durationSec` is required and must be > 0:
// the clock cannot decide when a session has ended without it, so a webinar
// is never left half-configured.
router.post("/:workshopId/attach", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const { key, durationSec } = z
      .object({
        key: z.string().min(1),
        durationSec: z.number().positive("durationSec must be greater than 0"),
      })
      .parse(req.body);

    // Store the KEY, never a presigned URL: presigned URLs expire (7 days max
    // on S3), so a URL baked into the document would silently stop playing.
    // /evergreen-state mints a fresh short-lived stream URL per request.
    workshop.evergreen = {
      ...(workshop.evergreen?.toObject?.() || workshop.evergreen || {}),
      source: "upload",
      videoS3Key: key,
      durationSec: Math.round(durationSec),
    };
    await workshop.save();

    return res.json({
      success: true,
      evergreen: { source: "upload", durationSec: Math.round(durationSec), hasVideo: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[Evergreen] attach error:", error);
    return res.status(500).json({ success: false, error: "Failed to attach video" });
  }
});

// ── PATCH /evergreen/:workshopId ──────────────────────────────────────────
// Toggle + settings. Enabling is guarded: without a video, a duration, and a
// resolvable schedule the webinar would go "live" and play nothing, so the API
// refuses rather than shipping a broken session.
router.patch("/:workshopId", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const body = z
      .object({
        enabled: z.boolean().optional(),
        joinWindowMin: z.number().min(0).nullable().optional(),
        loop: z.boolean().optional(),
        simulatedChat: z
          .array(
            z.object({
              atSec: z.number().min(0),
              name: z.string().min(1).max(80),
              message: z.string().min(1).max(500),
            })
          )
          .max(500)
          .optional(),
        simulatedViewers: z
          .object({ enabled: z.boolean(), peak: z.number().min(0).max(100000).optional() })
          .optional(),
      })
      .parse(req.body);

    const current = workshop.evergreen || {};

    if (body.enabled === true) {
      if ((!current.videoUrl && !current.videoS3Key) || !current.durationSec) {
        return res.status(400).json({
          success: false,
          error: "Add a video and its duration before enabling evergreen",
        });
      }
      // A recurrence with no `type` yields zero sessions (isSessionDate returns
      // false by default), so the webinar would never run. Caught here rather
      // than leaving the host with a silently dead schedule.
      if (workshop.isRecurring && !workshop.recurrencePattern?.type) {
        return res.status(400).json({
          success: false,
          error: "This webinar's recurrence has no type (daily/weekly/monthly) — fix the schedule first",
        });
      }
    }

    workshop.evergreen = {
      ...(current.toObject?.() || current),
      ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
      ...(body.joinWindowMin !== undefined ? { joinWindowMin: body.joinWindowMin } : {}),
      ...(body.loop !== undefined ? { loop: body.loop } : {}),
      ...(body.simulatedChat
        ? { simulatedChat: [...body.simulatedChat].sort((a, b) => a.atSec - b.atSec) }
        : {}),
      ...(body.simulatedViewers ? { simulatedViewers: body.simulatedViewers } : {}),
    };
    await workshop.save();

    return res.json({ success: true, evergreen: workshop.evergreen });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[Evergreen] patch error:", error);
    return res.status(500).json({ success: false, error: "Failed to update evergreen settings" });
  }
});

// ── GET /evergreen/:workshopId ────────────────────────────────────────────
// Current config for the admin editor (never the public clock).
router.get("/:workshopId", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;
    return res.json({ success: true, evergreen: workshop.evergreen || { enabled: false } });
  } catch (error) {
    console.error("[Evergreen] get error:", error);
    return res.status(500).json({ success: false, error: "Failed to load evergreen settings" });
  }
});

// ── GET /evergreen/:workshopId/recordings ─────────────────────────────────
// Past LiveKit recordings OF THIS WEBINAR, so a founder who already ran it
// live can replay that session instead of uploading a file.
//
// Deliberately a pull, not a push: the egress_ended webhook keeps writing
// OrganizationFiles exactly as before and never touches `evergreen`. A live
// webinar that happens to be recorded can therefore never silently turn
// itself into an evergreen one — the founder picks.
router.get("/:workshopId/recordings", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const files = await OrganizationFile.find({
      organization: workshop.orgId,
      "metadata.workshopId": String(workshop._id),
      status: "ready",
      mimeType: /^video\//,
    })
      .select("_id name s3Key size createdAt")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    // A short-lived stream URL per row: the browser reads the duration off it
    // before attaching, the same way it does for a local upload. Egress does
    // not record a duration we can trust the units of.
    const recordings = await Promise.all(
      files.map(async (f: any) => ({
        id: String(f._id),
        name: f.name,
        size: f.size || 0,
        createdAt: f.createdAt,
        probeUrl: await s3Service
          .getPresignedStreamUrl(f.s3Key, 60 * 30)
          .catch(() => undefined),
      }))
    );

    return res.json({ success: true, recordings: recordings.filter((r) => r.probeUrl) });
  } catch (error) {
    console.error("[Evergreen] recordings error:", error);
    return res.status(500).json({ success: false, error: "Failed to load recordings" });
  }
});

// ── POST /evergreen/:workshopId/use-recording ─────────────────────────────
// Adopt one of the above as the evergreen video. Stores the KEY, for the same
// expiry reason as /attach.
router.post("/:workshopId/use-recording", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const { fileId, durationSec } = z
      .object({
        fileId: z.string().refine((v) => Types.ObjectId.isValid(v), "Invalid file id"),
        durationSec: z.number().positive("durationSec must be greater than 0"),
      })
      .parse(req.body);

    // Re-check ownership from the file itself — a fileId from the client is
    // untrusted, and this must not become a way to read another org's S3 keys.
    const file: any = await OrganizationFile.findOne({
      _id: fileId,
      organization: workshop.orgId,
      "metadata.workshopId": String(workshop._id),
    })
      .select("s3Key")
      .lean();
    if (!file?.s3Key) {
      return res.status(404).json({ success: false, error: "Recording not found" });
    }

    workshop.evergreen = {
      ...(workshop.evergreen?.toObject?.() || workshop.evergreen || {}),
      source: "recording",
      videoS3Key: file.s3Key,
      durationSec: Math.round(durationSec),
    };
    await workshop.save();

    return res.json({
      success: true,
      evergreen: { source: "recording", durationSec: Math.round(durationSec), hasVideo: true },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: "Invalid request", issues: error.issues });
    }
    console.error("[Evergreen] use-recording error:", error);
    return res.status(500).json({ success: false, error: "Failed to attach recording" });
  }
});

// ── GET /evergreen/:workshopId/preview ────────────────────────────────────
// Play the configured video right now, ignoring the schedule.
//
// Without this a host can only watch their own evergreen webinar during the
// real window — which is only as long as the video (a 2:19 video on a daily
// slot is live for 139 seconds a day). That made the feature effectively
// untestable. Founder-guarded and read-only: it mints the same short-lived
// stream URL the public clock does, and changes nothing.
router.get("/:workshopId/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const workshop = await loadOwnedWorkshop(req, res);
    if (!workshop) return;

    const eg = workshop.evergreen;
    if (!eg?.durationSec || (!eg.videoUrl && !eg.videoS3Key)) {
      return res.status(400).json({ success: false, error: "No video configured yet" });
    }

    const videoUrl = eg.videoS3Key
      ? await s3Service.getPresignedStreamUrl(eg.videoS3Key, 60 * 60)
      : eg.videoUrl;

    return res.json({
      success: true,
      videoUrl,
      durationSec: eg.durationSec,
      simulatedChat: eg.simulatedChat || [],
    });
  } catch (error) {
    console.error("[Evergreen] preview error:", error);
    return res.status(500).json({ success: false, error: "Failed to build preview" });
  }
});

export default router;
