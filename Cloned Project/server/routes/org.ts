import { Router, RequestHandler } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { ConferenceRoom } from "../models/conferenceRoom.model";
import { uploadToUploadThing } from "../utils/uploadthing";
import { getCoordinatesFromAddress, resolvePostalCode } from "../utils/geocoding";
import { createStoreForOrganization, updateStore } from "../services/store";
import { generateAffiliateId } from "../utils/affiliateId";
import { notifyNewOfficeCreated } from "../services/bulkEmail";
import { addAivatarCredits, WELCOME_BONUS_CENTS } from "../services/aivatarWallet.service";
import { isValidCategoryName } from "../services/orgCategory";
import {
  assertCanCreateOffice,
  OfficeEligibilityError,
  eligibilityErrorBody,
} from "../services/officeEligibility";
import {
  DEFAULT_WELCOME_TEMPLATE_ID,
  sendWelcomeEmailTest,
} from "../services/welcomeEmail";

const router = Router();

// First-time organization creation.
//
// `requireAuth` was ADDED here: this route previously had no auth at all and
// took `userId` from the BODY, so anyone who knew a user id could mint them an
// org — plus a founder membership, a store, a $25 welcome credit and a
// conference room. That also made a licence gate meaningless, since the
// identity it keys on was caller-supplied.
//
// Safe to add: requireAuth treats `orgId` as optional (middleware/auth.ts), and
// the caller already holds a user-scoped JWT at this point — it only swaps for
// an org-scoped one afterwards, via /auth/token-after-org.
/**
 * Office creation, shared by two routes.
 *
 * `POST /org/create-first-time` (below) mounts it behind the Unilevel Plus
 * licence gate, exactly as before. `POST /platform/offices`
 * (routes/platformOffices.ts) mounts the SAME function behind a platform key
 * and sets `req.graceProgram` first, which is the only thing that skips the
 * gate and stamps the 30-day window on the new org.
 *
 * Shared rather than copied because this handler carries real side effects —
 * the $25 welcome bonus, the default conference room, floors, welcome emails —
 * and a second copy of that is a second thing to keep in step.
 */
