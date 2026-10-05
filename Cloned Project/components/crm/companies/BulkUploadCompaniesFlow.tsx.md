# `components/crm/companies/BulkUploadCompaniesFlow.tsx`

> A client-side dialog for the Deals CRM: it parses an Excel or CSV file of companies, lets the user check and edit every row, and sends them in bulk to the external CRM API, showing progress as it goes.

**Kind:** React component · **Lines:** 1029

## Purpose
On the Deals "Companies" page (`/deals/companies`), users can import many companies at once instead of creating them one by one. This component handles the whole import inside a modal. The user downloads a template, picks a file, reviews the parsed rows in an editable table and fixes any validation errors. The component then sends the rows to the CRM backend and shows a progress bar followed by a summary of what succeeded and failed. The CRM data does **not** live in this repo's Express server. Requests go to the external Garage UAT API (`https://uatapi.garage.app/api`) via `buildExternalUrl`. Sibling components follow the same pattern for other CRM entities (`components/crm/leads/BulkUploadLeadsFlow.tsx`, `components/crm/contacts/BulkUploadContactsFlow.tsx`).

## How it works

### Module-level helpers (L32-L226)
- **`TEMPLATE_URL`** (L32): a hardcoded public S3 URL for `companies_bulk_upload_template.xlsx`. `handleDownloadTemplate` downloads it by adding a temporary `<a download>` link. If that throws, it opens the URL with `window.open` instead.
- **`CompanyRow`** (L35): the row shape. `companyName` is required. The optional fields are `website`, `phoneNumber`, `email`, `industry`, `revenue`, `address`, `city`, `state`, `country`, `pinCode` and `ownerEmail`.
- **`UploadSummary`** (L50): the normalised result shown after an upload: message, totals, and lists of successful and failed rows.
- **`normalizeKey`** turns a header into lowercase alphanumerics only (`"Company Name"` → `"companyname"`). **`safeString`** trims strings, converts numbers to strings, and turns anything else into `""`.
- **`mapRowToCompany`** (L87-L123) matches columns loosely. For each target field, `pickValue` first tries an exact match against a list of synonyms, then falls back to any normalised header that *contains* one of the synonyms. For example, company name accepts `companyname`/`name`/`organization`/`account`, pin code accepts `pincode`/`zip`/`zipcode`/`postalcode`, and owner accepts `owneremail`/`owner`/`assignedto`. Users therefore don't need the exact template headers. Because of the "contains" fallback, a broad keyword such as `name` or `web` can match an unexpected column.
- **`parseExcelFile`** (L125-L134) reads the file with `XLSX.read` (array buffer), keeps only the **first worksheet**, converts it with `sheet_to_json({ defval: "" })`, maps each row, and drops rows that are completely empty.
- **`parseCSV`** (L136-L159) is a naive splitter. It splits lines on `\r?\n`, drops blank lines, splits each line on `,` and strips surrounding quotes. **Rows whose column count differs from the header row are silently skipped.** As a result, quoted values that contain commas (such as addresses) cause the row to be dropped.
- **`validateCompany`** (L163-L177) requires `companyName`. If `email` is present it must match a simple `x@y.z` regex, and if `website` is present it must start with `http://` or `https://`.
- **`normalizeUploadSummary`** (L179-L226) accepts several possible backend response shapes. It reads from `raw.summary`, `raw.results` or `raw` itself, and accepts many alternative key names (`successfulCompanies`/`successful`/`successfulRows`/..., `failedCount`/`failed`/`failedImports`, `totalProcessed`/`totalCompanies`/`total`/...). It falls back to the number of rows sent and builds a default success message if the backend sends none.

### Component state (L228-L301)
- **Theme:** `useTheme()` from `next-themes`. If `window.__garageDealsInline` is set (by `components/dashboard/inlineApps/deals/DealsApp.tsx` when the Deals app runs embedded in the dashboard), the outer dialog is forced to the dark palette. The `"color"` theme is passed through as-is.
- **Data:** `companies`, and `validationErrors` (a map from row index to messages).
- **Upload tracking:** `isUploading`, `uploadProgress`, `processedCount`, `successCount`, `failCount`, `totalToUpload` and `summary`.
- **UI flags:** `isParsing`, and `isPreviewOpen`, which opens a second, nested preview dialog.
- **Refs:** the file input, the fake-progress interval and the polling timeout. A `sessionId` state is written but never read.
- **`resetState`** clears everything, stops polling and clears the file input. It runs when the dialog closes, through `handleClose` and through an effect on `open`.

### File selection → preview (L303-L385)
`handleFileUpload` accepts `.xlsx`/`.xls` files (by extension or by a MIME type containing `spreadsheetml`/`excel`) and `.csv` files. Any other file type triggers an error toast. CSV files are read with `FileReader.readAsText`. After parsing, the component stores the rows, opens the preview dialog and runs `validateAll`. If any rows have problems, a warning toast shows how many. A parse error shows a toast and resets the component.

`updateCompanyField` updates one cell in the preview table and re-validates that row. To do this it captures the updated row in a local variable inside the `setCompanies` updater, and it relies on React running that updater before the `setValidationErrors` updater. If that variable is still `null`, it falls back to the stale `companies[index]`.

