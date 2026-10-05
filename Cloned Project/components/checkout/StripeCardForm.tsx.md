# `components/checkout/StripeCardForm.tsx`

> Client-side Stripe card checkout form: either an embedded Stripe `PaymentElement` plus a custom billing-address form, or a no-form 3DS confirmation for a saved card, both confirming a PaymentIntent the backend already created.

**Kind:** React component · **Lines:** 672

## Purpose
Card payments in the shared checkout go through Stripe. The backend creates a PaymentIntent and hands the parent (`PaymentMethodSelector`) a `clientSecret` and a `publishableKey`. This component takes those values and finishes the payment in the browser. Card data stays inside Stripe's iframe (`PaymentElement`), so card numbers never touch Garage code (PCI scope stays with Stripe). It also collects the billing name and address that Stripe India requires for export (non-INR) card payments. When the PaymentIntent was created for a saved card and only needs a 3DS/OTP challenge, it skips the form and confirms the intent straight away.

## How it works

### Stripe loader cache (L51-L60)
`getStripePromise(publishableKey)` memoises `loadStripe()` per publishable key in a module-level `Map`, so re-renders and remounts never load Stripe.js twice for the same key. The default component wraps the call in `useMemo` keyed on `publishableKey`.

### Country normalisation (L62-L72)
`toIsoCountry(input)` turns whatever the user profile holds ("India", "in", "IN") into the ISO-2 code Stripe expects. Two-letter input is upper-cased. Anything longer is matched case-insensitively against country names from `country-state-city`. If nothing matches it returns `""`, and the form then counts as incomplete.

### Top-level branch (L74-L137)
- `saved3DSOnly === true` renders `SavedCard3DSConfirm`. No `Elements` provider and no billing form are used.
- Otherwise it renders `<Elements>` with the `clientSecret` and a dark "night" appearance theme. `colorPrimary` comes from `getBrandHex()`, which reads the `--brand` CSS variable so white-label brands carry into the Stripe iframe. Inside sits `InnerForm`.

### `SavedCard3DSConfirm` (L139-L287)
This is the saved-card reuse path, for example an INR saved card where the backend returned `requires_action`.
- On mount, and again whenever `clientSecret` changes, `runConfirm()` calls `stripe.confirmCardPayment(clientSecret)`. That call uses the payment method already attached to the PI and opens Stripe's 3DS/OTP challenge.
- The call races a 300 s (5-minute) timeout. If the timeout wins, the component shows a calm "still processing, don't close or retry" message and **does not** call `onError`. The comments explain why: an error toast would invite a retry, and a retry while the first confirmation is still in flight risks a double charge. The parent's invoice-status polling or the webhook settles the outcome instead.
- On a Stripe error it shows the message and calls `onError(msg)`. On `status === "succeeded"` it calls `onPaid(paymentIntent.id)` and ignores anything `onPaid` throws, because the money has already moved. Any other status shows "Payment is <status>".
- UI states: `loading`/`confirming` (spinner, "Confirming <amount> with your bank…"), `succeeded`, and `error` (message plus a **Try again** button that runs `runConfirm` again).

### `InnerForm`: fresh-card entry (L289-L671)
- **State:** the `billing` object (name, line1, line2, city, state, postal_code, country) is pre-filled from `customerName`/`customerAddress`. Other state: `submitting`, `errorMsg`, `ready` (set by `PaymentElement.onReady`) and `showCountrySuggestions`. The error clears whenever `amount` or `currency` changes.
- **Country autocomplete:** a sorted list of every country name, filtered by substring and capped at 50 shown suggestions. Each suggestion uses `onMouseDown preventDefault` and the input closes the list 150 ms after blur, so a click lands before the list disappears.
- **Completeness:** `isComplete` needs name, line1, city, state, postal code and a country that `toIsoCountry` can resolve. Line 2 is optional. The Pay button stays disabled until Stripe and Elements are loaded, `ready` is true, the form is complete and nothing is submitting.
- **Submit (`handleSubmit`):** calls `stripe.confirmPayment({ elements, redirect: "if_required", confirmParams })`. `confirmParams` carries `receipt_email` and `payment_method_data.billing_details` (trimmed name, email and address with the ISO country). The call races the same 300 s timeout with the same "still processing, don't call onError" policy. After that, a Stripe error leads to `onError`, `succeeded` leads to `await onPaid(id)`, and any other status (such as `processing`) shows an informational message.
- **PaymentElement options:** `layout: "tabs"`. `billingDetails` sets name, email and address individually to `"never"`, because those values come from the custom inputs. Phone is left out on purpose: the string form `billingDetails: "never"` would make Stripe require a phone number in `confirmParams` and throw.
- **USD Amex warning:** when `currency` is `usd`, an amber banner warns that Amex is not supported. Stripe India rejects Amex USD charges until an Importer/Exporter Code (IEC) is registered. Visa and Mastercard work through presentment-currency conversion.
- **Amount display:** `Intl.NumberFormat("en-US", { style: "currency" })` on `amount / 100`, so `amount` is in minor units (cents/paise).

