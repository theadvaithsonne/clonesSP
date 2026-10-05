"use client";

import { useState } from "react";
import { Search, Loader2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

/**
 * Buy a domain through Garage's name.com reseller account.
 *
 * Registration is not automatic — payment and refund-on-failure are still
 * undecided, so this collects the registrant details name.com needs and
 * queues the request. The founder is told plainly that it's handled
 * manually rather than being left to wonder why nothing happened.
 *
 * Prices shown come from the server with the reseller margin already
 * applied, and are re-checked server-side on submit; nothing here sends a
 * price back.
 */

interface Offer {
  domain: string;
  available: boolean;
  premium: boolean;
  priceUsd: number;
  renewalUsd: number;
}

const EMPTY_CONTACT = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
};

export function DomainSearchPanel({ orgId }: { orgId: string }) {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [live, setLive] = useState(true);
  const [picked, setPicked] = useState<Offer | null>(null);
  const [contact, setContact] = useState({ ...EMPTY_CONTACT });
  const [kind, setKind] = useState<"app" | "shop">("app");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    const kw = keyword.trim();
    if (!kw) return;
    setSearching(true);
    setOffers(null);
    try {
      const q = kw.includes(".")
        ? `domains=${encodeURIComponent(kw)}`
        : `keyword=${encodeURIComponent(kw)}`;
      const res = await api<{ results: Offer[]; live: boolean }>(
        `/initial-setup/domain-search?${q}`,
      );
      setOffers(res.results || []);
      setLive(res.live);
    } catch {
      toast.error("Couldn't search domains");
    } finally {
      setSearching(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!picked) return;
    setSubmitting(true);
    try {
      await api(`/initial-setup/domain-request`, {
        method: "POST",
        body: JSON.stringify({ orgId, domain: picked.domain, kind, contact }),
      });
      setDone(true);
    } catch (err: any) {
      toast.error(err?.message || "Couldn't submit the request");
    } finally {
      setSubmitting(false);
    }
  };

  if (done && picked) {
    return (
      <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <Check className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="mt-4 text-lg font-bold text-white">Request received</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
          <span className="font-semibold text-white">{picked.domain}</span> is
          being registered for you. It&rsquo;s handled manually for now, so
          it won&rsquo;t appear under your domains straight away.
        </p>
      </div>
    );
  }

  // ── Step 2: registrant details ──────────────────────────────────────
  if (picked) {
    const field = (
      name: keyof typeof EMPTY_CONTACT,
      label: string,
      opts: { half?: boolean; optional?: boolean; placeholder?: string } = {},
    ) => (
      <div className={opts.half ? "sm:col-span-1" : "sm:col-span-2"}>
        <label className="mb-1 block text-xs font-semibold text-zinc-400">
          {label}
          {!opts.optional && <span className="text-brand"> *</span>}
        </label>
        <input
          value={contact[name]}
          required={!opts.optional}
          placeholder={opts.placeholder}
          onChange={(e) => setContact({ ...contact, [name]: e.target.value })}
          className="w-full rounded-lg border border-[#2a2a35] bg-[#131318] px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
      </div>
    );

    return (
      <form onSubmit={submit} className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-6">
        <button
          type="button"
          onClick={() => setPicked(null)}
          className="mb-4 flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to results
        </button>

        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-[#131318] px-4 py-3">
          <span className="font-bold text-white">{picked.domain}</span>
          <span className="text-sm text-zinc-400">
            <span className="font-semibold text-brand">
              ${picked.priceUsd.toFixed(2)}
            </span>{" "}
            first year &middot; ${picked.renewalUsd.toFixed(2)}/yr after
          </span>
        </div>

        <p className="mb-4 text-xs text-zinc-500">
          These details are required by the registrar. Garage holds the
          registration; this identifies who it&rsquo;s held for.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {field("firstName", "First name", { half: true })}
          {field("lastName", "Last name", { half: true })}
          {field("email", "Email", { half: true })}
          {field("phone", "Phone", { half: true, placeholder: "+1 555 000 1234" })}
          {field("address1", "Address")}
          {field("address2", "Address line 2", { optional: true })}
          {field("city", "City", { half: true })}
          {field("state", "State / Province", { half: true })}
          {field("zip", "Postcode", { half: true })}
          {field("country", "Country code", { half: true, placeholder: "US" })}

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-semibold text-zinc-400">
              Use this domain for
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "app" | "shop")}
              className="w-full rounded-lg border border-[#2a2a35] bg-[#131318] px-3 py-2 text-sm text-white outline-none focus:border-brand"
            >
              <option value="app">My office</option>
              <option value="shop">My shop</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-bold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_73%,white)] disabled:opacity-50"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Request {picked.domain}
        </button>
      </form>
    );
  }

  // ── Step 1: search ──────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-[#2a2a35] bg-[#0e0e12] p-6">
      <h3 className="text-base font-bold text-white">Find a domain</h3>
      <p className="mt-1 text-sm text-zinc-400">
        Search a name, or type a full domain to check that exact one.
      </p>

      <form onSubmit={search} className="mt-4 flex gap-2">
        <input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="bigwin or bigwin.com"
          className="flex-1 rounded-lg border border-[#2a2a35] bg-[#131318] px-3 py-2.5 text-sm text-white outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={searching || !keyword.trim()}
          className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_73%,white)] disabled:opacity-50"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Search
        </button>
      </form>

      {!live && offers && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
          Test mode — these prices and availability aren&rsquo;t real.
        </p>
      )}

      {offers && offers.length === 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Nothing found for that search.
        </p>
      )}

      {offers && offers.length > 0 && (
        <ul className="mt-5 space-y-2">
          {offers.map((o) => (
            <li
              key={o.domain}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2a2a35] bg-[#131318] px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-white">{o.domain}</p>
                <p className="text-xs text-zinc-500">
                  {o.available ? (
                    <>
                      ${o.priceUsd.toFixed(2)} first year &middot; $
                      {o.renewalUsd.toFixed(2)}/yr after
                      {o.premium && " · premium"}
                    </>
                  ) : (
                    "Already taken"
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={!o.available}
                onClick={() => setPicked(o)}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground transition hover:bg-[color:color-mix(in_srgb,var(--brand)_73%,white)] disabled:cursor-not-allowed disabled:bg-[#2a2a35] disabled:text-zinc-500"
              >
                {o.available ? "Select" : "Taken"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
