import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetBucketCorsCommand,
  PutBucketCorsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Upload } from "@aws-sdk/lib-storage";
import type { Readable } from "stream";
import { env } from "../config/env";
import { buildContentDisposition } from "../utils/fileNaming";

/**
 * AWS S3 user-defined metadata is sent as `x-amz-meta-*` HTTP headers, which
 * RFC 7230 limits to printable ASCII (\x20-\x7E). When a value contains
 * non-ASCII characters (e.g. a smart quote, narrow no-break space U+202F in
 * filenames from macOS screenshots), the SDK signs the request using the raw
 * byte string but the actual HTTP serialization differs, producing
 * `SignatureDoesNotMatch`. We strip non-printable / non-ASCII bytes here and
 * also trim CR/LF/tab so a stray newline can't break the header.
 *
 * Empty/falsy values are dropped entirely (S3 rejects empty metadata).
 */
function sanitizeS3Metadata(
  metadata?: Record<string, string>
): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (typeof v !== "string") continue;
    // Replace any character outside printable ASCII with `_`.
    const cleaned = v.replace(/[^\x20-\x7E]/g, "_").replace(/[\r\n\t]+/g, " ").trim();
    if (cleaned) out[k] = cleaned;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

// Initialize S3 client
// requestChecksumCalculation: "WHEN_REQUIRED" prevents the SDK from adding
// x-amz-checksum-* headers to presigned URLs, which browsers cannot easily
// set and which cause CORS preflight failures.
const s3Client = new S3Client({
  region: env.AWS_S3_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  endpoint: env.AWS_S3_ENDPOINT || undefined,
  forcePathStyle: env.AWS_S3_FORCE_PATH_STYLE,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export class S3Service {
  private static instance: S3Service;
  private bucket: string;

  private constructor() {
    this.bucket = env.AWS_S3_BUCKET;
  }

  public static getInstance(): S3Service {
    if (!S3Service.instance) {
      S3Service.instance = new S3Service();
    }
    return S3Service.instance;
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    key: string,
    body: Buffer | Uint8Array | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: sanitizeS3Metadata(metadata),
      });

      await s3Client.send(command);
      return key;
    } catch (error) {
      console.error("S3 upload error:", error);
      throw new Error("Failed to upload file to S3");
    }
  }

  /**
   * Stream-based multipart upload for files > 2 GiB (Node's Buffer limit).
   * Uses @aws-sdk/lib-storage to chunk automatically.
   */
  async uploadStream(
    key: string,
    body: Readable | Buffer,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const upload = new Upload({
      client: s3Client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: sanitizeS3Metadata(metadata),
      },
      queueSize: 4, // 4 parallel part uploads
      partSize: 16 * 1024 * 1024, // 16 MB parts
      leavePartsOnError: false,
    });
    await upload.done();
    return key;
  }

  /**
   * Get file from S3
   */
  async getFile(key: string): Promise<Buffer> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await s3Client.send(command);

      if (!response.Body) {
        throw new Error("File not found");
      }

      // Convert stream to buffer
      const chunks: Uint8Array[] = [];
      const stream = response.Body as any;

      for await (const chunk of stream) {
        chunks.push(chunk);
      }

      return Buffer.concat(chunks);
    } catch (error) {
      console.error("S3 get file error:", error);
      throw new Error("Failed to retrieve file from S3");
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error("S3 delete error:", error);
      throw new Error("Failed to delete file from S3");
    }
  }

  /**
   * Check if file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate presigned URL for file upload
   */
  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error("S3 presigned upload URL error:", error);
      throw new Error("Failed to generate presigned upload URL");
    }
  }

  /**
   * Generate presigned URL for file download
   */
  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600,
    downloadFilename?: string   // when set, forces browser download instead of inline open
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        // ResponseContentDisposition forces the browser to download the file.
        // Without this, S3 presigned URLs open inline in the browser tab, and
        // without a filename the browser falls back to the S3 key, which is
        // the upload-time name plus a timestamp prefix.
        ResponseContentDisposition: downloadFilename
          ? buildContentDisposition(downloadFilename)
          : "attachment",
      });

      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error("S3 presigned download URL error:", error);
      throw new Error("Failed to generate presigned download URL");
    }
  }

  /**
   * Presigned URL that opens the file INLINE in the browser (no forced
   * download). Used for the Play/Preview buttons where we want the video
   * to stream in a <video> tag.
   */
  async getPresignedStreamUrl(
    key: string,
    expiresIn: number = 3600,
    contentType?: string
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: "inline",
        ...(contentType ? { ResponseContentType: contentType } : {}),
      });
      return await getSignedUrl(s3Client, command, { expiresIn });
    } catch (error) {
      console.error("S3 presigned stream URL error:", error);
      throw new Error("Failed to generate presigned stream URL");
    }
  }

  /**
   * Generate file key for S3 storage
   */
  generateFileKey(
    userId: string,
    organizationId: string,
    fileName: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    return `cabinet/${organizationId}/${userId}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }

  /**
   * Generate S3 key for course video uploads.
   * Path: courses/{orgId}/{courseId}/{timestamp}_{random}_{filename}
   */
  generateCourseVideoKey(
    organizationId: string,
    courseId: string,
    fileName: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    return `courses/${organizationId}/${courseId}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }

  /**
   * Generate S3 key for standalone video uploads (not tied to a course).
   * Path: videos/{orgId}/{timestamp}_{random}_{filename}
   */
  generateStandaloneVideoKey(
    organizationId: string,
    fileName: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    return `videos/${organizationId}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }

  /**
   * Generate S3 key for short-form "Drop" video uploads (max 60s).
   * Path: drops/{orgId}/{timestamp}_{random}_{filename}
   */
  generateDropVideoKey(
    organizationId: string,
    fileName: string
  ): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");

    return `drops/${organizationId}/${timestamp}_${randomId}_${sanitizedFileName}`;
  }

  /**
   * Initiate a multipart upload for large files.
   * Returns the uploadId needed for subsequent part uploads.
   */
  async initiateMultipartUpload(
    key: string,
    contentType: string
  ): Promise<{ uploadId: string; key: string }> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });

      const response = await s3Client.send(command);
      if (!response.UploadId) {
        throw new Error("Failed to get upload ID from S3");
      }

      return { uploadId: response.UploadId, key };
    } catch (error) {
      console.error("S3 initiate multipart error:", error);
      throw new Error("Failed to initiate multipart upload");
    }
  }

  /**
   * Generate presigned URLs for each part of a multipart upload.
   * Browser will PUT each part directly to S3 using these URLs.
   */
  async getMultipartPresignedUrls(
    key: string,
    uploadId: string,
    totalParts: number,
    expiresIn: number = 3600
  ): Promise<{ partNumber: number; url: string }[]> {
    try {
      const urls: { partNumber: number; url: string }[] = [];

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        const command = new UploadPartCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn });
        urls.push({ partNumber, url });
      }

      return urls;
    } catch (error) {
      console.error("S3 multipart presigned URLs error:", error);
      throw new Error("Failed to generate multipart presigned URLs");
    }
  }

  /**
   * Complete a multipart upload after all parts have been uploaded.
   * Requires the ETag returned from each part upload.
   */
  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: { partNumber: number; etag: string }[]
  ): Promise<void> {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((p) => ({
              PartNumber: p.partNumber,
              ETag: p.etag,
            })),
        },
      });

      await s3Client.send(command);
    } catch (error) {
      console.error("S3 complete multipart error:", error);
      throw new Error("Failed to complete multipart upload");
    }
  }

  /**
   * Abort a multipart upload. Cleans up any uploaded parts.
   */
  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
      });

      await s3Client.send(command);
    } catch (error) {
      console.error("S3 abort multipart error:", error);
      // Don't throw — best-effort cleanup
    }
  }

  /**
   * Generate public URL for file (requires bucket to have public read access)
   */
  getPublicUrl(key: string): string {
    if (env.AWS_S3_ENDPOINT) {
      // Custom endpoint (e.g., MinIO, DigitalOcean Spaces)
      const endpoint = env.AWS_S3_ENDPOINT.replace(/\/$/, "");
      if (env.AWS_S3_FORCE_PATH_STYLE) {
        return `${endpoint}/${this.bucket}/${key}`;
      }
      return `${endpoint}/${key}`;
    }
    // Standard AWS S3 URL
    return `https://${this.bucket}.s3.${env.AWS_S3_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Get file metadata from S3
   */
  async getFileMetadata(key: string): Promise<any> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await s3Client.send(command);
      return {
        size: response.ContentLength,
        lastModified: response.LastModified,
        contentType: response.ContentType,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error("S3 get metadata error:", error);
      throw new Error("Failed to get file metadata from S3");
    }
  }

  /**
   * Ensure the S3 bucket has CORS configured for browser uploads.
   * Called once on server startup — skips if CORS is already set.
   */
  async ensureCors(): Promise<void> {
    try {
      // Quick check — if CORS already exists, do nothing
      await s3Client.send(new GetBucketCorsCommand({ Bucket: this.bucket }));
      return; // Already configured
    } catch (err: any) {
      if (err.name !== "NoSuchCORSConfiguration") {
        console.warn("[S3] Could not check CORS:", err.message);
        return; // Permission issue or network — skip silently
      }
    }

    // No CORS exists — set it (first deploy only)
    try {
      await s3Client.send(
        new PutBucketCorsCommand({
          Bucket: this.bucket,
          CORSConfiguration: {
            CORSRules: [
              {
                AllowedOrigins: ["*"],
                AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                AllowedHeaders: ["*"],
                ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
                MaxAgeSeconds: 3600,
              },
            ],
          },
        })
      );
      console.log("[S3] CORS auto-configured on bucket:", this.bucket);
    } catch (err: any) {
      console.warn("[S3] Could not auto-set CORS:", err.message);
    }
  }
}

export const s3Service = S3Service.getInstance();

