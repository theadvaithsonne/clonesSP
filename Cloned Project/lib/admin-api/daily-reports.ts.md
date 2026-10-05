# `lib/admin-api/daily-reports.ts`

> Garage-admin client and helpers for the Daily Reports page: paid sales grouped by buyer within an IST date window, plus IST calendar maths, range presets and display formatters.

**Kind:** frontend library · **Lines:** 255

## Purpose
The Daily Reports page (`/garage-admin/daily-reports`) shows who paid for what over a range of days in India Standard Time. Rows are grouped per buyer and split into four product kinds: Founders Office, Unilevel Plus, NetworkChain and crypto white-label. This file holds the TypeScript mirror of the backend response (`server/routes/garageAdminDailyReports.ts`), the fetch helper, and the pure date helpers that the page and its filter drawer share. The helpers work on `YYYY-MM-DD` strings so that neither drafts nor URLs ever depend on the browser's local timezone.

## How it works
### Types (L9-L93)
- `DailyReportInvoice` - one paid invoice:
  - `invoiceNumber`, a buyer-facing `publicUrl`, `kind`, a human `tag` such as "Renewal · cycle 2", `itemName`, `paidAt`;
  - amounts: `usd` / `gstUsd` (null only for a legacy row stored in paise), and `charged` (the original amount when the buyer did not pay in USD);
  - payment: `method` label, and `txHash` / `cryptoChain` for crypto payments;
  - `flags` (`cryptobrand_bootstrap`, `legacy_inr_paise`, `paidAt_missing`).
- `DailyReportRow` - one buyer:
  - `user`; `upline` (who referred the buyer, from `User.referredBy`); `location`;
  - totals per kind (`counts`, `byKindUsd`), `totalUsd`, `lastPaidAt`;
  - their `invoices`.
- `DailyReportStats` - page-wide totals per kind, crypto subtotal, and the number of flagged invoices.
- `DailyReportResponse` - `{ data, stats, pagination, range }`. `range` echoes the resolved window, including the UTC `fromAt` / `toAt` instants and the timezone.
- `DailyReportsFilters` - the page's filter state:
  - `from` / `to` as IST days, and an optional `kind`;
  - `downlineOf` - limit the report to everyone below this person in the referral tree;
  - `excludedUsers` - "legs" left out of that tree. The excluded people still appear, but what they recruited does not.
  These are `DownlinePerson` objects from `components/garage-admin/downline-scope.tsx`. The caller converts them into the `rootUserId` / `excludeUserId` query parameters.

### Fetch (L95-L127)
`getDailyReports(params)` builds the query from `from`, `to`, `kind`, `q`, `sortBy`, `sortOrder`, `limit`, `offset` and `rootUserId`, skipping empty values. `excludeUserId` is added as a repeated parameter (one per id), **but only when `rootUserId` is set**, because the backend ignores exclusions without a root. It calls `GET /backend/garage-admin/daily-reports` through `garageAdminApi` and returns the raw response; this endpoint has no `data` envelope to unwrap.

### IST calendar helpers (L129-L201)
- `REPORT_TZ = "Asia/Kolkata"`.
- `istToday()` - today in IST, via `ymdInTimeZone`.
- `istShift(ymd, days)` - anchors the date at 12:00 IST, shifts it by whole UTC days, and reads the result back in IST. IST has no daylight saving, so this is exact.
- `istMonthStart(ymd)` - the first day of that month.
- `defaultRange()` - yesterday to today.
- `RANGE_PRESETS` - `since_yesterday`, `today`, `yesterday`, `last_7` (6 days back), `last_30` (29 back), `this_month`. Each has `label`, a `short` chip label, and a lazy `range()` so the dates are computed when used.
- `presetForRange(from, to)` - which preset matches a range exactly, otherwise `"custom"`.

### Formatters and labels (L203-L254)
- `formatYmd(ymd, withYear?)` - "21 Sep" built from the string, never through a `Date`. Malformed input is returned unchanged.
- `rangeSummary(from, to)` - the preset label, a single day, or "12 Sep → 18 Sep 2026".
- `formatIst(iso, withYear?)` - an instant shown on the IST clock (`en-IN`, 12-hour), or "—" for an invalid date.
- `KIND_LABEL`, `KIND_ORDER` - display names and column order for the four kinds.
- `explorerTxUrl(chain, hash)` - block-explorer link for `bsc` (bscscan), `polygon`, `ethereum` (etherscan), `tron` (tronscan) and `bitcoin` (mempool.space); `null` for any other chain or a missing value.

## Exports
- Types: `DailyReportKind`, `DailyReportFlag`, `DailyReportInvoice`, `DailyReportUser`, `DailyReportRow`, `DailyReportStats`, `DailyReportResponse`, `DailyReportsFilters`, `RangePresetId`.
- `getDailyReports(params): Promise<DailyReportResponse>` - fetches the report.
- `REPORT_TZ`, `istToday()`, `istShift(ymd, days)`, `istMonthStart(ymd)`, `defaultRange()` - IST date maths.
- `RANGE_PRESETS`, `presetForRange(from, to)`, `rangeSummary(from, to)` - range presets.
- `formatYmd(ymd, withYear?)`, `formatIst(iso, withYear?)` - formatters.
- `KIND_LABEL`, `KIND_ORDER` - kind labels and column order.
- `explorerTxUrl(chain, hash)` - transaction explorer URL or `null`.

## Interfaces
- **Backend endpoints called:** `GET /backend/garage-admin/daily-reports?from&to&kind&q&sortBy&sortOrder&limit&offset&rootUserId&excludeUserId…` - served by `server/routes/garageAdminDailyReports.ts`, mounted at `/garage-admin`.
- **External services:** links only (no calls) to bscscan.com, polygonscan.com, etherscan.io, tronscan.org and mempool.space.

## Dependencies
- **Internal:**
  - `lib/api.ts` - `garageAdminApi`.
  - `lib/zonedTime.ts` - `ymdInTimeZone`.
  - `components/garage-admin/downline-scope.tsx` - `DownlinePerson` type (type-only import).

## Used by
- `app/garage-admin/(admin-dashboard)/daily-reports/page.tsx`
- `components/garage-admin/DailyReportsFilterDrawer.tsx`

## Notes
- The source comment points to `garagenew-backend routes/garageAdminDailyReports.ts`; in this merged project it is `server/routes/garageAdminDailyReports.ts`. Keep the types in step with it.