export const createFirstTimeOfficeHandler: RequestHandler = async (req, res) => {
  const schema = z.object({
    // Accepted for backward compatibility with existing clients but NEVER
    // trusted — the authenticated subject below is what the org is created
    // for. See the assignment after parse().
    userId: z.string().optional(),
    name: z.string().min(2),
    size: z.string().optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    // Additional fields from API integration guide
    description: z.string().optional(),
    headingText: z.string().optional(),
    subHeadingText: z.string().optional(),
    icon: z.string().optional(),
    coverPhoto: z.string().optional(),
    promoVideoLink: z.string().optional(),
    // Additional branding fields
    colored_logo: z.string().optional(),
    white_logo: z.string().optional(),
    colored_icon: z.string().optional(),
    white_icon: z.string().optional(),
    website_meta_title: z.string().optional(),
    website_meta_description: z.string().optional(),
    // Visibility & Category
    office_public: z.boolean().optional(),
    category: z.string().optional(),
    postalCode: z.string().optional(),
    // Cryptobrand-source flag. When true, the created Organization is
    // stamped with `officeCreatedFromCryptobrand: true` so downstream
    // reports and admin filters can distinguish these from
    // dashboard-created orgs.
    officeCreatedFromCryptobrand: z.boolean().optional(),
    // Founder said "Yes" to whitelabel while creating the office in
    // the HiFi seller app. Persisted as-is; grants no access on its
    // own. When the Cryptosub invoice for this org is paid,
    // fulfillInvoice reads this flag and activates a bundled
    // whitelabel OfficeAddonSubscription (metadata.source =
    // "cryptosub_bundle", so the paid-addon renewal tick skips it).
    whitelabelRequested: z.boolean().optional(),
  });
  const {
    userId: bodyUserId,
    name,
    size,
    location,
    city,
    state,
    country,
    description,
    headingText,
    subHeadingText,
    icon,
    coverPhoto,
    promoVideoLink,
    colored_logo,
    white_logo,
    colored_icon,
    white_icon,
    website_meta_title,
    website_meta_description,
    office_public,
    category,
    postalCode,
    officeCreatedFromCryptobrand,
    whitelabelRequested,
  } = schema.parse(req.body);

  // The AUTHENTICATED subject owns the office, never the body's `userId`.
  // A mismatch means a stale client or a forged request; reject rather than
  // silently creating the org for the wrong person.
  const userId = (req as any).user.userId as string;
  if (bodyUserId && bodyUserId !== userId) {
    return res.status(403).json({
      error: "user_mismatch",
      message: "You can only create an office for your own account.",
    });
  }

  // Gate: an active Unilevel Plus licence is required to create an office.
  // Runs BEFORE the name+location dedupe and before any write, so a rejected
  // request leaves nothing behind.
  //
  // Skipped ONLY when a platform key already authorised a grace office — see
  // routes/platformOffices.ts, which validates the key and checks the user has
  // not already used their one grace. An ordinary request cannot set this, so
  // the gate is unchanged for every existing caller.
  const graceProgram = (req as any).graceProgram as
    | { platformId: any; platformName: string; startedAt: Date; expiresAt: Date; createdByUserId: any }
    | undefined;
  if (!graceProgram) {
    try {
      await assertCanCreateOffice(userId);
    } catch (err: any) {
      if (err instanceof OfficeEligibilityError) {
        return res.status(err.statusCode).json(eligibilityErrorBody(err));
      }
      throw err;
    }
  }

  // Category must exist in the admin-managed taxonomy (empty allowed).
  // Free-text was removed as part of the admin-taxonomy rollout — every
  // string the founder can pick came from GET /org/categories, which
  // reads OrgCategory. Anything else is a stale/hand-crafted request.
  if (category && !(await isValidCategoryName(category))) {
    return res.status(400).json({
      error: `Unknown category "${category}". Pick from the admin-managed list.`,
    });
  }

  console.log("=== CREATE FIRST TIME DEBUG ===");
  console.log("Creating org for user:", userId);
  console.log("Org name:", name);

  // Get coordinates if city, state, and country are provided
  let coordinates = null;
  if (city && state && country) {
    console.log("Getting coordinates for:", { city, state, country });
    coordinates = await getCoordinatesFromAddress({
      city,
      state,
      country,
      streetAddress: location,
    });
    if (coordinates) {
      console.log("Obtained coordinates:", coordinates);
    } else {
      console.log("Failed to get coordinates");
    }
  }

  let org = await Organization.findOne({ name, location });
  let isNewOrg = false;

  if (!org) {
    // The redesigned create form only collects the essentials; missing
    // fields are flipped to sensible defaults here so the org doc never
    // has half-empty branding metadata that breaks downstream consumers.
    const orgData: any = {
      name,
      size,
      location,
      city,
      state,
      country,
      description,
      headingText: headingText ?? "",
      subHeadingText: subHeadingText ?? "",
      icon,
      coverPhoto,
      promoVideoLink,
      colored_logo,
      white_logo,
      colored_icon,
      white_icon,
      website_meta_title,
      website_meta_description,
      // Default new offices to PUBLIC so they're discoverable on the
      // marketplace from day 1. Founders can flip to private later.
      office_public: office_public ?? true,
      category,
      postalCode,
      // Only set true when the caller passed it. Default false.
      officeCreatedFromCryptobrand: officeCreatedFromCryptobrand === true,
      whitelabelRequested: whitelabelRequested === true,
    };

    // Add coordinates if available
    if (coordinates) {
      orgData.latitude = coordinates.latitude;
      orgData.longitude = coordinates.longitude;
    }

    // Stamped at creation, not after: a failure between the two would leave
    // an office that skipped the gate with no clock on it.
    if (graceProgram) {
      (orgData as any).graceProgram = graceProgram;
    }
    org = await Organization.create(orgData);
    isNewOrg = true;
    console.log("Created new org:", org._id);
  } else {
    console.log("Found existing org:", org._id);
  }

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Check if user is already a member of this organization
  const existingMembership = user.organizations?.find(
    (membership: any) => membership.organization.toString() === org.id
  );

  if (!existingMembership) {
    // Add organization membership
    user.organizations = user.organizations || [];
    user.organizations.push({
      organization: org.id,
      role: "founder",
      joinedAt: new Date(),
    });

    // Update legacy fields for backward compatibility
    user.organization = org.id;
    user.role = "founder";

    await user.save();
    console.log("Added user to org:", {
      userId: user._id,
      orgId: org._id,
      role: "founder",
    });
  } else {
    console.log("User already member of org");
  }

  // Create native store for new organizations (replaces EarnGPT)
  if (isNewOrg) {
    try {
      console.log("🚀 Creating native store for organization...");
      await createStoreForOrganization(org._id.toString());
      console.log("✅ Store created successfully for organization:", org._id);

      // Generate affiliate ID for founder if not present
      if (!user.affiliateId) {
        user.affiliateId = await generateAffiliateId();
        await user.save();
        console.log("✅ Generated affiliate ID for founder:", user.affiliateId);
      }

      // Set referredBy to shorupan if not already set
      if (!user.referredBy) {
        const shorupan = await User.findOne({ email: "shorupan@gmail.com" }).lean();
        if (shorupan?._id) {
          user.referredBy = shorupan._id;
          (user as any).referredBySource = "founder_default";
          await user.save();
          console.log("✅ Set founder referredBy to shorupan:", user.referredBy);
        }
      }
    } catch (error) {
      console.log("💥 Store creation failed:", error);
    }

    // Grant $25 welcome bonus to the new aivatar wallet for this org
    try {
      await addAivatarCredits(
        org._id.toString(),
        WELCOME_BONUS_CENTS,
        "Welcome bonus — new office created"
      );
      console.log("✅ Granted welcome bonus to new org:", org._id.toString());
    } catch (err) {
      console.error("💥 Failed to grant welcome bonus:", err);
    }

    // Cryptobrand orgs: eager-mint the founder's INR/ETH/BTC sibling
    // wallets (USD parent is created by whatever commission/credit
    // touches it first, but we do it here up-front so ensureCryptobrand
    // Wallets can set parentWalletId correctly). No-op on non-crypto orgs.
    try {
      const { ensureCryptobrandWallets } = await import(
        "../services/cryptobrandWallets"
      );
      await ensureCryptobrandWallets(user._id.toString(), org._id.toString());
    } catch (err) {
      console.error("💥 Failed to mint cryptobrand wallets:", err);
    }

    // Every office gets ONE free conference room. Materializing the row
    // here (instead of relying on the synthetic `hq-room:<orgId>` fallback
    // in ConferenceRoomPage) keeps the model consistent and gives us a
    // concrete count to gate future paid rooms against. Founders can
    // rename it via the existing PUT /conference-rooms/:id route.
    try {
      await ConferenceRoom.create({
        orgId: org._id,
        name: "Conference Room",
        createdBy: user._id,
        isActive: true,
      });
      console.log("✅ Created default conference room for org:", org._id.toString());
    } catch (err) {
      // Duplicate-name 409s shouldn't happen on first-time create but log
      // and continue so a transient hiccup doesn't break the whole signup.
      console.error("💥 Failed to create default conference room:", err);
    }

    // SUSPENDED (2026-07-03): new-office blast email temporarily disabled.
    // Re-enable by un-commenting once we're ready to resume the platform-wide
    // notification. See also the identical call in the /upsert route below.
    // notifyNewOfficeCreated({
    //   _id: org._id.toString(),
    //   name: org.name,
    //   slug: (org as any).slug,
    //   city: org.city || undefined,
    //   state: org.state || undefined,
    //   country: org.country || undefined,
    //   description: org.description || undefined,
    //   icon: org.icon || undefined,
    // });

    // Fan out the 4-email founder-onboard bundle (referrer + managers +
    // admin + corporate welcome). Fire-and-forget — Promise.allSettled
    // inside; never throws to the caller.
    (async () => {
      try {
        const { notifyFounderOnboarded } = await import(
          "../services/welcomeEmail"
        );
        await notifyFounderOnboarded(user._id.toString(), org._id.toString());
      } catch (err) {
        console.error("[founderOnboard] Dispatch failed:", err);
      }
    })();
  }

  console.log("=== END CREATE FIRST TIME DEBUG ===");

  // Cryptobrand-flagged orgs: mint the two initial invoices — Pro
  // office plan (monthly, $96) + Cryptosub (yearly, $600). Both
  // returned in the response so Cryptobrand's FE can open them
  // together as a "combined first checkout" and the founder pays each
  // via the standard /invoice/<id> pay page.
  //
  // Only fires for newly-created cryptobrand orgs (isNewOrg + flag).
  // Non-cryptobrand creations are untouched — response stays the
  // legacy `{org, membership}` shape.
  let cryptobrandBootstrap: any = null;
  if (isNewOrg && officeCreatedFromCryptobrand === true) {
    try {
      const { bootstrapCryptobrandOfficeInvoices } = await import(
        "../services/cryptobrandOfficeBootstrap"
      );
      cryptobrandBootstrap = await bootstrapCryptobrandOfficeInvoices({
        orgId: org._id.toString(),
        founderUserId: user._id.toString(),
      });
      console.log(
        "✅ Cryptobrand bootstrap minted:",
        cryptobrandBootstrap.officeInvoice.number,
        "+",
        cryptobrandBootstrap.cryptosubInvoice.number,
      );
    } catch (err) {
      console.error("💥 Cryptobrand bootstrap failed:", err);
      // Non-fatal — org is created; admin can retry mint via re-hit
      // of create-first-time (dedup guard reuses in-flight invoices).
    }
  }

  res.json({
    org,
    membership: { role: "founder", organization: org },
    ...(cryptobrandBootstrap ? { cryptobrandBootstrap } : {}),
    ...(graceProgram
      ? {
          grace: {
            startedAt: graceProgram.startedAt,
            expiresAt: graceProgram.expiresAt,
            platform: graceProgram.platformName,
          },
        }
      : {}),
  });
};

