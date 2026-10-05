import mongoose, { Types } from "mongoose";
import {
  OfficeAddon,
  IOfficeAddon,
  OFFICE_ADDONS_CONFIG,
  ADDON_COMMISSION_STRUCTURE,
  calculateAddonTaxAmounts,
  extractAddonBaseFromTotal,
  ADDON_GST_CONFIG,
} from "../models/officeAddon.model";
import {
  OfficeAddonSubscription,
  IOfficeAddonSubscription,
  OfficeAddonSubscriptionStatus,
} from "../models/officeAddonSubscription.model";
import {
  OfficeAddonPayment,
  IOfficeAddonPayment,
} from "../models/officeAddonPayment.model";
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
import { hasActiveOfficeSubscription } from "./officeSubscription";
import { creditAffiliateOrPlatform } from "./wallet";
import { convertInrToUsd } from "../utils/exchangeRate";

// Platform configuration (same as office subscriptions)
const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951"; // The Network Economy

// TEST ONLY: Hardcoded org IDs that bypass add-on subscription check (remove after testing)
const TEST_ADDON_UNLOCKED_ORG_IDS: string[] = ["694aac9cac3487774ba44f56"];

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

// ============ Add-on Initialization ============

/**
 * Initialize office add-ons in database and Razorpay
 * Run this once on startup or via admin endpoint
 *
 * GST CAVEAT: the `amount` sent to Razorpay below is base + 18% GST — an
 * ITEM-level figure shared by every org. These plans are dormant (add-ons
 * never create an invoice through them; the only add-on billing that produces
 * an invoice is the conference-room path in routes/officeCheckout.ts, which
 * is org-region gated). If Razorpay subscriptions are ever switched on, split
 * these per tax region (IN / INTL) first — see the same note in
 * services/officeSubscription.ts.
 */
