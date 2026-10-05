import mongoose, { Types } from "mongoose";
import {
  UnilevelPlusPlan,
  IUnilevelPlusPlan,
  UNILEVEL_PLUS_PLAN_CONFIG,
  UNILEVEL_PLUS_PLAN_ID,
} from "../models/unilevelPlusPlan.model";
import {
  UnilevelPlusDistribution,
  IUnilevelPlusDistribution,
  IUPLevelBonusRecipient,
  IUPInfinityBonusRecipient,
} from "../models/unilevelPlusDistribution.model";
import {
  UnilevelPlusPurchase,
  IUnilevelPlusPurchase,
} from "../models/unilevelPlusPurchase.model";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { creditAffiliateOrPlatform } from "./wallet";
// GST imports removed: Unilevel Plus is always priced exclusive of GST, so
// the commission base needs no tax extraction — see the note at the
// commissionBase assignment below.

/**
 * Stamp a recipient row with what actually reached their wallet.
 *
 * The distribution record is written BEFORE any money moves, so its `amount`
 * fields are what the comp plan allocated. When the NetworkChain coverage
 * split fires (services/networkChainCoverage.ts) the earner only receives half,
 * and `getUPCommissionStats` reads this record rather than the wallet — so
 * without this the member is shown roughly double what they were paid.
 *
 * `creditedAmount` is set unconditionally, including when there is no split, so
 * readers of NEW rows never have to guess; the optional fallback to `amount`
 * exists only for rows written before these fields did.
 */
/**
 * Reduce a credit result to the shape `applySplit` records.
 *
 * A founder cascade takes the WHOLE bonus, so it is expressed as a split where
 * the recipient kept nothing. Modelling it this way means the distribution row,
 * `getUPCommissionStats` and the member's own earnings page all report what
 * actually landed, with no extra field to remember to read.
 */
function splitFromCreditResult(result: {
  networkChainSplit?: {
    recipientAmount: number;
    forfeitedAmount: number;
    forfeitedToUserId: string | null;
  };
  founderCascade?: { forfeitedAmount: number; toUserId: string | null };
}) {
  if (result.networkChainSplit) return result.networkChainSplit;
  if (result.founderCascade) {
    return {
      recipientAmount: 0,
      forfeitedAmount: result.founderCascade.forfeitedAmount,
      forfeitedToUserId: result.founderCascade.toUserId,
    };
  }
  return undefined;
}

function applySplit(
  recipient: IUPLevelBonusRecipient | IUPInfinityBonusRecipient,
  split?: {
    recipientAmount: number;
    forfeitedAmount: number;
    forfeitedToUserId: string | null;
  }
): void {
  recipient.creditedAmount = split ? split.recipientAmount : recipient.amount;
  if (split) {
    recipient.forfeitedAmount = split.forfeitedAmount;
    recipient.forfeitedToUserId = split.forfeitedToUserId
      ? new Types.ObjectId(split.forfeitedToUserId)
      : undefined;
  }
}

// Platform configuration (same as commission.ts)
const PLATFORM_USER_EMAIL = "shorupan@gmail.com";
const PLATFORM_ORG_ID = "68f1fe05876fcc5fadb61951";

// ============= Plan Initialization =============

/**
 * Initialize the global Unilevel Plus plan in the database.
 * Runs on startup — creates the plan if it doesn't exist, updates it if config changed.
 * Similar to initializeOfficePlans().
 */
export async function initializeUnilevelPlusPlan(): Promise<IUnilevelPlusPlan> {
  const config = UNILEVEL_PLUS_PLAN_CONFIG;
  const fixedId = new Types.ObjectId(UNILEVEL_PLUS_PLAN_ID);

  // Drop legacy org-scoped unique index if it exists (was: { orgId: 1, isActive: 1 })
  try {
    const collectionName = UnilevelPlusPlan.collection.collectionName;
    const collection = mongoose.connection.collection(collectionName);
    const indexes = await collection.indexes();
    const legacyIdx = indexes.find(
      (idx) => idx.key && idx.key.orgId !== undefined && idx.key.isActive !== undefined && idx.unique
    );
    if (legacyIdx && legacyIdx.name) {
      await collection.dropIndex(legacyIdx.name);
      console.log(`[UnilevelPlus] Dropped legacy org-scoped index: ${legacyIdx.name}`);
    }
  } catch {
    // Collection may not exist yet — that's fine
  }

  let plan = await UnilevelPlusPlan.findById(fixedId);

  if (plan) {
    // Update fields if config changed
    let changed = false;
    const fields = [
      "name", "description", "productPrice", "currency",
      "companyPercentage", "directBonusPercentage", "levelBonusPercentage",
      "infinityTier1Percentage", "infinityTier2Percentage", "managerBonusPercentage",
      "maxLevels", "pointValue",
      "infinityTier1Enabled", "infinityTier2Enabled", "managerBonusEnabled",
    ] as const;

    for (const f of fields) {
      if ((plan as any)[f] !== (config as any)[f]) {
        (plan as any)[f] = (config as any)[f];
        changed = true;
      }
    }
    // Compare legMultipliers array
    if (JSON.stringify(plan.legMultipliers) !== JSON.stringify(config.legMultipliers)) {
      plan.legMultipliers = config.legMultipliers;
      changed = true;
    }

    if (changed) {
      await plan.save();
      console.log(`[UnilevelPlus] Updated global plan with latest config`);
    } else {
      console.log(`[UnilevelPlus] Global plan already up to date`);
    }
  } else {
    // Deactivate any old plans first
    await UnilevelPlusPlan.updateMany({ isActive: true }, { isActive: false });

    const { _id: _configId, ...configWithoutId } = config;
    plan = await UnilevelPlusPlan.create({
      _id: fixedId,
      ...configWithoutId,
    });
    console.log(`[UnilevelPlus] Created global plan: ${plan.name} ($${plan.productPrice})`);
  }

  return plan;
}

/**
 * Get the single global active Unilevel Plus plan.
 * Not org-scoped — there is one plan for the entire platform.
 */
export async function getActiveUnilevelPlusPlan(): Promise<IUnilevelPlusPlan | null> {
  return UnilevelPlusPlan.findOne({ isActive: true }).lean();
}

// ============= Plan CRUD =============

