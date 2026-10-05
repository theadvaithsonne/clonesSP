/**
 * Shared ticket-handler helpers. Used by both the user-facing
 * `/tickets/*` router and the garage-admin `/garage-admin/tickets/*`
 * router so attachment sanitisation + URL signing have one source.
 */
import { presignTicketView } from "./ticketAttachments.service";
import type { ITicketAttachment } from "../models/ticket.model";

interface AttachmentInput {
  key?: unknown;
  name?: unknown;
  contentType?: unknown;
  size?: unknown;
}

/**
 * Strip the client's attachment payload down to known fields with
 * length caps so a malicious caller can't stuff arbitrary JSON into
 * the embedded `attachments` array. Caps at 6 entries per item.
 */
export function sanitiseAttachments(raw: unknown): ITicketAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ITicketAttachment[] = [];
  for (const a of raw as AttachmentInput[]) {
    if (typeof a?.key !== "string" || !a.key.trim()) continue;
    out.push({
      key: a.key.trim().slice(0, 500),
      name:
        typeof a?.name === "string" ? a.name.trim().slice(0, 200) : undefined,
      contentType:
        typeof a?.contentType === "string"
          ? a.contentType.trim().slice(0, 120)
          : undefined,
      size:
        typeof a?.size === "number" && isFinite(a.size) && a.size > 0
          ? a.size
          : undefined,
    });
    if (out.length >= 6) break;
  }
  return out;
}

/** Add freshly-signed viewing URLs to every attachment on a ticket
 *  or message before returning it to the FE. */
export async function withViewUrls<
  T extends {
    attachments: ITicketAttachment[];
    messages?: { attachments: ITicketAttachment[] }[];
  },
>(
  ticket: T,
): Promise<T & { attachments: (ITicketAttachment & { url: string })[] }> {
  const signAll = async (atts: ITicketAttachment[]) =>
    Promise.all(
      atts.map(async (a) => ({ ...a, url: await presignTicketView(a.key) })),
    );
  const next = {
    ...ticket,
    attachments: await signAll(ticket.attachments || []),
  };
  if (Array.isArray(ticket.messages)) {
    next.messages = await Promise.all(
      ticket.messages.map(async (m) => ({
        ...m,
        attachments: await signAll(m.attachments || []),
      })),
    );
  }
  return next as T & {
    attachments: (ITicketAttachment & { url: string })[];
  };
}
