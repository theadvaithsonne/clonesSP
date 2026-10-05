import mongoose, { Types } from "mongoose";
import { CombPlan, ICombPlan, ICombPlanLevel } from "../models/combPlan.model";
import {
  CommissionDistribution,
  ICommissionDistribution,
  ICommissionRecipient,
} from "../models/commissionDistribution.model";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { Store } from "../models/store.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { creditAffiliateOrPlatform } from "./wallet";
import { distributeTerritoryCommissions } from "./territoryCommission";
import { distributeFranchiseProgramCommissions } from "./franchiseProgramCommission";
import { convertToUsd } from "../utils/exchangeRate";

// Platform fee is fixed at 5%
// The rate an org pays once it has actually bought an office plan.
// Exported so callers/tests can reason about it without re-declaring 5.
export const PLATFORM_FEE_PERCENTAGE = 5;

// Comb plans pay affiliate commissions out of the FULL sale principal (not the
// seller's 95%). To guarantee the seller never goes negative, total comb-plan
// percentages must not exceed (100 - PLATFORM_FEE_PERCENTAGE - SELLER_FLOOR).
// 5% platform + 90% commissions max + 5% seller floor = 100%.
const COMB_PLAN_MAX_PERCENTAGE = 90;

// Platform configuration - The Network Economy org owned by shorupan@gmail.com
export const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
export const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951"; // The Network Economy

// Fee charged to an org that has NOT bought an office plan — Starter
// subscribers, unpaid/trial subscriptions, lapsed plans, and orgs that never
// subscribed at all.
//
// 5% is the discount you get for paying for an office; 10% is the list price.
// Before this existed, `platformFeePercentage` was a write-once override set
// only by the Starter subscribe path, so ANY org without that field fell back
// to 5% — meaning never subscribing was CHEAPER than the free Starter plan.
// Ten of the eighteen orgs that had ever sold were in that state.
export const PLATFORM_FEE_NO_PAID_PLAN = 10;

/**
 * The platform fee an org pays on a sale, derived from its effective plan.
 *
 * Precedence:
 *   1. Platform's own parent org (GARAGE HQ) — untouched, stays on the base
 *      rate. It's our own org; charging it a "no plan" penalty is meaningless.
 *   2. Explicit admin override — an operator set a bespoke rate in
 *      /garage-admin/wallets. Identified by `platformFeeUpdatedBy` being set
 *      (the Starter subscribe path writes null there), so a hand-set rate is
 *      never silently overruled by plan state.
 *   3. A plan-level override (`OfficePlan.platformFeeOverride`) — this is how
 *      Starter declares its 10%.
 *   4. A paid plan with at least one successful payment → the 5% base rate.
 *      `paidCount > 0` is the "have they actually bought anything" test: it
 *      keeps a legacy Basic subscriber (active, paidCount 8) on 5% and keeps
 *      an unpaid Pro (status "created", paidCount 0) off it.
 *   5. Anything else — no subscription, trial, unpaid, lapsed → 10%.
 *
 * `orgDoc` may be passed in when the caller has already loaded the org, to
 * avoid a second query on the hot path.
 */
export async function resolvePlatformFeePercentage(
  orgId: string,
  orgDoc?: any
): Promise<{ pct: number; reason: string }> {
  const org =
    orgDoc ??
    (await Organization.findById(orgId).select("paymentConfig parent").lean());

  // 1. Our own org.
  if ((org as any)?.parent === true) {
    return { pct: PLATFORM_FEE_PERCENTAGE, reason: "platform_org" };
  }

  // 2. Hand-set by an operator.
  const cfg = (org as any)?.paymentConfig;
  if (
    cfg?.platformFeeUpdatedBy != null &&
    typeof cfg?.platformFeePercentage === "number"
  ) {
    return { pct: cfg.platformFeePercentage, reason: "admin_override" };
  }

  const { OfficeSubscription } = await import(
    "../models/officeSubscription.model"
  );
  const { OfficePlan } = await import("../models/officePlan.model");

  const sub: any = await OfficeSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
  }).lean();

  // 5a. Never subscribed to anything.
  if (!sub) {
    return { pct: PLATFORM_FEE_NO_PAID_PLAN, reason: "no_subscription" };
  }

  const plan: any = await OfficePlan.findById(sub.planId)
    .select("slug platformFeeOverride")
    .lean();

  // 3. Plan declares its own rate (Starter → 10).
  if (typeof plan?.platformFeeOverride === "number") {
    return {
      pct: plan.platformFeeOverride,
      reason: `plan_override:${plan.slug}`,
    };
  }

  // 4. A paid plan they have actually paid for at least once.
  const PAID_STATUSES = ["active", "authenticated", "halted"];
  const hasPaid = (sub.paidCount ?? 0) > 0 && !sub.isTrial;
  if (PAID_STATUSES.includes(sub.status) && hasPaid) {
    return { pct: PLATFORM_FEE_PERCENTAGE, reason: `paid:${plan?.slug}` };
  }

  // 5b. Trial, unpaid, created, expired, cancelled…
  return {
    pct: PLATFORM_FEE_NO_PAID_PLAN,
    reason: `unpaid:${plan?.slug ?? "unknown"}:${sub.status}${
      sub.isTrial ? ":trial" : ""
    }`,
  };
}

/**
 * Validate that a comb plan's level percentages don't exceed the global cap.
 * Throws if invalid. Used at create AND update time, plus a defensive runtime
 * check at distribution time (in case a plan slipped past creation validation).
 */
function assertCombPlanWithinCap(levels: ICombPlanLevel[]): void {
  const total = levels.reduce((s, l) => s + (l.percentage || 0), 0);
  if (total > COMB_PLAN_MAX_PERCENTAGE) {
    throw new Error(
      `Comb plan over-allocated: levels sum to ${total}% (max ${COMB_PLAN_MAX_PERCENTAGE}%). ` +
        `Reduce one or more level percentages so they total <= ${COMB_PLAN_MAX_PERCENTAGE}%.`
    );
  }
}

// ============= Comb Plan CRUD =============

export async function createCombPlan(data: {
  name: string;
  description?: string;
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  orgId: string;
  createdBy: string;
  levels: ICombPlanLevel[];
  // Distribution cap — see combPlan.model.ts::CombPlanCapType. Optional
  // so every legacy call (no cap fields) creates a perpetual plan.
  capType?: "perpetual" | "per_pair_capped";
  capCount?: number;
  // Which comp engine drives the plan. Absent = "levels" (every legacy call).
  planKind?: "levels" | "unilevel_plus";
  unilevelPlusPercentage?: number;
}): Promise<ICombPlan> {
  // Only meaningful for a levels plan — a unilevel_plus plan carries none,
  // and its own ceiling is enforced by the model + the route.
  if (data.planKind !== "unilevel_plus") {
    assertCombPlanWithinCap(data.levels);
  }

  // Deactivate any existing active plans for this item
  await CombPlan.updateMany(
    {
      itemType: data.itemType,
      itemId: new Types.ObjectId(data.itemId),
      isActive: true,
    },
    { isActive: false }
  );

  const combPlan = new CombPlan({
    name: data.name,
    description: data.description,
    itemType: data.itemType,
    itemId: new Types.ObjectId(data.itemId),
    orgId: new Types.ObjectId(data.orgId),
    createdBy: new Types.ObjectId(data.createdBy),
    levels: data.levels.map((l) => ({
      level: l.level,
      percentage: l.percentage,
      description: l.description,
    })),
    isActive: true,
    ...(data.capType ? { capType: data.capType } : {}),
    ...(data.capCount !== undefined ? { capCount: data.capCount } : {}),
    ...(data.planKind ? { planKind: data.planKind } : {}),
    ...(data.unilevelPlusPercentage !== undefined
      ? { unilevelPlusPercentage: data.unilevelPlusPercentage }
      : {}),
  });

  await combPlan.save();
  return combPlan;
}

export async function getCombPlan(planId: string): Promise<ICombPlan | null> {
  return CombPlan.findById(planId).lean();
}

export async function getCombPlanForItem(
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
  itemId: string
): Promise<ICombPlan | null> {
  return CombPlan.findOne({
    itemType,
    itemId: new Types.ObjectId(itemId),
    isActive: true,
  }).lean();
}

/**
 * Resolve the comb plan that governs a sale, honouring per-variant overrides.
 *
 * A product variant can carry its own comb plan (stored exactly like a product
 * plan, but with `itemId = variant._id`). When a specific variant is sold we
 * prefer that override; if the variant has no plan of its own we fall back to
 * the parent product's plan. `variantId` is optional so every non-variant
 * caller (courses, workshops, plain products…) keeps its existing behaviour.
 */
export async function resolveCombPlanForSale(
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
  itemId: string,
  variantId?: string
): Promise<ICombPlan | null> {
  if (variantId && variantId !== itemId) {
    const variantPlan = await getCombPlanForItem(itemType, variantId);
    if (variantPlan) return variantPlan;
  }
  return getCombPlanForItem(itemType, itemId);
}

