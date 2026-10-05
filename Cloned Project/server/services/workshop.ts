import { Types } from "mongoose";
import mongoose from "mongoose";
import { Workshop, IWorkshop, IRecurrencePattern } from "../models/workshop.model";
import { IEmailAlerts } from "../models/emailAlerts.schema";
import { IFounderAlerts } from "../models/founderAlerts.schema";
import { Meet } from "../models/meet.model";
import {
  WorkshopRegistration,
  IWorkshopRegistration,
} from "../models/workshopRegistration.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import {
  calculateSessions,
  getNextSession,
  getTimezoneOffsetMinutes,
  isValidSessionDate,
  startOfDay,
  endOfDay,
  WorkshopSession,
} from "../utils/recurrence";
import { getUsdToInrRate } from "../utils/exchangeRate";
import { WorkshopSessionOverride } from "../models/workshopSessionOverride.model";
import { isSessionDeleted, sessionDayKey } from "../utils/workshopStatus";
import {
  hasSessionEdits,
  indexOverridesByDay,
  resolveEffectiveSession,
  resolveSessionPricing,
} from "../utils/sessionOverlay";

/**
 * Mutates the given map, removing session-date strings that correspond to
 * trashed session overrides. Buyer-facing surfaces call this so the
 * Enrolled tab never shows a session the founder has moved to Trash.
 */
async function filterTrashedSessionDates(
  enrolledSessionsMap: Map<string, string[]>
): Promise<void> {
  const workshopIds = Array.from(enrolledSessionsMap.keys());
  if (workshopIds.length === 0) return;
  const overrides = await WorkshopSessionOverride.find({
    workshopId: {
      $in: workshopIds.map((id) => new Types.ObjectId(id)),
    },
    deletedAt: { $ne: null },
  }).lean();

  const trashedByWorkshop = new Map<string, Set<string>>();
  for (const o of overrides as any[]) {
    if (!isSessionDeleted(o)) continue;
    const wsId = o.workshopId.toString();
    if (!trashedByWorkshop.has(wsId)) trashedByWorkshop.set(wsId, new Set());
    trashedByWorkshop
      .get(wsId)!
      .add(sessionDayKey(o.sessionDate).toISOString());
  }

  for (const [wsId, dates] of enrolledSessionsMap.entries()) {
    const trashed = trashedByWorkshop.get(wsId);
    if (!trashed || trashed.size === 0) continue;
    const kept = dates.filter(
      (d) => !trashed.has(sessionDayKey(new Date(d)).toISOString())
    );
    enrolledSessionsMap.set(wsId, kept);
  }
}

/**
 * Compute the actual UTC end datetime for a workshop, respecting its timezone.
 * workshop.endTime is "HH:MM" in the workshop's timezone; workshop.date is UTC midnight.
 * For recurring workshops with a nextSession, use the nextSession's endDateTime instead.
 */
export function getWorkshopEndDateTimeUTC(workshop: any): Date {
  // Recurring with active next session — use the pre-calculated end
  if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.nextSession) {
    return new Date(workshop.nextSession.endDateTime);
  }

  const workshopDate = new Date(workshop.date);
  const [startH] = (workshop.startTime || "00:00").split(":").map(Number);
  const [endH, endM] = (workshop.endTime || "23:59").split(":").map(Number);

  const endDt = new Date(workshopDate);
  endDt.setUTCHours(endH, endM, 0, 0);

  // Handle midnight-crossing (endTime < startTime)
  if (endH < startH) {
    endDt.setUTCDate(endDt.getUTCDate() + 1);
  }

  // Convert from workshop timezone to UTC
  if (workshop.timezone) {
    const offset = getTimezoneOffsetMinutes(endDt, workshop.timezone);
    endDt.setMinutes(endDt.getMinutes() - offset);
  }

  return endDt;
}

/**
 * Compute the actual UTC start datetime for a workshop, respecting its
 * timezone. Mirror of getWorkshopEndDateTimeUTC — needed to tell a workshop
 * that hasn't begun yet from one that is under way. Before this existed the
 * workshop-level status had no notion of "not started", so every stream
 * showed as Active from the moment it was created.
 */
export function getWorkshopStartDateTimeUTC(workshop: any): Date {
  // Recurring with an active next session — use the pre-calculated start.
  if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.nextSession) {
    return new Date(workshop.nextSession.startDateTime);
  }

  const workshopDate = new Date(workshop.date);
  const [startH, startM] = (workshop.startTime || "00:00").split(":").map(Number);

  const startDt = new Date(workshopDate);
  startDt.setUTCHours(startH, startM, 0, 0);

  if (workshop.timezone) {
    const offset = getTimezoneOffsetMinutes(startDt, workshop.timezone);
    startDt.setMinutes(startDt.getMinutes() - offset);
  }

  return startDt;
}

/**
 * Helper to fetch meeting statuses for a list of workshops and map them to their IDs
 */
async function getMeetingStatusesMap(meetingIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const validIds = meetingIds
    .filter((id) => id && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (validIds.length === 0) return map;

  const meets = await Meet.find({ _id: { $in: validIds } })
    .select("status")
    .lean();

  meets.forEach((meet) => {
    map.set(meet._id.toString(), meet.status);
  });

  return map;
}

// ============= Workshop CRUD Functions =============

export interface CreateWorkshopData {
  title: string;
  description?: string;
  thumbnail?: string;
  galleryImages?: string[];
  videoUrl?: string;
  videoFile?: string;
  date: Date;
  startTime: string;
  endTime: string;
  timezone?: string;
  meetingUrl?: string;
  meetingId?: string;
  meetingPassword?: string;
  maxParticipants?: number;
  channelIds?: string[];
  /** User ids of office members billed as speakers (see the model). */
  speakerIds?: string[];
  isFree?: boolean;
  price?: number;
  currency?: string;
  gstInclusive?: boolean;
  requireIosPayment?: boolean;
  appleFeeInclusive?: boolean;
  isActive?: boolean;
  // Recurrence fields
  isRecurring?: boolean;
  recurrencePattern?: IRecurrencePattern;
  recurrenceStartDate?: Date;
  recurrenceEndDate?: Date;
  enrollmentType?: "once" | "per_session";
  /** Post-registration email config — see models/emailAlerts.schema.ts. */
  emailAlerts?: IEmailAlerts;
  /** Host's "someone registered" alert — see models/founderAlerts.schema.ts. */
  founderAlerts?: IFounderAlerts;
}

/**
 * Create a new workshop
 */
export async function createWorkshop(
  orgId: string,
  createdBy: string,
  data: CreateWorkshopData
): Promise<IWorkshop> {
  const { speakerIds, ...rest } = data;
  const workshopData: any = {
    ...rest,
    orgId: new Types.ObjectId(orgId),
    createdBy: new Types.ObjectId(createdBy),
    channelIds: data.channelIds?.map((id) => new Types.ObjectId(id)) || [],
    ...(speakerIds?.length
      ? { speakers: speakerIds.map((id) => new Types.ObjectId(id)) }
      : {}),
    isFree: data.isFree ?? (data.price === 0 || data.price === undefined),
    price: data.price || 0,
    currency: data.currency || "USD",
  };

  // Handle recurrence fields
  if (data.isRecurring) {
    workshopData.isRecurring = true;
    workshopData.recurrencePattern = data.recurrencePattern;
    workshopData.recurrenceStartDate = data.recurrenceStartDate || data.date;
    workshopData.isRecurrenceActive = true;
    workshopData.enrollmentType = data.enrollmentType || "once";
    // End date bounds every recurring workshop regardless of enrolment
    // mode. Route validation already ensures it's present + after start.
    if (data.recurrenceEndDate) {
      workshopData.recurrenceEndDate = data.recurrenceEndDate;
    }
  }

  const workshop = await Workshop.create(workshopData);
  return workshop;
}

/**
 * Update a workshop
 */
export async function updateWorkshop(
  workshopId: string,
  orgId: string,
  data: Partial<CreateWorkshopData> & { isRecurrenceActive?: boolean }
): Promise<IWorkshop | null> {
  // Get current workshop to check for enrollment type changes
  const currentWorkshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
  }).lean();

  if (!currentWorkshop) return null;

  const updateData: any = { ...data };

  if (data.channelIds) {
    updateData.channelIds = data.channelIds.map((id) => new Types.ObjectId(id));
  }

  // Speakers travel as `speakerIds`; an explicit empty list clears them.
  if (data.speakerIds !== undefined) {
    delete updateData.speakerIds;
    updateData.speakers = (data.speakerIds || []).map((id) => new Types.ObjectId(id));
  }

  if (data.price !== undefined) {
    updateData.isFree = data.isFree ?? data.price === 0;
  }

  // Handle enrollment type change: once -> per_session
  // Grandfather existing full enrollments
  if (
    data.enrollmentType === "per_session" &&
    currentWorkshop.enrollmentType === "once" &&
    currentWorkshop.isRecurring
  ) {
    await WorkshopRegistration.updateMany(
      {
        workshopId: new Types.ObjectId(workshopId),
        enrollmentType: "full",
        status: { $ne: "cancelled" },
      },
      { grandfathered: true }
    );
  }

  const workshop = await Workshop.findOneAndUpdate(
    {
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
    },
    updateData,
    { new: true }
  );

  return workshop;
}

/**
 * Delete (soft delete) a workshop
 */
export async function deleteWorkshop(
  workshopId: string,
  orgId: string
): Promise<boolean> {
  const result = await Workshop.updateOne(
    {
      _id: new Types.ObjectId(workshopId),
      orgId: new Types.ObjectId(orgId),
    },
    { isActive: false }
  );

  return result.modifiedCount > 0;
}

/**
 * Get a single workshop by ID
 */
/**
 * Whether `userId` is one of the workshop's billed speakers (Workshop.speakers).
 * Tolerates a populated list (documents) and a bare one (ObjectIds).
 */
export function isBilledSpeaker(
  workshop: { speakers?: any[] } | null | undefined,
  userId?: string | null
): boolean {
  if (!workshop?.speakers?.length || !userId) return false;
  return workshop.speakers.some((sp: any) => (sp?._id ?? sp)?.toString() === userId);
}

