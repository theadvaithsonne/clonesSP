'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, ShoppingBag, Check, ExternalLink } from 'lucide-react';
import { getToken, getUserDataFromToken } from '@/lib/auth';
import type { PinnedProduct } from '@/store/webinarStore';
import {
  CURRENCY_SYMBOL,
  convertPrice,
  formatPrice,
  type DisplayCurrency,
} from '@/lib/webinar/currency';

// Garage's pinned product shape uses `_id` instead of `itemId` and
// `images[0]` instead of a flat `image`. Adapt at the boundary so
// the rest of this file matches the NC copy 1-to-1.
interface PinnedItem {
  itemType: PinnedProduct['itemType'];
  itemId: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  image?: string;
  isPhysical?: boolean;
  storeSlug?: string;
  productUrl?: string;
}

// Garage backend that owns /api/ecommerce/invoices + the hosted
// /invoice/:id payment page. Default points at test.garage.app so
// staging works out of the box; flip the env var for prod once the
// flow is verified.
const GARAGE_API_URL =
  process.env.NEXT_PUBLIC_GARAGE_API_URL ??
  'https://test.garage.app';

interface Props {
  item: PinnedItem;
  /** Currency the buyer chose on the pinned card. Forwarded to
   *  /api/ecommerce/invoices so the invoice totalAmount is computed
   *  in the same unit the buyer is looking at. Falls back to USD. */
  displayCurrency?: DisplayCurrency;
  /** Live-selling attribution — the webinar session this purchase came
   *  from. The backend only keeps it if the item really was pinned in that
   *  (workshop, session), so a stray value is harmless. `liveWorkshopId` is
   *  the webinar id (the same id WebinarProductPin keys on). */
  liveWorkshopId?: string;
  liveSessionDate?: string;
  onClose: () => void;
}

interface ShippingAddress {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
}

interface InvoiceResult {
  _id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  itemCurrency?: string;
}

/**
 * Minimal checkout dialog for physical storefront items. Calls
 * Garage's POST /api/ecommerce/invoices which validates the cart,
 * creates a draft invoice, and returns a relative `payUrl` we open
 * for the buyer to complete payment.
 */
