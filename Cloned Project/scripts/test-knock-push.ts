/**
 * scripts/test-knock-push.ts
 *
 * Sends a TEST "knock" notification to a user's registered devices so we can
 * confirm push delivery WITHOUT having someone actually knock — and without
 * cutting a new app build first.
 *
 * It exercises both transports the backend uses for knocks:
 *   • iOS  → VoIP push via APNs   (sendKnockVoIPPush path)
 *   • Android → Expo push → FCM   (sendKnockPushNotification path)
 *
 * For VoIP it deliberately tries BOTH the sandbox and production APNs gateways
 * and reports which one the device token is accepted by. That instantly tells
 * us whether the installed build is registered for development (sandbox) or
 * production APNs — the #1 cause of "iOS knocks never arrive".
 *
 * Usage:
 *   npx tsx scripts/test-knock-push.ts --user <email|userId>
 *   npx tsx scripts/test-knock-push.ts --user me@x.com --type voip
 *   npx tsx scripts/test-knock-push.ts --user me@x.com --type push
 *   npx tsx scripts/test-knock-push.ts --voip-token <rawApnsToken>   # bypass DB
 *
 * Flags:
 *   --user <email|userId>   Recipient. Email is looked up; 24-hex is treated as _id.
 *   --type voip|push|both   Which transport(s) to test. Default: both.
 *   --voip-token <token>    Send a VoIP push to a raw token (skips DB lookup).
 *   --name <string>         Caller/knocker display name. Default: "Test Knock".
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import apn from "@parse/node-apn";
import Expo, { ExpoPushMessage } from "expo-server-sdk";

dotenv.config();

import { env } from "../server/config/env";
import { User } from "../server/models/user.model";
import { VoIPToken } from "../server/models/voipToken.model";
import { DeviceToken } from "../server/models/deviceToken.model";

// ── arg parsing ─────────────────────────────────────────────────────────────
function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const userArg = getArg("user");
const rawVoipToken = getArg("voip-token");
const type = (getArg("type") || "both").toLowerCase(); // voip | push | both
const knockerName = getArg("name") || "Test Knock";
const knockerId = "000000000000000000000000"; // placeholder ObjectId-ish caller id

const doVoip = type === "voip" || type === "both";
const doPush = type === "push" || type === "both";

// ── helpers ─────────────────────────────────────────────────────────────────
function loadApnsKey(): string | null {
  if (env.APNS_KEY_CONTENT) return env.APNS_KEY_CONTENT;
  if (env.APNS_KEY_PATH) {
    // Resolve relative to CWD first, then to the backend root (script lives in scripts/).
    const candidates = [
      path.resolve(process.cwd(), env.APNS_KEY_PATH),
      path.resolve(__dirname, "..", env.APNS_KEY_PATH),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
    }
    console.error(`[VOIP] APNs key file not found. Looked in:\n  ${candidates.join("\n  ")}`);
  }
  return null;
}

async function sendVoipToToken(token: string, production: boolean) {
  const key = loadApnsKey();
  if (!key) return { ok: false, reason: "APNs key not loadable" };
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    return {
      ok: false,
      reason: `Missing ${!env.APNS_KEY_ID ? "APNS_KEY_ID " : ""}${!env.APNS_TEAM_ID ? "APNS_TEAM_ID" : ""}`.trim(),
    };
  }

  const provider = new apn.Provider({
    token: { key, keyId: env.APNS_KEY_ID, teamId: env.APNS_TEAM_ID },
    production,
  });

  const note = new apn.Notification();
  note.topic = `${env.APNS_BUNDLE_ID}.voip`;
  note.pushType = "voip";
  note.priority = 10;
  note.expiry = Math.floor(Date.now() / 1000) + 60;
  note.payload = {
    callerId: knockerId,
    callerName: knockerName,
    callerProfilePicture: "",
    hasVideo: false,
  };

  try {
    const res = await provider.send(note, token);
    provider.shutdown();
    if (res.sent.length > 0) return { ok: true, reason: "accepted" };
    const f = res.failed[0];
    return { ok: false, reason: f?.response?.reason || f?.error?.message || `status ${f?.status}` };
  } catch (e: any) {
    provider.shutdown();
    return { ok: false, reason: e?.message || String(e) };
  }
}

async function testVoip(tokens: string[]) {
  console.log(`\n========== iOS VoIP test (${tokens.length} token${tokens.length === 1 ? "" : "s"}) ==========`);
  if (tokens.length === 0) {
    console.log("⚠️  No active VoIP tokens for this user. (iOS app never registered one —");
    console.log("    check CallKit availability + that VoIP registration isn't gated behind");
    console.log("    notification permission.)");
    return;
  }
  if (!env.APNS_TEAM_ID) {
    console.log("❌ APNS_TEAM_ID is empty in .env — set it before this can work.");
  }
  for (const token of tokens) {
    const short = `${token.substring(0, 12)}…`;
    const sandbox = await sendVoipToToken(token, false);
    const prod = await sendVoipToToken(token, true);
    console.log(`\n  token ${short}`);
    console.log(`    sandbox    : ${sandbox.ok ? "✅ accepted" : `❌ ${sandbox.reason}`}`);
    console.log(`    production : ${prod.ok ? "✅ accepted" : `❌ ${prod.reason}`}`);
    if (sandbox.ok || prod.ok) {
      console.log(
        `    → This token is a ${sandbox.ok ? "SANDBOX" : "PRODUCTION"} token. ` +
          `Set APNS_PRODUCTION=${sandbox.ok ? "false" : "true"} on the server to reach it.`
      );
    }
  }
}

async function testPush(tokens: string[]) {
  console.log(`\n========== Android/Expo push test (${tokens.length} token${tokens.length === 1 ? "" : "s"}) ==========`);
  if (tokens.length === 0) {
    console.log("⚠️  No active Expo device tokens for this user.");
    return;
  }
  const expo = new Expo();
  const messages: ExpoPushMessage[] = [];
  const valid: string[] = [];
  for (const token of tokens) {
    if (!Expo.isExpoPushToken(token)) {
      console.log(`  ❌ Not an Expo push token: ${token.substring(0, 20)}…`);
      continue;
    }
    messages.push({
      to: token,
      title: "Incoming Knock",
      body: `${knockerName} is knocking to start a conversation`,
      data: { type: "knock", knockerId, knockerName },
      channelId: "knocks",
      sound: "default",
      priority: "high",
    });
    valid.push(token);
  }
  if (messages.length === 0) return;

  const tickets = await expo.sendPushNotificationsAsync(messages);
  const receiptIds: string[] = [];
  tickets.forEach((t, i) => {
    const short = `${valid[i].substring(0, 20)}…`;
    if (t.status === "ok") {
      console.log(`  ✅ accepted by Expo: ${short} (receipt ${t.id})`);
      receiptIds.push(t.id);
    } else {
      console.log(`  ❌ ${short}: ${t.message} ${t.details ? JSON.stringify(t.details) : ""}`);
    }
  });

  // A ticket "ok" only means Expo queued it — FCM can still reject. Check receipts.
  if (receiptIds.length > 0) {
    console.log("  …waiting 4s for delivery receipts (FCM result)…");
    await new Promise((r) => setTimeout(r, 4000));
    const receipts = await expo.getPushNotificationReceiptsAsync(receiptIds);
    for (const [id, r] of Object.entries(receipts)) {
      if (r.status === "ok") console.log(`  ✅ delivered to FCM (receipt ${id})`);
      else console.log(`  ❌ receipt ${id}: ${r.message} ${r.details ? JSON.stringify(r.details) : ""}`);
    }
  }
}

async function run() {
  if (!env.MONGODB_URI) throw new Error("MONGODB_URI is missing");
  await mongoose.connect(env.MONGODB_URI);
  console.log("Connected to MongoDB:", mongoose.connection.name);

  // Raw-token shortcut: just fire a VoIP push, no DB lookup.
  if (rawVoipToken) {
    await testVoip([rawVoipToken]);
    await mongoose.disconnect();
    return;
  }

  if (!userArg) {
    console.error("\nUsage: npx tsx scripts/test-knock-push.ts --user <email|userId> [--type voip|push|both]");
    await mongoose.disconnect();
    process.exit(1);
  }

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
  console.log(`Target user: ${(user as any).name || "(no name)"} <${(user as any).email}>  id=${uid}`);

  const voipTokens = doVoip
    ? (await VoIPToken.find({ userId: uid, isActive: true }).select("token").lean()).map((t: any) => t.token)
    : [];
  const pushTokens = doPush
    ? (await DeviceToken.find({ userId: uid, isActive: true }).select("token platform").lean()).map((t: any) => t.token)
    : [];

  if (doVoip) await testVoip(voipTokens);
  if (doPush) await testPush(pushTokens);

  console.log("\nDone.");
  await mongoose.disconnect();
}

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
