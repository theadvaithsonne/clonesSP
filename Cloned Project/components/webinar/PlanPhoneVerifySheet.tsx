"use client";

/**
 * Phone verification for a Garage Store plan purchase.
 *
 * Shown when the buyer's 24-hour free-first-cycle window has never started —
 * i.e. they've never been onboarded onto the partner (NetworkChains). All we
 * ask for is the phone number: verifying it is what unlocks the offer.
 *
 * `POST /auth/phone/verify-otp` stamps `profileCompletedAt` on success, which
 * is what starts the window (backend services/comboWindow.ts). Nothing else
 * is collected here — no address, no second round-trip.
 */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ShieldCheck, Loader2, ChevronDown, Search } from "lucide-react";
import { type ICountry } from "country-state-city";
import { phoneCountries } from "@/lib/dialCodes";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useResendCooldown } from "@/lib/hooks/use-resend-cooldown";
import { getUserDataFromToken } from "@/lib/auth";
import { useAuthStore } from "@/store/authStore";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Fired once the number is verified AND the 24h window has started. */
  onVerified: () => void;
  /** Shown in the header so the buyer knows what they're unlocking. */
  planLabel?: string;
  /**
   * What this verification is for, recorded against the webinar so the host's
   * report can answer "who verified a number in order to buy the thing we
   * pinned". Reported only — the backend never authorizes anything on it.
   * Omitted outside a webinar; profile setup sends nothing.
   */
  context?: {
    workshopId?: string;
    itemType?: string;
    itemId?: string;
    itemName?: string;
  };
}

interface ProfileShape {
  name?: string;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
}

