// src/routes/profile.ts
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { storablePhone } from "../services/twoFactorSms";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { getCoordinatesFromAddress } from "../utils/geocoding";
import { generateAffiliateId } from "../utils/affiliateId";
import { autoJoinEmployeesChannel, autoJoinDefaultChannel } from "../services/channel";
import { s3Service } from "../services/s3";

const router = Router();

/**
 * POST /profile/presigned-upload
 *
 * Generates a presigned S3 PUT URL for a profile-picture upload from the
 * browser. Replaces the previous UploadThing-based flow — UT was a
 * third-party dependency doing what our own S3 already does, and its
 * default middleware (`return { userId: "anonymous" }`) let unauthenticated
 * callers burn our quota.
 *
 * Flow from the client's POV:
 *   1. FE calls this endpoint with { fileName, contentType, fileSize }
 *   2. BE returns { uploadUrl, publicUrl }
 *   3. FE PUTs the file bytes directly to uploadUrl (bypasses our server)
 *   4. FE saves publicUrl into the user's profileData and calls the
 *      existing profile-update endpoint like before
 *
 * Legacy profile pictures uploaded via UploadThing continue to render
 * unchanged — they're just URLs stored on User.profilePicture. Nothing
 * changes for them until we do the bulk migration later.
 */
