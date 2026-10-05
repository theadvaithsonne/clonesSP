# `server/services/__tests__/counterBill.sync.test.ts`

> Counter-bill status sync — how a sent bill learns it was paid, expired, cancelled, or (for a split bill) how many of its shares are in.

**Kind:** test · **Lines:** 98

<!-- docgen:auto -->

## Purpose
Counter-bill status sync — how a sent bill learns it was paid, expired,
cancelled, or (for a split bill) how many of its shares are in.

Every payment path marks the invoice paid before fulfilment runs, so the
invoice is the source of truth; these pin the mapping from it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (5)

- **syncBills**
  - marks a bill paid when its invoice is paid, and retires its QR
  - treats a lapsed expiresAt as expired even before the expiry cron runs
  - leaves an unpaid, unexpired bill alone
  - counts split shares as they're paid and closes the bill on the last one
  - ignores drafts and bills that are already closed

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/counterBill.ts` — `syncBills`
- **Packages:**
  - `mongoose` — `Types`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
