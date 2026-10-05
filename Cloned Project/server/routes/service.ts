import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { hasFounderAccess } from "../utils/accessCheck";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import {
  Service,
  IService,
  IServiceHourlyConfig,
  IServiceTaskroomConfig,
} from "../models/service.model";
import { ServiceOpt, IServiceOpt } from "../models/serviceOpt.model";
import { ServiceMilestoneMessage } from "../models/serviceMilestoneMessage.model";
import { notifyNewServiceCreated } from "../services/bulkEmail";
import {
  createService,
  updateService,
  deleteService,
  getServiceById,
  getServiceBySlug,
  getServices,
  getAvailableServices,
  addMilestone,
  updateMilestone,
  deleteMilestone,
  reorderMilestones,
  optInToService,
  getOptIn,
  getOptInById,
  getUserOptIns,
  getServiceOptIns,
  cancelOptIn,
  startMilestone,
  completeMilestone,
  getPendingPayments,
  createReview,
  getServiceReviews,
  updateReview,
  deleteReview,
  getServiceStats,
  unlockedMilestoneIds,
  CreateServiceData,
  UpdateServiceData,
  GetServicesOptions,
} from "../services/service";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
} from "../services/razorpay";
import {
  provisionEngagementRoom,
  provisionEngagementRoomAsync,
  getClientBoard,
  getRoomFiles,
  resolveStageTemplates,
  DEFAULT_CLIENT_ACCESS,
} from "../services/taskroomProvision";
import { distributeCommissions } from "../services/commission";

const router = Router();

// Helper to check if user is a founder in the organization
async function isUserFounder(userId: string, orgId: string): Promise<boolean> {
  const user = await User.findById(userId).lean();
  if (!user) return false;

  // Check in organizations array
  const membership = user.organizations?.find(
    (org) => org.organization.toString() === orgId
  );

  if (membership && hasFounderAccess(membership)) {
    return true;
  }

  // Fallback to legacy single-org field
  if (user.organization?.toString() === orgId && ["admin", "founder"].includes(user.role || "")) {
    return true;
  }

  return false;
}

// Channel-membership resolution + cache moved to
// `services/channelMembership.ts` — shared with products & courses.
import { getUserChannelIds } from "../services/channelMembership";

const TASKROOM_STAGE_TYPES = ["tostart", "active", "done", "closed"] as const;
const TASKROOM_TASK_KINDS = ["required", "task", "internal"] as const;
const TASKROOM_PRIORITIES = ["low", "medium", "high"] as const;

/**
 * Coerce a client-supplied taskroom config into the stored shape.
 *
 * The board layout is founder-authored free text that later drives calls into
 * another service, so enums are clamped and strings are trimmed and bounded
 * here rather than trusted.
 */
function normalizeTaskroomConfig(
  raw: any
): IServiceTaskroomConfig | undefined {
  if (raw === undefined || raw === null) return undefined;

  const clamp = (value: unknown, max = 120) =>
    String(value ?? "").trim().slice(0, max);

  const stages = Array.isArray(raw.stages)
    ? raw.stages
        .filter((stage: any) => clamp(stage?.name).length > 0)
        .slice(0, 30)
        .map((stage: any, index: number) => ({
          name: clamp(stage.name),
          color: clamp(stage.color, 32) || "#008080",
          stageType: TASKROOM_STAGE_TYPES.includes(stage?.stageType)
            ? stage.stageType
            : index === 0
            ? "tostart"
            : "active",
          isInternal: Boolean(stage?.isInternal),
          milestoneIndex:
            typeof stage?.milestoneIndex === "number" &&
            stage.milestoneIndex >= 0
              ? stage.milestoneIndex
              : undefined,
          tasks: Array.isArray(stage?.tasks)
            ? stage.tasks
                .filter((task: any) => clamp(task?.title, 200).length > 0)
                .slice(0, 50)
                .map((task: any) => ({
                  title: clamp(task.title, 200),
                  description: clamp(task?.description, 2000) || undefined,
                  kind: TASKROOM_TASK_KINDS.includes(task?.kind)
                    ? task.kind
                    : "task",
                  priority: TASKROOM_PRIORITIES.includes(task?.priority)
                    ? task.priority
                    : "medium",
                  // Deliverables cloned as subtasks of this card.
                  subtasks: Array.isArray(task?.subtasks)
                    ? task.subtasks
                        .map((subtask: any) => clamp(subtask, 200))
                        .filter((subtask: string) => subtask.length > 0)
                        .slice(0, 50)
                    : [],
                  // The assignee is a Garage user id the founder picked; it is
                  // resolved to a Taskroom user at provision time, so an id
                  // that does not resolve costs the card its owner and nothing
                  // more.
                  assignee: clamp(task?.assignee?.userId, 64)
                    ? {
                        userId: clamp(task.assignee.userId, 64),
                        name: clamp(task.assignee?.name, 200),
                        email: clamp(task.assignee?.email, 200),
                        image: clamp(task.assignee?.image, 500) || undefined,
                      }
                    : undefined,
                }))
            : [],
        }))
    : [];

  const access = raw.clientAccess || {};

  return {
    enabled: Boolean(raw.enabled),
    stages,
    clientAccess: {
      showTaskroomBoard: access.showTaskroomBoard !== false,
      showActivityLogs: access.showActivityLogs !== false,
      enableFilesTab: access.enableFilesTab !== false,
      revealTimelogSheet: Boolean(access.revealTimelogSheet),
      showProgressStatusGauge: access.showProgressStatusGauge !== false,
    },
    workspaceId: clamp(raw.workspaceId, 64) || undefined,
    spaceId: clamp(raw.spaceId, 64) || undefined,
  } as IServiceTaskroomConfig;
}

const BILLING_MODEL_TYPES = ["hourly", "retainer"];
const BILLING_CYCLES = ["weekly", "bi_weekly", "monthly"];
const BILLING_START_DAYS = [
  "1st_of_month",
  "15th_of_month",
  "contract_start",
  "monday",
];

/**
 * Clean the hourly setup coming off the wizard.
 *
 * The cap and the deposit each have an amount that only means something while
 * its switch is on — those are dropped rather than kept as dead numbers, so a
 * founder who turns the cap off and saves cannot leave a stale ceiling behind
 * for the billing run to trip over.
 */