export async function initializeOfficeAddons(): Promise<IOfficeAddon[]> {
  const addons: IOfficeAddon[] = [];
  const { fetchPlan } = await import("./razorpay");

  for (const [slug, config] of Object.entries(OFFICE_ADDONS_CONFIG)) {
    // Check if add-on already exists in DB
    const addonDoc = await OfficeAddon.findOne({ slug }).lean();
    let addon = addonDoc ? await OfficeAddon.findOne({ slug }) : null;

    if (addon && addon.razorpayPlanId) {
      // Verify the Razorpay plan ID is valid
      try {
        await fetchPlan(addon.razorpayPlanId);

        // Check if amount changed - if so, we MUST create a new Razorpay plan
        const amountChanged = addon.amount !== config.amount;

        if (amountChanged) {
          console.log(
            `[OfficeAddon] Add-on "${slug}" amount changed (${addon.amount} -> ${config.amount}), creating new Razorpay plan...`
          );

          // Calculate total amount (base + GST) to pass to Razorpay
          const { totalAmount } = calculateAddonTaxAmounts(
            config.amount,
            config.taxRate
          );

          const razorpayPlan = await createRazorpayPlan({
            period: "yearly",
            interval: 1,
            item: {
              name: `Office ${config.name} Add-on`,
              amount: totalAmount, // Total amount including GST
              currency: config.currency,
              description: config.description,
              tax_inclusive: true,
              sac_code: config.sacCode,
            },
            notes: {
              planType: "office_addon",
              slug,
              baseAmount: String(config.amount),
              taxRate: String(config.taxRate),
              sacCode: config.sacCode,
            },
          });

          // Update add-on with new Razorpay ID and all fields
          await OfficeAddon.updateOne(
            { _id: addon._id },
            {
              $set: {
                razorpayPlanId: razorpayPlan.id,
                amount: config.amount,
                taxRate: config.taxRate,
                taxInclusive: config.taxInclusive,
                sacCode: config.sacCode,
                name: config.name,
                description: config.description,
                features: config.features,
              },
            }
          );

          console.log(
            `[OfficeAddon] Add-on "${slug}" updated with new Razorpay ID: ${razorpayPlan.id}`
          );
          const updatedAddon = await OfficeAddon.findOne({ slug });
          addons.push(updatedAddon!);
          continue;
        }

        // Amount unchanged - just update other fields in-place
        const updateFields: any = {};
        if (addon.name !== config.name) updateFields.name = config.name;
        if (addon.description !== config.description)
          updateFields.description = config.description;
        if (JSON.stringify(addon.features) !== JSON.stringify(config.features))
          updateFields.features = config.features;

        if (Object.keys(updateFields).length > 0) {
          await OfficeAddon.updateOne(
            { _id: addon._id },
            { $set: updateFields }
          );
          console.log(
            `[OfficeAddon] Add-on "${slug}" updated with new fields:`,
            Object.keys(updateFields).join(", ")
          );
          addon = await OfficeAddon.findOne({ slug });
        } else {
          console.log(
            `[OfficeAddon] Add-on "${slug}" verified, no updates needed (Razorpay ID: ${addon.razorpayPlanId})`
          );
        }

        addons.push(addon!);
        continue;
      } catch (error: any) {
        // Razorpay plan doesn't exist - need to create a new one
        console.log(
          `[OfficeAddon] Add-on "${slug}" has invalid Razorpay ID, creating new Razorpay plan...`
        );

        const { totalAmount } = calculateAddonTaxAmounts(
          config.amount,
          config.taxRate
        );

        const razorpayPlan = await createRazorpayPlan({
          period: "yearly",
          interval: 1,
          item: {
            name: `Office ${config.name} Add-on`,
            amount: totalAmount,
            currency: config.currency,
            description: config.description,
            tax_inclusive: true,
            sac_code: config.sacCode,
          },
          notes: {
            planType: "office_addon",
            slug,
            baseAmount: String(config.amount),
            taxRate: String(config.taxRate),
            sacCode: config.sacCode,
          },
        });

        // Update existing add-on with new Razorpay ID
        await OfficeAddon.updateOne(
          { _id: addon!._id },
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
            },
          }
        );

        console.log(
          `[OfficeAddon] Add-on "${slug}" updated with new Razorpay ID: ${razorpayPlan.id}`
        );
        const updatedAddon = await OfficeAddon.findOne({ slug });
        addons.push(updatedAddon!);
        continue;
      }
    }

    // Add-on exists but has no razorpayPlanId - create Razorpay plan and update
    if (addon && !addon.razorpayPlanId) {
      console.log(
        `[OfficeAddon] Add-on "${slug}" missing Razorpay ID, creating...`
      );

      const { totalAmount } = calculateAddonTaxAmounts(
        config.amount,
        config.taxRate
      );

      const razorpayPlan = await createRazorpayPlan({
        period: "yearly",
        interval: 1,
        item: {
          name: `Office ${config.name} Add-on`,
          amount: totalAmount,
          currency: config.currency,
          description: config.description,
          tax_inclusive: true,
          sac_code: config.sacCode,
        },
        notes: {
          planType: "office_addon",
          slug,
          baseAmount: String(config.amount),
          taxRate: String(config.taxRate),
          sacCode: config.sacCode,
        },
      });

      // Update existing add-on
      await OfficeAddon.updateOne(
        { _id: addon._id },
        {
          $set: {
            razorpayPlanId: razorpayPlan.id,
            taxRate: config.taxRate,
            taxInclusive: config.taxInclusive,
            sacCode: config.sacCode,
          },
        }
      );

      console.log(
        `[OfficeAddon] Add-on "${slug}" updated with Razorpay ID: ${razorpayPlan.id}`
      );
      const updatedAddon = await OfficeAddon.findOne({ slug });
      addons.push(updatedAddon!);
      continue;
    }

    // No add-on exists at all - create from scratch
    console.log(`[OfficeAddon] Creating new "${slug}" add-on in Razorpay...`);

    const { totalAmount } = calculateAddonTaxAmounts(
      config.amount,
      config.taxRate
    );

    const razorpayPlan = await createRazorpayPlan({
      period: "yearly",
      interval: 1,
      item: {
        name: `Office ${config.name} Add-on`,
        amount: totalAmount,
        currency: config.currency,
        description: config.description,
        tax_inclusive: true,
        sac_code: config.sacCode,
      },
      notes: {
        planType: "office_addon",
        slug,
        baseAmount: String(config.amount),
        taxRate: String(config.taxRate),
        sacCode: config.sacCode,
      },
    });

    // Create add-on in database
    const newAddon = await OfficeAddon.create({
      ...config,
      razorpayPlanId: razorpayPlan.id,
    });

    console.log(
      `[OfficeAddon] Created add-on "${slug}" with Razorpay ID: ${razorpayPlan.id}`
    );
    addons.push(newAddon);
  }

  return addons;
}

