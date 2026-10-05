// src/routes/productCheckout.ts
// Public checkout routes for product purchase links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Product } from "../models/product.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Channel } from "../models/channel.model";
import { Floor } from "../models/floor.model";
import { createOtp, verifyOtp } from "../services/otp";
import { softAuth } from "../middleware/auth";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import { signJwt } from "../services/jwt";
import {
  createOrder as createRazorpayOrder,
  verifyPaymentSignature,
  fetchSubscription,
  CouponPromotion,
} from "../services/razorpay";
import { createInvoice, getNextChargeDate } from "../services/invoice";
import {
  createSubscriptionPlan,
  getSubscriptionPlanForItem,
  createUserSubscription,
} from "../services/subscription";
import { createOrder as createProductOrder, updatePaymentStatus } from "../services/product";
import { distributeCommissions } from "../services/commission";
import { getCommissionBase, applyGstToLine } from "../utils/gstTax";
import { resolveBuyerGstRegion } from "../utils/gstBuyerRegion";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { ensureUserHasAffiliateId, setReferredBy, setReferredByAffiliateId } from "../services/affiliate";
import {
  createBoardFromPurchase,
  addAtBatFromPurchase,
  addToDugoutFromPurchase,
  addFromUpperBaseInvite,
  addFromGenericInvite,
} from "../bat246/services/bat246Entry.service";
import { Bat246Distributor } from "../bat246/models/bat246Distributor.model";
import {
  validateCoupon,
  recordCouponUsage,
  markUsageApplied,
  markUsageFailed,
} from "../services/coupon";

const router = Router();

/**
 * GET /checkout/product/:productId
 * Fetch product and organization details for checkout page (public)
 */
router.get("/product/:productId", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const product = await Product.findOne({
      _id: new Types.ObjectId(productId),
      status: "active",
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found or not available" });
    }

    const organization = await Organization.findById(product.organizationId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    const effectivePrice = product.price;

    res.json({
      success: true,
      product: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: product.price,
        currency: product.currency,
        gstInclusive: (product as any).gstInclusive,
        images: product.images,
        isDigital: product.isDigital,
        isFree: effectivePrice === 0 || effectivePrice <= 0,
        isSubscription: product.isSubscription,
        subscriptionPeriod: product.subscriptionPeriod,
        channelIds: product.channelIds,
        requiresShipping: product.requiresShipping,
        deliveryMethod: product.deliveryMethod,
        tags: (product as any).tags ?? [],
      },
      organization: {
        _id: organization._id,
        name: organization.name,
        slug: organization.slug,
        icon: organization.icon,
        coverPhoto: organization.coverPhoto,
        description: organization.description,
      },
    });
  } catch (error) {
    console.error("Error fetching product for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch product details" });
  }
});

/**
 * POST /checkout/product/:productId/request-otp
 * Request OTP for checkout (public)
 */
