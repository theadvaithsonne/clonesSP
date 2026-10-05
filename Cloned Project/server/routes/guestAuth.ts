// src/routes/guestAuth.ts
import { Router } from "express";
import { storablePhone } from "../services/twoFactorSms";
import { z } from "zod";
import { createOtp, verifyOtp } from "../services/otp";
import {
  sendMail,
  guestRequestEmailTemplate,
  EMAIL_FROM_OTP,
  EMAIL_FROM_RESEND_OTP,
  EMAIL_FROM_NOTIFICATION,
  senderForHost
} from "../services/mailer";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { syncNewEnrollee } from "../services/downlineTree";
import { JoinRequest } from "../models/joinRequest.model";
import { Notification } from "../models/notification.model";
import { Product } from "../models/product.model";
import { Course } from "../models/course.model";
import { Workshop } from "../models/workshop.model";
import { Channel } from "../models/channel.model";
import { Floor } from "../models/floor.model";
import { Service } from "../models/service.model";
import { Types } from "mongoose";
import { generateSlug } from "../models/organization.model";
import { signJwt } from "../services/jwt";
import { generateAffiliateId } from "../utils/affiliateId";
import { addUserToGarageHQ } from "../services/init";
import { sendWelcomeEmail } from "../services/welcomeEmail";
import { autoJoinEmployeesChannel, autoJoinDefaultChannel } from "../services/channel";
import { getActiveOfficeSubscription } from "../services/officeSubscription";
import { IOfficePlan } from "../models/officePlan.model";

const router = Router();

// Guest limit for Basic plan (₹799) - hardcoded for now
const GUEST_LIMIT = 25;

/**
 * Get the count of guest members in an organization
 */
async function getGuestCount(orgId: string): Promise<number> {
  const count = await User.countDocuments({
    "organizations.organization": new Types.ObjectId(orgId),
    "organizations.guest": true,
  });
  return count;
}

/**
 * Check if organization is on Basic plan
 * Returns true if on Basic plan, false otherwise (Pro, no subscription, or parent org)
 */
async function isOnBasicPlan(orgId: string): Promise<boolean> {
  // Check if organization is a parent (GARAGE HQ) - no limit applies
  const org = await Organization.findById(orgId).select("parent").lean();
  if (org?.parent === true) {
    return false;
  }

  // Get active subscription
  const subscription = await getActiveOfficeSubscription(orgId);
  if (!subscription) {
    // No subscription means no limit (they haven't paid yet, or trial)
    return false;
  }

  const plan = subscription.planId as unknown as IOfficePlan;
  return plan?.slug === "basic";
}

/**
 * Check if organization has reached guest limit
 * Returns true if limit reached, false if can still add guests
 * Only applies to organizations on the Basic plan
 */
async function isGuestLimitReached(orgId: string): Promise<boolean> {
  // Only check limit for Basic plan subscribers
  const onBasicPlan = await isOnBasicPlan(orgId);
  if (!onBasicPlan) {
    return false; // Pro plan or no subscription = unlimited guests
  }

  const guestCount = await getGuestCount(orgId);
  return guestCount >= GUEST_LIMIT;
}

/**
 * POST /guest-auth/request-otp
 * Request OTP for guest login (public endpoint)
 */
router.post("/request-otp", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      isResend: z.boolean().optional().default(false),
    });
    const { email, isResend } = schema.parse(req.body);

    const code = await createOtp(email, "guest-login");
    await sendMail(
      email,
      "Your Guest Login OTP",
      `<p>Your OTP for guest login is <b>${code}</b> (valid 10 minutes)</p>`,
      `Your OTP is ${code}`,
      await senderForHost(req, isResend ? EMAIL_FROM_RESEND_OTP : EMAIL_FROM_OTP)
    );

    res.json({ ok: true });
  } catch (error: any) {
    console.error("Error in guest request-otp:", error);
    res.status(400).json({ error: error.message || "Failed to send OTP" });
  }
});

/**
 * POST /guest-auth/check-email
 * Report whether an account already exists for this email (public endpoint).
 * Used by the storefront office-join modal to stop existing users from going
 * through the new-signup OTP flow — they should log in instead. Uses the same
 * trim/lowercase normalization as verify-otp so the answer matches what a
 * subsequent verify would find.
 */
