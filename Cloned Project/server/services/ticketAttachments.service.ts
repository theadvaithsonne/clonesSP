/**
 * S3 presign helpers for ticket attachments. Mirrors the cabinet/S3
 * service's auth but uses a dedicated `tickets/` key prefix so
 * lifecycle policies can be tuned independently.
 *
 * FE flow: client asks for a presigned PUT, uploads the file bytes
 * directly to S3, then sends only the resulting `key` in the
 * ticket / message payload. We never proxy the file bytes through
 * the API server.
 */
import crypto from "crypto";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../config/env";

const s3Client = new S3Client({
  region: env.AWS_S3_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.AWS_S3_BUCKET;

const ALLOWED_MIME = new Set<string>([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const PUT_TTL_SECONDS = 5 * 60;
const GET_TTL_SECONDS = 7 * 24 * 60 * 60;

const EXT_FOR_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export interface PresignTicketUploadInput {
  userId: string;
  mimeType: string;
  filename?: string;
  sizeBytes?: number;
}

export interface PresignTicketUploadOutput {
  key: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  uploadExpiresIn: number;
  publicUrl: string;
  publicUrlExpiresIn: number;
}

export class TicketUploadValidationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "TicketUploadValidationError";
    this.status = status;
  }
}

function validate(input: PresignTicketUploadInput): void {
  if (!input.userId) {
    throw new TicketUploadValidationError("userId required");
  }
  const mime = (input.mimeType || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    throw new TicketUploadValidationError(
      `mimeType '${input.mimeType}' not allowed; must be one of ${Array.from(
        ALLOWED_MIME,
      ).join(", ")}`,
    );
  }
  if (input.sizeBytes != null && input.sizeBytes > MAX_BYTES) {
    throw new TicketUploadValidationError(
      `file too large: ${input.sizeBytes} bytes (max ${MAX_BYTES})`,
      413,
    );
  }
}

function buildKey(input: PresignTicketUploadInput): string {
  const ext = EXT_FOR_MIME[input.mimeType.toLowerCase()] || "bin";
  const uuid = crypto.randomUUID();
  return `tickets/${input.userId}/${uuid}.${ext}`;
}

export async function presignTicketUpload(
  input: PresignTicketUploadInput,
): Promise<PresignTicketUploadOutput> {
  validate(input);
  const key = buildKey(input);
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: input.mimeType,
    }),
    { expiresIn: PUT_TTL_SECONDS },
  );
  const publicUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: GET_TTL_SECONDS },
  );
  return {
    key,
    uploadUrl,
    uploadHeaders: { "Content-Type": input.mimeType },
    uploadExpiresIn: PUT_TTL_SECONDS,
    publicUrl,
    publicUrlExpiresIn: GET_TTL_SECONDS,
  };
}

/** Re-sign a GET URL for an existing key, called on every list/detail
 *  read so the FE always has a fresh, non-expired URL. */
export async function presignTicketView(key: string): Promise<string> {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: GET_TTL_SECONDS },
  );
}
