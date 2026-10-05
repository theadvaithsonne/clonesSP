import {
  createComponent,
  makeId,
  serializeColumns,
  type ComponentBlock,
  type ColumnData,
} from "./block-factory";
import { FOOTER_PRESETS, serializeFooterLinks } from "./footer-block";
import { sortComponentsWithPreheaderFirst } from "./preheader-block";

export type EmailTemplatePresetId =
  | "welcome"
  | "newsletter"
  | "promotional"
  | "transactional"
  | "order-confirmation"
  | "org-welcome";

export interface EmailTemplatePreset {
  id: EmailTemplatePresetId;
  name: string;
  description: string;
  /** CSS gradient for thumbnail preview */
  thumbnailGradient: string;
}

function patch(
  block: ComponentBlock,
  content: Partial<Record<string, string>> = {},
  styles: Partial<Record<string, string>> = {},
): ComponentBlock {
  return {
    ...block,
    content: { ...block.content, ...content },
    styles: { ...block.styles, ...styles },
  };
}

function textBlock(html: string, align: "left" | "center" = "left"): ComponentBlock {
  const plain = html.replace(/<[^>]+>/g, "");
  return patch(createComponent("text"), { html, plainText: plain }, { textAlign: align });
}

function headingBlock(text: string, level = "2", align: "left" | "center" = "center"): ComponentBlock {
  const size = level === "3" ? "22" : level === "4" ? "18" : "30";
  return patch(
    createComponent("heading"),
    { text, level },
    { fontSize: size, textAlign: align, marginBottom: "12" },
  );
}

function articleColumns(bodyHtml: string, imageAlt: string): ComponentBlock {
  const text = textBlock(bodyHtml, "left");
  const image = patch(
    createComponent("image"),
    { alt: imageAlt },
    { width: "260", paddingTop: "0", paddingBottom: "0" },
  );
  const cols: ColumnData[] = [
    { id: makeId(), width: 58, components: [text] },
    { id: makeId(), width: 42, components: [image] },
  ];
  return patch(
    createComponent("columns"),
    { columns: serializeColumns(cols) },
    {
      gap: "20",
      paddingTop: "8",
      paddingBottom: "8",
      paddingLeft: "20",
      paddingRight: "20",
      stackOnMobile: "true",
    },
  );
}

function buildWelcomeEmail(): ComponentBlock[] {
  return [
    patch(createComponent("logo"), {}, { align: "center", paddingTop: "32", paddingBottom: "16" }),
    headingBlock("Welcome to [Company]!", "2", "center"),
    textBlock(
      "<p>Hi {{first_name}},</p><p>We're thrilled to have you on board. Your account is ready — explore everything we have to offer and get started in just a few clicks.</p>",
      "center",
    ),
    patch(
      createComponent("image"),
      { alt: "Welcome hero image" },
      {
        width: "552",
        borderRadius: "8",
        paddingTop: "8",
        paddingBottom: "16",
        align: "center",
      },
    ),
    patch(
      createComponent("button"),
      { text: "Get Started", url: "https://yourcompany.com/get-started" },
      { align: "center", marginTop: "8", marginBottom: "24" },
    ),
    patch(createComponent("footer"), { includeSocialIcons: "true" }, {}),
  ];
}

function buildNewsletterEmail(): ComponentBlock[] {
  return [
    patch(createComponent("preheader"), {
      text: "This week's top stories and updates — read inside →",
    }),
    patch(createComponent("logo"), {}, { paddingTop: "20", paddingBottom: "12" }),
    headingBlock("The Weekly Newsletter", "2", "center"),
    textBlock(
      "<p>Hello {{first_name}},</p><p>Here's what's new this week. We've curated the best articles, tips, and updates just for you.</p>",
    ),
    createComponent("divider"),
    headingBlock("Article 1: Getting Started", "3", "left"),
    articleColumns(
      "<p>Learn the fundamentals and set yourself up for success. Our step-by-step guide walks you through everything you need to know in under 10 minutes.</p><p><strong>Read more →</strong></p>",
      "Article 1 image",
    ),
    createComponent("divider"),
    headingBlock("Article 2: Pro Tips & Tricks", "3", "left"),
    articleColumns(
      "<p>Take your skills to the next level with expert advice from our team. Discover shortcuts and strategies used by top performers.</p><p><strong>Read more →</strong></p>",
      "Article 2 image",
    ),
    patch(createComponent("socialIcons"), {}, { paddingTop: "16", paddingBottom: "8" }),
    createComponent("footer"),
  ];
}

