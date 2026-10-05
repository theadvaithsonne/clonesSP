import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { isFounderOrModuleAdmin } from "../utils/rbac";
import { getSessionHost } from "../services/webinarHost";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Workshop } from "../models/workshop.model";
import {
  founderAlertsZodSchema,
  normalizeFounderAlerts,
} from "../models/founderAlerts.schema";
import {
  emailAlertsZodSchema,
  normalizeEmailAlerts,
} from "../models/emailAlerts.schema";
import { notifyNewWorkshopCreated } from "../services/bulkEmail";
import { Meet } from "../models/meet.model";
import { getSocketInstance } from "../services/socket";
import { generateMeetJoinCode, generateMeetAgoraChannel } from "../utils/meetCode";
import { env } from "../config/env";
import {
  createWorkshop,
  updateWorkshop,
  deleteWorkshop,
  getWorkshopById,
  getOrgWorkshops,
  getUserAccessibleWorkshops,
  registerForFreeWorkshop,
  registerForPaidWorkshop,
  getWorkshopRegistrations,
  cancelRegistration,
  cancelFullEnrollment,
  cancelSessionEnrollment,
  getWorkshopSessions,
  hasSessionAccess,
  registerForRecurringWorkshopFull,
  registerForRecurringWorkshopSession,
  getWorkshopAnalytics,
  getRecurringWorkshopAnalytics,
  syncAttendanceFromMeeting,
  markUserAttended,
} from "../services/workshop";
import { getFounderStreamTable } from "../services/founderStreamTable";
import { parseSessionDate, isValidSessionDate } from "../utils/recurrence";
import { createOrder, verifyPaymentSignature } from "../services/razorpay";
import { distributeCommissions } from "../services/commission";
// Commissions are paid on the PRE-TAX base — see utils/gstTax.
// This file used to carry its own copy of getCommissionBase shadowing the
// shared util; removed so the buyer-location rule can't drift between them.
import { getCommissionBase } from "../utils/gstTax";
import { isBuyerInIndia } from "../utils/gstBuyerRegion";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  createUserSubscription,
  hasSubscriptionAccess,
  getUserActiveSubscription,
} from "../services/subscription";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import {
  enrichSessionsWithStatus,
  sessionDayKey,
  deriveWorkshopStatus,
  deriveClockStatus,
  isSessionDeleted,
  isWorkshopDeleted,
} from "../utils/workshopStatus";
import {
  SESSION_EDITABLE_FIELDS,
  hasSessionEdits,
  resolveEffectiveSession,
  resolveSessionPricing,
} from "../utils/sessionOverlay";

const router = Router();

/**
 * Can this user manage live streams / workshops in this org?
 *
 * Founders, legacy single-org admins and `fullAccess` holders — plus members a
 * founder granted the "live_streams" module via /rbac. A superset of the
 * founder check this previously performed, so nobody loses access.
 */
async function isUserFounder(
  userId: string,
  orgId: string
): Promise<boolean> {
  return isFounderOrModuleAdmin(userId, orgId, "live_streams");
}

// ============= Workshop CRUD Endpoints =============

/**
 * GET /workshops
 * Get workshops - founders see all org workshops, stakeholders see accessible ones
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      channelId: z.string().optional(),
      upcoming: z
        .string()
        .optional()
        .transform((v) => (v === "true" ? true : v === "false" ? false : undefined)),
      // Enrolled tab: narrow to the caller's own registrations server-side.
      // Without it the page limit applies to every accessible workshop and the
      // client filters afterwards, so an enrolment past the limit is invisible.
      enrolledOnly: z
        .string()
        .optional()
        .transform((v) => v === "true"),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 50)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v, 10) : 0)),
    });
    const { orgId, channelId, upcoming, limit, offset, enrolledOnly } =
      schema.parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    // A delegated `live_streams` admin runs the org's streams, so they need
    // the org-wide list — the subscriber branch below would hand them only
    // the streams they personally follow, i.e. an empty Live Streams console.
    // `isFounder` stays untouched: it is a role flag the client reads, not an
    // access decision.
    const canManageStreams =
      isFounder ||
      (await isFounderOrModuleAdmin(me.userId, orgId, "live_streams"));

    let result;
    if (canManageStreams) {
      // Founders and stream admins see all workshops in the org
      result = await getOrgWorkshops(orgId, {
        userId: me.userId,
        channelId,
        upcoming,
        limit,
        offset,
        includeInactive: false,
        enrolledOnly,
      });
    } else {
      // Stakeholders see workshops based on channel subscriptions
      result = await getUserAccessibleWorkshops(me.userId, orgId, {
        upcoming,
        limit,
        offset,
        enrolledOnly,
      });
    }

    res.json({
      success: true,
      workshops: result.workshops,
      total: result.total,
      isFounder,
      canManageStreams,
    });
  } catch (error) {
    console.error("Error getting workshops:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshops",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/trash?orgId=X
 * Founder-only: list of trashed workshops + trashed sessions from
 * non-trashed workshops. Each row carries its natural clock-derived
 * badge so the row still animates while it sits in Trash.
 * Defined BEFORE `/:workshopId` so express doesn't match "trash" as an id.
 */
