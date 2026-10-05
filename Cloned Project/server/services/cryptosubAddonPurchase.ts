// Cryptosub add-on — invoice-based purchase flow.
//
// Contract (from the plan file, docs/cryptosub-addon.md if you want a
// full narrative):
//   1. Founder self-serves. `purchaseCryptosubAddon` mints a $600 USD
//      (+18% GST when Indian-billed) recurring invoice and charges the
//      founder's saved card on-session immediately.
//   2. Invoice pays → `fulfillInvoice`'s `cryptosub` switch case
//      fires `activateCryptosubFromInvoice` (upserts an
//      OfficeAddonSubscription so `hasActiveAddon(orgId, "cryptosub")`
//      returns true) + `chargeReferralCommission` (credits 50% of the
//      base $600 = $300 USD to the buyer's direct referrer's Affiliate
//      Wallet via `creditAffiliateOrPlatform`).
//   3. Yearly renewal cron (`runCryptosubRenewalTick`) mints the next
//      invoice ~7 days before `currentEnd` and off_session charges the
//      saved card. Fail → status:"halted" + email. Success → extend
//      `currentEnd += 1yr`.
//
// This file DOES NOT touch the existing $299 Razorpay-subscription
// path — it's a parallel activation route on the same
// OfficeAddonSubscription collection. `metadata.source` tells them
// apart ("invoice" vs "razorpay").

import mongoose, { Types } from "mongoose";
import { Invoice, IInvoice } from "../models/invoice.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import { User } from "../models/user.model";
import { createInvoice } from "./invoice";
import { hasActiveAddon } from "./officeAddonSubscription";
import { creditAffiliateOrPlatform } from "./wallet";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "./commission";
import { resolveBuyerGstRegion } from "../utils/gstBuyerRegion";
import { applyGstToLine } from "../utils/gstTax";
import { CRYPTOSUB_ADDON, cryptosubCycleMs } from "../config/cryptosubAddon";

// ─── Types ──────────────────────────────────────────────────────────

export interface CryptosubPurchaseInput {
  orgId: string;
  buyerUserId: string;
}

/**
 * Response of the invoice-mint flow. The FE opens `/invoice/<invoiceId>`
 * on receipt and lets the standard invoice-pay page collect the money
 * via whichever channel the founder prefers (Razorpay hosted checkout,
 * Stripe Elements, crypto, wallet, etc.) — same pattern as office
 * subscriptions. On payment, `fulfillInvoice`'s `cryptosub`
 * switch case activates the add-on and pays the 50% referrer commission.
 */
export interface CryptosubPurchaseResult {
  invoiceId: string;
  invoiceNumber: string;
  amountSmallest: number;
  currency: string;
  /** Relative FE path — the standard invoice pay page. */
  redirectUrl: string;
}

export interface CryptosubPriceQuote {
  baseUsdCents: number;
  gstApplicable: boolean;
  gstAmountSmallest: number;
  totalUsdCents: number;
  currency: "USD";
  country: string;
  regionSource: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function findCryptosubAddonId(): Promise<Types.ObjectId> {
  const addon = await OfficeAddon.findOne({ slug: CRYPTOSUB_ADDON.slug })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!addon) {
    throw new Error(
      `OfficeAddon with slug "${CRYPTOSUB_ADDON.slug}" not found. ` +
        `Seed it via services/init.ts::initializeOfficeAddons before ` +
        `enabling the cryptosub invoice flow.`,
    );
  }
  return addon._id;
}

async function findOrgFounder(orgId: string): Promise<{
  _id: Types.ObjectId;
  email: string;
} | null> {
  return User.findOne({
    organizations: {
      $elemMatch: {
        organization: new Types.ObjectId(orgId),
        role: "founder",
      },
    },
  })
    .select("_id email")
    .lean<{ _id: Types.ObjectId; email: string }>();
}

// ─── Price quote ────────────────────────────────────────────────────

