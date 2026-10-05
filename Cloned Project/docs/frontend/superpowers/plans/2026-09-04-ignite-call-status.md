# Ignite Call Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Ignite Call Status column to the One Time Affiliates admin table that links each affiliate to a real NetworkChains catch-up, derives a four-state status from that call's live state, and opens a side panel with the call's recording, transcript and AI summary.

**Architecture:** Garage owns the link (a new `IgniteCall` collection in garagenew-backend); contacts-backend stays the system of record for the meeting itself and gains six service-token endpoints. All browser traffic goes through garagenew-backend, which calls contacts-backend server-to-server — the browser never holds an NC token for this feature. Status is derived at read time, never stored.

**Tech Stack:** Express + Mongoose (both backends), Next.js App Router + React (frontend), `node:test` (contacts-backend), Jest + ts-jest (garagenew-backend).

**Spec:** `docs/superpowers/specs/2026-09-04-ignite-call-status-design.md` (in this repo)

## Global Constraints

These apply to every task. They come from each repo's `CLAUDE.md` and are not negotiable.

**All repos**
- **Never** add a `Co-Authored-By` or AI-attribution trailer to any commit.
- These checkouts are shared with other sessions. **Stage specific paths only** — never `git add .` or `git add -A`. Other people's uncommitted drift must not end up in your commit.

**`server/contacts-backend`**
- Commits use the **default** git author. (Do NOT author as Chiranjeeb — that is a web-app-only rule.)
- Deploys run from a **prebuilt `dist` committed to git**. After editing `src/`, run `npm run build` and commit the specific compiled files alongside your `src` changes. Never `git add dist` wholesale.
- **Source maps are tracked** (936 `dist/**/*.map` files are in git, and this repo runs Sentry — missing maps degrade production stack traces). For every `src` file you touch, stage its **four** dist artifacts: `.js`, `.d.ts`, `.js.map`, `.d.ts.map`. The reliable way to stage exactly your own files without catching another session's drift is a per-file glob:

  ```bash
  git add dist/lib/ignite-catchup.*        # .js, .d.ts, .js.map, .d.ts.map
  ```

  After committing, run `git status --short dist/` and confirm no `.map` belonging to a file you touched is left behind.
- Tests: `node --import tsx --test 'src/**/*.test.ts'` (also exposed as `npm test`).
- Catch-Up / webinars / money-streams are **LiveKit, in this repo**. `garagenew-backend`'s `routes/meet.ts` is a different Agora system — do not confuse them.

**`server/garagenew-backend`**
- Typecheck with `./node_modules/.bin/tsc --noEmit -p tsconfig.json`, then `echo $?` **on its own line**. `npx --no tsc --noEmit` prints nothing and exits 0 even when the code is broken.
- **Never boot the server locally.** `.env` points at the **production** database and startup schedules cron jobs.
- **Never** guard a router with `router.use(auth)`. Several routers share the bare `/garage-admin` mount, so router-level middleware fires for paths the router doesn't define and rejects them before the next router is reached — this took down admin login in production. Attach guards **per route**: `router.post(path, requireGarageAdminAuth, requireGarageSuperAdmin, handler)`.
- Tests: `npx jest`. Jest `roots` is restricted to `src/bat246/__tests__`, `src/utils/__tests__`, `src/services/__tests__` — new tests must live in one of these or they will not run.
- The GarageAdmin model is exported as **`GarageAdminModel`**, not `GarageAdmin`.

**`client/garage-web-app-nextjs-v1`**
- Commits are authored as **Chiranjeeb Jena** (`-c user.name="Chiranjeeb Jena" -c user.email="chiranjeeb@garageuniversity.app"`).
- There is **no test framework** in this repo. Do not add one as part of this work.
- **`npm run build` is the authoritative check** — Turbopack does not typecheck.
- `./node_modules/.bin/tsc --noEmit` reports **~160 pre-existing errors** (mostly `WorkshopsPage.tsx` and generated `.next/types`). This repo has never been tsc-clean, so **a non-zero exit proves nothing**. Judge your work by: (a) `npm run build` exits 0, and (b) grepping the tsc output for the files you actually touched and confirming none appear. Never use `npx --no tsc --noEmit` — it emits nothing and exits 0 regardless, which reads as a pass.
- `main` is usually behind the remote and this tree often carries unrelated uncommitted work. Commit by pathspec, then merge and push from a throwaway worktree (see the repo CLAUDE.md "Pushing while the working tree is dirty"). Never `git pull --rebase` or `git stash` here.
- Deploys go through **Vercel** on push to `main` — pushing is not the same as shipping.
- Every dropdown uses the shared searchable-select template (`components/searchableSelect/searchable-select.tsx`).
- Every table value is **left-aligned**, numbers and money included.

**Wire enum** — used verbatim in both backends and the frontend:
`"not_scheduled" | "scheduled" | "started" | "completed"`

**Artifact join key** — LiveKit room names for catch-ups are `` `meet-${roomId}` ``.

---

## File Structure

**`server/contacts-backend`**
| File | Responsibility |
|---|---|
| `src/lib/ignite-catchup.ts` (create) | Pure helpers: room-name derivation, status derivation, attendee normalisation/merge. No IO. |
| `src/lib/__tests__/ignite-catchup.test.ts` (create) | Unit tests for the above. |
| `src/middleware/garageService.ts` (create) | `requireGarageService` — `X-Service-Token` validation only. |
| `src/middleware/__tests__/garageService.test.ts` (create) | Unit tests for the middleware. |
| `src/services/catchupArtifacts.ts` (create) | Dependency-injected reads: `statusForSchedules`, `relatedForSchedule`. |
| `src/services/__tests__/catchupArtifacts.test.ts` (create) | Unit tests with fake loaders. |
| `src/services/meet/createSchedule.ts` (create) | Shared catch-up creation + Google Calendar mirror, extracted from `routes/meet.ts`. |
| `src/routes/service-garage-meet.ts` (create) | The six service endpoints. |
| `src/config/env.ts` (modify) | Add `GARAGE_SERVICE_TOKEN`. |
| `src/routes/meet.ts` (modify, ~697-800) | `POST /meet/schedule` delegates to the extracted service. |
| `src/app.ts` (modify, ~311-320) | Mount the new router. |

**`server/garagenew-backend`**
| File | Responsibility |
|---|---|
| `src/models/igniteCall.model.ts` (create) | The `IgniteCall` link document. |
| `src/lib/ncMeetClient.ts` (create) | Thin typed fetch client for contacts-backend's service endpoints. |
| `src/services/igniteCall.service.ts` (create) | Pure status derivation + chunked, fail-soft enrichment. |
| `src/services/__tests__/igniteCall.service.test.ts` (create) | Jest tests. |
| `src/routes/garageAdminIgniteCall.ts` (create) | Attach / detach / history endpoints. |
| `src/routes/garageAdminOneTimeAffiliates.ts` (modify) | Enrich rows with `igniteCall`. |
| `src/app.ts` (modify, ~477-487) | Mount the new router. |

**`client/garage-web-app-nextjs-v1`**
| File | Responsibility |
|---|---|
| `lib/admin-api/ignite-call.ts` (create) | Types + API wrappers. |
| `components/garage-admin/ignite-call.tsx` (create) | `IgniteCallCell` + `IgniteCallDialog`. |
| `components/garage-admin/IgniteCallDrawer.tsx` (create) | The related-data side panel. |
| `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx` (modify) | Row type, column def, dialog/drawer state, CSV column. |

Phases must land in order: garagenew (Phase 2) calls endpoints built in Phase 1, and the frontend (Phase 3) calls endpoints built in Phase 2.

---

# Phase 1 — contacts-backend

### Task 1: Pure catch-up helpers

**Files:**
- Create: `src/lib/ignite-catchup.ts`
- Test: `src/lib/__tests__/ignite-catchup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `catchupRoomName(roomId: string): string`; `deriveIgniteStatus(input: ScheduleStatusInput | null | undefined): IgniteStatus`; `normalizeAttendeeEmail(raw: unknown): string | null`; `mergeAttendee(attendees: Attendee[], email: string, displayName?: string): { attendees: Attendee[]; added: boolean }`; types `IgniteStatus`, `Attendee`, `ScheduleStatusInput`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/ignite-catchup.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catchupRoomName,
  deriveIgniteStatus,
  normalizeAttendeeEmail,
  mergeAttendee,
} from "../ignite-catchup";

test("room name is the meet- prefix plus the schedule roomId", () => {
  assert.equal(catchupRoomName("abc123"), "meet-abc123");
});

test("status is not_scheduled when there is no linked call", () => {
  assert.equal(deriveIgniteStatus(null), "not_scheduled");
  assert.equal(deriveIgniteStatus(undefined), "not_scheduled");
});

test("status is scheduled until the host opens the room", () => {
  assert.equal(deriveIgniteStatus({ startedAt: null, endedAt: null }), "scheduled");
});

test("status is started once the room opened and has not ended", () => {
  assert.equal(
    deriveIgniteStatus({ startedAt: new Date("2026-09-04T10:00:00Z"), endedAt: null }),
    "started",
  );
});

test("status is completed once the room ended", () => {
  assert.equal(
    deriveIgniteStatus({
      startedAt: new Date("2026-09-04T10:00:00Z"),
      endedAt: new Date("2026-09-04T11:00:00Z"),
    }),
    "completed",
  );
});

test("endedAt wins even if startedAt was never recorded on the schedule", () => {
  // The host can start a room without the schedule's startedAt being written
  // (early start via a different path). A session that ended still means done.
  assert.equal(
    deriveIgniteStatus({ startedAt: null, endedAt: new Date("2026-09-04T11:00:00Z") }),
    "completed",
  );
});

test("attendee emails are lowercased and trimmed", () => {
  assert.equal(normalizeAttendeeEmail("  Nagendra@Example.COM "), "nagendra@example.com");
});

test("non-strings and blanks normalise to null", () => {
  assert.equal(normalizeAttendeeEmail(""), null);
  assert.equal(normalizeAttendeeEmail("   "), null);
  assert.equal(normalizeAttendeeEmail(undefined), null);
  assert.equal(normalizeAttendeeEmail(42), null);
});

test("mergeAttendee appends a new attendee", () => {
  const r = mergeAttendee([{ email: "a@x.com" }], "b@x.com", "Bee");
  assert.equal(r.added, true);
  assert.deepEqual(r.attendees, [{ email: "a@x.com" }, { email: "b@x.com", displayName: "Bee" }]);
});

test("mergeAttendee is idempotent, including across casing and whitespace", () => {
  const existing = [{ email: "nagendra@example.com" }];
  const r = mergeAttendee(existing, "  NAGENDRA@Example.com ", "Nagendra");
  assert.equal(r.added, false);
  assert.deepEqual(r.attendees, existing);
});

test("mergeAttendee drops an unusable email rather than writing a blank", () => {
  const existing = [{ email: "a@x.com" }];
  const r = mergeAttendee(existing, "   ");
  assert.equal(r.added, false);
  assert.deepEqual(r.attendees, existing);
});

test("mergeAttendee omits displayName when it is blank", () => {
  const r = mergeAttendee([], "c@x.com", "   ");
  assert.deepEqual(r.attendees, [{ email: "c@x.com" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/dev/technsure/server/contacts-backend && node --import tsx --test src/lib/__tests__/ignite-catchup.test.ts`
Expected: FAIL — `Cannot find module '../ignite-catchup'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/ignite-catchup.ts`:

```ts
/**
 * Pure helpers shared by the Garage "Ignite call" surface.
 *
 * Kept IO-free so they can be unit-tested without a database, following the
 * same convention as `lib/meet-device-session.ts`.
 */

/** LiveKit room names for catch-ups are `meet-<roomId>` — see routes/meet.ts:417. */
export const CATCHUP_ROOM_PREFIX = "meet-";

export function catchupRoomName(roomId: string): string {
  return `${CATCHUP_ROOM_PREFIX}${roomId}`;
}

export type IgniteStatus = "not_scheduled" | "scheduled" | "started" | "completed";

export interface ScheduleStatusInput {
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
}

/**
 * The four-state Ignite call status.
 *
 * `endedAt` is checked BEFORE `startedAt`: a host can open a room by a path
 * that never writes the schedule's own `startedAt`, and a call that has
 * demonstrably ended is complete regardless.
 */
export function deriveIgniteStatus(
  input: ScheduleStatusInput | null | undefined,
): IgniteStatus {
  if (!input) return "not_scheduled";
  if (input.endedAt) return "completed";
  if (input.startedAt) return "started";
  return "scheduled";
}

export interface Attendee {
  email: string;
  displayName?: string;
}

/** Matches the normalisation `POST /meet/schedule` applies at write time, so
 *  the `attendees.email` index lookups match without case folding at read. */
export function normalizeAttendeeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e ? e.slice(0, 200) : null;
}

/** Idempotent attendee add. Returns a new array only when something changed. */
export function mergeAttendee(
  attendees: Attendee[],
  email: string,
  displayName?: string,
): { attendees: Attendee[]; added: boolean } {
  const normalized = normalizeAttendeeEmail(email);
  if (!normalized) return { attendees, added: false };

  const already = attendees.some(
    (a) => normalizeAttendeeEmail(a.email) === normalized,
  );
  if (already) return { attendees, added: false };

  const entry: Attendee = { email: normalized };
  const dn = typeof displayName === "string" ? displayName.trim().slice(0, 80) : "";
  if (dn) entry.displayName = dn;

  return { attendees: [...attendees, entry], added: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/lib/__tests__/ignite-catchup.test.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Build and commit**

```bash
cd ~/dev/technsure/server/contacts-backend
npm run build
git add src/lib/ignite-catchup.ts src/lib/__tests__/ignite-catchup.test.ts \
        dist/lib/ignite-catchup.* dist/lib/__tests__/ignite-catchup.test.*