function normalizeHourlyConfig(raw: any): IServiceHourlyConfig | undefined {
  if (raw === undefined || raw === null) return undefined;

  const positive = (value: unknown, max: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.min(Math.round(parsed * 100) / 100, max);
  };

  const text = (value: unknown, max: number) =>
    String(value ?? "").trim().slice(0, max);

  // The delivery roster. A member without a user id is meaningless — nothing
  // could be added to the room for them — so those rows are dropped.
  const team = Array.isArray(raw.team)
    ? raw.team
        .filter((member: any) => text(member?.userId, 64).length > 0)
        .slice(0, 50)
        .map((member: any) => ({
          userId: text(member.userId, 64),
          name: text(member?.name, 200),
          email: text(member?.email, 200),
          image: text(member?.image, 500) || undefined,
          payRate: positive(member?.payRate, 1000000),
          role: text(member?.role, 120) || undefined,
        }))
    : [];

  const hardCapEnabled = Boolean(raw.hardCapEnabled);
  const securityDepositEnabled = Boolean(raw.securityDepositEnabled);
  const maxHoursPerMonth = positive(raw.maxHoursPerMonth, 10000);
  const securityDepositAmount = positive(raw.securityDepositAmount, 100000000);

  return {
    billingModelType: BILLING_MODEL_TYPES.includes(raw?.billingModelType)
      ? raw.billingModelType
      : "hourly",
    hourlyRate: positive(raw.hourlyRate, 1000000),
    estimatedMonthlyHours: positive(raw.estimatedMonthlyHours, 10000),
    noMinimumCommitment: Boolean(raw.noMinimumCommitment),
    billingCycle: BILLING_CYCLES.includes(raw?.billingCycle)
      ? raw.billingCycle
      : "monthly",
    billingStartDay: BILLING_START_DAYS.includes(raw?.billingStartDay)
      ? raw.billingStartDay
      : "1st_of_month",
    hardCapEnabled: hardCapEnabled && maxHoursPerMonth > 0,
    maxHoursPerMonth:
      hardCapEnabled && maxHoursPerMonth > 0 ? maxHoursPerMonth : undefined,
    timesheetApprovalRequired: raw?.timesheetApprovalRequired !== false,
    securityDepositEnabled:
      securityDepositEnabled && securityDepositAmount > 0,
    securityDepositAmount:
      securityDepositEnabled && securityDepositAmount > 0
        ? securityDepositAmount
        : undefined,
    team,
  } as IServiceHourlyConfig;
}

/**
 * Strip what only the founder may see before a service goes over the wire.
 *
 * Right now that is the delivery team's pay rates: the roster itself is fine
 * for a client to know — they can see who is on their board — but what each
 * person costs is the margin, and no client-reachable response carries it.
 */
function sanitizeServiceForClient<T>(service: T): T {
  const plain: any =
    service && typeof (service as any).toObject === "function"
      ? (service as any).toObject()
      : service;

  if (!plain || typeof plain !== "object") return service;
  if (!Array.isArray(plain.hourlyConfig?.team)) return plain as T;

  return {
    ...plain,
    hourlyConfig: {
      ...plain.hourlyConfig,
      team: plain.hourlyConfig.team.map(({ payRate, ...rest }: any) => rest),
    },
  } as T;
}

// ============ Service CRUD Routes ============

// Get all services (founders see all, stakeholders see available)
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    const options: GetServicesOptions = {
      status: req.query.status as GetServicesOptions["status"],
      channelId: req.query.channelId as string,
      search: req.query.search as string,
      tags: req.query.tags ? (req.query.tags as string).split(",") : undefined,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      sortBy: req.query.sortBy as GetServicesOptions["sortBy"],
      sortOrder: req.query.sortOrder as GetServicesOptions["sortOrder"],
    };

    let result;

    if (isFounder) {
      result = await getServices(orgId, options);
    } else {
      const channelIds = await getUserChannelIds(userId, orgId);
      result = await getAvailableServices(orgId, userId, channelIds, options);
      result = {
        ...result,
        services: (result.services || []).map(sanitizeServiceForClient),
      } as typeof result;
    }

    res.json({
      ...result,
      isFounder,
    });
  } catch (error) {
    console.error("Error fetching services:", error);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Get user's opt-ins (must be before /:serviceId to avoid conflict)
router.get("/opt-ins/my", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;

    const options = {
      status: req.query.status as string,
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
    };

    const result = await getUserOptIns(userId, orgId, options);

    res.json(result);
  } catch (error) {
    console.error("Error fetching user opt-ins:", error);
    res.status(500).json({ error: "Failed to fetch opt-ins" });
  }
});

// Get pending payments for user
router.get(
  "/payments/pending",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;

      const pendingPayments = await getPendingPayments(userId, orgId);

      res.json({ pendingPayments });
    } catch (error) {
      console.error("Error fetching pending payments:", error);
      res.status(500).json({ error: "Failed to fetch pending payments" });
    }
  }
);

// Get single service
router.get("/:serviceId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { serviceId } = req.params;

    // Try to find by ID first, then by slug
    let service = await getServiceById(serviceId, orgId);
    if (!service) {
      service = await getServiceBySlug(serviceId, orgId);
    }

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    const isFounder = await isUserFounder(userId, orgId);

    // Check access for stakeholders
    if (!isFounder && service.status !== "active") {
      return res.status(404).json({ error: "Service not found" });
    }

    // Get user's opt-in status early to implement the "Grandfather Clause"
    let optIn = null;
    let hasActiveOptIn = false;
    if (!isFounder) {
      optIn = await getOptIn(service._id.toString(), userId);
      hasActiveOptIn = !!(optIn && ["opted", "in_progress", "completed"].includes(optIn.status));
    }

    // Check channel access for stakeholders (bypassed if actively opted in)
    if (!isFounder && !hasActiveOptIn && service.channelIds.length > 0) {
      const channelIds = await getUserChannelIds(userId, orgId);
      const hasAccess = service.channelIds.some((chId) =>
        channelIds.includes(chId.toString())
      );

      if (!hasAccess) {
        return res
          .status(404)
          .json({ error: "Service not found" });
      }
    }

    // Check user restriction for stakeholders (bypassed if actively opted in)
    if (!isFounder && !hasActiveOptIn && service.allowedUserIds?.length > 0) {
      const isAllowed = service.allowedUserIds.some(
        (id) => id.toString() === userId
      );
      if (!isAllowed) {
        return res.status(404).json({ error: "Service not found" });
      }
    }

    res.json({
      service: isFounder ? service : sanitizeServiceForClient(service),
      isFounder,
      optIn,
    });
  } catch (error) {
    console.error("Error fetching service:", error);
    res.status(500).json({ error: "Failed to fetch service" });
  }
});

