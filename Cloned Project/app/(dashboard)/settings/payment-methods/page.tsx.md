# `app/(dashboard)/settings/payment-methods/page.tsx`

> Standalone Next.js page at `/settings/payment-methods` that renders the shared saved-cards panel inside a dark, centred container.

**Kind:** Next.js page · **Lines:** 19 · **Route:** `/settings/payment-methods`

## Purpose
Gives users a direct URL for managing their saved payment methods. All behaviour lives in `PaymentMethodsPanel`; the Vault page (`WalletPageNew`, "Payment Methods" tab) renders the same panel inline, so the two surfaces stay identical by construction.

## How it works
- Client component (`"use client"`).
- Renders a full-height `#0a0a0f` background with padding and a `max-w-3xl` centred column containing `<PaymentMethodsPanel />` with no props.
- The panel itself (see `components/dashboard/PaymentMethodsPanel.tsx`) lists Stripe cards (added through a SetupIntent with Stripe Elements) and Razorpay INR card tokens (added through a Rs 1 authorisation that is auto-refunded), and supports set-default and remove. Its API calls go through `lib/payment-methods-api.ts`.

## Exports
- `default PaymentMethodsPage()` - the page component.

## Dependencies
- **Internal:** `components/dashboard/PaymentMethodsPanel.tsx` - the saved-cards UI and all its logic.

## Used by
Reached by Next.js routing at `/settings/payment-methods` (the `(dashboard)` route group does not appear in the URL, but the dashboard layout wraps it). No file imports it.
