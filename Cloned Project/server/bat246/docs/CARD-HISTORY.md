# Card-Earning History Feature

## Overview

When a player earns a card (Gold, Black, Brown, or Green), the system now records **who was referred** to trigger that card. Hovering over any card in the board UI shows a tooltip with the full earning history for that card type.

## How It Works

### Data Model

`Bat246SalesCredit` gains three new optional fields:

| Field | Type | Description |
|---|---|---|
| `referredUserId` | ObjectId | Bat246Player `_id` of the person whose action earned this card |
| `referredUserName` | String | Display name (denormalized for fast reads) |
| `boardTrackingNumber` | String | Board identifier (e.g. `6-1003 R`) — avoids a join at read time |

Old records have `null` in these fields and display "Earned before tracking was added" in the UI.

-----

## Card-Earning Paths Covered

| Card | Function | File | Referred User = |
|---|---|---|---|
| Gold (AT BAT) | `maybeAutoPlaceAtBatReferral` | `bat246.service.ts` | Person placed in Dugout |
| Gold (1st Base Approve) | `maybeAwardGoldToApprover` | `bat246.service.ts` | Person placed via Approve button |
| Gold (Dugout promoted) | `promoteDugoutAfterPP` | `bat246Entry.service.ts` | Dugout player being promoted |
| Black (Dugout promoted) | `promoteDugoutAfterPP` | `bat246Entry.service.ts` | Dugout player being promoted |
| Brown (Dugout promoted) | `promoteDugoutAfterPP` | `bat246Entry.service.ts` | Dugout player being promoted |
| Black (Admin promote) | `promoteDugoutToAtBat` | `bat246Admin.service.ts` | Dugout player being promoted |
| Brown (Admin promote) | `promoteDugoutToAtBat` | `bat246Admin.service.ts` | Dugout player being promoted |
| Green (Reservation) | `placeUserFromReservation` | `bat246.service.ts` | Person placed in AT BAT |
| Green (Notification) | `placeUserAtPosition` | `bat246.service.ts` | Person placed in AT BAT |

---

## API Endpoint

```
GET /bat246/players/:playerId/card-history
```

**Auth:** Required (`requireAuth` middleware)

**Query params:**
- `cardType` *(optional)* — filter by card type. Values: `Gold`, `Black`, `Brown`, `Green`, `Gray`

**Response:**
```json
[
  {
    "cardType": "Black",
    "earnedAt": "2026-06-17T08:51:01.000Z",
    "boardTrackingNumber": "6-1003",
    "referredUserId": "6a31ac2cb8acc36222e7bdf8",
    "referredUserName": "Charlie Davis",
    "position": "secondBaseA"
  }
]
```

Sorted by `earnedAt` ascending (oldest first) so `#1`, `#2` are chronological.

**`playerId`** is the `Bat246Player._id` of the card **earner** (not the referred person).

---

## Frontend Behaviour

### Where tooltips appear

| Location | `playerId` source |
|---|---|
| Leaderboard bars (`BoardLayout.tsx`) | `row.playerId` |
| Base card slots (`BaseCard.tsx`) | `slot.playerId` |
| Home Plate card (`HomePlateCard.tsx`) | `slot.playerId` |

### Tooltip states

| State | Display |
|---|---|
| Loading (first hover, ≤150 ms debounce) | Spinner + "Loading..." |
| Has history | Numbered list: `#1  Board 6-1003 · Jun 17, 2026 · Referred Charlie Davis` |
| `referredUserName` is null | "Earned before tracking was added" |
| Empty array | "Earned before tracking was added" |
| Network / auth error | "Details unavailable" |

### Caching

Results are stored in a **module-level `Map<string, CardEarningEvent[]>`** keyed by `${playerId}:${cardType}`. Repeated hovers return instantly without a network call. Cache is cleared on page reload (no stale-data risk since this is game history, which never changes).

### AbortController

Each hover start attaches an `AbortController`. On hover end (or component unmount), the in-flight fetch is aborted and the 150 ms debounce timer is cleared. No dangling state updates possible.

---

## Error Resilience

- **Card history creation never breaks card awarding.** Gold/Black/Brown SalesCredit creates are wrapped in `try/catch`; failures are logged but never propagate to the caller.
- **Green SalesCredit creation** follows the existing pattern (awaited inline); adding the new fields does not change failure semantics.
- **`maybeAutoPlaceAtBatReferral` and `maybeAwardGoldToApprover`** use fire-and-forget `Promise.then().catch()` so a failed SalesCredit write cannot make the placement route return a 4xx.

---

## Backfill Note

Existing players have correct data in `slot.blackCards` / `slot.brownCards` / `slot.cardType` on the board document, but their `cardsEarned` and `SalesCredit` records pre-date this feature and therefore have `referredUserName = null`. The UI handles this gracefully. A backfill script can be written if historical tracking is needed.
