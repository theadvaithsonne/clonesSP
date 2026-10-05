# Office Grace Programme API

**Base path:** `/platform` · **Shipped:** commit `780fa8d`

Lets an integrating platform create a **starter office** for a founder who holds
no $25 Unilevel Plus licence, and gives them **30 days** to buy one — with a
countdown and live combo pricing to buy from.

Normally office creation requires an active licence
(`services/officeEligibility.ts`, enforced on `POST /org/create-first-time` and
`POST /org/upsert`). These endpoints are the only way around that, and they are
additive: **nothing about the existing routes, the web app, the mobile app, or
GARAGE HQ changes.**

---

## Authentication

Every endpoint requires **both** headers:

| Header | Meaning |
|---|---|
| `Authorization: Bearer <user JWT>` | Which founder the office is for |
| `X-Garage-Platform: <platform key>` | Which platform is vouching for them |

The platform key must carry the **`offices:grace`** scope. The main web and
mobile apps never send this header, so their licence gate is untouched.

Failure modes: missing JWT → `401`; missing key → `401 missing_platform_key`;
unknown/revoked key → `401 invalid_platform_key`; key without the scope →
`403 missing_scope`.

### Provisioning a platform key

Uses the existing admin flow — no new key system:

```http
POST /garage-admin/third-party/clients
{ "name": "Partner Platform", "scopes": ["offices:grace"] }
```

The response returns `apiKey` **once**. Store it; it can be rotated but never
re-read.

---

## Status model

Office state is **derived on every read**, never stored:

| Condition | `status` |
|---|---|
| Founder holds an active licence (bought any time — day 3 or day 300) | `licensed` |
| No licence, `now < expiresAt` | `grace` |
| No licence, `now >= expiresAt` | `locked` |
| Office was never on the programme | `none` |

There is no stored flag to go stale, no cron, and **buying the licence requires
no call to these APIs** — the next status read simply returns `licensed`.

**One grace per user**, keyed on the founder. A second office needs a real
licence.

---

## Endpoints

### 1. `GET /platform/offices/eligibility`

Ask before showing a "create office" button.

```jsonc
{
  "success": true,
  "canCreate": true,
  "reason": "grace_available",   // licence | grace_available | grace_active | grace_used
  "licenceActive": false,
  "existing": null,              // or { orgId, name, state: { ...status object } }
  "graceDays": 30
}
```

| `reason` | `canCreate` | Meaning |
|---|---|---|
| `licence` | `true` | Holds a licence — creates normally, no grace consumed |
| `grace_available` | `true` | Allowed; creating starts the 30-day clock |
| `grace_active` | `false` | Already has a running grace office |
| `grace_used` | `false` | Their grace lapsed — they must buy to create anything |

---

### 2. `POST /platform/offices` — the bypass

Body is **identical to `POST /org/create-first-time`** (`name` required;
`location`, `city`, `state`, `country`, `description`, `icon`, `coverPhoto`,
`category`, … all optional). It runs that exact handler, so membership, floors,
the $25 welcome bonus, the default conference room and the welcome emails all
happen the same way.

```http
POST /platform/offices
{ "name": "Acme Studio", "location": "Chennai", "country": "India" }
```

**`200`** — same body as `create-first-time`, plus `grace` when a window was
started:

```jsonc
{
  "org": { "_id": "…", "name": "Acme Studio", … },
  "membership": { "role": "founder", "organization": { … } },
  "grace": {
    "startedAt": "2026-09-23T10:00:00.000Z",
    "expiresAt": "2026-10-23T10:00:00.000Z",
    "platform": "Partner Platform"
  }
}
```

If the founder already holds a licence the office is created normally and
**`grace` is absent** — no clock is started and their one grace stays unused.

**`409`** — `grace_active` or `grace_used`, with `existing` describing the
office they already have.

> The office is created on the **free/starter tier**, exactly as the normal flow
> does — no office subscription row is written. Founders Office ($96/mo) is a
> separate purchase and is unaffected by this programme.

---

### 3. `GET /platform/offices/:orgId/status` — countdown + lock

Caller must be a member of that office (`403 not_your_office` otherwise).

```jsonc
{
  "success": true,
  "office": { "id": "…", "name": "Acme Studio" },
  "status": "grace",
  "startedAt": "2026-09-23T10:00:00.000Z",
  "expiresAt": "2026-10-23T10:00:00.000Z",
  "secondsRemaining": 2592000,
  "daysRemaining": 30,          // rounded UP, so a working office never shows 0
  "licenceActive": false,
  "graceDays": 30,
  "onGraceProgramme": true,
  "platform": "Partner Platform"
}
```

The licence checked is the **grace founder's**, not the caller's — a
stakeholder reading the status sees the office's real state.

---

### 4. `GET /platform/offices` — this user's grace offices

```jsonc
{
  "success": true,
  "licenceActive": false,
  "offices": [
    { "id": "…", "name": "Acme Studio", "platform": "Partner Platform",
      "status": "grace", "daysRemaining": 12, "secondsRemaining": 1036800,
      "startedAt": "…", "expiresAt": "…", "licenceActive": false, "graceDays": 30 }
  ]
}
```

---

### 5. `GET /platform/offer` — what they can buy