/**
 * Get all active office add-ons
 */
export async function getOfficeAddons(): Promise<IOfficeAddon[]> {
  return OfficeAddon.find({ isActive: true }).sort({ amount: 1 }).lean();
}

/**
 * Get office add-on by slug
 */
export async function getOfficeAddonBySlug(
  slug: string
): Promise<IOfficeAddon | null> {
  return OfficeAddon.findOne({ slug, isActive: true }).lean();
}

// ============ Add-on Subscription Management ============

export interface CreateOfficeAddonSubscriptionInput {
  orgId: string;
  founderId: string;
  addonSlug: string;
  founderEmail?: string;
  founderName?: string;
  founderPhone?: string;
  gstin?: string;
  offerId?: string; // Optional Razorpay offer ID for coupon discounts
}

/**
 * Create an office add-on subscription for an organization
 * Requires org to have an active office plan (Basic or Pro)
 */
export async function createOfficeAddonSubscription(
  input: CreateOfficeAddonSubscriptionInput
): Promise<IOfficeAddonSubscription> {
  const {
    orgId,
    founderId,
    addonSlug,
    founderEmail,
    founderName,
    founderPhone,
    gstin,
    offerId,
  } = input;

  // Check if org has an active office subscription first
  const hasActiveOfficeSub = await hasActiveOfficeSubscription(orgId);
  if (!hasActiveOfficeSub) {
    throw new Error(
      "Organization must have an active office plan to purchase add-ons"
    );
  }

  // Get add-on
  const addon = await OfficeAddon.findOne({ slug: addonSlug, isActive: true });
  if (!addon) {
    throw new Error(`Office add-on "${addonSlug}" not found`);
  }

  if (!addon.razorpayPlanId) {
    throw new Error(
      `Office add-on "${addonSlug}" is not configured in Razorpay`
    );
  }

  // Check if org already has this add-on
  const existingSubscription = await OfficeAddonSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    addonId: addon._id,
    status: { $in: ["created", "authenticated", "active", "pending"] },
  });

  if (existingSubscription) {
    throw new Error("Organization already has this add-on subscription");
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
          type: "office_addon_customer",
        },
      });
      razorpayCustomerId = customer.id;
      console.log(
        `[OfficeAddonSubscription] Created Razorpay customer with GSTIN: ${customer.id}`
      );
    } catch (error: any) {
      console.error(
        `[OfficeAddonSubscription] Failed to create Razorpay customer:`,
        error.message
      );
    }
  }

  // Create subscription in Razorpay
  // total_count: 10 for 10 years of annual billing
  const razorpaySubscriptionOptions: any = {
    plan_id: addon.razorpayPlanId,
    total_count: 10, // 10 years for yearly billing
    customer_notify: 1,
    customer_id: razorpayCustomerId,
    notes: {
      type: "office_addon_subscription",
      orgId,
      founderId,
      addonId: addon._id.toString(),
      addonSlug: addon.slug,
      founderEmail: founderEmail || "",
      founderName: founderName || "",
      gstin: gstin || "",
    },
  };

  // Add offer_id if coupon has razorpayOfferId
  if (offerId) {
    razorpaySubscriptionOptions.offer_id = offerId;
    console.log(`[OfficeAddonSubscription] Applying Razorpay offer: ${offerId}`);
  }

  const razorpaySubscription = await createRazorpaySubscription(razorpaySubscriptionOptions);

  // Create subscription in database
  const subscription = await OfficeAddonSubscription.create({
    orgId: new Types.ObjectId(orgId),
    founderId: new Types.ObjectId(founderId),
    addonId: addon._id,
    razorpaySubscriptionId: razorpaySubscription.id,
    razorpayPlanId: addon.razorpayPlanId,
    razorpayCustomerId:
      razorpaySubscription.customer_id || razorpayCustomerId || undefined,
    status: "created",
    totalCount: razorpaySubscription.total_count || 10,
    paidCount: 0,
    remainingCount: razorpaySubscription.remaining_count || 10,
    shortUrl: razorpaySubscription.short_url,
  });

  console.log(
    `[OfficeAddonSubscription] Created subscription for org ${orgId}, addon ${addonSlug}: ${subscription._id}`
  );

  return subscription;
}

