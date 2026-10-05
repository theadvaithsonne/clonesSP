// Auto-create a support ticket from a member's chat message.
//
// Called (fire-and-forget) whenever a message lands in a group. It cheaply
// bails for anything that isn't a member writing in their own support chat,
// then asks the AI (with the rule-based fallback) whether the conversation
// warrants a ticket, and files one if so — marked aiGenerated so the console
// can show "Created using AI".
//
// De-duped two ways: one open chat-sourced ticket per group at a time, and an
// in-process lock so two fast messages can't both create one.

import { Types } from "mongoose";

const inFlight = new Set<string>();

export async function maybeAutoCreateTicket(
  groupId: string,
  senderUserId: string,
): Promise<void> {
  try {
    if (
      !Types.ObjectId.isValid(groupId) ||
      !Types.ObjectId.isValid(senderUserId)
    ) {
      return;
    }
    if (inFlight.has(groupId)) return;

    const { Group } = await import("../models/group.model");
    const g: any = await Group.findOne({ _id: groupId, kind: "support" }).lean();
    if (!g) return;
    // Only the member's own messages trigger a ticket — not staff replies.
    if (String(g.supportUserId) !== String(senderUserId)) return;
    if (!g.orgId) return;

    inFlight.add(groupId);
    try {
      const { Ticket } = await import("../models/ticket.model");
      // Don't auto-open a second ticket while one is still active for this chat.
      const open = await Ticket.findOne({
        groupId: g._id,
        source: "chat",
        status: { $in: ["open", "in_progress"] },
      })
        .select("_id")
        .lean();
      if (open) return;

      const { suggestTicketForChat } = await import("./supportTicketSuggest");
      const s = await suggestTicketForChat(String(g._id));
      if (!s.suggest) return;

      const { User } = await import("../models/user.model");
      const member: any = await User.findById(g.supportUserId)
        .select("email name")
        .lean();
      if (!member?.email) return;

      const ticket = await Ticket.create({
        userId: g.supportUserId,
        userEmail: member.email,
        userName: member.name || member.email,
        orgId: g.orgId,
        title: s.subject || `Support request — ${g.name || "chat"}`,
        description:
          s.summary || s.subject || "Auto-created from a support chat.",
        category: "General",
        priority: s.priority || "medium",
        source: "chat",
        groupId: g._id,
        aiGenerated: true,
      });
      console.log(
        `[support-auto-ticket] created ${ticket._id} group=${g._id} via=${s.source}`,
      );
      // Route it to the best-fit admin (fire-and-forget — a failed assignment
      // must never undo a created ticket).
      const { autoAssignTicket } = await import("./ticketAutoAssign");
      void autoAssignTicket(String(ticket._id));
    } finally {
      inFlight.delete(groupId);
    }
  } catch (e: any) {
    console.warn("[support-auto-ticket] failed:", e?.message || e);
  }
}
