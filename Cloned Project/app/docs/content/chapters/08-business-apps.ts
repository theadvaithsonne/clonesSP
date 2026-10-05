import type { Chapter } from "../types";

export const businessApps: Chapter = {
  slug: "business-apps",
  number: 8,
  title: "Business apps",
  part: "Work",
  blurb:
    "A CRM, an HR system, an insurance platform and a helpdesk — each a full product, each running inside the office.",
  blocks: [
    {
      type: "prose",
      text: [
        "Some apps are big enough to be their own product but are mounted **inline**: they take over the main pane of the workspace without a page load, and they have no internal navigation of their own — the host sidebar tells them which section to show. `INLINE_APP_REGISTRY` in `components/dashboard/inlineApps/registry.ts` is the list.",
      ],
    },
    {
      type: "table",
      head: ["App", "Key", "What it is"],
      rows: [
        ["Teamforce", "`teamforce`", "HR, attendance, payroll and employee management."],
        ["Deals", "`deals`", "The CRM — leads, contacts, companies, funnels, products."],
        ["Network Mail", "`network-mail`", "Templates, campaigns, senders and reports."],
        ["Notes", "`thoughts`", "The block editor."],
        ["Events", "`events`", "Planning, ticketing and event websites."],
      ],
    },
    { type: "heading", id: "deals", text: "Deals — the CRM" },
    {
      type: "prose",
      text: [
        "Deals tracks the pipeline from a first touch to a closed sale, and it is wired back into the office: a lead card can start a knock, and a follow-up lands on your calendar.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Leads", def: "The pipeline. `/deals/leads/[id]` is a full record; `/deals/leads/bulk-upload` imports a CSV through a guided flow that resolves names to IDs before it writes anything." },
        { term: "Contacts and Companies", def: "The people and organisations behind the leads, each with their own bulk-upload flow." },
        { term: "Funnels", def: "`/deals/funnel` visualises the stages. Funnel Studio builds the pages themselves — a structure tree, a preview canvas and a node inspector — and publishes them to `/p/[slug]`." },
        { term: "Products", def: "What is being sold, attachable to a deal." },
        { term: "CMS", def: "`/deals/cms` holds the content the funnels render." },
        { term: "Quick actions", def: "`LeadContactQuickActions` and `FollowUpKnockCard` turn a record into a call or a scheduled follow-up without leaving it." },
        { term: "Notifications", def: "Per-user lead alerts, configured in `LeadNotificationSettings`." },
      ],
    },
    { type: "heading", id: "teamforce", text: "Teamforce — HR" },
    {
      type: "prose",
      text: [
        "Teamforce covers the employee lifecycle. It navigates by a single `internalDetail` state: routes listed in `handleNavigate` set it, anything else clears it, and the active section is `internalDetail || externalSection`.",
      ],
    },
    {
      type: "grid",
      items: [
        { title: "Employees", note: "Records, details, and a form that serves both add and edit." },
        { title: "Branches & departments", note: "The org structure HR reports against." },
        { title: "Attendance", note: "Presence and leave." },
        { title: "Payroll", note: "Runs, plus per-employee salary slips." },
        { title: "Tax declarations", note: "Employee submissions." },
        { title: "Recruitment", note: "Requests to hire, and where each one stands." },
      ],
    },
    {
      type: "prose",
      text: [
        "Adding people has three paths. **Manual entry** opens the employee form. **Bulk upload** parses a CSV. **Invite via email** sends an OTP invitation through `/invites/create` — the same endpoint the workspace's Invite Member dialog uses — and then creates an HR profile for each address so the record is waiting when they arrive.",
      ],
    },
    {
      type: "table",
      caption: "Bulk upload CSV columns. Header matching is case-insensitive.",
      head: ["Column", "Notes"],
      rows: [
        ["Full Legal Name", ""],
        ["Mobile Number", ""],
        ["Email ID", ""],
        ["Pan", ""],
        ["Date of Joining", "dd/mm/yyyy"],
        ["Place of Joining", ""],
        ["Branch", "The branch **name**, resolved to an id case-insensitively."],
        ["Department", "The department **name**, resolved the same way."],
        ["Designation", ""],
        ["Employment Type", ""],
      ],
    },
    {
      type: "note",
      tone: "limit",
      title: "Unrecognised branches and departments are dropped silently",
      text: "If a Branch or Department name does not match anything, the employee is still created — just without that field. A misspelled column value produces a record that looks fine until someone filters by department.",
    },
    { type: "heading", id: "coverfi", text: "CoverFi — insurance" },
    {
      type: "prose",
      text: [
        "CoverFi is a no-code platform for an insurance brokerage, and it is the most structured data model in the app.",
      ],
    },
    {
      type: "spec",
      items: [
        { term: "Brokerage", def: "The broker itself — branding, locations, employees and a public landing page." },
        { term: "Products", def: "Insurance products with categories and filters, billing type, payment frequency and waiver type." },
        { term: "Insurance companies", def: "The underwriters behind the products." },
        { term: "Companies", def: "Client companies and the products they have enrolled in, down to individual employees." },
        { term: "Corporates", def: "Corporate accounts with points of contact, employees (invited, active or suspended), dependents with a declared relation, and product mappings with their own status." },
        { term: "Communication", def: "Verified email senders and templates for policy correspondence." },
        { term: "Policy settings & roles", def: "Platform configuration and who can touch what." },
      ],
    },
    { type: "heading", id: "helpdesk", text: "Helpdesk" },
    {
      type: "prose",
      text: [
        "`/tickets` is support for people inside the organisation: raise a ticket at `/tickets/new` with a category, a priority and attachments, and follow it at `/tickets/[id]`. `SupportTicketModal` raises one from anywhere in the app. Platform staff work the same queue from the Garage Admin console.",
      ],
    },
  ],
};
