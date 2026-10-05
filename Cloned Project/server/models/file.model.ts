import { Schema, model } from "mongoose";

const FileSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    cabinet: {
      type: Schema.Types.ObjectId,
      ref: "Cabinet",
      required: true,
    },
    // S3 file information
    s3Key: {
      type: String,
      required: true, // S3 object key
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    s3Region: {
      type: String,
      required: true,
    },
    // File metadata
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true, // File size in bytes
    },
    extension: {
      type: String,
      trim: true,
    },
    // File path within cabinet
    path: {
      type: String,
      required: true, // e.g., "/Documents/Projects/file.pdf"
    },
    // Access control
    isPublic: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {}, // Can store custom permissions if needed
    },
    // Additional metadata
    tags: [String],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    // File status
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "ready", "error"],
      default: "uploading",
    },
    // Version control (for future file versioning)
    version: {
      type: Number,
      default: 1,
    },
    parentFile: {
      type: Schema.Types.ObjectId,
      ref: "File",
      default: null, // For file versions
    },
  },
  { timestamps: true }
);

// Indexes for efficient queries
FileSchema.index({ owner: 1, organization: 1 });
FileSchema.index({ cabinet: 1 });
FileSchema.index({ path: 1, owner: 1 });
FileSchema.index({ s3Key: 1 });
FileSchema.index({ mimeType: 1 });
FileSchema.index({ tags: 1 });

export const File = model("File", FileSchema);