export async function getWorkshopById(
  workshopId: string,
  userId?: string
): Promise<any> {
  const workshop = await Workshop.findById(workshopId)
    .populate("channelIds", "title")
    .populate("createdBy", "name email profilePicture")
    .populate("speakers", "name profilePicture designation")
    .lean();

  if (!workshop) return null;

  // Get registration count
  const registrationCount = await WorkshopRegistration.countDocuments({
    workshopId: new Types.ObjectId(workshopId),
    status: { $ne: "cancelled" },
  });

  // Check if user is registered (if userId provided)
  let isRegistered = false;
  let hasPaid = false;

  if (userId) {
    const registration = await WorkshopRegistration.findOne({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      status: { $ne: "cancelled" },
    }).lean();

    if (registration) {
      isRegistered = true;
      hasPaid = registration.hasPaid;
    }
  }

  // Add next session for recurring workshops
  let nextSession: WorkshopSession | null = null;
  if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.recurrencePattern) {
    nextSession = getNextSession(
      workshop.recurrencePattern,
      workshop.recurrenceStartDate || workshop.date,
      workshop.startTime,
      workshop.endTime,
      workshop.timezone,
      workshop.recurrenceEndDate
    );
  }

  // Get recent registration avatars
  const recentRegistrations = await WorkshopRegistration.find({
    workshopId: new Types.ObjectId(workshopId),
    status: { $ne: "cancelled" },
  })
    .sort({ registeredAt: -1 })
    .populate("userId", "name profilePicture")
    .limit(8)
    .lean();

  const registeredParticipantAvatars = recentRegistrations.map((reg: any) => {
    const user = reg.userId;
    return user?.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || "User")}`;
  });

  // Get meeting status
  let meetingStatus = "scheduled";
  if (workshop.meetingId && Types.ObjectId.isValid(workshop.meetingId)) {
    const meetObj = await Meet.findById(workshop.meetingId).select("status").lean();
    if (meetObj) {
      meetingStatus = meetObj.status;
    }
  }

  return {
    ...workshop,
    registeredParticipantsCount: registrationCount,
    isRegistered,
    hasPaid,
    nextSession,
    registeredParticipantAvatars,
    meetingStatus,
  };
}

/**
 * How many workshops the page-selection scan below will read.
 *
 * The scan is a projection — no populate, no per-workshop queries — so it is
 * cheap per row, but it is still bounded rather than unbounded. Matches the
 * cap founderStreamTable uses, doubled, because this one feeds a buyer-facing
 * list where being cut off is silently wrong rather than merely incomplete.
 */
const WORKSHOP_SCAN_CAP = 1000;

/**
 * Which workshops belong on this page.
 *
 * THE BUG THIS EXISTS TO FIX: both list endpoints used to do
 *
 *     .sort({ date: upcoming ? 1 : -1 }).skip(offset).limit(limit)
 *
 * and then apply the upcoming/past split in Node afterwards — because
 * `endTime` is a wall-clock string in the workshop's own timezone and can't be
 * compared against server time inside a query. Those two steps don't compose.
 * The database picked 50 rows, and only then did anything ask whether those
 * rows were the ones being asked for.
 *
 * On `upcoming=true` the sort is ASCENDING, so the 50 OLDEST workshops were
 * read and then mostly discarded for having ended: a newly created stream was
 * never in the page, and an org with 50+ past workshops got an empty Discover
 * tab. On `upcoming=undefined` (Enrolled) the sort is descending, so the cut
 * fell on older enrolments instead.
 *
 * So: scan a projection of every candidate, apply the filter, and only THEN
 * take the page. Enrichment downstream runs over at most `limit` workshops —
 * cheaper than before, since it used to enrich 50 rows to display a handful.
 */
async function selectWorkshopPage(
  filter: any,
  opts: { upcoming?: boolean; limit: number; offset: number; label: string }
): Promise<{ ids: Types.ObjectId[]; total: number }> {
  const { upcoming, limit, offset, label } = opts;

  const candidates = await Workshop.find(filter)
    .select(
      "date startTime endTime timezone isRecurring isRecurrenceActive " +
        "recurrencePattern recurrenceStartDate recurrenceEndDate"
    )
    .sort({ date: upcoming ? 1 : -1 })
    .limit(WORKSHOP_SCAN_CAP)
    .lean();

  if (candidates.length === WORKSHOP_SCAN_CAP) {
    // Never truncate silently: a capped list reads as "this is everything".
    console.warn(
      `[${label}] workshop scan hit the ${WORKSHOP_SCAN_CAP} cap — ` +
        `results past it are not represented in the page or the total`
    );
  }

  let kept = candidates;
  if (upcoming !== undefined) {
    const now = new Date();
    kept = candidates.filter((w: any) => {
      // An active recurrence is "upcoming" for as long as it has a session
      // left — same rule both callers applied post-enrichment before.
      if (w.isRecurring && w.isRecurrenceActive) {
        const next =
          w.recurrencePattern && (w.recurrenceStartDate || w.date)
            ? getNextSession(
                w.recurrencePattern,
                w.recurrenceStartDate || w.date,
                w.startTime,
                w.endTime,
                w.timezone,
                w.recurrenceEndDate
              )
            : null;
        return upcoming ? next != null : false;
      }
      const hasEnded = now > getWorkshopEndDateTimeUTC(w);
      return upcoming ? !hasEnded : hasEnded;
    });
  }

  return {
    ids: kept.slice(offset, offset + limit).map((w: any) => w._id),
    total: kept.length,
  };
}

/**
 * Re-impose the page's order on a `$in` fetch.
 *
 * `find({ _id: { $in } })` returns whatever order the index yields, which is
 * not the order the page was selected in — without this the list would shuffle
 * on every request.
 */
function orderByIds<T extends { _id: any }>(docs: T[], ids: Types.ObjectId[]): T[] {
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  return ids
    .map((id) => byId.get(id.toString()))
    .filter((d): d is T => !!d);
}

/**
 * Get all workshops for an organization
 */
export async function getOrgWorkshops(
  orgId: string,
  options: {
    userId?: string;
    channelId?: string;
    upcoming?: boolean;
    limit?: number;
    offset?: number;
    includeInactive?: boolean;
    /** Restrict to workshops `userId` holds a registration for. See the same
     *  option on getUserAccessibleWorkshops — a founder's Enrolled tab comes
     *  through here, and it has the same "cap applies to the pool" problem. */
    enrolledOnly?: boolean;
  } = {}
): Promise<{ workshops: any[]; total: number }> {
  const {
    userId,
    channelId,
    upcoming,
    limit = 50,
    offset = 0,
    includeInactive = false,
    enrolledOnly = false,
  } = options;

  const usdToInrRate = await getUsdToInrRate();

  const filter: any = {
    orgId: new Types.ObjectId(orgId),
  };

  if (!includeInactive) {
    filter.isActive = true;
  }

  // Exclude Trashed workshops from the main list. Trash page uses its own
  // dedicated route (GET /workshops/trash).
  filter.$and = [
    {
      $or: [
        { deletedAt: { $exists: false } },
        { deletedAt: null },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    },
  ];

  if (channelId) {
    filter.channelIds = new Types.ObjectId(channelId);
  }

  if (enrolledOnly) {
    if (!userId) return { workshops: [], total: 0 };
    const mine = await WorkshopRegistration.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: { $ne: "cancelled" },
    })
      .select("workshopId")
      .lean();
    const enrolledIds = Array.from(
      new Set(mine.map((r: any) => r.workshopId.toString()))
    ).map((id) => new Types.ObjectId(id));
    if (enrolledIds.length === 0) return { workshops: [], total: 0 };
    filter._id = { $in: enrolledIds };
  }

  // The upcoming/past split can't run inside the query (endTime is a
  // wall-clock string in the workshop's own timezone), so the page is chosen
  // by a projection scan that applies it first — see selectWorkshopPage. Doing
  // it the other way round paginated over rows the filter then threw away.
  const { ids: pageIds, total } = await selectWorkshopPage(filter, {
    upcoming,
    limit,
    offset,
    label: "getOrgWorkshops",
  });

  const workshops = pageIds.length
    ? orderByIds(
        await Workshop.find({ _id: { $in: pageIds } })
          .populate("channelIds", "title")
          .populate("createdBy", "name email profilePicture")
          .lean(),
        pageIds
      )
    : [];

  // Get registration counts and user registration status
  const workshopIds = workshops.map((w) => w._id);

  const registrationCounts = await WorkshopRegistration.aggregate([
    {
      $match: {
        workshopId: { $in: workshopIds },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$workshopId",
        // count = total non-cancelled registration ROWS.
        // For per_session that = total session-buys (person buys 3 = 3).
        // For enrol-once / one-time that = # unique enrolees (1 row each).
        count: { $sum: 1 },
        attendeesCount: {
          $sum: {
            $cond: [{ $eq: ["$status", "attended"] }, 1, 0],
          },
        },
        // Distinct userIds across all rows → drives the "Enrolees" tile
        // that per_session workshops surface separately from Enrollment.
        uniqueEnrolees: { $addToSet: "$userId" },
        // Distinct userIds among attended rows → "Unique Attendees" tile
        // for recurring workshops.
        uniqueAttendees: {
          $addToSet: {
            $cond: [
              { $eq: ["$status", "attended"] },
              "$userId",
              "$$REMOVE",
            ],
          },
        },
      },
    },
  ]);

  const countMap = new Map<
    string,
    {
      count: number;
      attendeesCount: number;
      enrolleesCount: number;
      uniqueAttendeesCount: number;
    }
  >(
    registrationCounts.map((r) => [
      r._id.toString(),
      {
        count: r.count,
        attendeesCount: r.attendeesCount || 0,
        enrolleesCount: Array.isArray(r.uniqueEnrolees)
          ? r.uniqueEnrolees.length
          : 0,
        uniqueAttendeesCount: Array.isArray(r.uniqueAttendees)
          ? r.uniqueAttendees.length
          : 0,
      },
    ])
  );

  // Get user registrations if userId provided
  let userRegistrations = new Map<string, { isRegistered: boolean; hasPaid: boolean }>();
  // Per-session enrolments — remember the specific sessionDate rows so
  // the FE calendar can dot only the days the user actually paid for
  // (rather than emitting every recurrence-pattern day).
  const enrolledSessionsMap = new Map<string, string[]>();
  if (userId) {
    const registrations = await WorkshopRegistration.find({
      workshopId: { $in: workshopIds },
      userId: new Types.ObjectId(userId),
      status: { $ne: "cancelled" },
    })
      .select("workshopId enrollmentType sessionDate hasPaid")
      .lean();

    registrations.forEach((reg) => {
      const key = reg.workshopId.toString();
      userRegistrations.set(key, {
        isRegistered: true,
        hasPaid: reg.hasPaid,
      });
      if ((reg as any).enrollmentType === "session" && (reg as any).sessionDate) {
        if (!enrolledSessionsMap.has(key)) enrolledSessionsMap.set(key, []);
        enrolledSessionsMap.get(key)!.push(
          new Date((reg as any).sessionDate).toISOString()
        );
      }
    });

    // Filter trashed session dates out of enrolledSessions so the buyer's
    // Enrolled tab never surfaces a deleted session.
    await filterTrashedSessionDates(enrolledSessionsMap);
  }

  // Get recent registration avatars for each workshop
  const recentRegistrations = await WorkshopRegistration.find({
    workshopId: { $in: workshopIds },
    status: { $ne: "cancelled" },
  })
    .sort({ registeredAt: -1 })
    .populate("userId", "name profilePicture")
    .lean();

  const avatarsMap = new Map<string, string[]>();
  recentRegistrations.forEach((reg: any) => {
    const wsId = reg.workshopId.toString();
    if (!avatarsMap.has(wsId)) {
      avatarsMap.set(wsId, []);
    }
    const currentList = avatarsMap.get(wsId)!;
    if (currentList.length < 8) {
      const user = reg.userId;
      if (user) {
        const avatarUrl = user.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || "User")}`;
        currentList.push(avatarUrl);
      }
    }
  });

  // Get meeting statuses map
  const meetingIds = workshops.map((w) => w.meetingId).filter((id): id is string => !!id);
  const meetStatusesMap = await getMeetingStatusesMap(meetingIds);

  // Batch get meeting participants for recurring workshops to calculate active session counts
  let meetParticipants: any[] = [];
  if (meetingIds.length > 0) {
    const { MeetParticipant } = await import("../models/meetParticipant.model");
    meetParticipants = await MeetParticipant.find({
      meetId: { $in: meetingIds.map((id) => new Types.ObjectId(id)) },
    }).lean();
  }

  // Group participants by meetId
  const participantsByMeetId = new Map<string, any[]>();
  meetParticipants.forEach((p) => {
    const mId = p.meetId.toString();
    if (!participantsByMeetId.has(mId)) {
      participantsByMeetId.set(mId, []);
    }
    participantsByMeetId.get(mId)!.push(p);
  });

  // Batch commission data — one query for the active CombPlan per
  // workshop (level percentage), one aggregation for the total dollars
  // paid out to affiliates. Both keyed by workshopId string.
  const commissionPercentMap = new Map<string, number>();
  const commissionPaidMap = new Map<string, number>();
  if (workshopIds.length > 0) {
    const { CombPlan } = await import("../models/combPlan.model");
    const { CommissionDistribution } = await import(
      "../models/commissionDistribution.model"
    );
    const [combPlans, commissionSums] = await Promise.all([
      CombPlan.find({
        itemType: "workshop",
        itemId: { $in: workshopIds },
        isActive: true,
      })
        .select("itemId totalPercentage")
        .lean(),
      CommissionDistribution.aggregate([
        {
          $match: {
            itemType: "workshop",
            itemId: { $in: workshopIds },
            status: "completed",
          },
        },
        {
          $group: {
            _id: "$itemId",
            totalPaidUsd: { $sum: "$totalCommissionAmount" },
          },
        },
      ]),
    ]);
    combPlans.forEach((p: any) =>
      commissionPercentMap.set(p.itemId.toString(), p.totalPercentage || 0)
    );
    commissionSums.forEach((r: any) =>
      commissionPaidMap.set(r._id.toString(), r.totalPaidUsd || 0)
    );
  }

  // Batch-fetch manualEndedAt overrides (same as the buyer list above) so
  // the founder's own calendar view also flips Completed for sessions
  // they started + ended early.
  // Widened to include manualStartedAt: the workshop-level status ladder
  // below needs "the founder pressed Start and hasn't pressed End" to render
  // Live, exactly the way the session rows do.
  const orgOverrideDocs = await WorkshopSessionOverride.find({
    workshopId: { $in: workshopIds },
    $or: [
      { manualEndedAt: { $ne: null } },
      { manualStartedAt: { $ne: null } },
      // A seat can be claimed a moment before manualStartedAt is stamped —
      // the LiveKit token claims it, the socket join stamps. Match those rows
      // too so the "hosted by" chip appears the instant someone goes in.
      { hostUserId: { $ne: null } },
      // Per-session edits. A founder viewing their own Enrolled calendar comes
      // through THIS function, not getUserAccessibleWorkshops — without this
      // their edited session still rendered under the series title.
      { isEdited: true },
    ],
  }).lean();
  const orgManuallyEndedByWorkshop = new Map<string, string[]>();
  // Workshops with at least one session currently started-and-not-ended.
  //
  // The 8h stale cap is the SAME one getSessionAnalytics applies (see
  // MANUAL_START_STALE_MS there). Without it a founder who hits Start and
  // never hits Stop would leave the workshop pill stuck on Live forever,
  // while the session row underneath correctly aged out to Completed — the
  // exact parent/child contradiction this change exists to remove.
  const MANUAL_START_STALE_MS = 8 * 60 * 60 * 1000;
  const nowForOverrides = Date.now();
  const orgLiveByWorkshop = new Set<string>();
  /** workshopId → userId currently holding that workshop's host seat. */
  const orgSessionHostIdByWorkshop = new Map<string, string>();
  for (const o of orgOverrideDocs as any[]) {
    const wsId = o.workshopId.toString();
    if (o.manualEndedAt) {
      const iso = new Date(o.sessionDate).toISOString();
      if (!orgManuallyEndedByWorkshop.has(wsId))
        orgManuallyEndedByWorkshop.set(wsId, []);
      orgManuallyEndedByWorkshop.get(wsId)!.push(iso);
    }
    if (
      o.manualStartedAt &&
      !o.manualEndedAt &&
      nowForOverrides - new Date(o.manualStartedAt).getTime() <=
        MANUAL_START_STALE_MS
    ) {
      orgLiveByWorkshop.add(wsId);
    }
    // Who currently holds the host seat. Only one person can run a session,
    // so the console can name them instead of letting a second founder click
    // Start and collect a 409. Skipped once the session has been ended — the
    // seat is released then and the row is only history.
    if (o.hostUserId && !o.manualEndedAt) {
      orgSessionHostIdByWorkshop.set(wsId, o.hostUserId.toString());
    }
  }

  // Per-session edits, resolved over their parent series. Same shape the
  // buyer list returns, so one client-side lookup serves both.
  const orgWorkshopById = new Map(
    workshops.map((w: any) => [w._id.toString(), w])
  );
  const orgEditsByWorkshop = new Map<string, any[]>();
  for (const o of orgOverrideDocs as any[]) {
    const wsId = o.workshopId.toString();
    const parent = orgWorkshopById.get(wsId);
    if (!parent || !hasSessionEdits(o)) continue;
    const effective = resolveEffectiveSession(parent, o.sessionDate, o);
    if (!orgEditsByWorkshop.has(wsId)) orgEditsByWorkshop.set(wsId, []);
    orgEditsByWorkshop.get(wsId)!.push({
      sessionDate: new Date(o.sessionDate).toISOString(),
      displayDate: effective.displayDate.toISOString(),
      isRescheduled: effective.isRescheduled,
      title: effective.title,
      description: effective.description,
      thumbnail: effective.thumbnail,
      startTime: effective.startTime,
      endTime: effective.endTime,
      timezone: effective.timezone,
      startDateTime: effective.startDateTime.toISOString(),
      endDateTime: effective.endDateTime.toISOString(),
      speakerName: effective.speakerName,
      speakerAvatar: effective.speakerAvatar,
      isFree: effective.isFree,
      price: effective.price,
    });
  }

  // Resolve the seat-holders to something displayable, in one round trip.
  const sessionHostIds = [...new Set(orgSessionHostIdByWorkshop.values())];
  const sessionHostById = new Map<string, any>();
  if (sessionHostIds.length) {
    const hostUsers = await User.find({ _id: { $in: sessionHostIds } })
      .select("name email profilePicture")
      .lean();
    for (const u of hostUsers as any[]) {
      sessionHostById.set(u._id.toString(), {
        id: u._id.toString(),
        name: u.name || "",
        email: u.email || "",
        profilePicture: u.profilePicture || "",
      });
    }
  }

  const enrichedWorkshops = workshops.map((workshop) => {
    // Add next session for recurring workshops
    let nextSession: WorkshopSession | null = null;
    // The series' very first occurrence, past or future. `nextSession` is
    // future-only (getNextSession passes includePast=false), so on its own it
    // cannot tell "never started" apart from "between sessions" — this can.
    // Consumed only by the computedStatus ladder below.
    //
    // includePast=true makes calculateSessions ignore `fromDate` and walk from
    // recurrenceStartDate (utils/recurrence.ts:142-147), so limit=1 yields the
    // first occurrence ever. Bounded work — the loop stops at the first match.
    let firstOccurrence: WorkshopSession | null = null;
    if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.recurrencePattern) {
      nextSession = getNextSession(
        workshop.recurrencePattern,
        workshop.recurrenceStartDate || workshop.date,
        workshop.startTime,
        workshop.endTime,
        workshop.timezone,
        workshop.recurrenceEndDate
      );
      firstOccurrence =
        calculateSessions(
          workshop.recurrencePattern,
          workshop.recurrenceStartDate || workshop.date,
          workshop.startTime,
          workshop.endTime,
          new Date(0), // ignored when includePast is true
          1,
          true,
          workshop.timezone,
          workshop.recurrenceEndDate
        )[0] || null;
    }

    // Calculate active sessions count for recurring workshops.
    // - activeSessionsCount = PAST sessions only (legacy consumers rely on
    //   this meaning "how many have already run").
    // - totalSessionsCount = FULL bounded range (needed for the founder
    //   card's "# Sessions" tile — total planned sessions).
    let activeSessionsCount = 1;
    let totalSessionsCount = 1;
    if (workshop.isRecurring && workshop.recurrencePattern) {
      const recurrenceSessions = calculateSessions(
        workshop.recurrencePattern,
        workshop.recurrenceStartDate || workshop.date,
        workshop.startTime,
        workshop.endTime,
        new Date(),
        500, // safety cap; bounded workshops stop naturally at recurrenceEndDate
        true, // includePast = true
        workshop.timezone,
        workshop.recurrenceEndDate
      );
      totalSessionsCount = recurrenceSessions.length;
      activeSessionsCount = recurrenceSessions.filter(
        (session) => session.date < new Date()
      ).length;
    }

    // Attendance events (Type B + C "Attendees" tile). Sum of Meet
    // participant JOIN events across the workshop's meet. A person who
    // joins 5 sessions counts as 5. For one-time workshops it collapses
    // to attendeesCount naturally.
    const meetParticipantsForWorkshop = workshop.meetingId
      ? participantsByMeetId.get(workshop.meetingId.toString()) || []
      : [];
    const attendanceEventsCount = meetParticipantsForWorkshop.length;

    const regData = countMap.get(workshop._id.toString()) || {
      count: 0,
      attendeesCount: 0,
      enrolleesCount: 0,
      uniqueAttendeesCount: 0,
    };
    const count = regData.count;
    const attendeesCount = regData.attendeesCount;
    const enrolleesCount = regData.enrolleesCount;
    const uniqueAttendeesCount = regData.uniqueAttendeesCount;
    const priceVal = workshop.price || 0;
    const currency = workshop.currency || "USD";
    const usdPrice = currency === "INR" ? priceVal / usdToInrRate : priceVal;

    const totalRevenueUSD = workshop.isFree ? 0 : count * usdPrice;
    let monthlyRevenueUSD = 0;
    if (!workshop.isFree && usdPrice > 0 && workshop.isSubscription) {
      let mrrPerMember = 0;
      switch (workshop.subscriptionPeriod) {
        case "weekly": mrrPerMember = usdPrice * (52 / 12); break;
        case "monthly": mrrPerMember = usdPrice; break;
        case "quarterly": mrrPerMember = usdPrice / 3; break;
        case "yearly": mrrPerMember = usdPrice / 12; break;
        default: mrrPerMember = usdPrice;
      }
      monthlyRevenueUSD = count * mrrPerMember;
    }

    // Derived Active/Completed status. Deleted is filtered out earlier so
    // it never reaches here. Recurring: Completed once recurrenceEndDate
    // has passed OR (no end date) once nextSession is null. Non-recurring:
    // Completed once the timezone-aware endTime has passed OR the founder
    // has explicitly ended the single session (via /webinar/:id/stop —
    // manualEndedAt override). Without the manual-end branch, a stream
    // ended early stayed "active" until the scheduled endTime, which
    // showed the "Start Live Stream" button on a done stream.
    // Same ladder the session rows use (see getSessionAnalytics), so a
    // workshop's pill can never contradict its own sessions:
    //   1. founder pressed End            → completed
    //   2. founder pressed Start (no End) → live
    //   3. scheduled end passed           → completed
    //   4. scheduled start passed         → live
    //   5. else                           → not_started
    //
    // "not_started" is the state that was missing: computedStatus used to be
    // just "active" | "completed", so a stream scheduled for next week showed
    // as Active the moment it was created, and a recurring workshop showed
    // Active before its first session had ever run.
    const nowForStatus = new Date();
    const wsIdStr = workshop._id.toString();
    const hasManualEnd =
      (orgManuallyEndedByWorkshop.get(wsIdStr)?.length ?? 0) > 0;
    const hasLiveSession = orgLiveByWorkshop.has(wsIdStr);

    let computedStatus: "not_started" | "active" | "live" | "completed";

    if (workshop.isRecurring) {
      // Recurrence exhausted → done, regardless of any individual session.
      if (
        workshop.recurrenceEndDate &&
        nowForStatus > new Date(workshop.recurrenceEndDate)
      ) {
        computedStatus = "completed";
      } else if (!workshop.isRecurrenceActive && !nextSession) {
        computedStatus = "completed";
      } else if (hasLiveSession) {
        computedStatus = "live";
      } else if (
        nextSession &&
        nowForStatus >= new Date(nextSession.startDateTime)
      ) {
        // We're inside the current session's window.
        computedStatus = "live";
      } else if (
        firstOccurrence &&
        nowForStatus >= new Date(firstOccurrence.startDateTime)
      ) {
        // The series has begun — its first occurrence is in the past — but
        // nothing is on air right now. That's "under way, between sessions".
        //
        // Without this branch a daily series running since March reported
        // "not_started" every moment it wasn't mid-session, because the ladder
        // only ever consulted `nextSession` (future-only: getNextSession passes
        // includePast=false) and `hasLiveSession` (right now). No past session
        // was visible to it at all, so a series that had run for months was
        // indistinguishable from one that had never started.
        computedStatus = "active";
      } else {
        // Nothing has run yet and the first occurrence is still ahead — the
        // genuine "yet to start" case.
        computedStatus = "not_started";
      }
    } else {
      const startUTC = getWorkshopStartDateTimeUTC(workshop);
      const endUTC = getWorkshopEndDateTimeUTC(workshop);
      if (hasManualEnd) {
        computedStatus = "completed";
      } else if (hasLiveSession) {
        computedStatus = "live";
      } else if (nowForStatus > endUTC) {
        computedStatus = "completed";
      } else if (nowForStatus >= startUTC) {
        computedStatus = "live";
      } else {
        computedStatus = "not_started";
      }
    }

    return {
      ...workshop,
      activeSessionsCount,
      totalSessionsCount,
      registeredParticipantsCount: count,
      enrolleesCount,
      uniqueAttendeesCount,
      attendanceEventsCount,
      attendeesCount,
      isRegistered: userRegistrations.get(workshop._id.toString())?.isRegistered || false,
      hasPaid: userRegistrations.get(workshop._id.toString())?.hasPaid || false,
      enrolledSessions: enrolledSessionsMap.get(workshop._id.toString()) || undefined,
      // ISO datetimes of sessions where the founder pressed End early.
      // FE calendar honours these to render Completed instead of the
      // scheduled-window default.
      manuallyEndedSessionDates:
        orgManuallyEndedByWorkshop.get(workshop._id.toString()) || undefined,
      sessionOverrides:
        orgEditsByWorkshop.get(workshop._id.toString()) || undefined,
      nextSession,
      registeredParticipantAvatars: avatarsMap.get(workshop._id.toString()) || [],
      totalRevenueUSD,
      monthlyRevenueUSD,
      affiliateCommissionPercent:
        commissionPercentMap.get(workshop._id.toString()) || 0,
      affiliateCommissionPaidUsd:
        commissionPaidMap.get(workshop._id.toString()) || 0,
      meetingStatus: workshop.meetingId ? (meetStatusesMap.get(workshop.meetingId.toString()) || "scheduled") : "scheduled",
      computedStatus,
      // Who is running this session right now, if anyone. Null when the seat
      // is open. Lets the console show "Hosted by X" and offer Join instead of
      // Start, rather than surfacing the conflict only as a 409 after a click.
      sessionHost:
        sessionHostById.get(
          orgSessionHostIdByWorkshop.get(workshop._id.toString()) || ""
        ) || null,
    };
  });

  // No post-filter here any more: selectWorkshopPage already applied the
  // upcoming/past split, so these rows ARE the page and `total` counts the
  // whole filtered set rather than what survived one page of it.
  return { workshops: enrichedWorkshops, total };
}

