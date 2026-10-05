// src/routes/publicEventManagement.ts
//
// Unauthenticated customer API behind the public event landing page.
// Mounted at /public/event-management.
//
// Rules that hold for every route here:
//   - only `status: "published"`, non-deleted, non-private events resolve;
//   - only tiers with `isVisible` and no `archivedAt` are ever returned;
//   - the website blocks served are the PUBLISHED snapshot, never the draft.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { EventProgram } from "../models/eventProgram.model";
import { EventTicketTier } from "../models/eventTicketTier.model";
import {
  EventRegistration,
  IEventRegistration,
} from "../models/eventRegistration.model";
import { EventSpeaker } from "../models/eventSpeaker.model";
import { EventAgendaSession } from "../models/eventAgendaSession.model";
import { EventSponsor } from "../models/eventSponsor.model";
import { EventWebsiteConfig } from "../models/eventWebsiteConfig.model";
import {
  EventRegistrationForm,
  ATTENDEE_FIELD_MAP,
  defaultFormFields,
  IEventFormField,
} from "../models/eventRegistrationForm.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { softAuth, requireAuth } from "../middleware/auth";
import {
  newQrCodeToken,
  claimTierSeats,
  releaseTierSeats,
  releaseExpiredHolds,
  SEAT_HOLD_MINUTES,
  tierSaleability,
  resolveEventCoupon,
  defaultWebsiteBlocks,
  sendTicketEmail,
  ticketIdOf,
  TICKET_ID_LENGTH,
} from "../services/eventManagement";
import { createInvoice, cancelInvoice, getInvoice } from "../services/invoice";

const router = Router();

