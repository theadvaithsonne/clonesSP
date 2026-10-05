# Module RBAC API

Lets a **founder** delegate admin control of individual product modules to specific employees, without making them a founder.

Two rules define the whole system:

1. **A grant is an offer, not an act.** Granting a module creates a *pending grant*. The member's access does not change until they accept. Unanswered, it expires **24 hours** after creation.
2. **A revoke is an act, not an offer.** Revoking applies immediately. Nobody accepts losing access.

Base path: `/rbac` · Auth: `Authorization: Bearer <jwt>` · Org scope: `?orgId=` query param on every founder endpoint.

---

## Concepts

### Modules

Access is **binary per module** — you are an admin of it or you are not. There is no viewer or editor tier.

| Key | Label |
|---|---|
| `community` | Community |
| `courses` | Courses |
| `live_streams` | Live Streams |
| `digital_products` | Digital Products |

Defined in [`src/config/rbacModules.ts`](src/config/rbacModules.ts). Adding a module is three lines: `RBAC_MODULES`, `MODULE_LABELS`, and the boolean in the `modulePermissions` sub-schema in `src/models/user.model.ts`. Routes, validation and the permission table are all driven off `RBAC_MODULES` and need no change.

Never hardcode this list client-side — read `GET /rbac/modules`.

### Who can be assigned

Only members where **`role !== "founder"` and `guest !== true`**.

- **Founders** already have everything. They appear in the table with `editable: false` so the UI can render them as locked rows.
- **Guests** are outside the employee permission model and are **excluded from the table entirely**.
- Founders cannot change **their own** permissions.

### Founder bypass

Founders — and stakeholders holding the legacy `fullAccess` flag — pass every module check regardless of what `modulePermissions` says. `GET /rbac/me` reports them as `isFounder: true` with all modules `true`, so the client can gate on a single field.

### Grant lifecycle

```
                    ┌──────────► accepted   (member said yes — permission is live)
                    │
POST /rbac/grants ──┼──► pending ┼──► declined  (member said no)
   (action:"grant") │            │
                    │            ├──► expired   (24h elapsed, no response)
                    │            │
                    │            └──► cancelled (founder withdrew, or revoked the module)
                    │
DELETE .../permissions/:module ──► applied  (action:"revoke" — took effect instantly)
```

Rows are **never deleted**. Expiry flips a status, so the full history of who granted what — and whether it was taken up — survives as the audit trail (`GET /rbac/grants`).

At most **one live offer** per `(org, member, module)`, enforced by a partial unique index.

---

## Endpoints

### Catalog

#### `GET /rbac/modules`
Auth: any authenticated user.

```json
{ "success": true, "data": { "modules": [ { "key": "community", "label": "Community" } ] } }
```

---

### Member-facing

These are for the person *receiving* permissions. Auth: any authenticated user; the caller must be the grant's target.

#### `GET /rbac/me?orgId=`
The caller's effective permissions. This is what the client gates on.

```json
{
  "success": true,
  "data": {
    "orgId": "...",
    "role": "stakeholder",
    "isFounder": false,
    "guest": false,
    "permissions": { "community": false, "courses": true, "live_streams": false, "digital_products": false },
    "pendingCount": 1
  }
}
```
`orgId` falls back to the token's org if omitted. `403` if the caller is not a member.

#### `GET /rbac/my-grants?orgId=`
Offers awaiting my response — drives the inbox badge. `orgId` optional; omit for all orgs.

```json
{
  "success": true,
  "data": {
    "grants": [{
      "grantId": "...", "orgId": "...", "orgName": "Thirdwave",
      "module": "courses", "moduleLabel": "Courses",
      "expiresAt": "2026-08-20T09:00:00.000Z",
      "createdAt": "2026-08-19T09:00:00.000Z",
      "grantedBy": { "id": "...", "name": "Rhea Kapoor", "email": "...", "profilePicture": "..." }
    }]
  }
}
```

#### `POST /rbac/grants/:grantId/accept`
**The moment access turns on.** Writes `modulePermissions[module] = true`.

`200` → `{ "grantId": "...", "module": "courses", "status": "accepted" }`

| Code | Meaning |
|---|---|
| `403` | The grant is not yours |
| `404` | No such grant |
| `409 GRANT_NOT_PENDING` | Already accepted / declined / cancelled |
| `410 GRANT_EXPIRED` | The 24h window closed |

Expiry is checked **lazily on this path**, so a stalled sweeper can never leak access.

#### `POST /rbac/grants/:grantId/decline`
Same responses. Nothing changes except the grant's status.

---

### Founder-facing — the permission table

All require founder status in `?orgId=` (`requireOrgAdmin`). Non-founders get `403`.

#### `GET /rbac/members?orgId=`

The table. Query params:

| Param | Notes |
|---|---|
| `search` | Case-insensitive match on name or email |
| `module` | Filter by one module key |
| `granted` | With `module`: `"false"` for members *without* it; anything else means with it |
| `page`, `limit` | Default `1` / `50`, max `200` |

```json
{
  "success": true,
  "data": {
    "rows": [{
      "userId": "...", "name": "Arjun Menon", "email": "arjun@thirdwave.co",
      "profilePicture": "...", "role": "stakeholder",
      "permissions": { "community": false, "courses": true, "live_streams": false, "digital_products": false },
      "pending": { "live_streams": { "grantId": "...", "expiresAt": "2026-08-20T09:00:00.000Z" } },
      "editable": true,
      "isSelf": false
    }],
    "modules": [{ "key": "community", "label": "Community" }],
    "page": 1, "limit": 50, "total": 7, "hasMore": false
  }
}
```

- `permissions` — what they actually have **now**.
- `pending` — live offers, so a cell can render "awaiting acceptance". Only populated for the returned page.
- `editable: false` → founder; render locked. Guests never appear.

#### `GET /rbac/members/:userId?orgId=`
One member, plus their last 100 grant/revoke events under `history`. Adds `guest` to the row shape.

---

### Founder-facing — granting

#### `POST /rbac/grants?orgId=`
Offer modules to one member. **Does not change their access.**

```json
{ "userId": "665...", "modules": ["courses", "community"] }
```

```json
{
  "success": true,
  "data": {
    "created":       [{ "grantId": "...", "module": "courses", "expiresAt": "...", "status": "pending" }],
    "alreadyPending":[{ "grantId": "...", "module": "community", "expiresAt": "..." }],
    "skipped":       [{ "userId": "...", "module": "...", "reason": "ALREADY_GRANTED" }]
  }
}
```

**Idempotent.** Re-offering a module that already has a live grant returns it under `alreadyPending` with its clock **untouched** — use `/resend` to extend. A module the member already holds lands in `skipped` as `ALREADY_GRANTED`.

| Code | Meaning |
|---|---|
| `400 SELF_ASSIGN` | You cannot assign to yourself |
| `400 NOT_ASSIGNABLE` | Target is a founder or a guest |
| `400` | Unknown module, or malformed body |
| `404 NOT_A_MEMBER` | Target is not in this org |

#### `POST /rbac/grants/bulk?orgId=`
Same offer to many members — the checkbox column.

```json
{ "userIds": ["665...", "666..."], "modules": ["live_streams"] }
```

**Never fails wholesale.** Ineligible members come back in `skipped`; eligible ones still get their grants.

```json
{ "success": true, "data": { "created": [{ "userId": "...", "grantId": "...", "module": "live_streams", "expiresAt": "..." }], "skipped": [{ "userId": "...", "reason": "NOT_ASSIGNABLE" }], "createdCount": 1 } }
```

Skip reasons: `NOT_A_MEMBER`, `NOT_ASSIGNABLE`, `SELF_ASSIGN`, `ALREADY_GRANTED`.

#### `POST /rbac/grants/:grantId/resend?orgId=`
Restart the 24h clock. Also **revives an expired grant** — that is the point of the endpoint.

`409 GRANT_NOT_PENDING` if already accepted/declined/cancelled. `409 GRANT_ALREADY_PENDING` if reviving would collide with a newer live offer for the same module.

#### `DELETE /rbac/grants/:grantId?orgId=`
Withdraw an offer before it is answered → `status: "cancelled"`. `409` if it is not pending.

---

### Founder-facing — revoking (immediate)

No acceptance step. Any live offer for the same module is cancelled too, so a revoke cannot leave a pending grant behind that the member could later accept to undo it.

#### `DELETE /rbac/members/:userId/permissions/:module?orgId=`
```json
{ "success": true, "data": { "userId": "...", "revoked": ["courses"], "cancelledPending": 0 } }
```

#### `DELETE /rbac/members/:userId/permissions?orgId=`
Revoke everything. Only touches modules they actually hold, so the audit trail does not fill with no-op revokes.

Both return `400 SELF_ASSIGN` / `400 NOT_ASSIGNABLE` / `404` on the same rules as granting.

---

### Founder-facing — audit trail

#### `GET /rbac/grants?orgId=`
Every grant and revoke ever made in this org.

Filters: `status`, `action` (`grant` | `revoke`), `module`, `userId`, `page`, `limit`.

```json
{
  "success": true,
  "data": {
    "grants": [{
      "grantId": "...", "module": "courses", "moduleLabel": "Courses",
      "action": "grant", "status": "accepted",
      "expiresAt": "...", "respondedAt": "...", "createdAt": "...",
      "member":    { "id": "...", "name": "Arjun Menon", "email": "...", "profilePicture": "..." },
      "grantedBy": { "id": "...", "name": "Rhea Kapoor", "email": "..." }
    }],
    "page": 1, "limit": 50, "total": 12, "hasMore": false
  }
}
```

