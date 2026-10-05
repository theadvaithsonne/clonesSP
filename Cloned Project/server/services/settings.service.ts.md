# `server/services/settings.service.ts`

> Module exporting `createSettings`, `getSettings`, `updateSettings`, `buildSettingsResponse`.

**Kind:** backend service · **Lines:** 237

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EMAIL_NOTIFICATION_SECTIONS` | const | `= [ { id: "global-emails", title: "Global Emails", items: [ { key: "globalNewOfficeJoinsG…` | 14 |
| `createSettings` | function | `async createSettings(userId: string, orgId: string)` | 123 |
| `getSettings` | function | `async getSettings(userId: string, orgId: string)` | 139 |
| `updateSettings` | function | `async updateSettings(userId: string, orgId: string, payload: { emailPreferences?: Record<string, boolean>; offi…)` | 152 |
| `buildSettingsResponse` | function | `buildSettingsResponse(settings: any)` | 198 |

## Interfaces

- **Database (Mongoose models used):**
  - `Settings` (server/models/setting.model.ts) — reads: `findOne`; **writes:** `create`, `findOneAndUpdate`

## Dependencies

- **Internal:**
  - `server/models/setting.model.ts` — `Settings`, `IDynamicEmailItem`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/settings.controller.ts`
