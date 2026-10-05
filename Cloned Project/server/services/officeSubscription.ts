import mongoose, { Types } from "mongoose";
import { refreshTypeFlags } from "./downlineTree";
import {
  OfficePlan,
  IOfficePlan,
  OFFICE_PLANS_CONFIG,
  OFFICE_PLAN_IDS,
  OFFICE_COMMISSION_STRUCTURE,
  calculateTaxAmounts,
  extractBaseFromTotal,
  GST_CONFIG,
} from "../models/officePlan.model";
import {
  OfficeSubscription,
  IOfficeSubscription,
  OfficeSubscriptionStatus,
} from "../models/officeSubscription.model";
import {
  OfficeSubscriptionPayment,
  IOfficeSubscriptionPayment,
} from "../models/officeSubscriptionPayment.model";
import {
  createPlan as createRazorpayPlan,
  createSubscription as createRazorpaySubscription,
  fetchSubscription as fetchRazorpaySubscription,
  cancelSubscription as cancelRazorpaySubscription,
  createCustomer as createRazorpayCustomer,
  RazorpaySubscription,
} from "./razorpay";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { getSocketInstance } from "./socket";
import { creditAffiliateOrPlatform } from "./wallet";
import { convertInrToUsd } from "../utils/exchangeRate";

// Platform configuration
const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951"; // The Network Economy

// Helper to safely emit socket events
function emitToUser(userId: string | Types.ObjectId, event: string, data: any) {
  const io = getSocketInstance();
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

/**
 * Convert Unix timestamp to Date
 */
function unixToDate(timestamp: number | null): Date | undefined {
  if (!timestamp) return undefined;
  return new Date(timestamp * 1000);
}

// ============ Plan Initialization ============

/**
 * Initialize office plans in database and Razorpay
 * Run this once on startup or via admin endpoint
 *
 * IMPORTANT: This function now updates existing plans in-place to preserve
 * subscription references. It only creates new Razorpay plans if:
 * 1. No plan exists in DB
 * 2. Plan exists but has no/invalid Razorpay ID
 *
 * Existing plans with valid Razorpay IDs are updated with new GST fields
 * but keep their original IDs intact.
 *
 * GST CAVEAT: the `amount` sent to Razorpay below is base + 18% GST — an
 * ITEM-level figure shared by every org subscribing to this plan. Real
 * billing does NOT flow through these plans: office invoices come from our
 * own recurring cascade (verified in prod — 73 renewals from our cron, 0 from
 * Razorpay; every Razorpay subscription record is `created`/`cancelled`/
 * `halted`). GST applicability is decided PER ORG at the invoice layer in
 * routes/officeCheckout.ts, gated on the organization's country.
 *
 * If Razorpay subscriptions are ever switched on for office, these plans MUST
 * be split per tax region (IN / INTL) first — one shared plan cannot charge
 * an Indian org and a foreign org different amounts.
 */
export async function initializeOfficePlans(): Promise<IOfficePlan[]> {
  const plans: IOfficePlan[] = [];
  const { fetchPlan } = await import("./razorpay");

  for (const [slug, config] of Object.entries(OFFICE_PLANS_CONFIG)) {
    // Check if plan already exists in DB
    // Use lean() to get raw document without Mongoose defaults applied
    const planDoc = await OfficePlan.findOne({ slug }).lean();
    let plan = planDoc ? await OfficePlan.findOne({ slug }) : null;

    // Free plans (Starter): amount is 0, so Razorpay wouldn't accept a plan
    // for it — and we never route billing through Razorpay anyway. Just
    // upsert the DB row and continue.
    if ((config as any).amount === 0) {
      const desiredFields: any = {
        name: config.name,
        description: config.description,
        amount: config.amount,
        currency: config.currency,
        period: config.period,
        interval: config.interval,
        features: config.features,
        canInviteStakeholders: config.canInviteStakeholders,
        maxStakeholders: config.maxStakeholders,
        isActive: (config as any).isActive ?? true,
        isDefault: config.isDefault,
        taxRate: config.taxRate,
        taxInclusive: config.taxInclusive,
        sacCode: config.sacCode,
        platformFeeOverride: (config as any).platformFeeOverride ?? null,
      };
      if (plan) {
        await OfficePlan.updateOne({ _id: plan._id }, { $set: desiredFields });
        const refreshed = await OfficePlan.findOne({ slug });
        plans.push(refreshed!);
      } else {
        const fixedPlanId =
          OFFICE_PLAN_IDS[slug as keyof typeof OFFICE_PLAN_IDS];
        if (!fixedPlanId) {
          console.error(
            `[OfficePlan] No fixed ID defined for free plan "${slug}"`,
          );
          continue;
        }
        const created = await OfficePlan.create({
          _id: new Types.ObjectId(fixedPlanId),
          slug,
          ...desiredFields,
        });
        plans.push(created);
      }
      console.log(`[OfficePlan] Free plan "${slug}" upserted (no Razorpay)`);
      continue;
    }

    if (plan && plan.razorpayPlanId) {
      // Verify the Razorpay plan ID is valid
      try {
        const existingRazorpayPlan = await fetchPlan(plan.razorpayPlanId);

        // Check if amount changed - if so, we MUST create a new Razorpay plan
        // (Razorpay plans cannot be modified once created)
        const amountChanged = plan.amount !== config.amount;

        if (amountChanged) {
          console.log(
            `[OfficePlan] Plan "${slug}" amount changed (${plan.amount} -> ${config.amount}), creating new Razorpay plan...`,
          );

          // Calculate total amount (base + GST) to pass to Razorpay
          const { totalAmount } = calculateTaxAmounts(
            config.amount,
            config.taxRate,
          );

          const razorpayPlan = await createRazorpayPlan({
            period: "monthly",
            interval: 1,
            item: {
              name: `Office ${config.name} Plan`,
              amount: totalAmount, // Total amount including GST
              currency: config.currency,
              description: config.description,
              tax_inclusive: true, // We're passing the total, so it's "inclusive"
              sac_code: config.sacCode,
            },
            notes: {
              planType: "office",
              slug,
              baseAmount: String(config.amount),
              taxRate: String(config.taxRate),
              sacCode: config.sacCode,
            },
          });

          // Update plan with new Razorpay ID and all fields
          await OfficePlan.updateOne(
            { _id: plan._id },
            {
              $set: {
                razorpayPlanId: razorpayPlan.id,
                amount: config.amount,
                // Kept in step with `amount` — the two together define the
                // price, and writing one without the other is how the stored
                // price silently stops meaning what the config says.
                currency: config.currency,
                taxRate: config.taxRate,
                taxInclusive: config.taxInclusive,
                sacCode: config.sacCode,
                name: config.name,
                description: config.description,
                features: config.features,
                canInviteStakeholders: config.canInviteStakeholders,
                maxStakeholders: config.maxStakeholders,
                isDefault: config.isDefault,
              },
            },
          );

          console.log(
            `[OfficePlan] Plan "${slug}" updated with new Razorpay ID: ${razorpayPlan.id}`,
          );
          const updatedPlan = await OfficePlan.findOne({ slug });
          plans.push(updatedPlan!);
          continue;
        }

        // Amount unchanged - just update other fields in-place (preserves _id for existing subscribers)
        // Check raw document (planDoc) to see if fields actually exist in DB
        const updateFields: any = {};
        if (!("taxRate" in planDoc!) || planDoc!.taxRate !== config.taxRate)
          updateFields.taxRate = config.taxRate;
        if (
          !("taxInclusive" in planDoc!) ||
          planDoc!.taxInclusive !== config.taxInclusive
        )
          updateFields.taxInclusive = config.taxInclusive;
        if (!("sacCode" in planDoc!) || planDoc!.sacCode !== config.sacCode)
          updateFields.sacCode = config.sacCode;

        // CURRENCY — must be synced, and its absence here was a live billing
        // bug. The Pro plan's stored currency had drifted to "INR" while the
        // config said "USD". Invoices copy `plan.currency` verbatim into
        // `itemCurrency`, so a $96 plan was rendering as 9600 INR smallest
        // units = ₹96 + ₹17.28 GST ≈ $1.19 instead of $113.28. Neither branch
        // of this initializer wrote `currency`, so a restart could never heal
        // it. Logged loudly because a silent currency correction is exactly
        // the kind of change someone needs to see.
        if (plan.currency !== config.currency) {
          updateFields.currency = config.currency;
          console.warn(
            `[OfficePlan] Plan "${slug}" CURRENCY DRIFT: db="${plan.currency}" → config="${config.currency}". ` +
              `Invoices inherit this, so the stored value was mis-denominating every invoice for this plan.`,
          );
        }

        // Also update other fields that might have changed
        if (plan.name !== config.name) updateFields.name = config.name;
        if (plan.description !== config.description)
          updateFields.description = config.description;
        if (JSON.stringify(plan.features) !== JSON.stringify(config.features))
          updateFields.features = config.features;
        if (plan.canInviteStakeholders !== config.canInviteStakeholders)
          updateFields.canInviteStakeholders = config.canInviteStakeholders;
        if (plan.maxStakeholders !== config.maxStakeholders)
          updateFields.maxStakeholders = config.maxStakeholders;
        if (plan.isDefault !== config.isDefault)
          updateFields.isDefault = config.isDefault;

        if (Object.keys(updateFields).length > 0) {
          await OfficePlan.updateOne({ _id: plan._id }, { $set: updateFields });
          console.log(
            `[OfficePlan] Plan "${slug}" updated with new fields:`,
            Object.keys(updateFields).join(", "),
          );
          // Refetch the updated plan
          plan = await OfficePlan.findOne({ slug });
        } else {
          console.log(
            `[OfficePlan] Plan "${slug}" verified, no updates needed (Razorpay ID: ${plan.razorpayPlanId})`,
          );
        }

        plans.push(plan!);
        continue;
      } catch (error: any) {
        // Razorpay plan doesn't exist - need to create a new one
        // But DON'T delete the DB plan - update it with new Razorpay ID instead
        console.log(
          `[OfficePlan] Plan "${slug}" has invalid Razorpay ID, creating new Razorpay plan...`,
        );

        // Calculate total amount (base + GST) to pass to Razorpay
        const { totalAmount: totalAmountForPlan } = calculateTaxAmounts(
          config.amount,
          config.taxRate,
        );

        const razorpayPlan = await createRazorpayPlan({
          period: "monthly",
          interval: 1,
          item: {
            name: `Office ${config.name} Plan`,
            amount: totalAmountForPlan, // Total amount including GST
            currency: config.currency,
            description: config.description,
            tax_inclusive: true, // We're passing the total, so it's "inclusive"
            sac_code: config.sacCode,
          },
          notes: {
            planType: "office",
            slug,
            baseAmount: String(config.amount),
            taxRate: String(config.taxRate),
            sacCode: config.sacCode,
          },
        });

        // Update existing plan with new Razorpay ID and GST fields
        await OfficePlan.updateOne(
          { _id: plan!._id },
          {
            $set: {
              razorpayPlanId: razorpayPlan.id,
              taxRate: config.taxRate,
              taxInclusive: config.taxInclusive,
              sacCode: config.sacCode,
              name: config.name,
              description: config.description,
              amount: config.amount,
              features: config.features,
              canInviteStakeholders: config.canInviteStakeholders,
              maxStakeholders: config.maxStakeholders,
              isDefault: config.isDefault,
            },
          },
        );

        console.log(
          `[OfficePlan] Plan "${slug}" updated with new Razorpay ID: ${razorpayPlan.id}`,
        );
        const updatedPlan = await OfficePlan.findOne({ slug });
        plans.push(updatedPlan!);
        continue;
      }
    }

    // Plan exists but has no razorpayPlanId - create Razorpay plan and update
    if (plan && !plan.razorpayPlanId) {
      console.log(
        `[OfficePlan] Plan "${slug}" missing Razorpay ID, creating...`,
      );

      // Calculate total amount (base + GST) to pass to Razorpay
      const { totalAmount: totalAmountMissing } = calculateTaxAmounts(
        config.amount,
        config.taxRate,
      );

      const razorpayPlan = await createRazorpayPlan({
        period: "monthly",
        interval: 1,
        item: {
          name: `Office ${config.name} Plan`,
          amount: totalAmountMissing, // Total amount including GST
          currency: config.currency,
          description: config.description,
          tax_inclusive: true, // We're passing the total, so it's "inclusive"
          sac_code: config.sacCode,
        },
        notes: {
          planType: "office",
          slug,
          baseAmount: String(config.amount),
          taxRate: String(config.taxRate),
          sacCode: config.sacCode,
        },
      });

      // Update existing plan
      await OfficePlan.updateOne(
        { _id: plan._id },
        {
          $set: {
            razorpayPlanId: razorpayPlan.id,
            taxRate: config.taxRate,
            taxInclusive: config.taxInclusive,
            sacCode: config.sacCode,
          },
        },
      );

      console.log(
        `[OfficePlan] Plan "${slug}" updated with Razorpay ID: ${razorpayPlan.id}`,
      );
      const updatedPlan = await OfficePlan.findOne({ slug });
      plans.push(updatedPlan!);
      continue;
    }

    // No plan exists at all - create from scratch using FIXED _id
    // The fixed _id ensures subscriptions always reference the same plan document
    const fixedPlanId = OFFICE_PLAN_IDS[slug as keyof typeof OFFICE_PLAN_IDS];
    if (!fixedPlanId) {
      console.error(`[OfficePlan] No fixed ID defined for plan "${slug}"`);
      continue;
    }

    console.log(
      `[OfficePlan] Creating new "${slug}" plan with fixed _id: ${fixedPlanId}...`,
    );

    // Calculate total amount (base + GST) to pass to Razorpay
    const { totalAmount: totalAmountNew } = calculateTaxAmounts(
      config.amount,
      config.taxRate,
    );

    const razorpayPlan = await createRazorpayPlan({
      period: "monthly",
      interval: 1,
      item: {
        name: `Office ${config.name} Plan`,
        amount: totalAmountNew, // Total amount including GST
        currency: config.currency,
        description: config.description,
        tax_inclusive: true, // We're passing the total, so it's "inclusive"
        sac_code: config.sacCode,
      },
      notes: {
        planType: "office",
        slug,
        baseAmount: String(config.amount),
        taxRate: String(config.taxRate),
        sacCode: config.sacCode,
      },
    });

    // Create plan in database with FIXED _id
    // This ensures even if the plan was deleted, it will be recreated with the same _id
    // and all existing subscriptions will continue to reference it correctly
    const { _id: _configId, ...configWithoutId } = config;
    const newPlan = await OfficePlan.create({
      _id: new Types.ObjectId(fixedPlanId),
      ...configWithoutId,
      razorpayPlanId: razorpayPlan.id,
    });

    console.log(
      `[OfficePlan] Created plan "${slug}" with fixed _id: ${fixedPlanId}, Razorpay ID: ${razorpayPlan.id}`,
    );

    plans.push(newPlan);
  }

  // Fix any legacy orphaned subscriptions that reference non-existent plan IDs
  // With fixed plan IDs, this should rarely be needed, but kept as a safety net
  await fixOrphanedSubscriptions(plans);

  return plans;
}

/**
 * Fix orphaned subscriptions that reference non-existent plan IDs
 * With fixed plan IDs (OFFICE_PLAN_IDS), this should rarely be needed.
 * We determine the correct plan by fetching the subscription from Razorpay
 * and checking the planSlug in the notes.
 */
async function fixOrphanedSubscriptions(plans: IOfficePlan[]): Promise<void> {
  // Get all valid plan IDs
  const validPlanIds = plans.map((p) => p._id.toString());

  // Create a map of slug to plan for quick lookup
  const slugToPlan = new Map<string, IOfficePlan>();
  for (const plan of plans) {
    slugToPlan.set(plan.slug, plan);
  }

  // Find subscriptions with invalid planIds
  const allSubs = await OfficeSubscription.find({});
  const orphanedSubs = allSubs.filter((sub) => {
    const planIdStr = sub.planId?.toString();
    return !planIdStr || !validPlanIds.includes(planIdStr);
  });

  if (orphanedSubs.length === 0) {
    return;
  }

  console.log(
    `[OfficePlan] Found ${orphanedSubs.length} orphaned subscriptions to fix`,
  );

  const { fetchSubscription, fetchPlan } = await import("./razorpay");

  for (const sub of orphanedSubs) {
    console.log(
      `[OfficePlan] Fixing orphaned subscription ${sub._id} with invalid planId: ${sub.planId}`,
    );

    try {
      // Skip if no Razorpay subscription ID (e.g., trial subscriptions)
      if (!sub.razorpaySubscriptionId) {
        console.log(
          `[OfficePlan] Skipping trial subscription ${sub._id} (no Razorpay ID)`,
        );
        continue;
      }
      // Try to get plan slug from Razorpay subscription notes
      const razorpaySub = await fetchSubscription(sub.razorpaySubscriptionId);
      const planSlug = razorpaySub.notes?.planSlug;

      if (planSlug && slugToPlan.has(planSlug)) {
        const correctPlan = slugToPlan.get(planSlug)!;
        await OfficeSubscription.updateOne(
          { _id: sub._id },
          { $set: { planId: correctPlan._id } },
        );
        console.log(
          `[OfficePlan] Fixed subscription ${sub._id}: planSlug "${planSlug}" -> planId ${correctPlan._id}`,
        );
        continue;
      }

      // Fallback: determine plan by Razorpay plan amount
      try {
        const razorpayPlan = await fetchPlan(sub.razorpayPlanId);
        const amount = razorpayPlan.item?.amount;

        // Basic: ~94282 paise (799 + GST), Pro: ~707882 paise (5999 + GST)
        const isBasic = amount && amount < 200000;
        const correctPlan = isBasic
          ? slugToPlan.get("basic")
          : slugToPlan.get("pro");

        if (correctPlan) {
          await OfficeSubscription.updateOne(
            { _id: sub._id },
            { $set: { planId: correctPlan._id } },
          );
          console.log(
            `[OfficePlan] Fixed subscription ${sub._id} by amount: ${amount} paise -> ${correctPlan.slug}`,
          );
        }
      } catch (planError) {
        console.error(
          `[OfficePlan] Could not fetch Razorpay plan ${sub.razorpayPlanId}:`,
          planError,
        );
      }
    } catch (error) {
      console.error(
        `[OfficePlan] Could not fix orphaned subscription ${sub._id}:`,
        error,
      );
    }
  }
}

/**
 * Get all active office plans
 */
export async function getOfficePlans(): Promise<IOfficePlan[]> {
  return OfficePlan.find({ isActive: true }).sort({ amount: 1 }).lean();
}

/**
 * Get office plan by slug
 */
export async function getOfficePlanBySlug(
  slug: string,
): Promise<IOfficePlan | null> {
  return OfficePlan.findOne({ slug, isActive: true }).lean();
}

/**
 * Get office plan by ID
 */
export async function getOfficePlan(
  planId: string,
): Promise<IOfficePlan | null> {
  return OfficePlan.findById(planId).lean();
}

// ============ Subscription Management ============

export interface CreateOfficeSubscriptionInput {
  orgId: string;
  founderId: string;
  planSlug: string;
  founderEmail?: string;
  founderName?: string;
  founderPhone?: string;
  gstin?: string; // Optional GSTIN for B2B customers
  offerId?: string; // Optional Razorpay offer ID for coupon discounts
}

/**
 * Create an office subscription for an organization
 */
export async function createOfficeSubscription(
  input: CreateOfficeSubscriptionInput,
): Promise<IOfficeSubscription> {
  const {
    orgId,
    founderId,
    planSlug,
    founderEmail,
    founderName,
    founderPhone,
    gstin,
    offerId,
  } = input;

  // Get plan
  const plan = await OfficePlan.findOne({ slug: planSlug, isActive: true });
  if (!plan) {
    throw new Error(`Office plan "${planSlug}" not found`);
  }

  if (!plan.razorpayPlanId) {
    throw new Error(`Office plan "${planSlug}" is not configured in Razorpay`);
  }

  // Check if org already has a subscription
  const existingSubscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["created", "authenticated", "active", "pending"] },
  });

  if (existingSubscription) {
    throw new Error("Organization already has an active subscription");
  }

  // Create Razorpay customer if GSTIN is provided (for B2B invoicing)
  let razorpayCustomerId: string | undefined;
  if (gstin && founderEmail && founderName) {
    try {
      const customer = await createRazorpayCustomer({
        name: founderName,
        email: founderEmail,
        contact: founderPhone,
        gstin: gstin,
        notes: {
          orgId,
          founderId,
          type: "office_subscription_customer",
        },
      });
      razorpayCustomerId = customer.id;
      console.log(
        `[OfficeSubscription] Created Razorpay customer with GSTIN: ${customer.id}`,
      );
    } catch (error: any) {
      console.error(
        `[OfficeSubscription] Failed to create Razorpay customer:`,
        error.message,
      );
      // Continue without customer - GSTIN won't appear on invoice but subscription will work
    }
  }

  // Create subscription in Razorpay
  // Default to 120 billing cycles (~10 years for monthly)
  const razorpaySubscriptionOptions: any = {
    plan_id: plan.razorpayPlanId,
    total_count: 120,
    customer_notify: 1,
    customer_id: razorpayCustomerId, // Link customer for GSTIN on invoices
    notes: {
      type: "office_subscription",
      orgId,
      founderId,
      planId: plan._id.toString(),
      planSlug: plan.slug,
      founderEmail: founderEmail || "",
      founderName: founderName || "",
      gstin: gstin || "",
    },
  };

  // Add offer_id if coupon has razorpayOfferId
  if (offerId) {
    razorpaySubscriptionOptions.offer_id = offerId;
    console.log(`[OfficeSubscription] Applying Razorpay offer: ${offerId}`);
  }

  const razorpaySubscription = await createRazorpaySubscription(
    razorpaySubscriptionOptions,
  );

  // Create subscription in database
  const subscription = await OfficeSubscription.create({
    orgId: new Types.ObjectId(orgId),
    founderId: new Types.ObjectId(founderId),
    planId: plan._id,
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayPlanId: plan.razorpayPlanId,
    razorpayCustomerId:
      razorpaySubscription.customer_id || razorpayCustomerId || undefined,
    status: "created",
    totalCount: razorpaySubscription.total_count || 120,
    paidCount: 0,
    remainingCount: razorpaySubscription.remaining_count || 120,
    shortUrl: razorpaySubscription.short_url,
  });

  console.log(
    `[OfficeSubscription] Created subscription for org ${orgId}: ${subscription._id}`,
  );
  console.log(
    `[OfficeSubscription] Razorpay subscription ID stored: ${razorpaySubscription.id}`,
  );

  return subscription;
}

