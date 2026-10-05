import { randomInt } from "crypto";

/**
 * Share-link tokens.
 *
 * One format for every link, whatever its access level. Tokens used to carry
 * an `int_` / `pub_` prefix, which meant a copied URL announced whether the
 * file behind it was private — two links out of the same cabinet looked like
 * two different kinds of thing, and the prefix was load-bearing at resolve
 * time.
 *
 * The access level now lives on the link record (`accessLevel`), so the token
 * is nothing but an opaque id: same alphabet, same length, same casing, for
 * public and restricted alike.
 */

// Mixed-case alphanumerics, no separators — 62^22 ≈ 131 bits of entropy.
const TOKEN_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const TOKEN_LENGTH = 22;

/**
 * Generate a shareable link token.
 *
 * `randomInt` rather than slicing `randomBytes`: it rejection-samples, so no
 * character comes up more often than another.
 */
export function generateShareableToken(): string {
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += TOKEN_ALPHABET[randomInt(0, TOKEN_ALPHABET.length)];
  }
  return token;
}

/**
 * Validate token format.
 *
 * Legacy `int_` / `pub_` tokens minted before the formats were unified are
 * still accepted — they are out in the wild and resolve fine, since resolution
 * reads the database record rather than the prefix.
 */
export function isValidShareableToken(token: string): boolean {
  if (/^[A-Za-z0-9]{22}$/.test(token)) return true;
  return /^(int|pub)_[A-Za-z0-9_-]{12}$/.test(token);
}