/**
 * Get workshops accessible to a user (based on channel subscriptions)
 */
export async function getUserAccessibleWorkshops(
  userId: string,
  orgId: string,
  options: {
    upcoming?: boolean;
    limit?: number;
    offset?: number;
    /**
     * Restrict to workshops this user actually holds a registration for.
     *
     * The Enrolled tab used to fetch a page of ALL accessible workshops and
     * narrow it to the enrolled ones in the browser, so the 50-row cap applied
     * to the pool rather than to the answer — an enrolment in the 51st-newest
     * workshop was invisible. Filtering here makes the cap mean what it says.
     */
    enrolledOnly?: boolean;
  } = {}
): Promise<{ workshops: any[]; total: number }> {
  const { upcoming, limit = 50, offset = 0, enrolledOnly = false } = options;

  // Get user's subscribed channels
  const memberships = await ChannelMembership.find({
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    status: "active",
  })
    .select("channelId")
    .lean();

  const subscribedChannelIds = memberships.map((m) => m.channelId);

  // Build filter: workshops with no channels OR workshops with user's subscribed channels
  const filter: any = {
    orgId: new Types.ObjectId(orgId),
    isActive: true,
    $and: [
      {
        $or: [
          { channelIds: { $size: 0 } },
          { channelIds: { $in: subscribedChannelIds } },
        ],
      },
      // Exclude Trashed workshops from buyer views entirely.
      {
        $or: [
          { deletedAt: { $exists: false } },
          { deletedAt: null },
          { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
        ],
      },
    ],
  };

  // Narrowing to the user's own enrolments happens in the QUERY, so the page
  // limit bounds the answer rather than the pool it's drawn from.
  if (enrolledOnly) {
    const mine = await WorkshopRegistration.find({
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: { $ne: "cancelled" },
    })
      .select("workshopId")
      .lean();
    const enrolledIds = Array.from(
      new Set(mine.map((r: any) => r.workshopId.toString()))
    ).map((id) => new Types.ObjectId(id));
    if (enrolledIds.length === 0) return { workshops: [], total: 0 };
    filter._id = { $in: enrolledIds };
  }

  // Page selection runs the upcoming/past split BEFORE it slices — see
  // selectWorkshopPage for why doing it the other way round hid new streams
  // from Discover and old enrolments from Enrolled.
  const { ids: pageIds, total } = await selectWorkshopPage(filter, {
    upcoming,
    limit,
    offset,
    label: "getUserAccessibleWorkshops",
  });

  const workshops = pageIds.length
    ? orderByIds(
        await Workshop.find({ _id: { $in: pageIds } })
          .populate("channelIds", "title")
          .populate("createdBy", "name email profilePicture")
          .lean(),
        pageIds
      )
    : [];

  // Get registration counts and user registration status
  const workshopIds = workshops.map((w) => w._id);

  const registrationCounts = await WorkshopRegistration.aggregate([
    {
      $match: {
        workshopId: { $in: workshopIds },
        status: { $ne: "cancelled" },
      },
    },
    {
      $group: {
        _id: "$workshopId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map(
    registrationCounts.map((r) => [r._id.toString(), r.count])
  );

  // Get user registrations
  const registrations = await WorkshopRegistration.find({
    workshopId: { $in: workshopIds },
    userId: new Types.ObjectId(userId),
    status: { $ne: "cancelled" },
  })
    .select("workshopId enrollmentType sessionDate hasPaid")
    .lean();

  const userRegistrations = new Map<string, { isRegistered: boolean; hasPaid: boolean }>();
  // Per-session enrolments — remember the specific sessionDate rows so
  // the FE calendar can dot only the days the user actually paid for.
  const enrolledSessionsMap = new Map<string, string[]>();
  registrations.forEach((reg) => {
    const key = reg.workshopId.toString();
    userRegistrations.set(key, {
      isRegistered: true,
      hasPaid: reg.hasPaid,
    });
    if ((reg as any).enrollmentType === "session" && (reg as any).sessionDate) {
      if (!enrolledSessionsMap.has(key)) enrolledSessionsMap.set(key, []);
      enrolledSessionsMap.get(key)!.push(
        new Date((reg as any).sessionDate).toISOString()
      );
    }
  });

  await filterTrashedSessionDates(enrolledSessionsMap);

  // Get recent registration avatars for each workshop
  const recentRegistrations = await WorkshopRegistration.find({
    workshopId: { $in: workshopIds },
    status: { $ne: "cancelled" },
  })
    .sort({ registeredAt: -1 })
    .populate("userId", "name profilePicture")
    .lean();

  const avatarsMap = new Map<string, string[]>();
  recentRegistrations.forEach((reg: any) => {
    const wsId = reg.workshopId.toString();
    if (!avatarsMap.has(wsId)) {
      avatarsMap.set(wsId, []);
    }
    const currentList = avatarsMap.get(wsId)!;
    if (currentList.length < 8) {
      const user = reg.userId;
      if (user) {
        const avatarUrl = user.profilePicture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || "User")}`;
        currentList.push(avatarUrl);
      }
    }
  });

  // Get meeting statuses map
  const meetingIds = workshops.map((w) => w.meetingId).filter((id): id is string => !!id);
  const meetStatusesMap = await getMeetingStatusesMap(meetingIds);

  // Batch-fetch session overrides so the calendar view can honor
  // manualEndedAt for sessions the founder started + ended early. Only
  // pull rows where the sessions have real events (started or ended) —
  // trashed sessions are already filtered from enrolledSessions above.
  const overrideDocs = await WorkshopSessionOverride.find({
    workshopId: { $in: workshopIds },
    $or: [
      { manualStartedAt: { $ne: null } },
      { manualEndedAt: { $ne: null } },
      // Edited sessions come back too: the Enrolled calendar renders whatever
      // day the attendee picked, and that card has to show the session's own
      // title / description / time rather than the series template.
      { isEdited: true },
    ],
  }).lean();
  const manuallyEndedByWorkshop = new Map<string, string[]>();
  for (const o of overrideDocs as any[]) {
    if (!o.manualEndedAt) continue;
    const wsId = o.workshopId.toString();
    const iso = new Date(o.sessionDate).toISOString();
    if (!manuallyEndedByWorkshop.has(wsId)) manuallyEndedByWorkshop.set(wsId, []);
    manuallyEndedByWorkshop.get(wsId)!.push(iso);
  }

  /**
   * Per-session edits, keyed by workshop then by the session's UTC day.
   *
   * Only sessions that actually differ are sent — an unedited series ships an
   * empty list and the client keeps rendering the workshop's own fields, which
   * is what every stream created before this feature does.
   */
  const editsByWorkshop = new Map<string, any[]>();
  const workshopById = new Map(workshops.map((w: any) => [w._id.toString(), w]));
  for (const o of overrideDocs as any[]) {
    const wsId = o.workshopId.toString();
    const parent = workshopById.get(wsId);
    if (!parent || !hasSessionEdits(o)) continue;
    const effective = resolveEffectiveSession(parent, o.sessionDate, o);
    if (!editsByWorkshop.has(wsId)) editsByWorkshop.set(wsId, []);
    editsByWorkshop.get(wsId)!.push({
      // Canonical slot key — what the client matches its selected day against
      // and what every enrol / join link for this session carries.
      sessionDate: new Date(o.sessionDate).toISOString(),
      displayDate: effective.displayDate.toISOString(),
      isRescheduled: effective.isRescheduled,
      title: effective.title,
      description: effective.description,
      thumbnail: effective.thumbnail,
      startTime: effective.startTime,
      endTime: effective.endTime,
      timezone: effective.timezone,
      startDateTime: effective.startDateTime.toISOString(),
      endDateTime: effective.endDateTime.toISOString(),
      speakerName: effective.speakerName,
      speakerAvatar: effective.speakerAvatar,
      isFree: effective.isFree,
      price: effective.price,
    });
  }

  const enrichedWorkshops = workshops.map((workshop) => {
    // Add next session for recurring workshops
    let nextSession: WorkshopSession | null = null;
    if (workshop.isRecurring && workshop.isRecurrenceActive && workshop.recurrencePattern) {
      nextSession = getNextSession(
        workshop.recurrencePattern,
        workshop.recurrenceStartDate || workshop.date,
        workshop.startTime,
        workshop.endTime,
        workshop.timezone,
        workshop.recurrenceEndDate
      );
    }

    return {
      ...workshop,
      registeredParticipantsCount: countMap.get(workshop._id.toString()) || 0,
      isRegistered: userRegistrations.get(workshop._id.toString())?.isRegistered || false,
      hasPaid: userRegistrations.get(workshop._id.toString())?.hasPaid || false,
      enrolledSessions: enrolledSessionsMap.get(workshop._id.toString()) || undefined,
      // ISO datetimes of sessions where the founder pressed End. FE uses
      // these to flip the calendar cell to Completed even if the
      // scheduled window hasn't started yet (founder ran the session
      // early and closed it).
      manuallyEndedSessionDates:
        manuallyEndedByWorkshop.get(workshop._id.toString()) || undefined,
      // Per-session edits for this series, or undefined when it has none.
      sessionOverrides:
        editsByWorkshop.get(workshop._id.toString()) || undefined,
      nextSession,
      registeredParticipantAvatars: avatarsMap.get(workshop._id.toString()) || [],
      meetingStatus: workshop.meetingId ? (meetStatusesMap.get(workshop.meetingId.toString()) || "scheduled") : "scheduled",
    };
  });

  // The upcoming/past split already ran in selectWorkshopPage, so these rows
  // ARE the page and `total` is the size of the whole filtered set.
  return { workshops: enrichedWorkshops, total };
}

// ============= Registration Functions =============

/**
 * Register for a free workshop
 */
export async function registerForFreeWorkshop(
  userId: string,
  workshopId: string,
  orgId: string,
  // For per_session workshops: which specific session date the user is
  // enrolling for. Ignored (and forbidden — 400) for `once`-mode
  // workshops. Optional overall so legacy `once` callers don't need
  // updates. The dedupe key + row shape both depend on this.
  opts?: { sessionDate?: Date }
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  // Check if workshop exists and is free
  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  }).lean();

  if (!workshop) {
    return { success: false, message: "Workshop not found" };
  }

  if (!workshop.isFree) {
    return { success: false, message: "This workshop requires payment" };
  }

  // Mode dispatch — `once` writes ONE row per (user, workshop);
  // `per_session` writes one row per (user, workshop, sessionDate).
  const mode = (workshop as any).enrollmentType === "per_session"
    ? "per_session"
    : "once";
  const sessionDate = opts?.sessionDate;

  if (mode === "per_session") {
    if (!sessionDate) {
      return {
        success: false,
        message: "sessionDate is required for per-session workshops",
      };
    }
    // Session must be a real occurrence per the recurrence pattern —
    // block enrolling in dates that don't correspond to a session.
    const pattern = (workshop as any).recurrencePattern;
    const startAt =
      (workshop as any).recurrenceStartDate || (workshop as any).date;
    if (!pattern || !startAt) {
      return {
        success: false,
        message: "Workshop is not configured as recurring",
      };
    }
    if (
      !isValidSessionDate(
        sessionDate,
        pattern,
        new Date(startAt),
        (workshop as any).recurrenceEndDate
      )
    ) {
      return {
        success: false,
        message: "The requested date is not a valid session for this workshop",
      };
    }
  }

  // Check max participants (scoped to a session date for per-session
  // workshops — different sessions have their own capacity).
  if (workshop.maxParticipants) {
    const capacityFilter: Record<string, any> = {
      workshopId: new Types.ObjectId(workshopId),
      status: { $ne: "cancelled" },
    };
    if (mode === "per_session") capacityFilter.sessionDate = sessionDate;
    const currentCount = await WorkshopRegistration.countDocuments(
      capacityFilter
    );

    if (currentCount >= workshop.maxParticipants) {
      return { success: false, message: "Workshop is full" };
    }
  }

  // Dedupe against the correct key for the mode. `once` matches on
  // (user, workshop). `per_session` matches on (user, workshop, sessionDate).
  const dedupeFilter: Record<string, any> = {
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
  };
  if (mode === "per_session") {
    dedupeFilter.sessionDate = sessionDate;
    dedupeFilter.enrollmentType = "session";
  } else {
    // For once-mode: only look at "full" rows (legacy rows with unset
    // enrollmentType default to "full" per the schema default).
    dedupeFilter.$or = [
      { enrollmentType: "full" },
      { enrollmentType: { $exists: false } },
    ];
  }
  const existing = await WorkshopRegistration.findOne(dedupeFilter);

  if (existing) {
    if (existing.status === "cancelled") {
      // Reactivate registration — clear cancelledAt so the row reads
      // as a fresh enrolment.
      existing.status = "registered";
      existing.registeredAt = new Date();
      (existing as any).enrolledAt = new Date();
      (existing as any).cancelledAt = undefined;
      await existing.save();
      await mintFreeWorkshopInvoice(userId, workshop, orgId, mode, sessionDate);
      return { success: true, message: "Successfully registered for workshop" };
    }
    // Already registered. Reconcile the invoice anyway — this path ran
    // uninvoiced for a long time, so an existing registration very likely
    // predates the mint. The helper is idempotent, so nothing double-mints.
    await mintFreeWorkshopInvoice(userId, workshop, orgId, mode, sessionDate);
    return { success: true, message: "Already registered", alreadyRegistered: true };
  }

  // Create registration — enrollmentType + sessionDate per mode.
  await WorkshopRegistration.create({
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    status: "registered",
    hasPaid: true, // Free workshop
    registeredAt: new Date(),
    enrolledAt: new Date(),
    enrollmentType: mode === "per_session" ? "session" : "full",
    ...(mode === "per_session" ? { sessionDate } : {}),
  });

  // Registration is the source of truth and is written first — the $0 invoice
  // is best-effort and must never cost the user their seat.
  await mintFreeWorkshopInvoice(userId, workshop, orgId, mode, sessionDate);

  return { success: true, message: "Successfully registered for workshop" };
}

/**
 * $0 paper trail for a free workshop enrolment, matching what a free
 * `/checkout/workshop/:id` produces. Keeps `metadata.type: "workshop_checkout"`
 * so existing reports grouping on it pick these up unchanged.
 *
 * Per-session enrolments pass the session date as the dedupe key: one user
 * legitimately enrols in many sessions of the same workshop, and without it
 * only the first would ever mint.
 */
async function mintFreeWorkshopInvoice(
  userId: string,
  workshop: any,
  orgId: string,
  mode: "once" | "per_session",
  sessionDate?: Date,
): Promise<void> {
  // Backgrounded: bookkeeping must not add latency to someone registering for
  // a webinar, and can never fail the registration.
  const { mintFreeItemInvoiceInBackground } = await import("./freeInvoice");
  mintFreeItemInvoiceInBackground({
    userId,
    orgId,
    sellerId: String(workshop.createdBy),
    itemType: "workshop",
    itemId: String(workshop._id),
    itemName: workshop.title,
    itemDescription: workshop.description,
    itemImage: workshop.thumbnail,
    currency: workshop.currency,
    metadataType: "workshop_checkout",
    source: "register",
    // Deliberate registration. Per-session workshops carry a dedupeKey, so
    // each session the viewer signs up for is a separate invoice and earns its
    // own confirmation.
    notifyBuyer: true,
    dedupeKey:
      mode === "per_session" && sessionDate
        ? new Date(sessionDate).toISOString().slice(0, 10)
        : undefined,
    extraMetadata:
      mode === "per_session" && sessionDate
        ? { sessionDate: new Date(sessionDate).toISOString() }
        : undefined,
  });
}

/**
 * Register for a paid workshop (after payment verification)
 * NOTE: Wallet crediting is now handled by distributeCommissions() in the route
 * This function only handles registration logic
 */
export async function registerForPaidWorkshop(
  userId: string,
  workshopId: string,
  orgId: string,
  paymentDetails: {
    paymentId: string;
    orderId: string;
    amount: number;
    currency?: string;
    // Per-session enrolments carry the specific session date the buyer
    // paid for. Ignored for `once`-mode workshops. Callers reading
    // sessionDate off invoice metadata should pass it in here.
    sessionDate?: Date;
  }
): Promise<{ success: boolean; message: string }> {
  // Check if workshop exists — pull the recurrence fields too so we can
  // dispatch on enrollmentType + validate the session date.
  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
  })
    .select(
      "title maxParticipants isFree enrollmentType recurrencePattern recurrenceStartDate recurrenceEndDate date"
    )
    .lean();

  if (!workshop) {
    return { success: false, message: "Workshop not found" };
  }

  const mode = (workshop as any).enrollmentType === "per_session"
    ? "per_session"
    : "once";
  const sessionDate = paymentDetails.sessionDate;

  if (mode === "per_session") {
    if (!sessionDate) {
      return {
        success: false,
        message: "sessionDate is required for per-session workshops",
      };
    }
    const pattern = (workshop as any).recurrencePattern;
    const startAt =
      (workshop as any).recurrenceStartDate || (workshop as any).date;
    if (!pattern || !startAt) {
      return {
        success: false,
        message: "Workshop is not configured as recurring",
      };
    }
    if (
      !isValidSessionDate(
        sessionDate,
        pattern,
        new Date(startAt),
        (workshop as any).recurrenceEndDate
      )
    ) {
      return {
        success: false,
        message: "The requested date is not a valid session for this workshop",
      };
    }
  }

  // Max participants — scope to sessionDate for per-session workshops
  // so each session's cap is independent.
  if (workshop.maxParticipants) {
    const capacityFilter: Record<string, any> = {
      workshopId: new Types.ObjectId(workshopId),
      status: { $ne: "cancelled" },
    };
    if (mode === "per_session") capacityFilter.sessionDate = sessionDate;
    const currentCount = await WorkshopRegistration.countDocuments(
      capacityFilter
    );

    if (currentCount >= workshop.maxParticipants) {
      return { success: false, message: "Workshop is full" };
    }
  }

  // Dedupe on the mode-correct key.
  const dedupeFilter: Record<string, any> = {
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
  };
  if (mode === "per_session") {
    dedupeFilter.sessionDate = sessionDate;
    dedupeFilter.enrollmentType = "session";
  } else {
    dedupeFilter.$or = [
      { enrollmentType: "full" },
      { enrollmentType: { $exists: false } },
    ];
  }
  const existing = await WorkshopRegistration.findOne(dedupeFilter);

  if (existing && existing.status !== "cancelled") {
    return { success: false, message: "Already registered for this workshop" };
  }

  // Create or reactivate registration — stamp mode + sessionDate.
  if (existing) {
    existing.status = "registered";
    existing.hasPaid = true;
    existing.paymentId = paymentDetails.paymentId;
    existing.orderId = paymentDetails.orderId;
    existing.amountPaid = paymentDetails.amount;
    existing.currency = paymentDetails.currency || "USD";
    existing.registeredAt = new Date();
    (existing as any).enrolledAt = new Date();
    (existing as any).cancelledAt = undefined;
    // Ensure enrollmentType matches the current workshop mode — legacy
    // rows created before the toggle worked might have "full" even on
    // per_session workshops. Backfill correctly on reactivation.
    (existing as any).enrollmentType =
      mode === "per_session" ? "session" : "full";
    if (mode === "per_session") {
      (existing as any).sessionDate = sessionDate;
    }
    await existing.save();
  } else {
    await WorkshopRegistration.create({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: "registered",
      hasPaid: true,
      paymentId: paymentDetails.paymentId,
      orderId: paymentDetails.orderId,
      amountPaid: paymentDetails.amount,
      currency: paymentDetails.currency || "USD",
      registeredAt: new Date(),
      enrolledAt: new Date(),
      enrollmentType: mode === "per_session" ? "session" : "full",
      ...(mode === "per_session" ? { sessionDate } : {}),
    });
  }

  return { success: true, message: "Successfully registered for workshop" };
}

/**
 * Get workshop registrations (for founders)
 */
export async function getWorkshopRegistrations(
  workshopId: string,
  orgId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ registrations: any[]; total: number }> {
  const { limit = 50, offset = 0 } = options;

  const filter = {
    workshopId: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    status: { $ne: "cancelled" },
  };

  const [registrations, total] = await Promise.all([
    WorkshopRegistration.find(filter)
      .populate("userId", "name email profilePicture")
      .sort({ registeredAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    WorkshopRegistration.countDocuments(filter),
  ]);

  return { registrations, total };
}

/**
 * Cancel a `full`-mode (enrol-once) registration. One user × workshop
 * row exists in this mode — this flips it to `cancelled` and stamps
 * `cancelledAt`. Idempotent: already-cancelled returns success without
 * a second event emission.
 *
 * For per-session workshops use `cancelSessionEnrollment` instead —
 * that's mode-scoped and takes a `sessionDate`.
 *
 * No billing side-effect: workshops are always one-time paid per your
 * config, so there's no recurring invoice chain to stop. LTV snapshot
 * + Unsub Log emission is best-effort inside the caller.
 */
export async function cancelFullEnrollment(
  userId: string,
  workshopId: string
): Promise<{
  success: boolean;
  message: string;
  status: "cancelled_immediately" | "already_cancelled" | "not_registered";
  cancelledAt: Date | null;
  registration: any | null;
}> {
  const now = new Date();
  const filter = {
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    // Match "full" rows only. Legacy rows with unset enrollmentType
    // default to "full" per the schema default, so accept both shapes.
    $or: [
      { enrollmentType: "full" },
      { enrollmentType: { $exists: false } },
    ],
  };
  const registration = await WorkshopRegistration.findOne(filter);
  if (!registration) {
    return {
      success: true,
      message: "Not registered for this workshop",
      status: "not_registered",
      cancelledAt: null,
      registration: null,
    };
  }
  if (registration.status === "cancelled") {
    return {
      success: true,
      message: "Registration was already cancelled",
      status: "already_cancelled",
      cancelledAt: (registration as any).cancelledAt || null,
      registration,
    };
  }
  registration.status = "cancelled";
  (registration as any).cancelledAt = now;
  await registration.save();
  return {
    success: true,
    message: "Registration cancelled. You'll lose access to every future session.",
    status: "cancelled_immediately",
    cancelledAt: now,
    registration,
  };
}

/**
 * Cancel ONE session's enrolment on a per-session workshop. Multiple
 * rows exist per (user, workshop) — one per enrolled `sessionDate`.
 * This flips exactly the row matching the passed sessionDate; other
 * sessions the user enrolled in are unaffected.
 *
 * Idempotent. Returns `not_registered` if the user never enrolled for
 * that specific session — the FE can present a friendly "you weren't
 * signed up for that one" message.
 */
export async function cancelSessionEnrollment(
  userId: string,
  workshopId: string,
  sessionDate: Date
): Promise<{
  success: boolean;
  message: string;
  status: "cancelled_immediately" | "already_cancelled" | "not_registered";
  cancelledAt: Date | null;
  sessionDate: Date;
  registration: any | null;
}> {
  const now = new Date();
  const filter = {
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    enrollmentType: "session" as const,
    sessionDate,
  };
  const registration = await WorkshopRegistration.findOne(filter);
  if (!registration) {
    return {
      success: true,
      message: "You weren't enrolled for this session",
      status: "not_registered",
      cancelledAt: null,
      sessionDate,
      registration: null,
    };
  }
  if (registration.status === "cancelled") {
    return {
      success: true,
      message: "This session enrolment was already cancelled",
      status: "already_cancelled",
      cancelledAt: (registration as any).cancelledAt || null,
      sessionDate,
      registration,
    };
  }
  registration.status = "cancelled";
  (registration as any).cancelledAt = now;
  await registration.save();
  return {
    success: true,
    message: "Session enrolment cancelled. Other sessions you enrolled in are unaffected.",
    status: "cancelled_immediately",
    cancelledAt: now,
    sessionDate,
    registration,
  };
}

/**
 * Legacy wrapper — kept as a thin proxy over `cancelFullEnrollment`
 * so pre-existing callers (mostly older admin-side code paths) don't
 * break. New code should call `cancelFullEnrollment` /
 * `cancelSessionEnrollment` directly and dispatch on the workshop's
 * enrollmentType at the route layer.
 */
export async function cancelRegistration(
  userId: string,
  workshopId: string
): Promise<boolean> {
  const result = await cancelFullEnrollment(userId, workshopId);
  return result.status === "cancelled_immediately";
}

// ============= Recurring Workshop Functions =============

/**
 * Get sessions for a recurring workshop
 */
export async function getWorkshopSessions(
  workshopId: string,
  userId: string,
  options: { limit?: number; includePast?: boolean } = {}
): Promise<{
  sessions: (WorkshopSession & {
    registeredCount: number;
    hasAccess: boolean;
    isFull: boolean;
  })[];
  workshop: any;
} | null> {
  const { limit = 10, includePast = false } = options;

  const workshop = await Workshop.findById(workshopId).lean();
  if (!workshop || !workshop.isRecurring || !workshop.recurrencePattern) {
    return null;
  }

  const sessions = calculateSessions(
    workshop.recurrencePattern,
    workshop.recurrenceStartDate || workshop.date,
    workshop.startTime,
    workshop.endTime,
    new Date(),
    limit,
    includePast,
    workshop.timezone,
    workshop.recurrenceEndDate
  );

  // One read for the whole series; sessions without a document fall back to
  // the workshop template, which is every session of every stream created
  // before per-session editing shipped.
  const overrideByDay = indexOverridesByDay(
    (await WorkshopSessionOverride.find({
      workshopId: new Types.ObjectId(workshopId),
    }).lean()) as any[]
  );

  // Enrich sessions with registration info
  const enrichedSessions = await Promise.all(
    sessions.map(async (session) => {
      // Count registrations for this session
      let regCount: number;
      if (workshop.enrollmentType === "per_session") {
        // For per-session: count session-specific + grandfathered
        regCount = await WorkshopRegistration.countDocuments({
          workshopId: new Types.ObjectId(workshopId),
          status: { $ne: "cancelled" },
          $or: [
            { grandfathered: true },
            {
              enrollmentType: "session",
              sessionDate: {
                $gte: startOfDay(session.date),
                $lt: endOfDay(session.date),
              },
            },
          ],
        });
      } else {
        // For enroll-once: count all full enrollments
        regCount = await WorkshopRegistration.countDocuments({
          workshopId: new Types.ObjectId(workshopId),
          enrollmentType: "full",
          status: { $ne: "cancelled" },
        });
      }

      const { hasAccess } = await hasSessionAccess(userId, workshopId, session.date);

      const override =
        overrideByDay.get(sessionDayKey(session.date).toISOString()) || null;
      const effective = resolveEffectiveSession(
        workshop as any,
        session.date,
        override as any,
        {
          startDateTime: session.startDateTime,
          endDateTime: session.endDateTime,
        }
      );

      return {
        ...session,
        // `date` stays the canonical slot key — it is what every register /
        // order / access call sends back. The edited values ride alongside it.
        startDateTime: effective.startDateTime,
        endDateTime: effective.endDateTime,
        title: effective.title,
        description: effective.description,
        thumbnail: effective.thumbnail,
        startTime: effective.startTime,
        endTime: effective.endTime,
        timezone: effective.timezone,
        isFree: effective.isFree,
        price: effective.price,
        currency: effective.currency,
        speakerName: effective.speakerName,
        speakerBio: effective.speakerBio,
        speakerAvatar: effective.speakerAvatar,
        agenda: effective.agenda,
        rescheduledDate: effective.isRescheduled
          ? effective.displayDate
          : undefined,
        isEdited: effective.isEdited,
        isDeleted: isSessionDeleted(override as any),
        registeredCount: regCount,
        hasAccess,
        isFull: workshop.maxParticipants ? regCount >= workshop.maxParticipants : false,
      };
    })
  );

  return {
    sessions: enrichedSessions,
    workshop: {
      _id: workshop._id,
      title: workshop.title,
      enrollmentType: workshop.enrollmentType,
      meetingUrl: workshop.meetingUrl,
      isFree: workshop.isFree,
      price: workshop.price,
    },
  };
}

/**
 * Check if user has access to a specific session
 */
export async function hasSessionAccess(
  userId: string,
  workshopId: string,
  sessionDate: Date
): Promise<{ hasAccess: boolean; registration?: IWorkshopRegistration }> {
  const workshop = await Workshop.findById(workshopId).lean();
  if (!workshop) return { hasAccess: false };

  // For non-recurring workshops, check existing registration
  if (!workshop.isRecurring) {
    const reg = await WorkshopRegistration.findOne({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      status: { $ne: "cancelled" },
    }).lean();
    return { hasAccess: !!reg && reg.hasPaid, registration: reg || undefined };
  }

  // For recurring workshops with "enroll once"
  if (workshop.enrollmentType === "once") {
    // Check for full enrollment
    const fullEnrollment = await WorkshopRegistration.findOne({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      enrollmentType: "full",
      status: { $ne: "cancelled" },
      hasPaid: true,
    }).lean();

    if (fullEnrollment) {
      // User has access if session is on or after their enrollment date
      const enrolledAt = fullEnrollment.enrolledAt || fullEnrollment.registeredAt;
      if (sessionDate >= startOfDay(enrolledAt)) {
        return { hasAccess: true, registration: fullEnrollment };
      }
    }
  }

  // Check for grandfathered access (applies to both enrollment types)
  const grandfathered = await WorkshopRegistration.findOne({
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    grandfathered: true,
    status: { $ne: "cancelled" },
    hasPaid: true,
  }).lean();

  if (grandfathered) {
    return { hasAccess: true, registration: grandfathered };
  }

  // For per-session enrollment, check specific session
  if (workshop.enrollmentType === "per_session") {
    const sessionReg = await WorkshopRegistration.findOne({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      enrollmentType: "session",
      sessionDate: {
        $gte: startOfDay(sessionDate),
        $lt: endOfDay(sessionDate),
      },
      status: { $ne: "cancelled" },
      hasPaid: true,
    }).lean();

    return { hasAccess: !!sessionReg, registration: sessionReg || undefined };
  }

  return { hasAccess: false };
}

/**
 * Register for a recurring workshop (full enrollment - "enroll once")
 */
export async function registerForRecurringWorkshopFull(
  userId: string,
  workshopId: string,
  orgId: string,
  paymentDetails?: {
    paymentId: string;
    orderId: string;
    amount: number;
    currency?: string;
  }
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
    isRecurring: true,
  }).lean();

  if (!workshop) {
    return { success: false, message: "Recurring workshop not found" };
  }

  if (workshop.enrollmentType !== "once") {
    return { success: false, message: "This workshop requires per-session registration" };
  }

  // Check max participants (total unique full enrollments)
  if (workshop.maxParticipants) {
    const currentCount = await WorkshopRegistration.countDocuments({
      workshopId: new Types.ObjectId(workshopId),
      enrollmentType: "full",
      status: { $ne: "cancelled" },
    });

    if (currentCount >= workshop.maxParticipants) {
      return { success: false, message: "Workshop is full" };
    }
  }

  // Check for existing full enrollment
  const existing = await WorkshopRegistration.findOne({
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    enrollmentType: "full",
  });

  if (existing && existing.status !== "cancelled") {
    return { success: true, message: "Already registered", alreadyRegistered: true };
  }

  const now = new Date();

  if (existing) {
    // Reactivate cancelled registration
    existing.status = "registered";
    existing.registeredAt = now;
    existing.enrolledAt = now;
    existing.hasPaid = workshop.isFree || !!paymentDetails;
    if (paymentDetails) {
      existing.paymentId = paymentDetails.paymentId;
      existing.orderId = paymentDetails.orderId;
      existing.amountPaid = paymentDetails.amount;
    }
    await existing.save();
  } else {
    await WorkshopRegistration.create({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: "registered",
      hasPaid: workshop.isFree || !!paymentDetails,
      enrollmentType: "full",
      enrolledAt: now,
      registeredAt: now,
      ...(paymentDetails && {
        paymentId: paymentDetails.paymentId,
        orderId: paymentDetails.orderId,
        amountPaid: paymentDetails.amount,
        currency: paymentDetails.currency || "USD",
      }),
    });
  }

  return { success: true, message: "Successfully registered for all sessions" };
}

/**
 * Register for a specific session of a recurring workshop (per-session enrollment)
 */
export async function registerForRecurringWorkshopSession(
  userId: string,
  workshopId: string,
  orgId: string,
  sessionDate: Date,
  paymentDetails?: {
    paymentId: string;
    orderId: string;
    amount: number;
    currency?: string;
  }
): Promise<{ success: boolean; message: string; alreadyRegistered?: boolean }> {
  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    isActive: true,
    isRecurring: true,
  }).lean();

  if (!workshop) {
    return { success: false, message: "Recurring workshop not found" };
  }

  if (!workshop.recurrencePattern) {
    return { success: false, message: "Invalid recurrence pattern" };
  }

  if (workshop.enrollmentType !== "per_session") {
    return { success: false, message: "This workshop uses full enrollment" };
  }

  // Validate session date — pass recurrenceEndDate so the helper rejects
  // anything past the per_session bound.
  if (
    !isValidSessionDate(
      sessionDate,
      workshop.recurrencePattern,
      workshop.recurrenceStartDate || workshop.date,
      workshop.recurrenceEndDate
    )
  ) {
    return { success: false, message: "Invalid session date" };
  }

  // Check if session is in the past
  if (endOfDay(sessionDate) < new Date()) {
    return { success: false, message: "Cannot register for past sessions" };
  }

  // Check max participants for this session
  if (workshop.maxParticipants) {
    const sessionStart = startOfDay(sessionDate);
    const sessionEnd = endOfDay(sessionDate);

    const currentCount = await WorkshopRegistration.countDocuments({
      workshopId: new Types.ObjectId(workshopId),
      status: { $ne: "cancelled" },
      $or: [
        { grandfathered: true },
        {
          enrollmentType: "session",
          sessionDate: { $gte: sessionStart, $lt: sessionEnd },
        },
      ],
    });

    if (currentCount >= workshop.maxParticipants) {
      return { success: false, message: "This session is full" };
    }
  }

  // This session's own pricing, which may differ from the series in
  // per_session mode. Everything below that says "free" means free FOR THIS
  // SESSION — registering without payment for a session the founder priced
  // separately would hand out paid access.
  const sessionOverride = await WorkshopSessionOverride.findOne({
    workshopId: new Types.ObjectId(workshopId),
    sessionDate: sessionDayKey(sessionDate),
  }).lean();

  // A trashed session can't be signed up for — but only on the way IN. If
  // `paymentDetails` is set the buyer has already been charged (this is the
  // verify-payment leg), and refusing here would leave them paid-for and
  // unregistered. The founder trashing a session mid-checkout is their call to
  // unwind with a refund; swallowing the money is not.
  if (!paymentDetails && isSessionDeleted(sessionOverride as any)) {
    return { success: false, message: "This session has been cancelled" };
  }

  const pricing = resolveSessionPricing(workshop, sessionOverride as any);

  if (!pricing.isFree && !paymentDetails) {
    return {
      success: false,
      message: "This session is paid — complete checkout to register",
    };
  }

  // Check for grandfathered access
  const grandfathered = await WorkshopRegistration.findOne({
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    grandfathered: true,
    status: { $ne: "cancelled" },
  });

  if (grandfathered) {
    return { success: true, message: "You have access to all sessions", alreadyRegistered: true };
  }

  // Check for existing session registration
  const sessionStart = startOfDay(sessionDate);
  const sessionEnd = endOfDay(sessionDate);

  const existing = await WorkshopRegistration.findOne({
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    enrollmentType: "session",
    sessionDate: { $gte: sessionStart, $lt: sessionEnd },
  });

  if (existing && existing.status !== "cancelled") {
    return { success: true, message: "Already registered for this session", alreadyRegistered: true };
  }

  const now = new Date();

  if (existing) {
    // Reactivate cancelled registration
    existing.status = "registered";
    existing.registeredAt = now;
    existing.enrolledAt = now;
    existing.hasPaid = pricing.isFree || !!paymentDetails;
    if (paymentDetails) {
      existing.paymentId = paymentDetails.paymentId;
      existing.orderId = paymentDetails.orderId;
      existing.amountPaid = paymentDetails.amount;
    }
    await existing.save();
  } else {
    await WorkshopRegistration.create({
      workshopId: new Types.ObjectId(workshopId),
      userId: new Types.ObjectId(userId),
      orgId: new Types.ObjectId(orgId),
      status: "registered",
      hasPaid: pricing.isFree || !!paymentDetails,
      enrollmentType: "session",
      sessionDate: sessionStart,
      enrolledAt: now,
      registeredAt: now,
      ...(paymentDetails && {
        paymentId: paymentDetails.paymentId,
        orderId: paymentDetails.orderId,
        amountPaid: paymentDetails.amount,
        currency: paymentDetails.currency || "USD",
      }),
    });
  }

  return { success: true, message: "Successfully registered for session" };
}

// ============= Analytics Functions =============

export interface WorkshopAnalytics {
  workshopId: string;
  workshopTitle: string;
  workshopDate: Date;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  // Enrollment stats
  totalEnrollments: number;
  enrolledBeforeStart: number;
  enrolledAfterStart: number;
  cancelledEnrollments: number;
  // Attendance stats
  totalAttended: number;
  noShows: number; // enrolled but didn't attend
  attendanceRate: number; // percentage
  // Revenue (for paid workshops)
  totalRevenue: number;
  currency: string;
  // Participants list with timing
  participants: {
    userId: string;
    name: string;
    email: string;
    profilePicture?: string;
    registeredAt: Date;
    enrolledBeforeStart: boolean;
    attended: boolean;
    attendedAt?: Date;
    joinedMeetingAt?: Date;
    leftMeetingAt?: Date;
    durationInMeeting?: number; // in minutes
    hasPaid: boolean;
    amountPaid?: number;
  }[];
}

export interface SessionAnalytics extends WorkshopAnalytics {
  sessionDate: Date;
  // 1-indexed session number within the workshop's bounded range.
  // Stable across pages: page 2 starting at offset 5 → sessionNumber 6.
  sessionNumber: number;
  // Time-derived status of the session at read time.
  status: "completed" | "live" | "not_started";
  // Total percentage from the workshop's active CombPlan (0 if none).
  affiliateCommissionPercent: number;
  // Dollars paid out to affiliates specifically for this session.
  // Undefined for enrol-once mode (revenue isn't split per session; FE
  // renders "—"). Populated for per_session — sums CommissionDistribution
  // rows whose metadata.sessionDate matches this session.
  affiliateCommissionPaidUsd?: number;
  // When the founder actually ran the session (WorkshopSessionOverride
  // stamps, the same ones the status above is derived from). Undefined
  // until they hit Start / Stop. Clients show these as the session's
  // "Actual" date & time next to the scheduled one.
  manualStartedAt?: Date;
  manualEndedAt?: Date;
  // Unique Garage TV / preview-card watchers of this session, counted from
  // the LiveKit "audience-*" identities the participant_joined webhook
  // collects on the session override.
  garageTvViewers?: number;
  // Products sold from this session. `products` counts what the host put on
  // screen (WebinarProductPin); the rest comes from orders whose lines were
  // attributed to the session and verified at fulfillment.
  liveSelling?: {
    products: number;
    customers: number;
    orders: number;
    revenue: number;
    commission: number;
  };
}

/**
 * Get comprehensive analytics for a workshop (founder only)
 */
export async function getWorkshopAnalytics(
  workshopId: string,
  orgId: string,
  sessionDate?: Date
): Promise<WorkshopAnalytics | null> {
  const { MeetParticipant } = await import("../models/meetParticipant.model");
  const { Meet } = await import("../models/meet.model");

  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
  }).lean();

  if (!workshop) return null;

  // Determine the effective workshop date/time for comparison
  let workshopStartDateTime: Date;
  let effectiveDate = workshop.date;

  if (sessionDate && workshop.isRecurring) {
    effectiveDate = sessionDate;
  }

  // Combine date with startTime to get exact start datetime
  const dateObj = new Date(effectiveDate);
  const [hours, minutes] = (workshop.startTime || "00:00").split(":").map(Number);
  workshopStartDateTime = new Date(
    dateObj.getUTCFullYear(),
    dateObj.getUTCMonth(),
    dateObj.getUTCDate(),
    hours,
    minutes
  );

  // Build registration filter
  const regFilter: any = {
    workshopId: new Types.ObjectId(workshopId),
  };

  // For recurring workshops with per-session enrollment, filter by session date
  if (workshop.isRecurring && workshop.enrollmentType === "per_session" && sessionDate) {
    regFilter.$or = [
      { grandfathered: true },
      {
        enrollmentType: "session",
        sessionDate: {
          $gte: startOfDay(sessionDate),
          $lt: endOfDay(sessionDate),
        },
      },
    ];
  }

  // Get all registrations
  const registrations = await WorkshopRegistration.find(regFilter)
    .populate("userId", "name email profilePicture")
    .lean();

  // Get meeting data if workshop has a meeting linked
  let meetParticipants: any[] = [];
  if (workshop.meetingId) {
    meetParticipants = await MeetParticipant.find({
      meetId: new Types.ObjectId(workshop.meetingId),
    }).lean();
  }

  // Create email -> participant map for quick lookup
  const participantByEmail = new Map<string, any>();
  meetParticipants.forEach((p) => {
    const existing = participantByEmail.get(p.email);
    // Keep the earliest join time if multiple entries
    if (!existing || p.joinedAt < existing.joinedAt) {
      participantByEmail.set(p.email, p);
    }
  });

  // Calculate stats
  let totalEnrollments = 0;
  let enrolledBeforeStart = 0;
  let enrolledAfterStart = 0;
  let cancelledEnrollments = 0;
  let totalAttended = 0;
  let totalRevenue = 0;

  const participants: WorkshopAnalytics["participants"] = [];

  for (const reg of registrations) {
    const user = reg.userId as any;
    if (!user || !user.email) continue;

    if (reg.status === "cancelled") {
      cancelledEnrollments++;
      continue;
    }

    totalEnrollments++;

    const registeredAt = reg.registeredAt || reg.createdAt;
    const isEnrolledBeforeStart = registeredAt < workshopStartDateTime;

    if (isEnrolledBeforeStart) {
      enrolledBeforeStart++;
    } else {
      enrolledAfterStart++;
    }

    // Check meeting attendance
    const meetAttendance = participantByEmail.get(user.email.toLowerCase());
    const attended = reg.status === "attended" || !!meetAttendance;

    if (attended) {
      totalAttended++;
    }

    // Calculate duration in meeting
    let durationInMeeting: number | undefined;
    if (meetAttendance && meetAttendance.joinedAt) {
      const joinTime = new Date(meetAttendance.joinedAt);
      const leaveTime = meetAttendance.leftAt
        ? new Date(meetAttendance.leftAt)
        : new Date(); // Still in meeting
      durationInMeeting = Math.round((leaveTime.getTime() - joinTime.getTime()) / 60000);
    }

    // Revenue
    if (reg.hasPaid && reg.amountPaid) {
      totalRevenue += reg.amountPaid;
    }

    participants.push({
      userId: (reg.userId as any)._id?.toString() || reg.userId.toString(),
      name: user.name || "Unknown",
      email: user.email,
      profilePicture: user.profilePicture,
      registeredAt,
      enrolledBeforeStart: isEnrolledBeforeStart,
      attended,
      attendedAt: reg.attendedAt,
      joinedMeetingAt: meetAttendance?.joinedAt,
      leftMeetingAt: meetAttendance?.leftAt,
      durationInMeeting,
      hasPaid: reg.hasPaid,
      amountPaid: reg.amountPaid,
    });
  }

  const noShows = totalEnrollments - totalAttended;
  const attendanceRate = totalEnrollments > 0 ? Math.round((totalAttended / totalEnrollments) * 100) : 0;

  return {
    workshopId,
    workshopTitle: workshop.title,
    workshopDate: effectiveDate,
    startTime: workshop.startTime,
    endTime: workshop.endTime,
    isRecurring: workshop.isRecurring || false,
    totalEnrollments,
    enrolledBeforeStart,
    enrolledAfterStart,
    cancelledEnrollments,
    totalAttended,
    noShows,
    attendanceRate,
    totalRevenue,
    currency: workshop.currency || "USD",
    participants,
  };
}

/**
 * Get analytics for all sessions of a recurring workshop
 */
export async function getRecurringWorkshopAnalytics(
  workshopId: string,
  orgId: string,
  options: { limit?: number; offset?: number; includePast?: boolean } = {}
): Promise<{
  workshop: any;
  sessions: SessionAnalytics[];
  aggregated: {
    totalSessions: number;
    totalEnrollments: number;
    totalAttended: number;
    averageAttendanceRate: number;
    totalRevenue: number;
  };
} | null> {
  const { limit = 10, offset = 0, includePast = true } = options;

  const workshop = await Workshop.findOne({
    _id: new Types.ObjectId(workshopId),
    orgId: new Types.ObjectId(orgId),
    isRecurring: true,
  }).lean();

  if (!workshop || !workshop.recurrencePattern) return null;

  // Compute the FULL bounded session list first (limit=500 safety cap),
  // then slice for pagination. calculateSessions caps by
  // recurrenceEndDate, so this is naturally bounded for per_session +
  // enrol-once workshops.
  const allSessions = calculateSessions(
    workshop.recurrencePattern,
    workshop.recurrenceStartDate || workshop.date,
    workshop.startTime,
    workshop.endTime,
    new Date(),
    500,
    includePast,
    workshop.timezone,
    workshop.recurrenceEndDate
  );
  const totalSessionsCount = allSessions.length;
  const sessions = allSessions.slice(offset, offset + limit);
  // Zero-based index-within-page → 1-indexed session number across the
  // whole workshop (page 2, offset=5 → sessionNumber starts at 6).
  const sessionNumberBase = offset + 1;

  // Get all registrations once
  const allRegistrations = await WorkshopRegistration.find({
    workshopId: new Types.ObjectId(workshopId),
  })
    .populate("userId", "name email profilePicture")
    .lean();

  // Get meeting data once
  let meetParticipants: any[] = [];
  if (workshop.meetingId) {
    const { MeetParticipant } = await import("../models/meetParticipant.model");
    meetParticipants = await MeetParticipant.find({
      meetId: new Types.ObjectId(workshop.meetingId),
    }).lean();
  }

  // Batch — commission plan (%) + per-session commission $ paid. Reads
  // once, indexes by sessionDate (YYYY-MM-DD) for O(1) lookup below.
  const { CombPlan } = await import("../models/combPlan.model");
  const { CommissionDistribution } = await import(
    "../models/commissionDistribution.model"
  );
  const [combPlan, sessionCommissionAgg] = await Promise.all([
    CombPlan.findOne({
      itemType: "workshop",
      itemId: new Types.ObjectId(workshopId),
      isActive: true,
    })
      .select("totalPercentage")
      .lean(),
    // Group commissions by their metadata.sessionDate string (YYYY-MM-DD
    // is what the routes stamp).
    CommissionDistribution.aggregate([
      {
        $match: {
          itemType: "workshop",
          itemId: new Types.ObjectId(workshopId),
          status: "completed",
          "metadata.sessionDate": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$metadata.sessionDate",
          total: { $sum: "$totalCommissionAmount" },
        },
      },
    ]),
  ]);
  const commissionPercent = combPlan?.totalPercentage || 0;
  const perSessionCommissionMap = new Map<string, number>();
  sessionCommissionAgg.forEach((r: any) => {
    perSessionCommissionMap.set(String(r._id), r.total || 0);
  });

  // ── Live selling ────────────────────────────────────────────────────────
  // Two reads, both indexed by the session's YYYY-MM-DD key:
  //   • what the host pinned during each session (products count)
  //   • the orders those pins produced (customers / orders / revenue), taken
  //     from productorders.metadata.liveSales, which fulfillment only writes
  //     after checking the claim against the pins.
  const { WebinarProductPin } = await import("../models/webinarProductPin.model");
  const pinRows = await WebinarProductPin.find({
    workshopId: new Types.ObjectId(workshopId),
  })
    .select("sessionDate itemId")
    .lean();

  // Pins gate everything downstream — fulfillment only stamps liveSales after
  // matching a pin, so a workshop with no pins can have no attributed orders.
  // Skipping the order/commission reads here keeps the common no-live-selling
  // case at one cheap indexed query, and the org scoping below keeps the
  // metadata matches on the organizationId/orgId indexes instead of scanning.
  let liveOrders: any[] = [];
  if (pinRows.length) {
    const { ProductOrder } = await import("../models/productOrder.model");
    liveOrders = await ProductOrder.find({
      organizationId: new Types.ObjectId(orgId),
      status: { $nin: ["cancelled", "refunded", "failed"] },
      "metadata.liveSelling": true,
      "metadata.liveSales.workshopId": workshopId,
    })
      .select("userId total currency metadata")
      .lean();
  }

  const pinnedByDay = new Map<string, Set<string>>();
  for (const p of pinRows as any[]) {
    const key = sessionDayKey(p.sessionDate).toISOString().slice(0, 10);
    if (!pinnedByDay.has(key)) pinnedByDay.set(key, new Set());
    pinnedByDay.get(key)!.add(String(p.itemId));
  }

  const liveSellingByDay = new Map<
    string,
    { orders: number; revenue: number; buyers: Set<string> }
  >();
  for (const o of liveOrders as any[]) {
    // An order can only be counted once per session, even if several of its
    // lines were pinned in that same session.
    const days = new Set<string>(
      (o.metadata?.liveSales || [])
        .filter((l: any) => String(l.workshopId) === String(workshopId))
        .map((l: any) => String(l.sessionDate))
    );
    for (const day of days) {
      if (!liveSellingByDay.has(day)) {
        liveSellingByDay.set(day, { orders: 0, revenue: 0, buyers: new Set() });
      }
      const bucket = liveSellingByDay.get(day)!;
      bucket.orders += 1;
      bucket.revenue += o.total || 0;
      if (o.userId) bucket.buyers.add(String(o.userId));
    }
  }

  // Affiliate commission paid on those product sales, per session day.
  const liveCommissionByDay = new Map<string, number>();
  if (pinRows.length) {
    const liveCommissionAgg = await CommissionDistribution.aggregate([
      {
        $match: {
          orgId: new Types.ObjectId(orgId),
          itemType: "product",
          status: "completed",
          "metadata.liveWorkshopId": String(workshopId),
          "metadata.liveSessionDate": { $exists: true },
        },
      },
      {
        $group: {
          _id: "$metadata.liveSessionDate",
          total: { $sum: "$totalCommissionAmount" },
        },
      },
    ]);
    liveCommissionAgg.forEach((r: any) =>
      liveCommissionByDay.set(String(r._id), r.total || 0)
    );
  }

  const nowForStatus = new Date();

  // Load per-session overrides once; used for status derivation and to
  // hide trashed sessions from the accordion (they show up in Trash).
  const sessionOverrides = await WorkshopSessionOverride.find({
    workshopId: new Types.ObjectId(workshopId),
  }).lean();
  const overrideByKey = new Map<string, any>();
  for (const o of sessionOverrides as any[]) {
    overrideByKey.set(sessionDayKey(o.sessionDate).toISOString(), o);
  }

  const sessionAnalytics: SessionAnalytics[] = [];
  let aggEnrollments = 0;
  let aggAttended = 0;
  let aggRevenue = 0;

  for (const session of sessions) {
    // Skip trashed sessions — they belong on the Trash page, not the
    // founder's session accordion.
    const overrideKey = sessionDayKey(session.date).toISOString();
    const override = overrideByKey.get(overrideKey);
    if (isSessionDeleted(override)) {
      continue;
    }

    // Filter registrations for this session date if per-session enrollment is active
    let registrations = allRegistrations;
    if (workshop.enrollmentType === "per_session") {
      const sDayStart = startOfDay(session.date);
      const sDayEnd = endOfDay(session.date);
      registrations = allRegistrations.filter(reg => {
        if (reg.grandfathered) return true;
        if (reg.enrollmentType === "session" && reg.sessionDate) {
          const regDate = new Date(reg.sessionDate);
          return regDate >= sDayStart && regDate < sDayEnd;
        }
        return false;
      });
    }

    // Determine the effective workshop start datetime for comparison
    const dateObj = new Date(session.date);
    const [hours, minutes] = (workshop.startTime || "00:00").split(":").map(Number);
    const workshopStartDateTime = new Date(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      hours,
      minutes
    );

    // Build participant join map for this day
    const sDayStart = startOfDay(session.date);
    const sDayEnd = endOfDay(session.date);
    const participantByEmail = new Map<string, any>();
    meetParticipants.forEach((p) => {
      if (p.joinedAt) {
        const joinedDate = new Date(p.joinedAt);
        if (joinedDate >= sDayStart && joinedDate < sDayEnd) {
          const emailKey = p.email.toLowerCase();
          const existing = participantByEmail.get(emailKey);
          if (!existing || p.joinedAt < existing.joinedAt) {
            participantByEmail.set(emailKey, p);
          }
        }
      }
    });

    let totalEnrollments = 0;
    let enrolledBeforeStart = 0;
    let enrolledAfterStart = 0;
    let cancelledEnrollments = 0;
    let totalAttended = 0;
    let totalRevenue = 0;

    const participants: WorkshopAnalytics["participants"] = [];

    for (const reg of registrations) {
      const user = reg.userId as any;
      if (!user || !user.email) continue;

      if (reg.status === "cancelled") {
        cancelledEnrollments++;
        continue;
      }

      totalEnrollments++;

      const registeredAt = reg.registeredAt || reg.createdAt;
      const isEnrolledBeforeStart = registeredAt < workshopStartDateTime;

      if (isEnrolledBeforeStart) {
        enrolledBeforeStart++;
      } else {
        enrolledAfterStart++;
      }

      const meetAttendance = participantByEmail.get(user.email.toLowerCase());
      const attended = reg.status === "attended" || !!meetAttendance;

      if (attended) {
        totalAttended++;
      }

      let durationInMeeting: number | undefined;
      if (meetAttendance && meetAttendance.joinedAt) {
        const joinTime = new Date(meetAttendance.joinedAt);
        const leaveTime = meetAttendance.leftAt
          ? new Date(meetAttendance.leftAt)
          : new Date();
        durationInMeeting = Math.round((leaveTime.getTime() - joinTime.getTime()) / 60000);
      }

      if (reg.hasPaid && reg.amountPaid) {
        totalRevenue += reg.amountPaid;
      }

      participants.push({
        userId: user._id?.toString() || reg.userId.toString(),
        name: user.name || "Unknown",
        email: user.email,
        profilePicture: user.profilePicture,
        registeredAt,
        enrolledBeforeStart: isEnrolledBeforeStart,
        attended,
        attendedAt: reg.attendedAt,
        joinedMeetingAt: meetAttendance?.joinedAt,
        leftMeetingAt: meetAttendance?.leftAt,
        durationInMeeting,
        hasPaid: reg.hasPaid,
        amountPaid: reg.amountPaid,
      });
    }

    const noShows = totalEnrollments - totalAttended;
    const attendanceRate = totalEnrollments > 0 ? Math.round((totalAttended / totalEnrollments) * 100) : 0;

    // Session status — clock-driven, with founder overrides. Order:
    //   1. manualEndedAt → completed (founder ended)
    //   2. manualStartedAt (not stale) → live, even past scheduledEnd
    //      or before scheduledStart — trusts the founder's explicit
    //      Start click.
    //   3. endDateTime passed → completed
    //   4. startDateTime passed → live
    //   5. else → not_started
    //
    // The previous EARLY_START_BUFFER_MS (2h) guard was removed on
    // 2026-07-14. It was added as defense-in-depth against spurious
    // manualStartedAt stamps landing on the wrong session's key (via
    // the /generate-meeting anchor bug). All three writers of
    // manualStartedAt now use the correct session anchor:
    //   - routes/webinarRoutes.ts:412 (/webinar/:id/start) — fixed 2026-07-13
    //   - routes/webinarRoutes.ts:594 (/webinar/:id/stop) — fixed 2026-07-13
    //   - routes/workshop.ts:2810 (/generate-meeting)     — fixed 2026-07-14
    //
    // With no writer capable of stamping the wrong session, we can trust
    // manualStartedAt as an authoritative "founder started this session"
    // signal — including cases where the founder legitimately starts more
    // than 2h before the scheduled time (setup / dry run / early start).
    // The 8h stale cap alone is enough to auto-heal any historical bad
    // rows that pre-date the anchor fixes.
    //
    // Note: the legacy `currentSessionDate` "always Live" override was
    // also removed here (was causing sticky Live when currentSessionDate
    // wasn't cleared on a clean stop).
    const MANUAL_START_STALE_MS = 8 * 60 * 60 * 1000;
    let status: SessionAnalytics["status"] = "not_started";
    if (override?.manualEndedAt) {
      status = "completed";
    } else if (
      override?.manualStartedAt &&
      nowForStatus.getTime() -
        new Date(override.manualStartedAt).getTime() <=
        MANUAL_START_STALE_MS
    ) {
      status = "live";
    } else if (session.endDateTime < nowForStatus) {
      status = "completed";
    } else if (
      session.startDateTime <= nowForStatus &&
      nowForStatus < session.endDateTime
    ) {
      status = "live";
    }

    const sessionKey = session.dateString; // YYYY-MM-DD
    const perSessionCommissionPaid =
      workshop.enrollmentType === "per_session"
        ? perSessionCommissionMap.get(sessionKey) || 0
        : undefined;

    sessionAnalytics.push({
      workshopId,
      workshopTitle: workshop.title,
      workshopDate: workshop.date,
      sessionDate: session.date,
      sessionNumber: sessionNumberBase + sessionAnalytics.length,
      status,
      affiliateCommissionPercent: commissionPercent,
      affiliateCommissionPaidUsd: perSessionCommissionPaid,
      // Actual run window — already loaded above for the status derivation.
      manualStartedAt: override?.manualStartedAt,
      manualEndedAt: override?.manualEndedAt,
      garageTvViewers: override?.garageTvViewerIds?.length ?? 0,
      liveSelling: (() => {
        const pinned = pinnedByDay.get(sessionKey);
        const sold = liveSellingByDay.get(sessionKey);
        if (!pinned && !sold) return undefined;
        return {
          products: pinned?.size ?? 0,
          customers: sold?.buyers.size ?? 0,
          orders: sold?.orders ?? 0,
          revenue: sold?.revenue ?? 0,
          commission: liveCommissionByDay.get(sessionKey) ?? 0,
        };
      })(),
      startTime: workshop.startTime,
      endTime: workshop.endTime,
      isRecurring: true,
      totalEnrollments,
      enrolledBeforeStart,
      enrolledAfterStart,
      cancelledEnrollments,
      totalAttended,
      noShows,
      attendanceRate,
      totalRevenue,
      currency: workshop.currency || "USD",
      participants,
    });

    aggEnrollments += totalEnrollments;
    aggAttended += totalAttended;
    aggRevenue += totalRevenue;
  }

  const averageAttendanceRate =
    aggEnrollments > 0 ? Math.round((aggAttended / aggEnrollments) * 100) : 0;

  return {
    workshop: {
      _id: workshop._id,
      title: workshop.title,
      isRecurring: true,
      enrollmentType: workshop.enrollmentType,
    },
    sessions: sessionAnalytics,
    aggregated: {
      // totalSessions reflects the FULL bounded range so the FE can
      // drive pagination controls (1-N of totalSessions).
      totalSessions: totalSessionsCount,
      totalEnrollments: aggEnrollments,
      totalAttended: aggAttended,
      averageAttendanceRate,
      totalRevenue: aggRevenue,
    },
  };
}

/**
 * Sync attendance status from meeting participants to workshop registrations
 * Should be called when a meeting ends
 */
export async function syncAttendanceFromMeeting(
  workshopId: string
): Promise<{ synced: number; errors: string[] }> {
  const { MeetParticipant } = await import("../models/meetParticipant.model");

  const workshop = await Workshop.findById(workshopId).lean();
  if (!workshop || !workshop.meetingId) {
    return { synced: 0, errors: ["Workshop or meeting not found"] };
  }

  // Get all meeting participants
  const meetParticipants = await MeetParticipant.find({
    meetId: new Types.ObjectId(workshop.meetingId),
  }).lean();

  if (meetParticipants.length === 0) {
    return { synced: 0, errors: [] };
  }

  // Get all registrations for this workshop
  const registrations = await WorkshopRegistration.find({
    workshopId: new Types.ObjectId(workshopId),
    status: { $ne: "cancelled" },
  })
    .populate("userId", "email")
    .lean();

  // Create email -> registration map
  const regByEmail = new Map<string, any>();
  registrations.forEach((reg) => {
    const user = reg.userId as any;
    if (user?.email) {
      regByEmail.set(user.email.toLowerCase(), reg);
    }
  });

  let synced = 0;
  const errors: string[] = [];

  // Update registrations based on meeting attendance
  for (const participant of meetParticipants) {
    const reg = regByEmail.get(participant.email.toLowerCase());
    if (reg && reg.status !== "attended") {
      try {
        await WorkshopRegistration.updateOne(
          { _id: reg._id },
          {
            status: "attended",
            attendedAt: participant.joinedAt,
          }
        );
        synced++;
      } catch (err) {
        errors.push(`Failed to update ${participant.email}: ${(err as Error).message}`);
      }
    }
  }

  return { synced, errors };
}

/**
 * Mark a specific user as attended (manual override)
 */
export async function markUserAttended(
  workshopId: string,
  userId: string,
  sessionDate?: Date
): Promise<boolean> {
  const filter: any = {
    workshopId: new Types.ObjectId(workshopId),
    userId: new Types.ObjectId(userId),
    status: { $ne: "cancelled" },
  };

  if (sessionDate) {
    filter.sessionDate = {
      $gte: startOfDay(sessionDate),
      $lt: endOfDay(sessionDate),
    };
  }

  const result = await WorkshopRegistration.updateOne(filter, {
    status: "attended",
    attendedAt: new Date(),
  });

  return result.modifiedCount > 0;
}
