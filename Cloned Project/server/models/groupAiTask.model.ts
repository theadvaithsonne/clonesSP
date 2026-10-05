import mongoose, { Schema } from "mongoose";

/**
 * A Taskroom task the AI created from a group chat message
 * (services/groupTaskAuto.ts).
 *
 * The unique `{messageId, itemIndex}` index is the duplicate guard: one message
 * can yield several tasks ("two things: …"), but the same item of the same
 * message can never be filed twice, even if the capture runs again.
 */
const GroupAiTaskSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: "Group", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    /** The message whose arrival produced this task. */
    messageId: { type: Schema.Types.ObjectId, ref: "GroupMessage", required: true },
    /** Position of this task among the ones extracted from `messageId`. */
    itemIndex: { type: Number, default: 0 },
    /**
     * Every message that fed the task — the trigger plus any image-only
     * messages from the same sender whose screenshots were attached. An image
     * listed here is never attached to a second task.
     */
    sourceMessageIds: [{ type: Schema.Types.ObjectId, ref: "GroupMessage" }],
    /** Who reported it. */
    fromUserId: { type: Schema.Types.ObjectId, ref: "User" },
    taskroomTaskId: { type: String, required: true },
    roomId: { type: String },
    priority: { type: String },
    confidence: { type: Number },
    title: { type: String },
    attachmentCount: { type: Number, default: 0 },
    /**
     * How the task got here: "ai" for classifier capture (the default, so every
     * row written before this field existed reads as "ai"), "manual" for a task
     * a member added by hand (services/groupTaskManual.ts). A manual row carries
     * a synthetic `messageId` that points at no real message, which keeps the
     * unique {messageId,itemIndex} guard working with no migration.
     */
    source: { type: String, default: "ai" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

GroupAiTaskSchema.index({ messageId: 1, itemIndex: 1 }, { unique: true });
// Recent tasks for a group (duplicate context for the model) and for one
// sender (the "screenshot sent right after the text" attach rule).
GroupAiTaskSchema.index({ groupId: 1, createdAt: -1 });
GroupAiTaskSchema.index({ groupId: 1, fromUserId: 1, createdAt: -1 });
// Removal and follow-ups look tasks up by the Taskroom id on a message's mark
// and by the screenshot messages attached to them.
GroupAiTaskSchema.index({ taskroomTaskId: 1 });
GroupAiTaskSchema.index({ sourceMessageIds: 1 });

export const GroupAiTask =
  mongoose.models.GroupAiTask || mongoose.model("GroupAiTask", GroupAiTaskSchema);
