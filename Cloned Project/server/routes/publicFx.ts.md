# `server/routes/publicFx.ts`

> src/routes/publicFx.ts

**Kind:** Express router · **Lines:** 181 · **Mounted at:** `/public/fx` (browser: `/backend/public/fx`)

<!-- docgen:auto -->

## Purpose
src/routes/publicFx.ts

PUBLIC currency-conversion API. No auth, no user context, no writes —
reads the FX rate table maintained by src/fx/fxService.ts (refreshed
hourly + on boot, see index.ts) and does pure conversion math.

Mount point: /public/fx

  GET /rates       ?base=USD                     -> { base, rates, asOf, source }
  GET /convert      ?from=USD&to=INR&amount=25    -> { from, to, amount, result, rate, asOf, source }
  GET /currencies                                  -> [{ code, name, symbol, decimals }]

Cached at the edge (CDN/proxy) — rates only meaningfully change hourly.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (3)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/rates` | `/backend/public/fx/rates` | — | inline | 75 |
| GET | `/convert` | `/backend/public/fx/convert` | — | inline | 108 |
| GET | `/currencies` | `/backend/public/fx/currencies` | — | inline | 164 |

**Router-level middleware** (`router.use`, runs before route matching):
- `(_req: Request, res: Response, next) => { res.set("Cache-Control", "public, max-age=300, s-maxage=3600"); next(); }` (L25)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 180 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/fx/fxService.ts` — `getRateTable`
  - `server/fx/currencyMeta.ts` — `CURRENCY_SYMBOL`
  - `server/fx/ccyExponent.ts` — `ccyExponent`
  - `server/utils/http.ts` — `ok`, `fail`
- **Packages:**
  - `express` — `Router`, `Request`, `Response`
  - `zod` — `z`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/public/fx`.
