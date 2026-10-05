# `components/shared/OrgKycBanner.tsx`

> "KYC pending" nudge for office founders.

**Kind:** React component · **Lines:** 161 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"KYC pending" nudge for office founders.

Self-gating, like PhoneVerifyBanner: it asks the server whether this user is
the founder of an office that owes documents, and renders nothing at all
otherwise (non-founders, offices nobody has asked anything of, already
verified offices). The dialog carries the uploader itself, so the founder
can finish without hunting for Manage Organization — the same section also
lives there for anyone who closed this.

Nothing about the close is remembered. A founder who owes KYC sees this
every time they open the office — on every login, every reload, and again
when they switch into another office of theirs that owes documents. Closing
it only drops it to the corner card for the rest of that view; it comes
back on the next load and stops for good only once the packet is submitted
or verified.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ShieldAlert`×2 (lucide-react), `Button`×2 (components/ui/button.tsx), `X` (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `OrgKycSection` (components/shared/OrgKycSection.tsx)

**Hooks used:** `useState`×3, `useEffect`×2, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OrgKycBanner)` | component | `OrgKycBanner()` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`
  - `components/shared/OrgKycSection.tsx` — `OrgKycSection (default)`
  - `lib/org-kyc.ts` — `fetchOrgKycNudge`, `orgKycNeedsFounderAction`, `OrgKycNudge`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `lucide-react` — `ShieldAlert`, `X`

## Used by

- `app/(dashboard)/layout.tsx`