router.get("/trash", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view Trash",
      });
    }

    const deletedWorkshops = await Workshop.find({
      orgId: new Types.ObjectId(orgId),
      deletedAt: { $ne: null },
      $expr: {
        $or: [
          { $eq: ["$restoredAt", null] },
          { $lt: ["$restoredAt", "$deletedAt"] },
        ],
      },
    })
      .sort({ deletedAt: -1 })
      .lean();

    const sessionOverrides = await WorkshopSessionOverride.find({
      deletedAt: { $ne: null },
      $expr: {
        $or: [
          { $eq: ["$restoredAt", null] },
          { $lt: ["$restoredAt", "$deletedAt"] },
        ],
      },
    })
      .sort({ deletedAt: -1 })
      .lean();

    const parentIds = Array.from(
      new Set(sessionOverrides.map((o: any) => o.workshopId.toString()))
    );
    const parents = await Workshop.find({
      _id: { $in: parentIds.map((id) => new Types.ObjectId(id)) },
      orgId: new Types.ObjectId(orgId),
    }).lean();
    const parentById = new Map(
      parents.map((p: any) => [p._id.toString(), p])
    );

    const now = new Date();
    const deletedSessions: any[] = [];
    for (const o of sessionOverrides as any[]) {
      const parent = parentById.get(o.workshopId.toString());
      if (!parent) continue;
      if (isWorkshopDeleted(parent)) continue;
      // Through the overlay so a trashed session that had been edited still
      // lists under its own title and the window it was moved to.
      const effective = resolveEffectiveSession(parent, o.sessionDate, o);
      const start = effective.startDateTime;
      const end = effective.endDateTime;
      deletedSessions.push({
        workshopId: parent._id,
        workshopTitle: effective.title,
        workshopThumbnail: effective.thumbnail,
        sessionDate: o.sessionDate,
        startDateTime: start,
        endDateTime: end,
        deletedAt: o.deletedAt,
        clockStatus: deriveClockStatus(
          { startDateTime: start, endDateTime: end },
          o,
          now
        ),
      });
    }

    res.json({
      success: true,
      deletedWorkshops,
      deletedSessions,
    });
  } catch (error) {
    console.error("Error listing workshop trash:", error);
    res.status(500).json({
      success: false,
      error: "Failed to list Trash",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/founder-table?orgId=X
 *
 * The founder console's Live Streams grid. Fifteen columns of per-stream
 * reporting plus the footer totals, in one read — see
 * services/founderStreamTable for where each number comes from.
 *
 * Two views:
 *   view=one-time   → one row per non-recurring stream (default).
 *   view=recurring  → one row per SESSION of `seriesId` (defaults to the most
 *                     recent series). The response also carries `series`, the
 *                     list the "Recurring Live Streams" picker renders.
 *
 * Declared BEFORE `/:workshopId` so express doesn't match "founder-table" as
 * an id.
 */
router.get("/founder-table", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      orgId: z.string(),
      view: z.enum(["one-time", "recurring"]).optional(),
      seriesId: z.string().optional(),
      search: z.string().optional(),
      status: z
        .enum(["all", "active", "completed", "deleted", "not_started", "draft"])
        .optional(),
      payment: z.enum(["all", "free", "paid"]).optional(),
      page: z
        .string()
        .optional()
        .transform((v) => (v ? Math.max(1, parseInt(v, 10)) : 1)),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? Math.min(100, Math.max(1, parseInt(v, 10))) : 20)),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
      // Per-column header filters, sent as filter[name]=…&filter[host]=….
      // Handled server-side because the table paginates: matching only the
      // rows already delivered would search one page out of many.
      filter: z.record(z.string(), z.string()).optional(),
    });
    const q = schema.parse(req.query);

    // Same gate as GET /workshops: founders plus anyone a founder granted the
    // `live_streams` module. A stakeholder has no business reading org-wide
    // revenue and affiliate payouts.
    if (!(await isUserFounder(me.userId, q.orgId))) {
      return res.status(403).json({
        success: false,
        error: "Only founders and live stream admins can view this table",
      });
    }

    const result = await getFounderStreamTable(q.orgId, {
      view: q.view,
      seriesId: q.seriesId,
      search: q.search,
      columnFilters: q.filter,
      status: q.status,
      payment: q.payment,
      page: q.page,
      limit: q.limit,
      sortBy: q.sortBy,
      sortOrder: q.sortOrder,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error("Error getting founder stream table:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load the live streams table",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/:workshopId
 * Get a single workshop
 */
router.get("/:workshopId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const workshop = await getWorkshopById(workshopId, me.userId);

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    res.json({
      success: true,
      workshop,
    });
  } catch (error) {
    console.error("Error getting workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops
 * Create a new workshop (founder only)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can create workshops",
      });
    }

    const recurrencePatternSchema = z.object({
      type: z.enum(["daily", "weekly", "monthly"]),
      excludedDays: z.array(z.number().min(0).max(6)).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      // Multi-day selection. Optional and additive — a client that sends only
      // the singular fields above gets exactly the previous behaviour.
      daysOfWeek: z.array(z.number().min(0).max(6)).max(7).optional(),
      daysOfMonth: z.array(z.number().min(1).max(31)).max(31).optional(),
    });

    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().optional(),
      thumbnail: z.string().optional(),
      galleryImages: z.array(z.string()).optional(),
      videoUrl: z.string().optional(),
      videoFile: z.string().optional(),
      date: z.string().transform((v) => new Date(v)),
      startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: z.string().default("Asia/Kolkata"),
      maxParticipants: z.number().min(1).optional(),
      channelIds: z.array(z.string()).optional(),
      speakerIds: z.array(z.string()).optional(),
      isFree: z.boolean().default(true),
      price: z.number().min(0).default(0),
      currency: z.string().default("USD"),
      // Post-registration email, same section products / courses /
      // communities use — see models/emailAlerts.schema.ts.
      emailAlerts: emailAlertsZodSchema.optional(),
      // "Notify me when someone registers" — the host's own alert, separate
      // from the attendee's email above.
      founderAlerts: founderAlertsZodSchema.optional(),
      // GST + iOS fee flags mirror channels. Only gstInclusive is
      // actively used today (INR-only, 18%). The other two are stubbed
      // so future iOS work reads the same shape as channels.
      gstInclusive: z.boolean().optional(),
      requireIosPayment: z.boolean().optional(),
      appleFeeInclusive: z.boolean().optional(),
      // isActive: false = save as draft, true = publish (default)
      isActive: z.boolean().default(true),
      // Recurrence fields
      isRecurring: z.boolean().default(false),
      recurrencePattern: recurrencePatternSchema.optional(),
      recurrenceStartDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      // Bound for per_session workshops. Required when the workshop is
      // isRecurring + per_session (validated below); accepted-but-ignored
      // for other modes so legacy callers don't break.
      recurrenceEndDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      enrollmentType: z.enum(["once", "per_session"]).default("once"),
      recordingMode: z.enum(["manual", "automatic"]).default("manual"),
      // Workshop detail page fields
      rating: z.number().min(0).max(5).optional(),
      ratingCount: z.number().min(0).optional(),
      aboutText: z.string().optional(),
      learningPoints: z.array(z.string()).optional(),
      agenda: z.array(z.object({
        title: z.string(),
        duration: z.string(),
        topics: z.array(z.string()).optional(),
      })).optional(),
      bonuses: z.array(z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      })).optional(),
      reviews: z.array(z.object({
        reviewerName: z.string(),
        reviewerRole: z.string().optional(),
        reviewerAvatar: z.string().optional(),
        rating: z.number().min(1).max(5),
        text: z.string(),
      })).optional(),
      faqs: z.array(z.object({
        question: z.string(),
        answer: z.string(),
      })).optional(),
      requirements: z.array(z.string()).optional(),
      whatsIncluded: z.array(z.string()).optional(),
      hostRating: z.number().min(0).max(5).optional(),
      hostStudents: z.string().optional(),
      hostWebinars: z.string().optional(),
      hostExperience: z.string().optional(),
    });

    const { emailAlerts, founderAlerts, ...rest } = schema.parse(req.body);
    const data = {
      ...rest,
      ...(emailAlerts
        ? { emailAlerts: normalizeEmailAlerts(emailAlerts) }
        : {}),
      ...(founderAlerts
        ? { founderAlerts: normalizeFounderAlerts(founderAlerts) }
        : {}),
    };

    // If price > 0, it's not free
    if (data.price > 0) {
      data.isFree = false;
    }

    // Validate recurrence pattern for recurring workshops
    if (data.isRecurring && !data.recurrencePattern) {
      return res.status(400).json({
        success: false,
        error: "Recurrence pattern is required for recurring workshops",
      });
    }

    // Every recurring workshop must be bounded. Per-session needs it so
    // enrol pickers have a stopping point; enrol-once needs it so the
    // founder + customers know when the series ends and access can lapse
    // cleanly. Non-recurring workshops ignore this field.
    if (data.isRecurring && !data.recurrenceEndDate) {
      return res.status(400).json({
        success: false,
        error: "End date is required for recurring workshops",
      });
    }
    if (data.recurrenceEndDate) {
      const start = data.recurrenceStartDate || data.date;
      if (data.recurrenceEndDate <= start) {
        return res.status(400).json({
          success: false,
          error: "End date must be after the start date",
        });
      }
    }

    const workshop = await createWorkshop(orgId, me.userId, data);

    // Populate for response
    const populatedWorkshop = await getWorkshopById(workshop._id.toString(), me.userId);

    // Notify all users about the new workshop
    // if (workshop.isActive) {
    //   const org = await Organization.findById(orgId).select("name").lean();
    //   notifyNewWorkshopCreated(
    //     {
    //       _id: workshop._id.toString(),
    //       name: workshop.title,
    //       price: workshop.price,
    //       currency: workshop.currency,
    //       description: workshop.description,
    //       thumbnail: workshop.thumbnail,
    //       date: workshop.date?.toISOString(),
    //     },
    //     (org as any)?.name || "an organization"
    //   );
    // }

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:created", {
        workshop: populatedWorkshop,
      });
    }

    res.status(201).json({
      success: true,
      message: "Workshop created successfully",
      workshop: populatedWorkshop,
    });
  } catch (error) {
    console.error("Error creating workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * PUT /workshops/:workshopId
 * Update a workshop (founder only)
 */
router.put("/:workshopId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can update workshops",
      });
    }

    const recurrencePatternSchema = z.object({
      type: z.enum(["daily", "weekly", "monthly"]),
      excludedDays: z.array(z.number().min(0).max(6)).optional(),
      dayOfWeek: z.number().min(0).max(6).optional(),
      dayOfMonth: z.number().min(1).max(31).optional(),
      // Multi-day selection. Optional and additive — a client that sends only
      // the singular fields above gets exactly the previous behaviour.
      daysOfWeek: z.array(z.number().min(0).max(6)).max(7).optional(),
      daysOfMonth: z.array(z.number().min(1).max(31)).max(31).optional(),
    });

    const schema = z.object({
      title: z.string().min(1).max(200).optional(),
      description: z.string().optional(),
      thumbnail: z.string().optional(),
      galleryImages: z.array(z.string()).optional(),
      videoUrl: z.string().optional(),
      videoFile: z.string().optional(),
      date: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      startTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      endTime: z
        .string()
        .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
        .optional(),
      timezone: z.string().optional(),
      meetingUrl: z.string().optional(),
      meetingId: z.string().optional(),
      meetingPassword: z.string().optional(),
      maxParticipants: z.number().min(1).optional(),
      channelIds: z.array(z.string()).optional(),
      speakerIds: z.array(z.string()).optional(),
      isFree: z.boolean().optional(),
      price: z.number().min(0).optional(),
      currency: z.string().optional(),
      emailAlerts: emailAlertsZodSchema.optional(),
      founderAlerts: founderAlertsZodSchema.optional(),
      gstInclusive: z.boolean().optional(),
      requireIosPayment: z.boolean().optional(),
      appleFeeInclusive: z.boolean().optional(),
      isActive: z.boolean().optional(),
      // Recurrence fields
      isRecurring: z.boolean().optional(),
      recurrencePattern: recurrencePatternSchema.optional(),
      recurrenceStartDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      // Bound for per_session workshops on the update path. Not required
      // on every PUT — only when the founder is switching the mode or
      // adjusting the end date. Full model-level enforcement happens on
      // create; PUT just validates shape + ordering.
      recurrenceEndDate: z
        .string()
        .optional()
        .transform((v) => (v ? new Date(v) : undefined)),
      isRecurrenceActive: z.boolean().optional(),
      enrollmentType: z.enum(["once", "per_session"]).optional(),
      recordingMode: z.enum(["manual", "automatic"]).optional(),
      // Workshop detail page fields
      rating: z.number().min(0).max(5).optional().nullable(),
      ratingCount: z.number().min(0).optional().nullable(),
      aboutText: z.string().optional().nullable(),
      learningPoints: z.array(z.string()).optional().nullable(),
      agenda: z.array(z.object({
        title: z.string(),
        duration: z.string(),
        topics: z.array(z.string()).optional(),
      })).optional().nullable(),
      bonuses: z.array(z.object({
        icon: z.string(),
        title: z.string(),
        description: z.string(),
      })).optional().nullable(),
      reviews: z.array(z.object({
        reviewerName: z.string(),
        reviewerRole: z.string().optional(),
        reviewerAvatar: z.string().optional(),
        rating: z.number().min(1).max(5),
        text: z.string(),
      })).optional().nullable(),
      faqs: z.array(z.object({
        question: z.string(),
        answer: z.string(),
      })).optional().nullable(),
      requirements: z.array(z.string()).optional().nullable(),
      whatsIncluded: z.array(z.string()).optional().nullable(),
      hostRating: z.number().min(0).max(5).optional().nullable(),
      hostStudents: z.string().optional().nullable(),
      hostWebinars: z.string().optional().nullable(),
      hostExperience: z.string().optional().nullable(),
    });

    const data = schema.parse(req.body);

    // If price > 0, it's not free
    if (data.price !== undefined && data.price > 0) {
      data.isFree = false;
    } else if (data.price === 0) {
      data.isFree = true;
    }

    // Omitting the section entirely leaves the stored config alone; sending it
    // (enabled or not) re-snapshots it, same contract the product / course /
    // community forms use.
    const { emailAlerts, founderAlerts, ...restData } = data;
    const workshopData = {
      ...restData,
      ...(emailAlerts ? { emailAlerts: normalizeEmailAlerts(emailAlerts) } : {}),
      ...(founderAlerts
        ? { founderAlerts: normalizeFounderAlerts(founderAlerts) }
        : {}),
    };

    // Ordering check when both start + end are supplied on the same PUT.
    // We don't cross-check against the persisted workshop's start here to
    // stay minimal; the FE always sends both when either changes.
    if (
      workshopData.recurrenceEndDate &&
      workshopData.recurrenceStartDate &&
      workshopData.recurrenceEndDate <= workshopData.recurrenceStartDate
    ) {
      return res.status(400).json({
        success: false,
        error: "End date must be after the start date",
      });
    }

    const workshop = await updateWorkshop(workshopId, orgId, workshopData);

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    const populatedWorkshop = await getWorkshopById(workshopId, me.userId);

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:updated", {
        workshop: populatedWorkshop,
      });
    }

    res.json({
      success: true,
      message: "Workshop updated successfully",
      workshop: populatedWorkshop,
    });
  } catch (error) {
    console.error("Error updating workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /workshops/:workshopId
 * Delete a workshop (founder only) - soft delete
 */
router.delete("/:workshopId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can delete workshops",
      });
    }

    const deleted = await deleteWorkshop(workshopId, orgId);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:deleted", {
        workshopId,
      });
    }

    res.json({
      success: true,
      message: "Workshop deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete workshop",
      details: (error as Error).message,
    });
  }
});

