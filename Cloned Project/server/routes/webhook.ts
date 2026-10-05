import { Router, Request, Response } from "express";
import { verifyWebhookSignature } from "../services/razorpay";
import { refreshTypeFlags } from "../services/downlineTree";
import {
  handleSubscriptionAuthenticated,
  handleSubscriptionActivated,
  handleSubscriptionCharged,
  handleSubscriptionPending,
  handleSubscriptionHalted,
  handleSubscriptionCancelled,
  handleSubscriptionCompleted,
  handleSubscriptionPaused,
  handleSubscriptionResumed,
} from "../services/subscription";
import {
  handleOfficeSubscriptionAuthenticated,
  handleOfficeSubscriptionActivated,
  handleOfficeSubscriptionCharged,
  handleOfficeSubscriptionPending,
  handleOfficeSubscriptionHalted,
  handleOfficeSubscriptionCancelled,
} from "../services/officeSubscription";
import {
  handleOfficeAddonSubscriptionAuthenticated,
  handleOfficeAddonSubscriptionActivated,
  handleOfficeAddonSubscriptionCharged,
  handleOfficeAddonSubscriptionPending,
  handleOfficeAddonSubscriptionHalted,
  handleOfficeAddonSubscriptionCancelled,
} from "../services/officeAddonSubscription";
import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { createRecurringInvoice } from "../services/invoice";
import { UnilevelPlusPurchase } from "../models/unilevelPlusPurchase.model";
import {
  getUserPurchase,
  getActiveUnilevelPlusPlan,
  distributeUnilevelPlusCommission,
} from "../services/unilevelPlusCommission";

const router = Router();

// Razorpay webhook event types
type RazorpayWebhookEvent =
  | "subscription.authenticated"
  | "subscription.activated"
  | "subscription.charged"
  | "subscription.pending"
  | "subscription.halted"
  | "subscription.cancelled"
  | "subscription.completed"
  | "subscription.paused"
  | "subscription.resumed"
  | "payment.authorized"
  | "payment.captured"
  | "payment.failed"
  | "order.paid"
  // Save-card (phase 2). Fires when tokenization for a saved card
  // completes/fails/is removed at Razorpay's end.
  | "token.confirmed"
  | "token.rejected"
  | "token.cancelled"
  // UPI Autopay: a payer can pause and later resume a mandate from inside
  // their own UPI app, without any action on our side.
  | "token.paused"
  | "token.resumed";

interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: RazorpayWebhookEvent;
  contains: string[];
  payload: {
    subscription?: {
      entity: any;
    };
    payment?: {
      entity: any;
    };
    order?: {
      entity: any;
    };
    token?: {
      entity: any;
    };
  };
  created_at: number;
}

/**
 * Razorpay Webhook Handler
 *
 * IMPORTANT: This endpoint receives raw body for signature verification.
 * Make sure to configure Express to NOT parse JSON for this route.
 *
 * In app.ts, mount this BEFORE the json() middleware:
 * app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);
 */
