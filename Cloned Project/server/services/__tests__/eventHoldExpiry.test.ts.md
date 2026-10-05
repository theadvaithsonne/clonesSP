# `server/services/__tests__/eventHoldExpiry.test.ts`

> Seat-hold expiry — an unpaid checkout's seats go back on sale only once its invoice is closed, so nobody can pay for a seat that has been resold.

**Kind:** test · **Lines:** 122

<!-- docgen:auto -->

## Purpose
Seat-hold expiry — an unpaid checkout's seats go back on sale only once its
invoice is closed, so nobody can pay for a seat that has been resold.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (5)

- **releaseExpiredHolds**
  - cancels the unpaid invoice before handing the seats back
  - cancels a multi-seat order's invoice once
  - leaves the seats held when the invoice was paid in the meantime
  - keeps the hold while a payment is in flight
  - still releases a hold whose invoice is already closed or missing

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/eventManagement.ts` — `releaseExpiredHolds`
- **Packages:**
  - `mongoose` — `Types`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