// ============= Trash / Soft-Delete Endpoints =============
// (GET /workshops/trash is defined earlier — before /:workshopId — to avoid
// route-collision.)

/**
 * PATCH /workshops/:workshopId/soft-delete?orgId=X
 * Move a workshop to Trash. Restorable via POST /restore.
 */
router.patch("/:workshopId/soft-delete", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can delete workshops",
      });
    }

    const now = new Date();
    const updated = await Workshop.findOneAndUpdate(
      { _id: new Types.ObjectId(workshopId), orgId: new Types.ObjectId(orgId) },
      { $set: { deletedAt: now }, $unset: { restoredAt: 1 } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:soft-deleted", {
        workshopId,
      });
    }

    res.json({ success: true, workshop: updated });
  } catch (error) {
    console.error("Error soft-deleting workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to move workshop to Trash",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/restore?orgId=X
 * Restore a workshop from Trash. Idempotent.
 */
router.post("/:workshopId/restore", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can restore workshops",
      });
    }

    const updated = await Workshop.findOneAndUpdate(
      { _id: new Types.ObjectId(workshopId), orgId: new Types.ObjectId(orgId) },
      { $set: { restoredAt: new Date() } },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:restored", {
        workshopId,
      });
    }

    res.json({ success: true, workshop: updated });
  } catch (error) {
    console.error("Error restoring workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to restore workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/trash?orgId=X
 * Move a specific session to Trash. If session is currently Live, its
 * underlying Meet is also ended so attendees drop out.
 * sessionDate = YYYY-MM-DD (interpreted as UTC).
 */
router.post(
  "/:workshopId/sessions/:sessionDate/trash",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { workshopId, sessionDate } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      const isFounder = await isUserFounder(me.userId, orgId);
      if (!isFounder) {
        return res.status(403).json({
          success: false,
          error: "Only founders can delete sessions",
        });
      }

      const workshop = await Workshop.findOne({
        _id: new Types.ObjectId(workshopId),
        orgId: new Types.ObjectId(orgId),
      });
      if (!workshop) {
        return res
          .status(404)
          .json({ success: false, error: "Workshop not found" });
      }

      const parsedDate = new Date(sessionDate);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid sessionDate" });
      }
      const key = sessionDayKey(parsedDate);
      const now = new Date();

      const override = await WorkshopSessionOverride.findOneAndUpdate(
        {
          workshopId: workshop._id,
          sessionDate: key,
        },
        {
          $set: {
            deletedAt: now,
            "meta.deletedBy": new Types.ObjectId(me.userId),
          },
          $unset: { restoredAt: 1 },
          $setOnInsert: {
            workshopId: workshop._id,
            sessionDate: key,
          },
        },
        { upsert: true, new: true }
      );

      // If this was the current live session, end the Meet so participants
      // drop out. Non-blocking — we don't fail the trash op if this fails.
      try {
        if (
          workshop.currentSessionDate &&
          sessionDayKey(workshop.currentSessionDate).getTime() === key.getTime()
        ) {
          await Meet.updateMany(
            {
              workshopId: workshop._id,
              status: "live",
            },
            { $set: { status: "ended", endedAt: new Date() } }
          );
          await Workshop.updateOne(
            { _id: workshop._id },
            { $unset: { currentSessionDate: 1 } }
          );
        }
      } catch (endErr) {
        console.warn(
          "[workshop-trash] Failed to end live meet on session trash:",
          endErr
        );
      }

      const io = getSocketInstance();
      if (io) {
        io.to(`org:${orgId}:workshops`).emit("workshop:session-trashed", {
          workshopId,
          sessionDate: key.toISOString(),
        });
      }

      res.json({ success: true, override });
    } catch (error) {
      console.error("Error trashing session:", error);
      res.status(500).json({
        success: false,
        error: "Failed to move session to Trash",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/restore?orgId=X
 * Restore a specific session from Trash. Idempotent.
 */
router.post(
  "/:workshopId/sessions/:sessionDate/restore",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { workshopId, sessionDate } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      const isFounder = await isUserFounder(me.userId, orgId);
      if (!isFounder) {
        return res.status(403).json({
          success: false,
          error: "Only founders can restore sessions",
        });
      }

      const parsedDate = new Date(sessionDate);
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid sessionDate" });
      }
      const key = sessionDayKey(parsedDate);
      const now = new Date();

      const override = await WorkshopSessionOverride.findOneAndUpdate(
        {
          workshopId: new Types.ObjectId(workshopId),
          sessionDate: key,
        },
        {
          $set: {
            restoredAt: now,
            "meta.restoredBy": new Types.ObjectId(me.userId),
          },
        },
        { new: true }
      );

      if (!override) {
        return res.status(404).json({
          success: false,
          error: "Session override not found",
        });
      }

      const io = getSocketInstance();
      if (io) {
        io.to(`org:${orgId}:workshops`).emit("workshop:session-restored", {
          workshopId,
          sessionDate: key.toISOString(),
        });
      }

      res.json({ success: true, override });
    } catch (error) {
      console.error("Error restoring session:", error);
      res.status(500).json({
        success: false,
        error: "Failed to restore session",
        details: (error as Error).message,
      });
    }
  }
);

/* ============= Per-Session Editing =============
 *
 * A recurring workshop's sessions are computed from its recurrence rule, so
 * there is no row to PUT. Editing one writes a WorkshopSessionOverride keyed
 * by (workshopId, sessionDate) — upserted on demand, which is why this works
 * on series created long before the feature shipped without any migration.
 *
 * `sessionDate` in the path is ALWAYS the canonical UTC-midnight slot key,
 * even for a session that has been moved to another day. It is what
 * registrations, orders, access checks and the webinar room all key off, so
 * an edit never rewrites it.
 */

/** Shared loader: the workshop + a validated canonical slot key. */
async function loadEditableSession(
  workshopId: string,
  orgId: string,
  sessionDate: string
): Promise<
  | { ok: true; workshop: any; key: Date }
  | { ok: false; status: number; error: string }
> {
  if (!Types.ObjectId.isValid(workshopId)) {
    return { ok: false, status: 400, error: "Invalid workshop ID" };
  }

  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
  }).lean();
  if (!workshop) {
    return { ok: false, status: 404, error: "Workshop not found" };
  }

  const parsed = new Date(sessionDate);
  if (isNaN(parsed.getTime())) {
    return { ok: false, status: 400, error: "Invalid sessionDate" };
  }
  const key = sessionDayKey(parsed);

  // The slot has to be one the recurrence rule actually produces. Without
  // this an edit could mint an override for a day that never renders, which
  // then sits in the collection influencing nothing and confusing everything.
  if (workshop.isRecurring) {
    const pattern = (workshop as any).recurrencePattern;
    const startAt = (workshop as any).recurrenceStartDate || workshop.date;
    const endAt = (workshop as any).recurrenceEndDate;
    if (
      !pattern ||
      !startAt ||
      !isValidSessionDate(key, pattern, new Date(startAt), endAt)
    ) {
      return {
        ok: false,
        status: 400,
        error: "That date is not a session of this live stream",
      };
    }
  } else if (sessionDayKey(new Date(workshop.date)).getTime() !== key.getTime()) {
    return {
      ok: false,
      status: 400,
      error: "That date is not a session of this live stream",
    };
  }

  return { ok: true, workshop, key };
}

/**
 * GET /workshops/:workshopId/sessions/:sessionDate/detail?orgId=X
 * The session as it currently reads, with the series values it inherits —
 * so an edit form can show placeholders for what it would fall back to.
 */
router.get(
  "/:workshopId/sessions/:sessionDate/detail",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { workshopId, sessionDate } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      if (!(await isUserFounder(me.userId, orgId))) {
        return res.status(403).json({
          success: false,
          error: "Only founders can view session details",
        });
      }

      const loaded = await loadEditableSession(workshopId, orgId, sessionDate);
      if (!loaded.ok) {
        return res
          .status(loaded.status)
          .json({ success: false, error: loaded.error });
      }
      const { workshop, key } = loaded;

      const override = await WorkshopSessionOverride.findOne({
        workshopId: workshop._id,
        sessionDate: key,
      }).lean();

      const effective = resolveEffectiveSession(workshop, key, override as any);

      res.json({
        success: true,
        sessionDate: key.toISOString(),
        session: {
          ...effective,
          isDeleted: isSessionDeleted(override as any),
          enrollmentType: workshop.enrollmentType || "once",
        },
        // What each field falls back to when its override is cleared. The FE
        // renders these as placeholders so "empty" reads as "inherited".
        seriesDefaults: {
          title: workshop.title,
          description: workshop.description,
          thumbnail: workshop.thumbnail,
          startTime: workshop.startTime,
          endTime: workshop.endTime,
          timezone: workshop.timezone,
          isFree: !!workshop.isFree || (workshop.price || 0) <= 0,
          price: workshop.price || 0,
          currency: (workshop.currency || "USD").toUpperCase(),
          agenda: workshop.agenda || [],
        },
        override: override || null,
      });
    } catch (error) {
      console.error("Error loading session detail:", error);
      res.status(500).json({
        success: false,
        error: "Failed to load session",
        details: (error as Error).message,
      });
    }
  }
);

