/**
 * READ-ONLY diagnostic for "the auction was won but the seller's wallet is
 * empty".
 *
 * Walks the whole chain in the order it is supposed to happen and prints what
 * it finds at each stage, so the first missing/failed link is obvious:
 *
 *   Product → StoreBid → AuctionEscrow → AuctionSettlement
 *     → Invoice → ProductOrder → CommissionDistribution
 *     → seller StoreWallet / platform StoreWallet / buyer AuctionWallet
 *
 * Then it reconciles the money for the winning bid and states a verdict.
 *
 * This script NEVER writes. Safe to run against production.
 *
 * Usage (from garagenew-backend/):
 *   npm run auction:diagnose -- --product <storeproductId>
 *   npm run auction:diagnose -- --bid <storeBidId>
 *   npm run auction:diagnose -- --settlement <auctionSettlementId>
 *   npm run auction:diagnose -- --recent          # last 10 settlements
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { AuctionEscrow } from "../models/auctionEscrow.model";
import { AuctionSettlement } from "../models/auctionSettlement.model";
import { AuctionWallet } from "../models/auctionWallet.model";
import { AuctionWalletTransaction } from "../models/auctionWalletTransaction.model";
import { StoreProduct } from "../models/storeProduct.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { CommissionDistribution } from "../models/commissionDistribution.model";
import { Invoice } from "../models/invoice.model";
import { ProductOrder } from "../models/productOrder.model";
import { User } from "../models/user.model";
import { PLATFORM_USER_EMAIL, PLATFORM_ORG_ID } from "../services/commission";

const money = (n: any) => (typeof n === "number" ? `$${n.toFixed(2)}` : "—");
const id = (v: any) => (v ? String(v) : "—");
const yn = (v: any) => (v ? "yes" : "NO");

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function head(title: string) {
  console.log(`\n${"═".repeat(72)}\n${title}\n${"═".repeat(72)}`);
}

function section(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 66 - title.length))}`);
}

async function diagnoseOne(settlementOrIds: {
  settlementId?: string;
  productId?: string;
  bidId?: string;
}) {
  // storeBids is owned by garage-store-backend and has no mongoose model on
  // this side — read the raw collection. Note the capital B in the name.
  const storeBids = mongoose.connection.collection("storeBids");

  // ── Resolve the settlement row from whichever handle we were given ──
  let settlement: any = null;
  if (settlementOrIds.settlementId) {
    settlement = await AuctionSettlement.findById(
      settlementOrIds.settlementId
    ).lean();
  } else if (settlementOrIds.bidId) {
    settlement = await AuctionSettlement.findOne({
      bidId: new Types.ObjectId(settlementOrIds.bidId),
    }).lean();
  } else if (settlementOrIds.productId) {
    settlement = await AuctionSettlement.findOne({
      productId: new Types.ObjectId(settlementOrIds.productId),
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  const productId =
    settlement?.productId ||
    (settlementOrIds.productId
      ? new Types.ObjectId(settlementOrIds.productId)
      : null);

  head(
    `AUCTION DIAGNOSIS  product=${id(productId)}  settlement=${id(
      settlement?._id
    )}`
  );

  const problems: string[] = [];

  // ── 1. Product ──────────────────────────────────────────────────────
  section("1. Product (storeproducts)");
  const product: any = productId
    ? await StoreProduct.findById(productId).lean()
    : null;
  if (!product) {
    console.log("  MISSING — no storeproducts doc for that id");
    problems.push("Product not found");
  } else {
    const a = product.auction || {};
    console.log(`  title             ${product.title}`);
    console.log(`  orgId             ${id(product.orgId)}`);
    console.log(`  saleType          ${product.saleType}`);
    console.log(`  currency          ${product.currency || "(unset)"}`);
    console.log(`  auction.status    ${a.status || "—"}`);
    console.log(`  settlementStatus  ${a.settlementStatus || "(absent)"}`);
    console.log(`  endsAt            ${a.endsAt || "—"}`);
    console.log(`  reservePrice      ${a.reservePrice ?? "—"}`);
    console.log(`  highestBidAmount  ${a.highestBidAmount ?? "—"}`);
    console.log(`  winningBidId      ${id(a.winningBidId)}`);
  }

  // ── 2. Bids ─────────────────────────────────────────────────────────
  section("2. Bids (storeBids)");
  const bids = productId
    ? await storeBids
        .find({ productId: new Types.ObjectId(String(productId)) })
        .sort({ amount: -1 })
        .limit(20)
        .toArray()
    : [];
  if (bids.length === 0) {
    console.log("  none");
  }
  for (const b of bids) {
    const flag = settlement && String(b._id) === String(settlement.bidId) ? " ← WINNER" : "";
    console.log(
      `  ${String(b._id)}  ${String(b.status).padEnd(12)} ${b.amount} ${
        b.currency
      }  bidder=${id(b.bidderId)}  email=${b.bidderEmail || "(none)"}${flag}`
    );
    if (!b.bidderEmail && settlement && String(b._id) === String(settlement.bidId)) {
      problems.push("Winning bid has no bidderEmail — settlement needs one");
    }
  }

  // ── 3. Escrow ───────────────────────────────────────────────────────
  section("3. Escrow (auctionescrows)");
  const escrows = productId
    ? await AuctionEscrow.find({ productId }).lean()
    : [];
  if (escrows.length === 0) {
    console.log("  none — no bidder ever had funds locked on this auction");
    problems.push("No escrow rows: the bid path never locked money");
  }
  for (const e of escrows as any[]) {
    console.log(
      `  user=${id(e.userId)}  ${String(e.status).padEnd(9)} locked=${money(
        e.lockedUsd
      )}  bid=${e.bidAmount} ${e.bidCurrency} @${e.exchangeRate}`
    );
  }

  // ── 4. Settlement ───────────────────────────────────────────────────
  section("4. Settlement (auctionsettlements)  ← the usual answer");
  if (!settlement) {
    console.log("  MISSING — the store backend never queued this win.");
    console.log(
      "  Look at garage-store-backend logs for '[auctionResolution] failed for'."
    );
    problems.push(
      "No AuctionSettlement row — the win was never queued (store-side resolution aborted)"
    );
  } else {
    console.log(`  status            ${settlement.status}`);
    console.log(`  attempts          ${settlement.attempts}`);
    console.log(`  lastError         ${settlement.lastError || "(none)"}`);
    console.log(`  amountUsd         ${money(settlement.amountUsd)}`);
    console.log(
      `  bid               ${settlement.bidAmount} ${settlement.bidCurrency} @${settlement.exchangeRate}`
    );
    console.log(`  winnerUserId      ${id(settlement.winnerUserId)}`);
    console.log(`  winnerEmail       ${settlement.winnerEmail || "(none)"}`);
    console.log(`  invoiceId         ${id(settlement.invoiceId)}`);
    console.log(`  productOrderId    ${id(settlement.productOrderId)}`);
    console.log(`  needsAddress      ${yn(settlement.needsAddress)}`);
    if (settlement.status === "failed") {
      problems.push(
        `Settlement FAILED: ${settlement.lastError} (nothing retries a failed row today)`
      );
    }
    if (settlement.status === "pending" && settlement.attempts > 0) {
      problems.push(
        `Settlement retrying: ${settlement.lastError} (attempt ${settlement.attempts})`
      );
    }
  }

  const paymentRef = settlement ? `auction_${String(settlement.bidId)}` : null;

  // ── 5. Seller resolution ────────────────────────────────────────────
  section("5. Seller resolution (who should get paid)");
  let founderId: string | null = null;
  if (product?.orgId) {
    const modern: any = await User.findOne({
      "organizations.organization": new Types.ObjectId(String(product.orgId)),
      "organizations.role": "founder",
    })
      .select("_id email name")
      .sort({ "organizations.joinedAt": 1 })
      .lean();
    const legacy: any = await User.findOne({
      organization: new Types.ObjectId(String(product.orgId)),
      role: "founder",
    })
      .select("_id email name")
      .lean();

    console.log(
      `  organizations[] founder   ${
        modern ? `${id(modern._id)} (${modern.email})` : "NONE  ← this is what the code looks for"
      }`
    );
    console.log(
      `  legacy organization field ${
        legacy ? `${id(legacy._id)} (${legacy.email})` : "none"
      }`
    );
    founderId = modern?._id ? String(modern._id) : legacy?._id ? String(legacy._id) : null;
    if (!modern) {
      problems.push(
        legacy
          ? "Seller org has NO organizations[] founder (only the legacy field) → STORE_OWNER_MISSING"
          : "Seller org has no founder at all → STORE_OWNER_MISSING"
      );
    }
  }

  // ── 6. Invoice ──────────────────────────────────────────────────────
  section("6. Invoice");
  const invoice: any = paymentRef
    ? await Invoice.findOne({ razorpayPaymentId: paymentRef }).lean()
    : null;
  if (!invoice) {
    console.log(`  MISSING for razorpayPaymentId=${paymentRef}`);
  } else {
    console.log(`  _id               ${id(invoice._id)}  ${invoice.invoiceNumber}`);
    console.log(`  status            ${invoice.status}`);
    console.log(
      `  subtotal/tax/total ${invoice.subtotal} / ${invoice.tax} / ${invoice.totalAmount} ${invoice.itemCurrency} (minor units)`
    );
    console.log(`  sellerId          ${id(invoice.sellerId)}`);
    console.log(`  organizationId    ${id(invoice.organizationId)}`);
    console.log(
      `  line[0] totalPrice ${invoice.lineItems?.[0]?.totalPrice} · sellerId ${id(
        invoice.lineItems?.[0]?.sellerId
      )}`
    );
    console.log(
      `  fulfillment.orders ${
        invoice.metadata?.fulfillment?.orders
          ? JSON.stringify(invoice.metadata.fulfillment.orders)
          : "(not stamped)"
      }`
    );
    if (!invoice.lineItems?.[0]?.totalPrice) {
      problems.push(
        "Invoice line totalPrice is 0/absent → the commission loop silently skips it"
      );
    }
  }

  // ── 7. ProductOrder ─────────────────────────────────────────────────
  section("7. ProductOrder");
  const order: any = paymentRef
    ? await ProductOrder.findOne({ paymentId: paymentRef }).lean()
    : null;
  console.log(
    order
      ? `  ${id(order._id)}  ${order.orderNumber}  total=${order.total} ${order.currency}  flavor=${order.metadata?.flavor}`
      : "  MISSING"
  );

  // ── 8. Commission ───────────────────────────────────────────────────
  section("8. CommissionDistribution  ← where the seller credit lives");
  const cds = paymentRef
    ? await CommissionDistribution.find({
        paymentId: { $regex: `^${paymentRef.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}` },
      }).lean()
    : [];
  if (cds.length === 0) {
    console.log("  none — distributeCommissions never completed for this sale");
    if (invoice) {
      problems.push(
        "Invoice exists but NO CommissionDistribution → the per-line commission threw and was swallowed"
      );
    }
  }
  for (const c of cds as any[]) {
    console.log(
      `  ${id(c._id)}  ${String(c.status).padEnd(10)} sale=${money(
        c.saleAmount
      )} fee=${money(c.platformFeeAmount)} seller=${money(c.sellerAmount)}`
    );
    console.log(`     paymentId     ${c.paymentId}`);
    if (c.failureReason) console.log(`     failureReason ${c.failureReason}`);
    if (c.status === "failed") {
      problems.push(
        `Commission row is FAILED (${c.failureReason}) — and its key now blocks every retry`
      );
    }
  }

  // ── 9. Wallets ──────────────────────────────────────────────────────
  section("9. Seller StoreWallet");
  let sellerCredited = 0;
  if (founderId && product?.orgId) {
    const w: any = await StoreWallet.findOne({
      userId: new Types.ObjectId(founderId),
      orgId: new Types.ObjectId(String(product.orgId)),
    }).lean();
    console.log(
      w
        ? `  balance ${money(w.balance)}  (userId=${founderId} orgId=${id(product.orgId)})`
        : "  no wallet document for the founder + this org"
    );
    const rows = cds.length
      ? await WalletTransaction.find({
          "metadata.distributionId": { $in: cds.map((c: any) => c._id) },
        }).lean()
      : [];
    if (rows.length === 0) console.log("  no WalletTransaction rows for this sale");
    for (const r of rows as any[]) {
      console.log(
        `    ${String(r.type).padEnd(7)} ${money(r.amount)}  ${r.description}`
      );
      if (r.type === "credit" && r.metadata?.saleGross) sellerCredited += r.amount;
    }
  } else {
    console.log("  skipped — no founder resolved");
  }

  section("10. Platform escrow StoreWallet");
  const platformUser: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  let escrowIn = 0;
  let escrowOut = 0;
  if (!platformUser) {
    console.log(`  MISSING USER ${PLATFORM_USER_EMAIL} — every distribution throws`);
    problems.push(`Platform user ${PLATFORM_USER_EMAIL} does not exist`);
  } else {
    const pw: any = await StoreWallet.findOne({
      userId: platformUser._id,
      orgId: new Types.ObjectId(PLATFORM_ORG_ID),
    }).lean();
    console.log(`  balance ${money(pw?.balance)}`);
    if (settlement) {
      const rows = await WalletTransaction.find({
        "metadata.bidId": settlement.bidId,
      }).lean();
      for (const r of rows as any[]) {
        console.log(
          `    ${String(r.type).padEnd(7)} ${money(r.amount)}  ${r.metadata?.kind}  ${r.description}`
        );
        if (r.metadata?.kind === "auction_escrow") escrowIn += r.amount;
        if (
          r.metadata?.kind === "auction_escrow_release" ||
          r.metadata?.kind === "auction_escrow_refund"
        )
          escrowOut += r.amount;
      }
      if (rows.length === 0) console.log("    no escrow rows for this bid");
    }
  }

  section("11. Buyer AuctionWallet");
  if (settlement?.winnerUserId) {
    const aw: any = await AuctionWallet.findOne({
      userId: settlement.winnerUserId,
    }).lean();
    console.log(
      aw
        ? `  balance ${money(aw.balance)}  locked ${money(aw.lockedBalance)}  spent ${money(aw.totalSpent)}`
        : "  no auction wallet"
    );
    const rows = await AuctionWalletTransaction.find({
      bidId: settlement.bidId,
    }).lean();
    for (const r of rows as any[]) {
      console.log(
        `    ${String(r.type).padEnd(11)} ${money(r.amount)}  bal ${money(
          r.balanceBefore
        )}→${money(r.balanceAfter)}  locked ${money(r.lockedBefore)}→${money(r.lockedAfter)}`
      );
    }
  }

  // ── Reconciliation ──────────────────────────────────────────────────
  section("MONEY RECONCILIATION (winning bid)");
  console.log(`  escrowed in        ${money(escrowIn)}`);
  console.log(`  escrow released    ${money(escrowOut)}`);
  console.log(`  seller credited    ${money(sellerCredited)}`);
  if (settlement) {
    if (escrowIn > 0 && escrowOut === 0) {
      console.log("  → money is STILL HELD in the platform escrow wallet");
    }
    if (escrowOut > 0 && sellerCredited === 0) {
      console.log(
        "  → escrow was released but the seller was NEVER credited (money absorbed by the platform wallet)"
      );
      problems.push(
        "Escrow released without a seller credit — platform wallet is holding the seller's money"
      );
    }
  }

  // ── Verdict ─────────────────────────────────────────────────────────
  head("VERDICT");
  if (problems.length === 0) {
    console.log("  No problem detected — the chain looks complete.");
    console.log(
      "  If the seller still reports nothing, confirm WHICH wallet they checked:"
    );
    console.log(
      `  the money is in StoreWallet{ userId: ${founderId || "<founder>"}, orgId: ${id(
        product?.orgId
      )} }`
    );
    console.log(
      "  and /wallet/store/balance returns the CALLER's wallet, not the founder's."
    );
  } else {
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
  }
  console.log("");
}

async function run() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected (read-only diagnostic — nothing will be written)");

  const productId = arg("product");
  const bidId = arg("bid");
  const settlementId = arg("settlement");

  if (process.argv.includes("--recent")) {
    const rows = await AuctionSettlement.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    head(`RECENT SETTLEMENTS (${rows.length})`);
    for (const r of rows as any[]) {
      console.log(
        `  ${id(r._id)}  ${String(r.status).padEnd(8)} attempts=${r.attempts}  ${money(
          r.amountUsd
        )}  product=${id(r.productId)}  ${r.lastError || ""}`
      );
    }
    console.log("\nRe-run with --settlement <id> for the full chain.\n");
    return;
  }

  if (!productId && !bidId && !settlementId) {
    console.log(
      "\nUsage: --product <id> | --bid <id> | --settlement <id> | --recent\n"
    );
    return;
  }

  await diagnoseOne({ productId, bidId, settlementId });
}

run()
  .catch((err) => {
    console.error("DIAGNOSTIC FAILED:", err);
    process.exit(1);
  })
  .finally(() => mongoose.disconnect());
