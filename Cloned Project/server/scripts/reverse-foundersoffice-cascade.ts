/**
 * ONE-OFF: Reverse the commission paid on the FOUNDERSOFFICE cascade.
 *
 * WHAT HAPPENED
 *   On 2026-09-01 a single Office Pro subscription (org 6a0207e0e7ce4252ed4b1d17,
 *   buyer techworldsdata@gmail.com) burned 12 billing cycles in 3 seconds.
 *   FOUNDERSOFFICE is 100%-off with cycleCount 12; every cycle invoiced $0, a
 *   $0 invoice is marked `paid` instantly with no gateway, and paying a
 *   recurring child mints the next cycle — a self-feeding loop that ran until
 *   the coupon's 12 cycles were exhausted.
 *
 *   Each cycle fired the Office Pro commission, because
 *   services/officeProInvoiceCommission.ts reads `invoice.subtotal` (the LIST
 *   price, 9600) and never `totalAmount` (what was COLLECTED, 0):
 *
 *       const baseUsd       = (invoice.subtotal || 0) / 100;  // 96
 *       const upSaleUsd     = 24;   // hardcoded
 *       const directFlatUsd = 24;   // hardcoded
 *
 *   That is the only commission path in the codebase that does this. Comb plan
 *   fired 125 times on 100%-off invoices and computed $0 every time.
 *
 * WHAT THIS REVERSES  (~$878.06 across 43 credits)
 *   1. office_pro_direct         12 × $24 → punithrajsamba@gmail.com   $288.00
 *   2. office_pro_platform_share 12 × $48 → platform user              $576.00
 *   3. the ONE completed unilevel_plus distribution, all recipients    $ 14.06
 *
 * WHAT THIS DELIBERATELY DOES **NOT** TOUCH
 *   The 11 unilevel distributions that died on a Mongo write conflict and are
 *   status "failed". They never paid anybody. They must NOT be replayed
 *   either — that money was never owed, because the invoices were free.
 *
 * MECHANISM
 *   Append-only, mirroring services/uplineCommissionMove.ts:309-375. The
 *   original credit is never deleted or mutated; we write a new debit
 *   WalletTransaction carrying `metadata.reversalOf`. `totalEarnings` is
 *   deflated alongside `balance`, or the recipient permanently overstates
 *   lifetime earnings. One Mongo session per wallet, so a mid-run failure
 *   can't debit a wallet without leaving a ledger row.
 *
 * IDEMPOTENT
 *   Any credit that already has a reversal pointing at it is skipped. Safe to
 *   re-run; a second run should report "0 to reverse".
 *
 * UNDERWATER SAFETY
 *   By default the batch ABORTS if any wallet would go negative — nothing is
 *   applied. --allow-negative overrides (dangerous).
 *
 * Usage:
 *   Dry run (default):  npx tsx src/scripts/reverse-foundersoffice-cascade.ts
 *   Apply:              npx tsx src/scripts/reverse-foundersoffice-cascade.ts --apply
 */
import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const APPLY = process.argv.includes("--apply");
const ALLOW_NEGATIVE = process.argv.includes("--allow-negative");

/**
 * The cascade root. Everything is derived from this rather than a hardcoded
 * list of transaction ids, so the target set is re-derivable and auditable.
 */
const PARENT_INVOICE_ID = "6a96b1da6b7f1dd3c712dc1c";

const REASON = "comped_invoice_100pct_off";

const round2 = (n: number) => Math.round(n * 100) / 100;

interface Target {
  txnId: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  amount: number;
  currency: string;
  description: string;
  kind: string;
  walletId: Types.ObjectId;
  walletType: "affiliate" | "store";
  orgId?: Types.ObjectId;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;

  console.log(
    `\nFOUNDERSOFFICE cascade reversal — ${APPLY ? "APPLY" : "DRY RUN"}` +
      `${ALLOW_NEGATIVE ? " (allow-negative)" : ""}\n` + "=".repeat(78)
  );

  // ── Resolve the cascade: parent + every child ──────────────────────────
  const parentId = new Types.ObjectId(PARENT_INVOICE_ID);
  const invoices = await db
    .collection("invoices")
    .find({ $or: [{ _id: parentId }, { parentInvoiceId: parentId }], status: "paid" })
    .project({ _id: 1, invoiceNumber: 1, subtotal: 1, totalAmount: 1, couponCode: 1 })
    .toArray();

  const invoiceIds = invoices.map((i: any) => String(i._id));
  console.log(`Cascade invoices (paid): ${invoices.length}`);

