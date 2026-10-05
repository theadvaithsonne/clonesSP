# `lib/safe-redirect.ts`

> Validators that make a user-supplied `?redirect=` value safe to navigate to, either as a same-origin path or as an absolute or custom-scheme URL.

**Kind:** frontend library · **Lines:** 57

## Purpose
Some signup funnels start off-site, for example the whitelabel marketing page's "Upgrade" button. They carry a `?redirect=` destination through login, org creation, the plan picker and the invoice page, and every step passes it along unchanged. This module is the check applied where the value is finally used. That way a forged value can at worst cause one navigation to a harmless destination, and no page that forwards the parameter becomes an open redirect.

## How it works
- **`safeRedirectPath(value)`:** trims the value. It returns it only if it starts with `/` and does **not** start with `//`, and returns `""` otherwise. Rejecting `//` matters because `//evil.com` is a protocol-relative URL that would leave the site.
- **`safeAbsoluteRedirectUrl(value)`:** for destinations that are meant to leave the site. The only current case is the hosted invoice page, which can bounce a payer back into a native app through something like `networkchain://billing/paid`.
  - Accepts only values matching `^([a-z][a-z0-9+.-]*)://`, a lower-case scheme followed by `://`. That rules out `javascript:alert(1)`.
  - Rejects the schemes in `DENIED_REDIRECT_SCHEMES` by name (`javascript`, `data`, `vbscript`, `blob`, `file`), because `javascript://x%0aalert(1)` would otherwise pass the shape check (`//` starts a JS comment).
  - The regex is lower-case only, so `JavaScript://...` fails the shape check outright.
  - The result must be assigned to `window.location.href`, not passed to the Next.js router.
- Both functions return `""` when there is nothing safe to use, so callers can write `if (dest) ...`.

## Exports
- `safeRedirectPath(value: string | null | undefined): string` - a same-origin path or `""`.
- `safeAbsoluteRedirectUrl(value: string | null | undefined): string` - a `scheme://...` URL whose scheme is not denied, or `""`.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `app/invoice/[invoiceId]/InvoicePayPage.tsx` - the hosted invoice payment page (`/invoice/[invoiceId]`), which redirects after payment.

## Notes
- This is security-sensitive. Do not loosen the `//` check or the denied-scheme list without understanding the open-redirect and XSS cases described above.
- `safeAbsoluteRedirectUrl` allows any `http(s)://` host, so it is not an allow-list of domains. Only use it where leaving the site is intended.
