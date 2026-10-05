// src/routes/magicLink.ts
//
// Shareable NetworkChain offer links: my.garage.app/magic-link/<token>
//
//   POST /magic-link              requireAuth  — mint a link and email it
//   GET  /magic-link/:token       public       — live quote for the page
//   POST /magic-link/:token/checkout  public   — mint the invoice, hand off
//
// The GET and checkout are PUBLIC by design, matching how /invoice/<id> already
// works: the token is enough to see a price, but paying is gated separately by
// the email OTP the invoice page enforces against `customerEmail`. Minting an
// unpaid invoice for someone is harmless; collecting money from them is not,
// and that half is untouched.
//
// Nothing about price is stored on the link. Every read re-quotes through
// services/comboCheckout.ts, so a link emailed while the 24-hour offer window
// was open automatically shows normal prices once it lapses.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth } from "../middleware/auth";
import { env } from "../config/env";
import { User } from "../models/user.model";
import { Invoice } from "../models/invoice.model";
import { ThirdPartyClient } from "../models/thirdPartyClient.model";
import {
  MagicLink,
  generateMagicLinkToken,
} from "../models/magicLink.model";
import {
  quoteComboCheckout,
  quoteAllPlans,
  createComboCheckoutInvoice,
  ComboCheckoutError,
  ComboQuote,
} from "../services/comboCheckout";
import { activateComboFreeFirstMonth } from "../services/comboActivation";
import { sendMail, offerMagicLinkTemplate, EMAIL_FROM_NOTIFICATION, senderForHost } from "../services/mailer";
import {
  sendMagicLinkWhatsapp,
  elevenZaMagicLinkConfigured,
} from "../services/elevenZaWhatsapp";

const router = Router();

/** How many links one user may mint per hour. Blunt anti-spam backstop. */
const CREATE_RATE_LIMIT_PER_HOUR = 30;

