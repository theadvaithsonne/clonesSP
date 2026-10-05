# `components/webinar/BidsPanel.tsx`

> React component `BidsPanel`.

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Gavel`×3 (lucide-react), `Trophy` (lucide-react)

### Props

- **`BidsPanel`**: `auction: AuctionLot | null`, `bids: LotBid[]`, `meId?: string | null`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (BidsPanel)` | component | `BidsPanel({ auction, bids, meId, }: { auction: AuctionLot \| null; bid…)` — The bid ledger, in the sidebar. | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/api/auctionLot.ts` — `AuctionLot`, `LotBid`, `(types only)`
  - `lib/webinar/currency.ts` — `formatMoney`
- **Packages:**
  - `lucide-react` — `Gavel`, `Trophy`

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
