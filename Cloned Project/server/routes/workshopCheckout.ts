// src/routes/workshopCheckout.ts
// Public checkout routes for workshop/webinar enrollment links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Workshop } from "../models/workshop.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ChannelMembership } from "../models/channelMembership.model";
import { Channel } from "../models/channel.model";
import { Floor } from "../models/floor.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import { signJwt } from "../services/jwt";
import {
  verifyPaymentSignature,
  fetchSubscription,
} from "../services/razorpay";
import { createInvoice, getNextChargeDate } from "../services/invoice";
import {
  registerForFreeWorkshop,
  registerForPaidWorkshop,
} from "../services/workshop";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { ensureUserHasAffiliateId, setReferredBy, setReferredByAffiliateId } from "../services/affiliate";
import { distributeCommissions } from "../services/commission";
import {
  validateCoupon,
  recordCouponUsage,
  markUsageApplied,
  markUsageFailed,
} from "../services/coupon";

const router = Router();

/**
 * GET /checkout/workshop/:workshopId
 * Fetch workshop and organization details for checkout page (public)
 */
router.get("/workshop/:workshopId", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }

    // Excludes soft-deleted (Trash) workshops so a buyer with a stale
    // checkout link can't proceed. Matches isWorkshopDeleted() at
    // utils/workshopStatus.ts:39.
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      isActive: true,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    })
      .populate("createdBy", "name profilePicture")
      .lean();

    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found or not available" });
    }

    const organization = await Organization.findById(workshop.orgId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    const effectivePrice = workshop.price;

    // Precompute upcoming sessions for per_session workshops so the FE
    // renders a session picker at checkout without needing a second
    // round-trip. `calculateSessions` respects the recurrence pattern
    // + workshop timezone so the returned datetimes align with what
    // the customer would see on their calendar. 10 is enough to fill
    // the picker without paging.
    let upcomingSessions: any[] = [];
    if (
      workshop.isRecurring &&
      (workshop as any).enrollmentType === "per_session" &&
      workshop.recurrencePattern &&
      (workshop as any).recurrenceStartDate
    ) {
      const { calculateSessions } = await import("../utils/recurrence");
      const { WorkshopSessionOverride } = await import(
        "../models/workshopSessionOverride.model"
      );
      const { indexOverridesByDay, resolveEffectiveSession, sessionDayKey } =
        await import("../utils/sessionOverlay");
      const { isSessionDeleted } = await import("../utils/workshopStatus");

      const overrideByDay = indexOverridesByDay(
        (await WorkshopSessionOverride.find({
          workshopId: workshop._id,
        }).lean()) as any[]
      );

      upcomingSessions = calculateSessions(
        workshop.recurrencePattern as any,
        new Date((workshop as any).recurrenceStartDate),
        workshop.startTime,
        workshop.endTime,
        new Date(),
        500,
        false,
        workshop.timezone,
        (workshop as any).recurrenceEndDate
          ? new Date((workshop as any).recurrenceEndDate)
          : undefined
      )
        .map((s: any) => {
          const override =
            overrideByDay.get(sessionDayKey(s.date).toISOString()) || null;
          const effective = resolveEffectiveSession(
            workshop as any,
            s.date,
            override as any,
            { startDateTime: s.startDateTime, endDateTime: s.endDateTime }
          );
          return {
            // `date`/`dateString` stay the canonical slot the buyer sends
            // back at checkout; the rest is what they'll actually see.
            date: s.date,
            dateString: s.dateString,
            startDateTime: effective.startDateTime,
            endDateTime: effective.endDateTime,
            isPast: effective.endDateTime < new Date(),
            isToday: s.isToday,
            title: effective.title,
            isFree: effective.isFree,
            price: effective.price,
            rescheduled: effective.isRescheduled,
            _trashed: isSessionDeleted(override as any),
          };
        })
        // A cancelled session must not sit in the picker — buying it would
        // create an order for something that isn't running.
        .filter((s: any) => !s._trashed)
        .map(({ _trashed, ...s }: any) => s);
    }

    res.json({
      success: true,
      workshop: {
        _id: workshop._id,
        title: workshop.title,
        description: workshop.description,
        thumbnail: workshop.thumbnail,
        date: workshop.date,
        startTime: workshop.startTime,
        endTime: workshop.endTime,
        timezone: workshop.timezone,
        maxParticipants: workshop.maxParticipants,
        isFree: workshop.isFree || effectivePrice === 0 || effectivePrice <= 0,
        price: workshop.price,
        currency: workshop.currency,
        isSubscription: workshop.isSubscription,
        subscriptionPeriod: workshop.subscriptionPeriod,
        isRecurring: workshop.isRecurring,
        recurrencePattern: workshop.recurrencePattern,
        recurrenceStartDate: (workshop as any).recurrenceStartDate,
        enrollmentType: (workshop as any).enrollmentType || "once",
        gstInclusive: (workshop as any).gstInclusive,
        upcomingSessions,
        channelIds: workshop.channelIds,
        host: workshop.createdBy,
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
    console.error("Error fetching workshop for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch workshop details" });
  }
});

