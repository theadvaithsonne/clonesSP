import type { Chapter } from "../types";

export const commerce: Chapter = {
  slug: "commerce",
  number: 9,
  title: "Content and commerce",
  part: "Revenue",
  blurb:
    "Everything a founder can sell — communities, courses, videos, digital products, services and their own time — and the checkout behind it.",
  blocks: [
    {
      type: "prose",
      text: [
        "A founder's back office is a storefront. Seven kinds of thing can be sold, each with the same surrounding machinery: a public page, a checkout, orders, customers, reviews, and an unsubscribe log.",
      ],
    },
    {
      type: "table",
      head: ["Sellable", "Public route", "Back office"],
      rows: [
        ["Community / channel", "`/guest/[slug]/channel/[id]`", "Communities — members, orders, cabinet, unsub log"],
        ["Course", "`/guest/[slug]/course/[id]`", "Courses — students, orders, analytics, unsub log"],
        ["Digital product", "`/guest/[slug]/product/[id]`", "Products — orders, customers"],
        ["Service", "`/guest/[slug]/service/[id]`", "Services — opt-ins, customers, orders"],
        ["1:1 call", "`/guest/[slug]/call/[id]`", "Calls — purchases, bookings, customers, orders"],
        ["Live stream / webinar", "`/guest/[slug]/webinar/[id]`", "Live — attendees, orders, recordings, unsub log"],
        ["Event ticket", "`/e/[slug]`", "Events — registrations, promotions"],
      ],
    },
    { type: "heading", id: "content", text: "Content" },
    {
      type: "spec",
      items: [
        { term: "Videos", def: "Long-form uploads with a custom player, collected into **playlists**. `AllVideosPage` is the library; `ContentAnalyticsPage` reports on it." },
        { term: "Drops", def: "Short vertical video with its own feed and player, uploaded through `DropUploadModal`." },
        { term: "Articles", def: "Long-form writing in a dedicated editor, published to the feed and to `/guest/[slug]/article/[id]`." },
        { term: "Recordings", def: "Past live streams, replayable at `/guest/[slug]/recording/[id]` with the original chat." },
        { term: "Courses", def: "Structured learning with enrolment, students and completion tracking." },
      ],
    },
    { type: "heading", id: "content-rewards", text: "Content Rewards" },
    {
      type: "prose",
      text: [
        "Content Rewards pays other people to make content for you. A founder funds a campaign, creators submit clips, and approved submissions are paid per thousand views.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "A rewards campaign",
        steps: [
          { label: "Create the campaign", actor: "Founder", kind: "start", detail: "Clipping or UGC, a budget, a rate per thousand views, and a payout floor and ceiling." },
          { label: "Set requirements", detail: "Platforms, clip duration bounds, required hashtags and mentions, guidelines, and downloadable assets." },
          { label: "Fund the campaign wallet", detail: "Budget is held; `lockedAmount` covers approved-but-unpaid work." },
          { label: "Creators submit", actor: "Participant", kind: "wait", detail: "Linked to their connected social accounts." },
          {
            label: "Review",
            kind: "decision",
            branches: [
              { on: "Auto-approve is on", steps: [{ label: "Approved on arrival" }] },
              { on: "Manual", steps: [{ label: "Approve or reject" }] },
            ],
          },
          { label: "Views accrue, payout is calculated", detail: "Clamped between `minPayout` and `maxPayout`." },
          { label: "Paid from the campaign wallet", kind: "end", detail: "Every movement is a credit, debit or refund on the wallet ledger." },
        ],
      },
    },
    { type: "heading", id: "checkout", text: "Checkout" },
    {
      type: "prose",
      text: [
        "One checkout serves every sellable, at `/checkout/{kind}/{id}`. It handles currency selection, several payment methods — card through Stripe, Razorpay, and a crypto panel — coupons at both the organisation and the platform level, GST quoting where it applies, and saved cards.",
      ],
    },
    {
      type: "routes",
      items: [
        { path: "/checkout/product/[productId]", note: "A digital product." },
        { path: "/checkout/course/[courseId]", note: "A course." },
        { path: "/checkout/channel/[channelId]", note: "A community subscription." },
        { path: "/checkout/service/[serviceId]", note: "A service engagement." },
        { path: "/checkout/call/[callId]", note: "A 1:1 call slot." },
        { path: "/checkout/workshop/[workshopId]", note: "A workshop or live session." },
        { path: "/invoice/[invoiceId]", note: "A standalone invoice, payable without an account." },
        { path: "/save-card/[token]", note: "Adding a card outside a purchase." },
      ],
    },
    {
      type: "prose",
      text: [
        "After payment, `ProductThankYouCard` renders a page the founder designed in `ProductThankYouPageEditor` — the post-purchase moment is editable content, not a fixed receipt. An invoice PDF is generated by `InvoiceDocument`.",
      ],
    },
    { type: "heading", id: "orders", text: "Orders and customers" },
    {
      type: "prose",
      text: [
        "Every sale lands in an orders view scoped to its kind — community orders, course orders, product orders, live orders, call orders — plus a combined `OrdersPage` and `OrderHistoryPage` for the buyer's own side. `CustomersPage` and the per-product customer views answer the other question: who bought, and what else have they bought.",
        "**Reserves** appear across several of these. A reserve is a claim on something not yet purchased — a held course seat, a product allocation, a call slot — and each sellable has its own reserves view.",
      ],
    },
    { type: "heading", id: "coupons", text: "Coupons and rewards" },
    {
      type: "spec",
      items: [
        { term: "Office coupons", def: "Issued by the organisation, managed in Office Settings." },
        { term: "Platform coupons", def: "Issued by Garage itself and honoured across organisations." },
        { term: "Coupon rules", def: "`CouponRuleEditor` defines who qualifies; `CouponAssignmentSheet` hands one to a specific person." },
        { term: "Cashback codes", def: "A separate mechanism with its own buyer and item pickers, issued against a purchase." },
        { term: "Gift rewards", def: "`GiftRewardModal` sends a reward directly." },
        { term: "Eligibility", def: "`rewards-api` computes who is eligible and what offers are pending." },
      ],
    },
    { type: "heading", id: "reviews", text: "Reviews and testimonials" },
    {
      type: "prose",
      text: [
        "Seven things can be reviewed: a channel, a course, a product, a workshop, a service, a call, and an office. Ratings roll up into a breakdown and a summary shown on the sales page, and `ReviewsModerationList` lets a founder moderate what appears.",
        "Testimonials are the curated version — written or recorded, arranged into a gallery, and published at `/guest/[slug]/testimonials`.",
      ],
    },
    { type: "heading", id: "auction", text: "Auctions" },
    {
      type: "prose",
      text: [
        "`/auction` runs live auctions over the socket. A lot can be a Garage product or something from outside, with images and a description. Bidding is realtime and has its own wallet, and an auction can be embedded into a live stream so the audience bids while watching.",
      ],
    },
    { type: "heading", id: "jobs", text: "The job marketplace" },
    {
      type: "prose",
      text: [
        "Services have a second face as a marketplace: organisations post work, people apply, and engagements are tracked in `ServiceEngagementView`. The public side is `/careers` and `/careers/[id]`, with `/jobs/[id]` for a single role.",
      ],
    },
  ],
};