/**
 * PUT | PATCH /workshops/:workshopId/sessions/:sessionDate?orgId=X
 * Edit one session of a recurring live stream.
 *
 * Partial by field either way: omit a key to leave it alone, send `null` to
 * clear that one override and fall back to the series. The override document
 * is created on first edit, so no migration is needed for existing streams.
 *
 * Both verbs run the same handler. PUT is the documented shape for clients;
 * PATCH is kept because the semantics really are a partial update, and having
 * one of them 404 would be a trap.
 */
const updateWorkshopSessionHandler = async (
  req: any,
  res: any
): Promise<any> => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, sessionDate } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!(await isUserFounder(me.userId, orgId))) {
      return res.status(403).json({
        success: false,
        error: "Only founders can edit sessions",
      });
    }

    const HHMM = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const schema = z.object({
      title: z.string().trim().min(1).max(200).nullable().optional(),
      description: z.string().max(20000).nullable().optional(),
      thumbnail: z.string().trim().max(2048).nullable().optional(),
      rescheduledDate: z.string().nullable().optional(),
      startTime: z.string().regex(HHMM).nullable().optional(),
      endTime: z.string().regex(HHMM).nullable().optional(),
      timezone: z.string().trim().min(1).max(64).nullable().optional(),
      isFree: z.boolean().nullable().optional(),
      price: z.number().min(0).max(1_000_000).nullable().optional(),
      speakerName: z.string().trim().max(200).nullable().optional(),
      speakerBio: z.string().max(5000).nullable().optional(),
      speakerAvatar: z.string().trim().max(2048).nullable().optional(),
      agenda: z
        .array(
          z.object({
            title: z.string().trim().min(1).max(200),
            duration: z.string().trim().max(50).default(""),
            topics: z.array(z.string().trim().max(200)).default([]),
          })
        )
        .max(100)
        .nullable()
        .optional(),
    });
    const body = schema.parse(req.body);

    const touchedFields = SESSION_EDITABLE_FIELDS.filter((f) => f in body);
    if (touchedFields.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nothing to update",
      });
    }

    const loaded = await loadEditableSession(workshopId, orgId, sessionDate);
    if (!loaded.ok) {
      return res
        .status(loaded.status)
        .json({ success: false, error: loaded.error });
    }
    const { workshop, key } = loaded;

    // Per-session pricing only means something when each session is bought
    // separately. In `once` mode the buyer purchases the whole series, so
    // checkout reads the series price — storing a session price there would
    // show a number in the founder's table that nobody is ever charged.
    if (
      (body.price !== undefined || body.isFree !== undefined) &&
      workshop.enrollmentType !== "per_session"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "This series is bought once, so its price is set on the series, not per session",
      });
    }

    const existing = await WorkshopSessionOverride.findOne({
      workshopId: workshop._id,
      sessionDate: key,
    }).lean();

    // Validate the RESULTING session, not just the patch: a request that
    // only moves startTime still has to end up with a sane window against
    // whatever endTime is already stored (or inherited).
    const merged: Record<string, any> = { ...(existing || {}) };
    for (const field of SESSION_EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const value = (body as any)[field];
      if (value === null) delete merged[field];
      else merged[field] = value;
    }

    const nextStart = merged.startTime || workshop.startTime;
    const nextEnd = merged.endTime || workshop.endTime;
    if (nextStart === nextEnd) {
      return res.status(400).json({
        success: false,
        error: "Start and end time can't be the same",
      });
    }

    let rescheduledKey: Date | null = null;
    if (body.rescheduledDate) {
      const moved = new Date(body.rescheduledDate);
      if (isNaN(moved.getTime())) {
        return res
          .status(400)
          .json({ success: false, error: "Invalid rescheduledDate" });
      }
      rescheduledKey = sessionDayKey(moved);

      // Two sessions of one series landing on the same day would make the
      // live-room resolver ambiguous (it picks the occurrence whose window
      // contains "now"), so a move onto another session's day is refused.
      if (rescheduledKey.getTime() !== key.getTime()) {
        const targetIso = rescheduledKey.toISOString();
        const clashesWithSlot =
          workshop.isRecurring &&
          (workshop as any).recurrencePattern &&
          isValidSessionDate(
            rescheduledKey,
            (workshop as any).recurrencePattern,
            new Date(
              (workshop as any).recurrenceStartDate || workshop.date
            ),
            (workshop as any).recurrenceEndDate
          );
        const clashingMove = await WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: { $ne: key },
          rescheduledDate: rescheduledKey,
        })
          .select("_id")
          .lean();
        if (clashesWithSlot || clashingMove) {
          return res.status(409).json({
            success: false,
            error:
              "Another session of this series already runs on " +
              targetIso.slice(0, 10),
          });
        }
      }
    }

    const $set: Record<string, any> = {
      "meta.updatedBy": new Types.ObjectId(me.userId),
    };
    const $unset: Record<string, 1> = {};
    for (const field of SESSION_EDITABLE_FIELDS) {
      if (!(field in body)) continue;
      const value = (body as any)[field];
      if (value === null) {
        $unset[field] = 1;
        continue;
      }
      if (field === "rescheduledDate") {
        $set[field] = rescheduledKey;
        continue;
      }
      $set[field] = value;
    }

    // `isEdited` is a cache of "does this session differ from the series",
    // recomputed from the merged result so a patch that clears the last
    // override clears the flag too.
    const stillEdited = hasSessionEdits({
      ...merged,
      ...(rescheduledKey ? { rescheduledDate: rescheduledKey } : {}),
    } as any);
    if (stillEdited) $set.isEdited = true;
    else $unset.isEdited = 1;

    const override = await WorkshopSessionOverride.findOneAndUpdate(
      { workshopId: workshop._id, sessionDate: key },
      {
        $set,
        ...(Object.keys($unset).length ? { $unset } : {}),
        $setOnInsert: { workshopId: workshop._id, sessionDate: key },
      },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    const effective = resolveEffectiveSession(workshop, key, override as any);

    const io = getSocketInstance();
    if (io) {
      io.to(`org:${orgId}:workshops`).emit("workshop:session-updated", {
        workshopId,
        sessionDate: key.toISOString(),
      });
    }

    res.json({
      success: true,
      message: "Session updated",
      sessionDate: key.toISOString(),
      session: effective,
      override,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: error.issues[0]?.message || "Invalid session update",
      });
    }
    console.error("Error updating session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update session",
      details: (error as Error).message,
    });
  }
};

router.put(
  "/:workshopId/sessions/:sessionDate",
  requireAuth,
  updateWorkshopSessionHandler
);
router.patch(
  "/:workshopId/sessions/:sessionDate",
  requireAuth,
  updateWorkshopSessionHandler
);

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/revert?orgId=X
 * Drop every per-session edit and fall back to the series template.
 *
 * Clears ONLY the customisation fields. The lifecycle stamps (trashed,
 * started, ended, host seat, Garage TV viewers) are history, not edits, and
 * survive — reverting a session's title must not un-delete it or wipe its
 * viewer count.
 */
router.post(
  "/:workshopId/sessions/:sessionDate/revert",
  requireAuth,
  async (req, res) => {
    try {
      const me = (req as any).user as { userId: string };
      const { workshopId, sessionDate } = req.params;
      const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

      if (!(await isUserFounder(me.userId, orgId))) {
        return res.status(403).json({
          success: false,
          error: "Only founders can revert sessions",
        });
      }

      const loaded = await loadEditableSession(workshopId, orgId, sessionDate);
      if (!loaded.ok) {
        return res
          .status(loaded.status)
          .json({ success: false, error: loaded.error });
      }
      const { workshop, key } = loaded;

      const $unset: Record<string, 1> = { isEdited: 1 };
      for (const field of SESSION_EDITABLE_FIELDS) $unset[field] = 1;

      // No upsert: a session with no override is already at series defaults,
      // and minting an empty document to say so would be noise.
      const override = await WorkshopSessionOverride.findOneAndUpdate(
        { workshopId: workshop._id, sessionDate: key },
        {
          $unset,
          $set: { "meta.updatedBy": new Types.ObjectId(me.userId) },
        },
        { new: true }
      ).lean();

      const effective = resolveEffectiveSession(workshop, key, override as any);

      const io = getSocketInstance();
      if (io) {
        io.to(`org:${orgId}:workshops`).emit("workshop:session-updated", {
          workshopId,
          sessionDate: key.toISOString(),
        });
      }

      res.json({
        success: true,
        message: "Session reverted to series defaults",
        sessionDate: key.toISOString(),
        session: effective,
        override,
      });
    } catch (error) {
      console.error("Error reverting session:", error);
      res.status(500).json({
        success: false,
        error: "Failed to revert session",
        details: (error as Error).message,
      });
    }
  }
);

// ============= Registration Endpoints =============

/**
 * POST /workshops/:workshopId/register
 * Register for a free workshop
 */