// Create service (founders only)
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can create services" });
    }

    const {
      title,
      description,
      longDescription,
      icon,
      iconBgColor,
      coverImage,
      tags,
      features,
      deliverables,
      images,
      videos,
      youtubeUrl,
      category,
      duration,
      pricingModel,
      paymentTiming,
      currency,
      taxMode,
      bookingAdvanceFeeEnabled,
      bookingAdvanceFee,
      cancellationPolicy,
      milestones,
      hourlyConfig,
      channelIds,
      allowedUserIds,
      status,
      whyChooseUs,
      contactInfo,
      taskroomConfig,
      // "Notify me when someone opts in" — the founder's own alert. See
      // models/founderAlerts.schema.ts.
      founderAlerts,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const serviceData: CreateServiceData = {
      organizationId: orgId,
      createdBy: userId,
      title,
      description,
      longDescription,
      icon,
      iconBgColor,
      coverImage,
      tags,
      features,
      deliverables,
      images,
      videos,
      youtubeUrl,
      category,
      duration,
      pricingModel,
      paymentTiming,
      currency,
      taxMode,
      bookingAdvanceFeeEnabled,
      bookingAdvanceFee,
      cancellationPolicy,
      milestones,
      // Billable services carry no milestones; the hourly setup takes their
      // place and the two are never both meaningful.
      hourlyConfig:
        pricingModel === "billable"
          ? normalizeHourlyConfig(hourlyConfig)
          : undefined,
      channelIds,
      allowedUserIds,
      status,
      whyChooseUs,
      contactInfo,
      taskroomConfig: normalizeTaskroomConfig(taskroomConfig),
      founderAlerts,
    };

    const service = await createService(serviceData);

    // Notify org members about the new service (only for active services).
    // Scoped to this office so members of unrelated orgs aren't spammed.
    if (service.status === "active") {
      const org = await Organization.findById(orgId).select("name").lean();
      notifyNewServiceCreated(
        {
          _id: service._id.toString(),
          name: service.title,
          description: service.description,
          coverImage: service.coverImage,
        },
        (org as any)?.name || "an organization",
        orgId
      );
    }

    res.status(201).json({ service });
  } catch (error) {
    console.error("Error creating service:", error);
    res.status(500).json({ error: "Failed to create service" });
  }
});

// Update service (founders only)
router.put("/:serviceId", requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId, orgId: jwtOrgId } = (req as any).user;
    const orgId = (req.query.orgId as string) || jwtOrgId;
    const { serviceId } = req.params;
    const isFounder = await isUserFounder(userId, orgId);

    if (!isFounder) {
      return res
        .status(403)
        .json({ error: "Only founders can update services" });
    }

    const updateData: UpdateServiceData = { ...req.body };
    // Switching a service back to milestones clears the hourly setup rather
    // than leaving a dead one behind for a later billing run to read.
    if (
      updateData.pricingModel !== undefined &&
      updateData.pricingModel !== "billable"
    ) {
      updateData.hourlyConfig = null;
    } else if (updateData.hourlyConfig !== undefined) {
      updateData.hourlyConfig =
        normalizeHourlyConfig(updateData.hourlyConfig) || null;
    }
    if (updateData.taskroomConfig !== undefined) {
      updateData.taskroomConfig = normalizeTaskroomConfig(
        updateData.taskroomConfig
      );
    }

    const service = await updateService(serviceId, orgId, updateData);

    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }

    res.json({ service });
  } catch (error) {
    console.error("Error updating service:", error);
    res.status(500).json({ error: "Failed to update service" });
  }
});

// Delete service (founders only)
router.delete(
  "/:serviceId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can delete services" });
      }

      const deleted = await deleteService(serviceId, orgId);

      if (!deleted) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ error: "Failed to delete service" });
    }
  }
);

// ============ Milestone Management Routes (Founder Only) ============

// Add milestone
router.post(
  "/:serviceId/milestones",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestones" });
      }

      const {
        title,
        description,
        duration,
        deliverables,
        attachments,
        paymentAmount,
        currency,
        paymentTiming,
      } = req.body;

      if (!title || paymentAmount === undefined) {
        return res
          .status(400)
          .json({ error: "Title and payment amount are required" });
      }

      const service = await addMilestone(serviceId, orgId, {
        title,
        description,
        duration,
        deliverables,
        attachments,
        paymentAmount,
        currency,
        paymentTiming,
      });

      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.status(201).json({ service });
    } catch (error) {
      console.error("Error adding milestone:", error);
      res.status(500).json({ error: "Failed to add milestone" });
    }
  }
);

// Update milestone
router.put(
  "/:serviceId/milestones/:milestoneId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId, milestoneId } = req.params;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestones" });
      }

      const service = await updateMilestone(
        serviceId,
        milestoneId,
        orgId,
        req.body
      );

      if (!service) {
        return res
          .status(404)
          .json({ error: "Service or milestone not found" });
      }

      res.json({ service });
    } catch (error) {
      console.error("Error updating milestone:", error);
      res.status(500).json({ error: "Failed to update milestone" });
    }
  }
);

// Delete milestone
router.delete(
  "/:serviceId/milestones/:milestoneId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId, milestoneId } = req.params;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestones" });
      }

      const service = await deleteMilestone(serviceId, milestoneId, orgId);

      if (!service) {
        return res
          .status(404)
          .json({ error: "Service or milestone not found" });
      }

      res.json({ service });
    } catch (error) {
      console.error("Error deleting milestone:", error);
      res.status(500).json({ error: "Failed to delete milestone" });
    }
  }
);

