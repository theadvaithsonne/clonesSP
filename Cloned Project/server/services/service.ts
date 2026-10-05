import { Types } from "mongoose";
import {
  Service,
  IService,
  IMilestone,
  IServiceHourlyConfig,
  IServiceTaskroomConfig,
} from "../models/service.model";
import {
  normalizeFounderAlerts,
  type FounderAlertsInput,
} from "../models/founderAlerts.schema";
import {
  ServiceOpt,
  IServiceOpt,
  IMilestoneProgress,
} from "../models/serviceOpt.model";
import { ServiceReview, IServiceReview } from "../models/serviceReview.model";
import { User } from "../models/user.model";

// Helper to generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============ Service CRUD ============

// A milestone's effective payment timing. Per-milestone timing wins; legacy
// milestones (no timing of their own) fall back to the service-level setting.
// Returns null when no payment is due at all (free service / zero amount).
export function resolveMilestoneTiming(
  servicePaymentTiming: "free" | "pay_before_milestone" | "pay_after_milestone",
  milestoneTiming?: "advance" | "on_completion" | null
): "advance" | "on_completion" | null {
  if (servicePaymentTiming === "free") return null;
  if (milestoneTiming === "advance" || milestoneTiming === "on_completion") {
    return milestoneTiming;
  }
  return servicePaymentTiming === "pay_before_milestone"
    ? "advance"
    : "on_completion";
}