function linkUrl(token: string): string {
  const base = (env.FRONTEND_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/magic-link/${token}`;
}

/**
 * `asha@gmail.com` → `a***@gmail.com`.
 *
 * The page is on a public URL, so it shows enough for the recipient to
 * recognise the offer is theirs without publishing their address to anyone the
 * link gets forwarded to.
 */
function maskEmail(email?: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split("@");
  if (!domain) return null;
  return `${local.slice(0, 1)}***@${domain}`;
}

/** Shape the quote for public consumption — no internals leak. */
function publicQuote(q: ComboQuote) {
  return {
    kind: q.kind,
    termMonths: q.termMonths,
    planLabel: q.planLabel,
    clientName: q.clientName,
    freeMonth: q.freeMonth,
    includesLicence: q.includesLicence,
    licenceUsd: q.licenceUsd,
    subUsd: q.subUsd,
    cartUsd: q.cartUsd,
    monthsOfAccess: q.monthsOfAccess,
    currency: q.currency,
  };
}

/**
 * Has this user already got what the link was selling?
 *
 * Read-time detection rather than a hook inside fulfillInvoice: self-healing,
 * and it keeps the billing path free of extra coupling. A live chain means a
 * root invoice that is paid, uncancelled and still covering today.
 */
async function hasLiveSubscription(
  userId: Types.ObjectId,
  thirdPartyClientId: Types.ObjectId
): Promise<{ live: boolean; invoiceId?: Types.ObjectId }> {
  const root = await Invoice.findOne({
    userId,
    thirdPartyClientId,
    parentInvoiceId: { $exists: false },
    status: "paid",
    cancelledAt: null,
    nextDueDate: { $gt: new Date() },
  })
    .select({ _id: 1 })
    .lean();
  return { live: !!root, invoiceId: root?._id };
}

/**
 * POST /magic-link
 *
 * Body: { userId, thirdPartyClientId, termMonths?, sendEmail? }
 *
 * Any logged-in user may mint one. `createdByUserId` is recorded and creation
 * is rate-limited, because this endpoint can send mail to an address the caller
 * doesn't own.
 */
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const me = (req as any).user as { userId: string };

    const schema = z.object({
      userId: z.string().min(1),
      thirdPartyClientId: z.string().min(1),
      termMonths: z.number().int().min(1).max(60).optional(),
      sendEmail: z.boolean().optional(),
    });
    const body = schema.parse(req.body);
    // Omitting termMonths mints a CATALOG link — every active term on one page,
    // recipient picks. That is what the automatic sign-up email sends.
    const termMonths = body.termMonths;

    if (
      !Types.ObjectId.isValid(body.userId) ||
      !Types.ObjectId.isValid(body.thirdPartyClientId)
    ) {
      return res
        .status(400)
        .json({ success: false, error: "invalid_id", message: "Malformed id" });
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await MagicLink.countDocuments({
      createdByUserId: new Types.ObjectId(me.userId),
      createdAt: { $gte: since },
    });
    if (recent >= CREATE_RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({
        success: false,
        error: "rate_limited",
        message: `You can create at most ${CREATE_RATE_LIMIT_PER_HOUR} offer links per hour.`,
      });
    }

    const target = await User.findById(body.userId)
      // phone/phoneVerified drive the WhatsApp copy of the link below.
      .select("email name phone phoneVerified")
      .lean();
    if (!target) {
      return res
        .status(404)
        .json({ success: false, error: "user_not_found", message: "User not found" });
    }

    const client = await ThirdPartyClient.findById(body.thirdPartyClientId);
    if (!client || !client.isActive || !client.productConfig?.recurringPeriod) {
      return res.status(404).json({
        success: false,
        error: "client_not_eligible",
        message:
          "Third-party client is missing, inactive, or not subscription-enabled.",
      });
    }

    // Quote now purely to VALIDATE something is sellable and to populate the
    // email. The link stores none of it — the page re-quotes on every load.
    const quotes = termMonths
      ? [await quoteComboCheckout({ userId: body.userId, client, termMonths })]
      : await quoteAllPlans({ userId: body.userId, client });
    if (!quotes.length) {
      return res.status(404).json({
        success: false,
        error: "no_sellable_plans",
        message: "No subscription terms are currently available.",
      });
    }
    // Headline the cheapest entry point — "from $25" reads better than the
    // arbitrary first term, and for a single-plan link it IS the plan.
    const headline = quotes.reduce((a, b) => (b.cartUsd < a.cartUsd ? b : a));

    // Re-send rather than pile up tokens for the same offer. `termMonths:
    // undefined` would be STRIPPED from the query by Mongoose and match any
    // link for this user, so a catalog link has to ask for its absence
    // explicitly — otherwise re-sending would hand back a single-plan token.
    let link = await MagicLink.findOne({
      userId: new Types.ObjectId(body.userId),
      thirdPartyClientId: client._id,
      status: "active",
      ...(termMonths ? { termMonths } : { termMonths: { $exists: false } }),
    });
    if (!link) {
      link = await MagicLink.create({
        token: generateMagicLinkToken(),
        userId: new Types.ObjectId(body.userId),
        thirdPartyClientId: client._id,
        ...(termMonths ? { termMonths } : {}),
        createdByUserId: new Types.ObjectId(me.userId),
      });
    }

    const url = linkUrl(link.token);

    let emailed = false;
    if (body.sendEmail !== false && target.email) {
      try {
        const sender = await User.findById(me.userId).select("name").lean();
        const tpl = offerMagicLinkTemplate({
          recipientName: target.name,
          senderName: sender?.name,
          clientName: headline.clientName,
          planLabel: headline.planLabel,
          cartUsd: headline.cartUsd,
          freeMonth: headline.freeMonth,
          monthsOfAccess: headline.monthsOfAccess,
          offerExpiresAt: headline.window.expiresAt,
          // Catalog links say "plans from $X"; single-plan links quote the plan.
          catalog: !termMonths,
          planCount: quotes.length,
          plans: quotes.map((q) => ({
            planLabel: q.planLabel,
            cartUsd: q.cartUsd,
            monthsOfAccess: q.monthsOfAccess,
            freeMonth: q.freeMonth,
            includesLicence: q.includesLicence,
            licenceUsd: q.licenceUsd,
            renewalUsd: q.renewalUsd,
            renewalMonths: q.termMonths,
          })),
          includesLicence: headline.includesLicence,
          licenceUsd: headline.licenceUsd,
          renewalUsd: headline.renewalUsd,
          renewalMonths: headline.termMonths,
          link: url,
        });
        await sendMail(
          target.email,
          tpl.subject,
          tpl.html,
          tpl.text,
          // No org on a magic link — it sells a third-party plan — so the
          // sender follows the site the founder created it from.
          await senderForHost(req)
        );
        emailed = true;
        link.emailSentAt = new Date();
        await link.save();
      } catch (mailErr: any) {
        // A failed send must not lose the link — the caller still gets the URL
        // and can deliver it another way.
        console.error("[MagicLink] email send failed:", mailErr?.message || mailErr);
      }
    }

    /**
     * Same link over WhatsApp.
     *
     * Independent of the email on purpose: these are two deliveries of one
     * link, and a WhatsApp failure must not cost the recipient an email that
     * already went (or vice versa). The link itself is never lost either way —
     * the caller gets the URL back in this response.
     *
     * Only to a verified number. An unverified one is user-entered and may
     * belong to someone else entirely, and this message quotes a price and a
     * personal deadline.
     */
    let whatsapped = false;
    const targetPhone = (target as any).phone as string | undefined;
    if (
      body.sendEmail !== false &&
      targetPhone &&
      (target as any).phoneVerified &&
      elevenZaMagicLinkConfigured()
    ) {
      try {
        const sender = await User.findById(me.userId).select("name").lean();
        // Mirrors the email's own wording so the two can't disagree.
        const price =
          headline.cartUsd === 0
            ? "free"
            : `${termMonths ? "" : "from "}$${headline.cartUsd}`;
        const headingLine = termMonths
          ? headline.planLabel
          : `${quotes.length} plan${quotes.length === 1 ? "" : "s"} to choose from`;

        await sendMagicLinkWhatsapp({
          phone: targetPhone,
          recipientName: target.name,
          senderName: sender?.name,
          clientName: headline.clientName,
          headingLine,
          price,
          offerExpiresAt: headline.window.expiresAt,
          freeMonth: headline.freeMonth,
          link: url,
        });
        whatsapped = true;
        link.whatsappSentAt = new Date();
        await link.save();
      } catch (waErr: any) {
        console.error(
          "[MagicLink] whatsapp send failed:",
          waErr?.message || waErr
        );
      }
    }

    return res.json({
      success: true,
      token: link.token,
      url,
      emailed,
      whatsapped,
      recipient: { name: target.name, emailMasked: maskEmail(target.email) },
      mode: termMonths ? "single" : "catalog",
      plans: quotes.map(publicQuote),
      quote: publicQuote(headline),
      offer: {
        open: headline.window.open,
        expiresAt: headline.window.expiresAt,
        secondsRemaining: headline.window.secondsRemaining,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        details: error.issues,
      });
    }
    if (error instanceof ComboCheckoutError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
    console.error("[MagicLink] create failed:", error);
    return res.status(500).json({
      success: false,
      error: "magic_link_create_failed",
      message: error?.message || "Failed to create offer link",
    });
  }
});

