import type { Metadata } from "next";
import { InvoicePayPage } from "./InvoicePayPage";

interface PageProps {
  params: Promise<{ invoiceId: string }>;
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.my.garage.app";

// Same-shape excerpt of the BE response we need to build link-preview
// metadata. Only the fields we read here — anything else is ignored.
interface InvoiceMetaResponse {
  success: boolean;
  invoice?: {
    invoiceNumber: string;
    status: string;
    customerName?: string;
    customerEmail?: string;
    totalAmount: number;
    itemCurrency: string;
    expiresAt?: string;
    lineItems?: Array<{ itemName?: string }>;
  };
  fromOrganization?: {
    name?: string;
    icon?: string;
  };
}

function formatAmountForMeta(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 2,
    }).format((amount || 0) / 100);
  } catch {
    return `${currency} ${((amount || 0) / 100).toFixed(2)}`;
  }
}

function formatDueDate(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { invoiceId } = await params;

  let data: InvoiceMetaResponse | null = null;
  try {
    const res = await fetch(`${API_URL}/api/invoices/${invoiceId}`, {
      // Link previews are hit by WhatsApp / Slack / iMessage / etc.
      // scrapers on-demand; server-side cache for a minute keeps the
      // BE from being hammered when a link goes viral.
      next: { revalidate: 60 },
    });
    if (res.ok) {
      data = (await res.json()) as InvoiceMetaResponse;
    }
  } catch {
    // Fetch failed (BE down / network) — fall back to the app default
    // so the link at least doesn't render broken metadata.
  }

  if (!data?.success || !data.invoice) {
    return {
      title: "Invoice — Garage.App",
      description: "Complete your payment securely.",
    };
  }

  const inv = data.invoice;
  const org = data.fromOrganization;

  // Buyer label — prefer the human name; fall back to email local-part;
  // last resort a generic string so we never render "undefined's Invoice".
  const buyer =
    inv.customerName?.trim() ||
    inv.customerEmail?.split("@")[0] ||
    "Your";

  // Business label — the receiver name (who's collecting), with a
  // graceful fall-through if the invoice wasn't scoped to an org.
  const business = org?.name?.trim() || "Garage.App";

  const dueLabel = formatDueDate(inv.expiresAt);
  const title = dueLabel
    ? `${buyer}'s Invoice For ${business} — Due ${dueLabel}`
    : `${buyer}'s Invoice For ${business}`;

  // Description — item + amount + invoice number. Compact enough for
  // WhatsApp's 2-line preview but useful for Slack/email unfurls.
  const itemName = inv.lineItems?.[0]?.itemName?.trim();
  const amount = formatAmountForMeta(inv.totalAmount, inv.itemCurrency);
  const descParts = [
    itemName ? `${itemName} — ${amount}` : `Amount: ${amount}`,
    `Invoice ${inv.invoiceNumber}`,
    dueLabel ? `Due ${dueLabel}` : null,
    inv.status && inv.status !== "draft" && inv.status !== "pending"
      ? `Status: ${inv.status}`
      : null,
  ].filter(Boolean);
  const description = descParts.join(" · ");

  // OG image — the collecting business's logo when present; the
  // scrapers all resize/crop to their own preview slot, so any
  // reasonable square URL works. No image at all falls back to the
  // app-wide default (root layout metadata).
  const image = org?.icon || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { invoiceId } = await params;
  return <InvoicePayPage invoiceId={invoiceId} />;
}