/**
 * Get office subscription for an organization
 */
export async function getOfficeSubscription(
  orgId: string,
): Promise<IOfficeSubscription | null> {
  return OfficeSubscription.findOne({ orgId: new Types.ObjectId(orgId) })
    .sort({ createdAt: -1 })
    .populate("planId")
    .lean();
}

/**
 * Get active office subscription for an organization
 */
export async function getActiveOfficeSubscription(
  orgId: string,
): Promise<IOfficeSubscription | null> {
  return OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["active", "authenticated"] },
  })
    .populate("planId")
    .lean();
}

// TEST ONLY: Hardcoded org IDs that bypass subscription lock (remove after testing)
const TEST_UNLOCKED_ORG_IDS: string[] = [
  // Add org IDs here for testing, e.g.:
  // "6789abcdef123456789abcde",
  "695e5f7d9865791391907dc5",
  "695e5e2798657913919071c6",
  "694aac9cac3487774ba44f56",
  "68f8ee6dc45c74df03e69211",
  "6911ecf63ad48c7107083a01",
  "694b880b9c04ef8140f371f4",
  "696fabf1ac60472c2c0278bf",
  "695e5e2798657913919071c6",
];

// ─── Pro-plan grace period ─────────────────────────────────────────────
//
// When a founder is on Pro and misses a payment (either the initial
// invoice on first subscribe, or a renewal), we DO NOT lock the office
// immediately. They get GRACE_PERIOD_DAYS days from the anchor date
// (last paid cycle end, or sub creation date for first-buy) to pay
// before the office auto-downgrades to Starter.
//
// The grace anchor is deterministic and stateless — no metadata to
// stash, no rehydration bugs. Both the unlock check and the daily
// cron read it the same way.
export const OFFICE_GRACE_PERIOD_DAYS = 7;
const OFFICE_GRACE_PERIOD_MS = OFFICE_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export interface OfficeGraceState {
  /** True when the sub is currently within its Pro grace window. */
  inGrace: boolean;
  /**
   * True when the grace window has passed and the sub is eligible for
   * auto-downgrade to Starter.
   */
  lapsed: boolean;
  /** When grace ends (or ended). Null when grace doesn't apply. */
  graceEndsAt: Date | null;
  /**
   * "Anchor" the grace window is measured from — last paid cycle end
   * for renewals, sub createdAt for a never-paid first-buy.
   */
  anchor: Date | null;
  /** Days until grace ends (0 when in the past). */
  daysRemaining: number;
}

/**
 * Derive the current grace state for a Pro subscription. Returns a
 * "no grace applies" shape for Starter/trial/etc.
 *
 * Rules:
 *  - Only Pro subs are eligible for the grace treatment (Starter is
 *    free — there's nothing to be unpaid for).
 *  - Anchor = subscription.currentEnd (paid cycle ends) OR createdAt
 *    (never had a paid cycle) — whichever is present.
 *  - Sub statuses that qualify as "unpaid/at-risk": created (never paid
 *    initial), pending, halted, expired, authenticated (subscribed but
 *    invoice unpaid).
 *  - Sub status "active" only qualifies when currentEnd has already
 *    passed — that means the cycle lapsed without renewal payment.
 */
