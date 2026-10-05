// The event catalogue admin notification rules can bind to.
//
// This is the contract between three consumers that would otherwise drift:
// the code that emits an event, the evaluator that tests conditions against
// its payload, and the admin UI that renders the condition builder. The UI
// reads this over HTTP and builds its inputs from `type`, so ADDING AN EVENT
// HERE REQUIRES NO UI CHANGE AND NO ENGINE CHANGE — that is what makes the
// catalogue dynamic.
//
// It lives in code rather than the database deliberately: a payload's shape
// IS code, and a DB-defined event could describe fields no emitter produces.
//
// See docs/superpowers/specs/2026-09-11-admin-notification-rules-design.md.

/** Drives which operators the builder offers, and how the value input renders. */
export type EventFieldType = "user" | "string" | "number" | "enum" | "boolean";

export interface EventField {
  key: string;
  label: string;
  type: EventFieldType;
  /** Only for type "enum". */
  values?: string[];
}

export interface AdminEventDescriptor {
  name: string;
  label: string;
  /** Shown in the builder so an admin knows when this actually fires. */
  description: string;
  fields: EventField[];
}

/**
 * Operators offered per field type. `user` is the interesting one: it is what
 * makes "signed up under X but not under Y" expressible, and both downline
 * operators resolve through the denormalized `User.ancestors[]` path
 * (user.model.ts:227), so they are indexed lookups rather than graph walks.
 */
export const OPERATORS_BY_TYPE: Record<EventFieldType, { op: string; label: string }[]> = {
  user: [
    { op: "inDownlineOf", label: "is in the downline of" },
    { op: "isDirectOf", label: "is a direct referral of" },
    { op: "is", label: "is" },
    { op: "hasTypeFlag", label: "has flag" },
  ],
  string: [
    { op: "equals", label: "is" },
    { op: "contains", label: "contains" },
    { op: "in", label: "is one of" },
  ],
  number: [
    { op: "eq", label: "=" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
  ],
  enum: [
    { op: "equals", label: "is" },
    { op: "in", label: "is one of" },
  ],
  boolean: [
    { op: "isTrue", label: "is true" },
    { op: "isFalse", label: "is false" },
  ],
};

export const ADMIN_EVENTS: AdminEventDescriptor[] = [
  {
    name: "user.signup",
    label: "Customer signs up",
    // Emitted from the `referredBy` post-hook on the User schema
    // (user.model.ts:388), NOT from the individual signup routes. That hook
    // exists because only four of the nine-plus paths that set `referredBy`
    // ever had explicit hooks; emitting per route would reintroduce exactly
    // that bug.
    description:
      "Any new member joining the referral tree — signup, invite, downline enrolment or a checkout that created the account.",
    fields: [
      { key: "user", label: "New member", type: "user" },
      { key: "sponsor", label: "Sponsor", type: "user" },
      { key: "country", label: "Country", type: "string" },
      {
        key: "source",
        label: "Source",
        type: "enum",
        values: ["signup", "invite", "checkout", "downline", "admin"],
      },
    ],
  },

  // ── $25 payments ──────────────────────────────────────────────────────
  //
  // Three NESTED events, not three exclusive ones. Every $25 payment raises
  // `payment.up25`; a payment that also bought a NetworkChain subscription
  // additionally raises `.networkchain`; one whose buyer also has a working
  // auto-debit instrument additionally raises `.networkchain.autodebit`. So a
  // rule picks its scope by picking its event — "every $25" never misses a
  // combo buyer.
  //
  // All three are emitted from services/adminNotifications/paymentEvents.ts,
  // triggered by a post-save hook on UnilevelPlusPurchase — the one model every
  // payment path writes. Purchases that are NOT payments (a reserve licence
  // being assigned, backfills, synthetic mints, manual activations) and $0
  // coupon activations are filtered out there.
  {
    name: "payment.up25",
    label: "$25 payment",
    description:
      "Someone pays for the $25 plan — on its own, or together with a subscription. Licence assignments and $0 coupon activations don't count.",
    fields: PAYMENT_FIELDS(),
  },
  {
    name: "payment.up25.networkchain",
    label: "$25 payment with NetworkChain subscription",
    description:
      "A $25 payment whose checkout also included a NetworkChain subscription (including a free first month).",
    fields: PAYMENT_FIELDS(),
  },
  {
    name: "payment.up25.networkchain.autodebit",
    label: "$25 payment with NetworkChain subscription + autodebit",
    // Autodebit uses the SAME predicate as the NetworkChain Subs admin page
    // (services/autoDebitInstrument.ts), so this event and that page's
    // "Auto-debit ON" badge can never disagree about the same buyer.
    description:
      "A $25 + NetworkChain payment where the buyer also has working auto-debit — an active UPI mandate or a saved card. Checked again for a few minutes after payment, since the mandate is often saved just after.",
    fields: PAYMENT_FIELDS(),
  },
];

/** Shared by all three payment events so a rule's conditions carry across. */
function PAYMENT_FIELDS(): EventField[] {
  return [
    { key: "user", label: "Payer", type: "user" },
    { key: "sponsor", label: "Payer's sponsor", type: "user" },
    { key: "amount", label: "Amount (USD)", type: "number" },
    { key: "country", label: "Country", type: "string" },
    {
      key: "source",
      label: "Paid via",
      type: "enum",
      values: ["invoice_fulfillment", "webhook_fallback", "direct"],
    },
    { key: "termMonths", label: "Subscription months", type: "number" },
    { key: "freeFirstMonth", label: "Free first month", type: "boolean" },
    {
      key: "autoDebitVia",
      label: "Auto-debit via",
      type: "enum",
      values: ["upi", "card", "none"],
    },
  ];
}

export const ADMIN_EVENT_NAMES = ADMIN_EVENTS.map((e) => e.name);

export function findEvent(name: string): AdminEventDescriptor | undefined {
  return ADMIN_EVENTS.find((e) => e.name === name);
}
