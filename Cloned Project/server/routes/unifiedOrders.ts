import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { ProductOrder } from "../models/productOrder.model";
import { CourseEnrollment } from "../models/courseEnrollment.model";
import { WorkshopRegistration } from "../models/workshopRegistration.model";
import { Subscription } from "../models/subscription.model";
import { Channel } from "../models/channel.model";
import { ServiceOpt } from "../models/serviceOpt.model";
import { Service } from "../models/service.model";
import { CallPurchase } from "../models/callPurchase.model";
import { CallOffering } from "../models/callOffering.model";
import { Types } from "mongoose";

const router = Router();

// Types for unified order response
export type UnifiedOrderType = "product" | "course" | "workshop" | "channel" | "service" | "call";

export interface UnifiedOrderItem {
  _id: string;
  orderNumber: string;
  type: UnifiedOrderType;
  /** The sold item's id (product/course/workshop/channel/service/call) —
   *  clients filter an item's own orders with this. */
  itemId: string;
  itemName: string;
  itemImage?: string;
  amount: number;
  currency: string;
  status: string;
  paymentStatus: string;
  createdAt: string;
  invoiceShortUrl?: string; // Public URL for Razorpay invoice
  customer: {
    _id: string;
    name: string;
    email: string;
    profilePicture?: string;
  } | null;
  // Type-specific metadata
  metadata: {
    // Product specific
    quantity?: number;
    isDigital?: boolean;
    requiresShipping?: boolean;
    trackingNumber?: string;
    trackingUrl?: string;
    digitalAssets?: Array<{ name: string; url: string; type: string }>;
    digitalLinks?: Array<{ label: string; url: string; description?: string }>;
    fulfillmentStatus?: string;
    shippingAddress?: {
      fullName: string;
      addressLine1: string;
      city: string;
      state: string;
      country: string;
    };
    // Course specific
    progressPercentage?: number;
    completedChapters?: number;
    totalChapters?: number;
    enrollmentStatus?: string;
    // Workshop specific
    eventDate?: string;
    eventTime?: string;
    timezone?: string;
    meetingUrl?: string;
    attendanceStatus?: string;
    isRecurring?: boolean;
    // Channel/Subscription specific
    subscriptionStatus?: string;
    currentPeriodEnd?: string;
    nextBillingDate?: string;
    billingCycle?: string;
    // Service specific
    serviceStatus?: string;
    completedMilestones?: number;
    totalMilestones?: number;
    amountPaid?: number;
    amountPending?: number;
    paymentTiming?: string;
    // Call specific
    quantityPurchased?: number;
    quantityUsed?: number;
    quantityRemaining?: number;
    quantityScheduled?: number;
    callDuration?: number;
    nextBookingDate?: string;
  };
}

interface UnifiedOrdersResponse {
  orders: UnifiedOrderItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  counts: {
    all: number;
    product: number;
    course: number;
    workshop: number;
    channel: number;
    service: number;
    call: number;
  };
}

// Helper to generate order number for items that don't have one
function generateOrderNumber(type: string, id: string, date: Date): string {
  const prefix = type.substring(0, 3).toUpperCase();
  const timestamp = date.getTime().toString(36).toUpperCase().slice(-6);
  const idSuffix = id.slice(-4).toUpperCase();
  return `${prefix}-${timestamp}-${idSuffix}`;
}

// ─── Per-collection fetchers ────────────────────────────────────────────────

