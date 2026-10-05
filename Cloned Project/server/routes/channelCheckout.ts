// src/routes/channelCheckout.ts
// Public checkout routes for channel subscription links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Channel } from "../models/channel.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Floor } from "../models/floor.model";
import { createOtp, verifyOtp } from "../services/otp";
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
import { addUserToGarageHQ } from "../services/init";
import { autoJoinDefaultChannel } from "../services/channel";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { ensureUserHasAffiliateId, setReferredBy, setReferredByAffiliateId } from "../services/affiliate";
import {
  validateCoupon,
  recordCouponUsage,
  markUsageApplied,
  markUsageFailed,
} from "../services/coupon";

const router = Router();

/**
 * GET /checkout/channel/:channelId
 * Fetch channel and organization details for checkout page (public)
 */
router.get("/channel/:channelId", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;

    if (!Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ success: false, error: "Invalid channel ID" });
    }

    const channel = await Channel.findOne({
      _id: new Types.ObjectId(channelId),
      isActive: true,
    })
      .populate("createdBy", "name profilePicture")
      .lean();

    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found or not available" });
    }

    const organization = await Organization.findById(channel.storeId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    const effectivePrice = channel.price;

    res.json({
      success: true,
      channel: {
        _id: channel._id,
        title: channel.title,
        description: channel.description,
        coverImage: channel.coverImage,
        isFree: channel.isFree || effectivePrice === 0 || effectivePrice <= 0,
        price: channel.price,
        currency: channel.currency,
        // The checkout page reads this to label the GST line. It was missing
        // here (the other three item detail endpoints return it), so the
        // page's inclusive branch could never fire.
        gstInclusive: (channel as any).gstInclusive,
        isSubscription: channel.isSubscription,
        subscriptionPeriod: channel.subscriptionPeriod,
        creator: channel.createdBy,
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
    console.error("Error fetching channel for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch channel details" });
  }
});

/**
 * POST /checkout/channel/:channelId/request-otp
 * Request OTP for checkout (public)
 */
