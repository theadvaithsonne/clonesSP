# `app/(dashboard)/coverfi/brokerage/employees/page.tsx`

> Thin route file that renders the brokerage Stakeholders table.

**Kind:** Next.js page · **Lines:** 6 · **Route:** `/coverfi/brokerage/employees`

## Purpose
This is the "Stakeholders" tab of the Coverfi brokerage settings. The URL segment is `employees`, but the tab label and the component are called stakeholders. The file only binds the URL to `StakeholdersTable`, which lists and manages the brokerage's own staff through the external Coverfi API.

## How it works
`BrokerageStakeholdersPage()` returns `<StakeholdersTable />`. The page has no logic of its own. The header and tabs come from `coverfi/brokerage/layout.tsx`. Access control comes from `coverfi/layout.tsx`.

## Exports
- `default BrokerageStakeholdersPage()` - renders the stakeholders table.

## Dependencies
- **Internal:** `components/coverfi/brokerage/StakeholdersTable.tsx` - the stakeholder list and CRUD.

## Used by
No file imports it. It is reached at `/coverfi/brokerage/employees` through the "Stakeholders" tab in `components/coverfi/brokerage/BrokerageTabs.tsx`.
