import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Organization } from "../models/organization.model";
void Organization; // ensure model is registered before populate

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const emails = ["shorupan@gmail.com", "shorupanmedia@gmail.com", "shorupan@garage.app", "shorupanventures@gmail.com"];
  for (const email of emails) {
    const user: any = await User.findOne({ email }).select("_id email name").lean();
    if (!user) {
      console.log(`\n──────────── ${email} — NOT FOUND ────────────`);
      continue;
    }
    console.log(`\n════════════════════════════════════════════════════════════`);
    console.log(`  ${email}  (${user._id})`);
    console.log(`════════════════════════════════════════════════════════════`);

    // All wallets
    const wallets: any[] = await StoreWallet.find({ userId: user._id })
      .populate("orgId", "name officeCreatedFromCryptobrand")
      .select("currency balance orgId isActive parentWalletId createdAt")
      .lean();
    if (wallets.length === 0) {
      console.log("  (no store wallets)");
      continue;
    }

    // Group by org
    const byOrg: Record<string, any[]> = {};
    for (const w of wallets) {
      const org = w.orgId as any;
      const key = org?._id ? `${org.name || "?"} [${org._id}]${org.officeCreatedFromCryptobrand ? " (cryptobrand)" : ""}` : "(null org)";
      if (!byOrg[key]) byOrg[key] = [];
      byOrg[key].push(w);
    }

    for (const [orgLabel, ws] of Object.entries(byOrg)) {
      const totalCurrencies = ws.length;
      const currencies = ws.map(w => `${w.currency}=${w.balance}`).join("  ");
      if (totalCurrencies > 1 || ws.some(w => Number(w.balance) > 0)) {
        console.log(`\n  ${orgLabel}`);
        console.log(`    ${currencies}`);
      }
    }

    // Recent BTC transactions (top 10)
    const btcWallets = wallets.filter(w => w.currency === "BTC");
    if (btcWallets.length > 0 && btcWallets.some(w => Number(w.balance) > 0)) {
      console.log(`\n  ── Recent BTC transactions ──`);
      const btcIds = btcWallets.map(w => w._id);
      const txs: any[] = await WalletTransaction.find({ storeWalletId: { $in: btcIds } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      for (const t of txs) {
        console.log(`    ${t.createdAt.toISOString()}  ${t.type.padEnd(6)} ${String(t.amount).padStart(15)} ${t.currency}  "${t.description}"  kind=${t.metadata?.kind || "-"}`);
      }
    }

    // Any USD transaction >= 1000 in the last 3 days
    const usdWallets = wallets.filter(w => w.currency === "USD");
    if (usdWallets.length > 0) {
      const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const bigUsd: any[] = await WalletTransaction.find({
        storeWalletId: { $in: usdWallets.map(w => w._id) },
        createdAt: { $gte: cutoff },
        amount: { $gte: 1000 },
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
      if (bigUsd.length > 0) {
        console.log(`\n  ── Large USD txs (last 3 days) ──`);
        for (const t of bigUsd) {
          console.log(`    ${t.createdAt.toISOString()}  ${t.type.padEnd(6)} ${String(t.amount).padStart(15)} ${t.currency}  "${t.description}"  kind=${t.metadata?.kind || "-"}`);
        }
      }
    }
  }

  // ── Also scan ALL wallet transactions from the last 24h with amount > 10000 (suspicious) ──
  console.log(`\n\n════════════════════════════════════════════════════════════`);
  console.log(`  Platform-wide: WalletTransactions > 10,000 amount in last 24h`);
  console.log(`════════════════════════════════════════════════════════════`);
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const big: any[] = await WalletTransaction.find({
    createdAt: { $gte: cutoff },
    amount: { $gte: 10000 },
  })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  for (const t of big) {
    const u: any = await User.findById(t.userId).select("email").lean();
    console.log(`  ${t.createdAt.toISOString()}  ${t.type.padEnd(6)} ${String(t.amount).padStart(15)} ${t.currency.padEnd(4)}  user=${u?.email || t.userId}  kind=${t.metadata?.kind || "-"}  desc="${t.description}"`);
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
