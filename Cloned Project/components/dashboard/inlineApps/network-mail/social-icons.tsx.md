# `components/dashboard/inlineApps/network-mail/social-icons.tsx`

> React components `SocialIconGlyph`, `SocialIconsBlockRenderer`, `SocialIconsPropertiesPanel`.

**Kind:** React component · **Lines:** 796 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SliderInput`×8 (local), `CollapsibleSection`×5 (local), `PropertyField`×4 (local), `ColorPicker`×4 (local), `PropInput`×3 (local), `Check`×2 (lucide-react), `PropSelect`×2 (local), `Mail` (lucide-react), `Globe` (lucide-react), `SocialIconGlyph` (local), `Link` (lucide-react), `Trash2` (lucide-react), `GripVertical` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Upload` (lucide-react), `Plus` (lucide-react), `Icon` (local)

### Props

- **`SocialIconGlyph`**: `platform: SocialPlatform`, `iconStyle: string`, `monoColor: string`, `customIcon?: string`, `size: number`
- **`SocialIconsBlockRenderer`**: `block: EmailBlock`, `isSelected: boolean`, `onSelect: () => void`, `onUpdate: (b: EmailBlock) => void`, `onDelete: () => void`, `onDuplicate: () => void`
- **`SocialIconsPropertiesPanel`**: `block: EmailBlock`, `onUpdate: (b: EmailBlock) => void`, `onDelete: () => void`, `ColorPicker: React.ComponentType<{ label: string; value: string; onCh…`

**Hooks used:** `useState`×3, `useMemo`, `useRef`, `useNetworkMailEditor` (components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SocialPlatform` | type |  | 30 |
| `SocialIcon` | interface |  | 43 |
| `BRAND_COLORS` | const | `= { facebook: "#1877F2", twitter: "#000000", instagram: "#E4405F", linkedin: "#0A66C2", y…` | 52 |
| `PLATFORM_LABELS` | const | `= { facebook: "Facebook", twitter: "Twitter / X", instagram: "Instagram", linkedin: "Link…` | 66 |
| `makeDefaultSocialIcons` | function | `makeDefaultSocialIcons(): SocialIcon[]` | 102 |
| `parseSocialIcons` | function | `parseSocialIcons(json: string): SocialIcon[]` | 113 |
| `serializeSocialIcons` | function | `serializeSocialIcons(icons: SocialIcon[]): string` | 122 |
| `getVisibleIcons` | function | `getVisibleIcons(icons: SocialIcon[]): SocialIcon[]` | 126 |
| `getIconFillColor` | function | `getIconFillColor(platform: SocialPlatform, iconStyle: string, monoColor: string): string` | 146 |
| `getIconContainerStyle` | function | `getIconContainerStyle(s: Record<string, string>, fillColor: string): React.CSSProperties` | 151 |
| `SocialIconGlyph` | component | `SocialIconGlyph({ platform, iconStyle, monoColor, customIcon, size, }: { pl…)` | 198 |
| `escAttr` | function | `escAttr(str: string): string` — Escape for HTML attribute values (preserves data: URIs; does not encode &lt; &gt;). | 237 |
| `renderSocialIconsInlineHtml` | function | `renderSocialIconsInlineHtml(s: Record<string, string>, iconsJson: string, esc: (str: string) => string): string` — Inline social icon row (no outer <tr>) for nesting in footer cells. | 303 |
| `renderSocialIconsEmail` | function | `renderSocialIconsEmail(s: Record<string, string>, content: Record<string, string>, esc: (str: string) => string): string` | 341 |
| `createSocialIconsBlockContent` | function | `createSocialIconsBlockContent(): Record<string, string>` | 384 |
| `createSocialIconsBlockStyles` | function | `createSocialIconsBlockStyles(): Record<string, string>` | 388 |
| `SocialIconsBlockRenderer` | component | `SocialIconsBlockRenderer({ block, onSelect, onUpdate, }: { block: EmailBlock; isSele…)` | 485 |
| `SocialIconsPropertiesPanel` | component | `SocialIconsPropertiesPanel({ block, onUpdate, onDelete, ColorPicker, }: { block: Email…)` | 610 |

## Interfaces

- **External hosts mentioned in the code:** `facebook.com`, `twitter.com`, `instagram.com`, `linkedin.com`, `youtube.com`, `pinterest.com`, `tiktok.com`, `wa.me`, `yourcompany.com`

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/network-mail/network-mail-editor-context.tsx` — `useNetworkMailEditor`
  - `components/dashboard/inlineApps/network-mail/template-image-upload.ts` — `resolveEditorImageSrc`
  - `components/dashboard/inlineApps/network-mail/social-icon-email-urls.ts` — `getSocialIconEmailImageSrc`
- **Packages:**
  - `react` — `useState`, `useRef`, `useMemo`
  - `sonner` — `toast`
  - `lucide-react` — `AlignLeft`, `AlignCenter`, `AlignRight`, `Check`, `GripVertical`, `Link`, …

## Used by

- `components/dashboard/inlineApps/network-mail/NetworkMailApp.tsx`
- `components/dashboard/inlineApps/network-mail/block-factory.ts`
- `components/dashboard/inlineApps/network-mail/email-html-export.ts`
- `components/dashboard/inlineApps/network-mail/footer-block.tsx`
- `components/dashboard/inlineApps/network-mail/social-icon-email-urls.ts`