export async function getCombPlansByOrg(
  orgId: string,
  options: {
    itemType?: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ plans: ICombPlan[]; total: number }> {
  const { itemType, isActive, limit = 50, offset = 0 } = options;

  const query: any = { orgId: new Types.ObjectId(orgId) };
  if (itemType) query.itemType = itemType;
  if (isActive !== undefined) query.isActive = isActive;

  const [plans, total] = await Promise.all([
    CombPlan.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    CombPlan.countDocuments(query),
  ]);

  return { plans, total };
}

export async function updateCombPlan(
  planId: string,
  updates: {
    name?: string;
    description?: string;
    levels?: ICombPlanLevel[];
    isActive?: boolean;
    // Distribution cap update. When capType flips to "perpetual", the
    // model's pre-save hook nulls out capCount to keep the doc clean.
    capType?: "perpetual" | "per_pair_capped";
    capCount?: number;
  }
): Promise<ICombPlan | null> {
  const plan = await CombPlan.findById(planId);
  if (!plan) return null;

  if (updates.name !== undefined) plan.name = updates.name;
  if (updates.description !== undefined) plan.description = updates.description;
  if (updates.levels !== undefined) {
    assertCombPlanWithinCap(updates.levels);
    plan.levels = updates.levels.map((l) => ({
      level: l.level,
      percentage: l.percentage,
      description: l.description,
    }));
  }
  if (updates.isActive !== undefined) plan.isActive = updates.isActive;
  if (updates.capType !== undefined) plan.capType = updates.capType;
  if (updates.capCount !== undefined) plan.capCount = updates.capCount;

  await plan.save();
  return plan;
}

export async function deleteCombPlan(planId: string): Promise<boolean> {
  // Check if commissions have been distributed with this plan
  const hasDistributions = await CommissionDistribution.exists({
    combPlanId: new Types.ObjectId(planId),
  });

  if (hasDistributions) {
    // Soft delete - just deactivate
    await CombPlan.updateOne(
      { _id: new Types.ObjectId(planId) },
      { isActive: false }
    );
  } else {
    // Hard delete if no commissions distributed
    await CombPlan.deleteOne({ _id: new Types.ObjectId(planId) });
  }

  return true;
}

// ============= Referral Tree Walking =============

/**
 * Walk up the referral tree from a user to find referrers at each level
 * @param userId Starting user (the seller/creator)
 * @param maxLevel Maximum levels to walk up
 * @returns Array of { userId, level } for each referrer found
 */
/** Exported for the HiFi bond commission splitter, which needs the same
 *  upline walk but distributes a pre-computed POOL rather than a sale
 *  amount (see services/bondCommission.ts). Kept identical so bonds and
 *  products resolve the same chain for the same buyer. */
export async function getReferralChain(
  userId: string,
  maxLevel: number
): Promise<{ userId: string; level: number }[]> {
  const chain: { userId: string; level: number }[] = [];
  const visited = new Set<string>();
  let currentUserId = userId;

  for (let level = 1; level <= maxLevel; level++) {
    const user = await User.findById(currentUserId)
      .select("referredBy")
      .lean();

    if (!user || !user.referredBy) {
      break; // No more referrers
    }

    const referrerId = user.referredBy.toString();

    // Prevent circular references
    if (visited.has(referrerId)) {
      break;
    }

    visited.add(referrerId);
    chain.push({ userId: referrerId, level });
    currentUserId = referrerId;
  }

  return chain;
}

/**
 * Does this org sell from a brick-and-mortar store?
 *
 * `Store.storeKind` is owned by the storefront backend and is ABSENT on most
 * stores (they predate the field). Absent means online, so this tests
 * `=== "offline"` explicitly — `!== "online"` would misclassify every legacy
 * store as offline and silently change how their commissions are paid.
 */
async function isOfflineStoreOrg(orgId: string): Promise<boolean> {
  const store = await Store.findOne({ orgId: new Types.ObjectId(orgId) })
    .select("storeKind")
    .lean();
  return (store as any)?.storeKind === "offline";
}

// How far up the referral chain we're willing to look for qualified buyers.
// The policy is "walk to the top" — the deepest real chain today is ~13, so
// this is a runaway guard against a referral cycle the visited-set somehow
// misses, not a business limit.
const MAX_CASCADE_DEPTH = 50;

export interface QualifiedChainResult {
  chain: { userId: string; level: number }[];
  candidatesWalked: number;
  qualifiedUserIds: string[];
  skippedUserIds: string[];
}

/**
 * Referral chain for an OFFLINE store, where a level is only earned by someone
 * who has actually bought from that store.
 *
 * Walks the same `referredBy` path as getReferralChain, then keeps only the
 * ancestors with a paid order from `orgId` and renumbers them 1..maxLevel —
 * "skip and compress". So for a chain A(no) → B(yes) → C(no) → D(yes):
 * B becomes L1 and D becomes L2. A and C earn nothing.
 *
 * Deliberately walks `referredBy` rather than the denormalised `User.ancestors`
 * array: that array is known to go stale (services/affiliate.ts detects the
 * case and falls back to a legacy walk), and money distribution has to use the
 * authoritative field.
 *
 * The qualification lookup is ONE query for the whole chain — resist the
 * temptation to check inside the walk loop, which would make cost scale with
 * depth on the payment hot path.
 */
async function getQualifiedReferralChain(
  userId: string,
  maxLevel: number,
  orgId: string
): Promise<QualifiedChainResult> {
  // 1. Collect ancestors in order, cycle-guarded (same shape as getReferralChain).
  const ancestors: string[] = [];
  const visited = new Set<string>();
  let currentUserId = userId;

  for (let i = 0; i < MAX_CASCADE_DEPTH; i++) {
    const user = await User.findById(currentUserId).select("referredBy").lean();
    if (!user || !user.referredBy) break;

    const referrerId = user.referredBy.toString();
    if (visited.has(referrerId)) break;

    visited.add(referrerId);
    ancestors.push(referrerId);
    currentUserId = referrerId;
  }

  if (ancestors.length === 0) {
    return { chain: [], candidatesWalked: 0, qualifiedUserIds: [], skippedUserIds: [] };
  }

  // 2. One batch query: which of them have bought from this store?
  const { ProductOrder } = await import("../models/productOrder.model");
  const buyerIds: any[] = await ProductOrder.distinct("userId", {
    userId: { $in: ancestors.map((a) => new Types.ObjectId(a)) },
    organizationId: new Types.ObjectId(orgId),
    paymentStatus: "paid",
  });
  const qualified = new Set(buyerIds.map((b) => String(b)));

  // 3. Compress: qualified ancestors, in chain order, renumbered from 1.
  const chain: { userId: string; level: number }[] = [];
  const skippedUserIds: string[] = [];
  for (const a of ancestors) {
    if (!qualified.has(a)) {
      skippedUserIds.push(a);
      continue;
    }
    chain.push({ userId: a, level: chain.length + 1 });
    if (chain.length >= maxLevel) break;
  }

  return {
    chain,
    candidatesWalked: ancestors.length,
    qualifiedUserIds: chain.map((c) => c.userId),
    skippedUserIds,
  };
}

// ============= Commission Distribution =============

export interface DistributeCommissionsInput {
  orgId: string;
  sellerId: string;
  customerId: string;
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
  itemId: string;
  // Optional product-variant id. When set and that variant has its own comb
  // plan, the variant plan governs this sale instead of the product plan.
  variantId?: string;
  itemName: string;
  saleAmount: number;
  currency?: string;
  paymentId?: string;
  isRecurringPayment?: boolean;
  recurringPaymentNumber?: number;
  metadata?: Record<string, any>;
}

export interface DistributeCommissionsResult {
  distribution: ICommissionDistribution;
  sellerCredited: number;
  platformFee: number;
  commissionsPaid: { userId: string; amount: number; level: number }[];
}

/**
 * Drop-creator carve-out (pure, DB-free — unit-testable).
 *
 * Given the already-computed upline `commissions[]` and their `totalCommission`
 * pool, redirect `splitPct`% of the pool to `dropCreatorId` and re-split the
 * remaining `(100 - splitPct)%` across the existing levels (proportional to
 * their original amounts). The pool total is PRESERVED — callers keep
 * `totalCommissionAmount` unchanged, so the seller's cut and platform fee are
 * untouched. Rounding drift is absorbed on the first (largest) level so the
 * levels sum to the 75% pool exactly and `Σ recipients === totalCommission`.
 *
 * No-ops (returns false, leaves `commissions` untouched) unless there is a
 * valid creator id, a positive pool, a split strictly between 0 and 100, and at
 * least one upline level — i.e. cold drop traffic with no upline earns nothing.
 *
 * Mutates `commissions` in place and appends the `drop_creator` recipient.
 */
export function applyDropCreatorSplit(
  commissions: ICommissionRecipient[],
  totalCommission: number,
  dropCreatorId: string,
  splitPct: number = 25
): boolean {
  if (
    !dropCreatorId ||
    !Types.ObjectId.isValid(dropCreatorId) ||
    !(splitPct > 0 && splitPct < 100) ||
    totalCommission <= 0 ||
    commissions.length === 0
  ) {
    return false;
  }
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const origTotal = totalCommission;
  const creatorAmt = round2((origTotal * splitPct) / 100); // e.g. 25% of pool
  const levelsPool = round2(origTotal - creatorAmt); // remaining 75%

  let allocated = 0;
  for (const c of commissions) {
    c.amount = round2((levelsPool * c.amount) / origTotal);
    allocated += c.amount;
  }
  const drift = round2(levelsPool - allocated);
  if (drift !== 0) commissions[0].amount = round2(commissions[0].amount + drift);

  commissions.push({
    userId: new Types.ObjectId(dropCreatorId) as any,
    level: 0,
    percentage: splitPct,
    amount: creatorAmt,
    role: "drop_creator",
  });
  return true;
}

/**
 * Distribute commissions for a sale
 *
 * NEW FLOW:
 * 1. Calculate platform fee (5%)
 * 2. Credit platform fee to shorupan@gmail.com's Store Wallet (The Network Economy org)
 * 3. Credit seller's Store Wallet with remaining 95%
 * 4. If comb plan exists:
 *    - Walk seller's referral tree
 *    - For each level: DEBIT seller's wallet, CREDIT affiliate's wallet
 * 5. Create audit records
 */
export async function distributeCommissions(
  input: DistributeCommissionsInput
): Promise<DistributeCommissionsResult> {
  const {
    orgId,
    sellerId,
    customerId,
    itemType,
    itemId,
    variantId,
    itemName,
    saleAmount: originalSaleAmount,
    currency: originalCurrency = "USD",
    paymentId,
    isRecurringPayment = false,
    recurringPaymentNumber,
    metadata,
  } = input;

  if (originalSaleAmount <= 0) {
    throw new Error("Sale amount must be greater than 0");
  }

  // Convert sale amount to USD if needed (wallets are always USD)
  const { usdAmount: saleAmount, exchangeRate, originalCurrency: fromCurrency } =
    await convertToUsd(originalSaleAmount, originalCurrency);
  const currency = "USD";

  // Check for duplicate payment - prevent double processing.
  //
  // `status: { $ne: "failed" }` is load-bearing. The catch block at the bottom
  // of this function writes a `status: "failed"` row carrying the SAME
  // {paymentId, itemType, itemId}. Without this filter a single failed attempt
  // poisoned the key permanently: every retry found the failed row, logged
  // "already distributed", returned that row's (non-zero) sellerAmount, and
  // moved ZERO money — while the caller saw success. A failed row is a
  // tombstone recording why an attempt died, not evidence anyone got paid.
  //
  // See also the retirement step inside the transaction below: the unique
  // sparse index on {paymentId, itemType, itemId} means the tombstone still
  // occupies the key, so it has to be moved aside before the retry can insert.
  if (paymentId) {
    const existingDistribution = await CommissionDistribution.findOne({
      paymentId,
      itemType,
      itemId: new Types.ObjectId(itemId),
      status: { $ne: "failed" },
    }).lean();

    if (existingDistribution) {
      console.log(`Commission already distributed for paymentId: ${paymentId}, itemId: ${itemId}`);
      // Return the existing distribution result instead of creating a new one
      return {
        distribution: existingDistribution as ICommissionDistribution,
        sellerCredited: existingDistribution.sellerAmount,
        platformFee: existingDistribution.platformFeeAmount,
        commissionsPaid: existingDistribution.commissions?.map(c => ({
          userId: c.userId.toString(),
          amount: c.amount,
          level: c.level,
        })) || [],
      };
    }
  }

  // 1. Resolve the platform fee for this sale from the org's EFFECTIVE PLAN.
  //    See resolvePlatformFeePercentage — the short version is that 5% is the
  //    reward for actually paying for an office, and everyone else pays 10%.
  const sellerOrg = await Organization.findById(orgId)
    .select("paymentConfig name parent")
    .lean();
  const feeResolution = await resolvePlatformFeePercentage(orgId, sellerOrg);
  const platformFeePct = feeResolution.pct;

  const platformFeeAmount = Math.round((saleAmount * platformFeePct) / 100 * 100) / 100;

  // 2. Seller is initially credited (100 - platformFeePct)% of the principal.
  //    Affiliate commissions then debit from this credit — see step 5 below.
  const sellerGrossAmount = Math.round((saleAmount - platformFeeAmount) * 100) / 100;

  // 3. Get comb plan for this sale — a per-variant plan wins over the product
  //    plan when the sold variant has its own override (see resolveCombPlanForSale).
  const combPlan = await resolveCombPlanForSale(itemType, itemId, variantId);

  // 3a. Hard cap on the comb plan itself (sum of level percentages).
  //     Defensive runtime check — also enforced at create/update time. If a
  //     plan slipped past creation validation, the distribution is refused
  //     and a `failed` CommissionDistribution record is logged below.
  if (combPlan && combPlan.levels && combPlan.levels.length > 0) {
    assertCombPlanWithinCap(combPlan.levels);
  }

  // 3b. Combined cap: platform fee + total comb-plan percentages must leave
  //     at least 5% for the seller. Catches the case where an admin set a
  //     high per-org fee that, combined with an existing comb plan, would
  //     push the seller below the floor. Refuse and log loudly.
  if (combPlan && combPlan.levels && combPlan.levels.length > 0) {
    const totalLevelPct = combPlan.levels.reduce(
      (s, l) => s + (l.percentage || 0),
      0
    );
    if (platformFeePct + totalLevelPct > 95) {
      throw new Error(
        `Distribution refused: platform fee ${platformFeePct}% + comb plan ${totalLevelPct}% ` +
          `exceeds 95% (would leave seller below 5% floor). Adjust either side.`
      );
    }
  }

  // 3c. Unilevel Plus cap. A "unilevel_plus" plan carries no levels, so the
  //      checks above skip it entirely — it needs the same 95% ceiling or a
  //      founder could set 95% and drive sellerAmount negative.
  const isUnilevelPlusPlan =
    (combPlan as any)?.planKind === "unilevel_plus" &&
    typeof (combPlan as any)?.unilevelPlusPercentage === "number" &&
    (combPlan as any).unilevelPlusPercentage > 0;
  const unilevelPlusPct = isUnilevelPlusPlan
    ? (combPlan as any).unilevelPlusPercentage
    : 0;
  if (isUnilevelPlusPlan && platformFeePct + unilevelPlusPct > 95) {
    throw new Error(
      `Distribution refused: platform fee ${platformFeePct}% + unilevel plus ${unilevelPlusPct}% ` +
        `exceeds 95% (would leave seller below 5% floor). Adjust either side.`
    );
  }

  // 4. Get referral chain if comb plan exists
  // Walk up from CUSTOMER (buyer) to find who referred them
  // L1 = customer's direct referrer, L2 = referrer's referrer, etc.
  //
  // OFFLINE STORES take a different chain: a level is only earned by an upline
  // who has themselves bought from that store, and non-buyers are skipped so
  // the level cascades to the next one who has. Paying a stranger for a
  // walk-in sale at a shop they've never visited doesn't reflect anything real.
  // Online stores are untouched.
  const maxLevel = combPlan?.levels?.length || 0;
  const isOffline = maxLevel > 0 ? await isOfflineStoreOrg(orgId) : false;
  let offlineQualification: Omit<QualifiedChainResult, "chain"> | null = null;

  let referralChain: { userId: string; level: number }[] = [];
  if (maxLevel > 0) {
    if (isOffline) {
      const q = await getQualifiedReferralChain(customerId, maxLevel, orgId);
      referralChain = q.chain;
      offlineQualification = {
        candidatesWalked: q.candidatesWalked,
        qualifiedUserIds: q.qualifiedUserIds,
        skippedUserIds: q.skippedUserIds,
      };
    } else {
      referralChain = await getReferralChain(customerId, maxLevel);
    }
  }

  // 5. Calculate commissions for each level (from the principal saleAmount).
  //    Platform's 5% never absorbs comb-plan payouts; affiliates are paid from
  //    the same base the customer paid against (saleAmount), and the seller
  //    absorbs the cost out of their initial 95% credit.
  const commissions: ICommissionRecipient[] = [];
  let totalCommissionAmount = 0;

  // Per-(affiliate, customer) N-time cap.
  //
  // When the plan opts in via `capType: "per_pair_capped"`, each candidate
  // affiliate must not have already received `capCount` commission
  // distributions from this same customer under this same plan. Query
  // uses ONLY existing indexed fields on CommissionDistribution
  // ({customerId}, {commissions.userId}); no new collection or field.
  //
  // Race behaviour: the query runs BEFORE the write transaction. Two
  // truly-simultaneous purchases by the same customer could both squeeze
  // one over the cap (the second one's count reads 0 while the first
  // hasn't committed yet). Acceptable — the cap is a business rule, not
  // a strict solvency invariant, and this is the same race the existing
  // idempotency guard has. Every subsequent purchase enforces cleanly.
  //
  // Legacy plans without a stored `capType` field come back as
  // `undefined` (Mongoose does not backfill defaults on read from an
  // existing doc). The explicit === "per_pair_capped" check treats
  // undefined as "perpetual" and short-circuits with zero DB round-trips.
  const isCapped =
    combPlan?.capType === "per_pair_capped" &&
    typeof combPlan.capCount === "number" &&
    combPlan.capCount >= 1;

  if (combPlan && combPlan.levels && combPlan.levels.length > 0) {
    for (const levelConfig of combPlan.levels) {
      const referrer = referralChain.find((r) => r.level === levelConfig.level);
      if (referrer && levelConfig.percentage > 0) {
        // Cap gate — drop this specific affiliate from the commission
        // list when their count for this customer under this plan has
        // hit the cap. Other levels keep their shares; the capped
        // share stays on the seller/platform side (no reallocation).
        if (isCapped) {
          const alreadyEarned =
            await CommissionDistribution.countDocuments({
              combPlanId: combPlan._id,
              "commissions.userId": new Types.ObjectId(referrer.userId),
              customerId: new Types.ObjectId(customerId),
              status: "completed",
            });
          if (alreadyEarned >= (combPlan.capCount || 0)) {
            // Silently skip. The affiliate hit their cap for this pair.
            continue;
          }
        }
        // Commission is calculated from the FULL sale principal, not the
        // seller's 95%. So a 30% L1 on a $100 sale pays $30 (not $28.50).
        const commissionAmount = Math.round((saleAmount * levelConfig.percentage) / 100 * 100) / 100;
        commissions.push({
          userId: new Types.ObjectId(referrer.userId) as any,
          level: levelConfig.level,
          percentage: levelConfig.percentage,
          amount: commissionAmount,
        });
        totalCommissionAmount += commissionAmount;
      }
    }
  }

  // 5a-UP. Unilevel Plus community plan.
  //
  //   The founder set a single percentage of the sale principal (same base the
  //   level plans use — the FULL principal, not the seller's 95%). That slice
  //   is handed to the Unilevel Plus tree, which distributes it by its own
  //   rules: 36% direct, a 15-level point budget, infinity tiers.
  //
  //   `sweepUnspent: "return"` is what makes the founder's percentage mean
  //   what they think it means. Normally the tree sweeps company share,
  //   unspent infinity tiers, the manager pool and any unallocated level
  //   budget to the platform — measured at 43-56% of everything that enters
  //   it. Here the founder is funding the tree out of their own margin, so
  //   anything the network does not earn has to come back to them.
  //
  //   Adding only `paid` (not the whole budget) to totalCommissionAmount is
  //   the entire mechanism: sellerAmount = sellerGrossAmount -
  //   totalCommissionAmount, so the unspent remainder simply never leaves the
  //   seller. No transfer, no second wallet write, nothing to reconcile.
  let unilevelPlusPaid = 0;
  let unilevelPlusDistributionId: string | undefined;
  if (isUnilevelPlusPlan) {
    const upBudget =
      Math.round(((saleAmount * unilevelPlusPct) / 100) * 100) / 100;
    if (upBudget > 0) {
      try {
        const {
          getActiveUnilevelPlusPlan,
          distributeUnilevelPlusCommission,
        } = await import("./unilevelPlusCommission");
        const upPlan = await getActiveUnilevelPlusPlan();
        if (!upPlan) throw new Error("No active Unilevel Plus plan");

        const upResult = await distributeUnilevelPlusCommission({
          buyerId: customerId,
          planId: String(upPlan._id),
          saleAmount: upBudget,
          currency: "USD",
          // MUST be suffixed. UnilevelPlusDistribution has a unique index on
          // paymentId, and this same payment id may already belong to a
          // licence distribution — without the suffix the second write is
          // silently swallowed as a replay and nobody gets paid.
          paymentId: `${paymentId}_up`,
          sweepUnspent: "return",
          metadata: {
            source: "comb_plan_unilevel_plus",
            combPlanId: String(combPlan!._id),
            itemType,
            itemId,
            orgId,
            saleAmount,
            unilevelPlusPercentage: unilevelPlusPct,
          },
        });

        unilevelPlusDistributionId = String(upResult.distribution?._id || "");
        unilevelPlusPaid =
          Math.round((upBudget - (upResult.unspentAmount || 0)) * 100) / 100;
        totalCommissionAmount += unilevelPlusPaid;
      } catch (err: any) {
        // Non-fatal, and deliberately does NOT charge the seller: with
        // unilevelPlusPaid still 0 the whole budget stays in sellerAmount.
        // Better the founder keeps the money than we debit them for a payout
        // that never happened.
        console.error(
          `[commission] Unilevel Plus community distribution failed for ${paymentId}:`,
          err?.message
        );
      }
    }
  }

  // 5b. Drop-creator carve-out. When a purchase originated from a "Drop"
  //     (short product video), the creator earns a share of the LINE's
  //     affiliate pool: 25% (configurable) to the creator, the remaining 75%
  //     re-split across the same upline levels. Pool total is preserved, so the
  //     seller's cut and the platform fee are untouched. No upline / no plan →
  //     pool is 0 → creator earns nothing (we never synthesize a pool).
  applyDropCreatorSplit(
    commissions,
    totalCommissionAmount,
    metadata?.dropCreatorId ? String(metadata.dropCreatorId) : "",
    Number(metadata?.dropCreatorSplitPct ?? 25)
  );

  // 6. Seller's final amount = 95% credit minus the principal-based commissions.
  //    With the cap above, sum(commissions) <= 90% of principal, so the
  //    minimum sellerAmount is 5% of principal.
  const sellerAmount = Math.round((sellerGrossAmount - totalCommissionAmount) * 100) / 100;
  const netAmount = sellerGrossAmount; // For record keeping

  // Get platform user (shorupan@gmail.com)
  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL }).select("_id").lean();
  if (!platformUser) {
    throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
  }
  const platformUserId = platformUser._id.toString();

  // Start MongoDB transaction for atomic operations
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Retire any tombstone from a previous failed attempt on this exact key.
    //
    // The guard above lets a retry through when the only prior row is
    // `failed`, but {paymentId, itemType, itemId} is a UNIQUE sparse index
    // (commissionDistribution.model.ts) — so the tombstone still occupies the
    // slot and the create below would die on E11000. Move it aside rather than
    // delete it: its `failureReason` is the only record of why the first
    // attempt failed, and it's what the diagnostics read.
    //
    // The new paymentId is derived from the row's own _id, so it's
    // deterministic and can never collide.
    if (paymentId) {
      const tombstones = await CommissionDistribution.find({
        paymentId,
        itemType,
        itemId: new Types.ObjectId(itemId),
        status: "failed",
      })
        .select("_id metadata")
        .session(session);

      for (const t of tombstones) {
        await CommissionDistribution.updateOne(
          { _id: t._id },
          {
            $set: {
              paymentId: `${paymentId}#superseded#${String(t._id)}`,
              metadata: {
                ...((t as any).metadata || {}),
                supersededPaymentId: paymentId,
                supersededAt: new Date(),
              },
            },
          },
          { session }
        );
      }
    }

    // Create distribution record first (pending status)
    const distribution = await CommissionDistribution.create(
      [
        {
          combPlanId: combPlan?._id,
          orgId: new Types.ObjectId(orgId),
          sellerId: new Types.ObjectId(sellerId),
          customerId: new Types.ObjectId(customerId),
          itemType,
          itemId: new Types.ObjectId(itemId),
          itemName,
          saleAmount,
          currency,
          platformFeePercentage: platformFeePct,
          platformFeeAmount,
          netAmount,
          sellerAmount,
          commissions,
          totalCommissionAmount,
          paymentId,
          status: "pending",
          isRecurringPayment,
          recurringPaymentNumber,
          metadata: {
            ...metadata,
            platformUserId,
            sellerGrossAmount,
            originalCurrency: fromCurrency,
            originalSaleAmount,
            exchangeRate,
            // Why this org paid this rate — "paid:pro", "plan_override:starter",
            // "no_subscription", "admin_override", "unpaid:pro:created"…
            // Without it, a 5%-vs-10% dispute is unanswerable after the fact.
            platformFeeReason: feeResolution.reason,
            // Present ONLY for offline stores, so its presence alone tells you
            // this sale used the buy-from-the-store-to-earn rule. Records who
            // was walked past and why a given upline earned nothing — the same
            // reason platformFeeReason exists.
            ...(offlineQualification
              ? { offlineQualification: { applied: true, ...offlineQualification } }
              : {}),
            // Present ONLY when the item ran a "unilevel_plus" comb plan.
            // Records the founder's chosen percentage, the budget it produced,
            // what the tree ACTUALLY paid, and what therefore stayed with the
            // seller — so "why did my 10% only pay out 4%?" is answerable from
            // the row rather than by re-deriving the tree.
            ...(isUnilevelPlusPlan
              ? {
                  unilevelPlus: {
                    percentage: unilevelPlusPct,
                    budget:
                      Math.round(((saleAmount * unilevelPlusPct) / 100) * 100) /
                      100,
                    paid: unilevelPlusPaid,
                    returnedToSeller:
                      Math.round(
                        ((saleAmount * unilevelPlusPct) / 100 -
                          unilevelPlusPaid) * 100
                      ) / 100,
                    distributionId: unilevelPlusDistributionId,
                  },
                }
              : {}),
          },
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    // ============= STEP 1: Credit Platform Fee to shorupan@gmail.com =============
    // Skip entirely when platformFeeAmount rounds to 0 (tiny sales — e.g. a
    // $0.03 sale × 5% rounds to $0). Writing a $0 WalletTransaction would
    // fail the schema's `amount >= 0.01` minimum and abort the whole atomic
    // transaction, denying the seller their share too. No platform earnings
    // on sub-$0.20 sales is the correct economic behaviour.
    if (platformFeeAmount > 0) {
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
              currency,
            },
          ],
          { session }
        );
        platformWallet = created[0];
      }

      const platformBalanceBefore = platformWallet.balance;
      const platformBalanceAfter = platformBalanceBefore + platformFeeAmount;
      platformWallet.balance = platformBalanceAfter;
      platformWallet.lastTransactionAt = new Date();
      await platformWallet.save({ session });

      // Create platform fee transaction
      await WalletTransaction.create(
        [
          {
            storeWalletId: platformWallet._id,
            walletType: "store",
            userId: platformUserId,
            orgId: new Types.ObjectId(PLATFORM_ORG_ID),
            type: "credit",
            amount: platformFeeAmount,
            currency,
            balanceBefore: platformBalanceBefore,
            balanceAfter: platformBalanceAfter,
            description: `Platform fee: ${itemName}`,
            note: `${platformFeePct}% platform fee from ${itemType} sale. Original sale: ${saleAmount} ${currency}`,
            relatedUserId: new Types.ObjectId(sellerId),
            metadata: {
              distributionId: distribution._id,
              itemType,
              itemId,
              saleAmount,
              sellerOrgId: orgId,
              sellerId,
              customerId,
            },
            status: "completed",
          },
        ],
        { session }
      );
    }

    // ============= STEP 2: Credit Seller's Store Wallet with the seller share =============
    // Always look up / create the wallet (Step 3 needs it for affiliate
    // debits), but only write a credit transaction when sellerGrossAmount > 0.
    let sellerWallet = await StoreWallet.findOne({
      userId: new Types.ObjectId(sellerId),
      orgId: new Types.ObjectId(orgId),
    }).session(session);

    if (!sellerWallet) {
      const created = await StoreWallet.create(
        [
          {
            userId: new Types.ObjectId(sellerId),
            orgId: new Types.ObjectId(orgId),
            balance: 0,
            currency,
          },
        ],
        { session }
      );
      sellerWallet = created[0];
    }

    const sellerBalanceBefore = sellerWallet.balance;
    const sellerBalanceAfterCredit = sellerBalanceBefore + sellerGrossAmount;

    if (sellerGrossAmount > 0) {
      // Two-write pattern: credit FULL sale principal, then debit the platform
      // fee as its own row. Net wallet balance impact is identical to a single
      // net credit — the split just surfaces the 5% cut to the seller instead
      // of hiding it inside the sale credit. STEP 1 (Shorupan's platform-fee
      // credit) is unchanged and independent — the seller-side debit is an
      // accounting mirror, not a transfer to Shorupan.
      const sellerBalanceAfterGrossCredit = sellerBalanceBefore + saleAmount;

      // --- Write 1: Full sale credit ---
      sellerWallet.balance = sellerBalanceAfterGrossCredit;
      sellerWallet.lastTransactionAt = new Date();
      await sellerWallet.save({ session });

      const [saleCreditTx] = await WalletTransaction.create(
        [
          {
            storeWalletId: sellerWallet._id,
            walletType: "store",
            userId: new Types.ObjectId(sellerId),
            orgId: new Types.ObjectId(orgId),
            type: "credit",
            amount: saleAmount,
            currency,
            balanceBefore: sellerBalanceBefore,
            balanceAfter: sellerBalanceAfterGrossCredit,
            description: `Sale: ${itemName}`,
            note: `${itemType} sale from customer. Full principal credited; ${platformFeePct}% platform fee debited separately below.`,
            relatedUserId: new Types.ObjectId(customerId),
            metadata: {
              distributionId: distribution._id,
              itemType,
              itemId,
              saleAmount,
              platformFee: platformFeeAmount,
              grossAmount: sellerGrossAmount,
              saleGross: true,
            },
            status: "completed",
          },
        ],
        { session }
      );

      // --- Write 2: Platform fee debit (skip on sub-fee-threshold sales) ---
      if (platformFeeAmount > 0) {
        sellerWallet.balance = sellerBalanceAfterCredit;
        sellerWallet.lastTransactionAt = new Date();
        await sellerWallet.save({ session });

        await WalletTransaction.create(
          [
            {
              storeWalletId: sellerWallet._id,
              walletType: "store",
              userId: new Types.ObjectId(sellerId),
              orgId: new Types.ObjectId(orgId),
              type: "debit",
              amount: platformFeeAmount,
              currency,
              balanceBefore: sellerBalanceAfterGrossCredit,
              balanceAfter: sellerBalanceAfterCredit,
              description: `Platform fee: ${itemName}`,
              note: `${platformFeePct}% platform fee on ${itemType} sale.`,
              relatedUserId: platformUserId,
              metadata: {
                distributionId: distribution._id,
                itemType,
                itemId,
                saleAmount,
                platformFee: true,
                pairedSaleCreditId: saleCreditTx._id,
              },
              status: "completed",
            },
          ],
          { session }
        );
      }
    }

    // ============= STEP 3: Process Affiliate Commissions (Debit Seller, Credit Affiliates) =============
    // Chain from the wallet's actual post-fee balance so downstream affiliate
    // rows have correct balanceBefore/After snapshots (matches sellerBalanceAfterCredit).
    const commissionsPaid: { userId: string; amount: number; level: number }[] = [];
    let currentSellerBalance = sellerWallet.balance;

    for (let i = 0; i < commissions.length; i++) {
      const commission = commissions[i];
      const referrerUserId = commission.userId.toString();
      const isDropCreator = commission.role === "drop_creator";

      // Skip zero-value commissions — e.g. a level configured at 30% on a
      // $0.03 sale rounds to $0.009 → $0.01 after Math.round, but tinier
      // sales or smaller percentages can round to $0. Writing a $0 wallet
      // transaction would fail the schema's amount >= 0.01 minimum and
      // abort the whole atomic transaction.
      if (commission.amount <= 0) {
        continue;
      }

      // === DEBIT Seller's wallet for this commission ===
      const sellerDebitBalanceBefore = currentSellerBalance;
      const sellerDebitBalanceAfter = sellerDebitBalanceBefore - commission.amount;
      currentSellerBalance = sellerDebitBalanceAfter;

      sellerWallet.balance = sellerDebitBalanceAfter;
      await sellerWallet.save({ session });

      // Create seller debit transaction
      await WalletTransaction.create(
        [
          {
            storeWalletId: sellerWallet._id,
            walletType: "store",
            userId: new Types.ObjectId(sellerId),
            orgId: new Types.ObjectId(orgId),
            type: "debit",
            amount: commission.amount,
            currency,
            balanceBefore: sellerDebitBalanceBefore,
            balanceAfter: sellerDebitBalanceAfter,
            description: isDropCreator
              ? `Drop creator commission (${commission.percentage}% of pool): ${itemName}`
              : `Affiliate commission L${commission.level}: ${itemName}`,
            note: isDropCreator
              ? `Deducted for drop creator (${commission.percentage}% of affiliate pool)`
              : `Deducted for Level ${commission.level} affiliate (${commission.percentage}%)`,
            relatedUserId: new Types.ObjectId(referrerUserId),
            metadata: {
              distributionId: distribution._id,
              itemType,
              itemId,
              level: commission.level,
              percentage: commission.percentage,
              affiliateUserId: referrerUserId,
              role: commission.role || "upline",
            },
            status: "completed",
          },
        ],
        { session }
      );

      // === CREDIT Affiliate's wallet (routes to platform if not UP-activated) ===
      const affiliateResult = await creditAffiliateOrPlatform({
        recipientUserId: referrerUserId,
        amount: commission.amount,
        currency,
        description: isDropCreator
          ? `Drop creator commission: ${itemName}`
          : `Level ${commission.level} commission: ${itemName}`,
        note: isDropCreator
          ? `Drop creator share (${commission.percentage}% of affiliate pool) from ${itemType} sale. Deducted from seller.`
          : `Commission from ${itemType} sale. Level ${commission.level} (${commission.percentage}%). Deducted from seller.`,
        relatedUserId: sellerId,
        metadata: {
          distributionId: distribution._id,
          itemType,
          itemId,
          level: commission.level,
          percentage: commission.percentage,
          sellerId,
          sellerOrgId: orgId,
          role: commission.role || "upline",
        },
        session,
      });

      // Update commission record with wallet and transaction IDs
      commissions[i].walletId = affiliateResult.affiliateWallet._id as any;
      commissions[i].transactionId = affiliateResult.transaction._id as any;

      commissionsPaid.push({
        userId: referrerUserId,
        amount: commission.amount,
        level: commission.level,
      });
    }

    // Update distribution with wallet/transaction references and mark completed
    distribution.commissions = commissions;
    distribution.status = "completed";
    await distribution.save({ session });

    await session.commitTransaction();

    // Buyer address resolution — hoisted so BOTH STEP 4 (global territory)
    // and STEP 5 (per-office franchise) can use it. Priority:
    //   1. caller-supplied metadata.buyerAddress (invoice shipping/billing
    //      snapshot from resolveBuyerAddress at fulfillInvoice time)
    //   2. buyer's current User profile (country/state/city/postalCode)
    // If both are empty, buyerAddress stays null and downstream systems
    // that need it will no-op on the buyer half.
    let buyerAddress:
      | { country?: string; state?: string; city?: string; postalCode?: string }
      | null = (metadata && (metadata as any).buyerAddress) || null;
    if (!buyerAddress) {
      const buyer = await User.findById(customerId)
        .select("country state city postalCode")
        .lean<{ country?: string; state?: string; city?: string; postalCode?: string }>();
      if (buyer) {
        buyerAddress = {
          country: buyer.country,
          state: buyer.state,
          city: buyer.city,
          postalCode: buyer.postalCode,
        };
      }
    }

    // ============= STEP 4: Territory commissions (post-commit) =============
    // Runs in its OWN Mongo transaction so any failure here cannot roll back
    // the seller / affiliate distribution that just committed. Splits sub-
    // territory (15%) / territory (5%) / country (5%) of the platform fee
    // out of Shorupan's wallet into the geographic owners' TerritoryWallets.
    //
    // Asymmetric address rule (2026-07-17):
    //   - Sub-territory slice: reads BUYER's pincode → pays whoever owns
    //     the buyer's sub-territory (or stays with Shorupan; NO cascade).
    //   - Territory + country slices: read BUSINESS (seller org) pincode →
    //     pay business's territory/country owners (cascade UP: territory
    //     slice falls to country if no territory owner; country slice
    //     stays with Shorupan when no country owner).
    if (platformFeeAmount > 0) {
      try {
        const tResult = await distributeTerritoryCommissions({
          orgId,
          platformUserId,
          platformOrgId: PLATFORM_ORG_ID,
          platformFeeAmount,
          platformFeePct,
          saleAmount,
          currency,
          buyerAddress,
          commissionDistributionId: distribution._id?.toString(),
          paymentId,
          itemType,
          itemId,
          itemName,
        });
        if (tResult.applied > 0) {
          console.log(
            `[Commission] Territory distributed: $${tResult.totalPaidOut} ` +
              `across ${tResult.applied} payout(s) ` +
              `(${tResult.payouts
                .map(
                  (p) =>
                    `${p.originalLevel}→${p.paidAsLevel} $${p.amount} (${p.ownerEmail})`
                )
                .join(", ")})`
          );
        }
      } catch (err) {
        console.warn(
          `[Commission] Territory distribution failed (non-blocking) for ${itemType} "${itemName}":`,
          err
        );
      }
    }

    // ============= STEP 5: Founder franchise programs (post-commit) =========
    // Independent of the global territory split above. If the selling office
    // runs its own franchise program, carve the founder-configured percentages
    // out of the office's seller-gross and route them to the territory owners
    // the founder sold to — attributed by the BUYER's location. Own Mongo
    // transaction, non-blocking. Skips entirely (no-op) when the office has no
    // active program.
    if (sellerGrossAmount > 0) {
      try {
        const fResult = await distributeFranchiseProgramCommissions({
          sellerOrgId: orgId,
          sellerId,
          sellerGrossAmount,
          buyerUserId: customerId,
          buyerAddress,
          saleAmount,
          platformFeeAmount,
          platformFeePct,
          currency,
          commissionDistributionId: distribution._id?.toString(),
          paymentId,
          itemType,
          itemId,
          itemName,
        });
        if (fResult.applied > 0) {
          console.log(
            `[Commission] Franchise program distributed: $${fResult.totalPaidOut} ` +
              `across ${fResult.applied} payout(s) for office ${orgId} ` +
              `(program ${fResult.programId})`
          );
        }
      } catch (err) {
        console.warn(
          `[Commission] Franchise program distribution failed (non-blocking) for ${itemType} "${itemName}":`,
          err
        );
      }
    }

    console.log(`[Commission] Distributed for ${itemType} "${itemName}":
      Original Sale: ${originalSaleAmount} ${fromCurrency} (→ $${saleAmount} USD @ ${exchangeRate})
      Platform (${platformFeePct}%): $${platformFeeAmount} → ${PLATFORM_USER_EMAIL}
      Seller gross (${100 - platformFeePct}%): $${sellerGrossAmount}
      Affiliate deductions: $${totalCommissionAmount}
      Seller final: $${sellerAmount}`);

    return {
      distribution,
      sellerCredited: sellerAmount,
      platformFee: platformFeeAmount,
      commissionsPaid,
    };
  } catch (error) {
    await session.abortTransaction();

    // Create failed distribution record
    await CommissionDistribution.create({
      combPlanId: combPlan?._id,
      orgId: new Types.ObjectId(orgId),
      sellerId: new Types.ObjectId(sellerId),
      customerId: new Types.ObjectId(customerId),
      itemType,
      itemId: new Types.ObjectId(itemId),
      itemName,
      saleAmount,
      currency,
      platformFeePercentage: platformFeePct,
      platformFeeAmount,
      netAmount,
      sellerAmount,
      commissions: [],
      totalCommissionAmount: 0,
      paymentId,
      status: "failed",
      failureReason: (error as Error).message,
      isRecurringPayment,
      recurringPaymentNumber,
      metadata,
    });

    throw error;
  } finally {
    session.endSession();
  }
}