router.post("/:workshopId/register", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const result = await registerForFreeWorkshop(me.userId, workshopId, orgId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Emit real-time event for registration count update
    const io = getSocketInstance();
    if (io && !result.alreadyRegistered) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error registering for workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register for workshop",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/create-order
 * Create Razorpay order for workshop registration
 */
router.post("/:workshopId/create-order", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Bulk-buy-to-assign flow — founder pays for N seats up-front and
    // assigns each later via ReservesPanel. Fulfillment at
    // services/invoice.ts:2282-2306 keys off `quantity > 1` to mint
    // ItemReserveLicense rows instead of registering the buyer.
    const { quantity: rawQty, forReserve } = z
      .object({
        quantity: z.number().int().min(1).max(100).optional(),
        forReserve: z.boolean().optional(),
      })
      .parse(req.body || {});
    const quantity = Math.max(1, rawQty ?? 1);

    // Get workshop details. Excludes soft-deleted (Trash) workshops so a
    // buyer can't create an order for one they got via a stale link.
    // Matches the isWorkshopDeleted() predicate at utils/workshopStatus.ts:39.
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    if (workshop.isFree || workshop.price === 0) {
      return res.status(400).json({
        success: false,
        error: "This is a free workshop. Use /register endpoint instead.",
      });
    }

    // Check max participants — accounts for the qty being reserved too.
    if (workshop.maxParticipants) {
      const { WorkshopRegistration } = await import("../models/workshopRegistration.model");
      const currentCount = await WorkshopRegistration.countDocuments({
        workshopId: new Types.ObjectId(workshopId),
        status: { $ne: "cancelled" },
      });

      if (currentCount + quantity > workshop.maxParticipants) {
        return res.status(400).json({
          success: false,
          error: "Workshop is full",
        });
      }
    }

    // Use discounted price if available
    const amount = workshop.price;

    // ── GST math (INR workshops only) ──────────────────────────────────
    // Same shape as channelCheckout / workshopCheckout. Razorpay charge
    // = subtotal + tax. Invoice line-item unitPrice = base (inclusive)
    // or listed (exclusive/USD).
    const unitPriceCents = Math.round(amount * 100);
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );
    // Gated on the BUYER's location, not the workshop's currency. In-app
    // purchase, so the logged-in user's profile country is the signal,
    // falling back to the workshop currency when they have none.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUserId: me.userId,
      paymentCurrency: workshop.currency || "USD",
    });
    const gstInclusive = !!(workshop as any).gstInclusive;
    // Per-unit — `quantity` is applied at the order and invoice layers below.
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
    });
    const lineItemUnitPrice = gstLine.lineUnitPrice;
    const invoiceTaxCents = gstLine.taxTotal;
    const chargeAmountCents = gstLine.chargeTotal;
    const gstMetadata = gstLine.gstMetadata
      ? {
          ...gstLine.gstMetadata,
          buyerCountry: gstRegion.country,
          buyerRegion: "IN" as const,
          regionSource: gstRegion.source,
        }
      : undefined;
    const gstSkipped = gstLine.gstMetadata
      ? undefined
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    // Receipt must be max 40 chars: ws_ (3) + last 12 of workshopId + _ (1) + timestamp last 10 (10) = 26 chars
    const shortId = workshopId.slice(-12);
    const shortTs = Date.now().toString().slice(-10);
    const order = await createOrder({
      amount: chargeAmountCents * quantity,
      currency: workshop.currency || "USD",
      receipt: `ws_${shortId}_${shortTs}`,
      notes: {
        workshopId,
        workshopTitle: workshop.title,
        userId: me.userId,
        orgId,
        type: "workshop_registration",
        quantity: String(quantity),
      },
    });

    // Create invoice
    let invoiceId: string | undefined;
    try {
      const { createInvoice } = require("../services/invoice");
      const userDoc = await User.findById(me.userId).select("email").lean();
      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: workshop.createdBy,
        userId: me.userId,
        customerEmail: userDoc?.email || "",
        lineItems: [{
          itemType: "workshop",
          itemId: workshopId,
          itemName: workshop.title,
          itemDescription: `Workshop registration: ${workshop.title}`,
          quantity,
          unitPrice: lineItemUnitPrice,
          originalCurrency: workshop.currency || "USD",
        }],
        itemCurrency: workshop.currency || "USD",
        tax: invoiceTaxCents ? invoiceTaxCents * quantity : undefined,
        metadata: {
          type: "workshop_purchase",
          ...(gstMetadata
            ? { gst: { ...gstMetadata, amount: gstMetadata.amount * quantity } }
            : {}),
          ...(gstSkipped ? { gstSkipped } : {}),
          ...(quantity > 1 || forReserve
            ? { forReserve: true, reserveCount: quantity }
            : {}),
        },
      });
      invoiceId = invoice._id.toString();
    } catch (invoiceError) {
      console.error("[Workshop] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      workshop: {
        id: workshopId,
        title: workshop.title,
        price: workshop.price,
      },
      invoiceId,
    });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/verify-payment
 * Verify payment and complete registration
 */
router.post("/:workshopId/verify-payment", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    });
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      schema.parse(req.body);

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
      });
    }

    // Get workshop to determine the payment amount
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Use discounted price if available, otherwise regular price
    const amount = workshop.price;

    // Complete registration and credit founder's wallet
    const result = await registerForPaidWorkshop(me.userId, workshopId, orgId, {
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      amount,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Distribute commissions if amount > 0
    if (amount && amount > 0) {
      try {
        await distributeCommissions({
          orgId,
          sellerId: workshop.createdBy.toString(),
          customerId: me.userId,
          itemType: "workshop",
          itemId: workshopId,
          itemName: workshop.title,
          saleAmount: getCommissionBase(
            amount,
            workshop,
            await isBuyerInIndia(me.userId, workshop.currency || "USD")
          ),
          currency: workshop.currency || "USD",
          paymentId: razorpayPaymentId,
        });
      } catch (commissionError) {
        // Log but don't fail the registration
        console.error("Error distributing commissions:", commissionError);
      }
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
      });
    }

    res.json({
      success: true,
      message: "Payment verified and registration completed",
    });
  } catch (error) {
    console.error("Error verifying payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: (error as Error).message,
    });
  }
});

/**
 * DELETE /workshops/:workshopId/register
 * Cancel workshop registration
 */
router.delete("/:workshopId/register", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    // Optional sessionDate query param — required only for
    // `per_session`-mode workshops. Server rejects with 400 if the
    // mode requires it and the client didn't send it.
    const sessionDateParam =
      typeof req.query.sessionDate === "string"
        ? req.query.sessionDate
        : undefined;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop id",
      });
    }

    // Load the workshop so we can dispatch on enrollmentType. Also
    // read the fields the event emitter needs later so we avoid a
    // second fetch.
    const { Workshop } = await import("../models/workshop.model");
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }
    const mode = (workshop as any).enrollmentType === "per_session"
      ? "per_session"
      : "once";

    let result:
      | Awaited<ReturnType<typeof cancelFullEnrollment>>
      | Awaited<ReturnType<typeof cancelSessionEnrollment>>;

    if (mode === "per_session") {
      if (!sessionDateParam) {
        return res.status(400).json({
          success: false,
          error: "sessionDate query param is required for per-session workshops",
        });
      }
      const sessionDate = new Date(sessionDateParam);
      if (isNaN(sessionDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid sessionDate — must be an ISO date string",
        });
      }
      result = await cancelSessionEnrollment(me.userId, workshopId, sessionDate);
    } else {
      // once-mode: ignore any provided sessionDate — the FE shouldn't
      // send one but if it does, we just don't use it.
      result = await cancelFullEnrollment(me.userId, workshopId);
    }

    if (result.status === "not_registered") {
      return res.status(404).json({
        success: false,
        error:
          mode === "per_session"
            ? "You weren't enrolled for that session"
            : "Registration not found",
      });
    }

    // Emit an Unsub Log event only on a fresh cancel (not on
    // idempotent already_cancelled hits — we don't want the log to
    // grow one row per double-click).
    if (
      result.status === "cancelled_immediately" &&
      (result as any).registration
    ) {
      try {
        const { User } = await import("../models/user.model");
        const userSnapshot = await User.findById(me.userId)
          .select("name email")
          .lean();
        const { emitWorkshopUnsubscribeEvent } = await import(
          "../services/channelMembershipEvent"
        );
        await emitWorkshopUnsubscribeEvent({
          registration: (result as any).registration,
          workshop,
          user: userSnapshot,
          sessionDate: (result as any).sessionDate || null,
        });
      } catch (logErr: any) {
        console.error(
          "[Workshop cancel] Failed to emit Unsub Log event:",
          logErr?.message ?? logErr
        );
      }
    }

    // Best-effort real-time nudge — anyone watching the workshop room
    // sees registration lists refresh.
    const io = getSocketInstance();
    if (io) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
      });
    }

    res.json({
      success: true,
      message: result.message,
      mode,
      status: result.status,
      cancelledAt: result.cancelledAt,
      ...(mode === "per_session"
        ? { sessionDate: (result as any).sessionDate }
        : {}),
    });
  } catch (error) {
    console.error("Error cancelling registration:", error);
    res.status(500).json({
      success: false,
      error: "Failed to cancel registration",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/:workshopId/registrations
 * Get workshop registrations (founder only)
 */
router.get("/:workshopId/registrations", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const schema = z.object({
      orgId: z.string(),
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
    });
    const { orgId, limit = 50, offset = 0 } = schema.parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view registrations",
      });
    }

    const result = await getWorkshopRegistrations(workshopId, orgId, {
      limit,
      offset,
    });

    res.json({
      success: true,
      registrations: result.registrations,
      total: result.total,
    });
  } catch (error) {
    console.error("Error getting registrations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get registrations",
      details: (error as Error).message,
    });
  }
});

// ============= Recurring Workshop Session Endpoints =============

/**
 * GET /workshops/:workshopId/sessions
 * Get upcoming sessions for a recurring workshop
 */
