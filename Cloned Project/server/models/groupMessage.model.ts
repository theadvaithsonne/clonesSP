import mongoose, { Schema } from "mongoose";

const AttachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  fileType: { type: String, required: true },
  fileUrl: { type: String, required: true },
  fileKey: { type: String, required: true }, // S3 key for management
  uploadedAt: { type: Date, default: Date.now },
  // See message.model.ts — same optional playback/layout metadata, kept
  // identical so a DM and a group attachment render through one code path.
  durationMs: { type: Number }, // audio + video
  width: { type: Number }, // image + video
  height: { type: Number }, // image + video
  thumbnailUrl: { type: String }, // video poster frame
  waveform: { type: [Number], default: undefined },
});

/** Group events rendered as a centred pill rather than a chat bubble. */
export const SYSTEM_EVENTS = [
  "group_created",
  "member_added",
  "member_removed",
  "member_left",
  "admin_promoted",
  "admin_dismissed",
  "group_renamed",
  "icon_changed",
  "description_changed",
  "retention_changed",
  // Taskroom link (services/groupTaskroom.ts, services/groupTaskAuto.ts).
  "taskroom_linked",
  "taskroom_unlinked",
  "ai_task_created",
  "ai_task_removed",
  "ai_task_assigned",
  "ai_task_updated",
  // A task a member added to the board by hand (services/groupTaskManual.ts).
  "manual_task_created",
] as const;

export type SystemEvent = (typeof SYSTEM_EVENTS)[number];

const GroupMessageSchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },
    from: { type: Schema.Types.ObjectId, ref: "User" }, // optional for agent replies
    text: { type: String, trim: true }, // Made optional to allow attachment-only messages
    // ── System events ("Priya added Devon") ──────────────────────────────
    // Deliberately NO default. Every message written before this existed, and
    // every ordinary message written after it, has no `type` at all — so the
    // payload older clients receive is byte-identical to what they get today.
    // Only system rows carry these fields, and only `type === "system"` is
    // special-cased anywhere. `from` is left unset on them (the schema already
    // allows that for agent replies); `actorId` carries who did the thing.
    type: { type: String, enum: ["system"] },
    event: { type: String, enum: SYSTEM_EVENTS as unknown as string[] },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    targetIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // Taskroom system pills only (`taskroom_linked`, `ai_task_created`): where
    // the board / task lives, so the client can open it. No default — every
    // other message has no key.
    taskroom: {
      type: new Schema(
        {
          taskId: { type: String },
          roomId: { type: String },
          spaceId: { type: String },
          workspaceId: { type: String },
          /** Task title for `ai_task_created`, board name for `taskroom_linked`. */
          title: { type: String },
        },
        { _id: false }
      ),
      default: undefined,
    },
    // Ordinary messages the AI filed as Taskroom tasks (services/groupTaskAuto.ts)
    // — the trigger message and any screenshot message attached to the task.
    // Drives the small "added to Taskroom" mark on the bubble. No default:
    // messages that never became a task have no key.
    aiTasks: {
      type: [
        new Schema(
          {
            taskId: { type: String },
            roomId: { type: String },
            spaceId: { type: String },
            workspaceId: { type: String },
            title: { type: String },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    attachments: [AttachmentSchema],
    mentions: [{ type: Schema.Types.ObjectId, ref: "User" }], // Array of mentioned user IDs
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
    },
    agentMeta: {
      agentId: { type: String },
      agentName: { type: String },
    },
    editedAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    // emoji -> array of userId strings who reacted with that emoji
    reactions: { type: Map, of: [String], default: () => new Map() },
    // Thread support
    threadId: {
      type: Schema.Types.ObjectId,
      ref: "GroupMessage",
      default: null,
      index: true,
    },
    threadResolved: { type: Boolean, default: false },
    replyCount: { type: Number, default: 0 },
    lastThreadReply: {
      text: { type: String, default: null },
      from: { type: Schema.Types.ObjectId, ref: "User", default: null },
      createdAt: { type: Date, default: null },
    },
    threadParticipants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    // Sender-generated id for idempotent sends; see message.model.ts.
    clientMsgId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Paging a group thread, and the scan /chat/search does per group. `groupId`
// was indexed alone, so "newest first" always ended in an in-memory sort.
// See message.model.ts for why search uses a regex rather than a text index.
GroupMessageSchema.index({ groupId: 1, createdAt: -1 });

// Idempotent sends; see message.model.ts.
GroupMessageSchema.index(
  { from: 1, clientMsgId: 1 },
  { unique: true, partialFilterExpression: { clientMsgId: { $type: "string" } } }
);

// ✅ guard against OverwriteModelError in dev hot-reloads
export const GroupMessage =
  mongoose.models.GroupMessage ||
  mongoose.model("GroupMessage", GroupMessageSchema);