/**
 * Compute the price the founder will pay for the cryptosub add-on,
 * accounting for GST based on their buyer region. Called by the /price
 * endpoint so the FE can render the total before purchase.
 */
export async function quoteCryptosubPrice(
  buyerUserId: string,
  orgId: string,
): Promise<CryptosubPriceQuote> {
  const region = await resolveBuyerGstRegion({
    buyerUserId,
    // No shipping / billing address on this flow — pure profile lookup.
  });
  const line = applyGstToLine({
    listedAmountMinor: CRYPTOSUB_ADDON.priceUsdCents,
    quantity: 1,
    gstInclusive: false,
    buyerInIndia: region.inIndia,
    taxRate: CRYPTOSUB_ADDON.gstRate,
  });
  return {
    baseUsdCents: CRYPTOSUB_ADDON.priceUsdCents,
    gstApplicable: region.inIndia,
    gstAmountSmallest: line.taxTotal,
    totalUsdCents: line.chargeTotal,
    currency: "USD",
    country: region.country || "Unknown",
    regionSource: region.source,
  };
}

// ─── Purchase (on-session first charge) ─────────────────────────────

/**
 * Mint a cryptosub add-on invoice and hand the founder off to the
 * standard `/invoice/<id>` pay page — same "external hosted checkout"
 * pattern the office subscription flow uses. No saved-card requirement:
 * the founder picks whatever payment method they want (Razorpay hosted,
 * Stripe Elements, crypto, wallet) on the invoice pay page.
 *
 * On payment, `fulfillInvoice`'s `cryptosub` switch case
 * activates the add-on (upserts OfficeAddonSubscription so
 * `hasActiveAddon(orgId, "cryptosub")` flips true) and pays 50% of
 * the base to the buyer's direct referrer.
 *
 * Rejects if:
 *   - The org already has cryptosub active (409, no duplicate invoice).
 *   - The org has no resolvable founder (400).
 */
export async function purchaseCryptosubAddon(
  input: CryptosubPurchaseInput,
): Promise<CryptosubPurchaseResult> {
  const { orgId, buyerUserId } = input;

  if (await hasActiveAddon(orgId, CRYPTOSUB_ADDON.slug)) {
    throw Object.assign(
      new Error("Cryptosub add-on is already active on this org."),
      { statusCode: 409 },
    );
  }

  const buyer = await User.findById(buyerUserId).lean<any>();
  if (!buyer) throw Object.assign(new Error("Buyer not found"), { statusCode: 404 });

  const seller = await findOrgFounder(orgId);
  if (!seller) {
    throw Object.assign(new Error("Org founder not found"), { statusCode: 400 });
  }

  const price = await quoteCryptosubPrice(buyerUserId, orgId);

  // Reuse the dedup path in createInvoice — if the founder already has
  // a pending/draft/failed cryptosub invoice, they get that one back
  // (no ghost duplicates). Same behavior as any other checkout flow.
  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: String(seller._id),
    userId: String(buyer._id),
    customerEmail: buyer.email,
    customerName: buyer.name,
    lineItems: [
      {
        itemType: "cryptosub",
        // Schema requires ObjectId. Use the org id — the invoice is
        // scoped to the org that's buying access. Trivially queryable:
        // Invoice.find({ "lineItems.itemType": "cryptosub",
        //                "lineItems.itemId": orgId }).
        itemId: orgId,
        itemName: "Cryptosub — 1 year",
        itemDescription:
          "Cryptosub access — custom domain, branded logo/name, branded email sender. Auto-renews yearly.",
        quantity: 1,
        unitPrice: CRYPTOSUB_ADDON.priceUsdCents,
        originalCurrency: CRYPTOSUB_ADDON.currency,
      },
    ],
    itemCurrency: CRYPTOSUB_ADDON.currency,
    isRecurring: true,
    recurringPeriod: CRYPTOSUB_ADDON.subscriptionPeriod,
    tax: price.gstAmountSmallest,
    metadata: {
      addonSlug: CRYPTOSUB_ADDON.slug,
      source: "self_serve",
      buyerRegion: {
        country: price.country,
        source: price.regionSource,
      },
      gst: price.gstApplicable
        ? {
            rate: CRYPTOSUB_ADDON.gstRate,
            amount: price.gstAmountSmallest,
            inclusive: false,
            sacCode: CRYPTOSUB_ADDON.sacCode,
          }
        : undefined,
    },
  });

  return {
    invoiceId: String(invoice._id),
    invoiceNumber: invoice.invoiceNumber,
    amountSmallest: invoice.totalAmount,
    currency: invoice.itemCurrency,
    redirectUrl: `/invoice/${invoice._id}`,
  };
}

