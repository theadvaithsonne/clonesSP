// src/services/auctionSettlement.ts
//
// Turns a won auction into a real sale.
//
// garage-store-backend owns bidding and escrow, but `fulfillInvoice` — seller
// payout, platform fee, comb-plan commissions, territory + franchise splits,
// cashback — lives here and can't be called from there. So the store backend
// drops an AuctionSettlement row when an auction resolves with a winner, and
// this cron picks it up.
//
// Per row:
//   1. release the escrow held in the platform store wallet
//   2. mint a PAID invoice for exactly that amount
//   3. run it through fulfillInvoice, which creates the ProductOrder,
//      decrements inventory and distributes commissions — identical to a
//      normal buy-now sale
//
// The buyer is never charged again: their money left their Auction Wallet when
// they placed the winning bid.
//
// Everything is keyed on `bidId`, which namespaces the three downstream
// unique-sparse idempotency keys (Invoice.razorpayPaymentId,
// ProductOrder.paymentId, CommissionDistribution{paymentId,itemType,itemId}),
// so a repeated run is a no-op rather than a double payout.

import mongoose, { Types } from "mongoose";
import {
  AuctionSettlement,
  AUCTION_SETTLEMENT_MAX_ATTEMPTS,
} from "../models/auctionSettlement.model";
import { StoreProduct } from "../models/storeProduct.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Invoice } from "../models/invoice.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { User } from "../models/user.model";
import { Store } from "../models/store.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "./commission";
import { resolveSellersForOrgs } from "./ecommerceInvoice";
import { applyGstToLine } from "../utils/gstTax";
import {
  resolveBuyerGstRegion,
  gstSkippedMetadata,
} from "../utils/gstBuyerRegion";

const round2 = (n: number) => Math.round(n * 100) / 100;

// How many rows one tick will process. Keeps a backlog from monopolising the
// event loop; the next tick picks up the rest.
const BATCH_SIZE = 20;

export interface SettlementRunResult {
  settlementId: string;
  status: "settled" | "failed" | "skipped" | "retry";
  invoiceId?: string;
  error?: string;
}

/**
 * Release one winner's escrow from the platform store wallet.
 *
 * Idempotent on (metadata.kind, metadata.bidId) — a retry after a crash
 * between release and invoice creation won't debit twice.
 *
 * Returns false when the platform wallet can't cover it. That should be
 * impossible (we credited this exact amount when the bid was placed) but
 * StoreWallet.balance has `min: 0`, so rather than throw a validation error
 * mid-settlement we surface it and let the row go to `failed` for a human.
 */
async function releaseEscrowFromPlatform(params: {
  amountUsd: number;
  bidId: Types.ObjectId;
  productId: Types.ObjectId;
  winnerUserId: Types.ObjectId;
  productTitle: string;
}): Promise<{ released: boolean; reason?: string }> {
  const { amountUsd, bidId, productId, winnerUserId, productTitle } = params;
  if (amountUsd <= 0) return { released: true };

  const already = await WalletTransaction.findOne({
    "metadata.kind": "auction_escrow_release",
    "metadata.bidId": bidId,
  }).lean();
  if (already) return { released: true };

  const platformUser = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  if (!platformUser) {
    return { released: false, reason: "PLATFORM_USER_MISSING" };
  }

  const session = await mongoose.startSession();
  try {
    let outcome: { released: boolean; reason?: string } = { released: false };

    await session.withTransaction(async () => {
      const wallet = await StoreWallet.findOne({
        userId: (platformUser as any)._id,
        orgId: new Types.ObjectId(PLATFORM_ORG_ID),
      }).session(session);

      if (!wallet) {
        outcome = { released: false, reason: "ESCROW_WALLET_MISSING" };
        return;
      }
      if ((wallet as any).balance < amountUsd) {
        outcome = { released: false, reason: "ESCROW_WALLET_UNDERFUNDED" };
        return;
      }

      const balanceBefore = (wallet as any).balance;
      (wallet as any).balance = round2(balanceBefore - amountUsd);
      (wallet as any).lastTransactionAt = new Date();
      await wallet.save({ session });

      await WalletTransaction.create(
        [
          {
            storeWalletId: wallet._id,
            walletType: "store",
            userId: (wallet as any).userId,
            orgId: (wallet as any).orgId,
            type: "debit",
            amount: amountUsd,
            currency: "USD",
            balanceBefore,
            balanceAfter: (wallet as any).balance,
            description: `Auction escrow released — ${productTitle}`.slice(0, 500),
            note: "Winner's escrow released into the sale; seller payout and commissions follow.",
            relatedUserId: winnerUserId,
            metadata: {
              kind: "auction_escrow_release",
              bidId,
              productId,
              winnerUserId,
            },
            status: "completed",
          },
        ],
        { session }
      );

      outcome = { released: true };
    });

    return outcome;
  } finally {
    await session.endSession();
  }
}

