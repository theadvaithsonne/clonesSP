// src/routes/serviceCheckout.ts
// Public checkout routes for service opt-in links
import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { Service } from "../models/service.model";
import { ServiceOpt } from "../models/serviceOpt.model";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { Floor } from "../models/floor.model";
import { createOtp, verifyOtp } from "../services/otp";
import { sendMail, EMAIL_FROM_OTP, senderForHost} from "../services/mailer";
import { signJwt } from "../services/jwt";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { ensureUserHasAffiliateId, setReferredByAffiliateId, setReferredBy } from "../services/affiliate";
import { createInvoice, getNextChargeDate } from "../services/invoice";
import { resolveMilestoneTiming } from "../services/service";
import { provisionEngagementRoomAsync } from "../services/taskroomProvision";

const router = Router();

/**
 * GET /checkout/service/:serviceId
 * Fetch service and organization details for checkout page (public)
 */
router.get("/service/:serviceId", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;

    if (!Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: "Invalid service ID" });
    }

    const service = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found or not available" });
    }

    const organization = await Organization.findById(service.organizationId)
      .select("_id name slug icon coverPhoto description")
      .lean();

    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    res.json({
      success: true,
      service: {
        _id: service._id,
        title: service.title,
        slug: service.slug,
        description: service.description,
        longDescription: service.longDescription,
        icon: service.icon,
        iconBgColor: service.iconBgColor,
        coverImage: service.coverImage,
        tags: service.tags,
        features: service.features,
        deliverables: service.deliverables,
        images: service.images,
        videos: service.videos,
        youtubeUrl: service.youtubeUrl,
        category: service.category,
        duration: service.duration,
        pricingModel: service.pricingModel,
        paymentTiming: service.paymentTiming,
        currency: service.currency,
        taxMode: service.taxMode,
        bookingAdvanceFeeEnabled: service.bookingAdvanceFeeEnabled,
        bookingAdvanceFee: service.bookingAdvanceFee,
        cancellationPolicy: service.cancellationPolicy,
        totalPrice: service.totalPrice,
        milestones: service.milestones,
        status: service.status,
        projectsCompleted: service.projectsCompleted,
        activeOptIns: service.activeOptIns,
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
    console.error("Error fetching service for checkout:", error);
    res.status(500).json({ success: false, error: "Failed to fetch service details" });
  }
});

/**
 * POST /checkout/service/:serviceId/init
 * Request OTP for checkout (public)
 */
router.post("/service/:serviceId/init", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const schema = z.object({
      email: z.string().email(),
    });
    const { email } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: "Invalid service ID" });
    }

    // Verify service exists and is active
    const service = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found or not available" });
    }

    const E = email.trim().toLowerCase();
    // Use guest-login purpose (already exists in OTP service)
    const code = await createOtp(E, "guest-login");

    await sendMail(
      E,
      "Your Service Checkout Verification Code",
      `<p>Your verification code for opting into <b>${service.title}</b> is <b>${code}</b> (valid 10 minutes)</p>`,
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
 * POST /checkout/service/:serviceId/verify-otp
 * Verify OTP and check user membership status (public)
 */
router.post("/service/:serviceId/verify-otp", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const schema = z.object({
      email: z.string().email(),
      otp: z.string().length(6),
    });
    const { email, otp } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: "Invalid service ID" });
    }

    const E = email.trim().toLowerCase();
    const verified = await verifyOtp(E, otp, "guest-login");

    if (verified === false) {
      return res.status(400).json({ success: false, error: "Invalid or expired OTP" });
    }

    // Get service to find organization
    const service = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found or not available" });
    }

    // Find or create user
    let user = await User.findOne({ email: E });
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await User.create({
        email: E,
        organizations: [],
      });
      isNewUser = true;
    }

    // Check if user is already a member of the organization
    const isMember = user.organizations?.some(
      (m: any) => m.organization.toString() === service.organizationId.toString()
    );

    // Check if already opted in to this service
    const existingOptIn = await ServiceOpt.findOne({
      serviceId: new Types.ObjectId(serviceId),
      userId: user._id,
      status: { $ne: "cancelled" },
    }).lean();

    // If user is already a member and already opted in, return immediately
    if (existingOptIn) {
      // Generate JWT token for already opted user
      let token: string | undefined;
      if (isMember) {
        token = signJwt({
          userId: user._id.toString(),
          orgId: service.organizationId.toString(),
          name: user.name || "",
          email: user.email,
        });
      }

      return res.json({
        success: true,
        userId: user._id.toString(),
        isMember,
        needsProfile: !user.name,
        alreadyOptedIn: true,
        token,
      });
    }

    res.json({
      success: true,
      userId: user._id.toString(),
      isMember,
      needsProfile: !user.name,
      alreadyOptedIn: false,
    });
  } catch (error: any) {
    console.error("Error verifying checkout OTP:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to verify OTP" });
  }
});

/**
 * POST /checkout/service/:serviceId/update-profile
 * Update user profile (name) before opt-in (public)
 */
router.post("/service/:serviceId/update-profile", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const schema = z.object({
      userId: z.string(),
      name: z.string().min(1).max(100),
    });
    const { userId, name } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(serviceId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Get service to find organization
    const service = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      status: "active",
    }).lean();

    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found or not available" });
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { name: name.trim() },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error("Error updating profile:", error);
    res.status(400).json({ success: false, error: error.message || "Failed to update profile" });
  }
});

/**
 * POST /checkout/service/:serviceId/opt-in
 * Opt-in to a service (public)
 */
