import Razorpay from "razorpay";
import crypto from "crypto";

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "",
});

export interface CouponPromotion {
  reference_id: string;
  code: string;
  type: "coupon" | "offer";
  value: number;
  value_type: "percentage" | "fixed_amount";
  description?: string;
}

export interface CreateOrderOptions {
  amount: number; // Amount in paise (INR)
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
  promotions?: CouponPromotion[];
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  notes: Record<string, string>;
  created_at: number;
}

// ============ Subscription Types ============

export interface CreatePlanOptions {
  period: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  item: {
    name: string;
    amount: number; // In paise
    currency?: string;
    description?: string;
    // Tax fields (configured via Razorpay Dashboard first)
    tax_inclusive?: boolean; // false = tax added on top
    sac_code?: string; // SAC code for services (e.g., "998314" for IT/SaaS)
    hsn_code?: string; // HSN code for goods
    tax_id?: string; // Tax ID from Razorpay Dashboard
    tax_group_id?: string; // Tax Group ID from Razorpay Dashboard
  };
  notes?: Record<string, string>;
}

export interface RazorpayPlan {
  id: string;
  entity: string;
  interval: number;
  period: string;
  item: {
    id: string;
    active: boolean;
    amount: number;
    unit_amount: number;
    currency: string;
    name: string;
    description: string;
    type: string;
    unit: string | null;
    tax_inclusive: boolean;
    hsn_code: string | null;
    sac_code: string | null;
    tax_rate: string | null;
    tax_id: string | null;
    tax_group_id: string | null;
  };
  notes: Record<string, string>;
  created_at: number;
}

export interface CreateSubscriptionOptions {
  plan_id: string;
  total_count?: number; // Total billing cycles (null for infinite)
  quantity?: number;
  start_at?: number; // Unix timestamp
  expire_by?: number; // Unix timestamp
  customer_notify?: 0 | 1;
  notes?: Record<string, string>;
  offer_id?: string;
  customer_id?: string; // Link subscription to a customer for GSTIN on invoices
}

// ============ Customer Types ============

export interface CreateCustomerOptions {
  name: string;
  email: string;
  contact?: string; // Phone number
  gstin?: string; // 15-char GSTIN for B2B customers
  notes?: Record<string, string>;
}

export interface RazorpayCustomer {
  id: string;
  entity: string;
  name: string;
  email: string;
  contact: string | null;
  gstin: string | null;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id: string | null;
  status:
    | "created"
    | "authenticated"
    | "active"
    | "pending"
    | "halted"
    | "cancelled"
    | "completed"
    | "expired"
    | "paused";
  current_start: number | null;
  current_end: number | null;
  ended_at: number | null;
  quantity: number;
  notes: Record<string, string>;
  charge_at: number | null;
  start_at: number | null;
  offer_id: string | null;
  short_url: string;
  has_scheduled_changes: boolean;
  change_scheduled_at: number | null;
  source: string;
  payment_method: string | null;
  created_at: number;
  expire_by: number | null;
  customer_notify: number;
  total_count: number | null;
  paid_count: number;
  remaining_count: number | null;
}

/**
 * Create a Razorpay order for one-time payment
 * Supports promotions (coupons) for discounts
 */
export async function createOrder(
  options: CreateOrderOptions
): Promise<RazorpayOrder> {
  const orderOptions: any = {
    amount: options.amount, // Amount in paise
    currency: options.currency || "INR",
    receipt: options.receipt || `receipt_${Date.now()}`,
    notes: options.notes || {},
  };

  // Add promotions if provided (for coupon discounts)
  if (options.promotions && options.promotions.length > 0) {
    orderOptions.promotions = options.promotions;
  }

  const order = await razorpay.orders.create(orderOptions);
  return order as RazorpayOrder;
}

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET || "";
  const body = orderId + "|" + paymentId;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  return expectedSignature === signature;
}

/**
 * Fetch payment details from Razorpay
 */
