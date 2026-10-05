import { Schema, model } from "mongoose";
import { installCatalogHooks } from "./_catalogHooks";

// Utility function to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const OrganizationSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, sparse: true },
    size: { type: String },
    location: { type: String },
    // Location details
    city: { type: String },
    state: { type: String },
    country: { type: String },
    postalCode: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    parent: { type: Boolean, default: false }, // true for GARAGE HQ
    // Additional fields from API integration guide
    description: { type: String },
    headingText: { type: String },
    subHeadingText: { type: String },
    icon: { type: String }, // UploadThing URL
    coverPhoto: { type: String }, // UploadThing URL
    promoVideoLink: { type: String },
    // Additional branding fields
    colored_logo: { type: String },
    white_logo: { type: String },
    colored_icon: { type: String },
    white_icon: { type: String },
    website_meta_title: { type: String },
    website_meta_description: { type: String },
    // Typography — CSS font-family string chosen from the ManageOrg picker.
    // Empty = fall back to the app default. Consumers stamp it into
    // `style={{ fontFamily: org.font }}` directly.
    font: { type: String, default: "" },
    /**
     * Derived mirror of the office's KYC state — the record itself lives in
     * the OrgKyc collection (models/orgKyc.model.ts), which is the source of
     * truth. Written only by services/orgKyc.service.ts#syncOrgKycMirror so a
     * listing or a session bootstrap can show a "verified office" badge
     * without a second query. Absent on every office created before KYC
     * existed, which reads as "not requested".
     */
    kycStatus: {
      type: String,
      enum: ["not_requested", "pending", "submitted", "verified", "rejected"],
      index: true,
    },
    kycVerifiedAt: { type: Date },
    // Visibility & Category
    office_public: { type: Boolean, default: false },
    category: { type: String, default: "" },
    // True when the office was minted by the Cryptobrand system (via
    // the standard /org/create-first-time or /org/upsert endpoints
    // with `officeCreatedFromCryptobrand: true` in the payload).
    // Default false. Indexed so admin reports can filter cheaply.
    officeCreatedFromCryptobrand: { type: Boolean, default: false, index: true },
    // Founder answered "Yes" to whitelabel at office-creation time in
    // the HiFi seller app. There is NO extra charge — Cryptosub +
    // Pro-office invoices are unchanged. When Cryptosub is later paid
    // (see fulfillInvoice case "cryptosub"), an OfficeAddonSubscription
    // for the "white-label" addon is upserted with
    // metadata.source = "cryptosub_bundle" so the paid-addon renewal
    // tick skips it. Defaults false; safe for existing offices.
    whitelabelRequested: { type: Boolean, default: false, index: true },
    // Native Store
    store: {
      name: { type: String },
      slug: { type: String },
      description: { type: String },
      headingText: { type: String },
      subHeadingText: { type: String },
      icon: { type: String },
      coverPhoto: { type: String },
      promoVideoLink: { type: String },
      isActive: { type: Boolean, default: true },
      createdAt: { type: Date },
      updatedAt: { type: Date },
    },
    // Domain configuration for Mailcow email
    domainConfig: {
      type: {
        type: String,
        enum: ["default", "custom"],
        default: "default",
      },
      customDomain: { type: String }, // e.g., "example.com" or "shourpan.com" for default
      verified: { type: Boolean, default: false },
      domainAddedToMailcow: { type: Boolean, default: false },
      dnsRecords: [
        {
          type: { type: String }, // "TXT", "CNAME", "MX"
          name: { type: String },
          value: { type: String },
          priority: { type: Number }, // For MX records
          verified: { type: Boolean, default: false },
        },
      ],
      verifiedAt: { type: Date },
    },
    // Mailbox configuration (founder's email on Mailcow)
    mailboxConfig: {
      created: { type: Boolean, default: false },
      email: { type: String }, // full email e.g., "founder@shourpan.com"
      localPart: { type: String }, // username part e.g., "founder"
      domain: { type: String }, // domain part e.g., "shourpan.com"
      credentials: { type: String }, // base64 encoded password (use proper encryption in production)
      createdAt: { type: Date },
      founderUserId: { type: Schema.Types.ObjectId, ref: "User" },
      lastFetchedAt: { type: Date },
    },
    // Billing details for GST invoicing
    billingDetails: {
      gstin: { type: String }, // 15-char GSTIN (e.g., 22AAAAA0000A1Z5)
      legalName: { type: String }, // Registered business name for invoices
      billingAddress: {
        line1: { type: String },
        line2: { type: String },
        city: { type: String },
        state: { type: String },
        pincode: { type: String },
      },
    },
    // White-label branding configuration
    branding: {
      primaryColor: { type: String, default: "#FBD10D" }, // Default Garage yellow
      /**
       * Second brand colour. Not decoration: several surfaces are a
       * primary→secondary gradient (the login button, for one), so an org
       * that sets only a primary gets its colour blended into Garage
       * yellow. Defaults to the primary so a single-colour brand renders
       * as a flat fill rather than a gradient into the wrong hue.
       */
      secondaryColor: { type: String },
    },
    /**
     * White-label transactional sending (Resend).
     *
     * Separate from `domainConfig`, which is the Mailcow/NetworkMail mailbox
     * setup on possibly the SAME domain. Mailcow receives; Resend sends. Both
     * can be configured at once and they need different DNS records — see
     * services/resendDomains.ts for the SPF merge that keeps them compatible.
     *
     * `fromEmail` is only honoured once `status` is "verified": sending from an
     * unverified domain is rejected by Resend, and silently falling back mid-
     * send would make a white-label client's mail arrive as Garage without
     * anyone noticing.
     */
    emailSender: {
      domain: { type: String },
      resendDomainId: { type: String },
      status: { type: String, default: "not_started" },
      fromEmail: { type: String },
      fromName: { type: String },
      dnsRecords: [
        {
          record: { type: String },
          name: { type: String },
          type: { type: String },
          value: { type: String },
          ttl: { type: String },
          priority: { type: Number },
          status: { type: String },
        },
      ],
      lastCheckedAt: { type: Date },
      verifiedAt: { type: Date },
    },
    // Join-welcome email config, set from Manage Organization. There is no
    // on/off switch — a welcome email always goes out; this only decides which
    // template renders it.
    //
    // `templateId` is a Network Mail template id, or "__default__" (also the
    // unset case) for the built-in layout in `services/welcomeEmail.ts`.
    // `templateHtml` is the frontend's rendered snapshot of that template,
    // merge tags still in place: Network Mail authenticates with the browser's
    // JWT, so this API cannot fetch the template at send time.
    welcomeEmail: {
      templateId: { type: String, trim: true },
      templateName: { type: String, trim: true },
      templateHtml: { type: String },
      syncedAt: { type: Date },
    },
    // Origin tag. Set to "nc_affiliate_store" by garage-store-backend when it
    // auto-provisions an org for an NC affiliate opening a storefront. The
    // "Your Offices" picker filters these out so a seller's storefront org
    // doesn't leak into the main app's office switcher. Legacy orgs without
    // this field are treated as garagenew-native and always shown.
    source: { type: String, index: true },
    /**
     * 30-day grace programme (routes/platformOffices.ts).
     *
     * Present ONLY on offices created through the platform bypass, where the
     * founder had no Unilevel Plus licence at creation time. Absent on every
     * office created before this existed and on everything created through the
     * normal flow — including GARAGE HQ — so no existing read is affected.
     *
     * Deliberately NOT a status field: lock state is DERIVED from
     * `expiresAt` + whether the founder now holds a licence
     * (services/officeGrace.ts#graceStatusFor), so there is no stored flag to
     * go stale and no cron to miss a day.
     */
    graceProgram: {
      platformId: { type: Schema.Types.ObjectId, ref: "ThirdPartyClient" },
      platformName: { type: String },
      startedAt: { type: Date },
      expiresAt: { type: Date, index: true },
      createdByUserId: { type: Schema.Types.ObjectId, ref: "User" },
    },
    // Per-org platform fee override. When unset, distributions fall back to
    // the global default (5%). When set, this value (0–50) is used for every
    // commission distribution where this org is the seller.
    paymentConfig: {
      platformFeePercentage: { type: Number, min: 0, max: 50 },
      platformFeeUpdatedAt: { type: Date },
      platformFeeUpdatedBy: {
        type: Schema.Types.ObjectId,
        ref: "GarageAdmin",
      },
    },
    // Garage admin responsible for this org — set by the super-admin via
    // POST /garage-admin/organizations/:id/assign-admin. Powers the
    // "Assigned To" column on the garage-admin companies table. Null
    // when nobody's been assigned yet.
    assignedAdminId: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
      index: true,
    },
    assignedAt: { type: Date },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "GarageAdmin",
    },
    // Custom app domains (white-label) - allows org to use their own domain
    customAppDomains: [
      {
        domain: { type: String, required: true }, // e.g., "app.ddbots.com" or "ddbots.com"
        // "app" = the office UI, "shop" = the storefront on shop.<domain>,
        // "event" = one event's public page, "cryptobrand" = the MyCryptoBrand
        // investor site. App, shop and cryptobrand are different Vercel
        // projects, so the kind decides where the domain gets attached; event
        // rides the app project because /e/<slug> is a route inside it.
        kind: { type: String, enum: ["app", "shop", "event", "cryptobrand", "otc"], default: "app" },
        verified: { type: Boolean, default: false },
        verifiedAt: { type: Date },
        sslProvisioned: { type: Boolean, default: false },
        sslProvisionedAt: { type: Date },
        isPrimary: { type: Boolean, default: false }, // Primary domain for this org
        createdAt: { type: Date, default: Date.now },
        dnsRecords: [
          {
            type: { type: String }, // "CNAME", "A", "TXT"
            name: { type: String },
            value: { type: String },
            verified: { type: Boolean, default: false },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

// Index for store slug lookups
OrganizationSchema.index({ "store.slug": 1 }, { sparse: true });

// Pre-save hook to auto-generate slug from name if not provided
OrganizationSchema.pre("save", async function (next) {
  if (!this.slug && this.name) {
    let baseSlug = generateSlug(this.name);
    let slug = baseSlug;
    let counter = 1;

    // Check for uniqueness and append counter if needed
    const Organization = model("Organization");
    while (await Organization.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    this.slug = slug;
  }
  next();
});

// Only mirror non-parent organizations — these are the office HQs that show
// up in the catalog. Parent orgs are administrative-only.
installCatalogHooks(OrganizationSchema, "office", {
  isCatalogDoc: (doc: any) => doc?.parent !== true,
});

export const Organization = model("Organization", OrganizationSchema);
export { generateSlug };
