/**
 * Enrol every member of an org into one of its free communities.
 *
 * A community flagged `mandatoryOnJoin` auto-enrols people who join the org
 * AFTER the flag was set; everyone already in the org is left out. This
 * closes that gap, e.g. Garage HQ's "For Affiliates" (Sep 2026: 645 in,
 * 1,037 HQ members missing).
 *
 * Does exactly what services/channel.ts::addUserToChannel does — membership
 * upsert (reactivating anyone who left) plus the $0 "channel_auto_join"
 * invoice every auto-join records — but AWAITS the invoice mint instead of
 * backgrounding it, so the process can't exit with mints still in flight.
 * No buyer email is sent (the free-join path never does); founder alerts
 * fire only if the channel has them enabled — check before a big run.
 *
 * Refuses paid channels: auto-enrolling into a paid community hands people
 * something they never bought.
 *
 *   npx tsx src/scripts/backfill-channel-members.ts --channel <id>            (dry run, writes the missing list)
 *   npx tsx src/scripts/backfill-channel-members.ts --channel <id> --apply
 *   npx tsx src/scripts/backfill-channel-members.ts --channel <id> --all-users --apply
 *       (--all-users: every platform user, not only the channel's org members)
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";
import fs from "fs";
import path from "path";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes("--apply");
const ALL_USERS = process.argv.includes("--all-users");
const CHANNEL_ID = arg("--channel");
const CONCURRENCY = 8;

(async () => {
  if (!CHANNEL_ID) {
    console.error("Usage: --channel <channelId> [--all-users] [--apply]");
    process.exit(1);
  }
  // autoIndex off: user.model declares a unique phone index that must not be
  // (re)built on production by a one-off script.
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false });
  const { Channel } = await import("../models/channel.model");
  const { ChannelMembership } = await import("../models/channelMembership.model");
  const { User } = await import("../models/user.model");
  const { mintFreeItemInvoice } = await import("../services/freeInvoice");

  const channel: any = await Channel.findById(CHANNEL_ID)
    .select("_id storeId createdBy title description coverImage currency isFree price isActive mandatoryOnJoin founderAlerts")
    .lean();
  if (!channel) {
    console.error(`No channel ${CHANNEL_ID}`);
    process.exit(1);
  }
  const isFree = channel.isFree === true || !channel.price || channel.price <= 0;
  if (!isFree) {
    console.error(`ABORT — "${channel.title}" is PAID (${channel.price} ${channel.currency}); refusing to give it away.`);
    process.exit(1);
  }
  const orgId = String(channel.storeId);
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN — pass --apply to write ===");
  console.log(
    `Channel  : ${channel.title} (${channel._id})  active=${channel.isActive} mandatoryOnJoin=${!!channel.mandatoryOnJoin} founderAlerts=${channel.founderAlerts?.enabled ? "ON ⚠️" : "off"}`,
  );
  console.log(`Org      : ${orgId}`);
  console.log(`Scope    : ${ALL_USERS ? "ALL platform users" : "members of the channel's org"}`);

  const users: any[] = await User.find(
    ALL_USERS ? {} : { "organizations.organization": new mongoose.Types.ObjectId(orgId) },
  )
    .select("_id email name")
    .lean();

  const active = await ChannelMembership.find({ channelId: channel._id, status: "active" })
    .select("userId")
    .lean();
  const activeIds = new Set(active.map((m: any) => String(m.userId)));
  const inactive = await ChannelMembership.find({ channelId: channel._id, status: { $ne: "active" } })
    .select("userId")
    .lean();
  const leftIds = new Set(inactive.map((m: any) => String(m.userId)));

  const missing = users.filter((u) => !activeIds.has(String(u._id)));
  const rejoining = missing.filter((u) => leftIds.has(String(u._id)));

  console.log(`\nIn scope : ${users.length}`);
  console.log(`Already in: ${users.length - missing.length}`);
  console.log(`Missing  : ${missing.length}  (of which previously left and will be reactivated: ${rejoining.length})`);

  // Always write the list so the founder can see who is being added.
  const outDir = process.env.SCRATCH_DIR || "/tmp";
  const outFile = path.join(outDir, `missing-${channel.title.replace(/\W+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`);
  fs.writeFileSync(
    outFile,
    ["email,name,rejoining", ...missing.map((u) => `${u.email || ""},"${(u.name || "").replace(/"/g, '""')}",${leftIds.has(String(u._id)) ? "yes" : ""}`)].join("\n"),
  );
  console.log(`List     : ${outFile}`);

  if (!APPLY) {
    console.log("\nNothing written.");
    await mongoose.disconnect();
    return;
  }

  let joined = 0;
  let invoiced = 0;
  let failed = 0;
  const queue = [...missing];
  const worker = async () => {
    for (;;) {
      const u = queue.shift();
      if (!u) return;
      const userId = String(u._id);
      try {
        // Same write addUserToChannel does.
        const existed = leftIds.has(userId);
        await ChannelMembership.findOneAndUpdate(
          { userId: u._id, channelId: channel._id },
          {
            userId: u._id,
            channelId: channel._id,
            orgId: channel.storeId,
            status: "active",
            role: "member",
            ...(existed ? {} : { joinedAt: new Date() }),
          },
          { upsert: true, new: true },
        );
        joined++;
        // Same invoice addUserToChannel mints (channel.ts::mintFreeChannelJoinInvoice),
        // awaited. Idempotent — a member who somehow already has one is untouched.
        const r = await mintFreeItemInvoice({
          userId,
          orgId,
          sellerId: String(channel.createdBy),
          itemType: "channel",
          itemId: String(channel._id),
          itemName: channel.title,
          itemDescription: channel.description,
          itemImage: channel.coverImage,
          currency: channel.currency,
          metadataType: "channel_auto_join",
          source: "subscribe",
        } as any);
        if (r?.created) invoiced++;
      } catch (err: any) {
        failed++;
        console.error(`  ✗ ${u.email || userId}: ${err?.message || err}`);
      }
      if ((joined + failed) % 100 === 0) console.log(`  … ${joined + failed}/${missing.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const nowActive = await ChannelMembership.countDocuments({ channelId: channel._id, status: "active" });
  console.log(`\nDone. joined=${joined} invoicesCreated=${invoiced} failed=${failed}`);
  console.log(`Active members now: ${nowActive}`);
  await mongoose.disconnect();
})().catch(async (err) => {
  console.error("FAILED:", err?.message || err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
