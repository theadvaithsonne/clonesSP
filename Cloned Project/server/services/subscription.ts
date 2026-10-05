import mongoose, { Types } from "mongoose";
import {
  SubscriptionPlan,
  ISubscriptionPlan,
  SubscriptionItemType,
  SubscriptionPeriod,
} from "../models/subscriptionPlan.model";
import {
  Subscription,
  ISubscription,
  SubscriptionStatus,
} from "../models/subscription.model";
import {
  SubscriptionPayment,
  ISubscriptionPayment,
} from "../models/subscriptionPayment.model";
import {
  createPlan as createRazorpayPlan,
  createSubscription as createRazorpaySubscription,
  fetchSubscription as fetchRazorpaySubscription,
  cancelSubscription as cancelRazorpaySubscription,
  pauseSubscription as pauseRazorpaySubscription,
  resumeSubscription as resumeRazorpaySubscription,
  RazorpaySubscription,
} from "./razorpay";
import { distributeCommissions } from "./commission";
import { getSocketInstance } from "./socket";

// Helper to safely get socket instance and emit events
function emitToUser(userId: string | Types.ObjectId, event: string, data: any) {
  const io = getSocketInstance();
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

// ============ Helper Functions ============

/**
 * Convert subscription period to Razorpay period format
 */
function periodToRazorpay(
  period: SubscriptionPeriod
): "daily" | "weekly" | "monthly" | "yearly" {
  switch (period) {
    case "weekly":
      return "weekly";
    case "monthly":
      return "monthly";
    case "quarterly":
      return "monthly"; // Quarterly = 3 months
    case "yearly":
      return "yearly";
    default:
      return "monthly";
  }
}

/**
 * Get interval for Razorpay based on period
 */
function getIntervalForPeriod(period: SubscriptionPeriod): number {
  switch (period) {
    case "weekly":
      return 1;
    case "monthly":
      return 1;
    case "quarterly":
      return 3; // 3 months
    case "yearly":
      return 1;
    default:
      return 1;
  }
}

/**
 * Convert Unix timestamp to Date
 */
function unixToDate(timestamp: number | null): Date | undefined {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000);
}

/**
 * Razorpay's /plans endpoint silently 500s when `item.name` or
 * `item.description` contain emoji or other non-BMP / pictographic
 * Unicode characters — we reproduced this against the live API with the
 * exact failing channel description. Razorpay returns SERVER_ERROR
 * instead of a clean validation error, which is why the bug took so
 * long to diagnose.
 *
 * Sanitize: strip the offending characters, collapse whitespace, cap at
 * 500 chars (Razorpay accepts much more, but plan text is informational —
 * no reason to ship a kilobyte of marketing copy to their API).
 */
