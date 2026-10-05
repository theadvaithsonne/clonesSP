# `server/services/accountMerge.ts`

> Module exporting `mergePhoneAccountInto`.

**Kind:** backend service · **Lines:** 248

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MergeOutcome` | type | Merging a throwaway phone-signup account into the caller's real account. | 35 |
| `mergePhoneAccountInto` | function | `async mergePhoneAccountInto(throwawayId: string, targetId: string): Promise<MergeOutcome>` — Moves the verified phone from `throwawayId` onto `targetId` and deletes the throwaway. | 190 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `updateOne`, `updateMany`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/twoFactorSms.ts` — `storablePhone`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/auth.ts`
