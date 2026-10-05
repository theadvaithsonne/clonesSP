# `lib/admin-api/notifications.ts`

> Garage-admin client for admin notification rules ("when event X happens and the conditions match, email recipients Y"): the event catalogue, rule CRUD, and resolving an email to a user.

**Kind:** frontend library · **Lines:** 123

## Purpose
This module backs the admin Notifications page, where operators build email alert rules. The backend serves the event catalogue rather than this file duplicating it. The condition builder draws its inputs from each `EventField.type`, so an event added on the server appears in the UI with no frontend change. The source comment points to a design spec at `garagenew-backend docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md`.

## How it works
- **Event catalogue.** `listEvents()` returns the `events` (name, label, description, typed `fields`) and an `operators` map. That map lists, for each field type (`user`, `string`, `number`, `enum`, `boolean`), the comparison operators the builder may offer.
- **Conditions** are a recursive tree (`ConditionNode`):
  - `{ all: [...] }`, `{ any: [...] }` or `{ not: node }` combine other nodes;
  - a leaf is `{ field, op, value? }`.
- **Recipients** (`RecipientSpec`) can be:
  - a static email list;
  - a relation to the event's subject (`sponsor`, `upline`, `officeOwner`, `subject`);
  - everyone with a role;
  - or a query (`filter` plus `cap`).
- **Rules** (`AdminNotificationRule`) also carry `enabled`, `templateName`, `throttlePerHour`, `recipientCap` and `lastFiredAt`.
- **Users stored by id.** Rules keep user ids, not emails, because an address can change and a rule that silently stopped matching would be worse than one that fails loudly. `resolveUser(email)` turns an email typed into the builder into the user's id, name, picture and `downlineCount`.
- Every call goes through `garageAdminApi` and returns the full `{ success, … }` body.

## Exports
- Types: `EventFieldType`, `EventField`, `AdminEventDescriptor`, `ConditionNode`, `RecipientSpec`, `AdminNotificationRule`.
- `listEvents()` - `{ success, events, operators }`.
- `listRules()` - `{ success, rules }`.
- `createRule(input: { name, description?, event, conditions?, recipients? })` - `{ success, rule }`.
- `updateRule(id, input: Partial<{ name, description, enabled, conditions, recipients }>)` - `{ success, rule }`. The event cannot be changed here.
- `deleteRule(id)` - `{ success }`.
- `resolveUser(email)` - `{ success, user }`.

## Interfaces
- **Backend endpoints called** (`server/routes/adminNotifications.ts`, mounted at `/garage-admin/notifications`):
  - `GET /backend/garage-admin/notifications/events` - event catalogue
  - `GET /backend/garage-admin/notifications/rules` - list rules
  - `POST /backend/garage-admin/notifications/rules` - create a rule
  - `PATCH /backend/garage-admin/notifications/rules/:id` - update a rule
  - `DELETE /backend/garage-admin/notifications/rules/:id` - delete a rule
  - `GET /backend/garage-admin/notifications/resolve-user?email=` - email to user

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/notifications/page.tsx`
