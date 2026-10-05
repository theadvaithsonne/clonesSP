/**
 * Client-side feature flags.
 *
 * These are compiled into the bundle at build time via Next.js's
 * `NEXT_PUBLIC_*` env var mechanism. Flip them by setting the env var
 * and rebuilding/restarting the dev server.
 *
 * NOTE: These are for UI visibility only. The backend has its own set of
 * flags (e.g. `ENFORCE_AGENT_SUBSCRIPTION` in agent_manager/config.py)
 * that enforce the same decisions server-side. A malicious client who
 * bypasses the frontend flag will still be blocked by the backend flag
 * if the backend is enforcing the subscription model.
 */

/**
 * Master kill-switch for the $24/month agent subscription UI.
 *
 * When `false` (default), the app runs in pay-as-you-go-only mode:
 *  - Agent cards no longer show "Locked" state or the "Unlock ($24)" button
 *  - Agent creation flow does not surface "$24 required" toasts
 *  - The `OfficeSubscriptionLock` dashboard wrapper becomes a pass-through
 *    (no org-level subscription lock overlay, no billing polling)
 *
 * What STAYS visible regardless of this flag:
 *  - The "Billing" sidebar entry and the `OpenClawBillingPage` — that's the
 *    pay-as-you-go wallet page (top-up, credits, payment methods, usage
 *    stats, billing history). Users still need it to add credits.
 *
 * When `true`, subscription enforcement is restored. This matches the
 * backend `ENFORCE_AGENT_SUBSCRIPTION` flag — keep both in sync.
 *
 * Default is `false` because we're currently growing the user base and
 * don't want to gate agent usage behind a monthly fee — users are only
 * charged for actual token usage via the wallet balance system.
 */
export const SUBSCRIPTIONS_ENABLED: boolean =
  process.env.NEXT_PUBLIC_ENFORCE_AGENT_SUBSCRIPTION === "true";
