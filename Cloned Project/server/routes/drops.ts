// src/routes/drops.ts
// Short-form video "Drops" API — Reels/Shorts-style content.
// Cursor-based pagination, batch signed URLs, presigned uploads.

import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { s3Service } from "../services/s3";
import { Drop } from "../models/drop.model";
import { User } from "../models/user.model";

const router = Router();


// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

// Helper to check if user is founder in an org
async function isUserFounder(
  userId: string,
  orgId: string
): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role organization organizations")
    .lean();
  if (!user) return false;

  // Legacy check
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return true;
  }

  // New multiple org check
  if (user.organizations) {
    const membership = user.organizations.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (membership && hasFounderAccess(membership)) {
      return true;
    }
  }

  return false;
}

// Helper to check if user is a guest (globally or within the specific org)
async function isUserGuest(
  userId: string,
  orgId: string
): Promise<boolean> {
  const user = await User.findById(userId)
    .select("role guest organization organizations")
    .lean();
  if (!user) return true;

  // 1. Check org membership specific to orgId first
  if (user.organizations && orgId) {
    const membership = user.organizations.find(
      (m: any) => m.organization && m.organization.toString() === orgId
    );
    if (membership) {
      if (hasFounderAccess(membership) || ["admin", "founder"].includes((membership.role as string) || "")) {
        return false;
      }
      if (membership.guest === true || (membership.role as string) === "guest") {
        return true;
      }
      if (membership.guest === false) {
        return false;
      }
    }
  }

  // 2. Check legacy single-org founder/admin status
  if (
    user.organization?.toString() === orgId &&
    ["admin", "founder"].includes(user.role || "")
  ) {
    return false;
  }

  // 3. Fallback to global user.guest status if no org-specific non-guest membership is matched
  if (user.guest === true) {
    return true;
  }

  return false;
}

// =====================================================================
// IMPORTANT: Specific-path routes MUST come BEFORE parametric /:id
// routes, otherwise Express will match "presigned-upload", "signed-url",
// etc. as an :id parameter and return 400.
// =====================================================================

// ============= Public Drop (no auth — for share/affiliate pages) =============

/**
 * GET /drops/public/:id
 * Public endpoint for shared drop links — no auth required.
 * Returns drop data + org info for the affiliate CTA page.
 */
router.get("/public/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: "Invalid drop ID" });
    }

    const drop = await Drop.findById(id)
      .populate("authorId", "name email profilePicture avatar")
      .lean();

    if (!drop || !drop.isActive) {
      return res.status(404).json({ success: false, error: "Drop not found" });
    }

    // Generate stream URL for uploads
    let streamUrl: string | null = null;
    if (drop.sourceType === "upload" && drop.videoS3Key) {
      try {
        streamUrl = await s3Service.getPresignedStreamUrl(
          drop.videoS3Key,
          4 * 3600,
          "video/mp4"
        );
      } catch {}
    } else {
      streamUrl = drop.videoUrl || null;
    }

    // Fetch org info for CTA
    const Organization = require("mongoose").model("Organization");
    let organization = null;
    try {
      organization = await Organization.findById(drop.orgId)
        .select("name slug icon coverPhoto description branding")
        .lean();
    } catch {}

    res.json({
      success: true,
      drop: { ...drop, streamUrl },
      organization,
    });
  } catch (error) {
    console.error("Error fetching public drop:", error);
    res.status(500).json({ success: false, error: "Failed to fetch drop" });
  }
});

// ============= Link Preview =============

/**
 * GET /drops/link-preview?url=...
 * Fetches oEmbed metadata for YouTube / Vimeo links.
 */