function bad(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

/**
 * The published event behind a public identifier, or null (response sent).
 *
 * Accepts the slug or the raw event id. The canonical URL is /events/<slug>,
 * but ids are handed out by the API and by anything that linked before the
 * route was renamed, so both have to resolve.
 */
async function loadPublicEvent(idOrSlug: string, res: Response) {
  const key = (idOrSlug || "").toLowerCase();
  const visible = { status: "published", deletedAt: null, isPrivate: false };
  const event = await EventProgram.findOne(
    Types.ObjectId.isValid(key)
      ? { $or: [{ slug: key }, { _id: new Types.ObjectId(key) }], ...visible }
      : { slug: key, ...visible }
  ).lean();
  if (!event) {
    bad(res, 404, "Event not found");
    return null;
  }
  return event as any;
}

/**
 * A cart line: one admission tier and how many of it.
 *
 * Quote, register and checkout all accept either `items: [{…}]` (a buyer who
 * picked General Admission AND a VIP pass in one go) or the original single
 * `ticketTierId` + `quantity` pair. The old shape is still what a link with
 * one tier produces, and older clients still send it, so both normalise to
 * the same array here rather than being handled twice downstream.
 */
const cartItemSchema = z.object({
  ticketTierId: z.string(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

const cartSchema = z.object({
  items: z.array(cartItemSchema).min(1).max(10).optional(),
  ticketTierId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(20).default(1),
});

type CartItem = z.infer<typeof cartItemSchema>;

/**
 * The cart as a list, or null when the body names no ticket at all.
 *
 * Duplicate tiers are merged: two lines for the same pass would claim seats
 * twice and print two registrations for what the buyer sees as one row.
 */
function normaliseCart(input: z.infer<typeof cartSchema>): CartItem[] | null {
  const raw: CartItem[] = input.items?.length
    ? input.items
    : input.ticketTierId
      ? [{ ticketTierId: input.ticketTierId, quantity: input.quantity }]
      : [];
  if (!raw.length) return null;

  const merged = new Map<string, number>();
  for (const item of raw) {
    merged.set(
      item.ticketTierId,
      Math.min(20, (merged.get(item.ticketTierId) || 0) + item.quantity)
    );
  }
  return [...merged].map(([ticketTierId, quantity]) => ({ ticketTierId, quantity }));
}

/** Strip anything the customer has no business seeing off a tier. */
function publicTier(t: any) {
  const remaining = Math.max(0, t.quantity - t.soldCount);
  return {
    _id: t._id,
    name: t.name,
    description: t.description,
    perks: t.perks || [],
    price: t.price,
    currency: t.currency,
    remaining,
    // Exact stock is a pressure lever an organizer may not want to publish;
    // it's also the number the checkout needs. Keep it, but never the raw
    // soldCount / revenue.
    soldOut: remaining <= 0,
    isPaused: !!t.isPaused,
    salesStart: t.salesStart,
    salesEnd: t.salesEnd,
    onSale: tierSaleability(t).ok,
  };
}

// ══ Browse ═══════════════════════════════════════════════════════════════

/**
 * GET /public/event-management?orgId=…&city=…&category=…
 *
 * The attendee-facing catalogue: every published, non-private event, for one
 * org or — with no orgId — across all of them, which is what the app's
 * discover rail lists. Unauthenticated on purpose — it is the same data the
 * public landing pages already expose, just listed. Drafts, private events
 * and soft-deleted events never appear.
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const parsed = z
      .object({
        orgId: z.string().optional(),
        when: z.enum(["upcoming", "past", "all"]).default("upcoming"),
        search: z.string().optional(),
        city: z.string().max(120).optional(),
        category: z.string().max(120).optional(),
        limit: z.coerce.number().int().min(1).max(60).default(30),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .safeParse(req.query);
    if (!parsed.success) return bad(res, 400, "Invalid filters");
    const { orgId, when, search, city, category, limit, offset } = parsed.data;
    if (orgId && !Types.ObjectId.isValid(orgId)) return bad(res, 400, "Invalid orgId");

    const query: Record<string, any> = {
      status: "published",
      deletedAt: null,
      isPrivate: false,
    };
    if (orgId) query.orgId = new Types.ObjectId(orgId);
    if (city?.trim())
      query["venue.city"] = { $regex: `^${escapeRegExp(city.trim())}$`, $options: "i" };
    if (category?.trim())
      query.category = { $regex: `^${escapeRegExp(category.trim())}$`, $options: "i" };
    // "Upcoming" keys off endsAt, not startsAt — a two-day conference on its
    // second morning is still running, not past.
    if (when === "upcoming") query.endsAt = { $gte: new Date() };
    else if (when === "past") query.endsAt = { $lt: new Date() };
    if (search?.trim())
      query.name = { $regex: escapeRegExp(search.trim()), $options: "i" };

    const [events, total] = await Promise.all([
      EventProgram.find(query)
        .select(
          "_id orgId name slug shortDescription startsAt endsAt timezone category language bannerUrl format venue totalCapacity requireApproval"
        )
        .sort({ startsAt: when === "past" ? -1 : 1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      EventProgram.countDocuments(query),
    ]);

    // Cheapest visible tier per event, so cards can show "From $X" without the
    // client fetching each event's landing payload.
    const ids = events.map((e: any) => e._id);
    const priced = await EventTicketTier.aggregate([
      // Admission only: an $8 t-shirt add-on is not what "From $X" means.
      {
        $match: {
          eventId: { $in: ids },
          archivedAt: null,
          isVisible: true,
          kind: { $ne: "addon" },
        },
      },
      { $sort: { price: 1 } },
      {
        $group: {
          _id: "$eventId",
          fromPrice: { $first: "$price" },
          currency: { $first: "$currency" },
          remaining: { $sum: { $subtract: ["$quantity", "$soldCount"] } },
        },
      },
    ]);
    const priceBy = new Map(priced.map((p: any) => [p._id.toString(), p]));

    res.json({
      success: true,
      total,
      events: events.map((e: any) => {
        const p = priceBy.get(e._id.toString());
        return {
          ...e,
          fromPrice: p?.fromPrice ?? null,
          currency: p?.currency ?? "USD",
          seatsRemaining: Math.max(0, p?.remaining ?? 0),
          soldOut: p ? p.remaining <= 0 : false,
        };
      }),
    });
  } catch (err) {
    console.error("[public/event-management] browse failed:", err);
    bad(res, 500, "Failed to load events");
  }
});

/**
 * GET /public/event-management/resolve-domain?host=…
 *
 * Maps a custom domain to the event slug it serves. The Next.js middleware
 * calls this on requests for unknown hosts, so it is deliberately tiny and
 * only ever answers for a VERIFIED domain — a pending one resolving here
 * would let anyone serve their page on a domain they hadn't proven they own.
 *
 * Declared before `/:slug` so "resolve-domain" is never read as a slug.
 */
router.get("/resolve-domain", async (req: Request, res: Response) => {
  try {
    const host = String(req.query.host || "")
      .toLowerCase()
      .split(":")[0]
      .replace(/\.$/, "")
      .trim();
    if (!host) return res.json({ success: true, slug: null });

    const config = await EventWebsiteConfig.findOne({
      "domain.host": host,
      "domain.status": "verified",
    })
      .select("eventId")
      .lean();
    if (!config) return res.json({ success: true, slug: null });

    // The event still has to be publicly viewable — unpublishing an event
    // must take its custom domain down with it.
    const event = await EventProgram.findOne({
      _id: (config as any).eventId,
      status: "published",
      deletedAt: null,
      isPrivate: false,
    })
      .select("slug")
      .lean();

    res.json({ success: true, slug: (event as any)?.slug || null });
  } catch (err) {
    console.error("[public/event-management] resolve-domain failed:", err);
    // Never 500 a router lookup — an error here would take the page down.
    res.json({ success: true, slug: null });
  }
});

// ══ Landing page payload ═════════════════════════════════════════════════

/**
 * GET /public/event-management/:slug
 * Everything the landing page renders, in one round-trip.
 */
router.get("/:slug", async (req: Request, res: Response) => {
  try {
    const event = await loadPublicEvent(req.params.slug, res);
    if (!event) return;

    // Free up seats from abandoned checkouts before quoting availability,
    // otherwise a page that looks sold out never recovers.
    await releaseExpiredHolds(event._id);

    const [tiers, speakers, sessions, sponsors, config, org, form] =
      await Promise.all([
      EventTicketTier.find({
        eventId: event._id,
        archivedAt: null,
        isVisible: true,
      })
        .sort({ sortOrder: 1 })
        .lean(),
      EventSpeaker.find({ eventId: event._id }).sort({ sortOrder: 1 }).lean(),
      EventAgendaSession.find({ eventId: event._id })
        .sort({ startTime: 1, sortOrder: 1 })
        .lean(),
      EventSponsor.find({ eventId: event._id }).lean(),
      EventWebsiteConfig.findOne({ eventId: event._id }).lean(),
      Organization.findById(event.orgId)
        .select("_id name slug icon coverPhoto description")
        .lean(),
      EventRegistrationForm.findOne({ eventId: event._id }).lean(),
    ]);
    const [registered] = await EventRegistration.aggregate([
      {
        $match: {
          eventId: event._id,
          status: "approved",
          paymentStatus: { $in: ["free", "paid"] },
        },
      },
      { $group: { _id: null, seats: { $sum: { $ifNull: ["$quantity", 1] } } } },
    ]);

    // Flat ordering. Sponsors are shown as one uniform wall of logos rather
    // than banded by tier, so the organizer's own order is the only order.
    // `tier` is still stored and still returned; nothing reads it to rank.
    sponsors.sort((a: any, b: any) => a.sortOrder - b.sortOrder);

    // Published snapshot only. If the organizer never opened the builder we
    // fall back to the default layout so the page is still a real page rather
    // than a blank screen.
    const published = (config as any)?.isPublished
      ? (config as any).publishedBlocks
      : null;
    const blocks = (published?.length ? published : defaultWebsiteBlocks(event))
      .filter((b: any) => b.isVisible !== false)
      .sort((a: any, b: any) => a.order - b.order);
    const theme =
      ((config as any)?.isPublished && (config as any).publishedTheme) ||
      (config as any)?.theme || {
        primaryColor: "#FACC15",
        backgroundColor: "#0c0c0e",
        font: "Inter",
      };

    const admission = tiers.filter((t: any) => (t.kind || "ticket") === "ticket");
    // The headline numbers the app shows under About. Days counts calendar
    // spans, so a 9am-to-6pm-two-days-later conference reads as 3.
    const spanMs = new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime();
    const stats = {
      days: Math.max(1, Math.ceil(spanMs / 86_400_000)),
      sessions: sessions.filter((x: any) => x.sessionType !== "break").length,
      speakers: speakers.length,
      attendees: registered?.seats ?? 0,
    };
    // When the soonest on-sale admission tier stops selling — the app's
    // "Ends in" countdown. Null when nothing on sale has an end date.
    const salesEndAt =
      admission
        .filter((t: any) => t.salesEnd && tierSaleability(t).ok)
        .map((t: any) => new Date(t.salesEnd).getTime())
        .sort((a: number, b: number) => a - b)[0] ?? null;
    // The FAQ lives in a website block; flattened so a client needn't know
    // the builder's block format.
    const faq = ((blocks.find((b: any) => b.type === "faq")?.content?.items || []) as any[])
      .filter((i) => i?.q && i?.a)
      .map((i) => ({ q: String(i.q), a: String(i.a) }));

    res.json({
      success: true,
      stats,
      salesEndAt: salesEndAt ? new Date(salesEndAt) : null,
      faq,
      event: {
        _id: event._id,
        name: event.name,
        slug: event.slug,
        shortDescription: event.shortDescription,
        description: event.description,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        category: event.category,
        language: event.language,
        bannerUrl: event.bannerUrl,
        format: event.format,
        venue: event.venue,
        // Never leak the LiveKit room id publicly — the join flow issues its
        // own token server-side.
        streaming: {
          streamType: event.streaming?.streamType,
          externalUrl: event.streaming?.externalUrl,
        },
        requireApproval: event.requireApproval,
        addGstForIndianBuyers: event.addGstForIndianBuyers,
        gstInclusive: event.gstInclusive,
        totalCapacity: event.totalCapacity,
      },
      organization: org || null,
      website: {
        blocks,
        theme,
        // Rendered into <head> by the public page, and into the site header.
        branding: (config as any)?.branding || {},
        seo: (config as any)?.seo || { keywords: [], noIndex: false },
        social: (config as any)?.social || {
          twitterCard: "summary_large_image",
        },
        customDomain:
          (config as any)?.domain?.status === "verified"
            ? (config as any).domain.host
            : null,
      },
      // Admission and add-ons are split for the buyer: one is the thing you
      // choose, the other is what you tack on afterwards.
      tiers: admission.map(publicTier),
      addons: tiers.filter((t: any) => t.kind === "addon").map(publicTier),
      speakers,
      sessions,
      sponsors,
      // The organizer's registration form. Falls back to the defaults so a
      // buyer is never shown a form with no fields just because the builder
      // was never opened.
      form: {
        title: (form as any)?.title || `Register for ${event.name}`,
        description:
          (form as any)?.description ||
          "Please fill out this form to complete your ticket registration.",
        fields: ((form as any)?.fields?.length
          ? (form as any).fields
          : defaultFormFields()
        )
          .slice()
          .sort((a: any, b: any) => a.order - b.order),
      },
    });
  } catch (err) {
    console.error("[public/event-management] landing failed:", err);
    bad(res, 500, "Failed to load event");
  }
});

// ══ Quote (promo preview) ════════════════════════════════════════════════

/**
 * POST /public/event-management/:slug/quote
 * Price a selection before the customer commits — promo validation + GST, so
 * the drawer's fee breakdown matches what checkout will actually charge.
 */
router.post("/:slug/quote", async (req: Request, res: Response) => {
  try {
    const event = await loadPublicEvent(req.params.slug, res);
    if (!event) return;

    const parsed = cartSchema
      .extend({
        promoCode: z.string().optional(),
        country: z.string().optional(),
        addons: z.array(cartItemSchema).max(10).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return bad(res, 400, "Invalid selection");
    const { promoCode, country } = parsed.data;
    const addonInput = parsed.data.addons || [];

    const cart = normaliseCart(parsed.data);
    if (!cart) return bad(res, 400, "Invalid ticket");
    if (cart.some((i) => !Types.ObjectId.isValid(i.ticketTierId)))
      return bad(res, 400, "Invalid ticket");

    const tiers = await EventTicketTier.find({
      _id: { $in: cart.map((i) => new Types.ObjectId(i.ticketTierId)) },
      eventId: event._id,
      archivedAt: null,
      isVisible: true,
    }).lean();
    const tierById = new Map(tiers.map((t: any) => [String(t._id), t]));
    if (tierById.size !== cart.length) return bad(res, 404, "Ticket not found");

    // The order is priceable only if every line in it is. The first blocked
    // line is the one reported, since that is the one the buyer has to change.
    const blocked = cart
      .map((i) => tierSaleability(tierById.get(i.ticketTierId) as any, i.quantity))
      .find((s) => !s.ok);
    const sale = blocked || { ok: true as const, reason: undefined };

    const ticketsTotal = cart.reduce(
      (sum, i) => sum + (tierById.get(i.ticketTierId) as any).price * i.quantity,
      0
    );

    // Add-ons are part of the order, so the coupon and the tax see them.
    const addonIds = addonInput
      .filter((a) => Types.ObjectId.isValid(a.ticketTierId))
      .map((a) => new Types.ObjectId(a.ticketTierId));
    const addonTiers = addonIds.length
      ? await EventTicketTier.find({
          _id: { $in: addonIds },
          eventId: event._id,
          kind: "addon",
          archivedAt: null,
          isVisible: true,
        })
          .select("_id price")
          .lean()
      : [];
    const addonPrice = new Map(
      addonTiers.map((t: any) => [String(t._id), t.price as number])
    );
    const addonsTotal = addonInput.reduce(
      (sum, a) => sum + (addonPrice.get(a.ticketTierId) ?? 0) * a.quantity,
      0
    );

    const subtotal = ticketsTotal + addonsTotal;

    // Minor units, because the shared coupon engine works in paise/cents.
    const coupon = await resolveEventCoupon({
      code: promoCode,
      eventId: event._id,
      orgId: event.orgId,
      subtotalMinor: Math.round(subtotal * 100),
    });
    const discount = coupon.discountMinor / 100;

    const discounted = Math.max(0, subtotal - discount);
    const gstApplies =
      !!event.addGstForIndianBuyers &&
      String(country || "").trim().toLowerCase() === "india" &&
      discounted > 0;
    // Inclusive pricing means the tax is already inside `discounted`, so the
    // quote shows it as a line but never adds it to the total — otherwise the
    // quote and the invoice would disagree by 18%.
    const tax = gstApplies
      ? event.gstInclusive
        ? Math.round((discounted - discounted / 1.18) * 100) / 100
        : Math.round(discounted * 0.18 * 100) / 100
      : 0;
    const total = gstApplies && event.gstInclusive ? discounted : discounted + tax;

    res.json({
      success: true,
      available: sale.ok,
      unavailableReason: sale.reason,
      // Tiers of one event share a currency — the console writes it per tier
      // but never lets them diverge — so the first line speaks for the order.
      currency: (tierById.get(cart[0].ticketTierId) as any).currency,
      subtotal,
      addonsTotal,
      discount,
      promoValid: coupon.ok,
      promoError: coupon.ok ? undefined : coupon.reason,
      // A platform coupon's discount is computed inside the invoice engine, so
      // the quote can only confirm the code is recognised, not price it.
      promoDeferred: !!coupon.platformCouponCode,
      taxRate: gstApplies ? 18 : 0,
      tax,
      taxInclusive: gstApplies ? !!event.gstInclusive : false,
      total: Math.round(total * 100) / 100,
      requiresApproval: !!event.requireApproval,
    });
  } catch (err) {
    console.error("[public/event-management] quote failed:", err);
    bad(res, 500, "Failed to price this selection");
  }
});

/**
 * Validate a buyer's answers against the organizer's form.
 *
 * Runs server-side because the form is public data — a caller can post
 * anything, and "required" enforced only in the browser is not enforced.
 * Returns the answers to store, stripped of anything not on the form, plus
 * any attendee overrides the standard fields imply.
 */
/** Escape a user-supplied string for use inside a RegExp. */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Choice comparison key: whitespace- and case-insensitive. */
const normaliseChoice = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

async function validateFormAnswers(
  eventId: Types.ObjectId,
  ticketTierId: string,
  raw: Record<string, unknown>
): Promise<
  | { ok: true; answers: Record<string, unknown> }
  | { ok: false; error: string }
> {
  const form = await EventRegistrationForm.findOne({ eventId }).lean();
  const fields: IEventFormField[] = ((form as any)?.fields?.length
    ? (form as any).fields
    : defaultFormFields()) as IEventFormField[];

  const answers: Record<string, unknown> = {};

  for (const field of fields) {
    // A hidden field is not asked, so it is never required and its answer is
    // discarded — otherwise a caller could satisfy a rule by posting a value
    // for a question the form never showed them.
    const visible = (field.conditions || []).every((c) => {
      if (c.source !== "ticket_type") return true;
      const hit = (c.values || []).includes(ticketTierId);
      return c.operator === "is" ? hit : !hit;
    });
    if (!visible) continue;

    // Standard fields are validated by the attendee schema, not here.
    if (ATTENDEE_FIELD_MAP[field.type]) continue;

    const value = raw?.[field.key];
    const isConsent =
      field.type === "terms" ||
      field.type === "marketing_opt_in" ||
      field.type === "photo_consent";

    if (isConsent) {
      const checked = value === true || value === "true";
      if (field.required && !checked)
        return { ok: false, error: `Please accept "${field.label}"` };
      answers[field.key] = checked;
      continue;
    }

    // Choices are matched on their trimmed, case-folded form and stored as the
    // organizer spelled them. Options saved before they were trimmed carry
    // stray whitespace, and the browser posts back the value it was given —
    // an exact-string match rejected those as "an invalid selection" even
    // though the buyer picked one of the offered choices.
    const matchOption = (raw: string): string | undefined =>
      field.options.find((o) => normaliseChoice(o) === normaliseChoice(raw));

    if (field.type === "multi_select") {
      const list = Array.isArray(value)
        ? (value
            .map(String)
            .map(matchOption)
            .filter(Boolean) as string[])
        : [];
      if (field.required && list.length === 0)
        return { ok: false, error: `"${field.label}" is required` };
      answers[field.key] = list;
      continue;
    }

    const text = typeof value === "string" ? value.trim() : "";
    if (field.required && !text)
      return { ok: false, error: `"${field.label}" is required` };
    if (field.type === "dropdown" && text) {
      const chosen = matchOption(text);
      if (!chosen)
        return { ok: false, error: `"${field.label}" has an invalid selection` };
      answers[field.key] = chosen;
      continue;
    }
    if (text) answers[field.key] = text.slice(0, 2000);
  }

  return { ok: true, answers };
}

// ── Attendee resolution ──────────────────────────────────────────────────

const attendeeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  country: z.string().max(120).optional(),
});

/**
 * One named person per seat.
 *
 * A two-ticket order is two people, and each is scanned in separately, so each
 * needs its own name, email, answers and QR code. Orders placed before this
 * existed — and any client that still posts a single `attendee` — collapse to
 * one seat per tier carrying the whole quantity, which is the old behaviour.
 */
const seatSchema = z.object({
  ticketTierId: z.string(),
  attendee: attendeeSchema,
  answers: z.record(z.string(), z.any()).optional(),
});

type Seat = z.infer<typeof seatSchema>;

/**
 * Expand the cart into one entry per seat, or an error the caller returns.
 *
 * The count per tier has to match the cart exactly. That is what stops an
 * "add attendee" button from minting seats nobody paid for: the quantity the
 * buyer selected is the only thing that decides how many people the order
 * holds, and the list is checked against it rather than trusted.
 */
function resolveSeats(
  cart: CartItem[],
  seats: Seat[] | undefined,
  fallbackAttendee: z.infer<typeof attendeeSchema>,
  fallbackAnswers: Record<string, unknown>
): { ok: true; seats: Array<Seat & { quantity: number }> } | { ok: false; error: string } {
  if (!seats?.length) {
    return {
      ok: true,
      seats: cart.map((i) => ({
        ticketTierId: i.ticketTierId,
        attendee: fallbackAttendee,
        answers: fallbackAnswers,
        quantity: i.quantity,
      })),
    };
  }

  const wanted = new Map(cart.map((i) => [i.ticketTierId, i.quantity]));
  const given = new Map<string, number>();
  for (const s of seats)
    given.set(s.ticketTierId, (given.get(s.ticketTierId) || 0) + 1);

  for (const [tierId, qty] of wanted) {
    const count = given.get(tierId) || 0;
    if (count !== qty)
      return {
        ok: false,
        error: `Add details for all ${qty} attendee${qty === 1 ? "" : "s"} on this ticket`,
      };
  }
  for (const tierId of given.keys())
    if (!wanted.has(tierId)) return { ok: false, error: "Invalid ticket" };

  // Two seats on one email would be one person holding two passes that the
  // per-email guard below then treats as a duplicate registration.
  const emails = seats.map((s) => s.attendee.email.toLowerCase().trim());
  if (new Set(emails).size !== emails.length)
    return { ok: false, error: "Each attendee needs their own email address" };

  return { ok: true, seats: seats.map((s) => ({ ...s, quantity: 1 })) };
}

/**
 * The User behind a guest checkout.
 *
 * Paid tickets need a real User because the invoice engine keys everything off
 * `userId`. Free registrations do not — we still attach one when the email is
 * already known, so the attendee sees the ticket in their account.
 */
async function resolveAttendeeUser(
  email: string,
  name: string,
  orgId: Types.ObjectId,
  createIfMissing: boolean
) {
  const normalized = email.toLowerCase().trim();
  let user = await User.findOne({ email: normalized });
  if (user || !createIfMissing) return user;

  user = await User.create({
    email: normalized,
    name: name?.trim() || undefined,
    guest: true,
    isVerified: true,
    organization: orgId,
  });
  return user;
}

/**
 * Close an unpaid order: cancel its invoice, then cancel every seat on it
 * and hand the seats and add-ons back. Throws when the invoice can't be
 * cancelled (already paid, or a payment is in flight), leaving it untouched.
 */
async function cancelUnpaidOrder(invoiceId: string) {
  const invoice = await getInvoice(invoiceId);
  if (!invoice) throw new Error("Order not found");
  if (invoice.status === "paid") throw new Error("This order is already paid");
  if (!["cancelled", "expired"].includes(invoice.status))
    await cancelInvoice(invoice._id.toString());

  const seats = await EventRegistration.find({
    invoiceId: invoice._id,
    paymentStatus: "pending",
    status: { $ne: "cancelled" },
  })
    .select("_id ticketTierId quantity addons")
    .lean();
  for (const reg of seats as any[]) {
    // Conditional flip first, so a concurrent sweep can't release twice.
    const flipped = await EventRegistration.updateOne(
      { _id: reg._id, paymentStatus: "pending", status: { $ne: "cancelled" } },
      {
        $set: {
          status: "cancelled",
          rejectedReason: "Order cancelled before payment",
          holdExpiresAt: null,
        },
      }
    );
    if (flipped.modifiedCount !== 1) continue;
    await releaseTierSeats(reg.ticketTierId, reg.quantity || 1).catch(() => {});
    for (const a of (reg.addons || []) as any[])
      await releaseTierSeats(a.ticketTierId, a.quantity || 1).catch(() => {});
  }
}

// ══ Free / approval registration ═════════════════════════════════════════

/**
 * POST /public/event-management/:slug/register
 * Free tiers and approval-gated applications. Paid tiers are rejected here and
 * must go through /checkout, so a $0 registration can never be minted for a
 * priced ticket.
 */
router.post("/:slug/register", softAuth, async (req: Request, res: Response) => {
  // Every seat claimed by this request, so a failure anywhere below hands all
  // of them back rather than permanently shrinking the tiers.
  const claims: Array<{ tierId: string; qty: number }> = [];
  const rollback = async () => {
    for (const c of claims) await releaseTierSeats(c.tierId, c.qty).catch(() => {});
    claims.length = 0;
  };
  try {
    const event = await loadPublicEvent(req.params.slug, res);
    if (!event) return;

    const parsed = cartSchema
      .extend({
        attendee: attendeeSchema,
        // Answers to the organizer's custom fields, keyed by field key.
        answers: z.record(z.string(), z.any()).optional(),
        // One entry per seat. Absent → the buyer is the only attendee.
        attendees: z.array(seatSchema).max(40).optional(),
        promoCode: z.string().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid registration");
    const { attendee } = parsed.data;

    const cart = normaliseCart(parsed.data);
    if (!cart) return bad(res, 400, "Invalid ticket");
    if (cart.some((i) => !Types.ObjectId.isValid(i.ticketTierId)))
      return bad(res, 400, "Invalid ticket");

    const tierDocs = await EventTicketTier.find({
      _id: { $in: cart.map((i) => new Types.ObjectId(i.ticketTierId)) },
      eventId: event._id,
      archivedAt: null,
      isVisible: true,
    });
    const tierById = new Map(tierDocs.map((t) => [t._id.toString(), t]));
    if (tierById.size !== cart.length) return bad(res, 404, "Ticket not found");
    if (tierDocs.some((t) => t.price > 0))
      return bad(res, 400, "This ticket requires payment — use checkout instead");

    if (await releaseExpiredHolds(event._id)) {
      // Re-read the counters the sweep just moved, so saleability below sees
      // the freed inventory rather than the stale documents.
      const fresh = await EventTicketTier.find({
        _id: { $in: tierDocs.map((t) => t._id) },
      })
        .select("_id soldCount")
        .lean();
      for (const f of fresh as any[]) {
        const doc = tierById.get(String(f._id));
        if (doc) doc.soldCount = f.soldCount;
      }
    }

    for (const item of cart) {
      const tier = tierById.get(item.ticketTierId)!;
      const sale = tierSaleability(tier as any, item.quantity);
      if (!sale.ok)
        return bad(res, 409, `${tier.name}: ${sale.reason || "unavailable"}`);
    }

    const resolved = resolveSeats(
      cart,
      parsed.data.attendees,
      attendee,
      parsed.data.answers || {}
    );
    if (!resolved.ok) return bad(res, 400, resolved.error);
    const seats = resolved.seats;

    // Required custom fields are enforced here, not just in the browser.
    // Validated per seat against that seat's tier: a field the organizer shows
    // only for one pass is required only on that pass.
    const seatAnswers: Array<Record<string, unknown>> = [];
    for (const seat of seats) {
      const form = await validateFormAnswers(
        event._id,
        seat.ticketTierId,
        seat.answers || {}
      );
      if (!form.ok) return bad(res, 400, form.error);
      seatAnswers.push(form.answers);
    }

    // One registration per email per event: refreshing the confirmation page
    // must not mint a second ticket. Checked for every attendee, not just the
    // buyer — otherwise a second seat could re-register someone already in.
    for (const seat of seats) {
      const existing = await EventRegistration.findOne({
        eventId: event._id,
        "attendee.email": seat.attendee.email.toLowerCase().trim(),
        status: { $in: ["pending_approval", "approved"] },
      }).lean();
      if (!existing) continue;
      // A single-attendee repeat is the refresh case and answers as before.
      if (seats.length === 1) {
        // …but it re-sends the ticket. This branch used to return in silence,
        // which is why registering again from an account that already had a
        // pass produced no email at all: the guard fired before the send
        // below ever ran. Someone registering a second time is almost always
        // someone who cannot find the first email, so sending it again is the
        // answer to what they were actually trying to do.
        const existingTier = await EventTicketTier.findById(
          (existing as any).ticketTierId
        )
          .select("name")
          .lean();
        void sendTicketEmail(event, existing, existingTier).catch((e) =>
          console.error(
            "[public/event-management] ticket re-send failed:",
            e?.message
          )
        );
        return res.json({
          success: true,
          alreadyRegistered: true,
          registration: {
            _id: (existing as any)._id,
            status: (existing as any).status,
            qrCodeToken: (existing as any).qrCodeToken,
          },
        });
      }
      return bad(
        res,
        409,
        `${seat.attendee.email} is already registered for this event`
      );
    }

    for (const item of cart) {
      const tier = tierById.get(item.ticketTierId)!;
      if (!(await claimTierSeats(tier._id, item.quantity))) {
        await rollback();
        return bad(res, 409, `${tier.name} just sold out`);
      }
      claims.push({ tierId: tier._id.toString(), qty: item.quantity });
    }

    const user = await resolveAttendeeUser(
      attendee.email,
      attendee.name,
      event.orgId,
      false
    );

    // One registration per seat — each carries its own QR code, because each
    // is scanned separately at the door.
    const registrations: IEventRegistration[] = [];
    for (const [i, seat] of seats.entries()) {
      const tier = tierById.get(seat.ticketTierId)!;
      const seatUser =
        seat.attendee.email.toLowerCase().trim() ===
        attendee.email.toLowerCase().trim()
          ? user
          : await resolveAttendeeUser(
              seat.attendee.email,
              seat.attendee.name,
              event.orgId,
              false
            );
      registrations.push(
        await EventRegistration.create({
          eventId: event._id,
          ticketTierId: tier._id,
          userId: seatUser?._id,
          attendee: {
            name: seat.attendee.name,
            email: seat.attendee.email.toLowerCase().trim(),
            phone: seat.attendee.phone,
            company: seat.attendee.company,
            jobTitle: seat.attendee.jobTitle,
            country: seat.attendee.country,
          },
          quantity: seat.quantity,
          status: event.requireApproval ? "pending_approval" : "approved",
          paymentStatus: "free",
          amountPaid: 0,
          currency: tier.currency,
          qrCodeToken: newQrCodeToken(),
          answers: seatAnswers[i] || {},
        })
      );
    }
    const registration = registrations[0];
    const tier = tierById.get(cart[0].ticketTierId)!;

    for (const reg of registrations) {
      const regTier = tierById.get(reg.ticketTierId.toString())!;
      void sendTicketEmail(event, reg, regTier).catch((e) =>
        console.error("[public/event-management] ticket email failed:", e?.message)
      );
    }

    // The organizer's "someone registered" alert, when they turned it on for
    // this event. The paid path gets its copy from fulfillInvoice; a free
    // registration mints no invoice at all, so it has to fire here.
    //
    // Idempotent by virtue of the one-registration-per-email guard above —
    // a refresh returns `alreadyRegistered` before reaching this line, so
    // there is no invoice claim to de-dupe on and none needed.
    void import("../services/founderAlertEmail").then(({ queueFounderAlert }) =>
      queueFounderAlert({
        itemType: "event",
        itemId: event._id,
        joiner: {
          userId: user?._id,
          name: attendee.name,
          email: attendee.email.toLowerCase().trim(),
        },
        amount: 0,
        currency: tier.currency,
      })
    );

    res.status(201).json({
      success: true,
      requiresApproval: !!event.requireApproval,
      // `registration` is the first pass in the order and stays for callers
      // that only ever booked one; `registrations` is the whole order.
      registration: {
        _id: registration._id,
        status: registration.status,
        qrCodeToken: registration.qrCodeToken,
      },
      registrations: registrations.map((r) => ({
        _id: r._id,
        ticketTierId: r.ticketTierId,
        status: r.status,
        qrCodeToken: r.qrCodeToken,
      })),
    });
  } catch (err) {
    // Give the held seats back — otherwise a failed write permanently shrinks
    // the tier's inventory.
    await rollback();
    console.error("[public/event-management] register failed:", err);
    bad(res, 500, "Failed to register");
  }
});

// ══ Paid checkout ════════════════════════════════════════════════════════

/**
 * POST /public/event-management/:slug/checkout
 *
 * Holds the seats, creates a pending registration, and mints a Garage Pay
 * invoice. The caller then sends the buyer to /invoice/:invoiceNumber, and
 * fulfillInvoice's `event_ticket` branch settles the registration on payment.
 */
router.post("/:slug/checkout", softAuth, async (req: Request, res: Response) => {
  // Every seat claimed in this request, so a failure anywhere below gives all
  // of them back — the ticket and each add-on.
  const claims: Array<{ tierId: string; qty: number }> = [];
  const rollback = async () => {
    for (const c of claims) await releaseTierSeats(c.tierId, c.qty).catch(() => {});
    claims.length = 0;
  };
  try {
    const event = await loadPublicEvent(req.params.slug, res);
    if (!event) return;

    const parsed = cartSchema
      .extend({
        attendee: attendeeSchema,
        // Answers to the organizer's custom fields, keyed by field key.
        answers: z.record(z.string(), z.any()).optional(),
        // One entry per seat. Absent → the buyer is the only attendee.
        attendees: z.array(seatSchema).max(40).optional(),
        promoCode: z.string().optional(),
        // Extras bought alongside the tickets. Each carries its own inventory
        // and sales window, so each is validated and claimed separately.
        addons: z.array(cartItemSchema).max(10).optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid checkout");
    const { attendee, promoCode } = parsed.data;
    const addonInput = parsed.data.addons || [];

    const cart = normaliseCart(parsed.data);
    if (!cart) return bad(res, 400, "Invalid ticket");
    if (cart.some((i) => !Types.ObjectId.isValid(i.ticketTierId)))
      return bad(res, 400, "Invalid ticket");

    const tierDocs = await EventTicketTier.find({
      _id: { $in: cart.map((i) => new Types.ObjectId(i.ticketTierId)) },
      eventId: event._id,
      archivedAt: null,
      isVisible: true,
    });
    const tierById = new Map(tierDocs.map((t) => [t._id.toString(), t]));
    if (tierById.size !== cart.length) return bad(res, 404, "Ticket not found");
    // A free pass mints no invoice, so it cannot ride along on a paid order —
    // it would be charged for and never settle. Those go through /register.
    if (tierDocs.some((t) => t.price <= 0))
      return bad(res, 400, "This ticket is free — use register instead");

    // A signed-in buyer owns the order, whoever the attendees are, so their
    // tickets land in their account rather than an account keyed by the
    // email typed into the form.
    const signedInId: string | undefined = (req as any).user?.userId;
    const signedIn =
      signedInId && Types.ObjectId.isValid(signedInId)
        ? await User.findById(signedInId)
        : null;

    // Starting over replaces the buyer's earlier unpaid order for this event —
    // otherwise backing out of payment and changing the cart would hold both
    // sets of seats until the first hold lapsed. One being paid right now
    // (crypto, auto-charge) refuses to cancel and is left alone.
    let superseded = false;
    if (signedIn) {
      const stale = await EventRegistration.distinct("invoiceId", {
        eventId: event._id,
        userId: signedIn._id,
        paymentStatus: "pending",
        status: { $ne: "cancelled" },
        invoiceId: { $ne: null },
      });
      for (const invoiceId of stale) {
        try {
          await cancelUnpaidOrder(String(invoiceId));
          superseded = true;
        } catch (err: any) {
          console.warn(
            `[public/event-management] kept earlier order ${invoiceId}: ${err?.message || err}`
          );
        }
      }
    }

    // Seats held by a checkout nobody paid for are not sold seats. Sweep, then
    // re-read the tiers so saleability sees the freed inventory.
    if ((await releaseExpiredHolds(event._id)) || superseded) {
      const fresh = await EventTicketTier.find({
        _id: { $in: tierDocs.map((t) => t._id) },
      })
        .select("_id soldCount")
        .lean();
      for (const f of fresh as any[]) {
        const doc = tierById.get(String(f._id));
        if (doc) doc.soldCount = f.soldCount;
      }
    }

    for (const item of cart) {
      const t = tierById.get(item.ticketTierId)!;
      const sale = tierSaleability(t as any, item.quantity);
      if (!sale.ok) return bad(res, 409, `${t.name}: ${sale.reason || "unavailable"}`);
    }

    const resolved = resolveSeats(
      cart,
      parsed.data.attendees,
      attendee,
      parsed.data.answers || {}
    );
    if (!resolved.ok) return bad(res, 400, resolved.error);
    const seats = resolved.seats;

    // Validated per seat against that seat's tier: a field the organizer shows
    // only for one pass is required only on that pass.
    const seatAnswers: Array<Record<string, unknown>> = [];
    for (const seat of seats) {
      const form = await validateFormAnswers(
        event._id,
        seat.ticketTierId,
        seat.answers || {}
      );
      if (!form.ok) return bad(res, 400, form.error);
      seatAnswers.push(form.answers);
    }

    for (const item of cart) {
      const t = tierById.get(item.ticketTierId)!;
      if (!(await claimTierSeats(t._id, item.quantity))) {
        await rollback();
        return bad(res, 409, `${t.name} just sold out`);
      }
      claims.push({ tierId: t._id.toString(), qty: item.quantity });
    }

    // The first pass in the cart anchors the order: it carries the add-ons and
    // is the registration the invoice metadata points at for back-compat.
    const tier = tierById.get(cart[0].ticketTierId)!;

    // ── Add-ons ──────────────────────────────────────────────────────
    // Loaded and claimed one at a time so a sold-out extra fails the whole
    // checkout cleanly rather than half-charging the buyer.
    const addonLines: Array<{
      tier: any;
      quantity: number;
    }> = [];
    for (const a of addonInput) {
      if (!Types.ObjectId.isValid(a.ticketTierId)) {
        await rollback();
        return bad(res, 400, "Invalid add-on");
      }
      const addonTier = await EventTicketTier.findOne({
        _id: new Types.ObjectId(a.ticketTierId),
        eventId: event._id,
        kind: "addon",
        archivedAt: null,
        isVisible: true,
      });
      if (!addonTier) {
        await rollback();
        return bad(res, 404, "Add-on not found");
      }
      const addonSale = tierSaleability(addonTier as any, a.quantity);
      if (!addonSale.ok) {
        await rollback();
        return bad(res, 409, `${addonTier.name}: ${addonSale.reason || "unavailable"}`);
      }
      if (!(await claimTierSeats(addonTier._id, a.quantity))) {
        await rollback();
        return bad(res, 409, `${addonTier.name} just sold out`);
      }
      claims.push({ tierId: addonTier._id.toString(), qty: a.quantity });
      addonLines.push({ tier: addonTier, quantity: a.quantity });
    }

    const user =
      signedIn ||
      (await resolveAttendeeUser(attendee.email, attendee.name, event.orgId, true));
    if (!user) {
      await rollback();
      return bad(res, 500, "Could not resolve a buyer account");
    }

    // One registration per pass type in the cart. Each gets its own QR code
    // because each is scanned separately at the door; the add-ons hang off the
    // first, which is where the buyer's extras are recorded for the order.
    const registrations: IEventRegistration[] = [];
    for (const [i, seat] of seats.entries()) {
      const itemTier = tierById.get(seat.ticketTierId)!;
      // The first seat anchors the order: it carries the add-ons and is the
      // registration the invoice metadata points at.
      const isAnchor = i === 0;
      registrations.push(
        await EventRegistration.create({
          eventId: event._id,
          ticketTierId: itemTier._id,
          // Every seat bills to the buyer's account — they are the one paying,
          // whoever else is named on the pass.
          userId: user._id,
          attendee: {
            name: seat.attendee.name,
            email: seat.attendee.email.toLowerCase().trim(),
            phone: seat.attendee.phone,
            company: seat.attendee.company,
            jobTitle: seat.attendee.jobTitle,
            country: seat.attendee.country,
          },
          quantity: seat.quantity,
          // Stays pending until fulfillInvoice settles it, whatever the event's
          // approval policy — an unpaid ticket is never "approved".
          status: "pending_approval",
          paymentStatus: "pending",
          amountPaid: 0,
          currency: itemTier.currency,
          promoCode: (promoCode || "").trim().toUpperCase() || undefined,
          qrCodeToken: newQrCodeToken(),
          answers: seatAnswers[i] || {},
          // Name and unit price frozen at purchase time, so a later edit to the
          // add-on can't rewrite what this attendee bought.
          addons: isAnchor
            ? addonLines.map((a) => ({
                ticketTierId: a.tier._id,
                name: a.tier.name,
                quantity: a.quantity,
                unitPrice: a.tier.price,
              }))
            : [],
          // The seats are claimed as of now. If this invoice is never paid,
          // `releaseExpiredHolds` hands them back after this deadline.
          holdExpiresAt: new Date(Date.now() + SEAT_HOLD_MINUTES * 60 * 1000),
        })
      );
    }
    const registration = registrations[0];

    // ── Money ────────────────────────────────────────────────────────
    // Minor units (cents/paise) from here down — the invoice engine works
    // exclusively in the smallest unit.
    const currency = (tier.currency || "USD").toUpperCase();
    const ticketsMinor = cart.reduce(
      (sum, i) =>
        sum + Math.round(tierById.get(i.ticketTierId)!.price * 100) * i.quantity,
      0
    );
    const addonsMinor = addonLines.reduce(
      (sum, a) => sum + Math.round(a.tier.price * 100) * a.quantity,
      0
    );
    // Add-ons are part of the order, so the coupon and the tax both see them.
    const subtotalMinor = ticketsMinor + addonsMinor;

    // Coupons come from the platform engine, not an events-only table. A
    // founder coupon resolves to a discount here; a Garage-admin platform
    // coupon is forwarded by code and applied inside createInvoice.
    const coupon = await resolveEventCoupon({
      code: promoCode,
      eventId: event._id,
      orgId: event.orgId,
      userId: user._id.toString(),
      subtotalMinor,
    });
    if (!coupon.ok) {
      await rollback();
      return bad(res, 400, coupon.reason || "Invalid coupon");
    }

    // Usage is recorded up front so a per-user cap can't be beaten by opening
    // two carts; fulfillInvoice marks it applied when the invoice is paid.
    let couponUsageId: string | undefined;
    if (coupon.couponId) {
      const { recordCouponUsage } = await import("../services/coupon");
      const usage = await recordCouponUsage({
        couponId: coupon.couponId,
        userId: user._id.toString(),
        orgId: event.orgId.toString(),
        transactionType: "one_time",
        transactionId: `event_pending_${registration._id}`,
        itemType: "event_ticket",
        itemId: event._id.toString(),
        originalAmount: subtotalMinor,
        discountAmount: coupon.discountMinor,
        finalAmount: Math.max(0, subtotalMinor - coupon.discountMinor),
      });
      couponUsageId = usage._id.toString();
    }

    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );
    const gstRegion = await resolveBuyerGstRegion({
      buyerUser: user,
      // No address is collected on the ticket form beyond an optional
      // country, so the payment currency is the fallback signal — same
      // approach as workshop / channel checkout.
      paymentCurrency: currency,
    });
    // The organizer's own switch gates GST on top of the buyer-location rule:
    // an event that never opted in never charges it.
    const buyerInIndia =
      !!event.addGstForIndianBuyers &&
      (gstRegion.inIndia ||
        String(attendee.country || "").trim().toLowerCase() === "india");

    const gstOpts = {
      // The organizer's choice: inclusive means the listed price already
      // contains the tax and they absorb it; exclusive adds it at checkout.
      gstInclusive: !!event.gstInclusive,
      buyerInIndia,
    };
    // Every pass type is taxed on its own line, paired with the registration
    // it belongs to so the settled amount can be split back out per ticket.
    const ticketGst = cart.map((item, i) => {
      const itemTier = tierById.get(item.ticketTierId)!;
      return {
        tier: itemTier,
        quantity: item.quantity,
        registration: registrations[i],
        gst: applyGstToLine({
          listedAmountMinor: Math.round(itemTier.price * 100),
          quantity: item.quantity,
          ...gstOpts,
        }),
      };
    });
    const gstLine = ticketGst[0].gst;
    // Each add-on is taxed the same way as the ticket, on its own line, so the
    // invoice itemises what the buyer actually agreed to.
    const addonGst = addonLines.map((a) => ({
      ...a,
      gst: applyGstToLine({
        listedAmountMinor: Math.round(a.tier.price * 100),
        quantity: a.quantity,
        ...gstOpts,
      }),
    }));
    const taxTotal =
      ticketGst.reduce((n, t) => n + t.gst.taxTotal, 0) +
      addonGst.reduce((n, a) => n + a.gst.taxTotal, 0);

    const invoice = await createInvoice({
      organizationId: event.orgId.toString(),
      sellerId: event.creatorId.toString(),
      userId: user._id.toString(),
      customerEmail: attendee.email.toLowerCase().trim(),
      customerName: attendee.name,
      lineItems: [
        ...ticketGst.map((t) => ({
          itemType: "event_ticket" as const,
          itemId: t.tier._id.toString(),
          itemName: `${event.name} — ${t.tier.name}`,
          itemDescription:
            t.tier.description || event.shortDescription || undefined,
          itemImage: event.bannerUrl || undefined,
          quantity: t.quantity,
          unitPrice: t.gst.lineUnitPrice,
          originalCurrency: currency,
        })),
        ...addonGst.map((a) => ({
          itemType: "event_ticket" as const,
          itemId: a.tier._id.toString(),
          itemName: `${event.name} — ${a.tier.name}`,
          itemDescription: a.tier.description || undefined,
          itemImage: event.bannerUrl || undefined,
          quantity: a.quantity,
          unitPrice: a.gst.lineUnitPrice,
          originalCurrency: currency,
        })),
      ],
      itemCurrency: currency,
      discount: coupon.discountMinor || undefined,
      tax: taxTotal || undefined,
      couponId: coupon.couponId,
      couponCode: coupon.couponCode,
      couponUsageId,
      platformCouponCode: coupon.platformCouponCode,
      metadata: {
        type: "event_ticket_checkout",
        eventId: event._id.toString(),
        eventSlug: event.slug,
        eventRegistrationId: registration._id.toString(),
        ticketTierId: tier._id.toString(),
        qrCodeToken: registration.qrCodeToken,
        // An order can hold several pass types, so fulfilment settles a list.
        // `eventRegistrationId` above stays as the anchor for anything (and
        // any invoice minted before this) that only knows about one.
        eventRegistrationIds: registrations.map((r) => r._id.toString()),
        // What each registration is worth, so a multi-pass order doesn't
        // record the whole invoice total against every ticket in it.
        eventRegistrationAmounts: Object.fromEntries(
          ticketGst.map((t) => [
            t.registration._id.toString(),
            t.gst.chargeTotal +
              // The add-ons ride on the anchor registration, and so does what
              // they were charged.
              (t.registration._id.equals(registration._id)
                ? addonGst.reduce((n, a) => n + a.gst.chargeTotal, 0)
                : 0),
          ])
        ),
        ...(gstLine.gstMetadata
          ? {
              gst: {
                ...gstLine.gstMetadata,
                buyerCountry: gstRegion.country,
                buyerRegion: "IN" as const,
                regionSource: gstRegion.source,
              },
            }
          : { gstSkipped: gstSkippedMetadata(gstRegion, "buyer_outside_india") }),
      },
    });

    for (const reg of registrations) {
      reg.invoiceId = invoice._id;
      await reg.save();
    }

    res.status(201).json({
      success: true,
      invoiceId: invoice._id.toString(),
      // The pay page routes by either identifier, and the human-readable
      // INV- number is what the buyer sees on the invoice itself — so the
      // FE builds the URL from this and falls back to the id.
      invoiceNumber: invoice.invoiceNumber,
      registrationId: registration._id.toString(),
      qrCodeToken: registration.qrCodeToken,
      // The whole order. `registrationId` / `qrCodeToken` above are the first
      // pass in it, kept for callers that only ever bought one.
      registrations: registrations.map((r) => ({
        _id: r._id.toString(),
        ticketTierId: r.ticketTierId.toString(),
        qrCodeToken: r.qrCodeToken,
      })),
      amount: invoice.totalAmount / 100,
      currency,
    });
  } catch (err) {
    await rollback();
    console.error("[public/event-management] checkout failed:", err);
    bad(res, 500, "Failed to start checkout");
  }
});

// ══ Ticket lookup / check-in ═════════════════════════════════════════════

/**
 * POST /public/event-management/tickets/lookup
 *
 * "Find my ticket" — the attendee has the reference from their confirmation
 * page or receipt email and no longer has the link. `reference` resolves as an
 * invoice number, a registration id or the QR token itself.
 *
 * A ticket ID opens its own pass with nothing else: it is the leading
 * characters of the QR token, which the ticket URL already hands out in full.
 * An order reference is different — invoice numbers run in sequence and
 * ObjectIds embed a timestamp, so those still need the booking email before
 * the order behind them is returned.
 */
router.post("/tickets/lookup", async (req: Request, res: Response) => {
  try {
    const parsed = z
      .object({
        reference: z.string().min(4).max(120),
        email: z.string().email().optional(),
      })
      .safeParse(req.body);
    if (!parsed.success) return bad(res, 400, "Enter your ticket ID");

    const reference = parsed.data.reference.trim();
    const email = parsed.data.email?.toLowerCase().trim() || "";

    // Deliberately one message for every miss. Distinguishing "no such
    // reference" from "wrong email" would hand an attacker a way to confirm a
    // reference exists.
    const notFound = () =>
      bad(res, 404, "No ticket matches that ID");

    const respond = async (rows: any[]) => {
      // A reference should never span events; if it somehow does, answer for
      // the one the matched seat belongs to rather than mixing them.
      const eventId = String(rows[0].eventId);
      const tickets = rows.filter((r: any) => String(r.eventId) === eventId);
      const event = await EventProgram.findById(eventId)
        .select("name slug startsAt endsAt timezone venue format bannerUrl")
        .lean();
      if (!event) return notFound();
      res.json({
        success: true,
        event,
        tickets: tickets.map((t: any) => ({
          qrCodeToken: t.qrCodeToken,
          attendeeName: t.attendee?.name,
          attendeeEmail: maskEmail(t.attendee?.email),
          tier: t.ticketTierId,
          quantity: t.quantity,
          status: t.status,
          paymentStatus: t.paymentStatus,
          checkedInAt: t.checkedInAt || null,
          valid:
            t.status === "approved" &&
            ["free", "paid"].includes(t.paymentStatus),
        })),
      });
    };

    // ── 1. The ticket ID itself ──────────────────────────────────────────
    //
    // Opens the pass on its own, with no email. The id is the leading 12+
    // characters of the QR token, which is already the credential the ticket
    // URL carries and a door scanner accepts — so quoting it grants nothing
    // that holding the ticket link doesn't. Only THIS pass comes back, never
    // the rest of the order, so one attendee's id can't enumerate their
    // colleagues.
    if (reference.length >= TICKET_ID_LENGTH) {
      const byToken = await EventRegistration.find({
        qrCodeToken: new RegExp(`^${escapeRegExp(reference)}`, "i"),
      })
        .populate("ticketTierId", "name price currency")
        .lean();
      if (byToken.length) return respond(byToken);
    }

    // ── 2. An order reference ────────────────────────────────────────────
    //
    // Invoice numbers run in sequence and ObjectIds embed a timestamp, so
    // neither is a secret. These still need the booking email, and they
    // return the whole order — which is what the buyer of a multi-attendee
    // booking is actually holding.
    if (!email)
      return bad(
        res,
        400,
        "Add the email you booked with to look an order reference up"
      );

    const or: Record<string, any>[] = [];
    if (Types.ObjectId.isValid(reference))
      or.push({ _id: new Types.ObjectId(reference) });

    const { Invoice } = require("../models/invoice.model");
    const invoice = await Invoice.findOne({
      invoiceNumber: new RegExp(`^${escapeRegExp(reference)}$`, "i"),
    })
      .select("_id")
      .lean();
    if (invoice) or.push({ invoiceId: invoice._id });
    if (!or.length) return notFound();

    const matches = await EventRegistration.find({ $or: or })
      .populate("ticketTierId", "name price currency")
      .lean();
    if (!matches.length) return notFound();

    // The buyer sees the whole order once any one seat on it is theirs.
    if (
      !matches.some(
        (m: any) => (m.attendee?.email || "").toLowerCase().trim() === email
      )
    )
      return notFound();

    return respond(matches);
  } catch (err) {
    console.error("[public/event-management] ticket lookup failed:", err);
    bad(res, 500, "Failed to look up that ticket");
  }
});

/**
 * GET /public/event-management/ticket/:qrCodeToken
 * Resolves a scanned ticket. Unauthenticated by design — the token IS the
 * credential — so it returns only what a door scanner needs.
 */
router.get("/ticket/:qrCodeToken", async (req: Request, res: Response) => {
  try {
    const token = String(req.params.qrCodeToken || "");
    if (token.length < 10) return bad(res, 400, "Invalid ticket");

    const registration = await EventRegistration.findOne({ qrCodeToken: token })
      .populate("ticketTierId", "name price currency")
      .lean();
    if (!registration) return bad(res, 404, "Ticket not found");

    const event = await EventProgram.findById((registration as any).eventId)
      .select("name slug startsAt endsAt timezone venue format bannerUrl")
      .lean();

    res.json({
      success: true,
      ticket: {
        qrCodeToken: token,
        attendeeName: (registration as any).attendee?.name,
        // Masked: a found/forwarded ticket link should not hand over a
        // full email address.
        attendeeEmail: maskEmail((registration as any).attendee?.email),
        tier: (registration as any).ticketTierId,
        quantity: (registration as any).quantity,
        status: (registration as any).status,
        paymentStatus: (registration as any).paymentStatus,
        checkedInAt: (registration as any).checkedInAt || null,
        valid:
          (registration as any).status === "approved" &&
          ["free", "paid"].includes((registration as any).paymentStatus),
      },
      event,
    });
  } catch (err) {
    console.error("[public/event-management] ticket lookup failed:", err);
    bad(res, 500, "Failed to load ticket");
  }
});

/**
 * GET /public/event-management/ticket/:qrCodeToken/calendar.ics
 * "Add to calendar" — works for Google, Apple and Outlook.
 */
router.get(
  "/ticket/:qrCodeToken/calendar.ics",
  async (req: Request, res: Response) => {
    try {
      const token = String(req.params.qrCodeToken || "");
      const registration = await EventRegistration.findOne({
        qrCodeToken: token,
      }).lean();
      if (!registration) return bad(res, 404, "Ticket not found");
      const event = await EventProgram.findById((registration as any).eventId).lean();
      if (!event) return bad(res, 404, "Event not found");

      const stamp = (d: Date) =>
        new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
      const esc = (s: string) =>
        String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
      const location = [
        (event as any).venue?.name,
        (event as any).venue?.addressLine1,
        (event as any).venue?.city,
        (event as any).venue?.country,
      ]
        .filter(Boolean)
        .join(", ");

      const ics = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Garage//Event Management//EN",
        "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT",
        `UID:${token}@garage.app`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp((event as any).startsAt)}`,
        `DTEND:${stamp((event as any).endsAt)}`,
        `SUMMARY:${esc((event as any).name)}`,
        `DESCRIPTION:${esc((event as any).shortDescription || "")}`,
        ...(location ? [`LOCATION:${esc(location)}`] : []),
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n");

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${(event as any).slug}.ics"`
      );
      res.send(ics);
    } catch (err) {
      console.error("[public/event-management] ics failed:", err);
      bad(res, 500, "Failed to build calendar file");
    }
  }
);

// ══ The buyer's own tickets and orders ═══════════════════════════════════

const EVENT_CARD_FIELDS =
  "name slug startsAt endsAt timezone venue format bannerUrl shortDescription";

/** A seat as its holder sees it — their own data, so nothing is masked. */
function ownTicket(r: any) {
  return {
    registrationId: String(r._id),
    qrCodeToken: r.qrCodeToken,
    ticketId: ticketIdOf(r.qrCodeToken),
    attendeeName: r.attendee?.name,
    attendeeEmail: r.attendee?.email,
    tier: r.ticketTierId
      ? {
          _id: r.ticketTierId._id,
          name: r.ticketTierId.name,
          price: r.ticketTierId.price,
          currency: r.ticketTierId.currency,
        }
      : null,
    quantity: r.quantity,
    addons: (r.addons || []).map((a: any) => ({
      name: a.name,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
    })),
    status: r.status,
    paymentStatus: r.paymentStatus,
    checkedInAt: r.checkedInAt || null,
    holdExpiresAt: r.holdExpiresAt || null,
    needsRefund: !!r.needsRefund,
    valid: r.status === "approved" && ["free", "paid"].includes(r.paymentStatus),
  };
}

/**
 * GET /public/event-management/me/tickets
 *
 * Every pass the caller holds: orders they paid for (all seats on them) and
 * seats someone else bought in their name (just those seats). Grouped by
 * order, newest first. Abandoned unpaid checkouts are left out; an unpaid
 * one still inside its hold is kept so the app can offer to finish paying.
 */
router.get("/me/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string; email?: string };
    const email = (me.email || "").toLowerCase().trim();
    const mine: Record<string, any>[] = [{ userId: new Types.ObjectId(me.userId) }];
    if (email) mine.push({ "attendee.email": email });

    const regs = await EventRegistration.find({
      $or: mine,
      $nor: [
        { status: "cancelled", paymentStatus: "pending" },
        { status: "rejected" },
      ],
    })
      .populate("ticketTierId", "name price currency")
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();

    const eventIds = [...new Set(regs.map((r: any) => String(r.eventId)))];
    const invoiceIds = [
      ...new Set(regs.filter((r: any) => r.invoiceId).map((r: any) => String(r.invoiceId))),
    ];
    const { Invoice } = require("../models/invoice.model");
    const [events, invoices] = await Promise.all([
      EventProgram.find({ _id: { $in: eventIds } }).select(EVENT_CARD_FIELDS).lean(),
      Invoice.find({ _id: { $in: invoiceIds } })
        .select("_id invoiceNumber status totalAmount itemCurrency paidAt userId")
        .lean(),
    ]);
    const eventById = new Map(events.map((e: any) => [String(e._id), e]));
    const invoiceById = new Map<string, any>(invoices.map((i: any) => [String(i._id), i]));

    // A free registration has no invoice; it is its own order.
    const orders = new Map<string, any>();
    for (const r of regs as any[]) {
      const key = r.invoiceId ? String(r.invoiceId) : String(r._id);
      if (!orders.has(key)) {
        const inv = r.invoiceId ? invoiceById.get(String(r.invoiceId)) : null;
        orders.set(key, {
          orderId: key,
          invoiceId: inv ? String(inv._id) : null,
          invoiceNumber: inv?.invoiceNumber || null,
          invoiceStatus: inv?.status || null,
          total: inv ? inv.totalAmount / 100 : 0,
          currency: inv?.itemCurrency || r.currency,
          paidAt: inv?.paidAt || null,
          isBuyer: String(r.userId || "") === me.userId,
          createdAt: r.createdAt,
          event: eventById.get(String(r.eventId)) || null,
          tickets: [],
        });
      }
      orders.get(key).tickets.push(ownTicket(r));
    }

    res.json({ success: true, orders: [...orders.values()].filter((o) => o.event) });
  } catch (err) {
    console.error("[public/event-management] my tickets failed:", err);
    bad(res, 500, "Failed to load your tickets");
  }
});

/** The event order behind an invoice, if the caller bought it. */
async function loadMyOrder(req: Request, res: Response) {
  const me = (req as any).user as { userId: string };
  const invoice = await getInvoice(String(req.params.invoiceId || ""));
  const regs = invoice
    ? await EventRegistration.find({ invoiceId: invoice._id })
        .populate("ticketTierId", "name price currency")
        .lean()
    : [];
  const isBuyer =
    !!invoice &&
    (String(invoice.userId) === me.userId ||
      regs.some((r: any) => String(r.userId || "") === me.userId));
  // One answer for "no such order" and "not yours", so ids can't be probed.
  if (!invoice || !regs.length || !isBuyer) {
    bad(res, 404, "Order not found");
    return null;
  }
  return { invoice, regs: regs as any[] };
}

/**
 * GET /public/event-management/me/orders/:invoiceId
 *
 * One order for its confirmation screen: every seat with its QR token, the
 * itemised lines, and the money. `:invoiceId` also accepts the INV- number.
 */
router.get(
  "/me/orders/:invoiceId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const order = await loadMyOrder(req, res);
      if (!order) return;
      const { invoice, regs } = order;
      const event = await EventProgram.findById(regs[0].eventId)
        .select(EVENT_CARD_FIELDS)
        .lean();
      const inv: any = invoice;

      res.json({
        success: true,
        order: {
          invoiceId: String(inv._id),
          invoiceNumber: inv.invoiceNumber,
          status: inv.status,
          paidAt: inv.paidAt || null,
          currency: inv.itemCurrency,
          // The invoice works in minor units; everything here is major.
          lines: (inv.lineItems || []).map((l: any) => ({
            name: String(l.itemName || "").replace(`${(event as any)?.name} — `, ""),
            quantity: l.quantity,
            unitPrice: l.unitPrice / 100,
            total: l.totalPrice / 100,
          })),
          subtotal: (inv.subtotal || 0) / 100,
          discount: (inv.discount || 0) / 100,
          tax: (inv.tax || 0) / 100,
          taxRate: inv.tax ? 18 : 0,
          total: inv.totalAmount / 100,
          couponCode: inv.couponCode || null,
          paymentMethod: inv.paymentMethodCategory || null,
          paymentPlatform: inv.paymentPlatform || null,
          customerEmail: inv.customerEmail,
          holdExpiresAt:
            regs
              .map((r) => r.holdExpiresAt)
              .filter(Boolean)
              .sort()[0] || null,
          event,
          tickets: regs.map(ownTicket),
        },
      });
    } catch (err) {
      console.error("[public/event-management] my order failed:", err);
      bad(res, 500, "Failed to load this order");
    }
  }
);

/**
 * POST /public/event-management/orders/:invoiceId/cancel
 *
 * The buyer walks away from an unpaid order: the invoice is cancelled and
 * its seats go straight back on sale instead of waiting out the hold.
 */
router.post(
  "/orders/:invoiceId/cancel",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const order = await loadMyOrder(req, res);
      if (!order) return;
      try {
        await cancelUnpaidOrder(String(order.invoice._id));
      } catch (err: any) {
        return bad(res, 409, err?.message || "This order can't be cancelled");
      }
      res.json({ success: true });
    } catch (err) {
      console.error("[public/event-management] cancel order failed:", err);
      bad(res, 500, "Failed to cancel this order");
    }
  }
);

// ── Helpers ──────────────────────────────────────────────────────────────

function maskEmail(email?: string): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "";
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

/** Confirmation email carrying the QR ticket link. Best-effort. */
export default router;