export interface MilestoneAttachmentInput {
  name: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface MilestoneInput {
  _id?: string;
  title: string;
  description?: string;
  duration?: string;
  deliverables?: string[];
  attachments?: MilestoneAttachmentInput[];
  paymentAmount: number;
  currency?: string;
  paymentTiming?: "advance" | "on_completion";
}

export interface CreateServiceData {
  organizationId: string;
  createdBy: string;
  title: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags?: string[];
  features?: string[];
  deliverables?: string[];
  images?: string[];
  videos?: string[];
  youtubeUrl?: string;
  category?: string;
  duration?: string;
  pricingModel?: "milestone" | "billable";
  paymentTiming?: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency?: string;
  taxMode?: "inclusive" | "exclusive";
  bookingAdvanceFeeEnabled?: boolean;
  bookingAdvanceFee?: number;
  cancellationPolicy?: string;
  milestones?: MilestoneInput[];
  /** Only read when `pricingModel` is "billable"; `null` clears it. */
  hourlyConfig?: IServiceHourlyConfig | null;
  channelIds?: string[];
  allowedUserIds?: string[];
  status?: "draft" | "active" | "archived";
  whyChooseUs?: Array<{ icon: string; title: string; description: string }>;
  contactInfo?: { phone?: string; email?: string; whatsapp?: string };
  taskroomConfig?: IServiceTaskroomConfig;
  /** "Notify me when someone opts in" — see models/founderAlerts.schema.ts. */
  founderAlerts?: FounderAlertsInput;
}

export async function createService(data: CreateServiceData): Promise<IService> {
  const slug = generateSlug(data.title);

  // Check for slug uniqueness within organization
  const existingSlug = await Service.findOne({
    organizationId: new Types.ObjectId(data.organizationId),
    slug,
  });

  let finalSlug = slug;
  if (existingSlug) {
    finalSlug = `${slug}-${Date.now().toString(36)}`;
  }

  // Build milestones with order
  const milestones: IMilestone[] = (data.milestones || []).map(
    (milestone, index) => ({
      _id: new Types.ObjectId(),
      order: index + 1,
      title: milestone.title,
      description: milestone.description,
      duration: milestone.duration,
      deliverables: milestone.deliverables || [],
      attachments: milestone.attachments || [],
      paymentAmount: milestone.paymentAmount,
      currency: milestone.currency || data.currency || "USD",
      paymentTiming: milestone.paymentTiming,
    })
  );

  const service = new Service({
    organizationId: new Types.ObjectId(data.organizationId),
    createdBy: new Types.ObjectId(data.createdBy),
    title: data.title,
    slug: finalSlug,
    description: data.description,
    longDescription: data.longDescription,
    icon: data.icon,
    iconBgColor: data.iconBgColor,
    coverImage: data.coverImage,
    tags: data.tags || [],
    features: data.features || [],
    deliverables: data.deliverables || [],
    images: data.images || [],
    videos: data.videos || [],
    youtubeUrl: data.youtubeUrl,
    category: data.category,
    duration: data.duration,
    pricingModel: data.pricingModel || "milestone",
    paymentTiming: data.paymentTiming || "free",
    currency: data.currency || "USD",
    taxMode: data.taxMode || "inclusive",
    bookingAdvanceFeeEnabled: data.bookingAdvanceFeeEnabled || false,
    bookingAdvanceFee: data.bookingAdvanceFee || 0,
    cancellationPolicy: data.cancellationPolicy,
    hourlyConfig: data.hourlyConfig || undefined,
    milestones,
    channelIds: (data.channelIds || []).map((id) => new Types.ObjectId(id)),
    allowedUserIds: (data.allowedUserIds || []).map((id) => new Types.ObjectId(id)),
    status: data.status || "draft",
    whyChooseUs: data.whyChooseUs,
    contactInfo: data.contactInfo,
    taskroomConfig: data.taskroomConfig,
    ...(data.founderAlerts !== undefined
      ? { founderAlerts: normalizeFounderAlerts(data.founderAlerts) }
      : {}),
  });

  return service.save();
}

export interface UpdateServiceData {
  title?: string;
  description?: string;
  longDescription?: string;
  icon?: string;
  iconBgColor?: string;
  coverImage?: string;
  tags?: string[];
  features?: string[];
  deliverables?: string[];
  images?: string[];
  videos?: string[];
  youtubeUrl?: string;
  category?: string;
  duration?: string;
  pricingModel?: "milestone" | "billable";
  paymentTiming?: "free" | "pay_before_milestone" | "pay_after_milestone";
  currency?: string;
  taxMode?: "inclusive" | "exclusive";
  bookingAdvanceFeeEnabled?: boolean;
  bookingAdvanceFee?: number;
  cancellationPolicy?: string;
  milestones?: MilestoneInput[];
  /** Only read when `pricingModel` is "billable"; `null` clears it. */
  hourlyConfig?: IServiceHourlyConfig | null;
  channelIds?: string[];
  allowedUserIds?: string[];
  status?: "draft" | "active" | "archived";
  whyChooseUs?: Array<{ icon: string; title: string; description: string }>;
  contactInfo?: { phone?: string; email?: string; whatsapp?: string };
  taskroomConfig?: IServiceTaskroomConfig;
  /** "Notify me when someone opts in" — see models/founderAlerts.schema.ts. */
  founderAlerts?: FounderAlertsInput;
}

export async function updateService(
  serviceId: string,
  organizationId: string,
  data: UpdateServiceData
): Promise<IService | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!service) {
    return null;
  }

  // Update slug if title changed
  if (data.title && data.title !== service.title) {
    const newSlug = generateSlug(data.title);
    const existingSlug = await Service.findOne({
      organizationId: new Types.ObjectId(organizationId),
      slug: newSlug,
      _id: { $ne: service._id },
    });

    service.slug = existingSlug
      ? `${newSlug}-${Date.now().toString(36)}`
      : newSlug;
    service.title = data.title;
  }

  // Update other fields
  if (data.description !== undefined) service.description = data.description;
  if (data.longDescription !== undefined)
    service.longDescription = data.longDescription;
  if (data.icon !== undefined) service.icon = data.icon;
  if (data.iconBgColor !== undefined) service.iconBgColor = data.iconBgColor;
  if (data.coverImage !== undefined) service.coverImage = data.coverImage;
  if (data.tags !== undefined) service.tags = data.tags;
  if (data.features !== undefined) service.features = data.features;
  if (data.deliverables !== undefined) service.deliverables = data.deliverables;
  if (data.images !== undefined) service.images = data.images;
  if (data.videos !== undefined) service.videos = data.videos;
  if (data.youtubeUrl !== undefined) service.youtubeUrl = data.youtubeUrl;
  if (data.category !== undefined) service.category = data.category;
  if (data.duration !== undefined) service.duration = data.duration;
  if (data.pricingModel !== undefined) service.pricingModel = data.pricingModel;
  if (data.paymentTiming !== undefined)
    service.paymentTiming = data.paymentTiming;
  if (data.currency !== undefined) service.currency = data.currency;
  if (data.taxMode !== undefined) service.taxMode = data.taxMode;
  if (data.bookingAdvanceFeeEnabled !== undefined)
    service.bookingAdvanceFeeEnabled = data.bookingAdvanceFeeEnabled;
  if (data.bookingAdvanceFee !== undefined)
    service.bookingAdvanceFee = data.bookingAdvanceFee;
  if (data.cancellationPolicy !== undefined)
    service.cancellationPolicy = data.cancellationPolicy;

  // Replace the milestone list wholesale. Existing _ids sent back by the client
  // are preserved so in-flight opt-ins keep pointing at the same milestones.
  if (data.milestones !== undefined) {
    service.milestones = data.milestones.map((milestone, index) => ({
      _id:
        milestone._id && Types.ObjectId.isValid(milestone._id)
          ? new Types.ObjectId(milestone._id)
          : new Types.ObjectId(),
      order: index + 1,
      title: milestone.title,
      description: milestone.description,
      duration: milestone.duration,
      deliverables: milestone.deliverables || [],
      attachments: milestone.attachments || [],
      paymentAmount: milestone.paymentAmount,
      currency: milestone.currency || data.currency || service.currency,
      paymentTiming: milestone.paymentTiming,
    })) as IMilestone[];
  }
  if (data.status !== undefined) service.status = data.status;
  if (data.whyChooseUs !== undefined) service.whyChooseUs = data.whyChooseUs as any;
  if (data.contactInfo !== undefined) service.contactInfo = data.contactInfo as any;
  // `set(path, undefined)` is what actually removes an embedded document —
  // assigning undefined to the property leaves the stored one in place.
  if (data.hourlyConfig !== undefined) {
    service.set("hourlyConfig", data.hourlyConfig || undefined);
  }
  if (data.taskroomConfig !== undefined)
    service.taskroomConfig = data.taskroomConfig as any;

  // The founder's "someone opted in" alert. Only written when the caller sent
  // it, so a milestone or status edit can't silently clear the toggle.
  if (data.founderAlerts !== undefined)
    service.founderAlerts = normalizeFounderAlerts(data.founderAlerts);

  // Update channel IDs
  if (data.channelIds !== undefined) {
    service.channelIds = data.channelIds.map((id) => new Types.ObjectId(id));
  }

  // Update allowed user IDs
  if (data.allowedUserIds !== undefined) {
    service.allowedUserIds = data.allowedUserIds.map((id) => new Types.ObjectId(id));
  }

  return service.save();
}