// ============= Commission History =============

export async function getCommissionHistory(
  userId: string,
  options: {
    role?: "seller" | "referrer";
    orgId?: string;
    itemType?: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event";
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  distributions: ICommissionDistribution[];
  total: number;
  summary: {
    totalEarnings: number;
    totalSales: number;
    earningsByLevel: Record<number, number>;
    earningsByItemType: Record<string, number>;
  };
}> {
  const {
    role = "seller",
    orgId,
    itemType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  const query: any = { status: "completed" };

  if (role === "seller") {
    query.sellerId = new Types.ObjectId(userId);
  } else {
    query["commissions.userId"] = new Types.ObjectId(userId);
  }

  if (orgId) query.orgId = new Types.ObjectId(orgId);
  if (itemType) query.itemType = itemType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = startDate;
    if (endDate) query.createdAt.$lte = endDate;
  }

  const [distributions, total] = await Promise.all([
    CommissionDistribution.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("customerId", "name email profilePicture")
      .populate("sellerId", "name email profilePicture")
      .lean(),
    CommissionDistribution.countDocuments(query),
  ]);

  // Calculate summary
  let totalEarnings = 0;
  let totalSales = 0;
  const earningsByLevel: Record<number, number> = {};
  const earningsByItemType: Record<string, number> = {};

  // Get all distributions for summary (without pagination)
  const allDistributions = await CommissionDistribution.find(query).lean();

  for (const dist of allDistributions) {
    if (role === "seller") {
      totalEarnings += dist.sellerAmount;
      totalSales += dist.saleAmount;
      earningsByItemType[dist.itemType] =
        (earningsByItemType[dist.itemType] || 0) + dist.sellerAmount;
    } else {
      // For referrer, find their commission in each distribution
      for (const comm of dist.commissions) {
        if (comm.userId.toString() === userId) {
          totalEarnings += comm.amount;
          totalSales += dist.saleAmount;
          earningsByLevel[comm.level] =
            (earningsByLevel[comm.level] || 0) + comm.amount;
          earningsByItemType[dist.itemType] =
            (earningsByItemType[dist.itemType] || 0) + comm.amount;
        }
      }
    }
  }

  return {
    distributions,
    total,
    summary: {
      totalEarnings,
      totalSales,
      earningsByLevel,
      earningsByItemType,
    },
  };
}

// ============= Item Commission Stats =============

export async function getItemCommissionStats(
  itemType: "course" | "product" | "channel" | "workshop" | "service" | "call" | "event",
  itemId: string
): Promise<{
  totalSales: number;
  totalRevenue: number;
  totalPlatformFees: number;
  totalCommissionsPaid: number;
  totalSellerEarnings: number;
  distributionCount: number;
}> {
  const stats = await CommissionDistribution.aggregate([
    {
      $match: {
        itemType,
        itemId: new Types.ObjectId(itemId),
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$saleAmount" },
        totalPlatformFees: { $sum: "$platformFeeAmount" },
        totalCommissionsPaid: { $sum: "$totalCommissionAmount" },
        totalSellerEarnings: { $sum: "$sellerAmount" },
        distributionCount: { $sum: 1 },
      },
    },
  ]);

  if (stats.length === 0) {
    return {
      totalSales: 0,
      totalRevenue: 0,
      totalPlatformFees: 0,
      totalCommissionsPaid: 0,
      totalSellerEarnings: 0,
      distributionCount: 0,
    };
  }

  return {
    totalSales: stats[0].distributionCount,
    totalRevenue: stats[0].totalSales,
    totalPlatformFees: stats[0].totalPlatformFees,
    totalCommissionsPaid: stats[0].totalCommissionsPaid,
    totalSellerEarnings: stats[0].totalSellerEarnings,
    distributionCount: stats[0].distributionCount,
  };
}

// ============= Third-Party Commission Reconciliation =============

/**
 * Replay commission distribution for paid third-party invoices that never
 * completed it.
 *
 * Multi-month terms turn a single distribution into N, so a transient failure
 * partway through the loop is far more likely than it was. Rather than retrying
 * inline on the payment request path, we leave `commissionDistributed: false`
 * and sweep here.
 *
 * Safe by construction: each month's UP distribution is idempotent on its unique
 * `paymentId`, and the platform credit is idempotent on `metadata.dedupeKey` —
 * so a replay only fills in what's genuinely missing.
 */
export async function reconcileThirdPartyCommissions(options?: {
  limit?: number;
  minAgeMinutes?: number;
}): Promise<{
  scanned: number;
  repaired: number;
  stillFailing: number;
  errors: Array<{ invoiceNumber: string; error: string }>;
}> {
  const limit = options?.limit ?? 200;
  const minAgeMinutes = options?.minAgeMinutes ?? 10;

  const { Invoice } = await import("../models/invoice.model");
  const { ThirdPartyClient } = await import("../models/thirdPartyClient.model");

  const candidates = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    status: "paid",
    commissionDistributed: { $ne: true },
    totalAmount: { $gt: 0 },
    "metadata.kind": { $ne: "topup" },
    paidAt: { $lt: new Date(Date.now() - minAgeMinutes * 60_000) },
  }).limit(limit);

  let repaired = 0;
  let stillFailing = 0;
  const errors: Array<{ invoiceNumber: string; error: string }> = [];

  for (const invoice of candidates) {
    try {
      if (!invoice.thirdPartyClientId) continue;
      const client = await ThirdPartyClient.findById(invoice.thirdPartyClientId);
      if (!client) continue;

      await distributeThirdPartySubscription({
        invoice,
        paymentId: invoice.razorpayPaymentId || `reconcile_${invoice._id}`,
        client,
      });
      invoice.commissionDistributed = true;
      await invoice.save();
      repaired++;
      console.log(
        `[ThirdPartyReconcile] repaired ${invoice.invoiceNumber}`
      );
    } catch (err: any) {
      stillFailing++;
      errors.push({
        invoiceNumber: invoice.invoiceNumber,
        error: err?.message || String(err),
      });
      // Persist the partial-state breadcrumb stamped by the distributor.
      try {
        await invoice.save();
      } catch {
        /* best effort */
      }
    }
  }

  if (candidates.length > 0) {
    console.log(
      `[ThirdPartyReconcile] scanned=${candidates.length} repaired=${repaired} stillFailing=${stillFailing}`
    );
  }
  return { scanned: candidates.length, repaired, stillFailing, errors };
}

