# `components/coverfi/communication/SenderFormDialog.tsx`

> Modal form for adding a new Coverfi email sender identity or editing an existing one, including its compliance postal address.

**Kind:** React component · **Lines:** 223

## Purpose
Coverfi sends outbound emails from configured "senders" (a nickname, a From name/address, an optional Reply-to and a postal address for CAN-SPAM compliance). This dialog is the create/edit form for one sender. It is opened from the senders table and saves the record to the external Coverfi API through `lib/coverfi/communication-api.ts`.

## How it works
**State**
- `data` - a flat form object with `nickname`, `from_name`, `from_email`, `reply_to`, `street`, `city`, `state`, `country`, `zip`, all strings. The module-level `empty` constant is the blank form.
- `saving` - disables the save button while the request is in flight.

**Prefill** - an effect on `[existing, open]` copies the `existing` sender into the form (flattening `existing.address.*` into the five address fields and turning missing optional values into `""`), or resets to `empty` when there is no `existing`. Because `open` is a dependency, reopening the dialog for "Add" always starts blank.

**Save (`onSave`)**
1. Client-side validation: `nickname`, `from_name` and `from_email` are required; otherwise a `sonner` error toast is shown and nothing is sent.
2. Builds the payload, turning empty strings into `undefined` for `reply_to` and each address field, and nesting the address fields back into an `address` object.
3. If `existing` is set it calls `updateSender(existing._id, payload)` and toasts "Updated"; otherwise `createSender(payload)` and toasts "Added".
4. On success it calls `onSaved()` (the parent refreshes its list) and then `onClose()`. Errors show the thrown message (the API client extracts `error`/`message` from the JSON body) or "Save failed".

**Layout** - a Radix `Dialog` (closing via overlay/Escape calls `onClose`). A two-column grid holds Nickname, From name, From email and Reply-to; a second section headed "Postal address (CAN-SPAM / compliance)" holds Street, City, State, Country and "Zip / Pincode". The footer has Cancel and an Add/Update button showing "Saving…" while busy.
- The From email input is **disabled when editing**: a sender's address cannot be changed after creation (the field is still included in the PATCH payload, unchanged).

**`Field` helper** (local, not exported) - wraps a `Label` and a child input, adding a red `*` when `required`.

## Exports
- `default SenderFormDialog({ open, onClose, onSaved, existing })`
  - `open: boolean` - whether the dialog is shown.
  - `onClose: () => void` - called on cancel, dismiss and after a successful save.
  - `onSaved: () => void` - called after a successful create/update.
  - `existing?: EmailSender | null` - the sender to edit; omitted/null means "add".

## Interfaces
- **External services:** the Coverfi API (not part of this repo; base URL `NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`, bearer token from `lib/auth`), via:
  - `POST {COVERFI}/v1/coverfi/communication/create/sender` - create (`createSender`)
  - `PATCH {COVERFI}/v1/coverfi/communication/sender/:id` - update (`updateSender`)

## Dependencies
- **Internal:** `lib/coverfi/communication-api.ts` - `createSender`, `updateSender`; `lib/coverfi/types.ts` - `EmailSender` type; `components/ui/dialog.tsx`, `input.tsx`, `label.tsx`, `button.tsx` - shadcn UI primitives.
- **Packages:** `react` - `useState`, `useEffect`; `sonner` - toast notifications.

## Used by
- `components/coverfi/communication/SendersTable.tsx` - opened by its "Add sender" and per-row edit buttons, on the `/coverfi/communication/senders` page.

## Notes
- Only presence is validated; email format is left to the browser `type="email"` hint (which does not block submission here because there is no `<form>`) and to the backend.
- The update payload is cast to `Partial<EmailSender>` because the address object may contain `undefined` values.
