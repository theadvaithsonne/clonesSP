import mongoose, { Schema } from "mongoose";

const GroupMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now },
    lastReadAt: { type: Date, default: new Date(0) },
  },
  { _id: false }
);

// ── Taskroom link (services/groupTaskroom.ts, services/groupTaskAuto.ts) ──
// One row per group member the sync has seen. `addedBySync` is the removal
// guard: only people the sync itself put on the board are ever taken off it,
// so anyone who was already on a linked existing board keeps their access.
const GroupTaskroomMemberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    /** tr2_user id — Taskroom's own user record, NOT the Garage user id. */
    taskroomUserId: { type: String, default: null },
    addedBySync: { type: Boolean, default: false },
    status: { type: String, enum: ["synced", "failed"], default: "synced" },
    error: { type: String, default: null },
    syncedAt: { type: Date },
  },
  { _id: false }
);

const GroupTaskroomSchema = new Schema(
  {
    /** AI task capture on/off. Member sync runs regardless — it follows the link. */
    enabled: { type: Boolean, default: true },
    /** "broken" when the board is gone or nobody can act on it — relink needed. */
    status: { type: String, enum: ["active", "broken"], default: "active" },
    mode: {
      type: String,
      enum: ["new-workspace", "new-board", "existing-board"],
    },
    workspaceId: { type: String },
    workspaceName: { type: String },
    spaceId: { type: String },
    roomId: { type: String },
    roomName: { type: String },
    /** Column new tasks land in — the board's first "tostart" stage (Backlog). */
    stageId: { type: String },
    linkedBy: { type: Schema.Types.ObjectId, ref: "User" },
    linkedAt: { type: Date },
    /**
     * Support chats only (services/supportChatTaskroom.ts): the org Taskroom
     * calls are made in. A support chat's own org is the CUSTOMER's, but the
     * board belongs to the support board owner, who acts on it — so the actor
     * (linkedBy) is minted in this org instead, and is used even though they
     * are not a member of the chat.
     */
    actorOrgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    members: { type: [GroupTaskroomMemberSchema], default: [] },
    lastSyncAt: { type: Date },
    lastError: { type: String, default: null },
    lastErrorAt: { type: Date },
  },
  { _id: false }
);

const GroupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true }, // Group description (admin can set)
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    members: { type: [GroupMemberSchema], default: [] },
    agentMembers: { type: [String], default: [] }, // virtual agent IDs e.g. "openclaw_agent_abc"
    picture: { type: String, default: null }, // URL to group picture
    // Required — a group without an org is invisible to every org-scoped
    // list query. Legacy docs missing this are backfilled by
    // scripts/backfill-group-orgid.ts.
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },

    // Admin controls
    broadcastOnly: { type: Boolean, default: false },
    adminOnlyFiles: { type: Boolean, default: false },
    messageRetentionDays: { type: Number, default: 0 }, // 0 = no retention
    // No default — Mongoose only writes the field when it's set, so
    // groups without an invite link are simply missing the key (not
    // null). This matters for the unique index below.
    inviteCode: { type: String },
    inviteExpiry: { type: Date },

    // ── Support chats (services/supportChat.ts) ─────────────────────────
    // One per user, created when their profile is first completed: the user,
    // their upline and every active garage admin. Deliberately NO default on
    // `kind` — an ordinary group simply has no key, so its payload and every
    // query that ignores `kind` stay exactly as they were.
    kind: { type: String, enum: ["support"] },
    /** The member this support chat exists for. Unique per user (index below). */
    supportUserId: { type: Schema.Types.ObjectId, ref: "User" },
    /** Their upline at the time of the last sync — kept so a change can swap it. */
    supportUplineId: { type: Schema.Types.ObjectId, ref: "User" },
    /** The User account of their assignedSupportAgentId admin, if any. */
    supportAgentUserId: { type: Schema.Types.ObjectId, ref: "User" },
    // Last real message, denormalised so the Support list and the admin
    // console can sort and flag "unanswered" without a lookup per group — a
    // staff member sits in every support chat on the platform.
    supportLastMessage: {
      type: new Schema(
        {
          text: { type: String, default: "" },
          from: { type: Schema.Types.ObjectId, ref: "User" },
          at: { type: Date },
          hasAttachments: { type: Boolean, default: false },
          /** Sent by a staff (group admin) member — false means awaiting a reply. */
          fromStaff: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: undefined,
    },
    /** Sort key for support lists: last message time, else creation time. */
    supportActivityAt: { type: Date },

    // Linked Taskroom board. No default — an unlinked group has no key, so
    // its payload and every existing query stay exactly as they were.
    taskroom: { type: GroupTaskroomSchema, default: undefined },
    /** Support chats: true when an admin gave this chat its own Taskroom board;
     *  otherwise it files onto the shared support board (supportChatTaskroom.ts). */
    supportTaskroomOwn: { type: Boolean, default: undefined },
  },
  { timestamps: true }
);

GroupSchema.index({ "members.userId": 1 });
GroupSchema.index({ orgId: 1 });
// At most one support chat per user. Partial so ordinary groups (no
// supportUserId) never collide with each other.
GroupSchema.index(
  { supportUserId: 1 },
  { unique: true, partialFilterExpression: { kind: "support" } }
);
GroupSchema.index({ kind: 1, supportActivityAt: -1 });
// Partial filter — index only docs that actually have a string invite
// code. A plain `sparse: true` would still index docs whose value is
// literal `null`, causing E11000 the second time a group is created
// without an invite link.
GroupSchema.index(
  { inviteCode: 1 },
  {
    unique: true,
    partialFilterExpression: { inviteCode: { $type: "string" } },
  },
);

export const Group =
  mongoose.models.Group || mongoose.model("Group", GroupSchema);
