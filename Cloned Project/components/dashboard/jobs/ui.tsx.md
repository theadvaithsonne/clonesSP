# `components/dashboard/jobs/ui.tsx`

> Jobs screens reuse the founder-console primitives from the Events module (the same #141414 cards, #262626 hairlines, #1A1A1A inputs and office brand accent as every founder create/edit surface) and add the few pieces hiring needs: status a…

**Kind:** React component · **Lines:** 674 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Jobs screens reuse the founder-console primitives from the Events module
(the same #141414 cards, #262626 hairlines, #1A1A1A inputs and office brand
accent as every founder create/edit surface) and add the few pieces hiring
needs: status and stage pills, the reward badge, avatars, a right-side
drawer, underline tabs, compact filter menus and row menus.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Check`×3 (lucide-react), `X`×2 (lucide-react), `ChevronDown` (lucide-react), `MoreHorizontal` (lucide-react), `Loader2` (lucide-react), `Card` (components/dashboard/inlineApps/events/ui.tsx), `Button` (components/dashboard/inlineApps/events/ui.tsx), `Copy` (lucide-react)

### Props

- **`PageHeader`**: `title: React.ReactNode`, `subtitle?: React.ReactNode`, `actions?: React.ReactNode`, `children?: React.ReactNode`
- **`UnderlineTabs`**: `tabs: Array<{ value: T; label: string; count?: number }>`, `value: T`, `onChange: (v: T) => void`, `className?: string`
- **`SearchInput`**: `value: string`, `onChange: (v: string) => void`, `placeholder: string`, `className?: string`
- **`SafeHtml`**: `html: string`, `className?: string`

**Hooks used:** `useClickOutside`×2 (local), `useHideBottomBar` (components/dashboard/inlineApps/events/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Button` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 24 |
| `Card` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 25 |
| `GOLD` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 26 |
| `Label` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 27 |
| `TextInput` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 28 |
| `TextArea` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 29 |
| `Select` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 30 |
| `CustomSelect` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 31 |
| `SwitchControl` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 32 |
| `Toggle` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 33 |
| `Checkbox` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 34 |
| `StatTile` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 35 |
| `EmptyState` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 36 |
| `Modal` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 37 |
| `useHideBottomBar` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 38 |
| `useConfirm` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 39 |
| `toLocalInput` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 40 |
| `fromLocalInput` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 41 |
| `formatMoney` | re-export | `from @/components/dashboard/inlineApps/events/ui` | 42 |
| `errorMessage` | function | `errorMessage(err: unknown, fallback: string): string` — The message of a thrown error, or `fallback` when it has none. | 48 |
| `formatDate` | function | `formatDate(d?: string \| Date \| null, opts: Intl.DateTimeFormatOptions = {}): string` | 53 |
| `formatDateTime` | function | `formatDateTime(d?: string \| Date \| null): string` | 60 |
| `meetingLink` | function | `meetingLink(url?: string \| null): string` — Interview join links are built by the backend from its FRONTEND_URL, so a misconfigured server stores `http://localhost:3000/meet/join?...` on the interview for good. | 77 |
| `timeAgo` | function | `timeAgo(d?: string \| Date \| null): string` | 88 |
| `formatSalary` | function | `formatSalary(salary?: { show?: boolean; currency?: string; min?: number …): string \| null` — "₹28L – ₹36L / year" style salary text, or null when hidden/unset. | 100 |
| `PageHeader` | component | `PageHeader({ title, subtitle, actions, children, }: { title: React.Rea…)` | 128 |
| `UnderlineTabs` | component | `UnderlineTabs({ tabs, value, onChange, className = "", }: { tabs: Array<{…)` | 153 |
| `SearchInput` | component | `SearchInput({ value, onChange, placeholder, className = "w-64", }: { va…)` | 190 |
| `SafeHtml` | component | `SafeHtml({ html, className = "" }: { html: string; className?: strin…)` — Founder-written rich text (job descriptions), sanitised before rendering. | 224 |
| `StatusPill` | component | `StatusPill({ status }: { status: JobStatus })` | 239 |
| `StagePill` | component | `StagePill({ category, name }: { category: StageCategory; name?: strin…)` | 251 |
| `RewardBadge` | component | `RewardBadge({ amount, suffix = "per hire", size = "md" }: { amount: num…)` | 261 |
| `Chip` | component | `Chip({ children, onRemove, active, onClick, }: { children: React…)` | 272 |
| `Avatar` | component | `Avatar({ name, src, size = 32 }: { name?: string; src?: string; si…)` | 311 |
| `OrgLogo` | component | `OrgLogo({ name, src, size = 36 }: { name?: string; src?: string; si…)` | 332 |
| `MatchScore` | component | `MatchScore({ score, size = "sm" }: { score: number; size?: "sm" \| "lg"…)` | 346 |
| `FilterMenu` | component | `FilterMenu({ label, value, options, onChange, allLabel = "All", }: { l…)` — Compact filter dropdown — a chip that opens a small option list. | 387 |
| `RowMenuItem` | type |  | 451 |
| `RowMenu` | component | `RowMenu({ items, align = "right" }: { items: RowMenuItem[]; align?:…)` — "•••" menu for a table row or card. | 461 |
| `Drawer` | component | `Drawer({ open, onClose, title, subtitle, headerExtra, children, fo…)` — Right-side panel with a sticky header and footer (candidate profile, offers, payouts). | 514 |
| `LoadingBlock` | component | `LoadingBlock({ label = "Loading…", className = "py-20" }: { label?: stri…)` | 578 |
| `SkeletonRows` | component | `SkeletonRows({ rows = 5 }: { rows?: number })` | 587 |
| `ErrorState` | component | `ErrorState({ message, onRetry }: { message: string; onRetry?: () => vo…)` | 597 |
| `CopyButton` | component | `CopyButton({ value, label = "Copy" }: { value: string; label?: string })` | 610 |
| `StageBar` | component | `StageBar({ counts }: { counts: Partial<Record<StageCategory, number>…)` — Thin horizontal bar split by stage category — the postings "applicant funnel". | 634 |
| `useLoad` | hook | `useLoad(loader: () => Promise<T>, deps: React.DependencyList)` — Loads data with loading / error state and a reload function. | 650 |

## Interfaces

- **Timers / queues:** `setTimeout` at L619

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/events/ui.tsx` — `Button`, `Card`, `GOLD`, `useHideBottomBar`, `formatMoney`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `STATUS_META`
  - `components/dashboard/jobs/types.ts` — `JobStatus`, `StageCategory`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Check`, `ChevronDown`, `Copy`, `Loader2`, `MoreHorizontal`, `X`
  - `sonner` — `toast`
  - `dompurify`

## Used by

- `components/dashboard/jobs/JobsAccessGate.tsx`
- `components/dashboard/jobs/candidate/AlertModal.tsx`
- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/candidate/DiscoverPage.tsx`
- `components/dashboard/jobs/candidate/JobDetailView.tsx`
- `components/dashboard/jobs/candidate/JobPage.tsx`
- `components/dashboard/jobs/candidate/MyApplicationsPage.tsx`
- `components/dashboard/jobs/candidate/SavedPage.tsx`
- `components/dashboard/jobs/candidate/boardNav.tsx`
- `components/dashboard/jobs/candidate/shared.tsx`
- `components/dashboard/jobs/founder/ApplicationsPage.tsx`
- `components/dashboard/jobs/founder/OverviewPage.tsx`
- `components/dashboard/jobs/founder/PayoutsPage.tsx`
- `components/dashboard/jobs/founder/PostingsPage.tsx`
- `components/dashboard/jobs/founder/TalentPoolPage.tsx`
- `components/dashboard/jobs/founder/candidate/CandidateDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/HireModal.tsx`
- `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`
- `components/dashboard/jobs/founder/candidate/RejectModal.tsx`
- `components/dashboard/jobs/founder/candidate/ScheduleInterviewModal.tsx`
- `components/dashboard/jobs/founder/candidate/ScorecardPage.tsx`
- `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`
- `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`
- `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`
- `components/dashboard/jobs/founder/settings/PrivacySection.tsx`
- _…and 22 more_

## Notes

- Security-relevant constructs: `dangerouslySetInnerHTML` (L232).
