import type { Chapter } from "../types";

export const money: Chapter = {
  slug: "money",
  number: 10,
  title: "Money and the network",
  part: "Revenue",
  blurb:
    "Affiliate links, a downline that pays several levels deep, rank bonuses, wallets in more than one currency, and getting the money out.",
  blocks: [
    {
      type: "prose",
      text: [
        "Garage's revenue model is referral-driven: almost everything that can be sold can also be *shared*, and the share carries the sharer's affiliate id. That one idea produces the network, the leaderboards, the rank bonuses and the wallets.",
      ],
    },
    { type: "heading", id: "links", text: "Affiliate links" },
    {
      type: "prose",
      text: [
        "Any sellable — and the apps themselves — can be turned into an affiliate link. `buildAffiliateUrl` stamps your id onto the destination, `buildEmbedHtml` produces an embeddable version, and `getAffiliateCatalog` and `getOfficeItems` list what is available to share: the platform-wide catalogue and your own office's items.",
        "A click is captured by `lib/affiliate-click.ts` and persisted stickily, so it survives the visitor wandering the site before they buy, and is spent as `referralCode` at sign-up. `getLinkStats` reports what each link did.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "How a referral becomes a commission",
        steps: [
          { label: "Share a link", actor: "Affiliate", kind: "start", detail: "The affiliate id is in the URL." },
          { label: "Visitor lands", detail: "`?ref=` or `?referCode=` is captured and stored stickily." },
          { label: "They browse", kind: "wait", detail: "The code survives navigation, an app-store detour, and a first app launch." },
          { label: "They sign up", actor: "POST /auth/verify-otp", detail: "The stored code is sent as `referralCode`." },
          { label: "They are now in your downline", detail: "Directly, at level one." },
          { label: "They buy something" },
          { label: "Commission is credited", actor: "Affiliate wallet", kind: "end", detail: "Direct on your own referrals, indirect on theirs." },
        ],
      },
    },
    { type: "heading", id: "network", text: "The network" },
    {
      type: "prose",
      text: [
        "1Network is the view of who you brought in and who they brought in. Referrals are split into **direct** — people you personally referred — and **indirect**, everyone below them. `AffiliateNetworkCanvas` draws the tree, and the globe view maps it geographically.",
        "Downline pages go further: per-person profiles, their monthly performance, and the live streams they are running. Founders can enrol someone into their downline directly through `EnrollDownlineSheet`, which posts to `/downlines/enroll`.",
      ],
    },
    { type: "heading", id: "leaderboard", text: "Leaderboards" },
    {
      type: "prose",
      text: [
        "The leaderboard ranks affiliates by referral performance, filterable by category and paginated — with `fetchAllLeaderboard` for when the whole board is needed at once rather than a page at a time.",
      ],
    },
    { type: "heading", id: "rank-bonus", text: "Rank bonuses" },
    {
      type: "prose",
      text: [
        "The rank bonus pays monthly on your standing in the network rather than on any single sale. The member-facing page answers three questions and nothing else: what rank am I, what is stopping me reaching the next one, and what have I been paid.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Rank", def: "Computed for a period (`periodKey`, a year-month) from your active directs and the size and top rank of each leg." },
        { term: "Legs", def: "Each direct referral heads a leg. A leg's size and its best rank both count toward yours." },
        { term: "Next rank", def: "Returned by the server as a target, a requirement, what you have and what you need — so the page never has to reimplement the plan's rules." },
        { term: "Bronze stacking", def: "When `plan.bronzeStacks` is set, a higher tier's bonus is paid **in addition to** Bronze rather than instead of it." },
        { term: "History", def: "Per period: the rank achieved, the bonus in USD, the payout status, whether it was routed to the platform, and when it was paid." },
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Self-scoped by the server",
      text: "`GET /rank-bonus/me` is scoped server-side. There is no way for a member to ask about someone else's rank from this page, which is why it carries no user parameter.",
    },
    { type: "heading", id: "wallets", text: "Wallets" },
    {
      type: "prose",
      text: [
        "The wallet — GaragePay, shown as **Vaults** — is not one balance. It is several, each with its own ledger, presented as tabs.",
      ],
    },
    {
      type: "table",
      head: ["Wallet", "Holds"],
      rows: [
        ["Store", "Spendable balance inside an organisation's store, toppable-up."],
        ["Affiliate", "Commission earned from referrals."],
        ["Content rewards", "Earnings from clipping and UGC campaigns."],
        ["Reserve", "Funds held against claims not yet settled."],
        ["Rewards", "Reward credits issued to you."],
        ["Cashback codes", "Codes issued against purchases."],
        ["Payment methods", "Cards and accounts on file — the paying-in side."],
      ],
    },
    {
      type: "prose",
      text: [
        "Balances can be held in more than one currency, converted between them, and transferred — to one person, or to several at once through `MultiCurrencyTransferSheet`. Organisations flagged as cryptobrand offices get an additional set of currencies. Every tab is backed by a transaction feed that pages rather than loading whole.",
      ],
    },
    { type: "heading", id: "payouts", text: "Getting paid out" },
    {
      type: "prose",
      text: [
        "`PayoutAccountsSection` and `BankDetailsSection` collect where the money should go; `CommissionPlanSection` shows what is being earned and on what terms. Withdrawal requests are raised by the member and settled by platform staff from the Garage Admin console, which also holds the ledger view and a sweeper for stuck balances.",
      ],
    },
    { type: "heading", id: "billing", text: "Billing and subscriptions" },
    {
      type: "prose",
      text: [
        "Two kinds of subscription exist and they are easy to confuse. **Office plans** are what an organisation pays Garage for seats and features. **Member subscriptions** are what a person pays a founder for a community, a course or a service.",
        "`MySubscriptionsPage` is the member's view of what they are paying for; `SubscriptionManagementModal` and `SubscriptionStatusBadge` handle changing and displaying state. AI usage is billed separately — see the AI chapter.",
      ],
    },
    { type: "heading", id: "revenue-network", text: "Revenue Network" },
    {
      type: "prose",
      text: [
        "Revenue Network is a companion platform that Garage talks to over server-side API routes under `/api/revenue-network/*` — affiliate links, network, stats and settings, plus channels and the store wallet with its transfer endpoint. These are Next.js route handlers rather than direct client calls, because the integration is keyed and the key must not reach the browser.",
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "`NEXT_PUBLIC_EXTERNAL_API_KEY`",
      text: "Revenue Network calls 401 without it. `lib/revenue-network-api.ts` warns in development when it is missing, which is the difference between a five-minute fix and an afternoon.",
    },
  ],
};