router.post("/presigned-upload", requireAuth, async (req, res) => {
  try {
    const me = (req as any).user as { userId: string };
    const schema = z.object({
      fileName: z.string().min(1).max(255),
      contentType: z
        .string()
        .regex(/^image\/(jpe?g|png|webp|gif|heic|heif)$/i, {
          message: "Only JPEG, PNG, WEBP, GIF, HEIC images are allowed",
        }),
      // 2 MB cap matches the previous UploadThing limit. The FE ALSO
      // enforces this so callers see the friendly toast before a request.
      // BE re-check is defensive against a tampered client.
      fileSize: z.number().int().positive().max(2 * 1024 * 1024, {
        message: "File must be 2 MB or smaller",
      }),
    });
    const { fileName, contentType, fileSize } = schema.parse(req.body);
    // fileSize destructured only for validation — we don't need it beyond
    // that; browser sets Content-Length itself when uploading.
    void fileSize;

    // Key layout keeps profile pictures out of the shared `cabinet/`
    // namespace (which is per-org). Per-user, timestamped + random
    // suffixed so replacing a photo doesn't clobber the previous one
    // in S3 — old URL keeps working from any cached page.
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 10);
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
    const s3Key = `profile-pictures/${me.userId}/${timestamp}_${randomId}_${sanitizedFileName}`;

    const uploadUrl = await s3Service.getPresignedUploadUrl(
      s3Key,
      contentType,
      600 // 10-min window; the FE uploads immediately after receiving
    );
    const publicUrl = s3Service.getPublicUrl(s3Key);

    return res.json({ uploadUrl, publicUrl, s3Key, expiresIn: 600 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.issues[0]?.message || "Invalid request" });
    }
    console.error("[profile] presigned-upload error:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Get user profile
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId)
      .select(
        "name email country state city postalCode phone latitude longitude level2Field1 level2Field2 profileComplete profilePicture affiliateId referredBy"
      )
      .populate<{
        referredBy?: {
          _id: mongoose.Types.ObjectId;
          name?: string;
          email?: string;
          profilePicture?: string;
        };
      }>("referredBy", "name email profilePicture");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Populated referrer — surfaced so the ProfilePopover can render the
    // "you were referred by X" affordance without a second round-trip.
    // Null when the user has no referrer (legacy accounts; new signups
    // always get one set at auth time).
    let referredBy = (user as any).referredBy
      ? {
          id: (user as any).referredBy._id.toString(),
          name: (user as any).referredBy.name || "",
          email: (user as any).referredBy.email || "",
          profilePicture: (user as any).referredBy.profilePicture || "",
        }
      : null;

    // BAT246 override: `User.referredBy` is the generic platform referrer
    // (falls back to shorupan@gmail.com for founder-org signups, see the
    // "founder_default" branch below) — for a BAT246 office signup that's
    // NOT who actually invited them, it's whoever `bat246RefUserId` on
    // their Bat246Distributor record says (set from the office-invite
    // link/flag, resolved via resolveBat246Ref). Prefer that here so
    // Complete Profile's "Referred By" card shows the real inviter (e.g.
    // Alan K) instead of the generic platform fallback (Shorupan).
    try {
      const { Bat246Distributor } = await import("../bat246/models/bat246Distributor.model");
      const dist = await Bat246Distributor.findOne({ userId: user._id })
        .select("bat246RefUserId")
        .populate<{
          bat246RefUserId?: { _id: mongoose.Types.ObjectId; name?: string; email?: string; profilePicture?: string };
        }>("bat246RefUserId", "name email profilePicture")
        .lean();
      const ref = (dist as any)?.bat246RefUserId;
      if (ref) {
        referredBy = {
          id: ref._id.toString(),
          name: ref.name || "",
          email: ref.email || "",
          profilePicture: ref.profilePicture || "",
        };
      }
    } catch (bat246Err) {
      console.error("[profile] bat246 referrer override failed:", bat246Err);
    }

    res.json({
      // Mobile (and roam-web) expect customerId on every profile load —
      // the warning "⚠️ No customerId found in user profile" was firing
      // twice per app open. There's no separate customerId field on
      // the user model; the entire backend treats `userId` as the
      // customerId in commerce flows (course.ts, workshop.ts,
      // productCheckout.ts etc. all do `customerId: userId`), so the
      // right move is to alias it here rather than introduce a new
      // field. _id surfaced alongside so clients don't have to keep
      // a separate copy from auth state.
      _id: user._id.toString(),
      customerId: user._id.toString(),
      name: user.name || "",
      email: user.email,
      country: user.country || "",
      state: user.state || "",
      city: user.city || "",
      postalCode: user.postalCode || "",
      phone: user.phone || "",
      latitude: user.latitude || null,
      longitude: user.longitude || null,
      level2Field1: user.level2Field1 || "",
      level2Field2: user.level2Field2 || "",
      profileComplete: user.profileComplete || false,
      profilePicture: user.profilePicture || "",
      affiliateId: user.affiliateId || undefined,
      referredBy,
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user profile
router.put("/", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "User ID is required"),
      name: z.string().min(1, "Name is required"),
      country: z.string().min(1, "Country is required"),
      state: z.string().min(1, "State is required"),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().optional(),
      phone: z
        .string()
        .min(7, "Phone number must be at least 7 digits")
        .regex(/^[\+\-\s]?[0-9][\d\s\-]{0,18}$/, "Invalid phone number format"),
      level2Field1: z.string().optional(),
      level2Field2: z.string().optional(),
      profilePicture: z.string().optional(),
      isFirstTimeUser: z.boolean().optional(),
    });

    const profileData = schema.parse(req.body);

    // Get orgId from query params
    const { orgId } = req.query;

    const user = await User.findById(profileData.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get coordinates if city, state, and country are provided
    let coordinates = null;
    if (profileData.city && profileData.state && profileData.country) {
      console.log("Getting coordinates for user profile:", {
        city: profileData.city,
        state: profileData.state,
        country: profileData.country,
        postalCode: profileData.postalCode,
      });
      coordinates = await getCoordinatesFromAddress({
        city: profileData.city,
        state: profileData.state,
        country: profileData.country,
        postalCode: profileData.postalCode,
      });
      if (coordinates) {
        console.log("Obtained coordinates for user:", coordinates);
      } else {
        console.log("Failed to get coordinates for user");
      }
    }

    // Preserve guest status - guest users ALWAYS remain guests
    const originalGuestStatus = user.guest;
    console.log(`🔍 Profile Update - User: ${user.email}, Original guest status: ${originalGuestStatus}`);

    // Update profile fields
    user.name = profileData.name;
    user.country = profileData.country;
    user.state = profileData.state;
    user.city = profileData.city;
    user.postalCode = profileData.postalCode || "";

    /**
     * `phone` is uniquely indexed, so a number already on another account
     * would throw a raw E11000 here and surface as a 500 on an ordinary
     * profile save.
     *
     * Unlike /auth/phone/verify-otp this flow proves nothing — anyone can type
     * any number into a form — so it must NOT take the number off the other
     * account. Reject with a message that points at the flow which CAN claim
     * it, which is verification.
     */
    // Check and store the SAME value. The form submits "+1 5149659854";
    // if the guard searched for that while the write below stored
    // "+15149659854", a number already on another account would slip past
    // the check and collide silently.
    const incomingPhone = storablePhone(profileData.phone) ?? profileData.phone;
    if (incomingPhone && incomingPhone !== user.phone) {
      const holder: any = await User.findOne({
        phone: incomingPhone,
        _id: { $ne: user._id },
      })
        .select("_id")
        .lean();
      if (holder) {
        return res.status(409).json({
          success: false,
          message:
            "That phone number is already on another account. Verify it with an OTP to move it to this one.",
        });
      }
    }
    // Normalized: the profile form's country picker submits
    // "+1 5149659854", which phone login can never match again.
    user.phone = incomingPhone;
    user.level2Field1 = profileData.level2Field1 || "";
    user.level2Field2 = profileData.level2Field2 || "";
    // Only touch profilePicture when the client explicitly sends the field —
    // a save from a form that omits it must NOT wipe an existing picture.
    // (Sending "" explicitly still clears it, e.g. the "remove photo" action.)
    if (profileData.profilePicture !== undefined) {
      user.profilePicture = profileData.profilePicture;
    }
    user.profileComplete = true;
    // Stamp the FIRST completion only. This handler runs on every profile save,
    // so guarding on `profileComplete` would let anyone restart their 24-hour
    // free-first-month window just by re-saving the form.
    if (!user.profileCompletedAt) {
      user.profileCompletedAt = new Date();
    }

    // Add coordinates if available
    if (coordinates) {
      user.latitude = coordinates.latitude;
      user.longitude = coordinates.longitude;
    }

    // Explicitly restore guest status to ensure it's not modified
    console.log(`🔍 Before restoring guest status - current value: ${user.guest}, original: ${originalGuestStatus}`);
    (user as any).guest = originalGuestStatus;
    console.log(`🔍 After restoring guest status - current value: ${user.guest}`);

    // Generate affiliate ID for first-time founders (replaces EarnGPT admin registration)
    if (profileData.isFirstTimeUser && user?.role !== "stakeholder") {
      try {
        console.log("🚀 Setting up affiliate ID for first-time user:", user.email);

        // Generate affiliate ID if not present
        if (!user.affiliateId) {
          user.affiliateId = await generateAffiliateId();
          console.log("✅ Generated affiliate ID:", user.affiliateId);
        }

        // Set referredBy to shorupan for founders if not already set
        if (!user.referredBy) {
          const shorupan = await User.findOne({ email: "shorupan@gmail.com" }).lean();
          if (shorupan?._id) {
            user.referredBy = shorupan._id;
            (user as any).referredBySource = "founder_default";
            console.log("✅ Set referredBy to shorupan:", user.referredBy);
          }
        }

        user.isFirstTimeUser = true;
      } catch (error) {
        console.log("💥 Affiliate ID generation failed:", error);
      }
    }

    // Check if user is a stakeholder and set up affiliate + channel membership
    // Only process if orgId is provided in query params
    const isStakeholder =
      user.role === "stakeholder" ||
      user.role === "user" ||
      user.organizations?.find(
        (membership: any) =>
          membership.organization.toString() === orgId?.toString() &&
          (membership.role === "stakeholder" || membership.role === "user")
      );

    console.log("isStakeholder", isStakeholder);
    console.log("orgId", orgId);

    if (isStakeholder && orgId && typeof orgId === "string") {
      try {
        console.log("🚀 Setting up affiliate and channel for stakeholder...");

        // Verify user belongs to this organization
        const userOrgMembership = user.organizations?.find(
          (membership: any) =>
            membership.organization.toString() === orgId.toString()
        );

        if (!userOrgMembership) {
          console.log(
            "❌ User is not a member of the specified organization:",
            orgId
          );
        } else {
          // Generate affiliate ID if not present
          if (!user.affiliateId) {
            user.affiliateId = await generateAffiliateId();
            console.log("✅ Generated affiliate ID for stakeholder:", user.affiliateId);
          }

          // Set referredBy to the founder of this organization if not already set
          if (!user.referredBy) {
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
            } else {
              console.log("⚠️ No founder found for organization:", orgId);
            }
          }

          // Auto-join default channel (Members for new orgs, Employees for existing)
          try {
            await autoJoinEmployeesChannel(user._id.toString(), orgId);
            await autoJoinDefaultChannel(user._id.toString(), orgId);
            console.log("✅ Added stakeholder to default channel");
          } catch (channelError) {
            console.log("⚠️ Could not auto-join default channel:", channelError);
          }
        }
      } catch (error) {
        console.log("💥 Stakeholder affiliate setup failed:", error);
      }
    }

    console.log(`🔍 Before final save - guest status: ${user.guest}`);
    await user.save();
    console.log(`🔍 After final save - guest status: ${user.guest}`);

    // Global signup referral bonus — pays the referrer AND this user out of
    // the platform store wallet. Hooked here rather than at account creation
    // because several paths mint shell accounts (checkout, invites, downline
    // enrolment) that never become real users; profile completion is the
    // cheapest available proxy for intent. Idempotent on a unique index, so
    // repeated profile edits pay once.
    void import("../services/referralSignupBonus").then(
      ({ payReferralSignupBonus }) => payReferralSignupBonus(user),
    );

    // India-based users are auto-enrolled into "Your Freedom Webinar".
    // Hooked here rather than at signup because country is almost never
    // known at account creation — the several signup paths (OTP, invite,
    // downline enrolment, checkout shell accounts) set it later, right here.
    // Fire-and-forget: it must never delay or fail a profile save.
    void import("../services/indiaWebinarAutoEnrol").then(
      ({ autoEnrolIndiaWebinar }) => autoEnrolIndiaWebinar(user),
    );

    // The user's support chat (them + upline + garage admins). After the
    // final save on purpose: the referrer defaulting above has to land first
    // so the right upline is added. Idempotent, so every re-save is a cheap
    // membership top-up rather than a second group.
    void import("../services/supportChat").then(({ ensureSupportGroup }) =>
      ensureSupportGroup(user._id),
    );

    res.json({
      message: "Profile updated successfully",
      profileComplete: true,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues,
      });
    }

    console.error("Error updating profile:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if user profile is complete
router.get("/status", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ error: "User ID is required" });
    }

    const user = await User.findById(userId).select("profileComplete");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      profileComplete: user.profileComplete || false,
    });
  } catch (error) {
    console.error("Error checking profile status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update user coordinates specifically
router.put("/coordinates", async (req, res) => {
  try {
    const schema = z.object({
      userId: z.string().min(1, "User ID is required"),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
    });

    const updateData = schema.parse(req.body);

    const user = await User.findById(updateData.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get coordinates if city, state, and country are provided
    let coordinates = null;
    if (updateData.city && updateData.state && updateData.country) {
      console.log("Getting coordinates for user update:", {
        city: updateData.city,
        state: updateData.state,
        country: updateData.country,
      });
      coordinates = await getCoordinatesFromAddress({
        city: updateData.city,
        state: updateData.state,
        country: updateData.country,
        postalCode: user.postalCode,
      });
      if (coordinates) {
        console.log("Obtained coordinates for user update:", coordinates);
      } else {
        console.log("Failed to get coordinates for user update");
      }
    }

    // Create final update object with coordinates if available
    const finalUpdateData = { ...updateData };
    if (coordinates) {
      finalUpdateData.latitude = coordinates.latitude;
      finalUpdateData.longitude = coordinates.longitude;
    }

    // Update user fields
    if (updateData.city) user.city = updateData.city;
    if (updateData.state) user.state = updateData.state;
    if (updateData.country) user.country = updateData.country;
    if (finalUpdateData.latitude) user.latitude = finalUpdateData.latitude;
    if (finalUpdateData.longitude) user.longitude = finalUpdateData.longitude;

    await user.save();

    // Same India auto-enrolment hook as the profile-completion route above —
    // this endpoint can also be the first place we learn the user's country.
    void import("../services/indiaWebinarAutoEnrol").then(
      ({ autoEnrolIndiaWebinar }) => autoEnrolIndiaWebinar(user),
    );

    res.json({
      message: "User coordinates updated successfully",
      latitude: user.latitude,
      longitude: user.longitude,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.issues,
      });
    }

    console.error("Error updating user coordinates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
