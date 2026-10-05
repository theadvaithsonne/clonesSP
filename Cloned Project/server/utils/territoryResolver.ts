import { Types } from "mongoose";
import { Organization } from "../models/organization.model";
import {
  FranchiseCountry,
  IFranchiseCountry,
} from "../models/franchiseCountry.model";
import {
  FranchiseTerritory,
  IFranchiseTerritory,
} from "../models/franchiseTerritory.model";
import {
  FranchiseSubTerritory,
  IFranchiseSubTerritory,
} from "../models/franchiseSubTerritory.model";

export interface AddressInput {
  country?: string | null;
  state?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function caseInsensitiveExact(value: string) {
  return new RegExp("^" + escapeRegex(value.trim()) + "$", "i");
}

// ── City name aliases ─────────────────────────────────────────────────
//
// When a user-typed city doesn't exactly match a sub-territory `name`
// in the franchise catalog, try these known aliases as a fallback.
//
// Guiding rules for adding an entry:
//   1. The alias must ALWAYS point to the same canonical sub-territory
//      in real life (no ambiguity). e.g. "Bangalore" is always the
//      old spelling of Bengaluru — safe. "Delhi" is not — it could be
//      New Delhi (Union Territory) or Old Delhi (part of Delhi UT).
//   2. When a bare city name spans multiple sub-territories (e.g.
//      "Bengaluru" covers both Urban and Rural districts), we default
//      to the metropolitan / higher-density variant. A founder who
//      actually belongs to the Rural sub can override by typing the
//      full name ("Bengaluru Rural") — that hits the exact-match path
//      before this fallback runs.
//   3. Only include entries verified against the actual catalog. Every
//      alias -> canonical mapping here is real data at the time of
//      writing.
//   4. Keys are lower-cased and trimmed at lookup time.
//
// This fallback exists because the org signup UI collects free-text
// city names but the franchise catalog uses district-specific labels
// ("Bengaluru Urban" not "Bengaluru"). Rather than migrate 100+ orgs'
// data OR write to the read-only catalog, we translate here.
const CITY_NAME_ALIASES: Record<string, string> = {
  // India — Karnataka
  bengaluru: "Bengaluru Urban",
  bangalore: "Bengaluru Urban",
  "bangalore urban": "Bengaluru Urban",
  "bangalore rural": "Bengaluru Rural",
};

function normalizeAliasKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// ===========================================================================
// Leaf-aware resolution
// ===========================================================================
//
// Used by commission distribution: an office only earns commission for levels
// that actually exist in its leaf chain. A "gap" office (e.g. a Karnataka org
// that doesn't match any of Karnataka's sub-territories) has NO leaf and
// therefore pays NO territory commissions — everything stays with Shorupan.
//
// Leaf rules:
//   - sub-territory is always a leaf
//   - territory is a leaf only if it has zero sub-territories below it
//   - country is a leaf only if it has zero territories below it
//
// An office's leaf is the most-granular franchise entity it geographically
// falls into, where that entity IS a leaf. If the office falls into a
// non-leaf entity (e.g. Karnataka with sub-territories defined but the office
// doesn't match either of them) it has no leaf → gap.

export interface TerritoryLeafChain {
  /** The level at which the office's leaf sits. `null` = gap (no commissions). */
  leafLevel: "country" | "territory" | "subTerritory" | null;
  /** The sub-territory the office falls in (only set when leafLevel is "subTerritory"). */
  subTerritory: IFranchiseSubTerritory | null;
  /** The territory in the office's chain (set when leafLevel is "subTerritory" or "territory"). */
  territory: IFranchiseTerritory | null;
  /** The country in the office's chain (set at any non-null leafLevel). */
  country: IFranchiseCountry | null;
}

const EMPTY_LEAF_CHAIN: TerritoryLeafChain = {
  leafLevel: null,
  subTerritory: null,
  territory: null,
  country: null,
};

export async function resolveLeafFromAddress(
  addr: AddressInput
): Promise<TerritoryLeafChain> {
  if (!addr.country) return EMPTY_LEAF_CHAIN;

  // 1. Try sub-territory match (zipcode first, then country+state+city name).
  let sub: IFranchiseSubTerritory | null = null;
  if (addr.postalCode && addr.postalCode.trim().length > 0) {
    sub = await FranchiseSubTerritory.findOne({
      zipCodes: addr.postalCode.trim(),
    }).lean<IFranchiseSubTerritory>();
  }
  if (!sub && addr.state && addr.city) {
    sub = await FranchiseSubTerritory.findOne({
      country: caseInsensitiveExact(addr.country),
      parentTerritory: caseInsensitiveExact(addr.state),
      name: caseInsensitiveExact(addr.city),
    }).lean<IFranchiseSubTerritory>();
  }

  // 1b. Sub-territory alias fallback — ONLY runs after the exact-name
  // lookup above has failed. Translates common typed variants
  // ("Bengaluru", "Bangalore") to the canonical catalog name
  // ("Bengaluru Urban") before retrying. Zero-risk: any org that was
  // resolving correctly on the exact path never enters this block.
  // Any org that was previously in gap gets a second chance without
  // any change to the franchise catalog or the Organization schema.
  if (!sub && addr.state && addr.city) {
    const aliasKey = normalizeAliasKey(addr.city);
    const canonical = CITY_NAME_ALIASES[aliasKey];
    if (canonical && canonical.toLowerCase() !== aliasKey) {
      sub = await FranchiseSubTerritory.findOne({
        country: caseInsensitiveExact(addr.country),
        parentTerritory: caseInsensitiveExact(addr.state),
        name: caseInsensitiveExact(canonical),
      }).lean<IFranchiseSubTerritory>();
      if (sub) {
        console.log(
          `[territoryResolver] alias fallback: "${addr.city}" → "${canonical}"` +
            ` (country=${addr.country}, state=${addr.state})`
        );
      }
    }
  }

  if (sub) {
    const territory = sub.parentId
      ? await FranchiseTerritory.findById(sub.parentId).lean<IFranchiseTerritory>()
      : null;
    const country = await FranchiseCountry.findOne({
      name: caseInsensitiveExact(territory?.country || addr.country),
    }).lean<IFranchiseCountry>();
    return {
      leafLevel: "subTerritory",
      subTerritory: sub,
      territory: territory ?? null,
      country: country ?? null,
    };
  }

  // 2. No sub match. Try territory.
  if (addr.state) {
    const territory = await FranchiseTerritory.findOne({
      country: caseInsensitiveExact(addr.country),
      name: caseInsensitiveExact(addr.state),
    }).lean<IFranchiseTerritory>();

    if (territory) {
      // Leaf only if territory has no sub-territories below.
      const subCount = await FranchiseSubTerritory.countDocuments({
        parentId: String(territory._id),
      });
      if (subCount === 0) {
        const country = await FranchiseCountry.findOne({
          name: caseInsensitiveExact(addr.country),
        }).lean<IFranchiseCountry>();
        return {
          leafLevel: "territory",
          subTerritory: null,
          territory,
          country: country ?? null,
        };
      }
      // Territory has sub-territories but org matched none → gap.
      return EMPTY_LEAF_CHAIN;
    }
  }

  // 3. No territory match. Try country (only a leaf if it has no territories,
  // which is rare but possible — e.g. tiny countries / city-states).
  const country = await FranchiseCountry.findOne({
    name: caseInsensitiveExact(addr.country),
  }).lean<IFranchiseCountry>();
  if (country) {
    const terrCount = await FranchiseTerritory.countDocuments({
      country: caseInsensitiveExact(country.name || addr.country),
    });
    if (terrCount === 0) {
      return {
        leafLevel: "country",
        subTerritory: null,
        territory: null,
        country,
      };
    }
    // Country has territories defined but org matched none → gap.
  }

  return EMPTY_LEAF_CHAIN;
}

export async function resolveLeafFromOrg(
  orgId: Types.ObjectId | string
): Promise<TerritoryLeafChain | null> {
  const org = await Organization.findById(orgId)
    .select("country state city postalCode")
    .lean<{
      country?: string;
      state?: string;
      city?: string;
      postalCode?: string;
    }>();
  if (!org) return null;

  return resolveLeafFromAddress({
    country: org.country,
    state: org.state,
    city: org.city,
    postalCode: org.postalCode,
  });
}
