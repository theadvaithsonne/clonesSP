import type { Chapter } from "../types";

export const work: Chapter = {
  slug: "work",
  number: 7,
  title: "Getting work done",
  part: "Work",
  blurb:
    "Taskrooms, tasks, notes, the Cabinet, and an AI that watches a recording of your session and tells you where the time went.",
  blocks: [
    { type: "heading", id: "taskroom", text: "Taskrooms" },
    {
      type: "prose",
      text: [
        "A taskroom is a project space: a board of work with its own members, settings and templates. Taskrooms are scoped to a workspace and a space within it, which is why the routes nest as deeply as they do.",
      ],
    },
    {
      type: "routes",
      items: [
        { path: "/taskroom/overview", note: "Everything across the organisation at a glance." },
        { path: "/taskroom/my-taskrooms", note: "Rooms you own." },
        { path: "/taskroom/all-taskrooms", note: "Every room you can see." },
        { path: "/taskroom/assigned-to-me", note: "Work assigned to you, across all rooms." },
        { path: "/taskroom/templates", note: "Reusable room and task structures." },
        { path: "/taskroom/settings", note: "Room configuration." },
        { path: "/taskroom/migrate", note: "Moving work in from an earlier structure." },
        { path: "/taskroom/[workspace]/dashboard/[space]", note: "A specific room's board." },
        { path: "/taskroom/[workspace]/settings/people/[space]", note: "Who is in that room." },
        { path: "/taskroom/backOffice/athena", note: "The Athena back-office view." },
      ],
    },
    {
      type: "prose",
      text: [
        "Cards move by drag and drop, carry documents through `DocumentManager`, and can have their description drafted by the AI — `POST /api/taskroom/generate-description` takes the title and writes the body.",
      ],
    },
    { type: "heading", id: "tasks", text: "Tasks" },
    {
      type: "prose",
      text: [
        "Separate from taskrooms, and deliberately lighter: a to-do is a line of text with an owner. `useTodos` covers create, list and complete, and a todo is either **personal** (yours alone) or assigned by someone else — `createdBy` records who.",
        "Assigning a task to someone who is in the office right now pushes `workspace:todo-notification` to them immediately, so it lands as an interruption rather than as an unread badge they find tomorrow.",
      ],
    },
    { type: "heading", id: "notes", text: "Notes" },
    {
      type: "prose",
      text: [
        "Notes — the Thoughts app — is a block-based document editor. A note is a tree of typed blocks, and pages nest inside each other.",
      ],
    },
    {
      type: "grid",
      items: [
        { title: "Content blocks", note: "Text, headings, images, video, audio, files, embeds, web bookmarks, math, code." },
        { title: "Database views", note: "Table, board, gallery, calendar, timeline and chart views over structured rows." },
        { title: "Structure", note: "Nested pages, page links, a table of contents, and synced blocks that stay identical in several places." },
        { title: "Mentions", note: "Mention a person or another page inline." },
        { title: "Reminders", note: "A reminder block that fires, watched by `NotesReminderListener`." },
        { title: "Comments", note: "Per-page and per-block discussion." },
        { title: "Version history", note: "Every revision, restorable." },
        { title: "Covers and colour", note: "Cover photos and a colour per note." },
      ],
    },
    {
      type: "prose",
      text: [
        "Notes are organised with **starred**, **archive**, **trash** and **recovery** views, built from **templates**, and shared by link — `/shared/note/[token]` serves a note to someone with no account, with access decided by `lib/noteAccess.ts`.",
      ],
    },
    { type: "heading", id: "cabinet", text: "The Cabinet" },
    {
      type: "prose",
      text: [
        "The Cabinet is file storage arranged as nested cabinets rather than a flat drive. It has two sides: **Personal**, which is yours, and **Shared**, which is what other people have given you.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Cabinets", def: "Named, described, and nestable. Breadcrumbs track where you are." },
        { term: "Upload", def: "Drag, pick, or paste. Files stage before committing so a mistaken drop is recoverable." },
        { term: "Sharing", def: "With named members of the organisation, or as a link — `/f/[token]` serves a file to anyone holding it." },
        { term: "Starring and filters", def: "Star anything; filter by content type." },
        { term: "Preview", def: "Images, audio and video open in place." },
        { term: "Editing", def: "`/cabinet/editor/[documentId]` opens a document for editing, with OnlyOffice for office formats." },
        { term: "Org and floor cabinets", def: "`OrganizationCabinetPage`, `FloorCabinetPage` and `FounderCabinetPage` scope the same storage to a whole org, a floor, or a founder's community." },
      ],
    },
    { type: "heading", id: "ask-cabinet", text: "Ask Cabinet" },
    {
      type: "prose",
      text: [
        "Ask Cabinet is the AI that reads what is in the Cabinet. Point it at a file and it answers questions about it; point it at a session recording and it reports what was accomplished.",
      ],
    },
    {
      type: "table",
      head: ["File type", "What you get"],
      rows: [
        ["Video", "Tasks completed, where efficiency was lost, and which AI tools would have shortened the work."],
        ["Audio", "A transcript, then the same analysis over it."],
        ["PDF and documents", "Summary and question answering over the contents."],
      ],
    },
    {
      type: "prose",
      text: [
        "After a workspace session recording uploads, analysis is requested automatically — `generateAskCabinetPrompt()` builds the prompt from the file name and MIME type, so a recording arrives already summarised.",
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "The Next.js route is deprecated",
      text: "`app/api/ask-cabinet/route.ts` returns **410 Gone** and exists only to fail loudly. Ask Cabinet is served by the backend at `/ask-cabinet`; any new caller should go there directly.",
    },
    { type: "heading", id: "other-work", text: "The rest of the desk" },
    {
      type: "spec",
      items: [
        { term: "Flowboards", def: "`/flowboard` — boards with their own realtime notification socket and a per-symbol view at `/flowboard/[symbol]`." },
        { term: "Docusign", def: "Upload a document, send it for signature, and track the signing state from `DocumentsList`." },
        { term: "Deskstream and Kasm", def: "A virtual desktop streamed into the workspace. `/api/kasm-proxy/[...path]` exists because the Kasm server does not send CORS headers; `/api/kasm-iframe/[kasmId]` frames a running session." },
        { term: "Voice memos", def: "Recorded anywhere in the app and kept with the thing they belong to — a meeting, a note, a lead." },
        { term: "Screen recorder", def: "`ScreenRecordingProvider` makes recording available from anywhere, with `FloatingRecordingIndicator` making it impossible to forget it is running." },
      ],
    },
  ],
};
