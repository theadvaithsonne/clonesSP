import type { Chapter } from "../types";

export const officeSetup: Chapter = {
  slug: "office-setup",
  number: 3,
  title: "Setting up an office",
  part: "Start here",
  blurb:
    "Creating an organisation, drawing the floor plan, inviting the team, choosing a plan, and putting your own name on it.",
  blocks: [
    {
      type: "prose",
      text: [
        "A new account with no organisations is sent to `/organization`. What follows is a short, ordered setup — and because the building is the product, the floor plan step matters more than it sounds.",
      ],
    },
    {
      type: "flow",
      flow: {
        title: "Office setup",
        steps: [
          { label: "Name the organisation", actor: "/organization", kind: "start", detail: "Company name, icon, and the slug the public HQ page will use." },
          { label: "Draw the floor plan", actor: "/floor-plan", detail: "Add floors, name them, and give each one departments. Posts to `/floors/setup`." },
          { label: "Choose a plan", actor: "/office-payment", detail: "Seat count and billing. `/upgrade` and `/downgrade` change it later." },
          { label: "Invite the team", actor: "/team", detail: "Email addresses with a role each. Optional — you can open the office empty." },
          { label: "Enter the workspace", kind: "end" },
        ],
      },
    },
    { type: "heading", id: "floors", text: "Floors and departments" },
    {
      type: "prose",
      text: [
        "Floors are the spine of the office. Each has a `level` number that sets its order and drives the animation as people move between them, a name, and a list of departments. Departments are named and colour-coded, and they carry a headcount — the same structure Teamforce uses for HR reporting.",
        "The roster for every floor comes from `GET /floors/roster?orgId=…` and arrives with both `members` and `pending` — people who have been invited to the floor but have not accepted.",
      ],
    },
    { type: "heading", id: "meeting-rooms", text: "Meeting rooms" },
    {
      type: "prose",
      text: [
        "Rooms live on floors and in the HQ. They are persistent group-call spaces: anyone can walk in, and whoever is inside is visible from outside before you join. Rooms can also be booked ahead — a booking carries a title, a description, a start and end time, a list of invited people, and a status of active, cancelled or completed.",
      ],
    },
    { type: "heading", id: "team-access", text: "Roles and team access" },
    {
      type: "prose",
      text: [
        "Members are invited with a role. Beyond the founder/admin split, individual apps are granted per person from **Settings → Team Access**, and the grants are read back by `useModuleAccess` and `useMyGrants`. An app a person has not been granted does not appear in their app bar at all.",
      ],
    },
    {
      type: "routes",
      items: [
        { path: "/settings/team-access", note: "Who has which apps." },
        { path: "/settings/payment-methods", note: "Cards on file for the organisation." },
        { path: "Office Settings → Invitees", note: "Sent invitations and their state." },
        { path: "Office Settings → Pending Requests", note: "People asking to join a private office." },
        { path: "Office Settings → Coupons", note: "Discount codes the office issues." },
      ],
    },
    { type: "heading", id: "branding", text: "Branding" },
    {
      type: "prose",
      text: [
        "An office sets its icon, cover photo, and a primary and secondary colour. Those values travel with the org everywhere it is rendered — the workspace chrome, the public HQ page, the guest storefront, checkout, and outbound email. The org welcome email is composed from the same palette.",
      ],
    },
    { type: "heading", id: "domains", text: "Domains" },
    {
      type: "prose",
      text: [
        "`/domains` is a full registrar surface, not just a CNAME field. You can search availability, see suggestions and pricing, buy a domain and pay for it inline, then manage DNS records, nameservers, auto-renew, transfer lock, and the authorisation code, and renew when it lapses.",
      ],
    },
    { type: "heading", id: "whitelabel", text: "White-labelling" },
    {
      type: "prose",
      text: [
        "The white-label add-on serves the whole workspace from the organisation's own domain, under its own name and colours. `WhitelabelSetupWizard` walks through branding, the sending domain for email, and the domain itself; `middleware.ts` resolves the hostname to an org on each request.",
      ],
    },
    {
      type: "note",
      tone: "warn",
      title: "`whitelabelActive` is separate from `isWhitelabel`",
      text: "A domain can still resolve to an org after the add-on has lapsed. `WhitelabelGate` checks `whitelabelActive`, not merely that the config loaded, before serving branded chrome.",
    },
    { type: "heading", id: "plans", text: "Plans and seats" },
    {
      type: "prose",
      text: [
        "Office plans are bought at `/office-payment` and changed at `/upgrade` and `/downgrade`. When a plan lapses or a seat limit is exceeded, `OfficeSubscriptionLock` and `BackOfficeLockedOverlay` cover the affected surface rather than hiding it — the office stays legible, but the locked features explain what to do.",
      ],
    },
  ],
};
