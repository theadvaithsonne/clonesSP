# Garage — what it does, in plain words

**Garage is a virtual office with a whole company's software built into it.** Your organisation is a building. It has floors, floors have departments and meeting rooms, and everyone who is signed in is standing somewhere in that building where you can see them. Around the office sits everything a company runs on: chat, files, tasks, a CRM, HR, email campaigns, a course and product store, affiliate payouts, games and AI helpers.

This page is the master list. For how it is built see [ARCHITECTURE.md](ARCHITECTURE.md); for the data see [DATABASE.md](DATABASE.md); the app also explains itself at `/docs` (source: `app/docs/content/chapters/`). Every source file has its own `.md` next to it.

## The basic ideas

| Word | Meaning |
|---|---|
| **Organisation / HQ** | The company account (the "tenant"). Everything belongs to one. A person can belong to several and switches at `/select-organization`. |
| **Floor, department, meeting room** | The building: floors hold departments (colour-coded groups) and persistent meeting rooms. |
| **Space** | Wherever someone is right now: lobby, a floor, a meeting room, or a call. |
| **Founder / Admin / Member / Guest** | Founder runs the business side; admin runs office settings; members work in the office; guests get access to one thing (an event, a channel, a call) but not the office. |
| **Platform staff** | Garage's own team, using a separate console at `/garage-admin` on its own subdomain. |

## 1. Getting in
- **Sign in with a one-time code** sent by email, or by SMS/WhatsApp for a phone number. No password to remember.
- **Several accounts at once**, with a quick switcher.
- **Invitations and join requests**, and **guest** links so outsiders can join a call or event without an account.
- Phone verification, with the code sent over both WhatsApp and SMS.

## 2. Setting up an office
- Create floors, departments and meeting rooms; invite people; assign roles and per-app permissions ("Team Access").
- **Branding, custom domains and white-label**: run Garage under your own domain, name, colours, logo and email sender (a paid yearly add-on). See [WHITELABEL.md](WHITELABEL.md).
- Plans and seats, office subscriptions and add-ons.

