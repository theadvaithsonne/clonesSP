import type { Chapter } from "../types";

export const communication: Chapter = {
  slug: "communication",
  number: 6,
  title: "Talking to people",
  part: "The office",
  blurb:
    "Direct messages, groups, threads, the feed, notifications, and email campaigns that go out under your own domain.",
  blocks: [
    { type: "heading", id: "dms", text: "Direct messages and groups" },
    {
      type: "prose",
      text: [
        "Chat lives in the right panel of the workspace, so a conversation never takes the office off screen. Three scopes exist: a direct message with someone in your organisation, a **global** direct message with someone in a different one, and a group.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Conversation IDs", def: "`dmConvId`, `groupConvId` and `globalDmConvId` in `lib/conv.ts` derive a stable id from the participants, so both sides compute the same room without asking the server." },
        { term: "Threads", def: "`ThreadPanel` opens a reply thread beside a message rather than inlining it." },
        { term: "Formatting", def: "A toolbar plus code blocks with syntax highlighting. Links are auto-detected and get a preview card." },
        { term: "Attachments", def: "Files, images, GIFs from Giphy, and emoji. A shared image opens in a lightbox." },
        { term: "Voice and video messages", def: "Record and send in place, with a waveform player on the receiving end." },
        { term: "Shared context", def: "Share a contact card or a location straight into the conversation." },
        { term: "Message actions", def: "React, reply, edit, delete, copy, and pin." },
        { term: "Group administration", def: "`GroupAdminPanel` manages members and permissions; `CreateGroupDialog` and `EditGroupDialog` cover the rest." },
        { term: "Mini chat", def: "`MiniChatWindow` floats a conversation over whatever else you are doing." },
      ],
    },
    { type: "heading", id: "slash", text: "Slash commands" },
    {
      type: "prose",
      text: [
        "Typing `/` in the composer opens a command menu that turns the message into something interactive. Three commands are live: **Create Poll**, **Schedule Meeting**, and **Share Product**. Each renders as a card in the conversation that the recipients act on in place — voting, accepting a time, or buying — rather than as text describing an action to take elsewhere.",
      ],
    },
    { type: "heading", id: "feed", text: "The feed" },
    {
      type: "prose",
      text: [
        "The feed is the organisation's public square, and also the delivery mechanism for paid communities. Posts belong to a **channel**; a channel can be free or subscription-gated, and what you see depends on what you have joined.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Posts", def: "Text, images, video, files and link previews, composed inline or in a full-screen composer on mobile." },
        { term: "Reactions", def: "Seven of them — like, love, fire, haha, wow, sad, angry — with a picker, a per-post summary, and a list of who reacted." },
        { term: "Polls", def: "Created in the composer, with live results." },
        { term: "Comments", def: "Threaded, with their own attachments." },
        { term: "Reposts and quotes", def: "Repost as-is or quote with your own commentary." },
        { term: "Bookmarks", def: "Saved posts, retrievable as their own list." },
        { term: "Pinning", def: "Channel owners pin a post to the top." },
        { term: "Hashtags", def: "`TrendingHashtags` surfaces what the organisation is talking about." },
        { term: "Articles", def: "Long-form posts written in a dedicated editor rather than the composer." },
        { term: "Sharing", def: "`ShareModal` produces a link that carries your affiliate code." },
      ],
    },
    { type: "heading", id: "channels", text: "Channels and communities" },
    {
      type: "prose",
      text: [
        "A channel is both a feed and a product. It has benefits, FAQs and reviews on its sales page, a price or none, and a subscription lifecycle: subscribe to a free channel directly, or pay — `createChannelOrder` then `verifyChannelPayment` for a one-off, `createChannelSubscription` for a recurring plan. Membership state is read back with `getChannelSubscriptionStatus`.",
        "Unsubscribing returns a status rather than a bare success, because leaving a paid channel and leaving a free one are different events, and the founder's **Unsub Log** records both.",
      ],
    },
    { type: "heading", id: "notifications", text: "Notifications" },
    {
      type: "prose",
      text: [
        "`NotificationsHub` collects everything that happened while you were not looking: task assignments, knocks you missed, mentions, orders, and app events. `MissedCallsPanel` handles knocks specifically. Task assignments also arrive live over `workspace:todo-notification` while you are in the office.",
      ],
    },
    { type: "heading", id: "network-mail", text: "Network Mail" },
    {
      type: "prose",
      text: [
        "Network Mail is the organisation's outbound email, running inline inside the workspace rather than as a separate product.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Templates", def: "Built from component blocks in a visual editor, with presets by category — marketing, general, promotional, transactional — and a draft/published/archived lifecycle. `email-html-export` renders blocks to the HTML that actually ships." },
        { term: "Campaigns", def: "A create flow that picks an audience, a template and a schedule." },
        { term: "Senders", def: "Verified sending identities and domains, set up in `EmailSenderSetup`." },
        { term: "Reports", def: "Delivery and engagement per campaign." },
      ],
    },
    {
      type: "note",
      tone: "info",
      title: "Where the same email templates show up",
      text: "The org welcome email and product emails are composed from the organisation's branding, so a template change follows through to transactional mail as well as campaigns.",
    },
  ],
};