export async function createUnilevelPlusPlan(data: {
  name: string;
  description?: string;
  productPrice: number;
  currency?: string;
  companyPercentage: number;
  directBonusPercentage: number;
  levelBonusPercentage: number;
  infinityTier1Percentage?: number;
  infinityTier2Percentage?: number;
  managerBonusPercentage?: number;
  maxLevels?: number;
  pointValue?: number;
  legMultipliers?: number[];
  orgId?: string;
  createdBy?: string;
}): Promise<IUnilevelPlusPlan> {
  // Deactivate any existing active plans globally
  await UnilevelPlusPlan.updateMany(
    { isActive: true },
    { isActive: false }
  );

  const plan = new UnilevelPlusPlan({
    name: data.name,
    description: data.description,
    productPrice: data.productPrice,
    currency: data.currency || "USD",
    companyPercentage: data.companyPercentage,
    directBonusPercentage: data.directBonusPercentage,
    levelBonusPercentage: data.levelBonusPercentage,
    infinityTier1Percentage: data.infinityTier1Percentage ?? 0,
    infinityTier2Percentage: data.infinityTier2Percentage ?? 0,
    managerBonusPercentage: data.managerBonusPercentage ?? 0,
    maxLevels: data.maxLevels ?? 15,
    pointValue: data.pointValue ?? 0.03,
    legMultipliers: data.legMultipliers ?? [1, 2, 3],
    ...(data.orgId && { orgId: new Types.ObjectId(data.orgId) }),
    ...(data.createdBy && { createdBy: new Types.ObjectId(data.createdBy) }),
    isActive: true,
  });

  await plan.save();
  return plan;
}

export async function getUnilevelPlusPlan(
  planId: string
): Promise<IUnilevelPlusPlan | null> {
  return UnilevelPlusPlan.findById(planId).lean();
}

/** @deprecated Use getActiveUnilevelPlusPlan() instead — plan is now global. */
export async function getActivePlanForOrg(
  _orgId?: string
): Promise<IUnilevelPlusPlan | null> {
  return getActiveUnilevelPlusPlan();
}

export async function getUnilevelPlusPlansByOrg(
  _orgId?: string,
  options: { isActive?: boolean; limit?: number; offset?: number } = {}
): Promise<{ plans: IUnilevelPlusPlan[]; total: number }> {
  const { isActive, limit = 50, offset = 0 } = options;

  const query: any = {};
  if (isActive !== undefined) query.isActive = isActive;

  const [plans, total] = await Promise.all([
    UnilevelPlusPlan.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    UnilevelPlusPlan.countDocuments(query),
  ]);

  return { plans, total };
}

export async function updateUnilevelPlusPlan(
  planId: string,
  updates: {
    name?: string;
    description?: string;
    productPrice?: number;
    currency?: string;
    companyPercentage?: number;
    directBonusPercentage?: number;
    levelBonusPercentage?: number;
    infinityTier1Percentage?: number;
    infinityTier2Percentage?: number;
    managerBonusPercentage?: number;
    maxLevels?: number;
    pointValue?: number;
    legMultipliers?: number[];
    isActive?: boolean;
  }
): Promise<IUnilevelPlusPlan | null> {
  const plan = await UnilevelPlusPlan.findById(planId);
  if (!plan) return null;

  if (updates.name !== undefined) plan.name = updates.name;
  if (updates.description !== undefined) plan.description = updates.description;
  if (updates.productPrice !== undefined)
    plan.productPrice = updates.productPrice;
  if (updates.currency !== undefined) plan.currency = updates.currency;
  if (updates.companyPercentage !== undefined)
    plan.companyPercentage = updates.companyPercentage;
  if (updates.directBonusPercentage !== undefined)
    plan.directBonusPercentage = updates.directBonusPercentage;
  if (updates.levelBonusPercentage !== undefined)
    plan.levelBonusPercentage = updates.levelBonusPercentage;
  if (updates.infinityTier1Percentage !== undefined)
    plan.infinityTier1Percentage = updates.infinityTier1Percentage;
  if (updates.infinityTier2Percentage !== undefined)
    plan.infinityTier2Percentage = updates.infinityTier2Percentage;
  if (updates.managerBonusPercentage !== undefined)
    plan.managerBonusPercentage = updates.managerBonusPercentage;
  if (updates.maxLevels !== undefined) plan.maxLevels = updates.maxLevels;
  if (updates.pointValue !== undefined) plan.pointValue = updates.pointValue;
  if (updates.legMultipliers !== undefined)
    plan.legMultipliers = updates.legMultipliers;
  if (updates.isActive !== undefined) plan.isActive = updates.isActive;

  await plan.save();
  return plan;
}

export async function deleteUnilevelPlusPlan(
  planId: string
): Promise<boolean> {
  const hasDistributions = await UnilevelPlusDistribution.exists({
    planId: new Types.ObjectId(planId),
  });

  if (hasDistributions) {
    await UnilevelPlusPlan.updateOne(
      { _id: new Types.ObjectId(planId) },
      { isActive: false }
    );
  } else {
    await UnilevelPlusPlan.deleteOne({ _id: new Types.ObjectId(planId) });
  }

  return true;
}

// ============= Purchase Management =============

export async function getUserPurchase(
  userId: string
): Promise<IUnilevelPlusPurchase | null> {
  return UnilevelPlusPurchase.findOne({
    userId: new Types.ObjectId(userId),
    status: "active",
  }).lean();
}

// ============= Leg Determination =============

/**
 * Determine which leg a direct child is for a parent user.
 * Legs are ordered by createdAt of the direct referrals.
 * Leg 1 = first person referred, Leg 2 = second, etc.
 */
async function getLegNumber(
  parentUserId: string,
  directChildId: string
): Promise<number> {
  const directReferrals = await User.find({
    referredBy: new Types.ObjectId(parentUserId),
  })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();

  const index = directReferrals.findIndex(
    (r) => r._id.toString() === directChildId
  );

  if (index === -1) {
    console.warn(
      `[UnilevelPlus] Data inconsistency: User ${directChildId} not found among referrals of ${parentUserId}. Defaulting to Leg 1.`
    );
    return 1;
  }

  return index + 1; // 1-based
}

