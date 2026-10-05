# `components/coverfi/communication/SendersTable.tsx`

> The Coverfi "Email senders" page body: lists sender identities with their verification status and lets the user add, edit, verify and delete them.

**Kind:** React component · **Lines:** 188

## Purpose
Coverfi email templates are sent from configured sender identities. This component is the management screen for those identities. It loads them from the external Coverfi API, renders them in a table, and hosts `SenderFormDialog` for create/edit. The page subtitle states that verification is currently a stub that will later be wired to SES / SendGrid.

## How it works
**State:** `rows` (the senders), `loading`, `open` (dialog visibility) and `editing` (the sender being edited, or `null` for add).

**Loading:** `refresh()` sets `loading`, calls `listSenders()` and stores the result; failures show a `sonner` toast ("Failed to load senders"). It runs once on mount and again after every mutation.

**Actions per row**
- **Verify** (shield icon) - shown only when `verification_status !== "verified"`. Calls `verifySender(id)`, toasts "Verification requested", then refreshes.
- **Edit** (pencil) - sets `editing` to the row and opens the dialog.
- **Delete** (trash) - asks `confirm('Delete sender "<nickname>"?')`, then `deleteSender(id)` and refresh. No success toast; errors toast "Delete failed" or the API message.

**Add sender** button clears `editing` and opens the dialog. The dialog's `onSaved` is `refresh`, so the list reloads after a save.

**Table columns:** Nickname, From (name with the email underneath), Reply-to (`—` when empty), Status, and an actions column. Loading and empty states ("Loading…", "No senders yet.") render as a single full-width row.

**Status badge:** `STATUS_STYLES` maps each `SenderVerificationStatus` (`unverified`, `pending`, `verified`, `failed`) to Tailwind classes - grey, `brand-2`, `brand`, and red respectively - and the raw status string is shown as the badge text.

## Exports
- `default SendersTable()` - self-contained page body; takes no props.

## Interfaces
- **External services:** the Coverfi API (not part of this repo; base URL `NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`, bearer token from `lib/auth`), via:
  - `GET {COVERFI}/v1/coverfi/communication` - list senders (`listSenders`)
  - `POST {COVERFI}/v1/coverfi/communication/sender/:id/verify` - request verification (`verifySender`)
  - `DELETE {COVERFI}/v1/coverfi/communication/sender/:id` - delete (`deleteSender`)
  - create/update go through `SenderFormDialog`.

## Dependencies
- **Internal:** `components/coverfi/communication/SenderFormDialog.tsx` - add/edit modal; `lib/coverfi/communication-api.ts` - `listSenders`, `deleteSender`, `verifySender`; `lib/coverfi/types.ts` - `EmailSender`, `SenderVerificationStatus`; `lib/utils.ts` - `cn()`; `components/ui/button.tsx`, `badge.tsx`, `table.tsx` - UI primitives.
- **Packages:** `react` - state and effect hooks; `lucide-react` - `Plus`, `Pencil`, `Trash2`, `ShieldCheck` icons; `sonner` - toasts.

## Used by
- `app/(dashboard)/coverfi/communication/senders/page.tsx` - the whole content of the route `/coverfi/communication/senders`, inside the Communication layout and tabs.

## Notes
- Uses the browser's blocking `confirm()` for deletes rather than a styled dialog.
- The edit and delete icon buttons have no `title`/aria-label (only the verify button does).
