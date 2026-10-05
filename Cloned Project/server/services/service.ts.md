# `server/services/service.ts`

> Module exporting `resolveMilestoneTiming`, `createService`, `updateService`, `deleteService` and 24 more.

**Kind:** backend service · **Lines:** 1457

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `resolveMilestoneTiming` | function | `resolveMilestoneTiming(servicePaymentTiming: "free" \| "pay_before_milestone" \| "pa…, milestoneTiming?: "advance" \| "on_completion" \| null): "advance" \| "on_completion" \| null` | 36 |
| `MilestoneAttachmentInput` | interface |  | 49 |
| `MilestoneInput` | interface |  | 56 |
| `CreateServiceData` | interface |  | 68 |
| `createService` | function | `async createService(data: CreateServiceData): Promise<IService>` | 105 |
| `UpdateServiceData` | interface |  | 176 |
| `updateService` | function | `async updateService(serviceId: string, organizationId: string, data: UpdateServiceData): Promise<IService \| null>` | 211 |
| `deleteService` | function | `async deleteService(serviceId: string, organizationId: string): Promise<boolean>` | 315 |
| `getServiceById` | function | `async getServiceById(serviceId: string, organizationId: string): Promise<IService \| null>` | 345 |
| `getServiceBySlug` | function | `async getServiceBySlug(slug: string, organizationId: string): Promise<IService \| null>` | 355 |
| `GetServicesOptions` | interface |  | 365 |
| `getServices` | function | `async getServices(organizationId: string, options: GetServicesOptions = {}): Promise<{ services: IService[]; total: number; pa…` | 376 |
| `getAvailableServices` | function | `async getAvailableServices(organizationId: string, userId: string, userChannelIds: string[], options: GetServicesOptions = {}): Promise<{ services: IService[]; total: number; pa…` | 440 |
| `CreateMilestoneData` | interface |  | 519 |
| `addMilestone` | function | `async addMilestone(serviceId: string, organizationId: string, data: CreateMilestoneData): Promise<IService \| null>` | 530 |
| `UpdateMilestoneData` | interface |  | 566 |
| `updateMilestone` | function | `async updateMilestone(serviceId: string, milestoneId: string, organizationId: string, data: UpdateMilestoneData): Promise<IService \| null>` | 577 |
| `deleteMilestone` | function | `async deleteMilestone(serviceId: string, milestoneId: string, organizationId: string): Promise<IService \| null>` | 620 |
| `reorderMilestones` | function | `async reorderMilestones(serviceId: string, organizationId: string, milestoneIds: string[]): Promise<IService \| null>` | 652 |
| `OptInData` | interface |  | 692 |
| `optInToService` | function | `async optInToService(data: OptInData): Promise<IServiceOpt>` | 698 |
| `unlockedMilestoneIds` | function | `unlockedMilestoneIds(progress: IMilestoneProgress[]): Set<string>` — A milestone is reachable once it is first in line or its predecessor has been approved. | 862 |
| `redactLockedMilestoneFiles` | function | `redactLockedMilestoneFiles(optIn: T): T` — Strip files belonging to milestones the client has not unlocked yet. | 883 |
| `getOptIn` | function | `async getOptIn(serviceId: string, userId: string): Promise<IServiceOpt \| null>` | 906 |
| `getOptInById` | function | `async getOptInById(optInId: string): Promise<IServiceOpt \| null>` | 919 |
| `getUserOptIns` | function | `async getUserOptIns(userId: string, organizationId: string, options: { status?: string; page?: number; limit?: number }…): Promise<{ optIns: IServiceOpt[]; total: number; p…` | 926 |
| `getServiceOptIns` | function | `async getServiceOptIns(serviceId: string, options: { status?: string; page?: number; limit?: number }…): Promise<{ optIns: IServiceOpt[]; total: number; p…` | 966 |
| `cancelOptIn` | function | `async cancelOptIn(optInId: string, userId: string): Promise<IServiceOpt \| null>` | 999 |
| `startMilestone` | function | `async startMilestone(optInId: string, milestoneId: string, founderId: string): Promise<IServiceOpt \| null>` | 1038 |
| `completeMilestone` | function | `async completeMilestone(optInId: string, milestoneId: string, founderId: string, attachments?: { name: string; url: string; size?: number }[]): Promise<IServiceOpt \| null>` | 1106 |
| `PendingPayment` | interface |  | 1211 |
| `getPendingPayments` | function | `async getPendingPayments(userId: string, organizationId: string): Promise<PendingPayment[]>` | 1224 |
| `CreateReviewData` | interface |  | 1268 |
| `createReview` | function | `async createReview(data: CreateReviewData): Promise<IServiceReview>` | 1277 |
| `getServiceReviews` | function | `async getServiceReviews(serviceId: string, options: { publicOnly?: boolean; page?: number; limit?: num…): Promise<{ reviews: IServiceReview[]; total: numbe…` | 1325 |
| `updateReview` | function | `async updateReview(reviewId: string, userId: string, data: { rating?: number; comment?: string }): Promise<IServiceReview \| null>` | 1367 |
| `deleteReview` | function | `async deleteReview(reviewId: string, userId: string): Promise<boolean>` | 1387 |
| `getServiceStats` | function | `async getServiceStats(serviceId: string): Promise<{ totalOptIns: number; activeOptIns: numb…` | 1401 |

## Interfaces

- **Database (Mongoose models used):**
  - `Service` (server/models/service.model.ts) — reads: `findOne`, `countDocuments`, `find`, `findById`; **writes:** `new + save`, `updateOne`, `deleteOne`
  - `ServiceOpt` (server/models/serviceOpt.model.ts) — reads: `countDocuments`, `findOne`, `findById`, `find`, `aggregate`; **writes:** `new + save`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `ServiceReview` (server/models/serviceReview.model.ts) — reads: `findOne`, `countDocuments`, `find`, `aggregate`; **writes:** `new + save`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/models/service.model.ts` — `Service`, `IService`, `IMilestone`, `IServiceHourlyConfig`, `IServiceTaskroomConfig`
  - `server/models/founderAlerts.schema.ts` — `normalizeFounderAlerts`, `FounderAlertsInput`
  - `server/models/serviceOpt.model.ts` — `ServiceOpt`, `IServiceOpt`, `IMilestoneProgress`
  - `server/models/serviceReview.model.ts` — `ServiceReview`, `IServiceReview`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/service.ts`
- `server/routes/serviceCheckout.ts`