/**
 * Get office add-on subscription for an organization
 */
export async function getOfficeAddonSubscription(
  orgId: string,
  addonSlug?: string
): Promise<IOfficeAddonSubscription | null> {
  const query: any = { orgId: new Types.ObjectId(orgId) };

  if (addonSlug) {
    const addon = await OfficeAddon.findOne({ slug: addonSlug }).lean();
    if (!addon) return null;
    query.addonId = addon._id;
  }

  return OfficeAddonSubscription.findOne(query)
    .sort({ createdAt: -1 })
    .populate("addonId")
    .lean();
}

/**
 * Get all office add-on subscriptions for an organization
 */
export async function getOfficeAddonSubscriptions(
  orgId: string
): Promise<IOfficeAddonSubscription[]> {
  return OfficeAddonSubscription.find({
    orgId: new Types.ObjectId(orgId),
  })
    .sort({ createdAt: -1 })
    .populate("addonId")
    .lean();
}

/**
 * Get active office add-on subscription for an organization
 */
export async function getActiveOfficeAddonSubscription(
  orgId: string,
  addonSlug?: string
): Promise<IOfficeAddonSubscription | null> {
  const query: any = {
    orgId: new Types.ObjectId(orgId),
    status: { $in: ["active", "authenticated"] },
  };

  if (addonSlug) {
    const addon = await OfficeAddon.findOne({ slug: addonSlug }).lean();
    if (!addon) return null;
    query.addonId = addon._id;
  }

  return OfficeAddonSubscription.findOne(query).populate("addonId").lean();
}

/**
 * Check if organization has an active add-on
 */
export async function hasActiveAddon(
  orgId: string,
  addonSlug: string
): Promise<boolean> {
  // TEST ONLY: Check if org is in hardcoded test list (remove after testing)
  if (TEST_ADDON_UNLOCKED_ORG_IDS.includes(orgId)) {
    return true;
  }

  const subscription = await getActiveOfficeAddonSubscription(orgId, addonSlug);

  if (!subscription) {
    return false;
  }

  // Check if subscription is still valid
  if (subscription.currentEnd && subscription.currentEnd < new Date()) {
    return false;
  }

  return true;
}

/**
 * Sync add-on subscription status with Razorpay
 */
