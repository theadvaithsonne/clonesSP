# `lib/coverfi/communication-api.ts`

> Client functions for Coverfi email senders (from-addresses that need verification) and email templates tied to trigger events, served by the external Coverfi backend.

**Kind:** frontend library · **Lines:** 76

## Purpose
A Coverfi brokerage emails its clients when certain events happen, such as welcome, policy created, renewal reminder or claim filed. This module wraps the endpoints that manage the sender identities and the per-event templates. Requests go through `coverfiApi` to `NEXT_PUBLIC_COVERFI_API_URL` with the Garage bearer token.

## How it works
All functions unwrap `ApiResult.data` except the deletes, which return the raw `ApiResult<null>`.

**Senders** (base `/v1/coverfi/communication`):
- `listSenders()` - `GET /v1/coverfi/communication`, returns `EmailSender[]`.
- `getSender(id)` - `GET .../sender/:id`.
- `createSender({ nickname, from_name, from_email, reply_to?, address? })` - `POST .../create/sender`.
- `updateSender(id, patch)` - `PATCH .../sender/:id`.
- `deleteSender(id)` - `DELETE .../sender/:id`.
- `verifySender(id)` - `POST .../sender/:id/verify` with body `{}`. This starts or refreshes verification, and the returned sender carries a `verification_status` of `unverified | pending | verified | failed`.

**Templates:**
- `listTemplates()` - `GET /v1/coverfi/templates`.
- `getTemplate(id)` - `GET /v1/coverfi/template/:id`.
- `createTemplate({ trigger_event_name, email_subject, email_content, is_active? })` - `POST /v1/coverfi/template/create`.
- `updateTemplate(id, patch)` - `PATCH /v1/coverfi/template/:id`.
- `deleteTemplate(id)` - `DELETE /v1/coverfi/template/:id`.

## Exports
`listSenders`, `getSender`, `createSender`, `updateSender`, `deleteSender`, `verifySender`, `listTemplates`, `getTemplate`, `createTemplate`, `updateTemplate`, `deleteTemplate`.

## Interfaces
- **External services:** the Coverfi backend. The email provider behind sender verification is reported in `EmailSender.provider` and is handled entirely by that backend.

## Dependencies
- **Internal:** `lib/coverfi/api.ts` - `coverfiApi`; `lib/coverfi/types.ts` - `ApiResult`, `EmailSender`, `EmailTemplate`.

## Used by
`app/(dashboard)/coverfi/page.tsx`, `components/coverfi/communication/SenderFormDialog.tsx`, `SendersTable.tsx`, `TemplateEditor.tsx` and `TemplatesTable.tsx`.

## Notes
- Template paths are not consistent: the list uses the plural `/templates`, and single-item routes use `/template/...`. Senders sit under `/communication`. Keep these exact paths if you add calls.
- `TEMPLATE_TRIGGER_PRESETS` in `types.ts` lists the event names the template editor suggests.
