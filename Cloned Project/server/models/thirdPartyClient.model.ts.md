# `server/models/thirdPartyClient.model.ts`

> Mongoose model for external partner platforms that call the Garage API with an API key, plus the key-generation, key-verification and webhook-secret helpers.

**Kind:** Mongoose model · **Lines:** 327

## Purpose
Partner platforms (analytics partners, subscription products sold alongside the Unilevel Plus licence, integrating platforms that create offices) authenticate with an `x-api-key` header. Each partner is a `ThirdPartyClient` document holding a bcrypt hash of its key, the scopes it was granted, its webhook endpoint and signing secret, rate limits and, for invoice-flow clients, a `productConfig` describing what is sold, at what price and how revenue is split between the Unilevel Plus (UP) comp tree and the platform. The file also centralises the scope list so that the model enum and the admin API validator cannot drift apart again.

## How it works

### Scopes (L5-L33)
`THIRD_PARTY_SCOPES` is the single list of grantable scopes:
- `invoices:read`, `invoices:write` - create and read partner invoices (the default for a new client).
- `analytics:read` - read-only access to public affiliate-network analytics; clients with only this scope do not need a `productConfig`.
- `wallet:credit` - credit a user's store wallet (money leaving the platform); deliberately separate from `invoices:write`.
- `offices:grace` - create a starter office for a user with no UP licence under the 30-day grace programme (`server/routes/platformOffices.ts`); granted only to a few integrating platforms, never to the main web/mobile apps.

The comment notes that a scope added to the type union but not to this array can never be granted.

### Term plans (L35-L79, L142-L153)
`IThirdPartyTermPlan` describes a purchasable subscription term (1 to 60 months, unique within the array):
- `totalAmount` - full-term standalone price in dollars.
- `bundleSubscriptionAmount` - the subscription portion when bought in the same cart as the UP licence (the licence is always charged at full list price, so the bundle discount lands here). Omitted means no bundle discount.
- `upPortion` - dollars **per month** paid into the UP comp tree; always list value. Per-month storage avoids division rounding when terms are discounted. The commission distributor runs `termMonths` separate UP distributions of `upPortion` each.
- `isActive` - rollout gate: a term stays invisible and unsellable until the partner confirms its webhook handler honours `termMonths` (see `server/services/thirdPartyWebhook.ts`).
- `label`, `sortOrder` - display.
There is deliberately no platform portion per term: the platform's share is the residual `pricePaid - upPortion * termMonths`.

### Product config (L81-L101, L155-L229)
`productConfig` fields: `productCode`, `totalAmount`, `upPortion`, `platformPortion`, `platformUserEmail`, `platformOrgId`, `recurringPeriod` (`weekly | monthly | quarterly | yearly`), `allowsTopUp` (default false; permits variable-amount non-recurring wallet top-up invoices via `mode="topup"`), and optional `termPlans` (default `undefined` so legacy documents stay without the field; `server/services/thirdPartyTerms.ts` then synthesises a 1-month plan from the scalars). There is intentionally no default term: anything longer than 1 month must be chosen explicitly at checkout.

The `termPlans` **synchronous path validator** (L172-L225) rejects the array when:
- a `termMonths` is not a positive integer or is duplicated;
- `bundleSubscriptionAmount` is negative;
- the 1-month entry defines `bundleSubscriptionAmount` (there is no bundled monthly tier) or its `totalAmount` / `upPortion` disagree with the top-level scalars (which would reprice existing subscriptions on renewal);
- **solvency invariant:** `upPortion * termMonths` exceeds the cheapest sell price (`min(totalAmount, bundleSubscriptionAmount ?? totalAmount)`), which would make the platform's share negative.
The rules live in a path validator rather than a `pre("validate")` hook because hooks are skipped by `validateSync()`.

