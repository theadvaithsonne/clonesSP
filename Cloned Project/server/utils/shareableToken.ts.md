# `server/utils/shareableToken.ts`

> Module exporting `generateShareableToken`, `isValidShareableToken`.

**Kind:** backend utility · **Lines:** 47

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateShareableToken` | function | `generateShareableToken(): string` — Generate a shareable link token. | 28 |
| `isValidShareableToken` | function | `isValidShareableToken(token: string): boolean` — Validate token format. | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `crypto` — `randomInt`

## Used by

- `server/controllers/shareableLink.controller.ts`
