# `server/models/service.model.ts`

> Mongoose model for a founder's professional service offering: milestone-priced or hourly/retainer-billed engagements, with detail-page content, visibility rules and a Taskroom board blueprint that is provisioned for each client who opts in.

**Kind:** Mongoose model · **Lines:** 668

## Purpose
A `Service` is a sellable engagement (for example "UI/UX Design & Strategy, 4-12 weeks") that a client "opts into". It is priced either by **milestones** (each with its own payment amount and timing) or as a **billable** hourly/retainer engagement billed from hours logged in Taskroom. On opt-in a `ServiceOpt` is created and, if enabled, a Taskroom engagement room is provisioned from the `taskroomConfig` blueprint stored here. The model is also one of the catalogue models mirrored to NetworkChainApi.

## How it works

### Milestones (L8-L30, L242-L300)
- `IMilestoneAttachment` / `MilestoneAttachmentSchema`: `name`, `url` (required), `size`, `contentType`.
- `MilestoneSchema`: explicit `_id` (default new `ObjectId`, though automatic ids are disabled), `order`, `title` (required), `description`, `duration` (free text such as "1-2 weeks"), `deliverables[]`, `attachments[]`, `paymentAmount` (>= 0, required), `currency` (`INR`/`USD`, default `USD`), and optional `paymentTiming` (`advance` | `on_completion`). `paymentTiming` has **no default**: on legacy milestones the service-level `paymentTiming` decides, via `resolveMilestoneTiming()` in `server/services/service.ts`.

### Detail page (L32-L44, L302-L318)
`WhyChooseUsSchema` (`icon`, `title`, `description`) cards and `ServiceContactInfoSchema` (`phone`, `email`, `whatsapp`) for "Reach out to us".

