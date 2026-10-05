# `components/dashboard/inlineApps/events/announceEvent.ts`

> The "published — now share it" popup for an event, from the create form and from the console's Publish button.

**Kind:** React component · **Lines:** 67

<!-- docgen:auto -->

## Purpose
The "published — now share it" popup for an event, from the create form and
from the console's Publish button. Both have the saved event plus its ticket
prices; this turns them into the popup's preview card.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `announceEvent` | function | `announceEvent(event: EventProgram, tickets: Array<{ price: number; currency: string }>, opts: { draft: boolean; note?: string \| null; bannerUrl?: s…)` | 46 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/shared/SellablePublishedModal.tsx` — `formatSellablePrice`, `showSellablePublished`
  - `components/dashboard/inlineApps/events/types.ts` — `EventProgram`, `(types only)`
- **Packages:** none

## Used by

- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/EventConsole.tsx`