function buildPromotionalEmail(): ComponentBlock[] {
  return [
    patch(createComponent("logo"), {}, { paddingTop: "24", paddingBottom: "8" }),
    headingBlock("Limited Time Offer!", "2", "center"),
    patch(
      createComponent("image"),
      { alt: "Featured product" },
      { width: "400", align: "center", paddingTop: "8", paddingBottom: "16" },
    ),
    headingBlock("Save 30% Today", "3", "center"),
    textBlock(
      "<p>Don't miss out on our biggest sale of the season. Use code <strong>SAVE30</strong> at checkout. Offer ends Sunday at midnight.</p>",
      "center",
    ),
    patch(
      createComponent("button"),
      { text: "Shop Now", url: "https://yourcompany.com/shop" },
      { backgroundColor: "#DC2626", borderColor: "#DC2626", align: "center", marginBottom: "20" },
    ),
    createComponent("divider"),
    patch(
      textBlock(
        "<p style='font-size:12px;color:#6B7280;'>Terms &amp; conditions: Offer valid while supplies last. Cannot be combined with other promotions. See website for full details.</p>",
        "center",
      ),
      {},
      { fontSize: "12", color: "#6B7280", paddingTop: "8", paddingBottom: "24" },
    ),
    createComponent("footer"),
  ];
}

function buildTransactionalEmail(): ComponentBlock[] {
  const minimalFooter = FOOTER_PRESETS.minimal;
  return [
    patch(createComponent("logo"), {}, { paddingTop: "24", paddingBottom: "12" }),
    headingBlock("Order Confirmation", "2", "center"),
    textBlock(
      "<p>Hi {{first_name}},</p><p>Thank you for your order! We've received it and will send you a shipping confirmation as soon as your items are on their way.</p>",
    ),
    createComponent("divider"),
    patch(
      textBlock(
        "<p><strong>Order #:</strong> {{order_number}}<br/><strong>Date:</strong> {{order_date}}<br/><strong>Total:</strong> {{order_total}}</p><p>{{order_items}}</p>",
      ),
      {},
      {
        backgroundColor: "#F9FAFB",
        paddingTop: "16",
        paddingBottom: "16",
        paddingLeft: "20",
        paddingRight: "20",
      },
    ),
    patch(
      createComponent("button"),
      { text: "View Order", url: "{{order_url}}" },
      { align: "center", marginTop: "8", marginBottom: "24" },
    ),
    patch(createComponent("footer"), minimalFooter.content, {
      ...createComponent("footer").styles,
      ...minimalFooter.styles,
      paddingTop: "24",
      paddingBottom: "24",
    }),
  ];
}

/**
 * Garage default for digital-product order alerts. Mirrors the design signed off
 * in `Deafulat.Html` — hero banner, confirmation heading, order summary panel on
 * a grey card, and a two-up CTA row that stacks on mobile.
 *
 * Three deliberate departures from that file: the CTAs there were left on
 * `href="#"`, and the footer company name used single braces (`{Your Company}`),
 * which no merge engine substitutes — both are wired to real merge tags here.
 *
 * The third is the header. The original was a flat PNG with the words
 * "Thank you for ordering from {company name}" painted into it, so every buyer
 * of every seller received that literal placeholder alongside Garage's logo
 * rather than the seller's name. It is rebuilt as real HTML below so it renders
 * the actual business name.
 */
