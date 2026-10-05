import mongoose, { Types, ClientSession } from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { TerritoryWallet } from "../models/territoryWallet.model";
import { TerritoryWalletTransaction } from "../models/territoryWalletTransaction.model";
import { FranchiseProgram } from "../models/franchiseProgram.model";
import {
  FranchiseTerritoryAssignment,
  FranchiseGeoLevel,
} from "../models/franchiseTerritoryAssignment.model";
import { resolveGeoChainFromAddress } from "../utils/franchiseGeoResolver";
import { AddressInput } from "../utils/territoryResolver";
import { buildFranchiseChainPlan } from "./franchiseChainPlan";

/**
 * Founder franchise program commission distribution — the per-office layer
 * that runs IN ADDITION TO the global Shorupan territory split.
 *
 * On every paid sale at an enrolled office, this carves the founder-configured
 * percentages of the FULL sale principal (mirroring the affiliate rule) and
 * routes them to the territory owners the founder sold to, attributed by the
 * BUYER's location. The debit still comes from the office's StoreWallet — so
 * the platform's 5% cut stays 100% intact and the seller absorbs the slice out
 * of their 95% gross credit.
 *
 * Chain-integrity (identical rule to the global system):
 *   - sub-territory owner earns whenever the buyer's sub-territory is assigned.
 *   - territory owner earns only if the buyer's sub-territory AND territory are
 *     both assigned (active).
 *   - country owner earns only if sub-territory AND territory AND country are
 *     all assigned (active).
 *
 * Safety: runs in its OWN Mongo transaction, AFTER the main commission +
 * global-territory commits. The caller wraps it in try/catch — any throw here
 * is logged and the rest of fulfilment continues. An overspend guard clips a
 * slice to the office wallet's available balance and never drives it negative.
 */

type Level = FranchiseGeoLevel;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface DistributeFranchiseProgramInput {
  sellerOrgId: Types.ObjectId | string; // the enrolled office
  sellerId: Types.ObjectId | string; // the seller user (office wallet owner)
  sellerGrossAmount: number; // the office's 95% gross (USD) for this sale
  buyerUserId?: Types.ObjectId | string | null;
  buyerAddress: AddressInput | null;
  saleAmount: number;
  platformFeeAmount: number;
  platformFeePct: number;
  currency: string;
  commissionDistributionId?: Types.ObjectId | string | null;
  paymentId?: string | null;
  itemType?: string;
  itemId?: Types.ObjectId | string | null;
  itemName?: string;
}

export interface DistributeFranchiseProgramResult {
  programId: string | null;
  attempted: number;
  applied: number;
  totalPaidOut: number;
  payouts: Array<{
    level: Level;
    geoEntityId: string;
    ownerUserId: string;
    amount: number;
  }>;
}

interface PlanItem {
  /** Which configured slice this payout represents (sub/terr/country). */
  sliceLevel: Level;
  /** Where the slice actually lands (may differ from sliceLevel when cascaded UP). */
  recipientLevel: Level;
  splitPct: number;
  assignment: any;
}

/** Active-and-not-expired check for a program / assignment subscription. */
function isLive(status: string, expiresAt?: Date | null): boolean {
  if (status !== "active") return false;
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) return false;
  return true;
}

