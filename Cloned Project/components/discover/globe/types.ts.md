# `components/discover/globe/types.ts`

> Module exporting `getCountryCode`, `isValidCoordinate`, `getEntityName`, `getEntityLocation` and 3 more.

**Kind:** React component · **Lines:** 382

<!-- docgen:auto -->

## Purpose
Globe View Types

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `HQFounder` | interface |  | 4 |
| `HQOrganization` | interface |  | 18 |
| `FounderOrganization` | interface |  | 43 |
| `NewFounder` | interface |  | 59 |
| `StakeholderOrganization` | interface |  | 73 |
| `Stakeholder` | interface |  | 89 |
| `TabType` | type |  | 103 |
| `EntityType` | type |  | 106 |
| `HQOrganizationsResponse` | interface |  | 109 |
| `FoundersResponse` | interface |  | 115 |
| `StakeholdersResponse` | interface |  | 121 |
| `TickerMessage` | interface |  | 128 |
| `CountryGroup` | interface |  | 140 |
| `COUNTRY_CODE_MAP` | const | `= { "Afghanistan": "AF", "Albania": "AL", "Algeria": "DZ", "Andorra": "AD", "Angola": "AO…` | 147 |
| `getCountryCode` | function | `getCountryCode(countryName: string): string` | 344 |
| `isValidCoordinate` | function | `isValidCoordinate(lat?: number, lng?: number): boolean` | 349 |
| `getEntityName` | function | `getEntityName(entity: EntityType): string` | 358 |
| `getEntityLocation` | function | `getEntityLocation(entity: EntityType): string` | 363 |
| `isHQOrganization` | function | `isHQOrganization(entity: EntityType): entity is HQOrganization` | 369 |
| `isFounder` | function | `isFounder(entity: EntityType): entity is NewFounder` | 374 |
| `isStakeholder` | function | `isStakeholder(entity: EntityType): entity is Stakeholder` | 379 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `components/discover/globe/GlobeMap.tsx`
- `components/discover/globe/GlobeSearch.tsx`
- `components/discover/globe/GlobeSidebar.tsx`
- `components/discover/globe/GlobeTabs.tsx`
- `components/discover/globe/GlobeTicker.tsx`
- `components/discover/globe/GlobeView.tsx`
- `lib/hooks/useGlobeData.ts`
