# `server/services/call.ts`

> Module exporting `createCallOffering`, `getCallOfferingById`, `getCallOfferingsByOrganization`, `getPublishedCallOfferings` and 19 more.

**Kind:** backend service · **Lines:** 825

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `createCallOffering` | function | `async createCallOffering(data: CreateCallOfferingInput): Promise<ICallOffering>` | 37 |
| `getCallOfferingById` | function | `async getCallOfferingById(callId: string): Promise<ICallOffering \| null>` | 72 |
| `getCallOfferingsByOrganization` | function | `async getCallOfferingsByOrganization(orgId: string, options: GetCallOfferingsOptions = {}): Promise<ICallOffering[]>` | 87 |
| `getPublishedCallOfferings` | function | `async getPublishedCallOfferings(orgId: string, channelIds?: string[]): Promise<ICallOffering[]>` | 111 |
| `updateCallOffering` | function | `async updateCallOffering(callId: string, data: UpdateCallOfferingInput): Promise<ICallOffering \| null>` | 146 |
| `deleteCallOffering` | function | `async deleteCallOffering(callId: string): Promise<boolean>` | 169 |
| `addIntakeQuestion` | function | `async addIntakeQuestion(callId: string, questionData: AddIntakeQuestionInput): Promise<ICallOffering \| null>` | 195 |
| `updateIntakeQuestion` | function | `async updateIntakeQuestion(callId: string, questionId: string, data: Partial<AddIntakeQuestionInput>): Promise<ICallOffering \| null>` | 219 |
| `deleteIntakeQuestion` | function | `async deleteIntakeQuestion(callId: string, questionId: string): Promise<ICallOffering \| null>` | 247 |
| `reorderIntakeQuestions` | function | `async reorderIntakeQuestions(callId: string, questionIds: string[]): Promise<ICallOffering \| null>` | 267 |
| `purchaseCalls` | function | `async purchaseCalls(data: PurchaseCallsInput): Promise<ICallPurchase>` | 317 |
| `getUserCallPurchases` | function | `async getUserCallPurchases(userId: string, orgId: string): Promise<ICallPurchase[]>` | 388 |
| `getCallOfferingPurchases` | function | `async getCallOfferingPurchases(callOfferingId: string): Promise<ICallPurchase[]>` | 406 |
| `getPurchaseById` | function | `async getPurchaseById(purchaseId: string): Promise<ICallPurchase \| null>` | 418 |
| `getFounderAvailableSlots` | function | `async getFounderAvailableSlots(founderId: string, callOfferingId: string, date: Date, orgId: string): Promise<TimeSlot[]>` | 438 |
| `createCallBooking` | function | `async createCallBooking(data: CreateCallBookingInput): Promise<ICallBooking>` | 526 |
| `getBookerBookings` | function | `async getBookerBookings(bookerId: string, orgId: string): Promise<ICallBooking[]>` | 595 |
| `getFounderBookings` | function | `async getFounderBookings(founderId: string, orgId: string, filters?: { status?: string; startDate?: Date; endDate?: Da…): Promise<ICallBooking[]>` | 609 |
| `completeCallBooking` | function | `async completeCallBooking(bookingId: string, completedBy: string, founderNotes?: string): Promise<ICallBooking \| null>` | 645 |
| `cancelCallBooking` | function | `async cancelCallBooking(bookingId: string, cancelledBy: string, reason?: string): Promise<ICallBooking \| null>` | 679 |
| `rescheduleCallBooking` | function | `async rescheduleCallBooking(bookingId: string, newStartTime: Date): Promise<ICallBooking \| null>` | 706 |
| `rateCallBooking` | function | `async rateCallBooking(bookingId: string, rating: number, review?: string): Promise<ICallBooking \| null>` | 749 |
| `getCallOfferingStats` | function | `async getCallOfferingStats(callOfferingId: string): Promise<CallOfferingStats>` | 800 |

## Interfaces

- **Database (Mongoose models used):**
  - `CallOffering` (server/models/callOffering.model.ts) — reads: `findById`, `find`; **writes:** `new + save`, `findByIdAndUpdate`, `findByIdAndDelete`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `countDocuments`, `find`, `findById`; **writes:** `new + save`, `findByIdAndUpdate`
  - `Availability` (server/models/availability.model.ts) — reads: `findOne`
  - `CallBooking` (server/models/callBooking.model.ts) — reads: `find`, `findOne`, `findById`; **writes:** `new + save`

## Dependencies

- **Internal:**
  - `server/models/callOffering.model.ts` — `CallOffering`, `ICallOffering`, `IIntakeQuestion`
  - `server/models/callPurchase.model.ts` — `CallPurchase`, `ICallPurchase`
  - `server/models/callBooking.model.ts` — `CallBooking`, `ICallBooking`
  - `server/models/availability.model.ts` — `Availability`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/call.ts`
- `server/routes/callBooking.ts`
- `server/routes/callCheckout.ts`
- `server/services/invoice.ts`
- `server/services/itemReserveLicense.ts`