async function fetchProductOrders(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const query: any = {
    organizationId: new Types.ObjectId(orgId),
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? { paymentStatus: statusFilter === "completed" ? "paid" : statusFilter }
      : {}),
  };

  if (search) {
    const re = new RegExp(search, "i");
    query.$or = [
      { orderNumber: re },
      { "items.productName": re },
    ];
  }

  const [total, productOrders] = await Promise.all([
    ProductOrder.countDocuments(query),
    ProductOrder.find(query)
      .populate("userId", "name email profilePicture")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items: UnifiedOrderItem[] = productOrders.map((order) => {
    const user = order.userId as any;
    const firstItem = order.items[0];
    return {
      _id: order._id.toString(),
      orderNumber: order.orderNumber,
      type: "product",
      itemId: firstItem?.productId?.toString() || "",
      itemName:
        order.items.length > 1
          ? `${firstItem?.productName || "Product"} + ${order.items.length - 1} more`
          : firstItem?.productName || "Product",
      itemImage: firstItem?.productImage,
      amount: order.total,
      currency: order.currency || "USD",
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: (order.createdAt as Date).toISOString(),
      invoiceShortUrl: (order as any).invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        quantity: order.items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        isDigital: firstItem?.isDigital,
        requiresShipping: order.requiresShipping,
        trackingNumber: order.trackingNumber,
        trackingUrl: order.trackingUrl,
        digitalAssets: firstItem?.digitalAssets?.map((a: any) => ({ name: a.name, url: a.fileUrl, type: a.fileType })),
        digitalLinks: firstItem?.digitalLinks?.map((l: any) => ({ label: l.label, url: l.url, description: l.description })),
        fulfillmentStatus: order.status,
        shippingAddress: order.shippingAddress
          ? {
              fullName: order.shippingAddress.fullName,
              addressLine1: order.shippingAddress.addressLine1,
              city: order.shippingAddress.city,
              state: order.shippingAddress.state,
              country: order.shippingAddress.country,
            }
          : undefined,
      },
    };
  });

  return { items, total };
}

async function fetchCourseEnrollments(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const query: any = {
    organizationId: new Types.ObjectId(orgId),
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? { paymentStatus: statusFilter === "completed" ? "completed" : statusFilter === "pending" ? "pending" : statusFilter }
      : {}),
  };

  if (search) {
    // We can't search courseId.title directly in find(); do a lightweight populate approach
    // For search on course name, we do an aggregation-based approach
    const re = new RegExp(search, "i");
    const { Course } = await import("../models/course.model");
    const matchingCourses = await Course.find({ title: re }).select("_id").lean();
    const matchingCourseIds = matchingCourses.map((c) => c._id);
    query.$or = [{ courseId: { $in: matchingCourseIds } }];
  }

  const [total, enrollments] = await Promise.all([
    CourseEnrollment.countDocuments(query),
    CourseEnrollment.find(query)
      .populate("userId", "name email profilePicture")
      .populate("courseId", "title thumbnail")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items: UnifiedOrderItem[] = enrollments.map((enrollment) => {
    const user = enrollment.userId as any;
    const course = enrollment.courseId as any;
    return {
      _id: enrollment._id.toString(),
      orderNumber: generateOrderNumber("CRS", enrollment._id.toString(), enrollment.createdAt as Date),
      type: "course",
      itemId: course?._id?.toString() || "",
      itemName: course?.title || "Course",
      itemImage: course?.thumbnail,
      amount: enrollment.amountPaid || 0,
      currency: enrollment.currency || "USD",
      status: enrollment.status,
      paymentStatus: enrollment.paymentStatus || (enrollment.isPaid ? "completed" : "pending"),
      createdAt: (enrollment.createdAt as Date).toISOString(),
      invoiceShortUrl: (enrollment as any).invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        progressPercentage: enrollment.progressPercentage,
        completedChapters: enrollment.completedChapters,
        totalChapters: enrollment.totalChapters,
        enrollmentStatus: enrollment.status,
      },
    };
  });

  return { items, total };
}

async function fetchWorkshopRegistrations(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const query: any = {
    orgId: new Types.ObjectId(orgId),
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? {
          ...(statusFilter === "completed" ? { hasPaid: true } : {}),
          ...(statusFilter === "pending" ? { hasPaid: false } : {}),
        }
      : {}),
  };

  if (search) {
    const re = new RegExp(search, "i");
    const { Workshop } = await import("../models/workshop.model");
    const matchingWorkshops = await Workshop.find({ title: re }).select("_id").lean();
    query.$or = [{ workshopId: { $in: matchingWorkshops.map((w) => w._id) } }];
  }

  const [total, registrations] = await Promise.all([
    WorkshopRegistration.countDocuments(query),
    WorkshopRegistration.find(query)
      .populate("userId", "name email profilePicture")
      .populate("workshopId", "title thumbnail scheduledDate scheduledTime timezone meetingUrl isRecurring")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items: UnifiedOrderItem[] = registrations.map((registration) => {
    const user = registration.userId as any;
    const workshop = registration.workshopId as any;
    return {
      _id: registration._id.toString(),
      orderNumber: generateOrderNumber("WKS", registration._id.toString(), registration.createdAt as Date),
      type: "workshop",
      itemId: workshop?._id?.toString() || "",
      itemName: workshop?.title || "Workshop",
      itemImage: workshop?.thumbnail,
      amount: registration.amountPaid || 0,
      currency: registration.currency || "USD",
      status: registration.status,
      paymentStatus: registration.hasPaid ? "completed" : "pending",
      createdAt: (registration.createdAt as Date).toISOString(),
      invoiceShortUrl: (registration as any).invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        eventDate: workshop?.scheduledDate?.toISOString(),
        eventTime: workshop?.scheduledTime,
        timezone: workshop?.timezone,
        meetingUrl: workshop?.meetingUrl,
        attendanceStatus: registration.status,
        isRecurring: workshop?.isRecurring,
      },
    };
  });

  return { items, total };
}

