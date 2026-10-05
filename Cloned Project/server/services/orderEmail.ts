import { Types } from "mongoose";
import { env } from "../config/env";
import { EMAIL_FROM_NOTIFICATION, sendMail } from "./mailer";

/**
 * Post-purchase order email, shared by products, courses and communities.
 *
 * The founder picks a Network Mail template in the item's form. That service is
 * separate from this API and authenticates with the browser's JWT, so we cannot
 * fetch the template here — the form snapshots the rendered HTML onto
 * `<item>.emailAlerts.templateHtml` and this module only substitutes merge tags
 * and hands it to Resend.
 */

/** Sellable items that can carry an `emailAlerts` config. */
export type OrderEmailItemType =
  | "product"
  | "course"
  | "channel"
  | "workshop";

/**
 * Naive `{{key}}` substitution, mirroring `affiliateEmailTemplates.render`.
 * Unmatched keys collapse to an empty string so a stray tag never reaches an inbox.
 */
export function renderMergeTags(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(
    /\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g,
    (_m, key: string) => {
      const v = vars[key];
      return v == null ? "" : String(v);
    },
  );
}

/** Merge values are user-authored (product names, customer names) — escape them. */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CURRENCY_SYMBOLS: Record<string, string> = { INR: "₹", USD: "$" };

function formatMoney(amount: number, currency?: string): string {
  const code = (currency || "USD").toUpperCase();
  const symbol = CURRENCY_SYMBOLS[code] || "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${code}`;
}