### Upload and progress (L387-L563)
1. `handleUpload` refuses to start if there are no rows or any validation errors remain. Otherwise it closes the preview, sets progress to 5%, and starts a **fake progress timer**: every 600 ms it raises the percentage (never above 90%) and adds 1 to `processedCount`, up to the number of rows.
2. It sends `POST {EXTERNAL}/crm/companies/bulk-upload` with the JSON body `{ companies, streamProgress: true, usePolling: true }`.
3. If the response contains a `sessionId`, `startProgressPolling` calls `GET {EXTERNAL}/crm/companies/bulk-upload/progress/:sessionId` repeatedly. It waits 1 s between polls, or 1.5 s after an exception. From the response it takes `percentage` (or computes `processed / total`, capped at 99%) plus `processed`, `successful` and `failed`. When `status` is `completed` or `finished`, it calls `finalizeUpload` with `summary`/`results`/the response body.
4. If there is no `sessionId`, the response is treated as the final result straight away (`result.results ?? result`).
5. `finalizeUpload` stops both timers, sets progress to 100%, stores the normalised summary, clears the rows and the file input, shows a success toast and calls `onUploadComplete()`. The page uses that callback to re-fetch the current page of companies.
6. On error, the component shows a toast, stops the timers and reopens the preview so the user can retry.

An unmount effect clears both the fake-progress interval and the polling timeout.

### Rendering (L582-L1026)
- **Outer dialog:** "Step 1: Download template", then "Step 2: Upload completed file" with a file input (`accept=".xlsx,.xls,.csv"`), then the progress panel while uploading, then the summary panel, and at the bottom "Reset Selection" and "Upload N Companies" buttons.
- **Nested preview dialog (L679-L890):** badges for the total row count and error count, a "Reupload" button, and a table of inline `Input`s for all 12 fields. Rows with errors get a red background. Below the table is an amber list of errors per row. The upload button reads "Fix N Errors First" while any errors remain.
- **Summary panel:** tiles for Total Processed, Successful, Failed and Success Rate, plus up to 10 failed rows (with their errors) and up to 10 successful rows. Longer lists end with an "...and N more" line.

## Exports
- `default BulkUploadCompaniesFlow({ open, onOpenChange, onUploadComplete? })` - a controlled modal. `open`/`onOpenChange` drive the outer dialog, and the optional `onUploadComplete` runs after a finished upload.

The types and helpers in this file (`CompanyRow`, `UploadSummary`, `parseCSV`, and so on) are not exported.

## Interfaces
- **External services:** the Garage UAT API at `https://uatapi.garage.app/api`, reached through `buildExternalUrl` in `lib/api-config.ts`. This is **not** this repo's `/backend` Express server, which has no `companies/bulk-upload` route.
  - `POST https://uatapi.garage.app/api/crm/companies/bulk-upload` - starts the bulk import.
  - `GET https://uatapi.garage.app/api/crm/companies/bulk-upload/progress/:sessionId` - polled for progress until the import completes.
  - The template file is downloaded from a public `nela-app` S3 bucket URL.
- **Browser storage / cookies:** none directly. `authenticatedFetch` reads the `auth-token`/`garage_tok` token from localStorage or cookies for the `Authorization: Bearer` header, and clears them when auth expires.
- **Background work:** a 600 ms fake-progress `setInterval`, and a `setTimeout`-chained progress poll every 1 s (1.5 s after an error).

## Dependencies
- **Internal:**
  - `components/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `progress.tsx`, `table.tsx`, `badge.tsx` - shadcn/Radix UI primitives.
  - `utils/api.ts` (`authenticatedFetch`) - authenticated fetch with Bearer token and CORS credentials. It retries 429/5xx/network errors up to 3 times with exponential backoff and redirects to `/login` on a 401 or an expired token.
  - `lib/api-config.ts` (`buildExternalUrl`) - prefixes paths with the external API base URL.
- **Packages:** `xlsx` (parses spreadsheets), `sonner` (toasts), `lucide-react` (icons), `next-themes` (theme detection), `react`.

## Used by
- `app/(dashboard)/deals/companies/page.tsx` - rendered at about L3459 with `open={isBulkUploadOpen}`, refreshing the list through `fetchCompanies(currentPageRef.current)` when the upload completes. This is the Next.js route `/deals/companies`. The same page is also mounted inside the dashboard's inline Deals app.

## Notes
- `authenticatedFetch` throws on any non-OK response, so the `!progressResponse.ok` branch in the poller almost never runs. Errors land in the `catch`, which schedules another poll. **Polling never gives up on its own.** If the progress endpoint keeps failing, it continues until the dialog closes or the component unmounts.
- The fake-progress timer keeps running while real polling is active. Both write `uploadProgress`/`processedCount`, so the numbers can briefly disagree until `finalizeUpload` stops the timer.
- In `normalizeUploadSummary`, `summarySource.successful`/`failed` is used both as a list and as a count. If the backend returns arrays under those keys with no explicit `successfulCount`/`failedCount`, the "count" becomes the array itself.
- The UI says "Drag and drop" and "max 10MB", but there is no drop handler other than the native file input, and no size check.
- CSV parsing does not handle quoted commas. Only the first sheet of an Excel workbook is read.
- The nested preview dialog always uses the light palette, even when the outer dialog is in dark mode.
- The API base URL in `lib/api-config.ts` is hardcoded to the UAT host, so this flow writes to that external environment no matter where this app is deployed.
