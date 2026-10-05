# `server/services/mailer.ts`

> Module exporting `senderForHost`, `senderForOrg`, `sendMail`, `inviteEmailTemplate` and 20 more.

**Kind:** backend service · **Lines:** 1403

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EMAIL_FROM_OTP` | const | `= "Garage <noreply@garageauth.com>"` — Initial OTP emails (first-time login, checkout verification, etc.) | 9 |
| `EMAIL_FROM_RESEND_OTP` | const | `= "Garage <noreply@garageauth.com>"` — Resend OTP emails (retry / resend flows) | 12 |
| `EMAIL_FROM_NOTIFICATION` | const | `= "Garage <noreply@mail.garagemail.in>"` — Non-OTP emails (notifications, invites, bulk, subscriptions, events) | 15 |
| `senderForHost` | function | `async senderForHost(req: { headers?: Record<string, any> } \| null \| undefined, fallback: string = EMAIL_FROM_NOTIFICATION): Promise<string>` — The from-address implied by the site a request came from. | 29 |
| `senderForOrg` | function | `async senderForOrg(orgId?: string \| { toString(): string } \| null, fallback: string = EMAIL_FROM_NOTIFICATION): Promise<string>` — The from-address for an organization's mail. | 61 |
| `sendMail` | function | `async sendMail(to: string, subject: string, html: string, text?: string, from?: string, cc?: string \| string[])` — Sends an email using Resend. | 91 |
| `inviteEmailTemplate` | function | `inviteEmailTemplate(email: string, code: string, orgId: string)` — This template function remains unchanged as it only generates content. | 127 |
| `guestRequestEmailTemplate` | function | `guestRequestEmailTemplate(email: string, orgName: string)` — Guest request confirmation email template | 155 |
| `guestApprovalEmailTemplate` | function | `guestApprovalEmailTemplate(email: string, code: string, orgId: string, orgName: string)` — Guest approval email template (sent when founder approves) | 172 |
| `guestRejectionEmailTemplate` | function | `guestRejectionEmailTemplate(email: string, orgName: string)` — Guest rejection email template (optional) | 204 |
| `sendEventGuestInvitation` | function | `async sendEventGuestInvitation(guestEmail: string, eventDetails: { title: string; description: string; startTi…, joinLink: string)` — Send event guest invitation email | 220 |
| `sendEventCancellationEmail` | function | `async sendEventCancellationEmail(guestEmail: string, eventDetails: { title: string; startTime: Date; endTime: Da…)` — Send event cancellation email to guest | 352 |
| `subscriptionActivatedTemplate` | function | `subscriptionActivatedTemplate(data: { userName: string; itemName: string; itemType: strin…)` — Email template for subscription activation | 447 |
| `subscriptionPaymentSuccessTemplate` | function | `subscriptionPaymentSuccessTemplate(data: { userName: string; itemName: string; amount: number;…)` — Email template for successful subscription payment | 510 |
| `subscriptionPaymentFailedTemplate` | function | `subscriptionPaymentFailedTemplate(data: { userName: string; itemName: string; amount: number;…)` — Email template for subscription payment failure | 568 |
| `subscriptionHaltedTemplate` | function | `subscriptionHaltedTemplate(data: { userName: string; itemName: string; })` — Email template for subscription halted (access revoked) | 627 |
| `subscriptionCancelledTemplate` | function | `subscriptionCancelledTemplate(data: { userName: string; itemName: string; accessEndDate: …)` — Email template for subscription cancelled | 671 |
| `sendSubscriptionEmail` | function | `async sendSubscriptionEmail(to: string, template: { subject: string; html: string })` — Send subscription email | 727 |
| `accountDeletionOtpTemplate` | function | `accountDeletionOtpTemplate(email: string, code: string)` — Account deletion verification email template | 737 |
| `podInviteEmailTemplate` | function | `podInviteEmailTemplate(data: { recipientName?: string; productName: string; priceL…)` — Email sent when a distributor is invited (or reminded) to purchase the POD product and claim their seat. | 799 |
| `bat246OfficeInviteEmailTemplate` | function | `bat246OfficeInviteEmailTemplate(data: { recipientName?: string; productName: string; priceL…)` — Sent by the admin "+ Invite" flow on the Distributors page to recruit a brand-new prospect (no Garage account yet) into the Bat246 program. | 832 |
| `bat246LayawayRequestEmailTemplate` | function | `bat246LayawayRequestEmailTemplate(data: { eligibleName?: string; requesterName: string; recip…)` — Sent to the eligible person a Layaway "Request" is asking to give B2 Coins — see createLayawayRequest() in bat246Layaway.service.ts, which imports this alongside the in-app bell notification (this email must never block that request if sen… | 866 |
| `bat246SnapBackLoanRequestEmailTemplate` | function | `bat246SnapBackLoanRequestEmailTemplate(data: { eligibleName?: string; borrowerName: string; amount…)` — Explicitly distinct wording from bat246LayawayRequestEmailTemplate above — a Snap Back Loan is a debt the borrower must repay from their own future earnings, not a no-strings coin gift, and the eligible person approving it should understan… | 899 |
| `couponAssignedEmailTemplate` | function | `couponAssignedEmailTemplate(args: { recipientName?: string; assignerLabel: string; // "…)` — Email template for admin/founder-originated coupon rewards. | 1018 |
| `couponGiftedEmailTemplate` | function | `couponGiftedEmailTemplate(args: { recipientName?: string; senderName: string; coupon:…)` — Email template for peer-to-peer coupon gifts (one user gifting to another). | 1051 |
| `OfferEmailPlan` | interface | One row of a catalog offer email — a subset of `ComboQuote`. | 1082 |
| `offerMagicLinkTemplate` | function | `offerMagicLinkTemplate(input: { recipientName?: string \| null; senderName?: string…)` — NetworkChain offer magic link. | 1140 |
| `offerReminderTemplate` | function | `offerReminderTemplate(input: { recipientName?: string \| null; clientName: string;…)` — Countdown reminder for an unclaimed NetworkChain offer. | 1354 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.RESEND_API_KEY`, `env.RESEND_FROM`, `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `resend` — `Resend`

## Used by

- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/services/bat246BoardInvite.service.ts`
- `server/bat246/services/bat246Layaway.service.ts`
- `server/bat246/services/bat246PodInvite.service.ts`
- `server/bat246/services/bat246SnapBackLoan.service.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/downlines.ts`
- `server/routes/eventManagement.ts`
- `server/routes/events.ts`
- `server/routes/guestAuth.ts`
- `server/routes/invites.ts`
- `server/routes/invoice.ts`
- `server/routes/jobsFounder.ts`
- `server/routes/joinRequests.ts`
- `server/routes/magicLink.ts`
- `server/routes/membership.ts`
- `server/routes/productCheckout.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/serviceCheckout.ts`
- _…and 21 more_
