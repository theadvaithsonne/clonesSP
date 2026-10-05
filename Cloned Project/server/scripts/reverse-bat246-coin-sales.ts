// src/scripts/reverse-bat246-coin-sales.ts
//
// Reverse 11 BAT 246 board sales (16–24 Sep 2026) that were paid with B2
// COINS but booked as $650 USD sales.
//
// What went wrong: each invoice carries `metadata.paidWithB2Coins: true`, yet
// fulfilment credited the full $650 principal to Alan's BAT 246 store wallet
// and paid a platform fee (4% or 10%) to Shorupan. No currency ever entered
// the system. The coin ledger has no matching debit either — there are zero
// `bat246b2cointransactions` for any of these buyers — so only the USD leg was
// ever written.
//
// Verified before writing this: the money reached EXACTLY two wallets and
// nowhere else.
//   * every CommissionDistribution shows totalCommission = 0
//   * no territory / franchise payouts (0 rows in that ledger for 16–25 Sep)
//   * no AT BAT payouts, no board placements, no reservations, no movements
//   * nothing in content-rewards or NC wallets
// So there is no third party to claw back from, and nothing cascades.
//
//   Alan     (redbaron2020@mail.com · BAT 246)  +$6,708.00  → reversed
//   Shorupan (shorupan@gmail.com · Garage App)    +$442.00  → reversed
//                                               ----------
//                                                $7,150.00
//
// NOT IN SCOPE, deliberately:
//   * The separate $440 overstatement on Alan's wallet from a lost-update race
//     (three AT BAT debits logged but never taken). Different cause, different
//     fix, and rolling it in here would make this script's arithmetic
//     unverifiable against the sheet.
//   * The 7 buyers' player / distributor / b2coin-purchase records. Removing
//     those is a product decision, not an accounting one.
//   * 6 other BAT 246 sale credits on the same wallet that were NOT flagged.
//
// Balances are moved with an atomic `$inc`, never read-modify-write. That is
// not a style preference: the read-modify-write pattern used elsewhere in the
// BAT 246 code is exactly what silently lost three debits on this same wallet.
//
// Idempotent: every row written carries `metadata.reversalOf` = the id of the
// row it cancels, and the script refuses to write a second one.
//
//   npx tsx src/scripts/reverse-bat246-coin-sales.ts            # dry run
//   npx tsx src/scripts/reverse-bat246-coin-sales.ts --confirm  # execute

import "dotenv/config";
import mongoose from "mongoose";

const ALAN_WALLET_ID = "6a1568e3645e44195241ecd1";

/** The 11 sale instants, transcribed from the reviewed sheet. */
const SALE_INSTANTS = [
  "2026-09-24T13:00:38.597Z",
  "2026-09-24T12:27:31.716Z",
  "2026-09-24T10:50:32.002Z",
  "2026-09-24T10:42:31.595Z",
  "2026-09-24T04:05:52.269Z",
  "2026-09-22T08:24:46.625Z",
  "2026-09-22T08:18:09.721Z",
  "2026-09-21T12:53:44.921Z",
  "2026-09-21T12:28:56.396Z",
  "2026-09-19T09:33:02.083Z",
  "2026-09-16T06:54:19.035Z",
];

/** Expected totals. The script aborts rather than move a different amount. */
const EXPECT_SALES = 7150.0;
const EXPECT_FEES = 442.0;

const REASON =
  "Reversal: BAT 246 board sale paid with B2 coins, booked as a USD sale in error";

