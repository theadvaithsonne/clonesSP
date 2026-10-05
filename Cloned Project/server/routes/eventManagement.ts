// src/routes/eventManagement.ts
//
// Founder / organizer API for the Event Management module.
//
// Mounted at /event-management. This is deliberately NOT /events — that prefix
// belongs to the legacy internal Agora calendar (routes/events.ts) and nothing
// here should be reachable from it.
//
// Every route resolves the event first and checks org membership through
// `canManageEvents`, so an org id in the query string can never be used to
// read another org's event.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import multer from "multer";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { EventProgram } from "../models/eventProgram.model";
import {
  founderAlertsZodSchema,
  normalizeFounderAlerts,
} from "../models/founderAlerts.schema";
import { EventTicketTier } from "../models/eventTicketTier.model";
import {
  EventRegistrationForm,
  FORM_FIELD_TYPES,
  defaultFormFields,
} from "../models/eventRegistrationForm.model";
import { EventRegistration } from "../models/eventRegistration.model";
import { EventSpeaker } from "../models/eventSpeaker.model";
import { EventAgendaSession } from "../models/eventAgendaSession.model";
import { EventSponsor } from "../models/eventSponsor.model";
import {
  EventWebsiteConfig,
  EVENT_BLOCK_TYPES,
} from "../models/eventWebsiteConfig.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { normaliseHost } from "../services/eventDomain";
import {
  addDomainToVercel,
  getDomainFromVercel,
  removeDomainFromVercel,
  verificationToDnsRecords,
} from "./initialSetup";
import { s3Service } from "../services/s3";
import {
  canManageEvents,
  generateUniqueSlug,
  computeEventMetrics,
  ensureWebsiteConfig,
  defaultWebsiteBlocks,
  publishChecklist,
  claimTierSeats,
  releaseTierSeats,
  releaseExpiredHolds,
  tierSalesStats,
} from "../services/eventManagement";

const router = Router();

// 8 MB is generous for a 1920×1080 JPEG/WebP banner and keeps the request
// body bounded on an authenticated but founder-facing endpoint.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype);
    cb(null, ok);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────

function bad(res: Response, status: number, error: string) {
  return res.status(status).json({ success: false, error });
}

/**
 * Load the event and confirm the caller may manage it.
 *
 * Returns null (and has already written the response) on any failure, so call
 * sites read `const event = await loadEvent(...); if (!event) return;`.
 */
async function loadEvent(req: Request, res: Response) {
  const { id } = req.params as { id: string };
  if (!Types.ObjectId.isValid(id)) {
    bad(res, 400, "Invalid event id");
    return null;
  }
  const event = await EventProgram.findOne({
    _id: new Types.ObjectId(id),
    deletedAt: null,
  });
  if (!event) {
    bad(res, 404, "Event not found");
    return null;
  }
  const allowed = await canManageEvents((req as AuthRequest).user.userId, event.orgId.toString());
  if (!allowed) {
    bad(res, 403, "You do not have access to manage this event");
    return null;
  }
  return event;
}

const coordinatesSchema = z
  .object({ lat: z.number().optional(), lng: z.number().optional() })
  .optional();

const venueSchema = z
  .object({
    name: z.string().max(200).optional(),
    addressLine1: z.string().max(300).optional(),
    city: z.string().max(120).optional(),
    state: z.string().max(120).optional(),
    postcode: z.string().max(40).optional(),
    country: z.string().max(120).optional(),
    coordinates: coordinatesSchema,
  })
  .optional();

const streamingSchema = z
  .object({
    streamType: z
      .enum(["garage_livestream", "money_stream", "external_link"])
      .optional(),
    livekitRoomId: z.string().optional(),
    externalUrl: z.string().optional(),
  })
  .optional();

const ticketInputSchema = z.object({
  kind: z.enum(["ticket", "addon"]).optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  perks: z.array(z.string().max(200)).optional(),
  price: z.number().min(0).default(0),
  currency: z.string().min(1).max(8).default("USD"),
  quantity: z.number().int().min(1).default(1),
  salesStart: z.string().optional(),
  salesEnd: z.string().optional(),
  isVisible: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const eventCoreSchema = z.object({
  name: z.string().min(1).max(200),
  shortDescription: z.string().max(140).optional(),
  description: z.string().max(10000).optional(),
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string().optional(),
  isRepeating: z.boolean().optional(),
  repeatRule: z.string().optional(),
  category: z.string().optional(),
  language: z.string().optional(),
  bannerUrl: z.string().optional(),
  format: z.enum(["in_person", "hybrid", "virtual"]).optional(),
  venue: venueSchema,
  streaming: streamingSchema,
  totalCapacity: z.number().int().min(1),
  requireApproval: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  payoutWalletId: z.string().optional(),
  addGstForIndianBuyers: z.boolean().optional(),
  gstInclusive: z.boolean().optional(),
  // "Notify me when someone registers" — the organizer's own alert, fired on
  // both free registration and paid ticket checkout. See
  // models/founderAlerts.schema.ts.
  founderAlerts: founderAlertsZodSchema.optional(),
});

// ══ Events ═══════════════════════════════════════════════════════════════

/**
 * POST /event-management
 * Create a draft event. Accepts the whole 3-step wizard payload in one call —
 * the wizard only submits on "Save draft" / "Publish", so there is no
 * intermediate state to persist.
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = eventCoreSchema.extend({
      orgId: z.string(),
      tickets: z.array(ticketInputSchema).optional(),
      publish: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid payload");
    }
    const body = parsed.data;

    if (!Types.ObjectId.isValid(body.orgId)) return bad(res, 400, "Invalid orgId");
    const allowed = await canManageEvents((req as AuthRequest).user.userId, body.orgId);
    if (!allowed) return bad(res, 403, "You do not have access to create events");

    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()))
      return bad(res, 400, "Invalid start or end date");
    if (endsAt <= startsAt) return bad(res, 400, "End time must be after start time");

    const slug = await generateUniqueSlug(body.name);

    const event = await EventProgram.create({
      orgId: new Types.ObjectId(body.orgId),
      creatorId: new Types.ObjectId((req as AuthRequest).user.userId),
      name: body.name,
      slug,
      shortDescription: body.shortDescription,
      description: body.description,
      startsAt,
      endsAt,
      timezone: body.timezone,
      isRepeating: body.isRepeating ?? false,
      repeatRule: body.repeatRule,
      category: body.category,
      language: body.language || "English",
      bannerUrl: body.bannerUrl,
      format: body.format || "in_person",
      venue: body.venue || {},
      streaming: body.streaming || {},
      totalCapacity: body.totalCapacity,
      requireApproval: body.requireApproval ?? false,
      isPrivate: body.isPrivate ?? false,
      payoutWalletId:
        body.payoutWalletId && Types.ObjectId.isValid(body.payoutWalletId)
          ? new Types.ObjectId(body.payoutWalletId)
          : undefined,
      addGstForIndianBuyers: body.addGstForIndianBuyers ?? false,
      gstInclusive: body.gstInclusive ?? false,
      ...(body.founderAlerts
        ? { founderAlerts: normalizeFounderAlerts(body.founderAlerts) }
        : {}),
      status: "draft",
    });

    if (body.tickets?.length) {
      await EventTicketTier.insertMany(
        body.tickets.map((t, i) => ({
          eventId: event._id,
          name: t.name,
          description: t.description,
          perks: t.perks || [],
          price: t.price,
          currency: (t.currency || "USD").toUpperCase(),
          quantity: t.quantity,
          salesStart: t.salesStart ? new Date(t.salesStart) : undefined,
          salesEnd: t.salesEnd ? new Date(t.salesEnd) : undefined,
          isVisible: t.isVisible ?? true,
          isPaused: t.isPaused ?? false,
          sortOrder: t.sortOrder ?? i,
        }))
      );
    }

    // Seed the builder now so REACH → Website is never an empty canvas.
    await ensureWebsiteConfig(event);

    if (body.publish) {
      const { canPublish, blockers } = await publishChecklist(event);
      if (!canPublish) {
        // The draft is still saved — the founder just lands back on the wizard
        // with a list of what is missing instead of losing their work.
        return res.status(200).json({
          success: true,
          event,
          published: false,
          blockers,
        });
      }
      event.status = "published";
      event.publishedAt = new Date();
      await event.save();
    }

    res.status(201).json({ success: true, event, published: event.status === "published" });
  } catch (err: any) {
    if (err?.code === 11000) return bad(res, 409, "An event with that name already exists");
    console.error("[event-management] create failed:", err);
    bad(res, 500, "Failed to create event");
  }
});

/**
 * GET /event-management?orgId=…
 * List the org's events with counts, for the Events home grid.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      orgId: z.string(),
      status: z
        .enum(["draft", "published", "ongoing", "completed", "cancelled"])
        .optional(),
      search: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
      offset: z.coerce.number().int().min(0).default(0),
    });
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) return bad(res, 400, "orgId is required");
    const { orgId, status, search, limit, offset } = parsed.data;

    if (!Types.ObjectId.isValid(orgId)) return bad(res, 400, "Invalid orgId");
    const allowed = await canManageEvents((req as AuthRequest).user.userId, orgId);
    if (!allowed) return bad(res, 403, "You do not have access to this org's events");

    const query: Record<string, any> = {
      orgId: new Types.ObjectId(orgId),
      deletedAt: null,
    };
    if (status) query.status = status;
    if (search?.trim()) query.name = { $regex: search.trim(), $options: "i" };

    const [events, total] = await Promise.all([
      EventProgram.find(query).sort({ startsAt: -1 }).skip(offset).limit(limit).lean(),
      EventProgram.countDocuments(query),
    ]);

    // One aggregate per collection rather than N per event — the grid renders
    // sold/registered counts on every card.
    const ids = events.map((e: any) => e._id);
    // Both numbers come from the registrations, never from `soldCount`.
    // `soldCount` is the inventory counter: it goes up the moment a checkout
    // starts, so using it here reported abandoned carts as ticket sales.
    const regs = await EventRegistration.aggregate([
      {
        $match: {
          eventId: { $in: ids },
          status: { $nin: ["cancelled"] },
        },
      },
      {
        $group: {
          _id: "$eventId",
          count: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending_approval"] }, 1, 0] },
          },
          sold: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$paymentStatus", ["paid", "free"]] },
                    { $ne: ["$status", "rejected"] },
                  ],
                },
                { $ifNull: ["$quantity", 1] },
                0,
              ],
            },
          },
        },
      },
    ]);
    const regBy = new Map(regs.map((r: any) => [r._id.toString(), r]));

    res.json({
      success: true,
      total,
      events: events.map((e: any) => ({
        ...e,
        ticketsSold: regBy.get(e._id.toString())?.sold || 0,
        registrations: regBy.get(e._id.toString())?.count || 0,
        pendingApproval: regBy.get(e._id.toString())?.pending || 0,
      })),
    });
  } catch (err) {
    console.error("[event-management] list failed:", err);
    bad(res, 500, "Failed to load events");
  }
});

/**
 * GET /event-management/:id
 * Full console payload: event + tiers + metrics + setup checklist.
 */
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;

    const [tiers, metrics, checklist, website] = await Promise.all([
      EventTicketTier.find({ eventId: event._id, archivedAt: null })
        .sort({ sortOrder: 1 })
        .lean(),
      computeEventMetrics(event),
      publishChecklist(event),
      EventWebsiteConfig.findOne({ eventId: event._id })
        .select("isPublished publishedAt")
        .lean(),
    ]);

    res.json({
      success: true,
      event,
      tiers,
      metrics,
      checklist,
      website: {
        isPublished: (website as any)?.isPublished ?? false,
        publishedAt: (website as any)?.publishedAt ?? null,
      },
    });
  } catch (err) {
    console.error("[event-management] detail failed:", err);
    bad(res, 500, "Failed to load event");
  }
});

