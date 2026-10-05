# `server/services/identifier.ts`

> Module exporting `classifyIdentifier`, `identifierQuery`, `identifierValue`, `identifierError` and 1 more.

**Kind:** backend service · **Lines:** 116

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IdentifierKind` | type | Decides whether a typed string is an email address or a phone number, and puts it in canonical form. | 26 |
| `Identifier` | type |  | 28 |
| `classifyIdentifier` | function | `classifyIdentifier(raw: unknown): Identifier` | 43 |
| `identifierQuery` | function | `identifierQuery(id: Identifier): FilterQuery<any>` — The Mongo filter that finds the user this identifier refers to. | 74 |
| `identifierValue` | function | `identifierValue(id: Identifier): string` — The canonical string for an identifier — what gets stored as the OtpCode key and echoed back to the client. | 86 |
| `identifierError` | function | `identifierError(id: Identifier): string` — Human-readable reason, safe to return to a client. | 93 |
| `findUserByIdentifier` | function | `async findUserByIdentifier(id: Identifier, select?: string): Promise<any \| null>` — Resolves the account an identifier refers to, or null. | 107 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `libphonenumber-js` — `parsePhoneNumberFromString`
  - `mongoose` — `FilterQuery`

## Used by

- `server/routes/auth.ts`
- `server/routes/public.ts`
- `server/services/pendingInvite.ts`