export const ORDER_CONFIRMATION_BANNER_URL =
  "https://nela-app.s3.us-east-1.amazonaws.com/network-mail/miQW7D60qk/6a76d827c28044471c005a7b/image/1786177350240-garage-order-confirmation-banner-600px__1_.png";

/** Header band recreating the banner artwork, with a live business name. */
function orderConfirmationHeader(): ComponentBlock {
  return patch(
    textBlock(
      '<p style="margin:0;font-size:22px;line-height:1.35;font-weight:700;color:#18181b;">' +
        "Thank you for ordering from {{business_name}}</p>" +
        '<p style="margin:14px 0 0 0;width:56px;border-top:3px solid #f5c518;font-size:0;line-height:0;">&nbsp;</p>' +
        '<p style="margin:14px 0 0 0;font-size:14px;line-height:1.5;color:#6B7280;">Your order is confirmed</p>',
      "left",
    ),
    {},
    {
      backgroundColor: "#F3F1EC",
      paddingTop: "36",
      paddingRight: "32",
      paddingBottom: "36",
      paddingLeft: "32",
    },
  );
}

function buildOrderConfirmationEmail(): ComponentBlock[] {
  const ctaStyles = {
    variant: "filled",
    backgroundColor: "var(--brand)",
    color: "#ffffff",
    borderColor: "var(--brand)",
    borderWidth: "2",
    fontSize: "12",
    fontWeight: "600",
    paddingX: "32",
    paddingY: "14",
    borderRadius: "8",
    align: "center",
    marginTop: "12",
    marginRight: "0",
    marginBottom: "12",
    marginLeft: "0",
  };

  const ctaColumns: ColumnData[] = [
    {
      id: makeId(),
      width: 50,
      components: [
        patch(
          createComponent("button"),
          { text: "View Order", url: "{{order_url}}", openInNewTab: "true" },
          ctaStyles,
        ),
      ],
    },
    {
      id: makeId(),
      width: 50,
      components: [
        patch(
          createComponent("button"),
          { text: "View Invoice", url: "{{invoice_url}}", openInNewTab: "true" },
          ctaStyles,
        ),
      ],
    },
  ];

  return [
    // Logo sits on its own dark band, mirroring the left panel of the original
    // artwork. Empty by default so the founder drops their own logo in — the
    // baked-in Garage mark was wrong on a seller's own order confirmation.
    patch(
      createComponent("logo"),
      { alt: "", fallbackText: "" },
      {
        align: "left",
        width: "150",
        backgroundColor: "#18181B",
        paddingTop: "28",
        paddingBottom: "28",
        paddingX: "32",
      },
    ),
    orderConfirmationHeader(),
    patch(
      createComponent("heading"),
      { text: "Order Confirmed!", level: "2" },
      {
        fontSize: "25",
        color: "#000000",
        fontWeight: "600",
        textAlign: "center",
        lineHeight: "1.3",
        marginTop: "0",
        marginBottom: "12",
        paddingTop: "16",
        paddingRight: "16",
        paddingBottom: "16",
        paddingLeft: "16",
      },
    ),
    textBlock(
      "Hi {{first_name}},<br><br>Thank you for your order! Your purchase is confirmed and ready to access — " +
        "open your order any time using the button below.<br>" +
        "If you have any questions, just contact us at {{support_option}}.<br><br>" +
        "Thanks again,<br>{{business_name}}",
    ),
    createComponent("divider"),
    patch(
      textBlock(
        "Order Id: {{order_number}}<br>Date: {{order_date}}<br>Total: {{order_total}}<br><br>{{order_items}}",
      ),
      {},
      {
        backgroundColor: "#F9FAFB",
        paddingTop: "16",
        paddingRight: "20",
        paddingBottom: "16",
        paddingLeft: "20",
      },
    ),
    patch(
      createComponent("columns"),
      { columns: serializeColumns(ctaColumns) },
      {
        gap: "16",
        paddingTop: "0",
        paddingRight: "0",
        paddingBottom: "0",
        paddingLeft: "0",
        stackOnMobile: "true",
      },
    ),
    patch(
      createComponent("footer"),
      {
        companyName: "{{business_name}}",
        showPhysicalAddress: "false",
        phone: "",
        contactEmail: "",
        copyrightText: "Powered by garage.",
        includeSocialIcons: "false",
        links: serializeFooterLinks([
          {
            id: makeId(),
            text: "Unsubscribe",
            url: "{{unsubscribe_url}}",
            type: "unsubscribe",
            visible: true,
          },
        ]),
      },
      {},
    ),
  ];
}

