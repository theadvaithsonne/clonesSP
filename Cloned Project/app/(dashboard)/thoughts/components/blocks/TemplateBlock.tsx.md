# `app/(dashboard)/thoughts/components/blocks/TemplateBlock.tsx`

> A BlockNote custom block (`template`) that offers a picker of four built-in page templates and inserts the chosen template's blocks into the note directly below itself.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 175

## Purpose
This block gives Thoughts notes a quick-start option. A user picks a template such as "Meeting Notes" and a prepared structure of headings, lists and checklists is inserted into the note. The block then remembers which template was applied.

## How it works
- `TEMPLATES` (L15-L79) holds four hard-coded templates. Each has an `id`, `name`, `description`, a lucide `icon` and `blocks`, an array of BlockNote partial blocks (`heading`, `paragraph`, `bulletListItem`, `checkListItem`, `numberedListItem`):
  - `meeting-notes` - "Meeting Notes": Date, Attendees, Agenda, Action Items.
  - `task-list` - "Task List": four checklist items.
  - `project-brief` - "Project Brief": Goals, Timeline, Deliverables.
  - `journal` - "Daily Journal": three reflection prompts.
- `TemplateRenderer` keeps `showPicker` and `appliedTemplate` in state. `appliedTemplate` is seeded from the `templateName` prop.
- `applyTemplate(template)`:
  1. calls `editor.insertBlocks(template.blocks, block, "after")`, placing the template content right after the template block;
  2. records the name in local state and in the block props (`templateName`);
  3. closes the picker.
- The header shows "TEMPLATE — <name>" after a template has been applied, plus a Browse/Close toggle. While no template has been applied and the picker is closed, the body shows a "Choose a template" call to action.

## Exports
- `templateBlock` - BlockNote block spec factory: type `template`, prop `templateName` (string, default `""`), `content: "none"`.

## Dependencies
- **Packages:** `@blocknote/react` (`createReactBlockSpec`), `lucide-react` (icons), `react`.

## Used by
- Re-exported by `app/(dashboard)/thoughts/components/blocks/index.ts`. `app/(dashboard)/thoughts/page.tsx` registers it as `template: templateBlock()`.

## Notes
- The "Meeting Notes" and "Daily Journal" templates contain a hard-coded date ("June 25, 2026") rather than today's date.
- A template can be applied more than once. Each application inserts another copy of its blocks.
- The template block stays in the document after the content is inserted.
