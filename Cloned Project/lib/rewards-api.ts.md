# `lib/rewards-api.ts`

> Module exporting `giftReward`, `createPaidCouponOffer`, `listIncomingOffers`, `listOutgoingOffers` and 4 more.

**Kind:** frontend library · **Lines:** 164

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EligibilityCandidate` | interface |  | 6 |
| `PendingCouponOffer` | interface |  | 14 |
| `giftReward` | function | `async giftReward(assignmentId: string, body: { recipientEmail: string; message?: string })` — Free gift (no money) — instant transfer, no approval. | 68 |
| `createPaidCouponOffer` | function | `async createPaidCouponOffer(assignmentId: string, body: { recipientEmail: string; priceUsd: number; orgId: st…)` — Paid offer — creates a PendingCouponGift. | 84 |
| `listIncomingOffers` | function | `async listIncomingOffers(): Promise<{ offers: PendingCouponOffer[]; }>` | 101 |
| `listOutgoingOffers` | function | `async listOutgoingOffers(): Promise<{ offers: PendingCouponOffer[]; }>` | 110 |
| `approveCouponOffer` | function | `async approveCouponOffer(offerId: string)` | 119 |
| `rejectCouponOffer` | function | `async rejectCouponOffer(offerId: string)` | 127 |
| `cancelCouponOffer` | function | `async cancelCouponOffer(offerId: string)` | 135 |
| `searchRecipientEligibility` | function | `async searchRecipientEligibility(args: { q: string; orgId: string; priceUsd: number; }): Promise<{ candidates: EligibilityCandidate[] }>` — Search candidate recipients for a paid offer. | 148 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/me/rewards/${assignmentId}/gift` (L72)
  - `GET /backend/me/rewards/offers/incoming` (L104)
  - `GET /backend/me/rewards/offers/outgoing` (L113)
  - `POST /backend/me/rewards/offers/${offerId}/approve` (L120)
  - `POST /backend/me/rewards/offers/${offerId}/reject` (L128)
  - `POST /backend/me/rewards/offers/${offerId}/cancel` (L136)
  - `GET /backend/me/rewards/offers/recipient-eligibility?${params.toString()}` (L158)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `API_URL`
  - `lib/auth.ts` — `getToken`
- **Packages:** none

## Used by

- `components/dashboard/GiftRewardModal.tsx`
- `components/dashboard/RewardsTab.tsx`
