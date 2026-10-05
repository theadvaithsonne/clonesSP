import mongoose, { Types, ClientSession } from "mongoose";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { FranchiseGlobalAssignment } from "../models/franchiseGlobalAssignment.model";
import { AddressInput } from "../utils/territoryResolver";
import { resolveGeoChainFromAddress } from "../utils/franchiseGeoResolver";
import { buildFranchiseChainPlan } from "./franchiseChainPlan";

/**
 * Territory commission distribution (System A — global franchise).
 *
 * For every paid sale that triggers a platform fee, this carves fixed
 * percentages of the fee out of Shorupan's StoreWallet and routes them to the
 * owners whose geo chain covers **the BUYER's address** at country /
 * territory / sub-territory level. Buyer chain is resolved from
 * `input.buyerAddress` (snapshot built by `resolveBuyerAddress`:
 * `invoice.shippingAddress → billingAddress → buyer's User profile`).
 *
 * Splits come out of the dynamic platform fee (whatever rate the seller org
 * is configured to pay). The seller's payout and affiliate commissions are
 * untouched.
 *
 * **Cascade-up rule** (matches System B / founder programs):
 *   Each level's slice is paid to its own owner. When a level has no owner
 *   (unassigned in the catalog, or cancelled / paused_lapsed in
 *   FranchiseGlobalAssignment), its slice cascades UPWARDS to the nearest
 *   assigned owner. Any slice that never finds an owner in the chain stays
 *   with Shorupan.
 *
 *   Concretely:
 *     - sub-territory slice (15%): sub owner → territory owner → country
 *       owner → Shorupan.
 *     - territory slice (5%): territory owner → country owner → Shorupan.
 *     - country slice (5%): country owner → Shorupan.
 *
 * **Missing buyer address**: buyer chain is empty → nothing owned at any
 * level → all slices default to Shorupan. Matches System B behavior.
 *
 * Runs in its OWN Mongo transaction, separate from the main commission
 * distribution — a territory failure can never roll back the seller /
 * affiliate distribution.
 */

const TERRITORY_SPLIT_PERCENTAGES = {
  country: 5,
  territory: 5,
  subTerritory: 15,
} as const;

type Level = keyof typeof TERRITORY_SPLIT_PERCENTAGES;

type OwnershipSource = "garage" | "catalog";

interface EntityRef {
  level: Level;
  id: string;
  name: string;
  ownerEmail: string;
  ownershipSource: OwnershipSource;
}

export interface DistributeTerritoryInput {
  orgId: Types.ObjectId | string;
  platformUserId: string;
  platformOrgId: string;
  platformFeeAmount: number;
  platformFeePct: number;
  saleAmount: number;
  currency: string;
  /**
   * Buyer's address at payment time. Drives ALL 3 slices (sub, territory,
   * country) via `resolveGeoChainFromAddress`. When null or empty, no chain
   * is resolved and all 3 slices default to Shorupan (no fallback to
   * seller-org address — this is a deliberate symmetric rule matching
   * System B).
   */
  buyerAddress?: AddressInput | null;
  commissionDistributionId?: Types.ObjectId | string | null;
  paymentId?: string | null;
  itemType?: string;
  itemId?: Types.ObjectId | string | null;
  itemName?: string;
}

