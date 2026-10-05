# `lib/crm/resolveLeadContactInfo.ts`

> Pure helpers that find a CRM lead's email address and phone number, looking at the lead record first and then at its linked contacts.

**Kind:** frontend library · **Lines:** 106

## Purpose
CRM leads from the external CRM API come in several shapes. A lead may have `email`/`phone` directly, a single `contact` object, a `contacts` array, or a `phoneNumbers` array of strings or objects. This module turns all of these into one email and one phone. The email and WhatsApp quick actions use it, and so does the code that sends required contact fields to the backend when a lead is partly updated.

## How it works
- **Choosing the primary contact (`getPrimaryContact`, internal):** if there is a `lead.contact` object, it is used. Otherwise, from `lead.contacts`, it takes the first contact with `isPrimary`. Failing that, the first contact that has a non-empty `email`, `phoneNumber` or `phone`. Failing that, the first contact.
- **Getting a phone from an entity (`firstPhoneFromEntity`, internal):** it tries `phoneNumber`, `phone` and `mobile`. Then it walks the `phoneNumbers` array, accepting a plain string or an object's `phoneNumber`/`phone`/`number`/`value`.
- **`resolveLeadEmail`:** `lead.email` if set, otherwise the primary contact's `email`.
- **`resolveLeadPhone`:** the lead's own phone fields, otherwise the primary contact's.
- **`buildLeadContactFieldsForApi`:** returns `{ email?, phone?, phoneNumbers?: [phone] }` with only the fields that were found. The comment says it exists because the backend validates contact fields even on partial updates, such as changing only tags.
- **`hasLeadEmailOrPhone`:** `true` if either an email or a phone can be found.

All values are trimmed, and anything that is not a string is treated as empty.

## Exports
- `resolveLeadEmail(lead: LeadLike): string` - the best email, or `""`.
- `resolveLeadPhone(lead: LeadLike): string` - the best phone (raw, not normalised), or `""`.
- `buildLeadContactFieldsForApi(lead: LeadLike): { email?: string; phone?: string; phoneNumbers?: string[] }` - contact fields to merge into an update payload.
- `hasLeadEmailOrPhone(lead: LeadLike): boolean` - whether any contact channel exists.

`LeadLike` (not exported) is `Record<string, unknown> | null | undefined`.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `lib/crm/leadContactActions.ts` - finds the target for the Gmail compose link and the WhatsApp link.
- `components/crm/LeadContactQuickActions.tsx` - decides which quick-action buttons to show.
- `app/(dashboard)/deals/page.tsx` (`/deals`) - uses `resolveLeadEmail` / `resolveLeadPhone` on dashboard activity cards.
- `app/(dashboard)/deals/leads/[id]/page.tsx` (`/deals/leads/[id]`) - uses `hasLeadEmailOrPhone` as a guard and spreads `buildLeadContactFieldsForApi` into lead update requests.

## Notes
- The phone is returned as stored. Normalising it, for example adding a country code for WhatsApp, is the caller's job (`formatPhoneForWhatsApp` in `leadContactActions.ts`).