git commit -m "Ignite call: pure catch-up helpers (room name, status, attendees)"
```

---

### Task 2: `requireGarageService` middleware

**Files:**
- Modify: `src/config/env.ts` (add next to `VOICE_AGENT_SERVICE_TOKEN`, ~line 102)
- Create: `src/middleware/garageService.ts`
- Test: `src/middleware/__tests__/garageService.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `requireGarageService(req, res, next): void`.

- [ ] **Step 1: Write the failing test**

Create `src/middleware/__tests__/garageService.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeGarageServiceGuard } from "../garageService";

function fakeRes() {
  const out: { code?: number; body?: unknown } = {};
  const res = {
    status(c: number) { out.code = c; return res; },
    json(b: unknown) { out.body = b; return res; },
  };
  return { res: res as never, out };
}

test("503 when no token is configured on this server", () => {
  const guard = makeGarageServiceGuard(() => "");
  const { res, out } = fakeRes();
  let called = false;
  guard({ headers: { "x-service-token": "anything" } } as never, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(out.code, 503);
});

test("401 when the caller sends no token", () => {
  const guard = makeGarageServiceGuard(() => "secret");
  const { res, out } = fakeRes();
  let called = false;
  guard({ headers: {} } as never, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(out.code, 401);
});

test("401 when the token does not match", () => {
  const guard = makeGarageServiceGuard(() => "secret");
  const { res, out } = fakeRes();
  let called = false;
  guard({ headers: { "x-service-token": "wrong" } } as never, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(out.code, 401);
});

test("calls next on an exact match", () => {
  const guard = makeGarageServiceGuard(() => "secret");
  const { res, out } = fakeRes();
  let called = false;
  guard({ headers: { "x-service-token": "secret" } } as never, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(out.code, undefined);
});

test("does NOT fall through to JWT auth — a Bearer token alone is rejected", () => {
  // Unlike requireServiceOrAuth, these endpoints act as the platform and must
  // never be reachable with a user JWT.
  const guard = makeGarageServiceGuard(() => "secret");
  const { res, out } = fakeRes();
  let called = false;
  guard({ headers: { authorization: "Bearer someUserJwt" } } as never, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(out.code, 401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/middleware/__tests__/garageService.test.ts`
Expected: FAIL — `Cannot find module '../garageService'`.

- [ ] **Step 3: Add the env var**

In `src/config/env.ts`, directly below the `VOICE_AGENT_SERVICE_TOKEN` entry (~line 102), add:

```ts
  // Service token for Garage's admin panel (garagenew-backend) to read and
  // write catch-up data for the "Ignite call" column. Deliberately SEPARATE
  // from VOICE_AGENT_SERVICE_TOKEN: that token is scoped to voice memos, and
  // silently widening it to meeting recordings and transcripts is a trade that
  // should be made explicitly. Empty = the endpoints return 503.
  GARAGE_SERVICE_TOKEN: process.env.GARAGE_SERVICE_TOKEN || "",
```

- [ ] **Step 4: Write minimal implementation**

Create `src/middleware/garageService.ts`:

```ts
import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

/**
 * Cross-service auth for Garage's admin panel.
 *
 * Unlike `requireServiceOrAuth` this does NOT fall through to JWT auth and
 * takes no `X-Service-User-Id`: these endpoints act as the platform, not on
 * behalf of a user, and the acting admin is already recorded on the Garage
 * side. Falling through would make meeting recordings and transcripts
 * reachable with any user's token.
 *
 * `makeGarageServiceGuard` takes the secret as a thunk so it can be unit-tested
 * without mutating process.env.
 */
export function makeGarageServiceGuard(readSecret: () => string) {
  return function guard(req: Request, res: Response, next: NextFunction): void {
    const expected = readSecret();
    if (!expected) {
      res.status(503).json({ ok: false, error: "Garage service auth not configured" });
      return;
    }
    const provided = req.headers["x-service-token"];
    if (typeof provided !== "string" || provided !== expected) {
      res.status(401).json({ ok: false, error: "Invalid service token" });
      return;
    }
    next();
  };
}

export const requireGarageService = makeGarageServiceGuard(
  () => env.GARAGE_SERVICE_TOKEN,
);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --import tsx --test src/middleware/__tests__/garageService.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/middleware/garageService.ts src/middleware/__tests__/garageService.test.ts \
        src/config/env.ts \
        dist/middleware/garageService.* dist/middleware/__tests__/garageService.test.* \
        dist/config/env.*
git commit -m "Ignite call: requireGarageService middleware + GARAGE_SERVICE_TOKEN"
```

---

### Task 3: Catch-up artifact reads

**Files:**
- Create: `src/services/catchupArtifacts.ts`
- Test: `src/services/__tests__/catchupArtifacts.test.ts`

**Interfaces:**
- Consumes: `catchupRoomName`, `deriveIgniteStatus`, `IgniteStatus` from Task 1.
- Produces: `STATUS_BATCH_LIMIT = 100`; `statusForSchedules(ids: string[], deps: CatchupDeps): Promise<ScheduleStatus[]>`; `relatedForSchedule(id: string, deps: CatchupDeps): Promise<CatchupRelated | null>`; types `CatchupDeps`, `ScheduleStatus`, `CatchupRelated`.

Follows the dependency-injection convention of `services/dailyDigest.service.ts` (`DigestDeps`), so the logic is testable without Mongo.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/catchupArtifacts.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  statusForSchedules,
  relatedForSchedule,
  STATUS_BATCH_LIMIT,
  type CatchupDeps,
} from "../catchupArtifacts";

const T0 = new Date("2026-09-04T10:00:00Z");
const T1 = new Date("2026-09-04T11:00:00Z");
const T2 = new Date("2026-09-04T12:00:00Z");

function sched(over: Partial<any> = {}): any {
  return {
    _id: "s1", roomId: "r1", title: "Ignite call", scheduledAt: T0,
    startedAt: null, durationMinutes: 60, userId: "u1", attendees: [], ...over,
  };
}

function deps(over: Partial<CatchupDeps> = {}): CatchupDeps {
  return {
    loadSchedules: async () => [],
    loadSessionsByRoom: async () => [],
    loadRecordingsByRoom: async () => [],
    loadNotesByRoom: async () => [],
    loadNoteDetail: async () => ({ transcript: null, summary: null }),
    ...over,
  };
}

test("a schedule with no sessions is scheduled", async () => {
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched()],
  }));
  assert.deepEqual(out, [
    { scheduleId: "s1", scheduledAt: T0, startedAt: null, endedAt: null, isLive: false, status: "scheduled" },
  ]);
});

test("a live session makes it started, and endedAt stays null", async () => {
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched({ startedAt: T1 })],
    loadSessionsByRoom: async () => [{ _id: "x", roomName: "meet-r1", startedAt: T1, endedAt: null }],
  }));
  assert.equal(out[0].status, "started");
  assert.equal(out[0].isLive, true);
  assert.equal(out[0].endedAt, null);
});

test("an ended session makes it completed", async () => {
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched({ startedAt: T1 })],
    loadSessionsByRoom: async () => [{ _id: "x", roomName: "meet-r1", startedAt: T1, endedAt: T2 }],
  }));
  assert.equal(out[0].status, "completed");
  assert.deepEqual(out[0].endedAt, T2);
});

test("one live session among ended ones keeps it started", async () => {
  // A rejoin after the first session ended — the call is not over.
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched({ startedAt: T0 })],
    loadSessionsByRoom: async () => [
      { _id: "a", roomName: "meet-r1", startedAt: T0, endedAt: T1 },
      { _id: "b", roomName: "meet-r1", startedAt: T1, endedAt: null },
    ],
  }));
  assert.equal(out[0].status, "started");
  assert.equal(out[0].isLive, true);
});

test("endedAt is the LATEST ended session, not the first", async () => {
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched({ startedAt: T0 })],
    loadSessionsByRoom: async () => [
      { _id: "a", roomName: "meet-r1", startedAt: T0, endedAt: T1 },
      { _id: "b", roomName: "meet-r1", startedAt: T1, endedAt: T2 },
    ],
  }));
  assert.deepEqual(out[0].endedAt, T2);
});

test("a session started without the schedule recording startedAt still reads started", async () => {
  const out = await statusForSchedules(["s1"], deps({
    loadSchedules: async () => [sched({ startedAt: null })],
    loadSessionsByRoom: async () => [{ _id: "x", roomName: "meet-r1", startedAt: T1, endedAt: null }],
  }));
  assert.equal(out[0].status, "started");
  assert.deepEqual(out[0].startedAt, T1);
});

test("sessions are matched per room, never leaked across schedules", async () => {
  const out = await statusForSchedules(["s1", "s2"], deps({
    loadSchedules: async () => [sched(), sched({ _id: "s2", roomId: "r2" })],
    loadSessionsByRoom: async () => [{ _id: "x", roomName: "meet-r2", startedAt: T1, endedAt: T2 }],
  }));
  const byId = Object.fromEntries(out.map((o) => [o.scheduleId, o.status]));
  assert.equal(byId.s1, "scheduled");
  assert.equal(byId.s2, "completed");
});

test("unknown ids are omitted rather than erroring", async () => {
  const out = await statusForSchedules(["s1", "nope"], deps({
    loadSchedules: async () => [sched()],
  }));
  assert.equal(out.length, 1);
  assert.equal(out[0].scheduleId, "s1");
});

test("over the batch limit is rejected", async () => {
  const ids = Array.from({ length: STATUS_BATCH_LIMIT + 1 }, (_, i) => `s${i}`);
  await assert.rejects(() => statusForSchedules(ids, deps()), /too many/i);
});

test("an empty id list short-circuits without touching the loaders", async () => {
  let touched = false;
  const out = await statusForSchedules([], deps({
    loadSchedules: async () => { touched = true; return []; },
  }));
  assert.deepEqual(out, []);
  assert.equal(touched, false);
});

test("related data joins recordings and notes off meet-<roomId>", async () => {
  const seen: string[] = [];
  const out = await relatedForSchedule("s1", deps({
    loadSchedules: async () => [sched({ startedAt: T1 })],
    loadSessionsByRoom: async (rooms) => { seen.push(...rooms); return [
      { _id: "x", roomName: "meet-r1", startedAt: T1, endedAt: T2, durationSeconds: 3600 },
    ]; },
    loadRecordingsByRoom: async (room) => { seen.push(room); return [
      { id: "rec1", roomName: room, displayName: "Ignite call", url: "https://s3/rec1.mp4", size: 10, duration: 3600, createdAt: T2 },
    ]; },
    loadNotesByRoom: async (room) => [
      { _id: "n1", roomName: room, title: "Ignite call", startedAt: T1, endedAt: T2, status: "done", participants: [], transcriptId: "t1", summaryId: "m1", createdAt: T1 },
    ],
    loadNoteDetail: async () => ({ transcript: { text: "hello" }, summary: { text: "went well" } }),
  }));
  assert.ok(out);
  assert.equal(out!.status, "completed");
  assert.equal(out!.recordings.length, 1);
  assert.equal(out!.noteSessions.length, 1);
  assert.deepEqual(out!.noteSessions[0].transcript, { text: "hello" });
  assert.deepEqual(out!.noteSessions[0].summary, { text: "went well" });
  assert.ok(seen.every((r) => r === "meet-r1"), `all lookups use meet-r1, got ${seen.join(",")}`);
});

test("a catch-up that was never joined returns empty sections, not an error", async () => {
  const out = await relatedForSchedule("s1", deps({
    loadSchedules: async () => [sched()],
  }));
  assert.ok(out);
  assert.equal(out!.status, "scheduled");
  assert.deepEqual(out!.sessions, []);
  assert.deepEqual(out!.recordings, []);
  assert.deepEqual(out!.noteSessions, []);
});