export interface DistributeTerritoryResult {
  attempted: number;
  applied: number;
  totalPaidOut: number;
  payouts: Array<{
    originalLevel: Level;
    paidAsLevel: Level;
    entityId: string;
    ownerEmail: string;
    amount: number;
  }>;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pickOwner(
  entity:
    | {
        _id?: any;
        id?: string;
        name?: string;
        ownerEmail?: string | null;
        _ownershipSource?: OwnershipSource;
      }
    | null
): {
  id: string;
  name: string;
  ownerEmail: string;
  ownershipSource: OwnershipSource;
} | null {
  if (!entity) return null;
  const email = (entity.ownerEmail || "").trim().toLowerCase();
  if (!email) return null;
  const id = entity._id != null ? String(entity._id) : entity.id || "";
  const name = entity.name || "";
  if (!id) return null;
  return {
    id,
    name,
    ownerEmail: email,
    ownershipSource: entity._ownershipSource || "catalog",
  };
}

/**
 * Resolve ownership for a catalog entity, preferring Garage's own
 * `FranchiseGlobalAssignment` table over the read-only catalog's ownerEmail.
 *
 * Returns a shallow clone of the entity with `ownerEmail` and a private
 * `_ownershipSource` marker adjusted:
 *   - Active Garage assignment       → email from assignment, source "garage"
 *   - `pending_payment` assignment   → fall back to CATALOG owner. Buyer has
 *                                      clicked "buy" but hasn't paid the invoice
 *                                      yet; blocking during this window silently
 *                                      dropped commissions for every sale in the
 *                                      geo until the buyer paid (2026-08-03 fix
 *                                      after 3 India CDs lost their higher tiers
 *                                      while assignments were pending_payment
 *                                      for 6-11+ days).
 *   - Cancelled / lapsed             → email cleared, source "garage" (blocks
 *                                      payout; no fallback to catalog).
 *   - No Garage assignment           → catalog email, source "catalog"
 *
 * Returns null if the input entity is null.
 */
async function resolveOwnershipForCatalogEntity(
  level: Level,
  entity: any | null
): Promise<any | null> {
  if (!entity) return null;
  const entityId = entity._id != null ? String(entity._id) : entity.id || "";
  if (!entityId) {
    return { ...entity, _ownershipSource: "catalog" as OwnershipSource };
  }
  const assign = await FranchiseGlobalAssignment.findOne({
    geoLevel: level,
    geoEntityId: entityId,
  })
    .select("status ownerEmail")
    .lean<any>();
  if (!assign) {
    return { ...entity, _ownershipSource: "catalog" as OwnershipSource };
  }
  if (assign.status === "active" && assign.ownerEmail) {
    return {
      ...entity,
      ownerEmail: assign.ownerEmail,
      _ownershipSource: "garage" as OwnershipSource,
    };
  }
  if (assign.status === "pending_payment") {
    // Mid-purchase — don't block the geo's commissions during the buying
    // window. Fall back to whatever the catalog currently shows for this
    // entity (usually the same person; sometimes the previous owner).
    return { ...entity, _ownershipSource: "catalog" as OwnershipSource };
  }
  // Cancelled / paused_lapsed — terminal states. Block payout with no
  // catalog fallback: ownership left Garage's active roster deliberately.
  return {
    ...entity,
    ownerEmail: "",
    _ownershipSource: "garage" as OwnershipSource,
  };
}

/**
 * Payout plan item.
 *
 *  `sliceLevel`  = which configured percentage bucket was paid (sub /
 *                  territory / country). Identifies the "source" of the
 *                  15% / 5% / 5% split.
 *  `recipient.level` = where the money actually landed. Differs from
 *                  `sliceLevel` when the slice cascaded up because no
 *                  owner was assigned at the source level.
 */
interface PlanItem {
  sliceLevel: Level;
  splitPct: number;
  recipient: EntityRef;
}

/**
 * Build the payout plan from the BUYER's geo chain using the shared
 * `buildFranchiseChainPlan` helper (same cascade-up logic as System B).
 *
 * All 3 slices resolve from the buyer's chain. Any slice whose target
 * level (or any level above it, up to country) has no owner cascades
 * upwards; if the entire chain has no assigned owner, the slice never
 * makes it into the plan and stays with Shorupan.
 *
 * `buyerChain` is the overlaid chain (post-FranchiseGlobalAssignment
 * ownership resolution), so cancelled / paused_lapsed assignments are
 * already reflected as unowned before we compute the cascade.
 */
function buildChainAlignedPayouts(buyerChain: {
  subTerritory: any | null;
  territory: any | null;
  country: any | null;
}): PlanItem[] {
  const subOwner = pickOwner(buyerChain.subTerritory);
  const terOwner = pickOwner(buyerChain.territory);
  const couOwner = pickOwner(buyerChain.country);

  const rawPlan = buildFranchiseChainPlan(
    {
      subTerritory: !!subOwner,
      territory: !!terOwner,
      country: !!couOwner,
    },
    TERRITORY_SPLIT_PERCENTAGES,
  );

  const ownerByLevel = {
    subTerritory: subOwner,
    territory: terOwner,
    country: couOwner,
  } as const;

  const plan: PlanItem[] = [];
  for (const p of rawPlan) {
    const owner = ownerByLevel[p.recipientLevel];
    if (!owner) continue; // defensive — cascade guarantees this exists
    plan.push({
      sliceLevel: p.sliceLevel,
      splitPct: p.splitPct,
      recipient: { level: p.recipientLevel, ...owner },
    });
  }
  return plan;
}

/** Resolve recipient User. Returns null if no Garage account exists. */
async function findRecipientUser(
  email: string,
  session: ClientSession
): Promise<Types.ObjectId | null> {
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const u = await User.findOne({
    email: new RegExp("^" + escapedEmail + "$", "i"),
  })
    .select("_id")
    .session(session);
  return u ? (u._id as Types.ObjectId) : null;
}

/**
 * Apply a single payout: debit Shorupan, credit owner, write audit rows on
 * both sides. Throws on any unexpected failure — caller decides what to do.
 */
async function applyOnePayout(opts: {
  recipient: EntityRef;
  /** Which configured slice this payout represents (sub/terr/country). */
  sliceLevel: Level;
  splitPct: number;
  amount: number;
  platformWallet: any;
  ownerUserId: Types.ObjectId;
  input: DistributeTerritoryInput;
  session: ClientSession;
}): Promise<void> {
  const {
    recipient,
    sliceLevel,
    splitPct,
    amount,
    platformWallet,
    ownerUserId,
    input,
    session,
  } = opts;

  const recipientLevel = recipient.level;
  const isCascaded = sliceLevel !== recipientLevel;
  // All 3 slices now resolve from the BUYER's address (System B parity).
  // Kept as a field on the audit log so historical rows written under the
  // old asymmetric rule can be distinguished from the new symmetric ones.
  const addressSource: "buyer" | "business" = "buyer";

  // === DEBIT Shorupan's StoreWallet ===
  const debitBefore = platformWallet.balance;
  const debitAfter = debitBefore - amount;
  if (debitAfter < 0) {
    throw new Error(
      `Shorupan wallet underflow: have ${debitBefore}, slice ${amount}`
    );
  }
  platformWallet.balance = debitAfter;
  platformWallet.lastTransactionAt = new Date();
  await platformWallet.save({ session });

  await WalletTransaction.create(
    [
      {
        storeWalletId: platformWallet._id,
        walletType: "store",
        userId: new Types.ObjectId(input.platformUserId),
        orgId: new Types.ObjectId(input.platformOrgId),
        type: "debit",
        amount,
        currency: input.currency,
        balanceBefore: debitBefore,
        balanceAfter: debitAfter,
        description: isCascaded
          ? `Territory commission: ${sliceLevel} slice → ${recipientLevel} owner`
          : `Territory commission to ${recipientLevel} owner`,
        note: isCascaded
          ? `${splitPct}% of platform fee (originally ${sliceLevel} slice, cascaded up because ${sliceLevel} was unassigned) → ${recipientLevel} "${recipient.name}" (${recipient.ownerEmail}) [resolved from ${addressSource} pincode]`
          : `${splitPct}% of platform fee → ${recipientLevel} "${recipient.name}" (${recipient.ownerEmail}) [resolved from ${addressSource} pincode]`,
        relatedUserId: ownerUserId,
        metadata: {
          territory: {
            sliceLevel,
            recipientLevel,
            cascaded: isCascaded,
            addressSource,
            entityId: recipient.id,
            entityName: recipient.name,
            splitPercentage: splitPct,
            // "garage" = owner resolved from an active FranchiseGlobalAssignment
            // (System A invoice-based sale). "catalog" = legacy catalog
            // ownerEmail fallback.
            ownershipSource: recipient.ownershipSource,
          },
        },
        status: "completed",
      },
    ],
    { session }
  );

  // === CREDIT owner's TerritoryWallet ===
  let twallet = await TerritoryWallet.findOne({ userId: ownerUserId }).session(
    session
  );
  if (!twallet) {
    const created = await TerritoryWallet.create(
      [
        {
          userId: ownerUserId,
          balance: 0,
          currency: input.currency,
          totalEarnings: 0,
          totalWithdrawn: 0,
        },
      ],
      { session }
    );
    twallet = created[0];
  }

  const credBefore = twallet.balance;
  const credAfter = credBefore + amount;
  twallet.balance = credAfter;
  twallet.totalEarnings = (twallet.totalEarnings || 0) + amount;
  twallet.lastTransactionAt = new Date();
  await twallet.save({ session });

  await TerritoryWalletTransaction.create(
    [
      {
        territoryWalletId: twallet._id,
        userId: ownerUserId,
        type: "credit",
        amount,
        currency: input.currency,
        balanceBefore: credBefore,
        balanceAfter: credAfter,
        description: isCascaded
          ? `Commission as ${recipientLevel} owner of ${recipient.name} (cascaded from unassigned ${sliceLevel})`
          : `Commission as ${recipientLevel} owner of ${recipient.name}`,
        status: "completed",
        // entityType = recipient's actual catalog level (where the money
        // landed). originalSliceLevel = which configured slice this was,
        // so a report can distinguish own-level earnings from cascaded-up
        // ones.
        entityType: recipientLevel,
        entityId: recipient.id,
        entityName: recipient.name,
        originalSliceLevel: sliceLevel,
        relatedSplitPercentage: splitPct,
        relatedCommissionDistributionId: input.commissionDistributionId
          ? new Types.ObjectId(String(input.commissionDistributionId))
          : undefined,
        relatedPaymentId: input.paymentId || undefined,
        relatedItemType: input.itemType,
        relatedItemId: input.itemId
          ? new Types.ObjectId(String(input.itemId))
          : undefined,
        relatedItemName: input.itemName,
        relatedSaleAmount: input.saleAmount,
        relatedPlatformFeeAmount: input.platformFeeAmount,
        relatedPlatformFeePercentage: input.platformFeePct,
        relatedOrgId: new Types.ObjectId(String(input.orgId)),
        metadata: {
          ownershipSource: recipient.ownershipSource,
        },
      },
    ],
    { session }
  );
}

/**
 * Entry point. Opens its own Mongo transaction. Returns a summary; throws
 * only on truly unexpected errors. Predictable "skip" cases (no owner, owner
 * not a Garage user, slice rounds to zero) silently no-op.
 *
 * The caller in commission.ts wraps this in try/catch — any throw here is
 * logged and the rest of the invoice fulfilment continues normally.
 */
export async function distributeTerritoryCommissions(
  input: DistributeTerritoryInput
): Promise<DistributeTerritoryResult> {
  const result: DistributeTerritoryResult = {
    attempted: 0,
    applied: 0,
    totalPaidOut: 0,
    payouts: [],
  };

  if (!input.platformFeeAmount || input.platformFeeAmount <= 0) return result;

  // Resolve BUYER's raw catalog chain — drives ALL 3 slices under the
  // new symmetric rule. `resolveGeoChainFromAddress` returns the pure
  // catalog docs (no ownership overlay); we layer that on next.
  //
  // Empty buyer address → empty chain → all slices default to Shorupan
  // (mirrors System B / founder programs — no fallback to seller org).
  const rawChain = input.buyerAddress
    ? await resolveGeoChainFromAddress(input.buyerAddress)
    : { subTerritory: null, territory: null, country: null };

  // Overlay Garage-side ownership onto each catalog entity at all 3
  // levels: an active FranchiseGlobalAssignment WINS over the catalog's
  // ownerEmail; pending_payment falls back to catalog (mid-purchase
  // window); cancelled / paused_lapsed clears the email (blocks payout,
  // no catalog fallback). Legacy catalog owners (no Garage row) earn as
  // before.
  const [subOverlaid, terOverlaid, couOverlaid] = await Promise.all([
    resolveOwnershipForCatalogEntity("subTerritory", rawChain.subTerritory),
    resolveOwnershipForCatalogEntity("territory", rawChain.territory),
    resolveOwnershipForCatalogEntity("country", rawChain.country),
  ]);
  const buyerChain = {
    subTerritory: subOverlaid,
    territory: terOverlaid,
    country: couOverlaid,
  };

  const plan = buildChainAlignedPayouts(buyerChain);

  // ── Loud logging on any dropped slice ───────────────────────────────
  // Silent drops were the source of the 2026-08-03 India-country bug
  // (partial-fanout audit). Emit one WARN line per missing slice, with
  // the CD id, entity id, and a classified reason so ops can grep for
  // `[territory][drop]` in the logs and reconcile.
  const cdRef = input.commissionDistributionId || "?";
  const classifyMissing = (
    sliceLevel: Level,
    rawEntity: any | null,
    resolvedEntity: any | null,
  ): string => {
    if (!input.buyerAddress) return "buyer_address_missing";
    if (!rawEntity) return "geo_entity_not_resolved";
    // resolvedEntity is the output of resolveOwnershipForCatalogEntity —
    // if ownerEmail was cleared, the assignment was cancelled/lapsed.
    const catalogEmail = (rawEntity.ownerEmail || "").trim();
    const resolvedEmail = (resolvedEntity?.ownerEmail || "").trim();
    if (!resolvedEmail && catalogEmail) return "assignment_cancelled_or_lapsed";
    if (!resolvedEmail && sliceLevel !== "country")
      return "no_owner_and_no_cascade_target";
    if (!resolvedEmail) return "catalog_owner_empty";
    return "unknown";
  };
  const planLevels = new Set(plan.map((p) => p.sliceLevel));
  if (!planLevels.has("subTerritory")) {
    console.warn(
      `[territory][drop] cd=${cdRef} slice=subTerritory reason=${classifyMissing("subTerritory", rawChain.subTerritory, buyerChain.subTerritory)} entity=${rawChain.subTerritory?._id || "-"} bizOrg=${input.orgId}`,
    );
  }
  if (!planLevels.has("territory")) {
    console.warn(
      `[territory][drop] cd=${cdRef} slice=territory reason=${classifyMissing("territory", rawChain.territory, buyerChain.territory)} entity=${rawChain.territory?._id || "-"} bizOrg=${input.orgId}`,
    );
  }
  if (!planLevels.has("country")) {
    console.warn(
      `[territory][drop] cd=${cdRef} slice=country reason=${classifyMissing("country", rawChain.country, buyerChain.country)} entity=${rawChain.country?._id || "-"} bizOrg=${input.orgId}`,
    );
  }

  if (plan.length === 0) return result;

  // Filter to plan items that have a resolvable Garage User account.
  // Done outside the session — read-only and cheap.
  const usableItems: Array<{
    sliceLevel: Level;
    splitPct: number;
    recipient: EntityRef;
    ownerUserId: Types.ObjectId;
  }> = [];

  for (const item of plan) {
    // Exact percentage — no rounding. Sub-cent slices (e.g. 15% of a $0.05
    // platform fee = $0.0075) flow through at full precision.
    const amount = (input.platformFeeAmount * item.splitPct) / 100;
    if (amount <= 0) continue;

    const ownerUserId = await findRecipientUserNoSession(item.recipient.ownerEmail);
    if (!ownerUserId) {
      console.warn(
        `[territory][drop] cd=${cdRef} slice=${item.sliceLevel} reason=no_garage_user owner=${item.recipient.ownerEmail} paidAsLevel=${item.recipient.level}`,
      );
      continue;
    }
    if (String(ownerUserId) === String(input.platformUserId)) {
      // Recipient IS Shorupan — no point debiting and crediting the same
      // wallet. Log so we can grep for it if the count seems off.
      console.warn(
        `[territory][drop] cd=${cdRef} slice=${item.sliceLevel} reason=recipient_is_platform owner=${item.recipient.ownerEmail} paidAsLevel=${item.recipient.level}`,
      );
      continue;
    }
    usableItems.push({ ...item, ownerUserId });
  }

  if (usableItems.length === 0) return result;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Load platform wallet fresh inside this session.
    const platformWallet = await StoreWallet.findOne({
      userId: new Types.ObjectId(input.platformUserId),
      orgId: new Types.ObjectId(input.platformOrgId),
    }).session(session);

    if (!platformWallet) {
      throw new Error(
        `Shorupan StoreWallet not found (user=${input.platformUserId}, org=${input.platformOrgId})`
      );
    }

    for (const item of usableItems) {
      // Exact slice — no rounding. See note in pre-flight loop above.
      const amount = (input.platformFeeAmount * item.splitPct) / 100;
      if (amount <= 0) continue;

      result.attempted += 1;

      await applyOnePayout({
        recipient: item.recipient,
        sliceLevel: item.sliceLevel,
        splitPct: item.splitPct,
        amount,
        platformWallet,
        ownerUserId: item.ownerUserId,
        input,
        session,
      });

      result.applied += 1;
      result.totalPaidOut = result.totalPaidOut + amount;
      result.payouts.push({
        // originalLevel = which configured slice was paid out (may differ
        // from paidAsLevel when the slice cascaded up to a higher owner).
        originalLevel: item.sliceLevel,
        paidAsLevel: item.recipient.level,
        entityId: item.recipient.id,
        ownerEmail: item.recipient.ownerEmail,
        amount,
      });
    }

    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

/** No-session variant for the pre-flight User existence check. */
async function findRecipientUserNoSession(
  email: string
): Promise<Types.ObjectId | null> {
  const escapedEmail = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const u = await User.findOne({
    email: new RegExp("^" + escapedEmail + "$", "i"),
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  return u ? u._id : null;
}
