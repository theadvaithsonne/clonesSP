/**
 * Dry-run: derive the first N addresses per chain from a supplied
 * mnemonic and print them. Use this BEFORE flipping the HD flag on to
 * verify our derivation matches MetaMask + TronLink (or any hardware
 * wallet) for the same seed at the same paths.
 *
 * If the addresses don't match, DO NOT SHIP — the seed you gave the
 * treasury team controls a different set of addresses than the ones
 * we're about to hand customers as deposit addresses.
 *
 * Usage:
 *   CRYPTO_WALLET_MNEMONIC="word1 word2 ..." \
 *     ./node_modules/.bin/tsx src/scripts/derive-test-addresses.ts [count]
 *
 * Default count = 5. Never commit an actual mnemonic to git — this
 * script only reads from env at runtime.
 */
import "dotenv/config";
import {
  deriveEvmAddress,
  deriveTronAddress,
  deriveBitcoinAddress,
  isHdEnabled,
} from "../services/cryptoWallet";

function main() {
  if (!isHdEnabled()) {
    console.error(
      "\n✗ HD wallet is disabled. Set CRYPTO_WALLET_MNEMONIC (12 or 24 words) and try again.\n",
    );
    process.exit(1);
  }

  const count = Math.max(1, Math.min(50, Number(process.argv[2] || 5)));

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  HD derivation smoke test`);
  console.log(`  Deriving first ${count} address(es) per chain from the seed`);
  console.log(`══════════════════════════════════════════════════════════════\n`);

  console.log(`── EVM (Polygon + BSC + Ethereum — same 0x on all three) ─`);
  console.log(`   path: m/44'/60'/0'/0/{i}`);
  for (let i = 0; i < count; i++) {
    const d = deriveEvmAddress(i);
    console.log(`   [${i}] ${d.address}`);
  }

  console.log(`\n── Tron ───────────────────────────────────────────────────`);
  console.log(`   path: m/44'/195'/0'/0/{i}`);
  for (let i = 0; i < count; i++) {
    const d = deriveTronAddress(i);
    console.log(`   [${i}] ${d.address}`);
  }

  console.log(`\n── Bitcoin (native SegWit, bech32) ───────────────────────`);
  console.log(`   path: m/84'/0'/0'/0/{i}`);
  for (let i = 0; i < count; i++) {
    const d = deriveBitcoinAddress(i);
    console.log(`   [${i}] ${d.address}`);
  }

  console.log(`\n══════════════════════════════════════════════════════════════`);
  console.log(`  Verification steps:`);
  console.log(`  1. Import the SAME mnemonic into MetaMask (EVM tab, default`);
  console.log(`     path m/44'/60'/0'/0). The first N accounts must equal`);
  console.log(`     the [0..N-1] rows above under "EVM".`);
  console.log(`  2. Import the SAME mnemonic into TronLink (or Ledger Live +`);
  console.log(`     Tron app). The first N addresses must equal the [0..N-1]`);
  console.log(`     rows above under "Tron".`);
  console.log(`  3. If ANY address mismatches — DO NOT SHIP. Path bug.`);
  console.log(`══════════════════════════════════════════════════════════════\n`);
}

main();
