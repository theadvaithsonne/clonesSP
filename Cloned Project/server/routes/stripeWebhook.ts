import { Router, Request, Response } from "express";
import {
  verifyWebhookSignature,
  getStripeClient,
} from "../services/stripe";
import { Invoice } from "../models/invoice.model";
import { fulfillInvoice } from "../services/invoice";
import { User } from "../models/user.model";

const router = Router();

/**
 * POST /webhooks/stripe
 * Stripe webhook handler — backstop for the synchronous /confirm-stripe-payment
 * endpoint. Mounted with express.raw() in app.ts because Stripe signature
 * verification needs the exact byte stream of the request body.
 */
router.post("/", async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"] as string | undefined;

  if (!signature) {
    console.warn("[Stripe Webhook] Missing stripe-signature header");
    return res.status(400).json({ error: "Missing signature" });
  }

  if (!Buffer.isBuffer(req.body)) {
    console.warn("[Stripe Webhook] req.body is not a Buffer — raw body parser missing?");
    return res.status(400).json({ error: "Raw body required" });
  }

  let event: any;
  try {
    event = verifyWebhookSignature(req.body, signature);
  } catch (err: any) {
    console.warn("[Stripe Webhook] Invalid signature:", err.message);
    return res.status(401).json({ error: "Invalid signature" });
  }

  console.log(`[Stripe Webhook] Verified ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        await handleSucceeded(event.data.object);
        break;
      }
      case "payment_intent.payment_failed": {
        await handleFailed(event.data.object);
        break;
      }
      case "charge.refunded": {
        await handleRefunded(event.data.object);
        break;
      }
      // ─── Save-card events (phase 1) ────────────────────────────────
      // Both attach paths converge here: SetupIntent from the Settings
      // page + `setup_future_usage` on a paying PaymentIntent from the
      // checkout flow. Idempotent — replays are a no-op.
      case "setup_intent.succeeded": {
        await handleSetupIntentSucceeded(event.data.object);
        break;
      }
      case "payment_method.attached": {
        await handlePaymentMethodAttached(event.data.object);
        break;
      }
      case "payment_method.detached": {
        await handlePaymentMethodDetached(event.data.object);
        break;
      }
      default:
        // intermediate / unrelated events — acknowledge silently
        break;
    }
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error handling ${event.type}:`, err);
    // Still 200 so Stripe doesn't endlessly retry; we have logs.
  }

  res.status(200).json({ received: true });
});

async function handleSucceeded(pi: any): Promise<void> {
  const invoiceId = pi?.metadata?.invoiceId;
  if (!invoiceId) {
    console.warn(`[Stripe Webhook] payment_intent.succeeded ${pi?.id} has no metadata.invoiceId`);
    return;
  }

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) {
    console.warn(`[Stripe Webhook] Invoice ${invoiceId} not found for PI ${pi.id}`);
    return;
  }

  if (invoice.status === "paid") {
    console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} already paid (idempotent)`);
    return;
  }

  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id || null;

  invoice.status = "paid";
  invoice.paidAt = new Date();
  invoice.paymentPlatform = "stripe";
  invoice.paymentMethodCategory = "card";
  invoice.paymentCurrency = (pi.currency || "usd").toUpperCase();
  invoice.metadata = {
    ...(invoice.metadata || {}),
    stripePaymentIntentId: pi.id,
    stripeChargeId: chargeId,
  };
  await invoice.save();

  try {
    await fulfillInvoice(invoice, `stripe_${pi.id}`);
    console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} fulfilled`);
  } catch (err) {
    console.error(
      `[Stripe Webhook] Fulfillment error for ${invoice.invoiceNumber}:`,
      err
    );
  }

  // Save-at-checkout side effect: if the PI carried both a customer
  // AND a mandate (i.e. this was a save-for-future INR checkout that
  // authorized an e-mandate), backfill the mandate id onto the
  // just-saved PM row. `payment_method.attached` already persisted the
  // PM without mandate; persistPaymentMethod detects the existing row
  // + missing mandate and patches it.
  //
  // Stripe puts the mandate id in one of two places depending on the
  // flow. Fresh save-at-checkout mostly lands on
  // `latest_charge.payment_method_details.card.mandate` (pi.mandate at
  // the top level stays null). Recurring MIT charges tend to fill
  // pi.mandate directly. Webhook events serialise latest_charge as an
  // id string, so we retrieve the charge on-demand when the top-level
  // slot is empty.
  const customerId =
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
  const paymentMethodId =
    typeof pi.payment_method === "string"
      ? pi.payment_method
      : pi.payment_method?.id;
  let mandateId: string | undefined =
    typeof pi.mandate === "string" ? pi.mandate : pi.mandate?.id;
  if (!mandateId && pi.setup_future_usage && customerId && paymentMethodId) {
    const chargeId =
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : pi.latest_charge?.id;
    if (chargeId) {
      try {
        const stripe = getStripeClient();
        const ch: any = await stripe.charges.retrieve(chargeId);
        mandateId =
          ch?.payment_method_details?.card?.mandate || ch?.mandate || undefined;
      } catch (err) {
        console.error(
          `[Stripe Webhook] Failed to retrieve charge ${chargeId} for mandate lookup:`,
          err,
        );
      }
    }
  }
  if (customerId && paymentMethodId && mandateId) {
    try {
      await persistPaymentMethod(
        customerId,
        paymentMethodId,
        undefined,
        mandateId,
      );
    } catch (err) {
      console.error(
        `[Stripe Webhook] mandate backfill failed for pm ${paymentMethodId}:`,
        err,
      );
    }
  }
}