/**
 * How many of this upline's direct referrals hold an ACTIVE Unilevel Plus
 * licence. This is the infinity-tier gate: 4+ unlocks Tier 1, 10+ unlocks
 * Tier 2, and once unlocked the upline is paid on EVERY sale that passes
 * through them — whichever leg it came up.
 *
 * HISTORY. Until 2026-09-16 this returned the POSITION of the leg the sale
 * travelled through (1-based, UP-active directs in signup order) and the
 * caller tested `position >= 4`. So a member whose first signup built the
 * whole team never saw a cent of infinity, while a member whose 4th signup
 * built it earned on all of it — and the plan's own description ("up to 3
 * uplines with 4+ legs") described a headcount. The founder ruled it a
 * headcount. Forward-only; no backpay.
 *
 * Deliberately a live count, re-evaluated on every sale: a lapsed licence
 * drops the count, and qualification with it. Same as before, just a
 * different test.
 *
 * Kept separate from getLegNumber on purpose: the LEVEL bonus multiplier
 * still uses leg POSITION among all directs, and that is unchanged.
 *
 * `_directChildId` is accepted so the two call sites read the same as they
 * always did; it no longer affects the answer.
 */
async function getActiveUpDirectCount(
  parentUserId: string,
  _directChildId: string
): Promise<number> {
  const directs = await User.find({
    referredBy: new Types.ObjectId(parentUserId),
  })
    .select("_id")
    .lean();
  if (directs.length === 0) return 0;

  return UnilevelPlusPurchase.countDocuments({
    userId: { $in: directs.map((d) => d._id) },
    status: "active",
  });
}

/**
 * Get leg multiplier based on leg number and multiplier config.
 * For [1, 2, 3]: Leg 1 → 1×, Leg 2 → 2×, Leg 3+ → 3× (capped at last)
 */
function getLegMultiplier(
  legNumber: number,
  legMultipliers: number[]
): number {
  if (legNumber <= legMultipliers.length) {
    return legMultipliers[legNumber - 1];
  }
  return legMultipliers[legMultipliers.length - 1];
}

// ============= Infinity Tier Constants =============

// Flat amount per qualifying user, per sale — now PER TIER.
//
// These were a single shared 0.6 constant. They have to differ because the
// plan deliberately weights tier 2 (10+ legs, the wide builders) far above
// tier 1 (4+ legs). Each must stay in step with its pool percentage in
// UNILEVEL_PLUS_PLAN_CONFIG, since a tier's pool is sized as
// 3 × per-recipient:
//   T1  3 × $0.40 = $1.20 =  4.8% of the $25 licence
//   T2  3 × $2.00 = $6.00 = 24%   of the $25 licence
// Change one without the other and the surplus (or shortfall) silently
// sweeps to the platform.
/**
 * Money precision for this engine: FOUR decimal places, not two.
 *
 * A payout is `legMultiplier × level × pointValue × planScale`. At the $25
 * licence that always lands on a whole cent, so cent-rounding cost nothing
 * and nobody noticed. Run the same schedule against a smaller base and it
 * breaks: at a $5 base the smallest level payout is $0.004, which rounds to
 * ZERO — the whole level pays nobody, silently. Below roughly $6.25 the
 * bottom of the comp plan simply stops existing.
 *
 * Four places keeps those payouts alive. It changes NOTHING at $25 or above,
 * where every figure is already an exact cent.
 *
 * Wallets accrue at this precision; WITHDRAWALS still settle in whole cents,
 * because no payment rail moves less than one. services/withdrawal.ts floors
 * to cents so the sub-cent remainder stays in the member's balance and rolls
 * forward, rather than being paid or lost.
 */
const MONEY_DP = 4;
const MONEY_SCALE = 10 ** MONEY_DP; // 10000
const money = (n: number) => Math.round(n * MONEY_SCALE) / MONEY_SCALE;

const INFINITY_T1_BONUS_PER_RECIPIENT = 0.4;
const INFINITY_T2_BONUS_PER_RECIPIENT = 2.0;
const INFINITY_MAX_RECIPIENTS_PER_TIER = 3; // Max 3 recipients per tier
export const INFINITY_T1_MIN_LEGS = 4;
export const INFINITY_T2_MIN_LEGS = 10;
const INFINITY_T2_ENABLED = true; // Set to false to deactivate Infinity Tier 2

/**
 * Count direct referrals (legs) for a user.
 */
async function getDirectReferralCount(userId: string): Promise<number> {
  return User.countDocuments({ referredBy: new Types.ObjectId(userId) });
}

// ============= Commission Distribution =============

export interface DistributeUPCommissionInput {
  buyerId: string;
  planId: string;
  saleAmount: number;
  currency?: string;
  paymentId: string;
  metadata?: Record<string, any>;
  /**
   * Where the pools the tree does NOT pay out end up.
   *
   *   "platform" (default) — today's behaviour: company share, unspent
   *      infinity tiers, the manager pool and the unallocated level budget are
   *      all credited to the platform store wallet. Licence sales, Office Pro
   *      and third-party subscriptions all rely on this.
   *
   *   "return" — credit NOTHING to the platform and report the figure back as
   *      `unspentAmount`. Used when a founder funds the tree from their own
   *      margin (a "unilevel_plus" CombPlan on a channel/community): the
   *      percentage they set is a ceiling on what the NETWORK can earn, and
   *      anything unearned has to stay with them rather than becoming
   *      platform revenue they never agreed to.
   */
  sweepUnspent?: "platform" | "return";
}

export interface DistributeUPCommissionResult {
  distribution: IUnilevelPlusDistribution;
  companyAmount: number;
  /**
   * Total the tree did NOT pay to anyone (company + unspent T1/T2 + manager +
   * unallocated level budget). With sweepUnspent "platform" this was credited
   * to the platform; with "return" it was credited to nobody and the caller
   * owns it.
   */
  unspentAmount: number;
  directBonusPaid: { userId: string; amount: number } | null;
  levelBonusesPaid: {
    userId: string;
    amount: number;
    level: number;
    legNumber: number;
  }[];
}

/**
 * Distribute commissions for a Unilevel Plus product purchase.
 *
 * Flow:
 * 1. Company gets companyPercentage
 * 2. Direct referrer gets directBonusPercentage
 * 3. Walk UP referral chain for level bonus (leg-aware multipliers)
 * 4. Reserve infinity & manager bonus pools
 */
