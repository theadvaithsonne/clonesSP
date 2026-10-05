import type { Chapter } from "../types";

export const games: Chapter = {
  slug: "games",
  number: 13,
  title: "BAT 246 and side apps",
  part: "Platform",
  blurb:
    "A board game with real distributors, a public campaign site on its own domains, and the smaller apps around the edges.",
  blocks: [
    { type: "heading", id: "bat246", text: "BAT 246" },
    {
      type: "prose",
      text: [
        "BAT 246 is a board-based distribution game running inside a Garage office. It is gated twice: your organisation has to be one of the BAT 246 offices, and within that office each surface is granted individually.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Boards", def: "`/games/bat246/boards` lists them; `/games/bat246/[boardId]` plays one. `/games/bat246/preview/[boardId]` shows a board without joining it." },
        { term: "Positions", def: "`/games/bat246/join/[boardId]/[position]` is a public join link for one seat on one board." },
        { term: "Members and distributors", def: "The roster, plus distributors with a detail page each." },
        { term: "Invite and place", def: "Inviting someone and seating them in one action." },
        { term: "B2 Coin Wallet", def: "The game's own currency." },
        { term: "Permissions", def: "`/games/bat246/permission` grants card keys. It is never itself grantable." },
        { term: "Documentation", def: "In-game reference, including a breakdown of every button on a board." },
        { term: "Office invite", def: "`/games/bat246/office-invite` brings someone into the BAT 246 office." },
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "Two default grants are not admin access",
      text: "Every BAT 246 office member automatically holds `documentation` and `b2coinwallet`. A non-empty `grantedKeys` therefore proves nothing on its own — real admin access means at least one grant *beyond* those two, and the landing page routes on exactly that distinction.",
    },
    {
      type: "table",
      caption: "Grantable card keys (`lib/hooks/useBat246CardAccess.ts`)",
      head: ["Key", "Grants"],
      rows: [
        ["`boards`", "The boards list and play."],
        ["`members`", "The member roster."],
        ["`distributors`", "Distributors and their detail pages."],
        ["`documentation`", "Granted to every office member by default."],
        ["`lostmoney`", "The Lost Money admin and paid list."],
        ["`inviteandplace`", "Inviting and seating in one step."],
        ["`b2coinwallet`", "Granted to every office member by default."],
      ],
    },
    { type: "heading", id: "lostmoney", text: "Lost Money" },
    {
      type: "prose",
      text: [
        "Lost Money is a public campaign site attached to BAT 246, served on its own domains. `middleware.ts` maps those hosts onto `/games/bat246/lostmoney/index` and rewrites short branded paths — `/home`, `/aboutus`, `/paidlist`, `/testimonials`, `/register` — onto the internal routes, which do not match one-to-one.",
        "Behind it, `/games/bat246/lostmoney/admin` and `/lostmoney/paidlist` are the operator's side.",
      ],
    },
    { type: "heading", id: "misc", text: "Around the edges" },
    {
      type: "spec",
      items: [
        { term: "Flowboards", def: "`/flowboard`, with a per-symbol view and its own notification socket and theme store." },
        { term: "Athena", def: "A back-office view under `/taskroom/backOffice/athena`, with short links at `/short/[id]`." },
        { term: "Bat246 videos", def: "`/bat246-videos` — gated video content, with the gate in `lib/webinar/bat246VideoGate.ts`." },
        { term: "AI providers", def: "`/ai-providers` as a standalone page as well as inside settings." },
        { term: "Cabinet viewer", def: "`/cabinet/view/[fileId]` opens one file on its own." },
        { term: "User flowcharts", def: "`/user-flowcharts` — an older, separate diagram page, kept for reference." },
      ],
    },
  ],
};
