# `server/services/channelMembershipEvent.ts`

> Emit ChannelMembershipEvent rows for the founder Unsub Log.

**Kind:** backend service · **Lines:** 556

<!-- docgen:auto -->

## Purpose
Emit ChannelMembershipEvent rows for the founder Unsub Log.

Two entry points:
  emitUnsubscribeEvent()  fires from services/feed.ts:unsubscribeFromChannel
                           for all three branches (free / one-time / recurring).
  emitExpiredEvents()      fires from the sweeper in index.ts when it
                           flips "cancelling this cycle" members to
                           fully expired. Bulk-friendly — pass every
                           membership that got flipped in the same
                           update, and this inserts one event per row.

Both entry points are best-effort: they log and swallow errors so a
broken log write can't take down a cancel or the daily sweeper.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `emitUnsubscribeEvent` | function | `async emitUnsubscribeEvent(args: EmitUnsubscribeEventArgs): Promise<void>` | 106 |
| `emitExpiredEvents` | function | `async emitExpiredEvents(memberships: ExpiredMembershipInput[]): Promise<void>` — One-shot bulk insert for the sweeper. | 182 |
| `emitPaymentDefaultedEvents` | function | `async emitPaymentDefaultedEvents(inputs: PaymentDefaultedInput[]): Promise<void>` | 303 |
| `emitWorkshopUnsubscribeEvent` | function | `async emitWorkshopUnsubscribeEvent(args: EmitWorkshopUnsubscribeArgs): Promise<void>` — Emit an `unsubscribed` MembershipEvent for a workshop cancel — full or per-session. | 500 |

## Interfaces

- **Database (Mongoose models used):**
  - `ChannelMembershipEvent` (server/models/channelMembershipEvent.model.ts) — reads: `find`; **writes:** `create`, `insertMany`

## Dependencies

- **Internal:**
  - `server/models/channelMembershipEvent.model.ts` — `ChannelMembershipEvent`
  - `server/utils/exchangeRate.ts` — `convertToUsd`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/index.ts`
- `server/routes/workshop.ts`
- `server/services/feed.ts`
