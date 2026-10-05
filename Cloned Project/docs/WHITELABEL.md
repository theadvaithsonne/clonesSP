# White-label

White-label lets an office (organisation) run Garage under **its own domain, name, colours, logo and email sender**. It is a paid, yearly add-on bought by the office founder. About 120 files touch it; this page is the map. Per-file detail is in each file's sibling `.md`.

## The four pieces

| Piece | What it does | Where it lives |
|---|---|---|
| **Add-on purchase and gating** | $600/year add-on, invoice-based, with commissions and yearly renewal. `hasActiveAddon(orgId, "white-label")` is the gate. | `server/config/whitelabelAddon.ts`, `server/services/whitelabelAddonPurchase.ts`, `server/routes/whitelabelAddon.ts`, `server/models/officeAddon*.model.ts` |
| **Custom app domains** | Org registers a domain, adds DNS records, backend verifies them. | `server/routes/initialSetup.ts` (`/add-app-domain`, `/verify-app-domain`, …), `Organization.customAppDomains` |
| **Branding** | Per-org primary/secondary colour, name, icon, cover photo applied when the app loads on a custom domain. | `Organization.branding`, `lib/whitelabel.ts`, `lib/hooks/useWhitelabel.ts`, `lib/whitelabel-context.tsx`, `lib/brand-color-context.tsx` |
| **Email sender** | Transactional mail sent from the org's own domain through Resend. | `Organization.emailSender`, `server/services/resendDomains.ts`, `components/dashboard/WhitelabelEmailStep.tsx` |

Related bonus programmes: the **monthly volume bonus** (`server/services/whitelabelMonthlyBonus/`) and the sibling **Cryptosub** add-on, which copies the same commission shape and can bundle white-label (see below).

## Buying it

Backend router `server/routes/whitelabelAddon.ts`, mounted at `/whitelabel-addon` (browser: `/backend/whitelabel-addon`):

| Method | Path | Guard | Purpose |
|---|---|---|---|
| POST | `/purchase` | `requireAuth`, `requireFounder` | Mint the add-on invoice (and, per the service header, charge a saved card on-session). |
| GET | `/status` | `requireAuth` | `hasAccess` and renewal date for the current org. |
| GET | `/price` | `requireAuth` | Quote base + GST + total for this buyer. |
| POST | `/admin/renewal-tick` | `requireGarageAdminAuth` | Run the renewal job on demand (`garageAdminPageGate` also covers `/whitelabel-addon/admin`). |

Flow:

1. The founder opens the pitch page (`components/dashboard/WhitelabelPage.tsx`) → `WhitelabelPurchaseDialog` → an invoice is minted and opened in a new tab at `/invoice/<id>` (`lib/whitelabel-checkout.ts`; the hosted pay page takes payment).
2. When the invoice is paid, `fulfillInvoice` runs `activateWhitelabelFromInvoice`, which upserts an `OfficeAddonSubscription` so `hasActiveAddon(orgId, "white-label")` becomes true, and `chargeReferralCommission` pays the referrers.
3. A daily job, `runWhitelabelRenewalTick` (scheduled in `server/index.ts`, 2 min after boot then every 24 h), mints the next invoice about 7 days before `currentEnd` and charges the saved card off-session. After 3 failed attempts, 24 h apart, the subscription is halted and the founder is emailed.
4. The UI gate `components/dashboard/WhitelabelGate.tsx` wraps Domain Management, Branding and Email Setup. It **fails closed**: if `GET /whitelabel-addon/status` errors it shows the pitch, not the controls.

Numbers (from `server/config/whitelabelAddon.ts`, the single source):

- Price **$600/year** USD, slug `white-label`. **18% GST** (SAC `998314`) added only for buyers in India, decided by country, not currency.
- Commission: **$150 flat** to the buyer's direct referrer (to the platform bucket if none), **$150 cascade** as six separate $25 Unilevel Plus unit sales, **$6** platform residual to the HQ store wallet.
- Monthly volume bonus: a direct referrer with **at least 10 new activations** in a calendar month gets **$150 per sale** once past the threshold (platform-funded).
- Bundling: a paid **Cryptosub** invoice can grant white-label when the org opted in at creation (`Organization.whitelabelRequested`, `activateBundledWhitelabelFromCryptosub`).

> **Inconsistency to be aware of:** the header comment of `server/services/whitelabelAddonPurchase.ts` describes the commission as "50% of the base = $300 to the direct referrer", and the doc comment on `chargeReferralCommission` mentions "$150 flat to L1, $144 depth-weighted…". The config file above is what the code reads; treat those comments as out of date, but check the service before changing money logic.

## Custom domains

Stored in `Organization.customAppDomains[]`: `domain`, `kind` (`app`, `shop`, `event`, `cryptobrand`, `otc`), `verified`, `verifiedAt`, `sslProvisioned`, `isPrimary`, and `dnsRecords[]` (`CNAME`/`A`/`TXT`, each with its own `verified`). `kind` decides which hosting project a domain attaches to (per the schema comment, app/shop/cryptobrand are different Vercel projects; an event domain rides the app project).

