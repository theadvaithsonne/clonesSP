# `server/services/garageUniversityOnboarding.service.ts`

> Module exporting `parseOnboardingPatch`, `toOnboardingResponse`, `ensureOnboardingIndexes`, `getOnboarding` and 2 more.

**Kind:** backend service · **Lines:** 382

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ONBOARDING_LIMITS` | const | `= { /** goal, headline, location, status */ TEXT_MAX: 1000, /** interests, topics, workMo…` — Garage University onboarding profiles: checking what a client sends, and reading / creating / editing the signed-in user's own profile. | 23 |
| `ONBOARDING_WRITABLE_FIELDS` | const | `= [ "orgId", "step", "interests", "goal", "topics", "status", "details", "idCard", "photo…` — Fields a client may send. | 45 |
| `OnboardingError` | class | `extends Error` — An error the API reports as-is: `{ success: false, error, code, ...extra }` with `status`. | 65 |
| `OnboardingPatch` | type |  | 153 |
| `parseOnboardingPatch` | function | `parseOnboardingPatch(body: unknown): OnboardingPatch` — Check a POST / PATCH body and return the values to store, exactly as sent. | 168 |
| `OnboardingResponse` | interface |  | 190 |
| `toOnboardingResponse` | function | `toOnboardingResponse(doc: any): OnboardingResponse` — A stored profile as the API returns it. | 220 |
| `ensureOnboardingIndexes` | function | `ensureOnboardingIndexes(): Promise<void>` — Build the unique userId index once per process. | 258 |
| `OnboardingCaller` | interface |  | 271 |
| `getOnboarding` | function | `async getOnboarding(userId: string): Promise<OnboardingResponse \| null>` — The caller's profile, or null when they haven't started onboarding — a normal state for a new user, not an error. | 286 |
| `createOnboarding` | function | `async createOnboarding(caller: OnboardingCaller, body: unknown): Promise<OnboardingResponse>` — Create the caller's profile, optionally with answers. | 297 |
| `updateOnboarding` | function | `async updateOnboarding(caller: OnboardingCaller, body: unknown): Promise<OnboardingResponse>` — Change any answers. `details` merge key by key, so saving one detail keeps the rest. | 347 |

## Interfaces

- **Database (Mongoose models used):**
  - `GarageUniversityOnboarding` (server/models/garageUniversityOnboarding.model.ts) — reads: `findOne`; **writes:** `createIndexes`, `findOneAndUpdate`
  - `User` (server/models/user.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/garageUniversityOnboarding.model.ts` — `GarageUniversityOnboarding`, `IOnboardingFile`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`
  - `zod` — `z`

## Used by

- `server/controllers/garageUniversityOnboarding.controller.ts`