export function computeOfficeGraceState(
  subscription: IOfficeSubscription | null,
  now: Date = new Date(),
): OfficeGraceState {
  const noGrace: OfficeGraceState = {
    inGrace: false,
    lapsed: false,
    graceEndsAt: null,
    anchor: null,
    daysRemaining: 0,
  };
  if (!subscription) return noGrace;

  const plan = subscription.planId as unknown as IOfficePlan | undefined;
  if (!plan || plan.slug !== "pro") return noGrace;

  // Trials have their own expiry mechanic — the caller (hasActive) still
  // handles them via trialEndsAt. Don't let grace overlap that path.
  if (subscription.isTrial) return noGrace;

  const atRiskStatuses = new Set([
    "created",
    "pending",
    "halted",
    "expired",
    "authenticated",
  ]);
  const isActive = subscription.status === "active";
  const cycleLapsed =
    isActive &&
    !!subscription.currentEnd &&
    subscription.currentEnd.getTime() < now.getTime();
  const atRisk = atRiskStatuses.has(subscription.status) || cycleLapsed;
  if (!atRisk) return noGrace;

  const anchor =
    subscription.currentEnd ||
    (subscription as any).createdAt ||
    subscription.startedAt ||
    null;
  if (!anchor) return noGrace;

  const graceEndsAt = new Date(anchor.getTime() + OFFICE_GRACE_PERIOD_MS);
  const inGrace = now.getTime() < graceEndsAt.getTime();
  const daysRemaining = inGrace
    ? Math.ceil((graceEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return {
    inGrace,
    lapsed: !inGrace,
    graceEndsAt,
    anchor,
    daysRemaining,
  };
}

/**
 * Check if organization has an active subscription
 * Organizations with parent: true (GARAGE HQs) are never locked even without payment
 */
export async function hasActiveOfficeSubscription(
  orgId: string,
): Promise<boolean> {
  // TEST ONLY: Check if org is in hardcoded test list (remove after testing)
  if (TEST_UNLOCKED_ORG_IDS.includes(orgId)) {
    return true;
  }

  // Check if organization is a parent (GARAGE HQ) - they are never locked
  const { Organization } = await import("../models/organization.model");
  const org = await Organization.findById(orgId).select("parent").lean();
  if (org?.parent === true) {
    return true;
  }

  // Find subscription — broadened to include the at-risk statuses that
  // qualify for the Pro grace unlock (created / pending / halted /
  // expired). The additional statuses are guarded below by
  // computeOfficeGraceState so a Starter sub in those states does NOT
  // slip through.
  const subscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: {
      $in: [
        "active",
        "authenticated",
        "trial",
        "created",
        "pending",
        "halted",
        "expired",
      ],
    },
  }).populate("planId");

  if (!subscription) {
    return false;
  }

  // Check trial status
  if (subscription.status === "trial" && subscription.isTrial) {
    const now = new Date();
    if (subscription.trialEndsAt && subscription.trialEndsAt > now) {
      return true; // Trial active
    }
    // Trial expired - mark it
    if (!subscription.trialExpired) {
      await OfficeSubscription.updateOne(
        { _id: subscription._id },
        { $set: { trialExpired: true, status: "expired" } },
      );
    }
    return false;
  }

  // Paid cycle still live → unlocked.
  const now = new Date();
  if (
    subscription.status === "active" &&
    subscription.currentEnd &&
    subscription.currentEnd > now
  ) {
    return true;
  }

  // Pro grace: never-paid initial invoice, halted renewal, lapsed cycle
  // — all treated as still-unlocked until the 7-day grace window ends.
  // The daily processExpiredOfficeGrace cron flips lapsed subs to
  // Starter, at which point this check flows back to the Starter path.
  const grace = computeOfficeGraceState(subscription, now);
  if (grace.inGrace) return true;

  return false;
}

/**
 * Get trial information for a subscription
 */
export function getTrialInfo(subscription: IOfficeSubscription | null) {
  if (!subscription?.isTrial) {
    return { isTrial: false };
  }

  const now = new Date();
  const trialEndsAt = subscription.trialEndsAt;
  let daysRemaining = 0;

  if (trialEndsAt && trialEndsAt > now) {
    daysRemaining = Math.ceil(
      (trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  return {
    isTrial: true,
    trialStartedAt: subscription.trialStartedAt,
    trialEndsAt: subscription.trialEndsAt,
    daysRemaining,
    trialExpired:
      subscription.trialExpired || (trialEndsAt ? trialEndsAt <= now : false),
  };
}

/**
 * Check if organization can invite stakeholders (Pro plan only)
 * Also allows: parent orgs (GARAGE HQs), trial subscriptions, and test orgs
 */
export async function canInviteStakeholders(orgId: string): Promise<boolean> {
  // TEST ONLY: Check if org is in hardcoded test list (remove after testing)
  if (TEST_UNLOCKED_ORG_IDS.includes(orgId)) {
    return true;
  }

  // Check if organization is a parent (GARAGE HQ) - they can always invite
  const { Organization } = await import("../models/organization.model");
  const org = await Organization.findById(orgId).select("parent").lean();
  if (org?.parent === true) {
    return true;
  }

  // Broadened to include the same at-risk statuses that hasActive checks
  // so a Pro founder in grace keeps their unlimited-stakeholders benefit
  // through the grace window (mirrors "don't lock during grace" policy).
  const subscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: {
      $in: [
        "active",
        "authenticated",
        "trial",
        "created",
        "pending",
        "halted",
        "expired",
      ],
    },
  })
    .populate("planId")
    .lean();

  if (!subscription) {
    return false;
  }

  // Trial subscriptions can invite stakeholders (they're on Pro plan)
  if (subscription.status === "trial") {
    return true;
  }

  const plan = subscription.planId as unknown as IOfficePlan;
  // At-risk Pro sub: allow invites only while in grace. Once grace
  // lapses (or if it never applied to this sub), fall back to the plan's
  // canInviteStakeholders flag — which is false for Starter, so a
  // post-grace auto-downgraded org drops back to the Basic-tier gate.
  if (
    plan?.slug === "pro" &&
    !["active", "authenticated"].includes(subscription.status)
  ) {
    const grace = computeOfficeGraceState(subscription as any);
    if (grace.inGrace) return true;
    return false;
  }

  return plan?.canInviteStakeholders ?? false;
}

/**
 * Get recovery information for a halted or pending subscription
 * Returns the recovery URL and any unpaid invoices
 */
export async function getSubscriptionRecoveryInfo(orgId: string): Promise<{
  isHalted: boolean;
  isPending: boolean;
  subscription: IOfficeSubscription | null;
  unpaidInvoices: Array<{
    invoiceId: string;
    amount: number;
    status: string;
    issuedAt: Date;
    shortUrl: string;
  }>;
  totalOutstanding: number;
  recoveryUrl: string | null;
} | null> {
  const subscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["halted", "pending"] },
  }).populate("planId");

  if (!subscription) {
    return null;
  }

  let unpaidInvoices: Array<{
    invoiceId: string;
    amount: number;
    status: string;
    issuedAt: Date;
    shortUrl: string;
  }> = [];
  let totalOutstanding = 0;

  if (subscription.razorpaySubscriptionId) {
    try {
      const { getUnpaidSubscriptionInvoices } = await import("./razorpay");
      const invoices = await getUnpaidSubscriptionInvoices(
        subscription.razorpaySubscriptionId,
      );

      unpaidInvoices = invoices.map((inv) => ({
        invoiceId: inv.id,
        amount: inv.amount / 100, // Convert paise to INR
        status: inv.status,
        issuedAt: new Date(inv.issued_at * 1000),
        shortUrl: inv.short_url,
      }));

      totalOutstanding =
        invoices.reduce((sum, inv) => sum + inv.amount_due, 0) / 100;
    } catch (error) {
      console.error(
        `[OfficeSubscription] Error fetching invoices for ${subscription.razorpaySubscriptionId}:`,
        error,
      );
    }
  }

  return {
    isHalted: subscription.status === "halted",
    isPending: subscription.status === "pending",
    subscription,
    unpaidInvoices,
    totalOutstanding,
    recoveryUrl: subscription.shortUrl || null,
  };
}

/**
 * Cancel an office subscription
 */
export async function cancelOfficeSubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true,
): Promise<IOfficeSubscription> {
  const subscription = await OfficeSubscription.findById(subscriptionId);
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (!["active", "authenticated", "pending"].includes(subscription.status)) {
    throw new Error("Subscription cannot be cancelled in current state");
  }

  // Trial subscriptions don't have Razorpay records
  if (!subscription.razorpaySubscriptionId) {
    throw new Error("Cannot cancel trial subscription via this method");
  }

  // Cancel in Razorpay
  await cancelRazorpaySubscription(
    subscription.razorpaySubscriptionId,
    cancelAtCycleEnd,
  );

  // Update in database
  subscription.status = "cancelled";
  subscription.cancelledAt = new Date();
  await subscription.save();

  // Notify user
  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "cancelled",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    endDate: subscription.currentEnd,
  });

  return subscription;
}

/**
 * Sync subscription status with Razorpay
 */
export async function syncOfficeSubscriptionStatus(
  subscriptionId: string,
): Promise<IOfficeSubscription | null> {
  const subscription = await OfficeSubscription.findById(subscriptionId);
  if (!subscription) {
    return null;
  }

  // Trial subscriptions don't have Razorpay records to sync
  if (!subscription.razorpaySubscriptionId) {
    return subscription;
  }

  const razorpaySubscription = await fetchRazorpaySubscription(
    subscription.razorpaySubscriptionId,
  );

  subscription.status = razorpaySubscription.status as OfficeSubscriptionStatus;
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount =
    razorpaySubscription.remaining_count ?? undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;

  if (razorpaySubscription.ended_at) {
    subscription.endedAt = unixToDate(razorpaySubscription.ended_at);
  }

  await subscription.save();
  return subscription;
}

// ============ Webhook Handlers ============

/**
 * Handle subscription authenticated event
 */
export async function handleOfficeSubscriptionAuthenticated(
  razorpaySubscription: RazorpaySubscription,
): Promise<void> {
  // Check if this is an office subscription
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    console.log(
      `[OfficeSubscription] Skipping non-office subscription: ${razorpaySubscription.id}`,
    );
    return;
  }

  console.log(
    `[OfficeSubscription] Handling authenticated event for: ${razorpaySubscription.id}`,
  );
  console.log(
    `[OfficeSubscription] Notes:`,
    JSON.stringify(razorpaySubscription.notes, null, 2),
  );

  // Try to find by razorpaySubscriptionId
  let subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  // If not found, try to find by orgId from notes (fallback)
  if (!subscription && razorpaySubscription.notes?.orgId) {
    console.log(
      `[OfficeSubscription] Not found by razorpaySubscriptionId, trying by orgId: ${razorpaySubscription.notes.orgId}`,
    );
    subscription = await OfficeSubscription.findOne({
      orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
      status: "created",
    });

    if (subscription) {
      console.log(
        `[OfficeSubscription] Found by orgId! Updating razorpaySubscriptionId from ${subscription.razorpaySubscriptionId} to ${razorpaySubscription.id}`,
      );
      subscription.razorpaySubscriptionId = razorpaySubscription.id;
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`,
    );
    // Log all subscriptions for debugging
    const allSubs = await OfficeSubscription.find({})
      .select("razorpaySubscriptionId orgId status")
      .lean();
    console.log(
      `[OfficeSubscription] All subscriptions in DB:`,
      JSON.stringify(allSubs, null, 2),
    );
    return;
  }

  subscription.status = "authenticated";
  subscription.razorpayCustomerId =
    razorpaySubscription.customer_id || undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;
  await subscription.save();

  console.log(`[OfficeSubscription] ${subscription._id} authenticated`);
}

/**
 * Handle subscription activated event (first payment successful)
 */
export async function handleOfficeSubscriptionActivated(
  razorpaySubscription: RazorpaySubscription,
  payment?: any,
): Promise<void> {
  // Check if this is an office subscription
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    return;
  }

  console.log(
    `[OfficeSubscription] Handling activated event for: ${razorpaySubscription.id}`,
  );

  // Try to find by razorpaySubscriptionId first
  let subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  }).populate("planId");

  // If not found, try by orgId from notes
  if (!subscription && razorpaySubscription.notes?.orgId) {
    subscription = await OfficeSubscription.findOne({
      orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
      status: { $in: ["created", "authenticated"] },
    }).populate("planId");

    if (subscription) {
      console.log(
        `[OfficeSubscription] Found by orgId, updating razorpaySubscriptionId`,
      );
      subscription.razorpaySubscriptionId = razorpaySubscription.id;
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`,
    );
    return;
  }

  const plan = subscription.planId as unknown as IOfficePlan;

  // Update subscription
  subscription.status = "active";
  subscription.startedAt = new Date();
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount =
    razorpaySubscription.remaining_count ?? undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;
  await subscription.save();

  // Downline-table Type column: activates "Founder Sub". Fire-and-forget.
  void refreshTypeFlags(subscription.founderId);

  // Record payment if provided
  if (payment) {
    await recordOfficeSubscriptionPayment(subscription, payment, 1);
  }

  // Distribute commission for first payment
  await distributeOfficeCommission(
    subscription,
    plan,
    1,
    payment?.amount || plan.amount,
  );

  // Notify user
  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "activated",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    planName: plan.name,
    currentEnd: subscription.currentEnd,
  });

  console.log(`[OfficeSubscription] ${subscription._id} activated`);
}

