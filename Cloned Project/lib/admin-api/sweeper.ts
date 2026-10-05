/**
 * Sweeper admin API — powers the /garage-admin/sweeper tab.
 * See garagenew-backend/src/routes/garageAdminSweeper.ts for the
 * backend contract.
 *
 * Detection stays automatic on the backend (WS + reconciler mark
 * invoices `matched` in real time). This module only surfaces the
 * subsequent "move USDT from N per-invoice deposit addresses into
 * the treasury" step, which is admin-triggered as of 2026-09-08.
 */
import { garageAdminApi } from "@/lib/api";

export type SweeperChain = "bsc" | "polygon" | "ethereum" | "bitcoin" | "tron";

/** One unswept row surfaced by GET /pending. */
export interface SweeperPendingRow {
  _id: string;
  chain: SweeperChain;
  coin: string;
  address: string;
  derivationIndex: number;
  matchedAt: string | Date | null;
  matchedTxHash: string | null;
  expectedAmount: string;
  expectedAmountAtomic: string;
  decimals: number;
  isNative: boolean;
  contractAddress: string | null;
  invoiceNumber: string | null;
  invoiceUserEmail: string | null;
  /** On-chain token/native balance in atomic units (string bigint). */
  onChainAtomic: string;
  /** USD approximation of `onChainAtomic`. 0 when the price feed is
   *  down — render "—" rather than "$0.00". */
  onChainUsd: number;
  /** On-chain native (gas) balance in that chain's atomic units.
   *  EVM = wei (18 decimals), Tron = sun (6), Bitcoin = 0 (no
   *  separate gas — fee comes out of the swept UTXOs themselves). */
  gasAtomic: string;
  /** Decimals for `gasAtomic`. 18 EVM / 6 Tron / 0 BTC. */
  gasDecimals: number;
  /** Symbol for the native gas coin (BNB / MATIC / ETH / TRX / ""). */
  gasSymbol: string;
  /** USD approximation of `gasAtomic`. 0 when unavailable. */
  gasUsd: number;
  /** Underlying request status — "matched" for a settled invoice, or
   *  "pending"/"expired" for a row that only appears because funds
   *  arrived without settling (see `sweepReason`). */
  requestStatus: string;
  /** Why this row is sweepable.
   *  - "matched"          → the invoice settled normally.
   *  - "unmatched_funds"  → crypto landed but couldn't settle the
   *    invoice (underpayment). Money is real and recoverable; the
   *    purchase just didn't complete. */
  sweepReason: "matched" | "unmatched_funds";
  // ── Event timeline ────────────────────────────────────────────
  /** When the deposit address was minted (invoice checkout started). */
  createdAt: string | Date | null;
  /** When the address stopped accepting on-time payments. */
  addressExpiresAt: string | Date | null;
  /** Block time of the incoming transfer — when the buyer's money
   *  ACTUALLY landed. Distinct from `matchedAt` (when we noticed). */
  fundsReceivedAt: string | Date | null;
  fundsReceivedTxHash: string | null;
  /** `matchedAt - fundsReceivedAt` in ms. How long detection took.
   *  Null when either timestamp is missing (legacy rows). */
  detectionLagMs: number | null;
}

/** One completed sweep returned by GET /history. */
export interface SweeperHistoryRow {
  _id: string;
  chain: SweeperChain;
  coin: string;
  address: string;
  derivationIndex: number;
  matchedAt: string | Date | null;
  matchedTxHash: string | null;
  expectedAmount: string;
  expectedAmountAtomic: string;
  decimals: number;
  /** Approximate USD value at request time (NOT the price at sweep
   *  time — we don't store that). FE labels it "≈ $X today". */
  amountUsd: number;
  sweptAt: string | Date | null;
  sweepTxHash: string | null;
  /** Treasury address the sweep landed at. Reads from env at query
   *  time — a treasury rotation would misrepresent old rows; the
   *  on-chain tx is the authoritative destination proof. */
  sweepDestination: string | null;
  invoiceNumber: string | null;
  invoiceUserEmail: string | null;
  // ── Event timeline ────────────────────────────────────────────
  // History used to return only `sweptAt`, so there was no way to see
  // when a payment arrived vs when it was consolidated.
  createdAt: string | Date | null;
  addressExpiresAt: string | Date | null;
  fundsReceivedAt: string | Date | null;
  fundsReceivedTxHash: string | null;
  detectionLagMs: number | null;
  // ── What's STILL on the address after the sweep ────────────────
  // An ERC-20 sweep is signed BY the deposit address, so the address
  // must hold native coin to pay its own gas. Whatever isn't burned
  // stays behind. These expose that remainder so stranded gas is
  // visible instead of disappearing the moment a row is swept.
  /** Token still on the address post-sweep, atomic units. */
  residualTokenAtomic: string;
  residualTokenUsd: number;
  /** Native/gas coin still on the address, atomic units. */
  residualGasAtomic: string;
  residualGasDecimals: number;
  /** BNB / MATIC / ETH / TRX — "" for Bitcoin (no separate gas). */
  residualGasSymbol: string;
  residualGasUsd: number;
  /** True when anything of value remains. Drives the leftover badge. */
  hasResidual: boolean;
  // ── Gas-recovery bookkeeping ───────────────────────────────────
  /** Tx that returned leftover gas to treasury. Null = never succeeded. */
  nativeRecoveryTxHash: string | null;
  nativeRecoveredAmount: number | null;
  /** Why recovery didn't complete. Non-null = gas is stranded. */
  nativeRecoveryFailedReason: string | null;
  /** Null = recovery was never even attempted on this row. */
  nativeRecoveryAttemptedAt: string | Date | null;
}