/**
 * Garage default for the email a member receives when they join an
 * organization. Mirrors the hardcoded layout in
 * `garagenew-backend/src/services/welcomeEmail.ts` — yellow header band, the
 * HQ detail card, a "Welcome to Garage" section and a CTA into the office —
 * so the founder previews what actually lands in the member's inbox.
 *
 * Two deliberate departures from that file:
 *  - Every band carries its own `backgroundColor`. The export wraps blocks in a
 *    white 600px table, so a dark template has to paint each row itself.
 *  - The CTA is a text block with an inline anchor rather than a button block.
 *    `renderButtonEmail` puts no background on its row, which would leave a
 *    white gap across a dark email.
 */
const ORG_WELCOME_SURFACE = "#1E1E2D";
const ORG_WELCOME_CARD = "#262638";
const ORG_WELCOME_ACCENT = "#FBD10D";

function orgWelcomeText(
  html: string,
  styles: Partial<Record<string, string>> = {},
): ComponentBlock {
  return patch(textBlock(html), {}, {
    backgroundColor: ORG_WELCOME_SURFACE,
    color: "#BDBDBD",
    fontSize: "15",
    paddingTop: "8",
    paddingBottom: "8",
    paddingLeft: "30",
    paddingRight: "30",
    ...styles,
  });
}

