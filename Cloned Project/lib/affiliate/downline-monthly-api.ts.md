# `lib/affiliate/downline-monthly-api.ts`

> Typed client for the monthly spent/earned activity chart in a downline member profile's header.

**Kind:** frontend library · **Lines:** 50

## Purpose
The member profile header shows a twelve-month chart for one member, with two series:
- **spent:** everything the member paid for, across all orgs and item types.
- **earned:** the viewer's commission from that member.

The chart ignores the profile's category tabs and its "As A Shopper" / "Digital" dropdowns, so changing a tab never changes the chart.

## How it works
- `fetchMemberMonthly(userId, year)` calls the backend through `garageAdminApi`. The admin panel has no user JWT, and the backend route uses `requireUserOrGarageAdmin`.
- The function cleans up the response:
  - `currency` falls back to `"USD"`.
  - `years` falls back to `[]`.
  - `months` falls back to `[]`.
  - `year` is passed through as-is.
- According to the type comments:
  - All money is in **cents**.
  - Currency is always USD, because the backend converts INR spend at a fixed rate.
  - `months` always has 12 zero-filled entries, January to December (`month` runs 1 to 12).
  - `years` lists the years that have data, newest first, and always includes the requested year.
- `earned` is the caller's commission, so it is blank for an admin.

## Exports
- `MemberMonthlyPoint` - `{ month: number; spent: number; earned: number }`.
- `MemberMonthly` - `{ year; currency; years: number[]; months: MemberMonthlyPoint[] }`.
- `fetchMemberMonthly(userId: string, year: number): Promise<MemberMonthly>`

## Interfaces
- **Backend endpoints called:** `GET /backend/affiliate/downline/:userId/monthly?year=YYYY`, served by `server/routes/downlineProfile.ts` (mounted at `/affiliate`).
- **Browser storage / cookies:** `garage_admin_token` is read by `garageAdminApi`.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `components/garage-admin/MemberActivityChart.tsx`

## Notes
- `userId` is put into the path without `encodeURIComponent`, unlike the sibling live-streams client.
