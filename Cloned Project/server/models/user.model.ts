// src/models/user.model.ts  (add fields if missing)
import { Schema, model } from "mongoose";

const OrgMembershipSchema = new Schema({
  organization: {
    type: Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
  },
  role: {
    type: String,
    enum: ["founder", "stakeholder"],
    default: "stakeholder",
  },
  fullAccess: { type: Boolean, default: false }, // Founder-level access for stakeholders when approved by admin
  // Module-level RBAC: per-surface admin rights a founder delegated to this
  // member. Binary per module — admin or not. Only ever written once the
  // member ACCEPTS a PermissionGrant (see models/permissionGrant.model.ts);
  // revocation writes false immediately. Founders/fullAccess bypass this map
  // entirely, so it stays all-false for them.
  //
  // Read it through utils/rbac.ts#normalizePermissions, never directly —
  // `.lean()` reads skip these defaults and yield undefined.
  modulePermissions: {
    type: new Schema(
      {
        community: { type: Boolean, default: false },
        courses: { type: Boolean, default: false },
        live_streams: { type: Boolean, default: false },
        digital_products: { type: Boolean, default: false },
      },
      { _id: false }
    ),
    default: () => ({}),
  },
  floorId: { type: Schema.Types.ObjectId, ref: "Floor" }, // Floor specific to this organization
  joinedAt: { type: Date, default: Date.now },
  guest: { type: Boolean, default: false }, // Track if user joined this org as a guest
  // Coverfi: true when this user was provisioned as a corporate admin / employee
  // through the Coverfi backend. Flips to false on first regular Garage login.
  insurance_user: { type: Boolean, default: false },
});