export async function fetchPayment(paymentId: string): Promise<any> {
  const payment = await razorpay.payments.fetch(paymentId);
  return payment;
}

/**
 * Fetch order details from Razorpay
 */
export async function fetchOrder(orderId: string): Promise<any> {
  const order = await razorpay.orders.fetch(orderId);
  return order;
}

/**
 * Create order for channel subscription
 */
export async function createChannelSubscriptionOrder(
  channelId: string,
  channelTitle: string,
  amount: number,
  userId: string,
  orgId: string,
  currency: string = "USD"
): Promise<RazorpayOrder> {
  // Receipt must be max 40 chars: ch_ (3) + last 12 of channelId + _ (1) + timestamp last 10 = 26 chars
  const shortId = channelId.slice(-12);
  const shortTs = Date.now().toString().slice(-10);
  return createOrder({
    amount: amount * 100, // Convert to smallest unit (paise/cents)
    currency,
    receipt: `ch_${shortId}_${shortTs}`,
    notes: {
      channelId,
      channelTitle,
      userId,
      orgId,
      type: "channel_subscription",
    },
  });
}

// ============ Plan Management ============

/**
 * Create a Razorpay plan for recurring subscriptions
 * Note: For GST to work, you must first configure tax rates in Razorpay Dashboard
 * and pass the tax_id or tax_group_id here
 */
export async function createPlan(
  options: CreatePlanOptions
): Promise<RazorpayPlan> {
  const itemOptions: any = {
    name: options.item.name,
    amount: options.item.amount,
    currency: options.item.currency || "INR",
    description: options.item.description || "",
  };

  // Add tax fields if provided
  if (options.item.tax_inclusive !== undefined) {
    itemOptions.tax_inclusive = options.item.tax_inclusive;
  }
  if (options.item.sac_code) {
    itemOptions.sac_code = options.item.sac_code;
  }
  if (options.item.hsn_code) {
    itemOptions.hsn_code = options.item.hsn_code;
  }
  if (options.item.tax_id) {
    itemOptions.tax_id = options.item.tax_id;
  }
  if (options.item.tax_group_id) {
    itemOptions.tax_group_id = options.item.tax_group_id;
  }

  const planOptions = {
    period: options.period,
    interval: options.interval,
    item: itemOptions,
    notes: options.notes || {},
  };

  const plan = await razorpay.plans.create(planOptions);
  return plan as RazorpayPlan;
}

/**
 * Fetch a Razorpay plan by ID
 */
export async function fetchPlan(planId: string): Promise<RazorpayPlan> {
  const plan = await razorpay.plans.fetch(planId);
  return plan as RazorpayPlan;
}

/**
 * List all Razorpay plans
 */
export async function listPlans(options?: {
  count?: number;
  skip?: number;
}): Promise<{ items: RazorpayPlan[]; count: number }> {
  const plans = await razorpay.plans.all(options || {});
  return plans as unknown as { items: RazorpayPlan[]; count: number };
}

// ============ Customer Management ============

/**
 * Create a Razorpay customer
 * Used to link GSTIN to subscriptions for GST invoicing
 */
export async function createCustomer(
  options: CreateCustomerOptions
): Promise<RazorpayCustomer> {
  const customerOptions: any = {
    name: options.name,
    email: options.email,
    notes: options.notes || {},
  };

  if (options.contact) {
    customerOptions.contact = options.contact;
  }
  if (options.gstin) {
    customerOptions.gstin = options.gstin;
  }

  const customer = await razorpay.customers.create(customerOptions);
  return customer as unknown as RazorpayCustomer;
}

/**
 * Fetch a Razorpay customer by ID
 */
export async function fetchCustomer(customerId: string): Promise<RazorpayCustomer> {
  const customer = await razorpay.customers.fetch(customerId);
  return customer as unknown as RazorpayCustomer;
}

/**
 * Update a Razorpay customer (e.g., to add/update GSTIN)
 */
