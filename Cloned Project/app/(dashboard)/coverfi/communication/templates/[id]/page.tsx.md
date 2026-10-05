# `app/(dashboard)/coverfi/communication/templates/[id]/page.tsx`

> Dynamic route that unwraps the template id from the URL and opens the Coverfi email-template editor.

**Kind:** Next.js page · **Lines:** 14 · **Route:** `/coverfi/communication/templates/[id]`

## Purpose
This is the edit screen for one Coverfi email template. The file only extracts the `id` segment and passes it to `TemplateEditor`. That component loads the template (`getTemplate(id)`), saves changes (`updateTemplate`) and deletes it (`deleteTemplate`) through the external Coverfi API.

## How it works
- A client component (`"use client"`).
- In Next.js 15, `params` arrives as a `Promise<{ id: string }>`. The page unwraps it with React 19's `use(params)` and renders `<TemplateEditor id={id} />`.
- It renders inside `coverfi/communication/layout.tsx` (header and tabs) and `coverfi/layout.tsx` (access control).

## Exports
- `default TemplateEditorPage({ params })` - `params: Promise<{ id: string }>`.

## Dependencies
- **Internal:** `components/coverfi/communication/TemplateEditor.tsx` - the template editor.
- **Packages:** `react` (`use`).

## Used by
No file imports it. Next.js reaches it at `/coverfi/communication/templates/<id>`, typically from rows in `TemplatesTable`.