router.post("/service/:serviceId/opt-in", async (req: Request, res: Response) => {
  try {
    const { serviceId } = req.params;
    const schema = z.object({
      userId: z.string(),
      referralId: z.string().optional().nullable(),
      couponCode: z.string().optional(),
    });
    const { userId, referralId, couponCode } = schema.parse(req.body);

    if (!Types.ObjectId.isValid(serviceId) || !Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: "Invalid ID" });
    }

    // Get service
    const service = await Service.findOne({
      _id: new Types.ObjectId(serviceId),
      status: "active",
    });

    if (!service) {
      return res.status(404).json({ success: false, error: "Service not found or not available" });
    }

    // Get organization
    const organization = await Organization.findById(service.organizationId);
    if (!organization) {
      return res.status(404).json({ success: false, error: "Organization not found" });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if already opted in
    const existingOptIn = await ServiceOpt.findOne({
      serviceId: new Types.ObjectId(serviceId),
      userId: new Types.ObjectId(userId),
      status: { $ne: "cancelled" },
    });

    if (existingOptIn) {
      return res.status(400).json({ success: false, error: "Already opted in to this service" });
    }

    // Check if user is already a member of the organization
    const isMember = user.organizations?.some(
      (m: any) => m.organization.toString() === service.organizationId.toString()
    );

    // If not a member, add to organization
    if (!isMember) {
      const hadNoOrgs = !user.organizations || user.organizations.length === 0;

      // Find default floor for the organization
      let defaultFloor = await Floor.findOne({
        organizationId: service.organizationId,
        isDefault: true,
      });

      if (!defaultFloor) {
        defaultFloor = await Floor.findOne({
          organizationId: service.organizationId,
        });
      }

      // Add user to organization
      await addUserToGarageHQ(user._id.toString());

      // Must happen BEFORE sendWelcomeEmail so referredBy is set when the upline notification fires
      if (referralId) {
        try {
          const wasSet = await setReferredByAffiliateId(user._id.toString(), referralId);
          if (!wasSet) {
            await setReferredBy(user._id.toString());
          }
        } catch (err) {
          console.error("Error setting referral:", err);
        }
      } else {
        await setReferredBy(user._id.toString());
      }

      // Ensure user has affiliate ID
      await ensureUserHasAffiliateId(user._id.toString());

      // Send welcome email for new users (fire-and-forget)
      if (hadNoOrgs) {
        sendWelcomeEmail(user._id.toString(), service.organizationId.toString()).catch((err) =>
          console.error("[WelcomeEmail] Failed:", err)
        );
      }
    }

    // Create service opt-in
    const milestonesProgress = service.milestones.map((m: any) => {
      const timing = resolveMilestoneTiming(service.paymentTiming, m.paymentTiming);
      const billable = timing !== null && m.paymentAmount > 0;
      return {
        milestoneId: m._id,
        order: m.order,
        title: m.title,
        status: "pending",
        paymentAmount: m.paymentAmount,
        currency: m.currency,
        paymentTiming: timing || undefined,
        paymentRequired: billable,
        paymentStatus: billable ? "pending" : "not_required",
      };
    });

    const optIn = await ServiceOpt.create({
      serviceId: service._id,
      userId: user._id,
      organizationId: service.organizationId,
      status: "opted",
      optedAt: new Date(),
      totalAmount: service.totalPrice,
      amountPaid: 0,
      amountPending: service.paymentTiming === "free" ? 0 : service.totalPrice,
      currency: service.currency,
      milestonesProgress,
      completedMilestones: 0,
      totalMilestones: service.milestones.length,
      progressPercentage: 0,
    });

    // Update service active opt-ins count
    await Service.findByIdAndUpdate(service._id, {
      $inc: { activeOptIns: 1 },
    });

    // Provision the client's engagement room out of band — never on the
    // checkout round-trip, and never able to fail the purchase.
    provisionEngagementRoomAsync(optIn._id);

    // Route coupon: platform coupons for service products run through createInvoice
    const { routeCoupon } = await import("../utils/couponRouting");
    const routedCoupon = await routeCoupon(couponCode);
    const platformCouponCode = routedCoupon.isPlatform ? couponCode : undefined;

    // Create invoice for the payment flow
    const invoice = await createInvoice({
      organizationId: service.organizationId.toString(),
      sellerId: service.createdBy.toString(),
      userId: user._id.toString(),
      customerEmail: user.email || "",
      customerName: user.name || undefined,
      lineItems: [{
        itemType: "service",
        itemId: serviceId,
        itemName: service.title,
        itemDescription: service.description || undefined,
        itemImage: service.coverImage || undefined,
        quantity: 1,
        unitPrice: Math.round((service.totalPrice || 0) * 100),
        originalCurrency: service.currency || "USD",
      }],
      itemCurrency: service.currency || "USD",
      discount: 0,
      platformCouponCode,
      referralId: referralId || undefined,
      metadata: { type: "service_checkout" },
    });
    const invoiceId = invoice._id.toString();

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: service.organizationId.toString(),
      name: user.name || "",
      email: user.email,
    });

    res.json({
      success: true,
      optIn: {
        _id: optIn._id,
        serviceId: optIn.serviceId,
        userId: optIn.userId,
        status: optIn.status,
        progressPercentage: optIn.progressPercentage,
      },
      invoiceId,
      token,
    });
  } catch (error: any) {
    console.error("Error opting in to service:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to opt-in" });
  }
});

export default router;
