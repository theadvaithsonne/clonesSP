# `server/services/adminVerification.ts`

> Step-up verification for the garage admin console ("Verify your admin").

**Kind:** backend service · **Lines:** 195

<!-- docgen:auto -->

## Purpose
Step-up verification for the garage admin console ("Verify your admin").

The console's only login factor is an emailed OTP, and the JWT it mints
lives for 7 days in localStorage — so a lifted token is a week of
unrestricted admin access. This adds a second, out-of-band question that
has to be answered once per login before the admin APIs will answer.

Getting it wrong signs you out rather than locking the account. That is
not the softer option — it's the stronger one:

  - There is no lockout state to strand the only super admin in.
  - The sign-out is real. Exhausting the attempts stamps
    `sessionsInvalidatedAt` on the admin, which kills every token issued
    before that instant — including the one the guesser is holding.
    Clearing localStorage alone would do nothing to an attacker.
  - So each round of guesses costs a fresh OTP delivered to the admin's […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_ATTEMPTS` | const | `= 3` — Wrong answers allowed per login before the session is destroyed. | 39 |
| `AdminVerificationQuestion` | interface |  | 41 |
| `AdminVerificationState` | interface |  | 47 |
| `normalizeAnswer` | function | `normalizeAnswer(raw: string): string` — Fold away the differences a human can't see: case, surrounding and repeated whitespace, and punctuation. | 62 |
| `hashAnswer` | function | `async hashAnswer(raw: string): Promise<string>` | 99 |
| `answerMatches` | function | `async answerMatches(raw: string, answerHash: string): Promise<boolean>` | 105 |
| `gateEnforced` | function | `gateEnforced(): boolean` — The global off switch — recovery path if this ever goes wrong in prod. | 118 |
| `isGated` | function | `isGated(state?: AdminVerificationState \| null): boolean` — Whether this admin is gated at all. | 129 |
| `listQuestions` | function | `listQuestions(state?: AdminVerificationState \| null): { id: string; prompt: string }[]` — Every question's prompt, in a stable order, with the hashes stripped. | 141 |
| `VerifyOutcome` | type |  | 147 |
| `evaluateAnswer` | function | `async evaluateAnswer(state: AdminVerificationState, questionId: string, rawAnswer: string): Promise<{ outcome: VerifyOutcome; next: AdminVeri…` — Check one answer and fold the attempt counter forward. | 158 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.ADMIN_VERIFY_PEPPER`, `env.JWT_SECRET`, `env.ADMIN_VERIFY_ENFORCE`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `bcryptjs`
  - `crypto`

## Used by

- `server/middleware/garageAdminAuth.ts`
- `server/routes/garageAdminVerify.ts`
- `server/scripts/set-admin-verification.ts`