router.get("/link-preview", requireAuth, async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "url query parameter is required" });
    }

    const extractYouTubeId = (u: string): string | null => {
      const patterns = [
        /youtu\.be\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
      ];
      for (const p of patterns) {
        const m = u.match(p);
        if (m) return m[1];
      }
      return null;
    };

    const isVimeo = /vimeo\.com\/(\d+)/.test(url);
    const youtubeId = extractYouTubeId(url);

    if (youtubeId) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) {
        return res.json({ success: false, error: "Could not fetch video details" });
      }
      const data = await resp.json();
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

      // YouTube oEmbed doesn't return duration — scrape from the page HTML
      let duration = 0;
      try {
        const pageResp = await fetch(`https://www.youtube.com/watch?v=${youtubeId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          signal: AbortSignal.timeout(8000),
        });
        if (pageResp.ok) {
          const html = await pageResp.text();
          // Try to extract from JSON-LD or ytInitialPlayerResponse
          // Pattern 1: "lengthSeconds":"123"
          const lenMatch = html.match(/"lengthSeconds"\s*:\s*"(\d+)"/);
          if (lenMatch) {
            duration = parseInt(lenMatch[1], 10);
          }
          // Pattern 2: "approxDurationMs":"123456"
          if (!duration) {
            const approxMatch = html.match(/"approxDurationMs"\s*:\s*"(\d+)"/);
            if (approxMatch) {
              duration = Math.round(parseInt(approxMatch[1], 10) / 1000);
            }
          }
        }
      } catch (e: any) {
        console.warn("Could not scrape YouTube duration:", e.message);
      }

      return res.json({
        success: true,
        title: data.title || "",
        author: data.author_name || "",
        thumbnail,
        provider: "YouTube",
        duration,
      });
    }

    if (isVimeo) {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const resp = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) {
        return res.json({ success: false, error: "Could not fetch video details" });
      }
      const data = await resp.json();
      return res.json({
        success: true,
        title: data.title || "",
        author: data.author_name || "",
        thumbnail: data.thumbnail_url || "",
        provider: "Vimeo",
        duration: data.duration || 0,
      });
    }

    // Anything else: the player can only iframe-embed YouTube/Vimeo, or
    // play a direct video file in a <video> tag. Everything else (an
    // Instagram/TikTok/Facebook page URL) used to be accepted here as a
    // "Direct Link" with duration 0 — it saved fine and then silently
    // failed to play. Reject it at the door instead.
    const isDirectVideoFile = /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
    if (isDirectVideoFile) {
      return res.json({
        success: true,
        title: "",
        author: "",
        thumbnail: "",
        provider: "Direct Link",
        duration: 0, // unknown — the client probes it before submitting
      });
    }

    // Name the platform when we recognise it so the error is actionable.
    const UNSUPPORTED: [RegExp, string][] = [
      [/instagram\.com/i, "Instagram"],
      [/tiktok\.com/i, "TikTok"],
      [/facebook\.com|fb\.watch/i, "Facebook"],
      [/twitter\.com|x\.com/i, "X"],
      [/linkedin\.com/i, "LinkedIn"],
      [/drive\.google\.com/i, "Google Drive"],
      [/dropbox\.com/i, "Dropbox"],
    ];
    const known = UNSUPPORTED.find(([re]) => re.test(url));
    return res.json({
      success: false,
      error: known
        ? `${known[1]} links can't be embedded. Use a YouTube link (60 seconds or less), or upload the video file directly.`
        : "Unsupported link. Use a YouTube link (60 seconds or less), or upload the video file directly.",
    });
  } catch (error: any) {
    console.error("Drop link preview error:", error.message);
    return res.json({ success: false, error: "Could not verify this link" });
  }
});

// ============= Upload Endpoints (specific paths first) =============

/**
 * POST /drops/presigned-upload
 * Generate a presigned PUT URL for direct browser-to-S3 video upload.
 */
