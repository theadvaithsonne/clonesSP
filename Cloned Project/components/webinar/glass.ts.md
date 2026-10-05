# `components/webinar/glass.ts`

> Liquid-glass class tokens for the floating webinar control overlay.

**Kind:** React component · **Lines:** 104

<!-- docgen:auto -->

## Purpose
Liquid-glass class tokens for the floating webinar control overlay.

The control bar now sits *on top of* the video stage instead of below it,
so every surface has to read as translucent glass over live video rather
than as an opaque chrome strip. Keeping the strings here means the bar,
the split buttons (mic / camera / speaker) and their popovers can't drift
apart visually.

Recipe: heavy backdrop blur + saturation boost (so colour behind the glass
stays vivid), a dark translucent fill for contrast against bright video, a
hairline white border, and an inner top highlight that reads as a specular
reflection off the top edge.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GLASS_BAR` | const | `= [ "relative rounded-[28px]", "border border-white/[0.12]", "bg-black/60 backdrop-blur-2xl backdro…` — The floating pill that wraps the whole control cluster. | 17 |
| `GLASS_BTN_SIZE` | const | `= "h-10 w-10 sm:h-11 sm:w-11"` — Shared geometry for every round control button. | 28 |
| `GLASS_BTN_BASE` | const | `= [ "relative flex items-center justify-center", "border transition-colors duration-150", "shadow-[…` — Base chrome shared by every control button (round + split faces). | 31 |
| `GLASS_BTN_IDLE` | const | `= "border-white/[0.12] bg-white/[0.09] text-white hover:bg-white/[0.18]"` — Default (inactive) glass button. | 38 |
| `GLASS_BTN_MUTED` | const | `= "border-red-400/30 bg-red-500/25 text-red-300 hover:bg-red-500/35"` — Muted / disabled-track state (mic off, camera off, speaker off). | 42 |
| `GLASS_BTN_DANGER` | const | `= "border-red-400/40 bg-red-500/85 text-white hover:bg-red-500 " + "shadow-[inset_0_1px_0…` — Destructive action (leave / end webinar) — always glowing. | 46 |
| `GLASS_BTN_ACTIVE_BLUE` | const | `= "border-blue-300/40 bg-blue-500/85 text-white hover:bg-blue-500 " + "shadow-[inset_0_1p…` — Active states — a glowing tinted fill so "on" reads instantly over video. | 51 |
| `GLASS_BTN_ACTIVE_GREEN` | const | `= "border-emerald-300/40 bg-emerald-500/85 text-white hover:bg-emerald-500 " + "shadow-[i…` | 55 |
| `GLASS_BTN_ACTIVE_YELLOW` | const | `= "border-yellow-300/40 bg-yellow-500/85 text-white hover:bg-yellow-500 " + "shadow-[inse…` | 59 |
| `GLASS_BTN_ACTIVE_RED` | const | `= "border-red-300/40 bg-red-500/85 text-white hover:bg-red-500 " + "shadow-[inset_0_1px_0…` | 63 |
| `GLASS_BTN_DISABLED` | const | `= "disabled:border-white/[0.08] disabled:bg-white/[0.05] disabled:text-white/40 " + "disa…` — Disabled variant used by the pre-media "Join" button. | 68 |
| `GLASS_MENU` | const | `= [ "rounded-2xl", "border border-white/[0.14]", "bg-black/75 backdrop-blur-2xl backdrop-saturate-1…` — Popover / dropdown surface. | 84 |
| `GLASS_CAPTION` | const | `= "text-[9px] sm:text-[10px] text-white/55 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"` — Caption text under each control. | 94 |
| `GLASS_SPLIT_SHELL` | const | `= "flex items-center rounded-full overflow-hidden border transition-colors duration-150 "…` — Outer shell for the split (face + chevron) controls. | 98 |
| `GLASS_SPLIT_IDLE` | const | `= "border-white/[0.12] bg-white/[0.09]"` | 102 |
| `GLASS_SPLIT_MUTED` | const | `= "border-red-400/30 bg-red-500/25"` | 103 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/webinar/ControlBar.tsx`
- `components/webinar/MediaSplitButton.tsx`
- `components/webinar/SpeakerButton.tsx`
