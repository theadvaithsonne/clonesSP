# `server/services/pendingInvite.ts`

> Module exporting `savePendingInvite`, `lookupPendingInvite`, `pendingReferralFor`, `markPendingInviteUsed` and 1 more.

**Kind:** backend service · **Lines:** 142

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `INVITE_WINDOW_MS` | const | `= 30 * 24 * 60 * 60 * 1000` — How long an invite waits for its person. | 15 |
| `savePendingInvite` | function | `async savePendingInvite(id: ValidIdentifier, affiliateId: string): Promise<{ saved: boolean; existingAccount: boolea…` — Record "this person was invited by `affiliateId`". | 42 |
| `lookupPendingInvite` | function | `async lookupPendingInvite(id: ValidIdentifier): Promise<{ existing: boolean; sponsor: Awaited<Ret…` — What the app's login screen may show for a typed identifier. | 75 |
| `pendingReferralFor` | function | `async pendingReferralFor(id: ValidIdentifier): Promise<{ inviteId: string; affiliateId: string }…` — The affiliate code a verified sign-in should be credited to, when the client sent none. | 92 |
| `markPendingInviteUsed` | function | `markPendingInviteUsed(inviteId: string, userId: string): void` — Retire an invite once a verified sign-in has used it. | 105 |
| `allowInviteRequest` | function | `allowInviteRequest(bucket: "save" \| "lookup", caller: string): boolean` — Check-and-record one request for `bucket:caller`. | 124 |

## Interfaces

- **Database (Mongoose models used):**
  - `PendingInvite` (server/models/pendingInvite.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`, `updateOne`

## Dependencies

- **Internal:**
  - `server/models/pendingInvite.model.ts` — `PendingInvite`
  - `server/services/affiliate.ts` — `getSponsorCardByAffiliateId`
  - `server/services/identifier.ts` — `findUserByIdentifier`, `identifierValue`, `Identifier`
- **Packages:** none

## Used by

- `server/routes/auth.ts`
- `server/routes/public.ts`
