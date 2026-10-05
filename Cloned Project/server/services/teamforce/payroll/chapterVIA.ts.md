# `server/services/teamforce/payroll/chapterVIA.ts`

> Chapter VI-A deductions aggregator — Old Regime (mostly).

**Kind:** backend service · **Lines:** 136

<!-- docgen:auto -->

## Purpose
Chapter VI-A deductions aggregator — Old Regime (mostly).
Spec §6.

Sec 80CCD(2) — employer NPS contribution — is the ONE Chapter VI-A item
available in BOTH regimes. The caller decides which sections to pass in
based on the employee's selected regime.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChapterVIAInput` | interface | Chapter VI-A deductions aggregator — Old Regime (mostly). | 10 |
| `ChapterVIAResult` | interface |  | 42 |
| `computeChapterVIA` | function | `computeChapterVIA(input: ChapterVIAInput): ChapterVIAResult` | 75 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:** none

## Used by

- `server/services/teamforce/payroll/index.ts`
- `server/services/teamforce/payroll/section192Tds.ts`
