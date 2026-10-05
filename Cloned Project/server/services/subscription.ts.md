# `server/services/subscription.ts`

> Module exporting `createSubscriptionPlan`, `getSubscriptionPlanForItem`, `getSubscriptionPlan`, `deactivateSubscriptionPlan` and 18 more.

**Kind:** backend service · **Lines:** 1112

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CreatePlanInput` | interface |  | 114 |
| `createSubscriptionPlan` | function | `async createSubscriptionPlan(input: CreatePlanInput): Promise<ISubscriptionPlan>` — Create a subscription plan for a content item | 137 |
| `getSubscriptionPlanForItem` | function | `async getSubscriptionPlanForItem(itemType: SubscriptionItemType, itemId: string): Promise<ISubscriptionPlan \| null>` — Get subscription plan for an item | 234 |
| `getSubscriptionPlan` | function | `async getSubscriptionPlan(planId: string): Promise<ISubscriptionPlan \| null>` — Get subscription plan by ID | 248 |
| `deactivateSubscriptionPlan` | function | `async deactivateSubscriptionPlan(planId: string): Promise<ISubscriptionPlan \| null>` — Deactivate a subscription plan | 257 |
| `CreateSubscriptionInput` | interface |  | 269 |
| `createUserSubscription` | function | `async createUserSubscription(input: CreateSubscriptionInput): Promise<ISubscription>` — Create a subscription for a user | 280 |
| `getUserSubscription` | function | `async getUserSubscription(userId: string, itemType: SubscriptionItemType, itemId: string): Promise<ISubscription \| null>` — Get user's subscription for an item | 387 |
| `getUserActiveSubscription` | function | `async getUserActiveSubscription(userId: string, itemType: SubscriptionItemType, itemId: string): Promise<ISubscription \| null>` — Get user's active subscription for an item | 404 |
| `getUserSubscriptions` | function | `async getUserSubscriptions(userId: string, options: { status?: SubscriptionStatus \| SubscriptionStatus…): Promise<{ subscriptions: ISubscription[]; total: …` — Get all subscriptions for a user | 420 |
| `cancelUserSubscription` | function | `async cancelUserSubscription(subscriptionId: string, cancelAtCycleEnd: boolean = true): Promise<ISubscription>` — Cancel a subscription | 455 |
| `pauseUserSubscription` | function | `async pauseUserSubscription(subscriptionId: string): Promise<ISubscription>` — Pause a subscription | 494 |
| `resumeUserSubscription` | function | `async resumeUserSubscription(subscriptionId: string): Promise<ISubscription>` — Resume a paused subscription | 528 |
| `handleSubscriptionAuthenticated` | function | `async handleSubscriptionAuthenticated(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription authenticated event | 564 |
| `handleSubscriptionActivated` | function | `async handleSubscriptionActivated(razorpaySubscription: RazorpaySubscription, payment?: any): Promise<void>` — Handle subscription activated event (first payment successful) | 589 |
| `handleSubscriptionCharged` | function | `async handleSubscriptionCharged(razorpaySubscription: RazorpaySubscription, payment: any): Promise<void>` — Handle subscription charged event (recurring payment successful) | 647 |
| `handleSubscriptionPending` | function | `async handleSubscriptionPending(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription pending event | 703 |
| `handleSubscriptionHalted` | function | `async handleSubscriptionHalted(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription halted event (payment failed after retries) | 732 |
| `handleSubscriptionCancelled` | function | `async handleSubscriptionCancelled(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription cancelled event | 765 |
| `handleSubscriptionCompleted` | function | `async handleSubscriptionCompleted(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription completed event | 797 |
| `handleSubscriptionPaused` | function | `async handleSubscriptionPaused(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription paused event | 827 |
| `handleSubscriptionResumed` | function | `async handleSubscriptionResumed(razorpaySubscription: RazorpaySubscription): Promise<void>` — Handle subscription resumed event | 859 |
| `hasSubscriptionAccess` | function | `async hasSubscriptionAccess(userId: string, itemType: SubscriptionItemType, itemId: string): Promise<boolean>` — Check if user has active subscription access to an item | 1056 |
| `syncSubscriptionStatus` | function | `async syncSubscriptionStatus(subscriptionId: string): Promise<ISubscription \| null>` — Sync subscription status with Razorpay | 1085 |

## Interfaces

- **Database (Mongoose models used):**
  - `SubscriptionPlan` (server/models/subscriptionPlan.model.ts) — reads: `findOne`, `findById`; **writes:** `create`, `findByIdAndUpdate`
  - `Subscription` (server/models/subscription.model.ts) — reads: `findOne`, `find`, `countDocuments`, `findById`; **writes:** `updateMany`, `create`
  - `SubscriptionPayment` (server/models/subscriptionPayment.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`

## Dependencies

- **Internal:**
  - `server/models/subscriptionPlan.model.ts` — `SubscriptionPlan`, `ISubscriptionPlan`, `SubscriptionItemType`, `SubscriptionPeriod`
  - `server/models/subscription.model.ts` — `Subscription`, `ISubscription`, `SubscriptionStatus`
  - `server/models/subscriptionPayment.model.ts` — `SubscriptionPayment`, `ISubscriptionPayment`
  - `server/services/razorpay.ts` — `createPlan as createRazorpayPlan`, `createSubscription as createRazorpaySubscription`, `fetchSubscription as fetchRazorpaySubscription`, `cancelSubscription as cancelRazorpaySubscription`, `pauseSubscription as pauseRazorpaySubscription`, `resumeSubscription as resumeRazorpaySubscription`, `RazorpaySubscription`
  - `server/services/commission.ts` — `distributeCommissions`
  - `server/services/socket.ts` — `getSocketInstance`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/subscriptionAdmin.ts`
- `server/routes/subscriptions.ts`
- `server/routes/webhook.ts`
- `server/routes/workshop.ts`

## Notes

- `subscription.ts`:1022 — TODO: Implement access granting based on itemType
- `subscription.ts`:1040 — TODO: Implement access revocation based on itemType
