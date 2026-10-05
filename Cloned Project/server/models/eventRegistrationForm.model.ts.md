# `server/models/eventRegistrationForm.model.ts`

> Mongoose model, field-type catalogue and helpers for the registration form an organiser builds for one Event Program.

**Kind:** Mongoose model · **Lines:** 170

## Purpose
The Event Management form builder lets an organiser reorder, relabel and require the standard attendee fields, and add custom questions and consent checkboxes. Each event has exactly one form, because a second form would create two sources of truth for what a buyer was asked. Answers to standard fields are still written to the typed `eventRegistration.attendee` subdocument. Custom and consent answers go to `eventRegistration.answers`, keyed by the field `key`.

## How it works
- `FORM_FIELD_TYPES` lists every type the field library can add, in three groups:
  - Standard (`first_name`, `last_name`, `email`, `phone`, `company`, `job_title`, `country`) map onto `attendee`.
  - Custom (`short_text`, `long_text`, `dropdown`, `multi_select`) go to `answers`.
  - Consent (`terms`, `marketing_opt_in`, `photo_consent`) go to `answers` as booleans.
- `IEventFormCondition` is a "show this field if" rule. The only supported `source` is `"ticket_type"`, because the ticket is the one thing known before the form is filled in. `operator` is `is` or `is_not`, and `values` holds ticket tier ids. A field shows only when **all** its conditions pass; an empty list means always shown.
- `IEventFormField`:
  - `key` is stable and must never change, because answers are stored against it.
  - Also `type`, `label` (max 200), `placeholder`, `helpText`, `required`, `showOnBadge` (print the answer on the attendee badge), `mapToDealsField` (an optional Deals field to copy the answer into, for example `deal.track_interest`), `options` (choices for dropdown and multi-select), `conditions` and `order`.
- The `ConditionSchema` and `FieldSchema` sub-schemas use `_id: false`. The form document stores `eventId` (ref `EventProgram`, **unique**), `title`, `description` (max 500) and `fields`, in collection **`event_registration_forms`**, with timestamps.
- `ATTENDEE_FIELD_MAP` maps each standard type to the attendee property it writes. `first_name` and `last_name` both map to `name`. Custom and consent types have no entry.
- `defaultFormFields()` returns the starter form: first name, last name and email (required), plus phone, company and job title (optional). These are exactly the fields checkout collected before the builder existed, so an organiser who never opens the builder sees no change. Name and company are marked `showOnBadge`, and `key` equals `type`.

## Exports
- `FORM_FIELD_TYPES` - readonly tuple of field types.
- `EventFormFieldType` - union of those types.
- `IEventFormCondition`, `IEventFormField`, `IEventRegistrationForm` - interfaces.
- `EventRegistrationForm` - the model.
- `ATTENDEE_FIELD_MAP` - standard type to attendee property.
- `defaultFormFields(): IEventFormField[]` - the default field list.

## Interfaces
- **Database:** `EventRegistrationForm` (collection `event_registration_forms`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/eventManagement.ts` (mounted at `/event-management`) - organiser reads and saves the form.
- `server/routes/publicEventManagement.ts` (mounted at `/public/event-management`) - the public register and checkout flow renders the form and validates and splits answers.

## Notes
- The comment on `ATTENDEE_FIELD_MAP` says custom fields "return null", but they simply have no entry, so a lookup yields `undefined`.
