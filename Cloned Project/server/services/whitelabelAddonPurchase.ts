// Whitelabel add-on — invoice-based purchase flow.
//
// Contract (from the plan file, docs/whitelabel-addon.md if you want a
// full narrative):
//   1. Founder self-serves. `purchaseWhitelabelAddon` mints a $600 USD
//      (+18% GST when Indian-billed) recurring invoice and charges the
//      founder's saved card on-session immediately.
//   2. Invoice pays → `fulfillInvoice`'s `whitelabel_addon` switch case
//      fires `activateWhitelabelFromInvoice` (upserts an
//      OfficeAddonSubscription so `hasActiveAddon(orgId, "white-label")`
//      returns true) + `chargeReferralCommission` (credits 50% of the
//      base $600 = $300 USD to the buyer's direct referrer's Affiliate
//      Wallet via `creditAffiliateOrPlatform`).
//   3. Yearly renewal cron (`runWhitelabelRenewalTick`) mints the next
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
import { WHITELABEL_ADDON, whitelabelCycleMs } from "../config/whitelabelAddon";

// ─── Types ──────────────────────────────────────────────────────────

export interface WhitelabelPurchaseInput {
  orgId: string;
  buyerUserId: string;
}

/**
 * Response of the invoice-mint flow. The FE opens `/invoice/<invoiceId>`
 * on receipt and lets the standard invoice-pay page collect the money
 * via whichever channel the founder prefers (Razorpay hosted checkout,
 * Stripe Elements, crypto, wallet, etc.) — same pattern as office
 * subscriptions. On payment, `fulfillInvoice`'s `whitelabel_addon`
 * switch case activates the add-on and pays the 50% referrer commission.
 */
export interface WhitelabelPurchaseResult {
  invoiceId: string;
  invoiceNumber: string;
  amountSmallest: number;
  currency: string;
  /** Relative FE path — the standard invoice pay page. */
  redirectUrl: string;
}

export interface WhitelabelPriceQuote {
  baseUsdCents: number;
  gstApplicable: boolean;
  gstAmountSmallest: number;
  totalUsdCents: number;
  currency: "USD";
  country: string;
  regionSource: string;
}

// ─── Helpers ────────────────────────────────────────────────────────