const UserSchema = new Schema(
  {
    // Uniqueness is declared as a partial index at the bottom of this file,
    // NOT here: a plain `unique: true` is non-sparse, so a second account
    // without an email collides on null and phone-only signup is impossible.
    email: { type: String },
    name: String,
    // Legacy fields for backward compatibility - will be deprecated
    organization: { type: Schema.Types.ObjectId, ref: "Organization" },
    role: {
      type: String,
      enum: ["admin", "user", "founder", "stakeholder"],
      default: "user",
    },
    // NEW: Multiple organization memberships
    organizations: [OrgMembershipSchema],
    isVerified: { type: Boolean, default: false },
    department: { type: String }, // NEW
    // Profile fields (optional for now)
    country: { type: String },
    state: { type: String },
    city: { type: String },
    postalCode: { type: String },
    // A login identity, not just a contact field — always E.164, unique via
    // the partial index below. See services/identifier.ts.
    phone: { type: String },
    // Set true once the user completes SMS OTP phone verification
    // (POST /auth/phone/verify-otp), or on signup via phone, where passing
    // the OTP IS the proof of possession. The verified number is stored on
    // `phone` above.
    phoneVerified: { type: Boolean, default: false },
    // Location coordinates
    latitude: { type: Number },
    longitude: { type: Number },
    level2Field1: { type: String },
    level2Field2: { type: String },
    profileComplete: { type: Boolean, default: false },
    /**
     * When the 24-hour free-first-month offer window opened
     * (services/comboWindow.ts).
     *
     * Defaults to NOW at account creation, so the clock starts at sign-up for
     * every user however they were created — the main OTP signup, an invite, a
     * downline enrolment, or a shell account minted during a product checkout.
     * A schema default rather than 17 call-site edits, so a creation path added
     * later cannot forget it.
     *
     * `POST /auth/phone/verify-otp` and `PUT /profile` still stamp it as a
     * FALLBACK for accounts that predate this default; both guard on it being
     * unset, so they can never restart a window that already ran.
     *
     * Deliberately NOT backfilled. Absence means "window closed", which is the
     * right answer for every account created before the offer existed, and
     * fails safe — a missing field can never grant a free month.
     */
    profileCompletedAt: { type: Date, default: Date.now },
    /**
     * Admin-set override for the 24-hour offer window's expiry. When set AND
     * later than the natural `profileCompletedAt + 24h`, this becomes the
     * effective expiry (see `services/comboWindow.ts`). Never used to shorten
     * the window — `comboWindowFor` picks whichever expiry is later.
     * Set by `POST /garage-admin/users/:userId/extend-offer`.
     */
    offerExpiresAtOverride: { type: Date },
    /** When the last admin extension happened. Audit only. */
    offerExtendedAt: { type: Date },
    /** Which garage admin ran the last extension. Audit only. */
    offerExtendedByAdminId: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
    },
    /** Set instead of offerExtendedByAdminId when a downline UPLINE (a normal
     *  user, via POST /downlines/:userId/extend-offer) extends this user's
     *  offer window. Keeps upline extensions distinguishable from admin ones. */
    offerExtendedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    /**
     * Saved payment methods (Stripe phase 1; Razorpay slot added in
     * phase 2). Card data itself lives in the processor's vault —
     * Garage only stores the opaque id + display metadata (brand,
     * last4, expiry) so we can render the picker and initiate
     * server-side off-session charges. See
     * `services/stripe.ts:getOrCreateStripeCustomer` +
     * `chargeSavedPaymentMethod` and the Stripe webhook branch that
     * persists `payment_method.attached` / `.detached`.
     */
    paymentProfile: {
      stripe: {
        customerId: { type: String, default: null }, // "cus_xxx"
        methods: [
          {
            _id: false,
            id: { type: String, required: true }, // "pm_xxx"
            brand: { type: String }, // "visa" | "mastercard" | ...
            last4: { type: String },
            expMonth: { type: Number },
            expYear: { type: Number },
            // ISO-2 issuer country from Stripe (`card.country`). Drives the
            // FE currency filter: INR checkouts show country === "IN"
            // cards; USD checkouts show non-IN. Absent on legacy rows
            // (saved before we started capturing it) — those show
            // everywhere as a graceful fallback.
            country: { type: String },
            // RBI e-mandate authorized at save time — lets us charge INR
            // saved cards off-session (zero OTP) up to `mandateAmount`.
            // Only populated when the SetupIntent that saved this card
            // included `payment_method_options.card.mandate_options` AND
            // the issuer is Indian. Absent for USD cards + legacy
            // Indian saves — those fall back to the CIT/OTP flow at
            // reuse time. Amount is stored in paise for INR mandates.
            mandateId: { type: String },
            mandateAmount: { type: Number },
            mandateStatus: { type: String }, // "active" | "inactive" | "pending"
            mandateExpiresAt: { type: Date },
            isDefault: { type: Boolean, default: false },
            addedAt: { type: Date, default: Date.now },
          },
        ],
      },
      // Razorpay saved cards (phase 2). Mirrors the Stripe shape.
      // `customerId` is the Razorpay Customer id — may be pre-populated
      // by the GSTIN attach flow on office subs
      // (`services/officeSubscription.ts:598-613`), in which case we
      // reuse it here rather than creating a second Customer at first
      // save. Tokens carry the RBI-mandated `maxAmount` cap + explicit
      // `expireAt` so we know when a token needs re-auth.
      razorpay: {
        customerId: { type: String, default: null }, // "cust_xxx"
        tokens: [
          {
            _id: false,
            id: { type: String, required: true }, // "token_xxx"
            method: { type: String, default: "card" }, // "card" | "upi"
            last4: { type: String },
            network: { type: String }, // "visa" | "mastercard" | "rupay" | ...
            issuer: { type: String }, // "HDFC" | "SBIN" | ...
            expMonth: { type: Number },
            expYear: { type: Number },
            maxAmount: { type: Number }, // paise cap per RBI
            expireAt: { type: Date },
            /**
             * UPI Autopay (recurring UPI mandate).
             *
             * A UPI token is only chargeable off-session once the payer has
             * approved a mandate in their UPI app. These four mirror the
             * Stripe `methods[]` mandate fields above so the auto-charge cron
             * can gate both rails with the same shape.
             *
             * `vpa` is the payer's UPI handle (name@bank) — the UPI analogue
             * of `last4`, and the only human-recognisable identifier for a UPI
             * token, since there is no card number to show.
             *
             * `mandateStatus` tracks the mandate's own lifecycle, which is NOT
             * the same as the token existing: a payer can revoke a mandate in
             * their UPI app (arriving as `token.cancelled`) while the token row
             * lingers. Charging is gated on "active", never on presence.
             */
            vpa: { type: String }, // "someone@okhdfcbank"
            mandateId: { type: String },
            mandateStatus: { type: String }, // "active" | "paused" | "revoked" | "pending"
            mandateExpiresAt: { type: Date },
            isDefault: { type: Boolean, default: false },
            addedAt: { type: Date, default: Date.now },
          },
        ],
      },
      /**
       * Instruments the USER removed from Payment Methods — a saved card
       * detached or a UPI mandate deleted from the settings page.
       *
       * Both delete routes `$pull` the row, which erased the only evidence
       * that auto-debit had ever been set up. The admin NetworkChain Subs
       * table then could not tell "cancelled their autopay" from "never had
       * one" — and the founder needs exactly that distinction (18 Sep 2026).
       * A mandate cancelled inside the UPI app is different: Razorpay's
       * `token.cancelled` marks the token row `revoked` and it stays.
       */
      removedInstruments: [
        {
          _id: false,
          kind: { type: String, enum: ["card", "upi"], required: true },
          id: { type: String, required: true }, // pm_xxx | token_xxx
          removedAt: { type: Date, default: Date.now },
          /** Tail of the card / the VPA, so support can name what went. */
          label: { type: String },
        },
      ],
    },
    profilePicture: { type: String }, // URL to the profile picture
    /** Job title / role label — used on profile cards and pre-stashed by
     *  the "Enroll a Downline" flow. Free-form, optional. */
    designation: { type: String, trim: true, maxlength: 120 },
    // Affiliate system fields
    isFirstTimeUser: { type: Boolean, default: false },
    affiliateId: { type: String, unique: true, sparse: true }, // Global affiliate ID (e.g., "aff_ti6de6kr")
    referredBy: { type: Schema.Types.ObjectId, ref: "User" }, // The user who referred this user
    // Why `referredBy` was set. Discriminates a real affiliate attribution
    // from an auto-assigned org-founder default so a later affiliate-link
    // click can UPGRADE a `founder_default` to an `affiliate`. Never
    // downgrade the other way (first affiliate wins).
    referredBySource: {
      type: String,
      enum: ["affiliate", "founder_default"],
    },
    // ── Downline-table denormalized fields (feat/downline-table) ────────────
    // Materialized ancestor path (ordered global-root → direct parent). Lets any
    // viewer's subtree / level / leg be an indexed lookup instead of a per-request
    // $graphLookup. Maintained on enroll + re-parent; backfilled by
    // scripts/backfill-downline-tree.ts. See docs contract 2026-07-27.
    ancestors: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    depth: { type: Number, default: 0 }, // = ancestors.length (global root = 0)
    // This user's 1-based signup order among their OWN parent's direct referrals
    // (Leg 1 = parent's first-ever direct). A viewer's "Leg N" for a member =
    // legNumber of the ancestor that is the viewer's direct child on that member's
    // path. Null until backfilled / for the global root.
    legNumber: { type: Number, default: null },
    // Denormalized subtree counts so the Directs / Downline columns are sortable
    // and filterable server-side. Maintained on enroll (parent.directsCount++,
    // every ancestor.downlineCount++ via one $inc over the ancestors path).
    directsCount: { type: Number, default: 0 }, // # of direct referrals
    downlineCount: { type: Number, default: 0 }, // total descendants (all levels)
    // Stackable membership sub-states (see services/downlineTypeFlags.ts).
    // Recomputed on purchase/subscription change; backfilled. Shopper = all false.
    typeFlags: {
      oneNetworkActivated: { type: Boolean, default: false }, // active UnilevelPlusPurchase ($25)
      networkChainsSub: { type: Boolean, default: false }, // active NC sub WITH a real >$0 paid cycle (not the $0 combo month)
      founderSub: { type: Boolean, default: false }, // active "Founders Office" OfficeSubscription
    },
    // Reserved for future MLM ranks — deferred; render "No Rank" until populated.
    rank1: { type: String, default: null },
    rank2: { type: String, default: null },
    // NetworkChain rank bonus standing. Written ONLY by the monthly rank-bonus
    // run (services/rankBonus/), so what a user sees is exactly what they were
    // paid for — never a live mid-month projection that they might then miss.
    // `current: null` means they did not qualify in `periodKey`.
    // Deliberately separate from rank1/rank2, which belong to a different
    // (still-unbuilt) MLM rank concept.
    ncRank: {
      current: { type: String, default: null },
      periodKey: { type: String, default: null }, // "2026-08"
      updatedAt: { type: Date, default: null },
    },
    // Support agent (a GarageAdmin) assigned to this user as a NetworkChain
    // subscriber, set from the admin "NetworkChain Subs" table's Assign/Change
    // action. Mirrors the org-level assignedAdminId on Organization, but scoped
    // to the individual paying affiliate.
    assignedSupportAgentId: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      index: { sparse: true },
    },
    assignedSupportAgentAt: { type: Date },
    assignedSupportAgentBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    // "NVC chat created" — MARKED BY HAND from the admin panel, not derived.
    // The chat itself happens off-platform, so there is no signal to compute
    // from; an admin records that it happened. Set = yes, unset = no.
    nvcChatCreatedAt: { type: Date },
    nvcChatCreatedBy: { type: Schema.Types.ObjectId, ref: "GarageAdmin" },
    // Guest user flag (for users who join via guest request flow)
    guest: { type: Boolean, default: false },
    // Personal OpenClaw AI agents (created via agent manager)
    openclawAgents: [
      {
        agentId: { type: String },
        name: { type: String },
        orgId: { type: Schema.Types.ObjectId, ref: "Organization" },
      },
    ],
    // Mailbox configuration for email (per organization)
    mailboxes: [
      {
        organization: { type: Schema.Types.ObjectId, ref: "Organization" },
        created: { type: Boolean, default: false },
        email: { type: String },
        localPart: { type: String },
        domain: { type: String },
        credentials: { type: String }, // base64 encoded (use proper encryption in production)
        createdAt: { type: Date },
        isActive: { type: Boolean, default: false }, // Which mailbox is currently active
      },
    ],
    // Last time we saw this user alive on the socket layer (connect or
    // periodic heartbeat). Powers the "Active 5m ago" affordance that
    // replaces the green-dot presence UI across the workspace.
    lastSeenAt: { type: Date },
  },
  { timestamps: true }
);

