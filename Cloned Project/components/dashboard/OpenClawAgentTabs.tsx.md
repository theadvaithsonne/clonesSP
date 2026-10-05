# `components/dashboard/OpenClawAgentTabs.tsx`

> Shared agent controller tab components.

**Kind:** React component · **Lines:** 2888 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared agent controller tab components.
Used by OpenClawChatPage (Management tab) and DMPage (agent DM view).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `AStatCard`×16 (local), `Loader2`×15 (lucide-react), `Button`×9 (components/ui/button.tsx), `FileText`×8 (lucide-react), `ChartTooltip`×8 (components/ui/chart.tsx), `ASection`×7 (local), `ChartContainer`×7 (components/ui/chart.tsx), `CartesianGrid`×7 (recharts), `XAxis`×7 (recharts), `YAxis`×7 (recharts), `ChartTooltipContent`×7 (components/ui/chart.tsx), `SSection`×7 (local), `Icon`×6 (local), `Plug`×6 (lucide-react), `X`×4 (lucide-react), `BarChart`×4 (recharts), `Bar`×4 (recharts), `Progress`×4 (components/ui/progress.tsx), `RefreshCw`×3 (lucide-react), `AlertTriangle`×3 (lucide-react), `Play`×3 (lucide-react), `Plus`×3 (lucide-react), `AreaChart`×3 (recharts), `Area`×3 (recharts), `SStatCard`×3 (local), `CheckCircle2`×2 (lucide-react), `ChevronDown`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `Badge`×2 (components/ui/badge.tsx), `Zap`×2 (lucide-react), `ScrollArea`×2 (components/ui/scroll-area.tsx), `Slider`×2 (components/ui/slider.tsx), `Circle` (lucide-react), `Bug` (lucide-react), `ArrowLeft` (lucide-react), `Pause` (lucide-react), `Bot` (lucide-react), `Unplug` (lucide-react), `Check` (lucide-react), … +11 more

### Props

- **`TasksTab`**: `agent: AgentData`, `authHeaders: Record<string, string>`
- **`JobsTab`**: `agent: AgentData`, `authHeaders: Record<string, string>`
- **`ContextsTab`**: `agent: AgentData`, `authHeaders: Record<string, string>`
- **`IntegrationsTab`**: `agent: AgentData`, `authHeaders: Record<string, string>`

