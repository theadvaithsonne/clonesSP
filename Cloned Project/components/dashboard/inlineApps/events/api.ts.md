# `components/dashboard/inlineApps/events/api.ts`

> Typed client for /event-management (founder) and /public/event-management (customer).

**Kind:** React component · **Lines:** 736

<!-- docgen:auto -->

## Purpose
Typed client for /event-management (founder) and /public/event-management
(customer). Nothing else in the app should hand-build these URLs.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `listEvents` | function | `async listEvents(params?: { status?: string; search?: string; limit?: number…)` | 26 |
| `createEvent` | function | `async createEvent(payload: Record<string, unknown>)` | 42 |
| `getEvent` | function | `async getEvent(id: string)` | 54 |
| `updateEvent` | function | `async updateEvent(id: string, payload: Record<string, unknown>)` | 65 |
| `publishEvent` | function | `async publishEvent(id: string)` | 72 |
| `unpublishEvent` | function | `async unpublishEvent(id: string)` | 78 |
| `deleteEvent` | function | `async deleteEvent(id: string)` | 84 |
| `uploadBanner` | function | `async uploadBanner(id: string, file: File)` — Banner upload. Sent as multipart so the browser never needs S3 credentials and the server can attribute the object to the event. | 92 |
| `uploadEventImage` | function | `async uploadEventImage(id: string, file: File, folder = "misc")` — Event-scoped image upload for anything that isn't the banner — speaker headshots, sponsor logos. | 105 |
| `listTickets` | function | `async listTickets(eventId: string, kind?: "ticket" \| "addon")` — Both kinds by default — the Tickets page renders its tabs from one fetch. | 121 |
| `createTicket` | function | `async createTicket(eventId: string, payload: Record<string, unknown>)` | 127 |
| `updateTicket` | function | `async updateTicket(eventId: string, ticketId: string, payload: Record<string, unknown>)` | 134 |
| `reorderTickets` | function | `async reorderTickets(eventId: string, orderedIds: string[])` | 145 |
| `deleteTicket` | function | `async deleteTicket(eventId: string, ticketId: string)` | 152 |
| `listRegistrations` | function | `async listRegistrations(eventId: string, params?: { status?: string; search?: string; limit?: number…)` | 160 |
| `approveRegistration` | function | `async approveRegistration(eventId: string, regId: string)` | 175 |
| `rejectRegistration` | function | `async rejectRegistration(eventId: string, regId: string, reason?: string)` | 182 |
| `checkInRegistration` | function | `async checkInRegistration(eventId: string, regId: string)` | 193 |
| `registrationsExportUrl` | function | `registrationsExportUrl(eventId: string)` — CSV export. Goes through raw fetch rather than `api()` because the response is a file, not JSON. | 204 |
| `listSpeakers` | function | `async listSpeakers(eventId: string)` | 210 |
| `createSpeaker` | function | `async createSpeaker(eventId: string, payload: Record<string, unknown>)` | 215 |
| `updateSpeaker` | function | `async updateSpeaker(eventId: string, speakerId: string, payload: Record<string, unknown>)` | 221 |
| `deleteSpeaker` | function | `async deleteSpeaker(eventId: string, speakerId: string)` | 231 |
| `listSessions` | function | `async listSessions(eventId: string)` | 239 |
| `createSession` | function | `async createSession(eventId: string, payload: Record<string, unknown>)` | 244 |
| `updateSession` | function | `async updateSession(eventId: string, sessionId: string, payload: Record<string, unknown>)` | 250 |
| `deleteSession` | function | `async deleteSession(eventId: string, sessionId: string)` | 260 |
| `listSponsors` | function | `async listSponsors(eventId: string)` | 268 |
| `createSponsor` | function | `async createSponsor(eventId: string, payload: Record<string, unknown>)` | 273 |
| `updateSponsor` | function | `async updateSponsor(eventId: string, sponsorId: string, payload: Record<string, unknown>)` | 279 |
| `deleteSponsor` | function | `async deleteSponsor(eventId: string, sponsorId: string)` | 289 |
| `OrgCoupon` | interface |  | 301 |
| `listEventCoupons` | function | `async listEventCoupons(eventId: string)` | 316 |
| `EventDomain` | interface |  | 335 |
| `DnsRecord` | interface |  | 344 |
| `EventWebsiteSettings` | interface |  | 351 |
| `saveWebsiteSettings` | function | `async saveWebsiteSettings(eventId: string, settings: Partial<EventWebsiteSettings>)` | 368 |
| `addEventDomain` | function | `async addEventDomain(eventId: string, host: string)` — Claims a host and returns the DNS records to create. | 379 |
| `verifyEventDomain` | function | `async verifyEventDomain(eventId: string)` — Resolves the records for real; only this can mark a domain verified. | 387 |
| `removeEventDomain` | function | `async removeEventDomain(eventId: string)` | 396 |
| `getRegistrationForm` | function | `async getRegistrationForm(eventId: string)` | 404 |
| `saveRegistrationForm` | function | `async saveRegistrationForm(eventId: string, form: Pick<EventRegistrationFormConfig, "title" \| "descript…)` — The whole form is replaced in one write — the builder owns the order. | 411 |
| `getCampaignAudience` | function | `async getCampaignAudience(eventId: string)` | 423 |
| `getCampaignRecipients` | function | `async getCampaignRecipients(eventId: string, audience: string)` — The email addresses behind one audience segment. | 441 |
| `getWebsite` | function | `async getWebsite(eventId: string)` | 454 |
| `saveWebsite` | function | `async saveWebsite(eventId: string, blocks: EventBlock[], theme?: Partial<EventTheme>)` | 463 |
| `publishWebsite` | function | `async publishWebsite(eventId: string)` | 474 |
| `resetWebsite` | function | `async resetWebsite(eventId: string)` | 483 |
| `PublicTierPayload` | type |  | 494 |
| `PublicEventPayload` | interface |  | 506 |
| `BrowseEvent` | interface |  | 521 |
| `browsePublicEvents` | function | `async browsePublicEvents(params?: { when?: "live" \| "upcoming" \| "past" \| "all"; sea…)` — Attendee-facing catalogue of published events. | 536 |
| `getPublicEvent` | function | `async getPublicEvent(slug: string)` | 552 |
| `QuoteResult` | interface |  | 556 |
| `TicketCartItem` | interface | One line of the cart: a pass type and how many of it. | 580 |
| `quoteTickets` | function | `async quoteTickets(slug: string, payload: { items: TicketCartItem[]; promoCode?: string; cou…)` | 585 |
| `AttendeeInput` | interface |  | 600 |
| `AttendeeSeatInput` | interface | One named person per seat. | 614 |
| `registerFree` | function | `async registerFree(slug: string, payload: { items: TicketCartItem[]; attendee: AttendeeInput…)` | 620 |
| `startCheckout` | function | `async startCheckout(slug: string, payload: { items: TicketCartItem[]; attendee: AttendeeInput…)` | 650 |
| `getTicket` | function | `async getTicket(qrCodeToken: string)` | 684 |
| `LookedUpTicket` | interface |  | 702 |
| `lookupTickets` | function | `async lookupTickets(reference: string, email?: string)` — "Find my ticket" from a reference — a ticket ID, an invoice number or a registration id. | 722 |
| `ticketCalendarUrl` | function | `ticketCalendarUrl(qrCodeToken: string)` | 733 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org/${orgId}/coupons?limit=200` (L318)
- **Other fetch/api calls (target not statically resolvable):**
  - `GET ${BASE}?${q.toString()}` (L37)
  - `GET ${BASE}/${id}` (L55)
  - `PATCH ${BASE}/${id}` (L66)
  - `POST ${BASE}/${id}/publish` (L73)
  - `POST ${BASE}/${id}/unpublish` (L79)
  - `DELETE ${BASE}/${id}` (L85)
  - `POST ${BASE}/${id}/banner` (L95)
  - `POST ${BASE}/${id}/image?folder=${encodeURIComponent(folder)}` (L112)
  - `` GET ${BASE}/${eventId}/tickets${kind ? `?kind=${kind}` : ""} `` (L122)
  - `POST ${BASE}/${eventId}/tickets` (L128)
  - `PUT ${BASE}/${eventId}/tickets/${ticketId}` (L139)
  - `PUT ${BASE}/${eventId}/tickets/reorder` (L146)
  - `DELETE ${BASE}/${eventId}/tickets/${ticketId}` (L153)
  - `` GET ${BASE}/${eventId}/registrations${qs ? `?${qs}` : ""} `` (L170)
  - `POST ${BASE}/${eventId}/registrations/${regId}/approve` (L176)
  - `POST ${BASE}/${eventId}/registrations/${regId}/reject` (L187)
  - `POST ${BASE}/${eventId}/registrations/${regId}/check-in` (L194)
  - `GET ${BASE}/${eventId}/speakers` (L211)
  - `POST ${BASE}/${eventId}/speakers` (L216)
  - `PUT ${BASE}/${eventId}/speakers/${speakerId}` (L226)
  - `DELETE ${BASE}/${eventId}/speakers/${speakerId}` (L232)
  - `GET ${BASE}/${eventId}/agenda` (L240)
  - `POST ${BASE}/${eventId}/agenda` (L245)
  - `PUT ${BASE}/${eventId}/agenda/${sessionId}` (L255)
  - `DELETE ${BASE}/${eventId}/agenda/${sessionId}` (L261)
  - `GET ${BASE}/${eventId}/sponsors` (L269)
  - `POST ${BASE}/${eventId}/sponsors` (L274)
  - `PUT ${BASE}/${eventId}/sponsors/${sponsorId}` (L284)
  - `DELETE ${BASE}/${eventId}/sponsors/${sponsorId}` (L290)
  - `PUT ${BASE}/${eventId}/website/settings` (L372)
  - `POST ${BASE}/${eventId}/website/domain` (L380)
  - `POST ${BASE}/${eventId}/website/domain/verify` (L388)
  - `DELETE ${BASE}/${eventId}/website/domain` (L397)
  - `GET ${BASE}/${eventId}/registration-form` (L405)
  - `PUT ${BASE}/${eventId}/registration-form` (L415)
  - `GET ${BASE}/${eventId}/campaigns/audience` (L424)
  - `GET ${BASE}/${eventId}/campaigns/recipients?audience=${encodeURIComponent(audience)}` (L445)
  - `GET ${BASE}/${eventId}/website` (L455)
  - `PUT ${BASE}/${eventId}/website` (L468)
  - `POST ${BASE}/${eventId}/website/publish` (L475)
  - `POST ${BASE}/${eventId}/website/reset` (L484)
  - `GET ${PUBLIC}?${q.toString()}` (L547)
  - `GET ${PUBLIC}/${slug}` (L553)
  - `POST ${PUBLIC}/${slug}/quote` (L594)
  - `POST ${PUBLIC}/${slug}/register` (L631)
  - `POST ${PUBLIC}/${slug}/checkout` (L663)
  - `GET ${PUBLIC}/ticket/${qrCodeToken}` (L685)
  - `POST ${PUBLIC}/tickets/lookup` (L723)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`, `API_URL`
  - `lib/auth.ts` — `getOrgId`
  - `components/dashboard/inlineApps/events/types.ts` — `AgendaSession`, `ChecklistItem`, `EventBlock`, `EventMetrics`, `EventProgram`, `EventRegistration`, `EventSiteData`, `EventSpeaker`, … +6
- **Packages:** none

## Used by

- `app/events/[id]/EventLandingClient.tsx`
- `app/events/[id]/checkout/CheckoutClient.tsx`
- `app/events/[id]/registered/[token]/ConfirmationClient.tsx`
- `app/events/[id]/ticket/[token]/TicketClient.tsx`
- `app/events/[id]/tickets/MyTicketsClient.tsx`
- `components/dashboard/inlineApps/events/CreateEventExtras.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventConsole.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/dashboard/inlineApps/events/EventFlowView.tsx`
- `components/dashboard/inlineApps/events/EventPasses.tsx`
- `components/dashboard/inlineApps/events/EventPickerModal.tsx`
- `components/dashboard/inlineApps/events/EventsBrowse.tsx`
- `components/dashboard/inlineApps/events/EventsListView.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
- `components/dashboard/inlineApps/events/WebsiteBuilder.tsx`
- `components/dashboard/inlineApps/events/sections/AgendaSection.tsx`
- `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx`
- `components/dashboard/inlineApps/events/sections/CouponsSection.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx`
- `components/dashboard/inlineApps/events/sections/SpeakersSection.tsx`
- `components/dashboard/inlineApps/events/sections/SponsorsSection.tsx`
- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
- _…and 3 more_