// Reorder milestones
router.post(
  "/:serviceId/milestones/reorder",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;
      const { milestoneIds } = req.body;
      const isFounder = await isUserFounder(userId, orgId);

      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestones" });
      }

      if (!milestoneIds || !Array.isArray(milestoneIds)) {
        return res.status(400).json({ error: "milestoneIds array is required" });
      }

      const service = await reorderMilestones(serviceId, orgId, milestoneIds);

      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json({ service });
    } catch (error: any) {
      console.error("Error reordering milestones:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to reorder milestones" });
    }
  }
);

// ============ Opt-in Routes ============

// Opt into service
router.post(
  "/:serviceId/opt-in",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;

      const optIn = await optInToService({
        serviceId,
        userId,
        organizationId: orgId,
      });

      // Best-effort: the engagement room is built out of band so several
      // sequential Taskroom calls never delay the opt-in response, and a
      // Taskroom outage never fails the opt-in.
      provisionEngagementRoomAsync(optIn._id);

      res.status(201).json({ optIn });
    } catch (error: any) {
      console.error("Error opting into service:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to opt into service" });
    }
  }
);

// Get opt-in status for service
router.get(
  "/:serviceId/opt-in",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { serviceId } = req.params;

      const optIn = await getOptIn(serviceId, userId);

      res.json({ optIn });
    } catch (error) {
      console.error("Error fetching opt-in:", error);
      res.status(500).json({ error: "Failed to fetch opt-in status" });
    }
  }
);

// Cancel opt-in
router.delete(
  "/opt-ins/:optInId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { optInId } = req.params;

      const optIn = await cancelOptIn(optInId, userId);

      if (!optIn) {
        return res.status(404).json({ error: "Opt-in not found or cannot be cancelled" });
      }

      res.json({ optIn });
    } catch (error: any) {
      console.error("Error cancelling opt-in:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to cancel opt-in" });
    }
  }
);

// ============ Milestone Progress Routes (Founder Only) ============

// Start milestone
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/start",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestone progress" });
      }

      const optIn = await startMilestone(optInId, milestoneId, userId);

      if (!optIn) {
        return res.status(404).json({ error: "Opt-in not found" });
      }

      res.json({ optIn });
    } catch (error: any) {
      console.error("Error starting milestone:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to start milestone" });
    }
  }
);

// Complete milestone
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/complete",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can manage milestone progress" });
      }

      const attachments = Array.isArray(req.body?.attachments)
        ? req.body.attachments
            .filter((f: any) => f && typeof f.name === "string" && typeof f.url === "string")
            .map((f: any) => ({ name: f.name, url: f.url, size: Number(f.size) || undefined }))
        : undefined;

      const optIn = await completeMilestone(optInId, milestoneId, userId, attachments);

      if (!optIn) {
        return res.status(404).json({ error: "Opt-in not found" });
      }

      res.json({ optIn });
    } catch (error: any) {
      console.error("Error completing milestone:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to complete milestone" });
    }
  }
);

// ============ Payment Routes ============

// Create Razorpay order for milestone payment
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/create-order",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

      // Get the opt-in
      const optIn = await ServiceOpt.findOne({
        _id: new Types.ObjectId(optInId),
        userId: new Types.ObjectId(userId),
      });

      if (!optIn) {
        return res.status(404).json({
          success: false,
          error: "Opt-in not found",
        });
      }

      // Find the milestone
      const milestone = optIn.milestonesProgress.find(
        (m) => m.milestoneId.toString() === milestoneId
      );

      if (!milestone) {
        return res.status(404).json({
          success: false,
          error: "Milestone not found",
        });
      }

      // Check if payment is required
      if (milestone.paymentStatus !== "pending") {
        return res.status(400).json({
          success: false,
          error: "Payment not required or already paid for this milestone",
        });
      }

      // Get service for details
      const service = await Service.findById(optIn.serviceId).lean();
      if (!service) {
        return res.status(404).json({
          success: false,
          error: "Service not found",
        });
      }

      // Create Razorpay order
      const shortTs = Date.now().toString().slice(-12);
      const order = await createRazorpayOrder({
        amount: Math.round(milestone.paymentAmount * 100), // Convert to paise
        currency: milestone.currency || "USD",
        receipt: `svc_${shortTs}`,
        notes: {
          userId,
          orgId,
          serviceId: service._id.toString(),
          serviceOptId: optIn._id.toString(),
          milestoneId,
          milestoneName: milestone.title,
          type: "service_milestone",
        },
      });

      // Create invoice
      let invoiceId: string | undefined;
      try {
        const { createInvoice } = require("../services/invoice");
        const userDoc = await User.findById(userId).select("email").lean();
        const invoice = await createInvoice({
          organizationId: orgId,
          sellerId: service.createdBy,
          userId,
          customerEmail: userDoc?.email || "",
          lineItems: [{
            itemType: "service",
            itemId: service._id.toString(),
            itemName: service.title,
            itemDescription: `Service milestone: ${milestone.title}`,
            quantity: 1,
            unitPrice: Math.round(milestone.paymentAmount * 100),
            originalCurrency: milestone.currency || "USD",
          }],
          itemCurrency: milestone.currency || "USD",
          metadata: { type: "service_purchase" },
        });
        invoiceId = invoice._id.toString();
      } catch (invoiceError) {
        console.error("[Service] Invoice creation error (non-blocking):", invoiceError);
      }

      res.json({
        success: true,
        order: {
          id: order.id,
          amount: order.amount,
          currency: order.currency,
        },
        milestone: {
          id: milestone.milestoneId,
          title: milestone.title,
          amount: milestone.paymentAmount,
          currency: milestone.currency,
        },
        service: {
          id: service._id,
          title: service.title,
        },
        invoiceId,
      });
    } catch (error) {
      console.error("Error creating milestone payment order:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create payment order",
        details: (error as Error).message,
      });
    }
  }
);