// ─── Activation (called by fulfillInvoice) ──────────────────────────

/**
 * Upsert the OfficeAddonSubscription doc so `hasActiveAddon(orgId,
 * "cryptosub")` returns true. Idempotent — safe to re-call on a
 * re-fulfilled invoice.
 *
 * Sets `metadata.source = "invoice"` to distinguish from legacy
 * Razorpay-subscription docs. On renewal, extends `currentEnd += 1yr`
 * and increments `paidCount`.
 */
export async function activateCryptosubFromInvoice(
  invoice: IInvoice,
): Promise<void> {
  // Idempotency — a re-fulfilled invoice shouldn't double-activate.
  if ((invoice.metadata as any)?.cryptosubActivatedAt) return;

  const addonId = await findCryptosubAddonId();
  const orgId = new Types.ObjectId(String(invoice.organizationId));
  const paidAt = invoice.paidAt || new Date();

  const existing = await OfficeAddonSubscription.findOne({
    orgId,
    addonId,
  });

  const prevEnd = existing?.currentEnd;
  // If a subscription already ends in the future (early renewal), stack
  // the new cycle on top of the remaining time instead of throwing it
  // away. Otherwise start fresh from paidAt.
  const cycleStart = prevEnd && prevEnd > paidAt ? prevEnd : paidAt;
  const cycleEnd = new Date(cycleStart.getTime() + cryptosubCycleMs());

  const founder = await findOrgFounder(String(invoice.organizationId));
  if (!founder) {
    throw new Error(
      `activateCryptosubFromInvoice: no founder for org ${invoice.organizationId}`,
    );
  }

  await OfficeAddonSubscription.updateOne(
    { orgId, addonId },
    {
      $set: {
        founderId: founder._id,
        addonId,
        status: "active",
        currentStart: cycleStart,
        currentEnd: cycleEnd,
        chargeAt: new Date(
          cycleEnd.getTime() - CRYPTOSUB_ADDON.renewalLeadDays * 24 * 3600 * 1000,
        ),
        startedAt: existing?.startedAt || paidAt,
        paymentMethod: "card",
        "metadata.source": "invoice",
        "metadata.lastInvoiceId": invoice._id,
        "metadata.lastInvoiceNumber": invoice.invoiceNumber,
      },
      $unset: {
        // Clear halt / cancel state if we're re-activating after a
        // failure.
        endedAt: 1,
        cancelledAt: 1,
      },
      $inc: {
        paidCount: 1,
      },
      $setOnInsert: {
        orgId,
      },
    },
    { upsert: true },
  );

  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        "metadata.cryptosubActivatedAt": new Date(),
        "metadata.cryptosubCycleEnd": cycleEnd,
      },
    },
  );
}

// ─── Commission (called by fulfillInvoice) ──────────────────────────

/**
 * Walk the buyer's referral chain up to `maxLevels` deep. Returns an
 * array of length `maxLevels` where each element is either the
 * ancestor's userId at that depth (chain[0] = direct referrer / L1)
 * or `null` if the chain terminates before that depth. `visited` Set
 * guards against a cycle (shouldn't happen; defensive).
 */
