# `lib/payment-methods-api.ts`

> Module exporting `listPaymentMethods`, `createStripeSetupIntent`, `deleteStripePaymentMethod`, `setStripeDefaultPaymentMethod` and 3 more.

**Kind:** frontend library · **Lines:** 139

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SavedStripeMethod` | interface |  | 10 |
| `SavedRazorpayToken` | interface |  | 31 |
| `PaymentMethodsResponse` | interface |  | 60 |
| `listPaymentMethods` | function | `listPaymentMethods(): Promise<PaymentMethodsResponse>` | 72 |
| `SetupIntentResponse` | interface |  | 76 |
| `createStripeSetupIntent` | function | `createStripeSetupIntent(): Promise<SetupIntentResponse>` | 84 |
| `deleteStripePaymentMethod` | function | `deleteStripePaymentMethod(pmId: string): Promise<{ success: true; removed: boolean }>` | 90 |
| `setStripeDefaultPaymentMethod` | function | `setStripeDefaultPaymentMethod(pmId: string): Promise<{ success: true }>` | 96 |
| `RazorpaySaveCardOrderResponse` | interface |  | 104 |
| `createRazorpaySaveCardOrder` | function | `createRazorpaySaveCardOrder(): Promise<RazorpaySaveCardOrderResponse>` — Create a ₹1 auth order for saving a card via Standard Checkout. | 119 |
| `deleteRazorpayToken` | function | `deleteRazorpayToken(tokenId: string): Promise<{ success: true; removed: boolean }>` | 126 |
| `setRazorpayDefaultToken` | function | `setRazorpayDefaultToken(tokenId: string): Promise<{ success: true }>` | 132 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/payment-methods` (L73)
  - `POST /backend/payment-methods/stripe/setup-intent` (L85)
  - `DELETE /backend/payment-methods/stripe/${pmId}` (L93)
  - `PATCH /backend/payment-methods/stripe/${pmId}/default` (L99)
  - `POST /backend/payment-methods/razorpay/save-card-order` (L120)
  - `DELETE /backend/payment-methods/razorpay/${tokenId}` (L129)
  - `PATCH /backend/payment-methods/razorpay/${tokenId}/default` (L135)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:** none

## Used by

- `components/checkout/PaymentMethodSelector.tsx`
- `components/dashboard/PaymentMethodsPanel.tsx`
