/**
 * Makes `phone` a first-class identity alongside `email`.
 *
 * Three index changes on `users`:
 *
 *   email_1   is `unique` but NOT sparse, so a SECOND user without an email
 *             collides on null. That is the single thing preventing a
 *             phone-only signup. Recreated as unique + partial.
 *   phone_1   new, unique + partial. Without it `findOne({ phone })` has no
 *             uniqueness guarantee and no index — it would silently return an
 *             arbitrary one of several matching accounts.
 *   email_ci  a redundant NON-unique duplicate of email_1 (identical key
 *             {email:1}). Dropped; it costs writes and buys nothing.
 *
 * `partialFilterExpression: { $type: "string" }` rather than `sparse: true`:
 * sparse only skips documents where the field is ABSENT, so an explicit
 * `email: null` write would still collide. Partial-on-type skips both.
 * (`affiliateId_1` and `username_1` already use the sparse variant here; this
 * is the stricter version of the same idea.)
 *
 * Refuses to create a unique index while duplicates exist, and reports them.
 *
 *   npx tsx src/scripts/migrate-identity-indexes.ts
 *   npx tsx src/scripts/migrate-identity-indexes.ts --apply
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const EMAIL_IDX = {
  name: "email_1",
  key: { email: 1 } as const,
  opts: {
    unique: true,
    partialFilterExpression: { email: { $type: "string" } },
    name: "email_1",
  },
};
const PHONE_IDX = {
  name: "phone_1",
  key: { phone: 1 } as const,
  opts: {
    unique: true,
    partialFilterExpression: { phone: { $type: "string" } },
    name: "phone_1",
  },
};

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const col = mongoose.connection.db!.collection("users");
  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const before = await col.indexes();
  const show = (i: any) =>
    `${String(i.name).padEnd(26)} ${JSON.stringify(i.key)}` +
    `${i.unique ? "  UNIQUE" : ""}${i.sparse ? "  sparse" : ""}` +
    `${i.partialFilterExpression ? "  partial=" + JSON.stringify(i.partialFilterExpression) : ""}`;
  console.log("current indexes:");
  for (const i of before) console.log("  " + show(i));

  // ── Safety: a unique index cannot be built over duplicates ──
  const dupes = async (field: "email" | "phone") =>
    col
      .aggregate([
        { $match: { [field]: { $type: "string" } } },
        { $group: { _id: `$${field}`, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
      ])
      .toArray();

  const [dupEmail, dupPhone] = await Promise.all([dupes("email"), dupes("phone")]);
  console.log(`\nduplicate emails: ${dupEmail.length}`);
  for (const d of dupEmail.slice(0, 10)) console.log(`   ${d._id} x${d.n}`);
  console.log(`duplicate phones: ${dupPhone.length}`);
  for (const d of dupPhone.slice(0, 10)) console.log(`   ${d._id} x${d.n}`);

  if (dupEmail.length || dupPhone.length) {
    console.log("\nABORT — resolve the duplicates above first (see dedupe-shared-phones.ts).");
    await mongoose.disconnect();
    process.exit(1);
  }

  const has = (n: string) => before.some((i: any) => i.name === n);
  const plan: string[] = [];
  if (has("email_1")) plan.push("drop email_1 (unique, non-partial)");
  plan.push("create email_1 (unique, partial on $type:string)");
  if (has("phone_1")) plan.push("drop phone_1");
  plan.push("create phone_1 (unique, partial on $type:string)");
  if (has("email_ci")) plan.push("drop email_ci (redundant duplicate of email_1)");
  console.log("\nplanned:");
  for (const p of plan) console.log("   " + p);

  if (!APPLY) {
    console.log("\nNothing written.");
    await mongoose.disconnect();
    return;
  }

  // Order matters: drop the old email index before creating the new one, since
  // they share a name.
  if (has("email_1")) await col.dropIndex("email_1");
  await col.createIndex(EMAIL_IDX.key as any, EMAIL_IDX.opts as any);
  if (has("phone_1")) await col.dropIndex("phone_1");
  await col.createIndex(PHONE_IDX.key as any, PHONE_IDX.opts as any);
  if (has("email_ci")) await col.dropIndex("email_ci");

  console.log("\nresulting indexes:");
  for (const i of await col.indexes()) console.log("  " + show(i));
  await mongoose.disconnect();
})();