// ============= Third-Party Subscription Distribution =============

/**
 * Distribute a third-party subscription payment.
 *
 * Split: the per-month `upPortion` runs through the Unilevel Plus distribution
 * tree ONCE PER MONTH COVERED, and `platformPortion × termMonths` is credited
 * directly to the platform store wallet.
 *
 * Why per-month rather than one distribution on the whole term: the UP tree's
 * per-recipient amounts are calibrated to the $25 licence and do not scale up
 * (`planScale` is capped at 1 in unilevelPlusCommission.ts, level bonuses are a
 * flat `legMultiplier × level × $0.03`). A single distribution on a 12-month
 * $144 base would therefore pay the upline roughly what a $12 base pays and
 * sweep the remainder to the platform — prepaying would silently gut affiliate
 * earnings. Running N × $12 makes a 12-month prepay pay exactly what 12 monthly
 * invoices pay.
 *
 * Idempotent on (invoiceId, recurringPaymentNumber, monthIndex): each month owns
 * a distinct paymentId under a unique index, and the platform credit carries a
 * dedupeKey — so the whole function is safely replayable.
 */
export async function distributeThirdPartySubscription(input: {
  invoice: any; // IInvoice
  paymentId: string;
  client: any; // IThirdPartyClient
}): Promise<{
  upDistributionId: string | null;
  upDistributionIds: string[];
  platformCreditAmount: number;
  upPortion: number;
  termMonths: number;
  monthsDistributed: number;
  monthsFailed: number;
}> {
  const { invoice, paymentId, client } = input;

  // getActiveUnilevelPlusPlan / distributeUnilevelPlusCommission are retained
  // for the commented-out tree distribution in step 1; the NetworkChain bonus
  // itself needs neither.
  const { getActiveUnilevelPlusPlan, distributeUnilevelPlusCommission } = await import(
    "./unilevelPlusCommission"
  );
  const { resolveTermPlan, resolveInvoiceTermMonths, perMonthPortions } =
    await import("./thirdPartyTerms");

  // Was a hard throw. The flat NetworkChain bonus does not touch the UP plan,
  // so deactivating that plan must no longer block NetworkChain distribution —
  // that would strand every subscription invoice for an unrelated reason.
  // NOTE: restoring the tree in step 1 means restoring the throw too;
  // `plan._id` is dereferenced there.
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    console.warn(
      "[ThirdPartyCommission] No active Unilevel Plus plan — continuing, " +
        "the NetworkChain bonus does not depend on it"
    );
  }

  const recurringPaymentNumber = invoice.recurringPaymentNumber || 1;

  // Read the term from the INVOICE, never from its parent. The parent carries
  // mutable subscription state, so a term change landing between "child
  // generated at $216" and "child paid" would otherwise run 12 distributions
  // against a 6-month invoice.
  const termMonths = resolveInvoiceTermMonths(invoice);
  // allowInactive: a partner disabling a term must not break distribution for
  // invoices already issued on it.
  const termPlan = resolveTermPlan(client.productConfig, termMonths, {
    allowInactive: true,
  });
  const { upPortion: upPerMonthList, platformPortion: platformPerMonthList } =
    perMonthPortions(client.productConfig);

  // Cash collected for this cycle.
  //
  // Normally that's the invoice total. A bundle is the exception: the buyer paid
  // on the UP licence invoice, so this cycle's `totalAmount` is 0 and the real
  // subscription revenue lives in `metadata.bundle.subUsd`.
  const bundleMeta = (invoice.metadata as any)?.bundle;
  const prepaidViaBundle = !!(invoice.metadata as any)?.prepaidViaBundle;
  const paidAmount =
    prepaidViaBundle && bundleMeta?.subUsd != null
      ? Number(bundleMeta.subUsd)
      : invoice.totalAmount / 100;

  const fullTermAmount = termPlan.totalAmount;

  let scaledUp: number;
  let scaledPlatform: number;

  if (termMonths === 1) {
    // ── MONTHLY: unchanged, proportional. ────────────────────────────────
    // Monthly is the ONLY plan that accepts coupons, and coupon compression is
    // the behaviour we want there — otherwise a 90%-off coupon would pay full
    // comp on 10% of the revenue.
    //
    // `paidAmount` is deliberately still GST-INCLUSIVE here, preserving today's
    // semantics exactly: for an Indian buyer this yields scale≈1.18 and pays the
    // GST out as commission. Known, separately-tracked bug; fixing it here would
    // silently cut Indian payouts by 18% as a side effect of this change.
    const scale = fullTermAmount > 0 ? paidAmount / fullTermAmount : 0;
    scaledUp = Math.round(upPerMonthList * scale * 100) / 100;
    scaledPlatform =
      Math.round(platformPerMonthList * termMonths * scale * 100) / 100;
  } else {
    // ── MULTI-MONTH: list-based, uncompressed. ───────────────────────────
    // Affiliates receive the full list `upPortion` for every month covered, no
    // matter what discount the buyer got (term pricing, bundle pricing). The
    // platform absorbs the entire discount as the residual.
    //
    // Coupons are blocked on multi-month terms at creation and at term-change,
    // so `paidAmount` here only ever reflects term/bundle pricing.
    //
    // Side benefit: because comp is pinned to list, the GST bug above cannot
    // reach affiliates on this path — an Indian buyer's 18% flows to the
    // platform as residual, which is where it belongs.
    scaledUp = upPerMonthList;
    scaledPlatform =
      Math.round((paidAmount - upPerMonthList * termMonths) * 100) / 100;

    if (scaledPlatform < 0) {
      // The termPlans validator (upPortion × months <= cheapest sell price)
      // should make this unreachable. If it fires anyway, clamp rather than
      // silently debiting the platform wallet — same failure mode as the
      // infinity-pool overspend fixed in unilevelPlusCommission.ts.
      console.error(
        `[ThirdPartyCommission] NEGATIVE platform share for ${invoice.invoiceNumber}: ` +
          `paid $${paidAmount} < comp $${upPerMonthList * termMonths} ` +
          `(${termMonths}-month term). Clamping to 0 — check productConfig.termPlans.`
      );
      scaledPlatform = 0;
    }
  }

  // Step 1: Pay the per-month portion out, once per month covered.
  //
  // paymentId compatibility is NON-NEGOTIABLE:
  //   termMonths === 1 → `tp_<invoiceId>_<n>`        (byte-identical to today)
  //   termMonths  > 1  → `tp_<invoiceId>_<n>_m<1..T>` (all new, cannot collide)
  // Emitting `_m1` for the single-month case would make every historical
  // invoice look undistributed, and a replay would double-pay the whole tree.
  const basePaymentId = `tp_${invoice._id.toString()}_${recurringPaymentNumber}`;
  const monthPaymentId = (m: number) =>
    termMonths === 1 ? basePaymentId : `${basePaymentId}_m${m}`;

  const upDistributionIds: string[] = [];
  const failedMonths: Array<{ month: number; error: string }> = [];

  // ──────────────────────────────────────────────────────────────────────
  // NETWORKCHAIN BONUS — flat, direct to the sponsor.
  //
  // The per-month portion used to run through the whole Unilevel Plus tree
  // (company 4% / direct 36% / level 43.2% / infinity 7.2%+7.2% / manager
  // 2.4%). It no longer does: the entire amount now goes to the buyer's ONE
  // direct sponsor as a flat "NetworkChain bonus". Nobody above the sponsor
  // earns from a NetworkChain subscription.
  //
  // The UP tree is still what pays out on the $25 licence — this change is
  // scoped to third-party subscription invoices only.
  //
  // TO RESTORE the tree: delete the `payNetworkChainBonus` loop below and
  // uncomment the `distributeUnilevelPlusCommission` block beneath it. The
  // amounts (`scaledUp` per month) and the paymentId scheme are deliberately
  // unchanged, so nothing else needs touching.
  // ──────────────────────────────────────────────────────────────────────

  // Resolved BEFORE any money moves, so a misconfigured platform user fails
  // the whole call rather than stranding it half-distributed.
  const platformUser = await User.findOne({
    email: client.productConfig.platformUserEmail,
  })
    .select("_id")
    .lean();
  if (!platformUser) {
    throw new Error(
      `Platform user ${client.productConfig.platformUserEmail} not found — cannot credit platform share`
    );
  }
  const platformUserId = platformUser._id;

  // The sponsor is the buyer's DIRECT referrer. A self-referrer (the network
  // founder) counts as having none — otherwise they would pay themselves.
  const buyer = await User.findById(invoice.userId).select({ referredBy: 1 }).lean();
  const sponsorId =
    buyer?.referredBy && String(buyer.referredBy) !== String(invoice.userId)
      ? String(buyer.referredBy)
      : null;

  // An orphan buyer's bonus goes to the platform rather than evaporating —
  // the money is already collected, so it has to land somewhere auditable.
  const bonusRecipientId = sponsorId || platformUserId.toString();

  let ncBonusRoutedToPlatform = 0;

  for (let m = 1; m <= termMonths; m++) {
    // Distinct namespace from the UP paymentIds, so replaying an invoice that
    // was distributed under the old tree can never collide with a bonus row.
    const dedupeKey = `${basePaymentId}_ncbonus_m${m}`;
    try {
      const already = await WalletTransaction.findOne({
        "metadata.dedupeKey": dedupeKey,
      })
        .select({ _id: 1 })
        .lean();
      if (already) {
        console.log(
          `[ThirdPartyCommission] NC bonus month ${m}/${termMonths} already paid for ${invoice.invoiceNumber}`
        );
        upDistributionIds.push(already._id.toString());
        continue;
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const credit = await creditAffiliateOrPlatform({
          recipientUserId: bonusRecipientId,
          amount: scaledUp,
          currency: "USD",
          description: `NetworkChain bonus — ${client.name}`,
          note:
            termMonths === 1
              ? undefined
              : `Month ${m} of ${termMonths}`,
          relatedUserId: invoice.userId.toString(),
          metadata: {
            dedupeKey,
            paymentId: monthPaymentId(m),
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            thirdPartyClientId: client._id.toString(),
            thirdPartyClientName: client.name,
            recurringPaymentNumber,
            source: "third_party_subscription",
            bonusType: "networkchain_direct",
            couponCode: invoice.couponCode,
            // How this month's base was derived. "list" means uncompressed
            // (multi-month); "scaled" means proportional to what was collected
            // (monthly, where coupons apply).
            commissionBasis: termMonths === 1 ? "scaled" : "list",
            termMonths,
            termMonthIndex: m,
            termPriceUsd: fullTermAmount,
            paidAmountUsd: paidAmount,
            // True when the buyer had no sponsor at all, as opposed to a
            // sponsor who simply holds no UP licence — different problems.
            ...(sponsorId ? {} : { orphanBuyer: true }),
            ...(prepaidViaBundle ? { prepaidViaBundle: true } : {}),
          },
          session,
        });
        await session.commitTransaction();
        upDistributionIds.push(credit.transaction._id.toString());
        if (credit.routedToPlatform) ncBonusRoutedToPlatform++;
      } catch (inner) {
        await session.abortTransaction();
        throw inner;
      } finally {
        session.endSession();
      }
    } catch (err: any) {
      // The dedupeKey carries a partial unique index, so a concurrent replay
      // surfaces as E11000. That means "already paid" — counting it as a
      // failure would strand the invoice at commissionDistributed=false.
      if (err?.code === 11000) {
        console.log(
          `[ThirdPartyCommission] NC bonus month ${m}/${termMonths} raced for ${invoice.invoiceNumber} (E11000)`
        );
        continue;
      }
      failedMonths.push({ month: m, error: err?.message || String(err) });
      console.error(
        `[ThirdPartyCommission] NC bonus month ${m}/${termMonths} failed for ${invoice.invoiceNumber}:`,
        err
      );
    }
  }

  console.log(
    `[ThirdPartyCommission] ${invoice.invoiceNumber}: NC bonus $${scaledUp} × ${termMonths} ` +
      `→ ${sponsorId ? `sponsor ${sponsorId}` : "platform (orphan buyer)"}` +
      (ncBonusRoutedToPlatform
        ? ` (${ncBonusRoutedToPlatform}/${termMonths} routed to platform — no active UP licence)`
        : "")
  );

  /* ── DISABLED: Unilevel Plus tree distribution ────────────────────────────
   * Superseded by the flat NetworkChain bonus above. Kept verbatim so the
   * tree can be switched back on without reconstructing it.
   *
   * Sequential, never Promise.all: distributeUnilevelPlusCommission walks the
   * upline and mutates the same wallet documents, so concurrent runs for one
   * buyer contend on identical docs and produce Mongo write conflicts.
   *
   * for (let m = 1; m <= termMonths; m++) {
   *   try {
   *     const r = await distributeUnilevelPlusCommission({
   *       buyerId: invoice.userId.toString(),
   *       planId: plan._id.toString(),
   *       saleAmount: scaledUp,
   *       currency: "USD",
   *       paymentId: monthPaymentId(m),
   *       metadata: {
   *         invoiceId: invoice._id.toString(),
   *         invoiceNumber: invoice.invoiceNumber,
   *         thirdPartyClientId: client._id.toString(),
   *         thirdPartyClientName: client.name,
   *         recurringPaymentNumber,
   *         source: "third_party_subscription",
   *         couponCode: invoice.couponCode,
   *         commissionBasis: termMonths === 1 ? "scaled" : "list",
   *         termMonths,
   *         termMonthIndex: m,
   *         termPriceUsd: fullTermAmount,
   *         paidAmountUsd: paidAmount,
   *         ...(prepaidViaBundle ? { prepaidViaBundle: true } : {}),
   *       },
   *     });
   *     upDistributionIds.push(r.distribution._id.toString());
   *   } catch (err: any) {
   *     // UnilevelPlusDistribution has a unique sparse index on paymentId, so
   *     // a concurrent duplicate surfaces as E11000. That means "already
   *     // distributed" — treating it as a failure would strand the invoice at
   *     // commissionDistributed=false forever.
   *     if (err?.code === 11000) {
   *       console.log(
   *         `[ThirdPartyCommission] month ${m}/${termMonths} already distributed for ${invoice.invoiceNumber} (E11000)`
   *       );
   *       continue;
   *     }
   *     failedMonths.push({ month: m, error: err?.message || String(err) });
   *     console.error(
   *       `[ThirdPartyCommission] month ${m}/${termMonths} failed for ${invoice.invoiceNumber}:`,
   *       err
   *     );
   *   }
   * }
   * ─────────────────────────────────────────────────────────────────────── */

  // Step 2: Credit the (possibly scaled) platformPortion to Shorupan's store wallet.
  // `platformUserId` is resolved above, before step 1 moves any money.
  const platformOrgObjectId = new Types.ObjectId(client.productConfig.platformOrgId);
  const platformCreditAmount = scaledPlatform;

  // Idempotency key for the platform credit.
  //
  // This block was previously guarded only by invoice.commissionDistributed —
  // and NOT by the UP paymentId, because distributeUnilevelPlusCommission
  // returning early on a duplicate does not stop the wallet credit below it.
  // So a replay already double-credited the platform wallet. The multi-month
  // loop above (which can fail partway and be retried) and the reconciliation
  // cron make replay routine, so this must now be genuinely idempotent.
  const platformDedupeKey = `tp_platform_${invoice._id.toString()}_${recurringPaymentNumber}`;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const alreadyCredited = await WalletTransaction.findOne({
      "metadata.dedupeKey": platformDedupeKey,
    })
      .session(session)
      .lean();

    if (alreadyCredited) {
      console.log(
        `[ThirdPartyCommission] platform share already credited for ${invoice.invoiceNumber} cycle ${recurringPaymentNumber} — skipping`
      );
      await session.commitTransaction();
      session.endSession();
      return buildResult();
    }

    let platformWallet = await StoreWallet.findOne({
      userId: platformUserId,
      orgId: platformOrgObjectId,
    }).session(session);

    if (!platformWallet) {
      const created = await StoreWallet.create(
        [
          {
            userId: platformUserId,
            orgId: platformOrgObjectId,
            balance: 0,
            currency: "USD",
          },
        ],
        { session }
      );
      platformWallet = created[0];
    }

    const balanceBefore = platformWallet.balance;
    const balanceAfter = balanceBefore + platformCreditAmount;
    platformWallet.balance = balanceAfter;
    platformWallet.lastTransactionAt = new Date();
    await platformWallet.save({ session });

    await WalletTransaction.create(
      [
        {
          storeWalletId: platformWallet._id,
          walletType: "store",
          userId: platformUserId,
          orgId: platformOrgObjectId,
          type: "credit",
          amount: platformCreditAmount,
          currency: "USD",
          balanceBefore,
          balanceAfter,
          description: `Third-party subscription platform share: ${client.name}`,
          note: `$${platformCreditAmount} platform share from ${client.productConfig.productCode} (cycle ${recurringPaymentNumber}, ${termMonths}-month term, $${paidAmount} collected${prepaidViaBundle ? " prepaid in a $25 licence bundle" : ""}). Comp basis: ${termMonths === 1 ? "scaled to amount paid" : `list ($${upPerMonthList}/mo × ${termMonths})`}.`,
          relatedUserId: invoice.userId,
          metadata: {
            invoiceId: invoice._id.toString(),
            invoiceNumber: invoice.invoiceNumber,
            thirdPartyClientId: client._id.toString(),
            productCode: client.productConfig.productCode,
            recurringPaymentNumber,
            razorpayPaymentId: paymentId,
            termMonths,
            termPriceUsd: fullTermAmount,
            dedupeKey: platformDedupeKey,
          },
          status: "completed",
        },
      ],
      { session }
    );

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    // endSession is idempotent; the early-return path above already called it.
    session.endSession();
  }

  console.log(
    `[ThirdPartyCommission] Invoice ${invoice.invoiceNumber}: ${upDistributionIds.length}/${termMonths} UP distributions @ $${scaledUp}, $${platformCreditAmount} → ${client.productConfig.platformUserEmail}`
  );

  return buildResult();

  function buildResult() {
    // Log-only cross-check. Rounding `scaledUp` to cents before multiplying can
    // leave up to $0.01 × termMonths unallocated on a future discounted term;
    // that residue is the platform's under the existing convention, so this
    // must never throw.
    const allocated =
      Math.round((scaledUp * termMonths + platformCreditAmount) * 100) / 100;
    if (Math.abs(allocated - paidAmount) > 0.02 * termMonths) {
      console.error(
        `[ThirdPartyCommission] SPLIT MISMATCH ${invoice.invoiceNumber}: allocated $${allocated} vs paid $${paidAmount} (term ${termMonths})`
      );
    }

    if (failedMonths.length > 0) {
      // Surface the partial state on the invoice, then throw so fulfillInvoice
      // records distribution_error and leaves commissionDistributed=false —
      // it still fires the partner webhook regardless, and the reconciliation
      // cron will replay only the missing months.
      invoice.metadata = {
        ...(invoice.metadata || {}),
        commissionPartial: {
          termMonths,
          distributed: upDistributionIds.length,
          failedMonths,
          lastAttemptAt: new Date(),
        },
      };
      throw new Error(
        `Third-party commission incomplete for ${invoice.invoiceNumber}: ${failedMonths.length}/${termMonths} months failed (${failedMonths
          .map((f) => `m${f.month}: ${f.error}`)
          .join("; ")})`
      );
    }

    return {
      upDistributionId: upDistributionIds[0] || null,
      upDistributionIds,
      platformCreditAmount,
      upPortion: Math.round(scaledUp * termMonths * 100) / 100,
      termMonths,
      monthsDistributed: upDistributionIds.length,
      monthsFailed: failedMonths.length,
    };
  }
}
