import "dotenv/config";
import mongoose from "mongoose";
import { env } from "../config/env";
import { WalletTransaction } from "../models/walletTransaction.model";
import { User } from "../models/user.model";

async function run() {
  const [invoiceId] = process.argv.slice(2);
  if (!invoiceId) {
    console.error("Usage: npx tsx src/scripts/inspect-whitelabel-txs.ts <invoiceId>");
    process.exit(1);
  }

  await mongoose.connect(env.MONGODB_URI);

  const txs: any[] = await WalletTransaction.find({
    "metadata.dedupeKey": { $regex: new RegExp(`^whitelabel_.*${invoiceId}`) },
  })
    .sort({ createdAt: 1 })
    .lean();

  console.log(`\nFound ${txs.length} whitelabel_* tx for invoice ${invoiceId}:\n`);

  const userIds = [...new Set(txs.map((t) => String(t.userId)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("_id email name")
    .lean<any[]>();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  for (const t of txs) {
    const u = byId.get(String(t.userId));
    console.log(
      `  ${t.createdAt.toISOString()}  ${u?.email || t.userId}  ${t.walletType} ${t.type} $${t.amount}  kind=${t.metadata?.kind}  dedupeKey=${t.metadata?.dedupeKey}`,
    );
  }

  await mongoose.disconnect();
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
