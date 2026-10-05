# `components/dashboard/ServiceFormModal.tsx`

> React components `ServiceFormModal`, `CreateDigitalServiceModal`, `EditServiceModal`.

**Kind:** React component · **Lines:** 2960 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×22 (local), `X`×8 (lucide-react), `SectionBlock`×7 (local), `GoldRadio`×6 (local), `Dropdown`×5 (local), `Loader2`×5 (lucide-react), `Check`×4 (lucide-react), `Switch`×4 (components/ui/switch.tsx), `ToggleRow`×4 (local), `AddRow`×4 (local), `ChipList`×3 (local), `ChevronDown`×2 (lucide-react), `Plus`×2 (lucide-react), `Shield`×2 (lucide-react), `GripVertical`×2 (lucide-react), `Paperclip`×2 (lucide-react), `ServiceFormModal`×2 (local), `Timer` (lucide-react), `Lock` (lucide-react), `Trash2` (lucide-react), `AlertCircle` (lucide-react), `ImageIcon` (lucide-react), `Film` (lucide-react), `Play` (lucide-react), `Layers` (lucide-react), `Clock` (lucide-react), `Info` (lucide-react), `Sparkles` (lucide-react), `BillableSetup` (local), `DeliveryTeamSection` (components/dashboard/service-taskroom/DeliveryTeamSection.tsx), `MilestoneCard` (local), `FounderAlertsSection` (components/dashboard/products/FounderAlertsSection.tsx), `Search` (lucide-react), `TaskroomVisibilitySection` (components/dashboard/service-taskroom/TaskroomVisibilitySection.tsx), `CommissionPlanSection` (components/dashboard/CommissionPlanSection.tsx)

### Props

- **`ServiceFormModal`**: `isOpen: boolean`, `mode: "create" | "edit"`, `service?: Service | null`, `onClose: () => void`, `onSaved: (service: Service) => void`
- **`CreateDigitalServiceModal`**: `isOpen: boolean`, `onClose: () => void`, `onSuccess: (service: Service) => void`
- **`EditServiceModal`**: `service: Service | null`, `onClose: () => void`, `onSaved: (service: Service) => void`

**Hooks used:** `useState`×46, `useRef`×5, `useEffect`×4, `useMemo`×4, `useCallback`×2, `useFounderAlerts` (components/dashboard/products/useFounderAlerts.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `announceService` | function | `announceService(service: Service)` — The share popup, for a service that was just created or first published. | 68 |
| `ServiceFormModalProps` | interface |  | 1202 |
| `ServiceFormModal` | component | `ServiceFormModal({ isOpen, mode, service, onClose, onSaved, }: ServiceFormMo…)` | 1210 |
| `CreateDigitalServiceModal` | component | `CreateDigitalServiceModal({ isOpen, onClose, onSuccess, }: { isOpen: boolean; onClose…)` | 2922 |
| `EditServiceModal` | component | `EditServiceModal({ service, onClose, onSaved, }: { service: Service \| null; …)` | 2941 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/upload` (L305)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **External hosts mentioned in the code:** `youtube.com`

## Dependencies

- **Internal:**
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsSection`
  - `components/dashboard/products/useFounderAlerts.ts` — `useFounderAlerts`
  - `lib/feed-api.ts` — `createService`, `updateService`, `getTeamMembers`, `DEFAULT_HOURLY_CONFIG`, `Service`, `ServiceHourlyConfig`, `ServiceMilestoneAttachment`, `ServiceMilestoneInput`, … +5
  - `components/ui/switch.tsx` — `Switch`
  - `lib/utils.ts` — `cn`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/CommissionPlanSection.tsx` — `CommissionPlanSection`, `saveCommissionPlan`
  - `components/dashboard/ServiceMediaCarousel.tsx` — `formatFileSize`, `youtubeId`, `youtubeThumb`
  - `components/dashboard/service-taskroom/TaskroomVisibilitySection.tsx` — `TaskroomVisibilitySection`, `buildDefaultStages`, `emptyTaskroomConfig`
  - `components/dashboard/service-taskroom/DeliveryTeamSection.tsx` — `DeliveryTeamSection`
  - `lib/form-limits.ts` — `MAX_BENEFITS`, `MAX_DELIVERABLES`, `filterNonEmptyStrings`, `limitReachedLabel`
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `garageStorefrontUrl`, `showSellablePublished`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `AlertCircle`, `Check`, `ChevronDown`, `Clock`, `Film`, `GripVertical`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/ServicesPage.tsx`

## Notes

- Large file (2960 lines) — read it by section; line numbers above point into it.
