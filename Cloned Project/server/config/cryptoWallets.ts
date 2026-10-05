// Central config for in-house crypto payment support.
//
// Adding a new chain/coin is 3 things: extend SUPPORTED_CHAINS, add the
// public address env var, and add a driver in services/cryptoPaymentPoller.ts.
// The rest of the pipeline (payment-request service, FE panel) is coin-
// agnostic.
import { env } from "./env";
import type { CryptoChain, CryptoCoin } from "../models/cryptoPaymentRequest.model";

export interface SupportedChainConfig {
  chain: CryptoChain;
  coin: CryptoCoin;
  /** Display name for the FE picker, e.g. "USDT on Tron". */
  label: string;
  /** Human-readable chain label (used in warnings on the payment panel). */
  chainName: string;
  /** Decimal precision of the token's smallest unit. */
  decimals: number;
  /**
   * The LARGEST decimals a mainstream wallet UI (MetaMask, Trust,
   * TronLink, TokenPocket) can safely display and accept as sender
   * input. The amount-tail disambiguation lives inside these decimals
   * so senders can type the full displayed amount by hand.
   *
   * Defaults to `decimals` for compatibility. Set explicitly when the
   * token's on-chain `decimals` exceed what wallets can render — e.g.
   * BEP-20 USDT is 18 decimals but every wallet shows only 6.
   */
  displayDecimals?: number;
  /**
   * Contract address of the token on-chain (used by the poller +
   * listener). Empty string flags a NATIVE coin (ETH on Ethereum,
   * TRX on Tron etc.) — the mint path skips ERC-20 amount encoding
   * and the native EVM listener scans block value transfers rather
   * than filtering Transfer events.
   */
  contractAddress: string;
  /**
   * True for native-coin invoices (e.g. ETH on Ethereum). Native coins:
   *   - Have no ERC-20 contract to filter events on.
   *   - Are USD-priced with live-FX conversion at mint time (via
   *     services/cryptoFxRate.ts), never USD-pegged like USDT/USDC.
   *   - Sweep by draining the native balance itself (balance IS the
   *     gas source; no pre-funded float wallet needed).
   */
  isNative?: boolean;
  /** Which env var holds our receiving wallet. Null when unconfigured. */
  platformAddress: string;
  /**
   * Prefix for wallet-app URI QR codes. TRC-20 wallets accept
   * `tron:<address>?token=<contract>&amount=<amount>`, EVM wallets
   * accept `<contract>@<chainId>/transfer?address=<recipient>&uint256=<atomic>`.
   * When null, we render just the address as the QR payload (still
   * works — most wallets recognize bare addresses).
   */
  qrScheme?: string;
}

// USDT on Tron (TRC-20) — cheapest USDT chain (~$0.50 gas), popular in
// retail. Token contract: TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t (mainnet).
const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

// USDT on Polygon (ERC-20) — pennies gas, widely held. Token contract:
// 0xc2132D05D31c914a87C6611C10748AEb04B58e8F (Tether-issued mainnet USDT).
// Replaces the earlier USDC-Polygon slot — see the migration note in
// the module header.
const USDT_POLYGON_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

// USDC on Polygon (bridged / USDC.e) — widely-held stablecoin, penny
// gas. Token contract: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174.
// If you want NATIVE USDC on Polygon (Circle-issued, newer, less liquid
// as of 2026) swap to: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359.
// Reactivated slot — was removed when the Polygon USDT contract took
// over; needed again for the HiFi investment flow (product `currency`
// = "USDC" pays via this pipeline, not the store wallet).
const USDC_POLYGON_CONTRACT = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// USDT on BNB Smart Chain (BEP-20) — Binance-issued. Token contract:
// 0x55d398326f99059fF775485246999027B3197955 (mainnet). NOTE: 18
// decimals, NOT 6 like the TRC-20/ERC-20/Polygon USDT variants — the
// atomic-amount math in cryptoPaymentRequest.ts uses `displayDecimals`
// (6) to keep the sender-facing amount at 6 decimals despite the
// on-chain unit being 10^18. Do not "fix" that back to 18 — no wallet
// UI can render or accept an 18-decimal token amount by hand.
const USDT_BEP20_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

