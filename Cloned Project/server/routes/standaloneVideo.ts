// src/routes/standaloneVideo.ts
// Handles CRUD for standalone videos (not tied to courses) and
// presigned URL generation for direct browser-to-S3 video uploads.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { s3Service } from "../services/s3";
import { StandaloneVideo } from "../models/standaloneVideo.model";
import { User } from "../models/user.model";
import { Types } from "mongoose";

const router = Router();

// Max 5GB per video
const MAX_VIDEO_SIZE = 5 * 1024 * 1024 * 1024;
// Multipart part size: 50MB
const PART_SIZE = 50 * 1024 * 1024;
// Allowed video MIME types
const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
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

// =====================================================================
// IMPORTANT: Specific-path routes MUST come BEFORE parametric /:id
// routes, otherwise Express will match "signed-url", "presigned-upload",
// etc. as an :id parameter and return 400 "Invalid video ID".
// =====================================================================

// ============= Link Preview Endpoint =============

/**
 * GET /standalone-videos/link-preview?url=...
 * Fetches oEmbed metadata (title, thumbnail, author, duration, provider)
 * for YouTube / Vimeo links in a single server-side call. Returns enough
 * information for the frontend to render a preview card and auto-fill fields.
 */
router.get("/link-preview", requireAuth, async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: "url query parameter is required" });
    }

    // Helper to extract a YouTube video ID from common URL patterns
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
      // YouTube oEmbed (no API key needed)
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const resp = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        return res.json({
          success: false,
          error: "Could not fetch video details",
        });
      }
      const data = await resp.json();
      // Use hqdefault for better quality thumbnail
      const thumbnail = `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
      return res.json({
        success: true,
        title: data.title || "",
        author: data.author_name || "",
        thumbnail,
        provider: "YouTube",
        duration: 0, // YouTube oEmbed doesn't include duration
      });
    }

    if (isVimeo) {
      const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
      const resp = await fetch(oembedUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) {
        return res.json({
          success: false,
          error: "Could not fetch video details",
        });
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

    // Unknown provider — not an error, just no metadata available
    return res.json({
      success: true,
      title: "",
      author: "",
      thumbnail: "",
      provider: "Direct Link",
      duration: 0,
    });
  } catch (error: any) {
    // Timeout or network errors shouldn't crash — return gracefully
    console.error("Link preview error:", error.message);
    return res.json({
      success: false,
      error: "Could not verify this link",
    });
  }
});

// ============= Upload Endpoints (specific paths first) =============

/**
 * POST /standalone-videos/presigned-upload
 * Get a single presigned PUT URL for small video uploads (<100MB).
 */
router.post("/presigned-upload", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can upload videos" });
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

    if (fileSize > MAX_VIDEO_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024 * 1024)}GB`,
      });
    }

    // Generate S3 key
    const s3Key = s3Service.generateStandaloneVideoKey(orgId, fileName);

    // Get presigned upload URL (1 hour expiry)
    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      contentType,
      3600
    );

    res.json({ uploadUrl, s3Key, expiresIn: 3600 });
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /standalone-videos/multipart/initiate
 * Initiate a multipart upload for large videos (>=100MB).
 */