  // Guard: every one of these MUST be a $0 invoice. If a genuinely-paid
  // invoice ever entered this set, reversing it would rob a real earner.
  const nonZero = invoices.filter((i: any) => (i.totalAmount || 0) !== 0);
  if (nonZero.length) {
    console.error(
      `\nABORT: ${nonZero.length} invoice(s) in the cascade collected money ` +
        `(${nonZero.map((i: any) => i.invoiceNumber).join(", ")}). ` +
        `This script only reverses commission on $0 invoices.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`All ${invoices.length} collected $0. Nominal value: $${
    invoices.reduce((s: number, i: any) => s + (i.subtotal || 0), 0) / 100
  }\n`);

  // ── Collect credits: (a) office_pro_* tagged with these invoiceIds ─────
  const credits = await db
    .collection("wallettransactions")
    .find({ "metadata.invoiceId": { $in: invoiceIds }, type: { $ne: "debit" } })
    .toArray();

  // ── (b) the completed unilevel_plus distribution(s) for these invoices ─
  // Their wallet transactions carry `metadata.distributionId`, NOT invoiceId,
  // so they are not caught by the query above.
  const dists = await db
    .collection("unilevelplusdistributions")
    .find({ "metadata.invoiceId": { $in: invoiceIds }, status: "completed" })
    .toArray();

  const distIds = dists.map((d: any) => String(d._id));
  // NOTE: `metadata.distributionId` is stored as an **ObjectId**, whereas
  // `metadata.invoiceId` above is stored as a **string**. Querying this one
  // with strings silently matches zero rows — which would leave the entire
  // unilevel leg un-reversed with no error.
  const distCredits = dists.length
    ? await db
        .collection("wallettransactions")
        .find({
          "metadata.distributionId": { $in: dists.map((d: any) => d._id) },
          type: { $ne: "debit" },
        })
        .toArray()
    : [];

  console.log(
    `Completed unilevel distributions: ${dists.length}` +
      ` (${distIds.join(", ") || "none"})`
  );
  const failedCount = await db.collection("unilevelplusdistributions").countDocuments({
    "metadata.invoiceId": { $in: invoiceIds },
    status: "failed",
  });
  console.log(
    `Failed unilevel distributions:    ${failedCount} — left untouched on purpose ` +
      `(never paid anyone, never owed)\n`
  );

  const all = [...credits, ...distCredits];

  // ── Idempotency: drop anything already reversed ───────────────────────
  const existingReversals = await db
    .collection("wallettransactions")
    .find({ "metadata.reversalOf": { $in: all.map((t: any) => t._id) } })
    .project({ "metadata.reversalOf": 1 })
    .toArray();
  const already = new Set(existingReversals.map((r: any) => String(r.metadata.reversalOf)));
  const pending = all.filter((t: any) => !already.has(String(t._id)));

  if (already.size) {
    console.log(`Already reversed (skipping): ${already.size}`);
  }
  if (!pending.length) {
    console.log("\n0 to reverse — nothing to do.\n");
    await mongoose.disconnect();
    return;
  }

  // ── Resolve wallets + emails ───────────────────────────────────────────
  const userIds = [...new Set(pending.map((t: any) => String(t.userId)))].map(
    (u) => new Types.ObjectId(u)
  );
  const users = await db
    .collection("users")
    .find({ _id: { $in: userIds } })
    .project({ email: 1 })
    .toArray();
  const emailOf = new Map(users.map((u: any) => [String(u._id), u.email]));

  const targets: Target[] = [];
  for (const t of pending as any[]) {
    const walletId = t.affiliateWalletId || t.storeWalletId;
    if (!walletId) {
      console.error(`  !! txn ${t._id} has no wallet id — skipping`);
      continue;
    }
    targets.push({
      txnId: t._id,
      userId: t.userId,
      email: emailOf.get(String(t.userId)) || String(t.userId),
      amount: t.amount,
      currency: t.currency || "USD",
      description: t.description,
      kind: t.metadata?.kind || t.metadata?.bonusType || "unilevel_plus",
      walletId,
      walletType: t.affiliateWalletId ? "affiliate" : "store",
      orgId: t.orgId,
    });
  }

  // ── Report ─────────────────────────────────────────────────────────────
  const byUser = new Map<string, { n: number; usd: number; kinds: Set<string> }>();
  for (const t of targets) {
    if (!byUser.has(t.email)) byUser.set(t.email, { n: 0, usd: 0, kinds: new Set() });
    const e = byUser.get(t.email)!;
    e.n++;
    e.usd = round2(e.usd + t.amount);
    e.kinds.add(t.kind);
  }

  console.log("Recipient                             txns      amount  kinds");
  console.log("-".repeat(78));
  let total = 0;
  for (const [email, e] of [...byUser.entries()].sort((a, b) => b[1].usd - a[1].usd)) {
    total = round2(total + e.usd);
    console.log(
      `${email.padEnd(36)} ${String(e.n).padStart(5)}  ${("$" + e.usd).padStart(10)}  ${[...e.kinds].join(",")}`
    );
  }
  console.log("-".repeat(78));
  console.log(`${"TOTAL".padEnd(36)} ${String(targets.length).padStart(5)}  ${("$" + total).padStart(10)}\n`);

  // ── Underwater check (before any write) ────────────────────────────────
  const perWallet = new Map<string, { need: number; type: "affiliate" | "store" }>();
  for (const t of targets) {
    const k = String(t.walletId);
    if (!perWallet.has(k)) perWallet.set(k, { need: 0, type: t.walletType });
    perWallet.get(k)!.need = round2(perWallet.get(k)!.need + t.amount);
  }

  console.log("Wallet balance check");
  console.log("-".repeat(78));
  let underwater = false;
  for (const [wid, info] of perWallet) {
    const col = info.type === "affiliate" ? "affiliatewallets" : "storewallets";
    const w: any = await db.collection(col).findOne({ _id: new Types.ObjectId(wid) });
    const before = w?.balance ?? 0;
    const after = round2(before - info.need);
    const bad = after < 0;
    if (bad) underwater = true;
    console.log(
      `  ${info.type.padEnd(10)} ${wid}  $${String(before).padStart(9)} -> $${String(after).padStart(9)}${bad ? "   << NEGATIVE" : ""}`
    );
  }
  console.log();

  if (underwater && !ALLOW_NEGATIVE) {
    console.error(
      "ABORT: at least one wallet would go negative. Nothing was applied.\n" +
        "Re-run with --allow-negative to force (dangerous).\n"
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply to execute.\n");
    await mongoose.disconnect();
    return;
  }

  // ── Apply ──────────────────────────────────────────────────────────────
  const AffiliateWallet = db.collection("affiliatewallets");
  const StoreWallet = db.collection("storewallets");
  const WalletTransaction = db.collection("wallettransactions");

  let done = 0;
  let reversedUsd = 0;

  for (const t of targets) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const col = t.walletType === "affiliate" ? AffiliateWallet : StoreWallet;
        const w: any = await col.findOne({ _id: t.walletId }, { session });
        if (!w) throw new Error(`wallet ${t.walletId} not found`);

        const before = w.balance || 0;
        const after = round2(before - t.amount);

        const set: any = { balance: after, lastTransactionAt: new Date() };
        // The original credit inflated lifetime earnings; the reversal must
        // deflate it or the recipient permanently overstates what they kept.
        if (t.walletType === "affiliate") {
          set.totalEarnings = round2((w.totalEarnings || 0) - t.amount);
        }
        await col.updateOne({ _id: t.walletId }, { $set: set }, { session });

        await WalletTransaction.insertOne(
          {
            ...(t.walletType === "affiliate"
              ? { affiliateWalletId: t.walletId, walletType: "affiliate" }
              : { storeWalletId: t.walletId, walletType: "store", orgId: t.orgId }),
            userId: t.userId,
            type: "debit",
            amount: t.amount,
            currency: t.currency,
            balanceBefore: before,
            balanceAfter: after,
            description: `Reversal: ${t.description}`,
            note: "Commission reversed — invoice was 100% discounted, $0 collected",
            metadata: {
              reversalOf: t.txnId,
              reason: REASON,
              couponCode: "FOUNDERSOFFICE",
              parentInvoiceId: PARENT_INVOICE_ID,
              actor: "reverse-foundersoffice-cascade",
            },
            status: "completed",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          { session }
        );
      });
      done++;
      reversedUsd = round2(reversedUsd + t.amount);
      console.log(`  reversed  $${String(t.amount).padStart(7)}  ${t.email}  (${t.kind})`);
    } catch (err: any) {
      console.error(`  FAILED    $${String(t.amount).padStart(7)}  ${t.email}: ${err.message}`);
    } finally {
      await session.endSession();
    }
  }

  // ── Mark the distribution(s) reversed ─────────────────────────────────
  if (distIds.length) {
    await db.collection("unilevelplusdistributions").updateMany(
      { _id: { $in: distIds.map((d) => new Types.ObjectId(d)) } },
      {
        $set: {
          status: "reversed",
          "metadata.reversedAt": new Date(),
          "metadata.reversedBy": "reverse-foundersoffice-cascade",
          "metadata.reversalReason": REASON,
        },
      }
    );
    console.log(`\nMarked ${distIds.length} distribution(s) status=reversed`);
  }

  // ── Stamp the invoices so a re-fire is detectable in audit ────────────
  await db.collection("invoices").updateMany(
    { _id: { $in: invoices.map((i: any) => i._id) } },
    {
      $set: {
        "metadata.commissionReversedAt": new Date(),
        "metadata.commissionReversalReason": REASON,
      },
    }
  );
  console.log(`Stamped ${invoices.length} invoice(s) with commissionReversedAt`);

  console.log(
    `\n${"=".repeat(78)}\nReversed ${done}/${targets.length} credits, $${reversedUsd}\n`
  );

  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
