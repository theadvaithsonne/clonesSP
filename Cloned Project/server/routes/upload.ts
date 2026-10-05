// src/routes/upload.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { s3Service } from "../services/s3";
import multer from "multer";

const router = Router();

// Configure multer for memory storage.
// Allow-list keeps untrusted /upload from becoming a generic blob host,
// but it used to silently reject anything an iPhone produced — HEIC/HEIF
// is the default capture format on iOS, and the 10MB cap killed any
// real video. Founders on iPhones uploading from the mobile app saw
// "No file provided or file type not allowed" because of one of those
// two cases. Both fixed here; log includes the rejected mimetype so
// future surprises are debuggable from prod logs.
const ALLOWED_MIMES = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  // video
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
  // audio
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  // documents
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
  "text/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // archives
  "application/zip",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
]);

// Mobile clients (Expo / React Native FormData) occasionally tag the
// part as `application/octet-stream` instead of the real mime, even
// when the extension is fine. Fall back to extension sniffing in that
// case so a known-good filename doesn't get rejected on a metadata
// quirk.
const ALLOWED_EXTS = new Set([
  "jpg", "jpeg", "png", "gif", "webp", "heic", "heif",
  "mp4", "mov", "webm", "mkv", "avi",
  "m4a", "mp3", "wav", "ogg", "aac",
  "pdf", "txt", "csv", "json", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "rar", "7z",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // 100MB — matches what a real phone-recorded video / photo burst
    // actually weighs. Cabinet uploads already allow 2GB; this generic
    // endpoint stays tighter because it's used for ad-hoc media, not
    // long recordings.
    fileSize: 100 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      return cb(null, true);
    }
    if (file.mimetype === "application/octet-stream") {
      const ext = (file.originalname.split(".").pop() || "").toLowerCase();
      if (ALLOWED_EXTS.has(ext)) {
        return cb(null, true);
      }
    }
    console.warn(
      `[upload] Rejected file ${file.originalname} (mimetype=${file.mimetype}) — not in allow-list`,
    );
    cb(null, false);
  },
});

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const me = (req as any).user as { userId: string; organizationId?: string };

    if (!req.file) {
      // The fileFilter logs the rejected mimetype above. Echo a similar
      // hint to the response so mobile error toasts can show the user
      // *why* their pick was rejected (oversize vs. bad type), not just
      // a generic failure.
      console.error(
        "[upload] req.file missing — rejected by fileFilter or oversize",
      );
      return res.status(400).json({
        error: "No file provided or file type not allowed",
        hint: "File must be under 100MB and one of: images (incl. HEIC), videos, audio, PDFs, Office docs, CSV, archives",
        allowedTypes: ["images", "videos", "audio", "documents", "archives"],
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;

    console.log(`Uploading file: ${originalname} (${mimetype}, ${size} bytes)`);

    // Generate file key
    const orgId = me.organizationId || "default";
    const userId = me.userId;
    const fileKey = s3Service.generateFileKey(userId, orgId, originalname);

    // Upload to S3
    await s3Service.uploadFile(fileKey, buffer, mimetype, {
      originalName: originalname,
      uploadedBy: userId,
      uploadedAt: new Date().toISOString(),
    });

    // Generate public URL (never expires)
    const fileUrl = s3Service.getPublicUrl(fileKey);

    console.log(`File uploaded successfully: ${fileKey}`);

    res.json({
      url: fileUrl,
      key: fileKey,
      fileName: originalname,
      fileSize: size,
      fileType: mimetype,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed", details: (error as Error).message });
  }
});

export default router;
