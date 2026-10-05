// eslint-disable-next-line @typescript-eslint/no-require-imports
import Stripe = require("stripe");
import { User } from "../models/user.model";
import { Types } from "mongoose";

export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;

let stripeClient: any = null;

export function getStripeClient(): any {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return stripeClient;
}

export interface CreatePaymentIntentOptions {
  amountInSmallestUnit: number;
  currency: string;
  metadata: {
    invoiceId: string;
    invoiceNumber: string;
    userId: string;
    orgId: string;
    itemType: string;
    [key: string]: string;
  };
  description?: string;
  receiptEmail?: string;
  // ─── Save-card additions ─────────────────────────────────────────────
  // When `customer` is present, Stripe scopes the PaymentIntent to that
  // Customer. Combined with `setupFutureUsage: "off_session"`, Stripe
  // auto-attaches the PaymentMethod after a successful charge — no
  // separate SetupIntent needed. The webhook then persists it onto the
  // User doc.
  customer?: string; // cus_xxx
  setupFutureUsage?: "off_session" | "on_session";
  // ─── India e-mandate ────────────────────────────────────────────────
  // When set, the PI includes RBI Standing-Instruction mandate options
  // (India-scoped — Stripe ignores for non-Indian issuers). Presenting
  // these at the same OTP that authorizes the card lets us charge the
  // card off-session later (`mandate: <id>`) without user interaction
  // up to the mandate's amount cap. Only applies when
  // setupFutureUsage is also set (i.e., we're saving the card).
  indianMandate?: IndianMandateOptions;
}

/**
 * India e-mandate config used by both SetupIntent + PaymentIntent
 * (save-and-charge). Amount is in paise (smallest INR unit) — RBI caps
 * per-transaction at ₹1,00,000 (10_000_000 paise) for zero-OTP MIT.
 */
export interface IndianMandateOptions {
  reference: string; // unique per mandate — we use `garage-<userId>-<ts>`
  amountInPaise: number; // e.g. 10_000_000 for ₹1L cap
  description: string; // shown on Stripe's mandate consent screen
  intervalCount?: number; // for "sporadic": omit; for periodic: 1..
  interval?: "day" | "week" | "month" | "year" | "sporadic";
  startDate?: Date; // defaults to now
}

export async function createPaymentIntent(
  opts: CreatePaymentIntentOptions
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const stripe = getStripeClient();
  const intent = await stripe.paymentIntents.create({
    amount: opts.amountInSmallestUnit,
    currency: opts.currency.toLowerCase(),
    // Lock the PaymentIntent to plain card payments. We do NOT use
    // automatic_payment_methods because that turns on Google Pay / Apple Pay /
    // Link, each of which loads its own iframes / availability checks
    // (pay.google.com, etc.) — these are routinely blocked by ad-blockers and
    // can stall stripe.confirmPayment() indefinitely on the client side.
    payment_method_types: ["card"],
    metadata: opts.metadata,
    description: opts.description,
    receipt_email: opts.receiptEmail,
    ...(opts.customer ? { customer: opts.customer } : {}),
    ...(opts.setupFutureUsage
      ? { setup_future_usage: opts.setupFutureUsage }
      : {}),
    ...(opts.indianMandate
      ? {
          payment_method_options: {
            card: {
              // PaymentIntent path — currency is inherited from the PI's
              // top-level `currency`; sending it here 400s with
              // `parameter_unknown: currency`.
              mandate_options: buildIndianMandateOptions(
                opts.indianMandate,
                false,
              ),
            },
          },
        }
      : {}),
  });

  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client_secret");
  }

  return {
    clientSecret: intent.client_secret,
    paymentIntentId: intent.id,
  };
}

/**
 * Build the Stripe `payment_method_options.card.mandate_options` shape.
 * Reused by both createSetupIntent + createPaymentIntent. India-scoped
 * via `supported_types: ["india"]` — Stripe ignores for non-Indian
 * issuers, so it's safe to always attach when saving a card.
 *
 * amount_type: "maximum" + interval: "sporadic" = the founder can be
 * charged any amount up to `amount` (paise), at any time, without OTP.
 * The RBI cap is ₹1,00,000 per transaction for zero-OTP; charges above
 * always require OTP (Stripe returns requires_action).
 *
 * `currency` handling differs by parent intent:
 *   - SetupIntent  → REQUIRED (SetupIntents have no top-level currency)
 *   - PaymentIntent → REJECTED (top-level `currency` on the PI is used;
 *                     sending it inside mandate_options returns
 *                     `parameter_unknown: currency`)
 * The `includeCurrency` flag lets each caller pick the correct shape.
 */
