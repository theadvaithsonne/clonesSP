// src/routes/courseCheckout.ts
// Public checkout routes for course enrollment links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Course } from "../models/course.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Channel } from "../models/channel.model";
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
import { enrollInCourse } from "../services/course";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { ensureUserHasAffiliateId, setReferredBy, setReferredByAffiliateId } from "../services/affiliate";
import { distributeCommissions } from "../services/commission";
import { getCommissionBase } from "../utils/gstTax";
import { isBuyerInIndia } from "../utils/gstBuyerRegion";
import {
  validateCoupon,
  recordCouponUsage,
  markUsageApplied,
  markUsageFailed,
} from "../services/coupon";

const router = Router();

/**
 * GET /checkout/course/:courseId
 * Fetch course and organization details for checkout page (public)
 */
router.get("/course/:courseId", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    if (!Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, error: "Invalid course ID" });
    }

    const course = await Course.findOne({
      _id: new Types.ObjectId(courseId),
      status: "published",
    }).lean();

    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found or not available" });
    }

    const organization = await Organization.findById(course.organizationId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    res.json({
      success: true,
      course: {
        _id: course._id,
        title: course.title,
        description: course.description,
        coverImage: course.coverImage,
        isPaid: course.isPaid,
        isFree: course.isFree,
        price: course.price,
        currency: course.currency,
        gstInclusive: (course as any).gstInclusive,
        isSubscription: course.isSubscription,
        subscriptionPeriod: course.subscriptionPeriod,
        channelIds: course.channelIds,
        totalDuration: course.totalDuration,
        totalChapters: course.totalChapters,
        enrolledStudents: course.enrolledStudents,
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
    console.error("Error fetching course for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch course details" });
  }
});

/**
 * POST /checkout/course/:courseId/request-otp
 * Request OTP for checkout (public)
 */
