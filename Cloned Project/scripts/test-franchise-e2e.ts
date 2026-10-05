/**
 * End-to-end franchise-program distribution test (WRITES to a DB).
 *
 * SAFETY: refuses to run unless `MONGODB_URI_TEST` is set AND its db name does
 * NOT contain "prod". Seeds a throwaway office/program/assignments, runs the
 * STEP 5 distributor directly, asserts the payouts, then deletes everything it
 * created. Never touches MONGODB_URI (prod).
 *
 *   MONGODB_URI_TEST="mongodb+srv://.../roam-admin-dev" npx tsx scripts/test-franchise-e2e.ts
 */
import mongoose, { Types } from "mongoose";
import { User } from "../server/models/user.model";
import { Organization } from "../server/models/organization.model";
import { StoreWallet } from "../server/models/storeWallet.model";
import { TerritoryWallet } from "../server/models/territoryWallet.model";
import { FranchiseProgram } from "../server/models/franchiseProgram.model";
import { FranchiseTerritoryAssignment } from "../server/models/franchiseTerritoryAssignment.model";
import { FranchiseCountry } from "../server/models/franchiseCountry.model";
import { FranchiseTerritory } from "../server/models/franchiseTerritory.model";
import { FranchiseSubTerritory } from "../server/models/franchiseSubTerritory.model";
import { distributeFranchiseProgramCommissions } from "../server/services/franchiseProgramCommission";

const uri = process.env.MONGODB_URI_TEST;
if (!uri) {
  console.log(
    "SKIPPED: set MONGODB_URI_TEST to a NON-prod database to run this e2e test."
  );
  process.exit(0);
}
if (/prod/i.test(uri)) {
  console.error("REFUSED: MONGODB_URI_TEST points at a 'prod' database.");
  process.exit(1);
}

const tag = "fr_e2e_" + Math.floor(Math.abs(Math.sin(42) * 1e9)); // stable-ish
const ids = {
  founder: new Types.ObjectId(),
  ownerSub: new Types.ObjectId(),
  ownerTer: new Types.ObjectId(),
  ownerCou: new Types.ObjectId(),
  office: new Types.ObjectId(),
  country: "fr_e2e_country",
  territory: "fr_e2e_territory",
  sub: "fr_e2e_sub",
  program: new Types.ObjectId(),
};

let pass = 0,
  fail = 0;
const check = (name: string, ok: boolean, extra = "") => {
  (ok ? pass++ : fail++, console.log(`  ${ok ? "✅" : "❌"} ${name}${extra ? "  " + extra : ""}`));
};

async function seed() {
  await User.create([
    { _id: ids.founder, email: `${tag}_founder@test.local`, name: "Founder" },
    { _id: ids.ownerSub, email: `${tag}_sub@test.local`, name: "SubOwner" },
    { _id: ids.ownerTer, email: `${tag}_ter@test.local`, name: "TerOwner" },
    { _id: ids.ownerCou, email: `${tag}_cou@test.local`, name: "CouOwner" },
  ]);
  await Organization.create({
    _id: ids.office,
    name: `${tag} Office`,
    country: "Testland",
    state: "TestState",
    city: "TestCity",
    postalCode: "99999",
  });
  // Office wallet pre-seeded with $100 gross (as if STEP 2 credited it).
  await StoreWallet.create({
    userId: ids.founder,
    orgId: ids.office,
    balance: 100,
    currency: "USD",
  });
  // Catalog chain.
  await FranchiseCountry.create({ _id: ids.country, name: "Testland", status: "taken" });
  await FranchiseTerritory.create({
    _id: ids.territory,
    name: "TestState",
    country: "Testland",
    parentId: ids.country,
    status: "taken",
  });
  await FranchiseSubTerritory.create({
    _id: ids.sub,
    name: "TestCity",
    country: "Testland",
    parentTerritory: "TestState",
    parentId: ids.territory,
    zipCodes: ["99999"],
    status: "taken",
  });
  // Program (active, 5/5/15) + assignments for all three levels.
  const future = new Date(Date.now() + 365 * 24 * 3600 * 1000);
  await FranchiseProgram.create({
    _id: ids.program,
    officeId: ids.office,
    founderUserId: ids.founder,
    status: "active",
    commissionConfig: { country: 5, territory: 5, subTerritory: 15 },
    subscription: { priceUSD: 650, period: "yearly", startedAt: new Date(), expiresAt: future },
  });
  const mk = (level: string, geoEntityId: string, ownerUserId: Types.ObjectId, ownerEmail: string) =>
    FranchiseTerritoryAssignment.create({
      programId: ids.program,
      officeId: ids.office,
      geoLevel: level,
      geoEntityId,
      geoEntityName: level,
      ownerUserId,
      ownerEmail,
      priceUSD: 650,
      assignedByUserId: ids.founder,
      status: "active",
      subscription: { startedAt: new Date(), expiresAt: future },
    });
  await mk("subTerritory", ids.sub, ids.ownerSub, `${tag}_sub@test.local`);
  await mk("territory", ids.territory, ids.ownerTer, `${tag}_ter@test.local`);
  await mk("country", ids.country, ids.ownerCou, `${tag}_cou@test.local`);
}

