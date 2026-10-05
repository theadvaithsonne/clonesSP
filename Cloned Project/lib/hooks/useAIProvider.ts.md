# `lib/hooks/useAIProvider.ts`

> A React hook that loads the current organisation's configured AI provider keys (bring-your-own-key for Gemini/Anthropic/OpenAI), the caller's role, and a remembered "selected provider".

**Kind:** React hook · **Lines:** 127

## Purpose
Founders can store their own AI provider API keys per organisation; AI features such as Ask Cabinet and the Betty dashboard then let the user choose which provider to use. This hook is the client-side source of truth for "which providers does this org have keys for, which one is selected, and am I a founder or a stakeholder".

## How it works
1. On mount `fetchKeys()` reads `garage_org_id` from localStorage and the session token (`getToken()`, localStorage `garage_tok`). Without either it clears state and stops.
2. It calls `GET /backend/founder-ai-providers/keys?orgId=<orgId>`. The backend (`server/routes/founderAiProviders.ts`, `requireAuth`) checks organisation membership and returns `{ data: { role, keys, ... } }`: founders get masked keys; stakeholders get `hasKeys`, `availableProviders` and keys with `maskedKey: "****"`. The hook accepts both a flat `{ keys, role, ... }` and a wrapped `{ data: {...} }` body.
3. `availableProviders` falls back to the provider ids of the returned keys.
4. Selected provider: if localStorage `garage_selected_ai_provider` names a provider that has a key, it is used; otherwise the first match in the priority order `google-gemini` > `anthropic` > `openai` (or the first key), which is also written to localStorage.
5. Any error is logged and the state is cleared; `isLoading` is always reset.

`setSelectedProvider(id)` changes the selection only if a key exists for `id`, and persists it.

## Exports
- `useAIProvider(): AIProviderConfig` - the hook.
- `interface ProviderKey` - `{ providerId, maskedKey, createdAt }`.
- `interface AIProviderConfig` - return shape: `keys`, `selectedProvider`, `isLoading`, `hasAnyKey`, `hasProvider(id)`, `refetch()`, `setSelectedProvider(id)`, `role` (`"founder" | "stakeholder" | null`), `isFounder`, `isStakeholder`, `availableProviders`.

## Interfaces
- **Backend endpoints called:** `GET /backend/founder-ai-providers/keys?orgId=...` - list the org's active keys plus the caller's role.
- **Database (via backend):** `AIProviderKeyModel` (`server/models/aiProviderKey.model.ts`) - read.
- **Browser storage / cookies:** localStorage `garage_org_id` (read), `garage_tok` (read via `getToken`), `garage_selected_ai_provider` (read/write).

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper against `NEXT_PUBLIC_API_URL`; `lib/auth.ts` - `getToken()`.
- **Packages:** `react` - state, effects, callbacks.

## Used by
- `components/dashboard/AIProviderSelector.tsx`
- `components/dashboard/AskCabinetSidebar.tsx`
- `components/dashboard/BettyDashboardPage.tsx`

## Notes
- The file has no `"use client"` directive and reads `localStorage` inside the effect, so it is only safe in client components (all current callers are).
- Each component that uses the hook makes its own request; there is no shared cache, and changing the selection in one component does not update another mounted instance until it refetches.
- The org id is read once per fetch; switching organisation requires `refetch()` or a remount.
