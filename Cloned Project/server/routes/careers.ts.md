# `server/routes/careers.ts`

> Express router with 8 endpoints, mounted at `/careers`.

**Kind:** Express router · **Lines:** 199 · **Mounted at:** `/careers` (browser: `/backend/careers`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (8)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/vacancies` | `/backend/careers/vacancies` | — | inline | 13 |
| GET | `/vacancies/:id` | `/backend/careers/vacancies/:id` | — | inline | 31 |
| POST | `/vacancies` | `/backend/careers/vacancies` | `requireAuth` | inline | 43 |
| PATCH | `/vacancies/:id` | `/backend/careers/vacancies/:id` | `requireAuth` | inline | 77 |
| DELETE | `/vacancies/:id` | `/backend/careers/vacancies/:id` | `requireAuth` | inline | 98 |
| POST | `/applications` | `/backend/careers/applications` | — | inline | 118 |
| GET | `/applications` | `/backend/careers/applications` | `requireAuth` | inline | 149 |
| PATCH | `/applications/:id` | `/backend/careers/applications/:id` | `requireAuth` | inline | 170 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 198 |

## Interfaces

- **Database (Mongoose models used):**
  - `Vacancy` (server/models/vacancy.model.ts) — reads: `find`, `findById`; **writes:** `create`, `findOneAndUpdate`, `findOneAndDelete`
  - `Application` (server/models/application.model.ts) — reads: `find`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`
  - `server/models/vacancy.model.ts` — `Vacancy`
  - `server/models/application.model.ts` — `Application`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/careers`.
