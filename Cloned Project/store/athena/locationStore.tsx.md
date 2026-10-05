# `store/athena/locationStore.tsx`

> React hooks `useCountries`, `useStates`, `useCities`, `useSelectedCountry`.

**Kind:** client state store · **Lines:** 276

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useLocationStore`×7 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LocationState` | interface |  | 6 |
| `useLocationStore` | const | `= create<LocationState>()( persist( (set, get) => ({ // Initial state countries: [], states: [], ci…` | 53 |
| `useCountries` | hook | `useCountries()` | 265 |
| `useStates` | hook | `useStates()` | 266 |
| `useCities` | hook | `useCities()` | 267 |
| `useSelectedCountry` | hook | `useSelectedCountry()` | 268 |
| `useSelectedState` | hook | `useSelectedState()` | 269 |
| `useSelectedCity` | hook | `useSelectedCity()` | 270 |
| `useLocationLoading` | hook | `useLocationLoading()` | 271 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`
  - `country-state-city` — `Country`, `State`, `City`, `ICountry`, `IState`, `ICity`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