export async function updateCustomer(
  customerId: string,
  options: Partial<CreateCustomerOptions>
): Promise<RazorpayCustomer> {
  const customer = await razorpay.customers.edit(customerId, options);
  return customer as unknown as RazorpayCustomer;
}

// ============ Subscription Management ============

/**
 * Create a Razorpay subscription
 */
export async function createSubscription(
  options: CreateSubscriptionOptions
): Promise<RazorpaySubscription> {
  const subscriptionOptions: any = {
    plan_id: options.plan_id,
    customer_notify: options.customer_notify ?? 1,
    notes: options.notes || {},
  };

  if (options.total_count) {
    subscriptionOptions.total_count = options.total_count;
  }
  if (options.quantity) {
    subscriptionOptions.quantity = options.quantity;
  }
  if (options.start_at) {
    subscriptionOptions.start_at = options.start_at;
  }
  if (options.expire_by) {
    subscriptionOptions.expire_by = options.expire_by;
  }
  if (options.offer_id) {
    subscriptionOptions.offer_id = options.offer_id;
    console.log(`[Razorpay] Creating subscription with offer_id: ${options.offer_id}`);
  }
  if (options.customer_id) {
    subscriptionOptions.customer_id = options.customer_id;
  }

  const subscription = await razorpay.subscriptions.create(subscriptionOptions);
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Fetch a Razorpay subscription by ID
 */
export async function fetchSubscription(
  subscriptionId: string
): Promise<RazorpaySubscription> {
  const subscription = await razorpay.subscriptions.fetch(subscriptionId);
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Cancel a Razorpay subscription
 * @param cancelAtCycleEnd - If true, subscription will be cancelled at the end of current billing cycle
 */
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true
): Promise<RazorpaySubscription> {
  const subscription = await razorpay.subscriptions.cancel(
    subscriptionId,
    cancelAtCycleEnd
  );
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Pause a Razorpay subscription
 * Note: Only available for subscriptions with pause_initiated_by set
 */
export async function pauseSubscription(
  subscriptionId: string
): Promise<RazorpaySubscription> {
  const subscription = await razorpay.subscriptions.pause(subscriptionId);
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Resume a paused Razorpay subscription
 */
export async function resumeSubscription(
  subscriptionId: string
): Promise<RazorpaySubscription> {
  const subscription = await razorpay.subscriptions.resume(subscriptionId);
  return subscription as unknown as RazorpaySubscription;
}

/**
 * List all subscriptions
 */
export async function listSubscriptions(options?: {
  plan_id?: string;
  count?: number;
  skip?: number;
}): Promise<{ items: RazorpaySubscription[]; count: number }> {
  const subscriptions = await razorpay.subscriptions.all(options || {});
  return subscriptions as unknown as { items: RazorpaySubscription[]; count: number };
}

/**
 * Fetch pending updates for a subscription
 */
export async function fetchSubscriptionPendingUpdate(
  subscriptionId: string
): Promise<any> {
  const pendingUpdate =
    await razorpay.subscriptions.pendingUpdate(subscriptionId);
  return pendingUpdate;
}

/**
 * Cancel pending update for a subscription
 */
export async function cancelSubscriptionPendingUpdate(
  subscriptionId: string
): Promise<any> {
  const result =
    await razorpay.subscriptions.cancelScheduledChanges(subscriptionId);
  return result;
}

/**
 * Update a subscription (change plan, quantity, etc.)
 */
export async function updateSubscription(
  subscriptionId: string,
  options: {
    plan_id?: string;
    quantity?: number;
    remaining_count?: number;
    start_at?: number;
    schedule_change_at?: "now" | "cycle_end";
    customer_notify?: 0 | 1;
    offer_id?: string;
  }
): Promise<RazorpaySubscription> {
  const subscription = await razorpay.subscriptions.update(
    subscriptionId,
    options
  );
  return subscription as unknown as RazorpaySubscription;
}

/**
 * Delete an offer linked to a subscription
 */
export async function deleteSubscriptionOffer(
  subscriptionId: string,
  offerId: string
): Promise<any> {
  const result = await razorpay.subscriptions.deleteOffer(
    subscriptionId,
    offerId
  );
  return result;
}

// ============ Invoice Management ============

export interface RazorpayInvoice {
  id: string;
  entity: string;
  type: string;
  invoice_number: string;
  customer_id: string;
  customer_details: {
    id: string;
    name: string | null;
    email: string | null;
    contact: string | null;
    gstin: string | null;
    billing_address: any | null;
    shipping_address: any | null;
    customer_name: string | null;
    customer_email: string | null;
    customer_contact: string | null;
  };
  order_id: string | null;
  subscription_id: string | null;
  line_items: any[];
  payment_id: string | null;
  status: string;
  expire_by: number | null;
  issued_at: number;
  paid_at: number | null;
  cancelled_at: number | null;
  expired_at: number | null;
  sms_status: string;
  email_status: string;
  date: number;
  terms: string | null;
  partial_payment: boolean;
  gross_amount: number;
  tax_amount: number;
  taxable_amount: number;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  currency_symbol: string;
  description: string | null;
  notes: Record<string, any>;
  comment: string | null;
  short_url: string;
  view_less: boolean;
  billing_start: number | null;
  billing_end: number | null;
  ref_num: string | null;
  group_taxes_discounts: boolean;
  created_at: number;
  idempotency_key: string | null;
}

/**
 * Fetch a Razorpay invoice by ID
 */
export async function fetchInvoice(invoiceId: string): Promise<RazorpayInvoice> {
  const invoice = await razorpay.invoices.fetch(invoiceId);
  return invoice as unknown as RazorpayInvoice;
}

/**
 * List invoices with optional filters
 */
export async function listInvoices(options?: {
  subscription_id?: string;
  type?: string;
  count?: number;
  skip?: number;
}): Promise<{ items: RazorpayInvoice[]; count: number }> {
  const invoices = await razorpay.invoices.all(options || {});
  return invoices as unknown as { items: RazorpayInvoice[]; count: number };
}

/**
 * Get all unpaid invoices for a subscription
 * Returns invoices in 'issued', 'partially_paid', or 'expired' status
 */
export async function getUnpaidSubscriptionInvoices(
  subscriptionId: string
): Promise<RazorpayInvoice[]> {
  const result = await listInvoices({
    subscription_id: subscriptionId,
    count: 50, // Get last 50 invoices
  });

  // Filter for unpaid invoices
  return result.items.filter((inv) =>
    ["issued", "partially_paid", "expired"].includes(inv.status)
  );
}

// ─── Save-card helpers (phase 2) ───────────────────────────────────────
//
// Mirrors the Stripe save-card layer conceptually. Two differences from
// Stripe worth remembering:
//   1. Razorpay has no SetupIntent equivalent — every token save
//      requires a real charge. We use a ₹1 authorization + auto-refund
//      pattern for standalone saves; save-at-checkout piggybacks on the
//      real invoice charge.
//   2. Reuse still goes through Razorpay Standard Checkout with a
//      `customer_id` — the popup pre-shows the founder's saved cards.
//      Not zero-click (RBI OTP requirement) but no PAN retyping. True
//      server-side off-session (MIT) charges land in phase 3.

/**
 * Ensure the user has a Razorpay Customer. Reads the User doc; if a
 * customer id is already present (either from a prior save-card or
 * from the GSTIN attach flow on office subs — see
 * `officeSubscription.ts:598`), returns it. Otherwise creates and
 * persists.
 */
export async function getOrCreateRazorpayCustomer(input: {
  userId: string;
  email?: string;
  name?: string;
  contact?: string;
}): Promise<string> {
  const { User } = await import("../models/user.model");
  const { Types } = await import("mongoose");
  const user = await User.findById(input.userId).select(
    "email name phone paymentProfile.razorpay.customerId",
  );
  if (!user) throw new Error("User not found");

  const existing = (user as any).paymentProfile?.razorpay?.customerId;
  if (existing) return existing;

  const rp = await razorpay.customers.create({
    name: input.name || (user as any).name || "Garage user",
    email: input.email || user.email || "",
    contact: input.contact || (user as any).phone || undefined,
    notes: { garageUserId: input.userId },
    // fail_existing: 0 → if a Razorpay Customer with this email already
    // exists, return it instead of throwing. Idempotent across retries.
    fail_existing: 0 as any,
  } as any);

  await User.updateOne(
    { _id: new Types.ObjectId(input.userId) },
    { $set: { "paymentProfile.razorpay.customerId": (rp as any).id } },
  );
  return (rp as any).id;
}

/**
 * Create an Order that will tokenize the card at payment time. FE opens
 * Standard Checkout with `save: 1` + `customer_id` + `token: {...}` to
 * trigger tokenization. `notes.type = "save_card_authorization"` marks
 * the ₹1 auth orders so the payment.captured webhook can auto-refund.
 */
export async function createSaveCardOrder(opts: {
  amount: number; // paise; use 100 (₹1) for standalone auth
  currency?: string;
  receipt?: string;
  customerId: string;
  isAuthorizationOnly: boolean; // true → auto-refund via webhook
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const orderOptions: any = {
    amount: opts.amount,
    currency: opts.currency || "INR",
    receipt: opts.receipt || `save_${Date.now().toString().slice(-10)}`,
    notes: {
      ...(opts.notes || {}),
      customerId: opts.customerId,
      ...(opts.isAuthorizationOnly
        ? { type: "save_card_authorization" }
        : {}),
    },
  };
  const order = await razorpay.orders.create(orderOptions);
  return order as RazorpayOrder;
}

/**
 * Read-through to Razorpay's saved-tokens list for the customer. Used
 * for reconciliation on the Payment Methods settings page + admin.
 */
export async function listCustomerTokens(
  customerId: string,
): Promise<any[]> {
  const res: any = await (razorpay.customers as any).fetchTokens(customerId);
  return res?.items || [];
}

/**
 * Every payment attempt made against an order.
 *
 * Used before mutating an invoice that already has a Razorpay order: an order
 * with no payments is safe to abandon, one with an authorised or captured
 * payment is not. Throws on failure so the caller can fail closed rather than
 * assume "no payments".
 */
export async function listOrderPayments(orderId: string): Promise<any[]> {
  const res: any = await (razorpay.orders as any).fetchPayments(orderId);
  return res?.items || [];
}

/**
 * Fetch ONE saved token, which is the only way to learn a UPI mandate's real
 * state.
 *
 * The payment entity carries `token_id` but nothing about the mandate itself —
 * no `recurring_details`, no `max_amount`, no `expired_at`. Reading those off
 * the payment (as the webhook used to) yields `undefined` every time, which is
 * why every mandate was recorded as "pending" with a null cap regardless of
 * whether the payer had actually approved it.
 *
 * Returns null rather than throwing: a lookup failure must never break webhook
 * processing or a settings-page read.
 */
export async function fetchCustomerToken(
  customerId: string,
  tokenId: string,
): Promise<any | null> {
  try {
    return await (razorpay.customers as any).fetchToken(customerId, tokenId);
  } catch (err: any) {
    console.error(
      `[Razorpay] could not fetch token ${tokenId} for ${customerId}:`,
      err?.message ?? err,
    );
    return null;
  }
}

/**
 * Map Razorpay's `recurring_details.status` onto the `mandateStatus` we store.
 *
 * Razorpay's vocabulary is wider than ours and the mapping is not obvious, so
 * it lives in one place. Anything unrecognised stays "pending" — the
 * conservative choice, since every consumer treats only "active" as usable.
 */
export function mandateStatusFromRecurring(
  recurringStatus: string | undefined | null,
): "active" | "pending" | "revoked" | "paused" {
  switch ((recurringStatus || "").toLowerCase()) {
    case "confirmed":
      return "active";
    case "cancelled":
    case "rejected":
    case "expired":
      return "revoked";
    case "paused":
      return "paused";
    default:
      // "initiated" and anything new — not yet usable, not yet dead.
      return "pending";
  }
}

/**
 * Remove a saved token from a Razorpay Customer. Emits
 * `token.cancelled`, which our webhook mirrors onto the User doc.
 */
export async function deleteRazorpayToken(opts: {
  customerId: string;
  tokenId: string;
}): Promise<void> {
  await (razorpay.customers as any).deleteToken(
    opts.customerId,
    opts.tokenId,
  );
}

/**
 * Refund a payment in full. Used to close out the ₹1 save-card auth
 * charge immediately after tokenization succeeds. The refund lands on
 * the founder's card statement within 5-7 business days.
 */
export async function refundPayment(opts: {
  paymentId: string;
  amount?: number; // paise; omit for full refund
  notes?: Record<string, string>;
}): Promise<any> {
  const refund = await razorpay.payments.refund(opts.paymentId, {
    ...(opts.amount != null ? { amount: opts.amount } : {}),
    speed: "normal",
    notes: opts.notes || {},
  } as any);
  return refund;
}

// ─── UPI Autopay (recurring UPI mandate) ───────────────────────────────
//
// The piece the save-card block above calls "phase 3": true server-side
// off-session charging. UPI is our busiest rail by payment count, yet every
// UPI payment today is a manual one-off collect, because
// `autoChargeRecurringInvoices` only knows how to charge Stripe cards.
//
// Shape of the flow, and how it differs from Stripe:
//
//   1. REGISTER — the payer's FIRST payment doubles as mandate creation. The
//      order carries `customer_id` + a `token` block (max_amount / expire_at /
//      frequency) and `method: "upi"`. There is no SetupIntent equivalent, so
//      registration always rides on a real charge — same constraint the card
//      save-flow works around with a ₹1 auth.
//
//   2. CONFIRM — Razorpay emits `token.confirmed` once the payer approves the
//      mandate in their UPI app. That event is a SEPARATE Dashboard
//      subscription and is not reliably emitted (see routes/webhook.ts), so
//      the `payment.captured` fallback is mandatory, not optional.
//
//   3. DEBIT — later cycles are charged with `createRecurringPayment`, which is
//      the Razorpay analogue of Stripe's off-session PaymentIntent.
//
// RBI caps a single UPI mandate execution; above that ceiling the payer gets
// an authentication prompt per debit rather than a silent charge. We register
// mandates for every term anyway (product decision), so the caller must treat
// "needs approval" as a real, expected outcome and not a failure.

/** Cap stamped on new mandates, in paise. Sized to clear the largest term. */
export const UPI_MANDATE_MAX_AMOUNT_PAISE = 5_000_000; // ₹50,000

/** How long a mandate stays valid before the payer must re-authorise. */
export const UPI_MANDATE_YEARS = 5;

/**
 * Create an Order that registers a UPI Autopay mandate while taking the first
 * real payment.
 *
 * `max_amount` is the ceiling for EVERY future debit on this mandate, not just
 * this one — set it above the largest amount we will ever charge, or renewals
 * silently become uncollectable and the payer has to re-authorise.
 */
export async function createUpiMandateOrder(opts: {
  amount: number; // paise — the first cycle's real charge
  currency?: string;
  receipt?: string;
  customerId: string;
  /** Ceiling for future debits. Defaults to UPI_MANDATE_MAX_AMOUNT_PAISE. */
  maxAmountPaise?: number;
  /**
   * Billing cadence declared on the mandate, shown to the payer in their UPI
   * app. Only these are honoured for UPI — anything else is treated as
   * as-presented. Resolved per-plan by `mandateFrequencyForTerm`; defaults to
   * `as_presented` when a term has no matching enum (e.g. half-yearly).
   */
  frequency?:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "yearly"
    | "as_presented";
  expireAt?: Date;
  notes?: Record<string, string>;
}): Promise<RazorpayOrder> {
  const expire =
    opts.expireAt ??
    new Date(Date.now() + UPI_MANDATE_YEARS * 365 * 24 * 60 * 60 * 1000);

  const orderOptions: any = {
    amount: opts.amount,
    currency: opts.currency || "INR",
    receipt: opts.receipt || `upiaut_${Date.now().toString().slice(-10)}`,
    method: "upi",
    customer_id: opts.customerId,
    // Tells Razorpay this first payment also establishes a mandate.
    token: {
      max_amount: opts.maxAmountPaise ?? UPI_MANDATE_MAX_AMOUNT_PAISE,
      expire_at: Math.floor(expire.getTime() / 1000), // unix seconds
      frequency: opts.frequency || "as_presented",
    },
    notes: {
      ...(opts.notes || {}),
      customerId: opts.customerId,
      type: "upi_autopay_registration",
    },
  };

  const order = await razorpay.orders.create(orderOptions);

  // Log whether Razorpay actually honoured the mandate fields. Fetching an
  // order back does NOT echo `token`/`customer_id`, so the create response is
  // the only place they're visible — and if the account isn't enabled for UPI
  // Autopay, this is how we find out, rather than discovering it when no
  // mandate ever materialises. Cheap: once per registration.
  const o = order as any;
  console.log(
    `[Razorpay] mandate order ${o?.id}: token=${o?.token ? JSON.stringify(o.token) : "ABSENT"} customer_id=${o?.customer_id ?? "ABSENT"} method=${o?.method ?? "ABSENT"}`,
  );

  return order as RazorpayOrder;
}

export interface RecurringDebitResult {
  /**
   * The order minted for this debit.
   *
   * The caller MUST persist this onto the invoice as `razorpayOrderId`. The
   * `payment.captured` / `payment.failed` webhooks correlate back to an
   * invoice purely by order id, and this order is created server-side rather
   * than by the browser — so without writing it back, a debit that settles
   * asynchronously (anything needing payer approval) can never be matched and
   * the invoice stays pending forever.
   */
  orderId: string;
  /** Razorpay payment id, when one was created. */
  paymentId?: string;
  /** Razorpay's payment status — "captured" is the only settled success. */
  status?: string;
  /**
   * True when the debit is accepted but awaits the payer's approval in their
   * UPI app (amount above the no-AFA ceiling, or issuer policy). NOT a
   * failure — but not money either. The caller must leave the invoice
   * unsettled and let the webhook finish it.
   */
  requiresApproval: boolean;
  raw: any;
}

/**
 * Debit an existing UPI mandate off-session — the Razorpay counterpart of
 * `chargeSavedPaymentMethod`.
 *
 * Two-step by API design: create an Order flagged recurring, then charge the
 * token against it. Both steps take the same `idempotencyKey` discipline the
 * Stripe path uses, so a retried cron run cannot double-charge.
 *
 * Never throws for "the payer must approve" — that is returned as
 * `requiresApproval` so the caller can distinguish it from a decline.
 */
export async function chargeUpiMandate(opts: {
  amount: number; // paise
  currency?: string;
  customerId: string;
  tokenId: string;
  receipt?: string;
  description?: string;
  notes?: Record<string, string>;
}): Promise<RecurringDebitResult> {
  // Step 1 — an order marked as a recurring (merchant-initiated) collection.
  const order: any = await razorpay.orders.create({
    amount: opts.amount,
    currency: opts.currency || "INR",
    receipt: opts.receipt || `upidbt_${Date.now().toString().slice(-10)}`,
    payment_capture: true,
    notes: { ...(opts.notes || {}), type: "upi_autopay_debit" },
  } as any);

  // Step 2 — charge the saved mandate token against it.
  const payment: any = await (razorpay.payments as any).createRecurringPayment({
    email: (opts.notes as any)?.email,
    contact: (opts.notes as any)?.contact,
    amount: opts.amount,
    currency: opts.currency || "INR",
    order_id: order.id,
    customer_id: opts.customerId,
    token: opts.tokenId,
    recurring: "1",
    description: opts.description || "Subscription renewal",
    notes: opts.notes || {},
  });

  const status = payment?.status as string | undefined;
  return {
    orderId: order.id,
    paymentId: payment?.id,
    status,
    // Razorpay reports an awaiting-approval debit as created/authorized
    // rather than captured. Treating that as success would mark an invoice
    // paid before the money exists.
    requiresApproval: status != null && status !== "captured" && status !== "failed",
    raw: payment,
  };
}

/**
 * Revoke a UPI mandate. Razorpay models this as deleting the token from the
 * customer, which emits `token.cancelled`.
 *
 * Deliberately tolerant: a mandate the payer already revoked in their UPI app
 * is gone at Razorpay, and a cancel flow must not fail because the thing it
 * wanted removed is already removed.
 */
export async function revokeUpiMandate(opts: {
  customerId: string;
  tokenId: string;
}): Promise<{ revoked: boolean; alreadyGone: boolean }> {
  // MUST be the cancel endpoint, not deleteToken. Razorpay's docs are explicit:
  //
  //   "Deleting a token removes it from Razorpay's database... However, it does
  //    NOT cancel the mandate. If you wish to delete the mandate with Razorpay,
  //    you must first cancel it using the Cancel Token API."
  //
  // This used to call `deleteToken`, so "revoke autopay" quietly removed our
  // reference while leaving the mandate ALIVE at NPCI — it kept showing as
  // active in the payer's UPI app and had to be cancelled there by hand. We
  // could no longer debit it (the token was gone from Razorpay), but the
  // standing authority remained, which is precisely the thing the payer asked
  // us to withdraw.
  //
  // The Node SDK (2.9.6) exposes fetchToken/fetchTokens/deleteToken but no
  // cancel, so this is a raw call.
  //
  // Deliberately does NOT delete afterwards: cancellation is asynchronous
  // ("cancellation_initiated") and the docs warn it can fail if NPCI rejects
  // it. Keeping the token lets `getAutopayState` reconcile and see whether the
  // cancellation actually landed. Deleting would blind us to exactly that.
  const auth = Buffer.from(
    `${process.env.RAZORPAY_KEY_ID || ""}:${process.env.RAZORPAY_KEY_SECRET || ""}`,
  ).toString("base64");

  try {
    const res = await fetch(
      `https://api.razorpay.com/v1/customers/${opts.customerId}/tokens/${opts.tokenId}/cancel`,
      { method: "PUT", headers: { Authorization: `Basic ${auth}` } },
    );
    const body: any = await res.json().catch(() => ({}));

    if (res.ok) {
      console.log(
        `[Razorpay] mandate ${opts.tokenId} cancel -> ${body?.status ?? "ok"} (NPCI cancellation initiated)`,
      );
      return { revoked: true, alreadyGone: false };
    }

    const desc = String(body?.error?.description ?? "");
    // Already cancelled / never existed — the payer's intent is satisfied.
    if (
      res.status === 400 ||
      res.status === 404 ||
      /not found|does not exist|already/i.test(desc)
    ) {
      console.log(
        `[Razorpay] mandate ${opts.tokenId} already gone at Razorpay (${res.status}: ${desc || "no detail"})`,
      );
      return { revoked: false, alreadyGone: true };
    }

    throw new Error(
      `Razorpay refused to cancel ${opts.tokenId} (${res.status}): ${desc || JSON.stringify(body).slice(0, 200)}`,
    );
  } catch (err: any) {
    if (err instanceof TypeError) {
      throw new Error(`Network error cancelling ${opts.tokenId}: ${err.message}`);
    }
    throw err;
  }
}

export { razorpay };