test("an unknown schedule returns null", async () => {
  const out = await relatedForSchedule("gone", deps());
  assert.equal(out, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/services/__tests__/catchupArtifacts.test.ts`
Expected: FAIL — `Cannot find module '../catchupArtifacts'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/catchupArtifacts.ts`:

```ts
import { catchupRoomName, deriveIgniteStatus, type IgniteStatus } from "../lib/ignite-catchup";

/** contacts-backend caps a status batch; garagenew chunks to stay under it. */
export const STATUS_BATCH_LIMIT = 100;

export interface ScheduleLike {
  _id: unknown;
  roomId: string;
  title: string;
  scheduledAt: Date;
  startedAt?: Date | null;
  durationMinutes: number;
  userId: unknown;
  timeZone?: string;
  description?: string;
  attendees?: { email: string; displayName?: string }[];
}

export interface SessionLike {
  _id: unknown;
  roomName: string;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds?: number;
  participants?: { identity?: string; name?: string; isHost?: boolean }[];
}

export interface RecordingLike {
  id: unknown;
  roomName: string;
  displayName?: string;
  size?: number;
  duration?: number;
  createdAt: Date;
  url: string | null;
}

export interface NoteLike {
  _id: unknown;
  roomName: string;
  title?: string;
  startedAt: Date;
  endedAt?: Date | null;
  durationSeconds?: number;
  status: string;
  participants?: { name?: string; email?: string }[];
  transcriptId?: string;
  summaryId?: string;
  createdAt: Date;
}

export interface CatchupDeps {
  loadSchedules(ids: string[]): Promise<ScheduleLike[]>;
  loadSessionsByRoom(roomNames: string[]): Promise<SessionLike[]>;
  loadRecordingsByRoom(roomName: string): Promise<RecordingLike[]>;
  loadNotesByRoom(roomName: string): Promise<NoteLike[]>;
  loadNoteDetail(noteSessionId: unknown): Promise<{ transcript: unknown; summary: unknown }>;
}

export interface ScheduleStatus {
  scheduleId: string;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  isLive: boolean;
  status: IgniteStatus;
}

export interface CatchupRelated extends ScheduleStatus {
  schedule: ScheduleLike;
  sessions: SessionLike[];
  recordings: RecordingLike[];
  noteSessions: (NoteLike & { transcript: unknown; summary: unknown })[];
}

/** Fold a schedule plus its sessions into one status row. */
function statusFor(schedule: ScheduleLike, sessions: SessionLike[]): ScheduleStatus {
  const isLive = sessions.some((s) => !s.endedAt);

  // Earliest real session start is a better "started" signal than the
  // schedule's own startedAt, which some start paths never write.
  const sessionStart = sessions.reduce<Date | null>(
    (acc, s) => (!acc || s.startedAt < acc ? s.startedAt : acc),
    null,
  );
  const startedAt = schedule.startedAt ?? sessionStart ?? null;

  // Only meaningful once nothing is live — otherwise the call is still running.
  const endedAt = isLive
    ? null
    : sessions.reduce<Date | null>(
        (acc, s) => (s.endedAt && (!acc || s.endedAt > acc) ? s.endedAt : acc),
        null,
      );

  return {
    scheduleId: String(schedule._id),
    scheduledAt: schedule.scheduledAt,
    startedAt,
    endedAt,
    isLive,
    status: deriveIgniteStatus({ startedAt, endedAt }),
  };
}

export async function statusForSchedules(
  ids: string[],
  deps: CatchupDeps,
): Promise<ScheduleStatus[]> {
  if (ids.length > STATUS_BATCH_LIMIT) {
    throw new Error(`too many schedule ids (max ${STATUS_BATCH_LIMIT})`);
  }
  if (ids.length === 0) return [];

  const schedules = await deps.loadSchedules(ids);
  if (schedules.length === 0) return [];

  const roomNames = schedules.map((s) => catchupRoomName(s.roomId));
  const sessions = await deps.loadSessionsByRoom(roomNames);

  const byRoom = new Map<string, SessionLike[]>();
  for (const s of sessions) {
    const list = byRoom.get(s.roomName);
    if (list) list.push(s);
    else byRoom.set(s.roomName, [s]);
  }

  // Unknown ids simply do not appear — a deleted schedule is not an error.
  return schedules.map((sch) =>
    statusFor(sch, byRoom.get(catchupRoomName(sch.roomId)) ?? []),
  );
}

export async function relatedForSchedule(
  id: string,
  deps: CatchupDeps,
): Promise<CatchupRelated | null> {
  const [schedule] = await deps.loadSchedules([id]);
  if (!schedule) return null;

  const roomName = catchupRoomName(schedule.roomId);

  // A catch-up that was scheduled and never joined has no sessions, no
  // recordings and no notes. That is an empty panel, not a failure.
  const [sessions, recordings, notes] = await Promise.all([
    deps.loadSessionsByRoom([roomName]),
    deps.loadRecordingsByRoom(roomName),
    deps.loadNotesByRoom(roomName),
  ]);

  const noteSessions = await Promise.all(
    notes.map(async (n) => ({ ...n, ...(await deps.loadNoteDetail(n._id)) })),
  );

  return {
    ...statusFor(schedule, sessions),
    schedule,
    sessions,
    recordings,
    noteSessions,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import tsx --test src/services/__tests__/catchupArtifacts.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Build and commit**

```bash
npm run build
git add src/services/catchupArtifacts.ts src/services/__tests__/catchupArtifacts.test.ts \
        dist/services/catchupArtifacts.* dist/services/__tests__/catchupArtifacts.test.*
git commit -m "Ignite call: catch-up artifact reads (status + related data)"
```

---

### Task 4: Extract the catch-up creation service

`POST /meet/schedule` (`routes/meet.ts:697`) creates a `MeetSchedule` and mirrors it to Google Calendar, all inline. The admin path needs the same behaviour. Extract rather than copy: a divergent copy would silently stop mirroring admin-created calls to Google Calendar, and nothing would fail loudly.

**Files:**
- Create: `src/services/meet/createSchedule.ts`
- Modify: `src/routes/meet.ts:697-800` (the `POST /schedule` handler body)

**Interfaces:**
- Consumes: `normalizeAttendeeEmail`, `Attendee` from Task 1.
- Produces: `createCatchupSchedule(input: CreateCatchupInput): Promise<{ schedule: IMeetSchedule; googleEvent: { eventId?: string; htmlLink?: string } }>`; `normalizeAttendees(raw: unknown): Attendee[]`.

- [ ] **Step 1: Write the failing test**

Create `src/services/meet/__tests__/createSchedule.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAttendees } from "../createSchedule";

test("normalizes, lowercases and de-blanks attendee emails", () => {
  assert.deepEqual(
    normalizeAttendees([{ email: "  A@X.com " }, { email: "b@x.com", displayName: " Bee " }]),
    [{ email: "a@x.com" }, { email: "b@x.com", displayName: "Bee" }],
  );
});

test("drops entries with no usable email — email is the join key", () => {
  assert.deepEqual(normalizeAttendees([{ displayName: "No Email" }, { email: "   " }]), []);
});

test("a non-array is an empty attendee list", () => {
  assert.deepEqual(normalizeAttendees(undefined), []);
  assert.deepEqual(normalizeAttendees("nope"), []);
});

test("caps displayName at 80 characters", () => {
  const long = "x".repeat(200);
  const [a] = normalizeAttendees([{ email: "a@x.com", displayName: long }]);
  assert.equal(a.displayName!.length, 80);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test src/services/meet/__tests__/createSchedule.test.ts`
Expected: FAIL — `Cannot find module '../createSchedule'`.

- [ ] **Step 3: Write the service**

Create `src/services/meet/createSchedule.ts`. Move the body of `POST /meet/schedule` here verbatim, parameterised by host instead of reading `req.user`:

```ts
import { Types } from "mongoose";
import { nanoid } from "nanoid";

import { MeetSchedule, IMeetSchedule } from "../../models/meet-schedule.model";
import { isGoogleConnected, createGoogleCalendarEvent } from "../googleCalendar";
import { normalizeAttendeeEmail, type Attendee } from "../../lib/ignite-catchup";

/** Mirrors the normalisation `POST /meet/schedule` has always applied. */
export function normalizeAttendees(raw: unknown): Attendee[] {
  if (!Array.isArray(raw)) return [];
  const out: Attendee[] = [];
  for (const a of raw as { email?: unknown; displayName?: unknown }[]) {
    const email = normalizeAttendeeEmail(a?.email);
    if (!email) continue;
    const entry: Attendee = { email };
    if (typeof a?.displayName === "string" && a.displayName.trim()) {
      entry.displayName = a.displayName.trim().slice(0, 80);
    }
    out.push(entry);
  }
  return out;
}

export interface CreateCatchupInput {
  hostUserId: string;
  hostOrgId: string;
  title: string;
  scheduledAt: string | Date;
  durationMinutes?: number;
  description?: string;
  timeZone?: string;
  calendarId?: string;
  accountId?: string;
  attendees?: unknown;
  contactId?: string;
}

export async function createCatchupSchedule(input: CreateCatchupInput): Promise<{
  schedule: IMeetSchedule;
  meetLink: string;
  googleEvent: { eventId?: string; htmlLink?: string };
}> {
  const roomId = nanoid(10);
  const dur = input.durationMinutes ?? 60;
  const startDate = new Date(input.scheduledAt);
  const endDate = new Date(startDate.getTime() + dur * 60 * 1000);
  const meetLink = `https://networkchains.com/meet/room/${roomId}`;
  const attendees = normalizeAttendees(input.attendees);

  const schedule = await MeetSchedule.create({
    userId: new Types.ObjectId(input.hostUserId),
    orgId: new Types.ObjectId(input.hostOrgId),
    title: input.title,
    roomId,
    scheduledAt: startDate,
    durationMinutes: dur,
    timeZone: typeof input.timeZone === "string" ? input.timeZone : undefined,
    description: input.description,
    attendees,
    contactId:
      typeof input.contactId === "string" && Types.ObjectId.isValid(input.contactId)
        ? new Types.ObjectId(input.contactId)
        : undefined,
  });

  // Best-effort Google Calendar mirror — a calendar failure must never lose
  // the schedule that was already written.
  let googleEvent: { eventId?: string; htmlLink?: string } = {};
  try {
    if (await isGoogleConnected(input.hostUserId)) {
      const calDesc = `${input.description ? input.description + "\n\n" : ""}Join meeting: ${meetLink}`;
      const result = await createGoogleCalendarEvent(
        input.hostUserId,
        input.hostOrgId,
        {
          summary: input.title,
          description: calDesc,
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
          timeZone: input.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          attendees: attendees.length ? attendees : undefined,
          locationType: "networkchain",
          locationDetail: meetLink,
        },
        input.calendarId || "primary",
        input.accountId || undefined,
      );
      googleEvent = { eventId: result.eventId, htmlLink: result.htmlLink };
      if (result.eventId) {
        await MeetSchedule.updateOne(
          { _id: schedule._id },
          { googleCalendarEventId: result.eventId },
        );
      }
    }
  } catch (err) {
    console.error("[createCatchupSchedule] Google Calendar mirror failed:", err);
  }

  return { schedule, meetLink, googleEvent };
}
```

**Before writing this file**, open `src/routes/meet.ts:697-800` and copy the real import paths and the real `createGoogleCalendarEvent` call shape from there — the block above reproduces it, but the route is the source of truth for the helper's module path and option names.

- [ ] **Step 4: Rewrite the route to delegate**

In `src/routes/meet.ts`, replace the body of `POST /schedule` (keeping its validation, its response shape, and its error handling byte-identical) with a call to `createCatchupSchedule({ hostUserId: req.user!.userId, hostOrgId: req.user!.orgId, ...req.body })`.

- [ ] **Step 5: Run tests and typecheck**

```bash
node --import tsx --test 'src/**/*.test.ts'
./node_modules/.bin/tsc --noEmit
echo $?
```
Expected: all tests PASS; typecheck exit code `0`.

- [ ] **Step 6: Verify the route's behaviour is unchanged**

Per the repo rule, never boot the server. Instead diff the old and new handler:

```bash
git diff src/routes/meet.ts
```
Read it and confirm: same validation, same 400 on missing `title`/`scheduledAt`, same response body keys, same `contactId` handling. The only change should be that the creation block moved.

- [ ] **Step 7: Build and commit**

```bash
npm run build
git add src/services/meet/createSchedule.ts src/services/meet/__tests__/createSchedule.test.ts \
        src/routes/meet.ts \
        dist/services/meet/createSchedule.* dist/services/meet/__tests__/createSchedule.test.* \
        dist/routes/meet.*
git commit -m "Ignite call: extract createCatchupSchedule so admin and user paths share it"
```

---

### Task 5: The service router

**Files:**
- Create: `src/routes/service-garage-meet.ts`
- Modify: `src/app.ts` (~line 311-320, with the other `/admin/*` mounts)

**Interfaces:**
- Consumes: `requireGarageService` (Task 2); `statusForSchedules`, `relatedForSchedule`, `STATUS_BATCH_LIMIT`, `CatchupDeps` (Task 3); `createCatchupSchedule` (Task 4); `mergeAttendee` (Task 1).
- Produces: six HTTP endpoints under `/service/garage/meet`, consumed by garagenew-backend in Phase 2.

Response envelope matches the rest of this repo's admin routes: `{ ok: true, data: … }` / `{ ok: false, error: … }`.

- [ ] **Step 1: Write the router**

Create `src/routes/service-garage-meet.ts`:

```ts
/**
 * Garage admin panel → catch-up data.
 *
 * Powers the "Ignite call status" column in Garage's One Time Affiliates
 * table. Garage owns the affiliate↔catch-up link; this repo stays the system
 * of record for the meeting itself.
 *
 * All routes are service-token only (see middleware/garageService.ts) — they
 * act as the platform, not on behalf of a user.
 */
import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireGarageService } from "../middleware/garageService";
import { MeetSchedule } from "../models/meet-schedule.model";
import { MeetSession } from "../models/meet-session.model";
import { OfficeRecording } from "../models/office-recording.model";
import { NoteSession } from "../note-taker/models/note-session.model";
import { NoteTranscript } from "../note-taker/models/note-transcript.model";
import { NoteSummary } from "../note-taker/models/note-summary.model";
import { User } from "../models/user.model";
import {
  statusForSchedules,
  relatedForSchedule,
  STATUS_BATCH_LIMIT,
  type CatchupDeps,
} from "../services/catchupArtifacts";
import { createCatchupSchedule } from "../services/meet/createSchedule";
import { mergeAttendee } from "../lib/ignite-catchup";
import { presignRecording } from "../services/userScopedReads";

const router = Router();

const validIds = (ids: unknown): string[] =>
  Array.isArray(ids)
    ? ids.filter((i): i is string => typeof i === "string" && Types.ObjectId.isValid(i))
    : [];

/** The real Mongo-backed loaders behind `CatchupDeps`. */
const deps: CatchupDeps = {
  loadSchedules: (ids) => MeetSchedule.find({ _id: { $in: ids } }).lean() as never,
  loadSessionsByRoom: (roomNames) =>
    MeetSession.find(
      { roomName: { $in: roomNames } },
      "roomName roomId startedAt endedAt durationSeconds participants",
    )
      .sort({ startedAt: 1 })
      .lean() as never,
  loadRecordingsByRoom: async (roomName) => {
    const recs = await OfficeRecording.find({ roomName, status: "ready" })
      .sort({ createdAt: -1 })
      .lean();
    return Promise.all(recs.map((r) => presignRecording(r)));
  },
  loadNotesByRoom: (roomName) =>
    NoteSession.find({ roomName })
      .select(
        "roomName title startedAt endedAt durationSeconds status participants transcriptId summaryId createdAt",
      )
      .sort({ startedAt: -1 })
      .lean() as never,
  loadNoteDetail: async (noteSessionId) => {
    const [transcript, summary] = await Promise.all([
      NoteTranscript.findOne({ sessionId: noteSessionId }).lean(),
      NoteSummary.findOne({ sessionId: noteSessionId }).lean(),
    ]);
    return { transcript, summary };
  },
};

/** 1. GET /host-by-email?email= — resolve a Garage admin to their NC user.
 *  Returns 200 with `user: null` when there is no match: "this admin has no
 *  NetworkChains account" is a normal outcome the UI must render, not a 404. */
router.get("/host-by-email", requireGarageService, async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(400).json({ ok: false, error: "email is required" });
      return;
    }
    const user = await User.findOne({ email }, "_id orgId name email").lean();
    res.json({
      ok: true,
      data: {
        user: user
          ? { userId: String(user._id), orgId: String(user.orgId ?? ""), name: user.name, email: user.email }
          : null,
      },
    });
  } catch (err) {
    console.error("[service/garage/meet] host-by-email error:", err);
    res.status(500).json({ ok: false, error: "Failed to resolve host" });
  }
});

