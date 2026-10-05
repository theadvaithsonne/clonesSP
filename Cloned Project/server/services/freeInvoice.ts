/**
 * Zero-value invoices for FREE grants of sellable items.
 *
 * A free purchase is supposed to leave the same paper trail a paid one does —
 * so free customers show up in member lists, "customers" analytics and exports
 * alongside paying ones. Historically the mint was written inline in each
 * `/checkout/*` route, which meant every OTHER way into the same service
 * function granted access silently: ~94% of free workshop registrations in
 * production have no invoice.
 *
 * The fix is this helper plus calls from the SERVICE-level chokepoints
 * (registerForFreeWorkshop, enrollInCourse, addUserToChannel, …) rather than
 * from routes, so a future caller cannot bypass it by construction.
 *
 * Generalised from the proven `mintFreeChannelJoinInvoice` in ./channel.ts,
 * keeping its four properties exactly:
 *   - idempotent per (userId, itemType, itemId, metadataType[, dedupeKey])
 *   - best-effort: never throws into the caller
 *   - mints $0 and forces status "paid"
 *   - skips silently when the user has no email
 */
import { User } from "../models/user.model";
import { createInvoice } from "./invoice";

/** Sellable item types that can be granted for free. */
export type FreeItemType =
  | "workshop"
  | "course"
  | "channel"
  | "product"
  | "service"
  | "call";

/**
 * Which entry point granted this. Purely informational — reports key off
 * `metadata.type`, which deliberately keeps the value each checkout route
 * already wrote so existing queries keep working.
 */
export type FreeInvoiceSource =
  | "checkout"
  | "register"
  | "enroll"
  | "prepare_join"
  | "subscribe"
  | "bundled"
  | "opt_in";

export interface MintFreeItemInvoiceOptions {
  userId: string;
  orgId: string;
  /** The founder/creator who owns the item. */
  sellerId: string;
  itemType: FreeItemType;
  itemId: string;
  itemName: string;
  itemDescription?: string;
  itemImage?: string;
  currency?: string;
  /**
   * Keep the value the corresponding checkout route already writes
   * ("workshop_checkout", "channel_auto_join", …) so existing reports that
   * group by `metadata.type` are unaffected.
   */
  metadataType: string;
  source: FreeInvoiceSource;
  /**
   * Extra idempotency scope. Needed where one user legitimately gets several
   * free grants of the SAME item — per-session recurring workshop enrolment
   * being the real case (pass the session date). Without it the dedupe guard
   * would mint only the first session's invoice.
   */
  dedupeKey?: string;
  /** Merged into metadata alongside type/free/source. */
  extraMetadata?: Record<string, any>;
  /**
   * Send the seller's post-purchase order email for this free grant.
   *
   * Off by default and opted into only at the points where the user
   * deliberately acquired the item (join a community, enrol in a course,
   * register for a live stream, claim a free product). The same mint also runs
   * for auto-joins — the default community on signup, the free communities
   * bundled with a course or product — and an "Order Confirmed" for something
   * nobody asked for is spam, so those keep it off.
   *
   * Only fires on a genuinely new invoice, so a repeat visit re-running an
   * idempotent mint doesn't re-send. `sendOrderEmail` de-dupes again on the
   * invoice itself, and no-ops entirely unless the seller enabled alerts on
   * the item.
   */
  notifyBuyer?: boolean;
  /**
   * ProductOrder backing this grant, when there is one. Only used for the
   * `notifyBuyer` email, whose items block renders the digital delivery links
   * off the order — without it the buyer gets a line naming the product and no
   * way to download it.
   */
  order?: any;
}

/** Item types `services/orderEmail.ts` knows how to render. */
const ORDER_EMAIL_ITEM_TYPES = new Set<FreeItemType>([
  "product",
  "course",
  "channel",
  "workshop",
]);

