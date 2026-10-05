# `components/ui/otp-input.tsx`

> React component `OtpInput`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 103 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`OtpInput`**: `length?: number`, `value: string`, `onChange: (val: string) => void`, `autoFocus?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OtpInput)` | component | `OtpInput({ length = 6, value, onChange, autoFocus = true, }: Props)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react`

## Used by

- `app/(auth)/guest-verify/GuestVerify.tsx`
- `app/(auth)/verify/page.tsx`
- `app/accept-invite/page.tsx`
- `app/garage-admin/accept-invite/page.tsx`
- `app/garage-admin/login/page.tsx`
- `app/guest/[slug]/GuestOfficePage.tsx`
- `app/guest/[slug]/components/GuestJoinFlow.tsx`
- `app/taskroom/backOffice/athena/InlineLoginModal.tsx`
- `components/meet/MeetPreJoin.tsx`