function formatDate(date?: Date | null): string {
  const d = date ? new Date(date) : new Date();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function firstNameOf(fullName?: string | null, email?: string | null): string {
  const name = String(fullName || "").trim();
  if (name) return name.split(/\s+/)[0];
  const local = String(email || "").split("@")[0];
  return local || "there";
}

/**
 * Ordered items as an HTML fragment, including the digital delivery links the
 * buyer actually needs. `order.items` amounts are major units (unlike
 * `invoice.totalAmount`, which is minor).
 *
 * Only product purchases create a ProductOrder; courses and communities fall
 * back to a single line built from the invoice's own item name.
 */
function buildOrderItemsHtml(
  order: any,
  fallbackName?: string,
  fallbackQuantity = 1,
): string {
  const items: any[] = Array.isArray(order?.items) ? order.items : [];
  if (items.length === 0) {
    return fallbackName
      ? `<strong>${esc(fallbackName)}</strong> × ${esc(fallbackQuantity)}`
      : "";
  }

  return items
    .map((item) => {
      const line = `<strong>${esc(item.productName)}</strong> × ${esc(item.quantity ?? 1)}`;
      const links: string[] = (item.digitalLinks || [])
        .filter((l: any) => l?.url)
        .map(
          (l: any) =>
            `<a href="${esc(l.url)}" target="_blank" style="color:#f5c518;text-decoration:underline;">${esc(l.label || "Open link")}</a>`,
        );
      const assets: string[] = (item.digitalAssets || [])
        .filter((a: any) => a?.fileUrl)
        .map(
          (a: any) =>
            `<a href="${esc(a.fileUrl)}" target="_blank" style="color:#f5c518;text-decoration:underline;">${esc(a.name || "Download")}</a>`,
        );
      const delivery = [...links, ...assets];
      return delivery.length
        ? `${line}<br>${delivery.join(" &nbsp;•&nbsp; ")}`
        : line;
    })
    .join("<br>");
}

/**
 * "Contact us at …" should reach the founder who actually sells the item.
 *
 * Preference order matters: the org's Mailcow mailbox (`mailboxConfig.email`) is
 * a provisioned @networkmail.com address that is often not a mailbox the founder
 * reads, so the real account email of the item's creator comes first.
 * Organization has no supportEmail field of its own.
 */
async function resolveSupportEmail(
  founderId: any,
  sellerId: any,
  org: any,
): Promise<string | null> {
  const { User } = await import("../models/user.model");
  for (const id of [founderId, sellerId]) {
    if (!id) continue;
    try {
      const user: any = await User.findById(id).select("email").lean();
      if (user?.email) return user.email;
    } catch {
      // fall through to the next candidate
    }
  }
  return org?.mailboxConfig?.email || null;
}

interface ResolvedItem {
  alerts: any;
  name: string;
  createdBy: any;
}

/**
 * Loads just the alert config off whichever collection owns the item. Each
 * model stores the same `emailAlerts` shape (models/emailAlerts.schema.ts);
 * only the display-name field differs.
 */
async function loadItem(
  itemType: OrderEmailItemType,
  itemId: string | Types.ObjectId,
): Promise<ResolvedItem | null> {
  switch (itemType) {
    case "product": {
      const { Product } = await import("../models/product.model");
      const doc: any = await Product.findById(itemId)
        .select("emailAlerts name createdBy")
        .lean();
      return doc
        ? { alerts: doc.emailAlerts, name: doc.name, createdBy: doc.createdBy }
        : null;
    }
    case "course": {
      const { Course } = await import("../models/course.model");
      const doc: any = await Course.findById(itemId)
        .select("emailAlerts title createdBy")
        .lean();
      return doc
        ? { alerts: doc.emailAlerts, name: doc.title, createdBy: doc.createdBy }
        : null;
    }
    case "channel": {
      const { Channel } = await import("../models/channel.model");
      const doc: any = await Channel.findById(itemId)
        .select("emailAlerts title createdBy")
        .lean();
      return doc
        ? { alerts: doc.emailAlerts, name: doc.title, createdBy: doc.createdBy }
        : null;
    }
    case "workshop": {
      const { Workshop } = await import("../models/workshop.model");
      const doc: any = await Workshop.findById(itemId)
        .select("emailAlerts title createdBy")
        .lean();
      return doc
        ? { alerts: doc.emailAlerts, name: doc.title, createdBy: doc.createdBy }
        : null;
    }
  }
}

/**
 * Where the "View Order" CTA lands. Products go to the orders tab (that is
 * where their download links live); courses and communities go straight to the
 * thing that was just bought, via the deep links `app/(dashboard)/layout.tsx`
 * already handles. `orgId` pins the seller's office — without it the buyer
 * lands in whichever office was last active.
 */
function buildItemUrl(
  itemType: OrderEmailItemType,
  itemId: string | Types.ObjectId,
  invoice: any,
  order: any,
): string {
  const params = new URLSearchParams();
  if (invoice.organizationId) {
    params.set("orgId", invoice.organizationId.toString());
  }

  switch (itemType) {
    case "product":
      // The dashboard is popover-driven rather than routed, so the Digital
      // Products → Orders tab is addressed by param. `order` scrolls to and
      // highlights this specific order once the list loads. The buyer is
      // always a member by now (`routes/productCheckout.ts` adds them as a
      // guest stakeholder on purchase), so pinning the office is safe.
      params.set("open", "product-orders");
      if (order?._id) params.set("order", order._id.toString());
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
      // No per-workshop deep link exists — an upcoming session has no room to
      // enter yet, so the layout's webinar handler only routes to a tab. Land
      // on the viewer's enrolled list, which is where the registration they
      // just made shows up.
      params.set("openApp", "webinar");
      params.set("tab", "enrolled");
      break;
  }

  return `${env.FRONTEND_URL}/workspace?${params.toString()}`;
}

export interface SendOrderEmailParams {
  /** Paid invoice document. Also the de-dupe anchor. */
  invoice: any;
  /** What was bought. */
  itemType: OrderEmailItemType;
  itemId: string | Types.ObjectId;
  /** ProductOrder for this purchase — products only; other flows have none. */
  order?: any;
  /** Seats bought, when there is no order record to read it from. */
  quantity?: number;
}

/**
 * Sends the order confirmation if the seller opted in. Safe to call from every
 * payment path: the send is claimed atomically on the invoice, so webhook /
 * browser races produce exactly one email.
 */
export async function sendOrderEmail({
  invoice,
  itemType,
  itemId,
  order,
  quantity,
}: SendOrderEmailParams): Promise<void> {
  const { Invoice } = await import("../models/invoice.model");

  const item = await loadItem(itemType, itemId);
  const alerts = item?.alerts;
  if (!alerts?.enabled || !alerts.templateHtml) return;

  const to = invoice?.customerEmail || order?.customerEmail;
  if (!to) {
    console.warn(
      `[order-email] no recipient for invoice ${invoice?._id} — skipping`,
    );
    return;
  }

  // Atomic claim. `fulfillInvoice` runs more than once per payment when a
  // webhook and the browser both land, so this is the de-dupe point.
  const claimed = await Invoice.findOneAndUpdate(
    { _id: invoice._id, "metadata.orderEmailSentAt": { $exists: false } },
    { $set: { "metadata.orderEmailSentAt": new Date() } },
    { new: true },
  );
  if (!claimed) return;

  try {
    const { Organization } = await import("../models/organization.model");
    const org: any = await Organization.findById(invoice.organizationId)
      .select("name icon description city state country mailboxConfig")
      .lean();

    const orderNumber = order?.orderNumber || invoice.invoiceNumber;
    const invoiceRef = invoice.invoiceNumber || invoice._id.toString();
    const invoicePageUrl = `${env.FRONTEND_URL}/invoice/${encodeURIComponent(invoiceRef)}`;
    const orderUrl = buildItemUrl(itemType, itemId, invoice, order);

    // `order.total` is in major units; `invoice.totalAmount` is minor. Prefer
    // the order record, which is what the buyer sees on their orders page.
    const total =
      typeof order?.total === "number"
        ? order.total
        : (invoice.totalAmount || 0) / 100;
    const currency = order?.currency || invoice.itemCurrency || "USD";

    const businessName = org?.name || "Garage";
    const supportEmail = await resolveSupportEmail(
      item?.createdBy,
      invoice.sellerId,
      org,
    );

    // The builder's Dynamic Fields picker offers member and organization tokens
    // in every template, so an order email has to resolve them too — an
    // unmatched key renders as nothing at all.
    const orgUrl = `${env.FRONTEND_URL}/workspace?orgId=${invoice.organizationId?.toString() || ""}`;

    const vars: Record<string, string> = {
      first_name: esc(firstNameOf(invoice.customerName, to)),
      user_name: esc(invoice.customerName || to),
      member_email: esc(to),
      business_name: esc(businessName),
      org_name: esc(businessName),
      org_description: esc(org?.description || ""),
      org_location: esc(
        [org?.city, org?.state, org?.country].filter(Boolean).join(", "),
      ),
      org_icon: esc(org?.icon || ""),
      org_url: orgUrl,
      dashboard_url: orgUrl,
      support_option: esc(supportEmail || "our support team"),
      support_email: esc(supportEmail || "our support team"),
      order_number: esc(orderNumber),
      order_date: esc(formatDate(invoice.paidAt || order?.createdAt)),
      order_total: esc(formatMoney(total, currency)),
      order_items: buildOrderItemsHtml(order, item?.name, quantity || 1),
      order_url: orderUrl,
      // Razorpay-hosted invoice when one exists; otherwise our own invoice page
      // so the CTA is never a dead link. Deliberately not `orderUrl` — that
      // points at the purchased item, which is not an invoice.
      invoice_url: invoice.invoiceShortUrl || invoicePageUrl,
      // There is no unsubscribe route in the app, and an order confirmation is
      // transactional anyway — a mailto to the seller is a link that actually
      // works rather than one that 404s.
      unsubscribe_url: supportEmail
        ? `mailto:${supportEmail}?subject=${encodeURIComponent("Unsubscribe from order emails")}`
        : env.FRONTEND_URL,
    };

    // Drop images left with an empty src (a seller with no org logo) — a merge
    // tag cannot remove the tag that holds it, and a broken image would ship.
    const html = renderMergeTags(alerts.templateHtml, vars).replace(
      /<img\b[^>]*\bsrc\s*=\s*(""|'')[^>]*>/gi,
      "",
    );
    const subject = `Order Confirmed — ${businessName}`;

    await sendMail(to, subject, html, undefined, EMAIL_FROM_NOTIFICATION);
    console.log(
      `[order-email] sent to ${to} for ${itemType} order ${orderNumber} (invoice ${invoiceRef})`,
    );
  } catch (err: any) {
    // Release the claim so a retry (webhook re-delivery, manual replay) can
    // still get the email out.
    await Invoice.updateOne(
      { _id: invoice._id },
      { $unset: { "metadata.orderEmailSentAt": "" } },
    ).catch(() => undefined);
    throw err;
  }
}

/**
 * Fire-and-forget wrapper for fulfilment paths: a mail failure must never fail
 * the purchase it is confirming.
 */
export function queueOrderEmail(params: SendOrderEmailParams): void {
  void sendOrderEmail(params).catch((err: any) =>
    console.error(
      `[order-email] ${params.itemType} send failed:`,
      err?.message,
    ),
  );
}
