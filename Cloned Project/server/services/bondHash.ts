// Public identifier for a purchased bond — the "bond hash".
//
// Anyone holding a bond hash can view that bond's public page (value,
// interest paid, remaining payments, schedule), so the identifier must
// not be guessable or enumerable. A sequential or short id would let
// anyone step through every bond on the platform and scrape what each
// one holds.
//
// Format: 12 random digits, never starting with 0 — readable, easy to
// paste into a search box, and matches the numeric look of the design
// ("Bitcoin Bond - 23416167"). ~3.9 x 10^11 possible values: at the
// public endpoint's rate limit, guessing even one live bond is not a
// practical attack.
//
// This is NOT an on-chain hash. Bonds are wallet-ledger records, so
// the id cannot be verified on a blockchain explorer.

import crypto from "crypto";

export const BOND_HASH_LENGTH = 12;

export function generateBondHash(): string {
  // First digit 1-9 so the value never loses a leading zero when a
  // client treats it as a number.
  let out = String(crypto.randomInt(1, 10));
  for (let i = 1; i < BOND_HASH_LENGTH; i++) {
    out += String(crypto.randomInt(0, 10));
  }
  return out;
}

/**
 * Normalise user input from a search box: tolerate spaces, dashes and
 * a leading "#". Returns null when what's left can't be a bond hash,
 * so callers can 400 without touching the database.
 */
export function normalizeBondHash(raw: unknown): string | null {
  const digits = String(raw ?? "").replace(/[\s\-#]/g, "");
  return /^[1-9]\d{11}$/.test(digits) ? digits : null;
}