router.post("/course/:courseId/request-otp", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, error: "Invalid course ID" });
    }

    // Verify course exists and is published
    const course = await Course.findOne({
      _id: new Types.ObjectId(courseId),
      status: "published",
    }).lean();

    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found or not available" });
    }

    const E = email.trim().toLowerCase();
    // Use guest-login purpose (already exists in OTP service)
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Course Enrollment Verification Code",
      `<p>Your verification code for enrolling in <b>${course.title}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
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
 * POST /checkout/course/:courseId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/course/:courseId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });
    const { email, code } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, error: "Invalid course ID" });
    }

    const E = email.trim().toLowerCase();
    const verified = await verifyOtp(E, code, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    // Get course to find organization
    const course = await Course.findOne({
      _id: new Types.ObjectId(courseId),
      status: "published",
    }).lean();

    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found or not available" });
    }

    // Find user
    const user = await User.findOne({ email: E }).lean();
    const isMember = user?.organizations?.some(
      (m: any) => m.organization.toString() === course.organizationId.toString()
    );

    res.json({
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
    });
  } catch (error: any) {
    console.error("Error verifying checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/**
 * POST /checkout/course/:courseId/process-checkout
 * Process checkout - create user, add to org, subscribe to channels, create payment
 */
router.post("/course/:courseId/process-checkout", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      referralId: z.string().optional(),
      couponCode: z.string().optional(),
      // Bulk-buy support: when quantity > 1, the buyer gets reserve licenses
      // (one per seat) instead of being auto-enrolled. They can later assign
      // each reserve to another Garage user via /item-reserves/:id/assign.
      // Subscriptions don't support quantity > 1 — guarded below.
      quantity: z.number().int().min(1).max(100).optional().default(1),
    });

    const { email, name, referralId, couponCode, quantity } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ success: false, error: "Invalid course ID" });
    }

    const E = email.trim().toLowerCase();

    // Get course with organization
    const course = await Course.findOne({
      _id: new Types.ObjectId(courseId),
      status: "published",
    }).lean();

    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found or not available" });
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
      console.log(`✅ Created new user for course checkout: ${E}`);
    } else if (name && !user.name) {
      // Update name if provided and user doesn't have one
      user.name = name;
      await user.save();
    }

    // Check if already member of organization
    const isMember = user.organizations?.some(
      (m: any) => m.organization.toString() === course.organizationId.toString()
    );

    // An existing org member used to get an early `return {isMember:true}`
    // HERE — before enrolment, before the channel joins, before the free
    // branch. So a member who "bought" a free course got a success response
    // and no course. Fall through instead and only skip the join-the-org work
    // they don't need, matching workshopCheckout/callCheckout which never
    // early-returned.
    if (!isMember) {
      // Get the first floor of the organization (by level)
      const firstFloor = await Floor.findOne({ orgId: course.organizationId }).sort({ level: 1 }).lean();

      // Add user to organization as guest stakeholder
      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: course.organizationId,
        role: "stakeholder",
        guest: true,
        floorId: firstFloor?._id || undefined,
        joinedAt: new Date(),
      } as any);
      await user.save();
      console.log(`✅ Added user ${E} to organization ${course.organizationId} as guest stakeholder (floor: ${firstFloor?.name || 'none'})`);

      // Also add user to GARAGE HQ (parent org) as a guest stakeholder.
      // Mirrors the seller-org membership above — a course buyer is a
      // customer, not a real member, so `guest: true` must propagate to
      // every membership we create for them (including HQ).
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

      // Send welcome email for new users (fire-and-forget)
      if (isNewUser) {
        sendWelcomeEmail(user._id.toString(), course.organizationId.toString()).catch((err) =>
          console.error("[WelcomeEmail] Failed:", err)
        );
      }
    }

    // Existing members on a PAID course keep the original early-return:
    // bounce to the workspace without enrolling or joining channels. Placed
    // BEFORE the channel block so their behaviour is byte-for-byte what it was.
    // Only the FREE path was changed to fall through, because there the early
    // return meant a member "bought" a free course and received nothing.
    if (isMember && !(course.isFree || (course.price || 0) === 0)) {
      return res.json({
        success: true,
        isMember: true,
        token: signJwt({
          userId: user._id.toString(),
          orgId: course.organizationId.toString(),
          name: user.name || "",
          email: user.email,
        }),
        orgId: course.organizationId.toString(),
        userId: user._id.toString(),
      });
    }

    // Subscribe user to the course's FREE channels only. This used to join
    // every entry in course.channelIds, handing out PAID communities for free.
    // Same guard workshopCheckout has always had.
    if (course.channelIds && course.channelIds.length > 0) {
      const freeChannels = await Channel.find({
        _id: { $in: course.channelIds },
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
          course.organizationId.toString(),
          { source: "bundled" },
        );
      }
      console.log(
        `✅ Subscribed user to ${freeChannels.length} free channels (skipped ${course.channelIds.length - freeChannels.length} paid)`,
      );
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: course.organizationId.toString(),
      name: user.name || "",
      email: user.email,
    });

    const orgId = course.organizationId.toString();
    const userId = user._id.toString();
    const price = course.price || 0;


    // quantity > 1 is only meaningful for paid, one-time course purchases.
    // Subscriptions are per-seat-per-period — multi-seat would mean N parallel
    // subscriptions, which isn't in scope for this flow. Free courses also
    // skip the reserve path (you only need one enrollment for the buyer).
    const effectiveQuantity =
      course.isSubscription || course.isFree || price === 0 ? 1 : quantity;

    // Handle free courses
    if (course.isFree || price === 0) {
      await enrollInCourse({
        courseId,
        userId,
        organizationId: orgId,
        isPaid: false,
        // This route awaits its own mint just below, because it needs the
        // invoice document to attach the order email. Letting the service also
        // mint (in the background) would race and could produce two.
        skipFreeInvoice: true,
      });

      const { mintFreeItemInvoice } = await import("../services/freeInvoice");
      const { invoice: freeInvoice } = await mintFreeItemInvoice({
        userId,
        orgId,
        sellerId: course.createdBy.toString(),
        itemType: "course",
        itemId: courseId,
        itemName: course.title,
        itemDescription: course.description,
        itemImage: course.coverImage,
        currency: course.currency,
        metadataType: "course_checkout",
        source: "checkout",
      });

      // This branch enrolls and marks the invoice paid inline — it never
      // reaches fulfillInvoice, so the order-confirmation email has to be
      // triggered here too or free courses silently send nothing.
      //
      // Gated on the invoice existing, NOT on `created`: enrollInCourse mints
      // it moments earlier, so `created` is always false here. A repeat
      // checkout can't reach this line — enrollInCourse throws
      // "Already enrolled" to the outer handler first — so arriving here
      // already means a genuinely new enrolment.
      if (freeInvoice) {
        void import("../services/orderEmail")
          .then(({ queueOrderEmail }) =>
            queueOrderEmail({
              invoice: freeInvoice,
              itemType: "course",
              itemId: courseId,
            }),
          )
          .catch((err: any) =>
            console.error("[order-email] free-course import failed:", err?.message),
          );
      }

      return res.json({
        success: true,
        // Reflects reality now that existing members reach this branch instead
        // of being bounced before enrolment.
        isMember: !!isMember,
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
    // Per-seat price in smallest unit; multiply by quantity for the order
    // total. Coupons validate against the multiplied amount below.
    const unitPriceCents = Math.round(price * 100);
    let finalPrice = unitPriceCents * effectiveQuantity; // In paise/cents

    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    if (couponCode && !routedCoupon.isPlatform) {
      couponValidation = await validateCoupon({
        code: couponCode,
        itemType: "course",
        itemId: courseId,
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
        transactionType: course.isSubscription ? "subscription" : "one_time",
        transactionId: `invoice_pending_${Date.now()}`,
        itemType: "course",
        itemId: courseId,
        originalAmount: unitPriceCents * effectiveQuantity,
        discountAmount,
        finalAmount: finalPrice,
      });
      couponUsageId = usage._id.toString();
    }

    // Create invoice (handles both one-time and recurring)
    const isRecurring = !!course.isSubscription;
    const recurringPeriod = course.subscriptionPeriod || "monthly";

    // ── GST math ────────────────────────────────────────────────────
    // Same shape as channelCheckout.ts and workshopCheckout.ts. GST is gated
    // on the BUYER's location, not the course's currency — an Indian buyer
    // owes it on a USD course, a foreign buyer never owes it on an INR one.
    // `gstInclusive` (asked of the founder for every course regardless of
    // currency) only decides whether the listed price already contains it.
    // Recurring child invoices inherit tax + metadata.gst verbatim via
    // generateNextChildInvoice — no per-cycle recomputation needed, which
    // also means a buyer keeps their cycle-1 treatment for the life of the
    // subscription.
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );

    // No address is collected on course checkout, so guests resolve off the
    // payment-currency fallback (itemCurrency is what paymentCurrency
    // defaults to at the pay step).
    const gstRegion = await resolveBuyerGstRegion({
      buyerUser: user,
      paymentCurrency: course.currency || "USD",
    });

    const gstInclusive = !!(course as any).gstInclusive;
    const gstLine = applyGstToLine({
      listedAmountMinor: unitPriceCents,
      quantity: effectiveQuantity,
      gstInclusive,
      buyerInIndia: gstRegion.inIndia,
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
      : gstSkippedMetadata(gstRegion, "buyer_outside_india");

    const invoice = await createInvoice({
      organizationId: orgId,
      sellerId: course.createdBy.toString(),
      userId,
      customerEmail: E,
      customerName: name,
      lineItems: [{
        itemType: "course",
        itemId: courseId,
        itemName: course.title,
        itemDescription: course.description,
        itemImage: course.coverImage,
        quantity: effectiveQuantity,
        unitPrice: lineItemUnitPrice,
        originalCurrency: course.currency || "USD",
      }],
      itemCurrency: course.currency || "USD",
      isRecurring,
      recurringPeriod: isRecurring ? recurringPeriod : undefined,
      discount: discountAmount,
      tax: invoiceTaxCents || undefined,
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      couponUsageId,
      platformCouponCode,
      referralId,
      metadata: {
        type: "course_checkout",
        ...(gstMetadata ? { gst: gstMetadata } : {}),
        ...(gstSkipped ? { gstSkipped } : {}),
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
      course: {
        title: course.title,
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
    console.error("Error processing course checkout:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process checkout",
      details: error.message,
    });
  }
});

/**
 * POST /checkout/course/:courseId/verify-payment
 * Verify Razorpay payment and enroll in course
 */
router.post("/course/:courseId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(courseId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid course or user ID" });
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

    // Get course
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found" });
    }

    const orgId = course.organizationId.toString();
    const price = course.price || 0;

    // Enroll user in course
    const enrollment = await enrollInCourse({
      courseId,
      userId,
      organizationId: orgId,
      isPaid: true,
      amountPaid: price,
      currency: course.currency || "USD",
      paymentId: razorpayPaymentId,
    });

    // Distribute commissions
    if (price > 0) {
      try {
        await distributeCommissions({
          orgId: course.organizationId.toString(),
          sellerId: course.createdBy.toString(),
          customerId: userId,
          itemType: "course",
          itemId: courseId,
          itemName: course.title,
          saleAmount: getCommissionBase(
            price,
            course as any,
            await isBuyerInIndia(userId, course.currency || "USD")
          ),
          currency: course.currency || "USD",
          paymentId: razorpayPaymentId,
          metadata: {
            source: "course_checkout",
            enrollmentId: enrollment._id.toString(),
          },
        });
      } catch (commissionError) {
        console.error("Error distributing commissions:", commissionError);
      }
    }

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
    console.error("Error verifying course payment:", error);

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
 * POST /checkout/course/:courseId/verify-subscription
 * Verify subscription status after Razorpay redirect
 */
router.post("/course/:courseId/verify-subscription", async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const schema = z.object({
      razorpaySubscriptionId: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpaySubscriptionId, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(courseId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid course or user ID" });
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

    // Get course
    const course = await Course.findById(courseId).lean();
    if (!course) {
      return res.status(404).json({ success: false, error: "Course not found" });
    }

    const orgId = course.organizationId.toString();
    const price = course.price || 0;

    // Enroll user in course
    const enrollment = await enrollInCourse({
      courseId,
      userId,
      organizationId: orgId,
      isPaid: true,
      amountPaid: price,
      currency: course.currency || "USD",
      paymentId: razorpaySubscriptionId,
    });

    // Distribute commissions
    if (price > 0) {
      try {
        await distributeCommissions({
          orgId: course.organizationId.toString(),
          sellerId: course.createdBy.toString(),
          customerId: userId,
          itemType: "course",
          itemId: courseId,
          itemName: course.title,
          saleAmount: getCommissionBase(
            price,
            course as any,
            await isBuyerInIndia(userId, course.currency || "USD")
          ),
          currency: course.currency || "USD",
          paymentId: razorpaySubscriptionId,
          isRecurringPayment: false,
          recurringPaymentNumber: 1,
          metadata: {
            source: "course_checkout_subscription",
            enrollmentId: enrollment._id.toString(),
            subscriptionId: razorpaySubscriptionId,
          },
        });
      } catch (commissionError) {
        console.error("Error distributing commissions:", commissionError);
      }
    }

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
    console.error("Error verifying course subscription:", error);

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
