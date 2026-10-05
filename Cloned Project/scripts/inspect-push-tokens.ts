/**
 * scripts/inspect-push-tokens.ts
 *
 * READ-ONLY. Prints what is actually registered in DeviceToken, broken down by
 * app and platform — the fastest way to tell a client that never registers
 * from a sender that never sends.
 *
 * `app` absent/null means garage-chat (rows predate the field), so it is
 * reported as "(legacy)" rather than folded into either app.
 *
 * Usage:
 *   npx tsx scripts/inspect-push-tokens.ts
 *   npx tsx scripts/inspect-push-tokens.ts --user me@x.com
 *   npx tsx scripts/inspect-push-tokens.ts --user 65f1a2b3c4d5e6f708192a3b
 */

import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

import { env } from "../server/config/env";
import { User } from "../server/models/user.model";
import { DeviceToken } from "../server/models/deviceToken.model";

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function run() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  const rows = await DeviceToken.aggregate([
    {
      $group: {
        _id: { app: "$app", platform: "$platform", isActive: "$isActive" },
        count: { $sum: 1 },
        newest: { $max: "$updatedAt" },
      },
    },
    { $sort: { count: -1 } },
  ]);

  console.log("\nAll registered device tokens");
  console.log("app            platform  active  count  newest");
  for (const r of rows) {
    const app = (r._id.app ?? "(legacy)").padEnd(14);
    const platform = String(r._id.platform).padEnd(9);
    const active = String(r._id.isActive).padEnd(7);
    const newest = r.newest ? new Date(r.newest).toISOString().slice(0, 10) : "-";
    console.log(`${app} ${platform} ${active} ${String(r.count).padStart(5)}  ${newest}`);
  }

  const nc = rows.filter((r) => r._id.app === "networkchain");
  const ncAndroid = nc.filter((r) => r._id.platform === "android").reduce((n, r) => n + r.count, 0);
  const ncIos = nc.filter((r) => r._id.platform === "ios").reduce((n, r) => n + r.count, 0);
  console.log(`\nnetworkchain: ios=${ncIos} android=${ncAndroid}`);
  if (ncAndroid === 0) {
    console.log("→ No Android token has EVER registered (expected: no FCM config in the app).");
  }
  if (ncIos === 0) {
    console.log("→ No iOS token either — registration is failing before the POST, not just on Android.");
  }

  const userArg = getArg("user");
  if (userArg) {
    const isObjectId = /^[a-f0-9]{24}$/i.test(userArg);
    const user = isObjectId
      ? await User.findById(userArg).select("name email").lean()
      : await User.findOne({ email: userArg.toLowerCase() }).select("name email").lean();

    if (!user) {
      console.log(`\nNo user found for "${userArg}"`);
    } else {
      const uid = (user as any)._id.toString();
      console.log(`\nTokens for ${(user as any).email || uid}:`);
      const mine = await DeviceToken.find({ userId: uid })
        .select("token platform app isActive appVersion failedAttempts updatedAt")
        .sort({ updatedAt: -1 })
        .lean();
      if (mine.length === 0) console.log("  (none)");
      for (const t of mine as any[]) {
        console.log(
          `  ${String(t.app ?? "(legacy)").padEnd(14)} ${String(t.platform).padEnd(8)}` +
            ` active=${String(t.isActive).padEnd(5)} v${t.appVersion ?? "?"}` +
            ` fails=${t.failedAttempts ?? 0} ${new Date(t.updatedAt).toISOString().slice(0, 16)}` +
            `  ${String(t.token).slice(0, 28)}...`
        );
      }
    }
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