router.post("/presigned-upload", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string; orgId?: string };
    const orgId = (req.query.orgId as string) || me.orgId || me.organizationId;

    if (await isUserGuest(me.userId, orgId)) {
      return res.status(403).json({ error: "Guests are not allowed to upload drops" });
    }

    const { fileName, fileSize, contentType } = req.body;

    if (!fileName || !fileSize || !contentType) {
      return res.status(400).json({
        error: "fileName, fileSize, and contentType are required",
      });
    }

    if (!ALLOWED_VIDEO_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: `Unsupported video format. Allowed: ${ALLOWED_VIDEO_TYPES.join(", ")}`,
      });
    }

    // Generate S3 key under drops/ prefix
    const s3Key = s3Service.generateDropVideoKey(orgId, fileName);

    // Presigned upload URL (1 hour expiry)
    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      contentType,
      3600
    );

    res.json({ uploadUrl, s3Key, expiresIn: 3600 });
  } catch (error) {
    console.error("Error generating drop presigned upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /drops/signed-url?key=...
 * Generate a time-limited signed URL for video streaming/playback.
 * Used to refresh expired URLs on the frontend.
 */
router.get("/signed-url", requireAuth, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "S3 key is required" });
    }

    const exists = await s3Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({ error: "Video not found in storage" });
    }

    // 4-hour expiry for streaming
    const url = await s3Service.getPresignedStreamUrl(key, 4 * 3600, "video/mp4");
    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();

    res.json({ url, expiresAt });
  } catch (error) {
    console.error("Error generating drop signed URL:", error);
    res.status(500).json({ error: "Failed to generate streaming URL" });
  }
});

// ============= CRUD Endpoints =============