export async function deleteService(
  serviceId: string,
  organizationId: string
): Promise<boolean> {
  // Check if there are any active opt-ins
  const activeOptIns = await ServiceOpt.countDocuments({
    serviceId: new Types.ObjectId(serviceId),
    status: { $in: ["opted", "in_progress"] },
  });

  if (activeOptIns > 0) {
    // Archive instead of delete
    await Service.updateOne(
      {
        _id: new Types.ObjectId(serviceId),
        organizationId: new Types.ObjectId(organizationId),
      },
      { $set: { status: "archived" } }
    );
    return true;
  }

  const result = await Service.deleteOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  return result.deletedCount > 0;
}

export async function getServiceById(
  serviceId: string,
  organizationId: string
): Promise<IService | null> {
  return Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  }).lean();
}

export async function getServiceBySlug(
  slug: string,
  organizationId: string
): Promise<IService | null> {
  return Service.findOne({
    slug,
    organizationId: new Types.ObjectId(organizationId),
  }).lean();
}

export interface GetServicesOptions {
  status?: "active" | "draft" | "archived" | "all";
  channelId?: string;
  search?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "title" | "totalPrice";
  sortOrder?: "asc" | "desc";
}

export async function getServices(
  organizationId: string,
  options: GetServicesOptions = {}
): Promise<{
  services: IService[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    status = "all",
    channelId,
    search,
    tags,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const query: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
  };

  if (status === "all") {
    query.status = { $ne: "archived" };
  } else {
    query.status = status;
  }

  if (channelId) {
    query.channelIds = new Types.ObjectId(channelId);
  }

  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $regex: search, $options: "i" } },
    ];
  }

  const total = await Service.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const sortOptions: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  const services = await Service.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .lean();

  return { services, total, page, totalPages };
}

// Get services available to a user (based on channel membership and user restriction)
export async function getAvailableServices(
  organizationId: string,
  userId: string,
  userChannelIds: string[],
  options: GetServicesOptions = {}
): Promise<{
  services: IService[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    search,
    tags,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = options;

  const userChannelObjectIds = userChannelIds.map(
    (id) => new Types.ObjectId(id)
  );

  const query: Record<string, unknown> = {
    organizationId: new Types.ObjectId(organizationId),
    status: "active",
    $and: [
      // User restriction check
      {
        $or: [
          { allowedUserIds: { $size: 0 } }, // No user restriction (public)
          { allowedUserIds: { $exists: false } }, // Backward compat for old docs
          { allowedUserIds: new Types.ObjectId(userId) }, // User is in allowed list
        ],
      },
      // Channel restriction check (existing logic, preserved)
      {
        $or: [
          { channelIds: { $size: 0 } }, // No channel restriction
          { channelIds: { $in: userChannelObjectIds } }, // User has access to at least one channel
        ],
      },
    ],
  };

  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }

  if (search) {
    (query.$and as any[]).push({
      $or: [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } },
      ],
    });
  }

  const total = await Service.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const sortOptions: Record<string, 1 | -1> = {
    [sortBy]: sortOrder === "asc" ? 1 : -1,
  };

  const services = await Service.find(query)
    .sort(sortOptions)
    .skip(skip)
    .limit(limit)
    .lean();

  return { services, total, page, totalPages };
}

// ============ Milestone Management ============

export interface CreateMilestoneData {
  title: string;
  description?: string;
  duration?: string;
  deliverables?: string[];
  attachments?: MilestoneAttachmentInput[];
  paymentAmount: number;
  currency?: string;
  paymentTiming?: "advance" | "on_completion";
}

