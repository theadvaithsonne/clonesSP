# `lib/nc-admin-api/earngpt-types.ts`

> Type-only file that declares the two EarnGPT suggestion-feedback response shapes used by the NetworkChains admin "EarnGPT Learning" page.

**Kind:** frontend library · **Lines:** 29

## Purpose
The NetworkChains admin pages were ported from the separate `networkchains-web-app`. That app's `lib/api/earngpt.ts` is mostly a user-facing EarnGPT client this port does not need, so only these two interfaces were copied over. The header asks that they stay byte-identical to the source, so the ported page works without edits.

## How it works
No runtime code.
- `AdminSuggestionFeedbackItem` is one row of the EarnGPT suggestion-learning log. Each row records that a user (`userId`) was shown a suggestion (`suggestedId`, optional `suggestedName` and `reasoning`) for an anchor (`anchorId`). `direction` is `"product"` or `"contact"`, meaning a product suggested for a contact or a contact suggested for a product. The user's verdict is `option`: `"wrong"`, `"close"` or `"chosen"`. Optional `freeText` and `contactId` fields follow, then the `createdAt` ISO timestamp.
- `AdminSuggestionFeedbackResponse` holds a `feedback` array plus `pagination` (`page`, `limit`, `total`, `totalPages`).

## Exports
- `interface AdminSuggestionFeedbackItem` - one feedback log row.
- `interface AdminSuggestionFeedbackResponse` - paged list of rows.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `lib/nc-admin-api/admin.ts` - re-exports both types and uses the response type as the return type of `getSuggestionFeedback()` (NC endpoint `GET /earngpt/admin/suggestion-feedback`). The EarnGPT Learning admin page imports them through `admin.ts`.

## Notes
- The data comes from the external NetworkChains contacts-backend, not from this repo's `server/`.