/**
 * Who gets paid for a sale from `orgId` — the org's founder User._id.
 *
 * Tries both shapes the codebase uses for org membership, because they diverge
 * in practice:
 *   1. `organizations[]` with `role: "founder"` — what resolveSellersForOrgs
 *      (and therefore normal ecommerce checkout) looks at.
 *   2. The legacy top-level `organization` + `role` pair on User. The store
 *      backend's auth middleware auto-provisions users writing ONLY this one,
 *      so a seller who first appeared through the storefront has no
 *      `organizations[]` entry at all and shape 1 finds nothing.
 *
 * createStoreWalletTopupInvoice already tolerates a missing founder by falling
 * back; settlement used to hard-fail, which stranded the money.
 */
async function resolveSellerUserId(orgId: string): Promise<string | null> {
  const byArray = await resolveSellersForOrgs([orgId]);
  const fromArray = byArray.get(orgId);
  if (fromArray) return fromArray;

  const legacy: any = await User.findOne({
    organization: new Types.ObjectId(orgId),
    role: "founder",
  })
    .select("_id")
    .sort({ createdAt: 1 })
    .lean();
  if (legacy?._id) {
    console.warn(
      `[AuctionSettlement] org ${orgId} has no organizations[] founder; ` +
        `falling back to the legacy organization+role field (user ${String(legacy._id)}).`
    );
    return String(legacy._id);
  }

  return null;
}

/**
 * Settle one queued auction win. Safe to call repeatedly for the same row.
 */