async function walkReferralChain(
  buyerId: string,
  maxLevels: number,
): Promise<(string | null)[]> {
  const chain: (string | null)[] = new Array(maxLevels).fill(null);
  const visited = new Set<string>([String(buyerId)]);
  let currentId: string | null = String(buyerId);
  for (let level = 0; level < maxLevels; level++) {
    if (!currentId) break;
    const doc: any = await User.findById(currentId)
      .select("referredBy")
      .lean();
    const nextId: string | null = doc?.referredBy
      ? String(doc.referredBy)
      : null;
    if (!nextId) break;
    if (visited.has(nextId)) {
      console.warn(
        `[walkReferralChain] cycle detected at level ${level + 1} — stopping (user=${nextId})`,
      );
      break;
    }
    visited.add(nextId);
    chain[level] = nextId;
    currentId = nextId;
  }
  return chain;
}

/**
 * Credit Shorupan's platform StoreWallet with an amount tagged by
 * kind + dedupeKey. Called twice per cryptosub sale:
 *   1. Residual (`cryptosub_platform`) — $6 baseline + absorbed
 *      missing-chain-level shares.
 *   2. Revenue (`cryptosub_platform_revenue`) — the $300 seller-take
 *      = base ($600) minus commission ($300). Without this, the
 *      money debited from the buyer's wallet is unaccounted on the
 *      ledger.
 * Safe no-op when amountUsd ≤ 0.
 */
async function creditPlatformStoreWallet(params: {
  amountUsd: number;
  invoice: IInvoice;
  breakdown: any;
  session: mongoose.ClientSession;
  kind: string;
  description: string;
  note: string;
  dedupeKey: string;
}): Promise<void> {
  const { amountUsd, invoice, breakdown, session, kind, description, note, dedupeKey } = params;
  if (!amountUsd || amountUsd <= 0) return;

  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .session(session)
    .lean<{ _id: Types.ObjectId }>();
  if (!platformUser) {
    console.error(
      `[chargeReferralCommission] platform user ${PLATFORM_USER_EMAIL} not found — skipping residual credit`,
    );
    return;
  }

  let wallet = await StoreWallet.findOne({
    userId: platformUser._id,
    orgId: new Types.ObjectId(PLATFORM_ORG_ID),
  }).session(session);
  if (!wallet) {
    const created = await StoreWallet.create(
      [
        {
          userId: platformUser._id,
          orgId: new Types.ObjectId(PLATFORM_ORG_ID),
          balance: 0,
          currency: "USD",
        },
      ],
      { session },
    );
    wallet = created[0];
  }

  const before = wallet.balance;
  const after = Math.round((before + amountUsd) * 100) / 100;
  wallet.balance = after;
  wallet.lastTransactionAt = new Date();
  await wallet.save({ session });

  await WalletTransaction.create(
    [
      {
        storeWalletId: wallet._id,
        walletType: "store",
        userId: platformUser._id,
        orgId: new Types.ObjectId(PLATFORM_ORG_ID),
        type: "credit",
        amount: amountUsd,
        currency: "USD",
        balanceBefore: before,
        balanceAfter: after,
        description,
        note,
        relatedUserId: new Types.ObjectId(String(invoice.userId)),
        metadata: {
          kind,
          invoiceId: String(invoice._id),
          invoiceNumber: invoice.invoiceNumber,
          breakdown,
          dedupeKey,
        },
        status: "completed",
      },
    ],
    { session },
  );
}

/**
 * Distribute the $300 cryptosub add-on commission across three
 * buckets: $150 flat to L1, $144 depth-weighted across L1..L6, $6
 * baseline to platform. Missing upline levels absorb into the
 * platform residual so the total distributed is always exactly $300.
 *
 * Every credit goes through `creditAffiliateOrPlatform` (which routes
 * to the platform when the recipient hasn't purchased Unilevel Plus)
 * or, for the residual, straight to Shorupan's HQ StoreWallet.
 *
 * Idempotent — per-bucket dedupeKeys on each WalletTransaction guard
 * against a re-fulfill double-paying any single slice.
 */
