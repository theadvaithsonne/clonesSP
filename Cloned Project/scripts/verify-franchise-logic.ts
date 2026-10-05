/**
 * Dependency-free verification of the founder-franchise pure logic.
 * No DB, no network — run with:  npx tsx scripts/verify-franchise-logic.ts
 *
 * Covers the two functions that make the money decisions:
 *   - buildFranchiseChainPlan  (chain-integrity)
 *   - resolveBuyerAddress      (buyer-location priority)
 * plus the seller-gross overspend/clip arithmetic the distributor relies on.
 */
import { buildFranchiseChainPlan } from "../server/services/franchiseChainPlan";
import { resolveBuyerAddress } from "../server/utils/buyerAddress";

let passed = 0;
let failed = 0;

function eq(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got);
  const w = JSON.stringify(want);
  if (g === w) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}\n       got:  ${g}\n       want: ${w}`);
  }
}

const CFG = { country: 5, territory: 5, subTerritory: 15 };

console.log("\n## buildFranchiseChainPlan (chain-integrity)");

// Full chain owned → 15/5/5.
eq(
  "all three assigned → sub+territory+country",
  buildFranchiseChainPlan(
    { country: true, territory: true, subTerritory: true },
    CFG
  ),
  [
    { level: "subTerritory", splitPct: 15 },
    { level: "territory", splitPct: 5 },
    { level: "country", splitPct: 5 },
  ]
);

// Sub owned, territory above NOT owned → only sub earns.
eq(
  "sub only assigned → sub only (territory/country drop)",
  buildFranchiseChainPlan(
    { country: true, territory: false, subTerritory: true },
    CFG
  ),
  [{ level: "subTerritory", splitPct: 15 }]
);

// Sub + territory owned, country not → sub + territory.
eq(
  "sub+territory assigned, no country → sub+territory",
  buildFranchiseChainPlan(
    { country: false, territory: true, subTerritory: true },
    CFG
  ),
  [
    { level: "subTerritory", splitPct: 15 },
    { level: "territory", splitPct: 5 },
  ]
);

// No sub in chain → nothing, even if territory/country assigned (matches global
// "territory-leaf with no subs earns nothing").
eq(
  "no sub assigned → empty (territory/country cannot earn)",
  buildFranchiseChainPlan(
    { country: true, territory: true, subTerritory: false },
    CFG
  ),
  []
);

// Zero-config levels are skipped even when assigned.
eq(
  "0% config on a level is skipped",
  buildFranchiseChainPlan(
    { country: true, territory: true, subTerritory: true },
    { country: 0, territory: 5, subTerritory: 15 }
  ),
  [
    { level: "subTerritory", splitPct: 15 },
    { level: "territory", splitPct: 5 },
  ]
);

console.log("\n## resolveBuyerAddress (priority: shipping → billing → profile)");

eq(
  "shipping wins over billing + profile",
  resolveBuyerAddress(
    {
      shippingAddress: { country: "India", state: "Karnataka", city: "Bengaluru", postalCode: "560001" },
      billingAddress: { country: "USA", state: "NY", city: "NYC", postalCode: "10001" },
    },
    { country: "UK", state: "X", city: "Y", postalCode: "Z" }
  ),
  { country: "India", state: "Karnataka", city: "Bengaluru", postalCode: "560001" }
);

eq(
  "billing used when no shipping",
  resolveBuyerAddress(
    { billingAddress: { country: "USA", state: "NY", city: "NYC", postalCode: "10001" } },
    { country: "UK" }
  ),
  { country: "USA", state: "NY", city: "NYC", postalCode: "10001" }
);

eq(
  "buyer profile fallback when invoice has no address",
  resolveBuyerAddress(
    {},
    { country: "India", state: "Telangana", city: "Hyderabad", postalCode: "500001" }
  ),
  { country: "India", state: "Telangana", city: "Hyderabad", postalCode: "500001" }
);

eq(
  "null when nothing usable",
  resolveBuyerAddress({}, null),
  null
);

eq(
  "address with blank country is skipped (falls through to profile)",
  resolveBuyerAddress(
    { shippingAddress: { country: "  ", state: "", city: "", postalCode: "" } },
    { country: "Canada" }
  ),
  { country: "Canada", state: undefined, city: undefined, postalCode: undefined }
);

console.log("\n## overspend/clip arithmetic (distributor guard)");

const round2 = (n: number) => Math.round(n * 100) / 100;
function sliceAmount(gross: number, pct: number, available: number) {
  const raw = round2((gross * pct) / 100);
  return round2(Math.min(raw, Math.max(0, available)));
}

eq("15% of $20 gross, ample balance", sliceAmount(20, 15, 100), 3);
eq("slice clipped to available balance", sliceAmount(20, 15, 1.5), 1.5);
eq("zero balance → zero slice", sliceAmount(20, 15, 0), 0);
eq("sub-cent rounds to 2dp", sliceAmount(0.05, 15, 100), 0.01);

console.log("\n## markup split ($650 floor → platform, excess → seller/reseller)");

const FLOOR = 650;
const markupExcess = (pricePaidUSD: number) =>
  Math.round((pricePaidUSD - FLOOR) * 100) / 100;

eq("$650 sale → $0 excess (all to platform)", markupExcess(650), 0);
eq("original sale $800 → $150 excess to founder (year 1)", markupExcess(800), 150);
eq("resale $1000 → $350 excess to reseller (one-time at transfer)", markupExcess(1000), 350);
// Recurring full price: renewals re-bill the same price, so the excess recurs
// to the founder every year (the resale transaction's reseller credit is the
// only one-time exception).
eq("renewal of $800 territory → $150 excess to founder (recurs yearly)", markupExcess(800), 150);

console.log("\n## franchise coupon — discount on the $650 program enroll");

// Mirrors services/platformCoupon.ts calculateDiscount: percent → (amount*pct)/100
// capped at maxDiscount and at the amount; fixed → min(value, amount).
const FLOOR_CENTS = 650 * 100;
const pctDiscount = (amount: number, pct: number, capCents?: number) => {
  let d = Math.floor((amount * pct) / 100);
  if (capCents != null) d = Math.min(d, capCents);
  return Math.min(d, amount);
};
const fixedDiscount = (amount: number, valueCents: number) =>
  Math.min(valueCents, amount);

eq("20% off $650 → $130 discount → pay $520",
  FLOOR_CENTS - pctDiscount(FLOOR_CENTS, 20), 520 * 100);
eq("$700 fixed off $650 → capped to $650 → free",
  FLOOR_CENTS - fixedDiscount(FLOOR_CENTS, 700 * 100), 0);
eq("50% off with $100 max-cap → $100 off → pay $550",
  FLOOR_CENTS - pctDiscount(FLOOR_CENTS, 50, 100 * 100), 550 * 100);
eq("100% off $650 → free",
  FLOOR_CENTS - pctDiscount(FLOOR_CENTS, 100), 0);

console.log("\n## franchise TERRITORY coupon — discounts the $650 floor only");

// Mirrors backend: discount base = min(price, $650 floor); discount subtracted
// from the FULL price; founder markup = price − 650 (coupon-independent),
// platform keeps (paid − markup).
const territoryOutcome = (priceUSD: number, pct: number) => {
  const priceC = priceUSD * 100;
  const baseC = Math.min(priceC, FLOOR_CENTS); // floor base
  const discountC = pctDiscount(baseC, pct);
  const paidC = priceC - discountC;
  const markupC = Math.max(0, priceC - FLOOR_CENTS); // founder/reseller, from price
  const platformC = paidC - markupC; // platform absorbs the discount
  return {
    paid: paidC / 100,
    founder: markupC / 100,
    platform: platformC / 100,
  };
};

// $800 territory, 20% coupon → 20% of $650 = $130 off → pay $670;
// founder still gets $150; platform keeps $520.
eq("$800 territory, 20% off → pay $670", territoryOutcome(800, 20).paid, 670);
eq("$800 territory, 20% off → founder keeps $150", territoryOutcome(800, 20).founder, 150);
eq("$800 territory, 20% off → platform gets $520", territoryOutcome(800, 20).platform, 520);

// 100% coupon zeroes the floor only: pay = markup, platform = 0, founder full.
eq("$800 territory, 100% off → pay $150 (markup only)", territoryOutcome(800, 100).paid, 150);
eq("$800 territory, 100% off → founder still $150", territoryOutcome(800, 100).founder, 150);
eq("$800 territory, 100% off → platform $0", territoryOutcome(800, 100).platform, 0);

// Exactly-$650 territory (no markup) behaves like the program coupon.
eq("$650 territory, 20% off → pay $520", territoryOutcome(650, 20).paid, 520);
eq("$650 territory, 20% off → founder $0", territoryOutcome(650, 20).founder, 0);

// RESALE uses the same floor-only math; the markup goes to the RESELLER
// (one-time) instead of the founder, but the numbers are identical.
const resale = territoryOutcome(1000, 20); // resale price $1000, 20% floor coupon
eq("resale $1000, 20% off → new owner pays $870", resale.paid, 870);
eq("resale $1000, 20% off → reseller keeps $350 markup", resale.founder, 350);
eq("resale $1000, 20% off → platform gets $520", resale.platform, 520);

console.log(`\n${"=".repeat(48)}`);
console.log(`RESULT: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
