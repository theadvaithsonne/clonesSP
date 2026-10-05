# `scripts/verify-franchise-logic.ts`

> Dependency-free self-check of the founder-franchise money rules (chain eligibility, buyer-address priority, slice clipping, markup split and coupon maths), run with tsx and printing pass/fail per case.

**Kind:** test script (no DB, no network) · **Lines:** 233

## Purpose
The founder franchise program pays country, territory and sub-territory owners a percentage of sales in their area, and sells territories with a $650 platform floor plus an optional founder markup. The decisions that move money are concentrated in two pure functions plus some arithmetic in the distributor and checkout. This script pins their expected behaviour as a quick, safe check that can run anywhere. Its DB-backed counterpart is `scripts/test-franchise-e2e.ts`. Despite the generic script label it touches no database.

## How it works
A small `eq(name, got, want)` helper compares `JSON.stringify` output and counts passes/failures; the script exits 1 if anything failed.

**`buildFranchiseChainPlan` (chain integrity, L30-L91)** with config `{ country: 5, territory: 5, subTerritory: 15 }`:
- all three levels assigned -> sub 15%, territory 5%, country 5% (in that order);
- territory missing above the sub -> only the sub earns (the chain breaks, country drops too);
- sub + territory, no country -> sub + territory;
- no sub assigned -> nobody earns, even if territory/country are assigned;
- a level configured at 0% is skipped.

**`resolveBuyerAddress` (L93-L138):** priority is invoice shipping address, then billing address, then the buyer's profile; returns `null` when nothing is usable; an address whose country is blank is skipped and falls through.

**Distributor guard (L140-L151):** a local `sliceAmount(gross, pct, available)` mirrors the distributor: percentage of seller gross rounded to 2 dp, clipped to the office wallet's available balance (never negative).

**Markup split (L153-L165):** with a $650 floor, `price - 650` is the excess: $0 at $650, $150 to the founder on an $800 sale (and again on each yearly renewal), $350 to the reseller on a $1,000 resale (one-time).

**Program coupon (L167-L187):** local copies of the percent/fixed discount maths (described as mirroring `calculateDiscount` in `services/platformCoupon.ts`): percent discounts are floored, optionally capped, and never exceed the amount; fixed discounts are capped at the amount.

**Territory coupon (L189-L228):** the discount applies only to the $650 floor; the founder/reseller markup is unaffected and the platform absorbs the discount. E.g. $800 territory at 20% off -> pay $670, founder $150, platform $520; at 100% off -> pay $150, platform $0.

Run: `npx tsx scripts/verify-franchise-logic.ts`.

## Exports
None.

## Dependencies
- **Internal:** `server/services/franchiseChainPlan.ts` - `buildFranchiseChainPlan`; `server/utils/buyerAddress.ts` - `resolveBuyerAddress`.

## Used by
Nothing imports it. Run manually with `npx tsx`; not part of the Jest suite.

## Notes
- Only the first two sections test real code. The slice, markup and coupon sections test local re-implementations of backend formulas, so they document intended behaviour but will not catch drift in `services/platformCoupon.ts` or the distributor.