export async function addMilestone(
  serviceId: string,
  organizationId: string,
  data: CreateMilestoneData
): Promise<IService | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!service) {
    return null;
  }

  const maxOrder = service.milestones.reduce(
    (max, m) => Math.max(max, m.order),
    0
  );

  const newMilestone: IMilestone = {
    _id: new Types.ObjectId(),
    order: maxOrder + 1,
    title: data.title,
    description: data.description,
    duration: data.duration,
    deliverables: data.deliverables || [],
    attachments: data.attachments || [],
    paymentAmount: data.paymentAmount,
    currency: data.currency || service.currency,
    paymentTiming: data.paymentTiming,
  };

  service.milestones.push(newMilestone);
  return service.save();
}

export interface UpdateMilestoneData {
  title?: string;
  description?: string;
  duration?: string;
  deliverables?: string[];
  attachments?: MilestoneAttachmentInput[];
  paymentAmount?: number;
  currency?: string;
  paymentTiming?: "advance" | "on_completion";
}

export async function updateMilestone(
  serviceId: string,
  milestoneId: string,
  organizationId: string,
  data: UpdateMilestoneData
): Promise<IService | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!service) {
    return null;
  }

  const milestoneIndex = service.milestones.findIndex(
    (m) => m._id.toString() === milestoneId
  );

  if (milestoneIndex === -1) {
    return null;
  }

  if (data.title !== undefined)
    service.milestones[milestoneIndex].title = data.title;
  if (data.description !== undefined)
    service.milestones[milestoneIndex].description = data.description;
  if (data.duration !== undefined)
    service.milestones[milestoneIndex].duration = data.duration;
  if (data.deliverables !== undefined)
    service.milestones[milestoneIndex].deliverables = data.deliverables;
  if (data.attachments !== undefined)
    service.milestones[milestoneIndex].attachments = data.attachments;
  if (data.paymentAmount !== undefined)
    service.milestones[milestoneIndex].paymentAmount = data.paymentAmount;
  if (data.currency !== undefined)
    service.milestones[milestoneIndex].currency = data.currency;
  if (data.paymentTiming !== undefined)
    service.milestones[milestoneIndex].paymentTiming = data.paymentTiming;

  return service.save();
}

export async function deleteMilestone(
  serviceId: string,
  milestoneId: string,
  organizationId: string
): Promise<IService | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!service) {
    return null;
  }

  const milestoneIndex = service.milestones.findIndex(
    (m) => m._id.toString() === milestoneId
  );

  if (milestoneIndex === -1) {
    return null;
  }

  service.milestones.splice(milestoneIndex, 1);

  // Reorder remaining milestones
  service.milestones.forEach((m, index) => {
    m.order = index + 1;
  });

  return service.save();
}

export async function reorderMilestones(
  serviceId: string,
  organizationId: string,
  milestoneIds: string[]
): Promise<IService | null> {
  const service = await Service.findOne({
    _id: new Types.ObjectId(serviceId),
    organizationId: new Types.ObjectId(organizationId),
  });

  if (!service) {
    return null;
  }

  // Verify all milestone IDs exist
  const milestoneIdSet = new Set(service.milestones.map((m) => m._id.toString()));
  for (const id of milestoneIds) {
    if (!milestoneIdSet.has(id)) {
      throw new Error(`Milestone ${id} not found`);
    }
  }

  // Reorder milestones
  const reorderedMilestones: IMilestone[] = [];
  for (let i = 0; i < milestoneIds.length; i++) {
    const milestone = service.milestones.find(
      (m) => m._id.toString() === milestoneIds[i]
    );
    if (milestone) {
      milestone.order = i + 1;
      reorderedMilestones.push(milestone);
    }
  }

  service.milestones = reorderedMilestones;
  return service.save();
}

// ============ Opt-in Management ============

export interface OptInData {
  serviceId: string;
  userId: string;
  organizationId: string;
}