async function findWhitelabelAddonId(): Promise<Types.ObjectId> {
  const addon = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!addon) {
    throw new Error(
      `OfficeAddon with slug "${WHITELABEL_ADDON.slug}" not found. ` +
        `Seed it via services/init.ts::initializeOfficeAddons before ` +
        `enabling the whitelabel invoice flow.`,
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
 * Compute the price the founder will pay for the whitelabel add-on,
 * accounting for GST based on their buyer region. Called by the /price
 * endpoint so the FE can render the total before purchase.
 */
export async function quoteWhitelabelPrice(
  buyerUserId: string,
  orgId: string,
): Promise<WhitelabelPriceQuote> {
  const region = await resolveBuyerGstRegion({
    buyerUserId,
    // No shipping / billing address on this flow — pure profile lookup.
  });
  const line = applyGstToLine({
    listedAmountMinor: WHITELABEL_ADDON.priceUsdCents,
    quantity: 1,
    gstInclusive: false,
    buyerInIndia: region.inIndia,
    taxRate: WHITELABEL_ADDON.gstRate,
  });
  return {
    baseUsdCents: WHITELABEL_ADDON.priceUsdCents,
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
 * Mint a whitelabel add-on invoice and hand the founder off to the
 * standard `/invoice/<id>` pay page — same "external hosted checkout"
 * pattern the office subscription flow uses. No saved-card requirement:
 * the founder picks whatever payment method they want (Razorpay hosted,
 * Stripe Elements, crypto, wallet) on the invoice pay page.
 *
 * On payment, `fulfillInvoice`'s `whitelabel_addon` switch case
 * activates the add-on (upserts OfficeAddonSubscription so
 * `hasActiveAddon(orgId, "white-label")` flips true) and pays 50% of
 * the base to the buyer's direct referrer.
 *
 * Rejects if:
 *   - The org already has whitelabel active (409, no duplicate invoice).
 *   - The org has no resolvable founder (400).
 */
export async function purchaseWhitelabelAddon(
  input: WhitelabelPurchaseInput,
): Promise<WhitelabelPurchaseResult> {
  const { orgId, buyerUserId } = input;

  if (await hasActiveAddon(orgId, WHITELABEL_ADDON.slug)) {
    throw Object.assign(
      new Error("Whitelabel add-on is already active on this org."),
      { statusCode: 409 },
    );
  }

  const buyer = await User.findById(buyerUserId).lean<any>();
  if (!buyer) throw Object.assign(new Error("Buyer not found"), { statusCode: 404 });

  const seller = await findOrgFounder(orgId);
  if (!seller) {
    throw Object.assign(new Error("Org founder not found"), { statusCode: 400 });
  }

  const price = await quoteWhitelabelPrice(buyerUserId, orgId);

  // Reuse the dedup path in createInvoice — if the founder already has
  // a pending/draft/failed whitelabel invoice, they get that one back
  // (no ghost duplicates). Same behavior as any other checkout flow.
  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: String(seller._id),
    userId: String(buyer._id),
    customerEmail: buyer.email,
    customerName: buyer.name,
    lineItems: [
      {
        itemType: "whitelabel_addon",
        // Schema requires ObjectId. Use the org id — the invoice is
        // scoped to the org that's buying access. Trivially queryable:
        // Invoice.find({ "lineItems.itemType": "whitelabel_addon",
        //                "lineItems.itemId": orgId }).
        itemId: orgId,
        itemName: "Whitelabel — 1 year",
        itemDescription:
          "Whitelabel access — custom domain, branded logo/name, branded email sender. Auto-renews yearly.",
        quantity: 1,
        unitPrice: WHITELABEL_ADDON.priceUsdCents,
        originalCurrency: WHITELABEL_ADDON.currency,
      },
    ],
    itemCurrency: WHITELABEL_ADDON.currency,
    isRecurring: true,
    recurringPeriod: WHITELABEL_ADDON.subscriptionPeriod,
    tax: price.gstAmountSmallest,
    metadata: {
      addonSlug: WHITELABEL_ADDON.slug,
      source: "self_serve",
      buyerRegion: {
        country: price.country,
        source: price.regionSource,
      },
      gst: price.gstApplicable
        ? {
            rate: WHITELABEL_ADDON.gstRate,
            amount: price.gstAmountSmallest,
            inclusive: false,
            sacCode: WHITELABEL_ADDON.sacCode,
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
 * "white-label")` returns true. Idempotent — safe to re-call on a
 * re-fulfilled invoice.
 *
 * Sets `metadata.source = "invoice"` to distinguish from legacy
 * Razorpay-subscription docs. On renewal, extends `currentEnd += 1yr`
 * and increments `paidCount`.
 */
export async function activateWhitelabelFromInvoice(
  invoice: IInvoice,
): Promise<void> {
  // Idempotency — a re-fulfilled invoice shouldn't double-activate.
  if ((invoice.metadata as any)?.whitelabelActivatedAt) return;

  const addonId = await findWhitelabelAddonId();
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
  const cycleEnd = new Date(cycleStart.getTime() + whitelabelCycleMs());

  const founder = await findOrgFounder(String(invoice.organizationId));
  if (!founder) {
    throw new Error(
      `activateWhitelabelFromInvoice: no founder for org ${invoice.organizationId}`,
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
          cycleEnd.getTime() - WHITELABEL_ADDON.renewalLeadDays * 24 * 3600 * 1000,
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
        "metadata.whitelabelActivatedAt": new Date(),
        "metadata.whitelabelCycleEnd": cycleEnd,
      },
    },
  );
}

/**
 * Bundle-grant whitelabel access when a Cryptosub invoice is paid, IF
 * the org opted in at office-creation time (`whitelabelRequested: true`).
 *
 * No invoice, no charge, no commission. The founder already paid for
 * Cryptosub — whitelabel rides along for free.
 *
 * Cycle alignment: mirrors the cryptosub OfficeAddonSubscription's
 * currentStart / currentEnd for THIS org (which activateCryptosubFrom-
 * Invoice just wrote). That way whitelabel extends together with
 * Cryptosub on renewal, and lapses together with Cryptosub if the
 * founder stops paying.
 *
 * Idempotency: skips if `invoice.metadata.whitelabelBundledAt` is
 * already set. Stamps it after the grant. Safe to re-fulfill.
 *
 * IMPORTANT: `metadata.source = "cryptosub_bundle"`, NOT `"invoice"`.
 * The paid-addon renewal tick (runWhitelabelRenewalTick) only picks
 * subscriptions where source === "invoice" and mints a $600 renewal
 * invoice. Using "cryptosub_bundle" keeps these offices out of that
 * job so they are never billed for whitelabel separately.
 */
export async function activateBundledWhitelabelFromCryptosub(
  invoice: IInvoice,
): Promise<void> {
  // Idempotency — re-fulfilment shouldn't double-grant.
  if ((invoice.metadata as any)?.whitelabelBundledAt) return;

  const orgId = String(invoice.organizationId);
  if (!orgId) return;

  const org: any = await mongoose.model("Organization").findById(orgId)
    .select("whitelabelRequested")
    .lean();
  // Not opted in → do nothing. This is the default path for every
  // office that DIDN'T tick the whitelabel box.
  if (!org || org.whitelabelRequested !== true) return;

  const addonId = await findWhitelabelAddonId();
  const orgObjId = new Types.ObjectId(orgId);

  // Anchor the whitelabel cycle to the cryptosub cycle that
  // activateCryptosubFromInvoice just wrote for this org. If for any
  // reason the cryptosub sub isn't there yet (shouldn't happen — this
  // function runs immediately after activation), fall back to the
  // paid-invoice window.
  const { CRYPTOSUB_ADDON } = await import("../config/cryptosubAddon");
  const cryptosubAddonId = (
    await OfficeAddon.findOne({ slug: CRYPTOSUB_ADDON.slug })
      .select("_id")
      .lean<{ _id: Types.ObjectId }>()
  )?._id;
  let cycleStart: Date;
  let cycleEnd: Date;
  if (cryptosubAddonId) {
    const cryptosubSub: any = await OfficeAddonSubscription.findOne({
      orgId: orgObjId,
      addonId: cryptosubAddonId,
    })
      .select("currentStart currentEnd")
      .lean();
    cycleStart = cryptosubSub?.currentStart || invoice.paidAt || new Date();
    cycleEnd =
      cryptosubSub?.currentEnd ||
      new Date((cycleStart.getTime()) + whitelabelCycleMs());
  } else {
    cycleStart = invoice.paidAt || new Date();
    cycleEnd = new Date(cycleStart.getTime() + whitelabelCycleMs());
  }

  const founder = await findOrgFounder(orgId);
  if (!founder) {
    console.warn(
      `[whitelabel:bundled] no founder for org ${orgId} — skipping bundled grant`,
    );
    return;
  }

  await OfficeAddonSubscription.updateOne(
    { orgId: orgObjId, addonId },
    {
      $set: {
        founderId: founder._id,
        addonId,
        status: "active",
        currentStart: cycleStart,
        currentEnd: cycleEnd,
        // No chargeAt — bundled subs are never charged. Renewal tick
        // filters on metadata.source === "invoice" anyway, so this
        // row will never be picked up.
        startedAt: cycleStart,
        paymentMethod: "bundled",
        "metadata.source": "cryptosub_bundle",
        "metadata.cryptosubInvoiceId": invoice._id,
        "metadata.cryptosubInvoiceNumber": invoice.invoiceNumber,
      },
      $unset: {
        endedAt: 1,
        cancelledAt: 1,
        chargeAt: 1,
      },
      $setOnInsert: {
        orgId: orgObjId,
      },
    },
    { upsert: true },
  );

  await Invoice.updateOne(
    { _id: invoice._id },
    {
      $set: {
        "metadata.whitelabelBundledAt": new Date(),
        "metadata.whitelabelBundledCycleEnd": cycleEnd,
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
 * kind + dedupeKey. Used for two distinct writes on every whitelabel
 * sale:
 *   1. Residual (`whitelabel_addon_platform`) — $6 baseline + any
 *      missing-chain-level shares that couldn't reach an upline.
 *   2. Revenue (`whitelabel_addon_platform_revenue`) — the $300
 *      seller-take = base ($600) minus commission ($300). Without
 *      this, the money debited from the buyer's wallet ends up
 *      unaccounted on the ledger.
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
 * Distribute the $300 whitelabel add-on commission across three
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
  if (meta.whitelabelCommissionAt) {
    return { distributed: false, breakdown: meta.whitelabelCommissionBreakdown };
  }

  const cfg = WHITELABEL_ADDON.commission;
  const buyerId = String(invoice.userId);
  // Get L1 direct referrer for the flat direct bonus.
  const buyerDoc: any = await User.findById(buyerId).select("referredBy").lean();
  const directRecipient: string | null = buyerDoc?.referredBy
    ? String(buyerDoc.referredBy)
    : null;

  // Breakdown metadata for audit trail.
  const breakdown = {
    directCents: directRecipient ? cfg.directFlatUsdCents : 0,
    directRecipient,
    // Cascade pool is delegated to distributeUnilevelPlusCommission —
    // we record the pool amount here for audit; the per-level splits
    // live in the UnilevelPlusDistribution doc it writes.
    cascadePoolCents: cfg.cascadePoolUsdCents,
    // Platform residual: just the $6 baseline. No more "absorbed
    // missing chain levels" — the UP function handles unspent
    // portions (infinity tiers, company %, manager %) by routing them
    // to Shorupan HQ StoreWallet internally.
    platformCents: cfg.platformResidualUsdCents,
    // If L1 is missing, the $150 direct falls into platform.
    ...(!directRecipient ? { directFellToPlatform: true } : {}),
  };
  if (!directRecipient) breakdown.platformCents += cfg.directFlatUsdCents;

  // ─── Actually credit. ────────────────────────────────────────────
  // Note: UP distribution runs in its own DB session inside
  // distributeUnilevelPlusCommission — don't wrap it in our outer
  // transaction (nested sessions would conflict). Direct + residual +
  // revenue writes use our own session.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Direct L1 flat $150.
      if (directRecipient) {
        await creditAffiliateOrPlatform({
          recipientUserId: directRecipient,
          amount: cfg.directFlatUsdCents / 100,
          currency: "USD",
          description: "Whitelabel add-on direct bonus (L1)",
          note: `Direct bonus from whitelabel add-on sale (invoice ${invoice.invoiceNumber}).`,
          relatedUserId: buyerId,
          metadata: {
            kind: "whitelabel_addon_direct",
            bucket: "direct",
            level: 1,
            invoiceId: String(invoice._id),
            invoiceNumber: invoice.invoiceNumber,
            unit: "whole",
            dedupeKey: `whitelabel_direct_${invoice._id}`,
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
        kind: "whitelabel_addon_platform",
        description: "Whitelabel add-on — platform residual (baseline)",
        note: `Whitelabel platform residual baseline${!directRecipient ? " + $150 direct (no L1 referrer)" : ""} from invoice ${invoice.invoiceNumber}.`,
        dedupeKey: `whitelabel_platform_${invoice._id}`,
      });

      // 4. Platform revenue — the SELLER TAKE. $600 base minus the
      // $300 commission = $300 that isn't distributed anywhere and
      // otherwise vanishes from the ledger (buyer's wallet is debited
      // for the full base, but no matching credit exists without
      // this write). Same platform sink as the residual, tagged
      // differently for reporting.
      const platformRevenueCents =
        WHITELABEL_ADDON.priceUsdCents -
        (cfg.directFlatUsdCents +
          cfg.cascadePoolUsdCents +
          cfg.platformResidualUsdCents);
      await creditPlatformStoreWallet({
        amountUsd: platformRevenueCents / 100,
        invoice,
        breakdown,
        session,
        kind: "whitelabel_addon_platform_revenue",
        description: "Whitelabel add-on — platform revenue (seller take)",
        note: `Platform revenue from whitelabel add-on sale (invoice ${invoice.invoiceNumber}). Base $${WHITELABEL_ADDON.priceUsdCents / 100} minus commission distribution.`,
        dedupeKey: `whitelabel_platform_revenue_${invoice._id}`,
      });
    });
  } finally {
    await session.endSession();
  }

  // ─── 3. UP cascade — pool distributed as 6 SEPARATE $25 unit sales
  //         through the active UnilevelPlusPlan formula. Six calls (not
  //         one $150 call) because level bonuses use `points × pointValue`
  //         (a fixed ¢/point), NOT a % of saleAmount — so a single $150
  //         call would pay level bonuses as if it were ONE UP unit, not
  //         six. Six calls correctly scale level bonuses 6× (matching
  //         the founder's "6 UP units per whitelabel sale" model).
  //         Each unit gets its own paymentId suffix so UP's dedupe by
  //         paymentId doesn't collide.
  //         Runs OUTSIDE the outer wallet transaction (nested mongoose
  //         sessions would fail).
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
            paymentId: `whitelabel_up_${invoice._id}_unit_${i}`,
            metadata: {
              kind: "whitelabel_addon_up_cascade",
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
        "metadata.whitelabelCommissionAt": new Date(),
        "metadata.whitelabelCommissionBreakdown": {
          direct: breakdown.directCents / 100,
          directRecipient: breakdown.directRecipient,
          // Full $144 goes to distributeUnilevelPlusCommission — per-
          // level splits live in the UnilevelPlusDistribution doc.
          upCascadePool:
            cfg.cascadePoolUsdCents / 100,
          upDistribution: upDistributionSummary,
          platform: breakdown.platformCents / 100,
          // Platform revenue = base ($600) − commission ($300). Not
          // part of the commission distribution — it's the seller-take
          // that would otherwise vanish from the ledger when the
          // buyer's wallet is debited for the full base.
          platformRevenue:
            (WHITELABEL_ADDON.priceUsdCents -
              (WHITELABEL_ADDON.commission.directFlatUsdCents +
                WHITELABEL_ADDON.commission.cascadePoolUsdCents +
                WHITELABEL_ADDON.commission.platformResidualUsdCents)) /
            100,
        },
      },
    },
  );

  const platformRevenueLog =
    WHITELABEL_ADDON.priceUsdCents -
    (WHITELABEL_ADDON.commission.directFlatUsdCents +
      WHITELABEL_ADDON.commission.cascadePoolUsdCents +
      WHITELABEL_ADDON.commission.platformResidualUsdCents);
  console.log(
    `[chargeReferralCommission] invoice=${invoice._id} direct=$${(breakdown.directCents / 100).toFixed(2)} upCascadePool=$${(cfg.cascadePoolUsdCents / 100).toFixed(2)} platform=$${(breakdown.platformCents / 100).toFixed(2)} platformRevenue=$${(platformRevenueLog / 100).toFixed(2)} base=$${(WHITELABEL_ADDON.priceUsdCents / 100).toFixed(2)}`,
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
 * Scan for whitelabel subscriptions whose `currentEnd` falls within the
 * renewal lead window, and mint the next invoice for the founder to
 * pay through the standard invoice-pay page (same pattern as the
 * initial purchase). No auto-charge — the founder receives an email
 * notification (out of scope for this tick; TODO) and pays via
 * whichever method they choose.
 *
 * Idempotency: uses `metadata.renewalInFlightAt` as an atomic lease so
 * a concurrent tick can't double-mint. Cleared after the mint lands.
 */
export async function runWhitelabelRenewalTick(): Promise<RenewalTickResult> {
  const addonId = await findWhitelabelAddonId();
  const now = new Date();
  const leadWindowEnd = new Date(
    now.getTime() + WHITELABEL_ADDON.renewalLeadDays * 24 * 3600 * 1000,
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

      const purchaseResult = await purchaseWhitelabelAddon({
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

export interface WhitelabelStatusResult {
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

export async function getWhitelabelStatus(
  orgId: string,
): Promise<WhitelabelStatusResult> {
  const active = await hasActiveAddon(orgId, WHITELABEL_ADDON.slug);
  const addonId = await findWhitelabelAddonId();
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