async function fetchChannelSubscriptions(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const { SubscriptionPayment } = await import("../models/subscriptionPayment.model");

  const query: any = {
    orgId: new Types.ObjectId(orgId),
    itemType: "channel",
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? { status: statusFilter === "completed" ? "active" : statusFilter === "pending" ? "created" : statusFilter }
      : {}),
  };

  if (search) {
    const re = new RegExp(search, "i");
    const matchingChannels = await Channel.find({ title: re }).select("_id").lean();
    query.$or = [{ itemId: { $in: matchingChannels.map((c) => c._id) } }];
  }

  // One-time channel purchases and FREE joins never create a Subscription —
  // checkout records them as `channel_checkout` invoices (invoiceType
  // one_time; free joins are $0 invoices marked paid). Union them in so a
  // community's order history covers all three acquisition paths. Recurring
  // invoices are excluded here — their Subscription row already represents
  // them.
  const { Invoice } = await import("../models/invoice.model");
  const invQuery: any = {
    organizationId: new Types.ObjectId(orgId),
    invoiceType: "one_time",
    "metadata.type": "channel_checkout",
    ...userFilter,
  };
  if (statusFilter && statusFilter !== "all") {
    if (statusFilter === "completed") invQuery.status = "paid";
    else if (statusFilter === "cancelled") invQuery.status = { $in: ["cancelled", "void", "expired", "failed"] };
    else invQuery.status = { $nin: ["paid", "cancelled", "void", "expired", "failed"] };
  }
  if (search) {
    invQuery["lineItems.itemName"] = new RegExp(search, "i");
  }

  // Merge-then-slice pagination: pull the first skip+limit rows of each
  // source, interleave by date, then window. Totals stay exact.
  const window = skip + limit;
  const [total, channelSubscriptions, invoiceTotal, channelInvoices] = await Promise.all([
    Subscription.countDocuments(query),
    Subscription.find(query)
      .populate("userId", "name email profilePicture")
      .populate("planId", "interval")
      .sort({ createdAt: -1 })
      .limit(window)
      .lean(),
    Invoice.countDocuments(invQuery),
    Invoice.find(invQuery)
      .populate("userId", "name email profilePicture")
      .sort({ createdAt: -1 })
      .limit(window)
      .lean(),
  ]);

  // Batch-fetch channel info and latest payments
  const channelIds = channelSubscriptions.map((s) => s.itemId);
  const subscriptionIds = channelSubscriptions.map((s) => s._id);

  const [channels, latestPayments] = await Promise.all([
    Channel.find({ _id: { $in: channelIds } }).select("title coverImage price currency").lean(),
    SubscriptionPayment.aggregate([
      { $match: { subscriptionId: { $in: subscriptionIds }, status: "captured" } },
      { $sort: { paymentNumber: -1 } },
      { $group: { _id: "$subscriptionId", latestPayment: { $first: "$$ROOT" } } },
    ]),
  ]);

  const channelMap = new Map(channels.map((c) => [c._id.toString(), c]));
  const paymentMap = new Map(latestPayments.map((p) => [p._id.toString(), p.latestPayment]));

  const subscriptionItems: UnifiedOrderItem[] = channelSubscriptions.map((subscription) => {
    const user = subscription.userId as any;
    const channel = channelMap.get(subscription.itemId.toString());
    const plan = subscription.planId as any;
    const latestPayment = paymentMap.get(subscription._id.toString());
    return {
      _id: subscription._id.toString(),
      orderNumber: generateOrderNumber("CHN", subscription._id.toString(), subscription.createdAt as Date),
      type: "channel",
      itemId: subscription.itemId?.toString() || "",
      itemName: channel?.title || "Channel",
      itemImage: channel?.coverImage || undefined,
      // No captured payment yet (pending/created subscription) → fall back to
      // the channel's own price so paid communities don't read as $0.
      amount: latestPayment?.amount ? latestPayment.amount / 100 : ((channel as any)?.price ?? 0),
      currency: (channel as any)?.currency || "USD",
      status: subscription.status,
      paymentStatus: ["active", "authenticated"].includes(subscription.status) ? "completed" : "pending",
      createdAt: (subscription.createdAt as Date).toISOString(),
      invoiceShortUrl: latestPayment?.invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        subscriptionStatus: subscription.status,
        currentPeriodEnd: subscription.currentEnd?.toISOString(),
        nextBillingDate: subscription.chargeAt?.toISOString(),
        billingCycle: plan?.interval,
      },
    };
  });

  const invoiceItems: UnifiedOrderItem[] = channelInvoices.map((inv: any) => {
    const user = inv.userId as any;
    const line = inv.lineItems?.[0];
    const cancelled = ["cancelled", "void", "expired", "failed"].includes(inv.status);
    return {
      _id: inv._id.toString(),
      orderNumber: inv.invoiceNumber || generateOrderNumber("CHN", inv._id.toString(), inv.createdAt as Date),
      type: "channel",
      itemId: line?.itemId?.toString() || "",
      itemName: line?.itemName || "Channel",
      itemImage: line?.itemImage || undefined,
      // Invoice totals are stored in cents.
      amount: (inv.totalAmount ?? 0) / 100,
      currency: inv.itemCurrency || "USD",
      status: inv.status,
      paymentStatus: inv.status === "paid" ? "completed" : cancelled ? "failed" : "pending",
      createdAt: (inv.createdAt as Date).toISOString(),
      invoiceShortUrl: inv.invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : inv.customerEmail
          ? { _id: "", name: inv.customerName || "", email: inv.customerEmail }
          : null,
      // One-time purchase → no subscription metadata (clients read that as
      // "One Time" frequency).
      metadata: {},
    };
  });

  const items = [...subscriptionItems, ...invoiceItems]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(skip, skip + limit);

  return { items, total: total + invoiceTotal };
}

