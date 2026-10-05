# `lib/crm/isFollowUpTask.ts`

> Classifies a CRM task as a "follow-up" or a regular task, and supplies the standard fields that mark a newly created task as a follow-up.

**Kind:** frontend library · **Lines:** 89

## Purpose
Tasks from the external CRM API do not reliably carry a follow-up flag. Older tasks were told apart only by their title or description text. This module puts the rule for "is this a follow-up?" in one place for all the Deals screens. It also exports `FOLLOW_UP_TASK_DEFAULTS`, which new follow-up tasks are created with, so that future tasks can be classified by flag instead of by wording.

## How it works
`isFollowUpTask(task)` checks the following in order:
1. `null`/`undefined` -> `false`.
2. **Explicit flag:** `isFollowUp === true` or the string `"true"` -> `true`.
3. **Type fields:** if any of `type`, `taskType`, `category` or `activityType` normalises to `follow-up`, `followup`, `follow_up` or `follow up` -> `true`. Normalising means trim, lowercase and collapse whitespace.
4. **Text heuristics** on the normalised `title` (or `name`) and `description`:
   - With no title and no description -> `false`.
   - The title is exactly "follow-up with lead" (any spelling variant) -> `true`.
   - The description is exactly "follow-up scheduled" / "followup scheduled", or contains "further follow-up needed" -> `true`.
   - The title starts with "auto follow-up", or contains "follow-up created" / "followup created" -> `true`.
   - The title contains **"contacted on whatsapp"** -> `false`. This explicit exclusion stops the completed WhatsApp-contact log entries created by `leadContactActions.ts` from being counted as follow-ups.
   - The title contains the phrase "follow up" / "follow-up" / "followup" as a whole word -> `true`.
   - The description contains the phrase **and** is or starts with "follow-up scheduled", or contains "auto follow" -> `true`.
5. Otherwise `false`.

`FOLLOW_UP_TASK_DEFAULTS` is `{ type: "follow-up", isFollowUp: true }` (`as const`). Callers spread it into task-creation payloads.

## Exports
- `isFollowUpTask(task: TaskLike | null | undefined): boolean` - follow-up classifier. `TaskLike` is a non-exported type with optional `type`, `taskType`, `category`, `activityType`, `isFollowUp`, `title`, `description` and `name` fields, all typed `unknown`.
- `FOLLOW_UP_TASK_DEFAULTS` - `{ type: "follow-up", isFollowUp: true }`, the marker fields for new follow-up tasks.

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
- `app/(dashboard)/deals/leads/[id]/page.tsx` (route `/deals/leads/[id]`) - uses `isFollowUpTask` to split a lead's tasks, and spreads `FOLLOW_UP_TASK_DEFAULTS` when it creates follow-ups.
- `app/(dashboard)/deals/leads/page.tsx` (`/deals/leads`) - spreads `FOLLOW_UP_TASK_DEFAULTS`.
- `app/(dashboard)/deals/page.tsx` (`/deals`) - spreads `FOLLOW_UP_TASK_DEFAULTS`.
- `lib/crm/leadContactActions.ts` - spreads `FOLLOW_UP_TASK_DEFAULTS` into the next-day follow-up it schedules after a WhatsApp contact.

## Notes
- The checks run in a deliberate order. The "contacted on whatsapp" exclusion comes after the strong positive signals (the explicit flag, the type fields and exact titles) but before the generic phrase match. Moving it changes which tasks are classified as follow-ups.