/** 2. GET /hosts/:ncUserId/schedules?days=60 — that host's upcoming catch-ups. */
router.get("/hosts/:ncUserId/schedules", requireGarageService, async (req: Request, res: Response) => {
  try {
    const { ncUserId } = req.params;
    if (!Types.ObjectId.isValid(ncUserId)) {
      res.status(400).json({ ok: false, error: "Invalid host id" });
      return;
    }
    const days = Math.min(Math.max(Number(req.query.days) || 60, 1), 180);
    const until = new Date(Date.now() + days * 86400_000);

    const schedules = await MeetSchedule.find(
      { userId: new Types.ObjectId(ncUserId), scheduledAt: { $lte: until } },
      "_id roomId title scheduledAt startedAt durationMinutes timeZone attendees",
    )
      .sort({ scheduledAt: 1 })
      .limit(200)
      .lean();

    res.json({
      ok: true,
      data: {
        schedules: schedules.map((s) => ({
          scheduleId: String(s._id),
          roomId: s.roomId,
          title: s.title,
          scheduledAt: s.scheduledAt,
          startedAt: s.startedAt ?? null,
          durationMinutes: s.durationMinutes,
          timeZone: s.timeZone ?? null,
          attendees: s.attendees ?? [],
        })),
      },
    });
  } catch (err) {
    console.error("[service/garage/meet] host schedules error:", err);
    res.status(500).json({ ok: false, error: "Failed to load schedules" });
  }
});

/** 3. POST /hosts/:ncUserId/schedules — create a catch-up on that host's account. */
router.post("/hosts/:ncUserId/schedules", requireGarageService, async (req: Request, res: Response) => {
  try {
    const { ncUserId } = req.params;
    if (!Types.ObjectId.isValid(ncUserId)) {
      res.status(400).json({ ok: false, error: "Invalid host id" });
      return;
    }
    const { title, scheduledAt, durationMinutes, timeZone, description, attendees } = req.body ?? {};
    if (!title || !scheduledAt) {
      res.status(400).json({ ok: false, error: "title and scheduledAt are required" });
      return;
    }
    const host = await User.findById(ncUserId, "_id orgId").lean();
    if (!host?.orgId) {
      res.status(404).json({ ok: false, error: "Host has no NetworkChains organisation" });
      return;
    }

    const { schedule, meetLink } = await createCatchupSchedule({
      hostUserId: String(host._id),
      hostOrgId: String(host.orgId),
      title: String(title).slice(0, 200),
      scheduledAt,
      durationMinutes,
      timeZone,
      description,
      attendees,
    });

    res.status(201).json({
      ok: true,
      data: {
        scheduleId: String(schedule._id),
        roomId: schedule.roomId,
        title: schedule.title,
        scheduledAt: schedule.scheduledAt,
        startedAt: null,
        durationMinutes: schedule.durationMinutes,
        meetLink,
      },
    });
  } catch (err) {
    console.error("[service/garage/meet] create schedule error:", err);
    res.status(500).json({ ok: false, error: "Failed to create catch-up" });
  }
});

/** 4. POST /schedules/:scheduleId/attendees — idempotent attendee add. */
router.post("/schedules/:scheduleId/attendees", requireGarageService, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    if (!Types.ObjectId.isValid(scheduleId)) {
      res.status(400).json({ ok: false, error: "Invalid schedule id" });
      return;
    }
    const { email, displayName } = req.body ?? {};
    if (typeof email !== "string" || !email.trim()) {
      res.status(400).json({ ok: false, error: "email is required" });
      return;
    }
    const schedule = await MeetSchedule.findById(scheduleId, "attendees").lean();
    if (!schedule) {
      res.status(404).json({ ok: false, error: "Catch-up not found" });
      return;
    }

    const merged = mergeAttendee(schedule.attendees ?? [], email, displayName);
    if (merged.added) {
      await MeetSchedule.updateOne({ _id: scheduleId }, { attendees: merged.attendees });
    }
    res.json({ ok: true, data: { added: merged.added, attendees: merged.attendees } });
  } catch (err) {
    console.error("[service/garage/meet] add attendee error:", err);
    res.status(500).json({ ok: false, error: "Failed to add attendee" });
  }
});

/** 5. POST /schedules/status — batched live status for the visible rows. */
router.post("/schedules/status", requireGarageService, async (req: Request, res: Response) => {
  try {
    const ids = validIds(req.body?.scheduleIds);
    if (ids.length > STATUS_BATCH_LIMIT) {
      res.status(400).json({ ok: false, error: `At most ${STATUS_BATCH_LIMIT} schedule ids per request` });
      return;
    }
    const statuses = await statusForSchedules(ids, deps);
    res.json({ ok: true, data: { statuses } });
  } catch (err) {
    console.error("[service/garage/meet] status error:", err);
    res.status(500).json({ ok: false, error: "Failed to load statuses" });
  }
});

/** 6. GET /schedules/:scheduleId/related — the side-panel payload. */
router.get("/schedules/:scheduleId/related", requireGarageService, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    if (!Types.ObjectId.isValid(scheduleId)) {
      res.status(400).json({ ok: false, error: "Invalid schedule id" });
      return;
    }
    const related = await relatedForSchedule(scheduleId, deps);
    if (!related) {
      res.status(404).json({ ok: false, error: "Catch-up not found" });
      return;
    }
    res.json({ ok: true, data: related });
  } catch (err) {
    console.error("[service/garage/meet] related error:", err);
    res.status(500).json({ ok: false, error: "Failed to load related data" });
  }
});

export default router;
```

- [ ] **Step 2: Extract `presignRecording`**

The router above imports `presignRecording` from `services/userScopedReads.ts`. That file currently inlines the S3 presign inside `recordingsFor` (~line 227). Extract the per-recording mapping into an exported `presignRecording(rec)` returning `{ id, roomName, displayName, size, duration, createdAt, url }`, and have `recordingsFor` call it. Behaviour must be identical, including the `egressId.startsWith("upload-")` guard and the `url = null` catch.

- [ ] **Step 3: Mount the router**

In `src/app.ts`, alongside the other admin mounts (~line 311-320):

```ts
import serviceGarageMeetRouter from "./routes/service-garage-meet";
// …
app.use("/service/garage/meet", serviceGarageMeetRouter);
```

- [ ] **Step 4: Typecheck and run the full test suite**

```bash
./node_modules/.bin/tsc --noEmit
echo $?
node --import tsx --test 'src/**/*.test.ts'
```
Expected: typecheck exit `0`; all tests PASS.

- [ ] **Step 5: Verify the guard is actually attached**

```bash
grep -c "requireGarageService" src/routes/service-garage-meet.ts
```
Expected: `7` — one import plus one per route. If it is fewer, a route is unguarded.

- [ ] **Step 6: Build and commit**

```bash
npm run build
git add src/routes/service-garage-meet.ts src/services/userScopedReads.ts src/app.ts \
        dist/routes/service-garage-meet.* dist/services/userScopedReads.* \
        dist/app.*
git commit -m "Ignite call: /service/garage/meet endpoints for the Garage admin panel"
```

---

# Phase 2 — garagenew-backend

### Task 6: `IgniteCall` model and the NC client

**Files:**
- Create: `src/models/igniteCall.model.ts`
- Create: `src/lib/ncMeetClient.ts`

**Interfaces:**
- Consumes: contacts-backend `/service/garage/meet/*` (Task 5).
- Produces: `IgniteCallModel`, `IIgniteCall`; and from the client — `ncHostByEmail`, `ncHostSchedules`, `ncCreateSchedule`, `ncAddAttendee`, `ncScheduleStatuses`, `ncScheduleRelated`, plus types `NcScheduleSummary`, `NcScheduleStatus`.

- [ ] **Step 1: Write the model**

Create `src/models/igniteCall.model.ts`:

```ts
import mongoose, { Schema, Document, Types } from "mongoose";

/**
 * An affiliate's Ignite call — the link between a Garage user and a
 * NetworkChains catch-up (a MeetSchedule in contacts-backend).
 *
 * `title` and `scheduledAt` are SNAPSHOTS. They let the admin table, the
 * history list and CSV export render when contacts-backend is unreachable,
 * and they keep history readable if the schedule is later deleted in NC.
 *
 * The four-state status is NOT stored — it is derived at read time from the
 * catch-up's live state. See services/igniteCall.service.ts.
 */
export interface IIgniteCall extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  adminId: Types.ObjectId;
  ncHostUserId: string;
  ncScheduleId: string;
  ncRoomId: string;
  title: string;
  scheduledAt: Date;
  detachedAt?: Date | null;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const IgniteCallSchema = new Schema<IIgniteCall>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adminId: { type: Schema.Types.ObjectId, ref: "GarageAdmin", required: true },
    ncHostUserId: { type: String, required: true },
    ncScheduleId: { type: String, required: true },
    ncRoomId: { type: String, required: true },
    title: { type: String, required: true },
    scheduledAt: { type: Date, required: true },
    detachedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
  },
  { timestamps: true },
);

// The per-row lookup: newest live call for a set of affiliates.
IgniteCallSchema.index({ userId: 1, detachedAt: 1, scheduledAt: -1 });
// The same catch-up must not be attached to the same affiliate twice.
IgniteCallSchema.index({ userId: 1, ncScheduleId: 1 }, { unique: true });

export const IgniteCallModel = mongoose.model<IIgniteCall>("IgniteCall", IgniteCallSchema);
```

- [ ] **Step 2: Write the client**

Create `src/lib/ncMeetClient.ts`:

```ts
/**
 * Thin client for contacts-backend's Garage service endpoints
 * (`/service/garage/meet/*`). Auth is a shared service token — see that
 * repo's middleware/garageService.ts.
 *
 * Every call has a hard timeout: the affiliates list enriches rows through
 * this client, and a hung NetworkChains must degrade the column, not stall
 * the admin table.
 */
