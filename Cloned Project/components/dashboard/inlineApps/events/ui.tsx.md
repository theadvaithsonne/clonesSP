# `components/dashboard/inlineApps/events/ui.tsx`

> Small form/layout primitives shared by the wizard, the console and the web builder.

**Kind:** React component · **Lines:** 1003 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Small form/layout primitives shared by the wizard, the console and the web
builder. Deliberately local to the events module: the app-wide `components/ui`
wrappers are Radix-based and heavier than these need to be.

The tokens below are lifted verbatim from ServiceFormModal so every founder
create/edit surface reads as one product: #141414 cards on #262626
hairlines, #1A1A1A inputs, #FBD10D focus and accent, bold uppercase
micro-labels. If that form is restyled, restyle these with it.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×4 (local), `ChevronDown`×2 (lucide-react), `Button`×2 (local), `Check` (lucide-react), `SwitchControl` (local), `Loader2` (lucide-react), `Card` (local), `X` (lucide-react)

### Props

- **`Label`**: `children: React.ReactNode`, `required?: boolean`, `hint?: string`
- **`TextInput`**: `label`, `required`, `hint`, `className`, `rest`
- **`TextArea`**: `label`, `required`, `hint`, `className`, `rest`
- **`Select`**: `label`, `required`, `hint`, `options`, `className`, `rest`

**Hooks used:** `useHideBottomBar`×2 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `GOLD` | const | `= "var(--brand)"` | 19 |
| `GOLD_DIM` | const | `= "color-mix(in srgb, var(--brand) 92%, black)"` | 20 |
| `Label` | component | `Label({ children, required, hint, }: { children: React.ReactNode;…)` | 22 |
| `blurOnWheel` | function | `blurOnWheel(e: React.WheelEvent<HTMLInputElement>)` — A focused `<input type="number">` treats the wheel as a stepper, so scrolling the form with the cursor over a price silently rewrites the amount. | 51 |
| `TextInput` | component | `TextInput({ label, required, hint, className = "", ...rest }: React.I…)` | 57 |
| `TextArea` | component | `TextArea({ label, required, hint, className = "", ...rest }: React.T…)` | 84 |
| `Select` | component | `Select({ label, required, hint, options, className = "", ...rest }…)` | 106 |
| `CustomSelectOption` | type |  | 144 |
| `CustomSelect` | component | `CustomSelect({ label, required, hint, value, onChange, options, placehol…)` — A themed replacement for `<select>`. | 167 |
| `SwitchControl` | component | `SwitchControl({ checked, onChange, disabled, className = "", "aria-label"…)` — The one switch the whole events module uses. | 397 |
| `Toggle` | component | `Toggle({ checked, onChange, label, description, disabled, }: { che…)` | 437 |
| `Checkbox` | component | `Checkbox({ checked, onChange, label, }: { checked: boolean; onChange…)` | 469 |
| `Button` | component | `Button({ variant = "primary", loading, children, className = "", .…)` | 507 |
| `Card` | component | `Card({ children, className = "", ...rest }: React.HTMLAttributes…)` | 546 |
| `SectionTitle` | component | `SectionTitle({ title, description, action, }: { title: string; descripti…)` | 561 |
| `StatTile` | component | `StatTile({ label, value, sub, accent, }: { label: string; value: Rea…)` | 583 |
| `CapacityMeter` | component | `CapacityMeter({ listed, capacity, fix = "Lower the ticket quantities or r…)` — Seats listed as tickets against the event's capacity. | 617 |
| `EmptyState` | component | `EmptyState({ icon, title, description, action, }: { icon?: React.React…)` | 658 |
| `useHideBottomBar` | hook | `useHideBottomBar(active: boolean)` — Hides the dashboard's floating bottom bar for as long as an overlay is open. | 688 |
| `Modal` | component | `Modal({ open, onClose, title, children, footer, width = "max-w-lg…)` | 698 |
| `ConsoleActionIcon` | type | Icon keys the dashboard's floating bottom bar knows how to render. | 752 |
| `ConsoleAction` | type |  | 760 |
| `useConsoleAction` | hook | `useConsoleAction(id: string, handler: () => void)` — Subscribes a section to its bottom-bar action. | 778 |
| `ConfirmOptions` | type |  | 793 |
| `useConfirm` | hook | `useConfirm()` — Promise-based replacement for `window.confirm`. | 816 |
| `toLocalInput` | function | `toLocalInput(iso?: string \| Date \| null): string` — `<input type="datetime-local">` wants `YYYY-MM-DDTHH:mm` in LOCAL time. | 894 |
| `fromLocalInput` | function | `fromLocalInput(value: string): string \| undefined` — Inverse of `toLocalInput` — a local-time string back to an ISO instant. | 905 |
| `formatMoney` | function | `formatMoney(amount: number, currency = "USD"): string` | 911 |
| `EVENT_CATEGORIES` | const | `= [ "Technology", "Web3", "Business", "Marketing", "Design", "Finance", "Health", "Educat…` | 923 |
| `EVENT_LANGUAGES` | const | `= [ "English", "Hindi", "Spanish", "French", "German", "Portuguese", "Arabic", "Mandarin"…` | 936 |
| `timezoneOptions` | function | `timezoneOptions(): Array<{ value: string; label: string }>` — A short, stable timezone list plus the visitor's own zone, which is pre-selected in the wizard. | 953 |
| `localTimezone` | function | `localTimezone(): string` | 996 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Check`, `ChevronDown`, `Loader2`, `X`

## Used by

- `components/dashboard/inlineApps/events/CreateEventExtras.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/DateTimeField.tsx`
- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventConsole.tsx`
- `components/dashboard/inlineApps/events/EventPickerModal.tsx`
- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/EventsListView.tsx`
- `components/dashboard/inlineApps/events/VenuePicker.tsx`
- `components/dashboard/inlineApps/events/WebsiteBuilder.tsx`
- `components/dashboard/inlineApps/events/sections/AgendaSection.tsx`
- `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx`
- `components/dashboard/inlineApps/events/sections/CouponsSection.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx`
- `components/dashboard/inlineApps/events/sections/SpeakersSection.tsx`
- `components/dashboard/inlineApps/events/sections/SponsorsSection.tsx`
- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
- `components/dashboard/inlineApps/events/sections/WebsiteSettings.tsx`
- `components/dashboard/jobs/ui.tsx`