export async function settleAuctionWin(
  settlementId: string | Types.ObjectId
): Promise<SettlementRunResult> {
  const settlement: any = await AuctionSettlement.findById(settlementId);
  if (!settlement) {
    return { settlementId: String(settlementId), status: "skipped", error: "not_found" };
  }
  if (settlement.status !== "pending") {
    return { settlementId: String(settlement._id), status: "skipped" };
  }

  const bidId: Types.ObjectId = settlement.bidId;
  const productId: Types.ObjectId = settlement.productId;
  const orgId: Types.ObjectId = settlement.orgId;
  // The idempotency anchor. Reused as Invoice.razorpayPaymentId (unique
  // sparse), ProductOrder.paymentId and the commission dedupe key.
  const paymentRef = `auction_${String(bidId)}`;

  // NOTHING here is terminal on the first attempt.
  //
  // Every failure below is a DATA problem (a missing founder record, a missing
  // email) that a human can fix in a couple of minutes. Burning the row
  // permanently on attempt 1 — as this used to — stranded the buyer's money in
  // the platform escrow wallet with no way back, because the cron only selects
  // `status: "pending"` and nothing resets it. Now every failure retries with
  // backoff, and after the cap the row parks as `failed` where the admin
  // requeue endpoint can revive it.
  const fail = async (reason: string) => {
    settlement.attempts = (settlement.attempts || 0) + 1;
    settlement.lastError = reason;
    if (settlement.attempts >= AUCTION_SETTLEMENT_MAX_ATTEMPTS) {
      settlement.status = "failed";
      settlement.nextAttemptAt = null;
      await StoreProduct.updateOne(
        { _id: productId },
        { $set: { "auction.settlementStatus": "failed" } }
      );
    } else {
      // 2^attempts minutes: 2, 4, 8, 16. Spreads four retries over ~30 min
      // instead of five minutes, which is enough time to notice and fix the
      // data before the row parks.
      const delayMs = Math.pow(2, settlement.attempts) * 60_000;
      settlement.nextAttemptAt = new Date(Date.now() + delayMs);
    }
    await settlement.save();
    return {
      settlementId: String(settlement._id),
      status: (settlement.status === "failed" ? "failed" : "retry") as
        | "failed"
        | "retry",
      error: reason,
    };
  };

  try {
    const product: any = await StoreProduct.findById(productId).lean();
    if (!product) return await fail("PRODUCT_NOT_FOUND");

    const sellerId = await resolveSellerUserId(String(orgId));
    if (!sellerId) return await fail("STORE_OWNER_MISSING");

    const buyer: any = await User.findById(settlement.winnerUserId)
      .select("email name country state city postalCode")
      .lean();

    // ALL preconditions are checked BEFORE any money moves. Invoice
    // .customerEmail is `required: true` and mongoose treats "" as missing on
    // a String, so an absent email would otherwise surface as an opaque
    // ValidationError — after we'd already debited the escrow account,
    // leaving the money in limbo with no sale to show for it. Fail here and
    // the funds stay safely escrowed for a human to sort out.
    const customerEmail = settlement.winnerEmail || buyer?.email || "";
    if (!customerEmail) {
      return await fail("WINNER_EMAIL_MISSING");
    }

    // An earlier attempt may have died after creating the invoice. Reuse it
    // rather than minting a second one.
    let invoice: any = await Invoice.findOne({ razorpayPaymentId: paymentRef });

    if (!invoice) {
      const released = await releaseEscrowFromPlatform({
        amountUsd: settlement.amountUsd,
        bidId,
        productId,
        winnerUserId: settlement.winnerUserId,
        productTitle: product.title || "Auction item",
      });
      if (!released.released) {
        return await fail(released.reason || "ESCROW_RELEASE_FAILED");
      }

      const store: any = await Store.findOne({ orgId })
        .select("_id currency")
        .lean();

      // Bill EXACTLY the escrowed USD. `amountUsd` is what the winner's wallet
      // actually paid — re-deriving it from bidAmount × today's FX rate would
      // drift against the money we hold.
      const listedMinor = Math.round(settlement.amountUsd * 100);

      // GST is handled EXACTLY as the buy-now flow handles it: extract the tax
      // from the inclusive price, put the pre-tax base on the line, and let
      // fulfillInvoice's GST block credit the tax to the platform (shorupan)
      // store wallet. Same helpers, same destination, same resulting rows.
      //
      // `gstInclusive: true` is hardcoded rather than read from the product:
      // a winning bid IS the total the buyer paid, so it always contains the
      // tax. Treating it as exclusive would push totalAmount 18% above the
      // escrow we actually hold and the ledger would stop balancing.
      const gstRegion = await resolveBuyerGstRegion({
        buyerUser: buyer,
        paymentCurrency: "USD",
      });

      const gst = applyGstToLine({
        listedAmountMinor: listedMinor,
        quantity: 1,
        gstInclusive: true,
        buyerInIndia: gstRegion.inIndia,
        exempt: product.taxable === false,
      });

      const requiresShipping = product.requiresShipping !== false;

      invoice = await Invoice.create({
        invoiceType: "one_time",
        // Already paid — the money moved when the bid was placed.
        status: "paid",
        paidAt: new Date(),
        organizationId: orgId,
        sellerId: new Types.ObjectId(sellerId),
        userId: settlement.winnerUserId,
        customerEmail,
        customerName: settlement.winnerName || buyer?.name || undefined,
        lineItems: [
          {
            itemType: "ecommerce_item",
            itemId: productId,
            itemName: product.title || "Auction item",
            itemImage: product.featuredImage || product.images?.[0]?.url,
            quantity: 1,
            // Pre-tax base. distributeCommissions reads this as the sale
            // principal, so the 5% platform fee and the comb-plan levels land
            // on the pre-tax amount — identical to a buy-now sale.
            unitPrice: gst.lineUnitPrice,
            totalPrice: gst.lineUnitPrice,
            originalCurrency: "USD",
            organizationId: orgId,
            sellerId: new Types.ObjectId(sellerId),
            storeId: store?._id,
            vendor: product.vendor,
          },
        ],
        subtotal: gst.lineUnitPrice,
        discount: 0,
        // Non-zero tax is what triggers fulfillInvoice's GST block, which
        // credits this amount to the platform (shorupan) store wallet — the
        // same path a buy-now sale takes.
        tax: gst.taxTotal,
        shippingCost: 0,
        // base + tax === the escrowed amount, by construction above.
        totalAmount: gst.lineUnitPrice + gst.taxTotal,
        itemCurrency: "USD",
        paymentCurrency: "USD",
        paymentPlatform: "auction_wallet",
        paymentMethodCategory: "wallet",
        // Unique sparse index — the invoice-level idempotency guard.
        razorpayPaymentId: paymentRef,
        // No shippingAddress: bidding never collects one. Commission
        // attribution still works — resolveBuyerAddress falls back to the
        // buyer's User profile. Physical delivery is chased by the seller off
        // the `needsAddress` flag below.
        paymentMode: "Prepaid",
        metadata: {
          // REQUIRED. The store backend's order mirror filters on this; without
          // it the seller's Order would never appear on their dashboard.
          flavor: "ecommerce",
          source: "auction_win",
          bidId,
          productId,
          settlementId: settlement._id,
          bidAmount: settlement.bidAmount,
          bidCurrency: settlement.bidCurrency,
          exchangeRate: settlement.exchangeRate,
          escrowUsd: settlement.amountUsd,
          // Same gst / gstSkipped metadata shape the sellable-item and
          // ecommerce flows stamp, so one reporting path and the gst_collected
          // ledger cover auction sales too.
          ...(gst.gstMetadata
            ? {
                gst: {
                  ...gst.gstMetadata,
                  buyerCountry: gstRegion.country,
                  buyerRegion: "IN" as const,
                  regionSource: gstRegion.source,
                },
              }
            : {
                gstSkipped: gstSkippedMetadata(
                  gstRegion,
                  gstRegion.inIndia ? "item_exempt" : "buyer_outside_india"
                ),
              }),
          requiresShipping,
          requiresShippingByProductId: { [String(productId)]: requiresShipping },
        },
      });

      if (requiresShipping) {
        settlement.needsAddress = true;
      }
    }

    // Inventory decrement, ProductOrder creation and the full commission
    // distribution. Internally idempotent via invoice.metadata.fulfillment.
    const { fulfillInvoice } = await import("./invoice");
    const result: any = await fulfillInvoice(invoice, paymentRef);

    const orderId = result?.orders?.[0]?.orderId;
    settlement.invoiceId = invoice._id;
    settlement.productOrderId = orderId
      ? new Types.ObjectId(String(orderId))
      : null;

    // VERIFY THE SELLER WAS ACTUALLY PAID before claiming success.
    //
    // fulfillInvoice returning proves nothing: its per-line commission loop
    // swallows errors and still sets commissionDistributed. Without this check
    // a settlement reported "settled" while the escrow had been released and
    // the seller received nothing — exactly the bug this whole pass is fixing.
    //
    // The key matches what the ecommerce loop builds: `${paymentId}_${itemId}`
    // (services/invoice.ts, per-line distributeCommissions call).
    const distribution: any = await CommissionDistribution.findOne({
      paymentId: `${paymentRef}_${String(productId)}`,
      itemType: "product",
      itemId: productId,
    }).lean();

    if (!distribution || distribution.status !== "completed") {
      const why =
        distribution?.failureReason ||
        (distribution
          ? `commission status is "${distribution.status}"`
          : "no CommissionDistribution row was created");
      // Escrow is already released at this point, so the money is sitting in
      // the platform wallet. Retrying now genuinely works: the poisoned-key
      // guard in distributeCommissions retires the failed row instead of
      // treating it as proof of payment.
      return await fail(`SELLER_NOT_CREDITED: ${why}`);
    }

    settlement.status = "settled";
    settlement.commissionDistributionId = distribution._id;
    settlement.sellerCreditedUsd = distribution.sellerAmount ?? null;
    settlement.settledAt = new Date();
    settlement.lastError = null;
    settlement.nextAttemptAt = null;
    await settlement.save();

    await StoreProduct.updateOne(
      { _id: productId },
      { $set: { "auction.settlementStatus": "settled" } }
    );

    return {
      settlementId: String(settlement._id),
      status: "settled",
      invoiceId: String(invoice._id),
    };
  } catch (err: any) {
    console.error(
      `[AuctionSettlement] ${String(settlement._id)} failed:`,
      err
    );
    return await fail(err?.message || String(err));
  }
}