/**
 * Handle subscription charged event (recurring payment successful)
 */
export async function handleOfficeSubscriptionCharged(
  razorpaySubscription: RazorpaySubscription,
  payment: any,
): Promise<void> {
  // Check if this is an office subscription
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    return;
  }

  console.log(
    `[OfficeSubscription] Handling charged event for: ${razorpaySubscription.id}`,
  );

  // Try to find by razorpaySubscriptionId first
  let subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  }).populate("planId");

  // If not found, try by orgId from notes
  if (!subscription && razorpaySubscription.notes?.orgId) {
    subscription = await OfficeSubscription.findOne({
      orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
    }).populate("planId");

    if (subscription) {
      console.log(
        `[OfficeSubscription] Found by orgId, updating razorpaySubscriptionId`,
      );
      subscription.razorpaySubscriptionId = razorpaySubscription.id;
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`,
    );
    return;
  }

  const plan = subscription.planId as unknown as IOfficePlan;
  const paymentNumber = razorpaySubscription.paid_count;

  // Detect if this is a recovery from halted/pending state
  const wasHalted = subscription.status === "halted";
  const wasPending = subscription.status === "pending";
  const isRecovery = wasHalted || wasPending;

  // Update subscription
  // IMPORTANT: Set status to "active" - if charged event comes before/without activated event,
  // the subscription should still be marked active since payment was successful
  if (
    subscription.status === "created" ||
    subscription.status === "authenticated" ||
    subscription.status === "halted" ||
    subscription.status === "pending"
  ) {
    subscription.status = "active";
    subscription.startedAt = subscription.startedAt || new Date();
  }
  subscription.currentStart = unixToDate(razorpaySubscription.current_start);
  subscription.currentEnd = unixToDate(razorpaySubscription.current_end);
  subscription.chargeAt = unixToDate(razorpaySubscription.charge_at);
  subscription.paidCount = razorpaySubscription.paid_count;
  subscription.remainingCount =
    razorpaySubscription.remaining_count ?? undefined;
  await subscription.save();

  // Downline-table Type column: activates "Founder Sub" on recurring charge. Fire-and-forget.
  void refreshTypeFlags(subscription.founderId);

  // Record payment
  await recordOfficeSubscriptionPayment(subscription, payment, paymentNumber);

  // Distribute commission for this payment
  await distributeOfficeCommission(
    subscription,
    plan,
    paymentNumber,
    payment.amount,
  );

  // If this was a recovery from halted/pending, send a special notification
  if (isRecovery) {
    console.log(
      `[OfficeSubscription] ${subscription._id} recovered from ${wasHalted ? "halted" : "pending"} state`,
    );
    emitToUser(subscription.founderId, "office:subscription:update", {
      type: "recovered",
      subscriptionId: subscription._id,
      orgId: subscription.orgId,
      planName: plan.name,
      message:
        "Payment successful! Your office subscription has been recovered.",
      paymentNumber,
      currentEnd: subscription.currentEnd,
    });
  }

  // Notify user (regular charged notification)
  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "charged",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    paymentNumber,
    currentEnd: subscription.currentEnd,
    nextChargeDate: subscription.chargeAt,
  });

  console.log(
    `[OfficeSubscription] ${subscription._id} charged (payment #${paymentNumber})`,
  );
}

/**
 * Handle subscription halted event (payment failed after retries)
 */
export async function handleOfficeSubscriptionHalted(
  razorpaySubscription: RazorpaySubscription,
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    return;
  }

  console.log(
    `[OfficeSubscription] Handling halted event for: ${razorpaySubscription.id}`,
  );

  // Only find by exact razorpaySubscriptionId to prevent upgrade conflicts
  const subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.log(
      `[OfficeSubscription] Subscription ${razorpaySubscription.id} not found in DB`,
    );
    return;
  }

  subscription.status = "halted";
  await subscription.save();

  // Grace policy: a halted Pro sub is no longer an instant lock. The
  // office keeps working through the grace window (see
  // computeOfficeGraceState) and only auto-downgrades to Starter if the
  // founder doesn't recover by then. We soften the messaging accordingly
  // — "please update your payment method" instead of "you are now
  // locked".
  const grace = computeOfficeGraceState(subscription);

  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "halted",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    graceEndsAt: grace.graceEndsAt,
    daysRemaining: grace.daysRemaining,
    message: grace.inGrace
      ? `Your Pro payment failed. Your office stays live for ${grace.daysRemaining} more day(s) — update your payment method to keep Pro. Otherwise, you'll auto-switch to the free Starter plan.`
      : "Your Pro payment failed and the grace window has passed. Your office will auto-switch to the free Starter plan shortly.",
  });

  console.log(
    `[OfficeSubscription] ${subscription._id} halted (grace ends ${grace.graceEndsAt?.toISOString() ?? "n/a"})`,
  );
}

/**
 * Handle subscription cancelled event
 */
export async function handleOfficeSubscriptionCancelled(
  razorpaySubscription: RazorpaySubscription,
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    return;
  }

  console.log(
    `[OfficeSubscription] Handling cancelled event for: ${razorpaySubscription.id}`,
  );

  // IMPORTANT: Only find by exact razorpaySubscriptionId - DO NOT use orgId fallback
  // This prevents the upgrade flow from accidentally cancelling the new Pro subscription
  // when the old Basic subscription's cancellation webhook comes in.
  // During upgrade: Basic is cancelled -> webhook comes -> if we use orgId fallback,
  // we'd find and cancel the new Pro subscription instead.
  const subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    // Subscription record not found - this is expected during upgrades
    // where the old subscription was deleted before creating the new one
    console.log(
      `[OfficeSubscription] Subscription ${razorpaySubscription.id} not found in DB (may have been replaced during upgrade)`,
    );
    return;
  }

  subscription.status = "cancelled";
  subscription.endedAt =
    unixToDate(razorpaySubscription.ended_at) || new Date();
  await subscription.save();

  // Notify user
  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "cancelled",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    endDate: subscription.currentEnd,
    message: `Your office subscription has been cancelled. Access will end on ${subscription.currentEnd?.toLocaleDateString()}.`,
  });

  console.log(`[OfficeSubscription] ${subscription._id} cancelled`);
}

/**
 * Handle subscription pending event
 */
export async function handleOfficeSubscriptionPending(
  razorpaySubscription: RazorpaySubscription,
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_subscription") {
    return;
  }

  console.log(
    `[OfficeSubscription] Handling pending event for: ${razorpaySubscription.id}`,
  );

  // Only find by exact razorpaySubscriptionId to prevent upgrade conflicts
  const subscription = await OfficeSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.log(
      `[OfficeSubscription] Subscription ${razorpaySubscription.id} not found in DB`,
    );
    return;
  }

  subscription.status = "pending";
  await subscription.save();

  emitToUser(subscription.founderId, "office:subscription:update", {
    type: "pending",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    message: "Payment is pending. Please check your payment method.",
  });

  console.log(`[OfficeSubscription] ${subscription._id} pending`);
}

// ============ Helper Functions ============

/**
 * Record a subscription payment
 */
async function recordOfficeSubscriptionPayment(
  subscription: IOfficeSubscription,
  payment: any,
  paymentNumber: number,
): Promise<IOfficeSubscriptionPayment> {
  // Check for duplicate
  const existing = await OfficeSubscriptionPayment.findOne({
    razorpayPaymentId: payment.id,
  });

  if (existing) {
    return existing;
  }

  // Try to fetch invoice short_url if invoice_id exists
  let invoiceShortUrl: string | undefined;
  if (payment.invoice_id) {
    try {
      const { fetchInvoice } = await import("./razorpay");
      const invoice = await fetchInvoice(payment.invoice_id);
      invoiceShortUrl = invoice.short_url;
      console.log(
        `[OfficePayment] Fetched invoice short_url: ${invoiceShortUrl}`,
      );
    } catch (error) {
      console.error(
        `[OfficePayment] Failed to fetch invoice ${payment.invoice_id}:`,
        error,
      );
    }
  }

  const subscriptionPayment = await OfficeSubscriptionPayment.create({
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    founderId: subscription.founderId,
    razorpayPaymentId: payment.id,
    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
    razorpayOrderId: payment.order_id,
    razorpayInvoiceId: payment.invoice_id,
    invoiceShortUrl,
    amount: payment.amount,
    currency: payment.currency || "USD",
    status: payment.status === "captured" ? "captured" : "authorized",
    paymentNumber,
    method: payment.method,
    cardId: payment.card_id,
    bank: payment.bank,
    wallet: payment.wallet,
    vpa: payment.vpa,
    fee: payment.fee,
    tax: payment.tax,
    notes: payment.notes,
    commissionDistributed: false,
    paidAt: new Date(payment.created_at * 1000),
  });

  return subscriptionPayment;
}

/**
 * Distribute commission for office subscription payment
 * Uses hardcoded commission structure: L1 = 15%, L2 = 10%, L3 = 2.5%, L4 = 2.5%
 * Remaining goes to platform (shorupan@gmail.com)
 */
