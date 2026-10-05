# `server/services/supportTicketSuggest.ts`

> AI triage: should this support chat become a ticket?

**Kind:** backend service · **Lines:** 227

<!-- docgen:auto -->

## Purpose
AI triage: should this support chat become a ticket?

Reads the recent conversation of one support group and asks the model whether
it contains an unresolved customer issue worth tracking as a ticket, plus a
subject/priority. Powers the "AI suggests creating a ticket" banner in the
admin console. Fails closed: any model or parse error yields no suggestion,
never an error the console has to handle.

Same provider as the translate feature — Gemini via DEFAULT_GEMINI_KEY (NOT
process.env.GEMINI_API_KEY, which the API rejects; see betty.ts).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TicketPriority` | type |  | 30 |
| `TicketSuggestion` | interface |  | 32 |
| `suggestTicketForChat` | function | `async suggestTicketForChat(groupId: string): Promise<TicketSuggestion>` | 89 |

## Interfaces

- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — reads: `findOne`
  - `GroupMessage` (server/models/groupMessage.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.OPENAI_API_KEY`

## Dependencies

- **Internal:**
  - `server/routes/betty.ts` — `DEFAULT_GEMINI_KEY`
  - `server/config/env.ts` — `env`
  - `server/models/group.model.ts` — `Group`
  - `server/models/groupMessage.model.ts` — `GroupMessage`
- **Packages:**
  - `mongoose` — `Types`
  - `@google/generative-ai` — `GoogleGenerativeAI`
  - `openai`

## Used by

- `server/routes/garageAdminSupportChats.ts`
- `server/services/supportTicketAuto.ts`