async function run() {
  const result = await distributeFranchiseProgramCommissions({
    sellerOrgId: ids.office,
    sellerId: ids.founder,
    sellerGrossAmount: 20,
    buyerUserId: ids.ownerSub,
    buyerAddress: { country: "Testland", state: "TestState", city: "TestCity", postalCode: "99999" },
    saleAmount: 20,
    platformFeeAmount: 1,
    platformFeePct: 5,
    currency: "USD",
    paymentId: `${tag}_pay`,
    itemType: "product",
    itemName: "E2E Item",
  });

  check("3 payouts applied", result.applied === 3, JSON.stringify(result.payouts));
  check("total paid = $5 (15%+5%+5% of $20)", result.totalPaidOut === 5);

  const [wSub, wTer, wCou, office] = await Promise.all([
    TerritoryWallet.findOne({ userId: ids.ownerSub }).lean(),
    TerritoryWallet.findOne({ userId: ids.ownerTer }).lean(),
    TerritoryWallet.findOne({ userId: ids.ownerCou }).lean(),
    StoreWallet.findOne({ userId: ids.founder, orgId: ids.office }).lean(),
  ]);
  check("sub owner credited $3", wSub?.balance === 3);
  check("territory owner credited $1", wTer?.balance === 1);
  check("country owner credited $1", wCou?.balance === 1);
  check("office wallet debited to $95", office?.balance === 95);
}

async function cleanup() {
  await Promise.all([
    User.deleteMany({ email: new RegExp("^" + tag) }),
    Organization.deleteOne({ _id: ids.office }),
    StoreWallet.deleteMany({ orgId: ids.office }),
    TerritoryWallet.deleteMany({
      userId: { $in: [ids.ownerSub, ids.ownerTer, ids.ownerCou] },
    }),
    FranchiseProgram.deleteOne({ _id: ids.program }),
    FranchiseTerritoryAssignment.deleteMany({ programId: ids.program }),
    FranchiseCountry.deleteOne({ _id: ids.country }),
    FranchiseTerritory.deleteOne({ _id: ids.territory }),
    FranchiseSubTerritory.deleteOne({ _id: ids.sub }),
    // Wipe any TerritoryWalletTransactions we wrote.
    mongoose.connection
      .collection("territorywallettransactions")
      .deleteMany({ franchiseProgramId: ids.program }),
  ]);
}

(async () => {
  await mongoose.connect(uri);
  console.log(`Connected to ${mongoose.connection.name}\n## Franchise e2e`);
  try {
    await cleanup(); // in case a prior run left residue
    await seed();
    await run();
  } catch (e) {
    console.error("ERROR", e);
    fail++;
  } finally {
    await cleanup();
    await mongoose.disconnect();
  }
  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
})();
