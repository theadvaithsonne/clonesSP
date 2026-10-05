// src/services/eventManagement.ts
//
// Shared logic for the Event Management module. Both the founder router
// (/event-management) and the public router (/public/event-management) import
// from here so the two can never drift on inventory, slugs or block defaults.

import { Types } from "mongoose";
import crypto from "crypto";
import {
  EventProgram,
  IEventProgram,
} from "../models/eventProgram.model";
import { EventTicketTier } from "../models/eventTicketTier.model";
import { EventRegistration } from "../models/eventRegistration.model";
import {
  EventWebsiteConfig,
  IEventWebsiteBlock,
  EventBlockType,
} from "../models/eventWebsiteConfig.model";
import { isFounderOrModuleAdmin } from "../utils/rbac";

/**
 * Events ride the existing "live_streams" RBAC module rather than adding a
 * new one — an org member trusted to run webinars is the same person trusted
 * to run the conference. Adding a module means touching the user schema and
 * every permission table, for no extra separation in practice.
 */
export async function canManageEvents(
  userId: string,
  orgId: string
): Promise<boolean> {
  return isFounderOrModuleAdmin(userId, orgId, "live_streams");
}

// ── Slugs ────────────────────────────────────────────────────────────────

export function slugify(input: string): string {
  return (input || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/**
 * A slug free at the moment of the call. Collisions are still possible under
 * concurrency — the unique index on EventProgram.slug is the real guard, and
 * the create route retries on duplicate key.
 */
export async function generateUniqueSlug(
  name: string,
  excludeId?: string
): Promise<string> {
  const base = slugify(name) || "event";
  for (let attempt = 0; attempt < 25; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const query: Record<string, any> = { slug: candidate };
    if (excludeId) query._id = { $ne: new Types.ObjectId(excludeId) };
    const clash = await EventProgram.exists(query);
    if (!clash) return candidate;
  }
  // Fall back to something that cannot collide.
  return `${base}-${crypto.randomBytes(4).toString("hex")}`;
}

// ── Check-in tokens ──────────────────────────────────────────────────────

/**
 * The QR payload. Unguessable by construction: it is NOT derived from the
 * registration id, because /public/event-management/ticket/:token resolves it
 * without any auth.
 */
export function newQrCodeToken(): string {
  return crypto.randomBytes(16).toString("base64url");
}

// ── Inventory ────────────────────────────────────────────────────────────

/**
 * Reserve `qty` seats on a tier, atomically.
 *
 * The `$expr` guard makes the increment conditional on there still being room
 * inside the same document update, so two buyers racing for the last seat
 * cannot both succeed. Returns false when the tier is sold out.
 */
export async function claimTierSeats(
  tierId: Types.ObjectId | string,
  qty: number
): Promise<boolean> {
  const res = await EventTicketTier.updateOne(
    {
      _id: new Types.ObjectId(tierId),
      $expr: { $lte: [{ $add: ["$soldCount", qty] }, "$quantity"] },
    },
    { $inc: { soldCount: qty } }
  );
  return res.modifiedCount === 1;
}

/** Give seats back after a failed checkout / cancelled registration. */
export async function releaseTierSeats(
  tierId: Types.ObjectId | string,
  qty: number
): Promise<void> {
  await EventTicketTier.updateOne(
    { _id: new Types.ObjectId(tierId), soldCount: { $gte: qty } },
    { $inc: { soldCount: -qty } }
  );
}

/**
 * How long a paid checkout may hold seats before they go back on sale.
 * Long enough to finish a card / UPI / crypto payment, short enough that an
 * abandoned cart doesn't strand inventory.
 */
export const SEAT_HOLD_MINUTES = 30;

/**
 * Hands back seats held by checkouts that were never paid for.
 *
 * There is no scheduler in this module, so this is a lazy sweep: it runs on
 * the paths that read or claim inventory. That is enough, because the only
 * thing an expired hold affects is what those same paths report.
 *
 * Scoped to one event so a page load never walks the whole collection.
 */
export async function releaseExpiredHolds(
  eventId: Types.ObjectId | string
): Promise<number> {
  const cutoff = new Date(Date.now() - SEAT_HOLD_MINUTES * 60 * 1000);
  const expired = await EventRegistration.find({
    eventId: new Types.ObjectId(eventId),
    paymentStatus: "pending",
    status: { $in: ["pending_approval", "approved"] },
    $or: [
      { holdExpiresAt: { $ne: null, $lt: new Date() } },
      // Rows written before `holdExpiresAt` existed have none, so they would
      // hold their seats forever. Age them off createdAt instead — this is
      // what lets an event stuck on abandoned test checkouts heal itself.
      { holdExpiresAt: null, createdAt: { $lt: cutoff } },
    ],
  })
    .select("_id ticketTierId quantity addons invoiceId")
    .lean();
  if (expired.length === 0) return 0;

  // The invoice has to close with the hold. Left open, the buyer could still
  // pay it after the seats went back on sale, and fulfillInvoice would have
  // no seat to give them. One invoice covers every seat in an order, so each
  // is settled once and the answer reused.
  const { cancelInvoice, getInvoice } = await import("./invoice");
  const invoiceClosed = new Map<string, boolean>();
  const closeInvoice = async (invoiceId: string): Promise<boolean> => {
    if (invoiceClosed.has(invoiceId)) return invoiceClosed.get(invoiceId)!;
    let closed = false;
    try {
      const invoice = await getInvoice(invoiceId);
      if (!invoice || ["cancelled", "expired"].includes(invoice.status)) {
        closed = true;
      } else if (invoice.status !== "paid") {
        await cancelInvoice(invoiceId);
        closed = true;
      }
      // Paid: payment raced the sweep. fulfillInvoice settles the seats, so
      // they must not be released here.
    } catch (err: any) {
      // A crypto or auto-charge payment may be in flight. Keep the hold and
      // let a later sweep retry once it has resolved.
      console.warn(
        `[events] hold on invoice ${invoiceId} kept: ${err?.message || err}`
      );
    }
    invoiceClosed.set(invoiceId, closed);
    return closed;
  };

  for (const reg of expired as any[]) {
    if (reg.invoiceId && !(await closeInvoice(String(reg.invoiceId)))) continue;
    // Flip the registration first. If the release below fails the seat is
    // merely still held — recoverable. The other order could double-release.
    const claimed = await EventRegistration.updateOne(
      { _id: reg._id, paymentStatus: "pending" },
      {
        $set: {
          status: "cancelled",
          rejectedReason: "Payment not completed in time",
          holdExpiresAt: null,
        },
      }
    );
    if (claimed.modifiedCount === 1) {
      await releaseTierSeats(reg.ticketTierId, reg.quantity || 1).catch(() => {});
      // Add-ons carry their own inventory, claimed in the same checkout, so
      // they expire with it.
      for (const a of (reg.addons || []) as any[]) {
        await releaseTierSeats(a.ticketTierId, a.quantity || 1).catch(() => {});
      }
    }
  }
  return expired.length;
}

/**
 * Real sales per tier, keyed by tier id.
 *
 * `soldCount` on the tier is an INVENTORY counter — it goes up the moment a
 * checkout starts, so it also contains unpaid holds. Reporting it as "sold"
 * showed 3 sold and revenue against tickets nobody had paid for. Anything the
 * founder reads as a sale is counted here instead, from the registrations.
 *
 * Revenue is the sum of what was actually charged, not quantity × list price,
 * so coupons and price changes can't rewrite history.
 */
export async function tierSalesStats(
  eventId: Types.ObjectId | string
): Promise<Map<string, { sold: number; revenue: number }>> {
  const match = {
    eventId: new Types.ObjectId(eventId),
    status: { $nin: ["rejected", "cancelled"] },
    paymentStatus: { $in: ["paid", "free"] },
  };

  const [tickets, addons] = await Promise.all([
    EventRegistration.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$ticketTierId",
          sold: { $sum: { $ifNull: ["$quantity", 1] } },
          revenue: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$amountPaid", 0],
            },
          },
        },
      },
    ]),
    // Add-on rows live inside the registration, so they need their own pass.
    // Revenue uses the price frozen at purchase, not the tier's price today.
    EventRegistration.aggregate([
      { $match: match },
      { $unwind: "$addons" },
      {
        $group: {
          _id: "$addons.ticketTierId",
          sold: { $sum: { $ifNull: ["$addons.quantity", 1] } },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$paymentStatus", "paid"] },
                {
                  $multiply: [
                    { $ifNull: ["$addons.unitPrice", 0] },
                    { $ifNull: ["$addons.quantity", 1] },
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const stats = new Map<string, { sold: number; revenue: number }>();
  for (const r of [...tickets, ...addons] as any[]) {
    const key = String(r._id);
    const prev = stats.get(key) || { sold: 0, revenue: 0 };
    stats.set(key, {
      sold: prev.sold + (r.sold || 0),
      revenue: prev.revenue + (r.revenue || 0),
    });
  }
  return stats;
}

/** Is this tier buyable right now? Reason string is safe to show a customer. */
export function tierSaleability(
  tier: {
    isVisible?: boolean;
    isPaused?: boolean;
    archivedAt?: Date | null;
    salesStart?: Date | null;
    salesEnd?: Date | null;
    quantity: number;
    soldCount: number;
  },
  qty = 1,
  now = new Date()
): { ok: boolean; reason?: string } {
  if (tier.archivedAt) return { ok: false, reason: "Ticket no longer available" };
  if (tier.isVisible === false) return { ok: false, reason: "Ticket not available" };
  if (tier.isPaused) return { ok: false, reason: "Sales are paused for this ticket" };
  if (tier.salesStart && now < new Date(tier.salesStart))
    return { ok: false, reason: "Sales have not started yet" };
  if (tier.salesEnd && now > new Date(tier.salesEnd))
    return { ok: false, reason: "Sales have closed for this ticket" };
  if (tier.soldCount + qty > tier.quantity)
    return { ok: false, reason: "Not enough tickets remaining" };
  return { ok: true };
}

// ── Coupons ──────────────────────────────────────────────────────────────

export interface EventCouponResult {
  ok: boolean;
  reason?: string;
  /** Discount in the smallest unit (cents/paise), matching the input. */
  discountMinor: number;
  couponId?: string;
  couponCode?: string;
  /** Only set when a platform (Garage-admin) coupon matched. */
  platformCouponCode?: string;
}

/**
 * Validate a coupon against an event, using the SAME engine every other paid
 * checkout uses (services/coupon.ts + utils/couponRouting.ts). Events do not
 * have a discount system of their own — a founder creates event coupons from
 * the existing Coupons surface with `applicableTo: ["event_ticket"]`.
 *
 * `itemId` is the EVENT, not the tier: a founder discounts "the summit", and
 * the discount then applies to whichever tier the buyer picked.
 *
 * Never throws — a coupon lookup failing must not take the checkout down.
 */
export async function resolveEventCoupon(opts: {
  code?: string;
  eventId: Types.ObjectId | string;
  orgId: Types.ObjectId | string;
  userId?: string;
  subtotalMinor: number;
}): Promise<EventCouponResult> {
  const code = (opts.code || "").trim();
  if (!code) return { ok: true, discountMinor: 0 };

  try {
    const { routeCoupon } = await import("../utils/couponRouting");
    const routed = await routeCoupon(code);

    // Platform coupons are resolved inside createInvoice — we only forward the
    // code and let the invoice engine apply and record it.
    if (routed.isPlatform) {
      return { ok: true, discountMinor: 0, platformCouponCode: code };
    }

    const { validateCoupon } = await import("./coupon");
    const result = await validateCoupon({
      code,
      itemType: "event_ticket",
      itemId: opts.eventId.toString(),
      amount: opts.subtotalMinor,
      userId: opts.userId,
      orgId: opts.orgId.toString(),
    });

    if (!result.valid) {
      return { ok: false, reason: result.error || "Invalid coupon", discountMinor: 0 };
    }
    return {
      ok: true,
      discountMinor: result.discountAmount || 0,
      couponId: result.coupon?._id?.toString(),
      couponCode: result.coupon?.code,
    };
  } catch (err: any) {
    console.error("[eventManagement] coupon validation failed:", err?.message);
    return { ok: false, reason: "Could not validate that coupon", discountMinor: 0 };
  }
}

// ── Metrics ──────────────────────────────────────────────────────────────

export interface EventMetrics {
  totalCapacity: number;
  ticketsSold: number;
  seatsRemaining: number;
  registrations: number;
  pendingApproval: number;
  approved: number;
  checkedIn: number;
  grossRevenue: number;
  currency: string;
}

export async function computeEventMetrics(
  event: Pick<IEventProgram, "_id" | "totalCapacity">
): Promise<EventMetrics> {
  const [tierAgg, regAgg, revenueAgg, sales] = await Promise.all([
    EventTicketTier.aggregate([
      { $match: { eventId: event._id, archivedAt: null } },
      { $group: { _id: null, held: { $sum: "$soldCount" } } },
    ]),
    EventRegistration.aggregate([
      { $match: { eventId: event._id } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          checkedIn: {
            $sum: { $cond: [{ $ifNull: ["$checkedInAt", false] }, 1, 0] },
          },
        },
      },
    ]),
    EventRegistration.aggregate([
      { $match: { eventId: event._id, paymentStatus: "paid" } },
      {
        $group: {
          _id: "$currency",
          gross: { $sum: "$amountPaid" },
        },
      },
    ]),
    // Admission only. `tierSalesStats` also counts add-ons, which are not
    // tickets — a t-shirt must not move "Tickets sold".
    EventRegistration.aggregate([
      {
        $match: {
          eventId: event._id,
          status: { $nin: ["rejected", "cancelled"] },
          paymentStatus: { $in: ["paid", "free"] },
        },
      },
      { $group: { _id: null, sold: { $sum: { $ifNull: ["$quantity", 1] } } } },
    ]),
  ]);

  const byStatus = Object.fromEntries(
    regAgg.map((r: any) => [r._id, r.count])
  ) as Record<string, number>;
  // Sales, not holds. `tierAgg` is the inventory total — it also contains
  // seats sitting in an unpaid checkout — so it only drives seatsRemaining.
  const ticketsSold = sales[0]?.sold || 0;
  const seatsHeld = tierAgg[0]?.held || 0;
  const registrations = regAgg.reduce((n: number, r: any) => n + r.count, 0);
  const checkedIn = regAgg.reduce((n: number, r: any) => n + (r.checkedIn || 0), 0);

  return {
    totalCapacity: event.totalCapacity,
    ticketsSold,
    seatsRemaining: Math.max(0, event.totalCapacity - seatsHeld),
    registrations,
    pendingApproval: byStatus["pending_approval"] || 0,
    approved: byStatus["approved"] || 0,
    checkedIn,
    grossRevenue: revenueAgg[0]?.gross || 0,
    currency: revenueAgg[0]?._id || "USD",
  };
}

// ── Website builder defaults ─────────────────────────────────────────────

function block(
  type: EventBlockType,
  order: number,
  content: Record<string, any>,
  styles: Record<string, string> = {}
): IEventWebsiteBlock {
  return {
    id: `${type}-${crypto.randomBytes(4).toString("hex")}`,
    type,
    order,
    isVisible: true,
    content,
    styles,
  };
}

/**
 * The starting canvas a founder sees the first time they open the builder.
 *
 * Every string here is either the organizer's own data or a neutral section
 * heading. Nothing invents a fact about the event — the earlier defaults
 * claimed "Two stages, one day", listed "Hands-on workshops" as a highlight
 * and shipped a made-up ticket-transfer policy in the FAQ, all of which would
 * have rendered verbatim on a live, paid page if the founder never opened the
 * builder. Blocks that would otherwise render empty or fabricated start
 * hidden instead, so the page shows less rather than something untrue.
 */
export function defaultWebsiteBlocks(
  event: Pick<
    IEventProgram,
    | "name"
    | "shortDescription"
    | "description"
    | "venue"
    | "startsAt"
    | "endsAt"
    | "timezone"
    | "format"
    | "category"
  >
): IEventWebsiteBlock[] {
  const summary = (event.shortDescription || "").trim();
  const long = (event.description || "").trim();
  const aboutBody = long || summary;
  const hasSummary = Boolean(aboutBody);

  // Auto-filled from what the organizer already entered in the wizard, so the
  // first open of the builder shows the real event rather than placeholders.
  // Every one of these is editable per block.
  const venueLine = [
    event.venue?.name,
    event.venue?.city,
    event.venue?.country,
  ]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");



  return [
    block("hero", 0, {
      headline: event.name,
      // Real summary or nothing — never an invented tagline.
      subheadline: summary,
      // Date, time and venue are NOT copied in here: the renderer reads them
      // live off the event, so moving the event updates the page. A snapshot
      // would quietly go stale.
      ctaLabel: "Get Tickets",
      showCountdown: true,
    }),
    // Hidden until there is something real to say. Shipping editor guidance
    // ("Tell attendees what this event is about…") as public body copy is
    // worse than shipping no About section at all.
    {
      ...block("about", 1, {
        heading: "About the event",
        // The long description if the organizer wrote one, else the summary.
        body: aboutBody,
        highlights: [],
      }),
      isVisible: hasSummary,
    },
    block("agenda", 2, { heading: "Agenda", subheading: "" }),
    block("speakers", 3, { heading: "Speakers", subheading: "" }),
    block("tickets", 4, { heading: "Tickets", subheading: "" }),
    block("sponsors", 5, { heading: "Our sponsors", subheading: "" }),
    block("venue_map", 6, {
      heading: event.format === "virtual" ? "Joining online" : "Venue",
      subheading: venueLine,
    }),
    // No starter questions: an unanswered FAQ is invisible, and an invented
    // answer is a policy the organizer never agreed to.
    { ...block("faq", 7, { heading: "FAQ", items: [] }), isVisible: false },
    block("cta_banner", 8, {
      headline: "Get your ticket",
      body: "",
      ctaLabel: "Get Tickets",
    }),
    block("footer", 9, {
      note: `© ${new Date().getFullYear()} ${event.name}. All rights reserved.`,
      links: [],
    }),
  ];
}

/** Fetch the config, creating it from defaults on first access. */
export async function ensureWebsiteConfig(event: IEventProgram) {
  let config = await EventWebsiteConfig.findOne({ eventId: event._id });
  if (config) return config;
  config = await EventWebsiteConfig.create({
    eventId: event._id,
    blocks: defaultWebsiteBlocks(event),
  });
  return config;
}

// ── Publish readiness ────────────────────────────────────────────────────

/**
 * What is still missing before this event can go live. Drives both the
 * publish gate and the Overview setup checklist, so the two agree.
 */
export async function publishChecklist(event: IEventProgram) {
  const tierCount = await EventTicketTier.countDocuments({
    eventId: event._id,
    archivedAt: null,
  });

  const items = [
    {
      key: "details",
      label: "Event name, dates and description",
      done: Boolean(event.name && event.startsAt && event.endsAt),
      required: true,
    },
    {
      key: "banner",
      label: "Cover image uploaded",
      done: Boolean(event.bannerUrl),
      required: false,
    },
    {
      key: "venue",
      label:
        event.format === "virtual"
          ? "Streaming destination set"
          : "Venue address added",
      done:
        event.format === "virtual"
          ? Boolean(
              event.streaming?.streamType &&
                (event.streaming.streamType !== "external_link" ||
                  event.streaming.externalUrl)
            )
          : Boolean(event.venue?.name && event.venue?.city),
      required: true,
    },
    {
      key: "capacity",
      label: "Capacity set",
      done: Number(event.totalCapacity) > 0,
      required: true,
    },
    {
      key: "tickets",
      label: "At least one ticket type",
      done: tierCount > 0,
      required: true,
    },
  ];

  const blockers = items.filter((i) => i.required && !i.done).map((i) => i.label);
  return { items, blockers, canPublish: blockers.length === 0 };
}

// ── Ticket email ─────────────────────────────────────────────────────────

/**
 * How many characters of the QR token the attendee is asked to quote.
 *
 * The site has always shown `qrCodeToken.slice(0, 12)` as the ticket id, so
 * that is what ends up written down and pasted back — the lookup has to accept
 * it, not just the full token. Kept here so the email, the ticket page and the
 * lookup can never drift apart.
 */
export const TICKET_ID_LENGTH = 12;

export const ticketIdOf = (qrCodeToken: string) =>
  String(qrCodeToken || "").slice(0, TICKET_ID_LENGTH);

/**
 * "Here is your ticket" — the one email an attendee actually needs.
 *
 * Lives in the service rather than in the public router because BOTH paths
 * have to send it: a free registration fires it inline, and a paid one fires
 * it from `fulfillInvoice` once the payment settles. It used to sit in the
 * router, which is why the paid path never sent anything at all — there was
 * nothing there it could reach without a service importing a route.
 *
 * Sent from EMAIL_FROM_NOTIFICATION, which is the category these belong to
 * (see mailer.ts). It previously went out under the OTP sender, a domain
 * reserved for login codes.
 */
export async function sendTicketEmail(
  event: any,
  registration: any,
  tier: any
): Promise<void> {
  const { sendMail, EMAIL_FROM_NOTIFICATION } = await import("./mailer");
  const to = registration?.attendee?.email;
  // Every failure here used to end up in a caller's `.catch(console.error)`
  // with no indication of who it was for, which made "nobody is getting the
  // email" impossible to tell apart from "we never tried". Both ends of the
  // attempt are logged now.
  if (!to) {
    console.error(
      `[ticket-email] registration ${registration?._id} has no attendee email — nothing sent`
    );
    return;
  }
  const appUrl = process.env.APP_URL || "https://my.garage.app";
  const ticketUrl = `${appUrl}/e/${event.slug}/ticket/${registration.qrCodeToken}`;
  const lookupUrl = `${appUrl}/events/${event.slug}/tickets`;

  // The id the attendee types into "My tickets", shown exactly as the site
  // shows it. A link is easily lost to a forwarded thread or a dead phone;
  // this plus their own email address gets the pass back from any device.
  const ticketId = ticketIdOf(registration.qrCodeToken);

  const pending = registration.status === "pending_approval";
  const subject = pending
    ? `Application received — ${event.name}`
    : `Your ticket for ${event.name}`;

  const idBlock = `
       <p style="margin:18px 0;padding:12px 14px;border:1px solid #e6e6e0;border-radius:8px">
         <span style="font-size:12px;color:#5f6070">Your ticket ID</span><br/>
         <strong style="font-family:monospace;font-size:16px;letter-spacing:1px">${ticketId}</strong>
       </p>
       <p style="font-size:12px;color:#5f6070">
         Lost this email? Enter that ticket ID and
         <strong>${registration.attendee?.email || "your email address"}</strong>
         at <a href="${lookupUrl}">${lookupUrl}</a> to pull your pass up again.
       </p>`;

  const html = pending
    ? `<p>Hi ${registration.attendee?.name || "there"},</p>
       <p>We have your application for <strong>${event.name}</strong>. The organizer will review it and you will hear back by email.</p>
       <p><a href="${ticketUrl}">Track your registration</a></p>${idBlock}`
    : `<p>Hi ${registration.attendee?.name || "there"},</p>
       <p>You're going to <strong>${event.name}</strong>.</p>
       <p>Ticket: ${tier?.name || "General admission"} × ${registration.quantity}</p>
       <p><a href="${ticketUrl}">View your ticket and QR code</a></p>${idBlock}`;

  const text = [
    `Hi ${registration.attendee?.name || "there"},`,
    pending
      ? `We have your application for ${event.name}.`
      : `You're going to ${event.name}.`,
    `Ticket ID: ${ticketId}`,
    `View your ticket: ${ticketUrl}`,
    `Lost this email? Enter that ticket ID and ${registration.attendee?.email || "your email"} at ${lookupUrl}`,
  ].join("\n\n");

  console.log(
    `[ticket-email] sending to ${to} for "${event?.name}" (${ticketId})`
  );
  try {
    await sendMail(to, subject, html, text, EMAIL_FROM_NOTIFICATION);
    console.log(`[ticket-email] sent to ${to} (${ticketId})`);
  } catch (err: any) {
    // Named explicitly, because the usual cause is an unverified sender
    // domain or a missing API key rather than anything about this ticket.
    console.error(
      `[ticket-email] FAILED for ${to} (${ticketId}) from ${EMAIL_FROM_NOTIFICATION}:`,
      err?.message,
      process.env.RESEND_API_KEY ? "" : "— RESEND_API_KEY is not set"
    );
    throw err;
  }
}
