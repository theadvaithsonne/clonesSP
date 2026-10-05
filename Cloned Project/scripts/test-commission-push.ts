/**
 * scripts/test-commission-push.ts
 *
 * Sends a TEST "commission earned" notification to a user's registered
 * devices so we can confirm end-to-end delivery WITHOUT crediting any
 * wallet — no wallet document or transaction is touched.
 *
 * Unlike test-knock-push.ts (which rebuilds the Expo message by hand),
 * this calls the REAL production sender —
 * services/pushNotification.ts::sendCommissionEarnedPushNotification —
 * so it exercises the exact code path wallet.ts::creditAffiliateOrPlatform
 * fires after a credit: token lookup, Intl amount formatting, the
 * "earnings" channelId, and the commission_earned tap payload.
 *
 * Usage:
 *   npx tsx scripts/test-commission-push.ts --user <email|userId>
 *   npx tsx scripts/test-commission-push.ts --user me@x.com --amount 4550 --level 2
 *   npx tsx scripts/test-commission-push.ts --user me@x.com --routed   # locked-earning variant
 *
 * Flags:
 *   --user <email|userId>   Recipient. Email is looked up; 24-hex is treated as _id.
 *   --amount <int>          Amount in the currency's SMALLEST unit (cents). Default: 4550.
 *   --currency <code>       Default: USD.
 *   --level <n>             Affiliate-chain level shown in the title. Omit for none.
 *   --routed                Send the routed-to-platform variant (UP-activation nudge).
 *   --description <string>  Notification body. Default marks it as a test.
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import { env } from "../server/config/env";
import { User } from "../server/models/user.model";
import { DeviceToken } from "../server/models/deviceToken.model";
import { sendCommissionEarnedPushNotification } from "../server/services/pushNotification";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const userArg = getArg("user");
const amount = parseInt(getArg("amount") || "4550", 10);
const currency = getArg("currency") || "USD";
const levelArg = getArg("level");
const level = levelArg ? parseInt(levelArg, 10) : undefined;
const routedToPlatform = hasFlag("routed");
const description =
  getArg("description") || "TEST commission notification — no money moved.";

async function run() {
  if (!userArg) {
    console.error(
      "\nUsage: npx tsx scripts/test-commission-push.ts --user <email|userId> [--amount 4550] [--level 2] [--routed]"
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

  const tokens = await DeviceToken.find({ userId: uid, isActive: true })
    .select("token platform lastUsedAt")
    .lean();
  console.log(`Active device tokens: ${tokens.length}`);
  for (const t of tokens as any[]) {
    console.log(
      `  • [${t.platform || "?"}] ${String(t.token).substring(0, 24)}…  lastUsed=${
        t.lastUsedAt ? new Date(t.lastUsedAt).toISOString() : "never"
      }`
    );
  }
  if (tokens.length === 0) {
    console.log(
      "⚠️  No active tokens — the app on the device hasn't registered one (or they were deactivated after failures)."
    );
    await mongoose.disconnect();
    return;
  }

  console.log(
    `\nSending commission push: amount=${amount} (${currency}, smallest unit)` +
      `${level ? ` level=${level}` : ""}${routedToPlatform ? " [routed-to-platform variant]" : ""}`
  );

  const result = await sendCommissionEarnedPushNotification(uid, {
    amount,
    currency,
    description,
    unit: "smallest",
    level,
    routedToPlatform,
    walletDeepLink: "/wallet",
  });

  console.log(`\nResult: sent=${result.sent} failed=${result.failed}`);
  for (const e of result.errors) console.log(`  ❌ ${e}`);
  if (result.sent > 0) {
    console.log(
      "\n✅ Accepted by Expo. On the device expect:\n" +
        `   title: "You earned $${(amount / 100).toFixed(2)}${level ? ` (Level ${level})` : ""}"\n` +
        `   body:  "${description}${routedToPlatform ? " Activate Unilevel Plus to unlock this earning." : ""}"\n` +
        '   Android channel: "earnings" (PRIVATE on lock screen) · tap → /wallet'
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
