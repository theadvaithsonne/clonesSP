# `server/models/organization.model.ts`

> The central Mongoose model for an organization ("office"): identity, branding, store, email/domain set-up, billing, white-label domains, payment overrides and programme flags, plus slug generation and catalog sync hooks.

**Kind:** Mongoose model · **Lines:** 305

## Purpose
Almost everything in Garage is scoped to an organization: workspace floors, courses, channels, products, wallets, affiliate programmes, webinars and the BAT246 game all hang off an `orgId`. This file defines that root record. `GARAGE HQ` is the one organization with `parent: true`; every other organization is a founder's office. With 124 importers it is one of the most widely used files in `server/`.

## How it works

### Identity and location (L16-L27)
`name` (required), `slug` (unique, sparse), `size`, `location`, and structured location fields `city`, `state`, `country`, `postalCode`, `latitude`, `longitude`. `parent` (default `false`) marks GARAGE HQ.

### Public profile and branding (L29-L45, L135-L145)
`description`, `headingText`, `subHeadingText`, `icon` and `coverPhoto` (UploadThing URLs), `promoVideoLink`, logo/icon variants `colored_logo`, `white_logo`, `colored_icon`, `white_icon`, SEO `website_meta_title` / `website_meta_description`, and `font` (a CSS `font-family` string from the ManageOrg picker, default `""` meaning "app default"; the frontend applies it as `style={{ fontFamily: org.font }}`).
`branding.primaryColor` defaults to Garage yellow `#FBD10D`. `branding.secondaryColor` has no default; the comment explains that several surfaces (the login button, for one) render a primary-to-secondary gradient, and consumers fall back to the primary so a single-colour brand renders flat.

### KYC mirror (L46-L59)
`kycStatus` (enum `not_requested` / `pending` / `submitted` / `verified` / `rejected`, indexed) and `kycVerifiedAt`. These are a derived copy of `OrgKyc` (`server/models/orgKyc.model.ts`), written only by `syncOrgKycMirror` in `server/services/orgKyc.service.ts`. Absent on older offices, which reads as "not requested".

### Visibility, category and origin flags (L60-L75, L194-L199)
- `office_public` (default `false`) - whether the office is publicly discoverable.
- `category` (default `""`) - a plain string matching an `OrgCategory.name` (see `orgCategory.model.ts`), not a reference.
- `officeCreatedFromCryptobrand` (indexed) - set when the office was minted by the Cryptobrand system via `/org/create-first-time` or `/org/upsert` with that flag in the payload.
- `whitelabelRequested` (indexed) - founder answered "Yes" to white-label in the HiFi seller app. No extra charge; when Cryptosub is later paid, an `OfficeAddonSubscription` for the `white-label` addon is upserted with `metadata.source = "cryptosub_bundle"`.
- `source` (indexed) - origin tag, e.g. `"nc_affiliate_store"` when garage-store-backend auto-provisions an org for a NetworkChains affiliate storefront. The "Your Offices" picker hides those; orgs without `source` are treated as native.

### Native store (L76-L89)
`store` sub-object: `name`, `slug`, `description`, `headingText`, `subHeadingText`, `icon`, `coverPhoto`, `promoVideoLink`, `isActive` (default `true`), `createdAt`, `updatedAt`. A sparse index on `store.slug` (L276) supports storefront lookups.

### Mailcow mail domain and mailbox (L90-L121)
- `domainConfig`: `type` (`default` / `custom`), `customDomain`, `verified`, `domainAddedToMailcow`, `dnsRecords[]` (`type`, `name`, `value`, `priority`, `verified`), `verifiedAt`.
- `mailboxConfig`: `created`, `email`, `localPart`, `domain`, `credentials`, `createdAt`, `founderUserId` (ref `User`), `lastFetchedAt`.

### Billing details for GST invoices (L122-L133)
`billingDetails.gstin`, `legalName`, and `billingAddress` (`line1`, `line2`, `city`, `state`, `pincode`).

### Resend white-label sending (L146-L178)
`emailSender`: `domain`, `resendDomainId`, `status` (default `"not_started"`), `fromEmail`, `fromName`, `dnsRecords[]` (`record`, `name`, `type`, `value`, `ttl`, `priority`, `status`), `lastCheckedAt`, `verifiedAt`. Separate from `domainConfig`: Mailcow receives mail, Resend sends it, and both can be configured on the same domain (`server/services/resendDomains.ts` merges SPF records). `fromEmail` is honoured only once `status` is `"verified"`, so a white-label client's mail never silently goes out as Garage.

### Join-welcome email (L179-L193)
`welcomeEmail`: `templateId` (a Network Mail template id or `"__default__"` for the built-in layout in `server/services/welcomeEmail.ts`), `templateName`, `templateHtml` (the frontend's rendered snapshot with merge tags intact, stored because Network Mail authenticates with the browser's JWT and cannot be fetched at send time), `syncedAt`. There is no on/off switch: a welcome email always goes out.