function buildIndianMandateOptions(
  m: IndianMandateOptions,
  includeCurrency: boolean,
): any {
  const start = m.startDate || new Date();
  return {
    reference: m.reference,
    amount_type: "maximum",
    amount: m.amountInPaise,
    ...(includeCurrency ? { currency: "inr" } : {}),
    start_date: Math.floor(start.getTime() / 1000),
    interval: m.interval || "sporadic",
    ...(m.intervalCount ? { interval_count: m.intervalCount } : {}),
    supported_types: ["india"],
    description: m.description,
  };
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<any> {
  const stripe = getStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): any {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  const stripe = getStripeClient();
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET
  );
}

// ─── Save-card helpers ────────────────────────────────────────────────
//
// Everything below is the phase-1 "save card, reuse later" layer. Card
// data itself never touches Garage — Stripe holds the PAN, we hold the
// opaque `cus_xxx` + `pm_xxx` ids.

/**
 * Ensure the user has a Stripe Customer, creating one lazily on first
 * need. Idempotent: subsequent calls read the cached id off the User
 * doc. Returns the customer id string.
 */
export async function getOrCreateStripeCustomer(input: {
  userId: string;
  email?: string;
  name?: string;
}): Promise<string> {
  const user = await User.findById(input.userId).select(
    "email name paymentProfile.stripe.customerId",
  );
  if (!user) throw new Error("User not found");

  const existing = (user as any).paymentProfile?.stripe?.customerId;
  if (existing) return existing;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: input.email || user.email || undefined,
    name: input.name || (user as any).name || undefined,
    metadata: { garageUserId: input.userId },
  });

  await User.updateOne(
    { _id: new Types.ObjectId(input.userId) },
    { $set: { "paymentProfile.stripe.customerId": customer.id } },
  );
  return customer.id;
}

/**
 * Standalone "save this card, don't charge me anything" flow — powers
 * the Payment Methods settings page. Returns a client_secret the FE
 * gives to Stripe Elements for a SetupIntent confirmation. Successful
 * confirmation fires `setup_intent.succeeded` in our webhook, which
 * persists the PM onto the User doc.
 *
 * When `indianMandate` is passed, the SetupIntent embeds RBI
 * Standing-Instruction mandate options. Stripe scopes them to Indian
 * issuers via `supported_types: ["india"]` (foreign cards ignore
 * them), and the founder consents to the mandate terms at the same
 * OTP that authorizes the card. From then on, off-session INR
 * charges up to the amount cap fire without OTP by passing
 * `mandate: <mandateId>` on the PaymentIntent.
 */
export async function createSetupIntent(
  customerId: string,
  opts?: { indianMandate?: IndianMandateOptions },
): Promise<{ clientSecret: string; setupIntentId: string }> {
  const stripe = getStripeClient();
  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
    ...(opts?.indianMandate
      ? {
          payment_method_options: {
            card: {
              // SetupIntent path — currency IS required inside
              // mandate_options (SetupIntents have no top-level currency).
              mandate_options: buildIndianMandateOptions(
                opts.indianMandate,
                true,
              ),
            },
          },
        }
      : {}),
  });
  if (!intent.client_secret) {
    throw new Error("Stripe did not return a client_secret for SetupIntent");
  }
  return { clientSecret: intent.client_secret, setupIntentId: intent.id };
}

