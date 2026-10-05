import { Schema, model, models, Types } from "mongoose";

const AttachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileKey: { type: String, required: true }, // S3 key for management
  uploadedAt: { type: Date, default: Date.now },
});

const GlobalMessageSchema = new Schema(
  {
    convId: { type: String, index: true }, // global-dm:<a>:<b> (sorted)
    // NO orgId - this is platform-wide messaging
    from: { type: Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, trim: true },
    attachments: [AttachmentSchema],
    replyTo: { type: Types.ObjectId, ref: "GlobalMessage", default: null },
    editedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    // emoji -> array of userId strings who reacted with that emoji (as on
    // office DMs and group messages).
    reactions: { type: Map, of: [String], default: () => new Map() },
    // Sender-generated id for idempotent sends; see message.model.ts.
    clientMsgId: { type: String },
  },
  { timestamps: true }
);

// Compound index for efficient message history queries
GlobalMessageSchema.index({ convId: 1, createdAt: -1 });

// Idempotent sends; see message.model.ts.
GlobalMessageSchema.index(
  { from: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

export const GlobalMessage =
  models.GlobalMessage || model("GlobalMessage", GlobalMessageSchema);
