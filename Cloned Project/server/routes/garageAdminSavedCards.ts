// Admin surface for a user's saved cards (Stripe only — Razorpay
// tokens are read-only elsewhere and out of scope here).
//
// Powers the "Saved Cards" tab on
// /garage-admin/one-time-affiliates/[userId]. Five actions:
//   1. GET  /users/:userId/saved-cards
//        List the user's Stripe methods with mandate metadata.
//   2. PATCH /users/:userId/saved-cards/:pmId/default
//        Flip default flag locally (no Stripe API call needed).
//   3. DELETE /users/:userId/saved-cards/:pmId
//        Detach from Stripe + $pull from User.paymentProfile.
//   4. POST /users/:userId/saved-cards/:pmId/charge
//        One-time charge for a specific product. Routes through the
//        normal Invoice → chargeSavedPaymentMethod → webhook →
//        fulfillInvoice pipeline so the buyer actually GETS the
//        product. Applies the shared MIT/CIT gating from
//        services/paymentGating.ts. Returns
//        {status: "succeeded"|"processing"|"requires_action"|"failed", ...}.
//   5. POST /users/:userId/saved-cards/refund
//        Full refund of a specific past Stripe charge (via PI id).
//        Requires the invoice to belong to :userId. Charge.refunded
//        webhook flips invoice → refunded automatically.
//   +  GET /users/:userId/saved-cards/:pmId/refundable-charges
//        Past Stripe-paid invoices on this user that are still
//        refundable.
//   +  GET /orgs/:orgId/products
//        Product list for the picker.
//
// Auth: super-admin only (mirrors garageAdminWallets). Every mutation
// stamps `initiatedBy.garageAdminId` on Stripe metadata + invoice
// metadata as the audit trail.

import { Router, Response } from "express";
import { Types } from "mongoose";
import {
  requireGarageAdminAuth,
  requireGarageSuperAdmin,
  GarageAdminRequest,
} from "../middleware/garageAdminAuth";
import { User } from "../models/user.model";
import { Product } from "../models/product.model";
import { Channel } from "../models/channel.model";
import { Invoice } from "../models/invoice.model";
import {
  chargeSavedPaymentMethod,
  detachPaymentMethod,
  refundStripeCharge,
  createSetupIntent,
  getOrCreateStripeCustomer,
} from "../services/stripe";
import { resolveSavedCardChargeMode } from "../services/paymentGating";
import { createInvoice, getNextChargeDate } from "../services/invoice";
import { signJwt } from "../services/jwt";

const router = Router();
router.use(requireGarageAdminAuth, requireGarageSuperAdmin);

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function isObjectId(s: string): boolean {
  return Types.ObjectId.isValid(s);
}

async function loadUserOr404(
  userId: string,
  res: Response,
): Promise<any | null> {
  if (!isObjectId(userId)) {
    res.status(400).json({ error: "Invalid userId" });
    return null;
  }
  const user = await User.findById(userId)
    .select("_id email name paymentProfile")
    .lean();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return user;
}

// ──────────────────────────────────────────────────────────────────
// 1. GET saved cards
// ──────────────────────────────────────────────────────────────────