router.post("/multipart/initiate", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can upload videos" });
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

    if (fileSize > MAX_VIDEO_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum size is ${MAX_VIDEO_SIZE / (1024 * 1024 * 1024)}GB`,
      });
    }

    // Generate S3 key
    const s3Key = s3Service.generateStandaloneVideoKey(orgId, fileName);

    // Calculate number of parts
    const totalParts = Math.ceil(fileSize / PART_SIZE);

    // Initiate multipart upload
    const { uploadId } = await s3Service.initiateMultipartUpload(
      s3Key,
      contentType
    );

    // Generate presigned URLs for all parts
    const partUrls = await s3Service.getMultipartPresignedUrls(
      s3Key,
      uploadId,
      totalParts,
      3600
    );

    res.json({
      uploadId,
      s3Key,
      partSize: PART_SIZE,
      totalParts,
      partUrls,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error initiating multipart upload:", error);
    res.status(500).json({ error: "Failed to initiate multipart upload" });
  }
});

/**
 * POST /standalone-videos/multipart/complete
 * Complete a multipart upload after all parts have been uploaded.
 */
router.post("/multipart/complete", requireAuth, async (req, res) => {
  try {
    const { s3Key, uploadId, parts } = req.body;

    if (!s3Key || !uploadId || !parts || !Array.isArray(parts)) {
      return res.status(400).json({
        error: "s3Key, uploadId, and parts array are required",
      });
    }

    for (const part of parts) {
      if (!part.partNumber || !part.etag) {
        return res.status(400).json({
          error: "Each part must have partNumber and etag",
        });
      }
    }

    await s3Service.completeMultipartUpload(s3Key, uploadId, parts);

    res.json({ success: true, s3Key });
  } catch (error) {
    console.error("Error completing multipart upload:", error);
    res.status(500).json({ error: "Failed to complete multipart upload" });
  }
});

/**
 * POST /standalone-videos/multipart/abort
 * Abort a multipart upload and clean up uploaded parts.
 */
router.post("/multipart/abort", requireAuth, async (req, res) => {
  try {
    const { s3Key, uploadId } = req.body;

    if (!s3Key || !uploadId) {
      return res.status(400).json({
        error: "s3Key and uploadId are required",
      });
    }

    await s3Service.abortMultipartUpload(s3Key, uploadId);

    res.json({ success: true });
  } catch (error) {
    console.error("Error aborting multipart upload:", error);
    res.status(500).json({ error: "Failed to abort multipart upload" });
  }
});

/**
 * GET /standalone-videos/signed-url
 * Generate a time-limited signed URL for video streaming/playback.
 */
router.get("/signed-url", requireAuth, async (req, res) => {
  try {
    const { key } = req.query;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "S3 key is required" });
    }

    // Verify the file exists
    const exists = await s3Service.fileExists(key);
    if (!exists) {
      return res.status(404).json({ error: "Video not found in storage" });
    }

    // Generate signed streaming URL (4 hour expiry)
    const url = await s3Service.getPresignedDownloadUrl(key, 4 * 3600);
    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();

    res.json({ url, expiresAt });
  } catch (error) {
    console.error("Error generating signed streaming URL:", error);
    res.status(500).json({ error: "Failed to generate streaming URL" });
  }
});

/**
 * DELETE /standalone-videos/video/delete
 * Delete a video file from S3 (used when replacing a video).
 */
router.delete("/video/delete", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can delete videos" });
    }

    const { key } = req.query;

    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "S3 key is required" });
    }

    await s3Service.deleteFile(key);

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

// ============= CRUD Endpoints (parametric /:id routes LAST) =============

/**
 * POST /standalone-videos
 * Create a new standalone video record (founder only).
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can upload videos" });
    }

    const { title, description, thumbnail, videoUrl, videoS3Key, sourceType, duration } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Title is required" });
    }

    const video = await StandaloneVideo.create({
      title: title.trim(),
      description: description?.trim(),
      thumbnail,
      videoUrl,
      videoS3Key,
      sourceType: sourceType || (videoS3Key ? "upload" : "link"),
      duration: duration || 0,
      orgId: new Types.ObjectId(orgId),
      createdBy: new Types.ObjectId(me.userId),
      isPublished: true,
    });

    // Populate creator info for response
    const populated = await StandaloneVideo.findById(video._id)
      .populate("createdBy", "name email avatar profilePicture")
      .lean();

    res.status(201).json({ success: true, video: populated });
  } catch (error) {
    console.error("Error creating standalone video:", error);
    res.status(500).json({ error: "Failed to create video" });
  }
});

/**
 * GET /standalone-videos
 * List standalone videos for the org (visible to all members).
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const isFounder = await isUserFounder(me.userId, orgId);

    // Founders see all; learners see only published
    const filter: any = { orgId: new Types.ObjectId(orgId) };
    if (!isFounder) {
      filter.isPublished = true;
    }

    const [videos, total] = await Promise.all([
      StandaloneVideo.find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("createdBy", "name email avatar profilePicture")
        .lean(),
      StandaloneVideo.countDocuments(filter),
    ]);

    res.json({ success: true, videos, total, isFounder });
  } catch (error) {
    console.error("Error fetching standalone videos:", error);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

/**
 * GET /standalone-videos/:id
 * Get a single standalone video.
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const video = await StandaloneVideo.findById(id)
      .populate("createdBy", "name email avatar profilePicture")
      .lean();

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ success: true, video });
  } catch (error) {
    console.error("Error fetching standalone video:", error);
    res.status(500).json({ error: "Failed to fetch video" });
  }
});

/**
 * PUT /standalone-videos/:id
 * Update a standalone video (founder only).
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { id } = req.params;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can update videos" });
    }

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const { title, description, thumbnail, videoUrl, videoS3Key, sourceType, duration, isPublished } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (thumbnail !== undefined) updateData.thumbnail = thumbnail;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (videoS3Key !== undefined) updateData.videoS3Key = videoS3Key;
    if (sourceType !== undefined) updateData.sourceType = sourceType;
    if (duration !== undefined) updateData.duration = duration;
    if (isPublished !== undefined) updateData.isPublished = isPublished;

    const video = await StandaloneVideo.findOneAndUpdate(
      { _id: new Types.ObjectId(id), orgId: new Types.ObjectId(orgId) },
      { $set: updateData },
      { new: true }
    )
      .populate("createdBy", "name email avatar profilePicture")
      .lean();

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ success: true, video });
  } catch (error) {
    console.error("Error updating standalone video:", error);
    res.status(500).json({ error: "Failed to update video" });
  }
});

/**
 * DELETE /standalone-videos/:id
 * Delete a standalone video and its S3 file (founder only).
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { id } = req.params;

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({ error: "Only founders can delete videos" });
    }

    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid video ID" });
    }

    const video = await StandaloneVideo.findOneAndDelete({
      _id: new Types.ObjectId(id),
      orgId: new Types.ObjectId(orgId),
    }).lean();

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Delete S3 file if it was an upload
    if (video.videoS3Key) {
      await s3Service.deleteFile(video.videoS3Key).catch((err) => {
        console.error("Error deleting S3 file:", err);
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting standalone video:", error);
    res.status(500).json({ error: "Failed to delete video" });
  }
});

export default router;