export async function optInToService(data: OptInData): Promise<IServiceOpt> {
  // Check if already opted in
  const existingOptIn = await ServiceOpt.findOne({
    serviceId: new Types.ObjectId(data.serviceId),
    userId: new Types.ObjectId(data.userId),
  });

  if (existingOptIn) {
    if (existingOptIn.status === "cancelled") {
      // Allow re-opt-in by resetting the opt-in
      existingOptIn.status = "opted";
      existingOptIn.optedAt = new Date();
      existingOptIn.cancelledAt = undefined;
      existingOptIn.completedAt = undefined;
      existingOptIn.completedMilestones = 0;
      existingOptIn.progressPercentage = 0;
      existingOptIn.amountPaid = 0;
      existingOptIn.amountPending = 0;

      // Reset milestone progress
      for (const mp of existingOptIn.milestonesProgress) {
        mp.status = "pending";
        mp.paymentStatus = "not_required";
        mp.paymentId = undefined;
        mp.paidAt = undefined;
        mp.startedAt = undefined;
        mp.completedAt = undefined;
        mp.completedBy = undefined;
      }

      return existingOptIn.save();
    }

    throw new Error("You have already opted into this service");
  }

  // Get the service
  const service = await Service.findOne({
    _id: new Types.ObjectId(data.serviceId),
    organizationId: new Types.ObjectId(data.organizationId),
    status: "active",
  });

  if (!service) {
    throw new Error("Service not found or not available");
  }

  // Check user restriction
  if (service.allowedUserIds && service.allowedUserIds.length > 0) {
    const isAllowed = service.allowedUserIds.some(
      (id) => id.toString() === data.userId
    );
    if (!isAllowed) {
      throw new Error("You don't have access to this service");
    }
  }

  // Build milestone progress from service milestones
  const milestonesProgress: IMilestoneProgress[] = service.milestones.map(
    (milestone) => ({
      milestoneId: milestone._id,
      order: milestone.order,
      title: milestone.title,
      status: "pending" as const,
      paymentAmount: milestone.paymentAmount,
      currency: milestone.currency,
      paymentTiming:
        resolveMilestoneTiming(
          service.paymentTiming,
          milestone.paymentTiming
        ) || undefined,
      paymentRequired: false,
      paymentStatus: "not_required" as const,
    })
  );

  // Only the first milestone can be started right away, so it is the only one
  // whose advance payment is due at opt-in time. Later advance milestones are
  // flagged as their predecessor completes (see completeMilestone).
  const first = milestonesProgress[0];
  if (first && first.paymentTiming === "advance" && first.paymentAmount > 0) {
    first.paymentRequired = true;
    first.paymentStatus = "pending";
  }

  const optIn = new ServiceOpt({
    serviceId: new Types.ObjectId(data.serviceId),
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    status: "opted",
    totalAmount: service.totalPrice,
    currency: service.currency,
    milestonesProgress,
    totalMilestones: service.milestones.length,
  });

  const savedOptIn = await optIn.save();

  // Update service active opt-ins count
  await Service.updateOne(
    { _id: new Types.ObjectId(data.serviceId) },
    { $inc: { activeOptIns: 1 } }
  );

  // POST /services/:serviceId/opt-in previously produced no invoice at all,
  // while /checkout/service/:id always did — so the same opt-in left a
  // different paper trail depending on which door the user came through.
  //
  // Deliberately NOT the $0 free-invoice shape: services keep the existing
  // pending, full-value invoice that serviceCheckout.ts:440 mints (milestone
  // billing reads that amount). This mirrors it rather than changing it.
  // Best-effort — the opt-in is the source of truth and already saved.
  try {
    const { Invoice } = await import("../models/invoice.model");
    const already = await Invoice.findOne({
      userId: data.userId,
      "lineItems.itemType": "service",
      "lineItems.itemId": String(service._id),
      "metadata.type": "service_checkout",
    })
      .select("_id")
      .lean();
    if (!already) {
      const { User } = await import("../models/user.model");
      const user = await User.findById(data.userId)
        .select("email name")
        .lean<{ email?: string; name?: string }>();
      if (user?.email) {
        const { createInvoice } = await import("./invoice");
        await createInvoice({
          organizationId: data.organizationId,
          sellerId: service.createdBy.toString(),
          userId: data.userId,
          customerEmail: user.email,
          customerName: user.name || undefined,
          lineItems: [
            {
              itemType: "service",
              itemId: String(service._id),
              itemName: service.title,
              itemDescription: service.description || undefined,
              itemImage: (service as any).coverImage || undefined,
              quantity: 1,
              unitPrice: Math.round((service.totalPrice || 0) * 100),
              originalCurrency: service.currency || "USD",
            },
          ],
          itemCurrency: service.currency || "USD",
          discount: 0,
          metadata: { type: "service_checkout", source: "opt_in" },
        } as any);
      }
    }
  } catch (err) {
    console.error("[Service] opt-in invoice mint failed:", err);
  }

  return savedOptIn;
}

/**
 * A milestone is reachable once it is first in line or its predecessor has been
 * approved. Everything after that is still locked.
 */
export function unlockedMilestoneIds(
  progress: IMilestoneProgress[]
): Set<string> {
  const ordered = [...progress].sort((a, b) => a.order - b.order);
  const unlocked = new Set<string>();
  ordered.forEach((milestone, index) => {
    const previous = index > 0 ? ordered[index - 1] : null;
    if (!previous || previous.status === "completed") {
      unlocked.add(milestone.milestoneId.toString());
    }
  });
  return unlocked;
}

/**
 * Strip files belonging to milestones the client has not unlocked yet.
 * The stored URLs are directly fetchable, so hiding the control in the UI is
 * not enough — the address itself must not leave the server.
 *
 * Only ever applied to client-scoped reads; founders keep the full payload.
 */
