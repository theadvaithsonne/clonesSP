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
import { AddressInput, caseInsensitiveExact } from "./territoryResolver";

/**
 * Founder-program geo resolution.
 *
 * Unlike `resolveLeafFromAddress` (which bakes in the GLOBAL system's
 * ownerEmail / leaf / gap rules), this returns the raw catalog entities an
 * address falls into at each level — pure geography, no ownership. The founder
 * distributor then looks up that program's own assignments by `geoEntityId`
 * and applies chain-integrity using the assignment ownership.
 *
 * Reuses the same geographic catalog (franchise_countries /
 * franchise_territorymasters / franchise_sub_territories) as the global
 * system, and the same address-matching helpers from `territoryResolver`.
 */

export interface GeoChain {
  country: IFranchiseCountry | null;
  territory: IFranchiseTerritory | null;
  subTerritory: IFranchiseSubTerritory | null;
}

const EMPTY_GEO_CHAIN: GeoChain = {
  country: null,
  territory: null,
  subTerritory: null,
};

export async function resolveGeoChainFromAddress(
  addr: AddressInput
): Promise<GeoChain> {
  if (!addr || !addr.country) return EMPTY_GEO_CHAIN;

  // 1. Sub-territory: postalCode (exact in zipCodes) first, then
  //    country+state+city name match.
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

  // 2. Territory: parent of the matched sub, else state-name match.
  let territory: IFranchiseTerritory | null = null;
  if (sub?.parentId) {
    territory = await FranchiseTerritory.findById(
      sub.parentId
    ).lean<IFranchiseTerritory>();
  }
  if (!territory && addr.state) {
    territory = await FranchiseTerritory.findOne({
      country: caseInsensitiveExact(addr.country),
      name: caseInsensitiveExact(addr.state),
    }).lean<IFranchiseTerritory>();
  }

  // 3. Country: by name (prefer the territory's country spelling).
  const countryName = territory?.country || addr.country;
  const country = await FranchiseCountry.findOne({
    name: caseInsensitiveExact(countryName),
  }).lean<IFranchiseCountry>();

  return {
    country: country ?? null,
    territory: territory ?? null,
    subTerritory: sub ?? null,
  };
}