async function distributeOfficeCommission(
  subscription: IOfficeSubscription,
  plan: IOfficePlan,
  paymentNumber: number,
  amountInPaise: number,
): Promise<void> {
  try {
    // Check if already distributed
    const existingPayment = await OfficeSubscriptionPayment.findOne({
      subscriptionId: subscription._id,
      paymentNumber,
      commissionDistributed: true,
    });

    if (existingPayment) {
      console.log(
        `[OfficeCommission] Already distributed for subscription ${subscription._id} payment #${paymentNumber}`,
      );
      return;
    }

    // Extract base amount (excluding GST) for commission calculation
    // Razorpay charges GST-inclusive amount, but commissions should be on base amount only
    const taxRate = plan.taxRate ?? GST_CONFIG.rate;
    const { baseAmount: baseAmountPaise, taxAmount: gstAmountPaise } =
      extractBaseFromTotal(amountInPaise, taxRate);

    // Convert from smallest unit (cents/paise) to currency unit
    let baseAmountUSD: number;
    let gstAmountUSD: number;
    let totalAmountUSD: number;
    let exchangeRate: number | undefined;

    if (plan.currency === "INR") {
      // Legacy INR subscription — convert to USD
      const baseAmountInINR = baseAmountPaise / 100;
      const gstAmountInINR = gstAmountPaise / 100;
      const totalAmountInINR = amountInPaise / 100;
      const converted = await convertInrToUsd(baseAmountInINR);
      baseAmountUSD = converted.usdAmount;
      exchangeRate = converted.exchangeRate;
      gstAmountUSD =
        Math.round((gstAmountInINR / converted.exchangeRate) * 100) / 100;
      totalAmountUSD =
        Math.round((totalAmountInINR / converted.exchangeRate) * 100) / 100;
      console.log(
        `[OfficeCommission] Legacy INR payment - Total: ₹${totalAmountInINR}, Base: ₹${baseAmountInINR} ($${baseAmountUSD} @ ${exchangeRate}), GST (${taxRate}%): ₹${gstAmountInINR}`,
      );
    } else {
      // USD subscription — direct cents to dollars
      baseAmountUSD = baseAmountPaise / 100;
      gstAmountUSD = gstAmountPaise / 100;
      totalAmountUSD = amountInPaise / 100;
      console.log(
        `[OfficeCommission] Payment breakdown - Total: $${totalAmountUSD}, Base: $${baseAmountUSD}, GST (${taxRate}%): $${gstAmountUSD}`,
      );
    }

    // Get platform user
    const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
      .select("_id")
      .lean();
    if (!platformUser) {
      throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
    }
    const platformUserId = platformUser._id.toString();

    // ── Pro plan branch: 3-bucket carve-out ($24 UP + $24 direct + $48
    //     platform), plus a monthly volume-bonus reserved from that
    //     $48 platform bucket at end-of-month settlement.
    //
    //     For the Pro plan ($96 base) we DISABLE the legacy office L1-L4
    //     structure. Split per sale:
    //       • $24 → distributeUnilevelPlusCommission (single UP unit;
    //         actual UP $24 base, NOT the doubled $48 we used before —
    //         we halved so per-recipient level/infinity amounts land
    //         at exactly one UP-unit's worth).
    //       • $24 → flat direct to L1 (buyer.referredBy). If no
    //         referrer (or not UP-active), creditAffiliateOrPlatform
    //         routes to Shorupan HQ same as everywhere else.
    //       • $48 → Shorupan HQ platform store wallet (immediate).
    //         This is the pool the monthly volume bonus is CARVED FROM
    //         at settlement time (see founderSubMonthlyBonus/*). We
    //         credit it upfront and the bonus module debits HQ + credits
    //         qualifying founders at month-close; unqualified sales
    //         keep the $48 as platform revenue.
    //
    //     Infinity gating uses the UP-active-directs rule
    //     (getActiveUpDirectCount in unilevelPlusCommission.ts) — only
    //     uplines with ≥4 UP-active directs (T1) or ≥10 (T2) get
    //     infinity bonuses.
    const isProPlan = plan._id.toString() === OFFICE_PLAN_IDS.pro;
    if (isProPlan) {
      // Dynamic import to avoid circular dep with unilevelPlusCommission.
      // Hoisted above the split because the carve-out is PRICED by the plan.
      const { getActiveUnilevelPlusPlan, distributeUnilevelPlusCommission } =
        await import("./unilevelPlusCommission");
      const upPlan = await getActiveUnilevelPlusPlan();
      if (!upPlan) {
        throw new Error(
          "Office Pro distribution requires an active Unilevel Plus plan, none found",
        );
      }

      // ── The UP carve-out is ONE Unilevel Plus licence ──
      // Was hardcoded 24 against a plan priced at 25, so every Office Pro
      // sale funded 96% of a licence and `planScale` inside
      // distributeUnilevelPlusCommission scaled EVERY payout down to 96%
      // of nominal (direct $8.64 not $9.00, infinity T1 $0.38 not $0.40).
      // Must stay identical to officeProInvoiceCommission.ts — the two
      // paths bill the same product and diverging here would mean a
      // Razorpay-paid sub paid differently from a wallet-paid one.
      const upSaleUsd = upPlan.productPrice;
      const directFlatUsd = 24;
      const platformShareUsd =
        Math.round(
          (baseAmountUSD - upSaleUsd - directFlatUsd) * 100,
        ) / 100;

      // Flat carve-outs against a variable base can go negative on a
      // cheaper plan. The isProPlan gate makes that unreachable today, but
      // fail loudly rather than write a negative platform credit.
      if (platformShareUsd < 0) {
        throw new Error(
          `Office Pro carve-out exceeds the sale: base $${baseAmountUSD} < ` +
            `$${upSaleUsd} (UP licence) + $${directFlatUsd} (direct flat)`,
        );
      }

      const upPaymentId = `office_pro_${subscription._id}_${paymentNumber}`;
      const directPaymentId = `office_pro_direct_${subscription._id}_${paymentNumber}`;

      // Founder here IS the buyer of the office sub — their referredBy
      // is who gets the $24 flat direct.
      const founderForDirect = await User.findById(subscription.founderId)
        .select("referredBy")
        .lean();
      const directRecipientId = founderForDirect?.referredBy
        ? String(founderForDirect.referredBy)
        : null;

      // 1) Run the UP comp tree on the licence carve-out (single UP unit).
      //    Idempotent on paymentId via UnilevelPlusDistribution's unique
      //    index, so webhook double-fires don't double-distribute.
      await distributeUnilevelPlusCommission({
        buyerId: subscription.founderId.toString(),
        planId: upPlan._id.toString(),
        saleAmount: upSaleUsd,
        currency: "USD",
        paymentId: upPaymentId,
        metadata: {
          source: "office_subscription_pro",
          officeSubscriptionId: subscription._id.toString(),
          officePlanId: plan._id.toString(),
          officePlanName: plan.name,
          paymentNumber,
          orgId: subscription.orgId?.toString(),
          baseAmountUSD,
          totalAmountUSD,
          gstAmountUSD,
          ...(exchangeRate ? { exchangeRate, legacyINR: true } : {}),
        },
      });

      // 2) Credit $24 flat direct to L1 (founder.referredBy). Routes
      //    to Shorupan HQ if no referrer or referrer is not UP-active.
      //    Its own transaction so a $24 direct failure can't roll back
      //    the platform-share write below. Idempotent via dedupeKey.
      const { creditAffiliateOrPlatform } = await import("./wallet");
      const directSession = await mongoose.startSession();
      let directRouted: "recipient" | "platform_no_referrer" = "recipient";
      try {
        await directSession.withTransaction(async () => {
          if (directRecipientId) {
            await creditAffiliateOrPlatform({
              recipientUserId: directRecipientId,
              amount: directFlatUsd,
              currency: "USD",
              description: `Office Pro direct bonus (L1)`,
              note: `Office Pro payment #${paymentNumber} — $24 flat direct on ${plan.name} activation. Org: ${subscription.orgId}`,
              relatedUserId: subscription.founderId.toString(),
              metadata: {
                dedupeKey: directPaymentId,
                kind: "office_pro_direct",
                subscriptionId: String(subscription._id),
                paymentNumber,
                orgId: String(subscription.orgId || ""),
                planSlug: plan.slug,
              },
              session: directSession,
            });
          } else {
            // No referrer at all — credit $24 to Shorupan HQ directly
            // (creditAffiliateOrPlatform still needs a recipientUserId).
            directRouted = "platform_no_referrer";
            let hqWallet = await StoreWallet.findOne({
              userId: platformUserId,
              orgId: new Types.ObjectId(PLATFORM_ORG_ID),
            }).session(directSession);
            if (!hqWallet) {
              const created = await StoreWallet.create(
                [
                  {
                    userId: platformUserId,
                    orgId: new Types.ObjectId(PLATFORM_ORG_ID),
                    balance: 0,
                    currency: "USD",
                  },
                ],
                { session: directSession },
              );
              hqWallet = created[0];
            }
            const before = hqWallet.balance;
            const after = Math.round((before + directFlatUsd) * 100) / 100;
            hqWallet.balance = after;
            hqWallet.lastTransactionAt = new Date();
            await hqWallet.save({ session: directSession });
            await WalletTransaction.create(
              [
                {
                  storeWalletId: hqWallet._id,
                  walletType: "store",
                  userId: platformUserId,
                  orgId: new Types.ObjectId(PLATFORM_ORG_ID),
                  type: "credit",
                  amount: directFlatUsd,
                  currency: "USD",
                  balanceBefore: before,
                  balanceAfter: after,
                  description: `Office Pro direct bonus — no referrer`,
                  note: `Office Pro payment #${paymentNumber}: $24 direct routed to HQ (buyer has no referredBy).`,
                  relatedUserId: subscription.founderId,
                  metadata: {
                    dedupeKey: directPaymentId,
                    kind: "office_pro_direct_no_referrer",
                    subscriptionId: subscription._id,
                    paymentNumber,
                    orgId: subscription.orgId,
                  },
                  status: "completed",
                },
              ],
              { session: directSession },
            );
          }
        });
      } catch (err: any) {
        // E11000 = dedupeKey collided (retry). Idempotent success.
        if (err?.code !== 11000) {
          console.error(
            `[OfficeCommission] Pro direct $24 failed sub=${subscription._id} pay=${paymentNumber}:`,
            err,
          );
          throw err;
        }
      } finally {
        directSession.endSession();
      }

      // 3) Credit the remaining $48 to platform store wallet. Atomic
      //    transaction so the platform credit + commissionDistributed
      //    flag flip together.
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        let platformWallet = await StoreWallet.findOne({
          userId: platformUserId,
          orgId: new Types.ObjectId(PLATFORM_ORG_ID),
        }).session(session);
        if (!platformWallet) {
          const created = await StoreWallet.create(
            [
              {
                userId: platformUserId,
                orgId: new Types.ObjectId(PLATFORM_ORG_ID),
                balance: 0,
                currency: "USD",
              },
            ],
            { session },
          );
          platformWallet = created[0];
        }
        const platformBalanceBefore = platformWallet.balance;
        const platformBalanceAfter = platformBalanceBefore + platformShareUsd;
        platformWallet.balance = platformBalanceAfter;
        platformWallet.lastTransactionAt = new Date();
        await platformWallet.save({ session });

        await WalletTransaction.create(
          [
            {
              storeWalletId: platformWallet._id,
              walletType: "store",
              userId: platformUserId,
              orgId: new Types.ObjectId(PLATFORM_ORG_ID),
              type: "credit",
              amount: platformShareUsd,
              currency: "USD",
              balanceBefore: platformBalanceBefore,
              balanceAfter: platformBalanceAfter,
              description: `Office Pro platform share: ${plan.name}`,
              note: `Office Pro payment #${paymentNumber}, base $${baseAmountUSD} (UP $${upSaleUsd} + direct $${directFlatUsd} + platform $${platformShareUsd}). Org: ${subscription.orgId}`,
              relatedUserId: subscription.founderId,
              metadata: {
                source: "office_subscription_pro_platform_share",
                subscriptionId: subscription._id,
                planId: plan._id,
                planName: plan.name,
                paymentNumber,
                orgId: subscription.orgId,
                founderId: subscription.founderId,
                baseAmountUSD,
                upSaleUsd,
                directFlatUsd,
                directRecipientId: directRecipientId || null,
                directRouted,
                platformShareUsd,
                totalAmountUSD,
                gstAmountUSD,
                ...(exchangeRate ? { exchangeRate, legacyINR: true } : {}),
              },
              status: "completed",
            },
          ],
          { session },
        );

        await OfficeSubscriptionPayment.updateOne(
          { subscriptionId: subscription._id, paymentNumber },
          { commissionDistributed: true },
          { session },
        );
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }

      console.log(`[OfficeCommission] Pro distribution complete:
        Total Charged: $${totalAmountUSD}${exchangeRate ? ` (converted from INR @ ${exchangeRate})` : ""}
        Base: $${baseAmountUSD}, GST (to government): $${gstAmountUSD}
        UP tree saleAmount: $${upSaleUsd} (paymentId ${upPaymentId})
        Direct L1 flat: $${directFlatUsd} → ${directRecipientId || "HQ (no referrer)"}
        Platform share: $${platformShareUsd}`);
      return; // ← skip the legacy L1-L4 branch below
    }

    // Get founder (for referral chain)
    const founder = await User.findById(subscription.founderId)
      .select("referredBy")
      .lean();

    // Calculate commissions using hardcoded structure (4 levels)
    // IMPORTANT: Commissions are calculated on BASE amount (excluding GST), in USD
    const l1Commission =
      Math.round(
        ((baseAmountUSD * OFFICE_COMMISSION_STRUCTURE.level1Percentage) / 100) *
          100,
      ) / 100;
    const l2Commission =
      Math.round(
        ((baseAmountUSD * OFFICE_COMMISSION_STRUCTURE.level2Percentage) / 100) *
          100,
      ) / 100;
    const l3Commission =
      Math.round(
        ((baseAmountUSD * OFFICE_COMMISSION_STRUCTURE.level3Percentage) / 100) *
          100,
      ) / 100;
    const l4Commission =
      Math.round(
        ((baseAmountUSD * OFFICE_COMMISSION_STRUCTURE.level4Percentage) / 100) *
          100,
      ) / 100;

    // Walk referral chain up to 4 levels
    const commissions: {
      userId: string;
      level: number;
      amount: number;
      percentage: number;
    }[] = [];
    let totalCommission = 0;

    // L1 - Founder's direct referrer
    if (founder?.referredBy) {
      const l1Referrer = await User.findById(founder.referredBy)
        .select("_id referredBy")
        .lean();
      if (l1Referrer) {
        commissions.push({
          userId: l1Referrer._id.toString(),
          level: 1,
          amount: l1Commission,
          percentage: OFFICE_COMMISSION_STRUCTURE.level1Percentage,
        });
        totalCommission += l1Commission;

        // L2 - L1's referrer
        if (l1Referrer.referredBy) {
          const l2Referrer = await User.findById(l1Referrer.referredBy)
            .select("_id referredBy")
            .lean();
          if (l2Referrer) {
            commissions.push({
              userId: l2Referrer._id.toString(),
              level: 2,
              amount: l2Commission,
              percentage: OFFICE_COMMISSION_STRUCTURE.level2Percentage,
            });
            totalCommission += l2Commission;

            // L3 - L2's referrer
            if (l2Referrer.referredBy) {
              const l3Referrer = await User.findById(l2Referrer.referredBy)
                .select("_id referredBy")
                .lean();
              if (l3Referrer) {
                commissions.push({
                  userId: l3Referrer._id.toString(),
                  level: 3,
                  amount: l3Commission,
                  percentage: OFFICE_COMMISSION_STRUCTURE.level3Percentage,
                });
                totalCommission += l3Commission;

                // L4 - L3's referrer
                if (l3Referrer.referredBy) {
                  commissions.push({
                    userId: l3Referrer.referredBy.toString(),
                    level: 4,
                    amount: l4Commission,
                    percentage: OFFICE_COMMISSION_STRUCTURE.level4Percentage,
                  });
                  totalCommission += l4Commission;
                }
              }
            }
          }
        }
      }
    }

    // Platform gets the rest of the BASE amount in USD (GST goes to government, not distributed)
    const platformAmount =
      Math.round((baseAmountUSD - totalCommission) * 100) / 100;

    // Start transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Credit platform wallet
      let platformWallet = await StoreWallet.findOne({
        userId: platformUserId,
        orgId: new Types.ObjectId(PLATFORM_ORG_ID),
      }).session(session);

      if (!platformWallet) {
        const created = await StoreWallet.create(
          [
            {
              userId: platformUserId,
              orgId: new Types.ObjectId(PLATFORM_ORG_ID),
              balance: 0,
              currency: "USD",
            },
          ],
          { session },
        );
        platformWallet = created[0];
      }

      const platformBalanceBefore = platformWallet.balance;
      const platformBalanceAfter = platformBalanceBefore + platformAmount;
      platformWallet.balance = platformBalanceAfter;
      platformWallet.lastTransactionAt = new Date();
      await platformWallet.save({ session });

      // Create platform transaction
      await WalletTransaction.create(
        [
          {
            storeWalletId: platformWallet._id,
            walletType: "store",
            userId: platformUserId,
            orgId: new Types.ObjectId(PLATFORM_ORG_ID),
            type: "credit",
            amount: platformAmount,
            currency: "USD",
            balanceBefore: platformBalanceBefore,
            balanceAfter: platformBalanceAfter,
            description: `Office subscription: ${plan.name} Plan`,
            note: `Office subscription payment #${paymentNumber}. Org: ${subscription.orgId}`,
            relatedUserId: subscription.founderId,
            metadata: {
              subscriptionId: subscription._id,
              planId: plan._id,
              planName: plan.name,
              paymentNumber,
              orgId: subscription.orgId,
              founderId: subscription.founderId,
              baseAmountUSD,
              totalAmountUSD,
              gstAmountUSD,
              totalCommission,
              ...(exchangeRate ? { exchangeRate, legacyINR: true } : {}),
            },
            status: "completed",
          },
        ],
        { session },
      );

      // Credit affiliate wallets (routes to platform if not UP-activated)
      for (const commission of commissions) {
        await creditAffiliateOrPlatform({
          recipientUserId: commission.userId,
          amount: commission.amount,
          currency: "USD",
          description: `Office L${commission.level} commission: ${plan.name} Plan`,
          note: `Level ${commission.level} (${commission.percentage}%) office subscription commission`,
          relatedUserId: subscription.founderId?.toString(),
          metadata: {
            subscriptionId: subscription._id,
            planId: plan._id,
            planName: plan.name,
            paymentNumber,
            level: commission.level,
            percentage: commission.percentage,
            orgId: subscription.orgId,
            founderId: subscription.founderId,
            baseAmountUSD,
            ...(exchangeRate ? { exchangeRate, legacyINR: true } : {}),
          },
          session,
        });
      }

      // Mark payment as commission distributed
      await OfficeSubscriptionPayment.updateOne(
        { subscriptionId: subscription._id, paymentNumber },
        { commissionDistributed: true },
        { session },
      );

      await session.commitTransaction();

      console.log(`[OfficeCommission] Distributed for ${plan.name} Plan:
        Total Charged: $${totalAmountUSD}${exchangeRate ? ` (converted from INR @ ${exchangeRate})` : ""}
        Base: $${baseAmountUSD}, GST (to government): $${gstAmountUSD}
        Platform: $${platformAmount}
        L1 Commission (15%): $${
          commissions.find((c) => c.level === 1)?.amount || 0
        }
        L2 Commission (10%): $${
          commissions.find((c) => c.level === 2)?.amount || 0
        }
        L3 Commission (2.5%): $${
          commissions.find((c) => c.level === 3)?.amount || 0
        }
        L4 Commission (2.5%): $${
          commissions.find((c) => c.level === 4)?.amount || 0
        }`);
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error(
      `[OfficeCommission] Failed for subscription ${subscription._id}:`,
      error,
    );
  }
}

