// Non-USD currencies granted to every member of a cryptobrand-flagged
// org (Organization.officeCreatedFromCryptobrand === true). Kept as a
// module-level constant for now — trivial to migrate to a per-org
// `Organization.cryptobrandSupportedCurrencies: string[]` later if
// founders need control over which extras they support.
//
// The USD wallet is the "parent" (see StoreWallet.parentWalletId) and
// is NOT listed here — it's created for every user in every org today.
// Only the SIBLINGS are enumerated here.
export const CRYPTOBRAND_EXTRA_CURRENCIES = ["INR", "ETH", "BTC", "USDT"] as const;

export type CryptobrandExtraCurrency =
  (typeof CRYPTOBRAND_EXTRA_CURRENCIES)[number];

/**
 * The full set of currencies a cryptobrand-org user should have wallets
 * for, USD first (parent). Used by the eager-creation service and the
 * fetch endpoint's safety-net top-up.
 */
export const CRYPTOBRAND_ALL_CURRENCIES = [
  "USD",
  ...CRYPTOBRAND_EXTRA_CURRENCIES,
] as const;