router.get("/:workshopId/sessions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const schema = z.object({
      // Bound at 500 so callers can render the full range of a per_session
      // workshop (bounded by recurrenceEndDate) rather than the arbitrary
      // "next 10" the FE used to cap at. For unbounded legacy workshops,
      // 500 acts as a safety cap (matches calculateSessions max).
      limit: z.coerce.number().min(1).max(500).optional(),
      includePast: z
        .string()
        .optional()
        .transform((v) => v === "true"),
    });
    const { limit = 500, includePast = false } = schema.parse(req.query);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const result = await getWorkshopSessions(workshopId, me.userId, {
      limit,
      includePast,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Recurring workshop not found",
      });
    }

    res.json({
      success: true,
      sessions: result.sessions,
      workshop: result.workshop,
    });
  } catch (error) {
    console.error("Error getting workshop sessions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop sessions",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/register
 * Register for a specific session (free, per-session enrollment)
 */
router.post("/:workshopId/sessions/:sessionDate/register", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, sessionDate } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const parsedDate = parseSessionDate(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid session date format. Use YYYY-MM-DD",
      });
    }

    const result = await registerForRecurringWorkshopSession(
      me.userId,
      workshopId,
      orgId,
      parsedDate
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io && !result.alreadyRegistered) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
        sessionDate,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error registering for session:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register for session",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/create-order
 * Create Razorpay order for a specific session (paid, per-session enrollment)
 */
router.post("/:workshopId/sessions/:sessionDate/create-order", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, sessionDate } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const parsedDate = parseSessionDate(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid session date format. Use YYYY-MM-DD",
      });
    }

    // Get workshop details. Excludes soft-deleted (Trash) workshops so a
    // buyer can't create a per-session order for one they got via a stale
    // link. Matches isWorkshopDeleted() at utils/workshopStatus.ts:39.
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      isRecurring: true,
      enrollmentType: "per_session",
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Recurring workshop with per-session enrollment not found",
      });
    }

    // Session-level price wins over the series price in per_session mode, so
    // the override is read BEFORE any of the money below is computed.
    const sessionOverride = await WorkshopSessionOverride.findOne({
      workshopId: workshop._id,
      sessionDate: sessionDayKey(parsedDate),
    }).lean();

    // A trashed session isn't for sale — a stale checkout link must not be
    // able to charge for one the founder has cancelled.
    if (isSessionDeleted(sessionOverride as any)) {
      return res.status(400).json({
        success: false,
        error: "This session has been cancelled",
      });
    }

    const sessionPricing = resolveSessionPricing(workshop, sessionOverride as any);

    if (sessionPricing.isFree) {
      return res.status(400).json({
        success: false,
        error: "This is a free session. Use /register endpoint instead.",
      });
    }

    // Check if session is in the past
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    if (parsedDate < now) {
      return res.status(400).json({
        success: false,
        error: "Cannot register for past sessions",
      });
    }

    // Reject dates that aren't valid recurrence occurrences OR fall past
    // the workshop's recurrenceEndDate — before we hit Razorpay + create
    // an Invoice. Verify-payment (registerForRecurringWorkshopSession)
    // catches these too, but only after the buyer has been charged.
    const pattern = (workshop as any).recurrencePattern;
    const startAt =
      (workshop as any).recurrenceStartDate || (workshop as any).date;
    const endAt = (workshop as any).recurrenceEndDate;
    if (
      !pattern ||
      !startAt ||
      !isValidSessionDate(parsedDate, pattern, new Date(startAt), endAt)
    ) {
      return res.status(400).json({
        success: false,
        error: "The requested date is not a valid session for this workshop",
      });
    }

    // The session's own price when it has one, else the series price.
    const amount = sessionPricing.price;

    // GST — same shape as the other three workshop invoice sites. See
    // channelCheckout.ts:482 for the inclusive/exclusive rationale.
    const unitPriceCents = Math.round(amount * 100);
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );
    // Gated on the BUYER's location, not the workshop's currency. In-app
    // purchase, so the logged-in user's profile country is the signal,
    // falling back to the workshop currency when they have none.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUserId: me.userId,
      paymentCurrency: workshop.currency || "USD",
    });
    const gstInclusive = !!(workshop as any).gstInclusive;
    // Per-unit — `quantity` is applied at the order and invoice layers below.
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
    });
    const lineItemUnitPrice = gstLine.lineUnitPrice;
    const invoiceTaxCents = gstLine.taxTotal;
    const chargeAmountCents = gstLine.chargeTotal;
    const gstMetadata = gstLine.gstMetadata
      ? {
          ...gstLine.gstMetadata,
          buyerCountry: gstRegion.country,
          buyerRegion: "IN" as const,
          regionSource: gstRegion.source,
        }
      : undefined;
    const gstSkipped = gstLine.gstMetadata
      ? undefined
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    const shortId = workshopId.slice(-8);
    const shortTs = Date.now().toString().slice(-8);
    const order = await createOrder({
      amount: chargeAmountCents,
      currency: workshop.currency || "USD",
      receipt: `wss_${shortId}_${sessionDate}_${shortTs}`,
      notes: {
        workshopId,
        workshopTitle: workshop.title,
        userId: me.userId,
        orgId,
        type: "workshop_session_registration",
        sessionDate,
      },
    });

    // Create invoice
    let invoiceId: string | undefined;
    try {
      const { createInvoice } = require("../services/invoice");
      const userDoc = await User.findById(me.userId).select("email").lean();
      const sessionTitle = (sessionOverride as any)?.title || workshop.title;
      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: workshop.createdBy,
        userId: me.userId,
        customerEmail: userDoc?.email || "",
        lineItems: [{
          itemType: "workshop",
          itemId: workshopId,
          itemName: sessionTitle,
          itemDescription: `Workshop session: ${sessionTitle} (${sessionDate})`,
          quantity: 1,
          unitPrice: lineItemUnitPrice,
          originalCurrency: workshop.currency || "USD",
        }],
        itemCurrency: workshop.currency || "USD",
        tax: invoiceTaxCents || undefined,
        metadata: {
          type: "workshop_purchase",
          sessionDate,
          ...(gstMetadata ? { gst: gstMetadata } : {}),
          ...(gstSkipped ? { gstSkipped } : {}),
        },
      });
      invoiceId = invoice._id.toString();
    } catch (invoiceError) {
      console.error("[Workshop Session] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      workshop: {
        id: workshopId,
        title: (sessionOverride as any)?.title || workshop.title,
        // The session's price, which is what the order was actually raised
        // for. Returning workshop.price here would let a client render one
        // amount while Razorpay collects another.
        price: amount,
      },
      sessionDate,
      invoiceId,
    });
  } catch (error) {
    console.error("Error creating session order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/sessions/:sessionDate/verify-payment
 * Verify payment for a specific session and complete registration
 */
router.post("/:workshopId/sessions/:sessionDate/verify-payment", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, sessionDate } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const parsedDate = parseSessionDate(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid session date format. Use YYYY-MM-DD",
      });
    }

    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    });
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      schema.parse(req.body);

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
      });
    }

    // Get workshop
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Same resolution as create-order, so the amount recorded on the
    // registration and the commission base match what was charged.
    const paidOverride = await WorkshopSessionOverride.findOne({
      workshopId: workshop._id,
      sessionDate: sessionDayKey(parsedDate),
    }).lean();
    const amount = resolveSessionPricing(workshop, paidOverride as any).price;

    // Complete session registration
    const result = await registerForRecurringWorkshopSession(
      me.userId,
      workshopId,
      orgId,
      parsedDate,
      {
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        amount,
      }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Distribute commissions if amount > 0. Stamp sessionDate on the
    // distribution's metadata so the founder analytics can attribute
    // this commission to the specific session (per-session revenue +
    // commission $ columns).
    if (amount && amount > 0) {
      try {
        await distributeCommissions({
          orgId,
          sellerId: workshop.createdBy.toString(),
          customerId: me.userId,
          itemType: "workshop",
          itemId: workshopId,
          itemName: `${(paidOverride as any)?.title || workshop.title} - Session ${sessionDate}`,
          saleAmount: getCommissionBase(
            amount,
            workshop,
            await isBuyerInIndia(me.userId, workshop.currency || "USD")
          ),
          currency: workshop.currency || "USD",
          paymentId: razorpayPaymentId,
          metadata: { sessionDate },
        });
      } catch (commissionError) {
        console.error("Error distributing commissions:", commissionError);
      }
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
        sessionDate,
      });
    }

    res.json({
      success: true,
      message: "Payment verified and session registration completed",
    });
  } catch (error) {
    console.error("Error verifying session payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/register-full
 * Register for all sessions of a recurring workshop (enroll once)
 */
router.post("/:workshopId/register-full", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const result = await registerForRecurringWorkshopFull(me.userId, workshopId, orgId);

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io && !result.alreadyRegistered) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
      });
    }

    res.json(result);
  } catch (error) {
    console.error("Error registering for recurring workshop:", error);
    res.status(500).json({
      success: false,
      error: "Failed to register",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/create-order-full
 * Create Razorpay order for full enrollment (all sessions)
 */
router.post("/:workshopId/create-order-full", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Get workshop details. Excludes soft-deleted (Trash) workshops so a
    // buyer can't create a full-enrollment order for one they got via a
    // stale link. Matches isWorkshopDeleted() at utils/workshopStatus.ts:39.
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
      isActive: true,
      isRecurring: true,
      enrollmentType: "once",
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Recurring workshop with 'enroll once' not found",
      });
    }

    if (workshop.isFree || workshop.price === 0) {
      return res.status(400).json({
        success: false,
        error: "This is a free workshop. Use /register-full endpoint instead.",
      });
    }

    // Use discounted price if available
    const amount = workshop.price;

    // GST — same shape as the other three workshop invoice sites.
    const unitPriceCents = Math.round(amount * 100);
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );
    // Gated on the BUYER's location, not the workshop's currency. In-app
    // purchase, so the logged-in user's profile country is the signal,
    // falling back to the workshop currency when they have none.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUserId: me.userId,
      paymentCurrency: workshop.currency || "USD",
    });
    const gstInclusive = !!(workshop as any).gstInclusive;
    // Per-unit — `quantity` is applied at the order and invoice layers below.
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
    });
    const lineItemUnitPrice = gstLine.lineUnitPrice;
    const invoiceTaxCents = gstLine.taxTotal;
    const chargeAmountCents = gstLine.chargeTotal;
    const gstMetadata = gstLine.gstMetadata
      ? {
          ...gstLine.gstMetadata,
          buyerCountry: gstRegion.country,
          buyerRegion: "IN" as const,
          regionSource: gstRegion.source,
        }
      : undefined;
    const gstSkipped = gstLine.gstMetadata
      ? undefined
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    const shortId = workshopId.slice(-12);
    const shortTs = Date.now().toString().slice(-10);
    const order = await createOrder({
      amount: chargeAmountCents,
      currency: workshop.currency || "USD",
      receipt: `wsf_${shortId}_${shortTs}`,
      notes: {
        workshopId,
        workshopTitle: workshop.title,
        userId: me.userId,
        orgId,
        type: "workshop_full_registration",
      },
    });

    // Create invoice
    let invoiceId: string | undefined;
    try {
      const { createInvoice } = require("../services/invoice");
      const userDoc = await User.findById(me.userId).select("email").lean();
      const invoice = await createInvoice({
        organizationId: orgId,
        sellerId: workshop.createdBy,
        userId: me.userId,
        customerEmail: userDoc?.email || "",
        lineItems: [{
          itemType: "workshop",
          itemId: workshopId,
          itemName: workshop.title,
          itemDescription: `Workshop full enrollment: ${workshop.title}`,
          quantity: 1,
          unitPrice: lineItemUnitPrice,
          originalCurrency: workshop.currency || "USD",
        }],
        itemCurrency: workshop.currency || "USD",
        tax: invoiceTaxCents || undefined,
        metadata: {
          type: "workshop_purchase",
          ...(gstMetadata ? { gst: gstMetadata } : {}),
          ...(gstSkipped ? { gstSkipped } : {}),
        },
      });
      invoiceId = invoice._id.toString();
    } catch (invoiceError) {
      console.error("[Workshop Full] Invoice creation error (non-blocking):", invoiceError);
    }

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
      },
      workshop: {
        id: workshopId,
        title: workshop.title,
        price: workshop.price,
      },
      invoiceId,
    });
  } catch (error) {
    console.error("Error creating full enrollment order:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create order",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/verify-payment-full
 * Verify payment for full enrollment and complete registration
 */
router.post("/:workshopId/verify-payment-full", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
    });
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      schema.parse(req.body);

    // Verify signature
    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: "Payment verification failed",
      });
    }

    // Get workshop
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    const amount = workshop.price;

    // Complete full registration
    const result = await registerForRecurringWorkshopFull(
      me.userId,
      workshopId,
      orgId,
      {
        paymentId: razorpayPaymentId,
        orderId: razorpayOrderId,
        amount,
      }
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Distribute commissions
    if (amount && amount > 0) {
      try {
        await distributeCommissions({
          orgId,
          sellerId: workshop.createdBy.toString(),
          customerId: me.userId,
          itemType: "workshop",
          itemId: workshopId,
          itemName: `${workshop.title} - Full Enrollment`,
          saleAmount: getCommissionBase(
            amount,
            workshop,
            await isBuyerInIndia(me.userId, workshop.currency || "USD")
          ),
          currency: workshop.currency || "USD",
          paymentId: razorpayPaymentId,
        });
      } catch (commissionError) {
        console.error("Error distributing commissions:", commissionError);
      }
    }

    // Emit real-time event
    const io = getSocketInstance();
    if (io) {
      io.to(`workshop:${workshopId}`).emit("workshop:registration-updated", {
        workshopId,
      });
    }

    res.json({
      success: true,
      message: "Payment verified and full enrollment completed",
    });
  } catch (error) {
    console.error("Error verifying full enrollment payment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/:workshopId/sessions/:sessionDate/access
 * Check if user has access to a specific session
 */
router.get("/:workshopId/sessions/:sessionDate/access", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, sessionDate } = req.params;

    const parsedDate = parseSessionDate(sessionDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Invalid session date format. Use YYYY-MM-DD",
      });
    }

    const { hasAccess } = await hasSessionAccess(me.userId, workshopId, parsedDate);

    res.json({
      success: true,
      hasAccess,
      sessionDate,
    });
  } catch (error) {
    console.error("Error checking session access:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check session access",
      details: (error as Error).message,
    });
  }
});

