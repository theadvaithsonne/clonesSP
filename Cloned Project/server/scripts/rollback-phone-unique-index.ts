/**
 * Drops the `phone_1` unique index.
 *
 * That index was created ahead of the phone-login module, but the DEPLOYED
 * code knows nothing about it: `/auth/phone/verify-otp` and `PUT /profile`
 * both write `phone` with no duplicate handling, so a number already held by
 * another account raises E11000 and surfaces to the user as a 500.
 *
 *   E11000 duplicate key error ... index: phone_1 dup key: { phone: "+91…" }
 *
 * The guards that make the index safe are written but not shipped. Until they
 * are, the index has to go — this reverts the database to the state the
 * running code was built for.
 *
 * Re-create it with scripts/migrate-identity-indexes.ts as part of deploying
 * the module. Nothing here touches the phone VALUES; the dedupe, country-code
 * repair and E.164 canonicalisation all stand.
 *
 *   npx tsx src/scripts/rollback-phone-unique-index.ts            (dry run)
 *   npx tsx src/scripts/rollback-phone-unique-index.ts --apply
 */
import dotenv from "dotenv";
dotenv.config({ quiet: true } as any);
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const show = (i: any) =>
  `${String(i.name).padEnd(12)} ${JSON.stringify(i.key)}` +
  `${i.unique ? "  UNIQUE" : ""}` +
  `${i.partialFilterExpression ? "  partial=" + JSON.stringify(i.partialFilterExpression) : ""}`;

(async () => {
  await mongoose.connect(process.env.MONGODB_URI!);
  const db = mongoose.connection.db!;
  const col = db.collection("users");
  console.log(`database: ${db.databaseName}`);
  console.log(APPLY ? "=== APPLY ===\n" : "=== DRY RUN — pass --apply to write ===\n");

  const before = await col.indexes();
  console.log("BEFORE — identity indexes:");
  for (const i of before)
    if (["email_1", "phone_1", "email_ci"].includes(String(i.name)))
      console.log("  " + show(i));

  const has = before.some((i: any) => i.name === "phone_1");
  if (!has) {
    console.log("\nphone_1 is not present — nothing to do.");
    await mongoose.disconnect();
    return;
  }

  // How many duplicates would become possible again? Purely informational —
  // this is the behaviour the deployed code has always had.
  const dupes = await col
    .aggregate([
      { $match: { phone: { $type: "string" } } },
      { $group: { _id: "$phone", n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ])
    .toArray();
  console.log(`\nduplicate phone numbers right now: ${dupes.length}`);

  if (!APPLY) {
    console.log("\nWould drop: phone_1");
    console.log("Would leave: email_1 (partial unique — strictly more permissive");
    console.log("             than the original, so it cannot cause a new error)");
    console.log("\nNothing written.");
    await mongoose.disconnect();
    return;
  }

  await col.dropIndex("phone_1");
  console.log("\nDropped phone_1.\n");

  console.log("AFTER — identity indexes:");
  for (const i of await col.indexes())
    if (["email_1", "phone_1", "email_ci"].includes(String(i.name)))
      console.log("  " + show(i));

  await mongoose.disconnect();
})();