### Client document (L103-L138, L235-L275)
`name` (indexed), `apiKeyHash` (unique), `apiKeyPrefix` (indexed), `webhookUrl`, `webhookSecret` (required), `scopes` (enum `THIRD_PARTY_SCOPES`, default `["invoices:read","invoices:write"]`), `isActive` (default true), `isComboDefault` (default false, indexed), `rateLimits` (`perMinute` default 60, `perDay` default 10000), `productConfig` (optional), `createdBy` (-> `User`), `lastUsedAt`, timestamps. Extra compound index `{ apiKeyPrefix, isActive }`.

`isComboDefault` marks the one client sold by the Unilevel Plus combo offer. It replaced "the only active client" detection, which silently disabled the combo's free first month and UPI mandate when a second client was added on 10 Sep 2026. Exactly one client should carry it.

### API key helpers (L277-L326)
- Key format: `gu_tp_<8-char prefix>_<64 hex chars>`. The prefix is stored in clear for lookup; only the bcrypt hash (cost 10) of the whole key is stored.
- Authentication flow (in `server/middleware/thirdPartyAuth.ts` and `server/middleware/platformKey.ts`): `extractKeyPrefix(rawKey)` -> find active clients with that prefix -> `verifyApiKey` against each candidate hash.

## Exports
- `THIRD_PARTY_SCOPES` - readonly tuple of all scope strings.
- `type ThirdPartyScope` - union of those strings.
- `interface IThirdPartyTermPlan`, `interface IThirdPartyProductConfig`, `interface IThirdPartyRateLimits`, `interface IThirdPartyClient` - shapes described above.
- `ThirdPartyClient` - Mongoose model `"ThirdPartyClient"` (collection `thirdpartyclients`).
- `interface GeneratedApiKey` - `{ rawKey, hash, prefix }`.
- `generateApiKey(): Promise<GeneratedApiKey>` - creates a new key; `rawKey` must be shown to the caller once and never stored.
- `verifyApiKey(rawKey, hash): Promise<boolean>` - bcrypt compare; returns false on any error.
- `extractKeyPrefix(rawKey): string | null` - splits on `_`, requires `gu`, `tp` and an 8-character prefix.
- `generateWebhookSecret(): string` - 32 random bytes as hex, used to sign outbound webhooks.

## Interfaces
- **Database:** `ThirdPartyClient` (collection `thirdpartyclients`).

## Dependencies
- **Packages:** `mongoose` - schema/model; `bcryptjs` - key hashing; `crypto` - random prefix, key body and webhook secret.

## Used by
`server/middleware/thirdPartyAuth.ts` and `server/middleware/platformKey.ts` (key authentication), `server/routes/thirdPartyAdmin.ts` (mounted at `/garage-admin/third-party-clients`: create/rotate/edit clients), `server/routes/thirdPartyInvoice.ts` and `server/routes/thirdPartyWallet.ts` (mounted at `/api/v1/third-party`), `server/routes/platformOffices.ts`, `server/routes/magicLink.ts`, `server/routes/publicRankBonus.ts`, `server/routes/unilevel-plus.ts`, `server/routes/adminCouponRules.ts`, `server/routes/garageAdminSavedCards.ts`, the combo services (`server/services/comboActivation.ts`, `comboCheckout.ts`, `comboClient.ts`), `server/services/commission.ts`, `server/services/couponRule.ts`, and many hand-run scripts (for example `server/scripts/seed-networkchain-term-plans.ts`, `reprice-networkchain-terms.ts`, `set-combo-default-client.ts`, `redeliver-thirdparty-webhook.ts`, `scripts/mint-synthetic-combo.ts`) - 33 importers in total.

## Notes
- **Possible prefix bug:** the prefix is produced with `base64url`, whose alphabet includes `_` and `-`. A prefix containing `_` (roughly 1 key in 8) makes `extractKeyPrefix` split the key wrongly and return `null` or a wrong prefix, so `thirdPartyAuth` would answer "Malformed API key" for a valid key. Rotating the key works around it; generating the prefix from hex would fix it.
- `webhookSecret` is stored in plaintext because it is needed to sign outgoing webhooks; treat the collection as sensitive.
- Validation of `termPlans` only runs when Mongoose validates (save/create, or updates with `runValidators`).
