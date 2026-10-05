/**
 * One-shot: deactivate the whitelabel add-on for an org — the reverse of
 * `activate-whitelabel-manual.ts`.
 *
 * Flips the org's OfficeAddonSubscription for the whitelabel addon to
 * `status: "cancelled"` so `hasActiveAddon(orgId, "white-label")` returns
 * false immediately (`getActiveOfficeAddonSubscription` only matches
 * status active/authenticated). Also stamps cancelledAt/endedAt, pulls
 * `currentEnd` back to now, and clears `chargeAt` so nothing can treat the
 * cycle as still running.
 *
 * The row is KEPT, not deleted — `metadata.source` and the grant history
 * stay auditable, and re-running the activate script restores access.
 *
 * Safe by default: prints what it WOULD change and exits. Pass --confirm to
 * actually write.
 *
 * Usage (from roam-backend/):
 *   npx tsx src/scripts/deactivate-whitelabel-manual.ts <org-name>
 *   npx tsx src/scripts/deactivate-whitelabel-manual.ts <org-name> --confirm
 *
 * Example:
 *   npx tsx src/scripts/deactivate-whitelabel-manual.ts chamak --confirm
 */
import "dotenv/config";
import mongoose, { Types } from "mongoose";
import { env } from "../config/env";
import { Organization } from "../models/organization.model";
import { OfficeAddon } from "../models/officeAddon.model";
import { OfficeAddonSubscription } from "../models/officeAddonSubscription.model";
import { WHITELABEL_ADDON } from "../config/whitelabelAddon";

async function run() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const orgQueryRaw = args.find((a) => !a.startsWith("--"));

  if (!orgQueryRaw) {
    console.error(
      "Usage: npx tsx src/scripts/deactivate-whitelabel-manual.ts <org-name> [--confirm]",
    );
    process.exit(1);
  }
  const orgQuery = orgQueryRaw.trim();

  await mongoose.connect(env.MONGODB_URI);
  console.log(`✅ Connected to Mongo (db: ${mongoose.connection.name})`);

  // Case-insensitive exact name match — same matcher the activate script uses,
  // so the two always resolve to the same org.
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
    console.error(`❌ OfficeAddon "${WHITELABEL_ADDON.slug}" not found.`);
    process.exit(1);
  }

  const existing = await OfficeAddonSubscription.findOne({
    orgId: org._id,
    addonId: addon._id,
  }).lean<any>();

  if (!existing) {
    console.log(
      `ℹ️  No whitelabel subscription exists for ${org.name} — nothing to deactivate.`,
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`\n📄 Current subscription (${existing._id}):`);
  console.log(`   status:       ${existing.status}`);
  console.log(`   source:       ${existing.metadata?.source ?? "(none)"}`);
  console.log(`   currentStart: ${existing.currentStart?.toISOString?.() ?? "n/a"}`);
  console.log(`   currentEnd:   ${existing.currentEnd?.toISOString?.() ?? "n/a"}`);
  console.log(`   chargeAt:     ${existing.chargeAt?.toISOString?.() ?? "n/a"}`);
  console.log(`   grantedAt:    ${existing.metadata?.grantedAt?.toISOString?.() ?? "n/a"}`);

  if (!["active", "authenticated"].includes(existing.status)) {
    console.log(
      `\nℹ️  Already inactive (status="${existing.status}") — access is already off. Nothing to do.`,
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const now = new Date();

  if (!confirm) {
    console.log(`\n🔍 DRY RUN — no changes written. Would apply:`);
    console.log(`   status     "${existing.status}" -> "cancelled"`);
    console.log(`   cancelledAt -> ${now.toISOString()}`);
    console.log(`   endedAt     -> ${now.toISOString()}`);
    console.log(`   currentEnd  -> ${now.toISOString()}`);
    console.log(`   chargeAt    -> unset`);
    console.log(`\n   Re-run with --confirm to apply.`);
    await mongoose.disconnect();
    process.exit(0);
  }

  const result = await OfficeAddonSubscription.updateOne(
    { _id: existing._id },
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        endedAt: now,
        // Pull the cycle closed too, so the currentEnd check in
        // hasActiveAddon also fails — not just the status filter.
        currentEnd: now,
        "metadata.deactivatedAt": now,
        "metadata.deactivatedBy": "deactivate-whitelabel-manual script",
        "metadata.previousStatus": existing.status,
      },
      // Nothing should think a renewal is owed.
      $unset: { chargeAt: 1 },
    },
  );

  console.log(
    `\n✅ updated: matched=${result.matchedCount} modified=${result.modifiedCount}`,
  );

  const after = await OfficeAddonSubscription.findById(existing._id).lean<any>();
  console.log(`✅ status now: ${after?.status}`);
  console.log(`✅ Whitelabel access for ${org.name} is OFF.`);
  console.log(
    `\nℹ️  Note: this only ends the subscription. Any custom domain rows on the\n` +
      `   organization (domainConfig / customAppDomains) are left untouched.`,
  );

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
