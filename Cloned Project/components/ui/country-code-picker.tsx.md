# `components/ui/country-code-picker.tsx`

> The dial-code selector that sits at the left of a phone input.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 183 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The dial-code selector that sits at the left of a phone input.

Modelled on the picker in components/shared/ProfilePopover.tsx, which is the
established pattern in this app: the dropdown spans the FULL field width
(`left-0 right-0`) rather than a fixed box, click-outside is a ref check on
`mousedown`, and the current selection is highlighted in the list.

Extracted because that markup existed in four near-identical copies —
ProfilePopover (mobile AND desktop), PhoneVerifyBanner and
PlanPhoneVerifySheet — which had drifted: two defaulted to +91, one to +1,
and each had its own search predicate. A login field that guesses the wrong
country sends someone's OTP to a stranger, so there is now one of these.

── Positioning contract ─────────────────────────────────────────────────
This renders the dropdown against the NEAREST POSITIONED ANCESTOR, not
against itself, so the list can span the whole field the way ProfilePopover's […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronDown` (lucide-react), `Search` (lucide-react)

### Props

- **`CountryCodePicker`**: `value: ICountry | null`, `onChange: (c: ICountry) => void`, `fallbackDial?: string`, `fallbackFlag?: string`, `disabled?: boolean`, `buttonClassName?: string`

**Hooks used:** `useMemo`×2, `useState`×2, `useCountries` (local), `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `dialOf` | function | `dialOf(country: ICountry \| null, fallback = "91"): string` — Dial code without the "+", e.g. | 38 |
| `useCountries` | hook | `useCountries(): ICountry[]` | 42 |
| `allDialCodes` | function | `allDialCodes(): string[]` — Every dial code in the picker — feed this to `splitE164`. | 47 |
| `findCountryByIso` | function | `findCountryByIso(iso: string): ICountry \| null` | 51 |
| `CountryCodePickerProps` | interface |  | 55 |
| `CountryCodePicker` | component | `CountryCodePicker({ value, onChange, fallbackDial = "91", fallbackFlag = "🇮�…)` | 66 |
| `default (CountryCodePicker)` | component | `CountryCodePicker({ value, onChange, fallbackDial = "91", fallbackFlag = "🇮�…)` | 182 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/dialCodes.ts` — `phoneCountries`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `country-state-city` — `ICountry`
  - `lucide-react` — `ChevronDown`, `Search`

## Used by

- `components/welcome/Welcome.tsx`
