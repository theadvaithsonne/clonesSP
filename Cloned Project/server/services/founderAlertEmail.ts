// src/services/founderAlertEmail.ts
//
// "Someone joined" alerts for the person who owns the thing.
//
// The seller-side twin of services/orderEmail.ts. That module mails the BUYER
// a branded confirmation off a Network Mail template; this one mails the
// FOUNDER a plain notice with who joined and what they joined, gated on the
// per-item `founderAlerts.enabled` toggle set in the item's form.
//
// Two properties make it safe to call from every acquisition path:
//   - it no-ops unless the founder turned the toggle on for THAT item, so
//     adding a call site can never start spamming an org that didn't ask;
//   - when an invoice backs the acquisition, the send is claimed atomically on
//     it, so the repeated `fulfillInvoice` calls a webhook/browser race
//     produces still yield exactly one email.
//
// Free acquisitions that mint a $0 invoice (services/freeInvoice.ts) go
// through the same claim. The only path without an invoice is free event
// registration, which is already guarded by a "already registered" check.

import { Types } from "mongoose";
import { EMAIL_FROM_NOTIFICATION, sendMail, senderForOrg } from "./mailer";
import { env } from "../config/env";

const BRAND = "#FBD10D";

/** Sellable items that can carry a `founderAlerts` config. */
export type FounderAlertItemType =
  | "product"
  | "course"
  | "channel"
  | "workshop"
  | "service"
  | "event";

