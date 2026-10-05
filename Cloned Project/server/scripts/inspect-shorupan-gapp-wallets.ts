import "dotenv/config";
import mongoose from "mongoose";
import { StoreWallet } from "../models/storeWallet.model";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";

const USER_EMAIL = "shorupan@gmail.com";
const ORG_ID_STR = "68f1fe05876fcc5fadb61951"; // Garage App

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const user: any = await User.findOne({ email: USER_EMAIL }).select("_id").lean();
  console.log(`\nUser: ${USER_EMAIL} → ${user?._id}`);
  console.log(`Org:  Garage App → ${ORG_ID_STR}\n`);

  // Direct raw fetch — bypass any pre('findOne') hook by using .find()
  const wallets: any[] = await StoreWallet.find({
    userId: user._id,
    orgId: ORG_ID_STR,
  })
    .select("_id currency balance isActive parentWalletId createdAt")
    .lean();

  console.log(`Found ${wallets.length} wallet doc(s):`);
  for (const w of wallets) {
    console.log(`  ${w.currency.padEnd(4)} balance=${String(w.balance).padStart(12)} active=${w.isActive} parent=${w.parentWalletId || "(root)"} created=${w.createdAt.toISOString()} _id=${w._id}`);
  }

  // For each wallet, sum the ledger and compare to stored balance.
  console.log(`\n── Ledger sums vs stored balance ──`);
  for (const w of wallets) {
    const txs: any[] = await WalletTransaction.find({ storeWalletId: w._id })
      .select("type amount currency balanceBefore balanceAfter description createdAt")
      .lean();
    let credit = 0, debit = 0, transferDelta = 0;
    const currencyCounts: Record<string, number> = {};
    for (const t of txs) {
      currencyCounts[t.currency] = (currencyCounts[t.currency] || 0) + 1;
      if (t.type === "credit") credit += t.amount;
      else if (t.type === "debit") debit += t.amount;
      else if (t.type === "transfer") {
        transferDelta += (t.balanceAfter || 0) - (t.balanceBefore || 0);
      }
    }
    const computed = credit - debit + transferDelta;
    const drift = Math.round((w.balance - computed) * 100) / 100;
    console.log(`  ${w.currency.padEnd(4)}: ${txs.length} txs (currencies: ${JSON.stringify(currencyCounts)})`);
    console.log(`         credit=${credit.toFixed(2)}  debit=${debit.toFixed(2)}  transferDelta=${transferDelta.toFixed(2)}  computed=${computed.toFixed(2)}  stored=${w.balance}  drift=${drift}`);

    if (w.currency === "BTC" && txs.length > 0) {
      console.log(`\n         Recent BTC-wallet txs:`);
      const recent = txs.slice(-10);
      for (const t of recent) {
        console.log(`           ${t.createdAt.toISOString()}  ${t.type.padEnd(8)} ${String(t.amount).padStart(12)} ${t.currency}  before=${t.balanceBefore} after=${t.balanceAfter}  "${t.description}"`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