/** PATCH /event-management/:id — partial update of any wizard/console field. */
router.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;

    const parsed = eventCoreSchema
      .partial()
      .extend({
        status: z
          .enum(["draft", "published", "ongoing", "completed", "cancelled"])
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid payload");
    const body = parsed.data;

    if (body.name !== undefined) {
      // Slug follows the name only while the event is a draft — a published
      // slug is a live URL that may already be printed on something.
      if (event.status === "draft" && body.name !== event.name) {
        event.slug = await generateUniqueSlug(body.name, event._id.toString());
      }
      event.name = body.name;
    }

    const startsAt = body.startsAt ? new Date(body.startsAt) : event.startsAt;
    const endsAt = body.endsAt ? new Date(body.endsAt) : event.endsAt;
    if (isNaN(startsAt.getTime()) || isNaN(endsAt.getTime()))
      return bad(res, 400, "Invalid start or end date");
    if (endsAt <= startsAt) return bad(res, 400, "End time must be after start time");
    event.startsAt = startsAt;
    event.endsAt = endsAt;

    const simple = [
      "shortDescription",
      "description",
      "timezone",
      "isRepeating",
      "repeatRule",
      "category",
      "language",
      "bannerUrl",
      "format",
      "totalCapacity",
      "requireApproval",
      "isPrivate",
      "addGstForIndianBuyers",
      "gstInclusive",
      "status",
    ] as const;
    for (const key of simple) {
      if ((body as any)[key] !== undefined) (event as any)[key] = (body as any)[key];
    }
    if (body.venue !== undefined)
      event.venue = { ...(event.venue as any), ...body.venue };
    if (body.streaming !== undefined)
      event.streaming = { ...(event.streaming as any), ...body.streaming };
    if (body.payoutWalletId !== undefined) {
      event.payoutWalletId = Types.ObjectId.isValid(body.payoutWalletId)
        ? new Types.ObjectId(body.payoutWalletId)
        : undefined;
    }
    // Only written when the wizard actually sent it, so a status flip or a
    // banner change can't silently clear the organizer's toggle.
    if (body.founderAlerts !== undefined) {
      event.founderAlerts = normalizeFounderAlerts(body.founderAlerts);
    }

    await event.save();
    res.json({ success: true, event });
  } catch (err) {
    console.error("[event-management] update failed:", err);
    bad(res, 500, "Failed to update event");
  }
});

/** POST /event-management/:id/publish — validate, then flip to published. */
router.post("/:id/publish", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;

    const { canPublish, blockers, items } = await publishChecklist(event);
    if (!canPublish) {
      return res.status(422).json({
        success: false,
        error: "This event is not ready to publish",
        blockers,
        checklist: items,
      });
    }
    event.status = "published";
    event.publishedAt = event.publishedAt || new Date();
    await event.save();
    res.json({ success: true, event });
  } catch (err) {
    console.error("[event-management] publish failed:", err);
    bad(res, 500, "Failed to publish event");
  }
});

/** POST /event-management/:id/unpublish — back to draft, hides the public page. */
router.post("/:id/unpublish", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    event.status = "draft";
    await event.save();
    res.json({ success: true, event });
  } catch (err) {
    console.error("[event-management] unpublish failed:", err);
    bad(res, 500, "Failed to unpublish event");
  }
});

/** DELETE /event-management/:id — soft delete (registrations keep resolving). */
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    event.deletedAt = new Date();
    event.status = "cancelled";
    await event.save();
    res.json({ success: true });
  } catch (err) {
    console.error("[event-management] delete failed:", err);
    bad(res, 500, "Failed to delete event");
  }
});

// ══ Banner upload ════════════════════════════════════════════════════════

/**
 * POST /event-management/:id/banner  (multipart, field `file`)
 * Direct upload — the banner is a single image well under the multer cap, so
 * a presign round-trip would only add a hop. Use /banner/presign for anything
 * the browser should PUT straight to S3.
 */
router.post(
  "/:id/banner",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const file = (req as any).file;
      if (!file) return bad(res, 400, "No image supplied (or unsupported type)");

      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      const key = `event-banners/${event._id}/${Date.now()}.${ext}`;
      await s3Service.uploadFile(key, file.buffer, file.mimetype, {
        eventId: event._id.toString(),
      });
      const url = s3Service.getPublicUrl(key);

      event.bannerUrl = url;
      await event.save();
      res.json({ success: true, url, key });
    } catch (err) {
      console.error("[event-management] banner upload failed:", err);
      bad(res, 500, "Failed to upload banner");
    }
  }
);

