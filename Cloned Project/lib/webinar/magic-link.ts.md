# `lib/webinar/magic-link.ts`

> Magic-link checkout for Garage Store plans.

**Kind:** frontend library · **Lines:** 116

<!-- docgen:auto -->

## Purpose
Magic-link checkout for Garage Store plans.

A magic link is a per-(user, plan, term) offer token. Everything about it
is computed LIVE on every read — nothing is frozen at creation — which is
what lets us mint the link first and only then open the buyer's 24-hour
window: the next read re-quotes at the better price.

Endpoints (garagenew-backend/src/routes/magicLink.ts):
  POST /magic-link                  requireAuth  — mint (or re-use) a token
  GET  /magic-link/:token           public       — live status + quote
  POST /magic-link/:token/checkout  public       — invoice, or free claim

Creation is rate-limited to 30/hour per creating user, so a link is minted
on the Buy click — never just to render a price.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ComboQuote` | interface | What the buyer is being charged for, as the server sees it. | 21 |
| `MagicLinkOffer` | interface | The buyer's own 24-hour free-first-cycle window. | 36 |
| `MagicLinkStatus` | type |  | 44 |
| `MagicLinkRead` | interface |  | 50 |
| `MagicLinkCreated` | interface |  | 64 |
| `MagicLinkCheckout` | interface |  | 73 |
| `createMagicLink` | function | `async createMagicLink(input: { userId: string; thirdPartyClientId: string; termMo…): Promise<MagicLinkCreated>` | 81 |
| `magicLinkUrl` | function | `magicLinkUrl(token: string): string` — Where the hosted offer page lives. | 98 |
| `readMagicLink` | function | `async readMagicLink(token: string): Promise<MagicLinkRead>` | 102 |
| `checkoutMagicLink` | function | `async checkoutMagicLink(token: string): Promise<MagicLinkCheckout>` | 108 |

## Interfaces

- **Other fetch/api calls (target not statically resolvable):**
  - `POST magic-link` (L87)
  - `GET magic-link/${encodeURIComponent(token)}` (L103)
  - `POST magic-link/${encodeURIComponent(token)}/checkout` (L111)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:** none

## Used by

- `app/webinar/[id]/WebinarRoomClient.tsx`
- `components/webinar/PinnedProductCard.tsx`
