"use client";

import { useEffect, useMemo, useState } from "react";
import { Phone, X, ShieldCheck, ChevronDown, Search } from "lucide-react";
import { type ICountry } from "country-state-city";
import { phoneCountries } from "@/lib/dialCodes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useResendCooldown } from "@/lib/hooks/use-resend-cooldown";

const SESSION_KEY = "phone-verify-banner-dismissed";

export default function PhoneVerifyBanner() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_KEY) === "1";
  });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [otp, setOtp] = useState("");
  const resend = useResendCooldown();
  const [loading, setLoading] = useState(false);

  // The persisted auth store can carry a STALE phoneVerified — e.g. it was
  // written at login (which returns no user object) or on a device where the
  // number was verified elsewhere since. Basing the nudge on that value showed
  // it to people who ARE verified. So decide from a fresh /auth/me instead:
  // stay silent until it resolves, and only show when the server confirms the
  // number is not verified. A verified result also syncs the store so the rest
  // of the app stops treating them as unverified.
  //   loading  → checking, render nothing (no flash)
  //   unverified → server says not verified, show the nudge
  //   other    → verified, or the check failed — never nag
  const [status, setStatus] = useState<"loading" | "unverified" | "other">(
    "loading",
  );
  useEffect(() => {
    let alive = true;
    api<{ user?: { phoneVerified?: boolean; phone?: string } }>("/auth/me")
      .then((res) => {
        if (!alive) return;
        if (res?.user?.phoneVerified) {
          updateUser({ phoneVerified: true });
          setStatus("other");
        } else {
          setStatus("unverified");
        }
      })
      .catch(() => {
        // Couldn't confirm — err on the side of NOT nagging a verified user.
        if (alive) setStatus("other");
      });
    return () => {
      alive = false;
    };
  }, [updateUser]);

  /**
   * Country is picked, not typed — matching the profile form and the webinar
   * plan sheet. This dialog used to hard-code 🇮🇳 +91 and cap the input at 10
   * digits, so no non-Indian number could be verified here at all, even
   * though the backend has accepted international numbers since the 2Factor
   * template switch.
   */
  const countries = useMemo(() => phoneCountries(), []);
  const [country, setCountry] = useState<ICountry | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [localNumber, setLocalNumber] = useState("");

  const dial = country?.phonecode?.replace(/^\+/, "") || "91";
  const phone = `+${dial}${localNumber}`;

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phonecode.replace(/^\+/, "").startsWith(q.replace(/^\+/, "")),
    );
  }, [countries, countrySearch]);

  // Don't render if not logged in, dismissed, already known-verified, or until
  // a fresh /auth/me has actually confirmed the number is NOT verified.
  if (!user || dismissed || user.phoneVerified) return null;
  if (status !== "unverified") return null;

  // Also the resend path — the request is identical, so `again` only picks the
  // wording and honours the cooldown.
  const handleRequestOtp = async (again = false) => {
    if (!localNumber.trim()) return;
    if (again && resend.waiting) return;
    setLoading(true);
    try {
      await api("/auth/phone/request-otp", {
        method: "POST",
        // Both channels: the backend defaults to SMS alone for older clients,
        // and attempts each independently, so one provider being down can't
        // swallow a code the other delivered.
        body: JSON.stringify({ phone, channel: "both" }),
      });
      toast.success(
        again ? "OTP resent by WhatsApp and SMS" : "OTP sent by WhatsApp and SMS",
      );
      // Armed on the FIRST send too. /auth/phone/request-otp has no server-side
      // throttle, so this countdown is the only thing rationing paid messages.
      resend.start();
      setStep("otp");
    } catch (err: any) {
      toast.error(err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const data = await api<{ ok: boolean; phone: string; phoneVerified: boolean }>(
        "/auth/phone/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone, code: otp }),
        }
      );
      updateUser({ phone: data.phone, phoneVerified: true });
      toast.success("Phone verified successfully!");
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setDismissed(true);
  };

  const handleOpen = () => {
    setStep("phone");
    setOtp("");

    // Split any number already on the profile back into country + local.
    // Match the LONGEST dial code first, or +1 wins over +91.
    const digits = (user.phone || "").replace(/\D/g, "");
    const match = digits
      ? [...countries]
          .filter((c) => digits.startsWith(c.phonecode.replace(/^\+/, "")))
          .sort(
            (a, b) =>
              b.phonecode.replace(/^\+/, "").length -
              a.phonecode.replace(/^\+/, "").length,
          )[0]
      : undefined;

    if (match) {
      setCountry(match);
      setLocalNumber(digits.slice(match.phonecode.replace(/^\+/, "").length));
    } else {
      setCountry(countries.find((c) => c.isoCode === "IN") || null);
      setLocalNumber(digits);
    }

    setCountryOpen(false);
    setCountrySearch("");
    setOpen(true);
  };

  return (
    <>
      {/* Floating pill — deliberately NOT in normal flow. The dashboard shell
          is h-dvh, so an inline banner pushed the whole layout down by its own
          height and put the sidebar's bottom (profile + buttons) past the
          viewport edge, where it couldn't be clicked. Fixed positioning keeps
          the nudge visible without costing the layout any height. Sits on the
          right so it never covers the bottom-left profile control. */}
      <div className="fixed bottom-20 right-4 md:bottom-4 z-[600] max-w-[calc(100vw-2rem)] rounded-full border border-brand/25 bg-[#1a1505] px-3 py-2 shadow-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Phone className="w-4 h-4 text-brand shrink-0" />
          <p className="text-xs text-white/80 truncate">
            <span className="text-brand font-medium">Verify your phone</span>
            <span className="hidden sm:inline">
              {" "}— adds an extra layer of security to your account.
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs px-3 border-brand/40 text-brand hover:bg-brand/10 bg-transparent"
            onClick={handleOpen}
          >
            Verify Now
          </Button>
          <button
            onClick={handleDismiss}
            className="text-white/30 hover:text-white/60 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Verification Dialog */}
      <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 p-3 bg-brand/20 rounded-full w-fit">
              <ShieldCheck className="w-7 h-7 text-brand" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              {step === "phone" ? "Verify Your Phone" : "Enter OTP"}
            </DialogTitle>
            <DialogDescription className="text-[#9fa0b8] text-sm">
              {step === "phone"
                ? "We'll send a one-time code to your mobile number."
                : `Enter the 6-digit code sent to ${phone}.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {step === "phone" ? (
              <>
                <div className="relative">
                  <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-[#2a2a35] bg-[#1a1a24] focus-within:border-brand/50">
                    <button
                      type="button"
                      onClick={() => setCountryOpen((v) => !v)}
                      className="flex shrink-0 items-center gap-1.5 border-r border-[#2a2a35] px-3 text-sm text-white hover:bg-white/[0.04]"
                    >
                      <span className="text-base leading-none">
                        {country?.flag || "🇮🇳"}
                      </span>
                      <span className="font-semibold">+{dial}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                    </button>
                    <input
                      autoFocus
                      type="tel"
                      inputMode="numeric"
                      placeholder="98765 43210"
                      value={localNumber}
                      onChange={(e) =>
                        setLocalNumber(
                          e.target.value.replace(/\D/g, "").slice(0, 15),
                        )
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleRequestOtp()}
                      className="min-w-0 flex-1 bg-transparent px-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
                    />
                  </div>

                  {countryOpen && (
                    <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-lg border border-[#2a2a35] bg-[#13131a] shadow-xl">
                      <div className="sticky top-0 border-b border-white/[0.06] bg-[#13131a] p-2">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                          <input
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            placeholder="Search country or code…"
                            className="h-8 w-full rounded-md bg-[#0e0e12] pl-8 pr-2 text-xs text-white placeholder:text-white/30 focus:outline-none"
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
                            className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-white/70 hover:bg-white/[0.06]"
                          >
                            <span className="text-sm">{c.flag}</span>
                            <span className="font-semibold text-white">
                              +{c.phonecode.replace(/^\+/, "")}
                            </span>
                            <span className="flex-1 truncate text-right text-white/40">
                              {c.name}
                            </span>
                          </button>
                        ))}
                        {filteredCountries.length === 0 && (
                          <p className="px-2.5 py-3 text-center text-xs text-white/40">
                            No match
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <Button
                  className="w-full bg-brand text-brand-foreground hover:bg-brand/90 font-semibold"
                  onClick={() => handleRequestOtp()}
                  disabled={loading || !localNumber.trim()}
                >
                  {loading ? "Sending…" : "Send OTP"}
                </Button>
              </>
            ) : (
              <>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  className="bg-[#1a1a24] border-[#2a2a35] text-white placeholder:text-white/30 tracking-widest text-center text-lg"
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                />
                <Button
                  className="w-full bg-brand text-brand-foreground hover:bg-brand/90 font-semibold"
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length < 4}
                >
                  {loading ? "Verifying…" : "Verify"}
                </Button>
                <p className="text-center text-xs text-white/40">
                  Didn&apos;t get it?{" "}
                  <button
                    onClick={() => handleRequestOtp(true)}
                    disabled={loading || resend.waiting}
                    className="text-brand transition-colors disabled:text-white/40"
                  >
                    {resend.waiting ? `Resend in ${resend.secondsLeft}s` : "Resend code"}
                  </button>
                </p>
                <button
                  className="w-full text-xs text-white/40 hover:text-white/60 transition-colors"
                  onClick={() => setStep("phone")}
                >
                  Change phone number
                </button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
