# `lib/featureFlags.ts`

> Client-side feature flags compiled in at build time; currently a single kill-switch for the $24/month OpenClaw agent subscription UI.

**Kind:** frontend library · **Lines:** 38

## Purpose
Centralises UI-visibility flags that come from `NEXT_PUBLIC_*` environment variables. Its one flag decides whether the app shows the per-agent monthly subscription model or runs in pay-as-you-go-only mode, where users pay only for token usage from their wallet balance.

## How it works
`SUBSCRIPTIONS_ENABLED` is `true` only when `NEXT_PUBLIC_ENFORCE_AGENT_SUBSCRIPTION` is exactly the string `"true"`; anything else (including unset) gives `false`, the documented default. Because Next.js inlines `NEXT_PUBLIC_*` values at build time, changing it requires a rebuild or dev-server restart.

When `false`:
- agent cards do not show the "Locked" state or "Unlock ($24)" button (`OpenClawAgentPage.tsx` only treats an agent as locked when the flag is on and `subscription_status === "locked"`);
- agent creation does not surface "$24 required" toasts;
- `OfficeSubscriptionLock` returns its children unchanged (no overlay, no billing polling).

The Billing sidebar entry and the pay-as-you-go `OpenClawBillingPage` stay visible either way, since users still need to top up credits.

## Exports
- `SUBSCRIPTIONS_ENABLED: boolean` - whether subscription enforcement UI is shown.

## Interfaces
- **Environment variables:** `NEXT_PUBLIC_ENFORCE_AGENT_SUBSCRIPTION` - set to `"true"` to enable the subscription UI.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `components/dashboard/OfficeSubscriptionLock.tsx` - becomes a pass-through when the flag is off.
- `components/dashboard/OpenClawAgentPage.tsx` - gates the locked-agent state.
- `app/(dashboard)/layout.tsx` mentions the flag in a comment about keeping the Billing entry visible but does not import it.

## Notes
- This is UI only, not security. The comment points to a matching server-side flag, `ENFORCE_AGENT_SUBSCRIPTION` in `agent_manager/config.py`, which belongs to the external OpenClaw agent manager service, not to this repo. Keep the two in sync.
