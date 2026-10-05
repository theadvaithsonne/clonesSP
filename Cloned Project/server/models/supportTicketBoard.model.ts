import { Schema, model } from "mongoose";

/**
 * The single Taskroom board that support tickets are mirrored onto.
 *
 * Every ticket we create also lands as an unassigned card on ONE shared
 * "Garage Support" board (Shorupan's "option 1"), so the support team works
 * tickets from the taskroom they already use instead of a separate ticket
 * console. This document is that board's provisioned coordinates — created once,
 * then reused for every ticket. It is a singleton, keyed by `key: "support"`.
 *
 * Provisioning (create the workspace/space/room in Taskroom v2) is done lazily
 * on the first ticket and cached here; `status` guards against two tickets
 * racing to provision it at once. See services/supportTicketTaskroom.ts.
 */
const SupportTicketBoardSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "support" },
    /** The Garage user the board is owned by (whose Taskroom account we act as). */
    ownerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization" },
    workspaceId: { type: String },
    workspaceName: { type: String, default: null },
    spaceId: { type: String },
    roomId: { type: String },
    roomName: { type: String, default: null },
    /** Set when an admin picked the board in the Support Chats page. */
    selectedBy: { type: String, default: null },
    selectedAt: { type: Date, default: null },
    /** The column new ticket-cards land in. */
    stageId: { type: String },
    status: {
      type: String,
      enum: ["provisioning", "ready", "failed"],
      default: "provisioning",
      index: true,
    },
    lastError: { type: String, default: null },
    provisionedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const SupportTicketBoard = model(
  "SupportTicketBoard",
  SupportTicketBoardSchema,
  "support_ticket_board"
);
