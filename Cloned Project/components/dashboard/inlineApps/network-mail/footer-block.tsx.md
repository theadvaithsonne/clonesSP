# `components/dashboard/inlineApps/network-mail/footer-block.tsx`

> React components `FooterBlockRenderer`, `FooterPropertiesPanel`.

**Kind:** React component · **Lines:** 913 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PropertyField`×10 (local), `PropInput`×8 (local), `CollapsibleSection`×7 (local), `Check`×5 (lucide-react), `EditableLine`×4 (local), `ColorPicker`×4 (local), `SliderInput`×3 (local), `Trash2`×2 (lucide-react), `Tag` (local), `SocialIconGlyph` (components/dashboard/inlineApps/network-mail/social-icons.tsx), `Plus` (lucide-react)

### Props

- **`FooterBlockRenderer`**: `block: EmailBlock`, `onUpdate: (b: EmailBlock) => void`
- **`FooterPropertiesPanel`**: `block: EmailBlock`, `onUpdate: (b: EmailBlock) => void`, `onDelete: () => void`, `ColorPicker: React.ComponentType<{ label: string; value: string; onCh…`

**Hooks used:** `useRef`×2, `useEffect`, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FooterLinkType` | type |  | 22 |
| `FooterLink` | interface |  | 24 |
| `makeDefaultFooterLinks` | function | `makeDefaultFooterLinks(): FooterLink[]` | 36 |
| `parseFooterLinks` | function | `parseFooterLinks(json: string): FooterLink[]` | 43 |
| `serializeFooterLinks` | function | `serializeFooterLinks(links: FooterLink[]): string` | 51 |
| `formatAddress` | function | `formatAddress(c: Record<string, string>): string` | 55 |
| `parseAddressFromEditor` | function | `parseAddressFromEditor(text: string): { street: string; city: string; state: string; zi…` — Inverse of formatAddress — used by sidebar textarea and preview editor. | 64 |
| `applyAddressFields` | function | `applyAddressFields(content: Record<string, string>, text: string): Record<string, string>` | 106 |
| `renderFooterPhoneEmailHtml` | function | `renderFooterPhoneEmailHtml(content: Record<string, string>, esc: (str: string) => string, textColor: string, linkColor: string): string` — Phone + contact email row for email HTML (escape each field; do not esc the separator entity). | 122 |
| `createFooterBlockContent` | function | `createFooterBlockContent(): Record<string, string>` | 148 |
| `createFooterBlockStyles` | function | `createFooterBlockStyles(): Record<string, string>` | 168 |
| `FOOTER_PRESETS` | const | `= { minimal: { label: "Minimal", content: { companyName: "Company Name", street: "123 Mai…` | 186 |
| `FooterBlockRenderer` | component | `FooterBlockRenderer({ block, onUpdate, }: { block: EmailBlock; onUpdate: (b: Em…)` | 323 |
| `renderFooterEmail` | function | `renderFooterEmail(s: Record<string, string>, content: Record<string, string>, esc: (str: string) => string): string` | 487 |
| `FooterPropertiesPanel` | component | `FooterPropertiesPanel({ block, onUpdate, onDelete, ColorPicker, }: { block: Email…)` | 627 |

## Interfaces

- **External hosts mentioned in the code:** `company.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/social-icons.tsx` — `parseSocialIcons`, `getVisibleIcons`, `SocialIconGlyph`, `BRAND_COLORS`, `makeDefaultSocialIcons`, `serializeSocialIcons`, `renderSocialIconsInlineHtml`
- **Packages:**
  - `react` — `useState`, `useMemo`, `useRef`, `useEffect`
  - `lucide-react` — `Check`, `Plus`, `Trash2`

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/block-factory.ts`
- `components/dashboard/inlineApps/network-mail/email-html-export.ts`
- `components/dashboard/inlineApps/network-mail/email-template-presets.ts`