export const SUPPORTED_CHAINS: SupportedChainConfig[] = [
  {
    chain: "tron",
    coin: "USDT",
    label: "USDT on Tron",
    chainName: "TRON",
    decimals: 6,
    displayDecimals: 6,
    contractAddress: USDT_TRC20_CONTRACT,
    platformAddress: env.PLATFORM_USDT_TRC20_ADDRESS,
  },
  {
    chain: "polygon",
    coin: "USDT",
    label: "USDT on Polygon",
    chainName: "Polygon",
    decimals: 6,
    displayDecimals: 6,
    contractAddress: USDT_POLYGON_CONTRACT,
    platformAddress: env.PLATFORM_USDT_POLYGON_ADDRESS,
  },
  {
    chain: "polygon",
    coin: "USDC",
    label: "USDC on Polygon",
    chainName: "Polygon",
    decimals: 6,
    displayDecimals: 6,
    contractAddress: USDC_POLYGON_CONTRACT,
    platformAddress: env.PLATFORM_USDC_POLYGON_ADDRESS,
  },
  {
    chain: "bsc",
    coin: "USDT",
    label: "USDT on BSC",
    chainName: "BNB Smart Chain",
    decimals: 18,
    displayDecimals: 6,
    contractAddress: USDT_BEP20_CONTRACT,
    platformAddress: env.PLATFORM_USDT_BEP20_ADDRESS,
  },
  // Native POL on Polygon mainnet.
  //
  // POL (formerly MATIC — same contract, renamed Sep 2024) is Polygon's
  // native gas coin. Same isNative machinery as ETH: no ERC-20 contract,
  // USD-priced at mint via CoinGecko ("matic-network"), detected by
  // cryptoNativeEvmWatcher's value-transfer scan, no gas-float wallet
  // needed (balance IS the gas source).
  //
  // 18 decimals native. Display at 6 so senders see "0.1234 POL" rather
  // than raw wei — matches ETH's displayDecimals treatment.
  //
  // Uses the same 0x hot-wallet as USDT/USDC on Polygon (one seed → one
  // 0x address across all EVM chains). Requires `polygon` in
  // CRYPTO_HD_ENABLED_CHAINS to surface in the invoice picker.
  {
    chain: "polygon",
    coin: "POL",
    label: "Native POL on Polygon",
    chainName: "Polygon",
    decimals: 18,
    displayDecimals: 6,
    contractAddress: "", // native — no contract
    platformAddress: env.CRYPTO_HOT_WALLET_ADDRESS_POLYGON,
    isNative: true,
  },
  // Native ETH on Ethereum mainnet.
  //
  // No token contract — ETH is the chain's native asset. `isNative` flips
  // the mint path from ERC-20-style Transfer detection to native
  // value-transfer detection (see cryptoNativeEvmWatcher). Amount is
  // USD-priced with live FX conversion at mint time (see
  // cryptoFxRate); the buyer commits to a fixed ETH quote for a 24h
  // window and pays exactly that amount.
  //
  // Same private key that controls the Polygon+BSC 0x address ALSO
  // controls the same address on Ethereum mainnet — one seed, three
  // EVM chains, one treasury address.
  //
  // 18 decimals native (wei). Display at 6 decimals so senders see
  // "0.001234 ETH" cleanly rather than 18 zeros.
  {
    chain: "ethereum",
    coin: "ETH",
    label: "Native ETH on Ethereum",
    chainName: "Ethereum",
    decimals: 18,
    displayDecimals: 6,
    contractAddress: "", // native — no contract
    platformAddress: env.CRYPTO_HOT_WALLET_ADDRESS_ETHEREUM,
    isNative: true,
  },
  // Native BTC on Bitcoin mainnet — native SegWit (bech32) addresses.
  //
  // UTXO model, not EVM. Handled by cryptoBitcoinWatcher (mempool.space
  // WS) for detection and cryptoBitcoinSweeper (bitcoinjs-lib PSBT)
  // for consolidation. Amount is USD-priced at mint (like ETH), with
  // the FX rate captured on the request via `usdPerCoinAtMint`.
  //
  // 8 decimals — 1 BTC = 10^8 satoshis. Display at 8 too (Bitcoin
  // wallets show full sat precision; no truncation needed).
  //
  // No fallback treasury: BTC mainnet uses bech32 addresses (bc1q…),
  // NOT compatible with our EVM 0x hot-wallet. `CRYPTO_HOT_WALLET_ADDRESS_BITCOIN`
  // must be set explicitly before enabling BTC in CRYPTO_HD_ENABLED_CHAINS.
  {
    chain: "bitcoin",
    coin: "BTC",
    label: "Native BTC on Bitcoin",
    chainName: "Bitcoin",
    decimals: 8,
    displayDecimals: 8,
    contractAddress: "", // native — no contract
    platformAddress: env.CRYPTO_HOT_WALLET_ADDRESS_BITCOIN,
    isNative: true,
  },
];

/**
 * Look up a supported chain+coin combination. Returns null when the
 * pair isn't supported OR when its `platformAddress` env var is empty
 * (deployment misconfiguration — caller should surface a friendly error).
 */
export function getChainConfig(
  chain: string,
  coin: string
): SupportedChainConfig | null {
  const match = SUPPORTED_CHAINS.find(
    (c) => c.chain === chain && c.coin === coin
  );
  if (!match) return null;
  if (!match.platformAddress) return null;
  return match;
}

/**
 * All configured (address is set) chain configs. Used by the FE picker
 * to show only options we can actually accept payments on. If we ever
 * disable a chain temporarily, unsetting the env var takes it out of
 * the picker with no code change.
 *
 * Native coins (ETH, BTC) have NO legacy shared-address settlement
 * path — the `cryptoPaymentPoller` only drives tron/polygon/bsc. Their
 * detection requires the HD watcher (WebSocket for EVM, mempool.space
 * for BTC). So we additionally require HD to be enabled for that chain
 * before surfacing it in the picker — otherwise a buyer picks ETH,
 * the invoice mints, they send ETH, and it never settles because
 * nothing is listening.
 *
 * USDT/USDC (Polygon/BSC/Tron) are unaffected — the legacy poller
 * handles them whether HD is on or off, so they surface whenever
 * their platformAddress is populated.
 */
export function getConfiguredChains(): SupportedChainConfig[] {
  const enabled = (env.CRYPTO_HD_ENABLED_CHAINS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return SUPPORTED_CHAINS.filter((c) => {
    if (!c.platformAddress) return false;
    if (c.isNative && !enabled.includes(c.chain)) return false;
    return true;
  });
}
