# `server/note-taker/distribution/email-sender.ts`

> Module exporting `sendEmail`.

**Kind:** Note-Taker module — distribution · **Lines:** 53

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SendEmailOptions` | interface |  | 13 |
| `sendEmail` | function | `async sendEmail(opts: SendEmailOptions): Promise<string[]>` — Send a note-taker summary email via Resend. | 28 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.RESEND_API_KEY`, `env.RESEND_FROM`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `resend` — `Resend`

## Used by

- `server/note-taker/jobs/distribute.worker.ts`
