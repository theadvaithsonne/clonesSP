/**
 * audit-partial-fanout.ts — READ-ONLY diagnostic
 *
 * Scans CommissionDistribution rows since a given date and flags any CD whose
 * TerritoryWalletTransaction fan-out is missing one or more of the expected
 * geo-slice rows (subTerritory / territory / country).
 *
 * Expected slice count is computed per-CD from the org's + buyer's geo chain
 * AT SCAN TIME using the same resolvers `distributeTerritoryCommissions` uses.
 * Because ownership state may have shifted since the CD was written, the
 * "expected" figure is a lower bound; if it says a slice is missing today
 * (with current owners resolvable), it was almost certainly missing at
 * commit time too.
 *
 * Usage:
 *   npx tsx src/scripts/audit-partial-fanout.ts --since=2026-07-23
 *   npx tsx src/scripts/audit-partial-fanout.ts --since=2026-07-23 --limit=200
 *
 * No writes. Prints one line per problem CD:
 *   MISSING [sub,country] cd=<id> org=<name/id> buyer=<email>
 *     saleAmount=$X platformFee=$Y  actual=[territory]  expected=[sub,territory,country]
 */
import "dotenv/config";
import mongoose from "mongoose";

const round2 = (n: number) => Math.round(n * 100) / 100;

function arg(name: string, dflt?: string): string | undefined {
  const flag = `--${name}=`;
  const match = process.argv.find((a) => a.startsWith(flag));
  return match ? match.slice(flag.length) : dflt;
}

(async () => {
  const since = arg("since");
  const limit = parseInt(arg("limit", "500") || "500", 10);
  if (!since || isNaN(new Date(since).getTime())) {
    console.error("Usage: --since=YYYY-MM-DD [--limit=500]");
    process.exit(1);
  }
  const sinceDate = new Date(since);

  await mongoose.connect(process.env.MONGODB_URI!);
  const { CommissionDistribution } = await import(
    "../models/commissionDistribution.model"
  );
  const { TerritoryWalletTransaction } = await import(
    "../models/territoryWalletTransaction.model"
  );
  const { Organization } = await import("../models/organization.model");
  const { User } = await import("../models/user.model");
  const { FranchiseGlobalAssignment } = await import(
    "../models/franchiseGlobalAssignment.model"
  );
  const { resolveLeafFromOrg, resolveLeafFromAddress } = await import(
    "../utils/territoryResolver"
  );

  const pickEmail = (e: any) =>
    e ? (e.ownerEmail || "").trim().toLowerCase() : "";

  // Same rule as territoryCommission.ts::resolveOwnershipForCatalogEntity
  // AFTER the 2026-08-03 fix. Used to compute the "expected" plan.
  const resolveOwner = async (
    level: "subTerritory" | "territory" | "country",
    entity: any | null,
  ): Promise<string> => {
    if (!entity) return "";
    const entityId = entity._id != null ? String(entity._id) : "";
    if (!entityId) return pickEmail(entity);
    const a: any = await FranchiseGlobalAssignment.findOne({
      geoLevel: level,
      geoEntityId: entityId,
    })
      .select("status ownerEmail")
      .lean();
    if (!a) return pickEmail(entity);
    if (a.status === "active" && a.ownerEmail)
      return (a.ownerEmail || "").trim().toLowerCase();
    if (a.status === "pending_payment") return pickEmail(entity);
    return ""; // cancelled / paused_lapsed
  };

  const cds = await CommissionDistribution.find({
    createdAt: { $gte: sinceDate },
    platformFeeAmount: { $gt: 0 },
  })
    .select(
      "_id createdAt orgId customerId saleAmount platformFeeAmount itemType itemId",
    )
    .sort({ createdAt: 1 })
    .limit(limit)
    .lean<any[]>();

  console.log(
    `\nScanning ${cds.length} CDs since ${sinceDate.toISOString()} (limit=${limit})\n`,
  );

  let problemCount = 0;
  let totalMissingUsd = 0;

  for (const cd of cds) {
    const twts = await TerritoryWalletTransaction.find({
      relatedCommissionDistributionId: cd._id,
    })
      .select("originalSliceLevel amount")
      .lean<any[]>();
    const actual = new Set(twts.map((t) => t.originalSliceLevel));

    // Compute the expected plan using the same rules as
    // distributeTerritoryCommissions (post-fix).
    const orgChain = cd.orgId
      ? await resolveLeafFromOrg(String(cd.orgId))
      : null;
    if (!orgChain) continue; // no org → nothing to expect

    const buyer = cd.customerId
      ? await User.findById(cd.customerId)
          .select("country state city postalCode")
          .lean<any>()
      : null;
    const buyerSubRaw =
      buyer &&
      (buyer.country || buyer.state || buyer.city || buyer.postalCode)
        ? (
            await resolveLeafFromAddress({
              country: buyer.country,
              state: buyer.state,
              city: buyer.city,
              postalCode: buyer.postalCode,
            })
          ).subTerritory
        : null;

    const [subOwner, terrOwner, couOwner] = await Promise.all([
      resolveOwner("subTerritory", buyerSubRaw),
      resolveOwner("territory", orgChain.territory),
      resolveOwner("country", orgChain.country),
    ]);

    const expected = new Set<string>();
    if (subOwner) expected.add("subTerritory");
    if (terrOwner || couOwner) expected.add("territory"); // cascades to country if terr empty
    if (couOwner) expected.add("country");

    const missing: string[] = [];
    for (const lvl of ["subTerritory", "territory", "country"] as const) {
      if (expected.has(lvl) && !actual.has(lvl)) missing.push(lvl);
    }
    if (missing.length === 0) continue;

    problemCount += 1;
    const missingUsd = missing.reduce((s, lvl) => {
      const pct = lvl === "subTerritory" ? 15 : 5;
      return s + (cd.platformFeeAmount * pct) / 100;
    }, 0);
    totalMissingUsd = round2(totalMissingUsd + missingUsd);

    const org = cd.orgId
      ? await Organization.findById(cd.orgId).select("name").lean<any>()
      : null;
    const buyerEmail = buyer
      ? await User.findById(cd.customerId).select("email").lean<any>()
      : null;
    console.log(
      `MISSING [${missing.join(",")}] cd=${cd._id} org="${org?.name || "?"}" buyer=${buyerEmail?.email || "?"}\n` +
        `  createdAt=${cd.createdAt?.toISOString?.()} saleAmount=$${cd.saleAmount} platformFee=$${cd.platformFeeAmount}\n` +
        `  actual=[${[...actual].join(",") || "-"}]  expected=[${[...expected].join(",") || "-"}]  missingUsd=$${round2(missingUsd)}`,
    );
  }

  console.log(
    `\n=== Summary ===\nCDs scanned: ${cds.length}\nProblem CDs: ${problemCount}\nTotal missing commission (approx): $${totalMissingUsd}`,
  );

  await mongoose.disconnect();
})();
