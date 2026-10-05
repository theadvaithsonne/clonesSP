# `components/coverfi/communication/TemplateEditor.tsx`

> Full-page editor for one Coverfi email template: trigger event, active flag, subject, rich-HTML body, detected `{{variables}}` and an inline preview.

**Kind:** React component · **Lines:** 231

## Purpose
Coverfi sends rich-HTML emails when named trigger events fire (for example `welcome` or `claim_filed`). Each template binds a trigger name to a subject and body. This component loads one template by id from the external Coverfi API, lets the user edit it with the shared `RichTextEditor`, and saves or deletes it. New templates are created as drafts by `TemplatesTable` and then opened here.

## How it works
**`extractVars(html)`** (module-private) - scans a string with the regex `/\{\{\s*([\w.]+)\s*\}\}/g` and returns the unique placeholder names, sorted. Dotted names like `user.firstName` are allowed; whitespace inside the braces is tolerated.

**State:** `tpl` (the loaded template, `null` until loaded), editable copies `trigger`, `subject`, `content`, `isActive`, plus `saving` and `previewOpen`.

**Load:** an effect on `id` calls `getTemplate(id)` and copies `trigger_event_name`, `email_subject`, `email_content` and `is_active` into the editable state. While `tpl` is `null` the component renders only "Loading…"; a failed load toasts the error and stays on that loading view.

**Live variables:** `liveVars` is memoised `extractVars(subject + " " + content)` and shown as a list of `{{name}}` badges with a count, or a hint explaining the `{{firstName}}` syntax when none are found. This is client-side display only; it is not sent on save (the `variables` array on `EmailTemplate` is not part of the update payload).

**Trigger field:** chips for each `TEMPLATE_TRIGGER_PRESETS` value (`welcome`, `policy_created`, `policy_renewal_reminder`, `claim_filed`, `claim_settled`, `quote_ready`) set the trigger with one click; the chip matching the current value is highlighted. A free-text input allows any custom name, and when the value is non-empty and not a preset the note "Custom trigger — not one of the presets." appears.

**Active switch:** toggles `isActive`; the caption explains that a disabled template is skipped by Coverfi.

**Save (`onSave`):** requires non-empty trigger, subject and content (toast otherwise), then `updateTemplate(id, { trigger_event_name, email_subject, email_content, is_active })` and toasts "Saved". The page stays open.

**Delete (`onDelete`):** browser `confirm()`, then `deleteTemplate(id)` and `router.push("/coverfi/communication/templates")`.

**Preview:** the Preview button toggles a white panel showing the subject and the body rendered with `dangerouslySetInnerHTML`. Placeholders are shown literally; no sample data is substituted.

A "Back to templates" link returns to `/coverfi/communication/templates`.

## Exports
- `default TemplateEditor({ id }: { id: string })` - editor for the template with that Coverfi id.

## Interfaces
- **External services:** the Coverfi API (not part of this repo; base URL `NEXT_PUBLIC_COVERFI_API_URL`, default `http://localhost:4100`, bearer token from `lib/auth`), via:
  - `GET {COVERFI}/v1/coverfi/template/:id` - load (`getTemplate`)
  - `PATCH {COVERFI}/v1/coverfi/template/:id` - save (`updateTemplate`)
  - `DELETE {COVERFI}/v1/coverfi/template/:id` - delete (`deleteTemplate`)

## Dependencies
- **Internal:** `lib/coverfi/communication-api.ts` - template CRUD calls; `lib/coverfi/types.ts` - `EmailTemplate`, `TEMPLATE_TRIGGER_PRESETS`; `components/ui/rich-text-editor.tsx` - `RichTextEditor` for the HTML body (`minHeight="280px"`); `components/ui/button.tsx`, `input.tsx`, `label.tsx`, `badge.tsx`, `switch.tsx` - UI primitives; `lib/utils.ts` - `cn()`.
- **Packages:** `react` - `useState`, `useEffect`, `useMemo`; `next` - `Link`, `useRouter`; `lucide-react` - `ArrowLeft`, `Eye`, `Save`, `Trash2`; `sonner` - toasts.

## Used by
- `app/(dashboard)/coverfi/communication/templates/[id]/page.tsx` - route `/coverfi/communication/templates/[id]`, which unwraps the `params` promise and passes `id`.

## Notes
- **Security:** the preview injects the template HTML unsanitised. The in-code comment says this is acceptable in v1 because the HTML is authored here, and that any future external rendering path must sanitise it. Anyone who can edit a template can therefore run script in the preview of anyone who opens it.
- Unsaved changes are not guarded: leaving via the back link or browser navigation discards them silently.
- Trigger names are not checked for uniqueness on the client.
