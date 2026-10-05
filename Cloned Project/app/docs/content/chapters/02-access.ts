import type { Chapter } from "../types";

export const access: Chapter = {
  slug: "access",
  number: 2,
  title: "Getting in",
  part: "Start here",
  blurb:
    "One-time codes, email or phone, several accounts at once, magic links, and guests who never sign up at all.",
  blocks: [
    {
      type: "prose",
      text: [
        "Garage has no passwords. You identify yourself with an email address or a phone number, receive a six-digit code, and type it back. Everything else — which organisation you land in, whether you are a member or a guest, whether you need to finish your profile — is decided after the code is accepted.",
      ],
    },
    { type: "heading", id: "otp", text: "Signing in with a code" },
    {
      type: "flow",
      flow: {
        title: "Sign-in",
        summary: "The same path serves a first-time signup and a returning member; the fork is whether the account already has organisations.",
        steps: [
          { label: "Enter email or phone", actor: "/login", kind: "start", detail: "One field. `lib/identifier.ts` decides which it is." },
          { label: "Request a code", actor: "POST /auth/request-otp", detail: "Sent over SMS and WhatsApp when the identifier is a phone." },
          { label: "Type the six digits", actor: "/verify", kind: "wait" },
          { label: "Verify", actor: "POST /auth/verify-otp", detail: "Returns the user, their organisations, and any pending referral credit." },
          {
            label: "Where does this person belong?",
            kind: "decision",
            branches: [
              {
                on: "Came from a storefront link",
                steps: [
                  { label: "Join that organisation", actor: "POST /guest-auth/public-join", detail: "Swaps in an org-scoped token so the workspace opens as the office that was clicked." },
                  { label: "Land on the item they came for", kind: "end" },
                ],
              },
              {
                on: "One organisation",
                steps: [
                  { label: "Select it automatically", actor: "POST /auth/select-org" },
                  { label: "Enter the workspace", kind: "end" },
                ],
              },
              {
                on: "Several organisations",
                steps: [
                  { label: "Pick an office", actor: "/select-organization" },
                  { label: "Enter the workspace", kind: "end" },
                ],
              },
              {
                on: "None",
                steps: [
                  { label: "Create an organisation", actor: "/organization", detail: "Or accept an invitation that is waiting." },
                  { label: "Run office setup", kind: "end" },
                ],
              },
            ],
          },
        ],
      },
    },
    {
      type: "note",
      tone: "warn",
      title: "The token carries the organisation",
      text: "`/auth/select-org` returns a *new* token scoped to the chosen org, and `orgId` is saved beside it. Switching offices is not a UI filter — it is a different token. Code that keeps a stale token after a switch will read the previous org's data.",
    },
    { type: "heading", id: "identifier", text: "Email or phone, one field" },
    {
      type: "prose",
      text: [
        "`lib/identifier.ts` is the single place that decides what someone typed. It is more careful than it looks, because each helper in it fixes a way real input breaks.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "`detectMode`", def: "Email or phone, from the raw string." },
        { term: "`toE164` / `toPhoneIdentifier`", def: "Combines a dial code with a local number. Strips the habitual trunk zero, which naive prefixing turns into a number that does not exist." },
        { term: "`dedupeLeadingCode`", def: "Handles a number that already carries its country code when a dial code is also selected." },
        { term: "`splitE164`", def: "Pulls a stored number back apart to prefill the picker. Must match the **longest** dial code first, or `+1` wins over `+91`." },
        { term: "`countryOfTyped`", def: "Guesses the country from what is being typed so the picker can follow along." },
      ],
    },
    { type: "heading", id: "phone", text: "Verifying a phone number" },
    {
      type: "prose",
      text: [
        "A phone number is verified separately from signing in. Three places can start it and all three must behave identically: **Complete Profile** in the profile popover, the **Verify your phone** banner, and the **Buy Now** sheet on a webinar plan.",
        "All three send `channel: \"both\"`, so the code goes out over WhatsApp *and* SMS — the backend defaults to SMS alone when the field is absent. All three use the searchable country picker.",
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "Fields the login page forgets stay undefined",
      text: "`store/authStore.tsx` is persisted to localStorage and only refreshed by explicit `refreshUser()` calls in the main app. Anything the verify page does not copy out of the `/auth/verify-otp` response is `undefined` until something else refreshes it, and the persisted cache hides that until cookies are cleared. This shipped as a real bug twice with `phone` and `phoneVerified`.",
    },
    { type: "heading", id: "multi-account", text: "Several accounts at once" },
    {
      type: "prose",
      text: [
        "You can be signed into more than one account and switch without signing out. The live session keys stay exactly as they are; a **ledger** sits beside them holding the other accounts. Switching copies a ledger row into the live keys and reloads, so nothing downstream — API clients, sockets, contexts — has to know that multiple users exist.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "`rememberAccount`", def: "Writes the current session into the ledger." },
        { term: "`beginAddAccount` / `endAddAccount`", def: "Marks the trip to the login screen as an addition, so the app does not bounce you back to the workspace mid-flow." },
        { term: "`activateAccount`", def: "Makes a ledger row the live session. Refuses an expired row." },
        { term: "`isAccountExpired`", def: "A remembered account is not a usable one — the JWT inside expires on its own schedule. Without this check the app gets a session that 401s every request." },
        { term: "`activateNextUsableAccount`", def: "Used on sign-out: drops to another live account rather than to the landing page." },
        { term: "`switchToAccount`", def: "The whole switch, ledger row to reload, in `lib/account-session.ts`." },
      ],
    },
    { type: "heading", id: "invites", text: "Invitations and requests" },
    {
      type: "routes",
      items: [
        { path: "/invite/[code]", note: "An invitation link. Accepting adds you to the organisation." },
        { path: "/accept-invite", note: "Accepting an invitation you received by email." },
        { path: "/magic-link/[token]", note: "Signs you in and drops you at a destination — used by campaign email and ticket links." },
        { path: "/my-requests", note: "Requests you have made to join private offices, and where they stand." },
        { path: "/garage-admin/accept-invite", note: "The same flow for platform staff, on the admin subdomain." },
      ],
    },
    {
      type: "prose",
      text: [
        "Founders and admins send invitations from **Invite Member**, which posts to `/invites/create` and emails a one-time code. Teamforce's **Invite via Email** uses the same endpoint, then pre-populates an HR profile for each address so the person arrives with a record already waiting. Invited-but-not-yet-joined people appear under Office Settings → Invitees; people who asked to join a private office appear under Pending Requests.",
      ],
    },
    { type: "heading", id: "guests", text: "Guests" },
    {
      type: "prose",
      text: [
        "A guest has access to one thing without joining the office. They get their own JWT and their own socket connection (`connectGuestSocket`), and they show up in the workspace with `guest: true` so the UI can treat them differently.",
      ],
    },
    {
      type: "routes",
      items: [
        { path: "/guest-login", note: "Guest sign-in for an event or a hosted item." },
        { path: "/guest-verify", note: "Code entry for guests." },
        { path: "/guest/event-join", note: "Joining a live event as a guest." },
        { path: "/guest/event-call", note: "The guest's view of an event call." },
        { path: "/guest/[slug]/**", note: "The organisation's storefront — everything a guest can browse and buy." },
      ],
    },
    {
      type: "heading",
      id: "affiliate-carry",
      text: "Referral credit that survives the journey",
    },
    {
      type: "prose",
      text: [
        "An affiliate link carries `?ref=` or `?referCode=`. That value is captured on first landing, persisted stickily, and spent as `referralCode` when the OTP is verified — so the credit survives a browser hop, an app-store install, and a first launch before the account even exists.",
      ],
    },
  ],
};