router.post("/check-email", async (req, res) => {
  try {
    const schema = z.object({ email: z.string().email() });
    const { email } = schema.parse(req.body);
    const exists = await User.exists({ email: email.trim().toLowerCase() });
    res.json({ ok: true, exists: !!exists });
  } catch (error: any) {
    console.error("Error in guest check-email:", error);
    res.status(400).json({ error: error.message || "Failed to check email" });
  }
});

/**
 * POST /guest-auth/verify-otp
 * Verify OTP and create/find guest user (public endpoint)
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      code: z.string().length(6),
      referralCode: z.string().optional(), // This is the affiliateId (e.g., "aff_t1qrarx")
    });
    const { email, code, referralCode } = schema.parse(req.body);

    const E = email.trim().toLowerCase();
    console.log("=== GUEST VERIFY OTP DEBUG ===");
    console.log("Email:", E);
    console.log("Referral Code (affiliateId):", referralCode);

    const verified = await verifyOtp(E, code, "guest-login");

    if (!verified && verified !== "") {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // If referralCode provided, look up the referrer by their affiliateId
    let referrerId: string | undefined;
    if (referralCode) {
      const referrer = await User.findOne({ affiliateId: referralCode });
      if (referrer) {
        referrerId = referrer._id.toString();
        console.log("🎯 Found referrer:", referrer.email, "with ID:", referrerId);
      } else {
        console.log("⚠️ Referrer not found for affiliateId:", referralCode);
      }
    }

    // Find or create guest user
    let user = await User.findOne({ email: E });
    if (!user) {
      // Create new user with referredBy if referrer was found
      const userData: any = {
        email: E,
        guest: true,
        isVerified: true,
      };
      if (referrerId) {
        userData.referredBy = referrerId;
        userData.referredBySource = "affiliate";
        console.log("🎯 Setting referredBy for new guest user:", referrerId);
      }
      user = await User.create(userData);
      // Slot the new guest into the denormalized downline tree. Same
      // hook as the main OTP signup path — see routes/auth.ts.
      if (referrerId) void syncNewEnrollee(user._id.toString());
      console.log(`✅ Created new guest user: ${E}`);
    } else {
      // Existing user — route through the upgrade-aware attribution service
      // so a founder_default placeholder gets overridden by a real affiliate
      // click, and the affiliate gets an "onboarded X" notification email.
      // No-op if the user already has a real (source=affiliate) attribution.
      if (referralCode) {
        try {
          const { setReferredByAffiliateId } = await import(
            "../services/affiliate"
          );
          await setReferredByAffiliateId(user._id.toString(), referralCode);
        } catch (attrErr) {
          console.error(
            "🎯 Attribution upgrade failed for existing guest user:",
            attrErr,
          );
        }
      }
      if (!user.guest) {
        // Existing non-guest user trying to use guest login
        // Mark them as guest for this flow
        user.guest = true;
        console.log(`🔄 Marked existing user as guest: ${E}`);
      }
      await user.save();
    }

    res.json({
      ok: true,
      userId: user.id,
      email: user.email,
      guest: true,
      // Additional user info for pre-filling forms
      name: user.name || null,
      phone: user.phone || null,
      profileComplete: user.profileComplete || false,
      hasOrganizations: (user.organizations?.length || 0) > 0,
    });
  } catch (error: any) {
    console.error("Error in guest verify-otp:", error);
    res.status(400).json({ error: error.message || "Failed to verify OTP" });
  }
});

/**
 * GET /guest-auth/available-hqs
 * Get all organizations (excluding parent HQ) with request status for the guest user
 * Excludes organizations that the user is already a member of
 */
router.get("/available-hqs", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string(),
    });
    const { userId } = schema.parse(req.query);

    // Fetch the user to check their existing organizations
    const user = await User.findById(userId).select("organizations").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get the list of organization IDs the user is already a member of
    const userOrgIds = new Set(
      (user.organizations || []).map((m: any) => String(m.organization))
    );

    // Fetch all organizations
    const organizations = await Organization.find({})
      .select(
        "_id name slug size location city state country latitude longitude description headingText subHeadingText icon coverPhoto promoVideoLink createdAt"
      )
      .lean();

    // Fetch all join requests for this user
    const requests = await JoinRequest.find({ guestUserId: userId }).lean();
    const requestMap = new Map();
    requests.forEach((req) => {
      requestMap.set(String(req.orgId), req.status);
    });

    // Filter out organizations the user is already a member of
    // and combine remaining orgs with request status
    const orgsWithStatus = organizations
      .filter((org) => !userOrgIds.has(String(org._id)))
      .map((org) => ({
        ...org,
        requestStatus: requestMap.get(String(org._id)) || null,
      }));

    res.json({
      ok: true,
      organizations: orgsWithStatus,
    });
  } catch (error: any) {
    console.error("Error in available-hqs:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch organizations" });
  }
});

