# `components/admin/wallets/StatsCards.tsx`

> Row of four summary tiles (orgs with wallets, total balance, outstanding debt, orgs with debt) for the garage-admin wallets page.

**Kind:** React component · **Lines:** 82

## Purpose
Gives super admins an at-a-glance view of the AIvatar wallet system across all organisations, above the wallets table. It is purely presentational: the parent page fetches the numbers and passes them in.

## How it works
- `WalletStatsCards` receives a `WalletStats` object or `null`. While `null` it renders four pulsing skeleton cards so the layout does not jump.
- With data it renders four `Stat` cards in a responsive grid (1 / 2 / 4 columns):
  - **Orgs with wallets** - `totalOrgs` (yellow, `Building2` icon)
  - **Total balance** - `totalBalance` formatted as dollars (green, `DollarSign`)
  - **Outstanding debt** - `totalDebt` formatted as dollars (red, `TrendingDown`)
  - **Orgs with debt** - `orgsWithDebt` (orange, `AlertTriangle`)
- `fmtCents(cents)` turns integer cents into `$1,234.56` with en-US grouping. All money values from the API are in cents.
- `Stat` is a local card component with a fixed accent palette (`yellow | green | red | orange`).

## Exports
- `WalletStatsCards({ stats }: { stats: WalletStats | null })` - the stats row; `null` shows a skeleton.

## Interfaces
- **Backend endpoints called:** none directly. The data shape comes from `GET /backend/garage-admin/wallets/stats` (`getWalletStats` in `lib/admin-api/wallets.ts`, called by the page), which aggregates over the `AivatarWallet` collection (`garage_aivatar_wallets`) and is limited to garage super admins.

## Dependencies
- **Internal:** `lib/admin-api/wallets.ts` - the `WalletStats` type only.
- **Packages:** `lucide-react` - icons.

## Used by
- `app/garage-admin/(admin-dashboard)/wallets/page.tsx` - rendered as `<WalletStatsCards stats={stats} />` on the admin wallets page.

## Notes
- `Stat` types its `icon` prop as `any`; any React component that accepts `className` works.
