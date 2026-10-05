# NetworkChains Super-Admin Panel → Garage Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the NetworkChains super-admin panel from `admin.garage.app/garage-admin` under the existing "NetworkChains" dashboard type, visually identical to `networkchains.com/admin`, with no second login.

**Architecture:** NC's admin pages move into `app/garage-admin/(admin-dashboard)/networkchains/*` and render inside the Garage admin shell. They keep talking to contacts-backend, authenticated by a short-lived `nc_admin_token` obtained by silently exchanging the existing `garage_admin_token` at a new `POST /admin/auth/elevate-garage` endpoint. Garage's `DataTable` becomes the single table stack, gaining three additive props so it can reproduce NC's exact metrics.

**Tech Stack:** Next.js 15 App Router (Turbopack), React 19, TypeScript, Tailwind, `@tanstack/react-query` v5, Express + Mongoose (contacts-backend), `node:test` + `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-02-nc-admin-port-to-garage-admin-design.md`

## Global Constraints

- **Repos.** Frontend work: `client/garage-web-app-nextjs-v1` (branch `main`, clean). Backend work: `server/contacts-backend` (branch `master`; untracked `probe.tmp.ts` and `src/scripts/preview-catchup-reminders.ts` belong to another session — **never** `git add` them). Both are shared checkouts: stage explicit paths, never `git add -A` or `git add .`, never stage `dist/`.
- **Source repo `client/networkchains-web-app-nextjs-v1-invite-clone` is READ-ONLY for this work.** Do not delete, redirect, or modify `networkchains.com/admin`. It keeps running unchanged.
- **Commit authorship.** Commits in `garage-web-app-nextjs-v1` are authored as Chiranjeeb Jena (`git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit`). `contacts-backend` commits use the default identity.
- **Never add a `Co-Authored-By` or any AI-attribution trailer** to any commit or PR in either repo.
- **Do not branch or push unless asked.** Commit on the current branch.
- **API base URL.** Ported NC clients read `process.env.NEXT_PUBLIC_NC_API_URL ?? "https://backend.networkchains.com"`. They must **never** read `NEXT_PUBLIC_API_URL` — in garage-web-app that variable points at garagenew-backend (`http://localhost:4000`) and every NC call would 404 silently.
- **localStorage keys.** `garage_admin_token` / `garage_admin_info` (Garage session, already present). `nc_admin_token` (NC admin token, new here, same key name NC uses).
- **Visual parity is the acceptance bar.** Every ported page must be screenshot-compared against the same page on `networkchains.com/admin`. "Renders without errors" is not sufficient.
- **Test infrastructure.** contacts-backend: `npm test` → `node --import tsx --test 'src/**/*.test.ts'` — colocated `src/**/*.test.ts`, `node:test` + `node:assert/strict`, models stubbed rather than hitting Mongo. **garage-web-app has no test framework** (scripts are only `dev`, `build`, `start`, `lint`); adding one is out of scope. Frontend verification is the procedure in **Frontend verification** below, plus screenshot comparison. Backend tasks are TDD; frontend tasks are not, and this plan does not pretend otherwise.
- **Do not modify garage's existing admin pages.** All `DataTable` changes must default to current behaviour.

### Frontend verification (read before running any check in garage-web-app)

Per this repo's `CLAUDE.md`:

- **`npm run build` is the authoritative check.** It must exit 0. Turbopack does
  not typecheck, so a green build alone is necessary but not sufficient.
- **`tsc --noEmit` reports ~160 PRE-EXISTING errors** in this repo (mostly
  `WorkshopsPage.tsx` and generated `.next/types`). It has never been tsc-clean,
  so a non-zero exit **proves nothing**. Never write "expected: clean" for a bare
  tsc run here. Judge your work by grepping the tsc output for the files you
  actually touched and confirming none appear.
- **Never run `npx --no tsc --noEmit`** — it emits nothing and exits 0 regardless,
  which reads as a false pass. Use `./node_modules/.bin/tsc --noEmit`.
- `next.config.ts` ignores TypeScript and ESLint errors during build, which is
  exactly why the touched-file grep matters.

So each frontend task's check is:

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
# List the files this task touched, one path fragment per line:
printf '%s\n' <paths this task created or modified> > /tmp/nc-touched.txt
npm run build                                            # must exit 0
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt \
  || echo "no errors in touched files"                   # must print the fallback
npm run lint
```

Every `npm run build` / tsc block below is shorthand for this procedure; populate
`/tmp/nc-touched.txt` from that task's **Files** list before running it.

- **contacts-backend, by contrast, IS tsc-clean** (verified: `./node_modules/.bin/tsc --noEmit` exits 0). There, "expected: no errors" means exactly that.

---

## File Structure

### `server/contacts-backend`

| File | Responsibility |
|---|---|
| Create `src/models/garageAdmin.readonly.model.ts` | Read-only Mongoose view of the `garageadmins` collection (shared DB). Never written to. |
| Create `src/routes/admin-auth.garage.ts` | `elevateGarageAdmin()` — the pure decision function, exported for testing. |
| Create `src/routes/admin-auth.garage.test.ts` | Unit tests for that function. |
| Modify `src/routes/admin-auth.ts` | Mount `POST /elevate-garage` as a thin wrapper. |

### `client/garage-web-app-nextjs-v1`

| File | Responsibility |
|---|---|
| Create `lib/nc-admin-api/auth.ts` | `nc_admin_token` lifecycle: `ensureNcAdminToken()`, `clearNcAdminToken()`, `ncAdminFetch()` with one-shot 401 re-elevation. Error classes. |
| Create `lib/nc-admin-api/admin.ts` | Port of NC `lib/api/admin.ts`, rebased onto `ncAdminFetch`. |
| Create `lib/nc-admin-api/{admin-axons,admin-funnels,admin-posthog,admin-sentry,admin-tickets}.ts` | Phase 2, one per page that needs it. |
| Create `components/nc-admin/nc-admin-query-provider.tsx` | Scoped `QueryClientProvider` (garage has no global one). |
| Create `components/nc-admin/nc-admin-gate.tsx` | Blocks on `ensureNcAdminToken()`; spinner, then children; not-authorised panel on failure. |
| Create `app/garage-admin/(admin-dashboard)/networkchains/layout.tsx` | Wraps the NC section in provider + gate. |
| Create `lib/nc-admin-first-route.ts` | `NC_FIRST_HREF` — the section's landing route, in its own module so the server index route need not import the client layout. |
| Create `app/garage-admin/(admin-dashboard)/networkchains/page.tsx` | Redirects to `NC_FIRST_HREF`. |
| Create `app/garage-admin/(admin-dashboard)/networkchains/<section>/page.tsx` | One per ported section. |
| Create `components/nc-admin/{axons,sentry,users}/*`, `components/nc-admin/{device-switch,product-switch}.tsx` | Ported NC admin sub-components. |
| Create `components/data-table/{TableTopBar,ExportPanel,FilterDrawer,SelectionBar,AppliedFilterChips}.tsx` | `topBar`-slot components garage lacks. |
| Modify `components/data-table/types.ts` | `frozen` widened; `rowHeight`, `headerHeight` props added. |
| Modify `components/data-table/DataTable.tsx` | `stickyRight` map; `rowHeight` / `headerHeight` honoured. |
| Modify `app/garage-admin/(admin-dashboard)/layout.tsx` | `networkchains` → `ready: true`; `NC_GROUPS`; TypeSheet navigation; deep-link type sync. |

---

# PHASE 1 — Thin slice

Proves the auth path and the table path end to end before nine more pages depend on them.

---

### Task 1: Read-only GarageAdmin model + elevation decision function (contacts-backend)

**Files:**
- Create: `server/contacts-backend/src/models/garageAdmin.readonly.model.ts`
- Create: `server/contacts-backend/src/routes/admin-auth.garage.ts`
- Test: `server/contacts-backend/src/routes/admin-auth.garage.test.ts`

**Interfaces:**
- Consumes: `env.JWT_SECRET`, `superAdminEmails()` from `src/routes/admin-auth.ts` (already exported).
- Produces:
  - `GarageAdminRO` — Mongoose model bound to collection `garageadmins`, fields `{ email: string; role: string; isActive: boolean }`.
  - `elevateGarageAdmin(authHeader: string | undefined): Promise<{ status: 200; token: string; email: string } | { status: 401 | 403; error: string }>` — never throws.

**Context an implementer needs:**

`garagenew-backend` mints the Garage admin token as
`signJwt({ garageAdminId, role, email })` (`src/controllers/garageAdmin.controller.ts:277`).
Both backends share `JWT_SECRET` **and** the same MongoDB (`roam-admin-prod`), so
this code can verify the signature *and* re-read the admin record. The existing
`/elevate` route deliberately checks the DB rather than the JWT claim; mirror that.

`garagenew-backend`'s model is `model("GarageAdmin", …)`, so the collection is
`garageadmins`.

- [ ] **Step 1: Write the read-only model**

Create `src/models/garageAdmin.readonly.model.ts`:

```ts
/**
 * READ-ONLY view of garagenew-backend's `garageadmins` collection.
 *
 * contacts-backend and garagenew-backend share one MongoDB (roam-admin-prod),
 * which lets the garage→NC admin elevation re-check the admin record instead of
 * trusting a JWT claim. This model must NEVER be written to — garagenew-backend
 * owns this collection.
 */