// Verify milestone payment
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/verify-payment",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

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

      // Get the opt-in
      const optIn = await ServiceOpt.findOne({
        _id: new Types.ObjectId(optInId),
        userId: new Types.ObjectId(userId),
      });

      if (!optIn) {
        return res.status(404).json({
          success: false,
          error: "Opt-in not found",
        });
      }

      // Find and update the milestone payment status
      const milestoneIndex = optIn.milestonesProgress.findIndex(
        (m) => m.milestoneId.toString() === milestoneId
      );

      if (milestoneIndex === -1) {
        return res.status(404).json({
          success: false,
          error: "Milestone not found",
        });
      }

      const milestone = optIn.milestonesProgress[milestoneIndex];

      // Check if already paid (prevent double payment)
      if (milestone.paymentStatus === "paid") {
        return res.status(400).json({
          success: false,
          error: "Milestone already paid",
        });
      }

      // Update milestone payment status
      milestone.paymentStatus = "paid";
      milestone.paymentId = razorpayPaymentId;
      milestone.paidAt = new Date();

      await optIn.save();

      // Get service for commission distribution
      const service = await Service.findById(optIn.serviceId).lean();

      // Distribute commissions
      if (service && milestone.paymentAmount > 0) {
        try {
          await distributeCommissions({
            orgId,
            sellerId: service.createdBy.toString(),
            customerId: userId,
            itemType: "service",
            itemId: service._id.toString(),
            itemName: `${service.title} - ${milestone.title}`,
            saleAmount: milestone.paymentAmount,
            currency: milestone.currency || "USD",
            paymentId: razorpayPaymentId,
            metadata: {
              serviceOptId: optIn._id.toString(),
              milestoneId,
              milestoneTitle: milestone.title,
              milestoneOrder: milestone.order,
            },
          });
        } catch (commissionError) {
          console.error("Error distributing commissions:", commissionError);
          // Don't fail the payment verification
        }
      }

      res.json({
        success: true,
        message: "Payment verified successfully",
        optIn,
      });
    } catch (error: any) {
      console.error("Error verifying milestone payment:", error);
      res.status(500).json({
        success: false,
        error: "Failed to verify payment",
        details: error.message,
      });
    }
  }
);

// ============ Review Routes ============

// Create review
router.post(
  "/:serviceId/reviews",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;
      const { serviceOptId, rating, comment } = req.body;

      if (!rating || !comment) {
        return res
          .status(400)
          .json({ error: "Rating and comment are required" });
      }

      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }

      const review = await createReview({
        serviceId,
        serviceOptId,
        userId,
        organizationId: orgId,
        rating,
        comment,
      });

      res.status(201).json({ review });
    } catch (error: any) {
      console.error("Error creating review:", error);
      res
        .status(400)
        .json({ error: error.message || "Failed to create review" });
    }
  }
);

// Get service reviews
router.get(
  "/:serviceId/reviews",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { serviceId } = req.params;
      const publicOnly = req.query.publicOnly === "true";
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await getServiceReviews(serviceId, {
        publicOnly,
        page,
        limit,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  }
);

// Update review
router.put(
  "/reviews/:reviewId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { reviewId } = req.params;
      const { rating, comment } = req.body;

      const review = await updateReview(reviewId, userId, { rating, comment });

      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({ review });
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ error: "Failed to update review" });
    }
  }
);

// Delete review
router.delete(
  "/reviews/:reviewId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId } = (req as any).user;
      const { reviewId } = req.params;

      const deleted = await deleteReview(reviewId, userId);

      if (!deleted) {
        return res.status(404).json({ error: "Review not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  }
);

// ============ Founder Dashboard Routes ============

// Get all opt-ins for a service (founders only)
router.get(
  "/:serviceId/opt-ins",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;

      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can view all opt-ins" });
      }

      const options = {
        status: req.query.status as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      const result = await getServiceOptIns(serviceId, options);

      res.json(result);
    } catch (error) {
      console.error("Error fetching service opt-ins:", error);
      res.status(500).json({ error: "Failed to fetch opt-ins" });
    }
  }
);

// Get service statistics (founders only)
router.get(
  "/:serviceId/stats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { serviceId } = req.params;

      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder) {
        return res
          .status(403)
          .json({ error: "Only founders can view service statistics" });
      }

      const stats = await getServiceStats(serviceId);

      res.json(stats);
    } catch (error) {
      console.error("Error fetching service stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  }
);

// ============ Milestone Discussion Routes ============

/**
 * Resolve who may read/write a milestone thread: the client who opted in, or a
 * founder of the organisation that owns the engagement.
 */
async function resolveMilestoneThreadAccess(
  optInId: string,
  userId: string,
  orgId: string
): Promise<
  | { ok: false; status: number; error: string }
  | { ok: true; optIn: any; authorRole: "client" | "founder" }
> {
  if (!Types.ObjectId.isValid(optInId)) {
    return { ok: false, status: 400, error: "Invalid engagement id" };
  }

  const optIn = await ServiceOpt.findById(optInId).lean();
  if (!optIn) {
    return { ok: false, status: 404, error: "Engagement not found" };
  }

  const isOwner = optIn.userId.toString() === userId;
  const isFounder = await isUserFounder(userId, orgId);
  const sameOrg = optIn.organizationId.toString() === orgId;

  if (!isOwner && !(isFounder && sameOrg)) {
    return { ok: false, status: 403, error: "No access to this engagement" };
  }

  return { ok: true, optIn, authorRole: isOwner ? "client" : "founder" };
}

// Attach files to one milestone of an engagement.
// A client's files land in `clientAttachments`; a founder's land in
// `attachments` (the deliverable proof shown to the client).
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

      const incoming = Array.isArray(req.body?.attachments)
        ? req.body.attachments
        : [];
      const files = incoming
        .filter((f: any) => f && typeof f.url === "string" && typeof f.name === "string")
        .slice(0, 10)
        .map((f: any) => ({
          name: String(f.name),
          url: String(f.url),
          size: typeof f.size === "number" ? f.size : undefined,
          contentType: typeof f.contentType === "string" ? f.contentType : undefined,
          uploadedAt: new Date(),
          uploadedBy: new Types.ObjectId(userId),
        }));

      if (files.length === 0) {
        return res.status(400).json({ error: "No files provided" });
      }

      const access = await resolveMilestoneThreadAccess(optInId, userId, orgId);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const optIn = await ServiceOpt.findById(optInId);
      if (!optIn) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const ordered = [...optIn.milestonesProgress].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex(
        (m) => m.milestoneId.toString() === milestoneId
      );
      const progress = index === -1 ? undefined : ordered[index];
      if (!progress) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // A locked milestone is not reachable yet — no reads, no writes
      const previous = index > 0 ? ordered[index - 1] : null;
      if (previous && previous.status !== "completed") {
        return res
          .status(403)
          .json({ error: "This milestone is locked until the previous one is approved" });
      }

      if (access.authorRole === "client") {
        progress.clientAttachments = [
          ...(progress.clientAttachments || []),
          ...files,
        ];
      } else {
        progress.attachments = [
          ...(progress.attachments || []),
          ...files.map(({ name, url, size, uploadedAt }: any) => ({
            name,
            url,
            size,
            uploadedAt,
          })),
        ];
      }

      await optIn.save();
      res.status(201).json({ optIn });
    } catch (error) {
      console.error("Error attaching milestone files:", error);
      res.status(500).json({ error: "Failed to attach files" });
    }
  }
);

