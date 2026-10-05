# `lib/docusign/access.ts`

> Pure helpers that derive a user's Docusign (Garage e-signature) role and permissions from the synced profile, for deciding what the UI shows.

**Kind:** frontend library · **Lines:** 29

## Purpose
The Docusign module has three roles plus "everyone else". The external Docusign backend enforces permissions (its `middlewares/requireDocusignAdmin.js` and `utils/documentAccess.util.js`, per the header comment); these functions only decide which tabs and buttons to render:
- **Founder** - always full access.
- **Admin** - manage members, settings and every document in the org (Dashboard, folders, Admin tab).
- **Sender** - create/send documents and templates, but sees only their own documents plus those sent to them; no Dashboard, folders or Admin tab.
- **Anyone else** - signs what is sent to them ("Assigned to Me").

## How it works
Input is a `Profile`: `Pick<DsUser, "role" | "isDocusignAdmin" | "isDocusignSender">`, or null/undefined (profile not synced yet). Precedence is founder > admin > sender > none.

## Exports
- `isDocusignAdminUser(me): boolean` - true for founders or `isDocusignAdmin`.
- `canSendDocuments(me): boolean` - admin-level users or `isDocusignSender`.
- `docusignRoleOf(me): DsRole` - `"founder" | "admin" | "sender" | null`.
- `ROLE_LABELS` - display labels `{ founder: "Founder", admin: "Admin", sender: "Sender" }`.
- `senderRoleLabel(me): string | undefined` - the label used to attribute a sender under their message in emails ("— Name, Admin"); matches the backend's `roleLabel`.

## Dependencies
- **Internal:** `lib/docusign/types.ts` - `DsRole`, `DsUser` (type-only).
- **Packages:** none.

## Used by
`app/(dashboard)/layout.tsx`, `components/dashboard/docusign/DocusignPage.tsx`, `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`, `components/dashboard/docusign/external/ExternalSignaturesList.tsx`, `components/dashboard/docusign/internal/AgreementsView.tsx`, `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`, `components/dashboard/docusign/shared/admin/MembersTab.tsx`, `store/docusign/sharedSlice.ts`.

## Notes
- Client-side checks only; never rely on them for security.