/**
 * GET /magic-link/:token — public.
 *
 * Everything is computed live. Nothing is read back from creation time, so a
 * link opened after the offer window lapses quotes normal prices.
 */
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const link = await MagicLink.findOne({ token: req.params.token });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, status: "not_found", error: "link_not_found" });
    }
    if (link.status === "revoked") {
      return res.json({ success: true, status: "revoked" });
    }

    const [target, client] = await Promise.all([
      User.findById(link.userId).select("email name").lean(),
      ThirdPartyClient.findById(link.thirdPartyClientId),
    ]);
    if (!target || !client?.productConfig) {
      return res
        .status(404)
        .json({ success: false, status: "not_found", error: "link_target_missing" });
    }

    // Access counters are best-effort telemetry; never fail the read for them.
    MagicLink.updateOne(
      { _id: link._id },
      { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } }
    ).catch(() => {});

    const recipient = {
      name: target.name || null,
      emailMasked: maskEmail(target.email),
    };

    // Already bought? Say so instead of quoting a price they can't use.
    const { live, invoiceId } = await hasLiveSubscription(
      link.userId,
      link.thirdPartyClientId
    );
    if (live) {
      if (link.status !== "consumed") {
        await MagicLink.updateOne(
          { _id: link._id },
          {
            $set: {
              status: "consumed",
              consumedAt: new Date(),
              ...(invoiceId ? { consumedInvoiceId: invoiceId } : {}),
            },
          }
        ).catch(() => {});
      }
      return res.json({
        success: true,
        status: "purchased",
        recipient,
        plan: { termMonths: link.termMonths, clientName: client.name },
      });
    }

    // Catalog link (no termMonths) → price every active term and let the page
    // render a picker. Single-plan link → exactly the one it was created with.
    const quotes = link.termMonths
      ? [
          await quoteComboCheckout({
            userId: link.userId.toString(),
            client,
            termMonths: link.termMonths,
          }),
        ]
      : await quoteAllPlans({ userId: link.userId.toString(), client });

    if (!quotes.length) {
      return res.status(404).json({
        success: false,
        error: "no_sellable_plans",
        message: "No subscription terms are currently available.",
      });
    }

    // Every quote shares the same user, so the window is identical across them.
    const w = quotes[0].window;

    return res.json({
      success: true,
      status: "active",
      mode: link.termMonths ? "single" : "catalog",
      recipient,
      plan: {
        termMonths: quotes[0].termMonths,
        label: quotes[0].planLabel,
        clientName: quotes[0].clientName,
        productCode: quotes[0].productCode,
      },
      offer: {
        open: w.open,
        startsAt: w.startsAt,
        expiresAt: w.expiresAt,
        secondsRemaining: w.secondsRemaining,
        windowHours: w.windowHours,
      },
      // Always an array. A single-plan link returns one entry, so the page has
      // one shape to render rather than two.
      plans: quotes.map(publicQuote),
      // Kept for single-plan clients written before catalog mode existed.
      quote: publicQuote(quotes[0]),
    });
  } catch (error: any) {
    if (error instanceof ComboCheckoutError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
    console.error("[MagicLink] read failed:", error);
    return res.status(500).json({
      success: false,
      error: "magic_link_read_failed",
      message: error?.message || "Failed to load offer",
    });
  }
});

