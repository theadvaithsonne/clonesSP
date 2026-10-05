# Admin notification rules — dynamic conditions, dynamic recipients

**Status:** design / approved, not yet planned
**Date:** 2026-09-11
**Surface:** Garage Admin → Notifications

## 1. Goal

Let a garage admin define, without a deploy: **when** to send mail and **who
receives it**. Both sides are configured, not coded.

The driving example, stated by the requester:

> when a customer signs up under `shorupan@gmail.com`, but *not* under
> `anuragm807@gmail.com` in the downline

That single sentence sets the bar: conditions must compose (include a subtree,
exclude a subtree inside it), and the requester confirmed both the event set
and the recipient set must be **"dynamic, any"** — so neither can be a
hardcoded enum.

## 2. Current state (verified, not assumed)

| Thing | Where | State |
|---|---|---|
| Denormalized ancestor path | `user.model.ts:227` — `ancestors[]`, `depth`, `legNumber` | shipped |
| "Is X in Y's downline" | `services/affiliate.ts:222` `isInMyDownline()` | shipped |
| Choke point for every signup | `user.model.ts:388+` post-hook on `referredBy` | shipped |
| Per-product email config (prior art) | `models/emailAlerts.schema.ts` | shipped |
| Mail transport | `services/mailer.ts` | shipped |
| In-app notifications | `models/notification.model.ts` | shipped, user-facing only |
| General event bus | — | **does not exist** |

Two facts shape the whole design:

- **`ancestors[]` already exists.** "In X's downline" is an indexed equality
  match (`ancestors: xId`), not a `$graphLookup`. The hard part of the
  requester's example is already solved by existing data.
- **`referredBy` is written from nine-plus places.** `user.model.ts:388`
  documents the history: only four signup paths had explicit hooks, and the
  other five (guestAuth stakeholder branch, `org.ts` ×2, `profile.ts` ×2,
  `invoice.ts`, and the course/workshop/channel checkouts via `setReferredBy`)
  silently skipped downline slotting. A post-hook was added as defence in
  depth. **Any new emit must use that hook, not the call sites**, or it
  reintroduces exactly the bug the hook exists to prevent.

## 3. Scope

**In**
- An event registry any part of the codebase can publish to.
- Per-rule conditions over an event's payload, composable with AND/OR/NOT.
- Per-rule recipient resolution, static or derived from the event.
- Admin UI to build, test, enable and audit rules.

**Out (for now)**
- Channels other than email (push, SMS, Slack, in-app).
- Per-office rules authored by founders — see §9.1.
- Digests / batching. Every rule sends per event.
- Editing mail templates. Rules select an existing Network Mail template.

## 4. Design

### 4.1 Event registry

One publish call, `emitAdminEvent(name, payload)`. Each event registers a
descriptor alongside it:

```ts
registerEvent({
  name: "user.signup",
  label: "Customer signs up",
  fields: [
    { key: "user",    type: "user"   },
    { key: "sponsor", type: "user"   },
    { key: "country", type: "string" },
    { key: "source",  type: "enum", values: ["signup", "invite", "checkout"] },
  ],
});
```

The descriptor is the contract between three consumers that would otherwise
drift: the emitter, the condition evaluator, and the UI's condition builder.
The admin UI fetches the registry from `GET /garage-admin/notifications/events`
and renders inputs from `type`, so **adding an event requires no change to the
rule engine and no change to the UI.** That is what "dynamic events" means
here — the catalogue grows without touching either consumer.

The registry lives in code, not the database: a payload's shape is code, and a
DB-defined event could describe fields no emitter produces.

**Emit points.** `user.signup` emits from the `referredBy` post-hook
(`user.model.ts:388+`). Emission is fire-and-forget and wrapped — a
notification failure must never fail a signup.

### 4.2 Conditions

A rule holds a boolean tree evaluated against the event payload:

```json
{ "all": [
    { "field": "user", "op": "inDownlineOf", "value": "<shorupan userId>" },
    { "not": { "field": "user", "op": "inDownlineOf", "value": "<anuragm807 userId>" } }
]}
```

Nodes are `{all:[…]}`, `{any:[…]}`, `{not:…}`, or a leaf
`{field, op, value}`. Operators are offered per field `type`:

| Field type | Operators |
|---|---|
| `user` | `inDownlineOf`, `isDirectOf`, `is`, `hasTypeFlag` |
| `string` | `equals`, `contains`, `in` |
| `number` | `eq`, `gt`, `gte`, `lt`, `lte` |
| `enum` | `equals`, `in` |
| `boolean` | `isTrue`, `isFalse` |

`inDownlineOf` resolves through `ancestors[]`. Rules store **user ids**, not
email addresses; the UI accepts an email and resolves it on save, so a later
email change cannot silently break a rule.

Evaluation is pure and synchronous over a context object hydrated once per
event (the subject user with `ancestors`, the sponsor, the office). Pure
evaluation is what makes §4.5's dry run possible and unit-testable.

### 4.3 Recipients