function razorpaySafeText(s: string | undefined, maxLen = 500): string {
  if (!s) return "";
  return s
    // Drop supplementary-plane characters (emoji, most pictographs,
    // flags) — the codepoints that broke the API in repro.
    .replace(/[\u{10000}-\u{10FFFF}]/gu, "")
    // Drop BMP symbol blocks Razorpay also chokes on: Misc Symbols,
    // Dingbats, Misc Symbols & Pictographs, etc.
    .replace(/[☀-➿]/g, "")
    // Collapse whitespace from stripped chars and clean up.
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ============ Plan Management ============

export interface CreatePlanInput {
  itemType: SubscriptionItemType;
  itemId: string;
  orgId: string;
  sellerId: string;
  name: string;
  description?: string;
  amount: number; // In smallest unit (paise/cents)
  currency?: string;
  period: SubscriptionPeriod;
  trialDays?: number;
  // When true, the `amount` already includes any applicable tax (e.g. GST) —
  // Razorpay charges exactly the amount specified, no additional tax math
  // on their end. When false/undefined, Razorpay treats `amount` as pre-tax
  // and may apply its own tax math (we don't rely on that today). Default
  // false to preserve legacy behavior; channel + office subscriptions set
  // true when the listed price is GST-inclusive.
  taxInclusive?: boolean;
}

/**
 * Create a subscription plan for a content item
 */
export async function createSubscriptionPlan(
  input: CreatePlanInput
): Promise<ISubscriptionPlan> {
  const { itemType, itemId, orgId, sellerId, name, description, amount, currency = "USD", period, trialDays, taxInclusive = false } =
    input;

  // Check if active plan already exists
  const existingPlan = await SubscriptionPlan.findOne({
    itemType,
    itemId: new Types.ObjectId(itemId),
    isActive: true,
  });

  if (existingPlan) {
    throw new Error("An active subscription plan already exists for this item");
  }

  // Create plan in Razorpay
  const razorpayPeriod = periodToRazorpay(period);
  const interval = getIntervalForPeriod(period);

  // Razorpay 500s on emoji / pictographic Unicode in plan name +
  // description. Channel titles and descriptions routinely contain them
  // (🔓 ✅ 📈 etc.) so sanitize before sending. See `razorpaySafeText`.
  const safeName = razorpaySafeText(name, 200) || "Subscription";
  const safeDescription =
    razorpaySafeText(description, 500) ||
    razorpaySafeText(`${period} subscription for ${name}`, 500) ||
    "Recurring subscription";

  const planPayload = {
    period: razorpayPeriod,
    interval,
    item: {
      name: safeName,
      amount,
      currency,
      description: safeDescription,
      tax_inclusive: taxInclusive,
    },
    notes: {
      itemType,
      itemId,
      orgId,
      sellerId,
    },
  };

  let razorpayPlan;
  try {
    razorpayPlan = await createRazorpayPlan(planPayload);
  } catch (err: any) {
    // Log the EXACT request body alongside Razorpay's response so we can
    // diagnose 5xx/SERVER_ERROR responses without needing the Razorpay
    // dashboard. Razorpay 4xx errors carry useful descriptions; 5xx ones
    // don't, so the request body is the only forensic data we have.
    const status = err?.statusCode;
    const code = err?.error?.code;
    const description = err?.error?.description;
    console.error("[createSubscriptionPlan] Razorpay plans.create failed", {
      itemType,
      itemId,
      orgId,
      sellerId,
      razorpay: {
        statusCode: status,
        code,
        description,
      },
      requestPayload: planPayload,
    });
    throw err;
  }

  // Create plan in database
  const plan = await SubscriptionPlan.create({
    razorpayPlanId: razorpayPlan.id,
    itemType,
    itemId: new Types.ObjectId(itemId),
    orgId: new Types.ObjectId(orgId),
    sellerId: new Types.ObjectId(sellerId),
    name,
    description,
    amount,
    currency,
    period,
    interval,
    trialDays: trialDays || 0,
    isActive: true,
  });

  return plan;
}

/**
 * Get subscription plan for an item
 */
export async function getSubscriptionPlanForItem(
  itemType: SubscriptionItemType,
  itemId: string
): Promise<ISubscriptionPlan | null> {
  return SubscriptionPlan.findOne({
    itemType,
    itemId: new Types.ObjectId(itemId),
    isActive: true,
  }).lean();
}

/**
 * Get subscription plan by ID
 */
export async function getSubscriptionPlan(
  planId: string
): Promise<ISubscriptionPlan | null> {
  return SubscriptionPlan.findById(planId).lean();
}

/**
 * Deactivate a subscription plan
 */
export async function deactivateSubscriptionPlan(
  planId: string
): Promise<ISubscriptionPlan | null> {
  return SubscriptionPlan.findByIdAndUpdate(
    planId,
    { isActive: false },
    { new: true }
  );
}

// ============ Subscription Management ============

export interface CreateSubscriptionInput {
  planId: string;
  userId: string;
  orgId: string;
  totalCount?: number; // null for infinite
  offerId?: string; // Razorpay offer ID for discounts
}

/**
 * Create a subscription for a user
 */
export async function createUserSubscription(
  input: CreateSubscriptionInput
): Promise<ISubscription> {
  const { planId, userId, orgId, totalCount, offerId } = input;

  // Get plan
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    throw new Error("Subscription plan not found");
  }

  if (!plan.isActive) {
    throw new Error("Subscription plan is not active");
  }

  // ── Block only on a GENUINELY live subscription ────────────────────
  // Billing runs through our own Invoice cascade, NOT Razorpay subscriptions,
  // so a Subscription doc is a Razorpay mirror that nothing ever advances —
  // rows sit at "created" for the life of the subscription even after several
  // cycles have been paid by invoice. Treating "created"/"pending" as
  // "subscribed" (as this check used to) rejected buyers who had merely
  // abandoned a checkout, with a message claiming they were already
  // subscribed. Access is owned by the paid Invoice and the membership /
  // enrolment it materialises — callers gate on that via
  // `hasSubscriptionAccess` before reaching this function.
  //
  // Same predicate as `hasSubscriptionAccess` / `getUserActiveSubscription`
  // so all three agree on what "live" means.
  const liveSubscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    itemType: plan.itemType,
    itemId: plan.itemId,
    status: { $in: ["active", "authenticated"] },
  });

  if (
    liveSubscription &&
    !(liveSubscription.currentEnd && liveSubscription.currentEnd < new Date())
  ) {
    throw new Error("User already has an active subscription for this item");
  }

  // Supersede leftovers from abandoned attempts. A "created" row is a Razorpay
  // stub written before the buyer ever paid, and "pending" is its awaiting-
  // mandate sibling; neither grants anything, and leaving them behind is what
  // made every retry fail. Cancelling them here (rather than in one route)
  // covers channels, courses, workshops and products alike.
  await Subscription.updateMany(
    {
      userId: new Types.ObjectId(userId),
      itemType: plan.itemType,
      itemId: plan.itemId,
      status: { $in: ["created", "pending"] },
    },
    { $set: { status: "cancelled", cancelledAt: new Date() } }
  );

  // Create subscription in Razorpay
  // Default to 120 billing cycles (10 years for monthly, ~2.3 years for weekly)
  // This effectively makes it an ongoing subscription that can be cancelled anytime
  const defaultTotalCount = 120;
  const razorpayOptions: any = {
    plan_id: plan.razorpayPlanId,
    total_count: totalCount || defaultTotalCount,
    customer_notify: 1,
    notes: {
      planId: plan._id.toString(),
      userId,
      orgId,
      itemType: plan.itemType,
      itemId: plan.itemId.toString(),
      sellerId: plan.sellerId.toString(),
    },
  };

  // Add offer_id if provided (for coupon discounts)
  if (offerId) {
    razorpayOptions.offer_id = offerId;
  }

  const razorpaySubscription = await createRazorpaySubscription(razorpayOptions);

  // Create subscription in database
  const subscription = await Subscription.create({
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayPlanId: plan.razorpayPlanId,
    razorpayCustomerId: razorpaySubscription.customer_id,
    planId: plan._id,
    userId: new Types.ObjectId(userId),
    orgId: new Types.ObjectId(orgId),
    itemType: plan.itemType,
    itemId: plan.itemId,
    sellerId: plan.sellerId,
    status: "created",
    totalCount: razorpaySubscription.total_count,
    paidCount: 0,
    remainingCount: razorpaySubscription.remaining_count,
    shortUrl: razorpaySubscription.short_url,
    offerId: offerId || undefined, // Store offer ID for tracking
  });

  return subscription;
}

