# User Login Flow — OTP → orgs → select → token

Complete client-side sequence for logging a user into the app. Every
call in this doc is **unauthenticated** except the final `/auth/me` (needs
the token you just obtained).

## Base URL

- Test: `https://test.garage.app`
- Prod: `https://api.my.garage.app` (subject to env)

All routes below are on this backend. No admin token required.

---

## Step 1 — Request OTP

Emails a 6-digit code to the user (valid **10 minutes**).

```
POST /auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "purpose": "login",       // optional; "login" | "invite" (default "login")
  "isResend": false         // optional; if true the mail comes from the "resend" from-address
}
```

**Response** (200)
```json
{ "ok": true }
```

**Notes**
- Email is trimmed + lowercased server-side.
- `isResend: true` uses `EMAIL_FROM_RESEND_OTP` (throttling/deliverability separation from first-attempt sends).

---

## Step 2 — Verify OTP

Exchanges the code for the user object + org memberships. **This is where the auth decision is made.**

```
POST /auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",         // exactly 6 digits
  "referralCode": "aff_xxx" // optional; affiliateId used to attribute new signups
}
```

### Three possible outcomes

The response shape branches on **how many orgs** the user belongs to.

#### 2a. User has **exactly one** org → auto-selected + token issued

```json
{
  "userId": "68f1fe06876fcc5fadb61984",
  "user": {
    "id": "68f1fe06876fcc5fadb61984",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "user",                 // legacy top-level role
    "organizations": [ /* see shape below */ ],
    "hasOrganizations": true,
    "phone": "+11234567890",        // null if never set
    "phoneVerified": true,
    "currentOrg": {                 // ONLY present in the auto-select case
      "id": "68f1fe05876fcc5fadb61951",
      "name": "Garage HQ",
      "icon": "https://.../logo.png",
      "role": "founder",
      "joinedAt": "2025-10-17T08:27:50.299Z",
      "parent": true,
      "guest": false
    }
  },
  "token": "eyJhbGciOi..."          // ONLY present in the auto-select case
}
```

→ **Client action**: store `token`, use for every subsequent authenticated call.
Skip step 3 entirely.

#### 2b. User has **multiple orgs** → NO token; client must pick

```json
{
  "userId": "68f1fe06876fcc5fadb61984",
  "user": {
    "id": "68f1fe06876fcc5fadb61984",
    "email": "user@example.com",
    "name": "Jane Doe",
    "role": "user",
    "organizations": [
      {
        "id": "68f1fe05876fcc5fadb61951",
        "name": "Garage HQ",
        "icon": "https://.../logo.png",
        "role": "founder",
        "joinedAt": "2025-10-17T08:27:50.299Z",
        "parent": true,
        "guest": false
      },
      {
        "id": "6a12...",
        "name": "Coverfi",
        "icon": "https://.../c.png",
        "role": "stakeholder",
        "joinedAt": "2026-01-05T10:00:00.000Z",
        "parent": false,
        "guest": false
      }
    ],
    "hasOrganizations": true,
    "phone": null,
    "phoneVerified": false
  }
  // no `token` field
  // no `currentOrg` field
}
```

→ **Client action**: render the org picker with `user.organizations`, then call `/auth/select-org` (step 3).

#### 2c. User has **zero orgs** → NO token; client must create/join an org first

```json
{
  "userId": "68f1fe06876fcc5fadb61984",
  "user": {
    "id": "68f1fe06876fcc5fadb61984",
    "email": "user@example.com",
    "name": null,
    "role": "user",
    "organizations": [],
    "hasOrganizations": false,
    "phone": null,
    "phoneVerified": false
  }
  // no `token`, no `currentOrg`
}
```

→ **Client action**: route to org-creation / invite-acceptance flow. Once the user is a member of an org, call `POST /auth/token-after-org` (see step 4).

### Errors

- `400 { "error": "Invalid OTP" }` — code doesn't match or expired.
- `500 { "error": "Failed to create user" }` — server-side hiccup on new-user path.

### Side effects on verify

- If the user is NEW (first time this email verifies), a User doc is created:
  - `referredBy` set when `referralCode` resolves to an existing affiliate.
  - Auto-joined to **GARAGE HQ** as a `guest: true` stakeholder.
  - Welcome email dispatched (fire-and-forget).
- If the user EXISTS and `referralCode` is provided, attribution is upgrade-aware:
  - No prior `referredBy` OR prior source is `founder_default` → **upgraded** to the affiliate; the affiliate gets an "onboarded X" email.
  - Prior source is `affiliate` → **no-op** (first affiliate wins).
- `isVerified: true` is stamped on the User.
- Any Coverfi-provisioned `insurance_user: true` memberships get flipped to `false` (main Garage login "graduates" them out of insurance-only access).

---

## Step 3 — Select an organization

Only needed for the **multi-org** case (2b). Exchanges the user + chosen org for a scoped JWT.

