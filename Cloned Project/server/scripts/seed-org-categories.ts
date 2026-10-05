/**
 * Seed the OrgCategory collection from the existing world:
 *   1. Every `Organization.category` value in the DB (case-insensitive
 *      dedup — "Tech" and "tech" collapse to one).
 *   2. The 10 hardcoded FE defaults so a fresh install still has a
 *      reasonable picker even before any org has been created.
 *
 * Safe to re-run. Categories that already exist (matched case-insensitive
 * on `name`) are skipped. `createdByAdminId` is left null on seed rows so
 * an admin can tell seeded values apart from ones they added later.
 *
 * Usage:
 *   npx ts-node --transpile-only src/scripts/seed-org-categories.ts            # dry-run
 *   npx ts-node --transpile-only src/scripts/seed-org-categories.ts --apply    # writes
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { Organization } from "../models/organization.model";
import { OrgCategory, slugifyCategoryName } from "../models/orgCategory.model";

const APPLY = process.argv.includes("--apply");

// Mirrors the two hardcoded FE arrays we're removing:
//   app/(onboarding)/organization/page.tsx:67-78
//   components/shared/ManageOrgPopover.tsx:146-157
const FE_DEFAULTS = [
  "Technology",
  "Healthcare",
  "Education",
  "Finance",
  "Retail",
  "Consulting",
  "Creative",
  "Manufacturing",
  "Real Estate",
  "Legal",
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(
    `\n[seed-org-categories] mode: ${APPLY ? "APPLY" : "DRY-RUN"}\n`,
  );

  // 1. Snapshot every non-empty category string currently in the DB.
  const fromDb = ((await Organization.distinct("category", {
    category: { $exists: true, $ne: "" },
  })) as string[]).filter((v) => typeof v === "string" && v.trim().length > 0);

  console.log(`Distinct Organization.category values in DB: ${fromDb.length}`);

  // 2. Merge + dedupe case-insensitively (keep the first-seen casing).
  const seen = new Map<string, string>();
  for (const raw of [...fromDb, ...FE_DEFAULTS]) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  const uniqueNames = [...seen.values()].sort((a, b) => a.localeCompare(b));

  console.log(
    `Unique category names (DB + FE defaults, case-ins deduped): ${uniqueNames.length}`,
  );

  // 3. Skip anything already present in OrgCategory (case-insensitive).
  const existing = await OrgCategory.find({}).select("name").lean();
  const existingLower = new Set(existing.map((e) => e.name.toLowerCase()));

  const toInsert = uniqueNames.filter(
    (n) => !existingLower.has(n.toLowerCase()),
  );

  console.log(`Already in OrgCategory: ${existing.length}`);
  console.log(`To insert: ${toInsert.length}\n`);

  for (const name of toInsert) {
    const baseSlug = slugifyCategoryName(name) || "category";
    let slug = baseSlug;
    let n = 2;
    // Resolve slug collisions the same way the service does — bump until free.
    while (await OrgCategory.findOne({ slug }).select("_id").lean()) {
      slug = `${baseSlug}-${n}`;
      n += 1;
    }
    console.log(`  + ${name}  (slug=${slug})`);
    if (!APPLY) continue;
    try {
      await OrgCategory.create({ name, slug, createdByAdminId: null });
    } catch (err: any) {
      console.error(`    ! insert failed for "${name}":`, err.message);
    }
  }

  console.log(
    `\n[seed-org-categories] done. ${APPLY ? "Inserted" : "Would insert"} ${toInsert.length} row(s).`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed-org-categories] fatal:", err);
  process.exit(1);
});