Routes in `server/routes/initialSetup.ts` (mounted at `/initial-setup`):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/add-app-domain` | auth | Register a domain and return the DNS records to create. |
| GET | `/app-domains` | auth | List the org's domains. |
| POST | `/verify-app-domain` | auth, **founder only** | Resolve the DNS records and mark them verified. |
| DELETE | `/app-domain` | auth | Remove a domain. |
| POST | `/set-primary-app-domain` | auth | Choose the primary domain. |
| GET | `/lookup-app-domain?domain=` | **public** | Used by every page load on a custom domain (see below). Returns branding only for **verified** domains. |
| GET | `/verify-domain-for-ssl` | public | Check a domain before certificate issue. |

The same file also holds the separate Mailcow mailbox setup (`/domain-config`, `/add-domain-to-mailcow`, `/domain-search`, `/domain-request`) and a certbot+nginx certificate helper (`provisionSSLForDomain`).

## What happens when a visitor opens a custom domain

1. The request reaches the app on that host. `middleware.ts` has **no generic white-label rule**: it only rewrites the admin host, the lost-money hosts and organisers' *event* domains. The generic white-label branding is applied **in the browser**.
2. `lib/whitelabel.ts` decides: `isWhitelabelDomain(host)` is false for the main app domain (`my.garage.app`), the admin domain, their subdomains, `localhost` and `127.0.0.1`.
3. `lib/hooks/useWhitelabel.ts` calls `GET /backend/initial-setup/lookup-app-domain?domain=<host>` once per page load (no caching) and returns a `WhitelabelConfig`: `orgId`, `orgName`, `orgIcon`, `primaryColor`, `secondaryColor`, `coverPhoto`, `whitelabelActive`.
4. `lib/whitelabel-context.tsx` (`WhitelabelProvider`, `useWhitelabelContext`, `useWhitelabelOptional`) shares it; login, onboarding, dashboard sidebar and header, webinar pre-join, invoice pay page, welcome screens and others read it.
5. `whitelabelActive` is `false` when the org's add-on has lapsed, so a lapsed office falls back to Garage styling even though the domain still resolves. A failed lookup also falls back to the defaults (Garage yellow `#FBD10D`) with an error flag.

Related helpers: `lib/hooks/useOrgShareOrigin.ts` (build share links on the org's own domain), `lib/safe-redirect.ts` (redirect allow-listing that knows custom domains), `lib/announcements.ts`.

## Branding and email sender

- `Organization.branding`: `primaryColor` (default `#FBD10D`) and `secondaryColor`. Several surfaces are a primary→secondary gradient, so a missing secondary defaults to the primary to avoid a gradient into Garage yellow.
- `Organization.emailSender`: `domain`, `resendDomainId`, `status` (default `not_started`), `fromEmail`, `fromName`, `dnsRecords[]`. `fromEmail` is only honoured once `status` is `verified`; mail never silently falls back to Garage's sender. It is separate from `domainConfig` (the Mailcow mailbox setup, possibly on the same domain): Mailcow receives, Resend sends, and `services/resendDomains.ts` merges the SPF records so both work.

## Setup wizard (founder UI)

`components/dashboard/WhitelabelSetupWizard.tsx` (via `WhitelabelWizardShell`) walks four steps; each step loads and saves its own data and can be skipped, and the last step reads real state so skipped steps show honestly:

1. **Domain** — `WhitelabelDomainWizard`
2. **Branding** — `WhitelabelBrandingStep`
3. **Email** — `WhitelabelEmailStep`
4. **Done** — `WhitelabelCompleteStep`

Entry points: `DomainManagementPage`, `EmailSenderSetup`, `InitialSetupPage`, `ManagementPage`, behind `WhitelabelGate`.

## Monthly volume bonus (admin side)

`server/services/whitelabelMonthlyBonus/` (`qualify.ts`, `payout.ts`, `run.ts`) runs from an hourly tick in `server/index.ts` (3 min after boot). Status goes `computing → computed → (paying → paid) | failed`; a dry run stops at `computed`. It takes a distributed lease (`cronLease`), and **money only moves when `WHITELABEL_MONTHLY_BONUS_ENABLED=true`** (default off). Models: `WhitelabelBonusRun`, `WhitelabelBonusPayout`. Admin router `server/routes/garageAdminWhitelabelMonthlyBonus.ts` (under `/garage-admin/whitelabel-monthly-bonus`): `POST /cron`, `GET /runs`, `GET /current`, plus preview and force-execute endpoints. The founder-subscription bonus (`founderSubMonthlyBonus`) is its sibling.

## Data touched

| Model | Role |
|---|---|
| `Organization` | `customAppDomains[]`, `branding`, `emailSender`, `whitelabelRequested`, `domainConfig` |
| `OfficeAddon` / `OfficeAddonSubscription` | the add-on definition (slug `white-label`) and each org's subscription (`currentEnd`, status, renewal lease in `metadata.renewalInFlightAt`) |
| `Invoice` | the add-on and renewal invoices |
| `StoreWallet`, `WalletTransaction` | commission and platform residual credits |
| `WhitelabelBonusRun`, `WhitelabelBonusPayout` | monthly bonus runs |

Field-level detail: [`DATABASE.md`](DATABASE.md).

## Configuration

`WHITELABEL_MONTHLY_BONUS_ENABLED` (bonus payouts), `BACKGROUND_JOBS` (turns off the renewal and bonus ticks), `RESEND_API_KEY` (email sender), the Mailcow variables (`MAILCOW_*`) for mailbox setup, `NEXT_PUBLIC_API_URL` (the browser's lookup call; under the combined server it is `<origin>/backend`).

## Gotchas

- Custom domains must also point at the **combined server** (or whichever host serves the app); in the combined layout the lookup call goes to `/backend/initial-setup/lookup-app-domain` on that same domain.
- Branding is client-side, so the first paint can briefly show Garage defaults (`isLoading: true`) before the lookup returns.
- Attaching a domain to the hosting provider (Vercel projects per `kind`) and nginx/certbot SSL are infrastructure steps referenced in `initialSetup.ts`; the combined server does not change that code, but it is no longer on Vercel by default, so revisit those steps when you decide where the combined app runs.
