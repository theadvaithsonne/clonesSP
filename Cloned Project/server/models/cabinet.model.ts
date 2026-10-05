import { Schema, model } from "mongoose";

// USER CABINETS - Personal cabinets for individual users
const UserCabinetSchema = new Schema(
  {
    name: {
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
    parentCabinet: {
      type: Schema.Types.ObjectId,
      ref: "UserCabinet",
      default: null,
    },
    path: {
      type: String,
      required: true,
    },
    isRoot: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false, // True for the default "My Files" cabinet
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// FLOOR CABINETS - Shared cabinets for floor members
const FloorCabinetSchema = new Schema(
  {
    name: {
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
      required: true, // Creator becomes the initial owner
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    floorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
    parentCabinet: {
      type: Schema.Types.ObjectId,
      ref: "FloorCabinet",
      default: null,
    },
    path: {
      type: String,
      required: true,
    },
    isRoot: {
      type: Boolean,
      default: true, // Floor cabinets are always root level
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// USER FILES - Files in user cabinets
const UserFileSchema = new Schema(
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
      ref: "UserCabinet",
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    s3Region: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    extension: {
      type: String,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: [String],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "ready", "error"],
      default: "uploading",
    },
    version: {
      type: Number,
      default: 1,
    },
    parentFile: {
      type: Schema.Types.ObjectId,
      ref: "UserFile",
      default: null,
    },
  },
  { timestamps: true }
);

// FLOOR FILES - Files in floor cabinets
const FloorFileSchema = new Schema(
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
      ref: "FloorCabinet",
      required: true,
    },
    floorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    s3Region: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    extension: {
      type: String,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: [String],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "ready", "error"],
      default: "uploading",
    },
    version: {
      type: Number,
      default: 1,
    },
    parentFile: {
      type: Schema.Types.ObjectId,
      ref: "FloorFile",
      default: null,
    },
  },
  { timestamps: true }
);

// ORGANIZATION CABINETS - Shared cabinets for all organization members
const OrganizationCabinetSchema = new Schema(
  {
    name: {
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
      required: true, // Creator becomes the initial owner
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },
    parentCabinet: {
      type: Schema.Types.ObjectId,
      ref: "OrganizationCabinet",
      default: null,
    },
    path: {
      type: String,
      required: true,
    },
    isRoot: {
      type: Boolean,
      default: true, // Organization cabinets are always root level
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

// ORGANIZATION FILES - Files in organization cabinets
const OrganizationFileSchema = new Schema(
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
      ref: "OrganizationCabinet",
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Bucket: {
      type: String,
      required: true,
    },
    s3Region: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    extension: {
      type: String,
      trim: true,
    },
    path: {
      type: String,
      required: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    /**
     * Who may open this file's share link.
     *
     *  - "office"  (default) — only members of the owning organization. A
     *    visitor who isn't one is walked through sign-in and joined to the
     *    office before the file opens.
     *  - "public"  — anyone with the link, no account needed.
     *
     * Defaulting to "office" means a file that predates this field, or one
     * uploaded by a client that never sets it, stays private.
     */
    sharing: {
      access: {
        type: String,
        enum: ["office", "public"],
        default: "office",
      },
      updatedAt: { type: Date, default: null },
      updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
    },
    permissions: {
      type: Schema.Types.Mixed,
      default: {},
    },
    tags: [String],
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "ready", "error"],
      default: "uploading",
    },
    version: {
      type: Number,
      default: 1,
    },
    parentFile: {
      type: Schema.Types.ObjectId,
      ref: "OrganizationFile",
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes for User Cabinets
UserCabinetSchema.index({ owner: 1, organization: 1 });
UserCabinetSchema.index({ path: 1, owner: 1 });
UserCabinetSchema.index({ parentCabinet: 1 });
UserCabinetSchema.index({ isDefault: 1, owner: 1, organization: 1 });

// Unique index to ensure only one default cabinet per user per org
UserCabinetSchema.index(
  { owner: 1, organization: 1, isDefault: 1 },
  { unique: true, partialFilterExpression: { isDefault: true } }
);

// Indexes for Floor Cabinets
FloorCabinetSchema.index({ floorId: 1, organization: 1 });
FloorCabinetSchema.index({ parentCabinet: 1 });
FloorCabinetSchema.index({ organization: 1 });

// Unique index to ensure only one cabinet per floor per org
FloorCabinetSchema.index({ floorId: 1, organization: 1 }, { unique: true });

// Indexes for User Files
UserFileSchema.index({ owner: 1, organization: 1 });
UserFileSchema.index({ cabinet: 1 });
UserFileSchema.index({ path: 1, owner: 1 });
UserFileSchema.index({ s3Key: 1 });
UserFileSchema.index({ mimeType: 1 });
UserFileSchema.index({ tags: 1 });

// Indexes for Floor Files
FloorFileSchema.index({ organization: 1 });
FloorFileSchema.index({ cabinet: 1 });
FloorFileSchema.index({ floorId: 1 });
FloorFileSchema.index({ path: 1 });
FloorFileSchema.index({ s3Key: 1 });
FloorFileSchema.index({ mimeType: 1 });
FloorFileSchema.index({ tags: 1 });

// Indexes for Organization Cabinets
OrganizationCabinetSchema.index({ organization: 1 });
OrganizationCabinetSchema.index({ parentCabinet: 1 });
OrganizationCabinetSchema.index({ path: 1 });

// Indexes for Organization Files
OrganizationFileSchema.index({ organization: 1 });
OrganizationFileSchema.index({ cabinet: 1 });
OrganizationFileSchema.index({ path: 1 });
OrganizationFileSchema.index({ s3Key: 1 });
OrganizationFileSchema.index({ mimeType: 1 });
OrganizationFileSchema.index({ tags: 1 });

export const UserCabinet = model("UserCabinet", UserCabinetSchema);
export const FloorCabinet = model("FloorCabinet", FloorCabinetSchema);
export const OrganizationCabinet = model(
  "OrganizationCabinet",
  OrganizationCabinetSchema
);
export const UserFile = model("UserFile", UserFileSchema);
export const FloorFile = model("FloorFile", FloorFileSchema);
export const OrganizationFile = model(
  "OrganizationFile",
  OrganizationFileSchema
);

// Legacy exports for backward compatibility
export const Cabinet = UserCabinet;
export const File = UserFile;
