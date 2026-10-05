/**
 * Garage-admin ticket client. Uses the `garageAdminApi()` wrapper which
 * auto-attaches the garage-admin JWT (different token from user auth).
 */
import { garageAdminApi } from "@/lib/api";

export type AdminTicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type AdminTicketPriority = "low" | "medium" | "high" | "urgent";

export interface AdminTicketAttachment {
  key: string;
  url?: string;
  name?: string;
  contentType?: string;
  size?: number;
}

export interface AdminTicketMessage {
  _id: string;
  authorRole: "user" | "admin";
  authorId: string;
  authorName: string;
  body: string;
  attachments: AdminTicketAttachment[];
  createdAt: string;
}

export interface AdminTicket {
  _id: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  orgId: string | null;
  isGuest?: boolean;
  title: string;
  description: string;
  status: AdminTicketStatus;
  priority: AdminTicketPriority;
  category?: string;
  /** "chat" when raised from a support chat. */
  source?: "chat" | "manual";
  /** true when auto-created from a chat by the AI. */
  aiGenerated?: boolean;
  /** Assignment — the garage admin who owns this ticket, if any. */
  assignedToId?: string | null;
  assignedToName?: string | null;
  assignedToEmail?: string | null;
  /** "ai" when routed automatically on creation, "admin" when a human set it. */
  assignedBy?: "ai" | "admin" | null;
  assignedAt?: string | null;
  assignReason?: string | null;
  attachments: AdminTicketAttachment[];
  messages: AdminTicketMessage[];
  lastActivityAt: string;
  hasUnreadForUser: boolean;
  hasUnreadForAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export const adminTicketsApi = {
  list: (status?: AdminTicketStatus) =>
    garageAdminApi<{ tickets: AdminTicket[] }>(
      status
        ? `/garage-admin/tickets?status=${encodeURIComponent(status)}`
        : `/garage-admin/tickets`,
    ),
  get: (id: string) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets/${id}`),
  /** Raise a ticket by hand on a member's behalf (outside any chat). */
  create: (input: {
    title: string;
    description: string;
    forEmail: string;
    forName?: string;
    priority?: AdminTicketPriority;
    category?: string;
  }) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  reply: (
    id: string,
    body: string,
    attachments: AdminTicketAttachment[] = [],
  ) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body, attachments }),
    }),
  update: (
    id: string,
    patch: {
      status?: AdminTicketStatus;
      priority?: AdminTicketPriority;
      category?: string;
    },
  ) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  /** Hand the ticket to a specific admin (sets assignedBy "admin"). */
  assign: (id: string, adminId: string) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets/${id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ adminId }),
    }),
  unassign: (id: string) =>
    garageAdminApi<AdminTicket>(`/garage-admin/tickets/${id}/unassign`, {
      method: "PATCH",
    }),
};
