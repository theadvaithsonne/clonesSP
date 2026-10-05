/**
 * The country list for phone inputs, with a dial code you can actually dial.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * `country-state-city` does not store a dial code in `phonecode`. It stores a
 * human-readable note, and for 26 countries that note is not a number:
 *
 *   Dominican Republic   "+1-809 and 1-829"
 *   Puerto Rico          "+1-787 and 1-939"
 *   Jamaica              "+1-876"
 *   India                "91"          ← no "+"
 *   Anguilla             "+1-264"      ← with "+"
 *
 * Concatenating that with a local number produced two live bugs:
 *
 *   1. A Dominican user could not register at all. The app sent
 *      "+1-809 and 1-829 7635544" and the backend's phone regex rejected the
 *      word "and" (routes/profile.ts). Reported 29 Sep by a DR member whose
 *      number starts 849 — a third area code the string doesn't even mention.
 *      809, 829 and 849 all failed identically; the digits were never the
 *      problem.
 *   2. On web it failed SILENTLY and worse. `toE164` strips non-digits from
 *      the dial code, so "+1-809 and 1-829" collapsed to "18091829" and the
 *      user's number was saved as +180918297635544 — plausible-looking,
 *      undialable, and no OTP ever arrives.
 *
 * The inconsistent "+" also meant `` `+${c.phonecode}` `` rendered "++1-264"
 * for half the Caribbean.
 *
 * ── What this returns ────────────────────────────────────────────────────
 * The same `ICountry` objects with `phonecode` replaced by the real calling
 * code from libphonenumber-js, digits only and never prefixed with "+". Every
 * existing read then does the right thing: `+${c.phonecode}` → "+1",
 * `c.phonecode.replace(/^\+/, "")` → "1", `digits.startsWith(c.phonecode)`
 * → matches.
 *
 * Note the deliberate consequence: a +1 country's dial code is "1", not
 * "1-876". The area code belongs to the number the user types, which is what
 * lets a 849 number exist at all. NANP users now enter all ten digits.
 */

import { Country, type ICountry } from "country-state-city";
import { getCountryCallingCode, type CountryCode } from "libphonenumber-js";

/**
 * Which country owns a dial code that several share.
 *
 * Prefill walks this list and takes the first country whose dial code the
 * stored number starts with, so without this a US number resolves to whatever
 * sorts first — today Canada, and after this change American Samoa. These are
 * libphonenumber's own "main country for calling code" values.
 */
const PRIMARY_FOR_DIAL: Record<string, string> = {
  "1": "US",
  "7": "RU",
  "39": "IT",
  "44": "GB",
  "47": "NO",
  "61": "AU",
  "212": "MA",
  "262": "RE",
  "358": "FI",
  "590": "GP",
  "599": "CW",
};

/**
 * libphonenumber has no metadata for a handful of uninhabited territories
 * (Antarctica, Bouvet Island, Pitchairn…). Keep them in the list rather than
 * changing its length, with the first run of digits from the package value.
 */
function fallbackDial(phonecode: string): string {
  const m = String(phonecode || "").match(/\d+/);
  return m ? m[0] : "";
}

let cached: ICountry[] | null = null;

/**
 * Every country, ordered for the dropdown, with a dialable `phonecode`.
 *
 * Use this anywhere a country feeds a PHONE field. For a plain country-name
 * field, `Country.getAllCountries()` is still fine.
 */
export function phoneCountries(): ICountry[] {
  if (cached) return cached;

  const fixed = Country.getAllCountries().map((c) => {
    let dial: string;
    try {
      dial = getCountryCallingCode(c.isoCode as CountryCode);
    } catch {
      dial = fallbackDial(c.phonecode);
    }
    return { ...c, phonecode: dial };
  });

  // Hoist each shared code's primary country above its siblings so prefill
  // resolves "+1555…" to the United States. Only the primary moves, and only
  // to the position of the first country sharing its code — the list stays
  // alphabetical everywhere else.
  const out: ICountry[] = [];
  const hoisted = new Set<string>();
  for (const c of fixed) {
    const primaryIso = PRIMARY_FOR_DIAL[c.phonecode];
    if (primaryIso && !hoisted.has(c.phonecode)) {
      hoisted.add(c.phonecode);
      const primary = fixed.find((x) => x.isoCode === primaryIso);
      if (primary && primary.isoCode !== c.isoCode) out.push(primary);
    }
    if (primaryIso && c.isoCode === primaryIso && out.includes(c)) continue;
    out.push(c);
  }

  cached = out;
  return out;
}

/** One country by ISO code, carrying the corrected dial code. */
export function phoneCountryByIso(iso: string): ICountry | null {
  return phoneCountries().find((c) => c.isoCode === iso) || null;
}