router.post("/create-first-time", requireAuth, createFirstTimeOfficeHandler);

router.post("/upsert", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    size: z.string().optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    // Additional fields from API integration guide
    description: z.string().optional(),
    headingText: z.string().optional(),
    subHeadingText: z.string().optional(),
    icon: z.string().optional(),
    coverPhoto: z.string().optional(),
    promoVideoLink: z.string().optional(),
    // Additional branding fields
    colored_logo: z.string().optional(),
    white_logo: z.string().optional(),
    colored_icon: z.string().optional(),
    white_icon: z.string().optional(),
    website_meta_title: z.string().optional(),
    website_meta_description: z.string().optional(),
    // Visibility & Category
    office_public: z.boolean().optional(),
    category: z.string().optional(),
    postalCode: z.string().optional(),
    // Cryptobrand-source flag (see /create-first-time for full docstring).
    officeCreatedFromCryptobrand: z.boolean().optional(),
    // Whitelabel-requested flag (see /create-first-time for full docstring).
    whitelabelRequested: z.boolean().optional(),
  });
  const {
    name,
    size,
    location,
    city,
    state,
    country,
    description,
    headingText,
    subHeadingText,
    icon,
    coverPhoto,
    promoVideoLink,
    colored_logo,
    white_logo,
    colored_icon,
    white_icon,
    website_meta_title,
    website_meta_description,
    office_public,
    category,
    postalCode,
    officeCreatedFromCryptobrand,
    whitelabelRequested,
  } = schema.parse(req.body);
  const me = (req as any).user as { userId: string };

  // Guard against unknown categories — must be one the admin created.
  if (category && !(await isValidCategoryName(category))) {
    return res.status(400).json({
      error: `Unknown category "${category}". Pick from the admin-managed list.`,
    });
  }

  // Get coordinates if city, state, and country are provided
  let coordinates = null;
  if (city && state && country) {
    console.log("Getting coordinates for upsert:", { city, state, country });
    coordinates = await getCoordinatesFromAddress({
      city,
      state,
      country,
      streetAddress: location,
    });
    if (coordinates) {
      console.log("Obtained coordinates for upsert:", coordinates);
    } else {
      console.log("Failed to get coordinates for upsert");
    }
  }

  let org = await Organization.findOne({ name, location });
  let isNewOrg = false;

  if (!org) {
    // Gate ONLY the create branch. This route is an upsert, so an existing
    // office owner without a licence must still be able to edit the org they
    // already have — the decision was "blocked from creating more", not
    // "locked out of what they have".
    //
    // Gating here as well as on create-first-time matters: this endpoint has no
    // frontend caller but is live behind a plain requireAuth, so leaving it
    // ungated would make the whole feature bypassable with one curl.
    try {
      await assertCanCreateOffice(me.userId);
    } catch (err: any) {
      if (err instanceof OfficeEligibilityError) {
        return res.status(err.statusCode).json(eligibilityErrorBody(err));
      }
      throw err;
    }

    const orgData: any = {
      name,
      size,
      location,
      city,
      state,
      country,
      description,
      headingText,
      subHeadingText,
      icon,
      coverPhoto,
      promoVideoLink,
      colored_logo,
      white_logo,
      colored_icon,
      white_icon,
      website_meta_title,
      website_meta_description,
      office_public,
      category,
      postalCode,
      // Only set true when the caller passed it. Default false.
      officeCreatedFromCryptobrand: officeCreatedFromCryptobrand === true,
      whitelabelRequested: whitelabelRequested === true,
    };

    // Add coordinates if available
    if (coordinates) {
      orgData.latitude = coordinates.latitude;
      orgData.longitude = coordinates.longitude;
    }

    org = await Organization.create(orgData);
    isNewOrg = true;
  }

  const user = await User.findById(me.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  // Check if user is already a member of this organization
  const existingMembership = user.organizations?.find(
    (membership: any) => membership.organization.toString() === org.id
  );

  if (!existingMembership) {
    // Add organization membership
    user.organizations = user.organizations || [];
    user.organizations.push({
      organization: org.id,
      role: "founder",
      joinedAt: new Date(),
    });

    // Update legacy fields for backward compatibility
    user.organization = org.id;
    user.role = "admin";

    await user.save();
  }

  // Create native store for new organizations (replaces EarnGPT)
  if (isNewOrg) {
    try {
      console.log("🚀 Creating native store for organization (upsert)...");
      await createStoreForOrganization(org._id.toString());
      console.log("✅ Store created successfully for organization (upsert):", org._id);

      // Generate affiliate ID for founder if not present
      if (!user.affiliateId) {
        user.affiliateId = await generateAffiliateId();
        await user.save();
        console.log("✅ Generated affiliate ID for founder (upsert):", user.affiliateId);
      }

      // Set referredBy to shorupan if not already set
      if (!user.referredBy) {
        const shorupan = await User.findOne({ email: "shorupan@gmail.com" }).lean();
        if (shorupan?._id) {
          user.referredBy = shorupan._id;
          (user as any).referredBySource = "founder_default";
          await user.save();
          console.log("✅ Set founder referredBy to shorupan (upsert):", user.referredBy);
        }
      }
    } catch (error) {
      console.log("💥 Store creation failed (upsert):", error);
    }

    // Grant $25 welcome bonus to the new aivatar wallet for this org
    try {
      await addAivatarCredits(
        org._id.toString(),
        WELCOME_BONUS_CENTS,
        "Welcome bonus — new office created"
      );
      console.log("✅ Granted welcome bonus to new org (upsert):", org._id.toString());
    } catch (err) {
      console.error("💥 Failed to grant welcome bonus (upsert):", err);
    }

    // SUSPENDED (2026-07-03): new-office blast email temporarily disabled.
    // Re-enable by un-commenting once we're ready to resume. Mirrors the
    // matching suspension in /create-first-time above.
    // notifyNewOfficeCreated({
    //   _id: org._id.toString(),
    //   name: org.name,
    //   slug: (org as any).slug,
    //   city: org.city || undefined,
    //   state: org.state || undefined,
    //   country: org.country || undefined,
    //   description: org.description || undefined,
    //   icon: org.icon || undefined,
    // });

    // Fan out the 4-email founder-onboard bundle. Fire-and-forget.
    // Mirrors the identical call in /create-first-time above.
    (async () => {
      try {
        const { notifyFounderOnboarded } = await import(
          "../services/welcomeEmail"
        );
        await notifyFounderOnboarded(user._id.toString(), org._id.toString());
      } catch (err) {
        console.error("[founderOnboard] Dispatch failed:", err);
      }
    })();
  }

  res.json({ org, membership: { role: "founder", organization: org } });
});