// Remove one file the caller uploaded to a milestone
router.delete(
  "/opt-ins/:optInId/milestones/:milestoneId/attachments",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;
      const url = typeof req.body?.url === "string" ? req.body.url : "";

      if (!url) {
        return res.status(400).json({ error: "File url is required" });
      }

      const access = await resolveMilestoneThreadAccess(optInId, userId, orgId);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const optIn = await ServiceOpt.findById(optInId);
      if (!optIn) {
        return res.status(404).json({ error: "Engagement not found" });
      }

      const progress = optIn.milestonesProgress.find(
        (m) => m.milestoneId.toString() === milestoneId
      );
      if (!progress) {
        return res.status(404).json({ error: "Milestone not found" });
      }

      // Each side can only remove its own uploads
      if (access.authorRole === "client") {
        progress.clientAttachments = (progress.clientAttachments || []).filter(
          (f) => f.url !== url
        );
      } else {
        progress.attachments = (progress.attachments || []).filter(
          (f) => f.url !== url
        );
      }

      await optIn.save();
      res.json({ optIn });
    } catch (error) {
      console.error("Error removing milestone file:", error);
      res.status(500).json({ error: "Failed to remove file" });
    }
  }
);

// List the messages on one milestone of one engagement
router.get(
  "/opt-ins/:optInId/milestones/:milestoneId/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;

      const access = await resolveMilestoneThreadAccess(optInId, userId, orgId);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const messages = await ServiceMilestoneMessage.find({
        serviceOptId: optInId,
        milestoneId,
      })
        .sort({ createdAt: 1 })
        .populate("userId", "name email profilePicture")
        .lean();

      res.json({ messages });
    } catch (error) {
      console.error("Error fetching milestone messages:", error);
      res.status(500).json({ error: "Failed to fetch milestone messages" });
    }
  }
);

// Post a message on one milestone of one engagement
router.post(
  "/opt-ins/:optInId/milestones/:milestoneId/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { optInId, milestoneId } = req.params;
      const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const access = await resolveMilestoneThreadAccess(optInId, userId, orgId);
      if (!access.ok) {
        return res.status(access.status).json({ error: access.error });
      }

      const created = await ServiceMilestoneMessage.create({
        serviceOptId: optInId,
        serviceId: access.optIn.serviceId,
        milestoneId,
        organizationId: access.optIn.organizationId,
        userId,
        authorRole: access.authorRole,
        message,
      });

      const populated = await ServiceMilestoneMessage.findById(created._id)
        .populate("userId", "name email profilePicture")
        .lean();

      res.status(201).json({ message: populated });
    } catch (error) {
      console.error("Error posting milestone message:", error);
      res.status(500).json({ error: "Failed to post milestone message" });
    }
  }
);

// ============ Taskroom Integration Routes ============

/**
 * Resolve an opt-in and confirm the caller may see it.
 *
 * Returns the opt-in plus whether the caller is the client (the person who
 * opted in) or the founder. Anyone else gets null — this is the single gate in
 * front of every taskroom read below.
 *
 * Founder status is checked before ownership so a founder who opted into their
 * own service to test it still gets the founder view: owning the opt-in must
 * not demote them to `client` and lock them out of the room handles and the
 * provisioning retry.
 */
async function resolveEngagementAccess(
  optInId: string,
  userId: string,
  orgId: string
): Promise<
  | {
      optIn: IServiceOpt;
      service: IService;
      role: "client" | "founder";
      /** True when the founder is also the client — the self-test case. */
      isSelfEngagement: boolean;
    }
  | null
> {
  if (!Types.ObjectId.isValid(optInId)) return null;

  const optIn = await ServiceOpt.findById(optInId);
  if (!optIn) return null;

  const service = await Service.findById(optIn.serviceId);
  if (!service) return null;

  const isOwner = optIn.userId.toString() === userId;
  const isFounder = await isUserFounder(
    userId,
    optIn.organizationId.toString()
  );

  if (!isOwner && !isFounder) return null;

  return {
    optIn,
    service,
    role: isFounder ? "founder" : "client",
    isSelfEngagement: isOwner && isFounder,
  };
}

/**
 * Client-facing board read.
 *
 * The client never talks to Taskroom directly and never receives the roomId
 * unless they are the founder: internal columns are removed here, server-side,
 * because a browser-side filter would still ship internal cards over the wire.
 */
router.get(
  "/opt-ins/:optInId/board",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const access = await resolveEngagementAccess(
        req.params.optInId,
        userId,
        orgId
      );

      if (!access) {
        return res.status(403).json({ error: "Not your engagement" });
      }

      const { optIn, service, role } = access;

      if (!service.taskroomConfig?.enabled) {
        return res.json({ board: null, reason: "not_configured" });
      }

      if (optIn.taskroom?.status !== "ready") {
        return res.json({
          board: null,
          reason: optIn.taskroom?.status || "pending",
        });
      }

      // A founder reading their own engagement — including one they opted into
      // to test the flow — always gets the board, even when it is switched off
      // for clients. Internal columns stay stripped either way, so what they
      // see is exactly what the client would see.
      const board = await getClientBoard(optIn, service, {
        ignoreVisibilitySwitch: role === "founder",
      });

      if (!board) {
        return res.json({ board: null, reason: "hidden" });
      }

      res.json({
        board,
        // Only the founder gets the deep-link handles; handing a roomId to the
        // client would let them query Taskroom directly and bypass filtering.
        taskroom:
          role === "founder"
            ? {
                roomId: optIn.taskroom?.roomId,
                spaceId: optIn.taskroom?.spaceId,
                workspaceId: optIn.taskroom?.workspaceId,
              }
            : undefined,
      });
    } catch (error) {
      console.error("Error fetching engagement board:", error);
      res.status(500).json({ error: "Failed to fetch engagement board" });
    }
  }
);