async function fetchServiceOptIns(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const query: any = {
    organizationId: new Types.ObjectId(orgId),
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? { status: statusFilter === "completed" ? "completed" : statusFilter === "pending" ? "opted" : statusFilter }
      : {}),
  };

  if (search) {
    const re = new RegExp(search, "i");
    const matchingServices = await Service.find({ title: re }).select("_id").lean();
    query.$or = [{ serviceId: { $in: matchingServices.map((s) => s._id) } }];
  }

  const [total, serviceOptIns] = await Promise.all([
    ServiceOpt.countDocuments(query),
    ServiceOpt.find(query)
      .populate("userId", "name email profilePicture")
      .populate("serviceId", "title coverImage paymentTiming")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  const items: UnifiedOrderItem[] = serviceOptIns.map((optIn) => {
    const user = optIn.userId as any;
    const service = optIn.serviceId as any;
    let paymentStatus = "pending";
    if (optIn.totalAmount === 0) {
      paymentStatus = "completed";
    } else if (optIn.amountPaid >= optIn.totalAmount) {
      paymentStatus = "completed";
    } else if (optIn.amountPaid > 0) {
      paymentStatus = "partial";
    }
    return {
      _id: optIn._id.toString(),
      orderNumber: generateOrderNumber("SVC", optIn._id.toString(), optIn.createdAt as Date),
      type: "service",
      itemId: service?._id?.toString() || "",
      itemName: service?.title || "Service",
      itemImage: service?.coverImage,
      amount: optIn.totalAmount,
      currency: optIn.currency || "USD",
      status: optIn.status,
      paymentStatus,
      createdAt: (optIn.createdAt as Date).toISOString(),
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        serviceStatus: optIn.status,
        progressPercentage: optIn.progressPercentage,
        completedMilestones: optIn.completedMilestones,
        totalMilestones: optIn.totalMilestones,
        amountPaid: optIn.amountPaid,
        amountPending: optIn.amountPending,
        paymentTiming: service?.paymentTiming,
      },
    };
  });

  return { items, total };
}