/**
 * GET /guest-auth/hq-by-slug/:slug
 * Get organization details by slug (public endpoint)
 * Optionally returns request status if userId is provided
 */
router.get("/hq-by-slug/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { userId } = req.query;

    // Find organization by slug, or generate slug from name to find it
    let organization = await Organization.findOne({ slug })
      .select(
        "_id name slug size location city state country latitude longitude description headingText subHeadingText icon coverPhoto promoVideoLink office_public font createdAt branding.primaryColor"
      )
      .lean();

    // If not found by slug, try to find by generated slug from name
    if (!organization) {
      const allOrgs = await Organization.find({})
        .select(
          "_id name slug size location city state country latitude longitude description headingText subHeadingText icon coverPhoto promoVideoLink office_public font createdAt branding.primaryColor"
        )
        .lean();

      organization =
        allOrgs.find((org) => {
          const generatedSlug = generateSlug(org.name);
          return generatedSlug === slug;
        }) || null;
    }

    if (!organization) {
      return res.status(404).json({ ok: false, error: "Organization not found" });
    }

    // Get request status if userId is provided
    let requestStatus = null;
    let isMember = false;

    if (userId && typeof userId === "string") {
      // Check if user is already a member
      const user = await User.findById(userId).select("organizations").lean();
      if (user) {
        isMember = (user.organizations || []).some(
          (m: any) => String(m.organization) === String(organization!._id)
        );

        // Get join request status
        const joinRequest = await JoinRequest.findOne({
          guestUserId: userId,
          orgId: organization._id,
        }).lean();

        requestStatus = joinRequest?.status || null;
      }
    }

    res.json({
      ok: true,
      organization: {
        ...organization,
        requestStatus,
        isMember,
      },
    });
  } catch (error: any) {
    console.error("Error in hq-by-slug:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch organization" });
  }
});

/**
 * GET /guest-auth/hq-items/:slug
 * Get all sellable items (products, courses, workshops) for an organization (public endpoint)
 * Only returns published/active items
 */
router.get("/hq-items/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Find organization by slug
    let organization = await Organization.findOne({ slug })
      .select("_id name")
      .lean();

    // If not found by slug, try to find by generated slug from name
    if (!organization) {
      const allOrgs = await Organization.find({})
        .select("_id name slug")
        .lean();

      organization =
        allOrgs.find((org) => {
          const generatedSlug = generateSlug(org.name);
          return generatedSlug === slug;
        }) || null;
    }

    if (!organization) {
      return res.status(404).json({ ok: false, error: "Organization not found" });
    }

    const orgId = organization._id;

    // Fetch all sellable items and members in parallel
    const [products, courses, workshops, channels, services, members] = await Promise.all([
      // Products - only active
      Product.find({
        organizationId: orgId,
        status: "active",
      })
        .select(
          "_id name slug description price currency images isDigital deliveryMethod isSubscription subscriptionPeriod"
        )
        .lean(),

      // Courses - only published
      Course.find({
        organizationId: orgId,
        status: "published",
      })
        .select(
          "_id title description coverImage isPaid isFree price currency totalDuration totalChapters enrolledStudents isSubscription subscriptionPeriod"
        )
        .lean(),

      // Workshops - only active
      // Include: upcoming one-time workshops OR active recurring workshops
      Workshop.find({
        orgId: orgId,
        isActive: true,
        $or: [
          { date: { $gte: new Date() } }, // Upcoming one-time workshops
          { isRecurring: true, isRecurrenceActive: true }, // Active recurring workshops
        ],
      })
        .select(
          "_id title description thumbnail date startTime endTime timezone isFree price currency maxParticipants isRecurring isSubscription subscriptionPeriod rating ratingCount aboutText learningPoints agenda bonuses reviews faqs requirements whatsIncluded hostRating hostStudents hostWebinars hostExperience"
        )
        .sort({ date: 1 })
        .lean(),

      // Channels - only active
      Channel.find({
        storeId: orgId,
        isActive: true,
      })
        .select(
          "_id title description price currency coverImage isFree isSubscription subscriptionPeriod rating ratingCount aboutText whatsIncluded benefits reviews faqs"
        )
        .lean(),

      // Services - only active
      Service.find({
        organizationId: orgId,
        status: "active",
      })
        .select(
          "_id title slug description icon iconBgColor coverImage images videos youtubeUrl category totalPrice currency duration milestones projectsCompleted pricingModel hourlyConfig paymentTiming taxMode bookingAdvanceFeeEnabled bookingAdvanceFee cancellationPolicy tags features"
        )
        .lean(),

      // Members - users who belong to this organization
      User.find({
        "organizations.organization": orgId,
      })
        .select("_id name email profilePicture city state country organizations")
        .lean(),
    ]);

    // Map members to include role from their org membership
    const mappedMembers = members.map((member: any) => {
      const membership = member.organizations?.find(
        (org: any) => org.organization?.toString() === orgId.toString()
      );
      return {
        _id: member._id,
        name: member.name,
        email: member.email,
        profilePicture: member.profilePicture,
        city: member.city,
        state: member.state,
        country: member.country,
        role: membership?.role || "stakeholder",
      };
    });

    res.json({
      ok: true,
      products,
      courses,
      workshops,
      channels,
      services,
      members: mappedMembers,
    });
  } catch (error: any) {
    console.error("Error in hq-items:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch items" });
  }
});

