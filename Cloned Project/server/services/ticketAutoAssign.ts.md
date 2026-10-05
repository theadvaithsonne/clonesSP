# `server/services/ticketAutoAssign.ts`

> Auto-assign a freshly created support ticket to a garage admin.

**Kind:** backend service · **Lines:** 197

<!-- docgen:auto -->

## Purpose
Auto-assign a freshly created support ticket to a garage admin.

Called fire-and-forget right after a ticket is created (chat auto-ticket,
user-filed, guest, or admin-raised). The AI reads the roster of active
admins — their names and role labels ("Support Agent", "NVC", "Finance", …)
— and picks the best fit for the ticket's topic. A human can override the
choice at any time from the console (that sets assignedBy "admin"), so this
only ever fills an UNassigned ticket and never touches one a person owns.

Fails safe: if the models are down or pick nothing usable, it falls back to
the least-loaded active admin so no ticket is left unowned. If there are no
eligible admins at all, it leaves the ticket unassigned.

Same Gemini provider/key as the triage + translate features (DEFAULT_GEMINI_KEY,
NOT process.env.GEMINI_API_KEY — see betty.ts), with OpenAI as the fallback.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AutoAssignResult` | interface | Result of an assignment attempt, for the caller's log line. | 43 |
| `autoAssignTicket` | function | `async autoAssignTicket(ticketId: string): Promise<AutoAssignResult \| null>` | 49 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.OPENAI_API_KEY`

## Dependencies

- **Internal:**
  - `server/routes/betty.ts` — `DEFAULT_GEMINI_KEY`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `mongoose` — `Types`
  - `@google/generative-ai` — `GoogleGenerativeAI`
  - `openai`

## Used by

- `server/routes/garageAdminSupportChats.ts`
- `server/routes/garageAdminTickets.ts`
- `server/routes/tickets.ts`
- `server/services/supportTicketAuto.ts`