/**
 * POST /event-management/:id/image  (multipart, field `file`)
 *
 * Generic event-scoped image upload — speaker headshots, sponsor logos, block
 * imagery. Unlike /banner it saves nothing to the event: it returns the URL
 * and the caller stores it wherever it belongs. That matters for speakers,
 * which are uploaded while the record is still a draft in a modal and has no
 * id to attach to yet.
 */
router.post(
  "/:id/image",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const file = (req as any).file;
      if (!file) return bad(res, 400, "No image supplied (or unsupported type)");

      // `folder` only picks the prefix — it can never escape the event's own
      // path, so a crafted value can't write outside it.
      const folder = String(req.query.folder || "misc").replace(
        /[^a-z0-9-]/gi,
        ""
      );
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      const key = `event-media/${event._id}/${folder || "misc"}/${Date.now()}.${ext}`;
      await s3Service.uploadFile(key, file.buffer, file.mimetype, {
        eventId: event._id.toString(),
      });
      res.json({ success: true, url: s3Service.getPublicUrl(key), key });
    } catch (err) {
      console.error("[event-management] image upload failed:", err);
      bad(res, 500, "Failed to upload the image");
    }
  }
);

/** POST /event-management/:id/banner/presign — browser-direct S3 PUT. */
router.post(
  "/:id/banner/presign",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const parsed = z
        .object({
          contentType: z.string().regex(/^image\/(jpeg|png|webp|gif|avif)$/),
          fileName: z.string().optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return bad(res, 400, "Unsupported image type");

      const ext =
        (parsed.data.fileName?.split(".").pop() || "").toLowerCase() ||
        parsed.data.contentType.split("/")[1];
      const key = `event-banners/${event._id}/${Date.now()}.${ext}`;
      const uploadUrl = await s3Service.getPresignedUploadUrl(
        key,
        parsed.data.contentType
      );
      res.json({
        success: true,
        uploadUrl,
        key,
        publicUrl: s3Service.getPublicUrl(key),
      });
    } catch (err) {
      console.error("[event-management] presign failed:", err);
      bad(res, 500, "Failed to create upload URL");
    }
  }
);

// ══ Ticket tiers ═════════════════════════════════════════════════════════

/** GET /event-management/:id/tickets — tiers with live sales progress. */
router.get("/:id/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    // Hand back seats from checkouts nobody ever paid for, so this page
    // isn't reporting abandoned carts as inventory.
    await releaseExpiredHolds(event._id);

    // `?kind=addon` narrows to add-ons; omitted returns both so the Tickets
    // page can render its two tabs from one fetch.
    const kind = String(req.query.kind || "");
    const [tiers, sales] = await Promise.all([
      EventTicketTier.find({
        eventId: event._id,
        archivedAt: null,
        ...(kind === "ticket" || kind === "addon" ? { kind } : {}),
      })
        .sort({ sortOrder: 1 })
        .lean(),
      tierSalesStats(event._id),
    ]);
    res.json({
      success: true,
      tiers: tiers.map((t: any) => {
        // `soldCount` is the INVENTORY counter: it includes seats currently
        // held by an unpaid checkout. What the founder reads as "sold" and
        // "revenue" comes from the registrations instead.
        const stat = sales.get(String(t._id)) || { sold: 0, revenue: 0 };
        const held = Math.max(0, t.soldCount - stat.sold);
        return {
          ...t,
          // Documents written before add-ons existed have no `kind`.
          kind: t.kind || "ticket",
          soldCount: stat.sold,
          held,
          remaining: Math.max(0, t.quantity - t.soldCount),
          revenue: stat.revenue,
          percentSold:
            t.quantity > 0 ? Math.round((stat.sold / t.quantity) * 100) : 0,
        };
      }),
    });
  } catch (err) {
    console.error("[event-management] tickets list failed:", err);
    bad(res, 500, "Failed to load tickets");
  }
});

/** POST /event-management/:id/tickets — add a tier. */
router.post("/:id/tickets", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const parsed = ticketInputSchema.safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid ticket");
    const t = parsed.data;

    const kind = t.kind || "ticket";
    const count = await EventTicketTier.countDocuments({
      eventId: event._id,
      kind,
    });
    const tier = await EventTicketTier.create({
      eventId: event._id,
      kind,
      name: t.name,
      description: t.description,
      perks: t.perks || [],
      price: t.price,
      currency: (t.currency || "USD").toUpperCase(),
      quantity: t.quantity,
      salesStart: t.salesStart ? new Date(t.salesStart) : undefined,
      salesEnd: t.salesEnd ? new Date(t.salesEnd) : undefined,
      isVisible: t.isVisible ?? true,
      isPaused: t.isPaused ?? false,
      sortOrder: t.sortOrder ?? count,
    });
    res.status(201).json({ success: true, tier });
  } catch (err) {
    console.error("[event-management] ticket create failed:", err);
    bad(res, 500, "Failed to create ticket");
  }
});

/**
 * PUT /event-management/:id/tickets/reorder
 * Declared before /tickets/:ticketId so "reorder" is never captured as an id.
 */
router.put(
  "/:id/tickets/reorder",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const parsed = z
        .object({ orderedIds: z.array(z.string()).min(1) })
        .safeParse(req.body);
      if (!parsed.success) return bad(res, 400, "orderedIds is required");

      const ids = parsed.data.orderedIds.filter((i) => Types.ObjectId.isValid(i));
      await EventTicketTier.bulkWrite(
        ids.map((id, index) => ({
          updateOne: {
            // eventId in the filter so a crafted id from another event can't be
            // reordered through this endpoint.
            filter: { _id: new Types.ObjectId(id), eventId: event._id },
            update: { $set: { sortOrder: index } },
          },
        }))
      );
      const tiers = await EventTicketTier.find({
        eventId: event._id,
        archivedAt: null,
      })
        .sort({ sortOrder: 1 })
        .lean();
      res.json({ success: true, tiers });
    } catch (err) {
      console.error("[event-management] ticket reorder failed:", err);
      bad(res, 500, "Failed to reorder tickets");
    }
  }
);

/** PUT /event-management/:id/tickets/:ticketId */
router.put(
  "/:id/tickets/:ticketId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { ticketId } = req.params as { ticketId: string };
      if (!Types.ObjectId.isValid(ticketId)) return bad(res, 400, "Invalid ticket id");

      const parsed = ticketInputSchema.partial().safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid ticket");
      const t = parsed.data;

      const tier = await EventTicketTier.findOne({
        _id: new Types.ObjectId(ticketId),
        eventId: event._id,
      });
      if (!tier) return bad(res, 404, "Ticket not found");

      // Capacity can be raised freely but never cut below what is already
      // claimed — those seats are either sold or in an active checkout.
      // Sweep first so an abandoned cart from an hour ago doesn't block a
      // legitimate edit.
      if (t.quantity !== undefined) {
        if (await releaseExpiredHolds(event._id)) {
          const fresh = await EventTicketTier.findById(tier._id)
            .select("soldCount")
            .lean();
          if (fresh) tier.soldCount = (fresh as any).soldCount;
        }
        if (t.quantity < tier.soldCount) {
          return bad(
            res,
            400,
            `Quantity cannot be lower than the ${tier.soldCount} seat(s) already taken`
          );
        }
      }

      if (t.name !== undefined) tier.name = t.name;
      if (t.description !== undefined) tier.description = t.description;
      if (t.perks !== undefined) tier.perks = t.perks;
      if (t.price !== undefined) tier.price = t.price;
      if (t.currency !== undefined) tier.currency = t.currency.toUpperCase();
      if (t.quantity !== undefined) tier.quantity = t.quantity;
      if (t.salesStart !== undefined)
        tier.salesStart = t.salesStart ? new Date(t.salesStart) : undefined;
      if (t.salesEnd !== undefined)
        tier.salesEnd = t.salesEnd ? new Date(t.salesEnd) : undefined;
      if (t.isVisible !== undefined) tier.isVisible = t.isVisible;
      if (t.isPaused !== undefined) tier.isPaused = t.isPaused;
      if (t.sortOrder !== undefined) tier.sortOrder = t.sortOrder;

      await tier.save();
      res.json({ success: true, tier });
    } catch (err) {
      console.error("[event-management] ticket update failed:", err);
      bad(res, 500, "Failed to update ticket");
    }
  }
);

