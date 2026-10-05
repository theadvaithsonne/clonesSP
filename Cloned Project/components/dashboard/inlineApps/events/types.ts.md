# `components/dashboard/inlineApps/events/types.ts`

> Shared types for the Event Management module (founder console + web builder + public landing page).

**Kind:** React component · **Lines:** 334

<!-- docgen:auto -->

## Purpose
Shared types for the Event Management module (founder console + web builder
+ public landing page). Mirrors the Mongoose models in
garagenew-backend/src/models/event*.model.ts.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EventFormat` | type |  | 5 |
| `EventStreamType` | type |  | 6 |
| `EventStatus` | type |  | 10 |
| `EventVenue` | interface |  | 17 |
| `EventStreaming` | interface |  | 27 |
| `EventProgram` | interface |  | 33 |
| `TicketTier` | interface |  | 71 |
| `RegistrationStatus` | type |  | 101 |
| `PaymentStatus` | type |  | 106 |
| `EventRegistration` | interface |  | 108 |
| `EventSpeaker` | interface |  | 140 |
| `AgendaSession` | interface |  | 158 |
| `SponsorTier` | type |  | 188 |
| `EventSponsor` | interface |  | 190 |
| `EventMetrics` | interface |  | 202 |
| `ChecklistItem` | interface |  | 214 |
| `EventBlockType` | type |  | 223 |
| `EventBlock` | interface |  | 235 |
| `EventTheme` | interface |  | 244 |
| `EventWebsiteConfig` | interface |  | 250 |
| `EventSiteData` | interface | Everything the public landing page and the builder canvas render from. | 260 |
| `FORM_FIELD_TYPES` | const | `= [ "first_name", "last_name", "email", "phone", "company", "job_title", "country", "shor…` | 269 |
| `EventFormFieldType` | type |  | 286 |
| `STANDARD_FIELD_TYPES` | const | `= [ "first_name", "last_name", "email", "phone", "company", "job_title", "country", ]` — Standard fields answer into `attendee`; everything else into `answers`. | 289 |
| `CONSENT_FIELD_TYPES` | const | `= [ "terms", "marketing_opt_in", "photo_consent", ]` | 299 |
| `EventFormCondition` | interface |  | 305 |
| `EventFormField` | interface |  | 312 |
| `EventRegistrationFormConfig` | interface |  | 327 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `app/events/[id]/tickets/MyTicketsClient.tsx`
- `components/dashboard/inlineApps/events/CreateEventExtras.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
- `components/dashboard/inlineApps/events/EventCheckoutView.tsx`
- `components/dashboard/inlineApps/events/EventConsole.tsx`
- `components/dashboard/inlineApps/events/EventDetailView.tsx`
- `components/dashboard/inlineApps/events/EventPasses.tsx`
- `components/dashboard/inlineApps/events/EventPickerModal.tsx`
- `components/dashboard/inlineApps/events/EventsListView.tsx`
- `components/dashboard/inlineApps/events/EventsPurchases.tsx`
- `components/dashboard/inlineApps/events/WebsiteBuilder.tsx`
- `components/dashboard/inlineApps/events/announceEvent.ts`
- `components/dashboard/inlineApps/events/api.ts`
- `components/dashboard/inlineApps/events/browse-format.ts`
- `components/dashboard/inlineApps/events/sections/AgendaSection.tsx`
- `components/dashboard/inlineApps/events/sections/CampaignsSection.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationFormBuilder.tsx`
- `components/dashboard/inlineApps/events/sections/RegistrationsSection.tsx`
- `components/dashboard/inlineApps/events/sections/SpeakersSection.tsx`
- `components/dashboard/inlineApps/events/sections/SponsorsSection.tsx`
- `components/dashboard/inlineApps/events/sections/TicketsSection.tsx`
- `components/events/ShareEventModal.tsx`
- `components/events/checkout/FormFields.tsx`
- `components/events/checkout/ui.tsx`
- `components/events/site/EventSiteRenderer.tsx`