/**
 * Every file that belongs to an engagement, for the Files tab.
 *
 * Three sources, kept apart because they mean different things: what the
 * founder shared, what the client uploaded, and what is attached to cards in
 * the engagement room. Files on milestones the client has not unlocked are
 * never included — the URLs are directly fetchable, so hiding the control in
 * the UI would not be enough.
 *
 * Gated by the `enableFilesTab` permission, which the founder bypasses.
 */
router.get(
  "/opt-ins/:optInId/files",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const access = await resolveEngagementAccess(
        req.params.optInId,
        userId,
        orgId
      );

      if (!access) {
        return res.status(403).json({ error: "Not your engagement" });
      }

      const { optIn, service, role } = access;
      const permissions = {
        ...DEFAULT_CLIENT_ACCESS,
        ...(service.taskroomConfig?.clientAccess || {}),
      };

      if (!permissions.enableFilesTab && role !== "founder") {
        return res.json({ files: null, reason: "hidden" });
      }

      const ordered = [...(optIn.milestonesProgress || [])].sort(
        (a, b) => a.order - b.order
      );
      // The founder sees the whole engagement; the client only what is open.
      const unlocked =
        role === "founder"
          ? new Set(ordered.map((m) => m.milestoneId.toString()))
          : unlockedMilestoneIds(optIn.milestonesProgress || []);

      const shared: any[] = [];
      const uploaded: any[] = [];

      for (const progress of ordered) {
        const milestoneId = progress.milestoneId.toString();
        if (!unlocked.has(milestoneId)) continue;

        const definition = service.milestones?.find(
          (m) => m._id.toString() === milestoneId
        );

        const context = {
          milestoneId,
          milestoneTitle: progress.title,
          milestoneOrder: progress.order,
        };

        for (const file of definition?.attachments || []) {
          shared.push({ ...context, ...file, source: "brief" });
        }
        for (const file of progress.attachments || []) {
          shared.push({
            ...context,
            ...(file as any),
            source: "deliverable",
          });
        }
        for (const file of progress.clientAttachments || []) {
          uploaded.push({ ...context, ...(file as any) });
        }
      }

      // De-duplicate a brief that was also submitted as the deliverable.
      const seen = new Set<string>();
      const sharedFiles = shared.filter((file) => {
        if (!file.url || seen.has(file.url)) return false;
        seen.add(file.url);
        return true;
      });

      const room = await getRoomFiles(optIn, service);

      res.json({
        files: {
          shared: sharedFiles,
          uploaded,
          room,
          // Which milestones the client may still attach files to.
          uploadTargets: ordered
            .filter((m) => unlocked.has(m.milestoneId.toString()))
            .map((m) => ({
              milestoneId: m.milestoneId.toString(),
              title: m.title,
              order: m.order,
            })),
        },
      });
    } catch (error) {
      console.error("Error fetching engagement files:", error);
      res.status(500).json({ error: "Failed to fetch engagement files" });
    }
  }
);

/**
 * The engagement's activity log: milestone transitions, payments, files,
 * messages and card movement on the board, merged into one timeline.
 *
 * Assembled here rather than in the browser because the pieces live in three
 * places (the opt-in, the message collection and Taskroom) and because the
 * `showActivityLogs` permission has to be enforced somewhere the client cannot
 * reach around.
 */
router.get(
  "/opt-ins/:optInId/activity",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const access = await resolveEngagementAccess(
        req.params.optInId,
        userId,
        orgId
      );

      if (!access) {
        return res.status(403).json({ error: "Not your engagement" });
      }

      const { optIn, service, role } = access;
      const permissions = {
        ...DEFAULT_CLIENT_ACCESS,
        ...(service.taskroomConfig?.clientAccess || {}),
      };

      if (!permissions.showActivityLogs && role !== "founder") {
        return res.json({ activity: null, reason: "hidden" });
      }

      const ordered = [...(optIn.milestonesProgress || [])].sort(
        (a, b) => a.order - b.order
      );
      const unlocked =
        role === "founder"
          ? new Set(ordered.map((m) => m.milestoneId.toString()))
          : unlockedMilestoneIds(optIn.milestonesProgress || []);

      type Entry = {
        type:
          | "milestone_started"
          | "milestone_completed"
          | "payment"
          | "file"
          | "message"
          | "task";
        at: string;
        title: string;
        detail?: string;
        actor?: string;
        milestoneId?: string;
      };

      const entries: Entry[] = [];
      const push = (entry: Entry | null) => {
        if (entry?.at) entries.push(entry);
      };

      for (const progress of ordered) {
        const milestoneId = progress.milestoneId.toString();
        if (!unlocked.has(milestoneId)) continue;

        if (progress.startedAt) {
          push({
            type: "milestone_started",
            at: new Date(progress.startedAt).toISOString(),
            title: `Milestone ${progress.order} started`,
            detail: progress.title,
            milestoneId,
          });
        }
        if (progress.completedAt) {
          push({
            type: "milestone_completed",
            at: new Date(progress.completedAt).toISOString(),
            title: `Milestone ${progress.order} delivered`,
            detail: progress.title,
            milestoneId,
          });
        }
        if (progress.paidAt) {
          push({
            type: "payment",
            at: new Date(progress.paidAt).toISOString(),
            title: `Payment received for milestone ${progress.order}`,
            detail: `${progress.currency} ${progress.paymentAmount}`,
            milestoneId,
          });
        }
        for (const file of progress.attachments || []) {
          push({
            type: "file",
            at: (file as any).uploadedAt
              ? new Date((file as any).uploadedAt).toISOString()
              : "",
            title: "Deliverable shared",
            detail: file.name,
            actor: "founder",
            milestoneId,
          });
        }
        for (const file of progress.clientAttachments || []) {
          push({
            type: "file",
            at: (file as any).uploadedAt
              ? new Date((file as any).uploadedAt).toISOString()
              : "",
            title: "File uploaded",
            detail: file.name,
            actor: "client",
            milestoneId,
          });
        }
      }

      const messages = await ServiceMilestoneMessage.find({
        serviceOptId: optIn._id,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .populate("userId", "name email")
        .lean();

      for (const message of messages) {
        const milestoneId = message.milestoneId?.toString();
        if (milestoneId && !unlocked.has(milestoneId)) continue;
        push({
          type: "message",
          at: new Date(message.createdAt as any).toISOString(),
          title:
            message.authorRole === "founder"
              ? "Comment from the founder"
              : "Comment from the client",
          detail: message.message,
          actor: (message.userId as any)?.name || message.authorRole,
          milestoneId,
        });
      }

      // Board movement, from the same filtered read the client's board uses —
      // internal columns never contribute an activity entry.
      if (optIn.taskroom?.status === "ready") {
        const board = await getClientBoard(optIn, service, {
          ignoreVisibilitySwitch: true,
        }).catch(() => null);

        for (const stage of board?.stages || []) {
          for (const card of stage.cards) {
            const label = card.name || card.title || "Task";
            if (card.isCompleted) {
              push({
                type: "task",
                at: (card as any).updatedAt
                  ? new Date((card as any).updatedAt).toISOString()
                  : "",
                title: `Task completed in ${stage.name}`,
                detail: label,
              });
            } else if (card.createdAt) {
              push({
                type: "task",
                at: new Date(card.createdAt).toISOString(),
                title: `Task added to ${stage.name}`,
                detail: label,
              });
            }
          }
        }
      }

      entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

      res.json({ activity: entries.slice(0, 60) });
    } catch (error) {
      console.error("Error fetching engagement activity:", error);
      res.status(500).json({ error: "Failed to fetch engagement activity" });
    }
  }
);

