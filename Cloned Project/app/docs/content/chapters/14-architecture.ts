import type { Chapter } from "../types";

export const architecture: Chapter = {
  slug: "architecture",
  number: 14,
  title: "Architecture reference",
  part: "Reference",
  blurb:
    "How the code is laid out, what state lives where, which environment variables matter, and how to tell whether a change actually works.",
  blocks: [
    { type: "heading", id: "layout", text: "Where things live" },
    {
      type: "code",
      lang: "text",
      text: `app/
├── (auth)/            Login, OTP verify, guest sign-in
├── (onboarding)/      Organisation, floor plan, team, plans
├── (landing)/         Marketing, signup, profile setup, book a demo
├── (dashboard)/       The signed-in app — workspace, apps, settings
├── (affiliate)/       Affiliate-scoped org and channel views
├── garage-admin/      Platform back office (own subdomain)
├── guest/ hq/ p/ e/   Public surfaces
├── meet/ webinar/     Calls and live sessions
├── api/               Next.js route handlers
└── docs/              This manual

lib/
├── socket.ts          One Socket.IO connection per tab
├── auth.ts            Token, org id, and what is inside the JWT
├── accounts.ts        The multi-account ledger
├── api.ts             HTTP client
├── webrtc-context.tsx Global peer state for 1:1 calls
├── workspace-livekit-context.tsx
├── meeting-context.tsx
├── whitelabel.ts      Host → organisation
└── hooks/             Cross-app hooks

components/
├── dashboard/         Everything in the signed-in shell
│   └── inlineApps/    Teamforce, Deals, Network Mail, Notes, Events
├── ui/                Radix wrappers
└── shared/            Used on both sides of the login`,
    },
    { type: "heading", id: "state", text: "State" },
    {
      type: "prose",
      text: [
        "Global state is Zustand stores plus React contexts, split by how long the value needs to live.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "`store/authStore.tsx`", def: "The signed-in user. **Persisted to localStorage** under `auth-storage`, and in the main app only ever written by the login page and explicit `refreshUser()` calls." },
        { term: "`store/appsStore.tsx`", def: "Installed apps, and the GX auth response mirrored into localStorage." },
        { term: "`store/uiStore.tsx`, `sidebarStore.tsx`", def: "Layout and panel state." },
        { term: "`store/webinarStore.ts`", def: "Live-session state." },
        { term: "`lib/chat-context.tsx`", def: "The active conversation and unread state." },
        { term: "`lib/webrtc-context.tsx`", def: "1:1 call state, mounted above the dashboard." },
        { term: "`lib/meeting-context.tsx` + `PipProvider`", def: "Mounted at the **root** layout — which is why a call survives navigating anywhere in the app." },
        { term: "`lib/whitelabel-context.tsx`", def: "The resolved organisation for the current host." },
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "Adding a field to the user",
      text: "The persisted auth store hides missing fields until someone clears their cookies. When you add a user field, update `setUser` on the **verify page** too — the backend returning it is not enough. Note that `setUser` in `app/select-organization/` and `AffiliateProfileOverlay.tsx` are local `useState`, not the store.",
    },
    { type: "heading", id: "patterns", text: "Patterns worth knowing" },
    {
      type: "spec",
      items: [
        { term: "Deterministic call ids", def: "`generateCallId(a, b)` sorts the two user ids before joining them, so both sides compute the same id and two simultaneous knocks collapse into one call." },
        { term: "Track helpers", def: "`isLiveCameraTrack()`, `isScreenTrack()` and `getPreferredScreenTrack()` in `workspace/utils.ts` — a MediaStreamTrack does not tell you what it is." },
        { term: "ICE candidate batching", def: "Candidates collected in 100ms windows before sending." },
        { term: "Dynamic imports", def: "The workspace and every inline app are loaded with `ssr: false`, because they depend on browser media APIs." },
        { term: "Stream deduplication", def: "Adding a track of a kind that already exists replaces it rather than stacking." },
        { term: "Memoised space rendering", def: "`spacesToRender` is recomputed only when the roster changes — it runs on every peer update otherwise." },
      ],
    },
    { type: "heading", id: "env", text: "Environment" },
    {
      type: "table",
      caption: "The variables you are most likely to need. Public ones reach the browser.",
      head: ["Variable", "Purpose"],
      rows: [
        ["`NEXT_PUBLIC_API_URL`", "The backend. Defaults to `http://localhost:4000`. Also the Socket.IO host."],
        ["`NEXT_PUBLIC_APP_URL`", "This app's own origin, used for absolute links and OG metadata."],
        ["`NEXT_PUBLIC_LIVEKIT_URL`", "The LiveKit server."],
        ["`NEXT_PUBLIC_EXTERNAL_API_KEY`", "Revenue Network. Missing means 401 on every call."],
        ["`NEXT_PUBLIC_CUSTOMER_APP_URL`", "The Revenue Network customer app."],
        ["`NEXT_PUBLIC_RAZORPAY_KEY_ID`", "Razorpay checkout."],
        ["`NEXT_PUBLIC_MAPBOX_TOKEN`", "Maps — the globe and event venues."],
        ["`NEXT_PUBLIC_POSTHOG_KEY` / `_HOST`", "Product analytics."],
        ["`NEXT_PUBLIC_ONLYOFFICE_URL`", "Document editing in the Cabinet."],
        ["`NEXT_PUBLIC_HQ_FORCE_RECORDING`", "Auto-recording policy for an HQ."],
        ["`NEXT_PUBLIC_IOS_APP_STORE_URL` / `_ANDROID_PLAY_STORE_URL`", "Where the open-in-app gate sends people."],
        ["`NOTION_API_KEY`, `GIPHY_API_KEY`, `FACEBOOK_APP_SECRET`", "Server-side only — used by route handlers."],
        ["`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`", "Source-map upload at build time."],
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Missing credentials fail soft",
      text: "Clients whose keys are absent log an error and return null rather than throwing, so one unconfigured integration does not take the app down.",
    },
    { type: "heading", id: "verify", text: "Verifying a change" },
    {
      type: "prose",
      text: [
        "Turbopack does not typecheck, and `next.config.ts` ignores both TypeScript and ESLint errors during the build. That makes the checks below more important than they would be elsewhere.",
      ],
    },
    {
      type: "code",
      lang: "bash",
      text: `npm run dev      # development, Turbopack
npm run build    # production build — the authoritative check
npm start        # serve the production build
npm run lint     # ESLint`,
    },
    {
      type: "note",
      tone: "warn",
      title: "A non-zero tsc exit proves nothing here",
      text: "`./node_modules/.bin/tsc --noEmit` reports roughly 160 pre-existing errors, mostly in `WorkshopsPage.tsx` and generated `.next/types`. The repository has never been tsc-clean. Judge your work by: `npm run build` exits 0, and none of the files you touched appear in the tsc output. Never use `npx --no tsc --noEmit` — it emits nothing and exits 0 regardless, which reads as a pass.",
    },
    { type: "heading", id: "deploy", text: "Deploying" },
    {
      type: "prose",
      text: [
        "This app deploys through **Vercel**. Pushing to `main` does not put a change in front of users until that deploy runs.",
        "`main` is usually behind the remote and the tree often carries unrelated uncommitted work, so `git pull --rebase` refuses and stashing would destroy work in flight. Commit by pathspec, then merge and push from a throwaway worktree so the primary tree is never touched.",
      ],
    },
    {
      type: "code",
      lang: "bash",
      caption: "Pushing while the working tree is dirty",
      text: `git commit -m "…" -- path/to/file.tsx          # only this file
git worktree add /tmp/wt -b tmp-push <commit>
cd /tmp/wt && git merge origin/main --no-edit
git push origin tmp-push:main                  # lands on main
cd - && git worktree remove /tmp/wt --force && git branch -D tmp-push`,
    },
    { type: "heading", id: "testing", text: "What cannot be tested automatically" },
    {
      type: "list",
      items: [
        "WebRTC needs real ICE candidates, which do not mock convincingly.",
        "Socket.IO events need a backend listening — there is no stub.",
        "Screen share and recording need a user gesture and a permission grant.",
        "MediaRecorder's supported containers and codecs differ by browser.",
        "LiveKit and Stream calls need a real token minted by the backend.",
      ],
    },
    { type: "heading", id: "start-here", text: "Files to read first" },
    {
      type: "routes",
      caption: "In this order",
      items: [
        { path: "app/(dashboard)/workspace/WorkspaceClient.tsx", note: "The office. Everything else hangs off it." },
        { path: "app/(dashboard)/workspace/hooks/useLiveKit.ts", note: "Every call in the workspace." },
        { path: "app/(dashboard)/workspace/hooks/useWebRTC.ts", note: "Presence video and connection recovery." },
        { path: "app/(dashboard)/workspace/hooks/useKnocking.ts", note: "How a call starts." },
        { path: "app/(dashboard)/workspace/types.ts", note: "The core data model — read this early." },
        { path: "lib/socket.ts", note: "Every realtime event passes through here." },
        { path: "lib/auth.ts + lib/accounts.ts", note: "Sessions, and several at once." },
        { path: "middleware.ts", note: "How a hostname becomes a route." },
        { path: "app/(dashboard)/layout.tsx", note: "Which providers wrap the signed-in app." },
      ],
    },
  ],
};