// ============= Subscription Endpoints =============

/**
 * POST /workshops/:workshopId/create-subscription
 * Create Razorpay subscription for recurring workshop access
 */
router.post("/:workshopId/create-subscription", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const schema = z.object({
      orgId: z.string(),
    });
    const { orgId } = schema.parse(req.query);

    // Get workshop details
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    if (workshop.isFree || !workshop.price || workshop.price === 0) {
      return res.status(400).json({
        success: false,
        error: "This is a free workshop. Use /register endpoint instead.",
      });
    }

    if (!workshop.isSubscription) {
      return res.status(400).json({
        success: false,
        error: "This is not a subscription workshop. Use /create-order endpoint instead.",
      });
    }

    // Check if user already has an active subscription
    const existingAccess = await hasSubscriptionAccess(me.userId, "workshop", workshopId);
    if (existingAccess) {
      return res.status(400).json({
        success: false,
        error: "You already have an active subscription to this workshop",
      });
    }

    // Check for existing registration
    const existingRegistration = await WorkshopRegistration.findOne({
      workshopId,
      userId: me.userId,
      enrollmentType: "full",
    });
    if (existingRegistration) {
      return res.status(400).json({
        success: false,
        error: "You are already registered for this workshop",
      });
    }

    // Get or create subscription plan
    let plan = await getSubscriptionPlanForItem("workshop", workshopId);

    if (!plan) {
      // Auto-create plan if it doesn't exist
      const amount = (workshop.price) * 100; // Convert to paise
      plan = await createSubscriptionPlan({
        itemType: "workshop",
        itemId: workshopId,
        orgId,
        sellerId: workshop.createdBy.toString(),
        name: `${workshop.title} - ${workshop.subscriptionPeriod || "monthly"} subscription`,
        description: workshop.description || undefined,
        amount,
        currency: workshop.currency || "USD",
        period: workshop.subscriptionPeriod || "monthly",
      });
    }

    if (!plan || !plan.isActive) {
      return res.status(400).json({
        success: false,
        error: "No active subscription plan available for this workshop",
      });
    }

    // Create subscription for user
    const subscription = await createUserSubscription({
      planId: plan._id.toString(),
      userId: me.userId,
      orgId,
    });

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        razorpaySubscriptionId: subscription.razorpaySubscriptionId,
        shortUrl: subscription.shortUrl,
        status: subscription.status,
      },
      plan: {
        id: plan._id,
        name: plan.name,
        amount: plan.amount,
        currency: plan.currency,
        period: plan.period,
      },
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Error creating workshop subscription:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create subscription",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/:workshopId/subscription-status
 * Check user's subscription status for a workshop
 */
router.get("/:workshopId/subscription-status", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;

    // Check subscription access
    const hasAccess = await hasSubscriptionAccess(me.userId, "workshop", workshopId);
    const activeSubscription = await getUserActiveSubscription(me.userId, "workshop", workshopId);

    // Also check workshop registration (for one-time purchases)
    const registration = await WorkshopRegistration.findOne({
      userId: me.userId,
      workshopId,
      enrollmentType: "full",
    }).lean();

    res.json({
      success: true,
      hasAccess: hasAccess || !!registration,
      subscription: activeSubscription ? {
        id: activeSubscription._id,
        status: activeSubscription.status,
        currentEnd: activeSubscription.currentEnd,
        paidCount: activeSubscription.paidCount,
      } : null,
      registration: registration ? {
        enrollmentType: registration.enrollmentType,
        hasPaid: registration.hasPaid,
        registeredAt: registration.createdAt,
      } : null,
    });
  } catch (error) {
    console.error("Error checking workshop subscription status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check subscription status",
    });
  }
});

// ============= Analytics Endpoints (Founder Only) =============

/**
 * GET /workshops/:workshopId/analytics
 * Get comprehensive analytics for a workshop (founder only)
 * For recurring workshops, optionally pass sessionDate to get session-specific analytics
 */
router.get("/:workshopId/analytics", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const schema = z.object({
      orgId: z.string(),
      sessionDate: z.string().optional(),
    });
    const { orgId, sessionDate } = schema.parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view workshop analytics",
      });
    }

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    let parsedSessionDate: Date | undefined;
    if (sessionDate) {
      parsedSessionDate = parseSessionDate(sessionDate);
      if (isNaN(parsedSessionDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid session date format. Use YYYY-MM-DD",
        });
      }
    }

    const analytics = await getWorkshopAnalytics(workshopId, orgId, parsedSessionDate);

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    res.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error("Error getting workshop analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop analytics",
      details: (error as Error).message,
    });
  }
});

/**
 * GET /workshops/:workshopId/analytics/sessions
 * Get analytics for all sessions of a recurring workshop (founder only)
 */
router.get("/:workshopId/analytics/sessions", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const schema = z.object({
      orgId: z.string(),
      // Cap at 100 — the founder page paginates with rows-per-page of 5,
      // 10, or 20, so 100 is plenty of headroom without letting a caller
      // request thousands.
      limit: z.coerce.number().min(1).max(100).optional(),
      offset: z.coerce.number().min(0).optional(),
      includePast: z
        .string()
        .optional()
        .transform((v) => v === "true"),
    });
    const {
      orgId,
      limit = 5,
      offset = 0,
      includePast = true,
    } = schema.parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can view workshop analytics",
      });
    }

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const analytics = await getRecurringWorkshopAnalytics(workshopId, orgId, {
      limit,
      offset,
      includePast,
    });

    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: "Recurring workshop not found",
      });
    }

    res.json({
      success: true,
      ...analytics,
    });
  } catch (error) {
    console.error("Error getting recurring workshop analytics:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get workshop analytics",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/sync-attendance
 * Sync attendance from meeting participants to workshop registrations (founder only)
 */
router.post("/:workshopId/sync-attendance", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can sync attendance",
      });
    }

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop ID",
      });
    }

    const result = await syncAttendanceFromMeeting(workshopId);

    res.json({
      success: true,
      message: `Synced ${result.synced} attendance records`,
      synced: result.synced,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Error syncing attendance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to sync attendance",
      details: (error as Error).message,
    });
  }
});

