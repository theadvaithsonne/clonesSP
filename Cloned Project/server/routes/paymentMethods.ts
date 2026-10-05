import { Router, Request, Response } from "express";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { User } from "../models/user.model";
import {
  createSetupIntent,
  detachPaymentMethod,
  getOrCreateStripeCustomer,
  stripeEnabled,
} from "../services/stripe";
import {
  createSaveCardOrder,
  deleteRazorpayToken,
  getOrCreateRazorpayCustomer,
} from "../services/razorpay";

/**
 * Saved-payment-methods surface. Backs the "Payment Methods" settings
 * page + the "Pay with saved •••• 4242" row on PaymentMethodSelector.
 *
 * Stripe is phase 1. A Razorpay slot will land under
 * `/payment-methods/razorpay/*` in phase 2 (see the plan file).
 */
const router = Router();

/**
 * GET /payment-methods
 * Returns the current user's saved cards, default-first. Reads from the
 * User doc — kept in sync with Stripe by the webhook. FE should treat
 * this as authoritative for the picker.
 */
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user as { userId: string };
    const doc = await User.findById(user.userId)
      .select("paymentProfile")
      .lean();

    const stripe = (doc as any)?.paymentProfile?.stripe || {
      customerId: null,
      methods: [],
    };
    const razorpay = (doc as any)?.paymentProfile?.razorpay || {
      customerId: null,
      tokens: [],
    };
    // Same "default-first, then most recent" ordering for both sides so
    // the picker + settings page share sort behavior.
    const sortByDefaultAndDate = (a: any, b: any) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return (
        new Date(b.addedAt || 0).getTime() -
        new Date(a.addedAt || 0).getTime()
      );
    };
    const methods = [...(stripe.methods || [])].sort(sortByDefaultAndDate);
    const tokens = [...(razorpay.tokens || [])].sort(sortByDefaultAndDate);

    return res.json({
      success: true,
      stripe: {
        customerId: stripe.customerId || null,
        methods,
      },
      razorpay: {
        customerId: razorpay.customerId || null,
        tokens,
      },
    });
  } catch (err: any) {
    console.error("[payment-methods][list] error:", err);
    return res
      .status(500)
      .json({ success: false, error: err?.message || "Failed to list" });
  }
});

/**
 * POST /payment-methods/stripe/setup-intent
 * Mints a Stripe SetupIntent so the FE can bind Elements to a fresh
 * card entry without charging anything. Creates the Customer if the
 * user doesn't have one yet.
 */
router.post(
  "/stripe/setup-intent",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!stripeEnabled) {
        return res
          .status(503)
          .json({ success: false, error: "Stripe not configured" });
      }
      const user = (req as any).user as { userId: string };
      const customerId = await getOrCreateStripeCustomer({
        userId: user.userId,
      });
      // Attach an India e-mandate on every save. Stripe only applies
      // it to Indian issuer cards (supported_types: ["india"]) — for
      // foreign cards it's silently ignored, so this is safe as a
      // default. Amount cap = ₹1,00,000 per RBI (10_000_000 paise).
      // With this in place, subsequent off-session INR charges up to
      // the cap fire without OTP by passing `mandate: <id>` on the PI.
      const { clientSecret, setupIntentId } = await createSetupIntent(
        customerId,
        {
          indianMandate: {
            reference: `garage-${user.userId}-${Date.now()}`,
            amountInPaise: 10_000_000, // ₹1,00,000 cap
            description:
              "Garage — subscription renewals and one-off purchases",
            interval: "sporadic",
          },
        },
      );
      return res.json({
        success: true,
        clientSecret,
        setupIntentId,
        customerId,
        // Publishable key travels with the response so the FE doesn't
        // need its own env var; matches how selectPaymentMethod ships it
        // in the checkout flow.
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
      });
    } catch (err: any) {
      console.error("[payment-methods][setup-intent] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to create setup intent",
      });
    }
  },
);

/**
 * DELETE /payment-methods/stripe/:pmId
 * Detaches the card from the user's Stripe Customer. The webhook
 * (`payment_method.detached`) prunes the User doc — but we also prune
 * inline so the FE list refreshes without waiting for the webhook.
 */