router.post("/razorpay", async (req: Request, res: Response) => {
  console.log("[Webhook] ========== INCOMING WEBHOOK ==========");
  console.log("[Webhook] Headers:", JSON.stringify(req.headers, null, 2));
  console.log("[Webhook] Body type:", typeof req.body);
  console.log("[Webhook] Body is Buffer:", Buffer.isBuffer(req.body));

  try {
    const signature = req.headers["x-razorpay-signature"] as string;
    console.log("[Webhook] Signature:", signature);

    if (!signature) {
      console.error("[Webhook] Missing Razorpay signature");
      return res.status(400).json({ error: "Missing signature" });
    }

    // Get raw body for signature verification
    // Handle Buffer (from express.raw()), string, or object
    let rawBody: string;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body.toString("utf8");
    } else if (typeof req.body === "string") {
      rawBody = req.body;
    } else {
      rawBody = JSON.stringify(req.body);
    }
    console.log("[Webhook] Raw body for verification:", rawBody.substring(0, 200) + "...");

    // Verify signature
    const isValid = verifyWebhookSignature(rawBody, signature);
    console.log("[Webhook] Signature valid:", isValid);

    if (!isValid) {
      console.error("[Webhook] Invalid Razorpay signature");
      return res.status(400).json({ error: "Invalid signature" });
    }

    // Parse payload
    const payload: RazorpayWebhookPayload = JSON.parse(rawBody);

    console.log(`[Webhook] ========== EVENT: ${payload.event} ==========`);
    console.log("[Webhook] Subscription ID:", payload.payload.subscription?.entity?.id);
    console.log("[Webhook] Subscription status:", payload.payload.subscription?.entity?.status);
    console.log("[Webhook] Subscription notes:", JSON.stringify(payload.payload.subscription?.entity?.notes, null, 2));

    // Handle subscription events
    // Both regular subscriptions (channels, courses, etc.) and office subscriptions
    // are handled here. The handlers check the subscription type via notes.type
    switch (payload.event) {
      case "subscription.authenticated": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionAuthenticated(subscription);
          await handleOfficeSubscriptionAuthenticated(subscription);
          await handleOfficeAddonSubscriptionAuthenticated(subscription);
        }
        break;
      }

      case "subscription.activated": {
        const subscription = payload.payload.subscription?.entity;
        const payment = payload.payload.payment?.entity;
        if (subscription) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionActivated(subscription, payment);
          await handleOfficeSubscriptionActivated(subscription, payment);
          await handleOfficeAddonSubscriptionActivated(subscription, payment);
        }
        break;
      }

      case "subscription.charged": {
        const subscription = payload.payload.subscription?.entity;
        const payment = payload.payload.payment?.entity;
        if (subscription && payment) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionCharged(subscription, payment);
          await handleOfficeSubscriptionCharged(subscription, payment);
          await handleOfficeAddonSubscriptionCharged(subscription, payment);

          // Create recurring invoice record
          try {
            const parentInvoice = await Invoice.findOne({
              razorpaySubscriptionId: subscription.id,
              parentInvoiceId: { $exists: false },
            }).lean();

            if (parentInvoice) {
              await createRecurringInvoice(parentInvoice._id.toString(), {
                razorpayPaymentId: payment.id,
                razorpaySubscriptionId: subscription.id,
                razorpayInvoiceId: payment.invoice_id,
                invoiceShortUrl: payment.short_url,
                amount: payment.amount,
                currency: payment.currency?.toUpperCase() || "INR",
                paymentNumber: subscription.paid_count || 1,
                method: payment.method,
              });
            }
          } catch (invoiceErr) {
            console.error("[Webhook] Failed to create recurring invoice:", invoiceErr);
          }
        }
        break;
      }

      case "subscription.pending": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionPending(subscription);
          await handleOfficeSubscriptionPending(subscription);
          await handleOfficeAddonSubscriptionPending(subscription);
        }
        break;
      }

      case "subscription.halted": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionHalted(subscription);
          await handleOfficeSubscriptionHalted(subscription);
          await handleOfficeAddonSubscriptionHalted(subscription);
        }
        break;
      }

      case "subscription.cancelled": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          // Handle regular, office, and add-on subscriptions
          await handleSubscriptionCancelled(subscription);
          await handleOfficeSubscriptionCancelled(subscription);
          await handleOfficeAddonSubscriptionCancelled(subscription);
        }
        break;
      }

      case "subscription.completed": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          await handleSubscriptionCompleted(subscription);
          // Office subscriptions don't have a completed handler (they don't complete)
        }
        break;
      }

      case "subscription.paused": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          await handleSubscriptionPaused(subscription);
          // Office subscriptions don't support pausing
        }
        break;
      }

      case "subscription.resumed": {
        const subscription = payload.payload.subscription?.entity;
        if (subscription) {
          await handleSubscriptionResumed(subscription);
          // Office subscriptions don't support pausing/resuming
        }
        break;
      }

      // Payment events (can be used for additional tracking)
      case "payment.authorized":
      case "payment.captured": {
        const payment = payload.payload.payment?.entity;
        console.log(
          `[Webhook] Payment event: ${payload.event}`,
          payment?.id,
          `order: ${payment?.order_id}`
        );

        // ─── Save-card token persist fallback (phase 2) ──────────────
        // Razorpay tokenizes the paid card as a byproduct of
        // Standard Checkout with `save: 1` + `customer_id`. That
        // tokenization info arrives on the payment.captured event
        // (`payment.token_id`, `payment.customer_id`) BEFORE the
        // separate `token.confirmed` event fires. We used to rely
        // solely on `token.confirmed` — but not every merchant
        // account emits it, and it's a separate Dashboard event to
        // subscribe. Persist here too so the card lands on the User
        // doc regardless. Idempotent — the helper checks for the
        // existing token id and no-ops on duplicates.
        if (
          payload.event === "payment.captured" &&
          payment?.token_id &&
          payment?.customer_id
        ) {
          try {
            await persistRazorpayTokenFromPayment(payment);
          } catch (persistErr) {
            console.error(
              `[Webhook] Failed to persist token from payment ${payment.id}:`,
              persistErr,
            );
          }
          // Fall through — this branch is additive, not exclusive.
        }

        // ─── Save-card ₹1 auth auto-refund (phase 2) ─────────────────
        // The /payment-methods/razorpay/save-card-order route mints
        // orders with notes.type = "save_card_authorization". On
        // capture, we immediately refund the ₹1 charge — the
        // tokenization already happened at auth-time, so the founder
        // has their saved card and gets their ₹1 back in 5-7 days.
        // Guarded by notes.type so a real invoice payment never gets
        // refunded here.
        if (
          payload.event === "payment.captured" &&
          payment?.id &&
          payment?.notes?.type === "save_card_authorization"
        ) {
          try {
            const { refundPayment } = await import("../services/razorpay");
            await refundPayment({
              paymentId: payment.id,
              notes: { reason: "save_card_authorization_auto_refund" },
            });
            console.log(
              `[Webhook] Auto-refunded save-card auth payment ${payment.id}`
            );
          } catch (refundErr) {
            console.error(
              `[Webhook] Failed to auto-refund save-card auth ${payment.id}:`,
              refundErr
            );
          }
          // Don't fall through to the invoice-fallback block — this
          // wasn't a real invoice payment.
          break;
        }

        // ============ Invoice fallback ============
        // If the frontend verify-payment didn't run (e.g., user closed browser),
        // process the invoice here. This is idempotent — fulfillInvoice checks for
        // existing orders by paymentId so it won't double-fulfill.
        if (payment?.order_id && payment?.id && payload.event === "payment.captured") {
          try {
            const pendingInvoice = await Invoice.findOne({
              razorpayOrderId: payment.order_id,
              status: "pending",
            });

            if (pendingInvoice) {
              console.log(
                `[Webhook] Invoice fallback (payment.captured): marking ${pendingInvoice.invoiceNumber} as paid`
              );
              pendingInvoice.status = "paid";
              pendingInvoice.paidAt = new Date();
              pendingInvoice.razorpayPaymentId = payment.id;
              await pendingInvoice.save();

              try {
                const { fulfillInvoice } = await import("../services/invoice");
                await fulfillInvoice(pendingInvoice, payment.id);
                console.log(
                  `[Webhook] Invoice ${pendingInvoice.invoiceNumber} fulfilled via payment.captured webhook`
                );
              } catch (fulfillErr) {
                console.error(
                  `[Webhook] Invoice fulfillment error:`,
                  fulfillErr
                );
              }
            }
          } catch (invoiceErr) {
            console.error("[Webhook] Invoice fallback error:", invoiceErr);
          }
        }
        break;
      }

      case "payment.failed": {
        const payment = payload.payload.payment?.entity;
        console.log(
          `[Webhook] Payment failed:`,
          payment?.id,
          `order: ${payment?.order_id}`
        );

        // Mark invoice as failed if it's still pending
        if (payment?.order_id) {
          try {
            const pendingInvoice = await Invoice.findOne({
              razorpayOrderId: payment.order_id,
              status: "pending",
            });
            if (pendingInvoice) {
              pendingInvoice.status = "failed";
              pendingInvoice.failedAt = new Date();
              pendingInvoice.errorDescription = payment?.error_description || "Payment failed";
              await pendingInvoice.save();
              console.log(
                `[Webhook] Invoice ${pendingInvoice.invoiceNumber} marked as failed`
              );
            }
          } catch (err) {
            console.error("[Webhook] Error marking invoice as failed:", err);
          }
        }
        break;
      }

      case "order.paid": {
        const order = payload.payload.order?.entity;
        const payment = payload.payload.payment?.entity;
        console.log(
          `[Webhook] Order paid:`,
          order?.id,
          `Type: ${order?.notes?.type || "unknown"}`
        );

        // ============ Invoice fallback ============
        // If this Razorpay order belongs to an invoice and the frontend verify-payment
        // didn't run (e.g., user closed browser), process it here as a fallback.
        if (order?.id && payment?.id) {
          try {
            const pendingInvoice = await Invoice.findOne({
              razorpayOrderId: order.id,
              status: "pending",
            });

            if (pendingInvoice) {
              console.log(
                `[Webhook] Invoice fallback: marking ${pendingInvoice.invoiceNumber} as paid via webhook`
              );
              pendingInvoice.status = "paid";
              pendingInvoice.paidAt = new Date();
              pendingInvoice.razorpayPaymentId = payment.id;
              await pendingInvoice.save();

              // Fulfill (idempotent — if frontend already fulfilled, this will be safe
              // because fulfillInvoice checks for existing product orders by paymentId)
              try {
                const { fulfillInvoice } = await import("../services/invoice");
                await fulfillInvoice(pendingInvoice, payment.id);
                console.log(
                  `[Webhook] Invoice ${pendingInvoice.invoiceNumber} fulfilled via webhook`
                );
              } catch (fulfillErr) {
                console.error(
                  `[Webhook] Invoice fulfillment error:`,
                  fulfillErr
                );
              }
            }
          } catch (invoiceErr) {
            console.error("[Webhook] Invoice fallback error:", invoiceErr);
          }
        }

        // Handle Unilevel Plus one-time purchase
        if (order?.notes?.type === "unilevel_plus_activation") {
          const userId = order.notes.userId;
          const orderId = order.id;
          const paymentId = payment?.id;

          console.log(
            `[Webhook] UP activation webhook for user: ${userId}, order: ${orderId}`
          );

          // Skip if already activated (idempotent)
          const existingPurchase = await getUserPurchase(userId);
          if (existingPurchase) {
            console.log(
              `[Webhook] UP already activated for user: ${userId}, skipping`
            );
            break;
          }

          // Get active plan
          const plan = await getActiveUnilevelPlusPlan();
          if (!plan) {
            console.error(
              `[Webhook] No active UP plan found for webhook activation`
            );
            break;
          }

          // Create purchase record
          await UnilevelPlusPurchase.create({
            userId: new Types.ObjectId(userId),
            planId: plan._id,
            paymentId: paymentId || `webhook_${orderId}`,
            amount: plan.productPrice,
            currency: plan.currency,
            status: "active",
            purchasedAt: new Date(),
            metadata: {
              razorpayOrderId: orderId,
              orgId: order.notes.orgId,
              source: "webhook_fallback",
            },
          });

          console.log(
            `[Webhook] UP purchase created for user: ${userId} via webhook`
          );

          // Downline-table Type column: activates "1Network Activated". Fire-and-forget.
          void refreshTypeFlags(userId);

          // Distribute commissions
          try {
            await distributeUnilevelPlusCommission({
              buyerId: userId,
              planId: plan._id.toString(),
              saleAmount: plan.productPrice,
              currency: plan.currency,
              paymentId: paymentId || `webhook_${orderId}`,
              metadata: {
                razorpayOrderId: orderId,
                source: "webhook_fallback",
              },
            });
            console.log(
              `[Webhook] UP commissions distributed for user: ${userId}`
            );
          } catch (commissionError) {
            console.error(
              `[Webhook] Error distributing UP commissions:`,
              commissionError
            );
          }
        }
        break;
      }

      // ─── Save-card token events (phase 2) ────────────────────────
      case "token.confirmed": {
        const token = payload.payload.token?.entity;
        // Previously `if (token)` with no else — a malformed delivery vanished
        // without trace, which is one of the ways a mandate could sit
        // "pending" forever with nothing to show for it in the logs.
        if (token) await handleRazorpayTokenConfirmed(token);
        else
          console.warn(
            "[Webhook] token.confirmed arrived with no token entity — ignored",
          );
        break;
      }
      case "token.cancelled": {
        const token = payload.payload.token?.entity;
        if (token) await handleRazorpayTokenCancelled(token);
        else
          console.warn(
            "[Webhook] token.cancelled arrived with no token entity — ignored",
          );
        break;
      }
      // A payer can pause/resume a UPI mandate from inside their UPI app.
      // These used to fall through to `default` and be dropped, leaving us
      // claiming autopay was live against a mandate that would refuse to
      // debit. Mirrored onto the row so the cron's `active` gate is accurate
      // and the UI can say what actually happened.
      case "token.paused":
      case "token.resumed": {
        const token = payload.payload.token?.entity;
        if (token?.id && token?.customer_id) {
          const paused = payload.event === "token.paused";
          const { User } = await import("../models/user.model");
          const res = await User.updateOne(
            {
              "paymentProfile.razorpay.customerId": token.customer_id,
              "paymentProfile.razorpay.tokens.id": token.id,
            },
            {
              $set: {
                "paymentProfile.razorpay.tokens.$.mandateStatus": paused
                  ? "paused"
                  : "active",
              },
            },
          );
          console.log(
            `[Webhook] ${payload.event}: mandate ${token.id} → ${paused ? "paused" : "active"} (matched ${res.modifiedCount})`,
          );
        } else {
          console.warn(`[Webhook] ${payload.event} with no usable token entity`);
        }
        break;
      }
      case "token.rejected": {
        const token = payload.payload.token?.entity;
        console.log(
          `[Webhook] token.rejected: ${token?.id} customer=${token?.customer_id}`,
        );
        // No persistence — the token was never saved. Nothing to prune.
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${payload.event}`);
    }

    // Always respond with 200 to acknowledge receipt
    // Razorpay will retry if we don't respond with 2xx
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);

    // Still return 200 to prevent Razorpay from retrying
    // The error is logged for debugging
    return res.status(200).json({
      received: true,
      error: "Processing error logged",
    });
  }
});

// ─── Save-card token handlers (phase 2) ────────────────────────────────
//
// Payload shape (Razorpay docs):
//   token.entity = {
//     id: "token_...",
//     entity: "token",
//     customer_id: "cust_...",
//     method: "card" | "upi",
//     card: { last4, network, issuer, expiry_month, expiry_year, ... },
//     max_amount: <paise>,
//     expired_at: <unix seconds>,
//     ...
//   }

async function handleRazorpayTokenConfirmed(tokenEntity: any): Promise<void> {
  const { User } = await import("../models/user.model");
  const customerId = tokenEntity?.customer_id;
  const tokenId = tokenEntity?.id;
  if (!customerId || !tokenId) {
    console.warn(
      `[Webhook] token.confirmed missing customer/token id: ${tokenId} / ${customerId}`,
    );
    return;
  }

  const user = await User.findOne({
    "paymentProfile.razorpay.customerId": customerId,
  }).select("paymentProfile.razorpay.tokens");
  if (!user) {
    console.warn(
      `[Webhook] No user found for Razorpay customer ${customerId} (token ${tokenId})`,
    );
    return;
  }

  const tokens =
    ((user as any).paymentProfile?.razorpay?.tokens || []) as any[];

  const card = tokenEntity.card || {};
  const isUpi = tokenEntity.method === "upi";
  const recurringStatus = tokenEntity?.recurring_details?.status;

  if (tokens.some((t) => t.id === tokenId)) {
    // Already persisted — but for UPI this event is what CONFIRMS the payer
    // approved the mandate. The payment.captured fallback may have written the
    // row first as "pending", so promote it rather than returning early;
    // otherwise a confirmed mandate stays unchargeable forever.
    if (isUpi && recurringStatus === "confirmed") {
      await User.updateOne(
        { _id: user._id, "paymentProfile.razorpay.tokens.id": tokenId },
        {
          $set: {
            "paymentProfile.razorpay.tokens.$.mandateStatus": "active",
            "paymentProfile.razorpay.tokens.$.mandateId": tokenId,
            ...(tokenEntity.max_amount
              ? { "paymentProfile.razorpay.tokens.$.maxAmount": tokenEntity.max_amount }
              : {}),
            ...(tokenEntity.expired_at
              ? {
                  "paymentProfile.razorpay.tokens.$.expireAt": new Date(tokenEntity.expired_at * 1000),
                  "paymentProfile.razorpay.tokens.$.mandateExpiresAt": new Date(tokenEntity.expired_at * 1000),
                }
              : {}),
          },
        },
      );
      console.log(`[Webhook] UPI mandate ${tokenId} confirmed → active`);
    } else if (isUpi) {
      // Previously an unlogged early return. Without this line, a delivered
      // event that simply didn't say "confirmed" was indistinguishable from an
      // event that never arrived — which is exactly the ambiguity that made
      // the stuck-pending bug hard to see.
      console.warn(
        `[Webhook] token.confirmed for ${tokenId} did NOT promote — recurring_details.status=${recurringStatus ?? "ABSENT"} (expected "confirmed"); row left as-is`,
      );
    }
    return;
  }

  const row: Record<string, any> = {
    id: tokenId,
    method: tokenEntity.method || "card",
    last4: card.last4 || null,
    network: card.network || null,
    issuer: card.issuer || null,
    expMonth: card.expiry_month || null,
    expYear: card.expiry_year || null,
    maxAmount: tokenEntity.max_amount || null,
    expireAt: tokenEntity.expired_at
      ? new Date(tokenEntity.expired_at * 1000)
      : null,
    // First-saved is default; subsequent adds default to false. Founder
    // can flip via PATCH /:tokenId/default.
    isDefault: tokens.length === 0,
    addedAt: new Date(),
  };

  if (isUpi) {
    row.vpa =
      [tokenEntity?.vpa?.username, tokenEntity?.vpa?.handle]
        .filter(Boolean)
        .join("@") || null;
    row.mandateId = tokenId;
    row.mandateStatus = recurringStatus === "confirmed" ? "active" : "pending";
    row.mandateExpiresAt = row.expireAt;
  }

  await User.updateOne(
    { _id: user._id },
    { $push: { "paymentProfile.razorpay.tokens": row } },
  );
  console.log(
    `[Webhook] Persisted Razorpay token ${tokenId} (${row.network} •••• ${row.last4}) to user ${user._id}`,
  );
}

async function handleRazorpayTokenCancelled(tokenEntity: any): Promise<void> {
  const { User } = await import("../models/user.model");
  const tokenId = tokenEntity?.id;
  if (!tokenId) return;

  // A UPI mandate can be revoked by the payer inside their UPI app, not just
  // by us. Pulling the row (the card behaviour) would erase the only evidence
  // the mandate ever existed and leave the auto-charge cron silently falling
  // through to "no card" — the subscription would just stop renewing with
  // nobody told. Mark it revoked instead: the cron already gates on
  // mandateStatus === "active", so it stops attempting immediately, and the
  // row remains for the settings page and for support to explain what
  // happened.
  const holder = await User.findOne({
    "paymentProfile.razorpay.tokens.id": tokenId,
  }).select("email paymentProfile.razorpay.tokens");

  const row = ((holder as any)?.paymentProfile?.razorpay?.tokens || []).find(
    (t: any) => t.id === tokenId,
  );

  if (row?.method === "upi") {
    await User.updateOne(
      { "paymentProfile.razorpay.tokens.id": tokenId },
      {
        $set: {
          "paymentProfile.razorpay.tokens.$.mandateStatus": "revoked",
        },
      },
    );
    console.log(
      `[Webhook] UPI mandate ${tokenId} revoked — auto-debit stopped for ${(holder as any)?.email ?? "user"}`,
    );
    return;
  }

  const result = await User.updateOne(
    { "paymentProfile.razorpay.tokens.id": tokenId },
    { $pull: { "paymentProfile.razorpay.tokens": { id: tokenId } } },
  );
  if (result.modifiedCount > 0) {
    console.log(`[Webhook] Pruned Razorpay token ${tokenId}`);
  }
}

/**
 * Persist a Razorpay token onto the User doc using the tokenization
 * info that ships on `payment.captured`. Complementary to
 * `handleRazorpayTokenConfirmed` — that one fires from the
 * `token.confirmed` event; THIS one fires from the payment itself.
 * Either path is sufficient to populate the User doc; running both
 * is idempotent (existing-id check no-ops on second write).
 *
 * The `payment.captured` path is the reliable one because it doesn't
 * require the merchant to have subscribed the separate `token.*`
 * events in Razorpay Dashboard.
 *
 * Payment shape used:
 *   payment.token_id     — "token_xxx"
 *   payment.customer_id  — "cust_xxx", matches paymentProfile.razorpay.customerId
 *   payment.card         — { last4, network, issuer, expiry_month, expiry_year, ... }
 * Token metadata (max_amount / expired_at) isn't on the payment; we
 * leave those null on the User doc and rely on `token.confirmed` (if
 * it's subscribed) to fill them in via `handleRazorpayTokenConfirmed`.
 */
async function persistRazorpayTokenFromPayment(payment: any): Promise<void> {
  const { User } = await import("../models/user.model");
  const customerId = payment?.customer_id;
  const tokenId = payment?.token_id;
  if (!customerId || !tokenId) {
    // For a UPI payment this is the giveaway that checkout did NOT send
    // recurring:1 + customer_id — no mandate was ever attempted.
    if (payment?.method === "upi") {
      console.warn(
        `[UPI-AUTOPAY] payment ${payment?.id} has no ${!customerId ? "customer_id" : "token_id"} — ` +
          `NO mandate was registered (checkout likely omitted recurring:1/customer_id)`,
      );
    }
    return;
  }

  const user = await User.findOne({
    "paymentProfile.razorpay.customerId": customerId,
  }).select("paymentProfile.razorpay.tokens");
  if (!user) {
    console.warn(
      `[Webhook] payment.captured token persist: no user for customer ${customerId}`,
    );
    return;
  }

  const tokens =
    ((user as any).paymentProfile?.razorpay?.tokens || []) as any[];
  if (tokens.some((t) => t.id === tokenId)) {
    // Already saved via a prior webhook — token.confirmed or a
    // previous payment.captured for the same token. Idempotent no-op.
    return;
  }

  const card = payment.card || {};
  const isUpi = payment.method === "upi";

  // UPI Autopay: the payment that registers a mandate carries the token's
  // terms. This is the FALLBACK path — `token.confirmed` is the primary, but
  // it is a separate Dashboard subscription and not reliably emitted (see the
  // block comment above), so a mandate must also be recoverable from here or
  // the payer ends up with a token that can never be charged.
  //
  // `maxAmount`/`expireAt` used to be hardcoded null on every row. For UPI
  // they are load-bearing: the auto-charge branch refuses to debit above the
  // cap, and a null cap would let it try and be rejected by Razorpay.
  //
  // THE TOKEN METADATA IS NOT ON THE PAYMENT. This used to read
  // `payment.token`, a field Razorpay's payment entity does not have — only the
  // flat `payment.token_id`. So `recurring_details.status` was always
  // `undefined` and every UPI mandate was written "pending" with a null cap,
  // no matter that the payer had approved it. Nothing else could ever fix that
  // row: the sole promote path is the separately-subscribed `token.confirmed`
  // webhook, and there is no reconciler behind it.
  //
  // We hold `token_id` and `customer_id` here, so ask Razorpay directly. One
  // extra call per saved token, on a path that already does network I/O.
  const isUpiToken = payment.method === "upi";
  let tokenMeta: any = {};
  if (isUpiToken) {
    const { fetchCustomerToken } = await import("../services/razorpay");
    tokenMeta = (await fetchCustomerToken(customerId, tokenId)) || {};
    console.log(
      `[UPI-AUTOPAY] 4/5 TOKEN payment=${payment.id} token=${tokenId} ` +
        `recurring=${tokenMeta?.recurring ?? "ABSENT"} ` +
        `recurring_details.status=${tokenMeta?.recurring_details?.status ?? "ABSENT"} ` +
        `max_amount=${tokenMeta?.max_amount ?? "ABSENT"} ` +
        `expired_at=${tokenMeta?.expired_at ?? "ABSENT"} vpa=${payment.vpa ?? "-"}`,
    );
  }

  const upiVpa =
    [tokenMeta?.vpa?.username, tokenMeta?.vpa?.handle].filter(Boolean).join("@") ||
    payment.vpa ||
    payment.upi?.vpa ||
    undefined;
  const recurringStatus = tokenMeta?.recurring_details?.status;

  const row: Record<string, any> = {
    id: tokenId,
    method: payment.method || "card",
    last4: card.last4 || null,
    network: card.network || null,
    issuer: card.issuer || null,
    expMonth: card.expiry_month || null,
    expYear: card.expiry_year || null,
    maxAmount: tokenMeta?.max_amount ?? null,
    expireAt: tokenMeta?.expired_at
      ? new Date(Number(tokenMeta.expired_at) * 1000)
      : null,
    isDefault: tokens.length === 0,
    addedAt: new Date(),
  };

  if (isUpi) {
    const { mandateStatusFromRecurring } = await import("../services/razorpay");
    row.vpa = upiVpa || null;
    row.mandateId = tokenId; // Razorpay addresses the mandate by its token id
    // Mapped from Razorpay's own vocabulary — "confirmed" is the only state
    // that means the payer approved it and the cron may debit.
    row.mandateStatus = mandateStatusFromRecurring(recurringStatus);
    row.mandateExpiresAt = row.expireAt;
  }

  await User.updateOne(
    { _id: user._id },
    { $push: { "paymentProfile.razorpay.tokens": row } },
  );
  console.log(
    isUpi
      ? `[Webhook] Persisted UPI mandate ${tokenId} (${row.vpa}) to user ${user._id} — recurring_details.status=${recurringStatus ?? "ABSENT"} → mandateStatus=${row.mandateStatus}, cap=${row.maxAmount ?? "null"}`
      : `[Webhook] Persisted Razorpay token ${tokenId} (${row.network} •••• ${row.last4}) to user ${user._id} via payment.captured`,
  );
}

/**
 * Webhook health check endpoint
 */
router.get("/health", (_req: Request, res: Response) => {
  console.log("[Webhook] Health check called");
  return res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Test endpoint to verify webhook route is accessible
 * Call: GET /webhooks/razorpay/test
 */
router.get("/razorpay/test", (_req: Request, res: Response) => {
  console.log("[Webhook] Test endpoint called - webhook route is accessible!");
  return res.status(200).json({
    message: "Webhook route is accessible",
    endpoint: "/webhooks/razorpay",
    method: "POST",
    timestamp: new Date().toISOString(),
  });
});

export default router;