/**
 * POST /magic-link/:token/checkout — public.
 *
 * Re-quotes, then either activates a free claim outright or mints the invoice
 * and hands the caller the existing public pay URL. Safe to call unauthenticated
 * for the same reason the GET is: an unpaid invoice grants nothing, and payment
 * is still gated by OTP to the buyer's own email.
 */
router.post("/:token/checkout", async (req: Request, res: Response) => {
  try {
    const link = await MagicLink.findOne({ token: req.params.token });
    if (!link) {
      return res
        .status(404)
        .json({ success: false, error: "link_not_found" });
    }
    if (link.status === "revoked") {
      return res.status(409).json({ success: false, error: "link_revoked" });
    }

    const client = await ThirdPartyClient.findById(link.thirdPartyClientId);
    if (!client || !client.isActive || !client.productConfig?.recurringPeriod) {
      return res
        .status(404)
        .json({ success: false, error: "client_not_eligible" });
    }

    const { live } = await hasLiveSubscription(
      link.userId,
      link.thirdPartyClientId
    );
    if (live) {
      return res.status(409).json({
        success: false,
        error: "already_subscribed",
        message: `You already have an active ${client.name} subscription.`,
      });
    }

    // A catalog link carries no plan, so the buyer's choice arrives here. A
    // single-plan link ignores the body entirely — otherwise anyone could post
    // a different term and buy something the link never offered.
    const bodySchema = z.object({
      termMonths: z.number().int().min(1).max(60).optional(),
    });
    const body = bodySchema.parse(req.body || {});
    const termMonths = link.termMonths ?? body.termMonths;
    if (!termMonths) {
      return res.status(400).json({
        success: false,
        error: "term_required",
        message: "Choose a plan before continuing.",
      });
    }

    const userId = link.userId.toString();
    const quote = await quoteComboCheckout({
      userId,
      client,
      termMonths,
    });

    // Nothing to charge: an existing licence holder claiming their free month.
    // Activate directly rather than minting a $0 invoice for them to "pay".
    if (quote.kind === "free_claim") {
      const upInvoice = await Invoice.findOne({
        userId: link.userId,
        "lineItems.itemType": "unilevel_plus",
        status: "paid",
      })
        .sort({ paidAt: -1 })
        .select({ _id: 1 })
        .lean();

      const result = await activateComboFreeFirstMonth({
        buyerId: userId,
        clientId: link.thirdPartyClientId.toString(),
        productCode: client.productConfig.productCode,
        triggerInvoiceId: upInvoice
          ? upInvoice._id.toString()
          : `magic_link_${link.token}`,
        nextTermMonths: termMonths > 1 ? termMonths : undefined,
      });

      await MagicLink.updateOne(
        { _id: link._id },
        {
          $set: {
            status: "consumed",
            consumedAt: new Date(),
            consumedInvoiceId: result.invoice._id,
          },
        }
      ).catch(() => {});

      return res.json({
        success: true,
        activated: true,
        payUrl: null,
        message: "Your free month is active — nothing to pay.",
        quote: publicQuote(quote),
      });
    }

    const { invoice, reused } = await createComboCheckoutInvoice({
      userId,
      client,
      termMonths,
    });

    return res.json({
      success: true,
      activated: false,
      reused,
      invoiceId: invoice._id.toString(),
      invoiceNumber: invoice.invoiceNumber,
      // Relative so the FE can push it without knowing the host.
      payUrl: `/invoice/${invoice._id.toString()}`,
      quote: publicQuote(quote),
    });
  } catch (error: any) {
    if (error instanceof ComboCheckoutError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.code,
        message: error.message,
      });
    }
    const status =
      typeof error?.statusCode === "number" ? error.statusCode : 500;
    console.error("[MagicLink] checkout failed:", error);
    return res.status(status).json({
      success: false,
      error: error?.code || "magic_link_checkout_failed",
      message: error?.message || "Failed to start checkout",
    });
  }
});

export default router;