/** Owner-facing label for each item type, and the verb that fits it. */
const ITEM_LABEL: Record<FounderAlertItemType, { noun: string; verb: string }> =
  {
    product: { noun: "digital product", verb: "bought" },
    course: { noun: "course", verb: "enrolled in" },
    channel: { noun: "community", verb: "joined" },
    workshop: { noun: "live stream", verb: "registered for" },
    service: { noun: "service", verb: "opted into" },
    event: { noun: "event", verb: "registered for" },
  };

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency || "USD"} ${amount.toFixed(2)}`;
  }
}

function formatDateTime(value?: Date | string | null): string {
  const d = value ? new Date(value) : new Date();
  return d.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  });
}

interface ResolvedItem {
  alerts: any;
  name: string;
  /** The founder who owns it — always a recipient when alerts are on. */
  ownerId: any;
  orgId: any;
}

/**
 * Loads just the alert config off whichever collection owns the item. Each
 * model stores the same `founderAlerts` shape
 * (models/founderAlerts.schema.ts); only the name / owner / org field names
 * differ between them.
 */
async function loadItem(
  itemType: FounderAlertItemType,
  itemId: string | Types.ObjectId,
): Promise<ResolvedItem | null> {
  switch (itemType) {
    case "product": {
      const { Product } = await import("../models/product.model");
      const doc: any = await Product.findById(itemId)
        .select("founderAlerts name createdBy organizationId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.name,
            ownerId: doc.createdBy,
            orgId: doc.organizationId,
          }
        : null;
    }
    case "course": {
      const { Course } = await import("../models/course.model");
      const doc: any = await Course.findById(itemId)
        .select("founderAlerts title createdBy organizationId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.title,
            ownerId: doc.createdBy,
            orgId: doc.organizationId,
          }
        : null;
    }
    case "channel": {
      const { Channel } = await import("../models/channel.model");
      const doc: any = await Channel.findById(itemId)
        .select("founderAlerts title createdBy storeId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.title,
            ownerId: doc.createdBy,
            orgId: doc.storeId,
          }
        : null;
    }
    case "workshop": {
      const { Workshop } = await import("../models/workshop.model");
      const doc: any = await Workshop.findById(itemId)
        .select("founderAlerts title createdBy orgId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.title,
            ownerId: doc.createdBy,
            orgId: doc.orgId,
          }
        : null;
    }
    case "service": {
      const { Service } = await import("../models/service.model");
      const doc: any = await Service.findById(itemId)
        .select("founderAlerts title createdBy organizationId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.title,
            ownerId: doc.createdBy,
            orgId: doc.organizationId,
          }
        : null;
    }
    case "event": {
      const { EventProgram } = await import("../models/eventProgram.model");
      const doc: any = await EventProgram.findById(itemId)
        .select("founderAlerts name creatorId orgId")
        .lean();
      return doc
        ? {
            alerts: doc.founderAlerts,
            name: doc.name,
            ownerId: doc.creatorId,
            orgId: doc.orgId,
          }
        : null;
    }
  }
}

/**
 * Where the founder lands to see who joined. Deliberately the seller-side
 * surface (members / enrolments / orders), not the buyer's copy of the item.
 */
function buildManageUrl(
  itemType: FounderAlertItemType,
  itemId: string | Types.ObjectId,
  orgId: any,
): string {
  const params = new URLSearchParams();
  if (orgId) params.set("orgId", orgId.toString());

  switch (itemType) {
    case "product":
      params.set("open", "product-orders");
      break;
    case "course":
      params.set("openApp", "course");
      params.set("courseId", itemId.toString());
      break;
    case "channel":
      params.set("openApp", "channel");
      params.set("channelId", itemId.toString());
      break;
    case "workshop":
      params.set("openApp", "webinar");
      params.set("tab", "hosting");
      break;
    case "service":
      params.set("openApp", "service");
      params.set("serviceId", itemId.toString());
      break;
    case "event":
      params.set("openApp", "events");
      params.set("eventId", itemId.toString());
      break;
  }

  return `${env.FRONTEND_URL}/workspace?${params.toString()}`;
}

interface FounderAlertEmailContent {
  subject: string;
  html: string;
  text: string;
}

function buildFounderAlertEmail(params: {
  itemType: FounderAlertItemType;
  itemName: string;
  orgName: string;
  joinerName: string;
  joinerEmail: string;
  joinerPhone?: string | null;
  joinerLocation?: string | null;
  amountLabel: string;
  when: string;
  manageUrl: string;
}): FounderAlertEmailContent {
  const { noun, verb } = ITEM_LABEL[params.itemType];
  const who = params.joinerName || params.joinerEmail;
  const subject = `${who} ${verb} ${params.itemName}`;

  const rows: Array<[string, string]> = [
    ["Name", params.joinerName || "—"],
    ["Email", params.joinerEmail],
  ];
  if (params.joinerPhone) rows.push(["Phone", params.joinerPhone]);
  if (params.joinerLocation) rows.push(["Location", params.joinerLocation]);
  rows.push([noun.replace(/^\w/, (c) => c.toUpperCase()), params.itemName]);
  rows.push(["Amount", params.amountLabel]);
  rows.push(["When", params.when]);

  const rowsHtml = rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:8px 0;color:#8a8a99;font-size:13px;width:110px;vertical-align:top;">${esc(label)}</td>
          <td style="padding:8px 0;color:#EAEAEA;font-size:14px;font-weight:600;">${esc(value)}</td>
        </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0C0C0E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0C0C0E;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141418;border:1px solid #2a2a35;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${BRAND};padding:20px 24px;">
                <h1 style="margin:0;color:#0C0C0E;font-size:20px;font-weight:700;">New ${esc(noun)} ${esc(params.itemType === "product" ? "sale" : "signup")}</h1>
                <p style="margin:6px 0 0;color:#0C0C0E;font-size:14px;opacity:0.8;">${esc(who)} ${esc(verb)} ${esc(params.itemName)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rowsHtml}
                </table>
                <div style="margin-top:24px;">
                  <a href="${esc(params.manageUrl)}" style="display:inline-block;background:${BRAND};color:#0C0C0E;text-decoration:none;font-size:14px;font-weight:700;padding:12px 20px;border-radius:10px;">View in ${esc(params.orgName)}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px;border-top:1px solid #2a2a35;">
                <p style="margin:0;color:#6a6a78;font-size:12px;">
                  You're getting this because alerts are on for this ${esc(noun)}. Turn them off any time by editing it in ${esc(params.orgName)}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text =
    `${who} ${verb} ${params.itemName}\n\n` +
    rows.map(([label, value]) => `${label}: ${value}`).join("\n") +
    `\n\nView in ${params.orgName}: ${params.manageUrl}\n\n` +
    `You're getting this because alerts are on for this ${noun}.`;

  return { subject, html, text };
}