import { Schema, model } from "mongoose";

const GarageAdminROSchema = new Schema(
  {
    email: { type: String },
    role: { type: String },
    isActive: { type: Boolean },
  },
  { collection: "garageadmins", strict: false },
);

export interface GarageAdminRODoc {
  email?: string;
  role?: string;
  isActive?: boolean;
}

export const GarageAdminRO = model<GarageAdminRODoc>(
  "GarageAdminRO",
  GarageAdminROSchema,
);
```

- [ ] **Step 2: Write the failing tests**

Create `src/routes/admin-auth.garage.test.ts`:

```ts
/**
 * Garage → NetworkChains admin elevation.
 *
 * Guards the gate on POST /admin/auth/elevate-garage: only an ACTIVE
 * garage-super-admin whose CURRENT email is on the SUPER_ADMIN_EMAILS allowlist
 * may exchange a garage admin token for an NC admin token.
 *
 * Run: npx tsx --test src/routes/admin-auth.garage.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.SUPER_ADMIN_EMAILS = "boss@garage.app, other@garage.app";

import { env } from "../config/env";
import { GarageAdminRO } from "../models/garageAdmin.readonly.model";
import { elevateGarageAdmin } from "./admin-auth.garage";

type AnyFn = (...args: unknown[]) => unknown;
function stub(obj: Record<string, unknown>, key: string, impl: AnyFn): () => void {
  const original = obj[key];
  obj[key] = impl;
  return () => {
    obj[key] = original;
  };
}

/** Stub GarageAdminRO.findById(...).select(...).lean() → doc */
function stubAdmin(doc: unknown): () => void {
  return stub(GarageAdminRO as unknown as Record<string, unknown>, "findById", () => ({
    select: () => ({ lean: () => Promise.resolve(doc) }),
  }));
}

const garageToken = (payload: Record<string, unknown>) =>
  `Bearer ${jwt.sign(payload, env.JWT_SECRET)}`;

test("200: active garage-super-admin on the allowlist gets an NC admin token", async () => {
  const restore = stubAdmin({ email: "boss@garage.app", role: "garage-super-admin", isActive: true });
  try {
    const res = await elevateGarageAdmin(garageToken({ garageAdminId: "abc123" }));
    assert.equal(res.status, 200);
    assert.equal(res.status === 200 && res.email, "boss@garage.app");
    const decoded = jwt.verify((res as { token: string }).token, env.JWT_SECRET) as Record<string, unknown>;
    assert.equal(decoded.admin, true);
    assert.equal(decoded.email, "boss@garage.app");
  } finally {
    restore();
  }
});

