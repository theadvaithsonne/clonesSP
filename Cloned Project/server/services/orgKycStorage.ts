/**
 * S3 access for office KYC documents.
 *
 * These files (PAN cards, government IDs, address proofs) are identity
 * documents, so they live in their OWN bucket — `AWS_S3_KYC_BUCKET`, which has
 * "Block all public access" enabled. Nothing in here ever produces a permanent
 * URL: uploads go straight from the browser to S3 with a 5-minute presigned
 * PUT, and every read is a fresh 10-minute presigned GET minted per request.
 *
 * Nothing else in the codebase may use this bucket, and this module never
 * touches `AWS_S3_BUCKET` — the general-purpose public bucket that uploads,
 * cabinet, recordings and ticket attachments all still use, unchanged.
 */
import crypto from "crypto";
import {
  DeleteObjectCommand,
  GetBucketCorsCommand,
  GetObjectCommand,
  PutBucketCorsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env";

// Same credentials/region as the main client, different bucket. The endpoint
// and path-style overrides are deliberately NOT copied: those exist for the
// MinIO/Spaces setups the public bucket may point at, and the KYC bucket is
// real AWS S3.
const kycS3Client = new S3Client({
  region: env.AWS_S3_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/** 5 minutes is plenty to start a PUT the browser already holds the bytes for. */
const PUT_TTL_SECONDS = 5 * 60;
/**
 * Read URLs are short-lived on purpose. The console re-mints them on every
 * load, so a leaked URL from a screenshot or a browser history entry stops
 * working within the hour rather than the week a ticket attachment gets.
 */
const GET_TTL_SECONDS = 10 * 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — a phone photo of a PAN card

const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

export class KycUploadValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "KycUploadValidationError";
    this.status = status;
  }
}

/**
 * Refuse to run at all when the bucket is unset rather than silently falling
 * back to the public bucket — a KYC document written to a world-readable
 * bucket is the one failure mode this whole module exists to prevent.
 */
function bucket(): string {
  if (!env.AWS_S3_KYC_BUCKET) {
    throw new KycUploadValidationError(
      "KYC storage is not configured (AWS_S3_KYC_BUCKET is unset)",
      503
    );
  }
  return env.AWS_S3_KYC_BUCKET;
}

export function isKycStorageConfigured(): boolean {
  return Boolean(env.AWS_S3_KYC_BUCKET);
}

export interface PresignKycUploadInput {
  orgId: string;
  requirementKey: string;
  mimeType: string;
  sizeBytes?: number;
}

export interface PresignKycUploadOutput {
  s3Key: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  uploadExpiresIn: number;
}

export async function presignKycUpload(
  input: PresignKycUploadInput
): Promise<PresignKycUploadOutput> {
  const mime = (input.mimeType || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new KycUploadValidationError(
      `File type '${input.mimeType || "unknown"}' is not accepted. Upload a PDF or an image.`
    );
  }
  if (input.sizeBytes != null && input.sizeBytes > MAX_BYTES) {
    throw new KycUploadValidationError(
      `File too large: ${input.sizeBytes} bytes (max ${MAX_BYTES})`,
      413
    );
  }

  const ext = EXT_FOR_MIME[mime] || "bin";
  const safeRequirement =
    String(input.requirementKey || "document").replace(/[^a-zA-Z0-9_-]/g, "-") ||
    "document";
  const s3Key = `org-kyc/${input.orgId}/${safeRequirement}/${crypto.randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    kycS3Client,
    new PutObjectCommand({
      Bucket: bucket(),
      Key: s3Key,
      ContentType: mime,
    }),
    { expiresIn: PUT_TTL_SECONDS }
  );

  return {
    s3Key,
    uploadUrl,
    uploadHeaders: { "Content-Type": mime },
    uploadExpiresIn: PUT_TTL_SECONDS,
  };
}

/** Fresh view URL for one stored document. Never cached, never persisted. */
export async function presignKycView(
  s3Key: string,
  filename?: string
): Promise<string> {
  return getSignedUrl(
    kycS3Client,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: s3Key,
      ResponseContentDisposition: filename
        ? `inline; filename="${filename.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "")}"`
        : "inline",
    }),
    { expiresIn: GET_TTL_SECONDS }
  );
}

export const KYC_VIEW_URL_TTL_SECONDS = GET_TTL_SECONDS;

/**
 * A brand-new S3 bucket has NO CORS configuration, and without one the
 * browser refuses the presigned PUT before it ever reaches S3 — the upload
 * fails with an opaque network error even though the URL and credentials are
 * perfectly good. (That is exactly how this bucket behaved on day one.)
 *
 * Mirrors S3Service.ensureCors for the public bucket: check first, only write
 * when there is nothing there, and never let a failure here take the boot
 * sequence down. "Block all public access" is unaffected — CORS governs which
 * origins a *browser* may call with, not who may read the objects.
 */
export async function ensureKycCors(): Promise<void> {
  if (!isKycStorageConfigured()) {
    console.warn("[orgKycStorage] AWS_S3_KYC_BUCKET unset — KYC uploads disabled");
    return;
  }
  try {
    await kycS3Client.send(new GetBucketCorsCommand({ Bucket: bucket() }));
    return; // Already configured — leave whatever is there alone.
  } catch (err: any) {
    if (err?.name !== "NoSuchCORSConfiguration") {
      console.warn("[orgKycStorage] could not check CORS:", err?.message);
      return;
    }
  }

  try {
    await kycS3Client.send(
      new PutBucketCorsCommand({
        Bucket: bucket(),
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["*"],
              // PUT for the upload, GET/HEAD so a presigned view URL can be
              // fetched by the browser. No DELETE: objects are only ever
              // removed server-side.
              AllowedMethods: ["PUT", "GET", "HEAD"],
              AllowedHeaders: ["*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 3600,
            },
          ],
        },
      })
    );
    console.log("[orgKycStorage] CORS configured on", bucket());
  } catch (err: any) {
    console.warn("[orgKycStorage] could not set CORS:", err?.message);
  }
}

/** Best-effort delete — used when a founder replaces or removes a document. */
export async function deleteKycObject(s3Key: string): Promise<void> {
  try {
    await kycS3Client.send(
      new DeleteObjectCommand({ Bucket: bucket(), Key: s3Key })
    );
  } catch (err) {
    console.warn("[orgKycStorage] delete failed for", s3Key, err);
  }
}
