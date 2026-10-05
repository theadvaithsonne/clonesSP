# `components/dashboard/OpenClawChatPage.tsx`

> React component `OpenClawChatPage`.

**Kind:** React component · **Lines:** 1036 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×6 (lucide-react), `Button`×3 (components/ui/button.tsx), `Bot`×2 (lucide-react), `MessageSquare`×2 (lucide-react), `X` (lucide-react), `Paperclip` (lucide-react), `Input` (components/ui/input.tsx), `Send` (lucide-react), `ActivityFeed` (local), `ArrowLeft` (lucide-react), `AgentTabBar` (components/dashboard/OpenClawAgentTabs.tsx), `ControllerTab` (local), `TasksTab` (components/dashboard/OpenClawAgentTabs.tsx), `JobsTab` (components/dashboard/OpenClawAgentTabs.tsx), `ContextsTab` (components/dashboard/OpenClawAgentTabs.tsx), `IntegrationsTab` (components/dashboard/OpenClawAgentTabs.tsx), `NotificationsTab` (components/dashboard/OpenClawAgentTabs.tsx), `AnalyticsTab` (components/dashboard/OpenClawAgentTabs.tsx), `SavingsTab` (components/dashboard/OpenClawAgentTabs.tsx), `OpenClawChatPageInternal` (local)

### Props

- **`OpenClawChatPage`**: `initialAgent?: AgentData`, `onBack?: () => void`

**Hooks used:** `useState`×19, `useEffect`×11, `useRef`×5, `useOpenClawWs` (components/dashboard/OpenClawAgentTabs.tsx), `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawChatPage)` | component | `OpenClawChatPage(props?: { initialAgent?: AgentData; onBack?: () => void })` | 1031 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `POST /backend/openclaw-messages` (L896)
- **Next.js API routes called (same origin):**
  - `GET /api/openclaw/agents/${agent.agent_id}/activity?${params}` (L141)
- **Socket.IO events:**
  - listens for: `openclaw:new-message`
- **Timers / queues:** `setTimeout` at L811, L819

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`, `getUserIdFromToken`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/api.ts` — `api`
  - `lib/socket.ts` — `connectSocket`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/OpenClawAgentTabs.tsx` — `AgentData`, `AgentTabId`, `AGENT_TABS`, `AgentTabBar`, `TasksTab`, `JobsTab`, `ContextsTab`, `IntegrationsTab`, … +4
  - `components/dashboard/OpenClawAgentPage.tsx` — `LlmModel`, `LLM_MODEL_LABEL`, `LLM_MODELS_ORDERED`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `MessageSquare`, `Send`, `Loader2`, `Bot`, `ArrowLeft`, `Monitor`, …

## Used by

- `components/dashboard/OpenClawAgentPage.tsx`