/** DELETE /event-management/:id/tickets/:ticketId — archive an unsold tier. */
router.delete(
  "/:id/tickets/:ticketId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { ticketId } = req.params as { ticketId: string };
      if (!Types.ObjectId.isValid(ticketId)) return bad(res, 400, "Invalid ticket id");

      const tier = await EventTicketTier.findOne({
        _id: new Types.ObjectId(ticketId),
        eventId: event._id,
      });
      if (!tier) return bad(res, 404, "Ticket not found");
      // Same sweep as the update path: a stale hold must not make a tier
      // permanently undeletable.
      if (await releaseExpiredHolds(event._id)) {
        const fresh = await EventTicketTier.findById(tier._id)
          .select("soldCount")
          .lean();
        if (fresh) tier.soldCount = (fresh as any).soldCount;
      }
      if (tier.soldCount > 0)
        return bad(
          res,
          400,
          "This tier has sales or a checkout in progress — hide it or pause sales instead of deleting"
        );

      tier.archivedAt = new Date();
      await tier.save();
      res.json({ success: true });
    } catch (err) {
      console.error("[event-management] ticket delete failed:", err);
      bad(res, 500, "Failed to delete ticket");
    }
  }
);

// ══ Registrations ════════════════════════════════════════════════════════

/** GET /event-management/:id/registrations */
router.get(
  "/:id/registrations",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const parsed = z
        .object({
          status: z
            .enum(["pending_approval", "approved", "rejected", "cancelled"])
            .optional(),
          search: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(500).default(50),
          offset: z.coerce.number().int().min(0).default(0),
        })
        .safeParse(req.query);
      if (!parsed.success) return bad(res, 400, "Invalid query");
      const { status, search, limit, offset } = parsed.data;

      const query: Record<string, any> = { eventId: event._id };
      if (status) query.status = status;
      if (search?.trim()) {
        const rx = { $regex: search.trim(), $options: "i" };
        query.$or = [
          { "attendee.name": rx },
          { "attendee.email": rx },
          { "attendee.company": rx },
        ];
      }

      const [registrations, total] = await Promise.all([
        EventRegistration.find(query)
          .sort({ createdAt: -1 })
          .skip(offset)
          .limit(limit)
          .populate("ticketTierId", "name price currency")
          .lean(),
        EventRegistration.countDocuments(query),
      ]);

      // Who brought each buyer in.
      //
      // Attribution lives on the User, not on the registration, so it is
      // resolved here rather than stored twice: buyer -> referredBy -> that
      // affiliate's name. Two queries for the whole page instead of one per
      // row, and a registration with no account or no referrer simply has no
      // tag. `referredBySource` is carried through so the console can tell a
      // real affiliate click apart from a founder default.
      const buyerIds = registrations
        .map((r: any) => r.userId)
        .filter(Boolean);
      const referrerByRegistration: Record<string, any> = {};
      if (buyerIds.length) {
        const buyers = await User.find({ _id: { $in: buyerIds } })
          .select("_id referredBy referredBySource")
          .lean();
        const buyerById = new Map(buyers.map((b: any) => [String(b._id), b]));
        const referrerIds = buyers
          .map((b: any) => b.referredBy)
          .filter(Boolean);
        const referrers = referrerIds.length
          ? await User.find({ _id: { $in: referrerIds } })
              .select("_id name email affiliateId")
              .lean()
          : [];
        const referrerById = new Map(
          referrers.map((r: any) => [String(r._id), r])
        );
        for (const reg of registrations as any[]) {
          const buyer = reg.userId && buyerById.get(String(reg.userId));
          const referrer =
            buyer?.referredBy && referrerById.get(String(buyer.referredBy));
          if (!referrer) continue;
          referrerByRegistration[String(reg._id)] = {
            name: referrer.name || referrer.email || "Affiliate",
            affiliateId: referrer.affiliateId || null,
            source: buyer.referredBySource || null,
          };
        }
      }

      res.json({
        success: true,
        total,
        registrations: (registrations as any[]).map((r) => ({
          ...r,
          referredBy: referrerByRegistration[String(r._id)] || null,
        })),
      });
    } catch (err) {
      console.error("[event-management] registrations failed:", err);
      bad(res, 500, "Failed to load registrations");
    }
  }
);

async function setRegistrationStatus(
  req: Request,
  res: Response,
  status: "approved" | "rejected"
) {
  const event = await loadEvent(req, res);
  if (!event) return;
  const { regId } = req.params as { regId: string };
  if (!Types.ObjectId.isValid(regId)) return bad(res, 400, "Invalid registration id");

  const registration = await EventRegistration.findOne({
    _id: new Types.ObjectId(regId),
    eventId: event._id,
  });
  if (!registration) return bad(res, 404, "Registration not found");

  // No-op if it is already in that state. Without this, clicking Reject twice
  // would return the seats to inventory twice and inflate the tier's stock.
  if (registration.status === status) {
    return res.json({ success: true, registration });
  }

  const wasHoldingSeat =
    registration.status === "pending_approval" || registration.status === "approved";

  if (status === "approved" && !wasHoldingSeat) {
    // Un-rejecting: take the seat back out of inventory. If the tier has since
    // sold out, say so rather than overselling the room.
    const reclaimed = await claimTierSeats(
      registration.ticketTierId,
      registration.quantity || 1
    );
    if (!reclaimed) {
      return bad(res, 409, "That ticket type is now sold out");
    }
  }

  registration.status = status;
  if (status === "rejected") {
    registration.rejectedReason =
      typeof req.body?.reason === "string" ? req.body.reason.slice(0, 500) : undefined;
    // Rejecting frees the seat so it can be resold.
    if (wasHoldingSeat) {
      await releaseTierSeats(registration.ticketTierId, registration.quantity || 1);
    }
  }
  await registration.save();

  // Fire-and-forget so a mail outage never blocks the organizer's click.
  void sendRegistrationDecisionEmail(event, registration, status).catch((e) =>
    console.error("[event-management] decision email failed:", e?.message)
  );

  res.json({ success: true, registration });
}

router.post(
  "/:id/registrations/:regId/approve",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await setRegistrationStatus(req, res, "approved");
    } catch (err) {
      console.error("[event-management] approve failed:", err);
      bad(res, 500, "Failed to approve registration");
    }
  }
);

router.post(
  "/:id/registrations/:regId/reject",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      await setRegistrationStatus(req, res, "rejected");
    } catch (err) {
      console.error("[event-management] reject failed:", err);
      bad(res, 500, "Failed to reject registration");
    }
  }
);

/** POST /event-management/:id/registrations/:regId/check-in — door scanner. */
router.post(
  "/:id/registrations/:regId/check-in",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { regId } = req.params as { regId: string };
      if (!Types.ObjectId.isValid(regId)) return bad(res, 400, "Invalid registration id");

      const registration = await EventRegistration.findOne({
        _id: new Types.ObjectId(regId),
        eventId: event._id,
      });
      if (!registration) return bad(res, 404, "Registration not found");
      if (registration.status !== "approved")
        return bad(res, 400, "This registration is not approved");

      registration.checkedInAt = registration.checkedInAt || new Date();
      await registration.save();
      res.json({ success: true, registration });
    } catch (err) {
      console.error("[event-management] check-in failed:", err);
      bad(res, 500, "Failed to check in attendee");
    }
  }
);