/**
 * Get user's subscription for an item
 */
export async function getUserSubscription(
  userId: string,
  itemType: SubscriptionItemType,
  itemId: string
): Promise<ISubscription | null> {
  return Subscription.findOne({
    userId: new Types.ObjectId(userId),
    itemType,
    itemId: new Types.ObjectId(itemId),
  })
    .sort({ createdAt: -1 })
    .lean();
}

/**
 * Get user's active subscription for an item
 */
export async function getUserActiveSubscription(
  userId: string,
  itemType: SubscriptionItemType,
  itemId: string
): Promise<ISubscription | null> {
  return Subscription.findOne({
    userId: new Types.ObjectId(userId),
    itemType,
    itemId: new Types.ObjectId(itemId),
    status: { $in: ["active", "authenticated"] },
  }).lean();
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(
  userId: string,
  options: {
    status?: SubscriptionStatus | SubscriptionStatus[];
    itemType?: SubscriptionItemType;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ subscriptions: ISubscription[]; total: number }> {
  const { status, itemType, limit = 50, offset = 0 } = options;

  const query: any = { userId: new Types.ObjectId(userId) };
  if (status) {
    query.status = Array.isArray(status) ? { $in: status } : status;
  }
  if (itemType) {
    query.itemType = itemType;
  }

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("planId")
      .lean(),
    Subscription.countDocuments(query),
  ]);

  return { subscriptions, total };
}