export async function chargeReferralCommission(
  invoice: IInvoice,
): Promise<{ distributed: boolean; breakdown: any }> {
  const meta: any = invoice.metadata || {};
  if (meta.cryptosubCommissionAt) {
    return { distributed: false, breakdown: meta.cryptosubCommissionBreakdown };
  }

  const cfg = CRYPTOSUB_ADDON.commission;
  const buyerId = String(invoice.userId);

  // Get L1 direct referrer for the flat direct bonus.
  const buyerDoc: any = await User.findById(buyerId).select("referredBy").lean();
  const directRecipient: string | null = buyerDoc?.referredBy
    ? String(buyerDoc.referredBy)
    : null;

  const breakdown = {
    directCents: directRecipient ? cfg.directFlatUsdCents : 0,
    directRecipient,
    cascadePoolCents: cfg.cascadePoolUsdCents,
    platformCents: cfg.platformResidualUsdCents,
    ...(!directRecipient ? { directFellToPlatform: true } : {}),
  };
  if (!directRecipient) breakdown.platformCents += cfg.directFlatUsdCents;

  // ─── Actually credit. ────────────────────────────────────────────
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Direct L1 flat $150.
      if (directRecipient) {
        await creditAffiliateOrPlatform({
          recipientUserId: directRecipient,
          amount: cfg.directFlatUsdCents / 100,
          currency: "USD",
          description: "Cryptosub add-on direct bonus (L1)",
          note: `Direct bonus from cryptosub add-on sale (invoice ${invoice.invoiceNumber}).`,
          relatedUserId: buyerId,
          metadata: {
            kind: "cryptosub_direct",
            bucket: "direct",
            level: 1,
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            unit: "whole",
            dedupeKey: `cryptosub_direct_${invoice._id}`,
          },
          session,
        });
      }

      // 2. Platform residual — $6 baseline (+ $150 if L1 missing).
      await creditPlatformStoreWallet({
        amountUsd: breakdown.platformCents / 100,
        invoice,
        breakdown,
        session,
        kind: "cryptosub_platform",
        description: "Cryptosub add-on — platform residual (baseline)",
        note: `Cryptosub platform residual baseline${!directRecipient ? " + $150 direct (no L1 referrer)" : ""} from invoice ${invoice.invoiceNumber}.`,
        dedupeKey: `cryptosub_platform_${invoice._id}`,
      });

      // 4. Platform revenue — seller take. See whitelabel version for
      // full rationale; same shape here.
      const platformRevenueCents =
        CRYPTOSUB_ADDON.priceUsdCents -
        (cfg.directFlatUsdCents +
          cfg.cascadePoolUsdCents +
          cfg.platformResidualUsdCents);
      await creditPlatformStoreWallet({
        amountUsd: platformRevenueCents / 100,
        invoice,
        breakdown,
        session,
        kind: "cryptosub_platform_revenue",
        description: "Cryptosub add-on — platform revenue (seller take)",
        note: `Platform revenue from cryptosub add-on sale (invoice ${invoice.invoiceNumber}). Base $${CRYPTOSUB_ADDON.priceUsdCents / 100} minus commission distribution.`,
        dedupeKey: `cryptosub_platform_revenue_${invoice._id}`,
      });
    });
  } finally {
    await session.endSession();
  }

  // ─── 3. UP cascade — pool distributed as 6 SEPARATE $25 unit sales
  //         through the active UnilevelPlusPlan formula. See the twin
  //         comment in whitelabelAddonPurchase.ts for why this is a
  //         loop of 6 and not a single $150 call (level bonuses use a
  //         fixed `points × pointValue`, so we need N calls to scale
  //         them N×). Each unit has its own paymentId so UP's dedupe
  //         doesn't collide.
  let upDistributionSummary: any = null;
  try {
    const { distributeUnilevelPlusCommission } = await import(
      "./unilevelPlusCommission"
    );
    const { UnilevelPlusPlan } = await import(
      "../models/unilevelPlusPlan.model"
    );
    const activePlan: any = await UnilevelPlusPlan.findOne({
      isActive: true,
    })
      .select("_id")
      .lean();
    if (!activePlan) {
      console.error(
        `[chargeReferralCommission] no active UnilevelPlusPlan — cascade skipped for invoice ${invoice._id}`,
      );
    } else {
      const UNIT_COUNT = 6;
      const unitAmountUsd =
        cfg.cascadePoolUsdCents / UNIT_COUNT / 100; // = $25
      const units: any[] = [];
      for (let i = 1; i <= UNIT_COUNT; i++) {
        try {
          const upResult = await distributeUnilevelPlusCommission({
            buyerId,
            planId: String(activePlan._id),
            saleAmount: unitAmountUsd,
            currency: "USD",
            paymentId: `cryptosub_up_${invoice._id}_unit_${i}`,
            metadata: {
              kind: "cryptosub_up_cascade",
              invoiceId: String(invoice._id),
              invoiceNumber: invoice.invoiceNumber,
              unitIndex: i,
              unitCount: UNIT_COUNT,
            },
          });
          units.push({
            unit: i,
            distributionId: String(upResult.distribution?._id || ""),
            companyAmount: upResult.companyAmount,
            directBonusPaid: upResult.directBonusPaid,
            levelBonusesPaid: upResult.levelBonusesPaid,
          });
        } catch (unitErr) {
          console.error(
            `[chargeReferralCommission] UP unit ${i}/${UNIT_COUNT} failed for invoice ${invoice._id}:`,
            unitErr,
          );
        }
      }
      const sum = (k: string) =>
        Math.round(units.reduce((s, u) => s + (u[k] || 0), 0) * 100) / 100;
      upDistributionSummary = {
        unitCount: UNIT_COUNT,
        unitAmountUsd,
        totalPoolUsd: cfg.cascadePoolUsdCents / 100,
        units,
        companyAmountTotal: sum("companyAmount"),
        directBonusPaidTotal: sum("directBonusPaid"),
        levelBonusesPaidTotal: sum("levelBonusesPaid"),
      };
    }
  } catch (err) {
    console.error(
      `[chargeReferralCommission] UP cascade failed for invoice ${invoice._id}:`,
      err,
    );
  }

  // ─── Stamp audit trail on the invoice. ───
  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        "metadata.cryptosubCommissionAt": new Date(),
        "metadata.cryptosubCommissionBreakdown": {
          direct: breakdown.directCents / 100,
          directRecipient: breakdown.directRecipient,
          upCascadePool: cfg.cascadePoolUsdCents / 100,
          upDistribution: upDistributionSummary,
          platform: breakdown.platformCents / 100,
          platformRevenue:
            (CRYPTOSUB_ADDON.priceUsdCents -
              (CRYPTOSUB_ADDON.commission.directFlatUsdCents +
                CRYPTOSUB_ADDON.commission.cascadePoolUsdCents +
                CRYPTOSUB_ADDON.commission.platformResidualUsdCents)) /
            100,
        },
      },
    },
  );

  const platformRevenueLog =
    CRYPTOSUB_ADDON.priceUsdCents -
    (CRYPTOSUB_ADDON.commission.directFlatUsdCents +
      CRYPTOSUB_ADDON.commission.cascadePoolUsdCents +
      CRYPTOSUB_ADDON.commission.platformResidualUsdCents);
  console.log(
    `[chargeReferralCommission] invoice=${invoice._id} direct=$${(breakdown.directCents / 100).toFixed(2)} upCascadePool=$${(cfg.cascadePoolUsdCents / 100).toFixed(2)} platform=$${(breakdown.platformCents / 100).toFixed(2)} platformRevenue=$${(platformRevenueLog / 100).toFixed(2)} base=$${(CRYPTOSUB_ADDON.priceUsdCents / 100).toFixed(2)}`,
  );

  return { distributed: true, breakdown };
}