export function redactLockedMilestoneFiles<T extends IServiceOpt>(optIn: T): T {
  const progress = optIn.milestonesProgress || [];
  const unlocked = unlockedMilestoneIds(progress);

  for (const milestone of progress) {
    if (!unlocked.has(milestone.milestoneId.toString())) {
      milestone.attachments = [];
      milestone.clientAttachments = [];
    }
  }

  const service = optIn.serviceId as unknown as IService | undefined;
  if (service && Array.isArray(service.milestones)) {
    for (const definition of service.milestones) {
      if (!unlocked.has(definition._id.toString())) {
        definition.attachments = [];
      }
    }
  }

  return optIn;
}

export async function getOptIn(
  serviceId: string,
  userId: string
): Promise<IServiceOpt | null> {
  return ServiceOpt.findOne({
    serviceId: new Types.ObjectId(serviceId),
    userId: new Types.ObjectId(userId),
  })
    .populate("serviceId", "title slug description longDescription coverImage icon iconBgColor duration currency totalPrice paymentTiming milestones createdBy contactInfo projectsCompleted taskroomConfig")
    .lean()
    .then((optIn) => (optIn ? redactLockedMilestoneFiles(optIn as IServiceOpt) : null));
}

export async function getOptInById(optInId: string): Promise<IServiceOpt | null> {
  return ServiceOpt.findById(optInId)
    .populate("serviceId", "title slug description longDescription coverImage icon iconBgColor duration currency totalPrice paymentTiming milestones createdBy contactInfo projectsCompleted taskroomConfig")
    .populate("userId", "name email profilePicture")
    .lean();
}

