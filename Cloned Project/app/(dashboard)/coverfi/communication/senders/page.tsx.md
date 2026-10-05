# `app/(dashboard)/coverfi/communication/senders/page.tsx`

> Thin route file that renders the Coverfi email Senders table.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/communication/senders`

## Purpose
This is the "Senders" tab of Coverfi Communication. Senders are the from-identities used for Coverfi's outbound email. The file only binds the URL to `SendersTable`, which lists senders and edits them through `SenderFormDialog` against the external Coverfi API (communication endpoints in `lib/coverfi/communication-api.ts`).

## How it works
`SendersPage()` returns `<SendersTable />`. The page has no logic of its own. The header and tabs come from `coverfi/communication/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default SendersPage()` - renders the senders table.

## Dependencies
- **Internal:** `components/coverfi/communication/SendersTable.tsx` - the sender list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/communication/senders` through `components/coverfi/communication/CommunicationTabs.tsx`.