// ============ Plan Upgrade Functions ============

import {
  OfficeUpgradeHistory,
  IOfficeUpgradeHistory,
  ICreditCalculation,
} from "../models/officeUpgradeHistory.model";
import { creditStoreWallet } from "./wallet";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Calculate unused Basic credit to be added to wallet
 * Credit is calculated on BASE amount only (excluding GST paid to government)
 */
function calculateUpgradeCredit(
  subscription: IOfficeSubscription,
  basicPlan: IOfficePlan,
): ICreditCalculation {
  const now = new Date();
  const currentStart = subscription.currentStart!;
  const currentEnd = subscription.currentEnd!;

  // Calculate days based on calendar days
  const totalDaysInCycle = Math.ceil(
    (currentEnd.getTime() - currentStart.getTime()) / MS_PER_DAY,
  );
  const daysUsed = Math.ceil(
    (now.getTime() - currentStart.getTime()) / MS_PER_DAY,
  );
  const daysRemaining = Math.max(0, totalDaysInCycle - daysUsed);

  // Daily rate for Basic plan (in paise, base amount)
  const basicDailyRate = basicPlan.amount / totalDaysInCycle;

  // Unused credit (in paise, base amount only - GST was paid to government)
  const creditAmount = Math.round(basicDailyRate * daysRemaining);

  return {
    currentPeriodStart: currentStart,
    currentPeriodEnd: currentEnd,
    upgradeDate: now,
    totalDaysInCycle,
    daysRemaining,
    creditAmount, // paise (base amount credited to wallet)
  };
}

export interface UpgradePreview {
  canUpgrade: boolean;
  reason?: string;
  currentPlan?: {
    name: string;
    slug: string;
    amount: number; // INR (base)
    amountWithGst: number; // INR (total)
  };
  targetPlan?: {
    name: string;
    slug: string;
    amount: number; // INR (base)
    amountWithGst: number; // INR (total)
  };
  creditToWallet?: {
    daysRemaining: number;
    totalDaysInCycle: number;
    unusedBasicCredit: number; // INR (base amount credited to wallet)
  };
  nextBillingDate?: Date;
  nextBillingAmount?: number; // INR (full Pro price with GST)
}

/**
 * Calculate upgrade preview for an organization
 * Returns wallet credit info instead of payment breakdown
 */
export async function calculateUpgradePreview(
  orgId: string,
): Promise<UpgradePreview> {
  // Get active subscription
  const subscription = await getActiveOfficeSubscription(orgId);
  if (!subscription) {
    return {
      canUpgrade: false,
      reason: "No active subscription found",
    };
  }

  // Get current plan
  const currentPlan = subscription.planId as unknown as IOfficePlan;
  if (!currentPlan) {
    return {
      canUpgrade: false,
      reason: "Current plan not found",
    };
  }

  // Check if already on Pro
  if (currentPlan.slug === "pro") {
    return {
      canUpgrade: false,
      reason: "Already on Pro plan",
    };
  }

  // Check if subscription is in valid state
  if (!["active", "authenticated"].includes(subscription.status)) {
    return {
      canUpgrade: false,
      reason: "Subscription must be active to upgrade",
    };
  }

  // Check if current period dates exist
  if (!subscription.currentStart || !subscription.currentEnd) {
    return {
      canUpgrade: false,
      reason: "Subscription billing cycle not established",
    };
  }

  // Get Pro plan
  const proPlan = await getOfficePlanBySlug("pro");
  if (!proPlan) {
    return {
      canUpgrade: false,
      reason: "Pro plan not available",
    };
  }

  // Calculate credit to wallet
  const credit = calculateUpgradeCredit(subscription, currentPlan);

  // Pro plan with GST for display
  const proPlanGst = calculateTaxAmounts(proPlan.amount, GST_CONFIG.rate);

  return {
    canUpgrade: true,
    currentPlan: {
      name: currentPlan.name,
      slug: currentPlan.slug,
      amount: currentPlan.amount / 100, // INR (base)
      amountWithGst:
        calculateTaxAmounts(currentPlan.amount, GST_CONFIG.rate).totalAmount /
        100, // INR (total)
    },
    targetPlan: {
      name: proPlan.name,
      slug: proPlan.slug,
      amount: proPlan.amount / 100, // INR (base)
      amountWithGst: proPlanGst.totalAmount / 100, // INR (total with GST)
    },
    creditToWallet: {
      daysRemaining: credit.daysRemaining,
      totalDaysInCycle: credit.totalDaysInCycle,
      unusedBasicCredit: credit.creditAmount / 100, // INR (base amount to wallet)
    },
    nextBillingDate: credit.currentPeriodEnd,
    nextBillingAmount: proPlanGst.totalAmount / 100, // INR (full Pro price with GST)
  };
}

export interface UpgradeResult {
  success: boolean;
  creditedAmount: number; // INR added to wallet
  walletBalance: number; // INR new wallet balance
  subscription: {
    _id: string;
    status: string;
    shortUrl: string;
    planName: string;
  };
}

/**
 * Initiate and complete office plan upgrade in one call
 *
 * Flow:
 * 1. Calculate unused Basic credit (base amount, excluding GST)
 * 2. Credit the amount to founder's StoreWallet
 * 3. Cancel Basic subscription in Razorpay (immediate)
 * 4. Create new Pro subscription in Razorpay
 * 5. Return Pro subscription shortUrl for user authorization
 */
