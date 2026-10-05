import type { Chapter } from "../types";

export const meetings: Chapter = {
  slug: "meetings",
  number: 5,
  title: "Meetings, webinars and events",
  part: "The office",
  blurb:
    "Conference rooms you can send a link to, live streams with an audience, and ticketed events with their own websites.",
  blocks: [
    {
      type: "prose",
      text: [
        "The office covers people who are already inside it. These three surfaces cover everyone else: a colleague on a link, an audience of hundreds, and a paying attendee who found you through a public event page.",
      ],
    },
    { type: "heading", id: "meet", text: "Conference rooms" },
    {
      type: "prose",
      text: [
        "`/meet/conference/[orgId]/[roomId]` is a standalone room reachable by URL, and `/meet/join` is the shorter way in. Unlike the workspace, these pages use LiveKit's React components and fetch their token over REST — no socket event starts the call.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Pre-join", def: "`MeetPreJoin` checks camera and microphone, picks devices, and lets you set a virtual background before anyone sees you." },
        { term: "In the room", def: "Video grid, control bar, participants panel, chat panel, emoji reactions, and a header with the room's identity." },
        { term: "Access control", def: "Hosts can gate entry, admit from a waiting state, and remove someone with `KickDialog`." },
        { term: "Memos and notes", def: "`MemosPanel` records voice memos during the call; `ConferenceNotesPage` holds the written record afterwards." },
        { term: "Recordings", def: "`RecordingsPanel` lists what was captured in the room." },
        { term: "Picture-in-picture", def: "`PersistentPipRenderer` keeps the call alive in a floating window while you use the rest of the app. It is mounted at the root layout, which is why the call survives navigation." },
        { term: "Attendance", def: "`MeetAttendancePanel` records who was actually present, not merely who was invited." },
      ],
    },
    { type: "heading", id: "webinars", text: "Webinars and live streams" },
    {
      type: "prose",
      text: [
        "`/webinar/[id]` is a broadcast room: a small number of speakers, a large silent audience, and a set of panels for turning that audience into customers. Audience delivery runs over **mediasoup**, an SFU, because a peer mesh does not survive an audience of any size.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Pre-join", def: "`WebinarPreJoin` handles devices and virtual backgrounds; `SessionNotStartedCard` covers arriving early." },
        { term: "Chat and reactions", def: "Live chat with GIFs, plus floating reactions over `webinar:reaction`." },
        { term: "Polls and Q&A", def: "`PollPanel` and `QAPanel` run alongside the stream." },
        { term: "The shop", def: "`ShopPanel` and `PinnedProductCard` put products in front of the audience mid-stream; `WebinarCheckoutDialog` and `StoreCheckoutDialog` close the sale without leaving the room." },
        { term: "Live auctions", def: "`LiveAuctionCard` and `BidsPanel` run a real-time auction during the stream, with bids arriving over a dedicated channel." },
        { term: "Join requests", def: "`JoinRequestsPanel` lets a host promote an audience member to speaker." },
        { term: "Recording", def: "`RecordingBanner` makes it unambiguous when the session is being recorded. Recordings are replayable afterwards, chat included, through `WebinarChatReplay`." },
        { term: "Evergreen", def: "`EvergreenRoom` replays a recorded session on a schedule as though it were live, configured in `EvergreenSettings`." },
        { term: "Simulated audience", def: "`SimulatedAudienceSettings` pads the attendee count and chat for rehearsals and evergreen replays." },
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "Two notions of attendance",
      text: "`WorkshopAnalyticsModal` shows enrolment stats and live-session stats side by side. Enrolment's \"Total Attended\" tile reads `WorkshopRegistration.status === \"attended\"`, which no backend code ever writes — it is 0 for every workshop. The Live Session section is the real record. And `summary.attendanceRecorded === false` means *not recorded*, not *nobody came*; it renders as an em dash, never as zero. Attendance only exists from the day the feature shipped and cannot be backfilled.",
    },
    { type: "heading", id: "events", text: "Events" },
    {
      type: "prose",
      text: [
        "The Events app is a full event platform running inside the workspace, organised as three jobs rather than a flat menu.",
      ],
    },
    {
      type: "table",
      head: ["Stage", "Covers"],
      rows: [
        ["Plan", "Overview, agenda, speakers, sponsors and exhibitors."],
        ["Sell", "Ticket types, registrations, and promotional codes."],
        ["Reach", "The event website builder and email campaigns."],
      ],
    },
    {
      type: "prose",
      text: [
        "`WebsiteBuilder` composes the public event site from sections, and `EventSiteRenderer` serves it at `/e/[slug]` — on the platform domain or on the event's own domain, which `middleware.ts` resolves against the API. Ticket holders get `/e/[slug]/ticket/[token]`. `EventConsole` is the run-of-show view on the day.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "Attending a ticketed event",
        steps: [
          { label: "Find the event site", actor: "/e/[slug]", kind: "start", detail: "Reachable on a custom domain." },
          { label: "Choose a ticket", actor: "TicketCheckoutDrawer" },
          { label: "Pay", actor: "/checkout" },
          { label: "Receive the ticket", actor: "/e/[slug]/ticket/[token]", detail: "A link that needs no account." },
          {
            label: "Event day",
            kind: "decision",
            branches: [
              { on: "Has an account", steps: [{ label: "Join from the workspace", kind: "end" }] },
              { on: "No account", steps: [{ label: "Guest join", actor: "/guest/event-join", detail: "A guest token and a guest socket." }, { label: "In the room", kind: "end" }] },
            ],
          },
        ],
      },
    },
    { type: "heading", id: "calendar", text: "Calendar" },
    {
      type: "prose",
      text: [
        "The calendar is where scheduled things converge — meetings, room bookings, event dates and follow-ups. It runs on FullCalendar with month, week and day views, supports drag-to-reschedule, and lets you edit an event's invitee list separately from the event itself. Follow-up groups tie a scheduled call back to the lead or contact it belongs to.",
      ],
    },
  ],
};