// ── Identity indexes ────────────────────────────────────────────────────
// Both login identifiers are unique, and both are OPTIONAL: an account may
// hold an email, a phone, or both. `partialFilterExpression` rather than
// `sparse` because sparse only skips a MISSING field — an explicit
// `email: null` write would still collide on a sparse unique index.
// Applied to the live collection by scripts/migrate-identity-indexes.ts;
// declared here so a fresh deploy builds the same thing.
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } }
);
UserSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } }
);
UserSchema.index({ "organizations.organization": 1 });
UserSchema.index({ affiliateId: 1 });
UserSchema.index({ referredBy: 1 });
// Downline-table workhorses: whole-subtree membership + subtree-by-level.
UserSchema.index({ ancestors: 1 });
UserSchema.index({ ancestors: 1, depth: 1 });
UserSchema.index({ "openclawAgents.orgId": 1 });
UserSchema.index({ lastSeenAt: -1 });

// ── Sign-up offer ────────────────────────────────────────────────────────────
// The 24-hour free-first-month window opens at account creation (see the
// `profileCompletedAt` default above), so the offer email goes out here.
//
// A model hook rather than 17 call-site edits: users are created from the OTP
// signup, invites, downline enrolment, teamforce, and six different checkout
// flows that mint a shell account for a buyer. Any of those can start a window,
// and a creation path added later gets this for free.
//
// `isNew` is already false by the time post("save") runs, so it is captured in
// pre("save") — the same idiom the disabled bulk-email hook below used.
UserSchema.pre("save", function (next) {
  (this as any).__wasNew = this.isNew;
  next();
});

