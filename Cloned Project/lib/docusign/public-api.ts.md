# `lib/docusign/public-api.ts`

> Unauthenticated client for the public, no-login self-sign page: an external recipient opens an emailed token link, verifies their email by OTP, and signs or declines.

**Kind:** frontend library · **Lines:** 166

## Purpose
When a founder sends an external document for signature (`sendExternalDocument` in `external-api.ts`), each recipient gets a link to `/workspace/sign/[token]`. That signer has no Garage account and no Bearer token, so this module is deliberately separate from the authenticated modules, whose `api()` always attaches the logged-in user's token. It keeps a hard separation from the internal flow, mirroring the Docusign backend's separate public routes. It uses a raw `fetch` helper, modelled on `app/f/[token]/ShareableLinkViewer.tsx`'s own `getJson`.

## How it works
- **URL building (private `url(token, path?, docId?)`).** `${DOCUSIGN_URL}/public/esign/<encoded token><path>` with an optional `?doc=<docId>`. `docId` picks one document when the link covers a group (bundle); omitted, the backend opens the first document still waiting on the signer. It is ignored for single-document links.
- **`getJson` (private).** Adds `Content-Type: application/json`, `cache: "no-store"`, and a 30 s abort timeout (phones on weak networks used to hang forever; there is no session, so no 401 handling). Network failures become friendly messages. The body is parsed as JSON (falling back to `{}`); a non-2xx status **or** `body.status === false` throws an `EsignApiError` with `status` and the backend's machine-readable `code`.
- **Error wording (`errorMessage`).** Written for signers arriving from an email, often much later:
  - 404 / 410 -> "This signing link is no longer valid. It may have been declined, voided or replaced by a newer link."
  - 413 -> signature image too large (does not rely on the body, which may not be JSON).
  - 429 -> backend message or a "wait a minute" default.
  - otherwise -> backend `message` or `Request failed (<status>)`.
- **Verification token.** `confirmEsignOtp` returns a short-lived `verificationToken`; `submitEsignSign` and `declineEsignSign` must send it as the `X-Esign-Verification` header. The caller keeps it in memory for this visit only, never in storage. A missing or expired token returns 403 with `code: "verification_required"`.
- **Signature images.** A public signer cannot use `uploadDocusignFile` (no token), so `blobToDataUrl` turns the captured signature into a base64 `data:` URL that is sent in `signatureImageUrl`; per the comment, the backend's `controllers/esignSigning.controller.js` (`materializeImageUrl`) uploads it server-side before flattening.
- **Decline is final.** Declining voids the document for everyone and retires every signing link; the same token 404s afterwards.

## Exports
- `type EsignApiError` - `Error & { status?: number; code?: string }`; what every failed call throws.
- `interface PublicEsignRecipient` - the signer's own recipient row (`_id`, `name`, `email`, `status`, `order`, verification/consent/sign/decline timestamps).
- `interface PublicEsignDocument` - public document view (`title`, `status` `sent | in_progress | completed | voided`, `message`, `orgName`, `orgLogoUrl`, `pageCount`, `signingOrder`, file URLs, `recipient`).
- `viewEsignDocument(token, docId?)` - document, `myFields`, `canSign`, `waitingFor`, `myStatus`, `consent` (`version`, `text`), `myEmailVerified`, optional `bundle` stepper.
- `getEsignFile(token, kind: "original" | "signed" | "certificate", docId?)` - a file link.
- `verifyEsignDocument(token, docId?)` - integrity check (`DsVerifyResult`), meaningful once completed.
- `requestEsignOtp(token, docId?)` - email a verification code.
- `confirmEsignOtp(token, code, docId?)` - returns `{ verificationToken, expiresAt }`.
- `submitEsignSign(token, verificationToken, data, docId?)` - submit field values, signature (`draw | type | upload`, image URL/data URL), `consentGiven: true`, optional `consentTextVersion`.
- `declineEsignSign(token, verificationToken, reason?, docId?)` - decline (voids the document).
- `blobToDataUrl(blob: Blob): Promise<string>` - FileReader wrapper producing a data URL.

## Interfaces
- **External services (Docusign service, relative to `DOCUSIGN_URL`, no auth header):**
  - `GET public/esign/:token[?doc=]`
  - `GET public/esign/:token/file/:kind`
  - `GET public/esign/:token/verify`
  - `POST public/esign/:token/verify-email/request`
  - `POST public/esign/:token/verify-email/confirm`
  - `POST public/esign/:token/sign` (header `X-Esign-Verification`)
  - `POST public/esign/:token/decline` (header `X-Esign-Verification`)
- **Environment variables:** `NEXT_PUBLIC_DOCUSIGN_URL`, indirectly through `DOCUSIGN_URL` in `client.ts`.

## Dependencies
- **Internal:**
  - `lib/docusign/client.ts` - `DOCUSIGN_URL` only.
  - `lib/docusign/types.ts` - `DsBundleStepper`, `DsField`, `DsVerifyResult` (type-only).
- **Packages:** none.

## Used by
`app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx` - the public signing page at `/workspace/sign/[token]`.

## Notes
- File comments call the page `app/sign/[token]`; in this repo it is under `app/(dashboard)/workspace/sign/[token]`.
- A comment says `uploadDocusignFile` is in `internal-api.ts`; it is actually exported from `client.ts`.
- Security: never persist `verificationToken`; it is the second factor proving control of the recipient's mailbox.