An ordered list of resolver specs, each resolved at send time, then flattened,
lowercased and deduped:

| Spec | Resolves to |
|---|---|
| `{type:"static", emails:[…]}` | literal addresses |
| `{type:"relation", relation:"sponsor"\|"upline"\|"officeOwner"\|"subject"}` | looked up per event |
| `{type:"role", role:"super-admin"\|…}` | current holders of that role |
| `{type:"query", filter:{…}, cap:N}` | everyone matching, capped |

`relation` is what makes recipients dynamic in the same sense as events: the
rule stores the *relationship*, the address is resolved per event.

`query` is the dangerous one and is treated as such — a mandatory `cap`, a
count preview before save, and a hard ceiling enforced server-side regardless
of what the UI sent.

### 4.4 Delivery

Reuses `mailer.ts` and the template pattern already proven in
`emailAlerts.schema.ts`: the rule stores a Network Mail `templateId` plus a
snapshot of `templateHtml`, because Network Mail authenticates with the
browser's JWT and the API cannot fetch a template at send time. Merge tags are
filled from the event payload.

**Idempotency.** Every send is keyed `(ruleId, eventId)` and that key is
unique-indexed. A retry, a double-emit, or two app instances processing the
same event cannot produce two emails.

**Audit.** `AdminNotificationLog` records rule, event, resolved recipients,
status and error. Without it, "why did this person get mailed?" is
unanswerable, and a dynamic rule builder makes that question inevitable.

### 4.5 Safety

These are requirements, not polish. A rule builder that can mail arbitrary
people based on an admin-authored predicate is a foot-gun without them.

- **Rules are created disabled.** Saving never sends.
- **Dry run.** "Test against the last 50 real events of this type" reports
  which would have matched and the recipients each would have produced.
  This is the only way an admin can trust a condition they just wrote, and it
  is cheap because §4.2 evaluation is pure.
- **Per-rule throttle** (max sends per hour) and the §4.3 recipient cap.
- **Fire-and-forget emission**, so notification failure never breaks the
  business action that raised the event.

## 5. Data model

```
AdminNotificationRule
  name, description
  enabled            (default false)
  event              (registry name)
  conditions         (tree, §4.2)
  recipients         (spec[], §4.3)
  templateId, templateName, templateHtml, syncedAt
  throttlePerHour, recipientCap
  orgId              (null = platform-wide; see §9.1)
  createdBy, createdAt, updatedAt

AdminNotificationLog
  ruleId, eventName, eventId
  matched            (bool — logged even when it did not fire, for dry-run parity)
  recipients[]       (resolved)
  status             queued | sent | failed | skipped_throttle | skipped_cap
  error
  createdAt
  unique index (ruleId, eventId)
```

## 6. API

```
GET    /garage-admin/notifications/events          registry, for the builder
GET    /garage-admin/notifications/rules
POST   /garage-admin/notifications/rules
PATCH  /garage-admin/notifications/rules/:id
DELETE /garage-admin/notifications/rules/:id
POST   /garage-admin/notifications/rules/:id/dry-run
POST   /garage-admin/notifications/rules/preview-recipients
GET    /garage-admin/notifications/log
```

Super-admin only, mounted beside the existing garage-admin routers.

## 7. UI

Garage Admin → **Notifications**, two tabs:

- **Rules** — list with event, enabled toggle, last fired. Editor is a
  four-step form: event → conditions → recipients → template, with **Test
  rule** always available and a recipient preview before save.
- **Log** — what fired, when, to whom, and why a skip was a skip.

The condition builder renders from the §4.1 registry. Nothing in the UI
enumerates events or fields.

## 8. Phasing

| Phase | Delivers | Why this order |
|---|---|---|
| 1 | Registry + `emitAdminEvent` + `user.signup` from the post-hook | Nothing else is testable without a real event |
| 2 | Rule model, condition evaluator, unit tests | Pure logic, no delivery risk |
| 3 | Recipient resolvers (static + relation) | The two that cover the stated use case |
| 4 | Delivery, idempotency, log | First real mail sends here |
| 5 | Admin UI + dry run | Dry run ships WITH the builder, not after |
| 6 | `role` and `query` resolvers, throttle | Highest blast radius, last |

Phase 1–4 satisfy the driving example. Phase 5 is what makes it usable by
someone who is not the person who built it.

## 9. Open questions

1. **Platform-wide only, or per-office?** *Assumed platform-wide* — the
   request said "in garage admin" and the example names platform users. The
   model carries `orgId` (null = platform) from day one so founder-scoped
   rules can be added without a migration, but no founder-facing UI or
   permission check is in scope. **Confirm before Phase 2.**
2. **Who may author rules** — all garage admins, or super-admins only?
   Assumed super-admin, matching the danger-zone routes.
3. **Retention** of `AdminNotificationLog`. Unbounded growth otherwise; a TTL
   index is the obvious answer but the window is a product call.
4. **Does a disabled rule still log** what it would have done? Useful for
   staging a rule before enabling; costs write volume.
