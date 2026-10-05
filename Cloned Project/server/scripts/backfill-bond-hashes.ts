// Give every existing bond holding a public bond hash, and create the
// unique index that guarantees no two bonds share one.
//
// autoIndex is OFF in production (src/db/mongo.ts), so the index
// declared on the schema is NOT built on deploy. This creates it with
// exactly the schema's key, options and name ("bondHash_1"), so a later
// `npm run indexes:sync` treats it as already present.
//
// Idempotent: holdings that already have a hash are left alone; the
// index create is a no-op if it exists. Dry-run by default.
//
//   ./node_modules/.bin/tsx -r dotenv/config src/scripts/backfill-bond-hashes.ts [--apply]
import "dotenv/config";
import mongoose from "mongoose";
import { generateBondHash } from "../services/bondHash";

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!, { autoIndex: false } as any);
  const col = mongoose.connection.db!.collection("bond_holdings");

  const existing = (await col.indexes()).find((i) => i.name === "bondHash_1");
  const missing = await col
    .find({ $or: [{ bondHash: { $exists: false } }, { bondHash: null }] })
    .project({ _id: 1, status: 1, units: 1, currency: 1, createdAt: 1 })
    .toArray();
  const total = await col.countDocuments();

  console.log(`\n  holdings total          : ${total}`);
  console.log(`  holdings needing a hash : ${missing.length}`);
  console.log(`  index bondHash_1        : ${existing ? "already exists" : "MISSING — will create"}`);
  for (const h of missing) {
    console.log(`    ${h._id}  ${h.status}  ${h.units} unit(s) ${h.currency}`);
  }

  if (!APPLY) {
    console.log("\n  DRY-RUN — add --apply to write. No funds are involved.\n");
    await mongoose.disconnect();
    return;
  }

  // Index first, so every assignment below is protected by it.
  if (!existing) {
    await col.createIndex(
      { bondHash: 1 },
      { unique: true, partialFilterExpression: { bondHash: { $type: "string" } } },
    );
    console.log("\n  ✓ created index bondHash_1 (unique, partial)");
  }

  let assigned = 0;
  for (const h of missing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const bondHash = generateBondHash();
      try {
        const r = await col.updateOne(
          { _id: h._id, $or: [{ bondHash: { $exists: false } }, { bondHash: null }] },
          { $set: { bondHash } },
        );
        if (r.modifiedCount === 1) {
          assigned++;
          console.log(`  ✓ ${h._id} -> ${bondHash}`);
        }
        break;
      } catch (e: any) {
        if (e?.code === 11000) continue; // collided — try another
        throw e;
      }
    }
  }
  const still = await col.countDocuments({ $or: [{ bondHash: { $exists: false } }, { bondHash: null }] });
  console.log(`\n  assigned ${assigned}; holdings still without a hash: ${still}\n`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error("FATAL:", e?.message || e); process.exit(1); });
