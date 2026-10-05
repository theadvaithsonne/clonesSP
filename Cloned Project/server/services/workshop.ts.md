# `server/services/workshop.ts`

> Module exporting `getWorkshopEndDateTimeUTC`, `getWorkshopStartDateTimeUTC`, `createWorkshop`, `updateWorkshop` and 19 more.

**Kind:** backend service · **Lines:** 3154

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getWorkshopEndDateTimeUTC` | function | `getWorkshopEndDateTimeUTC(workshop: any): Date` — Compute the actual UTC end datetime for a workshop, respecting its timezone. | 76 |
| `getWorkshopStartDateTimeUTC` | function | `getWorkshopStartDateTimeUTC(workshop: any): Date` — Compute the actual UTC start datetime for a workshop, respecting its timezone. | 110 |
| `CreateWorkshopData` | interface |  | 154 |
| `createWorkshop` | function | `async createWorkshop(orgId: string, createdBy: string, data: CreateWorkshopData): Promise<IWorkshop>` — Create a new workshop | 194 |
| `updateWorkshop` | function | `async updateWorkshop(workshopId: string, orgId: string, data: Partial<CreateWorkshopData> & { isRecurrenceActive?: …): Promise<IWorkshop \| null>` — Update a workshop | 234 |
| `deleteWorkshop` | function | `async deleteWorkshop(workshopId: string, orgId: string): Promise<boolean>` — Delete (soft delete) a workshop | 295 |
| `isBilledSpeaker` | function | `isBilledSpeaker(workshop: { speakers?: any[] } \| null \| undefined, userId?: string \| null): boolean` — Whether `userId` is one of the workshop's billed speakers (Workshop.speakers). | 317 |
| `getWorkshopById` | function | `async getWorkshopById(workshopId: string, userId?: string): Promise<any>` | 325 |
| `getOrgWorkshops` | function | `async getOrgWorkshops(orgId: string, options: { userId?: string; channelId?: string; upcoming?: …): Promise<{ workshops: any[]; total: number }>` — Get all workshops for an organization | 512 |
| `getUserAccessibleWorkshops` | function | `async getUserAccessibleWorkshops(userId: string, orgId: string, options: { upcoming?: boolean; limit?: number; offset?: num…): Promise<{ workshops: any[]; total: number }>` — Get workshops accessible to a user (based on channel subscriptions) | 1120 |
| `registerForFreeWorkshop` | function | `async registerForFreeWorkshop(userId: string, workshopId: string, orgId: string, opts?: { sessionDate?: Date }): Promise<{ success: boolean; message: string; alre…` — Register for a free workshop | 1395 |
| `registerForPaidWorkshop` | function | `async registerForPaidWorkshop(userId: string, workshopId: string, orgId: string, paymentDetails: { paymentId: string; orderId: string; amoun…): Promise<{ success: boolean; message: string }>` — Register for a paid workshop (after payment verification) NOTE: Wallet crediting is now handled by distributeCommissions() in the route This function only handles registration logic | 1586 |
| `getWorkshopRegistrations` | function | `async getWorkshopRegistrations(workshopId: string, orgId: string, options: { limit?: number; offset?: number } = {}): Promise<{ registrations: any[]; total: number }>` — Get workshop registrations (for founders) | 1734 |
| `cancelFullEnrollment` | function | `async cancelFullEnrollment(userId: string, workshopId: string): Promise<{ success: boolean; message: string; stat…` — Cancel a `full`-mode (enrol-once) registration. | 1773 |
| `cancelSessionEnrollment` | function | `async cancelSessionEnrollment(userId: string, workshopId: string, sessionDate: Date): Promise<{ success: boolean; message: string; stat…` — Cancel ONE session's enrolment on a per-session workshop. | 1835 |
| `cancelRegistration` | function | `async cancelRegistration(userId: string, workshopId: string): Promise<boolean>` — Legacy wrapper — kept as a thin proxy over `cancelFullEnrollment` so pre-existing callers (mostly older admin-side code paths) don't break. | 1895 |
| `getWorkshopSessions` | function | `async getWorkshopSessions(workshopId: string, userId: string, options: { limit?: number; includePast?: boolean } = {}): Promise<{ sessions: (WorkshopSession & { register…` — Get sessions for a recurring workshop | 1908 |
| `hasSessionAccess` | function | `async hasSessionAccess(userId: string, workshopId: string, sessionDate: Date): Promise<{ hasAccess: boolean; registration?: IWor…` — Check if user has access to a specific session | 2039 |
| `registerForRecurringWorkshopFull` | function | `async registerForRecurringWorkshopFull(userId: string, workshopId: string, orgId: string, paymentDetails?: { paymentId: string; orderId: string; amou…): Promise<{ success: boolean; message:…` — Register for a recurring workshop (full enrollment - "enroll once") | 2113 |
| `registerForRecurringWorkshopSession` | function | `async registerForRecurringWorkshopSession(userId: string, workshopId: string, orgId: string, sessionDate: Date, paymentDetails?: { paymentId: string; orderId: string; amou…): Promise<{ succ…` — Register for a specific session of a recurring workshop (per-session enrollment) | 2202 |
| `WorkshopAnalytics` | interface |  | 2366 |
| `SessionAnalytics` | interface |  | 2403 |
| `getWorkshopAnalytics` | function | `async getWorkshopAnalytics(workshopId: string, orgId: string, sessionDate?: Date): Promise<WorkshopAnalytics \| null>` — Get comprehensive analytics for a workshop (founder only) | 2442 |
| `getRecurringWorkshopAnalytics` | function | `async getRecurringWorkshopAnalytics(workshopId: string, orgId: string, options: { limit?: number; offset?: number; includePast?: b…): Promise<{ workshop: any; sessions: SessionAnalyti…` — Get analytics for all sessions of a recurring workshop | 2614 |
| `syncAttendanceFromMeeting` | function | `async syncAttendanceFromMeeting(workshopId: string): Promise<{ synced: number; errors: string[] }>` — Sync attendance status from meeting participants to workshop registrations Should be called when a meeting ends | 3065 |
| `markUserAttended` | function | `async markUserAttended(workshopId: string, userId: string, sessionDate?: Date): Promise<boolean>` — Mark a specific user as attended (manual override) | 3129 |

## Interfaces

- **Database (Mongoose models used):**
  - `WorkshopSessionOverride` (server/models/workshopSessionOverride.model.ts) — reads: `find`, `findOne`
  - `Meet` (server/models/meet.model.ts) — reads: `find`, `findById`
  - `Workshop` (server/models/workshop.model.ts) — reads: `findOne`, `findById`, `find`; **writes:** `create`, `findOneAndUpdate`, `updateOne`
  - `WorkshopRegistration` (server/models/workshopRegistration.model.ts) — reads: `countDocuments`, `findOne`, `find`, `aggregate`; **writes:** `updateMany`, `create`, `updateOne`
  - `User` (server/models/user.model.ts) — reads: `find`
  - `ChannelMembership` (server/models/channelMembership.model.ts) — reads: `find`
- **External hosts mentioned in the code:** `api.dicebear.com`

## Dependencies

- **Internal:**
  - `server/models/workshop.model.ts` — `Workshop`, `IWorkshop`, `IRecurrencePattern`
  - `server/models/emailAlerts.schema.ts` — `IEmailAlerts`
  - `server/models/founderAlerts.schema.ts` — `IFounderAlerts`
  - `server/models/meet.model.ts` — `Meet`
  - `server/models/workshopRegistration.model.ts` — `WorkshopRegistration`, `IWorkshopRegistration`
  - `server/models/channelMembership.model.ts` — `ChannelMembership`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/utils/recurrence.ts` — `calculateSessions`, `getNextSession`, `getTimezoneOffsetMinutes`, `isValidSessionDate`, `startOfDay`, `endOfDay`, `WorkshopSession`
  - `server/utils/exchangeRate.ts` — `getUsdToInrRate`
  - `server/models/workshopSessionOverride.model.ts` — `WorkshopSessionOverride`
  - `server/utils/workshopStatus.ts` — `isSessionDeleted`, `sessionDayKey`
  - `server/utils/sessionOverlay.ts` — `hasSessionEdits`, `indexOverridesByDay`, `resolveEffectiveSession`, `resolveSessionPricing`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/services/founderStreamTable.ts`
- `server/services/invoice.ts`
- `server/services/itemReserveLicense.ts`

## Notes

- Large file (3154 lines) — read it by section; line numbers above point into it.
