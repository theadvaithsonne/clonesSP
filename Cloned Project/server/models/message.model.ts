import { Schema, model, models, Types } from "mongoose";

const AttachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileKey: { type: String, required: true }, // S3 key for management
  uploadedAt: { type: Date, default: Date.now },
  // Playback/layout metadata, all optional and stored exactly as the client
  // sends them. Without these the receiver cannot size a bubble until the file
  // itself loads: voice notes show no length, images fall back to a 4:3 frame.
  durationMs: { type: Number }, // audio + video
  width: { type: Number }, // image + video
  height: { type: Number }, // image + video
  // Poster frame for a video, so the bubble shows the clip rather than a bare
  // play icon. A URL the client already uploaded — never generated here.
  thumbnailUrl: { type: String },
  // Up to 64 samples in 0..1, for the static voice-note waveform. Capped in the
  // socket handler rather than here so an oversized array is trimmed, not
  // rejected — a bad waveform must never cost someone their message.
  waveform: { type: [Number], default: undefined },
});

const MessageSchema = new Schema(
  {
    convId: { type: String, index: true }, // dm:<a>:<b> (sorted)
    orgId: { type: Types.ObjectId, ref: "Organization", index: true }, // Organization scope for DMs
    from: { type: Types.ObjectId, ref: "User", required: true, index: true },
    to: { type: Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, trim: true },
    attachments: [AttachmentSchema],
    replyTo: { type: Types.ObjectId, ref: "Message", default: null },
    editedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    // Reached the recipient's device (the second grey tick). Set when their
    // app acks receipt, or when they reconnect with it still pending. A set
    // readAt implies delivered, so readers check readAt first.
    deliveredAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    // emoji -> array of userId strings who reacted with that emoji
    reactions: { type: Map, of: [String], default: () => new Map() },
    // Sender-generated id that makes a send idempotent: a retry after a lost
    // ack returns the stored message instead of writing a second copy. Only
    // the mobile app sends it — see realtime/idempotentSend.ts.
    clientMsgId: { type: String },
  },
  { timestamps: true }
);

// Paging a thread, and the conversation-scoped scan /chat/search does. `convId`
// alone was already indexed, but not with `createdAt`, so every "newest first"
// page ended in a blocking in-memory sort.
//
// Deliberately NOT a text index. A Mongo text index tokenises into whole words
// with stemming, so a two-character query like "re" matches nothing and "rep"
// never finds "report" — which is not what a chat search box does. Search is a
// case-insensitive regex bounded by this index instead: correct substring
// semantics, and the conversation filter keeps the scan small.
MessageSchema.index({ convId: 1, createdAt: -1 });

// Idempotent sends. Partial, so the existing rows without a clientMsgId are
// not indexed and cannot collide.
MessageSchema.index(
  { from: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

export const Message = models.Message || model("Message", MessageSchema);