function buildOrgWelcomeEmail(): ComponentBlock[] {
  return [
    // Header band. The logo carries `{{org_icon}}`; the backend drops the
    // <img> entirely when the org has no icon, so an empty tag never ships.
    patch(
      createComponent("logo"),
      { src: "{{org_icon}}", alt: "{{org_name}}", fallbackText: "" },
      {
        align: "center",
        width: "56",
        borderRadius: "12",
        backgroundColor: ORG_WELCOME_ACCENT,
        paddingTop: "36",
        paddingBottom: "12",
        paddingX: "30",
      },
    ),
    patch(
      createComponent("heading"),
      { text: "Congratulations!", level: "1" },
      {
        fontSize: "28",
        color: "#0C0C0E",
        fontWeight: "700",
        textAlign: "center",
        backgroundColor: ORG_WELCOME_ACCENT,
        paddingTop: "0",
        paddingBottom: "0",
        paddingLeft: "30",
        paddingRight: "30",
        marginBottom: "0",
      },
    ),
    patch(
      textBlock(
        '<p style="margin:0;font-size:15px;color:#0C0C0E;opacity:0.8;">You&rsquo;re now part of {{business_name}}</p>',
        "center",
      ),
      {},
      {
        backgroundColor: ORG_WELCOME_ACCENT,
        paddingTop: "8",
        paddingBottom: "36",
        paddingLeft: "30",
        paddingRight: "30",
      },
    ),

    orgWelcomeText(
      '<p style="margin:0;font-size:16px;color:#EAEAEA;">Hi {{first_name}},</p>',
      { paddingTop: "36", paddingBottom: "16" },
    ),

    // HQ detail card
    patch(
      textBlock(
        '<p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#EAEAEA;">{{org_name}}</p>' +
          '<p style="margin:0 0 6px;font-size:14px;color:#888888;">{{org_location}}</p>' +
          '<p style="margin:0;font-size:14px;line-height:1.5;color:#BDBDBD;">{{org_description}}</p>',
      ),
      {},
      {
        backgroundColor: ORG_WELCOME_CARD,
        paddingTop: "20",
        paddingBottom: "20",
        paddingLeft: "30",
        paddingRight: "30",
      },
    ),

    orgWelcomeText(
      '<p style="margin:0;font-size:18px;font-weight:600;color:#EAEAEA;">Welcome to Garage</p>',
      { paddingTop: "28", paddingBottom: "12" },
    ),
    orgWelcomeText(
      "<p style=\"margin:0 0 16px;\">Garage is your all-in-one collaborative workspace — connect with your community, " +
        "attend live workshops &amp; webinars, access exclusive content, and grow together.</p>" +
        '<p style="margin:0;">Explore your HQ, join conversations, and make the most of everything Garage has to offer.</p>',
    ),

    // CTA — an anchor inside a text block so the row keeps the dark background.
    orgWelcomeText(
      '<p style="margin:0;text-align:center;">' +
        '<a href="{{org_url}}" style="display:inline-block;padding:14px 36px;background-color:#FBD10D;' +
        'color:#0C0C0E;text-decoration:none;border-radius:10px;font-size:16px;font-weight:700;">Explore Garage</a></p>',
      { paddingTop: "28", paddingBottom: "32" },
    ),

    patch(
      createComponent("footer"),
      {
        companyName: "{{business_name}}",
        showPhysicalAddress: "false",
        showUnsubscribe: "false",
        includeSocialIcons: "false",
        phone: "",
        contactEmail: "{{support_option}}",
        disclosureText: "",
        copyrightText: "Powered by Garage",
        links: serializeFooterLinks([]),
      },
      {
        backgroundColor: ORG_WELCOME_SURFACE,
        textColor: "#777777",
        linkColor: ORG_WELCOME_ACCENT,
        borderTopEnabled: "true",
        borderTopColor: "#2a2a3d",
        paddingTop: "24",
        paddingBottom: "32",
      },
    ),
  ];
}

const BUILDERS: Record<EmailTemplatePresetId, () => ComponentBlock[]> = {
  welcome: buildWelcomeEmail,
  newsletter: buildNewsletterEmail,
  promotional: buildPromotionalEmail,
  transactional: buildTransactionalEmail,
  "order-confirmation": buildOrderConfirmationEmail,
  "org-welcome": buildOrgWelcomeEmail,
};

export const EMAIL_TEMPLATE_PRESETS: EmailTemplatePreset[] = [
  {
    id: "welcome",
    name: "Welcome Email",
    description: "Logo, welcome message, hero image, CTA, footer with social",
    thumbnailGradient: "from-violet-500 to-purple-700",
  },
  {
    id: "newsletter",
    name: "Newsletter",
    description: "Pre-header, articles in columns, social icons, footer",
    thumbnailGradient: "from-blue-500 to-indigo-700",
  },
  {
    id: "promotional",
    name: "Promotional",
    description: "Product spotlight, discount, shop CTA, terms",
    thumbnailGradient: "from-rose-500 to-orange-600",
  },
  {
    id: "transactional",
    name: "Transactional",
    description: "Order confirmation with details and minimal footer",
    thumbnailGradient: "from-slate-500 to-slate-700",
  },
  {
    id: "order-confirmation",
    name: "Order Confirmation",
    description: "Garage default — banner, order summary, order + invoice CTAs",
    thumbnailGradient: "from-amber-400 to-yellow-600",
  },
  {
    id: "org-welcome",
    name: "Organization Welcome",
    description: "Garage default — HQ card, welcome message, explore CTA",
    thumbnailGradient: "from-yellow-400 to-amber-600",
  },
];

export function buildEmailTemplatePreset(id: EmailTemplatePresetId): ComponentBlock[] {
  const build = BUILDERS[id];
  if (!build) return [];
  return sortComponentsWithPreheaderFirst(build());
}
