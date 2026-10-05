# `lib/funnel-pages.ts`

> Type-only content model for page-designer ("Custom", stored mode `"pages"`) funnels: pages → sections → rows → columns → elements, with per-device styles, visibility, theme and brand settings.

**Kind:** frontend library · **Lines:** 246

## Purpose
Funnels can be built in a ClickFunnels-style page designer. This file defines the JSON shape of those pages as the frontend sends and receives it. Its header says it mirrors `contacts-backend/src/models/funnel-page.model.ts` and must be kept in sync by hand. contacts-backend is an external service, not part of this repo. The file has no runtime code; it only fixes the contract between the funnel API client and the designer/renderer.

## How it works
### Responsive values and visibility (L4-L18)
- `Device` is `"desktop" | "mobile"`. There is no tablet view; mobile covers phones and tablets.
- `Responsive<T>` holds an optional value per device. A missing `mobile` value means "inherit desktop", shown as the linked state in the settings panel.
- `Visibility` holds per-device booleans. A missing value means visible.

### `NodeStyle` (L20-L132)
One style bag shared by every level of the tree. Its groups:
- **Background:** colour, image, structured `backgroundGradient` (`angle`/`from`/`to`, which wins over `backgroundImage`), size, position, repeat.
- **Text:** `color`, `fontWeight`, `fontFamily` (a key into a font-stack table, not a family name), `fontSize` / `align` (responsive), `lineHeight`, `letterSpacing`, `textTransform`.
- **Box:** `maxWidth`, responsive `minHeight` / `paddingY` / `paddingX` / `marginY` / `gap`, border width/style/colour/radius, `boxShadow` (a preset key: `none|sm|md|lg|glow`, not raw CSS), `opacity`, `className`.
- **Layout:** `contentWidth` (number or `"full"`), `fullBleed`.
- **Named intents, not raw CSS:**
  - `position`: `static | relative | sticky-top | sticky-bottom`. The renderer turns a sticky intent into fixed positioning with an edge offset. It applies to sections, and to the `sticky_bar` element, which defaults to `sticky-bottom`.
  - `hover`: `none | lift | scale`. It applies to columns (as cards) and elements (button CTAs).
- **Theme-token selectors:** `gradientText` (on `heading` / `text`) and `badge` (on `text` only). Each picks the active theme's whole gradient-text or badge-pill class instead of carrying a colour. An explicit `color` on the same node wins and the token is ignored. The long comments explain the reasoning: the token is always applied as one self-contained class, so it can never produce invisible text, and `badge` was made a prop on `text` instead of a new element type, to avoid the cost of registering a new element type in many places.

### Element types (L134-L162)
`FunnelElementType` lists 28 element kinds:
- basics: `heading`, `text`, `image`, `video`, `button`, `product`, `form`, `divider`, `spacer`, `icon`
- composite blocks: `composite_hero`, `_features`, `_bento`, `_trust`, `_faq`, `_cta`, `_form`, `_testimonials`, `_logos`, `_pricing`, `_steps`
- extras: `countdown`, `sticky_bar`, `icon_list`, `logo`, `popup`, `embed`, `accordion`

### Tree (L164-L208)
`FunnelPage { id, slug, title, order, sections, style?, themePreset? }` → `FunnelSection { id, rows }` → `FunnelRow { id, columns }` → `FunnelColumn { id, width, elements }` → `FunnelElement { id, type, props, ... }`.
- `width` is in grid units out of 12, and the columns in a row should add up to 12.
- Sections, rows, columns and elements each also take an optional `style` and `visibility`.
- `props` is untyped (`Record<string, unknown>`) and depends on the element type.
- `themePreset` is set per page so every composite block on the page uses one palette. The AI picks it per page.

### Theme and brand (L210-L228)
- `FunnelBrand { primary?, onPrimary? }` is a single accent colour, given as a validated hex. `onPrimary` is worked out from contrast when it is missing.
- `FunnelTheme { preset?, brand? }` holds funnel-level settings. A page's own `themePreset` overrides `preset`, and when neither is set the default preset is used.

### Product block (L230-L245)
`ProductBlockProps` are the props stored on a `product` element: `itemId`, `itemType`, `name` and optional `category`, `orgSlug`, `image`, `price`, `currency`, `href` (used as-is for "general" platform products) and `label` (CTA text, "Buy Now" when missing).

## Exports
- Types: `Device`, `Responsive<T>`, `Visibility`, `NodeStyle`, `FunnelElementType`, `FunnelElement`, `FunnelColumn`, `FunnelRow`, `FunnelSection`, `FunnelPage`, `FunnelPages` (= `FunnelPage[]`), `FunnelBrand`, `FunnelTheme`, `ProductBlockProps`.

## Dependencies
- **Internal:** none
- **Packages:** none

## Used by
- `lib/api/funnels.ts` - imports `FunnelPage` and `FunnelTheme` for the funnel API client (`Funnel.content.theme`, `pages?: FunnelPage[]`).
- `components/dashboard/inlineApps/deals/DealsApp.tsx` also mentions `FunnelPage` (it is not in the import graph's importer list).

## Notes
- The comments refer to renderer and theme files (`theme-system.ts`, `element-renderer.tsx`, `resolve-style.ts`, `style-values.ts`, `blocks/composite-blocks.tsx`, `layout.ts`, `surface.test.tsx`). None of them exist in this repo. They belong to the funnel renderer in another codebase, so treat those comments as describing behaviour defined elsewhere.
- The model is mirrored by hand. Adding an element type or style field also needs a matching change in contacts-backend (its `FUNNEL_ELEMENT_TYPES` list, per the comments) or the backend may reject or drop it.
- This model is separate from the question/video tree in `lib/funnel-tree.ts`.