export async function syncOfficeAddonSubscriptionStatus(
  subscriptionId: string
): Promise<IOfficeAddonSubscription | null> {
  const subscription = await OfficeAddonSubscription.findById(subscriptionId);
  if (!subscription) {
    return null;
  }

  // Only relevant for Razorpay-backed subscriptions. Invoice-based
  // whitelabel subs (metadata.source === "invoice") don't have a
  // Razorpay counterpart to sync from — return the local doc as-is.
  if (!subscription.razorpaySubscriptionId) {
    return subscription.toObject() as any;
  }
  const razorpaySubscription = await fetchRazorpaySubscription(
    subscription.razorpaySubscriptionId
  );

  subscription.status =
    razorpaySubscription.status as OfficeAddonSubscriptionStatus;
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
 * Handle add-on subscription authenticated event
 */
export async function handleOfficeAddonSubscriptionAuthenticated(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  console.log(
    `[OfficeAddonSubscription] Authenticated webhook received. Notes type: ${razorpaySubscription.notes?.type}, ID: ${razorpaySubscription.id}`
  );

  // Check if this is an add-on subscription
  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    console.log(
      `[OfficeAddonSubscription] Skipping - not an addon subscription (type: ${razorpaySubscription.notes?.type})`
    );
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling authenticated event for: ${razorpaySubscription.id}`
  );

  let subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription && razorpaySubscription.notes?.orgId) {
    const addon = await OfficeAddon.findOne({
      slug: razorpaySubscription.notes.addonSlug,
    });
    if (addon) {
      subscription = await OfficeAddonSubscription.findOne({
        orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
        addonId: addon._id,
        status: "created",
      });

      if (subscription) {
        subscription.razorpaySubscriptionId = razorpaySubscription.id;
      }
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeAddonSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  subscription.status = "authenticated";
  subscription.razorpayCustomerId =
    razorpaySubscription.customer_id || undefined;
  subscription.paymentMethod = razorpaySubscription.payment_method as any;
  await subscription.save();

  console.log(`[OfficeAddonSubscription] ${subscription._id} authenticated`);
}

/**
 * Handle add-on subscription activated event (first payment successful)
 */
export async function handleOfficeAddonSubscriptionActivated(
  razorpaySubscription: RazorpaySubscription,
  payment?: any
): Promise<void> {
  console.log(
    `[OfficeAddonSubscription] Activated webhook received. Notes type: ${razorpaySubscription.notes?.type}, ID: ${razorpaySubscription.id}`
  );

  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    console.log(
      `[OfficeAddonSubscription] Skipping activated - not an addon subscription (type: ${razorpaySubscription.notes?.type})`
    );
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling activated event for: ${razorpaySubscription.id}`
  );

  let subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  }).populate("addonId");

  if (!subscription && razorpaySubscription.notes?.orgId) {
    const addon = await OfficeAddon.findOne({
      slug: razorpaySubscription.notes.addonSlug,
    });
    if (addon) {
      subscription = await OfficeAddonSubscription.findOne({
        orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
        addonId: addon._id,
        status: { $in: ["created", "authenticated"] },
      }).populate("addonId");

      if (subscription) {
        subscription.razorpaySubscriptionId = razorpaySubscription.id;
      }
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeAddonSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  const addon = subscription.addonId as unknown as IOfficeAddon;

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

  // Record payment if provided
  if (payment) {
    await recordOfficeAddonPayment(subscription, addon, payment, 1);
  }

  // Distribute commission for first payment
  await distributeAddonCommission(
    subscription,
    addon,
    1,
    payment?.amount || addon.amount
  );

  // Notify user
  emitToUser(subscription.founderId, "office:addon:update", {
    type: "activated",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    addonName: addon.name,
    currentEnd: subscription.currentEnd,
  });

  console.log(`[OfficeAddonSubscription] ${subscription._id} activated`);
}

/**
 * Handle add-on subscription charged event (recurring payment successful)
 */
export async function handleOfficeAddonSubscriptionCharged(
  razorpaySubscription: RazorpaySubscription,
  payment: any
): Promise<void> {
  console.log(
    `[OfficeAddonSubscription] Charged webhook received. Notes type: ${razorpaySubscription.notes?.type}, ID: ${razorpaySubscription.id}`
  );

  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    console.log(
      `[OfficeAddonSubscription] Skipping charged - not an addon subscription (type: ${razorpaySubscription.notes?.type})`
    );
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling charged event for: ${razorpaySubscription.id}`
  );

  let subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  }).populate("addonId");

  if (!subscription && razorpaySubscription.notes?.orgId) {
    const addon = await OfficeAddon.findOne({
      slug: razorpaySubscription.notes.addonSlug,
    });
    if (addon) {
      subscription = await OfficeAddonSubscription.findOne({
        orgId: new Types.ObjectId(razorpaySubscription.notes.orgId),
        addonId: addon._id,
      }).populate("addonId");

      if (subscription) {
        subscription.razorpaySubscriptionId = razorpaySubscription.id;
      }
    }
  }

  if (!subscription) {
    console.error(
      `[OfficeAddonSubscription] Not found for Razorpay ID: ${razorpaySubscription.id}`
    );
    return;
  }

  const addon = subscription.addonId as unknown as IOfficeAddon;
  const paymentNumber = razorpaySubscription.paid_count;

  // Update subscription
  if (
    subscription.status === "created" ||
    subscription.status === "authenticated"
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

  // Record payment
  await recordOfficeAddonPayment(subscription, addon, payment, paymentNumber);

  // Distribute commission
  await distributeAddonCommission(
    subscription,
    addon,
    paymentNumber,
    payment.amount
  );

  // Notify user
  emitToUser(subscription.founderId, "office:addon:update", {
    type: "charged",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    paymentNumber,
    currentEnd: subscription.currentEnd,
    nextChargeDate: subscription.chargeAt,
  });

  console.log(
    `[OfficeAddonSubscription] ${subscription._id} charged (payment #${paymentNumber})`
  );
}

/**
 * Handle add-on subscription halted event
 */
export async function handleOfficeAddonSubscriptionHalted(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling halted event for: ${razorpaySubscription.id}`
  );

  const subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.log(
      `[OfficeAddonSubscription] Subscription ${razorpaySubscription.id} not found in DB`
    );
    return;
  }

  subscription.status = "halted";
  await subscription.save();

  emitToUser(subscription.founderId, "office:addon:update", {
    type: "halted",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    message:
      "Your add-on subscription payment failed. Please update your payment method.",
  });

  console.log(`[OfficeAddonSubscription] ${subscription._id} halted`);
}

/**
 * Handle add-on subscription cancelled event
 */
export async function handleOfficeAddonSubscriptionCancelled(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling cancelled event for: ${razorpaySubscription.id}`
  );

  const subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.log(
      `[OfficeAddonSubscription] Subscription ${razorpaySubscription.id} not found in DB`
    );
    return;
  }

  subscription.status = "cancelled";
  subscription.endedAt =
    unixToDate(razorpaySubscription.ended_at) || new Date();
  await subscription.save();

  emitToUser(subscription.founderId, "office:addon:update", {
    type: "cancelled",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    endDate: subscription.currentEnd,
  });

  console.log(`[OfficeAddonSubscription] ${subscription._id} cancelled`);
}