router.delete(
  "/stripe/:pmId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!stripeEnabled) {
        return res
          .status(503)
          .json({ success: false, error: "Stripe not configured" });
      }
      const user = (req as any).user as { userId: string };
      const { pmId } = req.params;

      // Guard: user can only detach their own cards. Reject if the pm
      // isn't on their profile (defense-in-depth against forged ids).
      const doc = await User.findById(user.userId)
        .select("paymentProfile.stripe.methods")
        .lean();
      const removedCard = ((doc as any)?.paymentProfile?.stripe?.methods || []).find(
        (m: any) => m.id === pmId,
      );
      if (!removedCard) {
        return res
          .status(404)
          .json({ success: false, error: "Payment method not found" });
      }

      await detachPaymentMethod(pmId);

      // Record the removal before pulling the row — see
      // `paymentProfile.removedInstruments` on the User model.
      const pull = await User.updateOne(
        { _id: new Types.ObjectId(user.userId) },
        {
          $pull: { "paymentProfile.stripe.methods": { id: pmId } },
          $push: {
            "paymentProfile.removedInstruments": {
              kind: "card",
              id: pmId,
              removedAt: new Date(),
              label: [removedCard.brand, removedCard.last4].filter(Boolean).join(" •••• ") || undefined,
            },
          },
        },
      );

      // If we deleted the current default and other methods remain,
      // promote the most-recently-added one to default so the picker
      // still has a preferred pick.
      const after = await User.findById(user.userId)
        .select("paymentProfile.stripe.methods")
        .lean();
      const methods =
        ((after as any)?.paymentProfile?.stripe?.methods || []) as any[];
      if (methods.length > 0 && !methods.some((m) => m.isDefault)) {
        methods.sort(
          (a, b) =>
            new Date(b.addedAt || 0).getTime() -
            new Date(a.addedAt || 0).getTime(),
        );
        await User.updateOne(
          {
            _id: new Types.ObjectId(user.userId),
            "paymentProfile.stripe.methods.id": methods[0].id,
          },
          { $set: { "paymentProfile.stripe.methods.$.isDefault": true } },
        );
      }

      return res.json({ success: true, removed: pull.modifiedCount > 0 });
    } catch (err: any) {
      console.error("[payment-methods][detach] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to detach card",
      });
    }
  },
);

/**
 * PATCH /payment-methods/stripe/:pmId/default
 * Marks the given pm as the user's default. Local flag only — Stripe
 * doesn't itself store a "default PM" that affects our off-session
 * charges (we always pass the pm id explicitly).
 */
router.patch(
  "/stripe/:pmId/default",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { pmId } = req.params;

      const doc = await User.findById(user.userId).select(
        "paymentProfile.stripe.methods",
      );
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      const methods =
        ((doc as any).paymentProfile?.stripe?.methods || []) as any[];
      if (!methods.some((m) => m.id === pmId)) {
        return res
          .status(404)
          .json({ success: false, error: "Payment method not found" });
      }

      // Two-step: unset every default, then set the target one.
      // Cheaper than a $[] filter for a small array.
      await User.updateOne(
        { _id: new Types.ObjectId(user.userId) },
        { $set: { "paymentProfile.stripe.methods.$[].isDefault": false } },
      );
      await User.updateOne(
        {
          _id: new Types.ObjectId(user.userId),
          "paymentProfile.stripe.methods.id": pmId,
        },
        { $set: { "paymentProfile.stripe.methods.$.isDefault": true } },
      );

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[payment-methods][default] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to set default",
      });
    }
  },
);

// ─── Razorpay (phase 2) ────────────────────────────────────────────────
//
// Razorpay doesn't have a Stripe-SetupIntent equivalent — every save
// requires a real charge. `/save-card-order` returns a ₹1 order that
// the FE opens via Standard Checkout with `save: 1`. On payment
// captured, the webhook auto-refunds and persists the resulting token.

/** POST /payment-methods/razorpay/save-card-order → { orderId, keyId, customerId } */
router.post(
  "/razorpay/save-card-order",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      if (!process.env.RAZORPAY_KEY_ID) {
        return res
          .status(503)
          .json({ success: false, error: "Razorpay not configured" });
      }
      const user = (req as any).user as { userId: string };
      const customerId = await getOrCreateRazorpayCustomer({
        userId: user.userId,
      });

      // ₹1 authorization. The `payment.captured` webhook branches on
      // `notes.type === "save_card_authorization"` and refunds it in
      // full — founder sees "Card saved" + a refund on their statement
      // within 5-7 business days.
      const order = await createSaveCardOrder({
        amount: 100, // ₹1 in paise
        currency: "INR",
        customerId,
        isAuthorizationOnly: true,
        notes: { garageUserId: user.userId },
      });

      return res.json({
        success: true,
        orderId: order.id,
        keyId: process.env.RAZORPAY_KEY_ID,
        customerId,
        amount: order.amount,
        currency: order.currency,
      });
    } catch (err: any) {
      console.error("[payment-methods][razorpay/save-card-order] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to create save-card order",
      });
    }
  },
);

