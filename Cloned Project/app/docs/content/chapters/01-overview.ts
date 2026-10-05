import type { Chapter } from "../types";

export const overview: Chapter = {
  slug: "overview",
  number: 1,
  title: "What Garage is",
  part: "Start here",
  blurb:
    "A virtual office your team walks around in, with the rest of the company's software living inside it.",
  blocks: [
    {
      type: "prose",
      text: [
        "Garage is a workspace you occupy rather than a dashboard you visit. Your organisation is a building: it has floors, each floor has departments, and floors contain meeting rooms. Everyone signed in is somewhere in that building, and you can see where. You walk up to a colleague and knock; if they accept, you are in a call. There is no link to send and no room to schedule.",
        "Around that office sits the software a company actually runs on — chat, files, tasks, a CRM, an HR system, email campaigns, a course and product store, affiliate payouts, and a fleet of AI employees. All of it is reachable without leaving the room you are standing in.",
      ],
    },
    {
      type: "grid",
      items: [
        { title: "The office", note: "Floors, departments, meeting rooms, presence, knock-to-call, screen share, recording." },
        { title: "Meetings & live", note: "Conference rooms, webinars, live streams, ticketed events, guest join." },
        { title: "Communication", note: "Direct messages, groups, threads, the feed, notifications, Network Mail." },
        { title: "Getting work done", note: "Taskrooms, tasks, notes, calendar, the Cabinet, AI analysis of what you did." },
        { title: "Business apps", note: "Deals (CRM), Teamforce (HR), Events, CoverFi, Helpdesk — running inside the workspace." },
        { title: "Content & commerce", note: "Communities, courses, videos, digital products, services, 1:1 calls, checkout." },
        { title: "Money & network", note: "Affiliate links, downline, leaderboards, rank bonuses, vaults, payouts, billing." },
        { title: "AI employees", note: "Agents with contexts, integrations and scheduled jobs, plus public Q&A agents." },
      ],
    },
    { type: "heading", id: "org-model", text: "How an organisation is shaped" },
    {
      type: "prose",
      text: [
        "Everything in Garage hangs off an organisation, usually called an **HQ**. A person can belong to several, and switches between them at `/select-organization`; the chosen one is held in `orgId` alongside the auth token and travels on every request and socket connection.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Organisation (HQ)", def: "The tenant. Owns floors, members, billing, branding, a public slug, and optionally a custom domain." },
        { term: "Floor", def: "A level of the building, with a `level` number that drives sort order and the navigation animation. Holds departments and a member roster." },
        { term: "Department", def: "A named, colour-coded group on a floor. Used for filtering the roster and for HR structure in Teamforce." },
        { term: "Space", def: "Anywhere a person can be standing: the lobby, a floor, a meeting room, or a call. `spaceId` on a peer is the single source of truth for where someone is." },
        { term: "Meeting room", def: "A persistent group-call space on a floor or in the HQ. Can be booked ahead of time." },
        { term: "Member", def: "A person in the org, with a role. Members can also be pending — invited but not yet accepted." },
        { term: "Guest", def: "Someone with access to a specific thing (an event, a channel, a call) but not to the office. Flagged with `guest: true` on their peer state." },
      ],
    },
    { type: "heading", id: "roles", text: "Who can do what" },
    {
      type: "prose",
      text: [
        "Four overlapping notions of authority decide what you see. They are checked by separate hooks, so a person can be one without being the others.",
      ],
    },
    {
      type: "table",
      head: ["Capability", "Checked by", "Grants"],
      rows: [
        ["Founder", "`useAmIFounder`", "The back office: communities, courses, products, services, live streams, orders, coupons, payouts."],
        ["Admin", "`useIsAdmin`", "Office settings — branding, domains, invitees, pending requests, team access, coupons."],
        ["Module access", "`useModuleAccess` / `useMyGrants`", "Per-app permission inside the org, assigned from Team Access."],
        ["Platform staff", "Separate admin token", "The Garage Admin console on its own subdomain. Not an org role at all."],
      ],
    },
    { type: "heading", id: "stack", text: "The communication stack" },
    {
      type: "prose",
      text: [
        "Three layers carry realtime traffic, and which one you get depends on what you are doing. Confusing them is the fastest way to misread a bug report.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Socket.IO", def: "Signalling and presence. One singleton connection per tab (`lib/socket.ts`) carrying the JWT. Every knock, status change, space move and call setup message goes over it. Guests get their own socket with a guest token." },
        { term: "LiveKit", def: "The video layer for calls — knock calls, floor and meeting-room calls, conference rooms, guest events, workshop previews, community streams. The backend mints a JWT per participant; the client joins a room and subscribes to tracks. Recording runs through LiveKit's Egress API." },
        { term: "WebRTC (peer-to-peer)", def: "Floor-level presence video — the small live tiles of people standing near you. Direct peer connections with ICE candidate batching and exponential-backoff recovery." },
        { term: "mediasoup", def: "The SFU behind large webinar audiences, where a mesh would not hold up." },
        { term: "Daily", def: "An alternative transport kept alongside LiveKit for community streams and audience views." },
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Reading the code",
      text: "`useLiveKit` drives every workspace call and is socket-driven — it waits for `livekit:init-call` or `livekit:join-call` and joins imperatively. The `/meet` pages instead use the `<LiveKitRoom>` component and get their token from a REST call. Same service, two very different entry paths.",
    },
    { type: "heading", id: "surfaces", text: "Public surfaces" },
    {
      type: "prose",
      text: [
        "Not everything in Garage is behind a login. Organisations publish outward, and several route trees exist purely for people who have never signed in.",
      ],
    },
    {
      type: "routes",
      items: [
        { path: "/hq/[slug]", file: "app/hq/[slug]/[[...rest]]", note: "An organisation's public HQ page and everything beneath it." },
        { path: "/guest/[slug]", note: "The guest storefront: channels, courses, products, services, videos, drops, playlists, articles, webinars, recordings, testimonials." },
        { path: "/p/[slug]", note: "A published funnel or landing page." },
        { path: "/e/[slug]", note: "An event's public site, plus `/ticket/[token]` for a holder's ticket." },
        { path: "/f/[token]", note: "A shared file." },
        { path: "/shared/note/[token]", note: "A note shared by link." },
        { path: "/qa/[agentId]", file: "components/qa/PublicQAChat.tsx", note: "A public, unauthenticated chat with one AI agent." },
        { path: "/invoice/[invoiceId]", note: "A payable invoice." },
        { path: "/browse-hqs", note: "Directory of organisations open to being discovered." },
        { path: "/careers", note: "Public job listings; `/jobs/[id]` for a single role." },
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Custom domains",
      text: "`middleware.ts` maps hostnames onto route subtrees. A whitelabel domain resolves to the org workspace; event domains are looked up against the API and cached per isolate for five minutes; the Garage Admin subdomain is rewritten onto `/garage-admin` so its ~290 hardcoded links keep working.",
    },
  ],
};