## Exports
- `default StripeCardForm(props: StripeCardFormProps)`: the checkout card form. Props:
  - `clientSecret`, `publishableKey`: from the backend-created PaymentIntent.
  - `amount` (minor units) and `currency`: used for display only. The charge itself is fixed by the PI.
  - `customerEmail?`, `customerName?`, `customerAddress?: BillingAddress`: pre-fill values and receipt email.
  - `onPaid(paymentIntentId)`: called after the PI succeeds. May be async.
  - `onError?(message)`: called on Stripe-reported failures, never on timeout.
  - `saved3DSOnly?`: when `true`, use the saved-card 3DS-only flow. Defaults to `false`.
- `interface BillingAddress { line1?, line2?, city?, state?, postal_code?, country? }`: the shape of the address pre-fill.

`StripeCardFormProps`, `SavedCard3DSConfirm`, `InnerForm`, `getStripePromise` and `toIsoCountry` are internal and not exported.

## Interfaces
- **External services:** Stripe.js. It loads via `loadStripe`. `confirmPayment` handles fresh cards and `confirmCardPayment` handles saved cards. Stripe-hosted 3DS challenges and redirects may run during either call. The component makes no Garage backend calls itself: creating the PaymentIntent and fulfilling the order are the parent's job.

## Dependencies
- **Internal:**
  - `components/ui/button.tsx`, `components/ui/input.tsx`, `components/ui/label.tsx`: shadcn UI primitives.
  - `lib/utils.ts`: `cn` class merging.
  - `lib/brand-color-context.tsx`: `getBrandHex()`, which supplies the Stripe appearance primary colour from the `--brand` CSS variable.
- **Packages:**
  - `@stripe/stripe-js`: `loadStripe` and the `Stripe` type.
  - `@stripe/react-stripe-js`: `Elements`, `PaymentElement`, `useStripe` and `useElements`.
  - `country-state-city`: the country list for autocomplete and ISO lookup.
  - `lucide-react`: the `Loader2` and `ShieldCheck` icons.
  - `react`: hooks.

## Used by
- `components/checkout/PaymentMethodSelector.tsx`. It renders this form inline once it holds a `stripeIntent`, passing `saved3DSOnly={stripeIntent.savedCardFlow}`, `onPaid={handleStripeSucceeded}` and buyer-profile pre-fill. A "Use a different payment method" button sits underneath.

## Notes
- **Comment and constant disagree:** the long comment in `handleSubmit` (L365-L378) talks about a "3-minute" / "180s" timeout, but `CONFIRM_TIMEOUT_MS` is `300_000` (5 minutes) in both flows.
- The timeout `setTimeout`s are never cleared. That does no harm because the sentinel is ignored once the race settles, but the timer stays alive for the full 5 minutes.
- In the saved-card flow the timeout message says "don't retry", yet the error state still shows **Try again**. Clicking it calls `confirmCardPayment` again on the same PI. Stripe treats a PI as one charge, but the UI contradicts its own advice.
- `amount` and `currency` affect display only. Changing them does not change what Stripe charges.
- Billing details are gathered by Garage's own inputs (not Stripe's) to control the UX and to meet Stripe India's export-payment rules.
