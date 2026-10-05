# `server/services/comboClient.ts`

> Which third-party subscription does the Unilevel Plus combo offer sell?

**Kind:** backend service · **Lines:** 80

<!-- docgen:auto -->

## Purpose
Which third-party subscription does the Unilevel Plus combo offer sell?

── Why this exists ──────────────────────────────────────────────────────
Two separate places needed that answer and each resolved it the same
fragile way — "the client that is the only active one":

    const active = await ThirdPartyClient.find({ isActive: true }).limit(2);
    if (active.length === 1) { ...use active[0]... }

`services/upiAutopay.ts` used it to decide whether to register a UPI
mandate at checkout, and `services/invoice.ts` used it to decide whether to
grant the free first month at fulfilment.

Activating a SECOND client (GarageGo, 10 Sep 2026) made both conditions
false at once. Nothing in the code changed, but from that moment buyers on
the bare-licence path stopped getting a mandate AND stopped getting their […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ComboClientResolution` | interface |  | 36 |
| `resolveComboClient` | function | `async resolveComboClient(): Promise<ComboClientResolution>` | 42 |
| `comboClientProblem` | function | `comboClientProblem(reason: ComboClientResolution["reason"]): string` — Human-readable explanation for a failed resolution, for the log line at the call site. | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/thirdPartyClient.model.ts` — `IThirdPartyClient`, `(types only)`
- **Packages:** none

## Used by

- `server/scripts/backfill-combo-free-month.ts`
- `server/scripts/set-combo-default-client.ts`
- `server/scripts/setup-test-account.ts`
- `server/services/invoice.ts`
- `server/services/upiAutopay.ts`
