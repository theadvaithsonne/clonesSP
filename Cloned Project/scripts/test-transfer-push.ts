/**
 * scripts/test-transfer-push.ts
 *
 * Sends a TEST "transfer received" notification to a user's registered
 * devices — the push that services/wallet.ts fires after a peer store-wallet
 * transfer commits. No wallet or transaction is touched.
 *
 * Calls the REAL sender (services/pushNotification.ts::
 * sendTransferReceivedPushNotification), so it exercises the exact
 * production path: token lookup, whole-unit amount formatting, the
 * "earnings" channelId, and the transfer_received tap payload.
 *
 * Usage:
 *   npx tsx scripts/test-transfer-push.ts --user <email|userId>
 *   npx tsx scripts/test-transfer-push.ts --user me@x.com --amount 25 --from "Alex"
 *   npx tsx scripts/test-transfer-push.ts --user me@x.com --dest content_rewards
 *
 * Flags:
 *   --user <email|userId>   Recipient. Email is looked up; 24-hex is treated as _id.
 *   --amount <n>            WHOLE currency units (dollars). Default: 25.
 *   --currency <code>       Default: USD.
 *   --from <name>           Sender display name shown in the title. Default: "Test Sender".
 *   --dest store|content_rewards   Destination wallet flavor. Default: store.
 *   --description <string>  Notification body (sender's note). Default marks it as a test.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import { env } from "../server/config/env";
import { User } from "../server/models/user.model";
import { DeviceToken } from "../server/models/deviceToken.model";
import { sendTransferReceivedPushNotification } from "../server/services/pushNotification";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const userArg = getArg("user");
const amount = parseFloat(getArg("amount") || "25");
const currency = getArg("currency") || "USD";
const senderName = getArg("from") || "Test Sender";
const destination =
  getArg("dest") === "content_rewards" ? ("content_rewards" as const) : ("store" as const);
const description = getArg("description") || "TEST transfer notification — no money moved.";

async function run() {
  if (!userArg) {
    console.error(
      "\nUsage: npx tsx scripts/test-transfer-push.ts --user <email|userId> [--amount 25] [--from Alex] [--dest store|content_rewards]"
    );
    process.exit(1);
  }
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  const isObjectId = /^[a-f0-9]{24}$/i.test(userArg);
  const user = isObjectId
    ? await User.findById(userArg).select("name email").lean()
    : await User.findOne({ email: userArg.toLowerCase() }).select("name email").lean();

  if (!user) {
    console.error(`❌ No user found for "${userArg}"`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const uid = (user as any)._id.toString();
  console.log(
    `Target user: ${(user as any).name || "(no name)"} <${(user as any).email}>  id=${uid}`
  );

  const tokenCount = await DeviceToken.countDocuments({ userId: uid, isActive: true });
  console.log(`Active device tokens: ${tokenCount}`);
  if (tokenCount === 0) {
    console.log("⚠️  No active tokens — nothing to send to.");
    await mongoose.disconnect();
    return;
  }

  console.log(
    `\nSending transfer push: amount=${amount} ${currency} (whole units) from="${senderName}" dest=${destination}`
  );

  const result = await sendTransferReceivedPushNotification(uid, {
    amount,
    currency,
    senderName,
    description,
    destination,
    walletDeepLink: "/wallet",
  });

  console.log(`\nResult: sent=${result.sent} failed=${result.failed}`);
  for (const e of result.errors) console.log(`  ❌ ${e}`);
  if (result.sent > 0) {
    console.log(
      "\n✅ Accepted by Expo. On the device expect:\n" +
        `   title: "${senderName} sent you $${amount.toFixed(2)}"\n` +
        `   body:  "${description}"\n` +
        '   Android channel: "earnings" (PRIVATE on lock screen) · tap → /wallet (needs a build with the transfer_received case)'
    );
  }

  await mongoose.disconnect();
  console.log("\nDone.");
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
