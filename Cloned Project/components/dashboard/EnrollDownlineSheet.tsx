"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  Building2,
  Check,
  Loader2,
  MapPin,
  Phone as PhoneIcon,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Country } from "country-state-city";
import { phoneCountries as dialableCountries } from "@/lib/dialCodes";
import { checkDownlineEmail, enrollDownline } from "@/lib/downlines-api";
import { api } from "@/lib/api";

export interface EnrollDownlineSheetOrg {
  /** Organization _id. */
  orgId: string;
  /** Display name. */
  orgName: string;
  /** Caller's role at this org — shown next to the name in the picker. */
  role?: string;
  /** Org logo URL (from /auth/me → organization.icon). May be empty. */
  icon?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-select an office on open. Falls back to the first entry. */
  defaultOrgId?: string | null;
  /** Optional callback after a successful enroll. */
  onSuccess?: (result: {
    userId: string;
    email: string;
    orgName: string;
  }) => void;
}

interface AuthMeResponse {
  user: {
    organizations: Array<{
      id: string;
      name: string;
      role: "founder" | "stakeholder";
      parent?: boolean;
      icon?: string;
    }>;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mirrors the ProfilePopover field style — compact, with the same
// border/focus/placeholder palette so the slide-in feels native to the
// rest of the dashboard.
const INPUT_CLASS =
  "h-9 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200";

const LABEL_CLASS = "text-xs font-medium text-[#c7c7da]";

export function EnrollDownlineSheet({
  open,
  onOpenChange,
  defaultOrgId,
  onSuccess,
}: Props) {
  const [orgs, setOrgs] = useState<EnrollDownlineSheetOrg[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgId, setOrgId] = useState<string>("");
  const [email, setEmail] = useState("");
  // Email availability state — runs a debounced check against the BE so
  // we can block submit BEFORE the user fills out the rest of the form.
  // `null` = not checked yet (or invalid format), `true`/`false` = result.
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const emailCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Used to ignore stale responses if the user keeps typing.
  const emailCheckSeqRef = useRef(0);
  const [name, setName] = useState("");
  // Phone is split into a country-code dropdown + a digits-only input.
  // We default to India (+91 / ISO IN) and combine `"{+code} {digits}"`
  // on submit. ISO code is what we store in `phoneIso` because some dial
  // codes are shared by multiple countries (US/CA/several Caribbean = +1).
  const [phoneIso, setPhoneIso] = useState("IN");
  const [phone, setPhone] = useState("");
  // Location fields — Country drives the postal-code resolver, postal code
  // auto-fills city + state. Order + resolver behavior mirror ProfilePopover.
  const [country, setCountry] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState("");
  const postalCodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allCountryNames = useMemo<string[]>(() => {
    return Country.getAllCountries().map((c) => c.name).sort();
  }, []);

  // Country dial-code options for the Phone field. Filters out the handful
  // of countries country-state-city ships with empty `phonecode`. Keyed by
  // ISO code so shared codes (US/CA = +1) don't collide as Select values.
  const phoneCountries = useMemo(() => {
    return dialableCountries()
      .filter((c) => c.phonecode && c.phonecode.trim().length > 0)
      .map((c) => ({
        iso: c.isoCode,
        name: c.name,
        flag: c.flag || "",
        // country-state-city sometimes returns the code with a leading +,
        // sometimes without. Normalize so we always render exactly one.
        dial: c.phonecode.startsWith("+") ? c.phonecode : `+${c.phonecode}`,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const selectedPhoneCountry = useMemo(
    () => phoneCountries.find((c) => c.iso === phoneIso) || null,
    [phoneCountries, phoneIso]
  );

  // Country + postal → city + state. Mirrors ProfilePopover.resolvePostalCode:
  // appends country to the query (improves accuracy when the same pincode
  // exists in multiple countries) and only overwrites city/state — country
  // stays whatever the user picked.
  const resolvePostalCode = async (pincode: string, countryName: string) => {
    if (pincode.length < 3) {
      setPostalCodeError("");
      return;
    }
    setPostalCodeLoading(true);
    setPostalCodeError("");
    try {
      const params = new URLSearchParams({ pincode });
      if (countryName.trim()) params.append("country", countryName.trim());
      const res = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?${params.toString()}`, { method: "GET" });
      setCity(res.city || "");
      setState(res.state || "");
    } catch {
      setPostalCodeError("Could not resolve postal code. Please fill manually.");
    } finally {
      setPostalCodeLoading(false);
    }
  };

  const handlePostalCodeChange = (value: string) => {
    setPostalCode(value);
    if (postalCodeTimerRef.current) clearTimeout(postalCodeTimerRef.current);
    if (value.length >= 3) {
      postalCodeTimerRef.current = setTimeout(() => {
        resolvePostalCode(value, country);
      }, 800);
    }
  };

  const pinCodeResolved =
    postalCode.length >= 3 && !postalCodeLoading && !postalCodeError && !!city;

  // Body-scroll-lock while open. Same convention as the other sheets.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Reset + initialize when opening.
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setEmailExists(null);
    setEmailChecking(false);
    setName("");
    setPhoneIso("IN");
    setPhone("");
    setCountry("");
    setPostalCode("");
    setCity("");
    setState("");
    setPostalCodeError("");
    setPostalCodeLoading(false);
    setError(null);
  }, [open]);

  // Debounced "is this email already taken" pre-flight. Runs whenever the
  // email field changes; ignores stale responses via emailCheckSeqRef.
  useEffect(() => {
    if (!open) return;
    if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !EMAIL_RE.test(trimmed)) {
      setEmailExists(null);
      setEmailChecking(false);
      return;
    }
    setEmailChecking(true);
    const seq = ++emailCheckSeqRef.current;
    emailCheckTimerRef.current = setTimeout(async () => {
      try {
        const { exists } = await checkDownlineEmail(trimmed);
        // Drop the result if a newer keystroke has since superseded it.
        if (seq !== emailCheckSeqRef.current) return;
        setEmailExists(exists);
      } catch {
        // Soft-fail: don't block the user on a network blip. The BE
        // enforces USER_EXISTS on the actual enroll call anyway.
        if (seq !== emailCheckSeqRef.current) return;
        setEmailExists(null);
      } finally {
        if (seq === emailCheckSeqRef.current) setEmailChecking(false);
      }
    }, 500);
    return () => {
      if (emailCheckTimerRef.current) clearTimeout(emailCheckTimerRef.current);
    };
  }, [email, open]);

  // Self-fetch the caller's offices on open. Filters out the HQ parent
  // org by default (an enroll-a-downline action is meant for real offices
  // — the user can still pick HQ if they're a member, but it sits at the
  // bottom rather than being auto-selected).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setOrgsLoading(true);
    api<AuthMeResponse>("/auth/me")
      .then((res) => {
        if (!alive) return;
        const mapped: EnrollDownlineSheetOrg[] = (
          res.user?.organizations || []
        )
          // Stable sort: non-HQ orgs first, then HQ.
          .slice()
          .sort((a, b) => Number(!!a.parent) - Number(!!b.parent))
          .map((o) => ({
            orgId: o.id,
            orgName: o.name,
            role: o.role,
            icon: o.icon || "",
          }));
        setOrgs(mapped);
        const initial =
          defaultOrgId && mapped.find((o) => o.orgId === defaultOrgId)
            ? defaultOrgId
            : mapped[0]?.orgId || "";
        setOrgId(initial);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e?.message || "Failed to load your offices");
      })
      .finally(() => {
        if (alive) setOrgsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, defaultOrgId]);

  const selectedOrg = useMemo(
    () => orgs.find((o) => o.orgId === orgId) || null,
    [orgs, orgId]
  );

  const emailValid = EMAIL_RE.test(email.trim());
  // Block submit while the BE check is in flight OR if we know the email
  // is already taken. emailExists === true is the hard-stop; null / false
  // both let the user proceed.
  const canSubmit =
    !!orgId &&
    emailValid &&
    !submitting &&
    !emailChecking &&
    emailExists !== true;

  const livePreview = useMemo(() => {
    if (!selectedOrg) return "Pick an office to enroll your downline into.";
    const who = name.trim() || email.trim() || "Your new downline";
    return `${who} will join “${selectedOrg.orgName}” under your referral.`;
  }, [selectedOrg, name, email]);

  const handleSubmit = async () => {
    if (!canSubmit || !selectedOrg) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await enrollDownline({
        orgId: selectedOrg.orgId,
        email: email.trim().toLowerCase(),
        name: name.trim() || undefined,
        // Combine dial code + digits only if the user actually typed a
        // number — otherwise we'd send a bare "+91 " to the BE, which it
        // would happily store as the downline's phone.
        phone: phone.trim()
          ? `${selectedPhoneCountry?.dial || "+91"} ${phone.trim()}`
          : undefined,
        country: country.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
      });
      const label = res.user.name || res.user.email;
      toast.success(`${label} enrolled at ${res.orgName}`);
      onSuccess?.({
        userId: res.user._id,
        email: res.user.email,
        orgName: res.orgName,
      });
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message || "Failed to enroll downline";
      // Race condition guard: someone could create this account between
      // the debounced pre-flight and the actual enroll click. Bump
      // emailExists so the inline error stays visible after a 409.
      if (/already exists/i.test(msg)) {
        setEmailExists(true);
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={() => {
          if (!submitting) onOpenChange(false);
        }}
      />

      {/* Slide-in side panel — same shell as TopUpStoreWalletSheet */}
      <div
        className={cn(
          "relative ml-auto h-full w-full sm:max-w-md bg-[#0b0b0d] border-l border-[#2a2a35]",
          "shadow-2xl flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Sticky header */}
        <div className="shrink-0 px-5 pt-5 pb-4 border-b border-[#2a2a35] bg-[#0e0e12]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-brand/10 border border-brand/30 shrink-0">
                <UserPlus className="w-4 h-4 text-brand" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-white">
                  Enroll a downline
                </h2>
                <p className="text-xs text-[#9fa0b8] mt-0.5">
                  Pre-register a new member under your referral — no email or
                  link sent.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="p-1.5 rounded-md text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Live preview card */}
          <div className="mt-3 rounded-lg border border-brand/20 bg-brand/5 p-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-brand mt-0.5 shrink-0" />
            <p className="text-xs text-brand/90 leading-relaxed">
              {livePreview}
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Office picker */}
          <div>
            <label className={LABEL_CLASS}>Office</label>
            {orgsLoading ? (
              <div className="px-3 h-10 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center gap-2 text-sm text-[#9fa0b8]">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading your offices…
              </div>
            ) : orgs.length === 0 ? (
              <div className="px-3 h-10 rounded-lg bg-[#1a1a22] border border-[#2a2a35] flex items-center text-sm text-[#9fa0b8]">
                You don&apos;t belong to any offices yet.
              </div>
            ) : (
              <Select
                value={orgId}
                onValueChange={setOrgId}
                disabled={submitting}
              >
                <SelectTrigger
                  className={cn(
                    "!h-10 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                    "focus:border-brand/40 focus:ring-0 data-[size=default]:h-10"
                  )}
                >
                  <SelectValue placeholder="Choose an office" />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
                  {orgs.map((o) => (
                    <SelectItem
                      key={o.orgId}
                      value={o.orgId}
                      className="text-sm focus:bg-[#1a1a22] focus:text-white"
                    >
                      <div className="flex items-center gap-2">
                        {o.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.icon}
                            alt=""
                            className="w-4 h-4 rounded-sm object-cover shrink-0"
                            onError={(e) => {
                              // If the icon URL 404s or fails to load,
                              // collapse the <img> so the Building2
                              // sibling can take its place visually.
                              (e.currentTarget as HTMLImageElement).style.display = "none";
                            }}
                          />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-brand shrink-0" />
                        )}
                        <span className="truncate">{o.orgName}</span>
                        {o.role && (
                          <span className="text-[10px] text-[#6b6b80] ml-2 uppercase tracking-wide">
                            · {o.role}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="enroll-email" className={LABEL_CLASS}>
              Email
            </Label>
            <div className="relative">
              <Input
                id="enroll-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                autoComplete="off"
                disabled={submitting}
                className={cn(
                  INPUT_CLASS,
                  "pr-9",
                  emailValid && emailExists === true && "border-red-500/60",
                  emailValid && emailExists === false && "border-emerald-500/40"
                )}
              />
              {emailValid && emailChecking && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-brand-2" />
              )}
              {emailValid &&
                !emailChecking &&
                emailExists === true && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-red-400" />
                )}
              {emailValid &&
                !emailChecking &&
                emailExists === false && (
                  <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                )}
            </div>
            {email.length > 0 && !emailValid && (
              <p className="text-[11px] text-red-400">
                That doesn&apos;t look like a valid email.
              </p>
            )}
            {emailValid && emailExists === true && (
              <p className="text-[11px] text-red-400">
                A Garage user with this email already exists. They can&apos;t
                be re-enrolled.
              </p>
            )}
          </div>

          {/* Optional pre-fill */}
          <div className="pt-3 border-t border-[#2a2a35] space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b80]">
                Pre-fill profile
              </h3>
              <span className="text-[10px] text-[#5a5a72]">optional</span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="enroll-name" className={LABEL_CLASS}>
                Full name
              </Label>
              <Input
                id="enroll-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Asha Reddy"
                disabled={submitting}
                className={INPUT_CLASS}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="enroll-phone" className={LABEL_CLASS}>
                Phone
              </Label>
              <div className="flex gap-2">
                {/* Country dial-code dropdown. Trigger shows the flag +
                    +code in a compact pill; items show the country name
                    too so the user knows which +1 / +44 they picked. */}
                <Select
                  value={phoneIso}
                  onValueChange={setPhoneIso}
                  disabled={submitting}
                >
                  <SelectTrigger
                    aria-label="Country dial code"
                    className={cn(
                      "!h-9 w-[110px] shrink-0 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                      "focus:border-brand-2/40 focus:ring-0 data-[size=default]:h-9"
                    )}
                  >
                    <SelectValue placeholder="+__">
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm leading-none">
                          {selectedPhoneCountry?.flag || "🌐"}
                        </span>
                        <span className="text-xs tabular-nums">
                          {selectedPhoneCountry?.dial || "+__"}
                        </span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-h-72">
                    {phoneCountries.map((c) => (
                      <SelectItem
                        key={c.iso}
                        value={c.iso}
                        className="text-xs focus:bg-[#1a1a22] focus:text-white"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm leading-none">{c.flag}</span>
                          <span className="tabular-nums w-12">{c.dial}</span>
                          <span className="text-[#9fa0b8]">{c.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6a6a7a] pointer-events-none" />
                  <Input
                    id="enroll-phone"
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => {
                      // Digits only — the dial code is stored separately.
                      const sanitized = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 15);
                      setPhone(sanitized);
                    }}
                    placeholder="98765 43210"
                    disabled={submitting}
                    className={cn(INPUT_CLASS, "pl-10")}
                  />
                </div>
              </div>
            </div>

            {/* Country → Postal Code → City + State. Same pattern as
                ProfilePopover: pick country first, type postal code, and
                we hit /org/resolve-pincode (debounced) to auto-fill city
                + state. User can still override city/state manually. */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="enroll-country" className={LABEL_CLASS}>
                  Country
                </Label>
                <Select
                  value={country}
                  onValueChange={(value) => {
                    setCountry(value);
                    // Re-resolve postal-code → city/state with the new
                    // country so the resolver picks the right region when
                    // a pincode is ambiguous across countries.
                    if (postalCode.trim().length >= 3) {
                      resolvePostalCode(postalCode, value);
                    }
                  }}
                  disabled={submitting}
                >
                  <SelectTrigger
                    id="enroll-country"
                    className={cn(
                      "!h-9 bg-[#1a1a22] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
                      "focus:border-brand-2/40 focus:ring-0 data-[size=default]:h-9"
                    )}
                  >
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] text-white max-h-72">
                    {allCountryNames.map((countryName) => (
                      <SelectItem
                        key={countryName}
                        value={countryName}
                        className="text-xs focus:bg-[#1a1a22] focus:text-white"
                      >
                        {countryName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enroll-postal" className={LABEL_CLASS}>
                  Postal Code
                </Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6a6a7a]" />
                  <Input
                    id="enroll-postal"
                    value={postalCode}
                    onChange={(e) => handlePostalCodeChange(e.target.value)}
                    placeholder="560001"
                    disabled={submitting}
                    className={cn(INPUT_CLASS, "pl-9 pr-9")}
                  />
                  {postalCodeLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-brand-2" />
                  )}
                  {pinCodeResolved && !postalCodeLoading && (
                    <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
                {postalCodeError && (
                  <p className="text-[10px] text-red-400">{postalCodeError}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="enroll-city" className={LABEL_CLASS}>
                  City
                </Label>
                <Input
                  id="enroll-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Bengaluru"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enroll-state" className={LABEL_CLASS}>
                  State
                </Label>
                <Input
                  id="enroll-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="Karnataka"
                  disabled={submitting}
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <p className="text-[11px] text-[#6b6b80] leading-relaxed pt-1">
              Filling name <span className="text-[#9fa0b8]">and</span> phone
              lets your downline skip the onboarding card on their first
              login. Otherwise they&apos;ll be prompted for those two fields.
            </p>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 border-t border-[#2a2a35] bg-[#0e0e12] px-5 py-3 space-y-2">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 px-4 rounded-lg text-sm text-[#9fa0b8] hover:bg-[#1a1a22] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                "h-10 px-4 rounded-lg text-sm font-semibold bg-brand text-brand-foreground",
                "hover:bg-brand/90 transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              )}
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Enroll downline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