export async function initiateOfficeUpgrade(
  orgId: string,
  founderId: string,
): Promise<UpgradeResult> {
  // Get active subscription
  const subscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["active", "authenticated"] },
  }).populate("planId");

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  const currentPlan = subscription.planId as unknown as IOfficePlan;

  // Verify it's Basic plan
  if (currentPlan.slug !== "basic") {
    throw new Error("Can only upgrade from Basic plan");
  }

  // Verify subscription has billing cycle dates
  if (!subscription.currentStart || !subscription.currentEnd) {
    throw new Error("Subscription billing cycle not established");
  }

  // Verify subscription has Razorpay ID (not a trial)
  if (!subscription.razorpaySubscriptionId) {
    throw new Error(
      "Cannot upgrade trial subscription. Please subscribe first.",
    );
  }

  // Get Pro plan
  const proPlan = await getOfficePlanBySlug("pro");
  if (!proPlan || !proPlan.razorpayPlanId) {
    throw new Error("Pro plan not available");
  }

  // Calculate credit to wallet (credit is in plan's smallest unit: cents for USD)
  const credit = calculateUpgradeCredit(subscription, currentPlan);
  const creditAmountUSD = credit.creditAmount / 100; // Convert cents to dollars

  console.log(`[OfficeUpgrade] Starting upgrade for org ${orgId}`);
  console.log(
    `[OfficeUpgrade] Credit to wallet: $${creditAmountUSD} (${credit.daysRemaining} days remaining)`,
  );

  // Start MongoDB session for transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Step 1: Credit founder's wallet with unused Basic amount
    let walletTransaction: any = null;
    let walletBalance = 0;

    if (credit.creditAmount > 0) {
      const walletResult = await creditStoreWallet(
        founderId, // Acting as founder
        founderId, // Crediting to founder's own wallet
        orgId,
        creditAmountUSD,
        "Office upgrade credit: Unused Basic plan balance",
        `Upgrade from Basic to Pro. ${credit.daysRemaining} days remaining in billing cycle.`,
      );
      walletTransaction = walletResult.transaction;
      walletBalance = walletResult.wallet.balance;
      console.log(
        `[OfficeUpgrade] Credited $${creditAmountUSD} to founder's wallet`,
      );
    }

    // Step 2: Cancel Basic subscription in Razorpay (immediate cancellation)
    try {
      await cancelRazorpaySubscription(
        subscription.razorpaySubscriptionId,
        false,
      );
      console.log(
        `[OfficeUpgrade] Cancelled Basic subscription: ${subscription.razorpaySubscriptionId}`,
      );
    } catch (cancelError: any) {
      console.error(
        `[OfficeUpgrade] Failed to cancel Basic subscription:`,
        cancelError.message,
      );
      // If cancellation fails, we still try to proceed - user might have already cancelled
    }

    // Step 3: Get founder info for new subscription
    const founder = await User.findById(founderId)
      .select("name email phone")
      .lean();

    // Step 4: Create new Pro subscription in Razorpay
    const razorpaySubscription = await createRazorpaySubscription({
      plan_id: proPlan.razorpayPlanId,
      total_count: 120,
      customer_notify: 1,
      notes: {
        type: "office_subscription",
        orgId: orgId,
        founderId: founderId,
        planId: proPlan._id.toString(),
        planSlug: proPlan.slug,
        founderEmail: founder?.email || "",
        founderName: founder?.name || "",
        upgradedFrom: currentPlan.slug,
      },
    });

    console.log(
      `[OfficeUpgrade] Created Pro subscription: ${razorpaySubscription.id}`,
    );

    // Step 5: Delete old subscription record and create new one
    await OfficeSubscription.deleteOne({ _id: subscription._id }, { session });

    const newSubscription = await OfficeSubscription.create(
      [
        {
          orgId: new Types.ObjectId(orgId),
          founderId: new Types.ObjectId(founderId),
          planId: proPlan._id,
          razorpaySubscriptionId: razorpaySubscription.id,
          razorpayPlanId: proPlan.razorpayPlanId,
          status: "created",
          totalCount: razorpaySubscription.total_count || 120,
          paidCount: 0,
          remainingCount: razorpaySubscription.remaining_count || 120,
          shortUrl: razorpaySubscription.short_url,
        },
      ],
      { session },
    );

    // Step 6: Create upgrade history record
    await OfficeUpgradeHistory.create(
      [
        {
          orgId: new Types.ObjectId(orgId),
          founderId: new Types.ObjectId(founderId),
          previousSubscriptionId: subscription._id,
          previousRazorpaySubscriptionId: subscription.razorpaySubscriptionId,
          previousPlanSlug: currentPlan.slug,
          newSubscriptionId: newSubscription[0]._id,
          newRazorpaySubscriptionId: razorpaySubscription.id,
          newPlanSlug: proPlan.slug,
          creditCalculation: credit,
          walletTransactionId: walletTransaction?._id || new Types.ObjectId(), // Dummy if no credit
          status: "completed",
          completedAt: new Date(),
        },
      ],
      { session },
    );

    await session.commitTransaction();

    console.log(`[OfficeUpgrade] Upgrade completed for org ${orgId}`);
    console.log(
      `[OfficeUpgrade] New subscription ID: ${newSubscription[0]._id}`,
    );

    // Notify user
    emitToUser(founderId, "office:subscription:update", {
      type: "upgraded",
      orgId: orgId,
      previousPlan: currentPlan.slug,
      newPlan: proPlan.slug,
      creditedAmount: creditAmountUSD,
      subscriptionId: newSubscription[0]._id,
      shortUrl: razorpaySubscription.short_url,
    });

    return {
      success: true,
      creditedAmount: creditAmountUSD,
      walletBalance: walletBalance,
      subscription: {
        _id: newSubscription[0]._id.toString(),
        status: "created",
        shortUrl: razorpaySubscription.short_url!,
        planName: proPlan.name,
      },
    };
  } catch (error) {
    await session.abortTransaction();
    console.error(`[OfficeUpgrade] Failed for org ${orgId}:`, error);
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get upgrade history for an organization
 */
export async function getOfficeUpgradeHistory(
  orgId: string,
): Promise<IOfficeUpgradeHistory[]> {
  return OfficeUpgradeHistory.find({ orgId: new Types.ObjectId(orgId) })
    .sort({ createdAt: -1 })
    .lean();
}

// ============ Plan Downgrade Functions (Pro → Starter) ============
//
// End-of-cycle downgrade wired through OUR invoice system (not Razorpay).
// The founder keeps their paid Pro access through the full billing period
// they paid for — nothing is refunded, nothing is credited. At initiate:
//   1. Mark the recurring Pro parent invoice `cancelledAt = now` so the
//      daily `generateDueRecurringInvoices` cron stops minting Pro child
//      invoices for the next cycle. No new Pro invoice → no next charge.
//   2. Stash `scheduledDowngrade` metadata on the OfficeSubscription doc
//      so the FE can render "Downgrading on <date>" and the cron can find
//      it later.
// Starter is activated later by `processScheduledOfficeDowngrades()` — a
// daily job that scans for scheduledDowngrades whose effectiveAt has
// passed and runs the same switch code that used to run inline.
//
// v1 does not support un-cancelling: to keep Pro, the founder would need
// to re-subscribe through the normal /upgrade flow after the switch
// takes effect.

interface ScheduledDowngradeMeta {
  toSlug: "starter";
  requestedAt: Date;
  effectiveAt: Date;
  fromPlanSlug: string;
}

export interface DowngradePreview {
  canDowngrade: boolean;
  reason?: string;
  currentPlan?: {
    name: string;
    slug: string;
    amount: number; // base
    amountWithGst: number; // total
  };
  targetPlan?: {
    name: string;
    slug: string;
    amount: number; // 0 for starter
    amountWithGst: number; // 0
  };
  effectiveAt?: Date; // when the Starter switch actually happens (= current cycle end)
  alreadyScheduled?: boolean; // founder has already asked; showing status, not fresh CTA
  scheduledRequestedAt?: Date; // when the founder initiated the pending downgrade
  platformFeePercentageAfter?: number; // starter's 10% override, surfaced so founder sees the tradeoff
}

function readScheduledDowngrade(
  subscription: IOfficeSubscription | null,
): ScheduledDowngradeMeta | null {
  const meta = (subscription?.metadata as any)?.scheduledDowngrade;
  if (!meta || meta.toSlug !== "starter" || !meta.effectiveAt) return null;
  return {
    toSlug: "starter",
    requestedAt: new Date(meta.requestedAt),
    effectiveAt: new Date(meta.effectiveAt),
    fromPlanSlug: String(meta.fromPlanSlug || "pro"),
  };
}

export async function calculateDowngradePreview(
  orgId: string,
): Promise<DowngradePreview> {
  const subscription = await getActiveOfficeSubscription(orgId);
  if (!subscription) {
    return { canDowngrade: false, reason: "No active subscription found" };
  }

  const currentPlan = subscription.planId as unknown as IOfficePlan;
  if (!currentPlan) {
    return { canDowngrade: false, reason: "Current plan not found" };
  }

  if (currentPlan.slug !== "pro") {
    return {
      canDowngrade: false,
      reason:
        currentPlan.slug === "starter"
          ? "Already on Starter plan"
          : `Cannot downgrade from ${currentPlan.slug} plan`,
    };
  }

  if (!["active", "authenticated"].includes(subscription.status)) {
    return {
      canDowngrade: false,
      reason: "Subscription must be active to downgrade",
    };
  }

  if (!subscription.currentStart || !subscription.currentEnd) {
    return {
      canDowngrade: false,
      reason: "Subscription billing cycle not established",
    };
  }

  const starterPlan = await getOfficePlanBySlug("starter");
  if (!starterPlan) {
    return { canDowngrade: false, reason: "Starter plan not available" };
  }

  const currentGst = calculateTaxAmounts(currentPlan.amount, GST_CONFIG.rate);
  const starterFeeOverride =
    typeof starterPlan.platformFeeOverride === "number"
      ? starterPlan.platformFeeOverride
      : 10;

  const scheduled = readScheduledDowngrade(subscription);

  return {
    canDowngrade: !scheduled, // already-scheduled downgrades block re-scheduling
    reason: scheduled
      ? `Downgrade already scheduled for ${scheduled.effectiveAt.toISOString().slice(0, 10)}`
      : undefined,
    currentPlan: {
      name: currentPlan.name,
      slug: currentPlan.slug,
      amount: currentPlan.amount / 100,
      amountWithGst: currentGst.totalAmount / 100,
    },
    targetPlan: {
      name: starterPlan.name,
      slug: starterPlan.slug,
      amount: 0,
      amountWithGst: 0,
    },
    effectiveAt: scheduled?.effectiveAt || subscription.currentEnd,
    alreadyScheduled: !!scheduled,
    scheduledRequestedAt: scheduled?.requestedAt,
    platformFeePercentageAfter: starterFeeOverride,
  };
}

export interface DowngradeResult {
  success: boolean;
  effectiveAt: Date; // when Starter activation actually happens (Pro cycle end)
  subscription: {
    _id: string;
    status: string; // stays "active" — Pro access continues until effectiveAt
    planName: string; // still "Pro" until the switch fires
  };
}

export async function initiateOfficeDowngrade(
  orgId: string,
  founderId: string,
): Promise<DowngradeResult> {
  const { Invoice } = await import("../models/invoice.model");

  const subscription = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["active", "authenticated"] },
  }).populate("planId");

  if (!subscription) {
    throw new Error("No active subscription found");
  }

  const currentPlan = subscription.planId as unknown as IOfficePlan;
  if (currentPlan.slug !== "pro") {
    throw new Error("Can only downgrade from Pro plan");
  }

  if (!subscription.currentStart || !subscription.currentEnd) {
    throw new Error("Subscription billing cycle not established");
  }

  if (readScheduledDowngrade(subscription)) {
    throw new Error(
      "A downgrade is already scheduled for this subscription",
    );
  }

  const starterPlan = await getOfficePlanBySlug("starter");
  if (!starterPlan) {
    throw new Error("Starter plan not available");
  }

  const now = new Date();
  const effectiveAt = subscription.currentEnd;

  console.log(
    `[OfficeDowngrade] Scheduling Pro→Starter for org ${orgId}, effective ${effectiveAt.toISOString()}`,
  );

  // Load-bearing step: stop the invoice cron from generating any more
  // Pro or Pro-add-on charges. Three things get cancelled here:
  //   1. The paid recurring Pro parent invoice (root). Marking cancelledAt
  //      on it makes generateNextChildInvoice bail — no cycle N+1 mint.
  //   2. Any pre-minted draft/pending/unpaid child for cycle N+1 that the
  //      cron already sat on the founder's dashboard. Without this the
  //      founder would see a "you owe $96" invoice for a Pro cycle they
  //      won't consume, and payment against it would resurrect Pro.
  //   3. The recurring rooms parent invoice + any unpaid rooms children.
  //      Extra conference rooms are billed against a separate parent with
  //      metadata.type = "office_addon_subscription"; without cancelling
  //      it, a downgraded founder would keep paying $5/room/month after
  //      Starter kicks in even though Starter allows only 1 room.
  // Pro ACCESS keeps working through the cycle because canInviteStakeholders
  // and other gates read the OfficeSubscription doc, which we deliberately
  // leave "active" with planId=Pro until effectiveAt.
  const cancelResult = await Invoice.updateMany(
    {
      organizationId: new Types.ObjectId(orgId),
      cancelledAt: { $in: [null, undefined] },
      $or: [
        // 1. Paid root parent of the Pro subscription chain
        {
          "metadata.type": {
            $in: ["office_subscription", "office_trial", "office_upgrade"],
          },
          "metadata.planSlug": { $ne: "starter" },
          isRecurring: true,
          parentInvoiceId: { $in: [null, undefined] },
        },
        // 2. Pre-minted unpaid Pro child for cycle N+1 (child has parentInvoiceId
        //    set + status still open). Filtered by metadata to avoid touching
        //    any Starter free-plan children (planSlug guard mirrors #1).
        {
          "metadata.type": {
            $in: ["office_subscription", "office_trial", "office_upgrade"],
          },
          "metadata.planSlug": { $ne: "starter" },
          status: { $in: ["draft", "pending", "unpaid"] },
        },
        // 3. Rooms parent (paid, recurring) + any unpaid rooms children.
        //    Same metadata shape covers both because rooms invoices carry
        //    metadata.type = "office_addon_subscription" whether root or child.
        { "metadata.type": "office_addon_subscription" },
      ],
    },
    { $set: { cancelledAt: now } },
  );
  console.log(
    `[OfficeDowngrade] Cancelled ${cancelResult.modifiedCount} Pro/rooms invoice(s) for org ${orgId}`,
  );

  const scheduledMeta: ScheduledDowngradeMeta = {
    toSlug: "starter",
    requestedAt: now,
    effectiveAt,
    fromPlanSlug: currentPlan.slug,
  };
  subscription.metadata = {
    ...(subscription.metadata || {}),
    scheduledDowngrade: scheduledMeta,
  };
  await subscription.save();

  console.log(
    `[OfficeDowngrade] Scheduled downgrade stored on subscription ${subscription._id}`,
  );

  emitToUser(founderId, "office:subscription:update", {
    type: "downgrade-scheduled",
    orgId,
    fromPlan: currentPlan.slug,
    toPlan: starterPlan.slug,
    effectiveAt,
    subscriptionId: subscription._id,
  });

  return {
    success: true,
    effectiveAt,
    subscription: {
      _id: subscription._id.toString(),
      status: subscription.status,
      planName: currentPlan.name,
    },
  };
}

/**
 * Cron entry point: switch every subscription whose scheduled downgrade
 * has come due. Safe to run repeatedly (each activation deletes the
 * source sub, so a repeat run finds nothing to do).
 */
export async function processScheduledOfficeDowngrades(): Promise<number> {
  const now = new Date();
  const dueSubscriptions = await OfficeSubscription.find({
    "metadata.scheduledDowngrade.toSlug": "starter",
    "metadata.scheduledDowngrade.effectiveAt": { $lte: now },
    status: { $in: ["active", "authenticated", "cancelled"] },
  });

  if (dueSubscriptions.length === 0) return 0;

  console.log(
    `[OfficeDowngrade] Processing ${dueSubscriptions.length} scheduled downgrade(s)`,
  );

  let processed = 0;
  for (const sub of dueSubscriptions) {
    const scheduled = readScheduledDowngrade(sub);
    if (!scheduled) continue; // metadata shape guard
    try {
      await activateStarterForOrg(sub, {
        kind: "scheduled_downgrade",
        requestedAt: scheduled.requestedAt,
        fromPlanSlug: scheduled.fromPlanSlug,
      });
      processed++;
    } catch (err) {
      console.error(
        `[OfficeDowngrade] Failed to activate Starter for sub ${sub._id}:`,
        err,
      );
      // Continue to the next scheduled downgrade; failures don't cascade.
    }
  }

  return processed;
}

/**
 * Cron entry point: auto-downgrade every Pro sub whose grace period has
 * lapsed without payment. Pairs with the `hasActiveOfficeSubscription`
 * grace unlock — that keeps the office live for `OFFICE_GRACE_PERIOD_DAYS`,
 * this reclaims the tier at the end of that window.
 *
 * Safe to run repeatedly: `activateStarterForOrg` deletes the source
 * Pro sub, so a re-run finds nothing to do.
 */