export default function StoreCheckoutDialog({
  item,
  displayCurrency = 'USD',
  liveWorkshopId,
  liveSessionDate,
  onClose,
}: Props) {
  const user = getUserDataFromToken();
  const [email, setEmail] = useState(user?.email ?? '');
  const [shipping, setShipping] = useState<ShippingAddress>(() => ({
    fullName: (user?.name ?? '').trim(),
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    // Pre-fill India when the buyer picked INR, blank otherwise so US
    // buyers don't have to wipe the field.
    country: displayCurrency === 'INR' ? 'India' : '',
    phone: '',
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [invoice, setInvoice] = useState<InvoiceResult | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  // SSR guard — `createPortal` needs a real DOM node, which is only
  // available after hydration. The dialog is buyer-triggered so this
  // doesn't delay any first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Buyer-side preview of what they'll be charged. The server returns
  // the canonical `totalAmount` after submit; this keeps the dialog
  // consistent with the pinned card while the buyer fills the form.
  const previewPrice = useMemo(
    () => convertPrice(item.price, item.currency, displayCurrency),
    [item.price, item.currency, displayCurrency],
  );
  const previewLabel = `${CURRENCY_SYMBOL[displayCurrency]}${formatPrice(previewPrice)}`;

  function update<K extends keyof ShippingAddress>(
    k: K,
    v: ShippingAddress[K],
  ) {
    setShipping((s) => ({ ...s, [k]: v }));
  }

  async function submit() {
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    // The backend zod schema requires phone and a non-empty state, so
    // surface it client-side before the round-trip.
    const required: (keyof ShippingAddress)[] = [
      'fullName',
      'addressLine1',
      'city',
      'state',
      'postalCode',
      'country',
      'phone',
    ];
    for (const f of required) {
      if (!shipping[f].trim()) {
        setError(`${f} is required`);
        return;
      }
    }
    const token = getToken();
    if (!token) {
      setError('Please log in to complete checkout');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(
        `${GARAGE_API_URL}/api/ecommerce/invoices`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            items: [
              {
                productId: item.itemId,
                quantity: 1,
                // Attribute the sale to the live session it was bought from.
                // Backend verifies against WebinarProductPin, so an
                // unpinned/absent value is simply dropped.
                ...(liveWorkshopId ? { liveWorkshopId } : {}),
                ...(liveWorkshopId && liveSessionDate
                  ? { liveSessionDate }
                  : {}),
              },
            ],
            displayCurrency,
            customerEmail: email.trim().toLowerCase(),
            customerName: shipping.fullName.trim(),
            shippingAddress: {
              fullName: shipping.fullName.trim(),
              addressLine1: shipping.addressLine1.trim(),
              addressLine2: shipping.addressLine2.trim() || '',
              city: shipping.city.trim(),
              state: shipping.state.trim(),
              postalCode: shipping.postalCode.trim(),
              country: shipping.country.trim(),
              phone: shipping.phone.trim(),
            },
            paymentMode: 'Prepaid',
          }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.error || data?.message || 'Checkout failed',
        );
      }
      setInvoice(data.invoice as InvoiceResult);
      setPayUrl(typeof data.payUrl === 'string' ? data.payUrl : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!mounted) return null;

  // Once we have the invoice, switch to a success view and surface
  // the Garage-hosted payment page link. Portalled to <body> so
  // `position: fixed` is anchored to the viewport, not to the
  // transformed video-stage ancestor that hosts the pinned card.
  if (invoice) {
    // payUrl from the API is relative (e.g. "/invoice/<id>"). Prefix
    // it with the Garage base URL so it works regardless of which
    // host loaded the FE.
    const absolutePayUrl = payUrl
      ? payUrl.startsWith('http')
        ? payUrl
        : `${GARAGE_API_URL.replace(/\/$/, '')}${payUrl}`
      : null;
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e0e16] p-6 text-center shadow-2xl">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20">
            <Check className="h-7 w-7 text-green-400" />
          </div>
          <h2 className="text-base font-semibold text-white">
            Invoice {invoice.invoiceNumber} created
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Total {invoice.itemCurrency || displayCurrency}{' '}
            {invoice.totalAmount.toFixed(2)} — complete payment to confirm.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-white/10 bg-zinc-900 py-2 text-xs text-zinc-300 hover:bg-white/10"
            >
              Close
            </button>
            {absolutePayUrl && (
              <a
                href={absolutePayUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-2 text-xs font-semibold text-white hover:bg-purple-500"
              >
                Pay now
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 px-4 backdrop-blur-sm">
      <div className="flex h-full max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e0e16] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-semibold text-white">
              Ship to me
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Product summary */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt={item.name}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
              <ShoppingBag className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white">
              {item.name}
            </div>
            <div className="text-xs text-zinc-500">
              {previewLabel}
              <span className="ml-1 text-[10px] text-zinc-500">
                · billed in {displayCurrency}
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          <Field label="Email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
            />
          </Field>
          <Field label="Full name">
            <input
              value={shipping.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
            />
          </Field>
          <Field label="Address line 1">
            <input
              value={shipping.addressLine1}
              onChange={(e) => update('addressLine1', e.target.value)}
              placeholder="Street, building, apt"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
            />
          </Field>
          <Field label="Address line 2 (optional)">
            <input
              value={shipping.addressLine2}
              onChange={(e) => update('addressLine2', e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="City">
              <input
                value={shipping.city}
                onChange={(e) => update('city', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
              />
            </Field>
            <Field label="State">
              <input
                value={shipping.state}
                onChange={(e) => update('state', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Postal code">
              <input
                value={shipping.postalCode}
                onChange={(e) => update('postalCode', e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
              />
            </Field>
            <Field label="Country">
              <input
                value={shipping.country}
                onChange={(e) => update('country', e.target.value)}
                placeholder="India"
                className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
              />
            </Field>
          </div>
          <Field label="Phone">
            <input
              value={shipping.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="+91…"
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500/60"
            />
          </Field>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </p>
          )}
        </div>

        <div className="border-t border-white/10 px-5 py-3">
          <button
            onClick={submit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Generate invoice ({previewLabel})</>
            )}
          </button>
          <p className="mt-2 text-center text-[10px] text-zinc-500">
            Shipping is calculated at checkout. Payment opens on Garage after
            the invoice is created.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