/** GET /event-management/:id/registrations/export — CSV for the SELL tab. */
router.get(
  "/:id/registrations/export",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const [rows, form] = await Promise.all([
        EventRegistration.find({ eventId: event._id })
          .sort({ createdAt: -1 })
          .populate("ticketTierId", "name")
          .lean(),
        EventRegistrationForm.findOne({ eventId: event._id }).lean(),
      ]);

      // One column per custom / consent question, in the order the organizer
      // arranged them. Without this the answers are collected and never seen.
      const customFields = ((form as any)?.fields || [])
        .filter(
          (f: any) =>
            ![
              "first_name",
              "last_name",
              "email",
              "phone",
              "company",
              "job_title",
              "country",
            ].includes(f.type)
        )
        .sort((a: any, b: any) => a.order - b.order);

      const esc = (v: any) => {
        const flat = Array.isArray(v)
          ? v.join("; ")
          : typeof v === "boolean"
            ? v
              ? "Yes"
              : "No"
            : v;
        return `"${String(flat ?? "").replace(/"/g, '""')}"`;
      };
      const header = [
        "Name",
        "Email",
        "Phone",
        "Company",
        "Job title",
        "Ticket",
        "Add-ons",
        "Quantity",
        "Status",
        "Payment",
        "Amount",
        "Currency",
        "Registered at",
        "Checked in at",
        ...customFields.map((f: any) => f.label),
      ]
        .map(esc)
        .join(",");
      const body = rows
        .map((r: any) =>
          [
            r.attendee?.name,
            r.attendee?.email,
            r.attendee?.phone,
            r.attendee?.company,
            r.attendee?.jobTitle,
            r.ticketTierId?.name,
            (r.addons || [])
              .map((a: any) => `${a.name} x${a.quantity}`)
              .join("; "),
            r.quantity,
            r.status,
            r.paymentStatus,
            r.amountPaid,
            r.currency,
            r.createdAt?.toISOString?.() || "",
            r.checkedInAt?.toISOString?.() || "",
            ...customFields.map((f: any) => r.answers?.[f.key]),
          ]
            .map(esc)
            .join(",")
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${event.slug}-registrations.csv"`
      );
      res.send(`${header}\n${body}`);
    } catch (err) {
      console.error("[event-management] export failed:", err);
      bad(res, 500, "Failed to export registrations");
    }
  }
);

// ══ Speakers ═════════════════════════════════════════════════════════════

const speakerSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  bio: z.string().max(2000).optional(),
  avatarUrl: z.string().optional(),
  socials: z
    .object({
      twitter: z.string().optional(),
      linkedin: z.string().optional(),
      website: z.string().optional(),
      instagram: z.string().optional(),
    })
    .optional(),
  isKeynote: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/:id/speakers", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const speakers = await EventSpeaker.find({ eventId: event._id })
      .sort({ sortOrder: 1, createdAt: 1 })
      .lean();
    res.json({ success: true, speakers });
  } catch (err) {
    console.error("[event-management] speakers failed:", err);
    bad(res, 500, "Failed to load speakers");
  }
});

router.post("/:id/speakers", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const parsed = speakerSchema.safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid speaker");
    const count = await EventSpeaker.countDocuments({ eventId: event._id });
    const speaker = await EventSpeaker.create({
      ...parsed.data,
      sortOrder: parsed.data.sortOrder ?? count,
      eventId: event._id,
    });
    res.status(201).json({ success: true, speaker });
  } catch (err) {
    console.error("[event-management] speaker create failed:", err);
    bad(res, 500, "Failed to create speaker");
  }
});

router.put(
  "/:id/speakers/:speakerId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { speakerId } = req.params as { speakerId: string };
      if (!Types.ObjectId.isValid(speakerId)) return bad(res, 400, "Invalid speaker id");
      const parsed = speakerSchema.partial().safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid speaker");

      const speaker = await EventSpeaker.findOneAndUpdate(
        { _id: new Types.ObjectId(speakerId), eventId: event._id },
        { $set: parsed.data },
        { new: true }
      );
      if (!speaker) return bad(res, 404, "Speaker not found");
      res.json({ success: true, speaker });
    } catch (err) {
      console.error("[event-management] speaker update failed:", err);
      bad(res, 500, "Failed to update speaker");
    }
  }
);

router.delete(
  "/:id/speakers/:speakerId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { speakerId } = req.params as { speakerId: string };
      if (!Types.ObjectId.isValid(speakerId)) return bad(res, 400, "Invalid speaker id");
      await EventSpeaker.deleteOne({
        _id: new Types.ObjectId(speakerId),
        eventId: event._id,
      });
      // Drop the speaker from any session they were billed on, otherwise the
      // public agenda renders an empty chip.
      await EventAgendaSession.updateMany(
        { eventId: event._id },
        { $pull: { speakerIds: new Types.ObjectId(speakerId) } }
      );
      res.json({ success: true });
    } catch (err) {
      console.error("[event-management] speaker delete failed:", err);
      bad(res, 500, "Failed to delete speaker");
    }
  }
);

// ══ Agenda ═══════════════════════════════════════════════════════════════

const sessionSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(3000).optional(),
  stageName: z.string().max(120).optional(),
  room: z.string().max(120).optional(),
  sessionType: z.enum(["session", "break"]).optional(),
  trackColor: z.string().max(32).optional(),
  isLimitedSeats: z.boolean().optional(),
  format: z.enum(["in_person", "virtual", "hybrid"]).optional(),
  requiresRegistration: z.boolean().optional(),
  seatsAvailable: z.number().int().min(0).optional(),
  isRecorded: z.boolean().optional(),
  enableQa: z.boolean().optional(),
  enablePolls: z.boolean().optional(),
  startTime: z.string(),
  endTime: z.string(),
  speakerIds: z.array(z.string()).optional(),
  isLivestreamed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * A session belongs to its event's window, so anything outside it is a bug in
 * whatever produced the payload rather than a choice the organizer made. The
 * console's day and time pickers are already bounded by the same dates; this
 * is the check that holds for direct API callers and for a stale tab whose
 * event has since been re-dated.
 */
const OUT_OF_RANGE = "Session time must fall within the event date range";

function withinEventRange(
  event: { startsAt: Date; endsAt: Date },
  start: Date,
  end: Date
): boolean {
  return start >= event.startsAt && end <= event.endsAt;
}

router.get("/:id/agenda", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const sessions = await EventAgendaSession.find({ eventId: event._id })
      .sort({ startTime: 1, sortOrder: 1 })
      .lean();
    res.json({ success: true, sessions });
  } catch (err) {
    console.error("[event-management] agenda failed:", err);
    bad(res, 500, "Failed to load agenda");
  }
});

router.post("/:id/agenda", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid session");
    const start = new Date(parsed.data.startTime);
    const end = new Date(parsed.data.endTime);
    if (isNaN(start.getTime()) || isNaN(end.getTime()))
      return bad(res, 400, "Invalid session times");
    if (end <= start) return bad(res, 400, "Session end must be after its start");
    if (!withinEventRange(event, start, end)) return bad(res, 400, OUT_OF_RANGE);

    const session = await EventAgendaSession.create({
      eventId: event._id,
      title: parsed.data.title,
      description: parsed.data.description,
      stageName: parsed.data.stageName || "Main Stage",
      room: parsed.data.room,
      sessionType: parsed.data.sessionType || "session",
      trackColor: parsed.data.trackColor,
      isLimitedSeats: parsed.data.isLimitedSeats ?? false,
      format: parsed.data.format || "in_person",
      requiresRegistration: parsed.data.requiresRegistration ?? false,
      seatsAvailable: parsed.data.seatsAvailable ?? 0,
      isRecorded: parsed.data.isRecorded ?? false,
      enableQa: parsed.data.enableQa ?? false,
      enablePolls: parsed.data.enablePolls ?? false,
      startTime: start,
      endTime: end,
      speakerIds: (parsed.data.speakerIds || [])
        .filter((s) => Types.ObjectId.isValid(s))
        .map((s) => new Types.ObjectId(s)),
      isLivestreamed: parsed.data.isLivestreamed ?? false,
      sortOrder: parsed.data.sortOrder ?? 0,
    });
    res.status(201).json({ success: true, session });
  } catch (err) {
    console.error("[event-management] session create failed:", err);
    bad(res, 500, "Failed to create session");
  }
});

