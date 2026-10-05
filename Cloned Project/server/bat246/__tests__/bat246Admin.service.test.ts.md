# `server/bat246/__tests__/bat246Admin.service.test.ts`

> Jest unit tests for `assignSlot` in the BAT246 admin service. They cover adding the assigned user to the BAT246 organisation and the function's validation errors.

**Kind:** test · **Lines:** 182

## Purpose
`assignSlot(boardId, position, garageUserId)` in `server/bat246/services/bat246Admin.service.ts` puts a Garage user into a board slot. As a side effect it adds the user to the organisation that owns the product tagged `bat246_entry`, so the game appears in their sidebar. These tests confirm three things: the organisation add happens, it uses that product's `organizationId` with role `member`, and a failure there never aborts the slot assignment.

## How it works
- **Fixtures (L9-L37):** a pending `mockBoard` with empty slots, a `mockPlayer`, a `mockUser`, and a `mockProduct` carrying a fresh `organizationId`. These are made-up test values.
- **Model mocks (L40-L74):** `Bat246Board` (`findById`, `updateOne`), `Bat246Player`, `Bat246PlayerBoard`, `User` (`findById`, `updateOne`) and `Product.findOne`.
- **`setupHappyPath()`** wires these mocks so that `User.findById().lean()` and `Product.findOne().select().lean()` resolve to the fixtures.
- **"org membership" cases:**
  - `User.updateOne` is called with `$addToSet.organizations`.
  - The added entry's `organization` equals the product's `organizationId` and its `role` is `"member"`.
  - When the product lookup returns `null`, no organisation update happens and the call still resolves.
  - When `Product.findOne` throws, the call still resolves.
- **"validation" cases:**
  - A non-pending board should throw `"Only pending boards can be configured"`.
  - A missing board throws `"Board not found"`.
  - A missing user throws `"Garage user not found"`.

## Used by
Run by Jest through `npm test`. `jest.config.js` includes the `server/bat246/__tests__` root. Nothing imports this file.

## Notes
- **Out of date with the service:**
  - `assignSlot` now accepts boards in either `pending` or `active` status, and throws `"Board is not in a configurable state"` otherwise. The "throws if board is not in pending status" case therefore no longer matches: an `active` board does not throw, and the expected message text no longer exists anywhere in `server/`.
  - `assignSlot` now also upserts `Bat246Distributor` and calls helpers such as `findOrCreatePlayerForUser` and `resolveCountryOrigin`, none of which this test mocks. The `Bat246Distributor` upsert is inside a try/catch, but against an unconnected Mongoose model it may wait on command buffering. Expect these tests to need updating before they pass reliably.
