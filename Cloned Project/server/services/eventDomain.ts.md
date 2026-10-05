# `server/services/eventDomain.ts`

> src/services/eventDomain.ts

**Kind:** backend service · **Lines:** 70

<!-- docgen:auto -->

## Purpose
src/services/eventDomain.ts

Hostname hygiene for event custom domains.

Attaching and verifying a domain is the org-wide app-domain flow in
routes/initialSetup.ts — the same one whitelabel uses, which registers the
host with Vercel so a certificate is issued. This module only holds the one
rule that is specific to events: the host must not be one of ours.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `normaliseHost` | function | `normaliseHost(input: string): { ok: true; host: string } \| { ok: false; error: …` — Normalise and sanity-check what the organizer typed. | 37 |

## Interfaces

- **Environment variables (`process.env`):** `APP_URL`

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/routes/eventManagement.ts`
