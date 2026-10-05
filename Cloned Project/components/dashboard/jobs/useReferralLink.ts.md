# `components/dashboard/jobs/useReferralLink.ts`

> Job links copied or shared from the founder console carry the founder's own referral code (`?ref=<affiliateId>`), so people who apply through them are credited like any other referral.

**Kind:** React component · **Lines:** 37 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Job links copied or shared from the founder console carry the founder's own
referral code (`?ref=<affiliateId>`), so people who apply through them are
credited like any other referral. Reuses the app's affiliate-share helpers.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useReferralLink` | hook | `useReferralLink(): (url?: string \| null) => string` — Returns a function that adds the signed-in user's referral code to a link. | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/affiliate-share.ts` — `fetchMyAffiliateId`, `withAffiliateRef`
- **Packages:**
  - `react`

## Used by

- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/wizard/StepPublish.tsx`
- `components/dashboard/jobs/founder/workspace/JobDetailsTab.tsx`
- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