/**
 * Handle add-on subscription pending event
 */
export async function handleOfficeAddonSubscriptionPending(
  razorpaySubscription: RazorpaySubscription
): Promise<void> {
  if (razorpaySubscription.notes?.type !== "office_addon_subscription") {
    return;
  }

  console.log(
    `[OfficeAddonSubscription] Handling pending event for: ${razorpaySubscription.id}`
  );

  const subscription = await OfficeAddonSubscription.findOne({
    razorpaySubscriptionId: razorpaySubscription.id,
  });

  if (!subscription) {
    console.log(
      `[OfficeAddonSubscription] Subscription ${razorpaySubscription.id} not found in DB`
    );
    return;
  }

  subscription.status = "pending";
  await subscription.save();

  emitToUser(subscription.founderId, "office:addon:update", {
    type: "pending",
    subscriptionId: subscription._id,
    orgId: subscription.orgId,
    message: "Payment is pending. Please check your payment method.",
  });

  console.log(`[OfficeAddonSubscription] ${subscription._id} pending`);
}

// ============ Helper Functions ============

/**
 * Record an add-on subscription payment
 */
async function recordOfficeAddonPayment(
  subscription: IOfficeAddonSubscription,
  addon: IOfficeAddon,
  payment: any,
  paymentNumber: number
): Promise<IOfficeAddonPayment> {
  // Check for duplicate
  const existing = await OfficeAddonPayment.findOne({
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
        `[OfficeAddonPayment] Fetched invoice short_url: ${invoiceShortUrl}`
      );
    } catch (error) {
      console.error(
        `[OfficeAddonPayment] Failed to fetch invoice ${payment.invoice_id}:`,
        error
      );
    }
  }

  const addonPayment = await OfficeAddonPayment.create({
    subscriptionId: subscription._id,
    addonId: addon._id,
    orgId: subscription.orgId,
    founderId: subscription.founderId,
    razorpayPaymentId: payment.id,
    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
    razorpayOrderId: payment.order_id,
    razorpayInvoiceId: payment.invoice_id,
    invoiceShortUrl,
    amount: payment.amount,
    currency: payment.currency || "INR",
    status: payment.status === "captured" ? "captured" : "authorized",
    paymentNumber,
    method: payment.method,
    cardId: payment.card_id,
    bank: payment.bank,
    wallet: payment.wallet,
    vpa: payment.vpa,
    fee: payment.fee,
    tax: payment.tax,
    commissionDistributed: false,
    paidAt: new Date(payment.created_at * 1000),
  });

  return addonPayment;
}