const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const r2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const confirm = process.argv.includes("--confirm");
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const WT = db.collection("wallettransactions");
  const SW = db.collection("storewallets");

  const alanWid = new mongoose.Types.ObjectId(ALAN_WALLET_ID);
  const instants = SALE_INSTANTS.map((s) => new Date(s));

  // ── 1. Load the 11 sale credits ────────────────────────────────────────
  const sales = await WT.find({
    storeWalletId: alanWid,
    createdAt: { $in: instants },
    type: "credit",
    amount: 650,
  })
    .sort({ createdAt: 1 })
    .toArray();

  if (sales.length !== SALE_INSTANTS.length) {
    throw new Error(
      `Expected ${SALE_INSTANTS.length} sale rows, found ${sales.length}. Refusing to run.`
    );
  }

  // ── 2. Pair each with its platform-fee legs ────────────────────────────
  type Leg = { sale: any; alanFee: any | null; platFee: any | null };
  const legs: Leg[] = [];
  for (const sale of sales as any[]) {
    const distId = sale.metadata?.distributionId;
    if (!distId) throw new Error(`Sale ${sale._id} has no distributionId.`);
    const feeRows = await WT.find({
      "metadata.distributionId": distId,
      description: { $regex: "^Platform fee" },
    }).toArray();
    const alanFee =
      (feeRows as any[]).find((r) => String(r.storeWalletId) === ALAN_WALLET_ID) ?? null;
    const platFee =
      (feeRows as any[]).find((r) => String(r.storeWalletId) !== ALAN_WALLET_ID) ?? null;
    legs.push({ sale, alanFee, platFee });
  }

  const totalSales = r2(legs.reduce((s, l) => s + l.sale.amount, 0));
  const totalAlanFee = r2(legs.reduce((s, l) => s + (l.alanFee?.amount ?? 0), 0));
  const totalPlatFee = r2(legs.reduce((s, l) => s + (l.platFee?.amount ?? 0), 0));

  if (totalSales !== EXPECT_SALES || totalPlatFee !== EXPECT_FEES) {
    throw new Error(
      `Totals do not match the reviewed sheet (sales ${usd(totalSales)} vs ${usd(
        EXPECT_SALES
      )}, fees ${usd(totalPlatFee)} vs ${usd(EXPECT_FEES)}). Refusing to run.`
    );
  }
  if (totalAlanFee !== totalPlatFee) {
    throw new Error(
      `Fee legs disagree: Alan was debited ${usd(totalAlanFee)} but the platform received ${usd(
        totalPlatFee
      )}. Refusing to run.`
    );
  }

  // ── 3. Idempotency ─────────────────────────────────────────────────────
  const originalIds = legs.flatMap((l) =>
    [l.sale._id, l.alanFee?._id, l.platFee?._id].filter(Boolean)
  );
  const already = await WT.countDocuments({ "metadata.reversalOf": { $in: originalIds } });
  if (already > 0) {
    console.log(
      `${already} reversal row(s) already exist for these transactions. Nothing to do.`
    );
    await mongoose.disconnect();
    return;
  }

  // ── 4. Show the plan ───────────────────────────────────────────────────
  const alanWallet: any = await SW.findOne({ _id: alanWid });
  const platWid = legs.find((l) => l.platFee)?.platFee.storeWalletId;
  const platWallet: any = await SW.findOne({ _id: platWid });
  const alanDelta = r2(-totalSales + totalAlanFee); // -650 each, +fee back
  const platDelta = r2(-totalPlatFee);

  console.log(`\n${confirm ? "EXECUTING" : "DRY RUN"} — reversing ${legs.length} sales\n`);
  console.log("  date              buyer                            sale     fee    net back");
  for (const l of legs) {
    const u: any = l.sale.relatedUserId
      ? await db.collection("users").findOne({ _id: l.sale.relatedUserId }, { projection: { email: 1 } })
      : null;
    const fee = l.alanFee?.amount ?? 0;
    console.log(
      `  ${l.sale.createdAt.toISOString().slice(0, 16)}  ${String(u?.email ?? "(deleted user)").padEnd(30)} ` +
        `${usd(l.sale.amount).padStart(8)} ${usd(fee).padStart(7)} ${usd(r2(l.sale.amount - fee)).padStart(10)}`
    );
  }
  console.log(
    `\n  ALAN      ${usd(alanWallet.balance).padStart(12)}  ${usd(alanDelta).padStart(11)}  ->  ${usd(
      r2(alanWallet.balance + alanDelta)
    ).padStart(12)}`
  );
  console.log(
    `  SHORUPAN  ${usd(platWallet.balance).padStart(12)}  ${usd(platDelta).padStart(11)}  ->  ${usd(
      r2(platWallet.balance + platDelta)
    ).padStart(12)}`
  );
  console.log(`\n  total removed: ${usd(r2(-alanDelta - platDelta))}`);

  if (r2(alanWallet.balance + alanDelta) < 0 || r2(platWallet.balance + platDelta) < 0) {
    throw new Error("A wallet would go negative. Refusing to run.");
  }
  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to write.");
    await mongoose.disconnect();
    return;
  }

  // ── 5. Execute ─────────────────────────────────────────────────────────
  //
  // Each balance moves with $inc inside a findOneAndUpdate so two concurrent
  // writers cannot overwrite one another — the failure mode that already cost
  // this wallet three debits. balanceBefore is derived from the value the
  // update returns, so the ledger chain stays honest even under concurrency.
  const writeLeg = async (
    walletId: any,
    userId: any,
    orgId: any,
    delta: number,
    description: string,
    original: any
  ) => {
    const updated: any = await SW.findOneAndUpdate(
      { _id: walletId },
      { $inc: { balance: delta }, $set: { lastTransactionAt: new Date() } },
      { returnDocument: "after" }
    );
    const after = r2(updated.balance);
    const before = r2(after - delta);
    await WT.insertOne({
      storeWalletId: walletId,
      walletType: "store",
      userId,
      orgId,
      type: delta < 0 ? "debit" : "credit",
      amount: Math.abs(delta),
      currency: "USD",
      balanceBefore: before,
      balanceAfter: after,
      description,
      note: REASON,
      relatedUserId: original.relatedUserId ?? undefined,
      metadata: {
        reversalOf: original._id,
        reversalReason: "b2coins_sale_booked_as_usd",
        originalDescription: original.description,
        originalCreatedAt: original.createdAt,
        distributionId: original.metadata?.distributionId,
      },
      status: "completed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { before, after };
  };

  let n = 0;
  for (const l of legs) {
    // a. take back the $650 principal
    await writeLeg(
      alanWid,
      l.sale.userId,
      l.sale.orgId,
      -l.sale.amount,
      `Reversal — ${l.sale.description}`,
      l.sale
    );
    n++;
    // b. give back the platform fee Alan was debited
    if (l.alanFee) {
      await writeLeg(
        alanWid,
        l.alanFee.userId,
        l.alanFee.orgId,
        l.alanFee.amount,
        `Reversal — ${l.alanFee.description}`,
        l.alanFee
      );
      n++;
    }
    // c. take the fee back off the platform
    if (l.platFee) {
      await writeLeg(
        l.platFee.storeWalletId,
        l.platFee.userId,
        l.platFee.orgId,
        -l.platFee.amount,
        `Reversal — ${l.platFee.description}`,
        l.platFee
      );
      n++;
    }
    // d. mark the distribution, so a later audit sees it without joining
    if (l.sale.metadata?.distributionId) {
      await db.collection("commissiondistributions").updateOne(
        { _id: l.sale.metadata.distributionId },
        { $set: { reversedAt: new Date(), reversalReason: "b2coins_sale_booked_as_usd" } }
      );
    }
  }

  const alanEnd: any = await SW.findOne({ _id: alanWid });
  const platEnd: any = await SW.findOne({ _id: platWid });
  console.log(`\nWrote ${n} reversal rows.`);
  console.log(`  ALAN     -> ${usd(alanEnd.balance)}`);
  console.log(`  SHORUPAN -> ${usd(platEnd.balance)}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("FAILED:", e?.message || e);
  process.exit(1);
});
