/**
 * Delete yopmail test users + their owned data, EXCEPT the 21
 * addresses in the KEEP list.
 *
 * Two modes:
 *   --dry-run  (default) → counts every affected doc, writes nothing
 *   --commit           → actually deletes
 *
 * Scope per deleted user:
 *   1. User doc itself
 *   2. StoreWallet + AffiliateWallet by userId
 *   3. WalletTransaction rows where userId matches
 *   4. Invoice where userId (buyer) matches
 *   5. OfficeSubscription where founderId matches
 *   6. OfficeAddonSubscription where founderId matches
 *
 * DELIBERATELY OUT OF SCOPE (would need a separate script if wanted):
 *   • Organization docs — deleting an org would orphan any OTHER
 *     members who joined that org. Leave org rows alone; the deleted
 *     users' User.organizations[] embedded memberships die with the
 *     User doc.
 *   • CommissionDistribution — audit trail, kept.
 *   • CryptoPaymentRequest — self-expiring / harmless.
 *   • OrgRewardsWallet / NcWallet — not in scope.
 *
 * Usage:
 *   npx tsx src/scripts/delete-yopmail-users.ts             # dry run
 *   npx tsx src/scripts/delete-yopmail-users.ts --commit    # actual delete
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { AffiliateWallet } from "../models/affiliateWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Invoice } from "../models/invoice.model";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";

const KEEP_EMAILS = new Set(
  [
    "mipehixeitrau-5570@yopmail.com",
    "wefrivauprouffoi-7516@yopmail.com",
    "tenaupredipei-1504@yopmail.com",
    "zoicrodoijulou-1160@yopmail.com",
    "wessurattougo-7663@yopmail.com",
    "rolligajine-2930@yopmail.com",
    "gaduffuwecre-7679@yopmail.com",
    "naufratragevo-1118@yopmail.com",
    "shorupanmedia@gmail.com",
    "legallyapp123@gmail.com",
    "fretteutegrouli-9688@yopmail.com",
    "yabrozicafa-6650@yopmail.com",
    "decusemmeddi-8756@yopmail.com",
    "cromenojoire-8247@yopmail.com",
    "katraussougroro-9642@yopmail.com",
    "creprafalloni-3942@yopmail.com",
    "xilleittitrauju-1132@yopmail.com",
    "tinnessaheigre-1010@yopmail.com",
    "cebouyigroddoi-4671@yopmail.com",
    "bakummemauffou-6268@yopmail.com",
    "quelloiddudibeu-8659@yopmail.com",
    "shorupan@gmail.com",
    "stevenjobsmp@gmail.com",
  ].map((e) => e.trim().toLowerCase()),
);

async function run() {
  const commit = process.argv.includes("--commit");
  const mode = commit ? "COMMIT (destructive)" : "DRY RUN (no writes)";
  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to ${mongoose.connection.name}`);
  console.log(`Mode: ${mode}\n`);

  // ── 1. Gather target user ids. ──────────────────────────────────────
  const yopmail = await User.find({
    email: { $regex: /@yopmail\.com$/i },
  })
    .select("_id email")
    .lean();

  const targets = yopmail.filter(
    (u) => !KEEP_EMAILS.has((u.email || "").toLowerCase()),
  );
  const targetIds = targets.map((u) => u._id) as any as Types.ObjectId[];

  console.log(
    `Yopmail users total: ${yopmail.length}  |  kept: ${yopmail.length - targets.length}  |  targeting for delete: ${targets.length}\n`,
  );

  if (targets.length === 0) {
    console.log("Nothing to delete. Exiting.");
    await mongoose.disconnect();
    return;
  }

  // Snapshot the target list so a re-run can be reconciled against it.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = `/tmp/yopmail-delete-targets-${stamp}.txt`;
  const fs = await import("fs");
  fs.writeFileSync(
    outFile,
    targets.map((u) => `${u._id}  ${u.email}`).join("\n"),
    "utf8",
  );
  console.log(`Target list snapshotted → ${outFile}\n`);

  // ── 2. Count what's connected. Same query shapes we'd use to delete. ─
  const [
    walletTxCount,
    storeWalletCount,
    affiliateWalletCount,
    invoiceCount,
    officeSubCount,
    officeAddonSubCount,
  ] = await Promise.all([
    WalletTransaction.countDocuments({ userId: { $in: targetIds } }),
    StoreWallet.countDocuments({ userId: { $in: targetIds } }),
    AffiliateWallet.countDocuments({ userId: { $in: targetIds } }),
    Invoice.countDocuments({ userId: { $in: targetIds } }),
    OfficeSubscription.countDocuments({ founderId: { $in: targetIds } }),
    OfficeAddonSubscription.countDocuments({
      founderId: { $in: targetIds },
    }),
  ]);

  console.log("Docs that will be removed if you --commit:");
  console.log(`  Users                    : ${targets.length}`);
  console.log(`  StoreWallet              : ${storeWalletCount}`);
  console.log(`  AffiliateWallet          : ${affiliateWalletCount}`);
  console.log(`  WalletTransaction        : ${walletTxCount}`);
  console.log(`  Invoice (buyer)          : ${invoiceCount}`);
  console.log(`  OfficeSubscription       : ${officeSubCount}`);
  console.log(`  OfficeAddonSubscription  : ${officeAddonSubCount}`);

  if (!commit) {
    console.log(
      `\n🟡 DRY RUN — no writes. Re-run with --commit to actually delete.`,
    );
    await mongoose.disconnect();
    return;
  }

  // ── 3. COMMIT PATH — delete in dependency-safe order. ───────────────
  console.log(`\n🔴 COMMITTING deletes. This is IRREVERSIBLE.`);

  const wt = await WalletTransaction.deleteMany({
    userId: { $in: targetIds },
  });
  console.log(`  WalletTransaction removed: ${wt.deletedCount}`);

  const sw = await StoreWallet.deleteMany({ userId: { $in: targetIds } });
  console.log(`  StoreWallet removed      : ${sw.deletedCount}`);

  const aw = await AffiliateWallet.deleteMany({
    userId: { $in: targetIds },
  });
  console.log(`  AffiliateWallet removed  : ${aw.deletedCount}`);

  const inv = await Invoice.deleteMany({ userId: { $in: targetIds } });
  console.log(`  Invoice removed          : ${inv.deletedCount}`);

  const os = await OfficeSubscription.deleteMany({
    founderId: { $in: targetIds },
  });
  console.log(`  OfficeSubscription removed: ${os.deletedCount}`);

  const oas = await OfficeAddonSubscription.deleteMany({
    founderId: { $in: targetIds },
  });
  console.log(`  OfficeAddonSubscription removed: ${oas.deletedCount}`);

  const u = await User.deleteMany({ _id: { $in: targetIds } });
  console.log(`  User removed             : ${u.deletedCount}`);

  console.log(`\n✅ Done.`);
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