export async function processExpiredOfficeGrace(): Promise<number> {
  const now = new Date();

  // Candidate query — cheap DB filter first, then the precise grace
  // check runs in Node (needs planId populated). We fetch every Pro sub
  // in a status that COULD have expired grace, then let
  // computeOfficeGraceState decide. Small population per run — a Pro
  // sub only sits in these statuses for at most the grace window.
  const candidates = await OfficeSubscription.find({
    status: {
      $in: ["created", "pending", "halted", "expired", "active", "authenticated"],
    },
    isTrial: { $ne: true },
    // Exclude subs already in the scheduled-downgrade flow — those are
    // handled by processScheduledOfficeDowngrades on their own timeline.
    "metadata.scheduledDowngrade.toSlug": { $ne: "starter" },
  }).populate("planId");

  if (candidates.length === 0) return 0;

  let processed = 0;
  for (const sub of candidates) {
    const plan = sub.planId as unknown as IOfficePlan | undefined;
    if (!plan || plan.slug !== "pro") continue;

    const grace = computeOfficeGraceState(sub, now);
    if (!grace.lapsed) continue;

    try {
      await activateStarterForOrg(sub, {
        kind: "grace_expired",
        graceEndsAt: grace.graceEndsAt || now,
        fromPlanSlug: plan.slug,
      });
      processed++;
    } catch (err) {
      console.error(
        `[OfficeGraceExpired] Failed to auto-downgrade sub ${sub._id}:`,
        err,
      );
    }
  }

  if (processed > 0) {
    console.log(
      `[OfficeGraceExpired] Auto-downgraded ${processed} Pro sub(s) to Starter after grace expiry`,
    );
  }
  return processed;
}

/**
 * Reason a Pro sub is being switched to Starter. Drives the audit-row
 * metadata + user-facing socket event so a founder can tell "I asked for
 * this" from "we did this because you didn't pay."
 */
type StarterActivationReason =
  | { kind: "scheduled_downgrade"; requestedAt: Date; fromPlanSlug: string }
  | { kind: "grace_expired"; graceEndsAt: Date; fromPlanSlug: string };

/**
 * Executes the Pro→Starter switch. Shared by two callers:
 *  - `processScheduledOfficeDowngrades` (founder-initiated end-of-cycle
 *    downgrade)
 *  - `processExpiredOfficeGrace` (grace period lapsed without payment)
 *
 * Both paths converge on the same DB shape: kill the old Pro sub, mint a
 * fresh Starter sub, apply Starter's platform-fee override, mint the $0
 * recurring parent invoice, log the audit row. The `reason` argument
 * only differs in how we describe the switch in logs + socket events.
 */
async function activateStarterForOrg(
  sourceSubscription: IOfficeSubscription,
  reason: StarterActivationReason,
): Promise<void> {
  const { Organization } = await import("../models/organization.model");
  const { Invoice } = await import("../models/invoice.model");
  const { createInvoice, getNextChargeDate } = await import("./invoice");

  const orgId = sourceSubscription.orgId.toString();
  const founderId = sourceSubscription.founderId.toString();
  const logTag = reason.kind === "grace_expired"
    ? "OfficeGraceExpired"
    : "OfficeDowngrade";

  const starterPlan = await getOfficePlanBySlug("starter");
  if (!starterPlan) {
    console.error(
      `[${logTag}] Cannot activate Starter for org ${orgId}: Starter plan missing`,
    );
    return;
  }

  console.log(
    `[${logTag}] Activating Starter for org ${orgId} (reason: ${reason.kind})`,
  );

  // Cancel any UNPAID recurring Pro invoices before switching so the cron
  // stops minting children off them. Paid invoices are historical.
  try {
    const orphanedCancel = await Invoice.updateMany(
      {
        organizationId: new Types.ObjectId(orgId),
        "metadata.type": {
          $in: ["office_subscription", "office_trial", "office_upgrade"],
        },
        isRecurring: true,
        status: { $in: ["draft", "pending", "unpaid"] },
        cancelledAt: { $in: [null, undefined] },
      },
      { $set: { cancelledAt: new Date() } },
    );
    if (orphanedCancel.modifiedCount > 0) {
      console.log(
        `[${logTag}] Cancelled ${orphanedCancel.modifiedCount} unpaid Pro invoice(s) for org ${orgId}`,
      );
    }
  } catch (err) {
    console.error(
      `[${logTag}] Failed to cancel unpaid invoices (non-blocking):`,
      err,
    );
  }

  // Snapshot current platform-fee %, then apply Starter's 10% override.
  const feeOverride =
    typeof starterPlan.platformFeeOverride === "number"
      ? starterPlan.platformFeeOverride
      : 10;
  const orgBefore = await Organization.findById(orgId)
    .select("paymentConfig")
    .lean();
  const previousPlatformFeePercentage =
    orgBefore?.paymentConfig?.platformFeePercentage ?? null;

  await Organization.findByIdAndUpdate(orgId, {
    $set: {
      "paymentConfig.platformFeePercentage": feeOverride,
      "paymentConfig.platformFeeUpdatedAt": new Date(),
      "paymentConfig.platformFeeUpdatedBy": null,
    },
  });

  // The old Pro sub is still occupying the unique orgId slot. Drop it and
  // mint the fresh Starter sub. History is preserved in the
  // OfficeUpgradeHistory record we log below.
  await OfficeSubscription.deleteOne({ _id: sourceSubscription._id });

  const now = new Date();
  const nextDue = getNextChargeDate(now, "monthly");

  const newSubscription = await OfficeSubscription.create({
    orgId: new Types.ObjectId(orgId),
    founderId: new Types.ObjectId(founderId),
    planId: starterPlan._id,
    status: "active",
    currentStart: now,
    currentEnd: nextDue,
    chargeAt: nextDue,
    startedAt: now,
    paidCount: 1,
    isTrial: false,
    metadata: {
      planSlug: "starter",
      platformFeeOverride: feeOverride,
      previousPlatformFeePercentage,
      downgradedFrom: reason.fromPlanSlug,
      ...(reason.kind === "scheduled_downgrade"
        ? { downgradeRequestedAt: reason.requestedAt }
        : { downgradeReason: "grace_expired", graceEndsAt: reason.graceEndsAt }),
    },
  });

  // Audit trail. Uses OfficeUpgradeHistory as a bidirectional plan-change
  // log; the direction marker + reason are stashed on metadata so the two
  // flows stay distinguishable. Starter has no Razorpay sub — schema
  // requires the field as a non-empty string, so we store a sentinel
  // value that's clearly not an id rather than dropping it.
  await OfficeUpgradeHistory.create({
    orgId: new Types.ObjectId(orgId),
    founderId: new Types.ObjectId(founderId),
    previousSubscriptionId: sourceSubscription._id,
    previousRazorpaySubscriptionId:
      sourceSubscription.razorpaySubscriptionId ||
      `none:pro-${sourceSubscription._id}`,
    previousPlanSlug: reason.fromPlanSlug,
    newSubscriptionId: newSubscription._id,
    newRazorpaySubscriptionId: `none:starter-${newSubscription._id}`,
    newPlanSlug: starterPlan.slug,
    creditCalculation: {
      currentPeriodStart: sourceSubscription.currentStart || now,
      currentPeriodEnd: sourceSubscription.currentEnd || now,
      upgradeDate: now,
      totalDaysInCycle: 0,
      daysRemaining: 0,
      creditAmount: 0,
    },
    walletTransactionId: new Types.ObjectId(),
    status: "completed",
    completedAt: new Date(),
    metadata: {
      direction: "downgrade",
      reason: reason.kind,
      ...(reason.kind === "scheduled_downgrade"
        ? { scheduledRequestedAt: reason.requestedAt }
        : { graceEndsAt: reason.graceEndsAt }),
    } as any,
  });

  // Mint the $0 recurring parent invoice — same shape as the starter
  // fast-path in /subscribe so the free-plan cron chains children off it.
  const founderDoc = await User.findById(founderId).select("name email").lean();
  const parentInvoice = await createInvoice({
    organizationId: orgId,
    sellerId: founderId,
    userId: founderId,
    customerEmail: founderDoc?.email || "",
    customerName: founderDoc?.name || undefined,
    lineItems: [
      {
        itemType: "office_plan",
        itemId: starterPlan._id.toString(),
        itemName: `Office ${starterPlan.name} Plan`,
        itemDescription: starterPlan.description,
        quantity: 1,
        unitPrice: 0,
        originalCurrency: starterPlan.currency || "USD",
      },
    ],
    itemCurrency: starterPlan.currency || "USD",
    isRecurring: true,
    recurringPeriod: "monthly",
    discount: 0,
    tax: 0,
    metadata: {
      type: "office_subscription",
      planSlug: "starter",
      kind: "office_free_plan",
      downgradedFrom: reason.fromPlanSlug,
      ...(reason.kind === "grace_expired"
        ? { downgradeReason: "grace_expired" }
        : {}),
    },
  });
  parentInvoice.nextDueDate = nextDue;
  parentInvoice.recurringPaymentNumber = 1;
  parentInvoice.status = "paid";
  parentInvoice.paidAt = now;
  await parentInvoice.save();

  console.log(
    `[${logTag}] Starter activated for org ${orgId}, subscription ${newSubscription._id}`,
  );

  emitToUser(founderId, "office:subscription:update", {
    type: reason.kind === "grace_expired" ? "auto-downgraded" : "downgraded",
    orgId,
    previousPlan: reason.fromPlanSlug,
    newPlan: starterPlan.slug,
    subscriptionId: newSubscription._id,
    reason: reason.kind,
  });
}

/**
 * Activate (or extend) an org's office subscription from a PAID invoice that
 * never went through Razorpay.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * `fulfillInvoice`'s `office_plan` case used to fire the Pro commission and
 * then `return { status: "payment_recorded" }` — nothing else. Activation
 * lived exclusively in the Razorpay webhook handlers, so ANY office invoice
 * settled another way (wallet, crypto, or a 100%-off coupon) took the
 * customer's money, paid the upline, and delivered no office at all.
 *
 * That is exactly what happened to org 6a0207e0e7ce4252ed4b1d17 on
 * 2026-09-01: twelve FOUNDERSOFFICE cycles paid, $888 of commission
 * distributed, `officeSubscriptionId` absent on all twelve invoices, and the
 * founder presented with a fresh $113.28 bill the next day.
 *
 * ── Behaviour ────────────────────────────────────────────────────────────
 * Idempotent per invoice: the invoice's id is recorded in
 * `metadata.appliedInvoiceIds` and a second call for the same invoice is a
 * no-op. That matters because each cycle of a recurring chain calls this
 * separately, and a webhook/cron replay must not hand out extra months.
 *
 * Extension is CUMULATIVE — each paid invoice adds one billing period to
 * whichever is later, `currentEnd` or now. Twelve cycles paid in three
 * seconds therefore yield twelve months of runway, not one.
 *
 * `orgId` is unique on the collection, so this updates the existing row when
 * there is one rather than trying to insert a second.
 */
export async function activateOfficeFromPaidInvoice(
  invoice: any,
): Promise<{ status: "activated" | "extended" | "already_applied" | "skipped"; subscriptionId?: string }> {
  const orgId = invoice.organizationId;
  const founderId = invoice.userId;
  if (!orgId || !founderId) return { status: "skipped" };

  const planId = invoice.lineItems?.[0]?.itemId;
  if (!planId) return { status: "skipped" };

  const plan: any = await OfficePlan.findById(planId).lean();
  if (!plan) return { status: "skipped" };

  const invoiceKey = String(invoice._id);
  const { getNextChargeDate } = await import("./invoice");
  const now = new Date();

  const existing = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(String(orgId)),
  });

  // ── Idempotency ──
  if (existing?.metadata?.appliedInvoiceIds?.includes(invoiceKey)) {
    return { status: "already_applied", subscriptionId: String(existing._id) };
  }

  // Extend from the later of "now" and the current period end, so a lapsed
  // subscription restarts today rather than back-dating the new period into
  // a window the customer already lost.
  const anchor =
    existing?.currentEnd && existing.currentEnd > now ? existing.currentEnd : now;
  const nextEnd = getNextChargeDate(anchor, plan.period || "monthly");

  if (!existing) {
    const created = await OfficeSubscription.create({
      orgId: new Types.ObjectId(String(orgId)),
      founderId: new Types.ObjectId(String(founderId)),
      planId: plan._id,
      // Schema requires a non-empty string; there is no Razorpay plan on
      // this path, so store a sentinel that is obviously not an id.
      razorpayPlanId: "non_razorpay",
      status: "active",
      currentStart: now,
      currentEnd: nextEnd,
      chargeAt: nextEnd,
      startedAt: now,
      paidCount: 1,
      isTrial: false,
      paymentMethod: "wallet",
      metadata: {
        planSlug: plan.slug,
        activatedFrom: "paid_invoice_non_razorpay",
        appliedInvoiceIds: [invoiceKey],
      },
    });
    void refreshTypeFlags(created.founderId);
    return { status: "activated", subscriptionId: String(created._id) };
  }

  existing.status = "active";
  existing.planId = plan._id;
  existing.currentStart = existing.currentStart || now;
  existing.currentEnd = nextEnd;
  existing.chargeAt = nextEnd;
  existing.startedAt = existing.startedAt || now;
  existing.paidCount = (existing.paidCount || 0) + 1;
  existing.isTrial = false;
  existing.cancelledAt = undefined;
  existing.metadata = {
    ...(existing.metadata || {}),
    planSlug: plan.slug,
    activatedFrom: "paid_invoice_non_razorpay",
    appliedInvoiceIds: [
      ...((existing.metadata?.appliedInvoiceIds as string[]) || []),
      invoiceKey,
    ],
  };
  await existing.save();
  void refreshTypeFlags(existing.founderId);
  return { status: "extended", subscriptionId: String(existing._id) };
}