/**
 * Cancel a subscription
 */
export async function cancelUserSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true
): Promise<ISubscription> {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (!["active", "authenticated", "pending"].includes(subscription.status)) {
    throw new Error("Subscription cannot be cancelled in current state");
  }

  // Cancel in Razorpay
  await cancelRazorpaySubscription(
    subscription.razorpaySubscriptionId,
    cancelAtCycleEnd
  );

  // Update in database
  subscription.status = "cancelled";
  subscription.cancelledAt = new Date();
  await subscription.save();

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "cancelled",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    endDate: subscription.currentEnd,
  });

  return subscription;
}

/**
 * Pause a subscription
 */
export async function pauseUserSubscription(
  subscriptionId: string
): Promise<ISubscription> {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (subscription.status !== "active") {
    throw new Error("Only active subscriptions can be paused");
  }

  // Pause in Razorpay
  await pauseRazorpaySubscription(subscription.razorpaySubscriptionId);

  // Update in database
  subscription.status = "paused";
  subscription.pausedAt = new Date();
  await subscription.save();

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "paused",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
  });

  return subscription;
}

/**
 * Resume a paused subscription
 */
export async function resumeUserSubscription(
  subscriptionId: string
): Promise<ISubscription> {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (subscription.status !== "paused") {
    throw new Error("Only paused subscriptions can be resumed");
  }

  // Resume in Razorpay
  await resumeRazorpaySubscription(subscription.razorpaySubscriptionId);

  // Update in database
  subscription.status = "active";
  subscription.pausedAt = undefined;
  await subscription.save();

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "resumed",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
  });

  return subscription;
}

// ============ Webhook Handlers ============

/**
 * Handle subscription authenticated event
 */
export async function handleSubscriptionAuthenticated(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.error(
      `Subscription not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  subscription.status = "authenticated";
  subscription.razorpayCustomerId = razorpaySubscription.customer_id || undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;
  await subscription.save();

  console.log(`Subscription ${subscription._id} authenticated`);
}

/**
 * Handle subscription activated event (first payment successful)
 */
export async function handleSubscriptionActivated(
  razorpaySubscription: RazorpaySubscription,
  payment?: any
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.error(
      `Subscription not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  const plan = await SubscriptionPlan.findById(subscription.planId);
  if (!plan) {
    console.error(`Plan not found for subscription: ${subscription._id}`);
    return;
  }

  // Update subscription
  subscription.status = "active";
  subscription.startedAt = new Date();
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount = razorpaySubscription.remaining_count ?? undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;
  await subscription.save();

  // Record payment if provided
  if (payment) {
    await recordSubscriptionPayment(subscription, payment, 1);
  }

  // Distribute commission for first payment
  await distributeSubscriptionCommission(subscription, plan, 1);

  // Grant access
  await grantSubscriptionAccess(subscription);

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "activated",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    currentEnd: subscription.currentEnd,
  });

  console.log(`Subscription ${subscription._id} activated`);
}

/**
 * Handle subscription charged event (recurring payment successful)
 */
export async function handleSubscriptionCharged(
  razorpaySubscription: RazorpaySubscription,
  payment: any
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.error(
      `Subscription not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  const plan = await SubscriptionPlan.findById(subscription.planId);
  if (!plan) {
    console.error(`Plan not found for subscription: ${subscription._id}`);
    return;
  }

  const paymentNumber = razorpaySubscription.paid_count;

  // Update subscription
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount = razorpaySubscription.remaining_count ?? undefined;
  await subscription.save();

  // Record payment
  await recordSubscriptionPayment(subscription, payment, paymentNumber);

  // Distribute commission for this payment
  await distributeSubscriptionCommission(subscription, plan, paymentNumber);

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "charged",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    paymentNumber,
    currentEnd: subscription.currentEnd,
    nextChargeDate: subscription.chargeAt,
  });

  console.log(
    `Subscription ${subscription._id} charged (payment #${paymentNumber})`
  );
}

/**
 * Handle subscription pending event
 */
export async function handleSubscriptionPending(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "pending";
  await subscription.save();

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "pending",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    message: "Payment is pending. Please check your payment method.",
  });

  console.log(`Subscription ${subscription._id} pending`);
}

