# `components/welcome/Bat246AuthChrome.tsx`

> React components `Bat246LeftPanel`, `Bat246Title`, `Bat246PoweredBy`.

**Kind:** React component · **Lines:** 85 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Image`×3 (next/image)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BAT246_AUTH_BUTTON_CLASS` | const | `= "h-[60px] sm:h-[70px] text-[17.5px] sm:text-xl"` — bat246.com sizing. Its members skew older, so every line of text is set for low eyesight: nothing under 16px, and the disclaimer is lifted to the subtitle grey because the default #6a6a7a is too faint on this background. | 16 |
| `BAT246_AUTH_BUTTON_ICON_CLASS` | const | `= "w-5 h-5 sm:w-6 sm:h-6"` | 17 |
| `BAT246_AUTH_INPUT_ROW_CLASS` | const | `= "h-[60px] sm:h-[70px]"` — The email / phone field, matched to the button height. | 19 |
| `BAT246_AUTH_INPUT_TEXT_CLASS` | const | `= "text-lg! placeholder:text-lg"` | 23 |
| `BAT246_AUTH_DISCLAIMER_CLASS` | const | `= "text-base sm:text-lg text-[#9fa0b8]"` | 24 |
| `BAT246_AUTH_SUBTITLE_CLASS` | const | `= "text-lg sm:text-xl text-[#9fa0b8]"` | 25 |
| `BAT246_AUTH_BACK_CLASS` | const | `= "text-base sm:text-lg"` | 26 |
| `BAT246_AUTH_LINKS_CLASS` | const | `= "text-base sm:text-lg"` — "Use a different email or number" / "Resend" on the verify step. | 28 |
| `Bat246LeftPanel` | component | `Bat246LeftPanel()` — Replaces the city-lights photo: plain black with the B2 coin. | 31 |
| `Bat246Title` | component | `Bat246Title()` — Replaces the Garage logo at the top of the form. | 50 |
| `Bat246PoweredBy` | component | `Bat246PoweredBy()` — Pinned to the bottom-right of the (relative) right panel. | 69 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/bat246Office.ts` — `BAT246_DISPLAY_NAME`
- **Packages:**
  - `next`

## Used by

- `app/(auth)/verify/page.tsx`
- `components/welcome/Welcome.tsx`
