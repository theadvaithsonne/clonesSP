# `app/docs/content/index.ts`

> Module exporting `chapterBySlug`, `neighbours`, `outline`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 186

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CHAPTERS` | const | `= [ overview, access, officeSetup, office, meetings, communication, work, businessApps, c…` | 17 |
| `PARTS` | const | `= CHAPTERS.reduce( (parts, chapter) => { const existing = parts.find((p) => p.name === chapter.part…` — Sidebar groups, in the order the parts first appear. | 35 |
| `chapterBySlug` | function | `chapterBySlug(slug: string): Chapter \| undefined` | 45 |
| `neighbours` | function | `neighbours(slug: string)` | 49 |
| `outline` | function | `outline(chapter: Chapter)` — Headings in a chapter, for the "On this page" rail. | 58 |
| `SearchEntry` | type |  | 69 |
| `SEARCH_INDEX` | const | `= CHAPTERS.flatMap((chapter) => { let section: { id: string; text: string } \| null = null; const en…` | 157 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/docs/content/types.ts` — `Block`, `Chapter`, `(types only)`
  - `app/docs/content/chapters/01-overview.ts` — `overview`
  - `app/docs/content/chapters/02-access.ts` — `access`
  - `app/docs/content/chapters/03-office-setup.ts` — `officeSetup`
  - `app/docs/content/chapters/04-office.ts` — `office`
  - `app/docs/content/chapters/05-meetings.ts` — `meetings`
  - `app/docs/content/chapters/06-communication.ts` — `communication`
  - `app/docs/content/chapters/07-work.ts` — `work`
  - `app/docs/content/chapters/08-business-apps.ts` — `businessApps`
  - `app/docs/content/chapters/09-commerce.ts` — `commerce`
  - `app/docs/content/chapters/10-money.ts` — `money`
  - `app/docs/content/chapters/11-ai.ts` — `ai`
  - `app/docs/content/chapters/12-public.ts` — `publicSurfaces`
  - `app/docs/content/chapters/13-games.ts` — `games`
  - `app/docs/content/chapters/14-architecture.ts` — `architecture`
- **Packages:** none

## Used by

- `app/docs/[slug]/page.tsx`
- `app/docs/components/ChapterPage.tsx`
- `app/docs/components/Chrome.tsx`
- `app/docs/components/Palette.tsx`
- `app/docs/page.tsx`