export async function distributeFranchiseProgramCommissions(
  input: DistributeFranchiseProgramInput
): Promise<DistributeFranchiseProgramResult> {
  const result: DistributeFranchiseProgramResult = {
    programId: null,
    attempted: 0,
    applied: 0,
    totalPaidOut: 0,
    payouts: [],
  };

  if (!input.saleAmount || input.saleAmount <= 0) return result;
  if (!input.buyerAddress) return result; // no buyer location → no attribution

  // 1. Active program for this office?
  const program = await FranchiseProgram.findOne({
    officeId: new Types.ObjectId(String(input.sellerOrgId)),
  }).lean();
  if (!program) return result;
  if (!isLive(program.status, program.subscription?.expiresAt)) return result;
  result.programId = String(program._id);

  const cfg = program.commissionConfig || {
    country: 0,
    territory: 0,
    subTerritory: 0,
  };

  // 2. Resolve buyer geo chain (catalog entities).
  const chain = await resolveGeoChainFromAddress(input.buyerAddress);
  if (!chain.country && !chain.territory && !chain.subTerritory) return result;

  // 3. Load this program's active assignments for the buyer's geo entities.
  const wantedByLevel: Record<Level, string | null> = {
    country: chain.country ? String(chain.country._id) : null,
    territory: chain.territory ? String(chain.territory._id) : null,
    subTerritory: chain.subTerritory ? String(chain.subTerritory._id) : null,
  };
  const geoIds = Object.values(wantedByLevel).filter(Boolean) as string[];
  if (geoIds.length === 0) return result;

  const assignments = await FranchiseTerritoryAssignment.find({
    programId: program._id,
    geoEntityId: { $in: geoIds },
    status: "active",
  }).lean();

  const byLevel: Partial<Record<Level, any>> = {};
  for (const a of assignments) {
    // Only accept the assignment whose geoEntityId matches the buyer's entity
    // at that level (guards against stale level/entity mismatches).
    if (a.geoEntityId === wantedByLevel[a.geoLevel as Level]) {
      if (isLive(a.status, a.subscription?.expiresAt)) {
        byLevel[a.geoLevel as Level] = a;
      }
    }
  }

  // 4. Chain-integrity plan (pure decision, then re-attach the assignments).
  //    The cascade rule (see franchiseChainPlan.ts) may route a slice UP
  //    to a higher-level owner when the lower level is unassigned, so the
  //    plan item's `recipientLevel` is what tells us which assignment to
  //    debit — NOT the sliceLevel.
  const chainPlan = buildFranchiseChainPlan(
    {
      country: !!byLevel.country,
      territory: !!byLevel.territory,
      subTerritory: !!byLevel.subTerritory,
    },
    {
      country: cfg.country || 0,
      territory: cfg.territory || 0,
      subTerritory: cfg.subTerritory || 0,
    }
  );
  const plan: PlanItem[] = chainPlan.map((p) => ({
    sliceLevel: p.sliceLevel,
    recipientLevel: p.recipientLevel,
    splitPct: p.splitPct,
    assignment: byLevel[p.recipientLevel],
  }));
  if (plan.length === 0) return result;

  // 5. Pre-compute amounts; drop self-payouts and zero slices.
  const sellerUserId = new Types.ObjectId(String(input.sellerId));
  const usable = plan
    // Base = FULL sale principal (mirrors the affiliate change). Debit still
    // comes from the office's 95% credit, so the platform's 5% stays intact.
    .map((p) => ({ ...p, amount: round2((input.saleAmount * p.splitPct) / 100) }))
    .filter((p) => p.amount > 0)
    .filter((p) => String(p.assignment.ownerUserId) !== String(sellerUserId));
  if (usable.length === 0) return result;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Office wallet (where the gross was credited in commission STEP 2).
    const officeWallet = await StoreWallet.findOne({
      userId: sellerUserId,
      orgId: new Types.ObjectId(String(input.sellerOrgId)),
    }).session(session);

    if (!officeWallet) {
      // No wallet means nothing to debit — nothing to do.
      await session.abortTransaction();
      return result;
    }

    for (const item of usable) {
      result.attempted += 1;

      // Overspend guard: clip the slice to the office wallet's balance.
      const available = officeWallet.balance;
      if (available <= 0) break; // nothing left to distribute
      const amount = round2(Math.min(item.amount, available));
      if (amount <= 0) continue;

      await applyOnePayout({
        program,
        assignment: item.assignment,
        sliceLevel: item.sliceLevel,
        recipientLevel: item.recipientLevel,
        splitPct: item.splitPct,
        amount,
        officeWallet,
        input,
        session,
      });

      result.applied += 1;
      result.totalPaidOut = round2(result.totalPaidOut + amount);
      result.payouts.push({
        // Record the RECIPIENT level (who got the money), keeping the API
        // shape simple. The sliceLevel is preserved in the ledger metadata
        // for anyone who needs to distinguish "own slice" vs "cascaded-up
        // slice".
        level: item.recipientLevel,
        geoEntityId: item.assignment.geoEntityId,
        ownerUserId: String(item.assignment.ownerUserId),
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

async function applyOnePayout(opts: {
  program: any;
  assignment: any;
  /** Which configured slice this payout represents (sub/terr/country). */
  sliceLevel: Level;
  /** Where the slice actually lands (may equal sliceLevel, or be an upper
   *  level when the sliceLevel was unassigned and cascaded up). */
  recipientLevel: Level;
  splitPct: number;
  amount: number;
  officeWallet: any;
  input: DistributeFranchiseProgramInput;
  session: ClientSession;
}): Promise<void> {
  const {
    program,
    assignment,
    sliceLevel,
    recipientLevel,
    splitPct,
    amount,
    officeWallet,
    input,
    session,
  } = opts;

  const ownerUserId = new Types.ObjectId(String(assignment.ownerUserId));
  const isCascaded = sliceLevel !== recipientLevel;

  // === DEBIT the office StoreWallet ===
  const debitBefore = officeWallet.balance;
  const debitAfter = round2(debitBefore - amount);
  if (debitAfter < 0) {
    throw new Error(
      `Office wallet underflow: have ${debitBefore}, slice ${amount}`
    );
  }
  officeWallet.balance = debitAfter;
  officeWallet.lastTransactionAt = new Date();
  await officeWallet.save({ session });

  await WalletTransaction.create(
    [
      {
        storeWalletId: officeWallet._id,
        walletType: "store",
        userId: new Types.ObjectId(String(input.sellerId)),
        orgId: new Types.ObjectId(String(input.sellerOrgId)),
        type: "debit",
        amount,
        currency: input.currency,
        balanceBefore: debitBefore,
        balanceAfter: debitAfter,
        description: isCascaded
          ? `Franchise commission: ${sliceLevel} slice → ${recipientLevel} owner`
          : `Franchise commission to ${recipientLevel} owner`,
        note: isCascaded
          ? `${splitPct}% of sale principal (originally ${sliceLevel} slice, cascaded up because ${sliceLevel} was unassigned) → ${recipientLevel} "${assignment.geoEntityName || assignment.geoEntityId}" (${assignment.ownerEmail})`
          : `${splitPct}% of sale principal → ${recipientLevel} "${assignment.geoEntityName || assignment.geoEntityId}" (${assignment.ownerEmail})`,
        relatedUserId: ownerUserId,
        metadata: {
          franchiseProgram: {
            programId: String(program._id),
            assignmentId: String(assignment._id),
            // `level` = recipient's actual assignment level. Kept for
            // backward compatibility with any consumer reading this field.
            level: recipientLevel,
            sliceLevel,
            recipientLevel,
            cascaded: isCascaded,
            geoEntityId: assignment.geoEntityId,
            geoEntityName: assignment.geoEntityName,
            splitPercentage: splitPct,
            buyerUserId: input.buyerUserId ? String(input.buyerUserId) : null,
          },
        },
        status: "completed",
      },
    ],
    { session }
  );

  // === CREDIT the owner's TerritoryWallet (shared with the global system) ===
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
  const credAfter = round2(credBefore + amount);
  twallet.balance = credAfter;
  twallet.totalEarnings = round2((twallet.totalEarnings || 0) + amount);
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
          ? `Franchise commission as ${recipientLevel} owner of ${assignment.geoEntityName || assignment.geoEntityId} (cascaded from unassigned ${sliceLevel})`
          : `Franchise commission as ${recipientLevel} owner of ${assignment.geoEntityName || assignment.geoEntityId}`,
        status: "completed",
        // Franchise-program attribution.
        source: "founder_program",
        franchiseProgramId: program._id,
        franchiseAssignmentId: assignment._id,
        franchiseOfficeId: new Types.ObjectId(String(input.sellerOrgId)),
        buyerUserId: input.buyerUserId
          ? new Types.ObjectId(String(input.buyerUserId))
          : undefined,
        // entityType = recipient's actual catalog level (where the money
        // landed). originalSliceLevel = which configured slice this was,
        // so a report can tell "this territory owner earned $X from the
        // territory slice AND $Y from a cascaded sub-territory slice".
        entityType: recipientLevel,
        entityId: assignment.geoEntityId,
        entityName: assignment.geoEntityName,
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
        relatedOrgId: new Types.ObjectId(String(input.sellerOrgId)),
      },
    ],
    { session }
  );
}
