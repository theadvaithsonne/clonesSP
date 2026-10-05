// ONE-SHOT MIGRATION: backfill persistent per-user crypto deposit
// addresses for every existing cryptobrand-org member.
//
// WHAT: iterates every member of every Organization where
// `officeCreatedFromCryptobrand === true` and, for each user, calls
// `allocateUserAddressesFor(userId, orgId)`. That provisions the 5
// UserCryptoAddress rows (BTC × 1, ETH × 1, USDT × 3 chains).
//
// SAFETY:
//   • Idempotent. Users who already have all 5 rows are skipped in
//     the allocator itself; running this twice is a no-op after the
//     first successful pass.
//   • Fires HD counter increments. Consumes ~5 indices per user
//     (fewer if some already exist). On a 500-member cryptobrand
//     population, expect ~2,500 total counter increments spread
//     across BTC / EVM / Tron trees.
//   • Reserve funder is NOT triggered — XRP is deferred and the other
//     chains don't need pre-funding.
//   • Do NOT run this in parallel across processes. The allocator
//     serialises the HD counter via atomic $inc, but running one at
//     a time keeps the logs sequential and easy to correlate.
//
// USAGE:
//   npx tsx src/scripts/backfill-user-crypto-addresses.ts
//   npx tsx src/scripts/backfill-user-crypto-addresses.ts --dry-run
//     (prints who WOULD be provisioned, without allocating)
//   npx tsx src/scripts/backfill-user-crypto-addresses.ts --org <orgId>
//     (limit to one specific org; useful for staged rollout)
//
// Rerun-safety: run a second time to catch any users skipped due to
// mid-run errors. Idempotent, cheap.

import mongoose from "mongoose";
import { Organization } from "../models/organization.model";
import { User } from "../models/user.model";
import { StoreWallet } from "../models/storeWallet.model";
import { ensureCryptobrandWallets } from "../services/cryptobrandWallets";

interface Args {
  dryRun: boolean;
  orgFilter: string | null;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { dryRun: false, orgFilter: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    if (argv[i] === "--org" && argv[i + 1]) {
      args.orgFilter = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is required");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false } as any);
  console.log(
    `[backfill] connected. mode=${args.dryRun ? "DRY-RUN" : "LIVE"}${args.orgFilter ? ` org=${args.orgFilter}` : ""}`,
  );

  const orgFilter: any = { officeCreatedFromCryptobrand: true };
  if (args.orgFilter) orgFilter._id = new mongoose.Types.ObjectId(args.orgFilter);
  const orgs: any[] = await Organization.find(orgFilter)
    .select("_id name")
    .lean();
  console.log(`[backfill] cryptobrand orgs: ${orgs.length}`);

  const summary = {
    orgs: 0,
    users: 0,
    walletsCreated: 0,
    addressesAfter: 0,
    errors: 0,
  };

  for (const org of orgs) {
    summary.orgs += 1;
    // Members are stored on User.organizations[]; pull every user
    // whose array contains this org.
    const users: any[] = await User.find({
      "organizations.organization": org._id,
    })
      .select("_id email name")
      .lean();
    console.log(
      `[backfill] org ${org._id} (${org.name}) — ${users.length} member(s)`,
    );
    for (const u of users) {
      summary.users += 1;
      if (args.dryRun) {
        console.log(
          `  would ensureCryptobrandWallets for user ${u._id} <${u.email || "?"}> in org ${org._id}`,
        );
        continue;
      }
      try {
        // ensureCryptobrandWallets is a superset of allocateUserAddressesFor:
        //   1. Creates any missing sibling StoreWallets (INR/ETH/BTC/USDT)
        //   2. Then fire-and-forgets allocateUserAddressesFor for the
        //      5 deposit addresses (idempotent — skips existing rows)
        // So one call catches both a missing USDT wallet AND a missing
        // UserCryptoAddress row in one shot. Safe to re-run.
        const before = await StoreWallet.countDocuments({
          userId: u._id,
          orgId: org._id,
        });
        const r = await ensureCryptobrandWallets(String(u._id), String(org._id));
        const after = await StoreWallet.countDocuments({
          userId: u._id,
          orgId: org._id,
        });
        const walletsCreatedNow = after - before;
        summary.walletsCreated += walletsCreatedNow;
        if (walletsCreatedNow > 0 || r.createdCount > 0) {
          console.log(
            `  user ${u._id} <${u.email || "?"}>: wallets +${walletsCreatedNow} (total now ${after})`,
          );
        }
      } catch (err) {
        summary.errors += 1;
        console.error(
          `  user ${u._id}: unhandled error —`,
          (err as Error).message,
        );
      }
    }
  }

  // Post-run UserCryptoAddress count for the summary. Reuse the
  // already-registered model (ensureCryptobrandWallets → allocateUserAddressesFor
  // has loaded it), else fall back to a strict-false schema.
  if (!args.dryRun) {
    const UCA =
      mongoose.models.UserCryptoAddress ||
      mongoose.model(
        "UserCryptoAddress",
        new mongoose.Schema({}, { strict: false }),
        "usercryptoaddresses",
      );
    summary.addressesAfter = await UCA.countDocuments({
      orgId: { $in: orgs.map((o: any) => o._id) },
    });
  }

  console.log("");
  console.log("[backfill] summary:", summary);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