UserSchema.post("save", function (doc: any) {
  if (!doc.__wasNew) return;
  delete doc.__wasNew;
  if (!doc.email) return;

  /**
   * White-label signups get no NetworkChain offer.
   *
   * This is a Garage upsell — "Your NetworkChain offer — first month free",
   * sent from Garage's own address and linking to my.garage.app. Sending it
   * to someone who just registered on a client's branded site advertises a
   * different company to that client's customer.
   *
   * A transient set by the caller, mirroring `__wasNew` above: this hook has
   * no request context of its own, so it cannot tell which domain the signup
   * came from. The signup route resolves that and marks the doc.
   */
  if (doc.__skipSignupOffer) {
    delete doc.__skipSignupOffer;
    return;
  }

  // Fire-and-forget. sendSignupOffer swallows its own errors, and the extra
  // guard here means even an import failure can't reject the save that just
  // succeeded — the account must exist regardless of whether the email lands.
  import("../services/signupOffer")
    .then(({ sendSignupOffer }) =>
      sendSignupOffer({
        userId: doc._id.toString(),
        email: doc.email,
        name: doc.name,
      })
    )
    .catch((err) =>
      console.error("[SignupOffer] hook dispatch failed:", err?.message || err)
    );
});

// ─── Downline-tree auto-sync (defence in depth) ────────────────────────
//
// Every path that sets `referredBy` on a User doc — whether it went
// through an explicit `void syncNewEnrollee(...)` call site or not — now
// gets slotted into the denormalized downline (ancestors[]/depth/
// legNumber + parent.directsCount + ancestors[].downlineCount) via this
// post-hook. Historical bug: only 4 signup paths had explicit hooks, but
// there are 5+ other writers (guestAuth stakeholder branch, org.ts x2,
// profile.ts x2, invoice.ts, courseCheckout/workshopCheckout/
// channelCheckout via setReferredBy). Each missed path leaves the buyer
// visible on 1Network but invisible in the downline table.
//
// Guard: only fires when the doc has a referredBy AND has NOT been
// synced yet (ancestors is empty). Repeated saves of an already-synced
// user are cheap no-ops.
//
// Fire-and-forget; syncNewEnrollee swallows its own errors so this never
// rejects the save.
UserSchema.post("save", function (doc: any) {
  if (!doc.referredBy) return;
  const anc = doc.ancestors;
  if (Array.isArray(anc) && anc.length > 0) return;
  const uid = doc._id?.toString?.();
  if (!uid) return;
  // A self-referrer is a ROOT, so `ancestors: []` is CORRECT for them — the
  // emptiness check above would otherwise treat them as permanently unsynced
  // and re-fire on every single save. syncNewEnrollee guards this too; this
  // just avoids the pointless dispatch.
  if (String(doc.referredBy) === uid) return;
  import("../services/downlineTree")
    .then(({ syncNewEnrollee }) => syncNewEnrollee(uid))
    .catch((err) =>
      console.error(
        "[downlineTree] post-save syncNewEnrollee dispatch failed:",
        err?.message || err,
      ),
    );
});