async function handleFailed(pi: any): Promise<void> {
  const invoiceId = pi?.metadata?.invoiceId;
  if (!invoiceId) return;

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice || invoice.status === "paid") return;

  invoice.status = "failed";
  invoice.failedAt = new Date();
  invoice.errorDescription =
    pi.last_payment_error?.message || "Stripe payment failed";
  invoice.metadata = {
    ...(invoice.metadata || {}),
    stripePaymentIntentId: pi.id,
    failureReason: pi.last_payment_error?.code || "payment_failed",
  };
  await invoice.save();
  console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} marked failed`);
}

async function handleRefunded(charge: any): Promise<void> {
  const piId =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!piId) return;

  const invoice = await Invoice.findOne({
    "metadata.stripePaymentIntentId": piId,
  });
  if (!invoice) return;

  invoice.status = "refunded";
  invoice.refundedAt = new Date();
  invoice.metadata = {
    ...(invoice.metadata || {}),
    stripeRefundedAt: new Date().toISOString(),
  };
  await invoice.save();
  console.log(`[Stripe Webhook] Invoice ${invoice.invoiceNumber} refunded`);
}

// ─── Save-card handlers ────────────────────────────────────────────────
//
// Two attach entry points feed the same "persist to User doc" logic:
//   1. Standalone SetupIntent from the Payment Methods settings page.
//   2. `setup_future_usage` on a PaymentIntent during checkout.
// Detach comes from the FE Remove button + Stripe dashboard removals.

async function handleSetupIntentSucceeded(si: any): Promise<void> {
  const customerId =
    typeof si.customer === "string" ? si.customer : si.customer?.id;
  const paymentMethodId =
    typeof si.payment_method === "string"
      ? si.payment_method
      : si.payment_method?.id;
  if (!customerId || !paymentMethodId) {
    console.warn(
      `[Stripe Webhook] setup_intent.succeeded ${si.id} missing customer/pm`,
    );
    return;
  }
  // SetupIntent carries the mandate id when mandate_options were
  // requested — pipe it through so we can persist for zero-OTP INR reuse.
  const mandateId: string | undefined =
    typeof si.mandate === "string" ? si.mandate : si.mandate?.id;
  await persistPaymentMethod(customerId, paymentMethodId, undefined, mandateId);
}

async function handlePaymentMethodAttached(pm: any): Promise<void> {
  const customerId =
    typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
  if (!customerId || !pm.id) return;
  // payment_method.attached doesn't carry the mandate id — that arrives
  // separately on setup_intent.succeeded / payment_intent.succeeded.
  // We still persist the PM here (with card.country) so it shows up in
  // the FE immediately; mandate info gets backfilled by the later event.
  await persistPaymentMethod(customerId, pm.id, pm);
}

/**
 * Insert-or-update a card row on the User whose Stripe customerId matches.
 * Idempotent: same event replayed twice is a no-op. When called with
 * `mandateId` and the row already exists WITHOUT mandate info, we
 * upsert the mandate fields in place — this is the common
 * setup_intent-arrives-after-payment_method.attached ordering.
 */
async function persistPaymentMethod(
  customerId: string,
  paymentMethodId: string,
  presetPm?: any,
  mandateId?: string,
): Promise<void> {
  const user = await User.findOne({
    "paymentProfile.stripe.customerId": customerId,
  }).select("paymentProfile.stripe.methods");
  if (!user) {
    console.warn(
      `[Stripe Webhook] No user for customer ${customerId} (pm ${paymentMethodId})`,
    );
    return;
  }

  const methods = ((user as any).paymentProfile?.stripe?.methods || []) as any[];
  const existing = methods.find((m) => m.id === paymentMethodId);
  if (existing) {
    // Row already there. If we now have a mandate id and the existing
    // row doesn't, patch it in — this is the common
    // attach-fires-before-setup-intent ordering.
    if (mandateId && !existing.mandateId) {
      await User.updateOne(
        {
          _id: user._id,
          "paymentProfile.stripe.methods.id": paymentMethodId,
        },
        {
          $set: {
            "paymentProfile.stripe.methods.$.mandateId": mandateId,
            // Cap we set at save time — see paymentMethods.ts
            // setup-intent route + invoice.ts fresh-card branch.
            "paymentProfile.stripe.methods.$.mandateAmount": 10_000_000,
            "paymentProfile.stripe.methods.$.mandateStatus": "active",
          },
        },
      );
      console.log(
        `[Stripe Webhook] Backfilled mandate ${mandateId} onto existing pm ${paymentMethodId}`,
      );
    }
    return;
  }

  // Prefer the object handed to us by `payment_method.attached`; fetch
  // it explicitly for `setup_intent.succeeded` (which only carries the id).
  let pm: any = presetPm;
  if (!pm) {
    try {
      const stripe = getStripeClient();
      pm = await stripe.paymentMethods.retrieve(paymentMethodId);
    } catch (err) {
      console.error(
        `[Stripe Webhook] Failed to fetch pm ${paymentMethodId}:`,
        err,
      );
      return;
    }
  }

  const card = pm.card || {};
  const row: any = {
    id: pm.id,
    brand: card.brand || null,
    last4: card.last4 || null,
    expMonth: card.exp_month || null,
    expYear: card.exp_year || null,
    // ISO-2 issuer country from Stripe. Drives the FE currency filter
    // (INR checkouts show country==="IN" cards; USD shows non-IN).
    country: card.country || null,
    // First card added → default. Later ones added off-checkout are
    // not defaulted; user can change via PATCH /:pmId/default.
    isDefault: methods.length === 0,
    addedAt: new Date(),
    ...(mandateId
      ? {
          mandateId,
          mandateAmount: 10_000_000, // ₹1L cap, matches setup-intent route
          mandateStatus: "active",
        }
      : {}),
  };

  await User.updateOne(
    { _id: user._id },
    { $push: { "paymentProfile.stripe.methods": row } },
  );
  console.log(
    `[Stripe Webhook] Attached ${pm.id} (${row.brand} •••• ${row.last4}, country=${row.country}, mandate=${mandateId || "(none)"}) to user ${user._id}`,
  );
}

async function handlePaymentMethodDetached(pm: any): Promise<void> {
  if (!pm?.id) return;
  // pm.customer is null on detached events — pull by pm id alone.
  const result = await User.updateOne(
    { "paymentProfile.stripe.methods.id": pm.id },
    { $pull: { "paymentProfile.stripe.methods": { id: pm.id } } },
  );
  if (result.modifiedCount > 0) {
    console.log(`[Stripe Webhook] Detached pm ${pm.id}`);
  }
}

export default router;