/**
 * Handle subscription halted event (payment failed after retries)
 */
export async function handleSubscriptionHalted(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "halted";
  await subscription.save();

  // Revoke access
  await revokeSubscriptionAccess(subscription);

  // Notify user urgently
  emitToUser(subscription.userId, "subscription:update", {
    type: "halted",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    message:
      "Your subscription payment failed. Access has been revoked. Please update your payment method.",
  });

  console.log(`Subscription ${subscription._id} halted`);
}

/**
 * Handle subscription cancelled event
 */
export async function handleSubscriptionCancelled(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "cancelled";
  subscription.endedAt = unixToDate(razorpaySubscription.ended_at) || new Date();
  await subscription.save();

  // Access remains until currentEnd
  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "cancelled",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    endDate: subscription.currentEnd,
    message: `Your subscription has been cancelled. Access will end on ${subscription.currentEnd?.toLocaleDateString()}.`,
  });

  console.log(`Subscription ${subscription._id} cancelled`);
}

/**
 * Handle subscription completed event
 */
export async function handleSubscriptionCompleted(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "completed";
  subscription.endedAt = new Date();
  await subscription.save();

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "completed",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    message: "Your subscription has completed all billing cycles.",
  });

  console.log(`Subscription ${subscription._id} completed`);
}

/**
 * Handle subscription paused event
 */
export async function handleSubscriptionPaused(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "paused";
  subscription.pausedAt = new Date();
  await subscription.save();

  // Pause access
  await revokeSubscriptionAccess(subscription);

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "paused",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
  });

  console.log(`Subscription ${subscription._id} paused`);
}

/**
 * Handle subscription resumed event
 */
export async function handleSubscriptionResumed(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  const subscription = await Subscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    return;
  }

  subscription.status = "active";
  subscription.pausedAt = undefined;
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  await subscription.save();

  // Restore access
  await grantSubscriptionAccess(subscription);

  // Notify user
  emitToUser(subscription.userId, "subscription:update", {
    type: "resumed",
    subscriptionId: subscription._id,
    itemType: subscription.itemType,
    itemId: subscription.itemId,
    currentEnd: subscription.currentEnd,
  });

  console.log(`Subscription ${subscription._id} resumed`);
}

// ============ Helper Functions ============

/**
 * Record a subscription payment
 */
async function recordSubscriptionPayment(
  subscription: ISubscription,
  payment: any,
  paymentNumber: number
): Promise<ISubscriptionPayment> {
  // Check for duplicate
  const existing = await SubscriptionPayment.findOne({
    razorpayPaymentId: payment.id,
  });

  if (existing) {
    return existing;
  }

  // Try to fetch invoice short_url if invoice_id exists
  let invoiceShortUrl: string | undefined;
  if (payment.invoice_id) {
    try {
      const { fetchInvoice } = await import("./razorpay");
      const invoice = await fetchInvoice(payment.invoice_id);
      invoiceShortUrl = invoice.short_url;
      console.log(`[SubscriptionPayment] Fetched invoice short_url: ${invoiceShortUrl}`);
    } catch (error) {
      console.error(`[SubscriptionPayment] Failed to fetch invoice ${payment.invoice_id}:`, error);
    }
  }

  const subscriptionPayment = await SubscriptionPayment.create({
    subscriptionId: subscription._id,
    razorpayPaymentId: payment.id,
    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
    razorpayOrderId: payment.order_id,
    razorpayInvoiceId: payment.invoice_id,
    invoiceShortUrl,
    userId: subscription.userId,
    orgId: subscription.orgId,
    sellerId: subscription.sellerId,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status === "captured" ? "captured" : "authorized",
    paymentNumber,
    method: payment.method,
    cardId: payment.card_id,
    bank: payment.bank,
    wallet: payment.wallet,
    vpa: payment.vpa,
    fee: payment.fee,
    tax: payment.tax,
    notes: payment.notes,
    commissionDistributed: false,
    paidAt: new Date(payment.created_at * 1000),
  });

  return subscriptionPayment;
}