---

## Other surfaces

### `GET /auth/me`
Each entry in `user.organizations[]` now carries `modulePermissions`:

```jsonc
{
  "id": "...", "name": "Thirdwave", "role": "stakeholder", "fullAccess": false,
  "modulePermissions": { "community": false, "courses": true, "live_streams": false, "digital_products": false },
  "joinedAt": "...", "guest": false
}
```
Always all-keys-present. **Check `role` / `fullAccess` first** — founders bypass the map and it stays all-`false` for them.

### Notifications
Accepting a grant is prompted by a `UserNotification` of type `permission_grant`, surfaced through the existing `/user-notifications` endpoints, carrying `grantId`, `grantModule`, `grantModuleLabel`, `grantExpiresAt`, `grantedByName`. A notification failure never fails the grant — the member can still find it via `GET /rbac/my-grants`.

---

## Where permissions are enforced

Each module's route file had an identical file-local `isUserFounder(userId, orgId)` helper that every founder gate in that file called. Those helpers now delegate to `isFounderOrModuleAdmin(userId, orgId, <module>)`, so **every gate in the file inherits module admin at once** — no route can be missed.

| Route file | Prefix(es) | Module |
|---|---|---|
| `src/routes/feed.ts` | `/feed` | `community` |
| `src/routes/course.ts` | `/courses` | `courses` |
| `src/routes/workshop.ts` | `/workshops` | `live_streams` |
| `src/routes/product.ts` | `/products` | `digital_products` |

A granted member becomes founder-equivalent **inside that module only** — creating, updating, deleting, and the founder-only read views (order lists, enrollments, stats). Cross-module access does not leak: a `courses` admin still gets `403` from `/products`.

This is a **strict relaxation** and cannot regress anyone. `isFounderOrModuleAdmin` preserves both branches the old helpers had (legacy single-org `admin`/`founder`, and `hasFounderAccess` on the membership) and only adds the module grant on top — so every founder and `fullAccess` holder who could reach a route before still can.

**Not enforced** (still founder-only): `standaloneVideo.ts`, `drops.ts`, `playlist.ts`, `webinarRoutes.ts`. The first three back the "Content" surface, which is not one of the four modules; `webinarRoutes.ts` gates on recording ownership rather than a founder helper.

### Adding a gate to a new route

For routes running after `requireAuth`, prefer the middleware — it reuses the membership already on the request instead of re-querying:

```ts
import { requireModuleAdmin, canModule } from "../middleware/rbac";

router.post("/", requireAuth, requireModuleAdmin("courses"), handler)
```

`canModule(req, module)` is the boolean form for handlers that branch rather than reject. It is only valid for the token's own org — a cross-org check needs `requireModuleAdmin`, which can query.

`403` body: `{ "success": false, "message": "...", "code": "MODULE_ACCESS_REQUIRED", "module": "courses" }`

Note the two guards return **different error shapes**: the retrofitted helpers keep each file's original `{ "error": "Only founders can create products" }` wording, while `requireModuleAdmin` returns the `MODULE_ACCESS_REQUIRED` envelope above.

---

## Implementation notes

**Reading permissions.** Always go through `normalizePermissions()` in [`src/utils/rbac.ts`](src/utils/rbac.ts), never `membership.modulePermissions` directly. Most read paths use `.lean()`, and Mongoose does not apply schema defaults to lean results — so the field is `undefined` on every document written before this feature shipped.

**Expiry.** A sweeper in `src/index.ts` runs every 30 minutes flipping lapsed grants to `expired`. It is **housekeeping, not enforcement**: every read and accept path checks `expiresAt` inline, so a stalled cron can leave stale-looking rows in the founder's list but cannot leak access.

**Storage.** Permissions live on `user.organizations[].modulePermissions`; grants live in the `permissiongrants` collection.

**Not touched by this system:** the `/invites` org-invite flow, Teamforce's separate `teamforceRole`, and the `fullAccess` flag (honoured as a bypass, never written).

### Files

| Path | Role |
|---|---|
| `src/config/rbacModules.ts` | Module catalog, 24h TTL |
| `src/utils/rbac.ts` | `normalizePermissions`, `isModuleAdmin`, `isAssignable`, `findMembership`, `isFounderOrModuleAdmin` |
| `src/models/permissionGrant.model.ts` | Grant queue + audit trail |
| `src/services/permissionGrant.ts` | Grant lifecycle (create/accept/decline/revoke/expire) |
| `src/routes/rbac.ts` | All endpoints above |
| `src/middleware/rbac.ts` | `requireModuleAdmin`, `canModule` |