**Hooks used:** `useState`×51, `useEffect`×8, `useCallback`×5, `useOpenClawWs`×2 (local), `useRef`, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AgentData` | interface |  | 37 |
| `SubTask` | interface |  | 46 |
| `TaskIssue` | interface |  | 47 |
| `Task` | interface |  | 49 |
| `Job` | interface |  | 63 |
| `ContextItem` | interface |  | 73 |
| `AuthFieldSchema` | interface |  | 92 |
| `EndpointSchema` | interface |  | 98 |
| `DisplayMetadataItem` | interface |  | 104 |
| `ConnectedAgent` | interface |  | 110 |
| `Integration` | interface |  | 116 |
| `ConnectedIntegration` | interface |  | 127 |
| `AGENT_TABS` | const | `= [ { id: "controller", label: "Controller", icon: Monitor }, { id: "tasks", label: "Task…` | 135 |
| `AgentTabId` | type |  | 146 |
| `timeAgo` | function | `timeAgo(val?: string \| number)` | 150 |
| `useOpenClawWs` | hook | `useOpenClawWs(path: string, onMessage: (event: string, data: any) => void)` | 198 |
| `TasksTab` | component | `TasksTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Re…)` | 271 |
| `JobsTab` | component | `JobsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Re…)` | 628 |
| `ContextsTab` | component | `ContextsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Re…)` | 970 |
| `IntegrationsTab` | component | `IntegrationsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Re…)` | 1288 |
| `NotificationsTab` | component | `NotificationsTab()` | 1771 |
| `AnalyticsTab` | component | `AnalyticsTab({ agent, authHeaders }: { agent: AgentData; authHeaders: Re…)` | 1928 |
| `SavingsTab` | component | `SavingsTab({ agent }: { agent: AgentData })` | 2223 |
| `AgentTabBar` | component | `AgentTabBar({ activeTab, onTabChange, }: { activeTab: AgentTabId; onTab…)` | 2856 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `GET /api/openclaw/tasks${qs}` (L282)
  - `PATCH /api/openclaw/tasks/${taskId}/issues/${issueIndex}/resolve${qs}` (L314)
  - `GET /api/openclaw/jobs${qs}` (L642)
  - `GET /api/openclaw/jobs/${jobId}/detail${qs}` (L681)
  - `POST /api/openclaw/jobs/${jobId}/trigger${qs}` (L693)
  - `PATCH /api/openclaw/jobs/${job.job_id}${qs}` (L704)
  - `GET /api/openclaw/contexts/agent/${agent.agent_id}${qs}` (L1068)
  - `GET /api/openclaw/contexts${qs}` (L1069)
  - `GET /api/openclaw/contexts/third-party/completed${qs}` (L1070)
  - `GET /api/openclaw/contexts/third-party${agentQs}` (L1071)
  - `POST /api/openclaw/contexts/third-party/${ctx.id}/assign${qs}` (L1102)
  - `POST /api/openclaw/contexts/assign${qs}` (L1107)
  - `DELETE /api/openclaw/contexts/third-party/${ctx.id}/assign/${agent.agent_id}${qs}` (L1131)
  - `DELETE /api/openclaw/contexts/unassign/${agent.agent_id}/${ctx.id}${qs}` (L1135)
  - `GET /api/openclaw/integrations/agent/${agent.agent_id}${qs}` (L1308)
  - `POST /api/openclaw/integrations${qs}` (L1330)
  - `GET /api/openclaw/integrations/${integ.name}/logs${qs}` (L1381)
  - `DELETE /api/openclaw/integrations/unassign?agent_id=${encodeURIComponent(agent.agent_id)}&integration_name=${encodeURIComponent(integ.name)}${qs}` (L1393)
  - `POST /api/openclaw/integrations/${encodeURIComponent(integ.name)}/test?agent_id=${encodeURIComponent(agent.agent_id)}${qs}` (L1410)
  - `GET /api/openclaw/analytics/agent/${agent.agent_id}${qs}` (L1937)
  - `GET /api/openclaw/wallet` (L2246)
  - `POST /api/openclaw/wallet/verify-payment` (L2336)
  - `POST /api/openclaw/wallet/create-order` (L2372)
  - `GET /api/billing/usage/current-month${qs}` (L2446)
  - `GET /api/billing/usage/daily-7d${qs}` (L2447)
  - `GET /api/billing/usage/monthly-12m${qs}` (L2448)
  - `GET /api/billing/usage/models${qs}` (L2449)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`
- **Timers / queues:** `setTimeout` at L240, L1361, L2279; `setInterval` at L1353
- **External hosts mentioned in the code:** `checkout.razorpay.com`

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/scroll-area.tsx` — `ScrollArea`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/progress.tsx` — `Progress`
  - `components/ui/slider.tsx` — `Slider`
  - `components/ui/chart.tsx` — `ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartConfig`
  - `lib/auth.ts` — `getOrgId`, `getToken`, `getUserIdFromToken`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `components/checkout/PaymentMethodSelector.tsx` — `PaymentMethodSelector`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useCallback`, `useRef`, `ComponentType`, `ReactNode`
  - `next`
  - `framer-motion` — `motion`
  - `recharts` — `BarChart`, `Bar`, `XAxis`, `YAxis`, `CartesianGrid`, `AreaChart`, …
  - `sonner` — `toast`
  - `lucide-react` — `CheckCircle2`, `Circle`, `Clock`, `AlertTriangle`, `ChevronRight`, `ChevronDown`, …
  - `cronstrue`

## Used by

- `components/dashboard/OpenClawChatPage.tsx`
- `components/dashboard/ThirdPartyContextsView.tsx`

## Notes

- `OpenClawAgentTabs.tsx`:1876 — TODO: replace with API data once the interactions endpoint is plumbed through
- `OpenClawAgentTabs.tsx`:2091 — 7. Office Interactions — TODO: replace static data with data.interactions from the API */}
- Large file (2888 lines) — read it by section; line numbers above point into it.