/**
 * Charge a previously-saved PaymentMethod. Two modes:
 *
 *   offSession: true (default) — true MIT (Merchant-Initiated Transaction).
 *     Stripe charges without user interaction. Works for USD + any card.
 *     For INR + Indian issuer, Stripe REQUIRES a pre-registered e-mandate
 *     (`mandate` param) — without it the call errors with
 *     "The parameter `mandate` is not provided or invalid". We don't
 *     register mandates yet, so INR must go through the on-session path
 *     below.
 *
 *   offSession: false — CIT (Customer-Initiated Transaction). Stripe
 *     creates the PI, attaches the customer + payment_method, tries to
 *     confirm. Almost always returns `requires_action` for Indian cards
 *     (RBI OTP). Caller returns `client_secret` to the FE, which runs
 *     `stripe.confirmPayment(clientSecret)` to complete the OTP inline.
 *
 * Callers should pass `offSession: false` for currency === "inr" so INR
 * saved-card charges don't hit the mandate error.
 *
 * Response shapes to branch on:
 *   - status === "succeeded"                → done, fulfill invoice
 *   - status === "requires_action"          → 3DS/OTP; FE completes via confirmPayment(clientSecret)
 *   - status === "requires_payment_method"  → decline; surface error
 */
export async function chargeSavedPaymentMethod(opts: {
  customerId: string;
  paymentMethodId: string;
  amountInSmallestUnit: number;
  currency: string;
  metadata: CreatePaymentIntentOptions["metadata"];
  description?: string;
  receiptEmail?: string;
  offSession?: boolean; // default true; pass false for INR sans mandate (CIT)
  mandate?: string; // mandate id — required for off_session on Indian cards
  // Stripe's Idempotency-Key header. When set, retrying the same call
  // (same key + same body) returns the ORIGINAL PaymentIntent instead
  // of creating a new one. Callers doing off-session auto-charges MUST
  // pass a per-attempt key (e.g. `auto-charge-<invoiceId>-<yyyy-mm-dd>`)
  // to guarantee no double-charge if the process crashes mid-request
  // and the cron re-fires.
  idempotencyKey?: string;
}): Promise<any> {
  const stripe = getStripeClient();
  const offSession = opts.offSession !== false; // default true
  const body: any = {
    amount: opts.amountInSmallestUnit,
    currency: opts.currency.toLowerCase(),
    payment_method_types: ["card"],
    customer: opts.customerId,
    payment_method: opts.paymentMethodId,
    // off_session=true on Indian cards requires a mandate. With one
    // attached via `mandate: <id>`, Stripe charges silently (zero OTP)
    // up to the mandate's amount cap. Without one, the charge fails
    // with "parameter `mandate` is not provided" — that's what the
    // caller avoids by passing offSession:false (CIT flow with OTP).
    ...(offSession
      ? { off_session: true as const }
      : { off_session: false as const }),
    confirm: true,
    ...(opts.mandate ? { mandate: opts.mandate } : {}),
    metadata: opts.metadata,
    description: opts.description,
    receipt_email: opts.receiptEmail,
  };
  const requestOpts: any = opts.idempotencyKey
    ? { idempotencyKey: opts.idempotencyKey }
    : {};
  return stripe.paymentIntents.create(body, requestOpts);
}

/**
 * Read-through to Stripe's live list of saved cards for the customer.
 * Only used for reconciliation — day-to-day the FE reads from the
 * User doc, which the webhook keeps in sync.
 */
export async function listCustomerPaymentMethods(
  customerId: string,
): Promise<any[]> {
  const stripe = getStripeClient();
  const res = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });
  return res.data || [];
}

/**
 * Remove a saved card. Stripe emits `payment_method.detached`, which
 * our webhook uses to prune the User doc.
 */
export async function detachPaymentMethod(
  paymentMethodId: string,
): Promise<void> {
  const stripe = getStripeClient();
  await stripe.paymentMethods.detach(paymentMethodId);
}

/**
 * Full-refund a Stripe charge by its PaymentIntent id. Metadata is
 * stamped on the refund so the auditor can trace who triggered it.
 * Errors bubble so the caller can surface a real reason (e.g. Stripe's
 * "charge_already_refunded" gets a 400 instead of a silent no-op).
 *
 * The `charge.refunded` webhook (routes/stripeWebhook.ts) already
 * flips the invoice to `refunded`, so callers don't need to manually
 * update invoice state.
 */
export async function refundStripeCharge(opts: {
  paymentIntentId: string;
  metadata?: Record<string, string>;
}): Promise<any> {
  const stripe = getStripeClient();
  return stripe.refunds.create({
    payment_intent: opts.paymentIntentId,
    ...(opts.metadata ? { metadata: opts.metadata } : {}),
  });
}