router.put(
  "/:id/agenda/:sessionId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { sessionId } = req.params as { sessionId: string };
      if (!Types.ObjectId.isValid(sessionId)) return bad(res, 400, "Invalid session id");
      const parsed = sessionSchema.partial().safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid session");

      const existing = await EventAgendaSession.findOne({
        _id: new Types.ObjectId(sessionId),
        eventId: event._id,
      });
      if (!existing) return bad(res, 404, "Session not found");

      const update: Record<string, any> = { ...parsed.data };
      if (parsed.data.startTime) update.startTime = new Date(parsed.data.startTime);
      if (parsed.data.endTime) update.endTime = new Date(parsed.data.endTime);
      if (parsed.data.speakerIds)
        update.speakerIds = parsed.data.speakerIds
          .filter((s) => Types.ObjectId.isValid(s))
          .map((s) => new Types.ObjectId(s));

      // A partial update can move one edge past the other, so both checks run
      // against the times the session would end up with, not just the sent ones.
      const start: Date = update.startTime ?? existing.startTime;
      const end: Date = update.endTime ?? existing.endTime;
      if (isNaN(start.getTime()) || isNaN(end.getTime()))
        return bad(res, 400, "Invalid session times");
      if (end <= start)
        return bad(res, 400, "Session end must be after its start");
      // Only enforced when the edit actually touches the times: an organizer
      // renaming a session that a later date change put out of range should
      // not be blocked by it.
      if (
        (update.startTime || update.endTime) &&
        !withinEventRange(event, start, end)
      )
        return bad(res, 400, OUT_OF_RANGE);

      const session = await EventAgendaSession.findOneAndUpdate(
        { _id: existing._id, eventId: event._id },
        { $set: update },
        { new: true }
      );
      if (!session) return bad(res, 404, "Session not found");
      res.json({ success: true, session });
    } catch (err) {
      console.error("[event-management] session update failed:", err);
      bad(res, 500, "Failed to update session");
    }
  }
);

router.delete(
  "/:id/agenda/:sessionId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { sessionId } = req.params as { sessionId: string };
      if (!Types.ObjectId.isValid(sessionId)) return bad(res, 400, "Invalid session id");
      await EventAgendaSession.deleteOne({
        _id: new Types.ObjectId(sessionId),
        eventId: event._id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[event-management] session delete failed:", err);
      bad(res, 500, "Failed to delete session");
    }
  }
);

// ══ Sponsors ═════════════════════════════════════════════════════════════

const sponsorSchema = z.object({
  name: z.string().min(1).max(200),
  tier: z.enum(["platinum", "gold", "silver", "community"]).optional(),
  logoUrl: z.string().optional(),
  boothNumber: z.string().max(40).optional(),
  websiteUrl: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/:id/sponsors", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const sponsors = await EventSponsor.find({ eventId: event._id }).lean();
    // Flat, organizer-defined order — see the note on the public route. The
    // stored `tier` is left alone so the banding can be restored.
    sponsors.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
    res.json({ success: true, sponsors });
  } catch (err) {
    console.error("[event-management] sponsors failed:", err);
    bad(res, 500, "Failed to load sponsors");
  }
});

router.post("/:id/sponsors", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const parsed = sponsorSchema.safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid sponsor");
    const count = await EventSponsor.countDocuments({ eventId: event._id });
    const sponsor = await EventSponsor.create({
      ...parsed.data,
      sortOrder: parsed.data.sortOrder ?? count,
      eventId: event._id,
    });
    res.status(201).json({ success: true, sponsor });
  } catch (err) {
    console.error("[event-management] sponsor create failed:", err);
    bad(res, 500, "Failed to create sponsor");
  }
});

router.put(
  "/:id/sponsors/:sponsorId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { sponsorId } = req.params as { sponsorId: string };
      if (!Types.ObjectId.isValid(sponsorId)) return bad(res, 400, "Invalid sponsor id");
      const parsed = sponsorSchema.partial().safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid sponsor");
      const sponsor = await EventSponsor.findOneAndUpdate(
        { _id: new Types.ObjectId(sponsorId), eventId: event._id },
        { $set: parsed.data },
        { new: true }
      );
      if (!sponsor) return bad(res, 404, "Sponsor not found");
      res.json({ success: true, sponsor });
    } catch (err) {
      console.error("[event-management] sponsor update failed:", err);
      bad(res, 500, "Failed to update sponsor");
    }
  }
);

router.delete(
  "/:id/sponsors/:sponsorId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const { sponsorId } = req.params as { sponsorId: string };
      if (!Types.ObjectId.isValid(sponsorId)) return bad(res, 400, "Invalid sponsor id");
      await EventSponsor.deleteOne({
        _id: new Types.ObjectId(sponsorId),
        eventId: event._id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[event-management] sponsor delete failed:", err);
      bad(res, 500, "Failed to delete sponsor");
    }
  }
);

// ══ Promotions ═══════════════════════════════════════════════════════════
//
// There is no events-only discount system. Event coupons are ordinary founder
// coupons created from the existing Coupons surface with
// `applicableTo: ["event_ticket"]` and, optionally, this event in
// `specificItemIds` — see routes/founderCoupons.ts. The public checkout
// validates them through services/coupon.ts like every other paid item.

// ══ Email campaigns ══════════════════════════════════════════════════════

/**
 * GET /event-management/:id/campaigns/recipients?audience=…
 *
 * The email addresses behind one audience segment, so the caller can hand
 * them to NetworkMail as manual recipients.
 *
 * Events deliberately do NOT send mail themselves any more. NetworkMail owns
 * templates, scheduling, throttling, unsubscribe and bounce handling and the
 * delivery reports — a second sender inside this module bypassed all of it,
 * which is exactly the kind of thing that gets a sending domain blocked.
 * This endpoint is the seam: events know who, NetworkMail knows how.
 */
router.get(
  "/:id/campaigns/recipients",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const parsed = z
        .object({
          audience: z
            .enum(["all", "approved", "pending_approval", "paid"])
            .default("all"),
        })
        .safeParse(req.query);
      if (!parsed.success) return bad(res, 400, "Invalid audience");
      const { audience } = parsed.data;

      const query: Record<string, any> = { eventId: event._id };
      if (audience === "approved") query.status = "approved";
      else if (audience === "pending_approval") query.status = "pending_approval";
      else if (audience === "paid") query.paymentStatus = "paid";
      else query.status = { $in: ["approved", "pending_approval"] };

      const rows = await EventRegistration.find(query)
        .select("attendee.email attendee.name")
        .lean();

      // One person who bought twice is still one recipient.
      const seen = new Set<string>();
      const recipients: Array<{ email: string; name?: string }> = [];
      for (const r of rows as any[]) {
        const email = String(r.attendee?.email || "").toLowerCase().trim();
        if (!email || seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, name: r.attendee?.name });
      }

      res.json({ success: true, total: recipients.length, recipients });
    } catch (err) {
      console.error("[event-management] campaign recipients failed:", err);
      bad(res, 500, "Failed to load recipients");
    }
  }
);

/** GET /event-management/:id/campaigns/audience — recipient counts per segment. */
router.get(
  "/:id/campaigns/audience",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const [all, approved, pending, paid] = await Promise.all([
        EventRegistration.countDocuments({
          eventId: event._id,
          status: { $in: ["approved", "pending_approval"] },
        }),
        EventRegistration.countDocuments({ eventId: event._id, status: "approved" }),
        EventRegistration.countDocuments({
          eventId: event._id,
          status: "pending_approval",
        }),
        EventRegistration.countDocuments({
          eventId: event._id,
          paymentStatus: "paid",
        }),
      ]);
      res.json({ success: true, counts: { all, approved, pending_approval: pending, paid } });
    } catch (err) {
      console.error("[event-management] audience failed:", err);
      bad(res, 500, "Failed to load audience counts");
    }
  }
);

// ══ Registration form ════════════════════════════════════════════════════

const formFieldSchema = z.object({
  key: z.string().min(1).max(80),
  type: z.enum(FORM_FIELD_TYPES),
  label: z.string().min(1).max(200),
  placeholder: z.string().max(200).optional(),
  helpText: z.string().max(300).optional(),
  required: z.boolean().optional(),
  showOnBadge: z.boolean().optional(),
  mapToDealsField: z.string().max(120).optional(),
  options: z.array(z.string().max(200)).max(50).optional(),
  conditions: z
    .array(
      z.object({
        source: z.literal("ticket_type"),
        operator: z.enum(["is", "is_not"]),
        values: z.array(z.string()).max(50),
      })
    )
    .max(10)
    .optional(),
});

