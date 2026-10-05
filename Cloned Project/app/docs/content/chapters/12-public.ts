import type { Chapter } from "../types";

export const publicSurfaces: Chapter = {
  slug: "public",
  number: 12,
  title: "Public and guest surfaces",
  part: "Platform",
  blurb:
    "What an organisation shows the world, on Garage's domain or its own.",
  blocks: [
    {
      type: "prose",
      text: [
        "Roughly a third of the route tree exists for people who are not signed in. An organisation publishes outward — a storefront, an HQ page, funnels, event sites — and each of those can be served from Garage's domain or from the organisation's own.",
      ],
    },
    { type: "heading", id: "hq", text: "The HQ page" },
    {
      type: "prose",
      text: [
        "`/hq/[slug]/[[...rest]]` is an organisation's public face and a catch-all: everything beneath the slug resolves through it. From here a visitor can see what the office offers, ask to join a private one, or sign in and be dropped straight at the thing they clicked.",
        "`/browse-hqs` lists offices that have opted into being discovered, with a category and globe view; `/my-requests` is where someone tracks a request to join.",
      ],
    },
    { type: "heading", id: "storefront", text: "The guest storefront" },
    {
      type: "prose",
      text: [
        "`/guest/[slug]/*` is the sales surface. Every sellable has a page here, and each one carries the organisation's branding and the visitor's affiliate code.",
      ],
    },
    {
      type: "routes",
      caption: "Under /guest/[slug]",
      items: [
        { path: "/channel/[channelId]", note: "A community's sales page." },
        { path: "/course/[courseId]", note: "A course." },
        { path: "/product/[productId]", note: "A digital product." },
        { path: "/service/[serviceId]", note: "A service." },
        { path: "/call/[callId]", note: "A bookable 1:1 call." },
        { path: "/webinar/[webinarId]", note: "A live session." },
        { path: "/recording/[recordingId]", note: "A past session, replayable." },
        { path: "/video/[videoId]", note: "A long-form video." },
        { path: "/drop/[dropId]", note: "A short vertical video." },
        { path: "/playlist/[playlistId]", note: "A collection of videos." },
        { path: "/post/[postId] and /article/[postId]", note: "A feed post or a long-form article." },
        { path: "/testimonials and /testimonials/[slug]", note: "Social proof." },
      ],
    },
    { type: "heading", id: "funnels-events", text: "Funnels, events and links" },
    {
      type: "routes",
      items: [
        { path: "/p/[slug]", note: "A published funnel page, built in Funnel Studio." },
        { path: "/e/[slug]", note: "An event's website, often on the event's own domain." },
        { path: "/e/[slug]/ticket/[token]", note: "A ticket, usable without an account." },
        { path: "/events/[id]", note: "The platform-hosted view of an event." },
        { path: "/f/[token]", note: "A file shared by link." },
        { path: "/shared/note/[token]", note: "A note shared by link." },
        { path: "/magic-link/[token]", note: "Signs the holder in and forwards them to a destination." },
        { path: "/invoice/[invoiceId]", note: "A payable invoice." },
        { path: "/qa/[agentId]", note: "A public chat with one AI agent." },
        { path: "/careers, /careers/[id], /jobs/[id]", note: "Open roles." },
        { path: "/privacy", note: "The privacy policy." },
      ],
    },
    { type: "heading", id: "domains-mw", text: "How a custom domain resolves" },
    {
      type: "flow",
      flow: {
        title: "middleware.ts",
        summary: "Every request passes through this. The order matters — the cheapest checks come first.",
        steps: [
          { label: "Read the Host header", kind: "start", detail: "`nextUrl.hostname` is unreliable in `next dev`, so the header is read directly." },
          {
            label: "Is it a known fixed-path domain?",
            kind: "decision",
            branches: [
              { on: "Admin subdomain", steps: [{ label: "Rewrite under /garage-admin", kind: "end" }] },
              { on: "A Lost Money domain", steps: [{ label: "Rewrite under the Lost Money site", detail: "Branded aliases like /aboutus map to paths that do not match 1:1.", kind: "end" }] },
            ],
          },
          { label: "Is it an event domain?", kind: "decision", branches: [
            { on: "Yes", steps: [{ label: "Rewrite to /e/[slug]", kind: "end", detail: "Resolved against the API, cached per isolate for five minutes." }] },
            { on: "Cached miss", steps: [{ label: "Skip the lookup", detail: "Misses are cached too — the common case is an unmapped host." }] },
          ] },
          { label: "Is it a white-label domain?", kind: "decision", branches: [
            { on: "Yes", steps: [{ label: "Serve the org workspace, branded", kind: "end" }] },
            { on: "No", steps: [{ label: "Continue to the app as normal", kind: "end" }] },
          ] },
        ],
      },
    },
    {
      type: "note",
      tone: "info",
      title: "Why the lookup is cached both ways",
      text: "Event domains are database rows, so they cannot be a constant like the fixed-path map. Caching only the hits would mean one API round trip per request for every unmapped host — which is almost all of them. A short timeout also keeps a struggling API from holding up every request on the app.",
    },
    { type: "heading", id: "mobile", text: "Opening in the app" },
    {
      type: "prose",
      text: [
        "`OpenInAppGate` wraps the whole app at the root layout. On a mobile browser it offers to continue in the native app, and `lib/deeplink.ts` and `lib/installIntent.ts` carry the destination — and the affiliate code — through the app store and a first launch, so someone who installs from a shared link still lands on the thing they clicked.",
      ],
    },
  ],
};