/**
 * Repair the seller payout for a settlement whose invoice and order already
 * exist but whose commission never completed.
 *
 * This is the surgical alternative to re-running settlement: fulfillInvoice
 * cannot be replayed, because its ProductOrder carries a unique-sparse
 * `paymentId` and a second run would collide. So we re-issue ONLY the
 * per-line commission, using the exact same arguments the ecommerce
 * fulfilment loop builds.
 *
 * Safe to call repeatedly: distributeCommissions is idempotent on a
 * `completed` row, and retires a `failed` tombstone rather than treating it as
 * proof of payment.
 */
export async function repairSellerCommission(
  settlementId: string | Types.ObjectId
): Promise<{ ok: boolean; reason?: string; sellerCredited?: number }> {
  const settlement: any = await AuctionSettlement.findById(settlementId);
  if (!settlement) return { ok: false, reason: "settlement_not_found" };

  const invoice: any = await Invoice.findById(settlement.invoiceId).lean();
  if (!invoice) return { ok: false, reason: "invoice_not_found" };

  const li = invoice.lineItems?.[0];
  if (!li) return { ok: false, reason: "invoice_has_no_line_items" };
  if (!li.totalPrice || li.totalPrice <= 0) {
    return { ok: false, reason: "line_totalPrice_is_zero" };
  }

  const paymentRef = `auction_${String(settlement.bidId)}`;
  const { distributeCommissions } = await import("./commission");

  const result = await distributeCommissions({
    orgId: String(li.organizationId || invoice.organizationId),
    sellerId: String(li.sellerId || invoice.sellerId),
    customerId: String(invoice.userId),
    // Auction lots reuse the existing "product" comb-plan itemType, exactly as
    // normal ecommerce lines do.
    itemType: "product",
    itemId: String(li.itemId),
    itemName: li.itemName || "Auction item",
    saleAmount: li.totalPrice / 100,
    currency: li.originalCurrency || invoice.itemCurrency,
    paymentId: `${paymentRef}_${String(li.itemId)}`,
    metadata: {
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      source: "auction_win_repair",
      settlementId: settlement._id,
    },
  });

  settlement.status = "settled";
  settlement.commissionDistributionId = (result as any).distribution?._id;
  settlement.sellerCreditedUsd = result.sellerCredited;
  settlement.settledAt = new Date();
  settlement.lastError = null;
  settlement.nextAttemptAt = null;
  await settlement.save();

  await StoreProduct.updateOne(
    { _id: settlement.productId },
    { $set: { "auction.settlementStatus": "settled" } }
  );

  return { ok: true, sellerCredited: result.sellerCredited };
}