router.post("/channel/:channelId/request-otp", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ success: false, error: "Invalid channel ID" });
    }

    // Verify channel exists and is active
    const channel = await Channel.findOne({
      _id: new Types.ObjectId(channelId),
      isActive: true,
    }).lean();

    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found or not available" });
    }

    const E = email.trim().toLowerCase();
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Channel Subscription Verification Code",
      `<p>Your verification code for subscribing to <b>${channel.title}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
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
 * POST /checkout/channel/:channelId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/channel/:channelId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });
    const { email, code } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ success: false, error: "Invalid channel ID" });
    }

    const E = email.trim().toLowerCase();
    const verified = await verifyOtp(E, code, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    // Get channel to find organization
    const channel = await Channel.findOne({
      _id: new Types.ObjectId(channelId),
      isActive: true,
    }).lean();

    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found or not available" });
    }

    // Find user
    const user = await User.findOne({ email: E }).lean();

    // "Already a member?" — must be scoped to THIS channel, not the whole
    // org. Historical bug: this used to check `user.organizations` for
    // membership in `channel.storeId`, which false-blocked anyone who
    // ever joined the org via a different channel, an invite, or any
    // free-channel workflow. Now we only block when the user has a real
    // ChannelMembership row for this exact channel in `active` status
    // (created by fulfillInvoice's "channel" case on a paid purchase).
    let isMember = false;
    if (user) {
      const activeMembership = await ChannelMembership.findOne({
        userId: user._id,
        channelId: new Types.ObjectId(channelId),
        status: "active",
      }).lean();
      isMember = !!activeMembership;
    }

    res.json({
      success: true,
      userId: user?._id?.toString() || null,
      isMember,
      needsProfile: !user || !user.name,
      user: user
        ? {
            email: user.email,
            name: user.name,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Error verifying checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/**
 * POST /checkout/channel/:channelId/process-checkout
 * Process checkout - create user, add to org, subscribe to channel, create payment
 */
router.post("/channel/:channelId/process-checkout", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      referralId: z.string().optional(),
      couponCode: z.string().optional(),
      // Bulk-buy support: quantity > 1 routes each seat into the buyer's
      // reserve pool. Subscription channels and free channels stay at 1.
      quantity: z.number().int().min(1).max(100).optional().default(1),
      // Where the payment is happening (web | ios | android). iOS-app callers
      // stamp "ios" so we apply Apple's 30% fee accounting at fulfillment.
      // Defaults to "web".
      paymentSource: z.enum(["web", "ios", "android"]).optional().default("web"),
    });

    const { email, name, referralId, couponCode, quantity, paymentSource } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(channelId)) {
      return res.status(400).json({ success: false, error: "Invalid channel ID" });
    }

    const E = email.trim().toLowerCase();

    // Get channel
    const channel = await Channel.findOne({
      _id: new Types.ObjectId(channelId),
      isActive: true,
    }).lean();

    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found or not available" });
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
      console.log(`✅ Created new user for channel checkout: ${E}`);
    } else if (name && !user.name) {
      user.name = name;
      await user.save();
    }

    const orgId = channel.storeId.toString();

    // Check if the user already has an ACTIVE subscription to THIS specific
    // channel — not to the whole org. Same fix as /verify-otp above (see
    // that block for the historical bug explanation).
    const activeMembership = await ChannelMembership.findOne({
      userId: user._id,
      channelId: new Types.ObjectId(channelId),
      status: "active",
    }).lean();
    const isMember = !!activeMembership;

    if (isMember) {
      // Generate token for the user to redirect to workspace
      const token = signJwt({
        userId: user._id.toString(),
        orgId,
        name: user.name || "",
        email: user.email,
      });

      return res.json({
        success: true,
        isMember: true,
        token,
        orgId,
        userId: user._id.toString(),
      });
    }

    // Get the first floor of the organization (by level)
    const firstFloor = await Floor.findOne({ orgId: channel.storeId }).sort({ level: 1 }).lean();

    // Add user to organization as guest stakeholder
    user.organizations = user.organizations || [];
    user.organizations.push({
      organization: channel.storeId,
      role: "stakeholder",
      guest: true,
      floorId: firstFloor?._id || undefined,
      joinedAt: new Date(),
    } as any);
    await user.save();
    console.log(`✅ Added user ${E} to organization ${orgId} as guest stakeholder`);

    // Add user to GARAGE HQ as a guest stakeholder — mirrors the
    // seller-org membership above. A channel buyer is a customer, so
    // `guest: true` must propagate to the HQ membership too.
    await addUserToGarageHQ(user._id.toString(), { guest: true });
    console.log(`✅ Added user ${E} to GARAGE HQ as guest stakeholder`);

    // Auto-join user to the org's default community (if founder has set one)
    try {
      await autoJoinDefaultChannel(user._id.toString(), orgId);
    } catch (defaultChannelErr) {
      console.error("⚠️ Could not auto-join default community:", defaultChannelErr);
    }

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

    // Send welcome email for new users (fire-and-forget)
    if (isNewUser) {
      sendWelcomeEmail(user._id.toString(), orgId).catch((err) =>
        console.error("[WelcomeEmail] Failed:", err)
      );
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId,
      name: user.name || "",
      email: user.email,
    });

    const userId = user._id.toString();
    const price = channel.price;

    // quantity > 1 is only meaningful for paid, one-time channel purchases.
    // Subscription channels and free channels stay at 1.
    const effectiveQuantity =
      channel.isSubscription || channel.isFree || price === 0 || price <= 0
        ? 1
        : quantity;

    // Handle free channels
    if (channel.isFree || price === 0 || price <= 0) {
      // Subscribe directly to free channel
      await ChannelMembership.findOneAndUpdate(
        {
          userId: user._id,
          channelId: new Types.ObjectId(channelId),
          orgId: channel.storeId,
        },
        {
          userId: user._id,
          channelId: new Types.ObjectId(channelId),
          orgId: channel.storeId,
          status: "active",
          role: "member",
          joinedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      // Membership is granted inline here — this branch never reaches
      // fulfillInvoice, so the $0 invoice and the order-confirmation email both
      // hang off the mint. Minting through the shared helper rather than
      // createInvoice directly is what makes a repeat visit safe: nothing
      // bounces an existing member before this point, so an unguarded mint
      // would write a second invoice and send a second "Order Confirmed" every
      // time the free checkout URL was opened again.
      //
      // metadata.type stays "channel_checkout" so reports grouping on it are
      // unaffected.
      const { mintFreeItemInvoice } = await import("../services/freeInvoice");
      await mintFreeItemInvoice({
        userId,
        orgId,
        sellerId: channel.createdBy.toString(),
        itemType: "channel",
        itemId: channelId,
        itemName: channel.title,
        itemDescription: channel.description || undefined,
        itemImage: channel.coverImage || undefined,
        currency: channel.currency || "USD",
        metadataType: "channel_checkout",
        source: "checkout",
        notifyBuyer: true,
      });

      return res.json({
        success: true,
        isMember: false,
        isFree: true,
        token,
        orgId,
        userId,
      });
    }

    // Validate coupon if provided
    let couponValidation: any = null;
    let appliedCoupon: any = null;
    let discountAmount = 0;
    const unitPriceCents = Math.round(price * 100);
    let finalPrice = unitPriceCents * effectiveQuantity; // In paise/cents

    // Route coupon: check if it's a platform coupon first, else use legacy
    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    if (couponCode && !routedCoupon.isPlatform) {
      couponValidation = await validateCoupon({
        code: couponCode,
        itemType: "channel",
        itemId: channelId,
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
        transactionType: channel.isSubscription ? "subscription" : "one_time",
        transactionId: `invoice_pending_${Date.now()}`,
        itemType: "channel",
        itemId: channelId,
        originalAmount: unitPriceCents * effectiveQuantity,
        discountAmount,
        finalAmount: finalPrice,
      });
      couponUsageId = usage._id.toString();
    }

    // Create invoice (handles both one-time and recurring)
    const isRecurring = !!channel.isSubscription;
    const recurringPeriod = channel.subscriptionPeriod || "monthly";

    // ── GST + Apple iOS fee math ──────────────────────────────────────
    // GST applies on the BUYER's location, not the channel's currency: an
    // Indian buyer owes it on a USD channel, a foreign buyer never owes it
    // on an INR one. `gstInclusive` (asked of the founder for every item,
    // regardless of currency) only decides whether the listed price already
    // contains the tax. Full matrix lives in gstTax.applyGstToLine.
    //
    // Apple fee: applies only when paymentSource=ios AND channel.appleFeeInclusive.
    // It's accounted on the post-GST base; recorded on the invoice metadata.
    // No wallet credit — Apple keeps it on their side.
    const {
      shouldApplyAppleFee,
      applyGstToLine,
      extractAppleFeeFromTotal,
      APPLE_FEE_RATE,
    } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );

    // Channel checkout collects only email/OTP/name — no address — so for
    // guests this resolves off the payment-currency fallback. `paymentCurrency`
    // isn't chosen until the pay step and defaults to itemCurrency there, so
    // the channel's own currency is the correct stand-in at this point.
    const gstRegion = await resolveBuyerGstRegion({
      buyerUser: user,
      paymentCurrency: channel.currency || "USD",
    });

    const gstInclusive = !!(channel as any).gstInclusive;
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      quantity: effectiveQuantity,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
    });

    // Line-item unitPrice carries the pre-tax base; invoice-level `tax`
    // carries the GST. subtotal therefore stays pre-tax, which is what the
    // commission math downstream depends on.
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
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    // Apple iOS fee — only when buyer is paying via the iOS app.
    // Currently nothing in the codebase sets paymentSource=ios, so this is
    // infra-only. Apple-fee is computed on the post-GST base (the founder's
    // gross before platform fee + commissions are taken).
    let appleFeeMetadata: any = undefined;
    if (
      shouldApplyAppleFee(paymentSource) &&
      (channel as any).appleFeeInclusive
    ) {
      const lineSubtotalCents = lineItemUnitPrice * effectiveQuantity;
      const { feeAmount } = extractAppleFeeFromTotal(lineSubtotalCents);
      appleFeeMetadata = {
        rate: APPLE_FEE_RATE,
        amount: feeAmount,
        inclusive: true,
      };
    }

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: channel.createdBy.toString(),
      userId,
      customerEmail: E,
      customerName: name,
      lineItems: [{
        itemType: "channel",
        itemId: channelId,
        itemName: channel.title,
        itemDescription: channel.description || undefined,
        itemImage: channel.coverImage || undefined,
        quantity: effectiveQuantity,
        unitPrice: lineItemUnitPrice,
        originalCurrency: channel.currency || "USD",
      }],
      itemCurrency: channel.currency || "USD",
      isRecurring,
      recurringPeriod: isRecurring ? recurringPeriod : undefined,
      discount: discountAmount,
      tax: invoiceTaxCents || undefined,
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      couponUsageId,
      platformCouponCode,
      referralId,
      paymentSource,
      metadata: {
        type: "channel_checkout",
        ...(gstMetadata ? { gst: gstMetadata } : {}),
        ...(gstSkipped ? { gstSkipped } : {}),
        ...(appleFeeMetadata ? { appleFee: appleFeeMetadata } : {}),
      },
    });

    if (isRecurring) {
      invoice.nextDueDate = getNextChargeDate(new Date(), recurringPeriod);
      invoice.recurringPaymentNumber = 1;
      await invoice.save();
    }

    res.json({
      success: true,
      isMember: false,
      isFree: false,
      isSubscription: isRecurring,
      invoiceId: invoice._id.toString(),
      channel: {
        title: channel.title,
        originalPrice: price,
        price: finalPrice / 100,
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
    });
  } catch (error: any) {
    console.error("Error processing channel checkout:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process checkout",
      details: error.message,
    });
  }
});

/**
 * POST /checkout/channel/:channelId/verify-payment
 * Verify Razorpay payment and subscribe to channel
 */
router.post("/channel/:channelId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(channelId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid channel or user ID" });
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
        const user = await User.findById(userId).lean();
        const token = signJwt({ userId, orgId: paidInvoice.organizationId.toString(), name: user?.name || "", email: user?.email || "" });
        return res.json({ success: true, invoice: paidInvoice.invoiceNumber, token, orgId: paidInvoice.organizationId.toString() });
      } catch (invoiceErr: any) {
        return res.status(400).json({ success: false, error: invoiceErr.message });
      }
    }

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    // Get channel
    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found" });
    }

    const orgId = channel.storeId.toString();

    // Subscribe user to channel
    await ChannelMembership.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
        orgId: channel.storeId,
      },
      {
        userId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
        orgId: channel.storeId,
        status: "active",
        role: "member",
        joinedAt: new Date(),
        paymentId: razorpayPaymentId,
      },
      { upsert: true, new: true }
    );

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
      token,
      orgId,
    });
  } catch (error: any) {
    console.error("Error verifying channel payment:", error);

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
 * POST /checkout/channel/:channelId/verify-subscription
 * Verify subscription status after Razorpay redirect
 */
router.post("/channel/:channelId/verify-subscription", async (req: Request, res: Response) => {
  try {
    const { channelId } = req.params;
    const schema = z.object({
      razorpaySubscriptionId: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpaySubscriptionId, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(channelId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid channel or user ID" });
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

    // Get channel
    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      return res.status(404).json({ success: false, error: "Channel not found" });
    }

    const orgId = channel.storeId.toString();

    // Subscribe user to channel
    await ChannelMembership.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
        orgId: channel.storeId,
      },
      {
        userId: new Types.ObjectId(userId),
        channelId: new Types.ObjectId(channelId),
        orgId: channel.storeId,
        status: "active",
        role: "member",
        joinedAt: new Date(),
        subscriptionId: razorpaySubscriptionId,
      },
      { upsert: true, new: true }
    );

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
    console.error("Error verifying channel subscription:", error);

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