/**
 * POST /guest-auth/request-join
 * Create a join request for an organization
 */
router.post("/request-join", async (req, res) => {
  try {
    const schema = z.object({
      guestUserId: z.string(),
      orgId: z.string(),
      name: z.string().optional(),
      message: z.string().optional(),
    });
    const { guestUserId, orgId, name, message } = schema.parse(req.body);

    // Verify user exists
    const user = await User.findById(guestUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    // Note: Removed guest-only restriction - any authenticated user can request to join
    // an HQ they're not a member of. The membership check below prevents duplicates.

    // Verify organization exists
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check guest limit (25 guests for Basic plan)
    if (await isGuestLimitReached(orgId)) {
      return res.status(403).json({
        error: "This organization has reached its guest limit and is not accepting new members.",
        code: "GUEST_LIMIT_REACHED",
      });
    }

    // Check if user is already a member
    const existingMembership = user.organizations?.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (existingMembership) {
      return res
        .status(400)
        .json({ error: "You are already a member of this organization" });
    }

    // Create or update join request (idempotent)
    let joinRequest = await JoinRequest.findOne({ guestUserId, orgId });
    if (joinRequest) {
      // If rejected, allow re-requesting by resetting to pending
      if (joinRequest.status === "rejected") {
        joinRequest.status = "pending";
        joinRequest.message = message;
        if (name) joinRequest.name = name;
        await joinRequest.save();
        console.log(`🔄 Reset rejected request to pending: ${user.email} → ${org.name}`);
      } else {
        // Request already exists and is pending or approved
        return res.json({
          ok: true,
          requestId: joinRequest.id,
          status: joinRequest.status,
          message: "Request already exists",
        });
      }
    } else {
      // Create new request
      joinRequest = await JoinRequest.create({
        guestUserId,
        orgId,
        email: user.email,
        name: name || user.name,
        message: message || "",
        status: "pending",
      });
      console.log(`✅ Created join request: ${user.email} → ${org.name}`);
    }

    // Send confirmation email to guest
    try {
      const { subject, html } = guestRequestEmailTemplate(
        user.email!,
        org.name
      );
      await sendMail(user.email!, subject, html, undefined, await senderForHost(req));
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
      // Don't fail the request if email fails
    }

    // Notify all founders of this organization
    try {
      const founders = await User.find({
        "organizations.organization": orgId,
        "organizations.role": "founder",
      });

      for (const founder of founders) {
        await Notification.create({
          userId: founder._id,
          orgId: new Types.ObjectId(orgId),
          type: "join_request",
          priority: "normal",
          title: "New Join Request",
          message: `${user.email} ${name ? `(${name})` : ""} has requested to join ${org.name}`,
          data: {
            joinRequestId: joinRequest.id,
            guestUserId: user.id,
            guestEmail: user.email,
            guestName: name || user.name || "",
            requestMessage: message || "",
          },
        });
      }
      console.log(`📬 Notified ${founders.length} founders about join request`);
    } catch (notifError) {
      console.error("Failed to send notifications to founders:", notifError);
      // Don't fail the request if notifications fail
    }

    res.json({
      ok: true,
      requestId: joinRequest.id,
      status: joinRequest.status,
    });
  } catch (error: any) {
    console.error("Error in request-join:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to create join request" });
  }
});

