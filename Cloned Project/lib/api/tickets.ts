/**
 * User-facing tickets client. Uses the existing `api()` wrapper from
 * lib/api.ts which auto-attaches the user JWT.
 */
import { api, API_URL } from "@/lib/api";
import { getToken } from "@/lib/auth";

export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";

export interface TicketAttachment {
  key: string;
  url?: string;
  name?: string;
  contentType?: string;
  size?: number;
}

export interface TicketMessage {
  _id: string;
  authorRole: "user" | "admin";
  authorId: string;
  authorName: string;
  body: string;
  attachments: TicketAttachment[];
  createdAt: string;
}

export interface Ticket {
  _id: string;
  userId: string | null;
  userEmail: string;
  userName: string;
  orgId: string | null;
  isGuest?: boolean;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: string;
  attachments: TicketAttachment[];
  messages: TicketMessage[];
  lastActivityAt: string;
  hasUnreadForUser: boolean;
  hasUnreadForAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PresignUploadOutput {
  key: string;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  uploadExpiresIn: number;
  publicUrl: string;
  publicUrlExpiresIn: number;
}

export const ticketsApi = {
  presignUpload: (input: { mimeType: string; filename?: string; sizeBytes?: number }) =>
    api<PresignUploadOutput>("/tickets/upload-url", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  create: (input: {
    title: string;
    description: string;
    priority?: TicketPriority;
    category?: string;
    attachments?: TicketAttachment[];
  }) =>
    api<Ticket>("/tickets", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  listMine: () => api<{ tickets: Ticket[] }>("/tickets/mine"),

  get: (id: string) => api<Ticket>(`/tickets/${id}`),

  addMessage: (id: string, body: string, attachments: TicketAttachment[] = []) =>
    api<Ticket>(`/tickets/${id}/messages`, {
      method: "POST",
      body: JSON.stringify({ body, attachments }),
    }),
};

/** Browser upload via presigned PUT — server never sees bytes. */
export async function uploadTicketFile(file: File): Promise<TicketAttachment> {
  const presign = await ticketsApi.presignUpload({
    mimeType: file.type || "application/octet-stream",
    filename: file.name,
    sizeBytes: file.size,
  });
  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.uploadHeaders,
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload failed: ${put.status}`);
  }
  return {
    key: presign.key,
    url: presign.publicUrl,
    name: file.name,
    contentType: file.type || undefined,
    size: file.size,
  };
}

// Re-export for the admin-side helper that lives elsewhere
export { API_URL, getToken };
