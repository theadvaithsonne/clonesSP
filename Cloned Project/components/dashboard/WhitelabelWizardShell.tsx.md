# `components/dashboard/WhitelabelWizardShell.tsx`

> Shared chrome for the whitelabel setup wizard: the 4-segment progress rail, the step counter, the title block and the DNS record row used by both the app-domain and the email steps.

**Kind:** React component · **Lines:** 163 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Shared chrome for the whitelabel setup wizard: the 4-segment progress
rail, the step counter, the title block and the DNS record row used by
both the app-domain and the email steps. Every step renders inside this
so the header never shifts between screens — only the body swaps.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `WizardProgress` (local), `Copy` (lucide-react)

### Props

- **`WizardProgress`**: `step: number`, `complete?: boolean`
- **`WizardCard`**: `step: number`, `title: string`, `subtitle: string`, `badge?: string`, `wide?: boolean`, `complete?: boolean`, `children: React.ReactNode`
- **`DnsRecordRow`**: `record: WizardDnsRecord`, `onCopy: (value: string) => void`, `wrap?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WIZARD_TOTAL_STEPS` | const | `= 4` | 11 |
| `WizardProgress` | component | `WizardProgress({ step, complete = false, }: { step: number; /** Final scre…)` | 13 |
| `WizardCard` | component | `WizardCard({ step, title, subtitle, badge, wide = false, complete = fa…)` | 47 |
| `WizardDnsRecord` | type |  | 94 |
| `DnsRecordRow` | component | `DnsRecordRow({ record, onCopy, /** Email records are long (SPF, DMARC) —…)` | 102 |
| `formatRecordsForClipboard` | function | `formatRecordsForClipboard(records: WizardDnsRecord[]): string` — Tab-separated, the format DNS providers' bulk import accepts. | 158 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `lucide-react` — `Copy`

## Used by

- `components/dashboard/WhitelabelBrandingStep.tsx`
- `components/dashboard/WhitelabelCompleteStep.tsx`
- `components/dashboard/WhitelabelDomainWizard.tsx`
- `components/dashboard/WhitelabelEmailStep.tsx`
