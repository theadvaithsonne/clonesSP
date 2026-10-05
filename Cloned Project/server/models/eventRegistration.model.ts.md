# `server/models/eventRegistration.model.ts`

> Mongoose model for one Event Program attendee holding a ticket, with payment state, add-ons, custom form answers, a seat-hold expiry and an unguessable QR check-in token.

**Kind:** Mongoose model · **Lines:** 169

## Purpose
Every free registration or paid ticket checkout for an `EventProgram` creates one of these documents. It is the record that organisers approve or reject, that the revenue table reads, and that the door scanner checks in. The `qrCodeToken` is the only credential the scanner needs, and an unauthenticated public endpoint resolves it. That is why it must be unguessable and must never be derived from the registration id.

## How it works
Types: `EventRegistrationStatus` (`pending_approval | approved | rejected | cancelled`) and `EventPaymentStatus` (`free | paid | pending | refunded`).

Sub-schemas (both `_id: false`):
- `AttendeeSchema` / `IEventAttendee`: `name` (required, max 200), `email` (required, lowercased), and optional phone, company, jobTitle and country.
- `RegistrationAddonSchema` / `IEventRegistrationAddon`: `ticketTierId` (ref `EventTicketTier`), `name`, `quantity` (at least 1) and `unitPrice` (at least 0). The name and price are copied at purchase time so a later price change or a deleted add-on cannot rewrite what was paid.

Main fields (`IEventRegistration`), stored in collection **`event_registrations`**:
- `eventId` (ref `EventProgram`) and `ticketTierId` (ref `EventTicketTier`), both required and indexed. `userId` is optional because guest checkout registers by email alone.
- `attendee`, `quantity`, `addons`.
- `answers`: Mixed, keyed by the field keys from `event_registration_forms`. It holds custom and consent answers only; standard fields go to `attendee`. Values may be strings, arrays or booleans.
- `status` (default `pending_approval`) and `paymentStatus` (default `free`), both indexed.
- `amountPaid` and `currency` (default `"USD"`). These are copied from the invoice so the revenue table needs no joins and a refunded invoice cannot rewrite history. Also `invoiceId` (ref `Invoice`) and `promoCode` (uppercased).
- `qrCodeToken`: required and unique.
- `holdExpiresAt`: starting a paid checkout claims seats immediately so two buyers cannot take the last one at the same time. This field is set on creation, cleared when the invoice settles, and swept by `releaseExpiredHolds` (in `server/services/eventManagement.ts`) so abandoned checkouts hand their seats back.
- `checkedInAt`, `rejectedReason` (max 500).
- `needsRefund`: set when someone paid after their hold lapsed and the seats had been resold. No ticket is issued and an admin has to refund them.

Indexes: `{ eventId, status, createdAt: -1 }`, `{ eventId, "attendee.email" }`, and `{ paymentStatus, holdExpiresAt }` for the hold sweep.

## Exports
- `EventRegistrationStatus`, `EventPaymentStatus` - unions.
- `IEventAttendee`, `IEventRegistrationAddon`, `IEventRegistration` - interfaces.
- `EventRegistration` - the model.

## Interfaces
- **Database:** `EventRegistration` (collection `event_registrations`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/publicEventManagement.ts`: `POST /backend/public/event-management/:slug/register` and `/:slug/checkout`, `POST /tickets/lookup`, `GET /ticket/:qrCodeToken`, `GET /me/tickets`.
- `server/routes/eventManagement.ts` - organiser registration list, approval and check-in.
- `server/services/eventManagement.ts` (seat holds), `server/services/founderAlertEmail.ts`, `server/services/invoice.ts`.

## Notes
- `qrCodeToken` is a bearer credential. Never log it or expose it in listings to anyone except the ticket holder and the organiser.
- The hold sweep is lazy: it runs when organiser or checkout routes call `releaseExpiredHolds`, not from a cron.