/**
 * In-process serialisation per (user, itemType, itemId).
 *
 * `createInvoice` reuses any existing draft/pending invoice for the same
 * user+item when the totals match (services/invoice.ts:602-630). Every free
 * invoice is $0, so two of them always "match" — and because mints are
 * backgrounded, two concurrent ones can both reach createInvoice before either
 * has been flipped to "paid", making the second silently reuse the first.
 *
 * That is only wrong where multiple invoices per user+item are legitimate:
 * per-session recurring enrolment, which passes a dedupeKey. Chaining on the
 * key that createInvoice reuses on means the first mint is fully paid before
 * the second starts looking, so no draft is ever visible to reuse.
 *
 * Scoped to this process. A multi-instance race would at worst reuse one
 * invoice — never lose the grant, which is written before the mint regardless.
 */
const mintChains = new Map<string, Promise<unknown>>();

function serialiseByItem<T>(key: string, run: () => Promise<T>): Promise<T> {
  const prev = mintChains.get(key) ?? Promise.resolve();
  const next = prev.then(run, run);
  // Keep the map from growing without bound: drop the entry once this link is
  // the tail and has settled.
  mintChains.set(key, next);
  void next.catch(() => {}).finally(() => {
    if (mintChains.get(key) === next) mintChains.delete(key);
  });
  return next;
}

/**
 * Fire-and-forget wrapper. Use this from the access-granting chokepoints:
 * the invoice is bookkeeping, so it must not sit in the request path and add
 * latency to a user joining a community or registering for a webinar.
 *
 * Returns void immediately. `mintFreeItemInvoice` already swallows its own
 * errors, and the `.catch` here is a belt-and-braces guard so an unexpected
 * rejection can never surface as an unhandled promise.
 *
 * Only await the mint directly when you need the invoice document back in the
 * same request — the checkout routes do, to attach the order-confirmation
 * email. Those callers pass a skip flag so the chokepoint doesn't also mint,
 * which would otherwise race the two and produce duplicates.
 */
export function mintFreeItemInvoiceInBackground(
  opts: MintFreeItemInvoiceOptions,
): void {
  void mintFreeItemInvoice(opts).catch((err) =>
    console.error("[FreeInvoice] background mint rejected:", err),
  );
}

/** What the mint did — lets callers act only on a genuinely new invoice. */
export interface MintFreeItemInvoiceResult {
  /** The new invoice, or the pre-existing one when deduped. Null on skip/error. */
  invoice: any | null;
  /** True only when THIS call created it. */
  created: boolean;
}

/**
 * Mint a `$0 paid` invoice for a free grant. Best-effort: the access row
 * (registration / enrolment / membership / order) is the source of truth and
 * MUST already be written by the caller before this runs — an invoice failure
 * must never cost the user the thing they just claimed.
 *
 * Returns the invoice so callers that hang side effects off it (the order
 * confirmation email in the checkout routes) still can, and `created` so those
 * side effects fire once rather than on every repeat visit.
 */
export function mintFreeItemInvoice(
  opts: MintFreeItemInvoiceOptions,
): Promise<MintFreeItemInvoiceResult> {
  // Serialise on the same key createInvoice reuses drafts on, so concurrent
  // mints for one user+item cannot collapse into a single invoice.
  return serialiseByItem(
    `${opts.userId}:${opts.itemType}:${opts.itemId}`,
    () => mintFreeItemInvoiceUnlocked(opts),
  );
}

