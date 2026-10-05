import mongoose, { Schema, Document, Types } from "mongoose";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketAuthorRole = "user" | "admin";

export interface ITicketAttachment {
  key: string;
  name?: string;
  contentType?: string;
  size?: number;
}

export interface ITicketMessage {
  _id: Types.ObjectId;
  authorRole: TicketAuthorRole;
  authorId: Types.ObjectId;
  authorName: string;
  body: string;
  attachments: ITicketAttachment[];
  createdAt: Date;
}

export interface ITicket extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null;
  userEmail: string;
  userName: string;
  orgId?: Types.ObjectId | null;
  isGuest: boolean;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  // Set when the ticket was raised from a support group chat, so the console
  // can tie it back to that conversation (additive — plain tickets leave unset).
  source?: "chat" | "manual";
  groupId?: Types.ObjectId | null;
  sourceMessageId?: Types.ObjectId | null;
  // Assignment — which garage admin owns this ticket. Set automatically by the
  // AI on creation (assignedBy "ai") and overridable by a human (assignedBy
  // "admin"). Name/email are denormalised so the queue renders without a join.
  assignedToId?: Types.ObjectId | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  assignedBy?: "ai" | "admin" | null;
  assignedAt?: Date | null;
  /** Why the AI routed it here — shown as a tooltip, not user-facing. */
  assignReason?: string | null;
  /** The Taskroom card this ticket was mirrored to (services/supportTicketTaskroom.ts). */
  taskroomTaskId?: string | null;
  taskroomRoomId?: string | null;
  /** true when the ticket was raised automatically from a chat by the AI. */
  aiGenerated?: boolean;
  attachments: ITicketAttachment[];
  messages: ITicketMessage[];
  lastActivityAt: Date;
  hasUnreadForUser: boolean;
  hasUnreadForAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<ITicketAttachment>(
  {
    key: { type: String, required: true },
    name: String,
    contentType: String,
    size: Number,
  },
  { _id: false },
);

const MessageSchema = new Schema<ITicketMessage>({
  authorRole: { type: String, enum: ["user", "admin"], required: true },
  authorId: { type: Schema.Types.ObjectId, required: true },
  authorName: { type: String, required: true },
  body: { type: String, required: true },
  attachments: { type: [AttachmentSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

const TicketSchema = new Schema<ITicket>(
  {
    userId: { type: Schema.Types.ObjectId, required: false, default: null, index: true },
    userEmail: { type: String, required: true, lowercase: true, trim: true, index: true },
    userName: { type: String, required: true },
    orgId: { type: Schema.Types.ObjectId, required: false, default: null, index: true },
    isGuest: { type: Boolean, default: false, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "closed"],
      default: "open",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: String,
    // Link back to the support chat a ticket was raised from (additive).
    source: { type: String, enum: ["chat", "manual"] },
    groupId: { type: Schema.Types.ObjectId, ref: "Group", default: null, index: true },
    sourceMessageId: { type: Schema.Types.ObjectId, ref: "GroupMessage", default: null },
    aiGenerated: { type: Boolean, default: false },
    assignedToId: { type: Schema.Types.ObjectId, ref: "GarageAdmin", default: null, index: true },
    assignedToName: { type: String, default: null },
    assignedToEmail: { type: String, default: null },
    assignedBy: { type: String, enum: ["ai", "admin"], default: null },
    assignedAt: { type: Date, default: null },
    assignReason: { type: String, default: null },
    taskroomTaskId: { type: String, default: null },
    taskroomRoomId: { type: String, default: null },
    attachments: { type: [AttachmentSchema], default: [] },
    messages: { type: [MessageSchema], default: [] },
    lastActivityAt: { type: Date, default: () => new Date(), index: true },
    hasUnreadForUser: { type: Boolean, default: false },
    hasUnreadForAdmin: { type: Boolean, default: true },
  },
  { timestamps: true },
);

TicketSchema.index({ status: 1, lastActivityAt: -1 });
TicketSchema.index({ userId: 1, lastActivityAt: -1 });

// Every NEW ticket is mirrored onto the shared "Garage Support" Taskroom board
// (Shorupan's "option 1"). Done here, once, so all four creation paths (AI
// chat, user-filed, guest, admin-manual) get it without each remembering to.
// `wasNew` is captured in pre-save because `isNew` is already false by the time
// post-save runs; the mirror is fire-and-forget and never blocks the save.
TicketSchema.pre("save", function (next) {
  (this as any).$locals.wasNewTicket = this.isNew;
  next();
});
TicketSchema.post("save", function (doc: any) {
  if (!(this as any).$locals?.wasNewTicket) return;
  import("../services/supportTicketTaskroom")
    .then((m) => m.createTaskForTicket(String(doc._id)))
    .catch(() => {
      /* best-effort — the ticket exists regardless */
    });
});

// Garage and NC share the same Mongo cluster + DB in prod. Pinning
// the collection to `tickets_garage` keeps Garage tickets isolated
// from NC's `tickets_networkchain` collection.
export const Ticket = mongoose.model<ITicket>(
  "Ticket",
  TicketSchema,
  "tickets_garage",
);