/**
 * GET /drops
 * Cursor-based infinite scroll feed. Returns drops with pre-signed stream URLs.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    const cursor = req.query.cursor as string | undefined;

    // Base filter — uses compound index feed_cursor_idx
    const filter: any = {
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      isPublished: true,
    };

    // Apply cursor for seek-based pagination
    if (cursor) {
      const separatorIdx = cursor.lastIndexOf("|");
      if (separatorIdx > 0) {
        const dateStr = cursor.substring(0, separatorIdx);
        const idStr = cursor.substring(separatorIdx + 1);
        const cursorDate = new Date(dateStr);
        const cursorId = new Types.ObjectId(idStr);
        filter.$or = [
          { createdAt: { $lt: cursorDate } },
          { createdAt: cursorDate, _id: { $lt: cursorId } },
        ];
      }
    }

    const drops = await Drop.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1) // Fetch one extra to detect hasMore
      .select(
        "caption authorId videoUrl videoS3Key sourceType duration " +
        "thumbnailUrl viewsCount likesCount sharesCount createdAt"
      )
      .populate("authorId", "name email profilePicture avatar")
      .lean();

    const hasMore = drops.length > limit;
    const page = hasMore ? drops.slice(0, limit) : drops;

    // Build next cursor from last item
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? `${(last.createdAt as Date).toISOString()}|${last._id}`
        : null;

    // ── Which of these has the caller already liked? ──
    // Without this the client can't restore liked state after a refresh,
    // which is what made re-liking double-count.
    const likedIds = new Set(
      (
        await Drop.find({
          _id: { $in: page.map((d: any) => d._id) },
          likedBy: new Types.ObjectId(me.userId),
        })
          .select("_id")
          .lean()
      ).map((d: any) => d._id.toString())
    );

    // ── Batch signed URL generation ──
    // Generate streaming URLs for S3 uploads in the same response
    // to eliminate N+1 frontend requests during scroll.
    const enriched = await Promise.all(
      page.map(async (drop: any) => {
        drop.likedByMe = likedIds.has(drop._id.toString());
        if (drop.sourceType === "upload" && drop.videoS3Key) {
          try {
            const streamUrl = await s3Service.getPresignedStreamUrl(
              drop.videoS3Key,
              4 * 3600,
              "video/mp4"
            );
            return {
              ...drop,
              streamUrl,
              streamUrlExpiresAt: Date.now() + 4 * 3600 * 1000,
            };
          } catch {
            return { ...drop, streamUrl: null, streamUrlExpiresAt: null };
          }
        }
        // For link-based drops, videoUrl is already the playable URL
        return {
          ...drop,
          streamUrl: drop.videoUrl || null,
          streamUrlExpiresAt: null,
        };
      })
    );

    res.json({
      success: true,
      drops: enriched,
      nextCursor,
      hasMore,
    });
  } catch (error) {
    console.error("Error fetching drops feed:", error);
    res.status(500).json({ error: "Failed to fetch drops" });
  }
});

/**
 * POST /drops
 * Create a new drop (any org member).
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string; orgId?: string };
    const orgId = (req.query.orgId as string) || me.orgId || me.organizationId;

    if (await isUserGuest(me.userId, orgId)) {
      return res.status(403).json({ error: "Guests are not allowed to create drops" });
    }

    const {
      caption,
      videoUrl,
      videoS3Key,
      sourceType,
      duration,
      thumbnailUrl,
    } = req.body;

    // Validate: at least one video source
    if (!videoUrl && !videoS3Key) {
      return res.status(400).json({
        error: "Either videoUrl or videoS3Key is required",
      });
    }

    // Validate duration (max 60 seconds)
    if (duration && duration > 60) {
      return res.status(400).json({
        error: "Drop duration cannot exceed 60 seconds",
      });
    }

    // Link drops must be something the player can actually render:
    // a YouTube/Vimeo embed or a direct video file. Mirrors the check in
    // /link-preview so a client can't skip verification and post a link
    // that saves fine but never plays.
    if (videoUrl && !videoS3Key) {
      const playable =
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/))[a-zA-Z0-9_-]{11}/.test(videoUrl) ||
        /vimeo\.com\/\d+/.test(videoUrl) ||
        /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(videoUrl);
      if (!playable) {
        return res.status(400).json({
          error:
            "Unsupported video link. Use a YouTube link (60 seconds or less), or upload the video file directly.",
        });
      }
    }

    const drop = await Drop.create({
      caption: (caption || "").trim().substring(0, 500),
      authorId: new Types.ObjectId(me.userId),
      orgId: new Types.ObjectId(orgId),
      videoUrl: videoUrl || undefined,
      videoS3Key: videoS3Key || undefined,
      sourceType: sourceType || (videoS3Key ? "upload" : "link"),
      duration: duration || 0,
      thumbnailUrl: thumbnailUrl || undefined,
      isPublished: true,
      isActive: true,
    });

    // Populate for response
    const populated = await Drop.findById(drop._id)
      .populate("authorId", "name email profilePicture avatar")
      .lean();

    // Generate stream URL if it's an upload
    let streamUrl = null;
    let streamUrlExpiresAt = null;
    if (populated && populated.sourceType === "upload" && populated.videoS3Key) {
      try {
        streamUrl = await s3Service.getPresignedStreamUrl(
          populated.videoS3Key,
          4 * 3600,
          "video/mp4"
        );
        streamUrlExpiresAt = Date.now() + 4 * 3600 * 1000;
      } catch {
        // Non-fatal
      }
    } else if (populated) {
      streamUrl = populated.videoUrl || null;
    }

    res.status(201).json({
      success: true,
      drop: { ...populated, streamUrl, streamUrlExpiresAt },
    });
  } catch (error) {
    console.error("Error creating drop:", error);
    res.status(500).json({ error: "Failed to create drop" });
  }
});

// ============= Engagement =============

/**
 * POST /drops/:id/view
 * Increment view count (fire-and-forget, frontend debounces).
 */
router.post("/:id/view", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid drop ID" });
    }

    // Atomic increment — no read needed
    await Drop.updateOne(
      { _id: new Types.ObjectId(id) },
      { $inc: { viewsCount: 1 } }
    );

    res.json({ success: true });
  } catch (error) {
    // View counting is non-critical — don't fail loudly
    res.json({ success: true });
  }
});

/**
 * POST /drops/:id/like
 * Toggle this user's like on a drop.
 *
 * Idempotent: the counter only moves when `likedBy` actually changes, so
 * re-liking an already-liked drop (e.g. after a refresh dropped the
 * client's in-memory liked state) is a no-op instead of another +1.
 * Returns the authoritative count so the client can reconcile rather
 * than trusting its optimistic update.
 */
