"use client";

// Public NetworkChain offer page: my.garage.app/magic-link/<token>
//
// The token identifies WHO the offer is for and WHICH plan — never the price.
// Every load re-quotes server-side, so a link opened after the 24-hour offer
// window lapses shows normal prices rather than one we'd refuse to honour.
//
// No login to view, matching /invoice/[invoiceId]. Paying is gated by the email
// OTP that page already enforces, which is where we hand off.

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Check,
  Clock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { API_URL } from "@/lib/api";

type Quote = {
  kind: "free_claim" | "combo_cart" | "subscription";
  termMonths: number;
  planLabel: string;
  clientName: string;
  freeMonth: boolean;
  includesLicence: boolean;
  licenceUsd: number;
  subUsd: number;
  cartUsd: number;
  monthsOfAccess: number;
  currency: string;
};

type OfferLink = {
  success: boolean;
  status: "active" | "purchased" | "revoked" | "not_found";
  /** "catalog" = every plan, user picks. "single" = the one plan it sells. */
  mode?: "catalog" | "single";
  plans?: Quote[];
  recipient?: { name: string | null; emailMasked: string | null };
  plan?: {
    termMonths: number;
    label: string;
    clientName: string;
    productCode: string;
  };
  offer?: {
    open: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    secondsRemaining: number;
    windowHours: number;
  };
  quote?: Quote;
};

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

