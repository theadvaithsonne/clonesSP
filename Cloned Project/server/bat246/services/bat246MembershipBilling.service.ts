/**
 * bat246MembershipBilling.service.ts
 *
 * Free-2-months-then-$12/month Bat246 membership (2026-08-18, trial length
 * changed from 3 to 2 months same day) — replaces the old one-time $20/year
 * purchase for brand-new users. Two entry points:
 *
 *   - activateFreeTrialMembership(userId) — "Claim Free for 2 Months" button
 *     on the boards page. No charge, no invoice. Only usable once per user
 *     (whoever has never activated membership before, the old paid way or
 *     this new free way).
 *   - runDueMembershipBilling() — called by a sweeper in index.ts. Charges
 *     $12/month to anyone whose trial/previous cycle has ended, debiting
 *     their own Bat246 store wallet (allowed to go negative — see
 *     directDebitStoreWalletAllowNegative) and crediting Alan K's wallet.
 *
 * Legacy $20/year members (membershipPlan is null, nextBillingAt is null)
 * are never touched by either function — this is purely additive for users
 * who come through the new free-trial path.
 */
import { Types } from "mongoose";
import { Bat246Player } from "../models/bat246Player.model";
import { createBat246Player } from "./bat246PlayerId.util";
import { Bat246Distributor } from "../models/bat246Distributor.model";
import { User } from "../../models/user.model";
import { Product } from "../../models/product.model";
import { directCreditStoreWallet, directDebitStoreWalletAllowNegative } from "./bat246Wallet.util";

const ALAN_K_EMAIL = "redbaron2020@mail.com";
export const MEMBERSHIP_TRIAL_MONTHS = 2;
export const MEMBERSHIP_MONTHLY_FEE = 12;

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Starts a brand-new user on the free 2-month Bat246 membership trial.
 * Mirrors exactly what the paid "bat246_membership" invoice fulfillment
 * (services/invoice.ts) does after a successful $20 payment — flips
 * hasBat246Membership, recomputes isQualified, assigns a distributor ID and
 * notifies the upline if this completes qualification — just without any
 * money changing hands yet.
 */
export async function activateFreeTrialMembership(userId: string) {
  const now = new Date();
  const nextBillingAt = addMonths(now, MEMBERSHIP_TRIAL_MONTHS);

  let player = await Bat246Player.findOne({ userId: new Types.ObjectId(userId) });
  if (player?.membershipActive) {
    throw new Error("Membership is already active");
  }

  if (!player) {
    // A Bat246Player record isn't guaranteed to exist yet at this point —
    // "Activate Membership" is a separate qualification step from the
    // $650/$160 entry purchase (the only other place a Bat246Player gets
    // created) and the 4 steps can be completed in any order.
    const user = await User.findById(userId).select("name email").lean() as any;
    player = await createBat246Player({
      userId: new Types.ObjectId(userId),
      nickname: user?.name || user?.email || "",
      email: user?.email || "",
      memberSince: now,
    });
  }

  await Bat246Player.updateOne(
    { _id: player._id },
    {
      $set: {
        membershipActive: true,
        membershipExpiresAt: nextBillingAt,
        membershipPlan: "trial",
        membershipStartedAt: now,
        nextBillingAt,
      },
    }
  );

  const dist = await Bat246Distributor.findOneAndUpdate(
    { userId: new Types.ObjectId(userId) },
    { $setOnInsert: { isOfficeMember: false, isGarageAffiliate: false, hasPurchasedProduct: false, isQualified: false } },
    { upsert: true, new: true, lean: true, setDefaultsOnInsert: false }
  ) as any;

  if (dist) {
    // isGarageAffiliate ($25 Garage Affiliate) dropped from qualification
    // on request. hasBat246Membership isn't in this check either — this
    // function is the membership-activation handler itself, setting it
    // true in the same update below, so it's treated as already satisfied.
    const isNowQualified = !!(dist.isOfficeMember && dist.hasPurchasedProduct);
    const distUpdate: any = { hasBat246Membership: true, membershipExpiresAt: nextBillingAt, isQualified: isNowQualified };
    if (!dist.isQualified && isNowQualified) distUpdate.qualifiedAt = new Date();
    await Bat246Distributor.updateOne({ userId: new Types.ObjectId(userId) }, distUpdate);

    if (!dist.isQualified && isNowQualified) {
      try {
        const { maybeCreatePlacementNotification } = await import("./bat246.service");
        const { assignDistributorId } = await import("./bat246DistributorId.util");
        await assignDistributorId(userId).catch((err: any) => console.error("[bat246] assignDistributorId failed:", err.message));
        await maybeCreatePlacementNotification(userId);
      } catch { /* non-fatal */ }
    }

    if (dist.bat246RefUserId) {
      try {
        const { Bat246PlacementNotification } = await import("../models/bat246PlacementNotifications.model");
        const memberUser = await User.findById(userId).select("name email").lean() as any;
        await Bat246PlacementNotification.create({
          notificationType: "membership",
          qualifiedUserId: new Types.ObjectId(userId),
          qualifiedUserEmail: memberUser?.email || "",
          qualifiedUserName: memberUser?.name || "",
          uplineUserId: dist.bat246RefUserId,
        }).catch(() => {});
      } catch { /* non-fatal */ }
    }
  }

  return { active: true, plan: "trial" as const, nextBillingAt };
}

