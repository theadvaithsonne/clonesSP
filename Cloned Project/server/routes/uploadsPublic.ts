// Public (unauthenticated) upload endpoint for the onboarding flow.
//
// The org-creation step needs to persist a logo BEFORE the user has an
// org, a JWT, or any server-side identity. The main /upload route
// requires requireAuth (it attributes the file to a user + org for
// billing / audit), so it can't serve this case. UploadThing was doing
// this in a stub'd-mock state — replaced by first-party S3 here so we
// own the storage + drop a third-party service token.
//
// Trade-offs baked into this route:
//   - No auth → open surface. Mitigated by tight MIME allow-list
//     (images only), 5 MB size cap, and a distinctive S3 prefix that
//     we can prune with a nightly sweep once we add one.
//   - Stored under `public-onboarding/YYYY-MM-DD/…` so orphans (users
//     who abandon onboarding) are easy to identify and delete later
//     without touching authenticated uploads.
//   - Returns the same shape as POST /upload so the FE swap is a
//     one-line change (url + key + fileName + fileSize + fileType).
import { Router } from "express";
import multer from "multer";
import { s3Service } from "../services/s3";

const router = Router();

// Images only. Onboarding logo + profile picture — no reason to
// accept video/audio/PDF from an unauthenticated caller. HEIC included
// because iOS default capture format is still HEIC.
const ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_EXTS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    // 5 MB is enough for a logo or profile pic. Small caps keep the
    // spam surface tolerable on an unauthenticated endpoint.
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) return cb(null, true);
    if (file.mimetype === "application/octet-stream") {
      const ext = (file.originalname.split(".").pop() || "").toLowerCase();
      if (ALLOWED_EXTS.has(ext)) return cb(null, true);
    }
    console.warn(
      `[uploadsPublic] Rejected file ${file.originalname} (mimetype=${file.mimetype})`
    );
    cb(null, false);
  },
});

// Path segment: YYYY-MM-DD in UTC. Groups orphans by day so a sweeper
// can delete everything older than N days with a single prefix scan.
function todayPathSegment(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildPublicKey(originalName: string): string {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 15);
  const safeName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
  return `public-onboarding/${todayPathSegment()}/${timestamp}_${randomId}_${safeName}`;
}

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file provided or file type not allowed",
        hint: "File must be an image (jpg, png, gif, webp, heic) under 5 MB",
      });
    }

    const { buffer, originalname, mimetype, size } = req.file;
    const fileKey = buildPublicKey(originalname);

    console.log(
      `[uploadsPublic] Uploading ${originalname} (${mimetype}, ${size} bytes) → ${fileKey}`
    );

    await s3Service.uploadFile(fileKey, buffer, mimetype, {
      originalName: originalname,
      // No user attribution — this endpoint is anonymous by design.
      uploadedVia: "public-onboarding",
      uploadedAt: new Date().toISOString(),
    });

    const fileUrl = s3Service.getPublicUrl(fileKey);

    return res.json({
      url: fileUrl,
      key: fileKey,
      fileName: originalname,
      fileSize: size,
      fileType: mimetype,
    });
  } catch (error) {
    console.error("[uploadsPublic] Upload error:", error);
    return res
      .status(500)
      .json({ error: "Upload failed", details: (error as Error).message });
  }
});

export default router;