## 3. The virtual office
- **See who is where** and their status (available, busy, away, offline).
- **Knock to call**: walk up to a colleague and knock; it rings on every device and starts a one-to-one video call when they answer.
- **Floor and meeting-room calls** with camera, mic, screen share and in-call chat.
- **Record a work session** (screen plus everyone's audio), which then goes to the Cabinet and can be analysed by AI.
- Book meeting rooms ahead of time. Reconnects automatically if the connection drops.

## 4. Meetings, webinars and events
- **Conference rooms**: pre-join device check, virtual backgrounds, host controls (admit, remove), reactions, chat, voice memos, notes, recordings, attendance, picture-in-picture while you work.
- **Webinars and live streams**: huge audiences, live chat with GIFs, polls and Q&A, **a shop that pins products mid-stream**, **live auctions**, promote an audience member to speaker, recordings with replay.
- **Evergreen webinars**: a recording replayed on a schedule as if it were live, with an optional simulated audience.
- **Ticketed events**: organiser pages, custom event domains, tickets with QR/links.
- **Calendar**, bookings, co-working spaces and room bookings.
- **AI note-taker**: transcribes a session and produces a summary that can be sent out.

## 5. Talking to people
- **Direct messages and groups**: threads, replies, edit/delete/pin, reactions, files, images, GIFs, voice and video messages, shared contacts and locations, link previews, mini-chat window, message retention rules.
- **Slash commands** inside chat.
- **The feed**: posts, polls, comments, reposts and quotes, bookmarks, hashtags, long-form articles, and share links that carry your affiliate code.
- **Channels and communities** (some paid), **notifications**, and mobile **push** (iOS and Android).
- **Network Mail**: email campaigns with a visual template editor, plus a company mailbox.
- **Helpdesk and support tickets**, with a staff-side inbox.

## 6. Getting work done
- **Taskrooms** and **tasks** (kanban boards, assignments, subtasks, comments, live updates) and **Flowboards**.
- **Notes**: a Notion-style editor with pages, databases (table/board/calendar/timeline views), mentions, reminders and version history.
- **The Cabinet**: Google-Drive-style files and folders, sharing by person or by link, in-browser editing of office documents (OnlyOffice).
- **Ask Cabinet**: ask an AI about a document, video or recording (tasks done, efficiency tips).
- E-signature (Docusign), voice memos, a streamed virtual desktop (Kasm), screen recorder.

## 7. Business apps (inside the workspace)
- **Deals — a CRM**: leads, contacts, companies, funnels and a funnel-page builder, products, follow-up reminders, bulk CSV upload.
- **Teamforce — HR**: employees, branches and departments, attendance and leave, payroll and salary slips, tax declarations, recruitment. CSV bulk upload and email invites for new employees.
- **Events**: event management for organisers.
- **CoverFi — insurance brokerage**: products, insurers, corporate clients, employees and dependents, policy emails.
- **Jobs marketplace**: founders post jobs and hire; candidates apply; referral rewards paid when a hire completes its guarantee period.

## 8. Content and commerce
- **Content**: videos and playlists, short vertical "drops", articles, recordings, **courses** with enrolment and progress.
- **Selling**: digital products, services, paid 1:1 calls and call booking, community memberships, store pages, a guest storefront anyone can open.
- **Checkout**: pay by card (Razorpay, Stripe) or crypto; GST for India; invoices and pay links; recurring subscriptions with automatic renewal and revoking access on non-payment.
- **Orders and customers**, **coupons** (office, platform-wide, rules-based), **cashback codes**, gift rewards, **reviews**, **auctions**.
- **Content Rewards**: pay creators per views on their social posts, with payout sweeps.

## 9. Money and the network
- **Affiliate links**: share a link; when someone joins or buys, commissions are paid up the chain.
- **The network**: downline tree and table, genealogy view, leaderboards.
- **Unilevel Plus and rank bonuses**: monthly rank by team size and rank of each leg, with bonus payouts (can run in report-only mode).
- **Wallets and payouts**: store wallets in several currencies, affiliate wallet, ecommerce wallet, territory/franchise wallet, withdrawals, wallet-to-wallet transfers, crypto top-ups.
- **Franchise and territory programme**: country/territory franchises with resale offers and commissions.
- **HiFi bonds**: fixed-income instruments founders publish and investors buy, with scheduled interest payouts.
- **Magic links**: shareable offer links with reminder emails.
- **Third-party APIs**: partner invoicing, partner wallet credits, and public calculators and analytics for outside platforms.
- **Revenue Network** integration for the external customer app.

## 10. AI employees
- **Agents** you "hire", each with its own knowledge (**contexts**), **integrations**, **scheduled jobs and tasks**, and chat.
- **Public Q&A agents** that answer visitors.
- Bring-your-own **AI providers**; the OpenClaw gateway powers the agent backend.

## 11. Games and side apps
- **BAT 246**: a board game with boards, seats, card types, a B2 Coin wallet and a layaway system, POD teams, permissions, leaderboards, a monthly membership and invite flows (backend in `server/bat246/`, UI under `/games/bat246`).
- **Lost Money**: public sites (separate domains) for claims, testimonials and a paid list.
- Smaller extras: user flowcharts, a gated BAT246 video library, short links.

## 12. Public and guest pages
- **HQ pages** (`/hq/...`), **guest storefronts** (`/guest/...`), event pages (`/e`, `/events`), file links (`/f/<token>`), invoice pay pages (`/invoice/<id>`), meet links (`/meet`), webinar rooms (`/webinar/<id>`), a careers page, and "open in app" handoff for mobile.
- **Custom domains**: an organiser's own domain can serve their app, event, shop or investor site.

## 13. Garage Admin (platform staff)
A back-office with page-level permissions and an extra step-up verification. It covers organisations, founders and stakeholders, users and roles, KYC review, support tickets and chats, announcements and promotions, coupons, wallets and withdrawals, platform fees, rank and referral bonuses, subscriptions, analytics and daily reports, danger-zone operations (super admin only), AI provider settings, affiliate guests, co-working spaces, and a sweeper tool.

## Behind the scenes
- **Realtime**: Socket.IO for presence, chat and call setup; LiveKit for calls; mediasoup for big webinars; WebRTC for the small live tiles.
- **Background jobs** (about 20): expiring memberships and grants, billing, payouts, rank bonuses, renewals, retention clean-up, reminders. See [ARCHITECTURE.md](ARCHITECTURE.md#background-jobs).
- **Integrations**: Razorpay, Stripe, NOWPayments (crypto), AWS S3, Resend and Mailcow (email), Twilio-style SMS and WhatsApp OTP delivery, LiveKit, Daily, OnlyOffice, Mapbox, PostHog and Sentry (analytics and errors), Gemini/OpenAI/Anthropic/Deepgram (AI).
- **One project, one process**: the web app and API run together; the API is under `/backend`.
