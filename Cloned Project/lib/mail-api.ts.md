# `lib/mail-api.ts`

> Browser-side client for a Mailcow mail server's admin REST API (mailboxes, aliases, domains, SSO webmail, app passwords, spam score, sync jobs, DKIM, mail queue), with multi-domain configs kept in localStorage.

**Kind:** frontend library · **Lines:** 525

## Purpose
Garage offers hosted email on networkmail.com (and optionally other domains) run on Mailcow. The Mail page and the initial setup flow manage mailboxes and open webmail directly from the browser through this module. It does **not** go through the Garage backend: every request is a `fetch` straight to the Mailcow host with an `X-API-Key` header.

## How it works

### Domain configurations (L68-L149)
- A `MailDomainConfig` holds `id`, `name`, `domain`, `apiBase`, a `readKey` and a `writeKey`, and `isDefault`.
- `DEFAULT_CONFIG` (L69-L77) points to `https://mail.networkmail.com` for domain `networkmail.com`, id `"default"`.
- Configs are stored in localStorage under `mail_domain_configs`; the active one's id under `mail_active_domain`.
- `getDomainConfigs()` seeds storage with the default on first use and re-inserts the default if it was removed. On the server (no `window`) it returns just the default.
- `getActiveDomainConfig()` resolves the active id, falling back to the default.
- `setActiveDomain`, `saveDomainConfig` (insert or replace by id) and `deleteDomainConfig` (refuses `"default"`; resets the active domain to default when the active one is deleted) mutate storage.

### Request helper (L151-L180)
`mailApi<T>(endpoint, method = "GET", body?, useWriteKey = false)` reads the active config, picks the read or write key, sends JSON to `${apiBase}${endpoint}`, throws `HTTP <status>: <text>` on non-2xx, and returns the parsed JSON. Every POST in this file uses the write key.

### API wrappers (Mailcow `/api/v1/...` paths)
- **Mailboxes:** `getMailboxes(domain?)` -> `GET get/mailbox/all/{domain}`; `getMailbox(username)` (unwraps a one-element array); `createMailbox` -> `POST add/mailbox` with defaults active `"1"`, quota `"1024"` (MB), `force_pw_update "0"`, TLS enforced in/out; `updateMailbox` -> `POST edit/mailbox` `{items:[username], attr}`; `deleteMailbox(usernames)` -> `POST delete/mailbox`.
- **Aliases:** `getAliases(id = "all")`, `createAlias` (defaults active and `sogo_visible`), `updateAlias`, `deleteAlias` (ids sent as strings).
- **Domains:** `getDomains()`, `getDomain(domain)`.
- **SSO / webmail:** `generateSSOToken(username)` -> `POST add/sso/domain-admin`; `buildWebmailURL(mailbox, ssoToken?)` returns `${apiBase}/SOGo/so/{domain}/{local_part}?sso_token=...`, or plain `${apiBase}/SOGo` without a token.
- **Rate limits:** `getMailboxRatelimit`, `getDomainRatelimit`.
- **Quarantine / logs:** `getQuarantine`, `getPostfixLogs(count = 50)`, `getDovecotLogs(count = 50)`.
- **App passwords:** `getAppPasswords`, `createAppPassword` (defaults to IMAP, SMTP and POP3 access), `deleteAppPassword`.
- **Spam score:** `getSpamScore`, `updateSpamScore` (`POST edit/spam-score/`).
- **Sync jobs (imapsync):** `getSyncJobs`, `createSyncJob` with defaults TLS, 20-minute interval, excludes spam/junk folders, `delete2duplicates "1"`, `automap "1"`.
- **DKIM:** `getDKIM`, `generateDKIM` (selector `dkim`, 2048-bit by default).
- **Mail queue:** `getMailQueue`, `flushMailQueue`, `deleteFromQueue`.

### Helpers (L507-L524)
`formatBytes` renders sizes in B/KB/MB/GB/TB; `isApiSuccess` checks every response item is `type === "success"`; `getApiErrorMessage` joins the `msg` values of failed items.

## Exports
- Types: `MailDomainConfig`, `Mailbox`, `Alias`, `Domain`, `MailApiResponse`.
- Config: `getDomainConfigs()`, `getActiveDomainConfig()`, `setActiveDomain(id)`, `saveDomainConfig(config)`, `deleteDomainConfig(id): boolean`.
- Mailboxes: `getMailboxes(domain?)`, `getMailbox(username)`, `createMailbox(data)`, `updateMailbox(username, data)`, `deleteMailbox(usernames)`.
- Aliases: `getAliases(id?)`, `createAlias(data)`, `updateAlias(id, data)`, `deleteAlias(ids)`.
- Domains: `getDomains()`, `getDomain(domain)`.
- SSO: `generateSSOToken(username)`, `buildWebmailURL(mailbox, ssoToken?)`.
- Stats/ops: `getMailboxRatelimit`, `getDomainRatelimit`, `getQuarantine`, `getPostfixLogs`, `getDovecotLogs`, `getAppPasswords`, `createAppPassword`, `deleteAppPassword`, `getSpamScore`, `updateSpamScore`, `getSyncJobs`, `createSyncJob`, `getDKIM`, `generateDKIM`, `getMailQueue`, `flushMailQueue`, `deleteFromQueue`.
- Helpers: `formatBytes(bytes)`, `isApiSuccess(response)`, `getApiErrorMessage(response)`.

## Interfaces
- **External services:** Mailcow admin API at `https://mail.networkmail.com` (or a user-configured `apiBase`), plus SOGo webmail at `${apiBase}/SOGo`.
- **Browser storage / cookies:** localStorage `mail_domain_configs` (array of configs including API keys) and `mail_active_domain`.

## Dependencies
- **Internal:** none. **Packages:** none (uses `fetch`).

## Used by
- `app/(dashboard)/mail/page.tsx` - the Mail management page.
- `components/dashboard/InitialSetupPage.tsx` - onboarding step that provisions a mailbox.

## Notes
- **Security:** `DEFAULT_CONFIG` hardcodes two Mailcow admin API keys (a read key on L74 and a write key on L75). They ship in the client bundle, so anyone can read them and call the Mailcow admin API with full write access (create/delete mailboxes, flush queues, generate DKIM). They are also copied into localStorage. These keys should be rotated and the calls moved behind a backend proxy.
- Direct browser calls to the Mailcow host depend on Mailcow allowing CORS from the app origin.
- `generateSSOToken` posts to the domain-admin SSO endpoint, not a per-mailbox one; the comment explains the intended SOGo redirect.
- Not to be confused with `lib/network-mail-api.ts`, which is the separate campaigns/templates client.