### Taskroom blueprint (L46-L102, L320-L405)
- `ServiceTaskAssigneeSchema` - `userId` (required), `name`, `email`, `image`. Provisioning resolves `userId` to a Taskroom user, adds them to the room and creates the card in their name.
- `ServiceTaskTemplateSchema` - `title`, `description`, `kind` (`required` | `task` default | `internal`; drives the board badge and whether the card is cloned into the client-visible part of the room), `priority` (`low`/`medium` default/`high`), `subtasks[]` (cloned as Taskroom subtasks; milestone columns put each milestone's deliverables here), optional `assignee`.
- `ServiceStageTemplateSchema` - a Kanban column: `name`, `color` (default `#008080`), `stageType` (Taskroom v2: `tostart` default | `active` | `done` | `closed`), `isInternal`, `milestoneIndex` (set on columns generated from milestones), `tasks[]`.
- `ServiceClientAccessSchema` - what the client may see: `showTaskroomBoard`, `showActivityLogs`, `enableFilesTab`, `showProgressStatusGauge` (default `true`) and `revealTimelogSheet` (default `false`). The comment states these are enforced server-side by the board proxy, never by the browser.
- `ServiceTaskroomConfigSchema` - `enabled` (default `false`), `stages[]`, `clientAccess`, and optional pinned `workspaceId` / `spaceId` (otherwise provisioning resolves or creates a "Client Engagements" space in the founder's workspace).

### Hourly / retainer billing (L104-L155, L330-L341, L407-L436)
Used only when `pricingModel` is `"billable"`; milestones are not part of that model.
- Types `BillingModelType` (`hourly` | `retainer`), `BillingCycle` (`weekly` | `bi_weekly` | `monthly`), `BillingStartDay` (`1st_of_month` | `15th_of_month` | `contract_start` | `monday`).
- `ServiceHourlyConfigSchema`: `billingModelType` (default `hourly`), `hourlyRate`, `estimatedMonthlyHours` (a projection, not a floor), `noMinimumCommitment`, `billingCycle` (default `monthly`), `billingStartDay` (default `1st_of_month`), `hardCapEnabled` + `maxHoursPerMonth` (the route strips the max when the cap is off), `timesheetApprovalRequired` (default `true`), `securityDepositEnabled` + `securityDepositAmount`, and `team[]`.
- `ServiceTeamMemberSchema`: `userId` (required), `name`, `email`, `image`, `role`, and `payRate` - the internal hourly cost against the client-billed `hourlyRate`. Every team member is added to the provisioned Taskroom room.

### Main schema (L157-L240, L438-L635)
- Identity/display: `title`, `slug` (lower-cased, both required), `description`, `longDescription`, `icon`, `iconBgColor`, `coverImage`, `tags[]`, `features[]`, `deliverables[]`, `images[]`, `videos[]`, `youtubeUrl`, `category`, `duration`.
- Payment: `pricingModel` (`milestone` default | `billable`), `paymentTiming` (`free` default | `pay_before_milestone` | `pay_after_milestone`), `currency` (`INR`/`USD`, default `USD`), `totalPrice` (computed), `taxMode` (`inclusive` default | `exclusive` - tax added at invoice time), `bookingAdvanceFeeEnabled` + `bookingAdvanceFee` (upfront retainer at booking, separate from milestone payments), `cancellationPolicy`, `hourlyConfig`, `milestones[]`.
- Ownership: `organizationId` (ref `Organization`, indexed), `createdBy` (ref `User`), both required.
- `founderAlerts` - founder "someone opted in" alert field from `founderAlerts.schema.ts`.
- Visibility: `channelIds[]` (ref `Channel`), `allowedUserIds[]` (ref `User`; empty = visible to all, non-empty = only those users can see/opt in), `status` (`draft` default | `active` | `archived`).
- Stats: `projectsCompleted`, `activeOptIns` (default 0).
- `whyChooseUs`, `contactInfo`, `hourlyConfig`, `taskroomConfig` default to `undefined` (absent until set; services created before the Taskroom integration simply never provision a room).

### Indexes, hooks (L637-L667)
- Indexes: `{ organizationId, slug }` unique, `{ organizationId, status }`, `{ createdBy, status }`, `{ channelIds }`, `{ allowedUserIds }`.
- `pre("save")` recomputes `totalPrice` as the sum of `milestones[].paymentAmount` (0 when there are none). It does not run on `updateOne`/`findOneAndUpdate`, so writers using those must keep `totalPrice` in sync themselves.
- `installCatalogHooks(ServiceSchema, "service")` mirrors save/update/delete events into the catalogue outbox for NetworkChainApi.

## Exports
- `Service` - model `"Service"` (collection `services`).
- `IService` - document interface.
- `IMilestone`, `IMilestoneAttachment`, `IWhyChooseUs`, `IServiceContactInfo` - milestone and detail-page interfaces.
- `IServiceTaskAssignee`, `IServiceTaskTemplate`, `IServiceStageTemplate`, `IServiceClientAccess`, `IServiceTaskroomConfig` - Taskroom blueprint interfaces.
- `IServiceHourlyConfig`, `IServiceTeamMember` - billable engagement interfaces.
- `BillingModelType`, `BillingCycle`, `BillingStartDay` - string union types.

## Interfaces
- **Database:** `Service` (collection `services`) - schema; writes enqueue `CatalogOutbox` entries.
- **External services:** Taskroom (external, `https://uatapi.garage.app`) receives rooms built from `taskroomConfig` via `server/services/taskroomProvision.ts`; NetworkChainApi via the catalogue outbox.

## Dependencies
- **Internal:** `server/models/_catalogHooks.ts` - catalogue outbox hooks; `server/models/founderAlerts.schema.ts` - founder alert field.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/routes/service.ts` (mounted at `/services`, browser `/backend/services`), `server/routes/serviceCheckout.ts`, `server/routes/unifiedOrders.ts`, `server/routes/public.ts`, `server/routes/guestAuth.ts`, `server/routes/internal-catalog.ts`, `server/routes/affiliate.ts`, `server/routes/founderCouponItems.ts`, `server/routes/founderCouponRules.ts`, `server/controllers/garageAdmin.controller.ts`, `server/services/service.ts`, `server/services/taskroomProvision.ts`, `server/services/sellables.ts`, `server/services/review.ts`, `server/services/couponRule.ts`, `server/services/cashbackCode.ts`, `server/services/founderAlertEmail.ts`, `server/services/affiliateAnalyticsDetail.ts`, `server/services/affiliateTransactionDetail.ts`, and the manual scripts `server/scripts/add-catalog-sync-indexes.ts` and `server/scripts/backfill-catalog-outbox.ts` (21 importers).

## Notes
- **`team[].payRate` is confidential:** it is the founder's internal cost. `server/routes/service.ts` strips it from responses to non-founders; any new route returning `hourlyConfig` must do the same.
- `totalPrice` is only meaningful for milestone services; billable services are priced from `hourlyConfig`.