const NC_BASE = process.env.NC_BACKEND_URL || "https://backend.networkchains.com";
const SERVICE_TOKEN = process.env.GARAGE_SERVICE_TOKEN || "";
const TIMEOUT_MS = 8000;

export class NcMeetError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "NcMeetError";
    this.status = status;
  }
}

async function ncFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!SERVICE_TOKEN) {
    throw new NcMeetError("GARAGE_SERVICE_TOKEN is not configured", 503);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${NC_BASE}/service/garage/meet${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Service-Token": SERVICE_TOKEN,
        ...(init.headers || {}),
      },
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; data?: T; error?: string }
      | null;
    if (!res.ok || !body?.ok) {
      throw new NcMeetError(body?.error || `NetworkChains request failed`, res.status);
    }
    return body.data as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface NcHost { userId: string; orgId: string; name?: string; email?: string }
export interface NcScheduleSummary {
  scheduleId: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startedAt: string | null;
  durationMinutes: number;
  timeZone: string | null;
  attendees: { email: string; displayName?: string }[];
}
export interface NcScheduleStatus {
  scheduleId: string;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  isLive: boolean;
  status: "not_scheduled" | "scheduled" | "started" | "completed";
}

export const ncHostByEmail = (email: string) =>
  ncFetch<{ user: NcHost | null }>(`/host-by-email?email=${encodeURIComponent(email)}`);

export const ncHostSchedules = (ncUserId: string, days = 60) =>
  ncFetch<{ schedules: NcScheduleSummary[] }>(
    `/hosts/${encodeURIComponent(ncUserId)}/schedules?days=${days}`,
  );

export const ncCreateSchedule = (
  ncUserId: string,
  body: {
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    timeZone?: string;
    description?: string;
    attendees?: { email: string; displayName?: string }[];
  },
) =>
  ncFetch<NcScheduleSummary & { meetLink: string }>(
    `/hosts/${encodeURIComponent(ncUserId)}/schedules`,
    { method: "POST", body: JSON.stringify(body) },
  );

export const ncAddAttendee = (scheduleId: string, email: string, displayName?: string) =>
  ncFetch<{ added: boolean; attendees: { email: string; displayName?: string }[] }>(
    `/schedules/${encodeURIComponent(scheduleId)}/attendees`,
    { method: "POST", body: JSON.stringify({ email, displayName }) },
  );

export const ncScheduleStatuses = (scheduleIds: string[]) =>
  ncFetch<{ statuses: NcScheduleStatus[] }>(`/schedules/status`, {
    method: "POST",
    body: JSON.stringify({ scheduleIds }),
  });

export const ncScheduleRelated = (scheduleId: string) =>
  ncFetch<Record<string, unknown>>(
    `/schedules/${encodeURIComponent(scheduleId)}/related`,
  );
```

- [ ] **Step 3: Typecheck**

```bash
cd ~/dev/technsure/server/garagenew-backend
./node_modules/.bin/tsc --noEmit -p tsconfig.json
echo $?
```
Expected: exit code `0`.

- [ ] **Step 4: Commit**

```bash
git add src/models/igniteCall.model.ts src/lib/ncMeetClient.ts
git commit -m "Ignite call: IgniteCall model + contacts-backend service client"
```

---

### Task 7: Status derivation and fail-soft enrichment

**Files:**
- Create: `src/services/igniteCall.service.ts`
- Test: `src/services/__tests__/igniteCall.service.test.ts`

**Interfaces:**
- Consumes: `NcScheduleStatus` (Task 6).
- Produces: `NC_STATUS_CHUNK = 100`; `chunk<T>(items: T[], size: number): T[][]`; `newestLiveCall<T>(calls: T[]): T | null`; `enrichStatuses(scheduleIds: string[], fetchStatuses): Promise<Map<string, NcScheduleStatus>>`.

Jest tests must live under `src/services/__tests__/` — that directory is one of the three jest `roots`. It does not exist yet; create it.

- [ ] **Step 1: Write the failing test**

Create `src/services/__tests__/igniteCall.service.test.ts`:

```ts
import {
  chunk,
  newestLiveCall,
  enrichStatuses,
  NC_STATUS_CHUNK,
} from "../igniteCall.service";

