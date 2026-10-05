import type { Block, Chapter } from "./types";
import { overview } from "./chapters/01-overview";
import { access } from "./chapters/02-access";
import { officeSetup } from "./chapters/03-office-setup";
import { office } from "./chapters/04-office";
import { meetings } from "./chapters/05-meetings";
import { communication } from "./chapters/06-communication";
import { work } from "./chapters/07-work";
import { businessApps } from "./chapters/08-business-apps";
import { commerce } from "./chapters/09-commerce";
import { money } from "./chapters/10-money";
import { ai } from "./chapters/11-ai";
import { publicSurfaces } from "./chapters/12-public";
import { games } from "./chapters/13-games";
import { architecture } from "./chapters/14-architecture";

export const CHAPTERS: Chapter[] = [
  overview,
  access,
  officeSetup,
  office,
  meetings,
  communication,
  work,
  businessApps,
  commerce,
  money,
  ai,
  publicSurfaces,
  games,
  architecture,
];

/** Sidebar groups, in the order the parts first appear. */
export const PARTS: { name: string; chapters: Chapter[] }[] = CHAPTERS.reduce(
  (parts, chapter) => {
    const existing = parts.find((p) => p.name === chapter.part);
    if (existing) existing.chapters.push(chapter);
    else parts.push({ name: chapter.part, chapters: [chapter] });
    return parts;
  },
  [] as { name: string; chapters: Chapter[] }[]
);

export function chapterBySlug(slug: string): Chapter | undefined {
  return CHAPTERS.find((c) => c.slug === slug);
}

export function neighbours(slug: string) {
  const i = CHAPTERS.findIndex((c) => c.slug === slug);
  return {
    prev: i > 0 ? CHAPTERS[i - 1] : undefined,
    next: i >= 0 && i < CHAPTERS.length - 1 ? CHAPTERS[i + 1] : undefined,
  };
}

/** Headings in a chapter, for the "On this page" rail. */
export function outline(chapter: Chapter) {
  return chapter.blocks
    .filter((b): b is Extract<Block, { type: "heading" }> => b.type === "heading")
    .map(({ id, text }) => ({ id, text }));
}

// ── Search ────────────────────────────────────────────────────────
// Flattening happens once at module load. Every block contributes the text a
// reader would recognise it by; the heading above a block becomes its section,
// so a result can say where in the chapter it sits.

export type SearchEntry = {
  chapter: string;
  chapterNumber: number;
  chapterSlug: string;
  section: string | null;
  sectionId: string | null;
  text: string;
  kind: string;
};

/** Strip the markdown-lite marks so excerpts read as sentences, not source. */
function plain(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function blockText(block: Block): { text: string; kind: string } | null {
  switch (block.type) {
    case "heading":
      return { text: block.text, kind: "section" };
    case "prose":
      return { text: block.text.join(" "), kind: "text" };
    case "list":
      return { text: block.items.join(" · "), kind: "list" };
    case "spec":
      return {
        text: block.items.map((i) => `${i.term} — ${i.def}`).join(" · "),
        kind: "reference",
      };
    case "flow":
      return {
        text: [block.flow.title, block.flow.summary, ...block.flow.steps.map(stepText)]
          .filter(Boolean)
          .join(" · "),
        kind: "flow",
      };
    case "sequence":
      return {
        text: [
          block.sequence.title,
          block.sequence.summary,
          block.sequence.actors.join(" "),
          ...block.sequence.messages.map((m) => m.label),
        ]
          .filter(Boolean)
          .join(" · "),
        kind: "flow",
      };
    case "table":
      return {
        text: [block.caption, ...block.head, ...block.rows.flat()].filter(Boolean).join(" "),
        kind: "table",
      };
    case "note":
      return { text: [block.title, block.text].filter(Boolean).join(" — "), kind: "note" };
    case "routes":
      return {
        text: block.items.map((i) => `${i.path} ${i.note}`).join(" · "),
        kind: "routes",
      };
    case "events":
      return {
        text: block.items.map((i) => `${i.name} ${i.note}`).join(" · "),
        kind: "events",
      };
    case "grid":
      return {
        text: block.items.map((i) => `${i.title} — ${i.note}`).join(" · "),
        kind: "text",
      };
    case "code":
      return { text: [block.caption, block.text].filter(Boolean).join(" "), kind: "code" };
    default:
      return null;
  }
}

function stepText(step: { label: string; detail?: string; branches?: { on: string; steps: any[] }[] }): string {
  const own = [step.label, step.detail].filter(Boolean).join(" ");
  const kids = (step.branches || [])
    .map((b) => `${b.on} ${b.steps.map(stepText).join(" ")}`)
    .join(" ");
  return `${own} ${kids}`.trim();
}

export const SEARCH_INDEX: SearchEntry[] = CHAPTERS.flatMap((chapter) => {
  let section: { id: string; text: string } | null = null;
  const entries: SearchEntry[] = [
    {
      chapter: chapter.title,
      chapterNumber: chapter.number,
      chapterSlug: chapter.slug,
      section: null,
      sectionId: null,
      text: plain(chapter.blurb),
      kind: "chapter",
    },
  ];
  for (const block of chapter.blocks) {
    if (block.type === "heading") section = { id: block.id, text: block.text };
    const flat = blockText(block);
    if (!flat) continue;
    entries.push({
      chapter: chapter.title,
      chapterNumber: chapter.number,
      chapterSlug: chapter.slug,
      section: section?.text ?? null,
      sectionId: section?.id ?? null,
      text: plain(flat.text),
      kind: flat.kind,
    });
  }
  return entries;
});
