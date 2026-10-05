# `postcss.config.mjs`

> The PostCSS configuration. It registers the Tailwind CSS v4 PostCSS plugin so Next.js can compile the app's Tailwind stylesheets.

**Kind:** project config / root file · **Lines:** 6

## Purpose
Next.js passes every imported CSS file through PostCSS. This file adds a single plugin, `@tailwindcss/postcss`, which is how Tailwind CSS 4 plugs into the build. It turns the `@import "tailwindcss";` at the top of `app/globals.css` (and the utility classes used across `app/` and `components/`) into real CSS.

## How it works
It default-exports `{ plugins: ["@tailwindcss/postcss"] }`. There is no `tailwind.config` theme and no other plugins here. Under Tailwind v4, theme and content settings live in the CSS itself (for example `app/globals.css`, which also imports `tw-animate-css`).

## Exports
- `default` - the PostCSS config object `{ plugins: ["@tailwindcss/postcss"] }`.

## Dependencies
- **Packages:** `@tailwindcss/postcss` (devDependency, `^4`) - the Tailwind v4 PostCSS plugin. Next.js loads it by its string name. The `tailwindcss` package (`^4`) is also in `package.json`.

## Used by
Nothing imports it. Next.js finds it by convention when compiling CSS, in both the dev server started by `server/main.ts` and `npm run build:web`.