export async function distributeUnilevelPlusCommission(
  input: DistributeUPCommissionInput
): Promise<DistributeUPCommissionResult> {
  const {
    buyerId,
    planId,
    saleAmount,
    currency = "USD",
    paymentId,
    metadata,
  } = input;

  // Set inside the transaction when sweepUnspent === "return"; the caller
  // becomes responsible for this money instead of the platform.
  let unspentForCaller = 0;

  // Is this a FOUNDER comb plan — a founder handing a slice of their own
  // margin to our tree (services/commission.ts, planKind "unilevel_plus")?
  //
  // Only here do the two founder-plan rules apply: the direct share is
  // unlocked for an unlicensed member, and every other position they hold
  // cascades to a licensed upline rather than being seized by the platform.
  // Licence sales, NetworkChain, Office Pro and every other caller of this
  // function keep their existing behaviour untouched.
  const isFounderCombPlan =
    (input.metadata as any)?.source === "comb_plan_unilevel_plus";

  // Load plan
  const plan = await UnilevelPlusPlan.findById(planId);
  if (!plan || !plan.isActive) {
    throw new Error("Unilevel Plus plan not found or not active");
  }

  // Idempotency check
  const existingDistribution = await UnilevelPlusDistribution.findOne({
    paymentId,
  }).lean();

  if (existingDistribution) {
    console.log(
      `[UnilevelPlus] Commission already distributed for paymentId: ${paymentId}`
    );
    return {
      distribution: existingDistribution as IUnilevelPlusDistribution,
      companyAmount: existingDistribution.companyAmount,
      // Re-derived from the stored row, not 0 — a replayed sale must report
      // the same unspent figure or the caller would credit the seller twice.
      unspentAmount: money(
        (existingDistribution.companyAmount || 0) +
          ((existingDistribution.infinityTier1Amount || 0) -
            (existingDistribution.infinityTier1Distributed || 0)) +
          ((existingDistribution.infinityTier2Amount || 0) -
            (existingDistribution.infinityTier2Distributed || 0)) +
          (existingDistribution.managerBonusAmount || 0) +
          (existingDistribution.unallocatedAmount || 0)
      ),
      // Report what was CREDITED, matching what a fresh run returns, so a
      // replayed call and a first call agree. Rows written before the
      // NetworkChain split existed carry no `creditedAmount` and fall back to
      // the plan figure, which is what they were actually paid.
      directBonusPaid: existingDistribution.directBonusRecipientId
        ? {
            userId: existingDistribution.directBonusRecipientId.toString(),
            amount:
              existingDistribution.directBonusCreditedAmount ??
              existingDistribution.directBonusAmount,
          }
        : null,
      levelBonusesPaid:
        existingDistribution.levelBonusRecipients?.map((r) => ({
          userId: r.userId.toString(),
          amount: r.creditedAmount ?? r.amount,
          level: r.level,
          legNumber: r.legNumber,
        })) || [],
    };
  }

  // Commission base = the pre-tax sale amount.
  //
  // Unilevel Plus is a platform fee and is ALWAYS priced exclusive of GST:
  // checkout charges productPrice + 18% on top (for Indian buyers only). The
  // listed price therefore never contains tax, so there is nothing to extract
  // and `saleAmount` IS the base.
  //
  // This previously divided by 1.18 whenever the plan was INR and
  // `plan.gstInclusive` was set — and UNILEVEL_PLUS_PLAN_CONFIG does set
  // gstInclusive: true, contradicting how checkout actually bills. It stayed
  // inert only because the plan is USD, so the currency gate never fired.
  // Flipping the plan to INR would have silently cut every bonus by 18%.
  // Callers must pass the pre-tax amount (invoice.subtotal, not totalAmount).
  const commissionBase = saleAmount;

  // Calculate pool amounts
  const companyAmount = money((commissionBase * plan.companyPercentage) / 100);
  const directBonusAmount = money((commissionBase * plan.directBonusPercentage) / 100);
  const levelBonusBudget = money((commissionBase * plan.levelBonusPercentage) / 100);

  // ── Scale every FIXED payout to this sale's base ──────────────────────
  //
  // The pools above are percentages, so they shrink with the sale. The two
  // fixed schedules — `pointValue` per level point, and the per-recipient
  // infinity bonuses — are calibrated to the $25 licence, where they exactly
  // consume their pools:
  //
  //   levels: $0.02 × 3 × (1+2+…+15) = $7.20 = 28.8% of $25
  //   T1:     3 × $0.40 = $1.20 = 4.8%   ·   T2: 3 × $2.00 = $6.00 = 24%
  //
  // Run the same schedule against a smaller base — a founder comb plan
  // passing its own commission, NetworkChain's $12 portion, a discounted
  // licence — and the schedule costs the same while the pool shrinks. The
  // tiers were fixed for this; the LEVEL bonus was not, and failed quietly:
  // the budget cap simply stopped paying partway down, so a $3.50 founder
  // sale died at level 6 with nine levels earning nothing. Nobody was
  // overpaid, so nothing ever alarmed.
  //
  // Capped at 1 — this scales DOWN only, so a $25 licence is × 1 and every
  // existing payout is untouched. Bases ABOVE $25 (Office Pro's $48) keep
  // their deliberate surplus; see the tier note below.
  const planScale =
    plan.productPrice > 0
      ? Math.min(commissionBase / plan.productPrice, 1)
      : 0;
  // Sub-cent on small bases, so the level amount is rounded once, after
  // multiplying by the points — rounding the rate first would zero it.
  const scaledPointValue = plan.pointValue * planScale;
  const infinityTier1Amount = money((commissionBase * plan.infinityTier1Percentage) / 100);
  const infinityTier2Amount = money((commissionBase * plan.infinityTier2Percentage) / 100);
  const managerBonusAmount = money((commissionBase * plan.managerBonusPercentage) / 100);

  // Get buyer and their direct referrer
  const buyer = await User.findById(buyerId).select("referredBy").lean();
  if (!buyer) {
    throw new Error("Buyer not found");
  }

  const directReferrerId = buyer.referredBy?.toString() || null;

  // Walk UP the referral chain for level bonus
  // Chain-walk variables hoisted so infinity walk can continue from where level walk left off
  const visited = new Set<string>();
  let previousPersonId = buyerId;
  let currentPersonId = buyer.referredBy?.toString() || "";

  const levelBonusRecipients: IUPLevelBonusRecipient[] = [];
  let totalLevelBonusDistributed = 0;

  if (buyer.referredBy) {
    for (let level = 1; level <= plan.maxLevels; level++) {
      if (!currentPersonId || visited.has(currentPersonId)) {
        break;
      }
      visited.add(currentPersonId);

      // Determine leg number
      const legNumber = await getLegNumber(currentPersonId, previousPersonId);
      const multiplier = getLegMultiplier(legNumber, plan.legMultipliers);

      // Calculate bonus
      const points = multiplier * level;
      // Scaled to the sale's base — see planScale above. At the $25 licence
      // this is identical to the unscaled figure.
      let amount = money(points * scaledPointValue);

      // Cap at remaining budget
      if (totalLevelBonusDistributed + amount > levelBonusBudget) {
        amount = money(levelBonusBudget - totalLevelBonusDistributed);
        if (amount <= 0) break;
      }

      levelBonusRecipients.push({
        userId: new Types.ObjectId(currentPersonId) as any,
        level,
        legNumber,
        legMultiplier: multiplier,
        points,
        amount,
        directChildId: new Types.ObjectId(previousPersonId) as any,
      });

      totalLevelBonusDistributed += amount;

      // Move up the chain
      const currentUser = await User.findById(currentPersonId)
        .select("referredBy")
        .lean();
      previousPersonId = currentPersonId;
      currentPersonId = currentUser?.referredBy?.toString() || "";

      if (!currentPersonId) break;
    }
  }

  const unallocatedAmount = money(levelBonusBudget - totalLevelBonusDistributed);

  // === INFINITY TIER WALK ===
  // Infinity bonuses are ADDITIONAL to level bonuses.
  // First check all users already in the level bonus chain (levels 1-15),
  // then continue walking past level 15 for more candidates.
  const infinityTier1Recipients: IUPInfinityBonusRecipient[] = [];
  const infinityTier2Recipients: IUPInfinityBonusRecipient[] = [];
  let totalInfT1Distributed = 0;
  let totalInfT2Distributed = 0;

  // Per-recipient bonus, scaled to this sale's base.
  // The two INFINITY_T*_BONUS_PER_RECIPIENT constants are calibrated to the
  // $25 UP license, where 3 recipients exactly consume each tier's pool:
  // T1 3 × $0.40 = $1.20 (4.8%), T2 3 × $2.00 = $6.00 (24%).
  // Third-party subscriptions run this same plan on a smaller base (e.g.
  // NetworkChain's $12 upPortion) — that scales the POOL down but left these
  // constants at their $25 value, so 3 × $0.60 against an $0.86 pool drove
  // `infinityTierNUnspent` negative and silently debited the platform wallet
  // for the overspend. Scaling by commissionBase/productPrice keeps the tier
  // proportional at any base; at the $25 license planScale === 1, so existing
  // UP payouts are unchanged.
  //
  // Capped at 1 — this scales DOWN only. Bases above productPrice are a
  // deliberate design choice, not a defect: Office Pro carves out $48 (2× the
  // license) and its pools are correspondingly large, so $0.60 flat fits
  // comfortably and the surplus sweeps to the platform on purpose (see the
  // Pro-plan comment in services/officeSubscription.ts). Scaling up there
  // would reallocate that surplus to affiliates — a pricing change, not a
  // bug fix. Only the under-$25 bases (third-party upPortion, coupon-
  // discounted UP buys) over-allocate, and only those get rescaled.
  const infinityT1BonusPerRecipient = money(
    INFINITY_T1_BONUS_PER_RECIPIENT * planScale
  );
  const infinityT2BonusPerRecipient = money(
    INFINITY_T2_BONUS_PER_RECIPIENT * planScale
  );

  // A tier stops paying when it hits the recipient cap OR exhausts its pool.
  // The pool check is the backstop that makes over-allocation structurally
  // impossible regardless of how the per-recipient amount is derived — cent
  // rounding on the scaled bonus can still overshoot a pool by a cent or two,
  // and a plan configured with 0% for a tier must pay nothing at all.
  // Both walks below gate on these too, so we stop querying uplines for a
  // tier that can no longer pay.
  // Half of the smallest unit the engine carries — see `money` above. At the
  // old half-a-cent (0.005) a pool would read as exhausted while up to 49
  // sub-cent units of it were still unpaid.
  const POOL_EPSILON = 0.5 / MONEY_SCALE;
  const isT1Full = () =>
    infinityTier1Recipients.length >= INFINITY_MAX_RECIPIENTS_PER_TIER ||
    totalInfT1Distributed >= infinityTier1Amount - POOL_EPSILON;
  const isT2Full = () =>
    !INFINITY_T2_ENABLED ||
    infinityTier2Recipients.length >= INFINITY_MAX_RECIPIENTS_PER_TIER ||
    totalInfT2Distributed >= infinityTier2Amount - POOL_EPSILON;

  // Helper to check and add infinity eligibility for a user.
  // `activeUpDirects` = how many of the upline's directs hold an active
  // licence. 4+ qualifies for T1 and 10+ for T2 on THIS sale regardless of
  // which leg it came through. Nearest-the-buyer first, 3 per tier, pool-
  // capped — those limits are what keep the payout inside the pool now that
  // more uplines qualify per sale.
  const checkInfinityEligibility = (userId: string, activeUpDirects: number) => {
    if (isT1Full() && isT2Full()) return;

    if (!isT2Full() && activeUpDirects >= INFINITY_T2_MIN_LEGS) {
      // T2 eligible — upline has 10+ UP-active directs.
      const amount = money(
        Math.min(
          infinityT2BonusPerRecipient,
          infinityTier2Amount - totalInfT2Distributed
        )
      );
      if (amount > 0) {
        infinityTier2Recipients.push({
          userId: new Types.ObjectId(userId) as any,
          tier: 2,
          amount,
          directReferralCount: activeUpDirects,
        });
        totalInfT2Distributed = money(totalInfT2Distributed + amount);
      }
    }
    if (!isT1Full() && activeUpDirects >= INFINITY_T1_MIN_LEGS) {
      // T1 eligible — upline has 4+ UP-active directs.
      const amount = money(
        Math.min(
          infinityT1BonusPerRecipient,
          infinityTier1Amount - totalInfT1Distributed
        )
      );
      if (amount > 0) {
        infinityTier1Recipients.push({
          userId: new Types.ObjectId(userId) as any,
          tier: 1,
          amount,
          directReferralCount: activeUpDirects,
        });
        totalInfT1Distributed = money(totalInfT1Distributed + amount);
      }
    }
  };

  // Phase 1: Check level bonus recipients (levels 1-15) for infinity eligibility.
  // recipient.legNumber is the ALL-DIRECTS position used by the level bonus
  // multiplier and plays no part here; the infinity gate is a headcount of
  // UP-active directs.
  for (const recipient of levelBonusRecipients) {
    if (isT1Full() && isT2Full()) break;

    const activeUpDirects = await getActiveUpDirectCount(
      recipient.userId.toString(),
      recipient.directChildId.toString()
    );
    checkInfinityEligibility(recipient.userId.toString(), activeUpDirects);
  }

  // Phase 2: Continue walking past level 15 for more infinity candidates
  while (currentPersonId && !visited.has(currentPersonId)) {
    if (isT1Full() && isT2Full()) break;

    visited.add(currentPersonId);

    const activeUpDirects = await getActiveUpDirectCount(currentPersonId, previousPersonId);
    checkInfinityEligibility(currentPersonId, activeUpDirects);

    // Move up the chain
    const currentUser = await User.findById(currentPersonId)
      .select("referredBy")
      .lean();
    previousPersonId = currentPersonId;
    currentPersonId = currentUser?.referredBy?.toString() || "";
  }

  // Get platform user
  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  if (!platformUser) {
    throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
  }
  const platformUserId = platformUser._id.toString();

  // Start MongoDB transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Create distribution record (pending)
    const distribution = await UnilevelPlusDistribution.create(
      [
        {
          planId: plan._id,
          buyerId: new Types.ObjectId(buyerId),
          saleAmount,
          currency,
          paymentId,
          companyAmount,
          directBonusAmount,
          directBonusRecipientId: directReferrerId
            ? new Types.ObjectId(directReferrerId)
            : undefined,
          levelBonusBudget,
          levelBonusDistributed: totalLevelBonusDistributed,
          levelBonusRecipients,
          infinityTier1Amount,
          infinityTier1Recipients,
          infinityTier1Distributed: totalInfT1Distributed,
          infinityTier2Amount,
          infinityTier2Recipients,
          infinityTier2Distributed: totalInfT2Distributed,
          managerBonusAmount,
          unallocatedAmount,
          status: "pending",
          metadata,
        },
      ],
      { session }
    ).then((docs) => docs[0]);

    // === STEP 1: Credit company amount to platform wallet ===
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

    // Credit company amount + unspent infinity pools + reserved pools + unallocated to platform (in USD)
    const infinityTier1Unspent = money(
      infinityTier1Amount - totalInfT1Distributed
    );
    const infinityTier2Unspent = money(
      infinityTier2Amount - totalInfT2Distributed
    );

    const totalPlatformCredit =
      companyAmount +
      infinityTier1Unspent +
      infinityTier2Unspent +
      managerBonusAmount +
      unallocatedAmount;

    // Caller owns the unspent remainder — skip the platform credit entirely.
    // Used by founder-funded community plans, where the percentage the
    // founder set is a ceiling on what the NETWORK can earn; anything the
    // tree fails to pay has to stay with them, not become platform revenue.
    // The distribution row still records every pool, so the accounting is
    // identical — only the wallet write is suppressed.
    if (input.sweepUnspent === "return") {
      unspentForCaller = totalPlatformCredit;
    } else {

    const platformBalanceBefore = platformWallet.balance;
    const platformBalanceAfter = platformBalanceBefore + totalPlatformCredit;
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
          amount: totalPlatformCredit,
          currency: "USD",
          balanceBefore: platformBalanceBefore,
          balanceAfter: platformBalanceAfter,
          description: `Unilevel Plus activation revenue`,
          note: `Platform share from Unilevel Plus plan purchase`,
          relatedUserId: new Types.ObjectId(buyerId),
          metadata: {
            distributionId: distribution._id,
            distributionType: "unilevel_plus",
            companyAmount,
            infinityTier1Amount,
            infinityTier1Distributed: totalInfT1Distributed,
            infinityTier1Unspent,
            infinityTier2Amount,
            infinityTier2Distributed: totalInfT2Distributed,
            infinityTier2Unspent,
            managerBonusAmount,
            unallocatedAmount,
          },
          status: "completed",
        },
      ],
      { session }
    );

    } // end sweepUnspent !== "return"

    // === STEP 2: Credit direct referrer (routes to platform if not UP-activated) ===
    let directBonusPaid: { userId: string; amount: number } | null = null;

    if (directReferrerId && directBonusAmount > 0) {
      const directResult = await creditAffiliateOrPlatform({
        recipientUserId: directReferrerId,
        amount: directBonusAmount,
        currency: "USD",
        description: isFounderCombPlan
          ? `Direct commission — founder plan`
          : `Direct referral bonus`,
        note: isFounderCombPlan
          ? `Earned from a direct referral's purchase. Paid whether or not you hold a licence.`
          : `Earned from a direct referral's Unilevel Plus activation`,
        relatedUserId: buyerId,
        metadata: {
          distributionId: distribution._id,
          distributionType: "unilevel_plus",
          bonusType: "direct",
        },
        // The founder-plan direct share is the member's to keep with no $25,
        // and — separately — does not depend on a $36 NetworkChain
        // subscription for anyone, so it is never halved.
        unlockWithoutLicence: isFounderCombPlan,
        session,
      });

      // Record what actually LANDED, not what the plan allocated. The two
      // differ when the NetworkChain coverage split fires, and
      // getUPCommissionStats aggregates this record rather than the wallet —
      // without this the earner is shown double what they received.
      const directSplit = splitFromCreditResult(directResult);
      distribution.directBonusCreditedAmount =
        directSplit?.recipientAmount ?? directBonusAmount;
      if (directSplit) {
        distribution.directBonusForfeitedAmount = directSplit.forfeitedAmount;
        distribution.directBonusForfeitedToUserId = directSplit.forfeitedToUserId
          ? new Types.ObjectId(directSplit.forfeitedToUserId)
          : undefined;
      }

      directBonusPaid = {
        userId: directReferrerId,
        amount: directSplit?.recipientAmount ?? directBonusAmount,
      };
    }

    // === STEP 3: Credit level bonus recipients (routes to platform if not UP-activated) ===
    const levelBonusesPaid: {
      userId: string;
      amount: number;
      level: number;
      legNumber: number;
    }[] = [];

    for (let i = 0; i < levelBonusRecipients.length; i++) {
      const recipient = levelBonusRecipients[i];
      const recipientUserId = recipient.userId.toString();

      const affiliateResult = await creditAffiliateOrPlatform({
        recipientUserId,
        amount: recipient.amount,
        currency: "USD",
        description: `Level ${recipient.level} network bonus`,
        note: `Earned from Level ${recipient.level} in your referral network`,
        relatedUserId: buyerId,
        metadata: {
          distributionId: distribution._id,
          distributionType: "unilevel_plus",
          bonusType: "level",
          level: recipient.level,
          legNumber: recipient.legNumber,
          legMultiplier: recipient.legMultiplier,
          points: recipient.points,
        },
        // Not the direct share, so an unlicensed holder cannot keep it —
        // but on a founder plan it belongs to their nearest licensed
        // upline, never to the platform.
        cascadeToLicensedUpline: isFounderCombPlan,
        session,
      });
      unspentForCaller += affiliateResult.founderReturnAmount || 0;

      // Update recipient with wallet/transaction IDs
      levelBonusRecipients[i].walletId = affiliateResult.affiliateWallet._id as any;
      levelBonusRecipients[i].transactionId = affiliateResult.transaction._id as any;
      applySplit(levelBonusRecipients[i], splitFromCreditResult(affiliateResult));

      levelBonusesPaid.push({
        userId: recipientUserId,
        amount: levelBonusRecipients[i].creditedAmount ?? recipient.amount,
        level: recipient.level,
        legNumber: recipient.legNumber,
      });
    }

    // === STEP 4: Credit Infinity Tier 1 recipients ===
    for (let i = 0; i < infinityTier1Recipients.length; i++) {
      const recipient = infinityTier1Recipients[i];
      const recipientUserId = recipient.userId.toString();

      const affiliateResult = await creditAffiliateOrPlatform({
        recipientUserId,
        amount: recipient.amount,
        currency: "USD",
        description: `Infinity Tier 1 bonus`,
        note: `Earned from Infinity Tier 1 (${recipient.directReferralCount} legs)`,
        relatedUserId: buyerId,
        metadata: {
          distributionId: distribution._id,
          distributionType: "unilevel_plus",
          bonusType: "infinity_tier_1",
          directReferralCount: recipient.directReferralCount,
        },
        // Not the direct share, so an unlicensed holder cannot keep it —
        // but on a founder plan it belongs to their nearest licensed
        // upline, never to the platform.
        cascadeToLicensedUpline: isFounderCombPlan,
        session,
      });
      unspentForCaller += affiliateResult.founderReturnAmount || 0;

      infinityTier1Recipients[i].walletId =
        affiliateResult.affiliateWallet._id as any;
      infinityTier1Recipients[i].transactionId =
        affiliateResult.transaction._id as any;
      applySplit(
        infinityTier1Recipients[i],
        splitFromCreditResult(affiliateResult)
      );
    }

    // === STEP 5: Credit Infinity Tier 2 recipients ===
    for (let i = 0; i < infinityTier2Recipients.length; i++) {
      const recipient = infinityTier2Recipients[i];
      const recipientUserId = recipient.userId.toString();

      const affiliateResult = await creditAffiliateOrPlatform({
        recipientUserId,
        amount: recipient.amount,
        currency: "USD",
        description: `Infinity Tier 2 bonus`,
        note: `Earned from Infinity Tier 2 (${recipient.directReferralCount} legs)`,
        relatedUserId: buyerId,
        metadata: {
          distributionId: distribution._id,
          distributionType: "unilevel_plus",
          bonusType: "infinity_tier_2",
          directReferralCount: recipient.directReferralCount,
        },
        // Not the direct share, so an unlicensed holder cannot keep it —
        // but on a founder plan it belongs to their nearest licensed
        // upline, never to the platform.
        cascadeToLicensedUpline: isFounderCombPlan,
        session,
      });
      unspentForCaller += affiliateResult.founderReturnAmount || 0;

      infinityTier2Recipients[i].walletId =
        affiliateResult.affiliateWallet._id as any;
      infinityTier2Recipients[i].transactionId =
        affiliateResult.transaction._id as any;
      applySplit(
        infinityTier2Recipients[i],
        splitFromCreditResult(affiliateResult)
      );
    }

    // Update distribution with wallet/transaction refs and mark completed
    distribution.levelBonusRecipients = levelBonusRecipients;
    distribution.infinityTier1Recipients = infinityTier1Recipients;
    distribution.infinityTier1Distributed = totalInfT1Distributed;
    distribution.infinityTier2Recipients = infinityTier2Recipients;
    distribution.infinityTier2Distributed = totalInfT2Distributed;
    distribution.status = "completed";
    await distribution.save({ session });

    await session.commitTransaction();

    console.log(`[UnilevelPlus] Distributed for payment ${paymentId} (USD):
      Sale: $${saleAmount}
      Company: $${companyAmount}
      Direct Bonus: $${directBonusAmount} → ${directReferrerId || "none"}
      Level Bonus: $${totalLevelBonusDistributed}/$${levelBonusBudget} (${levelBonusRecipients.length} recipients)
      Infinity T1: $${totalInfT1Distributed}/$${infinityTier1Amount} (${infinityTier1Recipients.length} recipients)
      Infinity T2: $${totalInfT2Distributed}/$${infinityTier2Amount} (${infinityTier2Recipients.length} recipients)
      Reserved: Mgr=$${managerBonusAmount}
      Unallocated: $${unallocatedAmount}
      Platform total: $${totalPlatformCredit}`);

    return {
      distribution,
      companyAmount,
      unspentAmount: unspentForCaller,
      directBonusPaid,
      levelBonusesPaid,
    };
  } catch (error) {
    await session.abortTransaction();

    // Create failed distribution record
    await UnilevelPlusDistribution.create({
      planId: plan._id,
      buyerId: new Types.ObjectId(buyerId),
      saleAmount,
      currency,
      paymentId,
      companyAmount,
      directBonusAmount,
      levelBonusBudget,
      levelBonusDistributed: 0,
      levelBonusRecipients: [],
      infinityTier1Amount,
      infinityTier2Amount,
      managerBonusAmount,
      unallocatedAmount: levelBonusBudget,
      status: "failed",
      failureReason: (error as Error).message,
      metadata,
    });

    throw error;
  } finally {
    session.endSession();
  }
}