describe("chunk", () => {
  it("splits into batches of at most the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns no batches for an empty list", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("keeps a list smaller than the size as one batch", () => {
    expect(chunk([1, 2], 10)).toEqual([[1, 2]]);
  });
});

describe("newestLiveCall", () => {
  const a = { _id: "a", scheduledAt: new Date("2026-09-01"), detachedAt: null };
  const b = { _id: "b", scheduledAt: new Date("2026-09-05"), detachedAt: null };
  const detached = { _id: "c", scheduledAt: new Date("2026-09-09"), detachedAt: new Date() };

  it("picks the latest scheduledAt", () => {
    expect(newestLiveCall([a, b])!._id).toBe("b");
  });

  it("ignores detached calls even when they are newest", () => {
    expect(newestLiveCall([a, b, detached])!._id).toBe("b");
  });

  it("returns null when every call is detached", () => {
    expect(newestLiveCall([detached])).toBeNull();
  });

  it("returns null for an empty history", () => {
    expect(newestLiveCall([])).toBeNull();
  });
});

describe("enrichStatuses", () => {
  const status = (id: string, over = {}) => ({
    scheduleId: id, scheduledAt: "2026-09-04T10:00:00Z", startedAt: null,
    endedAt: null, isLive: false, status: "scheduled" as const, ...over,
  });

  it("returns a map keyed by scheduleId", async () => {
    const out = await enrichStatuses(["s1"], async () => [status("s1", { status: "started" })]);
    expect(out.get("s1")!.status).toBe("started");
  });

  it("chunks requests at NC_STATUS_CHUNK", async () => {
    // CSV export pages the affiliates list at 200 rows, so a single call can
    // carry more linked rows than contacts-backend accepts in one request.
    const ids = Array.from({ length: 250 }, (_, i) => `s${i}`);
    const batches: number[] = [];
    await enrichStatuses(ids, async (batch) => {
      batches.push(batch.length);
      return batch.map((id) => status(id));
    });
    expect(batches).toEqual([NC_STATUS_CHUNK, NC_STATUS_CHUNK, 50]);
  });

  it("every id in a 200-row export page gets a status", async () => {
    const ids = Array.from({ length: 200 }, (_, i) => `s${i}`);
    const out = await enrichStatuses(ids, async (batch) => batch.map((id) => status(id)));
    expect(out.size).toBe(200);
  });

  it("fails soft to an empty map when NetworkChains errors", async () => {
    const out = await enrichStatuses(["s1"], async () => {
      throw new Error("connect ETIMEDOUT");
    });
    expect(out.size).toBe(0);
  });

  it("keeps the batches that succeeded when one batch fails", async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `s${i}`);
    let call = 0;
    const out = await enrichStatuses(ids, async (batch) => {
      call += 1;
      if (call === 2) throw new Error("boom");
      return batch.map((id) => status(id));
    });
    expect(out.size).toBe(NC_STATUS_CHUNK);
  });

  it("does not call NetworkChains at all for an empty id list", async () => {
    const fetcher = jest.fn();
    const out = await enrichStatuses([], fetcher as never);
    expect(out.size).toBe(0);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/dev/technsure/server/garagenew-backend && npx jest src/services/__tests__/igniteCall.service.test.ts`
Expected: FAIL — `Cannot find module '../igniteCall.service'`.

- [ ] **Step 3: Write minimal implementation**

Create `src/services/igniteCall.service.ts`:

```ts
import type { NcScheduleStatus } from "../lib/ncMeetClient";

/**
 * contacts-backend caps a status batch at 100. The affiliates list is paged at
 * 20 in the UI but at 200 for CSV export, so chunking is required, not
 * defensive — without it an export would silently lose statuses.
 */
export const NC_STATUS_CHUNK = 100;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

interface LiveCallLike {
  scheduledAt: Date;
  detachedAt?: Date | null;
}

/** The call the column reflects: the newest non-detached one. */
export function newestLiveCall<T extends LiveCallLike>(calls: T[]): T | null {
  let best: T | null = null;
  for (const c of calls) {
    if (c.detachedAt) continue;
    if (!best || c.scheduledAt > best.scheduledAt) best = c;
  }
  return best;
}

/**
 * Live status for a set of catch-ups, chunked and FAIL-SOFT.
 *
 * A NetworkChains outage must degrade the Ignite call column to its stored
 * snapshot, never fail the whole affiliates list. Batches are independent, so
 * one bad batch does not discard the others.
 */
export async function enrichStatuses(
  scheduleIds: string[],
  fetchStatuses: (batch: string[]) => Promise<NcScheduleStatus[]>,
): Promise<Map<string, NcScheduleStatus>> {
  const out = new Map<string, NcScheduleStatus>();
  if (scheduleIds.length === 0) return out;

  const batches = chunk(scheduleIds, NC_STATUS_CHUNK);
  const results = await Promise.allSettled(batches.map((b) => fetchStatuses(b)));

  for (const r of results) {
    if (r.status !== "fulfilled") {
      console.error("[igniteCall] status batch failed:", r.reason);
      continue;
    }
    for (const s of r.value) out.set(s.scheduleId, s);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/services/__tests__/igniteCall.service.test.ts`
Expected: PASS — 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/services/igniteCall.service.ts src/services/__tests__/igniteCall.service.test.ts
git commit -m "Ignite call: chunked, fail-soft status enrichment"
```

---

### Task 8: Attach / detach / history endpoints

**Files:**
- Create: `src/routes/garageAdminIgniteCall.ts`
- Modify: `src/app.ts` (~line 477-487, with the other `/garage-admin` mounts)

**Interfaces:**
- Consumes: `IgniteCallModel` (Task 6); `ncHostByEmail`, `ncHostSchedules`, `ncCreateSchedule`, `ncAddAttendee`, `ncScheduleRelated` (Task 6); `newestLiveCall` (Task 7).
- Produces: `GET /garage-admin/admins/:adminId/catchups`, `POST /garage-admin/users/:userId/ignite-call`, `DELETE /garage-admin/users/:userId/ignite-call/:id`, `GET /garage-admin/users/:userId/ignite-calls`, `GET /garage-admin/ignite-call/:id/related`.

Paths use the neutral `/users/:userId/...` form exactly as `assign-agent` does (`garageAdminNetworkChainSubs.ts:484`), so a second admin table can adopt this column with no new backend.

- [ ] **Step 1: Write the router**

Create `src/routes/garageAdminIgniteCall.ts`:

```ts
/**
 * Ignite call — the link between a Garage affiliate and a NetworkChains
 * catch-up, plus the reads that back the status column and its side panel.
 *
 * Guards are attached PER ROUTE, never with router.use: this router shares the
 * bare /garage-admin mount, where router-level middleware fires for paths this
 * router does not define and rejects them before the next router is reached.
 * See CLAUDE.md — that pattern took down admin login in production.
 */
import { Router, Request, Response } from "express";
import { Types } from "mongoose";

import { requireGarageAdminAuth, requireGarageSuperAdmin } from "../middleware/garageAdminAuth";
import { IgniteCallModel } from "../models/igniteCall.model";
import { User } from "../models/user.model";
import { GarageAdminModel } from "../models/garageAdmin.model";
import {
  ncHostByEmail,
  ncHostSchedules,
  ncCreateSchedule,
  ncAddAttendee,
  ncScheduleRelated,
  NcMeetError,
} from "../lib/ncMeetClient";

const router = Router();
const adminOnly = [requireGarageAdminAuth];
const superAdminOnly = [requireGarageAdminAuth, requireGarageSuperAdmin];

function ncErrorResponse(res: Response, err: unknown, fallback: string) {
  if (err instanceof NcMeetError) {
    return res.status(err.status === 503 ? 503 : 502).json({ success: false, message: err.message });
  }
  console.error(`[garage-admin/ignite-call] ${fallback}:`, err);
  return res.status(500).json({ success: false, message: fallback });
}

/**
 * GET /garage-admin/admins/:adminId/catchups
 * That admin's upcoming catch-ups, for step 2 of the picker.
 * `host: null` means the admin has no NetworkChains account — a normal
 * outcome the picker renders explicitly, not an error.
 */
router.get("/admins/:adminId/catchups", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { adminId } = req.params;
    if (!Types.ObjectId.isValid(adminId)) {
      return res.status(400).json({ success: false, message: "Invalid admin id" });
    }
    const admin = await GarageAdminModel.findById(adminId).select("_id name email").lean();
    if (!admin) {
      return res.status(404).json({ success: false, message: "Admin not found" });
    }

    const { user: host } = await ncHostByEmail(String(admin.email));
    if (!host) {
      return res.json({ success: true, data: { host: null, schedules: [] } });
    }
    const { schedules } = await ncHostSchedules(host.userId, 60);
    return res.json({ success: true, data: { host, schedules } });
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to load catch-ups");
  }
});

/**
 * POST /garage-admin/users/:userId/ignite-call
 * Attach an existing catch-up, or create one and attach it.
 *
 * Body: { adminId, ncScheduleId? , createSchedule?: { title, scheduledAt,
 *         durationMinutes?, timeZone?, description? } }
 */
router.post("/users/:userId/ignite-call", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { adminId, ncScheduleId, createSchedule } = req.body ?? {};

    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    if (!Types.ObjectId.isValid(String(adminId))) {
      return res.status(400).json({ success: false, message: "Invalid admin id" });
    }
    if (!ncScheduleId && !createSchedule) {
      return res
        .status(400)
        .json({ success: false, message: "Provide ncScheduleId or createSchedule" });
    }

    const [affiliate, admin] = await Promise.all([
      User.findById(userId).select("_id name email").lean(),
      GarageAdminModel.findById(adminId).select("_id name email profilePicture").lean(),
    ]);
    if (!affiliate) return res.status(404).json({ success: false, message: "Affiliate not found" });
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found" });

    const { user: host } = await ncHostByEmail(String(admin.email));
    if (!host) {
      return res.status(409).json({
        success: false,
        message: `${admin.name || admin.email} has no NetworkChains account, so they have no catch-ups to attach.`,
      });
    }

    // Either use the catch-up the operator picked, or create a new one with
    // the affiliate already on it.
    let schedule;
    if (createSchedule) {
      schedule = await ncCreateSchedule(host.userId, {
        title: String(createSchedule.title ?? "Ignite call"),
        scheduledAt: String(createSchedule.scheduledAt),
        durationMinutes: createSchedule.durationMinutes,
        timeZone: createSchedule.timeZone,
        description: createSchedule.description,
        attendees: affiliate.email
          ? [{ email: String(affiliate.email), displayName: affiliate.name ?? undefined }]
          : [],
      });
    } else {
      const { schedules } = await ncHostSchedules(host.userId, 180);
      schedule = schedules.find((s) => s.scheduleId === String(ncScheduleId));
      if (!schedule) {
        return res.status(404).json({ success: false, message: "Catch-up not found for this admin" });
      }
      // Idempotent on the NetworkChains side — a no-op if already listed.
      if (affiliate.email) {
        await ncAddAttendee(schedule.scheduleId, String(affiliate.email), affiliate.name ?? undefined);
      }
    }

    const actingAdminId = (req as any).garageAdmin?.garageAdminId;
    const call = await IgniteCallModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), ncScheduleId: schedule.scheduleId },
      {
        $set: {
          adminId: new Types.ObjectId(String(adminId)),
          ncHostUserId: host.userId,
          ncRoomId: schedule.roomId,
          title: schedule.title,
          scheduledAt: new Date(schedule.scheduledAt),
          detachedAt: null,
        },
        $setOnInsert: {
          userId: new Types.ObjectId(userId),
          ncScheduleId: schedule.scheduleId,
          createdBy: actingAdminId ? new Types.ObjectId(actingAdminId) : undefined,
        },
      },
      { upsert: true, new: true },
    ).lean();

    // Shape must match the frontend's IgniteCallSummary EXACTLY — the picker
    // writes this straight into the table row, so a missing field would leave
    // the cell with an undefined status until the next reload.
    const historyCount = await IgniteCallModel.countDocuments({ userId });

    return res.json({
      success: true,
      data: {
        id: String(call!._id),
        adminId: String(admin._id),
        admin: { name: admin.name, email: admin.email, profilePicture: (admin as any).profilePicture ?? null },
        ncScheduleId: schedule.scheduleId,
        ncRoomId: schedule.roomId,
        title: schedule.title,
        scheduledAt: schedule.scheduledAt,
        // A just-attached call has not started. `started`/`completed` arrive
        // from the live status on the next list load.
        status: "scheduled",
        startedAt: null,
        endedAt: null,
        historyCount,
      },
    });
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to attach Ignite call");
  }
});

/** DELETE /garage-admin/users/:userId/ignite-call/:id — soft detach. */
router.delete("/users/:userId/ignite-call/:id", superAdminOnly, async (req: Request, res: Response) => {
  try {
    const { userId, id } = req.params;
    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const updated = await IgniteCallModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { detachedAt: new Date() } },
      { new: true },
    ).lean();
    if (!updated) return res.status(404).json({ success: false, message: "Ignite call not found" });
    return res.json({ success: true, data: { id, detachedAt: updated.detachedAt } });
  } catch (err) {
    console.error("[garage-admin/ignite-call] detach error:", err);
    return res.status(500).json({ success: false, message: "Failed to detach Ignite call" });
  }
});

/** GET /garage-admin/users/:userId/ignite-calls — full history for the panel. */
router.get("/users/:userId/ignite-calls", adminOnly, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    if (!Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }
    const calls = await IgniteCallModel.find({ userId }).sort({ scheduledAt: -1 }).lean();
    const adminIds = [...new Set(calls.map((c) => String(c.adminId)))];
    const admins = await GarageAdminModel.find({ _id: { $in: adminIds } })
      .select("_id name email profilePicture")
      .lean();
    const adminById = new Map(admins.map((a) => [String(a._id), a]));

    return res.json({
      success: true,
      data: {
        calls: calls.map((c) => {
          const a = adminById.get(String(c.adminId));
          return {
            id: String(c._id),
            adminId: String(c.adminId),
            admin: a
              ? { name: a.name, email: a.email, profilePicture: (a as any).profilePicture ?? null }
              : null,
            ncScheduleId: c.ncScheduleId,
            ncRoomId: c.ncRoomId,
            title: c.title,
            scheduledAt: c.scheduledAt,
            detachedAt: c.detachedAt ?? null,
          };
        }),
      },
    });
  } catch (err) {
    console.error("[garage-admin/ignite-call] history error:", err);
    return res.status(500).json({ success: false, message: "Failed to load Ignite calls" });
  }
});

/** GET /garage-admin/ignite-call/:id/related — recordings, transcript, summary. */
router.get("/ignite-call/:id/related", adminOnly, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const call = await IgniteCallModel.findById(id).lean();
    if (!call) return res.status(404).json({ success: false, message: "Ignite call not found" });

    try {
      const related = await ncScheduleRelated(call.ncScheduleId);
      return res.json({ success: true, data: { call: { id: String(call._id), title: call.title }, related } });
    } catch (err) {
      // The schedule can be deleted in NetworkChains after we linked it. The
      // snapshot keeps the panel readable rather than showing a hard error.
      if (err instanceof NcMeetError && err.status === 404) {
        return res.json({
          success: true,
          data: {
            call: { id: String(call._id), title: call.title },
            related: null,
            unavailableReason: "This catch-up no longer exists in NetworkChains.",
          },
        });
      }
      throw err;
    }
  } catch (err) {
    return ncErrorResponse(res, err, "Failed to load related data");
  }
});

export default router;
```

- [ ] **Step 2: Mount the router**

In `src/app.ts`, beside `garageAdminOneTimeAffiliatesRoutes` (~line 480):

```ts
import garageAdminIgniteCallRoutes from "./routes/garageAdminIgniteCall";
// …
app.use("/garage-admin", garageAdminIgniteCallRoutes);
```

- [ ] **Step 3: Verify no router-level guard slipped in**

```bash
grep -n "router.use" src/routes/garageAdminIgniteCall.ts
```
Expected: **no output**. Any hit is the production-outage pattern from CLAUDE.md and must be replaced with per-route guards.

- [ ] **Step 4: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json
echo $?
```
Expected: exit code `0`.

- [ ] **Step 5: Commit**

```bash
git add src/routes/garageAdminIgniteCall.ts src/app.ts
git commit -m "Ignite call: attach/detach/history/related admin endpoints"
```

---

### Task 9: Enrich the affiliates list

**Files:**
- Modify: `src/routes/garageAdminOneTimeAffiliates.ts` (the row-building block, ~line 363-500)

**Interfaces:**
- Consumes: `IgniteCallModel` (Task 6); `newestLiveCall`, `enrichStatuses` (Task 7); `ncScheduleStatuses` (Task 6).
- Produces: an `igniteCall` field on every row of `GET /garage-admin/one-time-affiliates`, consumed by the frontend in Phase 3.

- [ ] **Step 1: Add the imports**

At the top of `src/routes/garageAdminOneTimeAffiliates.ts`, beside the existing model imports:

```ts
import { IgniteCallModel } from "../models/igniteCall.model";
import { newestLiveCall, enrichStatuses } from "../services/igniteCall.service";
import { ncScheduleStatuses } from "../lib/ncMeetClient";
```

- [ ] **Step 2: Load links and statuses for the page**

After the block that loads users and resolves `agentsById` (~line 376-380), and before rows are built, add:

```ts
    // ── Ignite call ────────────────────────────────────────────────────────
    // The link is ours; the live status belongs to NetworkChains. Both are
    // batched for the page, and the status lookup is fail-soft: if
    // NetworkChains is unreachable the column falls back to the stored
    // snapshot rather than failing the whole table.
    const affiliateIds = users.map((u: any) => String(u._id));
    const igniteCalls = await IgniteCallModel.find({
      userId: { $in: affiliateIds },
      detachedAt: null,
    })
      .sort({ scheduledAt: -1 })
      .lean();

    const callsByUser = new Map<string, any[]>();
    for (const c of igniteCalls) {
      const key = String(c.userId);
      const list = callsByUser.get(key);
      if (list) list.push(c);
      else callsByUser.set(key, [c]);
    }

    const liveByUser = new Map<string, any>();
    for (const [uid, list] of callsByUser) {
      const live = newestLiveCall(list);
      if (live) liveByUser.set(uid, live);
    }

    const statusById = await enrichStatuses(
      [...liveByUser.values()].map((c) => c.ncScheduleId),
      async (batch) => (await ncScheduleStatuses(batch)).statuses,
    );

    // Ignite-call agents also need a name — fold them into the same lookup the
    // Assigned To column already builds.
    for (const c of liveByUser.values()) agentIds.add(String(c.adminId));
```

Note: this line must come **before** the query that resolves `agentsById` from `agentIds`. If `agentsById` is already resolved at that point, move this loop above it.

- [ ] **Step 3: Add the field to each row**

Inside the `users.map(...)` that builds each row (~line 495), beside the `assignedTo` assignment, add:

```ts
          const ignite = liveByUser.get(String(u._id));
          const igniteAdmin = ignite ? agentsById.get(String(ignite.adminId)) : null;
          const igniteStatus = ignite ? statusById.get(ignite.ncScheduleId) : null;
```

and in the returned row object:

```ts
          igniteCall: ignite
            ? {
                id: String(ignite._id),
                adminId: String(ignite.adminId),
                admin: igniteAdmin
                  ? {
                      name: igniteAdmin.name ?? null,
                      email: igniteAdmin.email ?? null,
                      profilePicture: igniteAdmin.profilePicture ?? null,
                    }
                  : null,
                ncScheduleId: ignite.ncScheduleId,
                ncRoomId: ignite.ncRoomId,
                title: ignite.title,
                scheduledAt: ignite.scheduledAt,
                // Fall back to the snapshot when NetworkChains did not answer:
                // a linked call is at least "scheduled".
                status: igniteStatus?.status ?? "scheduled",
                startedAt: igniteStatus?.startedAt ?? null,
                endedAt: igniteStatus?.endedAt ?? null,
                historyCount: (callsByUser.get(String(u._id)) ?? []).length,
              }
            : null,
```

- [ ] **Step 4: Typecheck**

```bash
./node_modules/.bin/tsc --noEmit -p tsconfig.json
echo $?
```
Expected: exit code `0`.

- [ ] **Step 5: Verify the data path without booting the server**

Per CLAUDE.md, never boot the server (`.env` points at production). Exercise the compiled module directly:

```bash
npm run build 2>/dev/null || ./node_modules/.bin/tsc -p tsconfig.json
node -e "
const { newestLiveCall } = require('./dist/services/igniteCall.service');
const now = new Date();
console.log(newestLiveCall([
  { _id: 'a', scheduledAt: new Date('2026-09-01'), detachedAt: null },
  { _id: 'b', scheduledAt: new Date('2026-09-05'), detachedAt: null },
  { _id: 'c', scheduledAt: new Date('2026-09-09'), detachedAt: now },
])._id === 'b' ? 'OK: newest live call wins, detached ignored' : 'BROKEN');
"
```
Expected: `OK: newest live call wins, detached ignored`.

- [ ] **Step 6: Commit**

```bash
git add src/routes/garageAdminOneTimeAffiliates.ts
git commit -m "Ignite call: enrich One Time Affiliates rows with linked call + live status"
```

---

# Phase 3 — frontend

### Task 10: API layer

**Files:**
- Create: `lib/admin-api/ignite-call.ts`

**Interfaces:**
- Consumes: the Phase 2 endpoints; `garageAdminApi` from `@/lib/api`.
- Produces: types `IgniteStatus`, `IgniteCallSummary`, `AdminCatchup`, `IgniteCallRelated`; functions `listAdminCatchups`, `attachIgniteCall`, `detachIgniteCall`, `listIgniteCalls`, `getIgniteCallRelated`; and `IGNITE_STATUS_LABEL`.

- [ ] **Step 1: Write the module**

Create `lib/admin-api/ignite-call.ts`:

```ts
import { garageAdminApi } from "@/lib/api";

export type IgniteStatus = "not_scheduled" | "scheduled" | "started" | "completed";

/** The only place the wire enum becomes display text. */
export const IGNITE_STATUS_LABEL: Record<IgniteStatus, string> = {
  not_scheduled: "Not Scheduled",
  scheduled: "Scheduled",
  started: "Started",
  completed: "Completed",
};

export type IgniteCallAdmin = {
  name: string | null;
  email: string | null;
  profilePicture: string | null;
};

export type IgniteCallSummary = {
  id: string;
  adminId: string;
  admin: IgniteCallAdmin | null;
  ncScheduleId: string;
  ncRoomId: string;
  title: string;
  scheduledAt: string;
  status: IgniteStatus;
  startedAt: string | null;
  endedAt: string | null;
  historyCount: number;
};

export type AdminCatchup = {
  scheduleId: string;
  roomId: string;
  title: string;
  scheduledAt: string;
  startedAt: string | null;
  durationMinutes: number;
  timeZone: string | null;
  attendees: { email: string; displayName?: string }[];
};

export type IgniteCallRelated = {
  call: { id: string; title: string };
  related: {
    status: IgniteStatus;
    scheduledAt: string;
    startedAt: string | null;
    endedAt: string | null;
    schedule: { title: string; durationMinutes: number; timeZone?: string | null };
    sessions: {
      _id: string;
      startedAt: string;
      endedAt: string | null;
      durationSeconds?: number;
      participants?: { name?: string; identity?: string; isHost?: boolean }[];
    }[];
    recordings: {
      id: string;
      displayName?: string;
      size?: number;
      duration?: number;
      createdAt: string;
      url: string | null;
    }[];
    noteSessions: {
      _id: string;
      title?: string;
      startedAt: string;
      endedAt: string | null;
      status: string;
      participants?: { name?: string; email?: string }[];
      transcript: { text?: string; segments?: { speaker?: string; text: string }[] } | null;
      summary: { text?: string; bullets?: string[] } | null;
    }[];
  } | null;
  unavailableReason?: string;
};

/** Step 2 of the picker. `host: null` = this admin has no NetworkChains account. */
export function listAdminCatchups(adminId: string) {
  return garageAdminApi<{
    data: { host: { userId: string; name?: string; email?: string } | null; schedules: AdminCatchup[] };
  }>(`/garage-admin/admins/${encodeURIComponent(adminId)}/catchups`).then((r) => r.data);
}

export function attachIgniteCall(
  userId: string,
  body: {
    adminId: string;
    ncScheduleId?: string;
    createSchedule?: {
      title: string;
      scheduledAt: string;
      durationMinutes?: number;
      timeZone?: string;
      description?: string;
    };
  },
) {
  return garageAdminApi<{ data: IgniteCallSummary }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call`,
    { method: "POST", body: JSON.stringify(body) },
  ).then((r) => r.data);
}

export function detachIgniteCall(userId: string, id: string) {
  return garageAdminApi<{ data: { id: string } }>(
    `/garage-admin/users/${encodeURIComponent(userId)}/ignite-call/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  ).then((r) => r.data);
}

export function listIgniteCalls(userId: string) {
  return garageAdminApi<{
    data: {
      calls: (Omit<IgniteCallSummary, "status" | "startedAt" | "endedAt" | "historyCount"> & {
        detachedAt: string | null;
      })[];
    };
  }>(`/garage-admin/users/${encodeURIComponent(userId)}/ignite-calls`).then((r) => r.data.calls);
}

export function getIgniteCallRelated(id: string) {
  return garageAdminApi<{ data: IgniteCallRelated }>(
    `/garage-admin/ignite-call/${encodeURIComponent(id)}/related`,
  ).then((r) => r.data);
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
cd ~/dev/technsure/client/garage-web-app-nextjs-v1
npm run build
echo $?
./node_modules/.bin/tsc --noEmit 2>&1 | grep "lib/admin-api/ignite-call"
npx eslint lib/admin-api/ignite-call.ts
```
Expected: `npm run build` exits `0`; the grep prints **nothing** (this repo carries ~160 pre-existing tsc errors, so only your own files matter); eslint clean.

- [ ] **Step 3: Commit**

```bash
git add lib/admin-api/ignite-call.ts
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjeeb@garageuniversity.app" \
  commit -m "Ignite call: admin API layer"
```

---

### Task 11: The status cell and picker dialog

**Files:**
- Create: `components/garage-admin/ignite-call.tsx`

**Interfaces:**
- Consumes: everything from Task 10; `isSuperAdminClient` from `@/lib/admin-api/permissions`; `SearchableSelect` from `@/components/searchableSelect/searchable-select`.
- Produces: `IgniteCallCell`, `IgniteCallDialog`, and type `IgniteCallRow`.

Read `components/garage-admin/assign-agent.tsx` first — this component mirrors its structure (cell + dialog, super-admin gate, `AdminOption` list, `RoleChip`), and the admin list in step 1 of the picker should reuse the same `GET /garage-admin/admins` fetch and avatar rendering.

- [ ] **Step 1: Write the component**

Create `components/garage-admin/ignite-call.tsx`:

```tsx
"use client";

// Ignite call status — the column cell plus its two-step picker.
//
// Mirrors assign-agent.tsx: the cell renders read-only for non-super admins,
// and the dialog is the only place the link is created. The link itself lives
// on a neutral /garage-admin/users/:userId/ignite-call endpoint, so a second
// admin table can adopt this column without a new backend.

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, X, CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { garageAdminApi } from "@/lib/api";
import { isSuperAdminClient } from "@/lib/admin-api/permissions";
import { SearchableSelect } from "@/components/searchableSelect/searchable-select";
import {
  attachIgniteCall,
  listAdminCatchups,
  IGNITE_STATUS_LABEL,
  type AdminCatchup,
  type IgniteCallSummary,
  type IgniteStatus,
} from "@/lib/admin-api/ignite-call";

export type IgniteCallRow = {
  userId: string | null;
  igniteCall: IgniteCallSummary | null;
  user?: { name?: string | null; email?: string | null } | null;
};

const STATUS_STYLE: Record<IgniteStatus, string> = {
  not_scheduled: "border-white/10 bg-white/[0.06] text-white/50",
  scheduled: "border-[#FBD10D]/30 bg-[#FBD10D]/10 text-[#FBD10D]",
  started: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  completed: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

function StatusBadge({ status }: { status: IgniteStatus }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status]}`}
    >
      {IGNITE_STATUS_LABEL[status]}
    </span>
  );
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * The cell. Left-aligned like every other value in this admin panel.
 * The muted second line is the affordance the spec calls for: the call's
 * date with a `›`, opening the related-data panel.
 */
export function IgniteCallCell({
  row,
  onSchedule,
  onOpenRelated,
  canEdit,
}: {
  row: IgniteCallRow;
  onSchedule: (row: IgniteCallRow) => void;
  onOpenRelated: (row: IgniteCallRow) => void;
  canEdit: boolean;
}) {
  const call = row.igniteCall;
  const status: IgniteStatus = call?.status ?? "not_scheduled";

  if (!call) {
    if (!canEdit) return <StatusBadge status="not_scheduled" />;
    return (
      <button
        type="button"
        onClick={() => onSchedule(row)}
        className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-semibold text-white/70 transition hover:border-[#FBD10D]/40 hover:text-[#FBD10D]"
      >
        <CalendarPlus className="h-3 w-3" />
        Not Scheduled
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <StatusBadge status={status} />
      <button
        type="button"
        onClick={() => onOpenRelated(row)}
        className="flex items-center gap-0.5 text-left text-[11px] text-white/40 transition hover:text-white/70"
      >
        {whenLabel(call.scheduledAt)}
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

type AdminOption = {
  id: string;
  name: string | null;
  email: string;
  role?: string | null;
};

/**
 * Two steps: pick the admin conducting the call, then pick (or create) one of
 * their catch-ups. An admin with no NetworkChains account, or none scheduled,
 * is said out loud rather than shown as an empty list.
 */
export function IgniteCallDialog({
  subject,
  onClose,
  onSaved,
}: {
  subject: IgniteCallRow | null;
  onClose: () => void;
  onSaved: (userId: string, call: IgniteCallSummary) => void;
}) {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [adminId, setAdminId] = useState<string>("");
  const [catchups, setCatchups] = useState<AdminCatchup[] | null>(null);
  const [hostMissing, setHostMissing] = useState(false);
  const [loadingCatchups, setLoadingCatchups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "Ignite call", scheduledAt: "", durationMinutes: 60 });

  const open = !!subject;
  const canEdit = isSuperAdminClient();

  useEffect(() => {
    if (!open || !canEdit) return;
    setAdminId("");
    setCatchups(null);
    setHostMissing(false);
    setCreating(false);
    garageAdminApi<{ data: AdminOption[] }>("/garage-admin/admins")
      .then((r) => setAdmins(r.data ?? []))
      .catch(() => toast.error("Could not load admins"));
  }, [open, canEdit]);

  useEffect(() => {
    if (!adminId) return;
    setLoadingCatchups(true);
    setHostMissing(false);
    listAdminCatchups(adminId)
      .then((d) => {
        setHostMissing(d.host === null);
        setCatchups(d.schedules);
      })
      .catch((e) => toast.error(e?.message || "Could not load catch-ups"))
      .finally(() => setLoadingCatchups(false));
  }, [adminId]);

  const selectedAdmin = useMemo(
    () => admins.find((a) => a.id === adminId) ?? null,
    [admins, adminId],
  );

  if (!open || !subject?.userId) return null;

  async function save(body: Parameters<typeof attachIgniteCall>[1]) {
    if (!subject?.userId) return;
    setSaving(true);
    try {
      const call = await attachIgniteCall(subject.userId, body);
      onSaved(subject.userId, call);
      toast.success("Ignite call scheduled");
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Could not schedule the Ignite call");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[520px] max-w-[92vw] rounded-2xl border border-white/10 bg-[#111] p-5 text-white">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold">Schedule Ignite call</h2>
            <p className="text-xs text-white/50">
              {subject.user?.name || subject.user?.email || "This affiliate"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1 — who is conducting it */}
        <label className="mb-1 block text-xs font-semibold text-white/60">
          Admin conducting the call
        </label>
        {/* The shared searchable-select is the only dropdown template in this
            app. Its options are {value,label} ONLY — no description field — so
            the role is folded into the label. */}
        <SearchableSelect
          value={adminId}
          onValueChange={setAdminId}
          placeholder="Select an admin"
          searchPlaceholder="Search admins…"
          options={admins.map((a) => ({
            value: a.id,
            label: a.role
              ? `${a.name || a.email} · ${a.role}`
              : a.name || a.email,
          }))}
        />

        {/* Step 2 — which of their catch-ups */}
        {adminId && (
          <div className="mt-4">
            <label className="mb-1 block text-xs font-semibold text-white/60">Catch-up</label>

            {loadingCatchups && (
              <div className="flex items-center gap-2 py-3 text-xs text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading catch-ups…
              </div>
            )}

            {!loadingCatchups && hostMissing && (
              <p className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">
                {selectedAdmin?.name || "This admin"} has no NetworkChains account, so they
                have no catch-ups. Pick a different admin.
              </p>
            )}

            {!loadingCatchups && !hostMissing && catchups?.length === 0 && !creating && (
              <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-white/60">
                  {selectedAdmin?.name || "This admin"} has no upcoming catch-ups.
                </p>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-2 text-xs font-semibold text-[#FBD10D] hover:underline"
                >
                  Schedule a new catch-up
                </button>
              </div>
            )}

            {!loadingCatchups && !creating && !!catchups?.length && (
              <>
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {catchups.map((c) => (
                    <button
                      key={c.scheduleId}
                      type="button"
                      disabled={saving}
                      onClick={() => save({ adminId, ncScheduleId: c.scheduleId })}
                      className="flex w-full flex-col items-start rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left transition hover:border-[#FBD10D]/40 disabled:opacity-50"
                    >
                      <span className="text-xs font-semibold">{c.title}</span>
                      <span className="text-[11px] text-white/50">
                        {whenLabel(c.scheduledAt)} · {c.durationMinutes} min
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="mt-2 text-xs font-semibold text-[#FBD10D] hover:underline"
                >
                  Schedule a new catch-up instead
                </button>
              </>
            )}

            {creating && (
              <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.04] p-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Title"
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={form.durationMinutes}
                  onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
                />
                <p className="text-[11px] text-white/40">
                  Created on {selectedAdmin?.name || "the admin"}&apos;s NetworkChains account,
                  in your browser&apos;s timezone, with this affiliate already invited.
                </p>
                <button
                  type="button"
                  disabled={saving || !form.scheduledAt}
                  onClick={() =>
                    save({
                      adminId,
                      createSchedule: {
                        title: form.title || "Ignite call",
                        scheduledAt: new Date(form.scheduledAt).toISOString(),
                        durationMinutes: form.durationMinutes,
                        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      },
                    })
                  }
                  className="w-full rounded-md bg-[#FBD10D] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {saving ? "Scheduling…" : "Create and attach"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
npm run build
echo $?
./node_modules/.bin/tsc --noEmit 2>&1 | grep "garage-admin/ignite-call"
npx eslint components/garage-admin/ignite-call.tsx
```
Expected: `npm run build` exits `0`; the grep prints **nothing**; eslint clean.

- [ ] **Step 3: Commit**

```bash
git add components/garage-admin/ignite-call.tsx
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjeeb@garageuniversity.app" \
  commit -m "Ignite call: status cell + two-step picker dialog"
```

---

### Task 12: The related-data panel, and wiring the column in

**Files:**
- Create: `components/garage-admin/IgniteCallDrawer.tsx`
- Modify: `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`

**Interfaces:**
- Consumes: Tasks 10 and 11.
- Produces: the finished column.

- [ ] **Step 1: Write the drawer**

Create `components/garage-admin/IgniteCallDrawer.tsx`. Copy the portal + `framer-motion` shell verbatim from `components/garage-admin/AffiliateMemberDrawer.tsx` (`createPortal`, `AnimatePresence`, the `fixed inset-0 z-[110] … justify-end` backdrop), then render this content:

```tsx
"use client";

// Related data for one affiliate's Ignite call — opened from the muted
// "date ›" line under the status badge. Lists everything a catch-up produced:
// recordings, note-taker transcript and AI summary, sessions and participants.
// Earlier calls for the same affiliate are listed below, collapsed.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";

import {
  getIgniteCallRelated,
  listIgniteCalls,
  IGNITE_STATUS_LABEL,
  type IgniteCallRelated,
} from "@/lib/admin-api/ignite-call";

export function IgniteCallDrawer({
  userId,
  callId,
  personName,
  onClose,
}: {
  userId: string | null;
  callId: string | null;
  personName: string | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<IgniteCallRelated | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listIgniteCalls>>>([]);
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(callId);

  useEffect(() => setActiveId(callId), [callId]);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    getIgniteCallRelated(activeId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [activeId]);

  useEffect(() => {
    if (!userId) return;
    listIgniteCalls(userId).then(setHistory).catch(() => setHistory([]));
  }, [userId]);

  if (typeof document === "undefined") return null;
  const open = !!callId;
  const r = data?.related ?? null;

  const body = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-end bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="h-full w-[520px] max-w-[92vw] overflow-y-auto border-l border-white/10 bg-[#0d0d0d] p-5 text-white"
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold">Ignite call</h2>
                <p className="text-xs text-white/50">{personName || "Affiliate"}</p>
              </div>
              <button type="button" onClick={onClose} className="text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {loading && (
              <div className="flex items-center gap-2 py-6 text-xs text-white/50">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading related data…
              </div>
            )}

            {!loading && data?.unavailableReason && (
              <p className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-white/60">
                {data.unavailableReason}
              </p>
            )}

            {!loading && r && (
              <>
                <Section title="Call">
                  <Field label="Status" value={IGNITE_STATUS_LABEL[r.status]} />
                  <Field label="Scheduled" value={fmt(r.scheduledAt)} />
                  <Field label="Started" value={r.startedAt ? fmt(r.startedAt) : "—"} />
                  <Field label="Ended" value={r.endedAt ? fmt(r.endedAt) : "—"} />
                </Section>

                <Section title={`Recordings (${r.recordings.length})`}>
                  {r.recordings.length === 0 && <Empty>No recording for this call.</Empty>}
                  {r.recordings.map((rec) => (
                    <div key={rec.id} className="mb-3">
                      {rec.url ? (
                        <video src={rec.url} controls className="w-full rounded-lg border border-white/10" />
                      ) : (
                        <Empty>Recording is still processing.</Empty>
                      )}
                      <p className="mt-1 text-[11px] text-white/40">
                        {rec.displayName || "Recording"} · {fmt(rec.createdAt)}
                      </p>
                    </div>
                  ))}
                </Section>

                <Section title="Note taker">
                  {r.noteSessions.length === 0 && <Empty>No note-taker session for this call.</Empty>}
                  {r.noteSessions.map((n) => (
                    <div key={n._id} className="mb-4">
                      <p className="mb-1 text-xs font-semibold">{n.title || "Session"}</p>
                      {n.summary ? (
                        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
                          <p className="mb-1 font-semibold text-white/50">AI summary</p>
                          {n.summary.text}
                          {n.summary.bullets?.map((b, i) => <li key={i} className="ml-4 list-disc">{b}</li>)}
                        </div>
                      ) : (
                        <Empty>No AI summary.</Empty>
                      )}
                      {n.transcript ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-white/50">Transcript</summary>
                          <div className="mt-1 whitespace-pre-wrap text-xs text-white/60">
                            {n.transcript.segments
                              ? n.transcript.segments.map((s, i) => (
                                  <p key={i}>
                                    <span className="text-white/40">{s.speaker ?? "—"}: </span>
                                    {s.text}
                                  </p>
                                ))
                              : n.transcript.text}
                          </div>
                        </details>
                      ) : (
                        <Empty>No transcript.</Empty>
                      )}
                    </div>
                  ))}
                </Section>

                <Section title={`Sessions (${r.sessions.length})`}>
                  {r.sessions.length === 0 && <Empty>Nobody joined this call.</Empty>}
                  {r.sessions.map((s) => (
                    <div key={s._id} className="mb-2 text-xs text-white/60">
                      {fmt(s.startedAt)} → {s.endedAt ? fmt(s.endedAt) : "live"}
                      {!!s.participants?.length && (
                        <span className="text-white/40">
                          {" "}· {s.participants.map((p) => p.name || p.identity).join(", ")}
                        </span>
                      )}
                    </div>
                  ))}
                </Section>
              </>
            )}

            {history.length > 1 && (
              <Section title="Earlier Ignite calls">
                {history
                  .filter((h) => h.id !== activeId)
                  .map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setActiveId(h.id)}
                      className="mb-1 block w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs hover:border-[#FBD10D]/40"
                    >
                      {h.title} · {fmt(h.scheduledAt)}
                      {h.detachedAt && <span className="text-white/40"> · detached</span>}
                    </button>
                  ))}
              </Section>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/40">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5 text-xs">
      <span className="text-white/40">{label}</span>
      <span className="text-white/80">{value}</span>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-white/40">{children}</p>;
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  });
}
```

- [ ] **Step 2: Add the row field and imports to the page**

In `app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx`:

Add to the `Row` type (beside `assignedTo`, ~line 68):

```ts
  igniteCall: IgniteCallSummary | null;
```

Add the imports:

```ts
import { IgniteCallCell, IgniteCallDialog } from "@/components/garage-admin/ignite-call";
import { IgniteCallDrawer } from "@/components/garage-admin/IgniteCallDrawer";
import { IGNITE_STATUS_LABEL, type IgniteCallSummary } from "@/lib/admin-api/ignite-call";
```

- [ ] **Step 3: Add the dialog and drawer state**

Beside the existing dialog state in the page component:

```ts
  const [igniteSubject, setIgniteSubject] = useState<Row | null>(null);
  const [igniteRelated, setIgniteRelated] = useState<Row | null>(null);
```

Render both, beside the existing `AssignAgentDialog`:

```tsx
      <IgniteCallDialog
        subject={igniteSubject}
        onClose={() => setIgniteSubject(null)}
        onSaved={(userId, call) =>
          setRows((prev) =>
            prev.map((r) => (r.userId === userId ? { ...r, igniteCall: call } : r)),
          )
        }
      />
      <IgniteCallDrawer
        userId={igniteRelated?.userId ?? null}
        callId={igniteRelated?.igniteCall?.id ?? null}
        personName={igniteRelated?.user?.name ?? null}
        onClose={() => setIgniteRelated(null)}
      />
```

(The page's row state setter is `setRows`, declared at page.tsx:191.)

- [ ] **Step 4: Wire detach into the drawer**

`DELETE /garage-admin/users/:userId/ignite-call/:id` exists (Task 8) but nothing reaches it yet — without this the operator can attach a wrong catch-up and never undo it.

In `IgniteCallDrawer`, accept two more props:

```tsx
  canEdit: boolean;
  onDetached: (userId: string) => void;
```

and render this at the bottom of the "Call" section, for super admins only:

```tsx
{canEdit && activeId && userId && (
  <button
    type="button"
    onClick={async () => {
      if (!window.confirm("Detach this Ignite call? It stays in history.")) return;
      try {
        await detachIgniteCall(userId, activeId);
        onDetached(userId);
        onClose();
      } catch (e: any) {
        toast.error(e?.message || "Could not detach the Ignite call");
      }
    }}
    className="mt-2 text-[11px] font-semibold text-red-400 hover:underline"
  >
    Detach this call
  </button>
)}
```

Import `detachIgniteCall` from `@/lib/admin-api/ignite-call` and `toast` from `sonner`. Detach is soft — the call stays in history, and the row falls back to the next-newest live call (or `Not Scheduled`) on reload.

Pass the props from the page:

```tsx
        canEdit={canAssign}
        onDetached={(userId) =>
          setRows((prev) =>
            prev.map((r) => (r.userId === userId ? { ...r, igniteCall: null } : r)),
          )
        }
```

- [ ] **Step 5: Add the column**

In the `columns` memo, between `assignedTo` (~line 948-955) and `joining` (~line 956):

```tsx
    {
      id: "igniteCall",
      header: "Ignite Call Status",
      width: 200,
      minWidth: 180,
      cell: (r) => (
        <IgniteCallCell
          row={r}
          canEdit={canAssign}
          onSchedule={setIgniteSubject}
          onOpenRelated={setIgniteRelated}
        />
      ),
      skeleton: (
        <div className="flex flex-col gap-1">
          <div className="h-4 w-24 rounded bg-white/10" />
          <div className="h-3 w-16 rounded bg-white/5" />
        </div>
      ),
    },
```

Deliberately **not** `sortable` and **not** `filterable` — see the spec. `assignedTo` is the same, for the same reason: this table paginates server-side and the status is not something garagenew can order the full result set by.

- [ ] **Step 6: Add the CSV column**

In `CSV_COLUMNS` (~line 152), after the Assigned-To entries:

```ts
  {
    header: "Ignite Call Status",
    accessor: (r) => IGNITE_STATUS_LABEL[r.igniteCall?.status ?? "not_scheduled"],
  },
  { header: "Ignite Call Admin", accessor: (r) => r.igniteCall?.admin?.name ?? "" },
  { header: "Ignite Call Date", accessor: (r) => isoDate(r.igniteCall?.scheduledAt) },
```

- [ ] **Step 7: Build and lint**

```bash
npm run build
echo $?
./node_modules/.bin/tsc --noEmit 2>&1 | grep -E "ignite-call|IgniteCallDrawer|one-time-affiliates"
npx eslint components/garage-admin/IgniteCallDrawer.tsx components/garage-admin/ignite-call.tsx \
  "app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx"
```
Expected: `npm run build` exits `0`; the grep prints **nothing**; eslint clean.

- [ ] **Step 8: Verify the column renders**

Start the dev server and load the page:

```bash
npm run dev
```
Open `http://localhost:3000/garage-admin/one-time-affiliates`, sign in as a super admin, and confirm:
- The "Ignite Call Status" column sits between "Assigned To" and "Joining Date".
- Every row reads **Not Scheduled** (the table starts with no links).
- The badge and its text are **left-aligned**, like every other value.
- Clicking "Not Scheduled" opens the picker; picking an admin lists their catch-ups, or says they have none.

This needs `GARAGE_SERVICE_TOKEN` set on both backends. Without it the picker will surface a 503 — that is the expected unconfigured behaviour, not a bug in this task.

- [ ] **Step 9: Commit**

```bash
git add components/garage-admin/IgniteCallDrawer.tsx \
        "app/garage-admin/(admin-dashboard)/one-time-affiliates/page.tsx"
git -c user.name="Chiranjeeb Jena" -c user.email="chiranjeeb@garageuniversity.app" \
  commit -m "Ignite call: related-data drawer + wire the column into One Time Affiliates"
```

---

## Deployment

1. Generate one shared secret. Set it as `GARAGE_SERVICE_TOKEN` on **both** Railway services (contacts-backend and garagenew-backend). Set `NC_BACKEND_URL` on garagenew-backend if it is not already present.
2. Deploy contacts-backend **first** — garagenew's enrichment calls it. Per that repo's CLAUDE.md: `git checkout origin/master -- dist` on the pm2 VM, then `pm2 restart contacts-backend --update-env`.
3. Deploy garagenew-backend, then the web app.

Until step 1 is done, contacts-backend returns 503 and the column reads its snapshot everywhere — degraded, not broken. There is no migration: `IgniteCall` starts empty and every affiliate correctly reads `Not Scheduled`.
