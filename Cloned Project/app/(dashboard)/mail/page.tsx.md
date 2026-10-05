# `app/(dashboard)/mail/page.tsx`

> Client-side "Mail" dashboard page with two tabs: "My Mail" (the signed-in member's organisation mailbox, read and send through the backend) and "Mail Manager" (admin of mailboxes and aliases on one or more Mailcow servers, called directly from the browser).

**Kind:** Next.js page · **Lines:** 1546 · **Route:** `/mail`

## Purpose
Garage gives organisation members email addresses hosted on Mailcow mail servers. This page is where a member reads their inbox and sends mail (the "My Mail" tab), and where someone with the Mailcow API keys creates or deletes mailboxes and forwarding aliases for a mail domain (the "Mail Manager" tab). The two tabs use different paths. My Mail goes through the Garage backend (`/backend/initial-setup/*`). Mail Manager talks straight to the Mailcow REST API through `lib/mail-api.ts`, using API keys stored in the browser. The page sits in the `(dashboard)` route group, so its URL is `/mail`. Mailbox creation for "My Mail" happens elsewhere: the empty state sends the user to "Email Setup" in the sidebar (`components/dashboard/InitialSetupPage.tsx`).

## How it works

### State (L104-L164)
The single component `MailPage` holds all of its state in `useState`:
- **Domain configs:** `domainConfigs`, `activeConfig`, the settings dialog flag `showDomainSettings`, `editingDomain`, and the form fields `configName/configDomain/configApiBase/configReadKey/configWriteKey`.
- **Mailboxes and aliases:** the lists, loading flags, `creating`/`deleting` and `creatingAlias`/`deletingAlias` flags, and the create-form fields (`localPart`, `fullName`, `password`, `password2`, `quota` defaulting to `"1024"`, `aliasAddress`, `aliasGoto`).
- **Tabs:** `mainTab` (`"my-mail"` | `"mail-manager"`, default My Mail) and `activeTab` (`"mailboxes"` | `"aliases"`) inside Mail Manager.
- **My Mail:** `myMailboxConfig`, `emails`, `selectedEmail`, `fetchingEmails`, `loadingMyMail`, plus the compose fields (`showCompose`, `composeTo`, `composeSubject`, `composeBody`, `sendingEmail`).
- **Banners:** `error`/`success`, set by `showMessage()`, which clears both after 5 s. These banners appear only in the Mail Manager tab. My Mail reports through `sonner` toasts instead.

### Initial load (L180-L235, L318-L321)
- On mount, `getDomainConfigs()` and `getActiveDomainConfig()` read the domain list from localStorage. The built-in default "Network Mail" (`networkmail.com`) config is always present.
- When `activeConfig` is set, `loadMailboxes()` and `loadAliases()` run. This happens on every page load, even while the My Mail tab is showing, so each visit sends Mailcow API requests from the browser. `loadAliases` keeps only aliases whose `domain` equals the active domain, because Mailcow's `get/alias/all` returns every domain's aliases.
- `loadMyMailConfig()` reads `garage_org_id` from localStorage and calls `GET /backend/initial-setup/domain-config?orgId=...`. The page uses only `mailboxConfig` from the response (`{ created, email, localPart, domain, lastFetchedAt }`). If there is no org id, the tab just stops loading.

### My Mail tab (L237-L316, L586-L697)
- While `loadingMyMail` is true, a spinner shows. If `myMailboxConfig.created` is false, a "No Mailbox Setup" card tells the user to go to Email Setup.
- Otherwise a header card shows the mailbox address with **Compose** and **Refresh** buttons, and below it an inbox list.
- Opening the page does not load email. The inbox fills only when the user clicks Refresh, which runs `fetchEmails()`: `GET /backend/initial-setup/fetch-inbox?orgId=...&limit=50`. The page stores `res.emails` and shows a toast with the count. Each row shows the sender, date, subject and the first 100 characters of `text`.
- Clicking a row sets `selectedEmail`, which opens a framer-motion modal (L1394-L1448). The modal shows From, To and Date, and renders the body as plain `text` inside a `<pre>`. HTML bodies are never rendered.
- `sendEmail()` (L278-L316) checks that To, Subject and Body are all filled and that To matches a simple single-address regex. It then calls `POST /backend/initial-setup/send-email` with `{ orgId, to, subject, body, isHtml: false }`. On success it closes the compose modal and clears the fields. The compose modal (L1450-L1541) shows a disabled From field set to the user's mailbox address. Only one recipient is supported, although the backend schema also accepts arrays, `cc` and `bcc`.

### Mail Manager tab (L323-L554, L699-L1391)
- **Domain selection and settings (L323-L390, L700-L911):** a `Select` switches the active config. `setActiveDomain()` saves the choice to localStorage, and the new `activeConfig` triggers a reload. The gear button opens a dialog to add a domain or edit one (name, domain, Mailcow base URL, read-only key, read-write key). It includes instructions for getting Mailcow API keys and, when more than one config exists, a list of configured domains. Every field is required. `apiBase` loses any trailing slash, and new configs get an id from `generateId()` (`domain_<timestamp>_<random>`). The default config can't be edited or deleted: the list shows it as "Default", and `handleDeleteDomainConfig` refuses id `"default"`. Deleting asks for `confirm()` first.
- **Header links:** "Open Mail Server" links to `activeConfig.apiBase`.
- **Create mailbox (L392-L439, L948-L1051):** checks that the two passwords match and that the password is at least 6 characters. It then calls `createMailbox({ local_part, name, password, password2, quota })`. The domain is filled in by `lib/mail-api.ts` from the active config. Success means every `MailApiResponse` entry has `type === "success"` (`isApiSuccess`). Otherwise the banner shows `getApiErrorMessage(result)`.
- **Mailbox table (L1053-L1205):** shows email, name, Active/Inactive (Mailcow returns `active` as `"1"` or `1`), quota used/total via `formatBytes`, a progress bar from `percent_in_use` (capped at 100 %), the message count, and actions. Clicking the username or the external-link icon runs `openWebmail()`, which opens `${apiBase}/SOGo` in a new tab. The user then signs in with the mailbox's own credentials; no SSO token is used. A copy button puts the address on the clipboard and shows a check icon for 2 s. Delete asks for `confirm()` and then calls `deleteMailbox([username])`.
- **Aliases (L489-L554, L1208-L1389):** if the alias address has no `@`, the page appends `@<activeDomain>`. The hint says "@domain" makes a catch-all. "Forward To" accepts comma-separated destinations. `createAlias({ address, goto })` and `deleteAlias([id])` follow the same success and error pattern as mailboxes. The table shows a "Catch-all" badge when `is_catch_all === 1`.

## Exports
- `default MailPage()` - the page component for `/mail` (marked `"use client"`). It takes no props.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/initial-setup/domain-config?orgId=...` - `requireAuth` plus an org-membership check. It returns `{ domainConfig, mailboxConfig, userRole, domainConfigured }`, and the page reads `mailboxConfig`.
  - `GET /backend/initial-setup/fetch-inbox?orgId=...&limit=50` - the backend fetches the user's active mailbox over IMAP (or through the mail proxy), upserts the messages into the `Email` model, and returns `{ success, emails }`.
  - `POST /backend/initial-setup/send-email` - body `{ orgId, to, subject, body, isHtml }`. The backend sends over SMTP (or the mail proxy) with the user's stored mailbox credentials.
- **External services:** the Mailcow REST API at each config's `apiBase` (default `https://mail.networkmail.com`), called from the browser by `lib/mail-api.ts` with an `X-API-Key` header: `GET /api/v1/get/mailbox/all/<domain>`, `POST /api/v1/add/mailbox`, `POST /api/v1/delete/mailbox`, `GET /api/v1/get/alias/all`, `POST /api/v1/add/alias`, `POST /api/v1/delete/alias`. The SOGo webmail is at `<apiBase>/SOGo`.
- **Browser storage / cookies:** reads `garage_org_id` from localStorage. Through `lib/mail-api.ts` it reads and writes `mail_domain_configs`, which holds every domain config including both API keys in plain text, and `mail_active_domain`. The bearer token comes from `getToken()` inside `lib/api.ts`.

## Dependencies
- **Internal:**
  - `lib/api.ts` - `api()` fetch wrapper that adds the `Authorization: Bearer` header and prefixes `NEXT_PUBLIC_API_URL` (`/backend`).
  - `lib/mail-api.ts` - Mailcow client and domain-config storage: `getDomainConfigs`, `getActiveDomainConfig`, `setActiveDomain`, `saveDomainConfig`, `deleteDomainConfig`, `getMailboxes`, `createMailbox`, `deleteMailbox`, `getAliases`, `createAlias`, `deleteAlias`, `formatBytes`, `isApiSuccess`, `getApiErrorMessage`, plus the types `MailDomainConfig`, `Mailbox`, `Alias`.
  - `components/ui/{button,input,label,card,dialog,select,tabs,badge}.tsx` - shadcn/Radix UI primitives.
- **Packages:** `react` (state, effects, callbacks), `framer-motion` (`motion`, `AnimatePresence` for the email and compose modals), `lucide-react` (icons), `sonner` (toasts in My Mail).

## Used by
No file imports this page. Next.js serves it at `/mail`, inside the `(dashboard)` layout. A search found no in-app link to `/mail`; `components/dashboard/InitialSetupPage.tsx` mentions it only in a comment ("same as /mail Mail Manager page").

## Notes
- **Security:** Mail Manager runs Mailcow admin operations from the browser. The default config in `lib/mail-api.ts` (L74-L75) hardcodes both the Mailcow read-only and read-write API keys for `mail.networkmail.com`. Those keys ship in the client bundle and end up in localStorage, so any user who can load this page can create or delete mailboxes and aliases on that server. The page itself has no role check, so access depends only on the dashboard layout.
- **Mailcow IP whitelist:** the dialog tells admins to whitelist their IP for API access. Because requests come from each user's browser, they succeed only from whitelisted IPs, and only if the Mailcow server allows CORS.
- `fetch-inbox` on the backend logs in to IMAP with a hardcoded test password (`server/routes/initialSetup.ts` L1104) rather than the stored mailbox credentials, while `send-email` decodes the stored base64 credentials. Reading the inbox therefore works only for mailboxes that use that test password.
- `Badge` is imported but never used. `openWebmail(mailbox)` ignores its argument and always opens the generic SOGo login, even though `lib/mail-api.ts` has `buildWebmailURL`/`generateSSOToken`.
- Inbox selection compares `selectedEmail?.id === email.id`, while the list `key` falls back to `seqno`. If messages have no `id`, they all share `undefined` and every row is highlighted.
- The compose validation regex accepts only one address, so comma-separated recipients are rejected on the client.
