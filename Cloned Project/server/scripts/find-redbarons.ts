import "dotenv/config";
import mongoose from "mongoose";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { Organization } from "../models/organization.model";
void Organization;

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  // Case-insensitive substring match on email + name.
  const users = await User.find({
    $or: [
      { email: { $regex: /redbaron/i } },
      { name: { $regex: /red\s*baron/i } },
    ],
  })
    .select("_id email name createdAt")
    .sort({ createdAt: -1 })
    .lean();

  console.log(`\nFound ${users.length} matching user(s):\n`);
  for (const u of users as any[]) {
    console.log(`  ${String(u._id)}  ${u.email}  "${u.name}"  created=${u.createdAt?.toISOString?.() || "-"}`);

    // Wallet summary
    const wallets: any[] = await StoreWallet.find({ userId: u._id })
      .populate("orgId", "name")
      .select("currency balance orgId")
      .lean();
    const nonZero = wallets.filter((w) => Number(w.balance) > 0);
    if (nonZero.length > 0) {
      console.log(`    wallets w/ balance:`);
      for (const w of nonZero) {
        const org = w.orgId as any;
        console.log(`      ${w.currency}=${w.balance}  in ${org?.name || w.orgId}`);
      }
    } else {
      console.log(`    (all wallets are zero across ${wallets.length} org(s))`);
    }

    // Recent big txs (>= 1000)
    const walletIds = wallets.map((w) => w._id);
    const bigTxs: any[] = await WalletTransaction.find({
      storeWalletId: { $in: walletIds },
      amount: { $gte: 1000 },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();
    if (bigTxs.length > 0) {
      console.log(`    recent large txs:`);
      for (const t of bigTxs) {
        console.log(`      ${t.createdAt.toISOString()}  ${t.type.padEnd(8)} ${t.amount} ${t.currency}  "${t.description}"`);
      }
    }
    console.log();
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
