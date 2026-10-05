# `server/utils/__tests__/gstBuyerRegion.test.ts`

> Tests: 11 test cases.

**Kind:** test · **Lines:** 147

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (11)

- **resolveBuyerGstRegion — precedence**
  - shipping address wins over billing and profile
  - billing address wins over profile when there is no shipping address
  - falls back to the profile country when no address is given
  - a resolved country beats the payment currency
- **resolveBuyerGstRegion — payment-currency fallback**
  - ignores an address whose country is blank
  - attributes the source past a blank shipping country
  - guest with no profile and no address is not India when paying USD
- **resolveOrgGstRegion — office / add-ons / conference rooms**
  - falls back to the subscriber's profile when no org is given
  - a USD-priced plan with no resolvable org or user is not India
  - never reports source 'org' when no org country was found
- **isBuyerInIndia**
  - returns a bare boolean for commission sites

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/gstBuyerRegion.ts` — `resolveBuyerGstRegion`, `resolveOrgGstRegion`, `isBuyerInIndia`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