// ─── Renewal (called by cron) ───────────────────────────────────────

export interface RenewalTickResult {
  scannedCount: number;
  mintedCount: number;
  skippedCount: number;
  errors: Array<{ subscriptionId: string; error: string }>;
}

/**
 * Scan for cryptosub subscriptions whose `currentEnd` falls within the
 * renewal lead window, and mint the next invoice for the founder to
 * pay through the standard invoice-pay page (same pattern as the
 * initial purchase). No auto-charge — the founder receives an email
 * notification (out of scope for this tick; TODO) and pays via
 * whichever method they choose.
 *
 * Idempotency: uses `metadata.renewalInFlightAt` as an atomic lease so
 * a concurrent tick can't double-mint. Cleared after the mint lands.
 */
export async function runCryptosubRenewalTick(): Promise<RenewalTickResult> {
  const addonId = await findCryptosubAddonId();
  const now = new Date();
  const leadWindowEnd = new Date(
    now.getTime() + CRYPTOSUB_ADDON.renewalLeadDays * 24 * 3600 * 1000,
  );

  const due = await OfficeAddonSubscription.find({
    addonId,
    status: "active",
    "metadata.source": "invoice",
    currentEnd: { $lte: leadWindowEnd },
  }).lean();

  const result: RenewalTickResult = {
    scannedCount: due.length,
    mintedCount: 0,
    skippedCount: 0,
    errors: [],
  };

  for (const sub of due) {
    try {
      const acquired = await OfficeAddonSubscription.findOneAndUpdate(
        {
          _id: sub._id,
          "metadata.renewalInFlightAt": { $exists: false },
        },
        { $set: { "metadata.renewalInFlightAt": new Date() } },
        { new: true },
      );
      if (!acquired) {
        result.skippedCount += 1;
        continue; // Another tick has the lease.
      }

      const purchaseResult = await purchaseCryptosubAddon({
        orgId: String(sub.orgId),
        buyerUserId: String(sub.founderId),
      });

      result.mintedCount += 1;
      await OfficeAddonSubscription.updateOne(
        { _id: sub._id },
        {
          $set: {
            "metadata.renewalInvoiceId": purchaseResult.invoiceId,
            "metadata.renewalInvoiceNumber": purchaseResult.invoiceNumber,
            "metadata.renewalMintedAt": new Date(),
          },
          $unset: { "metadata.renewalInFlightAt": 1 },
        },
      );
    } catch (err: any) {
      // Release the lease on unexpected crash so the next tick can retry.
      await OfficeAddonSubscription.updateOne(
        { _id: sub._id },
        { $unset: { "metadata.renewalInFlightAt": 1 } },
      );
      result.errors.push({
        subscriptionId: String(sub._id),
        error: err?.message || String(err),
      });
    }
  }

  return result;
}

// ─── Status (called by /status route) ───────────────────────────────

export interface CryptosubStatusResult {
  hasAccess: boolean;
  currentEnd?: Date;
  willRenewAt?: Date;
  source?: string;
  lastInvoice?: {
    id: string;
    number: string;
    paidAt?: Date;
  };
}

export async function getCryptosubStatus(
  orgId: string,
): Promise<CryptosubStatusResult> {
  const active = await hasActiveAddon(orgId, CRYPTOSUB_ADDON.slug);
  const addonId = await findCryptosubAddonId();
  const sub = await OfficeAddonSubscription.findOne({
    orgId: new Types.ObjectId(orgId),
    addonId,
  })
    .sort({ updatedAt: -1 })
    .lean<any>();
  if (!sub) return { hasAccess: active };
  return {
    hasAccess: active,
    currentEnd: sub.currentEnd,
    willRenewAt: sub.chargeAt,
    source: sub.metadata?.source,
    lastInvoice: sub.metadata?.lastInvoiceId
      ? {
          id: String(sub.metadata.lastInvoiceId),
          number: sub.metadata.lastInvoiceNumber || "",
        }
      : undefined,
  };
}