router.post("/product/:productId/request-otp", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    // Verify product exists and is active
    const product = await Product.findOne({
      _id: new Types.ObjectId(productId),
      status: "active",
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found or not available" });
    }

    const E = email.trim().toLowerCase();
    // Use guest-login purpose (already exists in OTP service)
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Checkout Verification Code",
      `<p>Your verification code for purchasing <b>${product.name}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
      `Your verification code is ${code}`,
      // Buyer is on the seller's site — the sender follows that domain.
      await senderForHost(req, EMAIL_FROM_OTP)
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error requesting checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to send OTP" });
  }
});

/**
 * Shared post-identity logic for the checkout flow — runs once we already
 * know a real, trustworthy email (either just OTP-verified, or read off a
 * valid, server-verified session JWT). Decides: Bat246 $20 membership gate,
 * existing-org-member short-circuit, and whether a profile name is needed.
 *
 * Used by both /verify-otp (identity established via OTP) and
 * /verify-session (identity established via an already-logged-in session,
 * skipping OTP entirely) — kept as one function so the two paths can never
 * drift apart on the membership gate, which is a real security boundary.
 */
async function resolveCheckoutIdentity(
  productId: string,
  email: string,
  explicitBat246Ref: string | undefined
) {
  const E = email.trim().toLowerCase();

  const product = await Product.findOne({
    _id: new Types.ObjectId(productId),
    status: "active",
  }).lean();

  if (!product) {
    return { status: 404, body: { success: false, error: "Product not found or not available" } };
  }

  const user = await User.findOne({ email: E }).lean();
  // bat246_entry products don't count as "org member" (game entry, not workspace subscription)
  const isBat246Entry = Array.isArray((product as any).tags) && (product as any).tags.includes("bat246_entry");
  const isMember = !isBat246Entry && user?.organizations?.some(
    (m: any) => m.organization.toString() === product.organizationId.toString()
  );

  // Bat246 membership gate: require active $20 membership for ALL Bat246 org products
  const BAT246_PRODUCT_ORG_ID = "6a0d34e677323d1b81c6469b";
  if (product.organizationId.toString() === BAT246_PRODUCT_ORG_ID) {
    const dist = user
      ? await Bat246Distributor.findOne({ userId: (user as any)._id }).select("hasBat246Membership").lean() as any
      : null;
    // Store bat246Ref on distributor early so $20 notification can find it
    // later. Falls back to the durable, email-keyed Bat246OfficeInvite
    // record (via resolveBat246Ref) when this request has no explicit
    // bat246Ref — covers a prospect who lost the URL param somewhere
    // between the invite email and this step.
    if (user) {
      (async () => {
        const { resolveBat246Ref } = await import("../bat246/services/bat246.service");
        const resolved = await resolveBat246Ref({ explicitRef: explicitBat246Ref, email: E, userId: (user as any)._id });
        if (resolved && Types.ObjectId.isValid(resolved)) {
          await Bat246Distributor.updateOne(
            { userId: (user as any)._id, bat246RefUserId: { $exists: false } },
            { $set: { bat246RefUserId: new Types.ObjectId(resolved) } }
          );
        }
      })().catch(() => {});
    }
    if (!dist?.hasBat246Membership) {
      return { status: 200, body: { success: true, requiresBat246Membership: true, membershipPrice: 20 } };
    }
  }

  return {
    status: 200,
    body: {
      success: true,
      userId: user?._id?.toString() || null,
      isMember: !!isMember,
      needsProfile: !user || !user.name,
      user: user
        ? {
            email: user.email,
            name: user.name,
          }
        : null,
    },
  };
}

/**
 * POST /checkout/product/:productId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/product/:productId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      bat246Ref: z.string().optional(),
    });
    const { email, code, bat246Ref: otpBat246Ref } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const E = email.trim().toLowerCase();
    const verified = await verifyOtp(E, code, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    const result = await resolveCheckoutIdentity(productId, E, otpBat246Ref);
    res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error("Error verifying checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/**
 * POST /checkout/product/:productId/verify-session
 * Same result shape as /verify-otp, but for a visitor who is ALREADY
 * logged into Garage (e.g. clicking their own dashboard "Buy" link) —
 * skips OTP entirely and trusts the session's own, already-verified email
 * instead. Uses softAuth (not requireAuth) because this route is public:
 * a guest with no/expired/invalid token gets a plain
 * `{success:false}` here and the frontend falls back to the normal
 * email/OTP flow, rather than a hard 401.
 */
router.post("/product/:productId/verify-session", softAuth, async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const authUser = (req as any).user as { userId: string; email?: string } | undefined;
    if (!authUser?.email) {
      return res.json({ success: false, error: "Not authenticated" });
    }

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const schema = z.object({ bat246Ref: z.string().optional() });
    const { bat246Ref: sessionBat246Ref } = schema.parse(req.body ?? {});

    const result = await resolveCheckoutIdentity(productId, authUser.email, sessionBat246Ref);
    res.status(result.status).json(result.body);
  } catch (error: any) {
    console.error("Error verifying checkout session:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify session" });
  }
});

/**
 * POST /checkout/product/:productId/process-checkout
 * Process checkout - create user, add to org, subscribe to channels, create payment
 */
router.post("/product/:productId/process-checkout", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      quantity: z.number().min(1).default(1),
      shippingAddress: z
        .object({
          fullName: z.string(),
          addressLine1: z.string(),
          addressLine2: z.string().optional(),
          city: z.string(),
          state: z.string(),
          postalCode: z.string(),
          country: z.string(),
          phone: z.string().optional(),
        })
        .optional(),
      referralId: z.string().optional(),
      couponCode: z.string().optional(),
      // "Buy to assign" — purchased units become reserve licenses the buyer
      // assigns to others (read by fulfillInvoice's case "product").
      forReserve: z.boolean().optional().default(false),
      bat246BoardId: z.string().optional(),
      bat246Pos: z.string().optional(),
      bat246DugoutRef: z.string().optional(),
      bat246UpperRef: z.string().optional(),
      bat246UpperRefPlayerId: z.string().optional(),
      bat246GenRef: z.string().optional(),
      bat246Ref: z.string().optional(),
    });

    const { email, name, quantity, shippingAddress, referralId, couponCode, forReserve, bat246BoardId, bat246Pos, bat246DugoutRef, bat246UpperRef, bat246UpperRefPlayerId, bat246GenRef, bat246Ref: bat246RefRaw } = schema.parse(req.body);
    let bat246Ref = bat246RefRaw;

    if (!Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, error: "Invalid product ID" });
    }

    const E = email.trim().toLowerCase();

    // Get product with organization
    const product = await Product.findOne({
      _id: new Types.ObjectId(productId),
      status: "active",
    }).lean();

    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found or not available" });
    }

    // Check stock for non-subscription products
    if (!product.isSubscription && product.trackQuantity) {
      const availableQuantity = product.quantity ?? 0;
      if (availableQuantity < quantity) {
        return res.status(400).json({
          success: false,
          error: `Insufficient stock. Available: ${availableQuantity}`,
        });
      }
    }

    // Find or create user
    let user = await User.findOne({ email: E });
    const isNewUser = !user;
    if (!user) {
      user = await User.create({
        email: E,
        name: name || undefined,
        guest: true,
        isVerified: true,
      });
      console.log(`✅ Created new user for checkout: ${E}`);
    } else if (name && !user.name) {
      // Update name if provided and user doesn't have one
      user.name = name;
      await user.save();
    }

    // Private one-time offer enforcement — mirrors the gate in
    // routes/product.ts::create-razorpay-order so the public checkout URL
    // can't be used to bypass the allowlist / one-time cap.
    if (((product as any).allowedUserIds?.length ?? 0) > 0) {
      const onAllowlist = (product as any).allowedUserIds.some(
        (uid: any) => uid.toString() === user._id.toString(),
      );
      if (!onAllowlist) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to purchase this product",
        });
      }
      const { ProductOrder } = await import("../models/productOrder.model");
      const alreadyBought = await ProductOrder.exists({
        userId: user._id,
        organizationId: product.organizationId,
        "items.productId": product._id,
        paymentStatus: "paid",
      });
      if (alreadyBought) {
        return res.status(409).json({
          success: false,
          error: "You have already purchased this product — this is a one-time offer",
        });
      }
    }

    // Bat246 membership gate (hard security block) — ALL Bat246 org products require $20 membership
    if (product.organizationId.toString() === "6a0d34e677323d1b81c6469b") {
      const dist = isNewUser ? null : await Bat246Distributor.findOne({ userId: user._id })
        .select("hasBat246Membership").lean() as any;
      if (!dist?.hasBat246Membership) {
        return res.status(403).json({ success: false, error: "Bat246 monthly membership required to purchase this product." });
      }
    }

    // Check if already member of organization
    // bat246_entry is a game entry product — org membership check never blocks it,
    // but we still need to know if they're already in the org to avoid duplicate entries.
    const isBat246Entry = Array.isArray((product as any).tags) && (product as any).tags.includes("bat246_entry");

    // For bat246_entry products, always use Alan K as the invoice seller
    let bat246SellerId: string | undefined;
    if (isBat246Entry) {
      const alanK = await User.findOne({ email: "redbaron2020@mail.com" }).select("_id").lean() as any;
      bat246SellerId = alanK?._id?.toString();
    }

    const alreadyInOrg = user.organizations?.some(
      (m: any) => m.organization.toString() === product.organizationId.toString()
    );
    const isMember = !isBat246Entry && alreadyInOrg;

    // Existing members on a PAID product keep the original early-return:
    // bounce to the workspace without an order or channel joins. The FREE path
    // now falls through instead — that early return meant a member "bought" a
    // free product and received nothing (no ProductOrder, no invoice).
    if (isMember && !(product.price === 0 || product.price <= 0)) {
      // Generate token for the user to redirect to workspace
      const token = signJwt({
        userId: user._id.toString(),
        orgId: product.organizationId.toString(),
        name: user.name || "",
        email: user.email,
      });

      return res.json({
        success: true,
        isMember: true,
        token,
        orgId: product.organizationId.toString(),
        userId: user._id.toString(),
      });
    }

    // Get the first floor of the organization (by level)
    const firstFloor = await Floor.findOne({ orgId: product.organizationId }).sort({ level: 1 }).lean();

    // Add user to organization as guest stakeholder (skip if already a member)
    user.organizations = user.organizations || [];
    if (!alreadyInOrg) {
      user.organizations.push({
        organization: product.organizationId,
        role: "stakeholder",
        guest: true,
        floorId: firstFloor?._id || undefined,
        joinedAt: new Date(),
      } as any);
      await user.save();
      console.log(`✅ Added user ${E} to organization ${product.organizationId} as guest stakeholder (floor: ${firstFloor?.name || 'none'})`);
    } else {
      console.log(`ℹ️  User ${E} already in organization ${product.organizationId} — skipping org push`);
    }

    // Also add user to GARAGE HQ (parent org) as a guest stakeholder.
    // Mirrors the seller-org membership above — a product buyer is a
    // customer, not a real member, so `guest: true` must propagate to
    // every membership we create for them (including HQ). Without this
    // flag the buyer appears in HQ's admin roster as a full stakeholder.
    await addUserToGarageHQ(user._id.toString(), { guest: true });
    console.log(`✅ Added user ${E} to GARAGE HQ as guest stakeholder`);

    // Must happen BEFORE sendWelcomeEmail so referredBy is set when the upline notification fires
    if (referralId) {
      const wasSet = await setReferredByAffiliateId(user._id.toString(), referralId);
      if (!wasSet) {
        // Fallback to founder if affiliate ID not found
        await setReferredBy(user._id.toString());
      }
    } else {
      await setReferredBy(user._id.toString());
    }
    await ensureUserHasAffiliateId(user._id.toString());
    console.log(`✅ Set affiliate info for user ${E}`);

    // No explicit bat246Ref on THIS request — e.g. the buyer abandoned
    // checkout earlier, closed the browser, and came back later via a
    // stale/bookmarked link that no longer carries `bat246Ref` (or any
    // direct navigation that skips the app's own "Buy $650" banner, which
    // otherwise always rebuilds this param fresh — see boards/page.tsx).
    // resolveBat246Ref tries, in order: this user's own already-recorded
    // Bat246Distributor.bat246RefUserId, then the durable, email-keyed
    // Bat246OfficeInvite record written the moment the admin sent the
    // invite (covers a prospect who never carried bat246Ref past that
    // point at all). Only if BOTH have nothing do we fall back to the
    // generic, unrelated platform affiliate code (`referralId`) — which
    // previously ran unconditionally here and could misattribute this
    // purchase to whoever "ref=aff_..." belongs to, instead of the actual
    // BAT246 inviter.
    if (!bat246Ref) {
      const { resolveBat246Ref } = await import("../bat246/services/bat246.service");
      bat246Ref = await resolveBat246Ref({ email: E, userId: user._id });
    }

    // Last resort: resolve referralId (generic affiliate code) → userId
    if (!bat246Ref && referralId) {
      const refUser = await User.findOne({ affiliateId: referralId }).select("_id").lean() as any;
      if (refUser?._id) bat246Ref = refUser._id.toString();
    }

    // Send welcome email for new users (fire-and-forget)
    if (isNewUser) {
      sendWelcomeEmail(user._id.toString(), product.organizationId.toString()).catch((err) =>
        console.error("[WelcomeEmail] Failed:", err)
      );
    }

    // Subscribe user to the product's FREE channels only. This used to join
    // every entry in product.channelIds, handing out PAID communities for free.
    // Same guard workshopCheckout has always had.
    if (product.channelIds && product.channelIds.length > 0) {
      const freeChannels = await Channel.find({
        _id: { $in: product.channelIds },
        $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
      })
        .select("_id")
        .lean();
      const { addUserToChannel } = await import("../services/channel");
      for (const ch of freeChannels) {
        // Through the service, not a direct write — that is what mints the $0
        // invoice for each bundled community join.
        await addUserToChannel(
          user._id.toString(),
          String(ch._id),
          product.organizationId.toString(),
          { source: "bundled" },
        );
      }
      console.log(
        `✅ Subscribed user to ${freeChannels.length} free channels (skipped ${product.channelIds.length - freeChannels.length} paid)`,
      );
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: product.organizationId.toString(),
      name: user.name || "",
      email: user.email,
    });

    const orgId = product.organizationId.toString();
    const userId = user._id.toString();
    const price = product.price;

    // Handle free products
    if (price === 0 || price <= 0) {
      // Create order for free product
      const order = await createProductOrder({
        organizationId: orgId,
        userId,
        items: [{ productId, quantity }],
        paymentMethod: "free",
        // This route mints its own free invoice below, carrying bat246
        // metadata and driving board placement + the order email. Let it.
        skipFreeInvoice: true,
      });

      // Create paid invoice for free product (for records)
      try {
        const freeInvoice = await createInvoice({
          organizationId: orgId,
          sellerId: bat246SellerId ?? product.createdBy.toString(),
          userId,
          customerEmail: E,
          customerName: name,
          lineItems: [{
            itemType: "product",
            itemId: productId,
            itemName: product.name,
            itemDescription: product.description,
            itemImage: product.images?.[0],
            quantity,
            unitPrice: 0,
            originalCurrency: product.currency || "USD",
          }],
          itemCurrency: product.currency || "USD",
          metadata: {
            type: "product_checkout",
            free: true,
            ...(bat246BoardId ? { bat246BoardId } : {}),
            ...(bat246Pos ? { bat246Pos } : {}),
            ...(bat246DugoutRef ? { bat246DugoutRef } : {}),
            ...(bat246UpperRef ? { bat246UpperRef } : {}),
            ...(bat246UpperRefPlayerId ? { bat246UpperRefPlayerId } : {}),
            ...(bat246GenRef ? { bat246GenRef } : {}),
            ...(bat246Ref ? { bat246Ref } : {}),
          },
        });
        freeInvoice.status = "paid";
        freeInvoice.paidAt = new Date();
        await freeInvoice.save();

        // This branch creates the ProductOrder itself and marks the invoice paid
        // inline — it never reaches fulfillInvoice, so the order-confirmation
        // email has to be triggered here too or free products silently send nothing.
        void import("../services/orderEmail")
          .then(({ queueOrderEmail }) =>
            queueOrderEmail({
              invoice: freeInvoice,
              itemType: "product",
              itemId: productId,
              order,
            }),
          )
          .catch((err: any) =>
            console.error("[order-email] free-product import failed:", err?.message),
          );

        // Bat246 POD invite — edge case: 100%-off coupon / $0-priced POD product.
        // Non-fatal: never let this block the free-product checkout itself.
        if (productId === "6a7236f5e76fd9817e7238d9") {
          try {
            const { markPodPurchaseCompleted } = await import("../bat246/services/bat246PodInvite.service");
            await markPodPurchaseCompleted(userId);
          } catch (err) {
            console.error("[bat246-pod] markPodPurchaseCompleted (free path) failed:", err);
          }
        }

        // bat246 board placement for free bat246_entry products
        if (isBat246Entry) {
          try {
            const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
            const { Bat246Player } = await import("../bat246/models/bat246Player.model");
            const { createBat246Player } = await import("../bat246/services/bat246PlayerId.util");
            const uName = invoiceUser?.name || ""; const uEmail = invoiceUser?.email || E;
            let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
            if (!player) { player = await createBat246Player({ userId: new Types.ObjectId(userId), nickname: uName || uEmail, email: uEmail, memberSince: new Date() }); }
            if (bat246BoardId && bat246Pos && bat246Ref) {
              const { Bat246PendingPlacement } = await import("../bat246/models/bat246PendingPlacement.model");
              const { Bat246PlacementNotification } = await import("../bat246/models/bat246PlacementNotifications.model");
              const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
              const { Bat246PositionReservation } = await import("../bat246/models/bat246PositionReservations.model");
              await Bat246Distributor.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } }, { upsert: true });
              const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
              await Bat246PendingPlacement.updateOne(
                { userId: new Types.ObjectId(userId), boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, isPlaced: false },
                { $setOnInsert: { userId: new Types.ObjectId(userId), userName: uName, userEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, refUserId: new Types.ObjectId(bat246Ref), purchasedAt: new Date(), expiresAt } },
                { upsert: true }
              );
              // Always upsert a PositionReservation so admin-approval can place the user
              await Bat246PositionReservation.updateOne(
                { reservedByUserId: new Types.ObjectId(userId), status: "active" },
                { $setOnInsert: { reservedByUserId: new Types.ObjectId(userId), reservedByEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, status: "active", reservedAt: new Date(), expiresAt } },
                { upsert: true }
              );
              // Placement notification (main)
              await Bat246PlacementNotification.create({ notificationType: "placement", boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
              // Retroactive membership notification — if user already had $20 membership before buying entry
              const distNow = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) }).select("hasBat246Membership").lean() as any;
              if (distNow?.hasBat246Membership) {
                await Bat246PlacementNotification.create({ notificationType: "membership", qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
              }
            } else if (bat246BoardId && bat246Pos) {
              await addAtBatFromPurchase({
                boardId: bat246BoardId,
                pos1stBase: bat246Pos,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || E,
                productId,
                saleAmount: price,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
              await addFromUpperBaseInvite({
                boardId: bat246BoardId,
                referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase",
                referrerPlayerId: bat246UpperRefPlayerId,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || E,
                productId,
                saleAmount: price,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246GenRef) {
              await addFromGenericInvite({
                boardId: bat246BoardId,
                referrerPlayerId: bat246GenRef,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || E,
                productId,
                saleAmount: price,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246BoardId && bat246DugoutRef) {
              await addToDugoutFromPurchase({
                boardId: bat246BoardId,
                referredByPlayerId: bat246DugoutRef,
                userId,
                userName: invoiceUser?.name || "",
                userEmail: invoiceUser?.email || E,
                productId,
                saleAmount: price,
                countryResidence: invoiceUser?.country ?? undefined,
              });
            } else if (bat246Ref) {
              // Boards page buy — no board context, just mark purchased and notify admin
              const { Bat246Distributor: D } = await import("../bat246/models/bat246Distributor.model");
              const { Bat246PlacementNotification: N } = await import("../bat246/models/bat246PlacementNotifications.model");
              const dist = await D.findOneAndUpdate(
                { userId: new Types.ObjectId(userId) },
                { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } },
                { upsert: true, new: true }
              ) as any;
              // isGarageAffiliate ($25 Garage Affiliate) dropped from
              // qualification on request.
              const qualified = !!(dist?.hasPurchasedProduct && dist?.isOfficeMember && dist?.hasBat246Membership);
              const wasQualified = !!dist?.isQualified;
              await D.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { isQualified: qualified, ...(qualified ? { qualifiedAt: new Date() } : {}) } });
              await N.create({ notificationType: "placement", boardId: null, position: null, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
              if (qualified && !wasQualified) {
                const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
                const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
                await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
                await maybeCreatePlacementNotification(userId).catch(() => {});
              }
            } else {
              console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
            }
          } catch (bat246Err: any) {
            console.error("[bat246] free product placement failed:", bat246Err.message);
          }
        }
      } catch (invoiceErr) {
        console.error("[ProductCheckout] Free invoice creation error:", invoiceErr);
      }

      return res.json({
        success: true,
        isMember: false,
        isFree: true,
        order: order,
        token,
        orgId,
        userId,
      });
    }

    // Calculate total amount
    const totalAmount = price * quantity;

    // Validate coupon if provided
    let couponValidation: any = null;
    let appliedCoupon: any = null;
    let discountAmount = 0;
    let finalPrice = Math.round(totalAmount * 100); // In paise

    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    if (couponCode && !routedCoupon.isPlatform) {
      couponValidation = await validateCoupon({
        code: couponCode,
        itemType: "product",
        itemId: productId,
        amount: finalPrice,
        userId,
        orgId,
      });

      if (!couponValidation.valid) {
        return res.status(400).json({
          success: false,
          error: couponValidation.error || "Invalid coupon",
        });
      }

      appliedCoupon = couponValidation.coupon;
      discountAmount = couponValidation.discountAmount || 0;
      finalPrice = couponValidation.finalAmount || finalPrice;
    }

    // Record coupon usage
    let couponUsageId: string | undefined;
    if (appliedCoupon) {
      const usage = await recordCouponUsage({
        couponId: appliedCoupon._id.toString(),
        userId,
        orgId,
        transactionType: product.isSubscription ? "subscription" : "one_time",
        transactionId: `invoice_pending_${Date.now()}`,
        itemType: "product",
        itemId: productId,
        originalAmount: Math.round(totalAmount * 100),
        discountAmount,
        finalAmount: finalPrice,
      });
      couponUsageId = usage._id.toString();
    }

    // Create invoice (handles both one-time and recurring)
    const isRecurring = !!product.isSubscription;
    const recurringPeriod = product.subscriptionPeriod || "monthly";

    // ── GST math ───────────────────────────────────────────────────
    // Gated on the BUYER's location, not the product's currency. Tax scales
    // by quantity: per-unit tax × qty.
    //
    // Bat246 entry products are game entries priced net of tax — GST is
    // never charged on them regardless of the product's gstInclusive flag,
    // currency, or buyer location. Passed through as `exempt` so the invoice
    // line-item unit price = product price, tax = 0, and the paired Razorpay
    // charge matches what the FE order summary shows.
    const unitPriceCents = Math.round(price * 100);
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );

    // Physical products collect a shipping address, which is the strongest
    // buyer-location signal we have — it takes precedence over the profile
    // and over the payment-currency fallback.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUser: user,
      shippingAddress,
      paymentCurrency: product.currency || "USD",
    });

    const gstInclusive = !!(product as any).gstInclusive;
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      quantity,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
      exempt: isBat246Entry,
    });
    const lineItemUnitPrice = gstLine.lineUnitPrice;
    const invoiceTaxCents = gstLine.taxTotal;
    const gstMetadata = gstLine.gstMetadata
      ? {
          ...gstLine.gstMetadata,
          buyerCountry: gstRegion.country,
          buyerRegion: "IN" as const,
          regionSource: gstRegion.source,
        }
      : undefined;
    const gstSkipped = gstLine.gstMetadata
      ? undefined
      : gstSkippedMetadata(
          gstRegion,
          isBat246Entry ? "item_exempt" : "buyer_outside_india"
        );

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: bat246SellerId ?? product.createdBy.toString(),
      userId,
      customerEmail: E,
      customerName: name,
      lineItems: [{
        itemType: "product",
        itemId: productId,
        itemName: product.name,
        itemDescription: product.description,
        itemImage: product.images?.[0],
        quantity,
        unitPrice: lineItemUnitPrice,
        originalCurrency: product.currency || "USD",
      }],
      itemCurrency: product.currency || "USD",
      isRecurring,
      recurringPeriod: isRecurring ? recurringPeriod : undefined,
      discount: discountAmount,
      tax: invoiceTaxCents || undefined,
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      couponUsageId,
      platformCouponCode,
      shippingAddress,
      referralId,
      metadata: {
        type: "product_checkout",
        requiresShipping: product.requiresShipping && !product.isDigital,
        ...(forReserve ? { forReserve: true } : {}),
        ...(bat246BoardId ? { bat246BoardId } : {}),
        ...(bat246Pos ? { bat246Pos } : {}),
        ...(bat246DugoutRef ? { bat246DugoutRef } : {}),
        ...(bat246UpperRef ? { bat246UpperRef } : {}),
        ...(bat246UpperRefPlayerId ? { bat246UpperRefPlayerId } : {}),
        ...(bat246GenRef ? { bat246GenRef } : {}),
        ...(bat246Ref ? { bat246Ref } : {}),
        ...(gstMetadata ? { gst: gstMetadata } : {}),
        ...(gstSkipped ? { gstSkipped } : {}),
      },
    });

    // Set nextDueDate for recurring invoices
    if (isRecurring) {
      invoice.nextDueDate = getNextChargeDate(new Date(), recurringPeriod);
      invoice.recurringPaymentNumber = 1;
      await invoice.save();
    }

    // Bat246 POD invite — coupon zeroed this specific product out (e.g. a
    // "FREEPOD"-style coupon). Independent of isBat246Entry below — matches
    // purely on product ID. Non-fatal.
    if (productId === "6a7236f5e76fd9817e7238d9" && invoice.status === "paid") {
      try {
        const { markPodPurchaseCompleted } = await import("../bat246/services/bat246PodInvite.service");
        await markPodPurchaseCompleted(userId);
      } catch (err) {
        console.error("[bat246-pod] markPodPurchaseCompleted (checkout coupon-zero path) failed:", err);
      }
    }

    // Platform coupon made this free → invoice was auto-paid in createInvoice.
    // fulfillInvoice for "product" only creates a generic ProductOrder — it has
    // no bat246 placement logic. Run it here, same as the free-product path.
    if (isBat246Entry && invoice.status === "paid") {
      try {
        const invoiceUser = await User.findById(userId).select("name email country").lean() as any;
        const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
        const { Bat246Player } = await import("../bat246/models/bat246Player.model");
        const { createBat246Player } = await import("../bat246/services/bat246PlayerId.util");
        const uName = invoiceUser?.name || ""; const uEmail = invoiceUser?.email || E;
        let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
        if (!player) { player = await createBat246Player({ userId: new Types.ObjectId(userId), nickname: uName || uEmail, email: uEmail, memberSince: new Date() }); }
        if (bat246BoardId && bat246Pos && bat246Ref) {
          const { Bat246PendingPlacement } = await import("../bat246/models/bat246PendingPlacement.model");
          const { Bat246PlacementNotification } = await import("../bat246/models/bat246PlacementNotifications.model");
          const { Bat246PositionReservation } = await import("../bat246/models/bat246PositionReservations.model");
          await Bat246Distributor.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } }, { upsert: true });
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await Bat246PendingPlacement.updateOne(
            { userId: new Types.ObjectId(userId), boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, isPlaced: false },
            { $setOnInsert: { userId: new Types.ObjectId(userId), userName: uName, userEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, refUserId: new Types.ObjectId(bat246Ref), purchasedAt: new Date(), expiresAt } },
            { upsert: true }
          );
          // Always upsert a PositionReservation so admin-approval can place the user
          await Bat246PositionReservation.updateOne(
            { reservedByUserId: new Types.ObjectId(userId), status: "active" },
            { $setOnInsert: { reservedByUserId: new Types.ObjectId(userId), reservedByEmail: uEmail, boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, status: "active", reservedAt: new Date(), expiresAt } },
            { upsert: true }
          );
          await Bat246PlacementNotification.create({ notificationType: "placement", boardId: new Types.ObjectId(bat246BoardId), position: bat246Pos, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
          const distNow = await Bat246Distributor.findOne({ userId: new Types.ObjectId(userId) }).select("hasBat246Membership").lean() as any;
          if (distNow?.hasBat246Membership) {
            await Bat246PlacementNotification.create({ notificationType: "membership", qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
          }
        } else if (bat246BoardId && bat246Pos) {
          await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: uName, userEmail: uEmail, productId, saleAmount: price, countryResidence: invoiceUser?.country ?? undefined });
        } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
          await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId, userName: uName, userEmail: uEmail, productId, saleAmount: price, countryResidence: invoiceUser?.country ?? undefined });
        } else if (bat246BoardId && bat246GenRef) {
          await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: uName, userEmail: uEmail, productId, saleAmount: price, countryResidence: invoiceUser?.country ?? undefined });
        } else if (bat246BoardId && bat246DugoutRef) {
          await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: uName, userEmail: uEmail, productId, saleAmount: price, countryResidence: invoiceUser?.country ?? undefined });
        } else if (bat246Ref) {
          // Boards page buy — no board context, just mark purchased and notify admin
          const { Bat246Distributor: D } = await import("../bat246/models/bat246Distributor.model");
          const { Bat246PlacementNotification: N } = await import("../bat246/models/bat246PlacementNotifications.model");
          const dist = await D.findOneAndUpdate(
            { userId: new Types.ObjectId(userId) },
            { $set: { playerId: player._id, hasPurchasedProduct: true, isOfficeMember: true, bat246RefUserId: new Types.ObjectId(bat246Ref) }, $setOnInsert: { isGarageAffiliate: false, hasBat246Membership: false, isQualified: false } },
            { upsert: true, new: true }
          ) as any;
          // isGarageAffiliate ($25 Garage Affiliate) dropped from
          // qualification on request.
          const qualified = !!(dist?.hasPurchasedProduct && dist?.isOfficeMember && dist?.hasBat246Membership);
          const wasQualified = !!dist?.isQualified;
          await D.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { isQualified: qualified, ...(qualified ? { qualifiedAt: new Date() } : {}) } });
          await N.create({ notificationType: "placement", boardId: null, position: null, qualifiedUserId: new Types.ObjectId(userId), qualifiedUserEmail: uEmail, qualifiedUserName: uName, uplineUserId: new Types.ObjectId(bat246Ref) });
          if (qualified && !wasQualified) {
            const { maybeCreatePlacementNotification } = await import("../bat246/services/bat246.service");
            const { assignDistributorId } = await import("../bat246/services/bat246DistributorId.util");
            await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
            await maybeCreatePlacementNotification(userId).catch(() => {});
          }
        } else {
          console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
        }
      } catch (bat246Err: any) {
        console.error("[bat246] coupon-zero placement failed:", bat246Err.message);
      }
    }

    res.json({
      success: true,
      isMember: false,
      isFree: invoice.status === "paid" && invoice.totalAmount === 0,
      isSubscription: isRecurring,
      invoiceId: invoice._id.toString(),
      product: {
        name: product.name,
        originalPrice: price,
        price: finalPrice / 100 / quantity,
        quantity,
        originalTotalAmount: totalAmount,
        totalAmount: finalPrice / 100,
      },
      coupon: appliedCoupon ? {
        code: appliedCoupon.code,
        discountValue: appliedCoupon.discountValue,
        discountAmount,
      } : null,
      couponUsageId,
      token,
      orgId,
      userId,
      requiresShipping: product.requiresShipping && !product.isDigital,
    });
  } catch (error: any) {
    console.error("Error processing checkout:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process checkout",
      details: error.message,
    });
  }
});

/**
 * POST /checkout/product/:productId/verify-payment
 * Verify Razorpay payment and create order
 */
router.post("/product/:productId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
      userId: z.string(),
      quantity: z.number().min(1).default(1),
      shippingAddress: z
        .object({
          fullName: z.string(),
          addressLine1: z.string(),
          addressLine2: z.string().optional(),
          city: z.string(),
          state: z.string(),
          postalCode: z.string(),
          country: z.string(),
          phone: z.string().optional(),
        })
        .optional(),
      couponUsageId: z.string().optional(),
      bat246BoardId: z.string().optional(),
      bat246Pos: z.string().optional(),
      bat246DugoutRef: z.string().optional(),
      bat246UpperRef: z.string().optional(),
      bat246UpperRefPlayerId: z.string().optional(),
      bat246GenRef: z.string().optional(),
    });

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, quantity, shippingAddress, couponUsageId, bat246BoardId, bat246Pos, bat246DugoutRef, bat246UpperRef, bat246UpperRefPlayerId, bat246GenRef } =
      schema.parse(req.body);

    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid product or user ID" });
    }

    // Delegate to invoice system if invoice exists for this order
    const { Invoice: InvoiceModel } = require("../models/invoice.model");
    const { verifyAndCompletePayment: invoiceVerify, fulfillInvoice } = require("../services/invoice");
    const existingInvoice = await InvoiceModel.findOne({ razorpayOrderId });
    if (existingInvoice) {
      if (existingInvoice.status === "paid") {
        const user = await User.findById(userId).lean();
        const token = signJwt({ userId, orgId: existingInvoice.organizationId.toString(), name: user?.name || "", email: user?.email || "" });
        return res.json({ success: true, message: "Already fulfilled via invoice", token, orgId: existingInvoice.organizationId.toString() });
      }
      try {
        const paidInvoice = await invoiceVerify(existingInvoice._id.toString(), { razorpayOrderId, razorpayPaymentId, razorpaySignature });
        if (!paidInvoice.__alreadyFulfilled) {
          await fulfillInvoice(paidInvoice, razorpayPaymentId);
        }
        const user = await User.findById(userId).lean() as any;
        const token = signJwt({ userId, orgId: paidInvoice.organizationId.toString(), name: user?.name || "", email: user?.email || "" });

        // ── Bat246 board placement (invoice path) ────────────────────────
        let bat246InvResult: { boardId?: string; trackingNumber?: string; atBatSlot?: number; placedInDugout?: boolean } = {};
        if (!paidInvoice.__alreadyFulfilled) {
          const invProduct = await Product.findById(productId).select("tags").lean();
          if (((invProduct as any)?.tags ?? []).includes("bat246_entry")) {
            try {
              const saleAmt = (paidInvoice.totalAmount ?? 0) / 100;
              if (bat246BoardId && bat246Pos) {
                const r = await addAtBatFromPurchase({ boardId: bat246BoardId, pos1stBase: bat246Pos, userId, userName: user?.name || "", userEmail: user?.email || "", productId, saleAmount: saleAmt, countryResidence: user?.country ?? undefined });
                bat246InvResult = { boardId: r.boardId, atBatSlot: r.atBatSlot, placedInDugout: r.placedInDugout };
              } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
                const r = await addFromUpperBaseInvite({ boardId: bat246BoardId, referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase", referrerPlayerId: bat246UpperRefPlayerId, userId, userName: user?.name || "", userEmail: user?.email || "", productId, saleAmount: saleAmt, countryResidence: user?.country ?? undefined });
                bat246InvResult = { boardId: r.boardId, atBatSlot: r.atBatSlot, placedInDugout: r.placedInDugout };
              } else if (bat246BoardId && bat246GenRef) {
                const r = await addFromGenericInvite({ boardId: bat246BoardId, referrerPlayerId: bat246GenRef, userId, userName: user?.name || "", userEmail: user?.email || "", productId, saleAmount: saleAmt, countryResidence: user?.country ?? undefined });
                bat246InvResult = { boardId: r.boardId, atBatSlot: r.atBatSlot, placedInDugout: r.placedInDugout };
              } else if (bat246BoardId && bat246DugoutRef) {
                const r = await addToDugoutFromPurchase({ boardId: bat246BoardId, referredByPlayerId: bat246DugoutRef, userId, userName: user?.name || "", userEmail: user?.email || "", productId, saleAmount: saleAmt, countryResidence: user?.country ?? undefined });
                bat246InvResult = { boardId: r.boardId, placedInDugout: true };
              } else {
                console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
              }
            } catch (bat246Err: any) {
              console.error("[bat246] invoice path placement failed:", bat246Err.message);
            }
          }
        }

        return res.json({
          success: true,
          invoice: paidInvoice.invoiceNumber,
          token,
          orgId: paidInvoice.organizationId.toString(),
          ...(bat246InvResult.boardId ? { bat246BoardId: bat246InvResult.boardId, bat246TrackingNumber: bat246InvResult.trackingNumber } : {}),
        });
      } catch (invoiceErr: any) {
        return res.status(400).json({ success: false, error: invoiceErr.message });
      }
    }

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    // Get product
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const orgId = product.organizationId.toString();

    // For bat246_entry products, always bill to Alan K (same logic as process-checkout)
    const verifyIsBat246 = ((product as any).tags ?? []).includes("bat246_entry");
    let bat246SellerId: string | undefined;
    if (verifyIsBat246) {
      const alanK = await User.findOne({ email: "redbaron2020@mail.com" }).select("_id").lean() as any;
      bat246SellerId = alanK?._id?.toString();
    }

    // Mirror the GST that was charged on the invoice onto the seller's order
    // record. Recomputed from the same inputs (product flag + buyer region)
    // rather than left at 0 — the storefront Order is mirrored from this doc
    // and renders a "GST (18%)" row from it, so a zero here understates both
    // the tax and the total on the seller's own invoice.
    const orderGstRegion = await resolveBuyerGstRegion({
      buyerUserId: userId,
      shippingAddress,
      paymentCurrency: product.currency || "USD",
    });
    const orderGstLine = applyGstToLine({
      listedAmountMinor: Math.round((product.price) * 100),
      quantity,
      gstInclusive: !!(product as any).gstInclusive,
      buyerInIndia: orderGstRegion.inIndia,
      // Same carve-out the charge path applies: bat246 entries are priced
      // net of tax. Re-derived here because this handler has its own scope.
      exempt:
        Array.isArray((product as any).tags) &&
        (product as any).tags.includes("bat246_entry"),
    });

    // Create the order
    const order = await createProductOrder({
      organizationId: orgId,
      userId,
      items: [{ productId, quantity }],
      shippingAddress,
      paymentMethod: "razorpay",
      paymentId: razorpayPaymentId,
      // Pre-tax base × qty, matching the invoice's line items.
      subtotal: orderGstLine.lineUnitPrice * quantity,
      tax: orderGstLine.taxTotal,
    });

    // Distribute commissions
    const price = product.price;
    const itemTotal = price * quantity;

    if (itemTotal > 0) {
      try {
        await distributeCommissions({
          orgId,
          sellerId: bat246SellerId ?? product.createdBy.toString(),
          customerId: userId,
          itemType: "product",
          itemId: productId,
          itemName: product.name,
          // Pre-tax commission base. Only an inclusive-priced product sold
          // to an Indian buyer carries GST inside its listed price, so that
          // is the one case needing extraction; everything else collapses
          // to itemTotal. Resolved the same way checkout did (shipping
          // address first) so the base matches what was invoiced.
          saleAmount:
            getCommissionBase(
              price,
              product as any,
              (
                await resolveBuyerGstRegion({
                  buyerUserId: userId,
                  shippingAddress,
                  paymentCurrency: product.currency || "USD",
                })
              ).inIndia
            ) * quantity,
          currency: product.currency || "USD",
          paymentId: razorpayPaymentId,
          metadata: {
            quantity,
            unitPrice: price,
            orderId: order._id.toString(),
            source: "product_checkout",
          },
        });
      } catch (commissionError) {
        console.error("Error distributing commissions:", commissionError);
      }
    }

    // Update payment status
    const updatedOrder = await updatePaymentStatus(order._id.toString(), orgId, "paid", razorpayPaymentId);

    // Mark coupon usage as applied if provided
    if (couponUsageId) {
      await markUsageApplied(couponUsageId);
    }

    // Get user and generate fresh token
    const user = await User.findById(userId).lean() as any;
    const token = signJwt({
      userId,
      orgId,
      name: user?.name || "",
      email: user?.email || "",
    });

    // ── Bat246 board placement ────────────────────────────────────────────
    let bat246Result: { boardId?: string; trackingNumber?: string; atBatSlot?: number; placedInDugout?: boolean } = {};
    const productTags: string[] = (product as any).tags ?? [];
    if (productTags.includes("bat246_entry")) {
      try {
        if (bat246BoardId && bat246Pos) {
          const result = await addAtBatFromPurchase({
            boardId: bat246BoardId,
            pos1stBase: bat246Pos,
            userId,
            userName: user?.name || "",
            userEmail: user?.email || "",
            productId,
            saleAmount: price,
            countryResidence: user?.country ?? undefined,
          });
          bat246Result = { boardId: result.boardId, atBatSlot: result.atBatSlot, placedInDugout: result.placedInDugout };
        } else if (bat246BoardId && bat246UpperRef && bat246UpperRefPlayerId) {
          const result = await addFromUpperBaseInvite({
            boardId: bat246BoardId,
            referrerPosition: bat246UpperRef as "2ndBaseA" | "2ndBaseB" | "3rdBase",
            referrerPlayerId: bat246UpperRefPlayerId,
            userId,
            userName: user?.name || "",
            userEmail: user?.email || "",
            productId,
            saleAmount: price,
            countryResidence: user?.country ?? undefined,
          });
          bat246Result = { boardId: result.boardId, atBatSlot: result.atBatSlot, placedInDugout: result.placedInDugout };
        } else if (bat246BoardId && bat246GenRef) {
          const result = await addFromGenericInvite({
            boardId: bat246BoardId,
            referrerPlayerId: bat246GenRef,
            userId,
            userName: user?.name || "",
            userEmail: user?.email || "",
            productId,
            saleAmount: price,
            countryResidence: user?.country ?? undefined,
          });
          bat246Result = { boardId: result.boardId, atBatSlot: result.atBatSlot, placedInDugout: result.placedInDugout };
        } else if (bat246BoardId && bat246DugoutRef) {
          const result = await addToDugoutFromPurchase({
            boardId: bat246BoardId,
            referredByPlayerId: bat246DugoutRef,
            userId,
            userName: user?.name || "",
            userEmail: user?.email || "",
            productId,
            saleAmount: price,
            countryResidence: user?.country ?? undefined,
          });
          bat246Result = { boardId: result.boardId, placedInDugout: true };
        } else {
          console.log(`[bat246] no board context for user ${userId}, skipping board creation`);
        }
      } catch (bat246Err: any) {
        console.error("[bat246] post-purchase placement failed:", bat246Err.message);
      }
    }

    res.json({
      success: true,
      order: updatedOrder || order,
      token,
      orgId,
      ...(bat246Result.boardId ? { bat246BoardId: bat246Result.boardId, bat246TrackingNumber: bat246Result.trackingNumber } : {}),
    });
  } catch (error: any) {
    console.error("Error verifying checkout payment:", error);

    // Mark coupon usage as failed if provided
    const { couponUsageId } = req.body;
    if (couponUsageId) {
      await markUsageFailed(couponUsageId).catch(console.error);
    }

    res.status(500).json({
      success: false,
      error: "Failed to verify payment",
      details: error.message,
    });
  }
});

/**
 * POST /checkout/product/:productId/verify-subscription
 * Verify subscription status after Razorpay redirect
 */
router.post("/product/:productId/verify-subscription", async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const schema = z.object({
      razorpaySubscriptionId: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpaySubscriptionId, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid product or user ID" });
    }

    // Fetch subscription status from Razorpay
    const rzpSubscription = await fetchSubscription(razorpaySubscriptionId);

    if (!rzpSubscription) {
      return res.status(404).json({ success: false, error: "Subscription not found" });
    }

    // Check if subscription is active or authenticated
    const validStatuses = ["authenticated", "active"];
    if (!validStatuses.includes(rzpSubscription.status)) {
      return res.status(400).json({
        success: false,
        error: `Subscription is not active. Status: ${rzpSubscription.status}`,
      });
    }

    // Get product
    const product = await Product.findById(productId).lean();
    if (!product) {
      return res.status(404).json({ success: false, error: "Product not found" });
    }

    const orgId = product.organizationId.toString();

    // Mark coupon usage as applied if provided
    if (couponUsageId) {
      await markUsageApplied(couponUsageId);
    }

    // Get user and generate fresh token
    const user = await User.findById(userId).lean();
    const token = signJwt({
      userId,
      orgId,
      name: user?.name || "",
      email: user?.email || "",
    });

    res.json({
      success: true,
      subscription: {
        id: razorpaySubscriptionId,
        status: rzpSubscription.status,
      },
      token,
      orgId,
    });
  } catch (error: any) {
    console.error("Error verifying subscription:", error);

    // Mark coupon usage as failed if provided
    const { couponUsageId } = req.body;
    if (couponUsageId) {
      await markUsageFailed(couponUsageId).catch(console.error);
    }

    res.status(500).json({
      success: false,
      error: "Failed to verify subscription",
      details: error.message,
    });
  }
});

export default router;