/**
 * POST /checkout/workshop/:workshopId/request-otp
 * Request OTP for checkout (public)
 */
router.post("/workshop/:workshopId/request-otp", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }

    // Verify workshop exists and is active
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      isActive: true,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found or not available" });
    }

    const E = email.trim().toLowerCase();
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Workshop Registration Verification Code",
      `<p>Your verification code for registering for <b>${workshop.title}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
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
 * POST /checkout/workshop/:workshopId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/workshop/:workshopId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
    });
    const { email, code } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }

    const E = email.trim().toLowerCase();
    const verified = await verifyOtp(E, code, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    // Get workshop to find organization
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      isActive: true,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found or not available" });
    }

    // Find user
    const user = await User.findOne({ email: E }).lean();
    const isMember = user?.organizations?.some(
      (m: any) => m.organization.toString() === workshop.orgId.toString()
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
 * POST /checkout/workshop/:workshopId/process-checkout
 * Process checkout - create user, add to org, subscribe to channels, create payment/registration
 */
router.post("/workshop/:workshopId/process-checkout", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      name: z.string().optional(),
      referralId: z.string().optional(),
      couponCode: z.string().optional(),
      // Bulk-buy support: quantity > 1 routes each seat into the buyer's
      // reserve pool. Subscription / free workshops stay at 1.
      quantity: z.number().int().min(1).max(100).optional().default(1),
      // For `per_session` workshops: ISO date string of the specific
      // session the buyer is enrolling for. Required when the workshop's
      // enrollmentType is "per_session"; ignored for "once" mode.
      // Stamped on invoice.metadata so both Razorpay + wallet payment
      // paths carry it through to registerForPaidWorkshop.
      sessionDate: z.string().optional(),
    });

    const { email, name, referralId, couponCode, quantity, sessionDate } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(workshopId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop ID" });
    }

    const E = email.trim().toLowerCase();

    // Get workshop
    const workshop = await Workshop.findOne({
      _id: new Types.ObjectId(workshopId),
      isActive: true,
      $or: [
        { deletedAt: null },
        { deletedAt: { $exists: false } },
        { $expr: { $gt: ["$restoredAt", "$deletedAt"] } },
      ],
    }).lean();

    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found or not available" });
    }

    // Session-date validation for per-session workshops. Do this early
    // so we don't create a user + invoice for a buy that would fail on
    // fulfillment. `sessionDate` is required when enrollmentType is
    // "per_session" and must match a real occurrence per the recurrence
    // pattern (delegated to isValidSessionDate).
    let sessionDateParsed: Date | undefined;
    if ((workshop as any).enrollmentType === "per_session") {
      if (!sessionDate) {
        return res.status(400).json({
          success: false,
          error: "sessionDate is required for per-session workshops",
        });
      }
      sessionDateParsed = new Date(sessionDate);
      if (isNaN(sessionDateParsed.getTime())) {
        return res.status(400).json({
          success: false,
          error: "Invalid sessionDate — must be an ISO date string",
        });
      }
      const { isValidSessionDate } = await import("../utils/recurrence");
      const pattern = (workshop as any).recurrencePattern;
      const startAt =
        (workshop as any).recurrenceStartDate || (workshop as any).date;
      const endAt = (workshop as any).recurrenceEndDate
        ? new Date((workshop as any).recurrenceEndDate)
        : undefined;
      if (
        !pattern ||
        !startAt ||
        !isValidSessionDate(sessionDateParsed, pattern, new Date(startAt), endAt)
      ) {
        return res.status(400).json({
          success: false,
          error: "The requested date is not a valid session for this workshop",
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
      console.log(`✅ Created new user for workshop checkout: ${E}`);
    } else if (name && !user.name) {
      user.name = name;
      await user.save();
    }

    // Check if already member of organization
    const isMember = user.organizations?.some(
      (m: any) => m.organization.toString() === workshop.orgId.toString()
    );

    // Existing members skip the org-add / welcome-email / affiliate steps
    // but STILL flow into invoice creation + registration below. Previously
    // this branch returned early — which meant an existing member hitting
    // the /checkout URL for a per-session workshop got a token back but
    // was never registered for the session they picked (no invoice, no
    // WorkshopRegistration row). Now the invoice + registration always
    // run; membership just short-circuits the org bootstrap.
    if (!isMember) {
      // Get the first floor of the organization (by level)
      const firstFloor = await Floor.findOne({ orgId: workshop.orgId }).sort({ level: 1 }).lean();

      // Add user to organization as guest stakeholder
      user.organizations = user.organizations || [];
      user.organizations.push({
        organization: workshop.orgId,
        role: "stakeholder",
        guest: true,
        floorId: firstFloor?._id || undefined,
        joinedAt: new Date(),
      } as any);
      await user.save();
      console.log(`✅ Added user ${E} to organization ${workshop.orgId} as guest stakeholder`);

      // Add user to GARAGE HQ as a guest stakeholder — mirrors the
      // seller-org membership above. A workshop buyer is a customer, so
      // `guest: true` must propagate to the HQ membership too.
      await addUserToGarageHQ(user._id.toString(), { guest: true });
      console.log(`✅ Added user ${E} to GARAGE HQ as guest stakeholder`);

      // Set referredBy based on referralId (affiliate link) or fallback to founder
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

      // Send welcome email (fire-and-forget, after referral is set so upline notification fires correctly)
      sendWelcomeEmail(user._id.toString(), workshop.orgId.toString()).catch((err) =>
        console.error("[WelcomeEmail] Failed:", err)
      );

      // Subscribe user to workshop's FREE channels only. Paid channels
      // require their own invoice (chained ahead of the workshop invoice
      // in prepare-join); auto-granting them here was a bug.
      if (workshop.channelIds && workshop.channelIds.length > 0) {
        const freeChannels = await Channel.find({
          _id: { $in: workshop.channelIds },
          $or: [{ isFree: true }, { price: { $in: [null, 0] } }],
        })
          .select("_id")
          .lean();
        for (const ch of freeChannels) {
          await ChannelMembership.findOneAndUpdate(
            {
              userId: user._id,
              channelId: ch._id,
              orgId: workshop.orgId,
            },
            {
              userId: user._id,
              channelId: ch._id,
              orgId: workshop.orgId,
              status: "active",
              role: "member",
              joinedAt: new Date(),
            },
            { upsert: true, new: true }
          );
        }
        console.log(`✅ Subscribed user to ${freeChannels.length} free channels (skipped ${workshop.channelIds.length - freeChannels.length} paid)`);
      }
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: workshop.orgId.toString(),
      name: user.name || "",
      email: user.email,
    });

    const orgId = workshop.orgId.toString();
    const userId = user._id.toString();

    // Per-session pricing. Only `per_session` enrolment can differ session to
    // session — in `once` mode the buyer purchases the whole series, so the
    // series price is the right one. `sessionDateParsed` is only set for
    // per_session (validated above), so this resolves to the series values
    // for every other workshop.
    const sessionOverride = sessionDateParsed
      ? await (
          await import("../models/workshopSessionOverride.model")
        ).WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: (
            await import("../utils/sessionOverlay")
          ).sessionDayKey(sessionDateParsed),
        }).lean()
      : null;

    const { isSessionDeleted } = await import("../utils/workshopStatus");
    if (isSessionDeleted(sessionOverride as any)) {
      return res.status(400).json({
        success: false,
        error: "This session has been cancelled",
      });
    }

    const { resolveSessionPricing } = await import("../utils/sessionOverlay");
    const sessionPricing = resolveSessionPricing(
      workshop as any,
      sessionOverride as any
    );
    const price = sessionPricing.price;
    const itemName = (sessionOverride as any)?.title || workshop.title;

    // quantity > 1 only meaningful for paid, one-time workshop purchases.
    const effectiveQuantity =
      workshop.isSubscription || sessionPricing.isFree ? 1 : quantity;

    // Handle free workshops
    if (sessionPricing.isFree) {
      // The $0 invoice is minted inside registerForFreeWorkshop now, so every
      // entry point (this checkout, /workshops/:id/register, the public
      // webinar prepare-join) produces it — not just this one.
      await registerForFreeWorkshop(userId, workshopId, orgId, {
        sessionDate: sessionDateParsed,
      });

      return res.json({
        success: true,
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
    const unitPriceCents = Math.round(price * 100);
    let finalPrice = unitPriceCents * effectiveQuantity; // In paise/cents

    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    if (couponCode && !routedCoupon.isPlatform) {
      couponValidation = await validateCoupon({
        code: couponCode,
        itemType: "workshop",
        itemId: workshopId,
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
        transactionType: workshop.isSubscription ? "subscription" : "one_time",
        transactionId: `invoice_pending_${Date.now()}`,
        itemType: "workshop",
        itemId: workshopId,
        originalAmount: unitPriceCents * effectiveQuantity,
        discountAmount,
        finalAmount: finalPrice,
      });
      couponUsageId = usage._id.toString();
    }

    const isRecurring = !!workshop.isSubscription;
    const recurringPeriod = workshop.subscriptionPeriod || "monthly";

    // ── GST math ───────────────────────────────────────────────────────
    // Mirrors channelCheckout.ts. Gated on the BUYER's location, not the
    // workshop's currency: an Indian buyer owes GST on a USD workshop, a
    // foreign buyer never owes it on an INR one. `gstInclusive` only decides
    // whether the listed price already contains the tax.
    const { applyGstToLine } = await import("../utils/gstTax");
    const { resolveBuyerGstRegion, gstSkippedMetadata } = await import(
      "../utils/gstBuyerRegion"
    );

    // No address collected here — guests resolve off the payment-currency
    // fallback (itemCurrency is paymentCurrency's default at the pay step).
    const gstRegion = await resolveBuyerGstRegion({
      buyerUser: user,
      paymentCurrency: workshop.currency || "USD",
    });

    const gstInclusive = !!(workshop as any).gstInclusive;
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
      sellerId: workshop.createdBy.toString(),
      userId,
      customerEmail: E,
      customerName: name,
      lineItems: [{
        itemType: "workshop",
        itemId: workshopId,
        itemName,
        itemDescription:
          (sessionOverride as any)?.description ||
          workshop.description ||
          undefined,
        itemImage:
          (sessionOverride as any)?.thumbnail || workshop.thumbnail || undefined,
        quantity: effectiveQuantity,
        unitPrice: lineItemUnitPrice,
        originalCurrency: workshop.currency || "USD",
      }],
      itemCurrency: workshop.currency || "USD",
      isRecurring,
      recurringPeriod: isRecurring ? recurringPeriod : undefined,
      discount: discountAmount,
      tax: invoiceTaxCents || undefined,
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      couponUsageId,
      platformCouponCode,
      referralId: referralId || undefined,
      // `sessionDate` on metadata is the source of truth read by
      // fulfillInvoice's workshop branch. Both Razorpay verify-payment
      // + the wallet pay-with-wallet path go through fulfillInvoice, so
      // both automatically get the right session.
      metadata: {
        type: "workshop_checkout",
        ...(sessionDateParsed
          ? { sessionDate: sessionDateParsed.toISOString() }
          : {}),
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
      isMember: !!isMember,
      isFree: false,
      isSubscription: isRecurring,
      invoiceId: invoice._id.toString(),
      workshop: {
        title: workshop.title,
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
    console.error("Error processing workshop checkout:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process checkout",
      details: error.message,
    });
  }
});

/**
 * POST /checkout/workshop/:workshopId/verify-payment
 * Verify Razorpay payment and register for workshop
 */
router.post("/workshop/:workshopId/verify-payment", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    const schema = z.object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      razorpaySignature: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
      // Per-session workshops: the ISO date string the buyer picked
      // during process-checkout. FE should pass through unchanged from
      // the earlier step. Ignored for `once`-mode workshops.
      sessionDate: z.string().optional(),
    });

    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, userId, couponUsageId, sessionDate } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(workshopId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop or user ID" });
    }

    // Verify signature
    const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    if (!isValid) {
      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }

    // Get workshop
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found" });
    }

    const orgId = workshop.orgId.toString();

    // Parse the sessionDate into a Date. Validation of "is this a real
    // occurrence?" happens inside registerForPaidWorkshop — no need to
    // duplicate here.
    const sessionDateParsed = sessionDate ? new Date(sessionDate) : undefined;

    // Same resolution as process-checkout, so the amount recorded on the
    // registration and the commission base match what the buyer was quoted.
    const { resolveSessionPricing, sessionDayKey } = await import(
      "../utils/sessionOverlay"
    );
    const sessionOverride = sessionDateParsed
      ? await (
          await import("../models/workshopSessionOverride.model")
        ).WorkshopSessionOverride.findOne({
          workshopId: workshop._id,
          sessionDate: sessionDayKey(sessionDateParsed),
        }).lean()
      : null;
    const price = resolveSessionPricing(workshop as any, sessionOverride as any)
      .price;

    // Register for paid workshop
    const registration = await registerForPaidWorkshop(userId, workshopId, orgId, {
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      amount: price,
      sessionDate: sessionDateParsed,
    });

    // Distribute commissions on the PRE-TAX base. Only an inclusive-priced
    // workshop sold to an Indian buyer contains GST in its listed price —
    // that's the one case needing extraction. A foreign buyer paid no GST,
    // so the whole listed price is base.
    if (price > 0) {
      try {
        const { getCommissionBase } = await import("../utils/gstTax");
        const { isBuyerInIndia } = await import("../utils/gstBuyerRegion");
        const commissionBase = getCommissionBase(
          price,
          workshop as any,
          await isBuyerInIndia(userId, workshop.currency || "USD")
        );
        await distributeCommissions({
          orgId: workshop.orgId.toString(),
          sellerId: workshop.createdBy.toString(),
          customerId: userId,
          itemType: "workshop",
          itemId: workshopId,
          itemName: workshop.title,
          saleAmount: commissionBase,
          currency: workshop.currency || "USD",
          paymentId: razorpayPaymentId,
          metadata: {
            source: "workshop_checkout",
            workshopId: workshopId,
            // Present when a per-session buyer went through the marketing
            // checkout URL; used by the founder analytics to attribute
            // commission $ to the specific session.
            ...(sessionDate ? { sessionDate } : {}),
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
    console.error("Error verifying workshop payment:", error);

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
 * POST /checkout/workshop/:workshopId/verify-subscription
 * Verify subscription status after Razorpay redirect
 */
router.post("/workshop/:workshopId/verify-subscription", async (req: Request, res: Response) => {
  try {
    const { workshopId } = req.params;
    const schema = z.object({
      razorpaySubscriptionId: z.string(),
      userId: z.string(),
      couponUsageId: z.string().optional(),
    });

    const { razorpaySubscriptionId, userId, couponUsageId } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(workshopId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid workshop or user ID" });
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

    // Get workshop
    const workshop = await Workshop.findById(workshopId).lean();
    if (!workshop) {
      return res.status(404).json({ success: false, error: "Workshop not found" });
    }

    const orgId = workshop.orgId.toString();
    const price = workshop.price;

    // Register for paid workshop
    const registration = await registerForPaidWorkshop(userId, workshopId, orgId, {
      paymentId: razorpaySubscriptionId,
      orderId: razorpaySubscriptionId,
      amount: price,
    });

    // Distribute commissions
    if (price > 0) {
      try {
        await distributeCommissions({
          orgId: workshop.orgId.toString(),
          sellerId: workshop.createdBy.toString(),
          customerId: userId,
          itemType: "workshop",
          itemId: workshopId,
          itemName: workshop.title,
          saleAmount: price,
          currency: workshop.currency || "USD",
          paymentId: razorpaySubscriptionId,
          isRecurringPayment: false,
          recurringPaymentNumber: 1,
          metadata: {
            source: "workshop_checkout_subscription",
            workshopId: workshopId,
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
    console.error("Error verifying workshop subscription:", error);

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