/**
 * POST /guest-auth/public-join
 * Directly join a public organization (no approval needed)
 * Only works for organizations with office_public: true
 */
router.post("/public-join", async (req, res) => {
  try {
    const schema = z.object({
      guestUserId: z.string(),
      orgId: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      // Optional affiliate code from the URL the user arrived through
      // (e.g. ?ref=aff_xxx). Preferred over the founder-default fallback
      // below, and can UPGRADE an existing founder_default attribution
      // to a real affiliate one.
      referralCode: z.string().optional(),
    });
    const { guestUserId, orgId, name, phone, referralCode } = schema.parse(
      req.body,
    );

    // Verify user exists
    let user = await User.findById(guestUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify organization exists and is public
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (!org.office_public) {
      return res.status(403).json({
        error: "This organization is not public. Please request to join instead.",
      });
    }

    // Check guest limit (25 guests for Basic plan)
    if (await isGuestLimitReached(orgId)) {
      return res.status(403).json({
        error: "This organization has reached its guest limit. Please contact the organization admin.",
        code: "GUEST_LIMIT_REACHED",
      });
    }

    // Check if user is already a member
    const existingMembership = user.organizations?.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (existingMembership) {
      // Already a member - generate token and return
      const token = signJwt({
        userId: user._id.toString(),
        orgId: orgId,
        role: "stakeholder",
        name: user.name,
        email: user.email,
        guest: user.guest,
      });
      return res.json({
        ok: true,
        alreadyMember: true,
        token,
        user: { id: user._id.toString(), email: user.email },
        needsProfileCompletion: !user.profileComplete,
      });
    }

    // Update user name if provided and not already set
    if (name && !user.name) {
      user.name = name.trim();
    }

    // Update phone number if provided
    if (phone) {
      user.phone = storablePhone(phone) ?? phone;
    }

    // Ensure user has affiliate ID
    if (!user.affiliateId) {
      user.affiliateId = await generateAffiliateId();
    }

    // Attribution — affiliate code (if provided) takes priority. If no code
    // was supplied OR the code doesn't resolve, fall through to the
    // founder default. The affiliate-code path also UPGRADES an existing
    // founder_default attribution, so users first attributed to the org
    // founder (by a prior interaction) can still be credited to the real
    // referrer when their signup completes here.
    let attributedViaAffiliate = false;
    if (referralCode?.trim()) {
      try {
        const { setReferredByAffiliateId } = await import(
          "../services/affiliate"
        );
        attributedViaAffiliate = await setReferredByAffiliateId(
          user._id.toString(),
          referralCode.trim(),
          orgId,
        );
      } catch (attrErr) {
        console.error(
          "⚠️ public-join affiliate attribution failed:",
          attrErr,
        );
      }
    }

    if (!attributedViaAffiliate && !user.referredBy) {
      const founderUser = await User.findOne({
        $or: [
          { organization: orgId, role: { $in: ["admin", "founder"] } },
          {
            "organizations.organization": orgId,
            "organizations.role": "founder",
          },
        ],
      })
        .select("_id")
        .lean();

      if (founderUser?._id) {
        user.referredBy = founderUser._id;
        (user as any).referredBySource = "founder_default";
        console.log("✅ Set referredBy to founder:", user.referredBy);
      }
    }

    // Get the first floor of the organization (by level)
    const firstFloor = await Floor.findOne({ orgId: new Types.ObjectId(orgId) })
      .sort({ level: 1 })
      .lean();

    // Add organization membership
    user.organizations = user.organizations || [];
    user.organizations.push({
      organization: new Types.ObjectId(orgId),
      role: "stakeholder",
      floorId: firstFloor?._id,
      joinedAt: new Date(),
      guest: true, // Mark as guest member
    });

    // Update legacy fields for backward compatibility
    user.organization = new Types.ObjectId(orgId);
    (user as any).role = "stakeholder";
    user.isVerified = true;

    await user.save();
    console.log(`✅ User ${user.email} directly joined public org: ${org.name}`);

    // Cryptobrand orgs: eager-mint the new member's currency wallets.
    // No-op on non-cryptobrand orgs. Fire-and-forget.
    try {
      const { ensureCryptobrandWalletsFireAndForget } = await import(
        "../services/cryptobrandWallets"
      );
      ensureCryptobrandWalletsFireAndForget(
        user._id.toString(),
        orgId,
        "guest-signup",
      );
    } catch (err) {
      console.error("[guestAuth] cryptobrand wallet ensure failed:", err);
    }

    // Add user to GARAGE HQ if not already a member
    try {
      const garageHQ = await Organization.findOne({ parent: true });
      if (garageHQ) {
        const hasGarageHQMembership = user.organizations?.some(
          (m: any) => m.organization.toString() === garageHQ._id.toString()
        );
        if (!hasGarageHQMembership) {
          await addUserToGarageHQ(user._id.toString());
          console.log(`✅ Added user to GARAGE HQ: ${user.email}`);
          // Send welcome email for the org they just joined (fire-and-forget)
          sendWelcomeEmail(user._id.toString(), orgId).catch((err) =>
            console.error("[WelcomeEmail] Failed:", err)
          );
        }
      }
    } catch (hqError) {
      console.error("⚠️ Could not add user to GARAGE HQ:", hqError);
    }

    // Auto-join default channel (Members for new orgs, Employees for existing)
    try {
      await autoJoinEmployeesChannel(user._id.toString(), orgId);
      await autoJoinDefaultChannel(user._id.toString(), orgId);
      console.log("✅ Added user to default channel");
    } catch (channelError) {
      console.log("⚠️ Could not auto-join default channel:", channelError);
    }

    // Generate JWT token
    const token = signJwt({
      userId: user._id.toString(),
      orgId: orgId,
      role: "stakeholder",
      name: user.name,
      email: user.email,
      guest: user.guest,
    });

    res.json({
      ok: true,
      token,
      user: { id: user._id.toString(), email: user.email, name: user.name },
      needsProfileCompletion: !user.profileComplete,
    });
  } catch (error: any) {
    console.error("Error in public-join:", error);
    res.status(400).json({ error: error.message || "Failed to join organization" });
  }
});

/**
 * GET /guest-auth/guest-limit-status
 * Check if organization has reached its guest limit (public endpoint)
 * Returns guest count and whether limit is reached
 * Only applies to Basic plan subscribers - Pro plan has unlimited guests
 * Query params: orgId
 */
router.get("/guest-limit-status", async (req, res) => {
  try {
    const { orgId } = req.query;

    if (!orgId || typeof orgId !== "string") {
      return res.status(400).json({ error: "orgId query parameter is required" });
    }

    const guestCount = await getGuestCount(orgId);
    const onBasicPlan = await isOnBasicPlan(orgId);

    // Only enforce limit for Basic plan
    const limitReached = onBasicPlan && guestCount >= GUEST_LIMIT;

    res.json({
      ok: true,
      guestCount,
      guestLimit: onBasicPlan ? GUEST_LIMIT : null, // null = unlimited
      limitReached,
      planType: onBasicPlan ? "basic" : "pro", // For frontend display
    });
  } catch (error: any) {
    console.error("Error in guest-limit-status:", error);
    res.status(400).json({ error: error.message || "Failed to check guest limit" });
  }
});

/**
 * POST /guest-auth/private-join
 * Join a private (non-parent) organization by:
 * 1. Adding user to GARAGE HQ (parent)
 * 2. Creating join request for the private org
 * 3. Returning JWT token for GARAGE HQ access
 */
router.post("/private-join", async (req, res) => {
  try {
    const schema = z.object({
      guestUserId: z.string(),
      orgId: z.string(),
      name: z.string().optional(),
      phone: z.string().optional(),
      message: z.string().optional(),
    });
    const { guestUserId, orgId, name, phone, message } = schema.parse(req.body);

    // Verify user exists
    const user = await User.findById(guestUserId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify organization exists and is NOT public (private org)
    const org = await Organization.findById(orgId);
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    // Check if user is already a member of the target org
    const existingMembership = user.organizations?.find(
      (m: any) => m.organization.toString() === orgId
    );
    if (existingMembership) {
      return res.status(400).json({ error: "You are already a member of this organization" });
    }

    // Update user name if provided and not already set
    if (name && !user.name) {
      user.name = name.trim();
    }

    // Update phone number if provided
    if (phone) {
      user.phone = storablePhone(phone) ?? phone;
    }

    // Ensure user has affiliate ID
    if (!user.affiliateId) {
      user.affiliateId = await generateAffiliateId();
    }

    await user.save();

    // Find GARAGE HQ (parent: true)
    const garageHQ = await Organization.findOne({ parent: true });
    if (!garageHQ) {
      return res.status(500).json({ error: "GARAGE HQ not found" });
    }

    // Add user to GARAGE HQ if not already a member
    const hasGarageHQMembership = user.organizations?.some(
      (m: any) => m.organization.toString() === garageHQ._id.toString()
    );
    if (!hasGarageHQMembership) {
      await addUserToGarageHQ(user._id.toString());
      console.log(`✅ Added user ${user.email} to GARAGE HQ`);
      // Send welcome email (parent HQ only, since private org is pending approval)
      sendWelcomeEmail(user._id.toString(), null).catch((err) =>
        console.error("[WelcomeEmail] Failed:", err)
      );
    }

    // Create or update join request for the private org
    let joinRequest = await JoinRequest.findOne({ guestUserId, orgId });
    if (joinRequest) {
      // If rejected, allow re-requesting by resetting to pending
      if (joinRequest.status === "rejected") {
        joinRequest.status = "pending";
        joinRequest.message = message;
        if (name) joinRequest.name = name;
        await joinRequest.save();
        console.log(`🔄 Reset rejected request to pending: ${user.email} → ${org.name}`);
      }
      // Already exists and pending/approved - use existing
    } else {
      // Create new request
      joinRequest = await JoinRequest.create({
        guestUserId: user._id,
        orgId,
        email: user.email,
        name: name || user.name,
        message: message || "",
        status: "pending",
      });
      console.log(`✅ Created join request: ${user.email} → ${org.name}`);
    }

    // Send confirmation email to user
    try {
      const { subject, html } = guestRequestEmailTemplate(user.email!, org.name);
      await sendMail(user.email!, subject, html, undefined, await senderForHost(req));
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    // Notify all founders of the private organization
    try {
      const founders = await User.find({
        "organizations.organization": orgId,
        "organizations.role": "founder",
      });

      for (const founder of founders) {
        await Notification.create({
          userId: founder._id,
          orgId: new Types.ObjectId(orgId),
          type: "join_request",
          priority: "normal",
          title: "New Join Request",
          message: `${user.email} ${name ? `(${name})` : ""} has requested to join ${org.name}`,
          data: {
            joinRequestId: joinRequest.id,
            guestUserId: user.id,
            guestEmail: user.email,
            guestName: name || user.name || "",
            requestMessage: message || "",
          },
        });
      }
      console.log(`📬 Notified ${founders.length} founders about join request`);
    } catch (notifError) {
      console.error("Failed to send notifications to founders:", notifError);
    }

    // Generate JWT token for GARAGE HQ
    const token = signJwt({
      userId: user._id.toString(),
      orgId: garageHQ._id.toString(),
      role: "stakeholder",
      name: user.name,
      email: user.email,
      guest: user.guest,
    });

    res.json({
      ok: true,
      token,
      garageHQId: garageHQ._id.toString(),
      garageHQName: garageHQ.name,
      requestId: joinRequest.id,
      status: joinRequest.status,
      needsProfileCompletion: !user.profileComplete,
    });
  } catch (error: any) {
    console.error("Error in private-join:", error);
    res.status(400).json({ error: error.message || "Failed to join organization" });
  }
});

/**
 * GET /guest-auth/my-requests
 * Get all join requests for a user
 * Supports both query param userId and JWT token auth
 */
router.get("/my-requests", async (req, res) => {
  try {
    let userId = req.query.userId as string;

    // If no userId in query, try to get from JWT token
    if (!userId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          const payload = JSON.parse(
            Buffer.from(token.split(".")[1], "base64").toString()
          );
          userId = payload.userId;
        } catch {
          // Invalid token format, continue without userId
        }
      }
    }

    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const requests = await JoinRequest.find({ guestUserId: userId })
      .populate("orgId", "name icon location city state country")
      .populate("respondedBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const formattedRequests = requests.map((req) => ({
      id: req._id,
      organization: req.orgId,
      status: req.status,
      message: req.message,
      createdAt: req.createdAt,
      respondedAt: req.respondedAt,
      respondedBy: req.respondedBy,
    }));

    res.json({
      ok: true,
      requests: formattedRequests,
    });
  } catch (error: any) {
    console.error("Error in my-requests:", error);
    res
      .status(400)
      .json({ error: error.message || "Failed to fetch requests" });
  }
});

export default router;
