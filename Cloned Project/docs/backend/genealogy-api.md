# Genealogy API (/affiliate/genealogy/*)

Backs the NC web Genealogy page. Contract: NC web repo
`docs/superpowers/plans/2026-09-19-genealogy-backend.md` (Task 5/6 "Produces").

## Deploy
1. Deploy as usual (dist is committed).
2. **Sync the new indexes** (autoIndex is off in prod). Both models' indexes
   need syncing — run both commands:
   `npm run indexes:sync:prod -- GenealogySnapshot` and
   `npm run indexes:sync:prod -- GenealogySnapshotRun`.
3. Optional env: `GENEALOGY_SNAPSHOT_FIRST_PERIOD=YYYY-MM` (default 2026-09).
   The first snapshot runs on the 1st of the month after that period; until
   then `summary.activeDelta` is `null` and the page hides the Δ pill.

## Definitions (product decisions 2026-09-19)
- status label: lapsed > qualified (NC active + UP) > active (NC active) > inactive.
- NC active = getActivePaidSubscribers (Invoice-based); lapsed = owns an NC
  chain but not active (incl. free-month-only); never = no chain.
- Volume/PV = paid invoices in the calendar month (UTC), totalAmount − tax −
  shippingCost, converted to USD via fxService.
- Earnings are always the CALLER's, from the member: direct / level / infinity.

## Security
Every route: root ∈ {caller} ∪ caller's downline (403 NOT_YOUR_DOWNLINE),
member ∈ root's subtree (404). Contact details only for the caller's directs.
The legacy downline endpoints (downline-table?rootUserId, direct-children,
user-info, downline/:id/*) are still unguarded — separate follow-up.

## Contract notes
- GNode includes `volumeUsd` (this month's personal volume, USD ex-GST).
- `summary.fromCaller` is added: the root's `{ leg, level }` relative to the
  calling user, or `null` when the caller is the root.
- The `/search` product facet is OR within the facet (matching any listed
  product is enough, not all of them).
- A date-only `joinedTo` (`YYYY-MM-DD`) is inclusive of the whole day.
- Top-ups (`store_wallet_topup` / `auction_wallet_topup` line items, or any
  invoice with `metadata.kind === "topup"`) are excluded from volume and
  from products bought.
- The "Newest" leg sort = the head's `joinedAt`.
