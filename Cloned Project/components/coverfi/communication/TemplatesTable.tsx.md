# `components/coverfi/communication/TemplatesTable.tsx`

> The Coverfi "Email templates" page body: lists templates keyed to trigger events and lets the user create, open and delete them.

**Kind:** React component · **Lines:** 178

## Purpose
This is the list view of Coverfi's outbound email templates (rich-HTML messages keyed to trigger events). It fetches templates from the external Coverfi API, shows each one's trigger, subject, variables and active flag, and links to `TemplateEditor` for editing. Creating a template here immediately makes a placeholder draft on the server and jumps into the editor.

## How it works
**State:** `rows`, `loading`, `creating`.

**Loading:** `refresh()` calls `listTemplates()`, stores the rows and toasts "Failed to load templates" on error. It runs on mount and after a delete.

**New template (`onNew`):** rather than opening a blank form, it calls `createTemplate` with a placeholder draft:
- `trigger_event_name: "new_template_<Date.now()>"` (timestamped to keep it unique),
- `email_subject: "Untitled subject"`,
- `email_content: "<p>Start writing here…</p>"`,

then `router.push("/coverfi/communication/templates/<new _id>")`. The button shows "Creating…" and stays disabled until navigation; on error `creating` is reset and a toast is shown.

**Delete (`onDelete`):** browser `confirm('Delete template "<trigger>"?')`, then `deleteTemplate(id)` and refresh.

**Table columns**
- **Trigger** - monospace trigger name linking to the editor.
- **Subject** - truncated.
- **Variables** - up to four `{{name}}` badges from the template's server-provided `variables` array, plus a `+N` badge when there are more (null-safe via `t.variables || []`).
- **Active** - an "Active" brand badge or a "Disabled" secondary badge from `is_active`.
- **Actions** - pencil (link to the editor) and trash (delete).

Loading and empty states ("Loading…", "No templates yet.") render as one full-width row.

## Exports
- `default TemplatesTable()` - self-contained page body; takes no props.

## Interfaces
- **External services:** the Coverfi API (not part of this repo; base URL `NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`, bearer token from `lib/auth`), via:
  - `GET {COVERFI}/v1/coverfi/templates` - list (`listTemplates`)
  - `POST {COVERFI}/v1/coverfi/template/create` - create draft (`createTemplate`)
  - `DELETE {COVERFI}/v1/coverfi/template/:id` - delete (`deleteTemplate`)

## Dependencies
- **Internal:** `lib/coverfi/communication-api.ts` - `listTemplates`, `createTemplate`, `deleteTemplate`; `lib/coverfi/types.ts` - `EmailTemplate`; `components/ui/button.tsx`, `badge.tsx`, `table.tsx` - UI primitives.
- **Packages:** `react` - state/effect hooks; `next` - `Link`, `useRouter`; `lucide-react` - `Plus`, `Pencil`, `Trash2`; `sonner` - toasts.

## Used by
- `app/(dashboard)/coverfi/communication/templates/page.tsx` - the content of route `/coverfi/communication/templates` (also where `/coverfi/communication` redirects).

## Notes
- Clicking "New template" and then abandoning the editor leaves an active `new_template_<timestamp>` draft on the server; the draft is created without `is_active`, so its active state is whatever the Coverfi backend defaults to.
- The edit action nests a `<Button>` inside a `<Link>` (a button inside an anchor), which is invalid HTML nesting though it works in browsers.
