// app/docs/content/types.ts
//
// The docs are structured data, not hand-written JSX. Every chapter is a list
// of blocks; a small renderer turns blocks into layout, and the same array is
// flattened into the ⌘K search index. Adding a section means adding an object.

/** A node in a flow diagram's vertical rail. */
export type FlowStep = {
  /** Short label — this is what the reader scans. Keep it under ~40 chars. */
  label: string;
  /** Who or what performs the step. Rendered in mono at the right of the row. */
  actor?: string;
  /** One line of detail shown under the label. */
  detail?: string;
  /** Changes the marker glyph and rail treatment. */
  kind?: "start" | "step" | "wait" | "decision" | "end" | "fail";
  /** Only for kind: "decision". Each branch is its own sub-rail. */
  branches?: { on: string; steps: FlowStep[] }[];
};

export type Flow = {
  title: string;
  /** One sentence on what the flow accomplishes, shown above the rail. */
  summary?: string;
  steps: FlowStep[];
};

/** A message on a sequence diagram. `from`/`to` are indices into `actors`. */
export type SequenceMessage = {
  from: number;
  to: number;
  label: string;
  /** Rendered as a dashed line — a response or an async push rather than a call. */
  dashed?: boolean;
  /** A note spanning the full width, above this message. */
  phase?: string;
};

export type Sequence = {
  title: string;
  summary?: string;
  actors: string[];
  messages: SequenceMessage[];
};

export type Block =
  /** A section heading. `id` becomes the anchor and the "On this page" entry. */
  | { type: "heading"; id: string; text: string }
  /** Paragraphs. Supports **bold**, `code`, and [text](href). */
  | { type: "prose"; text: string[] }
  | { type: "list"; ordered?: boolean; items: string[] }
  /** Term/definition pairs — the workhorse for "what each thing is". */
  | { type: "spec"; items: { term: string; def: string }[] }
  | { type: "flow"; flow: Flow }
  | { type: "sequence"; sequence: Sequence }
  | { type: "table"; head: string[]; rows: string[][]; caption?: string }
  | { type: "note"; tone: "info" | "warn" | "limit"; title?: string; text: string }
  /** Route reference. `path` is the URL, `file` the implementing file. */
  | { type: "routes"; caption?: string; items: { path: string; file?: string; note: string }[] }
  /** Socket.IO / realtime event reference. */
  | { type: "events"; caption?: string; items: { name: string; dir: "out" | "in" | "both"; note: string }[] }
  /** A grid of named capabilities — used for chapter openers. */
  | { type: "grid"; items: { title: string; note: string }[] }
  | { type: "code"; lang?: string; caption?: string; text: string };

export type Chapter = {
  slug: string;
  /** Chapter number, shown in the title block. The manual is ordered. */
  number: number;
  title: string;
  /** Used on the contents page and as the meta description. */
  blurb: string;
  /** Grouping in the sidebar. */
  part: string;
  blocks: Block[];
};