export interface SendFounderAlertParams {
  itemType: FounderAlertItemType;
  itemId: string | Types.ObjectId;
  /**
   * The invoice backing this acquisition, when there is one. Doubles as the
   * de-dupe anchor — without it the caller owns idempotency.
   */
  invoice?: any;
  /** Who joined. Falls back to the invoice's customer fields. */
  joiner?: {
    userId?: string | Types.ObjectId | null;
    name?: string | null;
    email?: string | null;
  };
  /** Major units. Omitted/0 renders as "Free". */
  amount?: number;
  currency?: string;
}

/**
 * Sends the "someone joined" alert if the founder opted in for this item.
 * Never throws into the caller's path — an acquisition must stand even when
 * the notification about it fails.
 */
export async function sendFounderAlert({
  itemType,
  itemId,
  invoice,
  joiner,
  amount,
  currency,
}: SendFounderAlertParams): Promise<void> {
  const item = await loadItem(itemType, itemId);
  const alerts = item?.alerts;
  // The gate. Every call site is unconditional; this is what keeps orgs that
  // never turned it on from getting any mail at all.
  if (!item || !alerts?.enabled) return;

  const { User } = await import("../models/user.model");

  const owner: any = item.ownerId
    ? await User.findById(item.ownerId).select("email name").lean()
    : null;

  // Owner first, then the extra addresses the founder listed. De-duped so an
  // owner who also typed their own address doesn't get two copies.
  const seen = new Set<string>();
  const recipients: string[] = [];
  for (const candidate of [owner?.email, ...(alerts.recipients || [])]) {
    const email = String(candidate || "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push(email);
  }
  if (recipients.length === 0) {
    console.warn(
      `[founder-alert] no recipient for ${itemType} ${itemId} — skipping`,
    );
    return;
  }

  // Resolve the joiner. The invoice already carries a name/email for every
  // paid and $0-invoiced path; the userId lookup is for the phone/location
  // that makes the alert worth reading.
  let joinerName = joiner?.name || invoice?.customerName || "";
  let joinerEmail = joiner?.email || invoice?.customerEmail || "";
  let joinerPhone: string | null = null;
  let joinerLocation: string | null = null;

  const joinerUserId = joiner?.userId || invoice?.userId;
  if (joinerUserId) {
    const u: any = await User.findById(joinerUserId)
      .select("name email phone city state country")
      .lean();
    if (u) {
      joinerName = joinerName || u.name || "";
      joinerEmail = joinerEmail || u.email || "";
      joinerPhone = u.phone || null;
      joinerLocation =
        [u.city, u.state, u.country].filter(Boolean).join(", ") || null;
    }
  }
  if (!joinerEmail) {
    console.warn(
      `[founder-alert] no joiner identity for ${itemType} ${itemId} — skipping`,
    );
    return;
  }

  const { Invoice } = await import("../models/invoice.model");

  // Atomic claim — the de-dupe point for webhook/browser races, exactly as
  // orderEmail.ts does it. Paths with no invoice are idempotent at the call
  // site instead.
  if (invoice?._id) {
    const claimed = await Invoice.findOneAndUpdate(
      { _id: invoice._id, "metadata.founderAlertSentAt": { $exists: false } },
      { $set: { "metadata.founderAlertSentAt": new Date() } },
      { new: true },
    );
    if (!claimed) return;
  }

  try {
    const { Organization } = await import("../models/organization.model");
    const orgId = item.orgId || invoice?.organizationId;
    const org: any = orgId
      ? await Organization.findById(orgId).select("name").lean()
      : null;

    // `invoice.totalAmount` is minor units; the explicit `amount` argument is
    // major, matching what the checkout routes already have to hand.
    const resolvedAmount =
      typeof amount === "number"
        ? amount
        : (invoice?.totalAmount || 0) / 100;
    const resolvedCurrency =
      currency || invoice?.itemCurrency || invoice?.currency || "USD";

    const { subject, html, text } = buildFounderAlertEmail({
      itemType,
      itemName: item.name || "your offering",
      orgName: org?.name || "Garage",
      joinerName,
      joinerEmail,
      joinerPhone,
      joinerLocation,
      amountLabel:
        resolvedAmount > 0
          ? formatMoney(resolvedAmount, resolvedCurrency)
          : "Free",
      when: formatDateTime(invoice?.paidAt),
      manageUrl: buildManageUrl(itemType, itemId, orgId),
    });

    const from = await senderForOrg(orgId, EMAIL_FROM_NOTIFICATION);
    const [to, ...cc] = recipients;
    await sendMail(to, subject, html, text, from, cc.length ? cc : undefined);

    console.log(
      `[founder-alert] sent to ${recipients.join(", ")} — ${joinerEmail} on ${itemType} ${itemId}`,
    );
  } catch (err: any) {
    // Release the claim so a retry (webhook re-delivery, manual replay) can
    // still get the alert out.
    if (invoice?._id) {
      await Invoice.updateOne(
        { _id: invoice._id },
        { $unset: { "metadata.founderAlertSentAt": "" } },
      ).catch(() => undefined);
    }
    throw err;
  }
}

/**
 * Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail
 * the join it is announcing.
 */
export function queueFounderAlert(params: SendFounderAlertParams): void {
  void sendFounderAlert(params).catch((err: any) =>
    console.error(
      `[founder-alert] ${params.itemType} send failed:`,
      err?.message || err,
    ),
  );
}

/**
 * Invoice line-item types that map straight onto a `founderAlerts`-carrying
 * model, i.e. where `lineItems[0].itemId` IS the owning document's id.
 *
 * `event_ticket` is deliberately absent — its itemId is the ticket TIER, so
 * the event has to be resolved via the registration. Handled separately below.
 */
const INVOICE_ITEM_TYPE_MAP: Record<string, FounderAlertItemType> = {
  product: "product",
  course: "course",
  channel: "channel",
  workshop: "workshop",
  service: "service",
};

/**
 * Single entry point for the paid path: works out what was bought from the
 * invoice and fires the alert if the owner opted in.
 *
 * Safe to call for EVERY fulfilled invoice — invoices for things that carry no
 * `founderAlerts` config (office plans, wallet top-ups, franchise fees, …)
 * resolve to null and return without touching the database beyond the line
 * item already in hand.
 */
export async function sendFounderAlertForInvoice(invoice: any): Promise<void> {
  const primaryItem = invoice?.lineItems?.[0];
  if (!primaryItem) return;

  const amount = (invoice.totalAmount || 0) / 100;
  const currency = invoice.itemCurrency || "USD";

  const direct = INVOICE_ITEM_TYPE_MAP[primaryItem.itemType];
  if (direct) {
    await sendFounderAlert({
      itemType: direct,
      itemId: primaryItem.itemId,
      invoice,
      amount,
      currency,
    });
    return;
  }

  if (primaryItem.itemType === "event_ticket") {
    // The line item points at the tier; the event id lives on the
    // registration the checkout route created before taking payment.
    const registrationId = (invoice.metadata as any)?.eventRegistrationId;
    if (!registrationId) return;
    const { EventRegistration } = await import(
      "../models/eventRegistration.model"
    );
    const registration: any = await EventRegistration.findById(registrationId)
      .select("eventId")
      .lean();
    if (!registration?.eventId) return;
    await sendFounderAlert({
      itemType: "event",
      itemId: registration.eventId,
      invoice,
      amount,
      currency,
    });
  }
}

/** Fire-and-forget wrapper for `sendFounderAlertForInvoice`. */
export function queueFounderAlertForInvoice(invoice: any): void {
  void sendFounderAlertForInvoice(invoice).catch((err: any) =>
    console.error("[founder-alert] invoice send failed:", err?.message || err),
  );
}
