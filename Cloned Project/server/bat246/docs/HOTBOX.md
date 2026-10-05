# BAT246 Hot Box

## What Is the Hot Box?

The Hot Box is a display panel on every board that shows recent card-earning events. Each time a player earns a Gold, Black, or Brown card, an entry is appended — logging the player and the card type. It acts as a live leaderboard of who earned what on this board.

---

## Data Model

**Schema:** `HotBoxEntrySchema` in `bat246Board.model.ts:65-76`

```typescript
{
  cardType:   String  // "Gold" | "Black" | "Brown" | "Gray" | "Green"  (required)
  playerId:   ObjectId → bat246Players                                   (required)
  assignedAt: Date                                                       (required)
}
```

**On the board document:** `hotBox: HotBoxEntrySchema[]` (default `[]`)

**Note:** "Gray" and "Green" exist in the enum but are never written by any code path. Only Gold, Black, and Brown are actually used.

**Enriched response** (`getBoardById` in `bat246.service.ts:159-165`): the raw `playerId` is joined to a `playerName` (player's `nickname` or `email`) and the board-slot `entryNo`. Both fields are returned to the frontend; only `playerName` is currently rendered.

---

## All Code Paths That Add a HotBox Entry

### 1. Gold — AT BAT referrer's first qualifying referral
**Function:** `maybeAutoPlaceAtBatReferral` — `bat246.service.ts:471-474`
**Trigger:** A new user joins via an AT BAT player's invite link and the AT BAT player has not yet earned a card
**Condition:** `atBat[i].cardType === null` — atomic update, runs only once
**Update:**
```
$set  atBat[i].cardType = "Gold"
$push hotBox { cardType: "Gold", playerId: atBatPlayer._id, assignedAt: now }
```

---

### 2. Gold — 1st Base player earns Gold via Approve button
**Function:** `maybeAwardGoldToApprover` — `bat246.service.ts:533-539`
**Trigger:** A 1st Base player clicks Approve on their 3rd referral (when `salesCredits >= 2` and no card yet)
**Condition:** `firstBase[i].salesCredits >= 2 && !firstBase[i].cardType`
**Update:**
```
$set  firstBase[i].cardType = "Gold"
$push hotBox { cardType: "Gold", playerId: callerPlayer._id, assignedAt: now }
```

---

### 3. Gold / Black / Brown — Dugout player promoted after Protection Period
**Function:** `promoteDugoutAfterPP` — `bat246Entry.service.ts:822-876`
**Trigger:** A Dugout player's Protection Period expires and they are promoted to AT BAT
**Logic (priority order):**

| Referrer Position | Card Awarded | Condition |
|---|---|---|
| 1st Base (`firstBase[i]`) | **Gold** | `salesCredits >= 2 && !cardType` |
| 2nd Base A/B or 3rd Base | **Black** | referrer sits in one of those slots |
| Home Plate | **Brown** | referrer is the HP occupant |

**Update (example — Black/Brown share the same $push):**
```
$set  <position>.cardType = "Black"|"Brown"  (first time only)
$set  <position>.blackCards++  OR  brownCards++
$push hotBox { cardType: <derived from cardEarnedType>, playerId: referrer._id, assignedAt: now }
```
`cardEarnedType` is set to `"black"` or `"brown"` before the `$push`, so the hotBox entry reflects the correct card. *(Bug was here — fixed: previously always pushed "Black" even for Brown.)*

---

### 4. Black / Brown — Admin manual dugout promotion
**Function:** `promoteDugoutToAtBat` — `bat246Admin.service.ts:342-386`
**Trigger:** Admin calls `POST /boards/:id/fix-dugout`
**Logic:** Same referrer priority as #3 above (no Gold path — admin promotion doesn't check 1st Base)
**Update:** Identical `$push` pattern using `cardEarnedType` to derive the hotBox card type.

---

## What Never Adds a HotBox Entry

| Card | Reason |
|---|---|
| Green | Awarded to AT BAT recruiter at time of 1st Base placement — no hotBox write |
| Gray | 1/3 split bonus — tracked on slot only, no hotBox write |
| Gold (AT BAT first referral via generic invite) | No hotBox write — only `$set cardType` + player `$inc` |

---

## Removal / Lifecycle

**Entries are never removed from an active board.** They accumulate for the life of the board.

On board split (`bat246Split.service.ts`), each child board is initialized with `hotBox: []`. The parent board retains its full history.

There is no admin endpoint to clear or edit hotBox entries directly.

---

## Frontend Rendering

**Component:** `BoardLayout.tsx:784-813`
**Position:** Overlay panel, top-right corner of the field view

**Layout:**
```
┌─────────────────┐
│    HOT BOX      │  ← varsity font, yellow header
├─────────────────┤
│ 🟡  PlayerName  │  ← Gold entries
│ ⬛  PlayerName  │  ← Black entries
│ 🟫  PlayerName  │  ← Brown entries
│ (empty row)     │  ← Gray (never populated in practice)
└─────────────────┘
```

**Per-type rendering:** `board.hotBox.filter(h => h.cardType === ct)` — each matching entry gets its own row with a `CardCase` icon + `entry.playerName`. Empty types render a blank row to maintain fixed panel height.

**Field used:** Only `playerName` is displayed. `entryNo` and `assignedAt` are returned by the API but not yet rendered.

---

## Known Issues / Design Notes

| # | Issue | Status |
|---|---|---|
| 1 | Brown promoted as "Black" in hotBox | **Fixed** (bat246Entry.service.ts:876, bat246Admin.service.ts:385) |
| 2 | Entries never removed — grow unbounded on long-lived boards | By design; only cleared on split |
| 3 | No deduplication — a retry of `promoteDugoutAfterPP` can push a duplicate entry | Open |
| 4 | `playerName` silently renders blank if player record is deleted | Open |
| 5 | "Green" and "Gray" in schema enum but never written | Dead code — consider removing |
| 6 | `assignedAt` and `entryNo` fetched and enriched but not shown in UI | Pending UI decision |

---

## Files

| File | Role |
|---|---|
| `src/bat246/models/bat246Board.model.ts:65-76` | HotBoxEntrySchema definition |
| `src/bat246/services/bat246.service.ts:106-165` | `getBoardById` — joins playerName + entryNo |
| `src/bat246/services/bat246.service.ts:471-495` | Gold hotBox push (AT BAT referrer) |
| `src/bat246/services/bat246.service.ts:533-539` | Gold hotBox push (1st Base Approve) |
| `src/bat246/services/bat246Entry.service.ts:822-876` | Gold/Black/Brown hotBox push (PP expiry) |
| `src/bat246/services/bat246Admin.service.ts:342-386` | Black/Brown hotBox push (admin promote) |
| `frontend/components/bat246/BoardLayout.tsx:784-813` | HOT BOX panel rendering |
