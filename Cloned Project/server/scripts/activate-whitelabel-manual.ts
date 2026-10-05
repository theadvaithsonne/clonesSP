/**
 * One-shot: activate the whitelabel add-on for a specific user + org
 * combination without a payment. Uses the same OfficeAddonSubscription
 * shape as the invoice-based purchase path so `hasActiveAddon(orgId,
 * "white-label")` returns true immediately.
 *
 * Marked with `metadata.source: "manual_admin_grant"` so it's
 * distinguishable from paid subscriptions (invoice / razorpay).
 *
 * Idempotent — re-running against the same user+org either extends
 * the current cycle or no-ops (see `activateWhitelabelFromInvoice`
 * behavior; the compound-unique index keeps a single doc per org+addon).
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/activate-whitelabel-manual.ts <email> <org-name>
 *
 * Example:
 *   npx tsx src/scripts/activate-whitelabel-manual.ts shorupanmedia@gmail.com chamak
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Organization } from "../models/organization.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import {
  WHITELABEL_ADDON,
  whitelabelCycleMs,
} from "../config/whitelabelAddon";

async function run() {
  const [emailRaw, orgQueryRaw] = process.argv.slice(2);
  if (!emailRaw || !orgQueryRaw) {
    console.error(
      "Usage: npx tsx src/scripts/activate-whitelabel-manual.ts <email> <org-name>",
    );
    process.exit(1);
  }
  const email = emailRaw.trim().toLowerCase();
  const orgQuery = orgQueryRaw.trim();

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo`);

  const user = await User.findOne({ email }).select("_id email name").lean<any>();
  if (!user) {
    console.error(`❌ No user with email ${email}`);
    process.exit(1);
  }
  console.log(`👤 User: ${user.name || "(no name)"} <${user.email}> ${user._id}`);

  // Case-insensitive org name match.
  const orgs = await Organization.find({
    name: new RegExp(
      `^${orgQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      "i",
    ),
  })
    .select("_id name")
    .lean<any[]>();

  if (orgs.length === 0) {
    console.error(`❌ No organization matching "${orgQuery}"`);
    process.exit(1);
  }
  if (orgs.length > 1) {
    console.error(
      `❌ Multiple organizations match "${orgQuery}" — narrow it down:`,
    );
    for (const o of orgs) console.error(`  - ${o.name} (${o._id})`);
    process.exit(1);
  }
  const org = orgs[0];
  console.log(`🏢 Org: ${org.name} (${org._id})`);

  const addon = await OfficeAddon.findOne({ slug: WHITELABEL_ADDON.slug })
    .select("_id slug")
    .lean<{ _id: Types.ObjectId; slug: string }>();
  if (!addon) {
    console.error(
      `❌ OfficeAddon "${WHITELABEL_ADDON.slug}" not found. Restart the BE — initializeOfficeAddons seeds it on boot.`,
    );
    process.exit(1);
  }

  // Confirm the user is actually a founder of this org — required by
  // OfficeAddonSubscription.founderId. If not, refuse rather than
  // pretending. Manual grants should still respect the schema invariant.
  const founderMembership = (user.organizations || []).find?.(
    (m: any) =>
      String(m.organization) === String(org._id) && m.role === "founder",
  );
  // The .lean() above stripped organizations from the projection. Refetch.
  const userWithOrgs = await User.findById(user._id)
    .select("organizations")
    .lean<any>();
  const isFounder = (userWithOrgs.organizations || []).some(
    (m: any) =>
      String(m.organization) === String(org._id) && m.role === "founder",
  );
  if (!isFounder) {
    console.error(
      `❌ User is not a founder of ${org.name} — cannot activate whitelabel on their behalf.`,
    );
    process.exit(1);
  }

  const now = new Date();
  const existing = await OfficeAddonSubscription.findOne({
    orgId: org._id,
    addonId: addon._id,
  }).lean<any>();

  const prevEnd = existing?.currentEnd;
  const cycleStart = prevEnd && prevEnd > now ? prevEnd : now;
  const cycleEnd = new Date(cycleStart.getTime() + whitelabelCycleMs());

  console.log(
    existing
      ? `♻️  Existing sub found (status=${existing.status}, currentEnd=${existing.currentEnd?.toISOString?.() || "n/a"}) — extending`
      : `✨ No existing sub — creating fresh`,
  );

  const result = await OfficeAddonSubscription.updateOne(
    { orgId: org._id, addonId: addon._id },
    {
      $set: {
        founderId: user._id,
        addonId: addon._id,
        status: "active",
        currentStart: cycleStart,
        currentEnd: cycleEnd,
        chargeAt: new Date(
          cycleEnd.getTime() -
            WHITELABEL_ADDON.renewalLeadDays * 24 * 3600 * 1000,
        ),
        startedAt: existing?.startedAt || now,
        paymentMethod: "card",
        "metadata.source": "manual_admin_grant",
        "metadata.grantedAt": now,
        "metadata.grantedFor": {
          email: user.email,
          orgName: org.name,
        },
      },
      $unset: { endedAt: 1, cancelledAt: 1 },
      $inc: { paidCount: 1 },
      $setOnInsert: { orgId: org._id },
    },
    { upsert: true },
  );

  console.log(
    `✅ upsert result: matched=${result.matchedCount} modified=${result.modifiedCount} upserted=${result.upsertedCount}`,
  );
  console.log(`✅ Whitelabel active until: ${cycleEnd.toISOString()}`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(async (err) => {
  console.error("❌ Fatal:", err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
