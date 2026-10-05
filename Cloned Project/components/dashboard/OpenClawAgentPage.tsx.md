# `components/dashboard/OpenClawAgentPage.tsx`

> React component `OpenClawAgentPage`.

**Kind:** React component · **Lines:** 1097 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×13 (components/ui/button.tsx), `Loader2`×6 (lucide-react), `Input`×4 (components/ui/input.tsx), `PlusCircle`×4 (lucide-react), `Bot`×3 (lucide-react), `X`×2 (lucide-react), `Users`×2 (lucide-react), `MemberRow`×2 (local), `AgentForm`×2 (local), `Check` (lucide-react), `Search` (lucide-react), `OpenClawChatPage` (components/dashboard/OpenClawChatPage.tsx), `Lock` (lucide-react), `Unlock` (lucide-react), `Link2` (lucide-react), `MessageSquare` (lucide-react), `ChevronUp` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `AssignmentsPanel` (local), `OpenClawAgentPageInternal` (local)

**Hooks used:** `useState`×19, `useEffect`×3, `useRef`, `useAmIFounder` (lib/hooks/useAmIFounder.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LlmModel` | type |  | 48 |
| `LlmProvider` | type |  | 57 |
| `LLM_PROVIDER_LABEL` | const | `= { openai: "OpenAI", anthropic: "Anthropic", }` | 59 |
| `LLM_MODEL_LABEL` | const | `= { "openai/gpt-5.1": "OpenAI · GPT-5.1", "openai/gpt-4.1": "OpenAI · GPT-4.1", "openai/g…` | 66 |
| `LLM_MODELS_ORDERED` | const | `= [ "openai/gpt-4o", "openai/gpt-4o-mini", "openai/gpt-5.1", "openai/gpt-4.1", "anthropic…` | 77 |
| `DEFAULT_MODEL_FOR` | const | `= { openai: "openai/gpt-5.1", anthropic: "anthropic/claude-sonnet-4-5", }` | 91 |
| `providerOf` | function | `providerOf(m?: string \| null): LlmProvider \| ""` | 96 |
| `default (OpenClawAgentPage)` | component | `OpenClawAgentPage()` | 1092 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `PATCH /api/openclaw/agent/${agentId}` (L688)
  - `PUT /api/openclaw/agent/${agentId}/assignments` (L791)
  - `POST /api/billing/subscriptions/${agentId}/unlock?user_id=${userId}` (L819)

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getToken`, `getOrgId`, `getUserIdFromToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/dashboard/OpenClawChatPage.tsx` — `OpenClawChatPage (default)`
  - `lib/featureFlags.ts` — `SUBSCRIPTIONS_ENABLED`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/feed-api.ts` — `getTeamMembers`, `TeamMember`
- **Packages:**
  - `react` — `useEffect`, `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Bot`, `Trash2`, `Loader2`, `PlusCircle`, `Pencil`, `X`, …

## Used by

- `components/dashboard/AIManagementPage.tsx`
- `components/dashboard/ManagementPage.tsx`
- `components/dashboard/OpenClawChatPage.tsx`