export async function getUserOptIns(
  userId: string,
  organizationId: string,
  options: { status?: string; page?: number; limit?: number } = {}
): Promise<{
  optIns: IServiceOpt[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { status, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(organizationId),
  };

  if (status) {
    query.status = status;
  }

  const total = await ServiceOpt.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const optIns = await ServiceOpt.find(query)
    .populate("serviceId", "title slug description longDescription coverImage icon iconBgColor duration currency totalPrice paymentTiming milestones createdBy contactInfo projectsCompleted taskroomConfig")
    .sort({ optedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return {
    optIns: optIns.map((optIn) => redactLockedMilestoneFiles(optIn as IServiceOpt)),
    total,
    page,
    totalPages,
  };
}

export async function getServiceOptIns(
  serviceId: string,
  options: { status?: string; page?: number; limit?: number } = {}
): Promise<{
  optIns: IServiceOpt[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { status, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = {
    serviceId: new Types.ObjectId(serviceId),
  };

  if (status) {
    query.status = status;
  }

  const total = await ServiceOpt.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const optIns = await ServiceOpt.find(query)
    .populate("userId", "name email profilePicture")
    .sort({ optedAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return { optIns, total, page, totalPages };
}

export async function cancelOptIn(
  optInId: string,
  userId: string
): Promise<IServiceOpt | null> {
  const optIn = await ServiceOpt.findOne({
    _id: new Types.ObjectId(optInId),
    userId: new Types.ObjectId(userId),
    status: { $in: ["opted", "in_progress"] },
  });

  if (!optIn) {
    return null;
  }

  // Check if any payments have been made
  const hasPaidMilestones = optIn.milestonesProgress.some(
    (m) => m.paymentStatus === "paid"
  );

  if (hasPaidMilestones) {
    throw new Error("Cannot cancel service with completed payments. Contact support.");
  }

  optIn.status = "cancelled";
  optIn.cancelledAt = new Date();

  const savedOptIn = await optIn.save();

  // Update service active opt-ins count
  await Service.updateOne(
    { _id: optIn.serviceId },
    { $inc: { activeOptIns: -1 } }
  );

  return savedOptIn;
}

// ============ Milestone Progress (Founder Only) ============

export async function startMilestone(
  optInId: string,
  milestoneId: string,
  founderId: string
): Promise<IServiceOpt | null> {
  const optIn = await ServiceOpt.findById(optInId);

  if (!optIn) {
    return null;
  }

  // Get the service to check payment timing
  const service = await Service.findById(optIn.serviceId);
  if (!service) {
    throw new Error("Service not found");
  }

  // Verify founder owns the service
  if (service.createdBy.toString() !== founderId) {
    throw new Error("Only the service creator can manage milestone progress");
  }

  const milestoneIndex = optIn.milestonesProgress.findIndex(
    (m) => m.milestoneId.toString() === milestoneId
  );

  if (milestoneIndex === -1) {
    throw new Error("Milestone not found");
  }

  const milestone = optIn.milestonesProgress[milestoneIndex];

  // Check if previous milestone is completed (if not the first)
  if (milestoneIndex > 0) {
    const prevMilestone = optIn.milestonesProgress[milestoneIndex - 1];
    if (prevMilestone.status !== "completed") {
      throw new Error("Previous milestone must be completed first");
    }
  }

  // Advance milestones must be paid before work starts
  const startTiming = resolveMilestoneTiming(
    service.paymentTiming,
    milestone.paymentTiming
  );
  if (
    startTiming === "advance" &&
    milestone.paymentAmount > 0 &&
    milestone.paymentStatus !== "paid"
  ) {
    throw new Error("Payment required before starting this milestone");
  }

  if (milestone.status !== "pending") {
    throw new Error("Milestone already started or completed");
  }

  milestone.status = "in_progress";
  milestone.startedAt = new Date();

  // Update overall opt-in status
  if (optIn.status === "opted") {
    optIn.status = "in_progress";
  }

  return optIn.save();
}

export async function completeMilestone(
  optInId: string,
  milestoneId: string,
  founderId: string,
  attachments?: { name: string; url: string; size?: number }[]
): Promise<IServiceOpt | null> {
  const optIn = await ServiceOpt.findById(optInId);

  if (!optIn) {
    return null;
  }

  // Get the service to check payment timing
  const service = await Service.findById(optIn.serviceId);
  if (!service) {
    throw new Error("Service not found");
  }

  // Verify founder owns the service
  if (service.createdBy.toString() !== founderId) {
    throw new Error("Only the service creator can manage milestone progress");
  }

  const milestoneIndex = optIn.milestonesProgress.findIndex(
    (m) => m.milestoneId.toString() === milestoneId
  );

  if (milestoneIndex === -1) {
    throw new Error("Milestone not found");
  }

  const milestone = optIn.milestonesProgress[milestoneIndex];

  if (milestone.status === "completed") {
    throw new Error("Milestone already completed");
  }

  const completeTiming = resolveMilestoneTiming(
    service.paymentTiming,
    milestone.paymentTiming
  );

  // Advance milestones must be paid before they can be closed out
  if (
    completeTiming === "advance" &&
    milestone.paymentAmount > 0 &&
    milestone.paymentStatus !== "paid"
  ) {
    throw new Error("Payment required before completing this milestone");
  }

  // Files submitted alongside the completion, if any
  if (attachments && attachments.length > 0) {
    milestone.attachments = attachments.map((file) => ({
      name: file.name,
      url: file.url,
      size: file.size,
      uploadedAt: new Date(),
    }));
  }

  // Mark milestone as completed
  milestone.status = "completed";
  milestone.completedAt = new Date();
  milestone.completedBy = new Types.ObjectId(founderId);
  optIn.completedMilestones += 1;

  // An "on completion" milestone bills the moment it is approved
  if (completeTiming === "on_completion" && milestone.paymentAmount > 0) {
    milestone.paymentRequired = true;
    milestone.paymentStatus = "pending";
  }

  // The next milestone becomes startable now, so its advance payment is due
  if (milestoneIndex + 1 < optIn.milestonesProgress.length) {
    const nextMilestone = optIn.milestonesProgress[milestoneIndex + 1];
    const nextTiming = resolveMilestoneTiming(
      service.paymentTiming,
      nextMilestone.paymentTiming
    );
    if (nextTiming === "advance" && nextMilestone.paymentAmount > 0) {
      nextMilestone.paymentRequired = true;
      nextMilestone.paymentStatus = "pending";
    }
  }

  // Check if service is completed
  if (optIn.completedMilestones >= optIn.totalMilestones) {
    optIn.status = "completed";
    optIn.completedAt = new Date();

    // Update service projects completed count
    await Service.updateOne(
      { _id: optIn.serviceId },
      {
        $inc: { projectsCompleted: 1, activeOptIns: -1 },
      }
    );
  }

  return optIn.save();
}

// ============ Pending Payments ============

export interface PendingPayment {
  serviceOptId: string;
  serviceId: string;
  serviceTitle: string;
  milestoneId: string;
  milestoneTitle: string;
  milestoneOrder: number;
  amount: number;
  currency: string;
  paymentTiming: string;
  completedAt?: Date;
}

export async function getPendingPayments(
  userId: string,
  organizationId: string
): Promise<PendingPayment[]> {
  const optIns = await ServiceOpt.find({
    userId: new Types.ObjectId(userId),
    organizationId: new Types.ObjectId(organizationId),
    status: { $in: ["opted", "in_progress"] },
    "milestonesProgress.paymentStatus": "pending",
  }).populate("serviceId", "title paymentTiming");

  const pendingPayments: PendingPayment[] = [];

  for (const optIn of optIns) {
    const service = optIn.serviceId as unknown as IService;
    for (const milestone of optIn.milestonesProgress) {
      if (milestone.paymentStatus === "pending") {
        pendingPayments.push({
          serviceOptId: optIn._id.toString(),
          serviceId: service._id.toString(),
          serviceTitle: service.title,
          milestoneId: milestone.milestoneId.toString(),
          milestoneTitle: milestone.title,
          milestoneOrder: milestone.order,
          amount: milestone.paymentAmount,
          currency: milestone.currency,
          paymentTiming:
            resolveMilestoneTiming(
              service.paymentTiming,
              milestone.paymentTiming
            ) === "advance"
              ? "pay_before_milestone"
              : "pay_after_milestone",
          completedAt: milestone.completedAt,
        });
      }
    }
  }

  return pendingPayments;
}

// ============ Reviews ============

export interface CreateReviewData {
  serviceId: string;
  serviceOptId: string;
  userId: string;
  organizationId: string;
  rating: number;
  comment: string;
}

export async function createReview(
  data: CreateReviewData
): Promise<IServiceReview> {
  // Verify the opt-in is completed
  const optIn = await ServiceOpt.findOne({
    _id: new Types.ObjectId(data.serviceOptId),
    serviceId: new Types.ObjectId(data.serviceId),
    userId: new Types.ObjectId(data.userId),
    status: "completed",
  });

  if (!optIn) {
    throw new Error("Can only review completed services");
  }

  // Check if review already exists
  const existingReview = await ServiceReview.findOne({
    serviceId: new Types.ObjectId(data.serviceId),
    userId: new Types.ObjectId(data.userId),
  });

  if (existingReview) {
    throw new Error("You have already reviewed this service");
  }

  // Get user info for denormalization
  const user = await User.findById(data.userId).lean();
  if (!user) {
    throw new Error("User not found");
  }

  const review = new ServiceReview({
    serviceId: new Types.ObjectId(data.serviceId),
    serviceOptId: new Types.ObjectId(data.serviceOptId),
    userId: new Types.ObjectId(data.userId),
    organizationId: new Types.ObjectId(data.organizationId),
    rating: data.rating,
    comment: data.comment,
    reviewerName: user.name,
    reviewerRole: user.department,
    reviewerAvatar: user.profilePicture,
    isApproved: true,
    isPublic: true,
  });

  return review.save();
}

export async function getServiceReviews(
  serviceId: string,
  options: { publicOnly?: boolean; page?: number; limit?: number } = {}
): Promise<{
  reviews: IServiceReview[];
  total: number;
  page: number;
  totalPages: number;
  averageRating: number;
}> {
  const { publicOnly = false, page = 1, limit = 20 } = options;

  const query: Record<string, unknown> = {
    serviceId: new Types.ObjectId(serviceId),
  };

  if (publicOnly) {
    query.isPublic = true;
    query.isApproved = true;
  }

  const total = await ServiceReview.countDocuments(query);
  const totalPages = Math.ceil(total / limit);
  const skip = (page - 1) * limit;

  const reviews = await ServiceReview.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  // Calculate average rating
  const ratingResult = await ServiceReview.aggregate([
    { $match: { serviceId: new Types.ObjectId(serviceId), isApproved: true } },
    { $group: { _id: null, avgRating: { $avg: "$rating" } } },
  ]);

  const averageRating = ratingResult[0]?.avgRating || 0;

  return { reviews, total, page, totalPages, averageRating };
}

export async function updateReview(
  reviewId: string,
  userId: string,
  data: { rating?: number; comment?: string }
): Promise<IServiceReview | null> {
  const review = await ServiceReview.findOne({
    _id: new Types.ObjectId(reviewId),
    userId: new Types.ObjectId(userId),
  });

  if (!review) {
    return null;
  }

  if (data.rating !== undefined) review.rating = data.rating;
  if (data.comment !== undefined) review.comment = data.comment;

  return review.save();
}

export async function deleteReview(
  reviewId: string,
  userId: string
): Promise<boolean> {
  const result = await ServiceReview.deleteOne({
    _id: new Types.ObjectId(reviewId),
    userId: new Types.ObjectId(userId),
  });

  return result.deletedCount > 0;
}

// ============ Stats ============

export async function getServiceStats(serviceId: string): Promise<{
  totalOptIns: number;
  activeOptIns: number;
  completedOptIns: number;
  cancelledOptIns: number;
  totalRevenue: number;
  averageRating: number;
  reviewCount: number;
}> {
  const serviceObjectId = new Types.ObjectId(serviceId);

  const [optInStats, revenueResult, ratingResult] = await Promise.all([
    ServiceOpt.aggregate([
      { $match: { serviceId: serviceObjectId } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    ServiceOpt.aggregate([
      { $match: { serviceId: serviceObjectId } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]),
    ServiceReview.aggregate([
      { $match: { serviceId: serviceObjectId, isApproved: true } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const stat of optInStats) {
    statusCounts[stat._id] = stat.count;
  }

  return {
    totalOptIns:
      (statusCounts.opted || 0) +
      (statusCounts.in_progress || 0) +
      (statusCounts.completed || 0) +
      (statusCounts.cancelled || 0),
    activeOptIns: (statusCounts.opted || 0) + (statusCounts.in_progress || 0),
    completedOptIns: statusCounts.completed || 0,
    cancelledOptIns: statusCounts.cancelled || 0,
    totalRevenue: revenueResult[0]?.total || 0,
    averageRating: ratingResult[0]?.avgRating || 0,
    reviewCount: ratingResult[0]?.count || 0,
  };
}