/** DELETE /payment-methods/razorpay/:tokenId */
router.delete(
  "/razorpay/:tokenId",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { tokenId } = req.params;

      const doc = await User.findById(user.userId)
        .select("paymentProfile.razorpay")
        .lean();
      const customerId = (doc as any)?.paymentProfile?.razorpay?.customerId;
      const row = ((doc as any)?.paymentProfile?.razorpay?.tokens || []).find(
        (t: any) => t.id === tokenId,
      );
      const owns = !!row;
      if (!customerId || !owns) {
        return res
          .status(404)
          .json({ success: false, error: "Token not found" });
      }

      try {
        if (row?.method === "upi") {
          // A UPI mandate must be CANCELLED at NPCI, not just deleted from
          // Razorpay's vault — per Razorpay's docs, deleting "does not cancel
          // the mandate". Deleting alone left the mandate showing as active in
          // the payer's UPI app, so "Revoke" here withdrew nothing and they had
          // to cancel it manually in GPay/PhonePe.
          //
          // revokeUpiMandate intentionally leaves the token in place after
          // cancelling, so the state stays observable — cancellation is
          // asynchronous and can be refused by NPCI.
          const { revokeUpiMandate } = await import("../services/razorpay");
          await revokeUpiMandate({ customerId, tokenId });
        } else {
          await deleteRazorpayToken({ customerId, tokenId });
        }
      } catch (rpErr: any) {
        // Log and continue — even if Razorpay's side rejects (token
        // already gone), we still prune our local mirror.
        console.warn(
          "[payment-methods][razorpay/delete] razorpay side failed:",
          rpErr?.message,
        );
      }

      // Record the removal before pulling the row — see
      // `paymentProfile.removedInstruments` on the User model.
      const pull = await User.updateOne(
        { _id: new Types.ObjectId(user.userId) },
        {
          $pull: { "paymentProfile.razorpay.tokens": { id: tokenId } },
          $push: {
            "paymentProfile.removedInstruments": {
              kind: row?.method === "upi" ? "upi" : "card",
              id: tokenId,
              removedAt: new Date(),
              label: row?.method === "upi" ? row?.vpa || undefined : [row?.network, row?.last4].filter(Boolean).join(" •••• ") || undefined,
            },
          },
        },
      );

      // Promote most-recent to default if we removed the current default.
      const after = await User.findById(user.userId)
        .select("paymentProfile.razorpay.tokens")
        .lean();
      const tokens =
        ((after as any)?.paymentProfile?.razorpay?.tokens || []) as any[];
      if (tokens.length > 0 && !tokens.some((t) => t.isDefault)) {
        tokens.sort(
          (a, b) =>
            new Date(b.addedAt || 0).getTime() -
            new Date(a.addedAt || 0).getTime(),
        );
        await User.updateOne(
          {
            _id: new Types.ObjectId(user.userId),
            "paymentProfile.razorpay.tokens.id": tokens[0].id,
          },
          { $set: { "paymentProfile.razorpay.tokens.$.isDefault": true } },
        );
      }

      return res.json({ success: true, removed: pull.modifiedCount > 0 });
    } catch (err: any) {
      console.error("[payment-methods][razorpay/delete] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to delete token",
      });
    }
  },
);

/** PATCH /payment-methods/razorpay/:tokenId/default */
router.patch(
  "/razorpay/:tokenId/default",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const user = (req as any).user as { userId: string };
      const { tokenId } = req.params;

      const doc = await User.findById(user.userId).select(
        "paymentProfile.razorpay.tokens",
      );
      if (!doc) {
        return res
          .status(404)
          .json({ success: false, error: "User not found" });
      }
      const tokens =
        ((doc as any).paymentProfile?.razorpay?.tokens || []) as any[];
      if (!tokens.some((t) => t.id === tokenId)) {
        return res
          .status(404)
          .json({ success: false, error: "Token not found" });
      }

      await User.updateOne(
        { _id: new Types.ObjectId(user.userId) },
        { $set: { "paymentProfile.razorpay.tokens.$[].isDefault": false } },
      );
      await User.updateOne(
        {
          _id: new Types.ObjectId(user.userId),
          "paymentProfile.razorpay.tokens.id": tokenId,
        },
        { $set: { "paymentProfile.razorpay.tokens.$.isDefault": true } },
      );

      return res.json({ success: true });
    } catch (err: any) {
      console.error("[payment-methods][razorpay/default] error:", err);
      return res.status(500).json({
        success: false,
        error: err?.message || "Failed to set default",
      });
    }
  },
);

export default router;