/**
 * Distribute commission for a subscription payment
 */
async function distributeSubscriptionCommission(
  subscription: ISubscription,
  plan: ISubscriptionPlan,
  paymentNumber: number
): Promise<void> {
  try {
    // Check if already distributed for this payment
    const existingPayment = await SubscriptionPayment.findOne({
      subscriptionId: subscription._id,
      paymentNumber,
      commissionDistributed: true,
    });

    if (existingPayment) {
      console.log(
        `Commission already distributed for subscription ${subscription._id} payment #${paymentNumber}`
      );
      return;
    }

    // Distribute commission
    const result = await distributeCommissions({
      orgId: subscription.orgId.toString(),
      sellerId: subscription.sellerId.toString(),
      customerId: subscription.userId.toString(),
      itemType: plan.itemType as any,
      itemId: plan.itemId.toString(),
      itemName: plan.name,
      saleAmount: plan.amount / 100, // Convert from paise to INR
      currency: plan.currency,
      paymentId: `sub_${subscription.razorpaySubscriptionId}_${paymentNumber}`,
      isRecurringPayment: true,
      recurringPaymentNumber: paymentNumber,
      metadata: {
        subscriptionId: subscription._id.toString(),
        planId: plan._id.toString(),
      },
    });

    // Mark payment as commission distributed
    await SubscriptionPayment.updateOne(
      { subscriptionId: subscription._id, paymentNumber },
      {
        commissionDistributed: true,
        commissionDistributionId: result.distribution._id,
      }
    );

    console.log(
      `Commission distributed for subscription ${subscription._id} payment #${paymentNumber}`
    );
  } catch (error) {
    console.error(
      `Failed to distribute commission for subscription ${subscription._id}:`,
      error
    );
  }
}

/**
 * Grant access based on subscription
 * This should be customized based on itemType
 */
async function grantSubscriptionAccess(
  subscription: ISubscription
): Promise<void> {
  // TODO: Implement access granting based on itemType
  // For channels: Add to ChannelMembership
  // For courses: Update CourseEnrollment
  // For workshops: Update WorkshopRegistration
  // For products: Update ProductOrder or create access record

  console.log(
    `Access granted for subscription ${subscription._id} (${subscription.itemType}:${subscription.itemId})`
  );
}

/**
 * Revoke access based on subscription
 * This should be customized based on itemType
 */
async function revokeSubscriptionAccess(
  subscription: ISubscription
): Promise<void> {
  // TODO: Implement access revocation based on itemType
  // For channels: Update ChannelMembership status
  // For courses: Update CourseEnrollment access
  // For workshops: Update WorkshopRegistration access
  // For products: Update access record

  console.log(
    `Access revoked for subscription ${subscription._id} (${subscription.itemType}:${subscription.itemId})`
  );
}

// ============ Access Check ============

/**
 * Check if user has active subscription access to an item
 */
export async function hasSubscriptionAccess(
  userId: string,
  itemType: SubscriptionItemType,
  itemId: string
): Promise<boolean> {
  const subscription = await Subscription.findOne({
    userId: new Types.ObjectId(userId),
    itemType,
    itemId: new Types.ObjectId(itemId),
    status: { $in: ["active", "authenticated"] },
  });

  if (!subscription) {
    return false;
  }

  // Check if subscription is still valid
  if (subscription.currentEnd && subscription.currentEnd < new Date()) {
    return false;
  }

  return true;
}

// ============ Sync with Razorpay ============

/**
 * Sync subscription status with Razorpay
 */
export async function syncSubscriptionStatus(
  subscriptionId: string
): Promise<ISubscription | null> {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription) {
    return null;
  }

  const razorpaySubscription = await fetchRazorpaySubscription(
    subscription.razorpaySubscriptionId
  );

  subscription.status = razorpaySubscription.status as SubscriptionStatus;
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount = razorpaySubscription.remaining_count ?? undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;

  if (razorpaySubscription.ended_at) {
    subscription.endedAt = unixToDate(razorpaySubscription.ended_at);
  }

  await subscription.save();
  return subscription;
}
