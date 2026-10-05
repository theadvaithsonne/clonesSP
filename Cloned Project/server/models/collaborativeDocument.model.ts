// Collaborative Document Model for ONLYOFFICE Integration
import mongoose, { Document, Schema } from "mongoose";

export type DocumentType = "word" | "cell" | "slide";

export interface ICollaborativeDocument extends Document {
  title: string;
  type: DocumentType;
  organization: mongoose.Types.ObjectId;
  cabinet?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  collaborators: mongoose.Types.ObjectId[];
  // File storage
  fileKey: string; // Unique key for ONLYOFFICE
  filePath: string; // S3 or local storage path
  fileUrl?: string; // Presigned URL (temporary)
  // Document state
  version: number;
  lastModifiedBy?: mongoose.Types.ObjectId;
  isLocked: boolean;
  lockedBy?: mongoose.Types.ObjectId;
  lockedAt?: Date;
  // Metadata
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollaborativeDocumentSchema = new Schema<ICollaborativeDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["word", "cell", "slide"],
      required: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    cabinet: {
      type: Schema.Types.ObjectId,
      ref: "Cabinet",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    collaborators: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    fileKey: {
      type: String,
      required: true,
      unique: true,
    },
    filePath: {
      type: String,
      required: true,
    },
    fileUrl: {
      type: String,
    },
    version: {
      type: Number,
      default: 1,
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lockedAt: {
      type: Date,
    },
    size: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
CollaborativeDocumentSchema.index({ organization: 1, createdBy: 1 });
CollaborativeDocumentSchema.index({ organization: 1, collaborators: 1 });
CollaborativeDocumentSchema.index({ fileKey: 1 });

// Static method to generate unique document key
CollaborativeDocumentSchema.statics.generateDocumentKey = function (): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `doc_${timestamp}_${randomPart}`;
};

// Method to get file extension based on type
CollaborativeDocumentSchema.methods.getFileExtension = function (): string {
  switch (this.type) {
    case "word":
      return "docx";
    case "cell":
      return "xlsx";
    case "slide":
      return "pptx";
    default:
      return "docx";
  }
};

// Method to get MIME type based on document type
CollaborativeDocumentSchema.methods.getMimeType = function (): string {
  switch (this.type) {
    case "word":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "cell":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "slide":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    default:
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
};

export const CollaborativeDocument = mongoose.model<ICollaborativeDocument>(
  "CollaborativeDocument",
  CollaborativeDocumentSchema
);
