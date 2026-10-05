# `components/dashboard/inlineApps/network-mail/template-image-upload.ts`

> Module exporting `resolveEditorImageSrc`.

**Kind:** React component · **Lines:** 21

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `resolveEditorImageSrc` | function | `async resolveEditorImageSrc(file: File, purpose: AssetPurpose, editor: ReturnType<typeof useNetworkMailEditor>): Promise<string>` — Upload via API when in editor; otherwise fall back to base64 (preview-only). | 6 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx` — `useNetworkMailEditor`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/social-icons.tsx`