Priced for **this** user right now, straight from `comboWindowFor` +
`quoteAllPlans` — the same functions the wallet page and the magic-link page
use, so this can never quote a different price from them.

```jsonc
{
  "success": true,
  "licenceActive": false,
  "window": {                      // the 24-hour sign-up offer window
    "open": true,
    "startsAt": "2026-09-23T09:00:00.000Z",
    "expiresAt": "2026-09-24T09:00:00.000Z",
    "secondsRemaining": 51240,
    "windowHours": 24
  },
  "magicLink": {
    "token": "ml_…",
    "url": "https://my.garage.app/magic-link/ml_…"
  },
  "headline": { … },               // the cheapest plan — "from $25"
  "plans": [
    {
      "kind": "combo_cart",
      "termMonths": 1,
      "freeMonth": true,
      "includesLicence": true,
      "licenceUsd": 25,
      "subUsd": 0,
      "cartUsd": 25,               // what they actually pay, pre-GST
      "monthsOfAccess": 2,
      "currency": "USD",
      "planLabel": "Monthly",
      "clientName": "NetworkChain",
      "productCode": "GU_SUB_36",
      "comboUsed": false,
      "ownsLicence": false,
      "window": { … }
    }
  ],
  "graceDays": 30
}
```

**Pricing rule (unchanged from the rest of the product):**

| When | Monthly plan |
|---|---|
| Within 24h of registering | `cartUsd: 25`, `freeMonth: true` — $25 licence, first NetworkChain month free |
| After 24h | `cartUsd: 61`, `freeMonth: false` — $25 licence + $36 subscription |

Multi-month terms are returned alongside at their bundle prices.

**Magic link:** the user's existing catalog link — the same row emailed at
sign-up (`sendSignupOffer`) — minted on demand if they never got one.
Idempotent: repeated calls return the same link. **Nothing is emailed from
here**; the platform owns its own messaging.

If no subscription-enabled partner is configured: `plans: []`,
`magicLink: null`, `reason: "no_active_partner"`.

---

### 6. `POST /platform/offer/checkout`

```http
POST /platform/offer/checkout
{ "termMonths": 1 }
```

**`201`**

```jsonc
{
  "success": true,
  "reused": false,                 // true when an existing unpaid invoice was returned
  "quote": { "termMonths": 1, "licenceUsd": 25, "subUsd": 0,
             "cartUsd": 25, "freeMonth": true, "monthsOfAccess": 2 },
  "invoice": {
    "id": "…",
    "invoiceNumber": "INV-…",
    "totalAmount": 2500,           // minor units, GST included where applicable
    "currency": "USD",
    "paymentUrl": "https://my.garage.app/invoice/…"
  }
}
```

Send the founder to `paymentUrl`. The invoice fulfils through the normal path,
so the licence, the free NetworkChain month and the commission distribution all
behave exactly like any other purchase — and the office flips to `licensed` on
the next status read.

**`409 already_licensed`** if they already hold a licence.
**`503 no_active_partner`** if no partner is configured.

---

## Error reference

| HTTP | `error` | Cause |
|---|---|---|
| 401 | — | Missing/invalid user JWT |
| 401 | `missing_platform_key` | No `X-Garage-Platform` header |
| 401 | `invalid_platform_key` | Key unknown or revoked |
| 403 | `missing_scope` | Key lacks `offices:grace` |
| 403 | `not_your_office` | Caller isn't a member of that office |
| 404 | `office_not_found` / `user_not_found` | — |
| 409 | `grace_active` | Already has a running grace office |
| 409 | `grace_used` | Grace lapsed; licence required |
| 409 | `already_licensed` | Checkout attempted with a licence held |
| 409 | `nothing_to_pay` | Quote costs nothing (claim via the standard flow) |
| 503 | `no_active_partner` | No subscription-enabled partner configured |

---

## Guarantees

- `POST /org/create-first-time` and `POST /org/upsert` keep
  `assertCanCreateOffice` **unchanged** — an unlicensed user still gets
  `403 licence_required` there.
- The `organizations.graceProgram` subdocument is **absent** on every office
  created before this or through the normal flow, GARAGE HQ included.
- No middleware was added to any existing route; no existing response changed.
- `create-first-time` is **shared, not copied**, so the money path has one
  implementation.

## ⚠️ Enforcement is advisory

`status: "locked"` is **reported**, not enforced. A locked office remains fully
usable against the rest of the Garage API — our web app, the mobile app, direct
API calls. The integrating platform is expected to honour the lock in its own
UI.

This was a deliberate product decision (status-API-only). If the lock needs to
actually bite, the follow-up is small: store it on the user's membership row
and have `requireAuth` reject that org's requests with `403 office_locked` —
no extra query, covers every office endpoint at once.

---

## Verification

- **9 unit tests** — `src/services/__tests__/officeGrace.test.ts`: status
  boundaries, expiry instant, licence-outranks-lapsed-window, "never on the
  programme" ≠ locked, corrupt-date safety, day rounding.
- **21 end-to-end checks** against the real routes: all four auth guards,
  one-grace-per-user, the 409s, expiry → `locked`, licence flipping `locked` →
  `licensed`, magic-link idempotency, foreign-office refusal, the $25 → $61
  price flip, and proof the ordinary route still returns
  `403 licence_required` for the same user.