/** "7h 04m 12s" — recomputed locally so the page doesn't need to re-poll. */
function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${String(m).padStart(2, "0")}m`;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a10] px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function Notice({
  icon: Icon,
  title,
  body,
}: {
  icon: any;
  title: string;
  body: string;
}) {
  return (
    <Shell>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-[#2a2a35] bg-[#12121a] px-6 py-12 text-center">
        <div className="rounded-xl border border-[#2a2a35] bg-[#0a0a10] p-3">
          <Icon className="h-5 w-5 text-brand" />
        </div>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <p className="max-w-xs text-sm text-[#9fa0b8]">{body}</p>
      </div>
    </Shell>
  );
}

export default function MagicLinkPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const router = useRouter();

  const [data, setData] = useState<OfferLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [selected, setSelected] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/magic-link/${token}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok && res.status !== 404) {
        throw new Error(json?.message || "Couldn't load this offer");
      }
      setData(json);
      setRemaining(json?.offer?.secondsRemaining || 0);
      // Default to the cheapest entry point rather than whatever came first.
      const ps: Quote[] = json?.plans || [];
      if (ps.length) {
        let best = 0;
        ps.forEach((p, i) => { if (p.cartUsd < ps[best].cartUsd) best = i; });
        setSelected(best);
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Couldn't load this offer");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  // Local countdown. Ticking client-side avoids hammering the API, and the
  // server re-quotes at checkout anyway — so a clock that drifts by a second
  // can never let someone pay a price the backend wouldn't honour.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          // Window just closed — refetch so the prices update in place.
          load();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [remaining, load]);

  async function handlePay(termMonths: number) {
    if (!token) return;
    setPaying(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/magic-link/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ termMonths }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Couldn't start checkout");
      }
      if (json.activated) {
        setClaimed(true);
        return;
      }
      // Same tab, into the existing public invoice page.
      router.push(json.payUrl);
    } catch (e: any) {
      setErrorMsg(e?.message || "Couldn't start checkout");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
          <p className="text-sm text-[#9fa0b8]">Loading your offer…</p>
        </div>
      </Shell>
    );
  }

  if (claimed) {
    return (
      <Notice
        icon={Check}
        title="You're all set"
        body="Your free month is active. Nothing to pay — you can close this page."
      />
    );
  }

  if (errorMsg && !data) {
    return <Notice icon={AlertCircle} title="Something went wrong" body={errorMsg} />;
  }
  if (!data || data.status === "not_found") {
    return (
      <Notice
        icon={AlertCircle}
        title="Link not found"
        body="This offer link doesn't exist or has been removed."
      />
    );
  }
  if (data.status === "revoked") {
    return (
      <Notice
        icon={AlertCircle}
        title="Link no longer active"
        body="This offer link has been revoked. Ask whoever sent it for a new one."
      />
    );
  }
  if (data.status === "purchased") {
    return (
      <Notice
        icon={Check}
        title="Already subscribed"
        body={`You already have an active ${data.plan?.clientName || "NetworkChain"} subscription.`}
      />
    );
  }

  // Always an array: a single-plan link returns one entry, so there is one
  // shape to render rather than two.
  const plans: Quote[] = data.plans?.length ? data.plans : data.quote ? [data.quote] : [];
  const q = plans[Math.min(selected, plans.length - 1)] ?? data.quote!;
  const offerLive = !!data.offer?.open && remaining > 0;
  const showPicker = plans.length > 1;

  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-[#2a2a35] bg-[#12121a]">
        {/* Offer banner */}
        {offerLive && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-brand/20 to-transparent px-5 py-3">
            <Sparkles className="h-4 w-4 shrink-0 text-brand" />
            <span className="text-[13px] font-medium text-brand">
              First month free
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-[12px] tabular-nums text-brand">
              <Clock className="h-3.5 w-3.5" />
              {formatRemaining(remaining)}
            </span>
          </div>
        )}

        <div className="px-5 py-6">
          {data.recipient?.name && (
            <p className="mb-1 text-sm text-[#9fa0b8]">
              For {data.recipient.name}
            </p>
          )}
          <h1 className="text-xl font-bold text-white">
            {showPicker ? q.clientName : `${q.clientName} — ${q.planLabel}`}
          </h1>
          <p className="mt-1 text-[13px] text-[#9fa0b8]">
            {showPicker
              ? "Choose a plan"
              : `${q.monthsOfAccess === 1 ? "1 month" : `${q.monthsOfAccess} months`} of access${
                  q.freeMonth && q.monthsOfAccess > 1
                    ? ", including your free first month"
                    : ""
                }`}
          </p>

          {/* Plan picker — catalog links only */}
          {showPicker && (
            <div className="mt-4 space-y-2">
              {plans.map((p, i) => {
                const active = i === selected;
                const perMonth = p.cartUsd / Math.max(1, p.monthsOfAccess);
                return (
                  <button
                    key={p.termMonths}
                    onClick={() => setSelected(i)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-brand bg-brand/[0.07]"
                        : "border-[#2a2a35] bg-[#0a0a10] hover:border-[#3a3a45]"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                        active ? "border-brand bg-brand" : "border-[#3a3a45]"
                      }`}
                    >
                      {active && <Check className="h-2.5 w-2.5 text-black" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-white">
                        {p.planLabel}
                      </span>
                      <span className="block text-[11px] text-[#6b6b80]">
                        {p.monthsOfAccess === 1
                          ? "1 month"
                          : `${p.monthsOfAccess} months`}{" "}
                        of access
                        {p.monthsOfAccess > 1
                          ? ` \u00b7 ${money(Math.round(perMonth * 100) / 100)}/mo`
                          : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-bold text-white">
                        {money(p.cartUsd)}
                      </span>
                      {p.freeMonth && (
                        <span className="block text-[10px] font-medium text-emerald-400">
                          1 month free
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Price */}
          <div className="mt-5 rounded-xl border border-[#2a2a35] bg-[#0a0a10] p-4">
            <div className="space-y-2 text-[13px]">
              {q.includesLicence && (
                <div className="flex justify-between">
                  <span className="text-[#9fa0b8]">Unilevel Plus licence</span>
                  <span className="text-white">{money(q.licenceUsd)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#9fa0b8]">
                  {q.clientName} — {q.planLabel}
                </span>
                <span className={q.subUsd === 0 ? "text-emerald-400" : "text-white"}>
                  {q.subUsd === 0 ? "Free" : money(q.subUsd)}
                </span>
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between border-t border-[#2a2a35] pt-3">
              <span className="text-sm text-[#9fa0b8]">Total today</span>
              <span className="text-2xl font-bold text-white">
                {money(q.cartUsd)}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] text-[#6b6b80]">
              Taxes calculated at checkout.
            </p>
          </div>

          {!offerLive && (
            <p className="mt-3 text-[12px] text-[#6b6b80]">
              The free-first-month offer has ended. These are the standard prices.
            </p>
          )}

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              {errorMsg}
            </div>
          )}

          <button
            onClick={() => handlePay(q.termMonths)}
            disabled={paying}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand text-sm font-semibold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] disabled:opacity-60"
          >
            {paying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : q.cartUsd === 0 ? (
              "Activate free month"
            ) : (
              `Pay ${money(q.cartUsd)}`
            )}
          </button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#6b6b80]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {data.recipient?.emailMasked
              ? `We'll verify ${data.recipient.emailMasked} before payment`
              : "Payment is verified by email"}
          </div>
        </div>
      </div>
    </Shell>
  );
}