/**
 * Founder-facing deep-link handles for an engagement, used by the
 * "Take to Taskroom" action.
 */
router.get(
  "/opt-ins/:optInId/taskroom",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const access = await resolveEngagementAccess(
        req.params.optInId,
        userId,
        orgId
      );

      if (!access || access.role !== "founder") {
        return res
          .status(403)
          .json({ error: "Only the founder can open the taskroom" });
      }

      res.json({
        taskroom: {
          status: access.optIn.taskroom?.status || "pending",
          roomId: access.optIn.taskroom?.roomId,
          spaceId: access.optIn.taskroom?.spaceId,
          workspaceId: access.optIn.taskroom?.workspaceId,
          error: access.optIn.taskroom?.error,
        },
      });
    } catch (error) {
      console.error("Error fetching engagement taskroom:", error);
      res.status(500).json({ error: "Failed to fetch engagement taskroom" });
    }
  }
);

/**
 * Retry a failed provision. Also used by the founder to build a room for an
 * engagement that predates the taskroom config being switched on.
 */
router.post(
  "/opt-ins/:optInId/taskroom/provision",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const access = await resolveEngagementAccess(
        req.params.optInId,
        userId,
        orgId
      );

      if (!access || access.role !== "founder") {
        return res
          .status(403)
          .json({ error: "Only the founder can provision a taskroom" });
      }

      // A manual retry clears the attempt ceiling — the founder is explicitly
      // asking, so a transient outage should not permanently lock them out.
      if (access.optIn.taskroom?.status === "failed") {
        access.optIn.set("taskroom.attempts", 0);
        await access.optIn.save();
      }

      const optIn = await provisionEngagementRoom(req.params.optInId);

      res.json({
        taskroom: {
          status: optIn?.taskroom?.status || "pending",
          roomId: optIn?.taskroom?.roomId,
          spaceId: optIn?.taskroom?.spaceId,
          workspaceId: optIn?.taskroom?.workspaceId,
          error: optIn?.taskroom?.error,
        },
      });
    } catch (error) {
      console.error("Error provisioning engagement taskroom:", error);
      res.status(500).json({ error: "Failed to provision taskroom" });
    }
  }
);

/**
 * Reverse lookup: which engagement does this Taskroom room belong to?
 *
 * Drives the additive "Service" tab inside Taskroom. Returns 204 for ordinary
 * rooms so the tab simply never renders and untouched taskrooms look exactly
 * as they did before.
 */
router.get(
  "/by-taskroom/:roomId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;
      const { roomId } = req.params;

      const optIn = await ServiceOpt.findOne({ "taskroom.roomId": roomId });
      if (!optIn) {
        return res.status(204).end();
      }

      const isFounder = await isUserFounder(
        userId,
        optIn.organizationId.toString()
      );
      const isClient = optIn.userId.toString() === userId;

      if (!isFounder && !isClient) {
        return res.status(204).end();
      }

      const service = await Service.findById(optIn.serviceId).lean();
      if (!service) {
        return res.status(204).end();
      }

      const client = await User.findById(optIn.userId)
        .select("name email profilePicture")
        .lean();

      res.json({
        service: {
          _id: service._id,
          title: service.title,
          slug: service.slug,
          icon: service.icon,
          iconBgColor: service.iconBgColor,
          currency: service.currency,
          totalPrice: service.totalPrice,
        },
        optIn: {
          _id: optIn._id,
          status: optIn.status,
          progressPercentage: optIn.progressPercentage,
          completedMilestones: optIn.completedMilestones,
          totalMilestones: optIn.totalMilestones,
          totalAmount: optIn.totalAmount,
          amountPaid: optIn.amountPaid,
          amountPending: optIn.amountPending,
          currency: optIn.currency,
          milestonesProgress: optIn.milestonesProgress,
        },
        client: isFounder ? client : undefined,
        viewerRole: isFounder ? "founder" : "client",
      });
    } catch (error) {
      console.error("Error resolving service by taskroom:", error);
      res.status(500).json({ error: "Failed to resolve service" });
    }
  }
);

/**
 * Default board layout for a service, used by the wizard to pre-fill Section 6
 * from the milestones already entered in Section 3.
 */
router.get(
  "/:serviceId/taskroom/template",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { userId, orgId: jwtOrgId } = (req as any).user;
      const orgId = (req.query.orgId as string) || jwtOrgId;

      const isFounder = await isUserFounder(userId, orgId);
      if (!isFounder) {
        return res.status(403).json({ error: "Founders only" });
      }

      const service = await Service.findOne({
        _id: new Types.ObjectId(req.params.serviceId),
        organizationId: new Types.ObjectId(orgId),
      });

      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }

      res.json({ stages: resolveStageTemplates(service) });
    } catch (error) {
      console.error("Error building taskroom template:", error);
      res.status(500).json({ error: "Failed to build taskroom template" });
    }
  }
);

export default router;