/**
 * POST /workshops/:workshopId/mark-attended/:userId
 * Manually mark a user as attended (founder only)
 */
router.post("/:workshopId/mark-attended/:userId", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId, userId } = req.params;
    const schema = z.object({
      orgId: z.string(),
      sessionDate: z.string().optional(),
    });
    const { orgId, sessionDate } = schema.parse(req.query);

    // Check if user is founder
    const isFounder = await isUserFounder(me.userId, orgId);
    if (!isFounder) {
      return res.status(403).json({
        success: false,
        error: "Only founders can mark attendance",
      });
    }

    if (!Types.ObjectId.isValid(workshopId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid workshop or user ID",
      });
    }

    let parsedSessionDate: Date | undefined;
    if (sessionDate) {
      parsedSessionDate = parseSessionDate(sessionDate);
      if (isNaN(parsedSessionDate.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid session date format. Use YYYY-MM-DD",
        });
      }
    }

    const marked = await markUserAttended(workshopId, userId, parsedSessionDate);

    if (!marked) {
      return res.status(404).json({
        success: false,
        error: "Registration not found or already marked as attended",
      });
    }

    res.json({
      success: true,
      message: "User marked as attended",
    });
  } catch (error) {
    console.error("Error marking attendance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark attendance",
      details: (error as Error).message,
    });
  }
});

// ============= Meeting Generation Endpoint =============

/**
 * POST /workshops/:workshopId/generate-meeting
 * Generate a Garage Meet link for the workshop (founder only)
 */
router.post("/:workshopId/generate-meeting", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const { workshopId } = req.params;
    const { orgId } = z.object({ orgId: z.string() }).parse(req.query);

    // Optional sessionDate — recurring workshops only. When present, the
    // Meet record is anchored to that session's date (not workshop.date's
    // seed), and workshop.currentSessionDate rotates to it so the join
    // gate knows which session is currently live.
    const bodySchema = z.object({ sessionDate: z.string().optional() }).partial();
    const { sessionDate: sessionDateParam } = bodySchema.parse(req.body || {});

    // Whoever runs the stream may rotate its Meet — the creator, a founder, or
    // a member the founder delegated `live_streams` to. isFounderOrModuleAdmin
    // is a superset of the isUserFounder check this replaces, so no existing
    // founder loses access.
    const canRunStreams = await isFounderOrModuleAdmin(
      me.userId,
      orgId,
      "live_streams"
    );
    if (!canRunStreams) {
      return res.status(403).json({
        success: false,
        error: "Live stream admin access is required to start a session",
        code: "MODULE_ACCESS_REQUIRED",
        module: "live_streams",
      });
    }

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
      isActive: true,
    });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        error: "Workshop not found",
      });
    }

    // Somebody else is already running this session. Rotating the Meet now
    // would swap the room out from under them and their attendees, so refuse.
    // The seat is per-session and is freed on stop, so the next session — and
    // a restart after this one ends — is open again.
    const seatHolder = await getSessionHost(workshop as any);
    if (seatHolder && seatHolder !== me.userId) {
      const holder = await User.findById(seatHolder).select("name email").lean();
      return res.status(409).json({
        success: false,
        error: `${holder?.name || holder?.email || "Someone else"} is already hosting this session`,
        code: "SESSION_ALREADY_HOSTED",
      });
    }

    // Email of whoever is starting — they are this session's host.
    const founder = await User.findById(me.userId).select("email").lean();
    if (!founder || !founder.email) {
      return res.status(404).json({
        success: false,
        error: "User not found or email not available",
      });
    }

    // Resolve the anchor date. For recurring workshops with a picked
    // sessionDate we validate + use it; otherwise we fall back to
    // workshop.date (the seed / non-recurring single date).
    let anchorDate = new Date(workshop.date);
    let pickedSessionDate: Date | null = null;
    if (sessionDateParam) {
      if (!workshop.isRecurring) {
        return res.status(400).json({
          success: false,
          error: "sessionDate is only valid for recurring workshops",
        });
      }
      const parsed = parseSessionDate(sessionDateParam);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid sessionDate format",
        });
      }
      if (
        !workshop.recurrencePattern ||
        !isValidSessionDate(
          parsed,
          workshop.recurrencePattern,
          workshop.recurrenceStartDate || workshop.date,
          workshop.recurrenceEndDate
        )
      ) {
        return res.status(400).json({
          success: false,
          error: "The requested date is not a valid session for this workshop",
        });
      }
      anchorDate = parsed;
      pickedSessionDate = parsed;
    }

    // Generate join code
    const joinCode = generateMeetJoinCode();

    // Combine anchor date with start/end times to create proper datetime values
    // anchorDate is stored as UTC midnight (e.g., 2025-12-17T00:00:00.000Z)
    // workshop.startTime/endTime are strings like "19:00", "20:00" in the workshop's timezone
    const workshopDate = anchorDate;
    const dateYear = workshopDate.getUTCFullYear();
    const dateMonth = workshopDate.getUTCMonth();
    const dateDay = workshopDate.getUTCDate();

    // Parse start and end times (format: "HH:MM")
    const [startHours, startMinutes] = (workshop.startTime || "00:00").split(":").map(Number);
    const [endHours, endMinutes] = (workshop.endTime || "23:59").split(":").map(Number);

    // Create datetime objects in UTC first, then adjust for the workshop's timezone
    const meetStartTime = new Date(Date.UTC(dateYear, dateMonth, dateDay, startHours, startMinutes, 0, 0));
    const meetEndTime = new Date(Date.UTC(dateYear, dateMonth, dateDay, endHours, endMinutes, 0, 0));

    // Adjust for workshop timezone: the hours are in the workshop's timezone, not UTC
    // e.g., 20:30 IST (UTC+5:30) should become 15:00 UTC
    if (workshop.timezone) {
      const utcStr = meetStartTime.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = meetStartTime.toLocaleString("en-US", { timeZone: workshop.timezone });
      const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
      meetStartTime.setTime(meetStartTime.getTime() - offsetMs);
      meetEndTime.setTime(meetEndTime.getTime() - offsetMs);
    }

    // Handle midnight-crossing (e.g., 23:50 - 00:30): add 1 day to end time
    if (meetEndTime <= meetStartTime) {
      meetEndTime.setDate(meetEndTime.getDate() + 1);
    }

    // Create the meet
    const newMeet = await Meet.create({
      orgId: new Types.ObjectId(orgId),
      hostEmail: founder.email.toLowerCase().trim(),
      title: workshop.title,
      description: workshop.description || "",
      startTime: meetStartTime,
      endTime: meetEndTime,
      joinCode,
      agoraChannel: generateMeetAgoraChannel(joinCode),
      status: "scheduled",
      isHostVerified: false,
    });

    // Generate the join link
    const frontendUrl = env.FRONTEND_URL || "http://localhost:3000";
    const joinLink = `${frontendUrl}/meet/join?code=${joinCode}`;

    // Update workshop with meeting details. Only rotate
    // `currentSessionDate` when the founder explicitly picked a session
    // via the picker — otherwise leave it alone (do NOT auto-stamp to
    // today just because a meeting URL was pre-generated).
    //
    // The bodyless "/generate-meeting" call is fired by the FE right
    // after creating a workshop (`WorkshopsPage.tsx:5089`
    // handleGenerateMeeting) purely to pre-generate the Meet room + URL
    // so the "Start Session" button has something to hand to Razorpay-
    // style handlers. It is NOT an intent-to-go-live signal — that's
    // what `/webinar/:id/start` is for.
    workshop.meetingUrl = joinLink;
    workshop.meetingId = newMeet._id.toString();
    if (pickedSessionDate) {
      (workshop as any).currentSessionDate = pickedSessionDate;
    }
    await workshop.save();

    // NOTE: This route no longer stamps `manualStartedAt` on the
    // session override. Reason: the FE auto-calls /generate-meeting on
    // workshop CREATE (see WorkshopsPage.tsx:5087-5089) to pre-generate
    // the meeting URL — a founder-triggered "I'm going live" signal
    // must NOT fire from that path or Session 1 of every new recurring
    // workshop shows up as "● Live" the instant it's created (repro
    // 2026-07-14: "Ask Chamak Live" Session 1 auto-live at t=0).
    //
    // `manualStartedAt` is now stamped by the HOST's socket join —
    // `webinar:joinRoom` in realtime/mediasoupHandlers.ts (the same
    // block that flips Meet to live). NOT by this route, and NOT by
    // `POST /webinar/:workshopId/start` alone — the FE never calls that
    // route (`handleStartStream` → `startWorkshopSession` lands HERE,
    // on /generate-meeting, then opens /webinar/{id}?role=host, whose
    // socket join does the stamping). Removing the stamp here on the
    // assumption /webinar/:id/start covered it broke early attendee
    // joins between 2026-07-14 and 2026-08-01: prepare-join's timing
    // gate saw no manualStartedAt and told everyone "This session
    // hasn't started yet" until the scheduled clock time.

    res.json({
      success: true,
      meeting: {
        meetId: newMeet._id.toString(),
        joinCode,
        joinLink,
      },
      ...(pickedSessionDate
        ? { sessionDate: pickedSessionDate.toISOString() }
        : {}),
    });
  } catch (error) {
    console.error("Error generating meeting:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate meeting",
      details: (error as Error).message,
    });
  }
});

export default router;
