# `server/utils/requestOrg.ts`

> src/utils/requestOrg.ts

**Kind:** backend utility · **Lines:** 79

<!-- docgen:auto -->

## Purpose
src/utils/requestOrg.ts

Which office is this request coming from?

A white-label site is served from the client's own domain but calls this API
on Garage's host, so `Host` here is ALWAYS the API — `test.garage.app` — no
matter which site the visitor is looking at. The only headers carrying the
originating site are `Origin` and `Referer`, set by the browser on that
cross-origin call, which is why they are checked first.

Reading `Host` first is the bug this exists to prevent: it silently resolves
every request to Garage, which made white-label signups join Garage HQ and
white-label OTPs send from the Garage address.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `hostFromRequest` | function | `hostFromRequest(req: { headers?: Record<string, any> } \| null \| undefined): string` — The site a request originated from, or "" when it cannot be determined. | 29 |
| `orgIdFromRequest` | function | `async orgIdFromRequest(req: { headers?: Record<string, any> } \| null \| undefined): Promise<Types.ObjectId \| null>` — The white-label org this request belongs to, or null for Garage's own hosts, unknown domains, or an unverified one. | 59 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/auth.ts`
- `server/services/mailer.ts`