test("403: a plain garage-admin (not super) is rejected", async () => {
  const restore = stubAdmin({ email: "boss@garage.app", role: "garage-admin", isActive: true });
  try {
    const res = await elevateGarageAdmin(garageToken({ garageAdminId: "abc123" }));
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test("403: super-admin role but email absent from the allowlist", async () => {
  const restore = stubAdmin({ email: "nobody@garage.app", role: "garage-super-admin", isActive: true });
  try {
    const res = await elevateGarageAdmin(garageToken({ garageAdminId: "abc123" }));
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test("403: deactivated admin record", async () => {
  const restore = stubAdmin({ email: "boss@garage.app", role: "garage-super-admin", isActive: false });
  try {
    const res = await elevateGarageAdmin(garageToken({ garageAdminId: "abc123" }));
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test("403: admin record no longer exists", async () => {
  const restore = stubAdmin(null);
  try {
    const res = await elevateGarageAdmin(garageToken({ garageAdminId: "abc123" }));
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test("401: the JWT claim is not trusted — DB email wins over a forged claim", async () => {
  // Token claims an allowlisted email; the DB says otherwise. DB must win.
  const restore = stubAdmin({ email: "nobody@garage.app", role: "garage-super-admin", isActive: true });
  try {
    const res = await elevateGarageAdmin(
      garageToken({ garageAdminId: "abc123", email: "boss@garage.app", role: "garage-super-admin" }),
    );
    assert.equal(res.status, 403);
  } finally {
    restore();
  }
});

test("401: token signed with the wrong secret", async () => {
  const bad = `Bearer ${jwt.sign({ garageAdminId: "abc123" }, "not-the-secret")}`;
  const res = await elevateGarageAdmin(bad);
  assert.equal(res.status, 401);
});

test("401: a NetworkChains user token (userId, no garageAdminId) is not accepted", async () => {
  const res = await elevateGarageAdmin(garageToken({ userId: "u1", orgId: "o1" }));
  assert.equal(res.status, 401);
});

test("401: missing or malformed Authorization header", async () => {
  assert.equal((await elevateGarageAdmin(undefined)).status, 401);
  assert.equal((await elevateGarageAdmin("Token abc")).status, 401);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend
npx tsx --test src/routes/admin-auth.garage.test.ts
```

Expected: FAIL — cannot find module `./admin-auth.garage`.

- [ ] **Step 4: Write the implementation**

Create `src/routes/admin-auth.garage.ts`:

```ts
/**
 * Garage → NetworkChains silent admin elevation.
 *
 * The Garage admin console (admin.garage.app/garage-admin) now hosts the NC
 * super-admin pages. Its operators are already OTP-authenticated against
 * garagenew-backend, so re-OTP'ing them here would be redundant — the same
 * reasoning as the session-based /elevate route next door.
 *
 * We trust the garage admin token ONLY to name an admin id: both backends share
 * JWT_SECRET, so the signature is verifiable, but the role/email claims inside
 * it are ignored. The authority is the `garageadmins` record read fresh from the
 * shared DB, plus the same SUPER_ADMIN_EMAILS allowlist that gates the OTP flow.
 * This grants nothing an allowlisted super admin cannot already obtain; it only
 * accepts a different proof of identity.
 */
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { GarageAdminRO } from "../models/garageAdmin.readonly.model";
import { superAdminEmails } from "./admin-auth";

export type ElevateGarageResult =
  | { status: 200; token: string; email: string }
  | { status: 401 | 403; error: string };

const GARAGE_SUPER_ADMIN_ROLE = "garage-super-admin";

export async function elevateGarageAdmin(
  authHeader: string | undefined,
): Promise<ElevateGarageResult> {
  if (!authHeader) return { status: 401, error: "Authorization header required" };

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { status: 401, error: "Invalid authorization format. Use: Bearer <token>" };
  }

  let payload: { garageAdminId?: string };
  try {
    payload = jwt.verify(parts[1], env.JWT_SECRET) as { garageAdminId?: string };
  } catch {
    return { status: 401, error: "Invalid token" };
  }

  // A NetworkChains user token verifies against the same secret but is not a
  // garage admin token — require the claim that only garagenew-backend mints.
  if (!payload?.garageAdminId) {
    return { status: 401, error: "Not a garage admin token" };
  }

  const admin = await GarageAdminRO.findById(payload.garageAdminId)
    .select("email role isActive")
    .lean();

  if (!admin || admin.isActive === false) return { status: 403, error: "not authorized" };
  if (admin.role !== GARAGE_SUPER_ADMIN_ROLE) return { status: 403, error: "not authorized" };

  const email = String(admin.email || "").trim().toLowerCase();
  if (!email || !superAdminEmails().includes(email)) {
    return { status: 403, error: "not authorized" };
  }

  const token = jwt.sign({ admin: true, email }, env.JWT_SECRET, { expiresIn: "2h" });
  return { status: 200, token, email };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend
npx tsx --test src/routes/admin-auth.garage.test.ts
```

Expected: PASS, 9/9.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend
git add src/models/garageAdmin.readonly.model.ts src/routes/admin-auth.garage.ts src/routes/admin-auth.garage.test.ts
git commit -m "feat(admin-auth): garage→NC admin elevation decision function"
```

---

### Task 2: Mount `POST /admin/auth/elevate-garage` (contacts-backend)

**Files:**
- Modify: `server/contacts-backend/src/routes/admin-auth.ts` (append before `export default router`)

**Interfaces:**
- Consumes: `elevateGarageAdmin()` from Task 1; `auditAuth()` already defined at the top of `admin-auth.ts`.
- Produces: `POST /admin/auth/elevate-garage` → `{ ok: true, token }` on success; `{ error }` on 401/403.

- [ ] **Step 1: Add the route**

In `src/routes/admin-auth.ts`, add the import beside the existing ones:

```ts
import { elevateGarageAdmin } from "./admin-auth.garage";
```

and insert this immediately before `export default router;`:

```ts
// ─── POST /admin/auth/elevate-garage ───────────────────────────────
// Silent step-up from the Garage admin console, which now hosts these NC
// admin pages. Deliberately NOT behind requireAuth: that middleware demands
// userId + orgId, which a garage admin token does not carry. All gating lives
// in elevateGarageAdmin() — see that file for why the JWT claims are ignored.
router.post("/elevate-garage", async (req: Request, res: Response) => {
  try {
    const result = await elevateGarageAdmin(req.headers.authorization);
    if (result.status !== 200) {
      auditAuth(req, "admin_auth_elevate_garage_denied", { status: result.status });
      res.status(result.status).json({ error: result.error });
      return;
    }
    auditAuth(req, "admin_auth_elevate_garage_success", { email: result.email });
    res.json({ ok: true, token: result.token });
  } catch (err) {
    console.error("[admin-auth] elevate-garage error:", err);
    res.status(500).json({ error: "Failed to elevate" });
  }
});
```

- [ ] **Step 2: Verify the route file still compiles**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Confirm the whole admin-auth suite is green**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend && npm test
```

Expected: PASS. If unrelated pre-existing failures appear, note them and do not fix them here.

- [ ] **Step 4: Smoke-test against a running dev server**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend && npm run dev
# in another shell — token taken from localStorage.garage_admin_token in a
# logged-in admin.garage.app/garage-admin session:
curl -s -X POST http://localhost:PORT/admin/auth/elevate-garage \
  -H "Authorization: Bearer <garage_admin_token>" | head -c 200
```

Expected: `{"ok":true,"token":"…"}`. With no header: `401`. With a non-super-admin's token: `403`.

- [ ] **Step 5: Commit**

```bash
cd /Users/mohammed/dev/technsure/server/contacts-backend
git add src/routes/admin-auth.ts
git commit -m "feat(admin-auth): POST /admin/auth/elevate-garage"
```

---

### Task 3: NC admin token lifecycle in garage-web-app

**Files:**
- Create: `client/garage-web-app-nextjs-v1/lib/nc-admin-api/auth.ts`
- Modify: `client/garage-web-app-nextjs-v1/.env` (add one variable)

**Interfaces:**
- Consumes: `localStorage.garage_admin_token` (set by the existing Garage admin login).
- Produces:
  - `NC_API_URL: string`
  - `class NcAdminUnauthorizedError extends Error`
  - `class NcAdminApiError extends Error { status: number }`
  - `getNcAdminToken(): string | null`
  - `setNcAdminToken(t: string): void`
  - `clearNcAdminToken(): void`
  - `ensureNcAdminToken(): Promise<string | null>`
  - `ncAdminFetch<T>(path: string, init?: RequestInit): Promise<T>` — unwraps `{ ok, data }`, re-elevates once on 401
  - `ncAdminFetchRaw<T>(path: string, init?: RequestInit): Promise<T>` — same auth, returns the body unwrapped

- [ ] **Step 1: Add the environment variable**

Append to `client/garage-web-app-nextjs-v1/.env`:

```
NEXT_PUBLIC_NC_API_URL=https://backend.networkchains.com
```

For local backend work, point it at the contacts-backend dev port instead. Do **not** reuse `NEXT_PUBLIC_API_URL` — in this app that is garagenew-backend.

- [ ] **Step 2: Write the auth module**

Create `lib/nc-admin-api/auth.ts`:

```ts
"use client";

/**
 * Auth for the ported NetworkChains admin pages.
 *
 * These pages talk to contacts-backend (backend.networkchains.com), NOT the
 * Garage backend, and they need an NC admin token rather than the Garage admin
 * session token. We obtain one by silently exchanging the Garage token at
 * POST /admin/auth/elevate-garage — no second login, no OTP gate.
 *
 * NEXT_PUBLIC_NC_API_URL is deliberately its own variable: in this app
 * NEXT_PUBLIC_API_URL points at garagenew-backend, so reading it here would send
 * every NC admin call to the wrong backend and 404 silently.
 */

export const NC_API_URL =
  process.env.NEXT_PUBLIC_NC_API_URL ?? "https://backend.networkchains.com";

const NC_TOKEN_KEY = "nc_admin_token";
const GARAGE_TOKEN_KEY = "garage_admin_token";

/** Thrown when an NC admin request returns 401 after a re-elevation attempt. */
export class NcAdminUnauthorizedError extends Error {
  constructor(message = "NetworkChains admin session expired") {
    super(message);
    this.name = "NcAdminUnauthorizedError";
  }
}

/** Generic NC admin API error carrying the HTTP status for UI mapping. */
export class NcAdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NcAdminApiError";
    this.status = status;
  }
}

export function getNcAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NC_TOKEN_KEY);
}

export function setNcAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NC_TOKEN_KEY, token);
}

export function clearNcAdminToken(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(NC_TOKEN_KEY);
}

/** In-flight elevation, so N parallel hooks trigger one request, not N. */
let elevating: Promise<string | null> | null = null;

async function elevate(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const garageToken = window.localStorage.getItem(GARAGE_TOKEN_KEY);
  if (!garageToken) return null;
  try {
    const res = await fetch(`${NC_API_URL}/admin/auth/elevate-garage`, {
      method: "POST",
      headers: { Authorization: `Bearer ${garageToken}` },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { token?: string };
    if (!json.token) return null;
    setNcAdminToken(json.token);
    return json.token;
  } catch {
    return null;
  }
}

/**
 * Cached NC admin token, elevating from the Garage session if absent.
 * Returns null when the operator is not an allowlisted garage-super-admin —
 * callers render the not-authorised panel rather than an OTP gate.
 */
export async function ensureNcAdminToken(): Promise<string | null> {
  const existing = getNcAdminToken();
  if (existing) return existing;
  if (!elevating) {
    elevating = elevate().finally(() => {
      elevating = null;
    });
  }
  return elevating;
}

async function call(path: string, init: RequestInit, token: string): Promise<Response> {
  return fetch(`${NC_API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

/** Authed request with one-shot re-elevation on 401. */
async function request(path: string, init: RequestInit = {}): Promise<Response> {
  let token = await ensureNcAdminToken();
  if (!token) throw new NcAdminUnauthorizedError("Not authorised for NetworkChains admin");

  let res = await call(path, init, token);
  if (res.status === 401) {
    // Expired or revoked: drop it, elevate once more, retry once. A second 401
    // is terminal — never loop.
    clearNcAdminToken();
    token = await ensureNcAdminToken();
    if (!token) throw new NcAdminUnauthorizedError();
    res = await call(path, init, token);
    if (res.status === 401) {
      clearNcAdminToken();
      throw new NcAdminUnauthorizedError();
    }
  }
  return res;
}

/** Authed request returning the `data` field of contacts-backend's envelope. */
export async function ncAdminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: T;
    error?: string;
  };
  if (!res.ok || json.ok === false || json.data === undefined) {
    throw new NcAdminApiError(json.error || `Request failed (${res.status})`, res.status);
  }
  return json.data;
}

/** Authed request returning the raw body — for endpoints with no envelope. */
export async function ncAdminFetchRaw<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new NcAdminApiError(json?.error || `Request failed (${res.status})`, res.status);
  }
  return json;
}
```

- [ ] **Step 3: Typecheck**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback.

- [ ] **Step 4: Commit**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
git add lib/nc-admin-api/auth.ts .env
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(nc-admin): NC admin token lifecycle with silent garage elevation"
```

---

### Task 4: Port the NC admin API client

**Files:**
- Create: `client/garage-web-app-nextjs-v1/lib/nc-admin-api/admin.ts`
- Read (do not modify): `client/networkchains-web-app-nextjs-v1-invite-clone/lib/api/admin.ts` (1307 lines)

**Interfaces:**
- Consumes: everything from `lib/nc-admin-api/auth.ts` (Task 3).
- Produces: all exported types and data functions of NC's `lib/api/admin.ts`, unchanged in name and signature — including `ADMIN_PRODUCTS`, `PRODUCT_LABELS`, `formatCents`, `type AdminProduct`, `type UsageUsersData`, `type UsageSummaryData`, `type UsageUserDetailData`, `type SubUser`, `getUsageSummary`, `getUsageUsers`, `getUsageUser`, `getSubscriptionUsers`, `activateSubscription`, `expireSubscription`, and the remaining page functions used in Phase 2.

**Porting rules (apply mechanically):**

1. Copy the file verbatim, then apply the substitutions below. Keep every export name identical so ported pages need no edits beyond their import path.
2. Delete the local `API_URL`, `ADMIN_TOKEN_KEY`, `getAdminToken`, `setAdminToken`, `clearAdminToken`, `parseJson`, `postPublic`, `getAuthed`, `AdminUnauthorizedError`, `AdminApiError`, `requestAdminOtp`, `verifyAdminOtp`, and `elevateAdmin`. The OTP flow is not ported.
3. Re-export the replacements so page imports keep working:

```ts
export {
  NcAdminUnauthorizedError as AdminUnauthorizedError,
  NcAdminApiError as AdminApiError,
  getNcAdminToken as getAdminToken,
  clearNcAdminToken as clearAdminToken,
} from "./auth";
```

4. Replace every `getAuthed<T>(path)` call with `ncAdminFetch<T>(path)`.
5. Replace `adminRawGet<T>(path)` / `adminRawPost<T>(path, body)` bodies with
   `ncAdminFetchRaw<T>(path)` / `ncAdminFetchRaw<T>(path, { method: "POST", body: JSON.stringify(body) })`.
6. Replace the bespoke token reads at NC `admin.ts:353`, `:375`, `:886`, and `adminAffiliateFetch` at `:1276` with the same `ncAdminFetch` / `ncAdminFetchRaw` helpers.
7. Leave every type definition, enum, label map, and formatter untouched.

- [ ] **Step 1: Copy the source file**

```bash
cd /Users/mohammed/dev/technsure
cp client/networkchains-web-app-nextjs-v1-invite-clone/lib/api/admin.ts \
   client/garage-web-app-nextjs-v1/lib/nc-admin-api/admin.ts
```

- [ ] **Step 2: Apply the porting rules above**

Work through the file top to bottom. Add this header comment in place of the original module docstring:

```ts
/**
 * NetworkChains super-admin API client, ported from the NC web app.
 *
 * Identical surface to networkchains-web-app `lib/api/admin.ts` so the ported
 * pages import the same names — only the transport changed: auth now comes from
 * ./auth (garage→NC silent elevation) instead of the NC OTP flow.
 *
 * Source of truth for behaviour remains contacts-backend's /admin routes.
 */
```

- [ ] **Step 3: Verify no stale references survive**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
grep -nE "NEXT_PUBLIC_API_URL|getAuthed|postPublic|adminRawGet|adminRawPost|verifyAdminOtp|elevateAdmin" lib/nc-admin-api/admin.ts
```

Expected: **no output**. Any hit means a substitution was missed — in particular a surviving `NEXT_PUBLIC_API_URL` would silently point at the Garage backend.

- [ ] **Step 4: Typecheck**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback.

- [ ] **Step 5: Commit**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
git add lib/nc-admin-api/admin.ts
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(nc-admin): port NC admin API client onto garage elevation transport"
```

---

### Task 5: Teach garage's DataTable NC's metrics

**Files:**
- Modify: `client/garage-web-app-nextjs-v1/components/data-table/types.ts`
- Modify: `client/garage-web-app-nextjs-v1/components/data-table/DataTable.tsx`
- Read (reference): `client/networkchains-web-app-nextjs-v1-invite-clone/components/data-table/DataTable.tsx:149-176, 259-282, 542-556`

**Interfaces:**
- Produces: `ColumnDef.frozen?: boolean | "left" | "right"`; `DataTableProps.rowHeight?: number | "auto"`; `DataTableProps.headerHeight?: number`.

**Why:** garage's table hardcodes `ROW_H = 95` and a 45px header, built for its own avatar-plus-multi-line-money cells. NC's rows are auto-height (`py-3.5`) under a 48px header, and NC right-pins Actions columns. All three additions default to today's garage behaviour, and every existing garage caller passes `frozen: true` or omits it — so no shipping table changes.

- [ ] **Step 1: Widen `frozen` and add the two metric props in `types.ts`**

Replace the `frozen?: boolean; // sticky to the left edge (e.g. Name)` line in `ColumnDef` with:

```ts
  /** Sticky to an edge on horizontal scroll. `true`/"left" pins to the left
   *  (e.g. Name); "right" pins to the right (e.g. an Actions column). Only
   *  leading-contiguous left and trailing-contiguous right columns stick. */
  frozen?: boolean | "left" | "right";
```

Add to `DataTableProps<T>`:

```ts
  /**
   * Row height in px, or "auto" to let cell padding size the row.
   *
   * Defaults to 95 — Garage's own tables carry avatar + multi-line money cells
   * and are designed around that height. The ported NetworkChains admin tables
   * are compact and pass "auto" to reproduce their original metrics exactly.
   */
  rowHeight?: number | "auto";
  /** Header row height in px. Defaults to Garage's 45; NC's tables pass 48. */
  headerHeight?: number;
```

- [ ] **Step 2: Add `stickyRight` in `DataTable.tsx`**

Update the destructured props (near `stickyBg = "#0b0b0b"`) to include:

```ts
  rowHeight = 95,
  headerHeight = 45,
```

Change the `stickyLeft` loop guard from `if (!c.frozen) break;` to:

```ts
      if (!(c.frozen === true || c.frozen === "left")) break; // leading contiguous only
```

and add immediately after the `stickyLeft` `useMemo`:

```ts
  // Right offset for the sticky trailing right-frozen columns (e.g. Actions), so
  // they stay reachable no matter the horizontal scroll — the mirror of stickyLeft.
  const stickyRight = useMemo(() => {
    const map = new Map<string, number>();
    let right = 0;
    for (let i = orderedCols.length - 1; i >= 0; i--) {
      const c = orderedCols[i];
      if (c.frozen !== "right") break; // trailing contiguous only
      map.set(c.id, right);
      right += widthOf(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderedCols, widths]);
```

- [ ] **Step 3: Thread it through the header cell**

In the `orderedCols.map((c, idx) => {…})` header block, replace

```ts
                const left = stickyLeft.get(c.id);
```

with

```ts
                const left = stickyLeft.get(c.id);
                const right = stickyRight.get(c.id);
                const frozenX = left != null || right != null;
```

change the `<th>` `className` sticky-elevation condition from `left != null ? "z-30" : ""` to `frozenX ? "z-30" : ""`, and add to its `style` (keeping `left` as it is):

```ts
                      height: headerHeight,
                      right,
```

`h-[45px]` appears **twice** in this file and both must give way to the prop —
line 319 (the select-all checkbox `<th>`) and line 356 (the column `<th>`).
Remove the utility class from both and set `style={{ height: headerHeight }}` on
the checkbox `<th>` too, or its 45px will hold the header row taller than NC's 48
regardless of what the columns do.

- [ ] **Step 4: Thread it through the row cell**

In `RowInner`, add `stickyRight` to both the destructured params and the props type:

```ts
  stickyRight,
```
```ts
  stickyRight: Map<string, number>;
```

Replace

```ts
        const left = stickyLeft.get(c.id);
```

with

```ts
        const left = stickyLeft.get(c.id);
        const right = stickyRight.get(c.id);
        const frozenX = left != null || right != null;
```

change the frozen-cell `className` condition from `left != null` to `frozenX`, and in the `<td>` `style` replace `height: ROW_H,` with:

```ts
              ...(rowHeight === "auto" ? {} : { height: rowHeight }),
              right,
```

`RowInner` needs `rowHeight` passed down — add it to the destructured params and the props type as `rowHeight: number | "auto";`, and pass `rowHeight={rowHeight}` at the `<DataRow …>` call site alongside the existing `stickyLeft={stickyLeft}`. Pass `stickyRight={stickyRight}` there too.

- [ ] **Step 5: Typecheck and lint**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback.

- [ ] **Step 6: Regression-check the existing garage tables**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1 && npm run dev
```

Visit and confirm each renders exactly as before (95px rows, 45px header, left-frozen first column, no right-pinning):
- `/garage-admin/one-time-affiliates`
- `/garage-admin/networkchain-subs`
- `/garage-admin/users`

This is the only step guarding against a regression in shipping pages — do not skip it.

- [ ] **Step 7: Commit**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
git add components/data-table/types.ts components/data-table/DataTable.tsx
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(data-table): right-frozen columns, configurable row and header height"
```

---

### Task 6: Port the five topBar-slot components

**Files:**
- Create: `client/garage-web-app-nextjs-v1/components/data-table/TableTopBar.tsx`
- Create: `client/garage-web-app-nextjs-v1/components/data-table/AppliedFilterChips.tsx`
- Create: `client/garage-web-app-nextjs-v1/components/data-table/SelectionBar.tsx`
- Create: `client/garage-web-app-nextjs-v1/components/data-table/FilterDrawer.tsx`
- Create: `client/garage-web-app-nextjs-v1/components/data-table/ExportPanel.tsx`
- Create: `client/garage-web-app-nextjs-v1/lib/hooks/use-debounced-value.ts`

**Interfaces:**
- Produces (names must match NC exactly so ported pages compile unchanged):
  - `TableTopBar`, `type TopBarView`
  - `AppliedFilterChips`, `type FilterChip`
  - `SelectionBar`
  - `FilterDrawer`, `facetField`, `numericRangeField`, `type FilterField`
  - `ExportPanel`, `ExportButton`, `type ExportField<T>`
  - `useDebouncedValue`

**Why these are not table internals:** garage's `DataTable` exposes `topBar?: ReactNode` — *"The whole top control bar (view selector + search + actions). Page-supplied."* NC pages render all five inside that slot. They are page furniture that happens to live in the `data-table` folder.

- [ ] **Step 1: Copy the six files verbatim**

```bash
cd /Users/mohammed/dev/technsure
NC=client/networkchains-web-app-nextjs-v1-invite-clone
G=client/garage-web-app-nextjs-v1
cp $NC/components/data-table/TableTopBar.tsx        $G/components/data-table/
cp $NC/components/data-table/AppliedFilterChips.tsx $G/components/data-table/
cp $NC/components/data-table/SelectionBar.tsx       $G/components/data-table/
cp $NC/components/data-table/FilterDrawer.tsx       $G/components/data-table/
cp $NC/components/data-table/ExportPanel.tsx        $G/components/data-table/
cp $NC/lib/hooks/use-debounced-value.ts             $G/lib/hooks/
```

- [ ] **Step 2: Resolve import drift**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
grep -nE 'from "@/' components/data-table/{TableTopBar,AppliedFilterChips,SelectionBar,FilterDrawer,ExportPanel}.tsx lib/hooks/use-debounced-value.ts
```

For each import, confirm the target exists in this repo. `@/lib/utils`, `@/components/ui/{button,input,dialog,badge,skeleton}` are present. Anything absent must be copied from the NC repo in this same task and listed in the commit.

- [ ] **Step 3: Check for a `types.ts` clash**

These files import from `@/components/data-table/types`, which in this repo is garage's richer version. Confirm each type they use (`ColumnDef`, `SortState`) still resolves:

```bash
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback. If `ColumnDef` in garage lacks a field one of these components reads, add it as an optional field — do not narrow garage's type.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback.

- [ ] **Step 5: Commit**

```bash
git add components/data-table/TableTopBar.tsx components/data-table/AppliedFilterChips.tsx \
        components/data-table/SelectionBar.tsx components/data-table/FilterDrawer.tsx \
        components/data-table/ExportPanel.tsx lib/hooks/use-debounced-value.ts
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(data-table): port NC topBar-slot components"
```

---

### Task 7: NC section shell — provider, gate, layout, routing

**Files:**
- Create: `client/garage-web-app-nextjs-v1/components/nc-admin/nc-admin-query-provider.tsx`
- Create: `client/garage-web-app-nextjs-v1/components/nc-admin/nc-admin-gate.tsx`
- Create: `client/garage-web-app-nextjs-v1/app/garage-admin/(admin-dashboard)/networkchains/layout.tsx`
- Create: `client/garage-web-app-nextjs-v1/app/garage-admin/(admin-dashboard)/networkchains/page.tsx`
- Create: `client/garage-web-app-nextjs-v1/lib/nc-admin-first-route.ts`
- Modify: `client/garage-web-app-nextjs-v1/app/garage-admin/(admin-dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `ensureNcAdminToken` from `lib/nc-admin-api/auth.ts` (Task 3).
- Produces: `NcAdminQueryProvider`, `NcAdminGate`, `NC_FIRST_HREF: string` (exported from `lib/nc-admin-first-route.ts`), and a module-local `NC_GROUPS: NavGroupModel[]` inside `layout.tsx`.

**Context:** garage-web-app has **no root `QueryClientProvider`** — it uses scoped providers per ported feature. Follow `components/downline/downline-query-provider.tsx`, which documents exactly this situation.

- [ ] **Step 1: Write the scoped query provider**

Create `components/nc-admin/nc-admin-query-provider.tsx`:

```tsx
"use client";

// Scoped React Query provider for the ported NetworkChains admin section
// (app/garage-admin/(admin-dashboard)/networkchains). Garage doesn't use React
// Query app-wide — see components/downline/downline-query-provider.tsx and
// components/vaults/vaults-query-provider.tsx for the same pattern — and every
// NC admin page is built on useQuery, so the section gets its own QueryClient.

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function NcAdminQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 2: Write the elevation gate**

Create `components/nc-admin/nc-admin-gate.tsx`:

```tsx
"use client";

/**
 * Blocks the NetworkChains admin section until an nc_admin_token exists.
 *
 * The NC data hooks gate on `enabled: !!token`, and elevation is async, so
 * children must not mount until it resolves. Same shape as the NC app's
 * app/(admin)/layout.tsx, minus the OTP branch: a Garage operator who isn't an
 * allowlisted garage-super-admin gets a plain refusal, never an OTP prompt.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";

export function NcAdminGate({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    ensureNcAdminToken().then((t) => {
      if (!cancelled) setToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (token === undefined) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#FBD10D]" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-12 text-center">
        <div className="mb-5 rounded-full border border-white/[0.08] bg-white/[0.03] p-4">
          <ShieldCheck className="h-8 w-8 text-zinc-400" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-white">
          No access to NetworkChains admin
        </h2>
        <p className="max-w-md text-sm text-zinc-400">
          These pages are limited to allowlisted NetworkChains super admins. Ask a
          super admin to add your email, then sign in again.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 3: Write the section layout**

Create `app/garage-admin/(admin-dashboard)/networkchains/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { NcAdminQueryProvider } from "@/components/nc-admin/nc-admin-query-provider";
import { NcAdminGate } from "@/components/nc-admin/nc-admin-gate";

export default function NetworkChainsAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <NcAdminQueryProvider>
      <NcAdminGate>{children}</NcAdminGate>
    </NcAdminQueryProvider>
  );
}
```

- [ ] **Step 4: Add the NC nav model and index redirect**

First create `lib/nc-admin-first-route.ts` — a standalone constant, because
`layout.tsx` is a `"use client"` module and the index route below is a server
component. Importing the href from its own module keeps the server route from
pulling in the whole client layout:

```ts
/** Landing route for the NetworkChains dashboard — the first leaf of NC_GROUPS.
 *  Phase 1 ships only AI Cost and Revenue; Task 19 repoints this at Users once
 *  the full nav lands. */
export const NC_FIRST_HREF = "/garage-admin/networkchains/ai-cost";
```

Then in `app/garage-admin/(admin-dashboard)/layout.tsx`, import it —
`import { NC_FIRST_HREF } from "@/lib/nc-admin-first-route";` — and add the nav
model beside the existing `DASHBOARD_TYPES`:

```tsx
// NetworkChains admin nav. NC's own sidebar is a flat list of these entries, so
// they live in ONE accordion group rather than being re-grouped thematically —
// splitting them would be a redesign, not a port. Leaves are superOnly: the
// elevation endpoint requires garage-super-admin, so a delegated admin must
// never see this group (canSeeLeaf already drops superOnly leaves for them, and
// empty groups are filtered out).
const NC_GROUPS: NavGroupModel[] = [
  {
    key: "networkchains",
    title: "NetworkChains",
    icon: NetworkChainsIcon,
    items: [
      // PHASE 1 — only the ported pages. An unported leaf here would 404.
      // The first leaf's href IS NC_FIRST_HREF, so the two can't drift.
      { label: "AI Cost", href: NC_FIRST_HREF, superOnly: true },
      { label: "Revenue", href: "/garage-admin/networkchains/subscriptions", superOnly: true },
    ],
  },
];
```

Create `app/garage-admin/(admin-dashboard)/networkchains/page.tsx` — a server
component, which is why it imports the constant from its own module and not from
the client `layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { NC_FIRST_HREF } from "@/lib/nc-admin-first-route";

export default function NetworkChainsIndex() {
  redirect(NC_FIRST_HREF);
}
```

- [ ] **Step 5: Flip the dashboard type to ready and select the nav set**

In `DASHBOARD_TYPES`, change the `networkchains` entry's `ready: false` to `ready: true`.

Where `groups` is computed (layout.tsx:554), select the source list by dashboard type:

```tsx
  const sourceGroups = selectedDashboard === "networkchains" ? NC_GROUPS : allGroups;
  const groups: NavGroupModel[] = sourceGroups
    .map((g) => ({ ...g, items: g.items.filter(canSeeLeaf) }))
    .filter((g) => g.items.length > 0);
```

and make the direct-URL guard read from the same list:

```tsx
  const activeLeaf = sourceGroups
    .flatMap((g) => g.items)
    .find((leaf) => isLeafActive(pathname, leaf));
```

- [ ] **Step 6: Make the type switcher navigate, and deep links self-consistent**

Replace the `TypeSheet`'s `onSelect` handler with one that navigates:

```tsx
          onSelect={(id) => {
            setSelectedDashboard(id);
            setTypeSheetOpen(false);
            // The type is no longer client-only state: NC pages live at real
            // routes, so switching has to move the URL too. Without this a
            // refresh would land on an Admin route while showing NC chrome.
            if (id === "networkchains") router.push(NC_FIRST_HREF);
            else if (pathname.startsWith("/garage-admin/networkchains")) {
              router.push("/garage-admin/dashboard");
            }
          }}
```

And add, beside the other mount effects, a sync so a deep link forces the matching type:

```tsx
  // A deep link into /garage-admin/networkchains/* must show NC chrome even when
  // localStorage remembers "admin" from the last visit.
  useEffect(() => {
    if (pathname.startsWith("/garage-admin/networkchains")) {
      setSelectedDashboardState("networkchains");
    }
  }, [pathname]);
```

Note this runs after the `localStorage` restore effect, so the URL wins — which is the intent.

- [ ] **Step 7: Typecheck, lint, build**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback. (Pages don't exist yet, so the nav will link to 404s until Tasks 8 and 9 — expected at this step, resolved by the end of Phase 1.)

- [ ] **Step 8: Commit**

```bash
git add components/nc-admin/nc-admin-query-provider.tsx components/nc-admin/nc-admin-gate.tsx \
        lib/nc-admin-first-route.ts \
        "app/garage-admin/(admin-dashboard)/networkchains/layout.tsx" \
        "app/garage-admin/(admin-dashboard)/networkchains/page.tsx" \
        "app/garage-admin/(admin-dashboard)/layout.tsx"
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(garage-admin): NetworkChains dashboard section shell and routing"
```

---

### Task 8: Port the AI Cost page

**Files:**
- Create: `client/garage-web-app-nextjs-v1/app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx`
- Create: `client/garage-web-app-nextjs-v1/lib/hooks/use-admin-usage.ts`
- Read (do not modify): `client/networkchains-web-app-nextjs-v1-invite-clone/app/(admin)/admin/ai-cost/page.tsx` (369 lines), `.../lib/hooks/use-admin-usage.ts`

**Interfaces:**
- Consumes: `lib/nc-admin-api/admin.ts` (Task 4), `NcAdminGate` (Task 7).
- Produces: `useUsageSummary`, `useUsageUsers`, `useUsageUser`.

**Why this page first:** it has no table, so it isolates the auth path. If elevation is broken, it fails here alone.

- [ ] **Step 1: Copy both files**

```bash
cd /Users/mohammed/dev/technsure
NC=client/networkchains-web-app-nextjs-v1-invite-clone
G=client/garage-web-app-nextjs-v1
mkdir -p "$G/app/garage-admin/(admin-dashboard)/networkchains/ai-cost"
cp "$NC/app/(admin)/admin/ai-cost/page.tsx" \
   "$G/app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx"
cp "$NC/lib/hooks/use-admin-usage.ts" "$G/lib/hooks/use-admin-usage.ts"
```

- [ ] **Step 2: Repoint imports**

In both new files, change every `from "@/lib/api/admin"` to `from "@/lib/nc-admin-api/admin"`.

In `lib/hooks/use-admin-usage.ts`, replace the `hasToken` helper so it reads the NC token key:

```ts
import { getNcAdminToken } from "@/lib/nc-admin-api/auth";

const hasToken = () => !!getNcAdminToken();
```

- [ ] **Step 3: Replace the reload-on-401 behaviour**

NC's page responds to an expired session with `clearAdminToken()` + `window.location.reload()`, which in the Garage shell would throw the operator out of the console. Replace that `useEffect` body with:

```tsx
  // An expired NC token is recovered by re-elevating from the Garage session —
  // never by reloading, which would drop the operator out of the Garage shell.
  useEffect(() => {
    const unauth =
      summary.error instanceof AdminUnauthorizedError ||
      users.error instanceof AdminUnauthorizedError;
    if (unauth) {
      clearAdminToken();
      ensureNcAdminToken().then(() => {
        summary.refetch();
        users.refetch();
      });
    }
  }, [summary.error, users.error]);
```

adding `import { ensureNcAdminToken } from "@/lib/nc-admin-api/auth";` at the top.

- [ ] **Step 4: Check the page's own chrome**

NC pages render inside `AdminShell`, which supplies no padding of its own; the Garage shell already wraps children in `space-y-6 px-8 pb-8 pt-7`. If the copied page adds its own outer page padding, remove that outer wrapper's padding so it isn't doubled. Compare against the live NC page before deciding.

- [ ] **Step 5: Typecheck, lint, build**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback.

- [ ] **Step 6: Verify end to end**

```bash
npm run dev
```

1. Sign in at `/garage-admin/login` as a garage-super-admin whose email is in contacts-backend's `SUPER_ADMIN_EMAILS`.
2. Open the top-right pill → **NetworkChains**. Expect navigation to `/garage-admin/networkchains/ai-cost`, NC nav in the sidebar, "NetworkChains" in the header brand.
3. Confirm cost data loads. In DevTools → Application → Local Storage, confirm `nc_admin_token` now exists.
4. Delete `nc_admin_token`, reload: it should be re-minted silently with no OTP prompt.
5. Corrupt `nc_admin_token` to force a 401: the page should recover via one re-elevation, not loop.
6. Sign in as a plain `garage-admin`: the NetworkChains group must not appear in the sidebar, and a direct visit to `/garage-admin/networkchains/ai-cost` must show the not-authorised panel.
7. **Screenshot-compare** against `networkchains.com/admin/ai-cost`. They must match.

- [ ] **Step 7: Commit**

```bash
git add "app/garage-admin/(admin-dashboard)/networkchains/ai-cost/page.tsx" lib/hooks/use-admin-usage.ts
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(nc-admin): port AI Cost page"
```

---

### Task 9: Port the Revenue (subscriptions) page

**Files:**
- Create: `client/garage-web-app-nextjs-v1/app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx`
- Read (do not modify): `client/networkchains-web-app-nextjs-v1-invite-clone/app/(admin)/admin/subscriptions/page.tsx` (472 lines)

**Interfaces:**
- Consumes: `DataTable` with `frozen`/`rowHeight`/`headerHeight` (Task 5); `TableTopBar`, `AppliedFilterChips`, `SelectionBar`, `FilterDrawer`, `ExportPanel`, `useDebouncedValue` (Task 6); `getSubscriptionUsers`, `activateSubscription`, `expireSubscription`, `type SubUser` (Task 4).

**Why this page second:** it is the only NC page that uses every companion component at once — `TableTopBar` + `FilterDrawer` + `SelectionBar` + `ExportPanel` + `AppliedFilterChips`, plus `onColumnFilter` drawer-driven filtering and selection. If the table port is wrong, it is wrong here.

- [ ] **Step 1: Copy the page**

```bash
cd /Users/mohammed/dev/technsure
NC=client/networkchains-web-app-nextjs-v1-invite-clone
G=client/garage-web-app-nextjs-v1
mkdir -p "$G/app/garage-admin/(admin-dashboard)/networkchains/subscriptions"
cp "$NC/app/(admin)/admin/subscriptions/page.tsx" \
   "$G/app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx"
```

- [ ] **Step 2: Repoint imports**

Change `from "@/lib/api/admin"` to `from "@/lib/nc-admin-api/admin"`. Every `@/components/data-table/*` and `@/lib/hooks/use-debounced-value` import resolves unchanged after Task 6.

- [ ] **Step 3: Pass NC's table metrics**

On the `<DataTable<SubUser>` element (NC source line 359), add:

```tsx
          rowHeight="auto"
          headerHeight={48}
```

Without these the rows render at Garage's 95px and the page will not match NC.

Also reconcile pagination: `PaginationProps.recordsPerPage` is **required** in
garage's `types.ts:64` but optional in NC's. The page already tracks a
records-per-page value for `RPP_OPTIONS` — pass it explicitly in the `pagination`
prop (NC source line 426) rather than relying on a default.

- [ ] **Step 4: Apply the same 401 handling as Task 8**

Replace `clearAdminToken()` + `window.location.reload()` with `clearAdminToken()` followed by `ensureNcAdminToken()` and a refetch, importing `ensureNcAdminToken` from `@/lib/nc-admin-api/auth`.

- [ ] **Step 5: Add the leaf to the sidebar**

Already present from Task 7 (`Revenue` → `/garage-admin/networkchains/subscriptions`). Confirm it highlights when active.

- [ ] **Step 6: Typecheck, lint, build**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
```

Expected: `npm run build` exits 0, and the tsc grep prints the "no errors in touched files" fallback. A `ColumnDef` type error here means garage's column model is missing an optional field NC uses — add it as optional in `components/data-table/types.ts`; never narrow garage's type.

- [ ] **Step 7: Verify end to end**

```bash
npm run dev
```

At `/garage-admin/networkchains/subscriptions`, confirm every mechanism:
- rows load; row height matches NC (compact, not 95px)
- sort by a column header
- the column filter affix opens the **FilterDrawer** (not the built-in popover)
- applying a facet/range filter renders chips via `AppliedFilterChips` in the top bar
- garage's own internal chips row stays empty (no double chips)
- row selection shows the `SelectionBar`; bulk activate/expire works
- `ExportPanel` produces a CSV with the `SUB_EXPORT_FIELDS` columns in order
- pagination and records-per-page work
- any right-pinned Actions column stays pinned while scrolling horizontally
- **Screenshot-compare** against `networkchains.com/admin/subscriptions`

- [ ] **Step 8: Re-verify no garage regression**

Revisit `/garage-admin/one-time-affiliates` and `/garage-admin/networkchain-subs` and confirm they are unchanged.

- [ ] **Step 9: Commit**

```bash
git add "app/garage-admin/(admin-dashboard)/networkchains/subscriptions/page.tsx"
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "feat(nc-admin): port Revenue (subscriptions) page"
```

---

**PHASE 1 GATE.** Do not start Phase 2 until Tasks 8 and 9 both pass their screenshot comparison and the plain-`garage-admin` permission check in Task 8 Step 6.6. Everything in Phase 2 assumes the auth path and the table metrics are settled.

---

# PHASE 2 — Remaining nine sections

### The porting recipe

Every Phase 2 task follows the same procedure. It is written out once here; each task below names its own files, dependencies, and page-specific traps.

1. `mkdir -p` the destination directory under `app/garage-admin/(admin-dashboard)/networkchains/` and `cp` the page from the NC repo.
2. Copy any `lib/api/admin-*.ts` client the page imports into `lib/nc-admin-api/`, applying the Task 4 porting rules (drop the local token/fetch helpers, re-export the `auth.ts` replacements under NC's old names, route every call through `ncAdminFetch` / `ncAdminFetchRaw`).
3. Copy any `components/admin/**` sub-components the page imports into `components/nc-admin/**`.
4. Repoint imports: `@/lib/api/admin` → `@/lib/nc-admin-api/admin`, `@/lib/api/admin-X` → `@/lib/nc-admin-api/admin-X`, `@/components/admin/` → `@/components/nc-admin/`.
5. On every `<DataTable …>`, add `rowHeight="auto"` and `headerHeight={48}`.
6. Replace `clearAdminToken()` + `window.location.reload()` with `clearAdminToken()` → `ensureNcAdminToken()` → refetch.
7. Copy any missing shared dependency (`components/icons/platform-logos`, `components/layout/nav-icons`, `components/page-transition`, `components/ui/confirm-dialog`, `lib/admin/product`, `lib/utils/format`, and the `lib/hooks/use-admin-*` hooks) from the NC repo to the same path in garage-web-app. Adjust the hooks' `hasToken` to read `getNcAdminToken()`.
8. Add the leaf to `NC_GROUPS` in `app/garage-admin/(admin-dashboard)/layout.tsx`, in NC's sidebar order.
9. Confirm no stale reference survives:
   ```bash
   grep -rnE 'NEXT_PUBLIC_API_URL|@/lib/api/admin|@/components/admin/|window.location.reload' \
     "app/garage-admin/(admin-dashboard)/networkchains/" lib/nc-admin-api/ components/nc-admin/
   ```
   Expected: no output.
10. `npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint`.
11. `npm run dev`, exercise the page, and **screenshot-compare against the same page on `networkchains.com/admin`**.
12. Commit with `git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com"`, staging only that task's paths.

Tasks are ordered so the cheapest and most independent land first, and the one with the largest dependency subtree lands last.

---

### Task 10: Offerings

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/offerings/page.tsx` (from NC `app/(admin)/admin/offerings/page.tsx`, 573 lines)
- Create: `components/nc-admin/product-switch.tsx`, `components/nc-admin/device-switch.tsx`, `lib/admin/product.ts` (if imported)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx` (add the `Offerings` leaf)

**Interfaces:** consumes `lib/nc-admin-api/admin.ts`, the Task 6 companions, and the Task 5 DataTable props.

- [ ] **Step 1:** Apply recipe steps 1–8. Nav leaf: `{ label: "Offerings", href: "/garage-admin/networkchains/offerings", superOnly: true }`, placed third in `NC_GROUPS[0].items` (NC order: Users, EarnGPT, Offerings, Aixons, Catch Up, Live Calls, Revenue, Funnels, AI Cost, Sentry, Replays).
- [ ] **Step 2:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 3:** Recipe step 10 — `npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint` clean.
- [ ] **Step 4:** Recipe step 11 — verify table, top bar, export, and screenshot-match `networkchains.com/admin/offerings`.
- [ ] **Step 5:** Commit `feat(nc-admin): port Offerings page`.

---

### Task 11: EarnGPT Learning

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/earngpt-learning/page.tsx` (from NC `app/(admin)/admin/earngpt-learning/page.tsx`, 266 lines)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

- [ ] **Step 1:** Apply recipe steps 1–8. Nav leaf: `{ label: "EarnGPT", href: "/garage-admin/networkchains/earngpt-learning", superOnly: true }`, second in NC order.
- [ ] **Step 2:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 3:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 4:** Recipe step 11 — screenshot-match `networkchains.com/admin/earngpt-learning`.
- [ ] **Step 5:** Commit `feat(nc-admin): port EarnGPT Learning page`.

---

### Task 12: Sentry (list + issue detail)

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/sentry/page.tsx` (341 lines), `.../sentry/[issueId]/page.tsx` (289 lines)
- Create: `lib/nc-admin-api/admin-sentry.ts` (from NC `lib/api/admin-sentry.ts`, 410 lines)
- Create: `components/nc-admin/sentry/{event-panels,stack-trace,unavailable-state}.tsx`
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific trap:** `unavailable-state.tsx` renders when the Sentry integration is unconfigured. Verify it still renders correctly under the Garage shell rather than assuming the NC one.

- [ ] **Step 1:** Apply recipe steps 1–8 for both routes and the API client. Nav leaf: `{ label: "Sentry", href: "/garage-admin/networkchains/sentry", superOnly: true }`, tenth in NC order.
- [ ] **Step 2:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 3:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 4:** Recipe step 11 — verify list, drill into an issue, confirm the stack trace and event panels render; screenshot-match `networkchains.com/admin/sentry` and one issue page.
- [ ] **Step 5:** Commit `feat(nc-admin): port Sentry pages`.

---

### Task 13: Replays (PostHog)

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/posthog/page.tsx` (356 lines)
- Create: `lib/nc-admin-api/admin-posthog.ts` (157 lines)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific trap:** this page embeds the PostHog session-replay player. Confirm no CSP or iframe policy in garage-web-app's `next.config.ts` blocks it — the NC app may permit an origin this app does not.

- [ ] **Step 1:** Apply recipe steps 1–8. Nav leaf: `{ label: "Replays", href: "/garage-admin/networkchains/posthog", superOnly: true }`, last in NC order.
- [ ] **Step 2:** Check `next.config.ts` headers/CSP for anything blocking the embed; if blocked, allow the PostHog origin and note the change in the commit body.
- [ ] **Step 3:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 4:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 5:** Recipe step 11 — confirm a replay actually plays; screenshot-match `networkchains.com/admin/posthog`.
- [ ] **Step 6:** Commit `feat(nc-admin): port Replays page`.

---

### Task 14: Aixons (list + detail)

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/axons/page.tsx` (345 lines), `.../axons/[axonId]/page.tsx` (555 lines)
- Create: `lib/nc-admin-api/admin-axons.ts` (377 lines)
- Create: `components/nc-admin/axons/{merge-dialog,unmerge-dialog}.tsx`
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific trap:** merge/unmerge are destructive writes against live Axon data. Exercise them against a dev backend, never prod.

- [ ] **Step 1:** Apply recipe steps 1–8 for both routes, the API client, and both dialogs. Nav leaf: `{ label: "Aixons", href: "/garage-admin/networkchains/axons", superOnly: true }`, fourth in NC order.
- [ ] **Step 2:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 3:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 4:** Recipe step 11 — list, detail, and both dialogs open and submit against a **dev** backend; screenshot-match `networkchains.com/admin/axons` and one detail page.
- [ ] **Step 5:** Commit `feat(nc-admin): port Aixons pages`.

---

### Task 15: Users (list + detail)

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/users/page.tsx` (252 lines), `.../users/[userId]/page.tsx` (1402 lines)
- Create: `components/nc-admin/users/{earngpt-chat-viewer,meeting-detail}.tsx`
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific traps:**
- The detail page is the largest single file in the port (1402 lines). Port it whole; do not restructure it while moving it — a refactor mixed into a move makes any regression impossible to bisect.
- It imports `@/components/affiliate/globe/*`, which **already exists** in garage-web-app. Use the existing copy; do **not** overwrite it. If the two have drifted, adapt the ported page to garage's version and note the difference in the commit body.

- [ ] **Step 1:** Apply recipe steps 1–8 for both routes and both sub-components. Nav leaf: `{ label: "Users", href: "/garage-admin/networkchains/users", superOnly: true }`, **first** in NC order.
- [ ] **Step 2:** Diff the two globe implementations before wiring:
  ```bash
  diff -rq client/networkchains-web-app-nextjs-v1-invite-clone/components/affiliate/globe \
           client/garage-web-app-nextjs-v1/components/affiliate/globe
  ```
  Adapt the page to garage's version if they differ.
- [ ] **Step 3:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 4:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 5:** Recipe step 11 — list, detail, EarnGPT chat viewer, meeting detail, and the globe all render; screenshot-match `networkchains.com/admin/users` and one user detail page.
- [ ] **Step 6:** Commit `feat(nc-admin): port Users pages`.

---

### Task 16: Catch Up

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/meet/page.tsx` (1082 lines)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific trap:** garage-web-app already has meeting/office code of its own (`hooks/office/*`, `lib/office-api.ts`, `components/meet/*`). Do **not** merge the ported page into it — keep the NC admin view self-contained under `components/nc-admin/` so the two don't entangle.

- [ ] **Step 1:** Apply recipe steps 1–8. Nav leaf: `{ label: "Catch Up", href: "/garage-admin/networkchains/meet", superOnly: true }`, fifth in NC order.
- [ ] **Step 2:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 3:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 4:** Recipe step 11 — screenshot-match `networkchains.com/admin/meet`.
- [ ] **Step 5:** Commit `feat(nc-admin): port Catch Up page`.

---

### Task 17: Live Calls

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/meet/live/page.tsx` (1538 lines)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific traps:**
- Largest page in the port and the most stateful — it holds live subscriptions/polling. Verify it unsubscribes on unmount; inside the Garage shell an operator can switch dashboard types without a full page load, so a leaked interval would survive where in the NC app a navigation would have cleared it.
- Nests under the `meet/` directory created in Task 16, so sequence it after.

- [ ] **Step 1:** Apply recipe steps 1–8. Nav leaf: `{ label: "Live Calls", href: "/garage-admin/networkchains/meet/live", superOnly: true }`, sixth in NC order.
- [ ] **Step 2:** Audit every `setInterval` / `setTimeout` / socket subscription for a cleanup return in its `useEffect`. Add cleanup where missing.
- [ ] **Step 3:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 4:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 5:** Recipe step 11 — with a live call running, confirm updates arrive; then switch to the Admin dashboard and confirm in DevTools that polling stops. Screenshot-match `networkchains.com/admin/meet/live`.
- [ ] **Step 6:** Commit `feat(nc-admin): port Live Calls page`.

---

### Task 18: Funnels (list + detail)

**Files:**
- Create: `app/garage-admin/(admin-dashboard)/networkchains/funnels/page.tsx` (166 lines), `.../funnels/[id]/page.tsx` (177 lines)
- Create: `lib/nc-admin-api/admin-funnels.ts` (127 lines), `lib/api/funnels.ts`, `lib/funnel-tree.ts`, `lib/hooks/use-admin-funnels.ts`
- Create: `components/funnel-studio/*` (6 files, ~56K)
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx`

**Page-specific traps:**
- Largest dependency subtree in the port — sequenced last so it cannot block anything else.
- Funnel enum and field definitions are mirrored across three sites and **must stay identical**; a Zod schema strips unknown fields silently, so a drifted enum fails quietly rather than loudly. Diff the ported `lib/funnel-tree.ts` and `lib/api/funnels.ts` against the NC originals after porting and confirm they are byte-identical apart from import paths.
- garage-web-app has an unrelated `app/(dashboard)/deals/funnel/page.tsx`. It is **not** related to funnel-studio — do not merge or reuse it.

- [ ] **Step 1:** Apply recipe steps 1–8 for both routes, the API clients, the hook, and `components/funnel-studio/`. Nav leaf: `{ label: "Funnels", href: "/garage-admin/networkchains/funnels", superOnly: true }`, eighth in NC order.
- [ ] **Step 2:** Confirm the enum/field mirror is intact:
  ```bash
  diff <(sed 's#@/lib/api/admin-funnels#X#' client/garage-web-app-nextjs-v1/lib/funnel-tree.ts) \
       <(sed 's#@/lib/api/admin-funnels#X#' client/networkchains-web-app-nextjs-v1-invite-clone/lib/funnel-tree.ts)
  ```
  Expected: no differences beyond import paths.
- [ ] **Step 3:** Recipe step 9 — stale-reference grep returns nothing.
- [ ] **Step 4:** Recipe step 10 — typecheck, lint, build clean.
- [ ] **Step 5:** Recipe step 11 — list loads, a funnel opens in funnel-studio, and an edit saves without dropping fields; screenshot-match `networkchains.com/admin/funnels` and one funnel detail page.
- [ ] **Step 6:** Commit `feat(nc-admin): port Funnels pages`.

---

### Task 19: Final sweep

**Files:**
- Modify: `app/garage-admin/(admin-dashboard)/layout.tsx` (final `NC_GROUPS` order)
- Modify: `lib/nc-admin-first-route.ts` (landing route → Users)
- Modify: `docs/superpowers/specs/2026-09-02-nc-admin-port-to-garage-admin-design.md` (status)

- [ ] **Step 1: Confirm `NC_GROUPS` holds all 11 leaves in NC's sidebar order, and repoint the landing route**

Users, EarnGPT, Offerings, Aixons, Catch Up, Live Calls, Revenue, Funnels, AI Cost, Sentry, Replays — matching `components/admin/admin-shell.tsx`'s `ADMIN_NAV` in the NC repo.

Now that Users exists, change `lib/nc-admin-first-route.ts` to:

```ts
export const NC_FIRST_HREF = "/garage-admin/networkchains/users";
```

and move the `AI Cost` leaf to ninth position, giving the first leaf its literal
href back:

```tsx
      { label: "Users", href: NC_FIRST_HREF, superOnly: true },
      …
      { label: "AI Cost", href: "/garage-admin/networkchains/ai-cost", superOnly: true },
```

The type switcher and the `/garage-admin/networkchains` index both read
`NC_FIRST_HREF`, so this one edit moves the section's landing page.

- [ ] **Step 2: Confirm nothing points at the wrong backend or the old paths**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
grep -rnE 'NEXT_PUBLIC_API_URL|@/lib/api/admin|@/components/admin/' \
  "app/garage-admin/(admin-dashboard)/networkchains/" lib/nc-admin-api/ components/nc-admin/
```

Expected: no output.

- [ ] **Step 3: Confirm the NetworkChains app is untouched**

```bash
cd /Users/mohammed/dev/technsure/client/networkchains-web-app-nextjs-v1-invite-clone
git status --porcelain
```

Expected: no output. The NC panel must still be running unmodified — removal was explicitly deferred.

- [ ] **Step 4: Full build and a walk of every route**

```bash
cd /Users/mohammed/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
./node_modules/.bin/tsc --noEmit 2>&1 | grep -F -f /tmp/nc-touched.txt || echo "no errors in touched files"
npm run lint
npm run dev
```

Visit all 11 NC sections plus every detail route. Then visit the Garage admin pages (`/garage-admin/users`, `/garage-admin/one-time-affiliates`, `/garage-admin/networkchain-subs`, `/garage-admin/rank-bonus`) and confirm no regression.

- [ ] **Step 5: Mark the spec implemented**

Change the spec's `**Status:**` line to `Implemented (Phase 1 + Phase 2) — NC-app removal still deferred`.

- [ ] **Step 6: Commit**

```bash
git add "app/garage-admin/(admin-dashboard)/layout.tsx" lib/nc-admin-first-route.ts \
        docs/superpowers/specs/2026-09-02-nc-admin-port-to-garage-admin-design.md
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjib.jena@gmail.com" commit -m "chore(nc-admin): complete NetworkChains admin port"
```

---

## Deferred, deliberately

- **Removing the panel from `networkchains.com/admin`.** Explicitly out of scope. Both panels run against the same contacts-backend admin endpoints until a later cutover.
- **`hooks/office/*` wrong-backend bug.** Six files in garage-web-app (`useHostControls`, `useAccessControl`, `useVoiceMemos`, `useRecording`, `useConferenceRecordings`, `components/office/MeetHeader.tsx`) use `process.env.NEXT_PUBLIC_API_URL ?? "https://backend.networkchains.com"`. Since `NEXT_PUBLIC_API_URL` is set in this app, the fallback is dead and those hooks call the Garage backend. `lib/office-api.ts` uses the correct `NEXT_PUBLIC_OFFICE_API_URL`. Pre-existing, unrelated to this port, worth its own fix.
- **Reconciling the two `DataTable` forks in the NC repo.** The NC app keeps its own copy. Garage's is now the superset; a future cutover could delete NC's.
