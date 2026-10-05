# `server/services/messageTranslation.ts`

> src/services/messageTranslation.ts

**Kind:** backend service · **Lines:** 168

<!-- docgen:auto -->

## Purpose
src/services/messageTranslation.ts

Translate group messages on demand, cached per (message, language).

Used by the support chats — the member-facing route in routes/groups.ts and
the admin console in routes/garageAdminSupportChats.ts share this so a
message translated by one is free for the other.

Gemini with the platform key (DEFAULT_GEMINI_KEY), NOT process.env.
GEMINI_API_KEY — that variable holds a key the API rejects (see betty.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TRANSLATE_LANGUAGES` | const | `= { en: "English", es: "Spanish", fr: "French", ar: "Arabic", zh: "Simplified Chinese", /…` — The languages the apps offer — the web app's locales. | 23 |
| `TranslateLang` | type |  | 54 |
| `isTranslateLang` | function | `isTranslateLang(v: unknown): v is TranslateLang` | 56 |
| `MAX_TRANSLATE_BATCH` | const | `= 50` — Cap per request — one model call translates the whole batch. | 62 |
| `translateGroupMessages` | function | `async translateGroupMessages(groupId: string, messageIds: string[], lang: TranslateLang): Promise<Record<string, string>>` — Translations for the given messages of ONE group, keyed by message id. | 104 |

## Interfaces

- **Database (Mongoose models used):**
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`
  - `MessageTranslation` (server/models/messageTranslation.model.ts) — reads: `find`; **writes:** `bulkWrite`

## Dependencies

- **Internal:**
  - `server/routes/betty.ts` — `DEFAULT_GEMINI_KEY`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
  - `server/models/messageTranslation.model.ts` — `MessageTranslation`
- **Packages:**
  - `crypto`
  - `mongoose` — `Types`
  - `@google/generative-ai` — `GoogleGenerativeAI`

## Used by

- `server/routes/garageAdminSupportChats.ts`
- `server/routes/groups.ts`
