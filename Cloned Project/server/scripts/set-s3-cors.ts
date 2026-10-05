/**
 * One-time script to set CORS configuration on the S3 bucket.
 * This is required for direct browser-to-S3 uploads (presigned PUT URLs).
 *
 * Usage: npx ts-node src/scripts/set-s3-cors.ts
 */
import { S3Client, PutBucketCorsCommand, GetBucketCorsCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";

dotenv.config();

const s3Client = new S3Client({
  region: process.env.AWS_S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
if (!BUCKET) {
  console.error("❌  AWS_S3_BUCKET is not set in .env");
  process.exit(1);
}

async function setCors() {
  console.log(`\n🪣  Bucket: ${BUCKET}`);
  console.log(`🌍  Region: ${process.env.AWS_S3_REGION}\n`);

  // Check current CORS
  try {
    const current = await s3Client.send(
      new GetBucketCorsCommand({ Bucket: BUCKET })
    );
    console.log("📋  Current CORS rules:", JSON.stringify(current.CORSRules, null, 2));
  } catch (err: any) {
    if (err.name === "NoSuchCORSConfiguration") {
      console.log("⚠️   No CORS configuration exists on this bucket.\n");
    } else {
      console.error("Error reading current CORS:", err.message);
    }
  }

  // Set CORS configuration
  const corsConfig = {
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          // Allow browser uploads from any origin (presigned URLs are already scoped)
          AllowedOrigins: ["*"],
          AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
          AllowedHeaders: ["*"],
          // Expose ETag so multipart uploads can read it from the response
          ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
          MaxAgeSeconds: 3600,
        },
      ],
    },
  };

  try {
    await s3Client.send(new PutBucketCorsCommand(corsConfig));
    console.log("✅  CORS configuration set successfully!\n");

    // Verify
    const verify = await s3Client.send(
      new GetBucketCorsCommand({ Bucket: BUCKET })
    );
    console.log("📋  New CORS rules:", JSON.stringify(verify.CORSRules, null, 2));
    console.log("\n🎉  Done! Browser uploads should now work.\n");
  } catch (error: any) {
    console.error("❌  Failed to set CORS:", error.message);
    console.error("\nMake sure your AWS credentials have s3:PutBucketCors permission.");
    process.exit(1);
  }
}

setCors();
