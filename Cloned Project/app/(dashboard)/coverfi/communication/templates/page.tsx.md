# `app/(dashboard)/coverfi/communication/templates/page.tsx`

> Thin route file that renders the Coverfi email Templates table.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/communication/templates`

## Purpose
This is the "Templates" tab of Coverfi Communication. Templates are reusable rich-HTML emails with variables. `/coverfi/communication` redirects here, so this is also the area's default screen. The file only binds the URL to `TemplatesTable`, which loads templates from the external Coverfi API (`listTemplates()` → `GET /v1/coverfi/templates`).

## How it works
`TemplatesPage()` returns `<TemplatesTable />`. The page has no logic of its own. Opening a template leads to `/coverfi/communication/templates/[id]`. The header and tabs come from `coverfi/communication/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default TemplatesPage()` - renders the templates table.

## Dependencies
- **Internal:** `components/coverfi/communication/TemplatesTable.tsx` - the template list.

## Used by
No file imports it. It is reached at `/coverfi/communication/templates` from `CommunicationTabs`, from the redirect in `coverfi/communication/page.tsx`, and from the "Email templates" tile and "Craft email templates" card on `/coverfi`.