/**
 * Distribute commission for add-on subscription payment
 * Uses same structure as office plans: L1 = 15%, L2 = 10%, L3 = 2.5%, L4 = 2.5%
 */
async function distributeAddonCommission(
  subscription: IOfficeAddonSubscription,
  addon: IOfficeAddon,
  paymentNumber: number,
  amountInPaise: number
): Promise<void> {
  try {
    // Check if already distributed
    const existingPayment = await OfficeAddonPayment.findOne({
      subscriptionId: subscription._id,
      paymentNumber,
      commissionDistributed: true,
    });

    if (existingPayment) {
      console.log(
        `[AddonCommission] Already distributed for subscription ${subscription._id} payment #${paymentNumber}`
      );
      return;
    }

    // Extract base amount (excluding GST) for commission calculation
    const taxRate = addon.taxRate ?? ADDON_GST_CONFIG.rate;
    const { baseAmount: baseAmountPaise, taxAmount: gstAmountPaise } =
      extractAddonBaseFromTotal(amountInPaise, taxRate);

    // Convert from smallest unit (cents/paise) to currency unit
    let baseAmountUSD: number;
    let gstAmountUSD: number;
    let totalAmountUSD: number;
    let exchangeRate: number | undefined;

    if (addon.currency === "INR") {
      // Legacy INR subscription — convert to USD
      const baseAmountInINR = baseAmountPaise / 100;
      const gstAmountInINR = gstAmountPaise / 100;
      const totalAmountInINR = amountInPaise / 100;
      const converted = await convertInrToUsd(baseAmountInINR);
      baseAmountUSD = converted.usdAmount;
      exchangeRate = converted.exchangeRate;
      gstAmountUSD = Math.round((gstAmountInINR / converted.exchangeRate) * 100) / 100;
      totalAmountUSD = Math.round((totalAmountInINR / converted.exchangeRate) * 100) / 100;
      console.log(
        `[AddonCommission] Legacy INR payment - Total: ₹${totalAmountInINR}, Base: ₹${baseAmountInINR} ($${baseAmountUSD} @ ${exchangeRate}), GST (${taxRate}%): ₹${gstAmountInINR}`
      );
    } else {
      // USD subscription — direct cents to dollars
      baseAmountUSD = baseAmountPaise / 100;
      gstAmountUSD = gstAmountPaise / 100;
      totalAmountUSD = amountInPaise / 100;
      console.log(
        `[AddonCommission] Payment breakdown - Total: $${totalAmountUSD}, Base: $${baseAmountUSD}, GST (${taxRate}%): $${gstAmountUSD}`
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

    // Get founder (for referral chain)
    const founder = await User.findById(subscription.founderId)
      .select("referredBy")
      .lean();

    // Calculate commissions using hardcoded structure (4 levels), in USD
    const l1Commission =
      Math.round((baseAmountUSD * ADDON_COMMISSION_STRUCTURE.level1Percentage) / 100 * 100) / 100;
    const l2Commission =
      Math.round((baseAmountUSD * ADDON_COMMISSION_STRUCTURE.level2Percentage) / 100 * 100) / 100;
    const l3Commission =
      Math.round((baseAmountUSD * ADDON_COMMISSION_STRUCTURE.level3Percentage) / 100 * 100) / 100;
    const l4Commission =
      Math.round((baseAmountUSD * ADDON_COMMISSION_STRUCTURE.level4Percentage) / 100 * 100) / 100;

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
          percentage: ADDON_COMMISSION_STRUCTURE.level1Percentage,
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
              percentage: ADDON_COMMISSION_STRUCTURE.level2Percentage,
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
                  percentage: ADDON_COMMISSION_STRUCTURE.level3Percentage,
                });
                totalCommission += l3Commission;

                // L4 - L3's referrer
                if (l3Referrer.referredBy) {
                  commissions.push({
                    userId: l3Referrer.referredBy.toString(),
                    level: 4,
                    amount: l4Commission,
                    percentage: ADDON_COMMISSION_STRUCTURE.level4Percentage,
                  });
                  totalCommission += l4Commission;
                }
              }
            }
          }
        }
      }
    }

    // Platform gets the rest of the BASE amount in USD
    const platformAmount = Math.round((baseAmountUSD - totalCommission) * 100) / 100;

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
          { session }
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
            description: `Office add-on: ${addon.name}`,
            note: `Office add-on payment #${paymentNumber}. Org: ${subscription.orgId}`,
            relatedUserId: subscription.founderId,
            metadata: {
              subscriptionId: subscription._id,
              addonId: addon._id,
              addonName: addon.name,
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
        { session }
      );

      // Credit affiliate wallets (routes to platform if not UP-activated)
      for (const commission of commissions) {
        await creditAffiliateOrPlatform({
          recipientUserId: commission.userId,
          amount: commission.amount,
          currency: "USD",
          description: `Add-on L${commission.level} commission: ${addon.name}`,
          note: `Level ${commission.level} (${commission.percentage}%) add-on commission`,
          relatedUserId: subscription.founderId?.toString(),
          metadata: {
            subscriptionId: subscription._id,
            addonId: addon._id,
            addonName: addon.name,
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
      await OfficeAddonPayment.updateOne(
        { subscriptionId: subscription._id, paymentNumber },
        { commissionDistributed: true },
        { session }
      );

      await session.commitTransaction();

      console.log(`[AddonCommission] Distributed for ${addon.name}:
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
      `[AddonCommission] Failed for subscription ${subscription._id}:`,
      error
    );
  }
}

/**
 * Get payments for an add-on subscription
 */
export async function getOfficeAddonPayments(
  orgId: string
): Promise<IOfficeAddonPayment[]> {
  return OfficeAddonPayment.find({
    orgId: new Types.ObjectId(orgId),
  })
    .sort({ createdAt: -1 })
    .populate("addonId")
    .lean();
}