/**
 * GET /event-management/:id/registration-form
 * Creates the default form on first read, so the builder always opens on
 * something rather than an empty canvas.
 */
router.get(
  "/:id/registration-form",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;

      let form = await EventRegistrationForm.findOne({ eventId: event._id });
      if (!form) {
        form = await EventRegistrationForm.create({
          eventId: event._id,
          title: `Register for ${event.name}`,
          description:
            "Please fill out this form to complete your ticket registration.",
          fields: defaultFormFields(),
        });
      }
      res.json({ success: true, form });
    } catch (err) {
      console.error("[event-management] registration form load failed:", err);
      bad(res, 500, "Failed to load the registration form");
    }
  }
);

/**
 * PUT /event-management/:id/registration-form
 *
 * The whole form is replaced in one write — the builder holds the canonical
 * order client-side, and a partial patch would need per-field diffing for no
 * benefit. `order` is assigned from array position so the two can never
 * disagree.
 */
router.put(
  "/:id/registration-form",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;

      const parsed = z
        .object({
          title: z.string().max(200).optional(),
          description: z.string().max(500).optional(),
          fields: z.array(formFieldSchema).max(60),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid form");

      // Keys are what answers are stored against, so a duplicate would make
      // one field silently overwrite another's answer.
      const keys = parsed.data.fields.map((f) => f.key);
      if (new Set(keys).size !== keys.length)
        return bad(res, 400, "Two fields share the same key");

      // A choice field with no choices renders as an empty dropdown the buyer
      // can't answer — catch it here rather than on the public page.
      const emptyChoice = parsed.data.fields.find(
        (f) =>
          (f.type === "dropdown" || f.type === "multi_select") &&
          !(f.options || []).filter((o) => o.trim()).length
      );
      if (emptyChoice)
        return bad(res, 400, `"${emptyChoice.label}" needs at least one option`);

      const form = await EventRegistrationForm.findOneAndUpdate(
        { eventId: event._id },
        {
          $set: {
            title: parsed.data.title ?? "",
            description: parsed.data.description,
            fields: parsed.data.fields.map((f, order) => ({
              ...f,
              required: f.required ?? false,
              showOnBadge: f.showOnBadge ?? false,
              // Trimmed, not just filtered: the buyer's answer is compared
              // against these, and a stored " Medium" never matches "Medium".
              options: (f.options || []).map((o) => o.trim()).filter(Boolean),
              conditions: f.conditions || [],
              order,
            })),
          },
        },
        { new: true, upsert: true }
      );
      res.json({ success: true, form });
    } catch (err) {
      console.error("[event-management] registration form save failed:", err);
      bad(res, 500, "Failed to save the registration form");
    }
  }
);

// ══ Website builder ══════════════════════════════════════════════════════

const blockSchema = z.object({
  id: z.string().min(1),
  type: z.enum(EVENT_BLOCK_TYPES as [string, ...string[]]),
  order: z.number().int(),
  isVisible: z.boolean().default(true),
  content: z.record(z.string(), z.any()).default({}),
  styles: z.record(z.string(), z.string()).default({}),
});

/** GET /event-management/:id/website — builder config (draft). */
router.get("/:id/website", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const config = await ensureWebsiteConfig(event);

    // The builder preview needs the same data the public page renders, or the
    // agenda/speakers/sponsors blocks would preview empty.
    const [tiers, speakers, sessions, sponsors] = await Promise.all([
      EventTicketTier.find({ eventId: event._id, archivedAt: null })
        .sort({ sortOrder: 1 })
        .lean(),
      EventSpeaker.find({ eventId: event._id }).sort({ sortOrder: 1 }).lean(),
      EventAgendaSession.find({ eventId: event._id }).sort({ startTime: 1 }).lean(),
      EventSponsor.find({ eventId: event._id }).lean(),
    ]);

    res.json({
      success: true,
      config,
      event,
      data: { tiers, speakers, sessions, sponsors },
    });
  } catch (err) {
    console.error("[event-management] website load failed:", err);
    bad(res, 500, "Failed to load website config");
  }
});

/** PUT /event-management/:id/website — save the draft blocks + theme. */
router.put("/:id/website", requireAuth, async (req: Request, res: Response) => {
  try {
    const event = await loadEvent(req, res);
    if (!event) return;
    const parsed = z
      .object({
        blocks: z.array(blockSchema),
        theme: z
          .object({
            primaryColor: z.string().optional(),
            backgroundColor: z.string().optional(),
            font: z.string().optional(),
          })
          .optional(),
      })
      .safeParse(req.body);
    if (!parsed.success)
      return bad(res, 400, parsed.error.issues[0]?.message || "Invalid block config");

    const config = await ensureWebsiteConfig(event);
    // Re-index rather than trusting the client's `order` — a duplicate order
    // would make the public render non-deterministic.
    config.blocks = parsed.data.blocks
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((b, i) => ({ ...b, order: i })) as any;
    if (parsed.data.theme)
      config.theme = { ...(config.theme as any), ...parsed.data.theme };
    await config.save();

    res.json({ success: true, config });
  } catch (err) {
    console.error("[event-management] website save failed:", err);
    bad(res, 500, "Failed to save website config");
  }
});

/**
 * POST /event-management/:id/website/publish
 * Snapshot the draft into the published fields. The public page reads only the
 * snapshot, so nothing goes live until this runs.
 */
router.post(
  "/:id/website/publish",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const config = await ensureWebsiteConfig(event);

      config.publishedBlocks = JSON.parse(JSON.stringify(config.blocks));
      config.publishedTheme = JSON.parse(JSON.stringify(config.theme));
      config.isPublished = true;
      config.publishedAt = new Date();
      await config.save();

      res.json({
        success: true,
        config,
        publicSlug: event.slug,
        // Still a draft event → the site is published but the page will 404
        // until the event itself is published. Surfaced so the UI can say so.
        eventPublished: event.status === "published",
      });
    } catch (err) {
      console.error("[event-management] website publish failed:", err);
      bad(res, 500, "Failed to publish website");
    }
  }
);

// ── Website settings: domain, branding, SEO, sharing ────────────────────

/** PUT /event-management/:id/website/settings — everything but the blocks. */
router.put(
  "/:id/website/settings",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;

      const parsed = z
        .object({
          branding: z
            .object({
              logoUrl: z.string().max(2000).optional(),
              faviconUrl: z.string().max(2000).optional(),
              siteName: z.string().max(120).optional(),
            })
            .optional(),
          seo: z
            .object({
              title: z.string().max(70).optional(),
              description: z.string().max(200).optional(),
              keywords: z.array(z.string().max(60)).max(20).optional(),
              noIndex: z.boolean().optional(),
            })
            .optional(),
          social: z
            .object({
              ogTitle: z.string().max(120).optional(),
              ogDescription: z.string().max(300).optional(),
              ogImageUrl: z.string().max(2000).optional(),
              twitterCard: z.enum(["summary", "summary_large_image"]).optional(),
              twitterHandle: z.string().max(40).optional(),
            })
            .optional(),
        })
        .safeParse(req.body);
      if (!parsed.success)
        return bad(res, 400, parsed.error.issues[0]?.message || "Invalid settings");

      const config = await ensureWebsiteConfig(event);
      if (parsed.data.branding)
        config.branding = { ...(config.branding || {}), ...parsed.data.branding };
      if (parsed.data.seo)
        config.seo = {
          ...(config.seo || { keywords: [], noIndex: false }),
          ...parsed.data.seo,
        } as any;
      if (parsed.data.social)
        config.social = {
          ...(config.social || { twitterCard: "summary_large_image" }),
          ...parsed.data.social,
        } as any;
      await config.save();

      res.json({ success: true, config });
    } catch (err) {
      console.error("[event-management] website settings save failed:", err);
      bad(res, 500, "Failed to save website settings");
    }
  }
);

