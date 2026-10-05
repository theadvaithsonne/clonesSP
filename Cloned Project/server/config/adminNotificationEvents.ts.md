# `server/config/adminNotificationEvents.ts`

> The code-defined catalogue of events that garage-admin notification rules can bind to, with each event's payload fields and the condition operators allowed per field type.

**Kind:** backend config · **Lines:** 162

## Purpose
Admin notification rules ("email me when someone in X's downline pays $25") need three parties to agree on what an event looks like: the code that emits it, the evaluator that tests rule conditions against the payload, and the admin UI's condition builder. This file is that single contract. The admin UI fetches it over HTTP and builds its inputs from each field's `type`, so adding an event here needs no UI or engine change. It is kept in code rather than the database on purpose: a payload's shape is code, and a DB-defined event could describe fields no emitter actually produces.

## How it works
- **Field types** (`EventFieldType`): `user`, `string`, `number`, `enum`, `boolean`. The type decides which operators the builder offers and how the value input renders.
- **`OPERATORS_BY_TYPE`** maps each type to its operators:
  - `user`: `inDownlineOf`, `isDirectOf`, `is`, `hasTypeFlag`. The downline operators resolve through the denormalised `User.ancestors[]` array, so they are indexed lookups rather than tree walks.
  - `string`: `equals`, `contains`, `in`; `number`: `eq`, `gt`, `gte`, `lt`, `lte`; `enum`: `equals`, `in`; `boolean`: `isTrue`, `isFalse`.
- **`ADMIN_EVENTS`** currently lists four events:
  - `user.signup` - any new member joining the referral tree. Fields: `user`, `sponsor` (user), `country` (string), `source` (enum: signup, invite, checkout, downline, admin). The comment explains it is emitted from a `referredBy` post-hook on the User schema rather than per signup route, because only some of the many paths that set `referredBy` ever had explicit hooks.
  - `payment.up25`, `payment.up25.networkchain`, `payment.up25.networkchain.autodebit` - three **nested** (not exclusive) events for $25 plan payments. Every $25 payment raises the first; one that also bought a NetworkChain subscription also raises the second; one whose buyer also has working auto-debit (UPI mandate or saved card) raises the third. A rule picks its scope by picking its event. They are emitted from `services/adminNotifications/paymentEvents.ts`, triggered by a post-save hook on `UnilevelPlusPurchase`; licence assignments, backfills, synthetic mints, manual activations and $0 coupon activations are filtered out there. The auto-debit test uses the same predicate as the NetworkChain Subs admin page (`services/autoDebitInstrument.ts`).
- All three payment events share `PAYMENT_FIELDS()` (a hoisted function declaration, so it can be called inside the array literal above it): `user`, `sponsor`, `amount` (USD), `country`, `source` (invoice_fulfillment / webhook_fallback / direct), `termMonths`, `freeFirstMonth`, `autoDebitVia` (upi / card / none). Sharing the list lets a rule's conditions carry across the three events.

## Exports
- `type EventFieldType` - `"user" | "string" | "number" | "enum" | "boolean"`.
- `interface EventField` - `{ key, label, type, values? }`; `values` only for enums.
- `interface AdminEventDescriptor` - `{ name, label, description, fields }`.
- `OPERATORS_BY_TYPE` - operator list (`{ op, label }[]`) per field type.
- `ADMIN_EVENTS` - the event catalogue.
- `ADMIN_EVENT_NAMES` - just the event names, used for validation.
- `findEvent(name: string): AdminEventDescriptor | undefined` - lookup by name.

## Interfaces
- **Endpoints served (indirectly):** `routes/adminNotifications.ts` returns `{ events: ADMIN_EVENTS, operators: OPERATORS_BY_TYPE }` from `GET /backend/garage-admin/notifications/events` and validates a rule's `event` against `ADMIN_EVENT_NAMES`.

## Dependencies
None (pure data and types).

## Used by
- `server/routes/adminNotifications.ts` - catalogue endpoint and rule validation.
- `server/services/adminNotifications/dispatch.ts` - `findEvent` when dispatching an emitted event.
- `server/services/adminNotifications/evaluate.ts` - condition evaluation.
- `server/services/__tests__/adminNotificationEvaluate.test.ts` - tests.

## Notes
- Adding an event here only describes it; something must still emit it with a matching payload, otherwise rules bound to it never fire.
- The header points to a design spec under `docs/superpowers/specs/`.