// ============= Commission History =============

export async function getUPCommissionHistory(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<{
  distributions: IUnilevelPlusDistribution[];
  total: number;
}> {
  const { limit = 50, offset = 0 } = options;

  // Find distributions where user is any type of bonus recipient
  const query = {
    status: "completed",
    $or: [
      { directBonusRecipientId: new Types.ObjectId(userId) },
      { "levelBonusRecipients.userId": new Types.ObjectId(userId) },
      { "infinityTier1Recipients.userId": new Types.ObjectId(userId) },
      { "infinityTier2Recipients.userId": new Types.ObjectId(userId) },
    ],
  };

  const [distributions, total] = await Promise.all([
    UnilevelPlusDistribution.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate("buyerId", "name email profilePicture")
      .lean(),
    UnilevelPlusDistribution.countDocuments(query),
  ]);

  return { distributions, total };
}

export async function getUPCommissionStats(userId: string): Promise<{
  totalDirectBonusEarned: number;
  totalLevelBonusEarned: number;
  totalInfinityT1Earned: number;
  totalInfinityT2Earned: number;
  totalEarned: number;
  directBonusCount: number;
  levelBonusCount: number;
  infinityT1Count: number;
  infinityT2Count: number;
  earningsByLevel: Record<number, number>;
  earningsByLeg: Record<number, number>;
  /**
   * Total forwarded away by the NetworkChain coverage split — money the plan
   * allocated to this member that they did not receive because they had no
   * live subscription. `totalEarned + totalForfeited` is what they would have
   * been paid with coverage, which is the number worth showing them.
   */
  totalForfeited: number;
}> {
  const userObjId = new Types.ObjectId(userId);

  // Direct bonus earnings
  const directBonusStats = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        directBonusRecipientId: userObjId,
        status: "completed",
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: { $ifNull: ["$directBonusCreditedAmount", "$directBonusAmount"] } },
        count: { $sum: 1 },
      },
    },
  ]);

  // Level bonus earnings
  const levelBonusStats = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        "levelBonusRecipients.userId": userObjId,
        status: "completed",
      },
    },
    { $unwind: "$levelBonusRecipients" },
    { $match: { "levelBonusRecipients.userId": userObjId } },
    {
      $group: {
        _id: null,
        totalAmount: {
          $sum: {
            $ifNull: [
              "$levelBonusRecipients.creditedAmount",
              "$levelBonusRecipients.amount",
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Earnings by level
  const byLevel = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        "levelBonusRecipients.userId": userObjId,
        status: "completed",
      },
    },
    { $unwind: "$levelBonusRecipients" },
    { $match: { "levelBonusRecipients.userId": userObjId } },
    {
      $group: {
        _id: "$levelBonusRecipients.level",
        total: {
          $sum: {
            $ifNull: [
              "$levelBonusRecipients.creditedAmount",
              "$levelBonusRecipients.amount",
            ],
          },
        },
      },
    },
  ]);

  // Earnings by leg
  const byLeg = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        "levelBonusRecipients.userId": userObjId,
        status: "completed",
      },
    },
    { $unwind: "$levelBonusRecipients" },
    { $match: { "levelBonusRecipients.userId": userObjId } },
    {
      $group: {
        _id: "$levelBonusRecipients.legNumber",
        total: {
          $sum: {
            $ifNull: [
              "$levelBonusRecipients.creditedAmount",
              "$levelBonusRecipients.amount",
            ],
          },
        },
      },
    },
  ]);

  // Infinity Tier 1 earnings
  const infT1Stats = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        "infinityTier1Recipients.userId": userObjId,
        status: "completed",
      },
    },
    { $unwind: "$infinityTier1Recipients" },
    { $match: { "infinityTier1Recipients.userId": userObjId } },
    {
      $group: {
        _id: null,
        totalAmount: {
          $sum: {
            $ifNull: [
              "$infinityTier1Recipients.creditedAmount",
              "$infinityTier1Recipients.amount",
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Infinity Tier 2 earnings
  const infT2Stats = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        "infinityTier2Recipients.userId": userObjId,
        status: "completed",
      },
    },
    { $unwind: "$infinityTier2Recipients" },
    { $match: { "infinityTier2Recipients.userId": userObjId } },
    {
      $group: {
        _id: null,
        totalAmount: {
          $sum: {
            $ifNull: [
              "$infinityTier2Recipients.creditedAmount",
              "$infinityTier2Recipients.amount",
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  // Forfeited halves, across all four bonus types. Absent on pre-split rows,
  // so $ifNull to 0 rather than letting $sum skip and miscount.
  const forfeitedAgg = await UnilevelPlusDistribution.aggregate([
    {
      $match: {
        status: "completed",
        $or: [
          { directBonusRecipientId: userObjId },
          { "levelBonusRecipients.userId": userObjId },
          { "infinityTier1Recipients.userId": userObjId },
          { "infinityTier2Recipients.userId": userObjId },
        ],
      },
    },
    {
      $project: {
        f: {
          $add: [
            {
              $cond: [
                { $eq: ["$directBonusRecipientId", userObjId] },
                { $ifNull: ["$directBonusForfeitedAmount", 0] },
                0,
              ],
            },
            ...["levelBonusRecipients", "infinityTier1Recipients", "infinityTier2Recipients"].map(
              (field) => ({
                $sum: {
                  $map: {
                    input: {
                      $filter: {
                        input: { $ifNull: [`$${field}`, []] },
                        as: "r",
                        cond: { $eq: ["$$r.userId", userObjId] },
                      },
                    },
                    as: "r",
                    in: { $ifNull: ["$$r.forfeitedAmount", 0] },
                  },
                },
              })
            ),
          ],
        },
      },
    },
    { $group: { _id: null, total: { $sum: "$f" } } },
  ]);
  const totalForfeited = money(forfeitedAgg[0]?.total || 0);

  const totalDirectBonus = directBonusStats[0]?.totalAmount || 0;
  const totalLevelBonus = levelBonusStats[0]?.totalAmount || 0;
  const totalInfT1 = infT1Stats[0]?.totalAmount || 0;
  const totalInfT2 = infT2Stats[0]?.totalAmount || 0;

  const earningsByLevel: Record<number, number> = {};
  for (const item of byLevel) {
    earningsByLevel[item._id] = item.total;
  }

  const earningsByLeg: Record<number, number> = {};
  for (const item of byLeg) {
    earningsByLeg[item._id] = item.total;
  }

  return {
    totalDirectBonusEarned: totalDirectBonus,
    totalLevelBonusEarned: totalLevelBonus,
    totalInfinityT1Earned: totalInfT1,
    totalInfinityT2Earned: totalInfT2,
    totalEarned: totalDirectBonus + totalLevelBonus + totalInfT1 + totalInfT2,
    directBonusCount: directBonusStats[0]?.count || 0,
    levelBonusCount: levelBonusStats[0]?.count || 0,
    infinityT1Count: infT1Stats[0]?.count || 0,
    infinityT2Count: infT2Stats[0]?.count || 0,
    earningsByLevel,
    earningsByLeg,
    totalForfeited,
  };
}
