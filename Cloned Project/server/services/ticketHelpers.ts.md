# `server/services/ticketHelpers.ts`

> Shared ticket-handler helpers.

**Kind:** backend service · **Lines:** 74

<!-- docgen:auto -->

## Purpose
Shared ticket-handler helpers. Used by both the user-facing
`/tickets/*` router and the garage-admin `/garage-admin/tickets/*`
router so attachment sanitisation + URL signing have one source.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `sanitiseAttachments` | function | `sanitiseAttachments(raw: unknown): ITicketAttachment[]` — Strip the client's attachment payload down to known fields with length caps so a malicious caller can't stuff arbitrary JSON into the embedded `attachments` array. | 21 |
| `withViewUrls` | function | `async withViewUrls(ticket: T): Promise<T & { attachments: (ITicketAttachment & {…` — Add freshly-signed viewing URLs to every attachment on a ticket or message before returning it to the FE. | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/ticketAttachments.service.ts` — `presignTicketView`
  - `server/models/ticket.model.ts` — `ITicketAttachment`, `(types only)`
- **Packages:** none

## Used by

- `server/routes/garageAdminTickets.ts`
- `server/routes/tickets.ts`