// Resolve postal code to city, state, country (public - used during onboarding)
router.get("/resolve-pincode", async (req, res) => {
  try {
    const { pincode, country } = req.query;

    if (!pincode || typeof pincode !== "string" || pincode.trim().length < 3) {
      return res
        .status(400)
        .json({ error: "A valid postal code is required (minimum 3 characters)" });
    }

    // `country` is optional but the profile / org popovers always send it.
    // It used to be dropped here, which left the lookup unbiased — a bare
    // 5-digit code is ambiguous across countries, and the keyless provider
    // can't be queried at all without one.
    const countryHint =
      typeof country === "string" && country.trim() ? country.trim() : undefined;

    const result = await resolvePostalCode(pincode.trim(), countryHint);

    if (!result) {
      return res
        .status(404)
        .json({ error: "Could not resolve postal code. Please check and try again." });
    }

    res.json({
      city: result.city,
      state: result.state,
      country: result.country,
      latitude: result.latitude,
      longitude: result.longitude,
    });
  } catch (error) {
    console.error("Error resolving pincode:", error);
    res.status(500).json({ error: "Failed to resolve postal code" });
  }
});

// Get category suggestions (public — no auth). MUST be registered
// BEFORE `router.get("/:orgId", ...)` below, otherwise Express matches
// this URL against the `:orgId` param first and the request either
// 401s (unauthed caller) or 400s trying to look up an Organization
// with id "categories". Sourced from the admin-managed OrgCategory
// collection (free-text on the FE was removed as part of the admin-
// taxonomy rollout). Response shape kept `{categories: string[]}` so
// existing FE consumers don't need to change how they call this.
router.get("/categories", async (req, res) => {
  try {
    const { listCategoryNames } = await import("../services/orgCategory");
    const categories = await listCategoryNames();
    res.json({ categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// Get organization details
router.get("/:orgId", requireAuth, async (req, res) => {
  const { orgId } = req.params;
  const me = (req as any).user as { userId: string };

  // Verify user is a member of this organization
  const user = await User.findById(me.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const membership = user.organizations?.find(
    (membership: any) => membership.organization.toString() === orgId
  );

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this organization" });
  }

  const org = await Organization.findById(orgId);
  if (!org) {
    return res.status(404).json({ error: "Organization not found" });
  }

  res.json({
    org,
    membership: {
      role: membership.role,
      joinedAt: membership.joinedAt,
    },
  });
});

// Update organization details
router.put("/:orgId", requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2).optional(),
    size: z.string().optional(),
    location: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    description: z.string().optional(),
    headingText: z.string().optional(),
    subHeadingText: z.string().optional(),
    icon: z.string().optional(),
    coverPhoto: z.string().optional(),
    promoVideoLink: z.string().optional(),
    // Additional branding fields
    colored_logo: z.string().optional(),
    white_logo: z.string().optional(),
    colored_icon: z.string().optional(),
    white_icon: z.string().optional(),
    website_meta_title: z.string().optional(),
    website_meta_description: z.string().optional(),
    // Typography (CSS font-family string, empty = app default)
    font: z.string().optional(),
    // Visibility & Category
    office_public: z.boolean().optional(),
    category: z.string().optional(),
    postalCode: z.string().optional(),
    // Whitelabel-requested flag. Founders can toggle post-creation
    // via this endpoint. Actual whitelabel access is still gated on
    // a paid Cryptosub invoice — flipping this true on its own does
    // NOT grant access; it only marks the org as "opted in", and the
    // next fulfilled Cryptosub invoice (renewal or first-time) will
    // upsert the bundled white-label OfficeAddonSubscription. See
    // services/whitelabelAddonPurchase.ts:activateBundledWhitelabelFromCryptosub.
    whitelabelRequested: z.boolean().optional(),
    // Join-welcome email template choice (see organization.model.ts).
    welcomeEmail: z
      .object({
        templateId: z.string().optional(),
        templateName: z.string().optional(),
        templateHtml: z.string().optional(),
      })
      .optional(),
  });

  const { orgId } = req.params;
  const updateData = schema.parse(req.body);
  const me = (req as any).user as { userId: string };

  // Guard against unknown categories — must be one the admin created.
  if (
    updateData.category &&
    !(await isValidCategoryName(updateData.category))
  ) {
    return res.status(400).json({
      error: `Unknown category "${updateData.category}". Pick from the admin-managed list.`,
    });
  }

  // Get coordinates if city, state, and country are provided
  let coordinates = null;
  if (updateData.city && updateData.state && updateData.country) {
    console.log("Getting coordinates for update:", {
      city: updateData.city,
      state: updateData.state,
      country: updateData.country,
    });
    coordinates = await getCoordinatesFromAddress({
      city: updateData.city,
      state: updateData.state,
      country: updateData.country,
      streetAddress: updateData.location,
    });
    if (coordinates) {
      console.log("Obtained coordinates for update:", coordinates);
    } else {
      console.log("Failed to get coordinates for update");
    }
  }

  // Create final update object with coordinates if available
  const finalUpdateData: Record<string, any> = { ...updateData };
  if (coordinates) {
    finalUpdateData.latitude = coordinates.latitude;
    finalUpdateData.longitude = coordinates.longitude;
  }

  // Falling back to the built-in template clears the snapshot rather than
  // leaving a stale one behind — `sendWelcomeEmail` keys off its presence.
  if (updateData.welcomeEmail) {
    const templateId =
      updateData.welcomeEmail.templateId || DEFAULT_WELCOME_TEMPLATE_ID;
    const isDefault = templateId === DEFAULT_WELCOME_TEMPLATE_ID;
    finalUpdateData.welcomeEmail = {
      templateId,
      templateName: updateData.welcomeEmail.templateName || "",
      templateHtml: isDefault
        ? ""
        : updateData.welcomeEmail.templateHtml || "",
      syncedAt: new Date(),
    };
  }

  // Verify user is a member of this organization
  const user = await User.findById(me.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const membership = user.organizations?.find(
    (membership: any) => membership.organization.toString() === orgId
  );

  if (!membership) {
    return res.status(403).json({ error: "Not a member of this organization" });
  }

  // Only founders can update organization details
  if (membership.role !== "founder") {
    return res
      .status(403)
      .json({ error: "Only founders can update organization details" });
  }

  const org = await Organization.findByIdAndUpdate(
    orgId,
    { $set: finalUpdateData },
    { new: true, runValidators: true }
  );

  if (!org) {
    return res.status(404).json({ error: "Organization not found" });
  }

  // Update native store (replaces EarnGPT)
  try {
    if (org.store?.slug) {
      // Store exists, update it
      console.log("🚀 Updating native store...");
      await updateStore(orgId, {
        name: org.name,
        description: org.description || undefined,
        headingText: org.headingText || undefined,
        subHeadingText: org.subHeadingText || undefined,
        icon: org.icon || undefined,
        coverPhoto: org.coverPhoto || undefined,
        promoVideoLink: org.promoVideoLink || undefined,
      });
      console.log("✅ Store updated successfully for organization:", org._id);
    } else {
      // Store doesn't exist, create it
      console.log("⚠️ No native store found, creating new store...");
      await createStoreForOrganization(orgId);
      console.log("✅ Store created successfully for organization:", org._id);
    }
  } catch (error) {
    console.log("💥 Store update/creation failed:", error);
  }

  res.json({ org });
});

// Send the join-welcome email to the founder's own inbox, so they can check the
// real thing before new members start receiving it. `templateHtml` carries the
// snapshot currently on screen in Manage Organization — testing before saving
// is the point, so this deliberately does not read from the saved org first.
router.post("/:orgId/welcome-email/test", requireAuth, async (req, res) => {
  const schema = z.object({ templateHtml: z.string().optional() });
  const { templateHtml } = schema.parse(req.body ?? {});
  const { orgId } = req.params;
  const me = (req as any).user as { userId: string };

  const user = await User.findById(me.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const membership = user.organizations?.find(
    (m: any) => m.organization.toString() === orgId
  );
  if (!membership) {
    return res.status(403).json({ error: "Not a member of this organization" });
  }
  if (membership.role !== "founder") {
    return res
      .status(403)
      .json({ error: "Only founders can send a test welcome email" });
  }

  try {
    const { to } = await sendWelcomeEmailTest(me.userId, orgId, templateHtml);
    res.json({ success: true, to });
  } catch (err: any) {
    console.error("[WelcomeEmail] Test send failed:", err);
    res
      .status(400)
      .json({ error: err?.message || "Failed to send the test email" });
  }
});

// Upload file for organization (icon or cover photo)
router.post("/upload/:orgId", requireAuth, async (req, res) => {
  const { orgId } = req.params;
  const { fileType } = req.body; // 'icon' or 'coverPhoto'
  const me = (req as any).user as { userId: string };

  // Verify user is a founder of this organization
  const user = await User.findById(me.userId);
  if (!user) return res.status(404).json({ error: "User not found" });

  const membership = user.organizations?.find(
    (membership: any) => membership.organization.toString() === orgId
  );

  if (!membership || membership.role !== "founder") {
    return res.status(403).json({ error: "Only founders can upload files" });
  }

  // In a real implementation, you would handle the file upload here
  // For now, we'll just return a placeholder URL
  const placeholderUrl = `https://uploadthing.com/placeholder-${fileType}-${orgId}`;

  // Update organization with the new file URL
  const updateField =
    fileType === "icon"
      ? { icon: placeholderUrl }
      : { coverPhoto: placeholderUrl };

  const org = await Organization.findByIdAndUpdate(
    orgId,
    { $set: updateField },
    { new: true }
  );

  if (!org) {
    return res.status(404).json({ error: "Organization not found" });
  }

  res.json({
    url: placeholderUrl,
    message: `${fileType} uploaded successfully`,
  });
});

// (The /categories handler used to live here — moved above the
// `/:orgId` handler so Express matches this URL literally instead of
// treating "categories" as an `:orgId` param.)

// Update organization branding (primary color)
router.put("/:orgId/branding", requireAuth, async (req, res) => {
  const schema = z.object({
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
      .optional(),
  });

  const { orgId } = req.params;
  const me = (req as any).user as { userId: string };

  try {
    const { primaryColor, secondaryColor } = schema.parse(req.body);

    // Verify user is a member of this organization
    const user = await User.findById(me.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.organizations?.find(
      (membership: any) => membership.organization.toString() === orgId
    );

    if (!membership) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    // Only founders can update branding
    if (membership.role !== "founder") {
      return res
        .status(403)
        .json({ error: "Only founders can update branding settings" });
    }

    const org = await Organization.findByIdAndUpdate(
      orgId,
      // Only set what was sent — a caller updating one colour must not
      // blank the other.
      {
        $set: {
          ...(primaryColor ? { "branding.primaryColor": primaryColor } : {}),
          ...(secondaryColor ? { "branding.secondaryColor": secondaryColor } : {}),
        },
      },
      { new: true, runValidators: true }
    );

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      branding: org.branding,
      message: "Branding updated successfully",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      const issues = error.issues || error.errors || [];
      return res.status(400).json({ error: issues[0]?.message || "Invalid input" });
    }
    console.error("Error updating branding:", error);
    res.status(500).json({ error: "Failed to update branding" });
  }
});

// Get organization branding settings
router.get("/:orgId/branding", requireAuth, async (req, res) => {
  const { orgId } = req.params;
  const me = (req as any).user as { userId: string };

  try {
    // Verify user is a member of this organization
    const user = await User.findById(me.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.organizations?.find(
      (membership: any) => membership.organization.toString() === orgId
    );

    if (!membership) {
      return res.status(403).json({ error: "Not a member of this organization" });
    }

    const org = await Organization.findById(orgId).select("branding").lean();
    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    res.json({
      branding: org.branding || { primaryColor: "#FBD10D" },
    });
  } catch (error) {
    console.error("Error fetching branding:", error);
    res.status(500).json({ error: "Failed to fetch branding" });
  }
});

// Delete organization (founder only) — removes org and cleans up all user memberships
router.delete("/:orgId", requireAuth, async (req, res) => {
  const { orgId } = req.params;
  const me = (req as any).user as { userId: string };

  try {
    const user = await User.findById(me.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    const membership = user.organizations?.find(
      (m: any) => m.organization.toString() === orgId && m.role === "founder"
    );

    if (!membership) {
      return res.status(403).json({ error: "Only the founder can delete this organization" });
    }

    const org = await Organization.findByIdAndDelete(orgId);
    if (!org) return res.status(404).json({ error: "Organization not found" });

    // Remove this org from every user's organizations array
    await User.updateMany(
      { "organizations.organization": orgId },
      { $pull: { organizations: { organization: orgId } } }
    );

    // Note: the org's AivatarWallet (and its transaction history) is
    // intentionally NOT deleted. Orphan wallets surface in the
    // /garage-admin/wallets list with a "deleted" badge and the detail
    // page is gated. We'll decide what to do with them later (refund,
    // archive, donate to GARAGE HQ, etc.).

    res.json({ message: "Organization deleted successfully" });
  } catch (error) {
    console.error("Error deleting organization:", error);
    res.status(500).json({ error: "Failed to delete organization" });
  }
});

export default router;