async function fetchCallPurchases(
  orgId: string,
  userFilter: object,
  statusFilter: string | undefined,
  search: string | undefined,
  skip: number,
  limit: number
): Promise<{ items: UnifiedOrderItem[]; total: number }> {
  const { CallBooking } = await import("../models/callBooking.model");

  const query: any = {
    organizationId: new Types.ObjectId(orgId),
    ...userFilter,
    ...(statusFilter && statusFilter !== "all"
      ? { paymentStatus: statusFilter === "completed" ? "completed" : statusFilter }
      : {}),
  };

  if (search) {
    const re = new RegExp(search, "i");
    const matchingOfferings = await CallOffering.find({ title: re }).select("_id").lean();
    query.$or = [{ callOfferingId: { $in: matchingOfferings.map((o) => o._id) } }];
  }

  const [total, callPurchases] = await Promise.all([
    CallPurchase.countDocuments(query),
    CallPurchase.find(query)
      .populate("userId", "name email profilePicture")
      .populate("callOfferingId", "title coverImage duration createdBy")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Fetch next booking for each purchase
  const purchaseIds = callPurchases.map((p) => p._id);
  const nextBookings = await CallBooking.aggregate([
    {
      $match: {
        callPurchaseId: { $in: purchaseIds },
        status: "scheduled",
        startTime: { $gte: new Date() },
      },
    },
    { $sort: { startTime: 1 } },
    { $group: { _id: "$callPurchaseId", nextBooking: { $first: "$$ROOT" } } },
  ]);
  const nextBookingMap = new Map(nextBookings.map((b) => [b._id.toString(), b.nextBooking]));

  const items: UnifiedOrderItem[] = callPurchases.map((purchase) => {
    const user = purchase.userId as any;
    const callOffering = purchase.callOfferingId as any;
    const nextBooking = nextBookingMap.get(purchase._id.toString());
    let displayStatus = "active";
    if (purchase.quantityRemaining === 0) {
      displayStatus = "used";
    } else if (purchase.quantityScheduled > 0) {
      displayStatus = "scheduled";
    }
    return {
      _id: purchase._id.toString(),
      orderNumber: generateOrderNumber("CAL", purchase._id.toString(), purchase.createdAt as Date),
      type: "call",
      itemId: callOffering?._id?.toString() || "",
      itemName: callOffering?.title || "1:1 Call",
      itemImage: callOffering?.coverImage,
      amount: purchase.totalAmount,
      currency: purchase.currency || "USD",
      status: displayStatus,
      paymentStatus: purchase.paymentStatus,
      createdAt: (purchase.createdAt as Date).toISOString(),
      invoiceShortUrl: purchase.invoiceShortUrl,
      customer: user?._id
        ? { _id: user._id.toString(), name: user.name || "", email: user.email || "", profilePicture: user.profilePicture }
        : null,
      metadata: {
        quantityPurchased: purchase.quantityPurchased,
        quantityUsed: purchase.quantityUsed,
        quantityRemaining: purchase.quantityRemaining,
        quantityScheduled: purchase.quantityScheduled,
        callDuration: callOffering?.duration,
        nextBookingDate: nextBooking?.startTime?.toISOString(),
      },
    };
  });

  return { items, total };
}

// ─── Route Handler ───────────────────────────────────────────────────────────

// GET /unified-orders - Get all orders for the organization (founders only)
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    const orgId = user.orgId;
    const userId = user.userId;
    const userRole = user.role;

    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Parse query params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const type = req.query.type as UnifiedOrderType | "all" | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const skip = (page - 1) * limit;

    const isFounder = userRole === "founder";
    const userFilter = isFounder ? {} : { userId: new Types.ObjectId(userId) };

    // ── FAST PATH: single-type query with DB-level pagination ────────────────
    if (type && type !== "all") {
      let result: { items: UnifiedOrderItem[]; total: number };

      switch (type) {
        case "product":
          result = await fetchProductOrders(orgId, userFilter, status, search, skip, limit);
          break;
        case "course":
          result = await fetchCourseEnrollments(orgId, userFilter, status, search, skip, limit);
          break;
        case "workshop":
          result = await fetchWorkshopRegistrations(orgId, userFilter, status, search, skip, limit);
          break;
        case "channel":
          result = await fetchChannelSubscriptions(orgId, userFilter, status, search, skip, limit);
          break;
        case "service":
          result = await fetchServiceOptIns(orgId, userFilter, status, search, skip, limit);
          break;
        case "call":
          result = await fetchCallPurchases(orgId, userFilter, status, search, skip, limit);
          break;
        default:
          return res.status(400).json({ error: "Invalid order type" });
      }

      const totalPages = Math.ceil(result.total / limit);
      const typeCounts: UnifiedOrdersResponse["counts"] = {
        all: result.total,
        product: type === "product" ? result.total : 0,
        course: type === "course" ? result.total : 0,
        workshop: type === "workshop" ? result.total : 0,
        channel: type === "channel" ? result.total : 0,
        service: type === "service" ? result.total : 0,
        call: type === "call" ? result.total : 0,
      };

      return res.json({
        orders: result.items,
        pagination: { page, limit, total: result.total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
        counts: typeCounts,
      } as UnifiedOrdersResponse);
    }

    // ── SLOW PATH: type=all — run all 6 fetchers in parallel, merge in memory ─
    // We fetch without skip/limit here then paginate in JS (unavoidable for cross-collection merge+sort)
    // But at least all 6 run in parallel now
    const [productRes, courseRes, workshopRes, channelRes, serviceRes, callRes] = await Promise.all([
      fetchProductOrders(orgId, userFilter, status, search, 0, 10000),
      fetchCourseEnrollments(orgId, userFilter, status, search, 0, 10000),
      fetchWorkshopRegistrations(orgId, userFilter, status, search, 0, 10000),
      fetchChannelSubscriptions(orgId, userFilter, status, search, 0, 10000),
      fetchServiceOptIns(orgId, userFilter, status, search, 0, 10000),
      fetchCallPurchases(orgId, userFilter, status, search, 0, 10000),
    ]);

    const allOrders: UnifiedOrderItem[] = [
      ...productRes.items,
      ...courseRes.items,
      ...workshopRes.items,
      ...channelRes.items,
      ...serviceRes.items,
      ...callRes.items,
    ];

    // Sort by createdAt descending
    allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Counts (based on individual totals from DB, not JS filter — accurate even with search)
    const counts: UnifiedOrdersResponse["counts"] = {
      all: allOrders.length,
      product: productRes.total,
      course: courseRes.total,
      workshop: workshopRes.total,
      channel: channelRes.total,
      service: serviceRes.total,
      call: callRes.total,
    };

    // Paginate
    const total = allOrders.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedOrders = allOrders.slice(skip, skip + limit);

    return res.json({
      orders: paginatedOrders,
      pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
      counts,
    } as UnifiedOrdersResponse);
  } catch (error) {
    console.error("Error fetching unified orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /unified-orders/counts - Get order counts by type (for quick stats)
router.get("/counts", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string; orgId: string; role?: string };
    const orgId = user.orgId;
    const userId = user.userId;
    const userRole = user.role;

    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const isFounder = userRole === "founder";
    const userFilter = isFounder ? {} : { userId: new Types.ObjectId(userId) };

    const { Invoice } = await import("../models/invoice.model");
    const [productCount, courseCount, workshopCount, subscriptionCount, channelInvoiceCount, serviceCount, callCount] = await Promise.all([
      ProductOrder.countDocuments({
        organizationId: new Types.ObjectId(orgId),
        ...userFilter,
      }),
      CourseEnrollment.countDocuments({
        organizationId: new Types.ObjectId(orgId),
        ...userFilter,
      }),
      WorkshopRegistration.countDocuments({
        orgId: new Types.ObjectId(orgId),
        ...userFilter,
      }),
      Subscription.countDocuments({
        orgId: new Types.ObjectId(orgId),
        itemType: "channel",
        ...userFilter,
      }),
      // Free joins + one-time channel purchases live as channel_checkout
      // invoices, not Subscriptions — keep this count in step with the list.
      Invoice.countDocuments({
        organizationId: new Types.ObjectId(orgId),
        invoiceType: "one_time",
        "metadata.type": "channel_checkout",
        ...userFilter,
      }),
      ServiceOpt.countDocuments({
        organizationId: new Types.ObjectId(orgId),
        ...userFilter,
      }),
      CallPurchase.countDocuments({
        organizationId: new Types.ObjectId(orgId),
        ...userFilter,
      }),
    ]);

    const channelCount = subscriptionCount + channelInvoiceCount;
    res.json({
      all: productCount + courseCount + workshopCount + channelCount + serviceCount + callCount,
      product: productCount,
      course: courseCount,
      workshop: workshopCount,
      channel: channelCount,
      service: serviceCount,
      call: callCount,
    });
  } catch (error) {
    console.error("Error fetching order counts:", error);
    res.status(500).json({ error: "Failed to fetch order counts" });
  }
});

export default router;
