import { Schema, model } from "mongoose";

const ShareableLinkSchema = new Schema(
  {
    // Unique token for the link (e.g., "int_abc123..." or "pub_xyz789...")
    token: {
      type: String,
      required: true,
      unique: true,
    },

    // Type of link: internal (within org) or external (public).
    // Kept as the storage key — `{ file, linkType }` is unique, so a file has
    // at most one link of each kind and flipping its access mode revives the
    // matching record instead of piling up new ones.
    linkType: {
      type: String,
      enum: ["internal", "external"],
      required: true,
    },

    /**
     * What the token grants, in the words the sharing UI uses. This is what
     * resolution reads: the token itself is an opaque id with no prefix, so
     * the record is the only thing that knows whether a link is open to the
     * world or gated behind office membership.
     */
    accessLevel: {
      type: String,
      enum: ["public", "restricted"],
      default: "restricted",
    },

    // Reference to the file being shared. Each cabinet tree keeps its files in
    // its own collection, so the link records which one to resolve against —
    // without it, an organization file id would be looked up in UserFile and
    // populate silently to null.
    file: {
      type: Schema.Types.ObjectId,
      refPath: "fileModel",
      required: true,
    },

    fileModel: {
      type: String,
      enum: ["UserFile", "OrganizationFile", "FloorFile"],
      default: "UserFile",
    },

    // Owner of the file (who created the link)
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Organization context
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    // Expiration date (mandatory, 30 days from creation)
    expiresAt: {
      type: Date,
      required: true,
    },

    // Maximum number of accesses allowed
    maxAccessCount: {
      type: Number,
      default: 100,
    },

    // Current access count
    accessCount: {
      type: Number,
      default: 0,
    },

    // Link status
    status: {
      type: String,
      enum: ["active", "expired", "limit_reached", "revoked"],
      default: "active",
    },

    // Last time the link was accessed
    lastAccessedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Indexes
ShareableLinkSchema.index({ token: 1 }, { unique: true });
ShareableLinkSchema.index({ file: 1, linkType: 1 }, { unique: true }); // One link per file per type
ShareableLinkSchema.index({ owner: 1, organization: 1 });
ShareableLinkSchema.index({ expiresAt: 1 });
ShareableLinkSchema.index({ status: 1 });

export const ShareableLink = model("ShareableLink", ShareableLinkSchema);
