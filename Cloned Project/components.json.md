# `components.json`

> Configuration file for the shadcn/ui CLI: tells `npx shadcn add <component>` where to put generated UI components and how to style them.

**Kind:** project config / root file · **Lines:** 23

## Purpose
This file is read only by the shadcn/ui command-line tool, never by Next.js, the Express server or the build. It records the choices made when shadcn/ui was set up, so that each new component the CLI adds (a dialog, a select, a sheet and so on) uses the same style, Tailwind setup and import aliases as the ones already in `components/ui/`.

## How it works
- `$schema` - points at the shadcn JSON schema so editors can validate the file.
- `style: "new-york"` - the shadcn visual variant (tighter spacing, smaller radii) used to generate components.
- `rsc: true` - the project uses React Server Components (Next.js App Router), so the CLI adds a `"use client"` directive to components that need one.
- `tsx: true` - components are generated as TypeScript (`.tsx`).
- `tailwind`:
  - `config: ""` - no `tailwind.config.*` file. The project uses Tailwind CSS 4, which is configured in CSS, and the repo root has no Tailwind config file.
  - `css: "app/globals.css"` - the stylesheet where the CLI adds theme CSS variables. That file imports `tailwindcss` and `tw-animate-css`.
  - `baseColor: "neutral"` - the grey palette used for the default theme tokens.
  - `cssVariables: true` - colours are themed through CSS custom properties (for example `--background`), not hard-coded utility colours.
  - `prefix: ""` - Tailwind classes have no prefix.
- `iconLibrary: "lucide"` - generated components import icons from `lucide-react`.
- `aliases` - the import paths the CLI writes into generated code. They depend on the `@/*` to `./*` path mapping in `tsconfig.json`:
  - `components` -> `@/components`
  - `ui` -> `@/components/ui` (where the primitives live: `button.tsx`, `dialog.tsx`, `select.tsx`, `sheet.tsx`, ...)
  - `utils` -> `@/lib/utils` (provides the `cn(...)` class-merge helper built on `clsx` and `tailwind-merge`)
  - `lib` -> `@/lib`
  - `hooks` -> `@/hooks`
- `registries: {}` - no extra third-party component registries are set up.

## Exports
None. This is a JSON data file.

## Dependencies
- **Internal:** `app/globals.css` (target stylesheet), `lib/utils.ts` (`cn` helper), `components/ui/` (output folder), `hooks/`, and the `@/*` path alias in `tsconfig.json`.
- **Packages:** used by the `shadcn` CLI (run with npx, not a runtime dependency). Generated components rely on `lucide-react`, `class-variance-authority`, `clsx`/`tailwind-merge` and `tw-animate-css`, which are all listed in `package.json`.

## Used by
No source file imports it. Only the shadcn CLI reads it, when a developer runs commands such as `npx shadcn@latest add <component>`.

## Notes
- Changing `style`, `baseColor` or the aliases affects only components added later. Existing files in `components/ui/` are not regenerated.
- Many files in `components/ui/` are custom components (for example `country-code-picker.tsx`, `rich-text-editor.tsx`, `screen-recorder.tsx`), not shadcn output. Running `shadcn add` for a component that already exists will ask before overwriting it. Check for local changes before accepting.
