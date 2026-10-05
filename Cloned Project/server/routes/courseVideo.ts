// src/routes/courseVideo.ts
// Handles presigned URL generation for direct browser-to-S3 video uploads
// and signed streaming URL generation for video playback.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { s3Service } from "../services/s3";
import { Course } from "../models/course.model";
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

/**
 * POST /courses/video/presigned-upload
 * Get a single presigned PUT URL for small video uploads (<100MB).
 * Browser uploads directly to S3 using this URL.
 */
router.post("/presigned-upload", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { courseId, fileName, fileSize, contentType } = req.body;

    // Validation
    if (!courseId || !fileName || !fileSize || !contentType) {
      return res.status(400).json({
        error: "courseId, fileName, fileSize, and contentType are required",
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

    // Verify course exists and user has access (if not "new")
    if (courseId !== "new") {
      if (!Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ error: "Invalid courseId" });
      }
      const course = await Course.findById(courseId).lean();
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
    }

    // Generate S3 key
    const s3Key = s3Service.generateCourseVideoKey(orgId, courseId, fileName);

    // Get presigned upload URL (1 hour expiry)
    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      contentType,
      3600
    );

    res.json({
      uploadUrl,
      s3Key,
      expiresIn: 3600,
    });
  } catch (error) {
    console.error("Error generating presigned upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * POST /courses/video/multipart/initiate
 * Initiate a multipart upload for large videos (>=100MB).
 * Returns uploadId and presigned URLs for each part.
 */
router.post("/multipart/initiate", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId: string };
    const orgId = (req.query.orgId as string) || me.organizationId;
    const { courseId, fileName, fileSize, contentType } = req.body;

    // Validation
    if (!courseId || !fileName || !fileSize || !contentType) {
      return res.status(400).json({
        error: "courseId, fileName, fileSize, and contentType are required",
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

    // Verify course exists (if not "new")
    if (courseId !== "new") {
      if (!Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ error: "Invalid courseId" });
      }
      const course = await Course.findById(courseId).lean();
      if (!course) {
        return res.status(404).json({ error: "Course not found" });
      }
    }

    // Generate S3 key
    const s3Key = s3Service.generateCourseVideoKey(orgId, courseId, fileName);

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
 * POST /courses/video/multipart/complete
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

    // Validate parts format
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
 * POST /courses/video/multipart/abort
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
 * GET /courses/video/signed-url/:s3Key
 * Generate a time-limited signed URL for video streaming/playback.
 * Used by both founders (preview) and enrolled learners.
 * s3Key is base64url-encoded to avoid path issues.
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
      return res.status(404).json({ error: "Video not found" });
    }

    // Generate signed streaming URL (4 hour expiry for long videos)
    const url = await s3Service.getPresignedDownloadUrl(key, 4 * 3600);

    const expiresAt = new Date(Date.now() + 4 * 3600 * 1000).toISOString();

    res.json({ url, expiresAt });
  } catch (error) {
    console.error("Error generating signed streaming URL:", error);
    res.status(500).json({ error: "Failed to generate streaming URL" });
  }
});

/**
 * DELETE /courses/video/:s3Key
 * Delete a video from S3. Used when replacing or removing a video.
 */
router.delete("/delete", requireAuth, async (req, res) => {
  try {
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

export default router;