/** Process a batch of queued wins. */
export async function settleQueuedAuctionWins(): Promise<SettlementRunResult[]> {
  const now = new Date();
  const rows = await AuctionSettlement.find({
    status: "pending",
    attempts: { $lt: AUCTION_SETTLEMENT_MAX_ATTEMPTS },
    // Respect the backoff window. Rows that have never been attempted have
    // nextAttemptAt: null and are always eligible. Without this a failing row
    // is retried every 60s and exhausts its budget in five minutes.
    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }],
  })
    .sort({ createdAt: 1 })
    .limit(BATCH_SIZE)
    .select("_id")
    .lean();

  const results: SettlementRunResult[] = [];
  for (const row of rows) {
    results.push(await settleAuctionWin(row._id as Types.ObjectId));
  }
  return results;
}

/**
 * Cron entrypoint — invoked from src/index.ts on boot. Idles harmlessly when
 * the queue is empty.
 */
export function startAuctionSettlementCron(
  intervalMs = 60_000
): NodeJS.Timeout {
  console.log(`[AuctionSettlement] cron scheduled every ${intervalMs}ms`);

  // setInterval does not wait for the previous tick, and a batch is processed
  // serially. A slow batch would otherwise overlap with the next one, both
  // selecting the same rows — the loser of the unique paymentId index then
  // burns an attempt for no reason.
  let inFlight = false;

  const tick = async () => {
    if (inFlight) {
      console.warn("[AuctionSettlement] previous tick still running — skipping");
      return;
    }
    inFlight = true;
    try {
      const r = await settleQueuedAuctionWins();
      if (r.length) {
        console.log(
          `[AuctionSettlement] processed ${r.length}: ${r
            .map((x) => `${x.settlementId}=${x.status}`)
            .join(", ")}`
        );
      }
    } catch (err) {
      console.error("[AuctionSettlement] tick failed:", err);
    } finally {
      inFlight = false;
    }
  };
  setTimeout(tick, 10_000);
  return setInterval(tick, intervalMs);
}