/**
 * POST /event-management/:id/website/domain — attach a custom domain.
 *
 * Reuses the org-wide app-domain flow (routes/initialSetup.ts): the host is
 * registered on `organization.customAppDomains` with `kind: "event"` and
 * attached to the same Vercel project that serves /e/<slug>. That is what
 * gets the certificate issued — a domain verified only by our own DNS lookup
 * would resolve but serve a cert error. The event's website config just
 * records WHICH host serves it.
 */
router.post(
  "/:id/website/domain",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const parsed = z
        .object({ host: z.string().min(1).max(300) })
        .safeParse(req.body);
      if (!parsed.success) return bad(res, 400, "Enter a domain");

      const norm = normaliseHost(parsed.data.host);
      if (!norm.ok) return bad(res, 400, norm.error);
      const host = norm.host;

      const org = await Organization.findById(event.orgId);
      if (!org) return bad(res, 404, "Organization not found");

      // Same guard the app-domain route uses: one host, one org.
      const otherOrg = await Organization.findOne({
        _id: { $ne: org._id },
        "customAppDomains.domain": host,
      })
        .select("_id")
        .lean();
      if (otherOrg)
        return bad(res, 409, "That domain is already in use by another organization");

      // …and one host, one event, within this org.
      const clash = await EventWebsiteConfig.findOne({
        "domain.host": host,
        eventId: { $ne: event._id },
      })
        .select("_id")
        .lean();
      if (clash)
        return bad(res, 409, "That domain is already connected to another event");

      const isSubdomain = host.split(".").length > 2;
      const dnsRecords: Array<{
        type: string;
        name: string;
        value: string;
        verified: boolean;
      }> = isSubdomain
        ? [
            {
              type: "CNAME",
              name: host.split(".")[0],
              value: "cname.vercel-dns.com",
              verified: false,
            },
          ]
        : [
            { type: "A", name: "@", value: "216.198.79.1", verified: false },
            {
              type: "CNAME",
              name: "www",
              value: "cname.vercel-dns.com",
              verified: false,
            },
          ];

      // Vercel first, so any ownership TXT challenge it issues is folded into
      // the records before they are persisted and shown.
      const vercel = await addDomainToVercel(host, "event");
      if (!vercel.success)
        return bad(res, 400, vercel.error || "Could not attach that domain");
      dnsRecords.push(
        ...verificationToDnsRecords(vercel.vercelConfig?.verification)
      );

      const existing = (org.customAppDomains || []).find(
        (d: any) => d.domain?.toLowerCase() === host
      );
      if (existing) {
        (existing as any).kind = "event";
        (existing as any).dnsRecords = dnsRecords;
      } else {
        (org.customAppDomains as any).push({
          domain: host,
          kind: "event",
          verified: false,
          dnsRecords,
        });
      }
      await org.save();

      const config = await ensureWebsiteConfig(event);
      config.domain = { host, status: "pending" } as any;
      await config.save();

      res.json({
        success: true,
        domain: config.domain,
        records: dnsRecords,
      });
    } catch (err: any) {
      console.error("[event-management] domain attach failed:", err);
      bad(res, 500, "Failed to add the domain");
    }
  }
);

/**
 * POST /event-management/:id/website/domain/verify
 *
 * Vercel's `verified` flag is the source of truth, exactly as in
 * /initial-setup/verify-app-domain: it only flips once ownership is proven,
 * DNS resolves AND the certificate is issued. A locally-resolving A record is
 * necessary but not sufficient.
 */
router.post(
  "/:id/website/domain/verify",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const config = await ensureWebsiteConfig(event);
      const host = config.domain?.host;
      if (!host) return bad(res, 400, "No domain to verify");

      const org = await Organization.findById(event.orgId);
      const entry = (org?.customAppDomains || []).find(
        (d: any) => d.domain?.toLowerCase() === host
      ) as any;

      const status = await getDomainFromVercel(host);

      if (entry) {
        // Keep the challenge records current: Vercel can issue the TXT late,
        // and the founder can't add a record they were never shown.
        const byKey = new Map(
          (entry.dnsRecords || []).map((r: any) => [`${r.type}:${r.name}`, r])
        );
        for (const v of verificationToDnsRecords(status.verification)) {
          const hit = byKey.get(`${v.type}:${v.name}`) as any;
          if (hit) {
            hit.value = v.value;
            hit.verified = status.verified;
          } else {
            entry.dnsRecords.push(v);
          }
        }
        entry.verified = status.verified;
        if (status.verified && !entry.verifiedAt) entry.verifiedAt = new Date();
        entry.sslProvisioned = status.verified;
        if (status.verified && !entry.sslProvisionedAt)
          entry.sslProvisionedAt = new Date();
        await org!.save();
      }

      config.domain!.status = status.verified ? "verified" : "failed";
      config.domain!.lastCheckedAt = new Date();
      config.domain!.lastError = status.verified
        ? undefined
        : "Not verified yet. Check the DNS records below — changes can take up to an hour to propagate.";
      if (status.verified && !config.domain!.verifiedAt)
        config.domain!.verifiedAt = new Date();
      await config.save();

      res.json({
        success: true,
        domain: config.domain,
        check: { ok: status.verified },
        records: entry?.dnsRecords || [],
      });
    } catch (err) {
      console.error("[event-management] domain verify failed:", err);
      bad(res, 500, "Failed to check the domain");
    }
  }
);

/** DELETE /event-management/:id/website/domain — detach it. */
router.delete(
  "/:id/website/domain",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const config = await ensureWebsiteConfig(event);
      const host = config.domain?.host;

      if (host) {
        // Release it on Vercel too, or the org can never re-add it and no
        // other org can claim it either.
        await removeDomainFromVercel(host).catch(() => {});
        const org = await Organization.findById(event.orgId);
        if (org) {
          (org as any).customAppDomains = (org.customAppDomains || []).filter(
            (d: any) => d.domain?.toLowerCase() !== host
          );
          await org.save();
        }
      }

      config.domain = undefined;
      await config.save();
      res.json({ success: true });
    } catch (err) {
      console.error("[event-management] domain remove failed:", err);
      bad(res, 500, "Failed to remove the domain");
    }
  }
);

/** POST /event-management/:id/website/reset — restore the default canvas. */
router.post(
  "/:id/website/reset",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const event = await loadEvent(req, res);
      if (!event) return;
      const config = await ensureWebsiteConfig(event);
      config.blocks = defaultWebsiteBlocks(event) as any;
      await config.save();
      res.json({ success: true, config });
    } catch (err) {
      console.error("[event-management] website reset failed:", err);
      bad(res, 500, "Failed to reset website");
    }
  }
);

// ── Notification email ───────────────────────────────────────────────────

/**
 * Approve / reject confirmation. Uses the shared mailer; any failure is logged
 * by the caller and never surfaces to the organizer, since the decision itself
 * has already been persisted.
 */
async function sendRegistrationDecisionEmail(
  event: any,
  registration: any,
  status: "approved" | "rejected"
): Promise<void> {
  const { sendMail, EMAIL_FROM_OTP } = await import("../services/mailer");
  const appUrl = process.env.APP_URL || "https://my.garage.app";
  const link = `${appUrl}/e/${event.slug}`;

  const subject =
    status === "approved"
      ? `You're in — ${event.name}`
      : `Update on your registration for ${event.name}`;

  const body =
    status === "approved"
      ? `<p>Hi ${registration.attendee?.name || "there"},</p>
         <p>Your registration for <strong>${event.name}</strong> has been approved.</p>
         <p>Your ticket reference is <strong>${registration.qrCodeToken}</strong>. Show the QR code on your ticket page at the door.</p>
         <p><a href="${link}">View the event</a></p>`
      : `<p>Hi ${registration.attendee?.name || "there"},</p>
         <p>Unfortunately the organizer was not able to approve your registration for <strong>${event.name}</strong>.</p>
         ${registration.rejectedReason ? `<p>${registration.rejectedReason}</p>` : ""}`;

  await sendMail(
    registration.attendee.email,
    subject,
    body,
    undefined,
    EMAIL_FROM_OTP
  );
}

export default router;