async function mintFreeItemInvoiceUnlocked(
  opts: MintFreeItemInvoiceOptions,
): Promise<MintFreeItemInvoiceResult> {
  try {
    const { Invoice } = await import("../models/invoice.model");

    // Idempotency — one free invoice per (user, item, type[, dedupeKey]).
    const dedupeQuery: Record<string, any> = {
      userId: opts.userId,
      "lineItems.itemType": opts.itemType,
      "lineItems.itemId": opts.itemId,
      "metadata.type": opts.metadataType,
    };
    if (opts.dedupeKey) {
      dedupeQuery["metadata.dedupeKey"] = opts.dedupeKey;
    }
    // Not .lean() — callers may need a real document back.
    const existing = await Invoice.findOne(dedupeQuery);
    if (existing) return { invoice: existing, created: false };

    const user = await User.findById(opts.userId)
      .select("email name")
      .lean<{ email?: string; name?: string }>();
    // createInvoice requires customerEmail. Guest-flow users can lack one —
    // they stay uninvoiced rather than blocking the grant.
    if (!user?.email) {
      console.log(
        `[FreeInvoice] Skipping mint — user ${opts.userId} has no email (${opts.itemType} ${opts.itemId})`,
      );
      return { invoice: null, created: false };
    }

    const invoice = await createInvoice({
      organizationId: opts.orgId,
      sellerId: String(opts.sellerId),
      userId: opts.userId,
      customerEmail: user.email,
      customerName: user.name,
      lineItems: [
        {
          itemType: opts.itemType,
          itemId: String(opts.itemId),
          itemName: opts.itemName,
          itemDescription: opts.itemDescription || undefined,
          itemImage: opts.itemImage || undefined,
          quantity: 1,
          unitPrice: 0,
          originalCurrency: opts.currency || "USD",
        },
      ],
      itemCurrency: opts.currency || "USD",
      metadata: {
        ...(opts.extraMetadata || {}),
        type: opts.metadataType,
        free: true,
        source: opts.source,
        ...(opts.dedupeKey ? { dedupeKey: opts.dedupeKey } : {}),
      },
    } as any);

    (invoice as any).status = "paid";
    (invoice as any).paidAt = new Date();
    await (invoice as any).save();

    console.log(
      `[FreeInvoice] $0 invoice minted — user ${opts.userId} ${opts.itemType} ${opts.itemId} (${opts.source})`,
    );

    // Order confirmation for a free acquisition. Paid purchases get theirs from
    // fulfillInvoice(); this branch never reaches it, so without this a founder
    // who turned alerts on sees emails for paying customers and silence for
    // free ones. Fire-and-forget — the grant already stands and a mail failure
    // must not undo the invoice we just wrote.
    // The buyer's invoice for a free acquisition. Gated on `notifyBuyer` —
    // the flag that distinguishes something the user deliberately acquired
    // from a system grant (auto-enrolment, downline seeding, backfills), which
    // must not generate a receipt for a purchase that never happened. NOT
    // gated on ORDER_EMAIL_ITEM_TYPES: that set exists because the seller
    // template needs a loadable item, whereas an invoice renders from the
    // invoice alone.
    if (opts.notifyBuyer) {
      const { queueInvoiceEmail } = await import("./invoiceEmail");
      queueInvoiceEmail(invoice);
    }

    // The founder's "someone joined" alert. Free grants never reach
    // fulfillInvoice(), so without this a founder who turned alerts on would
    // hear about paying customers and nothing about free ones — and for a
    // free community that is every single member.
    //
    // Deliberately NOT gated on `notifyBuyer`. That flag exists to keep a
    // purchase RECEIPT away from someone who never bought anything; the
    // founder asked to be told about every new member, auto-joins included.
    // Gated on `created` instead, so an idempotent re-mint on a repeat visit
    // doesn't re-announce a member who joined weeks ago.
    const { queueFounderAlertForInvoice } = await import("./founderAlertEmail");
    queueFounderAlertForInvoice(invoice);

    if (opts.notifyBuyer && ORDER_EMAIL_ITEM_TYPES.has(opts.itemType)) {
      const { queueOrderEmail } = await import("./orderEmail");
      queueOrderEmail({
        invoice,
        itemType: opts.itemType as any,
        itemId: opts.itemId,
        order: opts.order,
        quantity: 1,
      });
    }

    return { invoice, created: true };
  } catch (err) {
    // Never propagate: the grant already happened and must stand.
    console.error(
      `[FreeInvoice] Mint failed for user ${opts.userId} ${opts.itemType} ${opts.itemId}:`,
      err,
    );
    return { invoice: null, created: false };
  }
}