```
POST /auth/select-org
Content-Type: application/json

{
  "userId": "68f1fe06876fcc5fadb61984",
  "orgId": "68f1fe05876fcc5fadb61951"
}
```

**Response** (200)
```json
{
  "token": "eyJhbGciOi...",
  "currentOrg": {
    "id": "68f1fe05876fcc5fadb61951",
    "name": "Garage HQ",
    "role": "founder",
    "joinedAt": "2025-10-17T08:27:50.299Z",
    "parent": true
  }
}
```

**Errors**
- `404 { "error": "User not found" }`.
- `400 { "error": "Organization not found for user" }` — the user isn't a member of that `orgId`.

**Notes**
- NC-affiliate-store orgs (`organization.source === "nc_affiliate_store"`) are **filtered out** by design — they belong to garage-store, not the main app. Attempting to select one returns 400.
- The token's `orgId` scopes the whole session to that org. To switch orgs later, call this endpoint again with a different `orgId`.

---

## Step 4 — Token after joining/creating an org (edge case)

Used after the org-creation flow completes for the zero-org case (2c). Same shape as `/select-org` but skips the NC-affiliate-store filter — needed because a just-created org can be any type.

```
POST /auth/token-after-org
Content-Type: application/json

{ "userId": "...", "orgId": "..." }
```

**Response** (200)
```json
{ "token": "eyJhbGciOi..." }
```

**Errors**
- `404 { "error": "User not found" }`
- `400 { "error": "User not member of organization" }`

---

## The token

Signed with `HS256`. Payload:

```jsonc
{
  "userId": "68f1fe06...",
  "orgId":  "68f1fe05...",  // the currently-selected org
  "role":   "founder",       // membership role in that org
  "name":   "Jane Doe",
  "email":  "user@example.com",
  "guest":  false,           // only on select-org / token-after-org branches
  "iat":    1787031835,
  "exp":    1787636635       // 7 days from iat
}
```

**Usage** — attach on every authenticated request:

```
Authorization: Bearer <token>
```

**Expiry**: 7 days. On `401` from a protected route, re-run steps 1-2 (and 3 if multi-org).

**Switching orgs**: call `/auth/select-org` again with a different `orgId`. Old token is not explicitly revoked — the client just discards it.

---

## Step 5 (optional) — Verify the token is live

Once you have a token, `/auth/me` is the smoke-test endpoint. Requires the header.

```
GET /auth/me
Authorization: Bearer <token>
```

Returns the current user + resolved membership. Use it on app cold-boot to hydrate the session store without a fresh OTP.

---

## Full happy-path pseudocode

```ts
// 1. Ask user for their email → send OTP
await fetch(`${API}/auth/request-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});

// 2. User types the 6-digit OTP → verify
const verifyRes = await fetch(`${API}/auth/verify-otp`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, code }),
}).then((r) => r.json());

let token: string;

if (verifyRes.token) {
  // 2a: auto-selected (single org)
  token = verifyRes.token;
} else if (verifyRes.user.organizations.length > 1) {
  // 2b: multi-org — let the user pick
  const orgId = await pickOrgUi(verifyRes.user.organizations);
  const selectRes = await fetch(`${API}/auth/select-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: verifyRes.userId, orgId }),
  }).then((r) => r.json());
  token = selectRes.token;
} else {
  // 2c: no orgs — route to create/join, then call /auth/token-after-org
  const orgId = await createOrgUi(verifyRes.userId);
  const tokenRes = await fetch(`${API}/auth/token-after-org`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: verifyRes.userId, orgId }),
  }).then((r) => r.json());
  token = tokenRes.token;
}

// 3. Persist + attach on every subsequent call
localStorage.setItem("garage_token", token);
```

---

## Quick reference table

| Step | Endpoint | Auth | Returns token? |
|---|---|---|---|
| Request OTP | `POST /auth/request-otp` | None | No |
| Verify OTP | `POST /auth/verify-otp` | None | Yes, **only** if user has exactly one org |
| Select org | `POST /auth/select-org` | None (userId in body) | Yes |
| Token after org creation | `POST /auth/token-after-org` | None (userId in body) | Yes |
| Session smoke-test | `GET /auth/me` | Bearer | — |

---

## Common client bugs to avoid

- **Assuming `token` always exists on `verify-otp`.** It only does in the single-org case. Check `verifyRes.token` before writing — fall through to `/select-org` when missing.
- **Not filtering `organizations[]` for `guest: true`.** Some UIs want to hide guest memberships from the picker; the API returns them either way.
- **Reusing an old token after `/select-org`.** Every call to `/select-org` mints a fresh token scoped to that org. Discard the previous one.
- **Forgetting to lowercase-normalize the email locally** before sending. The server does it too, but keeping local + server in sync avoids the "why does my resend land in a different mailbox" head-scratcher.
- **Sending `code` with dashes/spaces.** The server expects exactly 6 characters; strip whitespace client-side.