/** Resolves the Bat246 org (from the $650 entry product's org) and Alan K's userId — shared by every billing charge. */
async function resolveBillingContext(): Promise<{ orgId: string; alanUserId: string } | null> {
  const entryProduct = await Product.findOne({ tags: "bat246_entry" }).select("organizationId").lean() as any;
  if (!entryProduct?.organizationId) return null;
  const alanUser = await User.findOne({ email: ALAN_K_EMAIL }).select("_id").lean() as any;
  if (!alanUser) return null;
  return { orgId: entryProduct.organizationId.toString(), alanUserId: alanUser._id.toString() };
}

async function chargeMembershipFee(garageUserId: string, billingPeriodDate: Date): Promise<void> {
  const ctx = await resolveBillingContext();
  if (!ctx) return;

  // yyyy-mm-dd of the cycle being billed — unique per player per cycle, so
  // even a rare double-run of the sweeper can't double-charge this cycle
  // (DB-level unique index on metadata.dedupeKey — see WalletTransaction).
  const periodKey = billingPeriodDate.toISOString().slice(0, 10);

  await directDebitStoreWalletAllowNegative(
    garageUserId,
    ctx.orgId,
    MEMBERSHIP_MONTHLY_FEE,
    "Bat246 monthly membership fee",
    `bat246_membership_debit_${garageUserId}_${periodKey}`
  );
  await directCreditStoreWallet(
    ctx.alanUserId,
    ctx.orgId,
    MEMBERSHIP_MONTHLY_FEE,
    "Bat246 monthly membership fee (from member)",
    `bat246_membership_credit_${garageUserId}_${periodKey}`
  );
}

/**
 * One sweep pass: charges everyone whose nextBillingAt has arrived. Safe to
 * call as often as you like — each due row is atomically claimed (advancing
 * nextBillingAt via a findOneAndUpdate keyed on the exact nextBillingAt just
 * read) before any money moves, so a concurrent/duplicate tick loses the
 * race and skips rather than double-charging.
 */
export async function runDueMembershipBilling(): Promise<{ billed: number; skipped: number }> {
  const now = new Date();
  const due = await Bat246Player.find({
    membershipActive: true,
    nextBillingAt: { $lte: now },
  }).select("_id userId nextBillingAt").lean() as any[];

  let billed = 0;
  let skipped = 0;

  for (const p of due) {
    if (!p.userId) { skipped++; continue; }
    try {
      const billingPeriodDate = new Date(p.nextBillingAt);
      const nextCycle = addMonths(billingPeriodDate, 1);

      const claimed = await Bat246Player.findOneAndUpdate(
        { _id: p._id, nextBillingAt: p.nextBillingAt },
        { $set: { membershipPlan: "monthly", nextBillingAt: nextCycle, membershipExpiresAt: nextCycle } }
      );
      if (!claimed) { skipped++; continue; }

      await chargeMembershipFee(p.userId.toString(), billingPeriodDate);
      billed++;
    } catch (err: any) {
      console.error("[bat246] membership billing failed for player", String(p._id), err?.message ?? err);
      skipped++;
    }
  }

  return { billed, skipped };
}