router.post("/:id/like", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid drop ID" });
    }

    const me = (req as any).user.userId as string;
    const dropId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(me);
    const liked = req.body?.liked !== false; // default to "like"

    // Single atomic op: the membership guard in the filter is what makes
    // this idempotent. Liking an already-liked drop matches nothing, so
    // the counter can't move twice — no read-then-write race either.
    const result = liked
      ? await Drop.findOneAndUpdate(
          { _id: dropId, likedBy: { $ne: userId } },
          { $addToSet: { likedBy: userId }, $inc: { likesCount: 1 } },
          { new: true, projection: { likesCount: 1 } }
        ).lean()
      : await Drop.findOneAndUpdate(
          { _id: dropId, likedBy: userId },
          { $pull: { likedBy: userId }, $inc: { likesCount: -1 } },
          { new: true, projection: { likesCount: 1 } }
        ).lean();

    // No match = already in the requested state. Read the current count
    // so the client still gets an authoritative number to reconcile with.
    let likesCount: number;
    if (result) {
      likesCount = Math.max(0, (result as any).likesCount ?? 0);
    } else {
      const current = await Drop.findById(dropId).select("likesCount").lean();
      if (!current) return res.status(404).json({ error: "Drop not found" });
      likesCount = Math.max(0, (current as any).likesCount ?? 0);
    }

    res.json({ success: true, liked, likesCount });
  } catch (error) {
    console.error("Error toggling drop like:", error);
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

/**
 * POST /drops/:id/share
 * Increment share count.
 */
router.post("/:id/share", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid drop ID" });
    }

    await Drop.updateOne(
      { _id: new Types.ObjectId(id) },
      { $inc: { sharesCount: 1 } }
    );

    res.json({ success: true });
  } catch (error) {
    res.json({ success: true }); // Non-critical
  }
});

// ============= Parametric routes LAST =============

/**
 * GET /drops/:id
 * Get a single drop (for share links).
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid drop ID" });
    }

    const drop = await Drop.findById(id)
      .populate("authorId", "name email profilePicture avatar")
      .lean();

    if (!drop || !drop.isActive) {
      return res.status(404).json({ error: "Drop not found" });
    }

    // Generate stream URL
    let streamUrl = null;
    let streamUrlExpiresAt = null;
    if (drop.sourceType === "upload" && drop.videoS3Key) {
      try {
        streamUrl = await s3Service.getPresignedStreamUrl(
          drop.videoS3Key,
          4 * 3600,
          "video/mp4"
        );
        streamUrlExpiresAt = Date.now() + 4 * 3600 * 1000;
      } catch {
        // Non-fatal
      }
    } else {
      streamUrl = drop.videoUrl || null;
    }

    // So a shared-link view renders the heart in the right state.
    const likedByMe = !!(await Drop.exists({
      _id: drop._id,
      likedBy: new Types.ObjectId((req as any).user.userId),
    }));

    res.json({
      success: true,
      drop: { ...drop, streamUrl, streamUrlExpiresAt, likedByMe },
    });
  } catch (error) {
    console.error("Error fetching drop:", error);
    res.status(500).json({ error: "Failed to fetch drop" });
  }
});

/**
 * DELETE /drops/:id
 * Delete a drop. Author can delete their own; founders can delete any.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid drop ID" });
    }

    const drop = await Drop.findById(id).lean();
    if (!drop) {
      return res.status(404).json({ error: "Drop not found" });
    }

    // Check permissions: own drop OR founder
    const isOwner = drop.authorId.toString() === me.userId;
    const isFounder = await isUserFounder(me.userId, orgId);

    if (!isOwner && !isFounder) {
      return res.status(403).json({
        error: "You don't have permission to delete this drop",
      });
    }

    // Soft delete
    await Drop.updateOne(
      { _id: new Types.ObjectId(id) },
      { $set: { isActive: false } }
    );

    // Delete S3 file if it was an upload (fire-and-forget)
    if (drop.videoS3Key) {
      s3Service.deleteFile(drop.videoS3Key).catch((err) => {
        console.error("Error deleting drop S3 file:", err);
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting drop:", error);
    res.status(500).json({ error: "Failed to delete drop" });
  }
});

export default router;