### 30-day grace programme (L200-L219)
`graceProgram`: `platformId` (ref `ThirdPartyClient`), `platformName`, `startedAt`, `expiresAt` (indexed), `createdByUserId` (ref `User`). Present only on offices created through the platform bypass in `server/routes/platformOffices.ts` when the founder had no Unilevel Plus licence. There is deliberately no stored lock flag: lock state is derived by `graceStatusFor` in `server/services/officeGrace.ts` from `expiresAt` and whether the founder now holds a licence.

### Platform fee override (L220-L230)
`paymentConfig.platformFeePercentage` (0-50); when unset, commission distributions use the global default (5% per the comment). `platformFeeUpdatedAt`, `platformFeeUpdatedBy` (ref `GarageAdmin`).

### Admin assignment (L231-L244)
`assignedAdminId` (ref `GarageAdmin`, indexed), `assignedAt`, `assignedBy`. Set via `POST /garage-admin/organizations/:id/assign-admin`; powers the "Assigned To" column of the garage-admin companies table.

### Custom app domains (L245-L270)
`customAppDomains[]`: `domain` (required), `kind` (`app` / `shop` / `event` / `cryptobrand` / `otc`, default `app`), `verified`/`verifiedAt`, `sslProvisioned`/`sslProvisionedAt`, `isPrimary`, `createdAt`, `dnsRecords[]` (`type`, `name`, `value`, `verified`). The kind decides which Vercel project the domain is attached to: app, shop and cryptobrand are separate projects; `event` rides the app project because `/e/<slug>` is a route in it.

### Hooks (L275-L301)
- **Slug pre-save:** when a document is saved without a `slug`, `generateSlug(name)` produces a base (lowercase, strip non-word characters, collapse whitespace/underscores/hyphens to `-`, trim hyphens). The hook loops `Organization.findOne({ slug, _id: { $ne: this._id } })`, appending `-1`, `-2`, ... until unique.
- **Catalog sync:** `installCatalogHooks(OrganizationSchema, "office", { isCatalogDoc: doc => doc?.parent !== true })` (from `server/models/_catalogHooks.ts`) enqueues a `CatalogOutbox` entry on `save`, `findOneAndUpdate`, `findOneAndDelete` and document `deleteOne`. A dispatcher later signs and POSTs those changes to the NetworkChains API. GARAGE HQ (`parent: true`) is excluded.

## Exports
- `Organization` - the Mongoose model (`model("Organization", ...)`).
- `generateSlug(name: string): string` - the slug helper used by the pre-save hook (also imported by `server/routes/guestAuth.ts`).

## Interfaces
- **Database:** `Organization` (collection `organizations`); indirectly `CatalogOutbox` via the hooks.
- **External services:** NetworkChains catalog API (through the outbox), Mailcow, Resend, UploadThing (asset URLs), Vercel (custom domains). This file stores configuration only; the calls live in services.
- **Background work:** catalog outbox entries are drained asynchronously by `catalogOutbox.dispatcher.ts`.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - `installCatalogHooks`.
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
124 files, including `scripts/test-franchise-e2e.ts`, the BAT246 seed scripts (`server/bat246/scripts/seedBat246.ts`, `seedBat246Product.ts`, `seedBat246ProductForOrg.ts`, `set-bat246-org-icon.ts`), `server/bat246/services/bat246Entry.service.ts`, `server/controllers/coworkingSpaceBooking.controller.ts`, `server/controllers/garageAdmin.controller.ts`, `server/controllers/shareableLink.controller.ts`, and routes `affiliate.ts`, `auction.ts`, `auth.ts`, `bond.ts`, `call.ts`, `callCheckout.ts`, `channelCheckout.ts`, `course.ts`, `courseCheckout.ts`, `cryptobrandCheckout.ts`, `discover.ts`, `downlineTable.ts`, `downlines.ts`, `ecommerceWallet.ts`, `eventManagement.ts`, `feed.ts` (all under `server/routes/`), and 99 more.

## Notes
- **Security:** `mailboxConfig.credentials` stores the founder's Mailcow mailbox password base64-encoded (the inline comment itself says to use proper encryption in production). Base64 is not encryption; anyone with database read access can recover it. Avoid returning this field in API responses.
- Slug generation only runs on `save()`. Organizations created with `insertMany`, `updateOne` upserts or `findOneAndUpdate` upserts get no slug unless the caller sets one. The uniqueness loop is also not race-safe; the unique index is the final guard.
- `updateOne` / `updateMany` do not trigger catalog sync (see `_catalogHooks.ts`); an hourly reconciler is relied on for those.
- The model is registered without a `mongoose.models` guard.