// findOneAndUpdate does NOT trigger post("save"), so it needs its own
// hook. Pattern matches the paths that use User.findByIdAndUpdate to
// set referredBy (e.g. services/invoice.ts:407-411).
UserSchema.post("findOneAndUpdate", function (doc: any) {
  if (!doc || !doc.referredBy) return;
  const anc = doc.ancestors;
  if (Array.isArray(anc) && anc.length > 0) return;
  const uid = doc._id?.toString?.();
  if (!uid) return;
  // Self-referrers are roots; `ancestors: []` is correct for them. See the
  // matching guard on the post-save hook above.
  if (String(doc.referredBy) === uid) return;
  import("../services/downlineTree")
    .then(({ syncNewEnrollee }) => syncNewEnrollee(uid))
    .catch((err) =>
      console.error(
        "[downlineTree] post-findOneAndUpdate syncNewEnrollee dispatch failed:",
        err?.message || err,
      ),
    );
});

// DISABLED: Bulk signup notification emails sent to all platform users
// UserSchema.pre("save", function (next) {
//   if (this.isModified("organizations")) {
//     const current = (this.organizations || []).length;
//     if (this.isNew) {
//       (this as any).__prevOrgCount = 0;
//     } else if ((this as any).__prevOrgCount === undefined) {
//       (this as any).__prevOrgCount = current - 1;
//     }
//   }
//   next();
// });

// UserSchema.post("save", async function (doc) {
//   const prevCount = (doc as any).__prevOrgCount;
//   if (prevCount === undefined) return;
//   delete (doc as any).__prevOrgCount;
//
//   const currentCount = (doc.organizations || []).length;
//   if (prevCount !== 0 || currentCount < 1) return;
//
//   const newMembership = (doc.organizations || [])[currentCount - 1] as any;
//   if (newMembership?.role === "founder") return;
//
//   try {
//     const { notifyNewPersonJoined } = await import("../services/bulkEmail");
//
//     let referredByName: string | undefined;
//     if (doc.referredBy) {
//       const referrer = await model("User")
//         .findById(doc.referredBy)
//         .select("name")
//         .lean();
//       referredByName = (referrer as any)?.name;
//     }
//
//     notifyNewPersonJoined({
//       email: doc.email!,
//       name: doc.name || undefined,
//       city: doc.city || undefined,
//       referredByName,
//     });
//   } catch (err) {
//     console.error("[BulkEmail] Mongoose post-save hook error:", err);
//   }
// });

export const User = model("User", UserSchema);
