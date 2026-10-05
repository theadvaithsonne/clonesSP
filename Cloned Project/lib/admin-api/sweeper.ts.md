# `lib/admin-api/sweeper.ts`

> Garage-admin client for the crypto sweeper: lists funded per-invoice deposit addresses, moves their USDT/coins into the treasury, shows sweep history and gas-wallet status, and recovers leftover gas.

**Kind:** frontend library · **Lines:** 253

## Purpose
Each crypto checkout creates its own deposit address (derived from an HD wallet). The backend detects payments automatically: a WebSocket listener and a reconciler mark invoices `matched` in real time. This module only handles the next step, which has been triggered by an admin since 2026-09-08: **consolidating the funds from many deposit addresses into the treasury**. It powers the `/garage-admin/sweeper` page.

## How it works
### Where the requests go
`/garage-admin/sweeper/*` is **not served by this repo's Express routes**. In `server/app.ts`, when `CRYPTO_BACKEND_URL` is set, `/garage-admin/sweeper` is proxied with `http-proxy-middleware` to the separate external garage-crypto-backend service. The local route was deleted when the crypto code was extracted. If the variable is unset, these calls return 404. The source comment's pointer to `garagenew-backend/src/routes/garageAdminSweeper.ts` is out of date.

### Data shapes
- **`SweeperPendingRow`** - an address that has not been swept yet. It has:
  - chain and coin, address, derivation index, contract and decimals;
  - the expected amount, and the live on-chain balance (`onChainAtomic` as a bigint string, plus `onChainUsd`);
  - the gas balance for that chain (`gasAtomic`, `gasDecimals` 18 for EVM / 6 for Tron / 0 for Bitcoin, `gasSymbol`, `gasUsd`);
  - the invoice number and buyer email;
  - `sweepReason`: `matched` (the invoice settled normally) or `unmatched_funds` (crypto arrived but did not settle the invoice, for example an underpayment; the money is real and recoverable);
  - an event timeline: `createdAt`, `addressExpiresAt`, `fundsReceivedAt` / `fundsReceivedTxHash` (block time when the money actually arrived), `matchedAt` (when it was noticed), and `detectionLagMs` between the two.
  A USD value of 0 means the price feed was down; show "—", not "$0.00".
- **`SweeperHistoryRow`** - a completed sweep. It has:
  - `sweptAt`, `sweepTxHash` and `sweepDestination` (read from env when queried, so a treasury rotation would mislabel old rows; the on-chain transaction is the real proof);
  - `amountUsd`, valued at request time, not at sweep time;
  - the same timeline fields;
  - **leftovers**: an ERC-20 sweep is signed by the deposit address, which must hold native coin to pay its gas, so any gas not used stays behind. The `residualToken*` / `residualGas*` fields and `hasResidual` make that visible;
  - gas-recovery bookkeeping: `nativeRecoveryTxHash`, `nativeRecoveredAmount`, `nativeRecoveryFailedReason` (set when the gas is stuck), `nativeRecoveryAttemptedAt` (null when recovery was never attempted).
- **`SweeperSummary`** - pending count and USD, swept count and USD for the last 30 days, and a per-chain breakdown.
- **`SweeperGasStatus`** - per-chain status of the gas-float wallet (BSC, Polygon, Ethereum only): balance, gas price, and `sweepsFunded` (how many more sweeps it can pay for).
- **`SweeperRunResult`** / **`SweeperRecoverGasResult`** - the outcome for each address.

### Calls
All calls go through `garageAdminApi`. The two POSTs set `Content-Type` explicitly.
- `listPendingSweeps()`, `getSweeperGasStatus()`, `getSweeperSummary()` - reads.
- `runSweeper({ requestId? | chain? | all? })` - sweeps one request, one chain or everything. Returns per-row results and counts (`swept`, `skipped`, `errors`).
- `listSweepHistory({ chain?, limit?, skip? })` - paginated history with `total`.
- `recoverSweeperGas({ requestId? | all? })` - manual retry for draining leftover gas back to the treasury. The sweep tries this automatically, but per the source comment that step is best-effort and has failed silently under RPC rate limits. Recovery does nothing, safely, on an address with nothing left.

## Exports
- Types: `SweeperChain` (`bsc | polygon | ethereum | bitcoin | tron`), `SweeperPendingRow`, `SweeperHistoryRow`, `SweeperRecoverGasResult`, `SweeperSummary`, `SweeperGasStatus`, `SweeperRunResult`.
- `listPendingSweeps()`, `getSweeperGasStatus()`, `runSweeper(body)`, `listSweepHistory(params?)`, `getSweeperSummary()`, `recoverSweeperGas(body)`.

## Interfaces
- **Backend endpoints called** (proxied to the external garage-crypto-backend):
  - `GET /backend/garage-admin/sweeper/pending` - unswept addresses
  - `GET /backend/garage-admin/sweeper/gas-status` - gas-wallet status
  - `POST /backend/garage-admin/sweeper/run` - run a sweep
  - `GET /backend/garage-admin/sweeper/history?chain&limit&skip` - sweep history
  - `GET /backend/garage-admin/sweeper/summary` - totals
  - `POST /backend/garage-admin/sweeper/recover-gas` - recover leftover gas
- **External services:** garage-crypto-backend (reached through the `CRYPTO_BACKEND_URL` proxy), which signs on-chain transactions on BSC, Polygon, Ethereum, Tron and Bitcoin.
- **Environment variables:** `CRYPTO_BACKEND_URL` (server side) decides whether these endpoints exist.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/sweeper/page.tsx`

## Notes
- `runSweeper` and `recoverSweeperGas` send real on-chain transactions.
- In `server/app.ts` the proxy is mounted before `express.json()` and before the admin page gate, so authorising these requests is up to the crypto backend.