export default function PlanPhoneVerifySheet({
  open,
  onClose,
  onVerified,
  planLabel,
  context,
}: Props) {
  // Country code is picked, not typed — same as the profile form. Storing
  // the ICountry (not just the dial code) keeps the flag and search working.
  const [country, setCountry] = useState<ICountry | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [localNumber, setLocalNumber] = useState("");
  const [code, setCode] = useState("");
  const updateUser = useAuthStore((s) => s.updateUser);

  const countries = useMemo(() => phoneCountries(), []);
  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phonecode.includes(q) ||
        c.isoCode.toLowerCase().includes(q),
    );
  }, [countries, countrySearch]);

  const dial = country?.phonecode?.replace(/^\+/, "") || "91";
  const phone = `+${dial}${localNumber.trim()}`;
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const resend = useResendCooldown();

  // Prefill whatever number we already hold — most people just confirm it.
  useEffect(() => {
    if (!open) return;
    setCode("");
    setSent(false);
    setCountryOpen(false);
    setCountrySearch("");
    setCountry(
      (cur) => cur || countries.find((c) => c.isoCode === "IN") || null,
    );
    const { userId } = getUserDataFromToken();
    if (!userId) return;
    api<ProfileShape>(`profile?userId=${encodeURIComponent(userId)}`, {
      method: "GET",
    })
      .then((p) => {
        const raw = (p?.phone || "").trim();
        if (!raw) return;
        // Stored numbers are E.164 ("+919022108802"). Match the LONGEST
        // dial code first so +1 doesn't win over +91.
        const digits = raw.replace(/\D/g, "");
        const match = [...countries]
          .filter((c) => digits.startsWith(c.phonecode.replace(/^\+/, "")))
          .sort(
            (a, b) =>
              b.phonecode.replace(/^\+/, "").length -
              a.phonecode.replace(/^\+/, "").length,
          )[0];
        if (match) {
          setCountry(match);
          setLocalNumber(digits.slice(match.phonecode.replace(/^\+/, "").length));
        } else {
          setLocalNumber(digits);
        }
      })
      .catch(() => {
        /* prefill is a nicety — never block on it */
      });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Also the resend path — the request is identical, so `again` only picks the
  // wording and honours the cooldown.
  const sendOtp = async (again = false) => {
    if (!localNumber.trim()) return;
    if (again && resend.waiting) return;
    setBusy(true);
    try {
      await api("auth/phone/request-otp", {
        method: "POST",
        // Both channels — the backend defaults to SMS alone for older clients.
        // Worth the extra message here: this code is what unlocks the offer,
        // so a single undelivered SMS costs the sale.
        body: JSON.stringify({ phone, channel: "both" }),
      });
      toast.success(
        again ? "Code resent by WhatsApp and SMS" : "Code sent by WhatsApp and SMS",
      );
      // Armed on the FIRST send too. auth/phone/request-otp has no server-side
      // throttle, so this countdown is the only thing rationing paid messages.
      resend.start();
      setSent(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send the code");
    } finally {
      setBusy(false);
    }
  };

  const verifyAndStartWindow = async () => {
    if (code.trim().length < 4) return;
    setBusy(true);
    try {
      const verified = await api<{ phone: string }>("auth/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          phone,
          code: code.trim(),
          // Only sent when we're inside a webinar — see Props.context.
          ...(context?.workshopId
            ? { context: { ...context, source: "webinar-pin" } }
            : {}),
        }),
      });

      // Publish to the auth store too. The dashboard's "Verify your phone"
      // nudge hides on `user.phoneVerified`, so without this it keeps
      // nagging anyone who verified from inside a webinar.
      updateUser({ phone: verified?.phone || phone, phoneVerified: true });

      toast.success("Phone verified — your offer is unlocked");
      onVerified();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-2xl border border-white/[0.08] bg-[#0e0e12] p-5 shadow-2xl sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="rounded-full bg-brand/15 p-2">
                  <ShieldCheck className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">
                    Verify your phone
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {planLabel
                      ? `Unlocks your offer on ${planLabel}`
                      : "Unlocks your first-month offer"}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!sent ? (
              <>
                <div className="relative mb-3">
                  <div className="flex h-11 items-stretch overflow-hidden rounded-lg border border-white/[0.1] bg-[#13131a] focus-within:border-brand/50">
                    <button
                      type="button"
                      onClick={() => setCountryOpen((v) => !v)}
                      className="flex shrink-0 items-center gap-1.5 border-r border-white/[0.08] px-3 text-sm text-white hover:bg-white/[0.04]"
                    >
                      <span className="text-base leading-none">
                        {country?.flag || "🇮🇳"}
                      </span>
                      <span className="font-semibold">+{dial}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
                    </button>
                    <input
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      value={localNumber}
                      onChange={(e) =>
                        setLocalNumber(
                          e.target.value.replace(/\D/g, "").slice(0, 15),
                        )
                      }
                      onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                      placeholder="98765 43210"
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white placeholder-zinc-600 focus:outline-none"
                    />
                  </div>

                  {countryOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/[0.1] bg-[#13131a] shadow-xl">
                      <div className="sticky top-0 border-b border-white/[0.06] bg-[#13131a] p-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
                          <input
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country or code…"
                            className="h-8 w-full rounded-md bg-[#0e0e12] pl-8 pr-2 text-xs text-white placeholder-zinc-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="p-1">
                        {filteredCountries.map((c) => (
                          <button
                            key={c.isoCode}
                            type="button"
                            onClick={() => {
                              setCountry(c);
                              setCountryOpen(false);
                              setCountrySearch("");
                            }}
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-zinc-300 hover:bg-white/[0.06]"
                          >
                            <span className="text-sm">{c.flag}</span>
                            <span className="font-semibold text-white">
                              +{c.phonecode.replace(/^\+/, "")}
                            </span>
                            <span className="flex-1 truncate text-right text-zinc-500">
                              {c.name}
                            </span>
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="py-4 text-center text-xs text-zinc-600">
                            No results
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => sendOtp()}
                  disabled={busy || !localNumber.trim()}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? "Sending…" : "Send code"}
                </button>
              </>
            ) : (
              <>
                <input
                  autoFocus
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  onKeyDown={(e) =>
                    e.key === "Enter" && verifyAndStartWindow()
                  }
                  placeholder="6-digit code"
                  className="mb-3 h-11 w-full rounded-lg border border-white/[0.1] bg-[#13131a] px-3 text-center text-lg tracking-[0.4em] text-white placeholder-zinc-600 placeholder:text-sm placeholder:tracking-normal focus:border-brand/50 focus:outline-none"
                />
                <button
                  onClick={verifyAndStartWindow}
                  disabled={busy || code.trim().length < 4}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand text-sm font-semibold text-brand-foreground transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_91%,black)] disabled:opacity-40"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {busy ? "Verifying…" : "Verify & unlock"}
                </button>
                <p className="mt-3 text-center text-xs text-zinc-500">
                  Didn&apos;t get it?{" "}
                  <button
                    onClick={() => sendOtp(true)}
                    disabled={busy || resend.waiting}
                    className="text-brand transition-colors disabled:text-zinc-500"
                  >
                    {resend.waiting ? `Resend in ${resend.secondsLeft}s` : "Resend code"}
                  </button>
                </p>
                <button
                  onClick={() => setSent(false)}
                  disabled={busy}
                  className="mt-2 w-full text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                >
                  Change number
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