router.get(
  "/users/:userId/saved-cards",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;
      const stripe = user.paymentProfile?.stripe || {
        customerId: null,
        methods: [],
      };

      // UPI Autopay mandates sit alongside the Stripe cards: same idea (a
      // stored instrument an admin can charge), different rail. Only UPI rows
      // — a Razorpay CARD token is a saved card, not a mandate, and is not
      // chargeable off-session the way these are.
      //
      // `maxAmount` is the per-debit ceiling in PAISE and is the constraint an
      // admin most needs to see: a mandate registered for a $36/mo plan is
      // capped around ₹5,100, so most ad-hoc amounts will simply not fit.
      const rzp = (user.paymentProfile as any)?.razorpay || {};
      const mandates = ((rzp.tokens || []) as any[])
        .filter((t) => t?.method === "upi")
        .map((t) => ({
          id: t.id,
          vpa: t.vpa || null,
          mandateId: t.mandateId || null,
          mandateStatus: t.mandateStatus || null,
          maxAmount: t.maxAmount ?? null, // paise
          mandateExpiresAt: t.mandateExpiresAt || null,
          isDefault: !!t.isDefault,
          addedAt: t.addedAt,
          // Only an active, unexpired mandate can actually be debited.
          chargeable:
            t.mandateStatus === "active" &&
            (!t.mandateExpiresAt || new Date(t.mandateExpiresAt) > new Date()),
        }));

      res.json({
        success: true,
        stripe: {
          customerId: stripe.customerId || null,
          methods: stripe.methods || [],
        },
        razorpay: {
          customerId: rzp.customerId || null,
          mandates,
        },
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] list:", err);
      res.status(500).json({ error: err?.message || "Failed to load cards" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// 2. Set default
// ──────────────────────────────────────────────────────────────────

router.patch(
  "/users/:userId/saved-cards/:pmId/default",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;
      const methods = user.paymentProfile?.stripe?.methods || [];
      const target = methods.find((m: any) => m.id === req.params.pmId);
      if (!target) return res.status(404).json({ error: "Card not found on this user" });

      // Two-step update: unset every default, set the target as default.
      await User.updateOne(
        { _id: user._id },
        { $set: { "paymentProfile.stripe.methods.$[].isDefault": false } },
      );
      const r = await User.updateOne(
        {
          _id: user._id,
          "paymentProfile.stripe.methods.id": req.params.pmId,
        },
        { $set: { "paymentProfile.stripe.methods.$.isDefault": true } },
      );
      res.json({ success: true, modified: r.modifiedCount });
    } catch (err: any) {
      console.error("[admin-saved-cards] set-default:", err);
      res.status(500).json({ error: err?.message || "Failed to set default" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// 3. Delete
// ──────────────────────────────────────────────────────────────────

router.delete(
  "/users/:userId/saved-cards/:pmId",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;
      const methods = user.paymentProfile?.stripe?.methods || [];
      const target = methods.find((m: any) => m.id === req.params.pmId);
      if (!target) return res.status(404).json({ error: "Card not found on this user" });

      try {
        await detachPaymentMethod(req.params.pmId);
      } catch (stripeErr: any) {
        // Common case: card already detached in Stripe; still prune local.
        console.warn(
          `[admin-saved-cards] detach ${req.params.pmId} on Stripe: ${stripeErr?.message} — pruning local anyway`,
        );
      }
      await User.updateOne(
        { _id: user._id },
        { $pull: { "paymentProfile.stripe.methods": { id: req.params.pmId } } },
      );
      res.json({ success: true });
    } catch (err: any) {
      console.error("[admin-saved-cards] delete:", err);
      res.status(500).json({ error: err?.message || "Failed to delete card" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Send-add-card link — mints a Stripe SetupIntent for the user's
// customer + signs a short-lived JWT + returns a URL the admin can
// share with the user. The user opens the URL on THEIR device, enters
// their card via Stripe Elements + confirms the RBI mandate — the PAN
// never touches our servers or the admin's browser (PCI SAQ A boundary).
//
// The token is a purpose-scoped JWT that ONLY authorises the "exchange
// this token for a SetupIntent client_secret" call at the public
// endpoint below — it does NOT authenticate any user session.
//
// 24-hour token expiry. Same SetupIntent mandate options as the user's
// own settings-page save-card flow, so Indian cards land with a live
// mandate for zero-OTP future admin charges.
// ──────────────────────────────────────────────────────────────────

const ADD_LINK_JWT_PURPOSE = "save_card_admin_link";
const ADD_LINK_TTL_SECONDS = 60 * 60 * 24; // 24h

router.post(
  "/users/:userId/saved-cards/create-add-link",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      // Ensure the user has a Stripe customer — creates one lazily
      // (same helper the user's own settings page uses).
      const customerId = await getOrCreateStripeCustomer({
        userId: String(user._id),
      });

      // Attach an India e-mandate on every save. Stripe applies it only
      // to Indian issuers (`supported_types: ["india"]`) — for foreign
      // cards it's silently ignored. ₹1L cap per RBI. Same shape as
      // routes/paymentMethods.ts:105 so admin-added cards land with
      // the same mandate footprint as user-added ones.
      const { clientSecret, setupIntentId } = await createSetupIntent(
        customerId,
        {
          indianMandate: {
            reference: `garage-admin-${admin.id}-${user._id}-${Date.now()}`,
            amountInPaise: 10_000_000,
            description:
              "Garage — subscription renewals and one-off purchases",
            interval: "sporadic",
          },
        },
      );

      // Sign a purpose-scoped, short-lived JWT. Contains what the
      // public exchange endpoint needs to hydrate + serve the setup
      // client_secret. Never treat this as an auth JWT — the exchange
      // endpoint rejects anything without purpose match.
      const token = signJwt(
        {
          purpose: ADD_LINK_JWT_PURPOSE,
          userId: String(user._id),
          customerId,
          setupIntentId,
          clientSecret,
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
        },
        { expiresIn: ADD_LINK_TTL_SECONDS },
      );

      const baseUrl =
        process.env.FRONTEND_URL || "https://my.garage.app";
      const url = `${baseUrl.replace(/\/$/, "")}/save-card/${token}`;
      const expiresAt = new Date(Date.now() + ADD_LINK_TTL_SECONDS * 1000);

      res.json({
        success: true,
        url,
        token,
        expiresAt,
        setupIntentId,
        recipient: {
          userId: String(user._id),
          email: user.email,
          name: user.name,
        },
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] create-add-link:", err);
      res
        .status(500)
        .json({ error: err?.message || "Failed to create add-card link" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Product picker
// ──────────────────────────────────────────────────────────────────

router.get(
  "/orgs/:orgId/products",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!isObjectId(orgId)) {
        return res.status(400).json({ error: "Invalid orgId" });
      }
      const rows = await Product.find({
        organizationId: new Types.ObjectId(orgId),
        status: "active",
      })
        .select("_id name price currency isDigital images gstInclusive")
        .sort({ createdAt: -1 })
        .limit(200)
        .lean<any[]>();
      res.json({
        success: true,
        products: rows.map((p) => ({
          _id: String(p._id),
          name: p.name,
          price: p.price,
          currency: p.currency,
          isDigital: !!p.isDigital,
          gstInclusive: !!p.gstInclusive,
          image: p.images?.[0] || null,
        })),
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] products:", err);
      res.status(500).json({ error: err?.message || "Failed to load products" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Subscribable-items picker (products + channels marked isSubscription)
// ──────────────────────────────────────────────────────────────────

router.get(
  "/orgs/:orgId/subscribable-items",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const { orgId } = req.params;
      if (!isObjectId(orgId)) {
        return res.status(400).json({ error: "Invalid orgId" });
      }
      const [products, channels] = await Promise.all([
        Product.find({
          organizationId: new Types.ObjectId(orgId),
          status: "active",
          isSubscription: true,
          subscriptionPeriod: { $exists: true, $ne: null },
        })
          .select(
            "_id name price currency isDigital images subscriptionPeriod gstInclusive",
          )
          .sort({ createdAt: -1 })
          .limit(200)
          .lean<any[]>(),
        Channel.find({
          storeId: new Types.ObjectId(orgId),
          isActive: true,
          isSubscription: true,
          subscriptionPeriod: { $exists: true, $ne: null },
        })
          .select(
            "_id title price currency coverImage subscriptionPeriod gstInclusive",
          )
          .sort({ createdAt: -1 })
          .limit(200)
          .lean<any[]>(),
      ]);
      const items = [
        ...products.map((p) => ({
          itemType: "product" as const,
          _id: String(p._id),
          name: p.name,
          price: Number(p.price || 0),
          currency: p.currency || "USD",
          subscriptionPeriod: p.subscriptionPeriod,
          gstInclusive: !!p.gstInclusive,
          image: p.images?.[0] || null,
        })),
        ...channels.map((c) => ({
          itemType: "channel" as const,
          _id: String(c._id),
          name: c.title,
          // Channels store price in units (dollars), not cents — normalise
          // to smallest unit here so the FE preview + BE charge line up.
          price: Math.round(Number(c.price || 0) * 100),
          currency: c.currency || "USD",
          subscriptionPeriod: c.subscriptionPeriod,
          gstInclusive: !!c.gstInclusive,
          image: c.coverImage || null,
        })),
      ];
      res.json({ success: true, items });
    } catch (err: any) {
      console.error("[admin-saved-cards] subscribable-items:", err);
      res.status(500).json({
        error: err?.message || "Failed to load subscribable items",
      });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// 4. One-time charge
// ──────────────────────────────────────────────────────────────────

router.post(
  "/users/:userId/saved-cards/:pmId/charge",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { orgId, productId } = req.body || {};
      if (!orgId || !productId || !isObjectId(orgId) || !isObjectId(productId)) {
        return res
          .status(400)
          .json({ error: "orgId and productId (ObjectIds) are required" });
      }

      const customerId = user.paymentProfile?.stripe?.customerId as
        | string
        | undefined;
      const methods = (user.paymentProfile?.stripe?.methods || []) as any[];
      const card = methods.find((m: any) => m.id === req.params.pmId);
      if (!customerId || !card) {
        return res
          .status(404)
          .json({ error: "Card not found on this user" });
      }

      const product = await Product.findOne({
        _id: new Types.ObjectId(productId),
        organizationId: new Types.ObjectId(orgId),
      }).lean<any>();
      if (!product) {
        return res
          .status(404)
          .json({ error: "Product not found on this org" });
      }
      if (product.status === "archived" || product.status === "draft") {
        return res.status(400).json({
          error: `Product is ${product.status} — cannot charge for it`,
        });
      }

      // Find the org's founder as the seller. Every invoice needs one.
      const orgFounder: any = await User.findOne({
        organizations: {
          $elemMatch: {
            organization: new Types.ObjectId(orgId),
            role: "founder",
          },
        },
      })
        .select("_id email")
        .lean();
      if (!orgFounder) {
        return res.status(400).json({
          error: "Could not resolve an org founder to attribute this sale to",
        });
      }

      // Build the invoice — same shape a real buy would take.
      const unitPrice = Number(product.price || 0);
      if (!unitPrice || unitPrice <= 0) {
        return res.status(400).json({
          error: "Product has no price — cannot admin-charge",
        });
      }
      const invoice = await createInvoice({
        organizationId: String(orgId),
        sellerId: String(orgFounder._id),
        userId: String(user._id),
        customerEmail: user.email,
        customerName: user.name,
        lineItems: [
          {
            itemType: "product",
            itemId: String(product._id),
            itemName: product.name,
            itemImage: product.images?.[0],
            quantity: 1,
            unitPrice,
            originalCurrency: product.currency || "USD",
          },
        ],
        itemCurrency: product.currency || "USD",
        metadata: {
          type: "admin_one_time_charge",
          adminInitiated: true,
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
        },
      });

      const chargeMode = resolveSavedCardChargeMode({
        card,
        invoiceAmount: invoice.totalAmount,
        invoiceCurrency: invoice.itemCurrency,
      });

      // MIT/CIT: if CIT (INR sans mandate / over cap), the admin can't
      // complete the OTP for the buyer. Return the invoice + client_secret
      // so admin can share the invoice URL and buyer completes OTP.
      const idempotencyKey = `admin-charge-${invoice._id}`;
      let pi: any;
      try {
        pi = await chargeSavedPaymentMethod({
          customerId,
          paymentMethodId: req.params.pmId,
          amountInSmallestUnit: invoice.totalAmount,
          currency: invoice.itemCurrency,
          offSession: chargeMode.offSession,
          ...(chargeMode.mandate ? { mandate: chargeMode.mandate } : {}),
          idempotencyKey,
          metadata: {
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            userId: String(user._id),
            orgId: String(orgId),
            adminInitiated: "true",
            initiatedByGarageAdminId: String(admin.id),
            initiatedByGarageAdminEmail: admin.email,
            chargeMode: chargeMode.reason,
          } as any,
          description: `Admin one-time charge: ${product.name}`,
          receiptEmail: user.email,
        });
      } catch (err: any) {
        // Stripe throws on authentication_required; PI attached to err.raw.
        if (
          err?.code === "authentication_required" &&
          err?.raw?.payment_intent
        ) {
          pi = err.raw.payment_intent;
        } else {
          console.error("[admin-saved-cards] charge Stripe error:", err);
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                status: "failed",
                failedAt: new Date(),
                errorDescription:
                  err?.raw?.message || err?.message || "Stripe error",
              },
            },
          );
          return res.status(400).json({
            success: false,
            status: "failed",
            error: err?.raw?.message || err?.message || "Charge failed",
            invoiceId: String(invoice._id),
          });
        }
      }

      // Stamp the PI on the invoice (webhook uses this to correlate).
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "metadata.stripePaymentIntentId": pi.id,
            "metadata.stripeCustomerId": customerId,
            "metadata.stripePaymentMethodId": req.params.pmId,
            "metadata.chargeMode": chargeMode.reason,
            status:
              pi.status === "succeeded" ? "paid" : "pending",
            paymentPlatform: "stripe",
            paymentMethodCategory: "card",
            paymentCurrency: (invoice.itemCurrency || "USD").toUpperCase(),
          },
        },
      );

      if (pi.status === "succeeded") {
        return res.json({
          success: true,
          status: "succeeded",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          note: "Webhook will finalize fulfillment.",
        });
      }
      if (pi.status === "processing") {
        return res.json({
          success: true,
          status: "processing",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          note: "Charge is settling; the webhook will finalize it.",
        });
      }
      if (
        pi.status === "requires_action" ||
        pi.status === "requires_confirmation"
      ) {
        const invoiceUrl = `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${invoice._id}`;
        return res.json({
          success: true,
          status: "requires_action",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          clientSecret: pi.client_secret,
          invoiceUrl,
          note:
            chargeMode.reason === "inr_cit_otp_required"
              ? "This card requires an OTP the buyer must enter. Share the invoice URL with them."
              : "Stripe requested additional authentication. Share the invoice URL with the buyer.",
        });
      }
      return res.json({
        success: false,
        status: pi.status,
        paymentIntentId: pi.id,
        invoiceId: String(invoice._id),
        error: `Charge landed in an unexpected status: ${pi.status}`,
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] charge:", err);
      res.status(500).json({ error: err?.message || "Failed to charge" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Start a subscription — creates a recurring parent invoice + charges
// cycle 1 with the same MIT/CIT gating as the one-time charge above.
// Renewals from cycle 2 onward are handled automatically by the daily
// `autoChargeRecurringInvoices` cron on the same saved card (or the
// user's current default at renewal time).
//
// Guardrail: INR + Indian card + no active mandate is REFUSED —
// every renewal would need OTP, which defeats the point of a sub.
// ──────────────────────────────────────────────────────────────────

router.post(
  "/users/:userId/saved-cards/:pmId/start-subscription",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { orgId, itemType, itemId } = req.body || {};
      if (
        !orgId ||
        !itemId ||
        !isObjectId(orgId) ||
        !isObjectId(itemId) ||
        (itemType !== "product" && itemType !== "channel")
      ) {
        return res.status(400).json({
          error:
            "orgId, itemType ('product' | 'channel') and itemId (ObjectId) are required",
        });
      }

      const customerId = user.paymentProfile?.stripe?.customerId as
        | string
        | undefined;
      const methods = (user.paymentProfile?.stripe?.methods || []) as any[];
      const card = methods.find((m: any) => m.id === req.params.pmId);
      if (!customerId || !card) {
        return res
          .status(404)
          .json({ error: "Card not found on this user" });
      }

      // Load + validate the sellable. Normalises so downstream code
      // reads a single shape regardless of product vs channel.
      let itemShape: {
        name: string;
        image: string | null;
        priceSmallest: number;
        currency: string;
        subscriptionPeriod: "weekly" | "monthly" | "quarterly" | "yearly";
        sellerId: string;
      } | null = null;

      if (itemType === "product") {
        const p: any = await Product.findOne({
          _id: new Types.ObjectId(itemId),
          organizationId: new Types.ObjectId(orgId),
        }).lean();
        if (!p) return res.status(404).json({ error: "Product not found on this org" });
        if (p.status !== "active") {
          return res.status(400).json({
            error: `Product is ${p.status} — cannot subscribe`,
          });
        }
        if (!p.isSubscription || !p.subscriptionPeriod) {
          return res.status(400).json({
            error: "Product is not a subscription (isSubscription must be true with a subscriptionPeriod)",
          });
        }
        // Product.price is already in smallest unit.
        itemShape = {
          name: p.name,
          image: p.images?.[0] || null,
          priceSmallest: Number(p.price || 0),
          currency: p.currency || "USD",
          subscriptionPeriod: p.subscriptionPeriod,
          sellerId: String(p.createdBy),
        };
      } else {
        const c: any = await Channel.findOne({
          _id: new Types.ObjectId(itemId),
          storeId: new Types.ObjectId(orgId),
        }).lean();
        if (!c) return res.status(404).json({ error: "Channel not found on this org" });
        if (c.isActive === false) {
          return res.status(400).json({
            error: "Channel is inactive — cannot subscribe",
          });
        }
        if (!c.isSubscription || !c.subscriptionPeriod) {
          return res.status(400).json({
            error: "Channel is not a subscription (isSubscription must be true with a subscriptionPeriod)",
          });
        }
        // Channel.price is stored in units (dollars/rupees). Normalise.
        itemShape = {
          name: c.title,
          image: c.coverImage || null,
          priceSmallest: Math.round(Number(c.price || 0) * 100),
          currency: c.currency || "USD",
          subscriptionPeriod: c.subscriptionPeriod,
          sellerId: String(c.createdBy),
        };
      }
      if (itemShape.priceSmallest <= 0) {
        return res.status(400).json({
          error: "Item has no price — cannot subscribe",
        });
      }

      // Up-front refusal for INR + Indian card + no active mandate.
      // Otherwise every renewal would sit unpaid waiting on OTP.
      const wouldNeedOtpEveryCycle =
        (itemShape.currency || "").toUpperCase() === "INR" &&
        card.country === "IN" &&
        !(
          card.mandateId &&
          card.mandateStatus === "active" &&
          card.mandateAmount &&
          itemShape.priceSmallest <= Number(card.mandateAmount)
        );
      if (wouldNeedOtpEveryCycle) {
        return res.status(400).json({
          error:
            "This is an INR Indian-issuer card without an active RBI mandate for the required amount. Every renewal would need OTP — subscription refused. Ask the buyer to re-save the card with the mandate opt-in, or use a card that supports it.",
        });
      }

      // Create the recurring parent invoice.
      const invoice = await createInvoice({
        organizationId: String(orgId),
        sellerId: itemShape.sellerId,
        userId: String(user._id),
        customerEmail: user.email,
        customerName: user.name,
        lineItems: [
          {
            itemType,
            itemId: String(itemId),
            itemName: itemShape.name,
            itemImage: itemShape.image || undefined,
            quantity: 1,
            unitPrice: itemShape.priceSmallest,
            originalCurrency: itemShape.currency,
          },
        ],
        itemCurrency: itemShape.currency,
        isRecurring: true,
        recurringPeriod: itemShape.subscriptionPeriod,
        metadata: {
          type: "admin_start_subscription",
          adminInitiated: true,
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
        },
      });
      // Mirror the channel/product-checkout pattern: stamp cycle 1
      // marker + next-due date so the daily minter picks up cycle 2.
      invoice.nextDueDate = getNextChargeDate(
        new Date(),
        itemShape.subscriptionPeriod,
      );
      invoice.recurringPaymentNumber = 1;
      await invoice.save();

      const chargeMode = resolveSavedCardChargeMode({
        card,
        invoiceAmount: invoice.totalAmount,
        invoiceCurrency: invoice.itemCurrency,
      });

      const idempotencyKey = `admin-sub-${invoice._id}`;
      let pi: any;
      try {
        pi = await chargeSavedPaymentMethod({
          customerId,
          paymentMethodId: req.params.pmId,
          amountInSmallestUnit: invoice.totalAmount,
          currency: invoice.itemCurrency,
          offSession: chargeMode.offSession,
          ...(chargeMode.mandate ? { mandate: chargeMode.mandate } : {}),
          idempotencyKey,
          metadata: {
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            userId: String(user._id),
            orgId: String(orgId),
            adminInitiated: "true",
            initiatedByGarageAdminId: String(admin.id),
            initiatedByGarageAdminEmail: admin.email,
            chargeMode: chargeMode.reason,
            subscriptionCycle: "1",
          } as any,
          description: `Admin subscription start (cycle 1): ${itemShape.name}`,
          receiptEmail: user.email,
        });
      } catch (err: any) {
        if (
          err?.code === "authentication_required" &&
          err?.raw?.payment_intent
        ) {
          pi = err.raw.payment_intent;
        } else {
          console.error("[admin-saved-cards] start-sub Stripe error:", err);
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                status: "failed",
                failedAt: new Date(),
                errorDescription:
                  err?.raw?.message || err?.message || "Stripe error",
              },
            },
          );
          return res.status(400).json({
            success: false,
            status: "failed",
            error: err?.raw?.message || err?.message || "Charge failed",
            invoiceId: String(invoice._id),
          });
        }
      }

      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "metadata.stripePaymentIntentId": pi.id,
            "metadata.stripeCustomerId": customerId,
            "metadata.stripePaymentMethodId": req.params.pmId,
            "metadata.chargeMode": chargeMode.reason,
            status: pi.status === "succeeded" ? "paid" : "pending",
            paymentPlatform: "stripe",
            paymentMethodCategory: "card",
            paymentCurrency: (invoice.itemCurrency || "USD").toUpperCase(),
          },
        },
      );

      const commonBody = {
        subscription: {
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          itemType,
          itemId: String(itemId),
          itemName: itemShape.name,
          subscriptionPeriod: itemShape.subscriptionPeriod,
          amountPerCycle: invoice.totalAmount,
          currency: invoice.itemCurrency,
          nextDueDate: invoice.nextDueDate,
        },
        chargeMode: chargeMode.reason,
      };

      if (pi.status === "succeeded") {
        return res.json({
          success: true,
          status: "succeeded",
          paymentIntentId: pi.id,
          ...commonBody,
          note:
            "Cycle 1 paid. Renewals will auto-charge this card via the daily cron.",
        });
      }
      if (pi.status === "processing") {
        return res.json({
          success: true,
          status: "processing",
          paymentIntentId: pi.id,
          ...commonBody,
          note: "Cycle 1 is settling; webhook will finalize.",
        });
      }
      // We already refused the CIT case above, so anything else is a
      // Stripe risk decision. Return the invoice URL for OTP fallback.
      if (
        pi.status === "requires_action" ||
        pi.status === "requires_confirmation"
      ) {
        const invoiceUrl = `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${invoice._id}`;
        return res.json({
          success: true,
          status: "requires_action",
          paymentIntentId: pi.id,
          clientSecret: pi.client_secret,
          invoiceUrl,
          ...commonBody,
          note:
            "Stripe requested additional authentication for cycle 1 — share the invoice URL with the buyer to complete OTP.",
        });
      }
      return res.json({
        success: false,
        status: pi.status,
        paymentIntentId: pi.id,
        ...commonBody,
        error: `Cycle 1 landed in unexpected status: ${pi.status}`,
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] start-subscription:", err);
      res
        .status(500)
        .json({ error: err?.message || "Failed to start subscription" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Garage's OWN paid products, billable onto a saved card.
//
// `start-subscription` above only sells an ORG's products/channels. It
// cannot start Unilevel Plus, NetworkChain or an Office plan, and the
// only alternatives were `charge-adhoc` (takes money, grants nothing —
// its fulfilment is the default no-op) or running
// scripts/activate-nc-from-saved-card.ts by hand.
//
// Two endpoints:
//   GET  .../billable-platform-items   what this user can be sold, and why not
//   POST .../bill-platform-item        mint + charge + activate
//
// Deliberately separate from `start-subscription` rather than folded
// into it: that handler works today, and these three products each need
// a genuinely different activation path. Sharing one handler would risk
// the working path for no gain.
// ──────────────────────────────────────────────────────────────────

/** Everything the modal needs to render one sellable row. */
interface PlatformItem {
  itemType: "unilevel_plus" | "third_party" | "office_plan";
  name: string;
  /** "one_time" hides the free-cycle control — a $0 licence is a comp. */
  kind: "one_time" | "recurring";
  /** Smallest unit, matching the org-items endpoint so the FE formats one way. */
  price: number;
  currency: string;
  subscriptionPeriod?: "monthly";
  /** NetworkChain sells 1/3/6/12-month terms. */
  terms?: Array<{ termMonths: number; label: string; price: number }>;
  /** Orgs this user founds — office_plan must be billed against one. */
  orgs?: Array<{ _id: string; name: string }>;
  eligible: boolean;
  /** Shown on a disabled row. Null when eligible. */
  reason: string | null;
  /**
   * NetworkChain attaches to a Unilevel Plus licence. Without one we sell
   * the licence in the same cart rather than dead-ending the admin.
   */
  requiresCombo?: boolean;
  comboPrice?: number;
}

router.get(
  "/users/:userId/billable-platform-items",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const [
        { UNILEVEL_PLUS_PLAN_CONFIG },
        { UnilevelPlusPurchase },
        { ThirdPartyClient },
        { OfficeSubscription },
        { OFFICE_PLAN_IDS, OFFICE_PLANS_CONFIG },
        { Organization },
      ] = await Promise.all([
        import("../models/unilevelPlusPlan.model"),
        import("../models/unilevelPlusPurchase.model"),
        import("../models/thirdPartyClient.model"),
        import("../models/officeSubscription.model"),
        import("../models/officePlan.model"),
        import("../models/organization.model"),
      ]);

      const items: PlatformItem[] = [];

      // ── Unilevel Plus — ONE-TIME. `UnilevelPlusPurchase.userId` is
      //    unique, so a second licence is impossible by construction.
      const upPurchase = await UnilevelPlusPurchase.findOne({
        userId: user._id,
        status: "active",
      }).lean();
      const upPriceMinor = Math.round(
        Number(UNILEVEL_PLUS_PLAN_CONFIG.productPrice) * 100,
      );
      items.push({
        itemType: "unilevel_plus",
        name: "Unilevel Plus licence",
        kind: "one_time",
        price: upPriceMinor,
        currency: UNILEVEL_PLUS_PLAN_CONFIG.currency || "USD",
        eligible: !upPurchase,
        reason: upPurchase ? "Already owns an active licence" : null,
      });

      // ── NetworkChain — recurring, terms from productConfig, never literals.
      const client: any = await ThirdPartyClient.findOne({ isActive: true }).lean();
      if (client?.productConfig) {
        const terms = (client.productConfig.termPlans || [])
          .filter((t: any) => t.isActive)
          .sort((a: any, b: any) => a.termMonths - b.termMonths)
          .map((t: any) => ({
            termMonths: t.termMonths,
            label: t.label || `${t.termMonths} month(s)`,
            price: Math.round(Number(t.totalAmount) * 100),
          }));

        // The mirror collection is owned by NetworkChain's own backend; we
        // only read it. `status` alone is not enough — a row can be "active"
        // with a period that has already ended.
        const ncRow = await Invoice.db
          .collection("networkchain_subscriptions")
          .findOne({ userId: user._id });
        const covered =
          ncRow?.status === "active" &&
          ncRow?.currentPeriodEnd &&
          new Date(ncRow.currentPeriodEnd) > new Date();

        const monthly = terms[0]?.price ?? 0;
        items.push({
          itemType: "third_party",
          name: client.name || "NetworkChain",
          kind: "recurring",
          price: monthly,
          currency: "USD",
          subscriptionPeriod: "monthly",
          terms,
          eligible: !covered && terms.length > 0,
          reason: covered
            ? "Already has active coverage"
            : terms.length === 0
              ? "No active terms configured"
              : null,
          requiresCombo: !upPurchase,
          ...(!upPurchase ? { comboPrice: monthly + upPriceMinor } : {}),
        });
      }

      // ── Office Pro — billed against an org the user actually founds.
      //    `OfficeSubscription.orgId` is unique, so an org that already has
      //    one gets EXTENDED rather than duplicated; surface that.
      const foundedOrgIds = (user.organizations || [])
        .filter((m: any) => m.role === "founder")
        .map((m: any) => m.organization);
      const orgs = foundedOrgIds.length
        ? await Organization.find({ _id: { $in: foundedOrgIds } })
            .select("_id name")
            .lean()
        : [];
      // Keyed config, not an array — `pro` is the only paid plan today
      // (`basic` is commented out, `starter` is $0).
      const proPlan: any = (OFFICE_PLANS_CONFIG as any).pro;
      const existingSubs = orgs.length
        ? await OfficeSubscription.find({
            orgId: { $in: orgs.map((o: any) => o._id) },
            status: "active",
          })
            .select("orgId")
            .lean()
        : [];
      const activeOrgIds = new Set(existingSubs.map((s: any) => String(s.orgId)));
      const sellableOrgs = orgs
        .filter((o: any) => !activeOrgIds.has(String(o._id)))
        .map((o: any) => ({ _id: String(o._id), name: o.name }));

      if (proPlan) {
        items.push({
          itemType: "office_plan",
          name: proPlan.name || "Founders Office",
          kind: "recurring",
          price: Number(proPlan.amount) || 0,
          currency: proPlan.currency || "USD",
          subscriptionPeriod: "monthly",
          orgs: sellableOrgs,
          eligible: sellableOrgs.length > 0,
          reason:
            orgs.length === 0
              ? "Founds no organization to bill this against"
              : sellableOrgs.length === 0
                ? "Every org they found already has an active plan"
                : null,
        });
      }

      res.json({ success: true, items });
    } catch (err: any) {
      console.error("[admin/billable-platform-items]", err);
      res.status(500).json({ error: err?.message || "Failed to load items" });
    }
  },
);

router.post(
  "/users/:userId/saved-cards/:pmId/bill-platform-item",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { itemType, orgId, termMonths, freeCycles } = req.body || {};
      if (!["unilevel_plus", "third_party", "office_plan"].includes(itemType)) {
        return res.status(400).json({
          error:
            "itemType must be 'unilevel_plus', 'third_party' or 'office_plan'",
        });
      }
      const free = Math.max(0, Number(freeCycles) || 0);
      if (free > 0 && itemType === "unilevel_plus") {
        // One-time — there is no "next cycle" to defer to. A $0 licence is a
        // comp, which is a different decision and a different tool.
        return res
          .status(400)
          .json({ error: "Unilevel Plus is one-time — it cannot have free cycles" });
      }

      const customerId = user.paymentProfile?.stripe?.customerId as
        | string
        | undefined;
      const methods = (user.paymentProfile?.stripe?.methods || []) as any[];
      const card = methods.find((m: any) => m.id === req.params.pmId);
      if (!customerId || !card) {
        return res.status(404).json({ error: "Card not found on this user" });
      }

      const {
        mintUnilevelPlusInvoice,
        mintComboInvoice,
        mintOfficePlanInvoice,
        platformOrgId,
      } = await import("../services/adminPlatformBilling");

      const actor = { id: String(admin.id), email: admin.email };
      let minted: {
        invoice: any;
        chargeAmountMinor: number;
        label: string;
      } | null = null;

      // ── Unilevel Plus (one-time) ──
      if (itemType === "unilevel_plus") {
        const { UnilevelPlusPurchase } = await import(
          "../models/unilevelPlusPurchase.model"
        );
        if (await UnilevelPlusPurchase.findOne({ userId: user._id, status: "active" })) {
          return res.status(400).json({ error: "User already owns an active licence" });
        }
        minted = await mintUnilevelPlusInvoice({
          user,
          orgId: await platformOrgId(),
          actor,
        });
      }

      // ── NetworkChain ──
      if (itemType === "third_party") {
        const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");
        const client: any = await ThirdPartyClient.findOne({ isActive: true });
        if (!client?.productConfig) {
          return res.status(400).json({ error: "No active third-party client" });
        }
        const term = (client.productConfig.termPlans || []).find(
          (t: any) => t.termMonths === (Number(termMonths) || 1) && t.isActive,
        );
        if (!term) {
          return res.status(400).json({ error: "That term is not available" });
        }
        const covered = await Invoice.db
          .collection("networkchain_subscriptions")
          .findOne({ userId: user._id });
        if (
          covered?.status === "active" &&
          covered?.currentPeriodEnd &&
          new Date(covered.currentPeriodEnd) > new Date()
        ) {
          return res.status(400).json({ error: "User already has active coverage" });
        }

        const { UnilevelPlusPurchase } = await import(
          "../models/unilevelPlusPurchase.model"
        );
        const hasLicence = await UnilevelPlusPurchase.findOne({
          userId: user._id,
          status: "active",
        });
        const subUsd = Number(term.totalAmount);

        if (free > 0) {
          /**
           * A free first NetworkChain cycle already has a purpose-built path —
           * it IS the 24-hour offer. Reuse it rather than minting a
           * discounted invoice, so the free month, the queued term for cycle
           * 2, and the partner webhook all behave exactly as they do for a
           * normal combo buyer. Nothing is charged.
           */
          const trigger = await Invoice.findOne({
            userId: user._id,
            status: "paid",
            "lineItems.itemType": "unilevel_plus",
          })
            .sort({ paidAt: -1 })
            .lean();
          if (!trigger) {
            return res.status(400).json({
              error:
                "A free cycle attaches to a paid Unilevel Plus invoice — this user has none. Sell the licence first.",
            });
          }
          const { activateComboFreeFirstMonth } = await import(
            "../services/comboActivation"
          );
          const result = await activateComboFreeFirstMonth({
            buyerId: String(user._id),
            clientId: String(client._id),
            productCode: client.productConfig.productCode,
            triggerInvoiceId: String((trigger as any)._id),
            freeFirstCycle: true,
            nextTermMonths: term.termMonths,
          });
          return res.json({
            success: true,
            status: "succeeded",
            freeCycle: true,
            subscription: {
              invoiceId: String((result.invoice as any)._id),
              invoiceNumber: (result.invoice as any).invoiceNumber,
              itemType: "third_party",
              itemName: client.name,
              subscriptionPeriod: "monthly",
              amountPerCycle: Math.round(subUsd * 100),
              currency: "USD",
              nextDueDate: (result.invoice as any).nextDueDate,
            },
            note: `First cycle free. ${client.name} bills from ${new Date(
              (result.invoice as any).nextDueDate,
            ).toDateString()} on this user's default card.`,
          });
        }

        if (hasLicence) {
          /**
           * Licence already owned, so this is an ordinary subscription
           * purchase — mint an ordinary subscription invoice.
           *
           * NOT the `prepaidFirstCycle` path: that one deliberately totals $0
           * because the cash was collected on a Unilevel Plus cart invoice
           * elsewhere. Here there IS no other invoice, so a $0 one would
           * leave the buyer charged with nothing on their orders page, no
           * invoice email, and a Stripe charge that reconciles to nothing.
           *
           * A plain `createThirdPartyInvoice` gives the same full-price
           * invoice NetworkChain's own partner API mints: real totalAmount,
           * GST resolved from the buyer, `nextDueDate` set, and fulfilment
           * (via the Stripe webhook) distributing commission on
           * `invoice.totalAmount` and firing the partner webhook that
           * actually advances the customer's coverage.
           */
          const { createThirdPartyInvoice } = await import(
            "../services/thirdPartyInvoice"
          );
          // Date-scoped so a retry on the same day returns the SAME invoice
          // (createThirdPartyInvoice dedupes on clientId+externalId), which in
          // turn keeps the Stripe idempotency key stable — while a genuine
          // re-subscribe later still mints a new one.
          const day = new Date().toISOString().slice(0, 10);
          const ncInvoice = await createThirdPartyInvoice({
            client,
            customerEmail: user.email,
            productCode: client.productConfig.productCode,
            externalId: `admin_nc_${user._id}_${day}_${term.termMonths}m`,
            termMonths: term.termMonths,
            metadata: {
              adminInitiated: true,
              initiatedByGarageAdminId: String(admin.id),
              initiatedByGarageAdminEmail: admin.email,
            },
          });
          if (ncInvoice.status === "paid") {
            return res.status(400).json({
              error: `Already billed today — invoice ${ncInvoice.invoiceNumber} is paid.`,
            });
          }
          minted = {
            invoice: ncInvoice,
            chargeAmountMinor: ncInvoice.totalAmount,
            label: `${client.name} — ${term.termMonths} month(s)`,
          };
        } else {
          // No licence: sell both in one cart, the way real checkout does.
          const { UNILEVEL_PLUS_PLAN_CONFIG } = await import(
            "../models/unilevelPlusPlan.model"
          );
          minted = await mintComboInvoice({
            user,
            orgId: await platformOrgId(),
            actor,
            clientId: String(client._id),
            productCode: client.productConfig.productCode,
            termMonths: term.termMonths,
            subUsd,
            licenceUsd: Number(UNILEVEL_PLUS_PLAN_CONFIG.productPrice),
          });
        }
      }

      // ── Office Pro ──
      if (itemType === "office_plan") {
        if (!orgId || !isObjectId(orgId)) {
          return res
            .status(400)
            .json({ error: "orgId is required for an office plan" });
        }
        const founds = (user.organizations || []).some(
          (m: any) =>
            String(m.organization) === String(orgId) && m.role === "founder",
        );
        if (!founds) {
          return res
            .status(400)
            .json({ error: "This user does not found that organization" });
        }
        minted = await mintOfficePlanInvoice({
          user,
          orgId: String(orgId),
          actor,
          freeCycles: free,
        });
      }

      if (!minted) return res.status(400).json({ error: "Nothing to bill" });

      // ── Free cycle: already paid + fulfilled by createInvoice's zero-pay
      //    branch. No card is touched. ──
      if (minted.chargeAmountMinor === 0) {
        return res.json({
          success: true,
          status: "succeeded",
          freeCycle: true,
          subscription: {
            invoiceId: String(minted.invoice._id),
            invoiceNumber: minted.invoice.invoiceNumber,
            itemType,
            itemName: minted.label,
            subscriptionPeriod: "monthly",
            amountPerCycle: minted.invoice.subtotal,
            currency: minted.invoice.itemCurrency,
            nextDueDate: minted.invoice.nextDueDate,
          },
          note: `First cycle free. Billing starts ${new Date(
            minted.invoice.nextDueDate,
          ).toDateString()} on this user's default card at that time.`,
        });
      }

      // ── Charge — same gating, salvage and response shapes as
      //    start-subscription, so the dialog's SCA block works unchanged. ──
      const chargeMode = resolveSavedCardChargeMode({
        card,
        invoiceAmount: minted.chargeAmountMinor,
        invoiceCurrency: minted.invoice.itemCurrency || "USD",
      });
      const idempotencyKey = `admin-platform-${itemType}-${minted.invoice._id}-${termMonths || 1}`;
      let pi: any;
      try {
        pi = await chargeSavedPaymentMethod({
          customerId,
          paymentMethodId: req.params.pmId,
          amountInSmallestUnit: minted.chargeAmountMinor,
          currency: minted.invoice.itemCurrency || "USD",
          offSession: chargeMode.offSession,
          ...(chargeMode.mandate ? { mandate: chargeMode.mandate } : {}),
          idempotencyKey,
          metadata: {
            invoiceId: String(minted.invoice._id),
            invoiceNumber: minted.invoice.invoiceNumber,
            userId: String(user._id),
            orgId: String(minted.invoice.organizationId || ""),
            itemType,
            adminInitiated: "true",
            initiatedByGarageAdminId: String(admin.id),
            initiatedByGarageAdminEmail: admin.email,
            chargeMode: chargeMode.reason,
          } as any,
          description: `Admin: ${minted.label}`,
          receiptEmail: user.email,
        });
      } catch (err: any) {
        if (err?.code === "authentication_required" && err?.raw?.payment_intent) {
          pi = err.raw.payment_intent;
        } else {
          console.error("[admin-saved-cards] bill-platform-item Stripe error:", err);
          return res.status(400).json({
            success: false,
            status: "failed",
            error: err?.raw?.message || err?.message || "Charge failed",
            invoiceId: String(minted.invoice._id),
          });
        }
      }

      if (pi.status !== "succeeded") {
        // Nothing captured, so nothing is activated. The buyer must authorise
        // on-session; the dialog renders the invoice link for that.
        return res.json({
          success: true,
          status:
            pi.status === "requires_action" || pi.status === "requires_confirmation"
              ? "requires_action"
              : pi.status,
          paymentIntentId: pi.id,
          clientSecret: pi.client_secret,
          invoiceUrl: `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${minted.invoice._id}`,
          subscription: {
            invoiceId: String(minted.invoice._id),
            invoiceNumber: minted.invoice.invoiceNumber,
            itemType,
            itemName: minted.label,
            amountPerCycle: minted.chargeAmountMinor,
            currency: minted.invoice.itemCurrency || "USD",
          },
          chargeMode: chargeMode.reason,
          note: "Stripe requested authentication — share the invoice URL so the buyer can complete it. Nothing has been activated yet.",
        });
      }

      res.json({
        success: true,
        status: "succeeded",
        paymentIntentId: pi.id,
        chargeMode: chargeMode.reason,
        subscription: {
          invoiceId: String(minted.invoice._id),
          invoiceNumber: minted.invoice.invoiceNumber,
          itemType,
          itemName: minted.label,
          amountPerCycle: minted.chargeAmountMinor,
          currency: minted.invoice.itemCurrency || "USD",
        },
        note: `Charged ${minted.label}.`,
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] bill-platform-item:", err);
      res.status(500).json({ error: err?.message || "Failed to bill this item" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Ad-hoc one-time charge — arbitrary amount + description, NOT tied
// to a Product/Course/Channel. Same MIT/CIT gate as the product
// charge; same audit metadata stamping. Creates an invoice with
// itemType="admin_adhoc"; fulfillInvoice hits the default no-op
// branch (no product to grant, no commissions to distribute).
// ──────────────────────────────────────────────────────────────────

router.post(
  "/users/:userId/saved-cards/:pmId/charge-adhoc",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { orgId, amount, currency, description } = req.body || {};
      if (!orgId || !isObjectId(orgId)) {
        return res.status(400).json({ error: "orgId (ObjectId) is required" });
      }
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({
          error: "amount must be a positive number (in whole units, e.g. 12.50)",
        });
      }
      const cur = String(currency || "").toUpperCase();
      if (cur !== "USD" && cur !== "INR") {
        return res.status(400).json({
          error: "currency must be 'USD' or 'INR'",
        });
      }
      const desc = String(description || "").trim().slice(0, 200);
      if (!desc) {
        return res.status(400).json({
          error: "description is required (shown to buyer + auditor)",
        });
      }

      const customerId = user.paymentProfile?.stripe?.customerId as
        | string
        | undefined;
      const methods = (user.paymentProfile?.stripe?.methods || []) as any[];
      const card = methods.find((m: any) => m.id === req.params.pmId);
      if (!customerId || !card) {
        return res
          .status(404)
          .json({ error: "Card not found on this user" });
      }

      // Seller = org founder (invoice model requires organizationId +
      // sellerId; we scope adhoc charges to a real org for reporting).
      const orgFounder: any = await User.findOne({
        organizations: {
          $elemMatch: {
            organization: new Types.ObjectId(orgId),
            role: "founder",
          },
        },
      })
        .select("_id email")
        .lean();
      if (!orgFounder) {
        return res.status(400).json({
          error: "Could not resolve an org founder for this org",
        });
      }

      // Amount is in whole units on the wire (12.50 = twelve fifty). Store
      // in smallest unit on the invoice (cents/paise).
      const amountSmallest = Math.round(amountNum * 100);

      const invoice = await createInvoice({
        organizationId: String(orgId),
        sellerId: String(orgFounder._id),
        userId: String(user._id),
        customerEmail: user.email,
        customerName: user.name,
        lineItems: [
          {
            itemType: "admin_adhoc",
            // Schema requires ObjectId. Use the admin's own id so the
            // audit trail is trivially queryable
            // (Invoice.find({"lineItems.itemId": admin.id})).
            itemId: String(admin.id),
            itemName: desc,
            quantity: 1,
            unitPrice: amountSmallest,
            originalCurrency: cur,
          },
        ],
        itemCurrency: cur,
        metadata: {
          type: "admin_adhoc_charge",
          adminInitiated: true,
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
          adhocDescription: desc,
        },
      });

      const chargeMode = resolveSavedCardChargeMode({
        card,
        invoiceAmount: invoice.totalAmount,
        invoiceCurrency: invoice.itemCurrency,
      });

      const idempotencyKey = `admin-adhoc-${invoice._id}`;
      let pi: any;
      try {
        pi = await chargeSavedPaymentMethod({
          customerId,
          paymentMethodId: req.params.pmId,
          amountInSmallestUnit: invoice.totalAmount,
          currency: invoice.itemCurrency,
          offSession: chargeMode.offSession,
          ...(chargeMode.mandate ? { mandate: chargeMode.mandate } : {}),
          idempotencyKey,
          metadata: {
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            userId: String(user._id),
            orgId: String(orgId),
            adminInitiated: "true",
            initiatedByGarageAdminId: String(admin.id),
            initiatedByGarageAdminEmail: admin.email,
            chargeMode: chargeMode.reason,
            adhocDescription: desc,
          } as any,
          description: `Adhoc charge: ${desc}`,
          receiptEmail: user.email,
        });
      } catch (err: any) {
        if (
          err?.code === "authentication_required" &&
          err?.raw?.payment_intent
        ) {
          pi = err.raw.payment_intent;
        } else {
          console.error("[admin-saved-cards] adhoc Stripe error:", err);
          await Invoice.updateOne(
            { _id: invoice._id },
            {
              $set: {
                status: "failed",
                failedAt: new Date(),
                errorDescription:
                  err?.raw?.message || err?.message || "Stripe error",
              },
            },
          );
          return res.status(400).json({
            success: false,
            status: "failed",
            error: err?.raw?.message || err?.message || "Charge failed",
            invoiceId: String(invoice._id),
          });
        }
      }

      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            "metadata.stripePaymentIntentId": pi.id,
            "metadata.stripeCustomerId": customerId,
            "metadata.stripePaymentMethodId": req.params.pmId,
            "metadata.chargeMode": chargeMode.reason,
            status: pi.status === "succeeded" ? "paid" : "pending",
            paymentPlatform: "stripe",
            paymentMethodCategory: "card",
            paymentCurrency: cur,
          },
        },
      );

      if (pi.status === "succeeded") {
        return res.json({
          success: true,
          status: "succeeded",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.totalAmount,
          currency: cur,
          description: desc,
          note: "Charge captured. Invoice marked paid.",
        });
      }
      if (pi.status === "processing") {
        return res.json({
          success: true,
          status: "processing",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          note: "Charge is settling; webhook will finalize.",
        });
      }
      if (
        pi.status === "requires_action" ||
        pi.status === "requires_confirmation"
      ) {
        const invoiceUrl = `${process.env.FRONTEND_URL || "https://my.garage.app"}/invoice/${invoice._id}`;
        return res.json({
          success: true,
          status: "requires_action",
          paymentIntentId: pi.id,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          clientSecret: pi.client_secret,
          invoiceUrl,
          note:
            chargeMode.reason === "inr_cit_otp_required"
              ? "INR card requires OTP — share the invoice URL with the buyer."
              : "Stripe requested additional authentication — share the invoice URL with the buyer.",
        });
      }
      return res.json({
        success: false,
        status: pi.status,
        paymentIntentId: pi.id,
        invoiceId: String(invoice._id),
        error: `Charge landed in unexpected status: ${pi.status}`,
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] adhoc:", err);
      res.status(500).json({ error: err?.message || "Failed to charge" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// Refundable-charges list (per card)
// ──────────────────────────────────────────────────────────────────

router.get(
  "/users/:userId/saved-cards/:pmId/refundable-charges",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      // Scope: user's Stripe-paid invoices that were charged on THIS PM.
      // We match on metadata.stripePaymentMethodId when present; fall
      // back to any Stripe-paid invoice for this user (some older rows
      // don't carry the PM id, but the refund action is still allowed
      // and gated per invoice below).
      const rows = await Invoice.find({
        userId: user._id,
        paymentPlatform: "stripe",
        status: "paid",
        "metadata.stripePaymentIntentId": { $exists: true, $ne: null },
      })
        .select(
          "_id invoiceNumber paidAt totalAmount itemCurrency lineItems metadata",
        )
        .sort({ paidAt: -1 })
        .limit(20)
        .lean<any[]>();

      res.json({
        success: true,
        charges: rows.map((r) => ({
          invoiceId: String(r._id),
          invoiceNumber: r.invoiceNumber,
          paidAt: r.paidAt,
          amount: r.totalAmount,
          currency: (r.itemCurrency || "USD").toUpperCase(),
          itemName: r.lineItems?.[0]?.itemName,
          paymentIntentId: r.metadata?.stripePaymentIntentId,
          paymentMethodId: r.metadata?.stripePaymentMethodId,
          matchedPm: r.metadata?.stripePaymentMethodId === req.params.pmId,
        })),
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] refundable:", err);
      res.status(500).json({
        error: err?.message || "Failed to load refundable charges",
      });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// 5. Refund
// ──────────────────────────────────────────────────────────────────

router.post(
  "/users/:userId/saved-cards/refund",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { paymentIntentId } = req.body || {};
      if (!paymentIntentId || typeof paymentIntentId !== "string") {
        return res
          .status(400)
          .json({ error: "paymentIntentId is required" });
      }

      // Cross-user guard: the invoice for this PI MUST belong to this user.
      const invoice: any = await Invoice.findOne({
        userId: user._id,
        "metadata.stripePaymentIntentId": paymentIntentId,
      })
        .select("_id invoiceNumber status")
        .lean();
      if (!invoice) {
        return res.status(404).json({
          error:
            "No invoice found for this PaymentIntent on this user — refusing to refund across users",
        });
      }
      if (invoice.status === "refunded") {
        return res
          .status(400)
          .json({ error: "Invoice is already refunded" });
      }
      if (invoice.status !== "paid") {
        return res.status(400).json({
          error: `Invoice status is ${invoice.status} — only paid invoices can be refunded`,
        });
      }

      const refund = await refundStripeCharge({
        paymentIntentId,
        metadata: {
          invoiceId: String(invoice._id),
          invoiceNumber: String(invoice.invoiceNumber || ""),
          userId: String(user._id),
          adminInitiated: "true",
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
        },
      });

      // Webhook (charge.refunded → routes/stripeWebhook.ts) will flip
      // the invoice to `refunded`. Return the refund shape now.
      res.json({
        success: true,
        refund: {
          id: refund.id,
          status: refund.status,
          amount: refund.amount,
          currency: refund.currency,
        },
        invoiceId: String(invoice._id),
        note: "Webhook will finalize the invoice status to refunded.",
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] refund:", err);
      res
        .status(400)
        .json({ error: err?.raw?.message || err?.message || "Refund failed" });
    }
  },
);

// ──────────────────────────────────────────────────────────────────
// 12. Charge a UPI Autopay mandate (ad-hoc)
//
// The UPI counterpart to charge-adhoc above. Same invoice shape
// (itemType "admin_adhoc"), same audit metadata — different rail, and
// three constraints a card charge doesn't have:
//
//   1. A mandate is INR-denominated. A USD amount must be converted
//      before it can be checked or charged.
//   2. Every mandate carries a per-debit CEILING sized to the plan it
//      was registered for. A $36/mo mandate is capped near ₹5,100, so
//      most ad-hoc amounts simply won't fit — refuse with the numbers
//      rather than letting Razorpay reject it opaquely.
//   3. Above the RBI no-AFA threshold the payer must approve the debit
//      in their UPI app, so the charge completes ASYNCHRONOUSLY. That
//      is "pending", not "failed", and the webhook settles it — which
//      is why razorpayOrderId is persisted before we return.
// ──────────────────────────────────────────────────────────────────

router.post(
  "/users/:userId/upi-mandates/:tokenId/charge-adhoc",
  async (req: GarageAdminRequest, res: Response) => {
    try {
      const admin = req.garageAdmin!;
      const user = await loadUserOr404(req.params.userId, res);
      if (!user) return;

      const { orgId, amount, currency, description } = req.body || {};
      if (!orgId || !isObjectId(orgId)) {
        return res.status(400).json({ error: "orgId (ObjectId) is required" });
      }
      const amountNum = Number(amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
      }
      const cur = String(currency || "USD").toUpperCase();
      if (!["USD", "INR"].includes(cur)) {
        return res.status(400).json({ error: "currency must be USD or INR" });
      }
      const desc = String(description || "").trim();
      if (!desc) return res.status(400).json({ error: "description is required" });

      const rzp = (user.paymentProfile as any)?.razorpay || {};
      const customerId = rzp.customerId as string | undefined;
      const mandate = ((rzp.tokens || []) as any[]).find(
        (t) => t?.id === req.params.tokenId && t?.method === "upi",
      );
      if (!customerId || !mandate) {
        return res.status(404).json({ error: "UPI mandate not found for this user" });
      }

      // Never trust the stored status alone — a payer can revoke in their UPI
      // app and we only learn on the next read. Ask Razorpay before charging.
      const { fetchCustomerToken, mandateStatusFromRecurring, chargeUpiMandate } =
        await import("../services/razorpay");
      const live = await fetchCustomerToken(customerId, mandate.id);
      const liveStatus = live
        ? mandateStatusFromRecurring(live?.recurring_details?.status)
        : mandate.mandateStatus;
      if (liveStatus !== "active") {
        await User.updateOne(
          { _id: user._id, "paymentProfile.razorpay.tokens.id": mandate.id },
          { $set: { "paymentProfile.razorpay.tokens.$.mandateStatus": liveStatus } },
        );
        return res.status(400).json({
          error: `Mandate is "${live?.recurring_details?.status ?? liveStatus}" at Razorpay — cannot charge it. The user must set autopay up again.`,
        });
      }

      // Mandates are INR. Convert first so the cap check and the debit agree.
      let inrAmount = amountNum;
      let rateNote = "";
      if (cur === "USD") {
        const { convertUsdToInr } = await import("../utils/exchangeRate");
        const conv = await convertUsdToInr(amountNum);
        inrAmount = conv.inrAmount;
        rateNote = ` (converted at 1 USD = ${conv.exchangeRate} INR)`;
      }
      const inrPaise = Math.round(inrAmount * 100);

      const cap = Number(mandate.maxAmount || 0);
      if (cap > 0 && inrPaise > cap) {
        return res.status(400).json({
          error:
            `₹${(inrPaise / 100).toLocaleString("en-IN")} exceeds this mandate's per-debit cap of ` +
            `₹${(cap / 100).toLocaleString("en-IN")}${rateNote}. The mandate was authorised for a ` +
            `smaller recurring amount — charging more needs a new mandate, not a retry.`,
        });
      }

      // Seller = org founder, same as the card ad-hoc route above: the
      // invoice model requires an organizationId + sellerId.
      const orgFounder: any = await User.findOne({
        organizations: {
          $elemMatch: {
            organization: new Types.ObjectId(orgId),
            role: "founder",
          },
        },
      })
        .select("_id email")
        .lean();
      if (!orgFounder) {
        return res.status(400).json({ error: "Could not resolve the org founder" });
      }

      const invoice = await createInvoice({
        organizationId: String(orgId),
        sellerId: String(orgFounder._id),
        userId: String(user._id),
        customerEmail: user.email,
        customerName: user.name,
        lineItems: [
          {
            itemType: "admin_adhoc",
            itemId: String(admin.id),
            itemName: desc,
            quantity: 1,
            unitPrice: Math.round(amountNum * 100),
            originalCurrency: cur,
          },
        ],
        itemCurrency: cur,
        metadata: {
          type: "admin_adhoc_charge",
          adminInitiated: true,
          initiatedByGarageAdminId: String(admin.id),
          initiatedByGarageAdminEmail: admin.email,
          adhocDescription: desc,
          chargedVia: "upi_mandate",
        },
      });

      let result: any;
      try {
        result = await chargeUpiMandate({
          amount: inrPaise,
          currency: "INR",
          customerId,
          tokenId: mandate.id,
          description: desc,
          notes: {
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            userId: String(user._id),
            orgId: String(orgId),
            adminInitiated: "true",
            initiatedByGarageAdminId: String(admin.id),
          },
        });
      } catch (err: any) {
        await Invoice.updateOne(
          { _id: invoice._id },
          {
            $set: {
              status: "failed",
              failedAt: new Date(),
              errorDescription: err?.message || "UPI mandate debit failed",
            },
          },
        );
        return res.status(400).json({
          success: false,
          status: "failed",
          error: err?.message || "UPI mandate debit failed",
          invoiceId: String(invoice._id),
        });
      }

      // Persist the order id BEFORE returning: the payment.captured /
      // payment.failed webhooks correlate back to an invoice purely by order
      // id, and an AFA-pending debit settles later. Without this a pending
      // charge could never be matched and would sit forever.
      const settled = result.paymentId && !result.requiresApproval;
      await Invoice.updateOne(
        { _id: invoice._id },
        {
          $set: {
            razorpayOrderId: result.orderId,
            "metadata.razorpayPaymentId": result.paymentId || null,
            "metadata.upiMandateTokenId": mandate.id,
            "metadata.upiMandateVpa": mandate.vpa || null,
            status: settled ? "paid" : "pending",
            ...(settled ? { paidAt: new Date() } : {}),
            paymentPlatform: "razorpay",
            paymentMethodCategory: "upi",
            paymentCurrency: "INR",
          },
        },
      );

      if (settled) {
        try {
          const fresh = await Invoice.findById(invoice._id);
          if (fresh) {
            const { fulfillInvoice } = await import("../services/invoice");
            await fulfillInvoice(fresh, `admin_upi_${result.paymentId}`);
          }
        } catch (err) {
          console.error("[admin-saved-cards] UPI adhoc fulfil failed:", err);
        }
        return res.json({
          success: true,
          status: "succeeded",
          paymentId: result.paymentId,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          amount: inrPaise,
          currency: "INR",
          description: desc,
          note: `Debited ₹${(inrPaise / 100).toLocaleString("en-IN")}${rateNote}. Invoice marked paid.`,
        });
      }

      return res.json({
        success: true,
        status: "pending",
        paymentId: result.paymentId || null,
        invoiceId: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber,
        amount: inrPaise,
        currency: "INR",
        description: desc,
        note:
          `₹${(inrPaise / 100).toLocaleString("en-IN")}${rateNote} is awaiting the customer's approval in their ` +
          `UPI app (required above ₹15,000). The invoice settles automatically when they approve.`,
      });
    } catch (err: any) {
      console.error("[admin-saved-cards] UPI adhoc charge:", err);
      res.status(500).json({ error: err?.message || "Failed to charge mandate" });
    }
  },
);

export default router;
