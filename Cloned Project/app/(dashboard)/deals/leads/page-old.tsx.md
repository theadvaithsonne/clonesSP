# `app/(dashboard)/deals/leads/page-old.tsx`

> An older, dead version of the CRM Leads list page: a single client component that lists, searches, creates, views, edits, deletes and converts "contacts" (shown as leads) against the external CRM API.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 1043

## Purpose
This is the previous implementation of the `/deals/leads` screen, kept beside its replacement `app/(dashboard)/deals/leads/page.tsx`. Next.js only turns files named `page.tsx` into routes, so `page-old.tsx` is **not routable** and nothing imports it. It is a reference copy. It is worth reading only to see how the early CRM worked. In this version a "lead" was just a CRM **contact** record (`crm/contacts`), while the current page works with dedicated lead records.

## How it works

### Data model (L63-L79)
A local `Contact` interface: `_id`, `userId`, optional `companyId`, `firstName`, `lastName`, optional `email`, `phone`, `jobTitle`, `notes`, timestamps, and conversion fields `convertedToClient`, `convertedAt`, `convertedEmployeeId`.

### State (L81-L110)
- `contacts`: the list. `companies`: a `companyId -> name` map. `loading` and `searchTerm`.
- Dialog flags: `isAddDialogOpen`, `isEditDialogOpen`, `isViewDialogOpen`, `isDeleteAlertOpen`.
- `currentContact` (being viewed or edited) and `contactToDelete` (an id).
- `newContact`: one shared form object used by both the Add and Edit dialogs.
- `validationErrors`: per-field error strings for `email`, `phone`, `firstName`, `lastName`, `companyId`, `jobTitle`.

### Validation (L112-L124, L313-L361)
- `validateEmail`: an empty value passes. Otherwise it must match a simple `x@y.z` regex.
- `validatePhone`: an empty value passes. Otherwise it must be exactly 10 digits.
- `handleInputChange` writes the field into `newContact`. For `phone` it strips non-digits, then validates. For `email` it validates on every keystroke.
- `handleCreateContact` runs a full check before it submits. First name, last name, company and job title are required. Company must not be empty or `"none"`. Email and phone are checked with the validators above.
- The "Create Lead" button is also disabled until first name, last name, email, phone, company and job title are all filled. So in the Add dialog, email and phone are required in practice, even though the validators accept empty values.

### Loading (L126-L166)
On mount it runs `GET crm/contacts`. It accepts the response as `{contacts}`, `{data}` or a bare array, and coerces anything else to `[]`. It then runs `GET crm/companies` and builds the company-name map. That second call expects a bare array (`companiesData.forEach`). A failure on the contacts call shows a sonner error toast.

### Search (L168-L183)
A client-side filter over `contacts`. It matches the full name, email or the mapped company name, case-insensitively. A leftover comment says "Filter out converted contacts", but no such filter is applied, so converted contacts still appear.

### CRUD and conversion (L185-L465)
- **Delete:** `openDeleteAlert` stores the id and opens an AlertDialog. On confirm, `handleDeleteContact` sends `DELETE crm/contacts/:id`, logs a `delete` activity, removes the row locally and shows a toast.
- **View:** `openViewDialog` opens a read-only "Lead Details" dialog and fires a `view` activity (not awaited). That dialog has an Edit button that switches to the Edit dialog.
- **Edit:** `openEditDialog` copies the contact into `newContact`. A missing company becomes `"none"`. `handleUpdateContact` sends `PUT crm/contacts/:id` with the whole `newContact` object, swaps the returned record into the list, resets the form and logs an `update` activity. The Edit dialog runs no validation.
- **Create:** `handleCreateContact` sends `POST crm/contacts`, appends the returned record, resets the form and logs a `create` activity.
- **Convert to client:** `handleConvertToClient` sends `POST crm/contacts/convert-to-client` with `{ contactId }`, logs an `update` activity, then reloads the list through `fetchContacts`. The menu item is disabled once `convertedToClient` is true.
- `fetchContacts` (L408-L426) reloads with `GET crm/contacts`. Unlike the mount effect, it calls `setContacts(data)` with the raw response and does not unwrap it.

### UI (L467-L1041)
- A header with "Leads" and an "Add Lead" dialog trigger.
- A search input.
- A loading state, an empty state with a `UserCircle` icon, or a table. Columns: an empty favourite slot, Name, Email, Phone, Company, Job Title and "Converted to Client". Phone, Company, Job Title and Converted are hidden below `md`. Each row has a dropdown menu: View, Edit, Convert to Client, Delete.
- Then the View dialog, the Edit dialog and the delete-confirmation AlertDialog.
- Several earlier controls are commented out: Export, Filters, the "All Leads" view dropdown and a star/favourite button.

## Exports
- `default ContactsPage()` - the old leads/contacts list page component. It takes no props.

## Interfaces
- **External services:** every call goes to the external CRM API `https://uatapi.garage.app/api` (built by `buildExternalUrl`, not part of this repo). Calls go through `authenticatedFetch`, which sends a Bearer token and `credentials: "include"`:
  - `GET crm/contacts` - list contacts/leads
  - `GET crm/companies` - company names for the picker and table
  - `POST crm/contacts` - create
  - `PUT crm/contacts/:id` - update
  - `DELETE crm/contacts/:id` - delete
  - `POST crm/contacts/convert-to-client` - body `{ contactId }`
  - `POST crm/activities` - activity log entries, sent through `createActivity` with types `create`, `view`, `update` and `delete`, all with entity type `contact`
- **Browser storage / cookies:** indirectly, through `authenticatedFetch`: the auth token is read from `localStorage` `auth-token` or `garage_tok`, or from the `auth-token` cookie.

## Dependencies
- **Internal:**
  - `components/ui/button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx`, `select.tsx`, `table.tsx`, `dialog.tsx`, `alert-dialog.tsx`, `dropdown-menu.tsx` - shadcn/Radix UI primitives. The import graph also lists `components/ui/badge.tsx`, but that import is commented out (L20).
  - `lib/activity.ts` - `createActivity`, which posts to `crm/activities` and swallows its own errors so logging never blocks the main action.
  - `utils/api.ts` - `authenticatedFetch`, a fetch wrapper that adds auth headers and retries.
  - `lib/api-config.ts` - `buildExternalUrl`, which prefixes paths with the hard-coded `https://uatapi.garage.app/api`.
- **Packages:** `react` (state and effects), `sonner` (toasts), `lucide-react` (icons: `MoreHorizontal`, `Plus`, `Search`, `UserCircle`).

## Used by
Nothing. No file imports it, and because it is not named `page.tsx` Next.js does not route it. It appears unused. The live screen is `app/(dashboard)/deals/leads/page.tsx` at `/deals/leads`.

## Notes
- **Dead code:** safe to ignore when tracing behaviour. Changes here have no effect on the app.
- The mount effect lists `[toast]` as its dependency. `toast` is a stable import, so the effect runs once.
- Labels are inconsistent. The UI says "lead", while the code and messages mix in "contact" ("Update Contact" button, "permanently delete the contact").
- The Add and Edit dialogs reuse the same `id` attributes (`firstName` and others). Both are only mounted while open, so this is harmless.
- If the API returns a wrapped object, `fetchContacts` (used after a conversion) would store it as-is, and `contacts.filter` would then throw.