/** Outcome of POST /recover-gas for one address. */
export interface SweeperRecoverGasResult {
  success: boolean;
  chain?: SweeperChain;
  address: string;
  txHash?: string;
  amount?: number;
  error?: string;
}

/** Top-of-page totals returned by GET /summary. */
export interface SweeperSummary {
  totalPendingCount: number;
  totalPendingUsd: number;
  totalSweptLast30dCount: number;
  totalSweptLast30dUsd: number;
  chainBreakdown: Array<{
    chain: SweeperChain;
    pendingCount: number;
    pendingUsd: number;
  }>;
}

/** One chain's gas-float wallet status. */
export interface SweeperGasStatus {
  chain: "bsc" | "polygon" | "ethereum";
  address: string;
  balanceAtomic: string;
  balanceWhole: number;
  gasPriceWei: string;
  /** Estimated sweeps of runway the drum funds at current gas price. */
  sweepsFunded: number;
}

/** Per-row sweep outcome returned by POST /run. */
export interface SweeperRunResult {
  success: boolean;
  requestId: string;
  chain: SweeperChain;
  coin: string;
  address: string;
  sweptAmount?: number;
  sweepTxHash?: string;
  gasTopupTxHash?: string;
  skippedReason?: string;
  error?: string;
}

export async function listPendingSweeps(): Promise<{
  success: true;
  rows: SweeperPendingRow[];
}> {
  return garageAdminApi("/garage-admin/sweeper/pending");
}

export async function getSweeperGasStatus(): Promise<{
  success: true;
  chains: SweeperGasStatus[];
}> {
  return garageAdminApi("/garage-admin/sweeper/gas-status");
}

export async function runSweeper(body: {
  requestId?: string;
  chain?: SweeperChain;
  all?: boolean;
}): Promise<{
  success: true;
  results: SweeperRunResult[];
  counts: { swept: number; skipped: number; errors: number };
}> {
  return garageAdminApi("/garage-admin/sweeper/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listSweepHistory(params: {
  chain?: SweeperChain;
  limit?: number;
  skip?: number;
} = {}): Promise<{
  success: true;
  rows: SweeperHistoryRow[];
  total: number;
}> {
  const q = new URLSearchParams();
  if (params.chain) q.set("chain", params.chain);
  if (params.limit !== undefined) q.set("limit", String(params.limit));
  if (params.skip !== undefined) q.set("skip", String(params.skip));
  const qs = q.toString();
  return garageAdminApi(
    `/garage-admin/sweeper/history${qs ? `?${qs}` : ""}`,
  );
}

export async function getSweeperSummary(): Promise<
  { success: true } & SweeperSummary
> {
  return garageAdminApi("/garage-admin/sweeper/summary");
}

/**
 * Drain leftover native coin (gas) from an already-swept deposit
 * address back to the treasury.
 *
 * The sweep tries this automatically, but that leg is best-effort and
 * has historically failed silently under RPC rate-limits — stranding
 * gas on-chain with no way to reclaim it from the UI. This is the
 * manual retry. No-ops safely on an address with nothing left.
 */
export async function recoverSweeperGas(body: {
  requestId?: string;
  all?: boolean;
}): Promise<{
  success: true;
  results: SweeperRecoverGasResult[];
  counts?: { scanned: number; recovered: number; failed: number };
}> {
  return garageAdminApi("/garage-admin/sweeper/recover-gas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
