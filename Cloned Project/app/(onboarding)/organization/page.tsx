"use client";

import { Suspense, useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, API_URL } from "@/lib/api";
import { saveToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Info,
  ChevronDown,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLicenceGate } from "../layout";
import { Country, State } from "country-state-city";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsAndConditionsModal } from "@/components/onboarding/TermsAndConditionsModal";

// Shared dark-theme primitives — mirror the EnrollDownlineSheet convention
// so all our modern forms feel native to the same UI system.
const INPUT_CLASS =
  "h-10 bg-[#1E1E1E] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200";
const LABEL_CLASS = "text-xs font-medium text-[#c7c7da]";
const SELECT_TRIGGER_CLASS = cn(
  "!h-10 bg-[#1E1E1E] border-[#2a2a35] text-white text-sm hover:border-[#3a3a45]",
  "focus:border-brand-2/40 focus:ring-0 data-[size=default]:h-10"
);

// Pricing constant — kept in lockstep with `CONFERENCE_ROOM_PRICE_USD`
// in the backend (Part 2 of the rollout will wire actual billing).
const CONFERENCE_ROOM_PRICE_USD = 5;

// Categories are now sourced entirely from the admin-managed OrgCategory
// taxonomy via GET /org/categories. The previous hardcoded fallback was
// removed as part of the admin-taxonomy rollout — free-text input is
// gone, so an empty picker means the admin hasn't seeded any categories
// yet (should never happen after the seed script runs).

function OrganizationPageContent() {
  const router = useRouter();
  // Raises the licence drawer when the backend rejects creation (see the
  // catch in checkUserAndCreateOrg).
  const { openGate } = useLicenceGate();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");

  // Form state — only the fields the simplified form collects. Heading,
  // sub-heading, cover photo, promo video, public toggle are all moved to
  // ManageOrgPopover so founders can fill them later.
  const [orgName, setOrgName] = useState("");
  const [country, setCountry] = useState(""); // ISO code (e.g. "IN", "US")
  const [postalCode, setPostalCode] = useState("");
  const [stateCode, setStateCode] = useState(""); // ISO state code
  const [stateName, setStateName] = useState(""); // Display name for submit
  const [city, setCity] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [category, setCategory] = useState("");
  // The stepper is intentionally locked at 1 at create time per the plan
  // — founders get 1 free, additional rooms are added (and billed) from
  // the dashboard's ConferenceRoomPage. The +/- buttons are disabled.
  const [conferenceRoomCount] = useState(1);

  // Custom Combobox state for the Country dropdown
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  // Postal-code resolver state — mirrors EnrollDownlineSheet.
  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState("");
  const postalCodeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Category options — populated from GET /org/categories. Starts empty
  // and fills on mount; no client-side defaults anymore.
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);

  // First-time founders may not have a name on file yet. After clicking
  // Create, we check, and if name is empty we prompt for it in a dialog.
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [userName, setUserName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Terms & Conditions must be accepted before the office can be created.
  // The full text lives in TermsAndConditionsModal (mirrored from the
  // store's /terms page).
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Track which fields the user has interacted with so we only surface
  // validation errors after a blur — avoids the form screaming at them
  // before they've had a chance to type.
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Logo uploading/preview states
  const [logoUploading, setLogoUploading] = useState(false);
  const [localLogoPreview, setLocalLogoPreview] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const countryListRef = useRef<HTMLDivElement>(null);
  const stateListRef = useRef<HTMLDivElement>(null);
  const categoryListRef = useRef<HTMLDivElement>(null);

  // Onboarding logo upload goes to our own S3-backed public endpoint
  // (POST /uploads/public) instead of UploadThing. That endpoint doesn't
  // require a bearer token — the user hasn't created an org yet, so
  // they have no JWT at this point. Same-shape response as /upload,
  // so downstream form state is unchanged.
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be less than 5MB");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setLocalLogoPreview(localUrl);
    setLogoUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/uploads/public`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || err.hint || "Upload failed");
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error("Upload returned no URL");
      setLogoUrl(data.url);
      toast.success("Logo uploaded successfully");
    } catch (err) {
      toast.error(
        `Logo upload failed: ${(err as Error).message || "Please try again."}`
      );
      setLocalLogoPreview("");
    } finally {
      setLogoUploading(false);
    }
  };

  // Redirect unauthenticated visitors back to login.
  useEffect(() => {
    if (!userId) router.push("/login");
  }, [userId, router]);

  // Remove viewport scrollbars completely
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
    };
  }, []);

  // Fetch the admin-managed category list. Any string the founder can
  // pick MUST come from here — BE rejects unknown values on submit.
  useEffect(() => {
    api<{ categories: string[] }>("/org/categories", { method: "GET" })
      .then((res) => {
        setCategorySuggestions(res.categories || []);
      })
      .catch(() => {
        // Leave the list empty on network error. Founder can still
        // submit without a category (empty is allowed server-side).
      });
  }, []);

  // Country options — sorted alphabetically. ISO code is the Select value
  // so we can drive the State dropdown below from `State.getStatesOfCountry`.
  const countries = useMemo(() => {
    return Country.getAllCountries()
      .map((c) => ({ iso: c.isoCode, name: c.name, flag: c.flag || "" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);
  const selectedCountryName = useMemo(
    () => countries.find((c) => c.iso === country)?.name || "",
    [countries, country]
  );
  const selectedCountry = useMemo(
    () => countries.find((c) => c.iso === country) || null,
    [countries, country]
  );

  // State options derived from the selected country. Many countries have
  // no states in the dataset (e.g. Vatican); the resolver will still fill
  // in the state name from the postal code and we render it as a free
  // input fallback if `states` is empty.
  const states = useMemo(() => {
    if (!country) return [];
    return State.getStatesOfCountry(country)
      .map((s) => ({ iso: s.isoCode, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [country]);

  // Whenever the user changes country, blow away the state so we don't
  // carry a stale state code that doesn't belong to the new country.
  const handleCountryChange = (iso: string) => {
    setCountry(iso);
    setStateCode("");
    setStateName("");
    // If a postal code is already typed, re-resolve with the new country
    // — same pincode can map to different cities across countries.
    if (postalCode.trim().length >= 3) {
      resolvePostalCode(postalCode, iso);
    }
  };

  // Country + postal → city + state. Mirrors EnrollDownlineSheet exactly.
  // Sets stateName (display) and tries to map back to stateCode for the
  // Select value when a matching state exists in country-state-city.
  const resolvePostalCode = async (pincode: string, countryIso: string) => {
    if (pincode.length < 3) {
      setPostalCodeError("");
      return;
    }
    setPostalCodeLoading(true);
    setPostalCodeError("");
    try {
      const params = new URLSearchParams({ pincode });
      const countryName =
        countries.find((c) => c.iso === countryIso)?.name || "";
      if (countryName) params.append("country", countryName);
      const res = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?${params.toString()}`, { method: "GET" });
      setCity(res.city || "");
      setStateName(res.state || "");
      // Try to align the Select value when the resolved state matches
      // a known ISO state for the chosen country.
      const matchedState = countryIso
        ? State.getStatesOfCountry(countryIso).find(
            (s) => s.name.toLowerCase() === (res.state || "").toLowerCase()
          )
        : null;
      setStateCode(matchedState?.isoCode || "");
    } catch {
      setPostalCodeError(
        "Could not resolve postal code. Please fill manually."
      );
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
    } else {
      setCity("");
      setStateName("");
      setStateCode("");
      setPostalCodeError("");
    }
  };

  // When the user picks a state from the Select, sync both code + name.
  const handleStateSelect = (iso: string) => {
    setStateCode(iso);
    const matched = states.find((s) => s.iso === iso);
    setStateName(matched?.name || "");
  };

  const pinCodeResolved =
    postalCode.length >= 3 && !postalCodeLoading && !postalCodeError && !!city;

  // Validation — required fields only. Description is required because
  // an empty description leaves the office card looking broken on the
  // public marketplace.
  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    if (touched.orgName && !orgName.trim()) out.orgName = "Required";
    if (touched.orgName && orgName.trim() && orgName.trim().length < 2)
      out.orgName = "At least 2 characters";
    if (touched.country && !country) out.country = "Required";
    if (touched.postalCode && !postalCode.trim()) out.postalCode = "Required";
    if (touched.stateName && !stateName.trim()) out.stateName = "Required";
    if (touched.city && !city.trim()) out.city = "Required";
    // Strip HTML tags to check if description has any real content.
    const descText = description.replace(/<[^>]*>/g, "").trim();
    if (touched.description && !descText) out.description = "Required";
    return out;
  }, [touched, orgName, country, postalCode, stateName, city, description]);

  const isFormValid = useMemo(() => {
    if (!orgName.trim() || orgName.trim().length < 2) return false;
    if (!country) return false;
    if (!postalCode.trim()) return false;
    if (!stateName.trim()) return false;
    if (!city.trim()) return false;
    const descText = description.replace(/<[^>]*>/g, "").trim();
    if (!descText) return false;
    if (!acceptedTerms) return false;
    return true;
  }, [
    orgName,
    country,
    postalCode,
    stateName,
    city,
    description,
    acceptedTerms,
  ]);

  const markAllTouched = () => {
    setTouched({
      orgName: true,
      country: true,
      postalCode: true,
      stateName: true,
      city: true,
      description: true,
    });
  };

  async function checkUserAndCreateOrg() {
    try {
      const userResponse = await api<{ name?: string }>(
        `/auth/get-user?userId=${userId}`,
        { method: "GET" }
      );
      if (!userResponse.name) {
        setShowNameDialog(true);
        return;
      }
      await createOrganization(userResponse.name);
    } catch {
      toast.error("Something went wrong loading your account.");
    }
  }

  async function createOrganization(userNameToSave: string) {
    if (!orgName || !userId) return;
    setSubmitting(true);
    try {
      if (userNameToSave) {
        await api("/auth/update-user", {
          method: "POST",
          body: JSON.stringify({ userId, name: userNameToSave }),
        });
      }

      const orgResponse = await api<{
        org: { _id: string; name: string };
        membership: { role: string; organization: unknown };
      }>("/org/create-first-time", {
        method: "POST",
        body: JSON.stringify({
          userId,
          name: orgName.trim(),
          country: selectedCountryName,
          postalCode: postalCode.trim(),
          state: stateName.trim(),
          city: city.trim(),
          description,
          icon: logoUrl || undefined,
          category: category || undefined,
        }),
      });

      const tokenResponse = await api<{ token: string }>(
        "/auth/token-after-org",
        {
          method: "POST",
          body: JSON.stringify({ userId, orgId: orgResponse.org._id }),
        }
      );

      saveToken(tokenResponse.token);
      localStorage.setItem("garage_org_id", orgResponse.org._id);
      toast.success("Office created");

      // Founder came from Picker #1 with a plan pre-selected (see
      // /office-payment `handleStart` isNewOffice branch — it forwards
      // `?plan=starter|pro`). Auto-subscribe here so they skip Picker #2
      // and go straight to workspace (Starter) or invoice-pay (Pro).
      // Any failure falls through to the old picker route so they're
      // never stuck.
      const preSelectedPlan = searchParams.get("plan");
      const newOrgId = orgResponse.org._id;
      const nextToken = tokenResponse.token;
      const redirect = searchParams.get("redirect");

      if (preSelectedPlan === "starter") {
        try {
          const r = await api<{
            success: boolean;
            requiresPayment: boolean;
          }>(
            `/checkout/office/${newOrgId}/subscribe`,
            {
              method: "POST",
              body: JSON.stringify({ planSlug: "starter" }),
            },
            nextToken,
          );
          if (r.success) {
            toast.success("Starters Offer activated — you're all set.");
            router.push(redirect || "/workspace");
            return;
          }
        } catch (e) {
          console.warn(
            "[org-create] auto-subscribe (starter) failed — falling back to picker:",
            e,
          );
          // fall through to picker below
        }
      } else if (preSelectedPlan === "pro") {
        try {
          const r = await api<{
            success: boolean;
            officeInvoiceId: string | null;
            roomsInvoiceId: string | null;
          }>(
            `/checkout/office/${newOrgId}/start-trial`,
            {
              method: "POST",
              body: JSON.stringify({ planSlug: "pro", totalRoomCount: 1 }),
            },
            nextToken,
          );
          const nextInvoiceId = r.officeInvoiceId || r.roomsInvoiceId;
          if (r.success && nextInvoiceId) {
            toast.success(
              "Almost there — complete payment to activate your office.",
            );
            // Same reason as the Starter branch above: the destination the
            // founder started from has to survive the payment step.
            router.push(
              redirect
                ? `/invoice/${nextInvoiceId}?redirect=${encodeURIComponent(redirect)}`
                : `/invoice/${nextInvoiceId}`,
            );
            return;
          }
        } catch (e) {
          console.warn(
            "[org-create] auto-subscribe (pro) failed — falling back to picker:",
            e,
          );
          // fall through to picker below
        }
      }

      // No pre-selected plan OR auto-subscribe failed — keep the picker
      // as the safety-net fallback so the founder can always complete
      // signup manually.
      router.push(
        redirect
          ? `/office-payment?redirect=${encodeURIComponent(redirect)}`
          : "/office-payment"
      );
    } catch (e: any) {
      // The backend is the real gate, and it can reject a tab that passed the
      // layout's check — a licence that lapsed, was refunded, or a request
      // made before the guard ran. Raise the purchase drawer instead of
      // toasting the raw error code at the founder.
      const msg = String(e?.message || "");
      if (/licence_required/i.test(msg)) {
        openGate();
        return;
      }
      toast.error(e?.message || "Could not create office. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNameSubmit() {
    if (!userName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    setShowNameDialog(false);
    await createOrganization(userName.trim());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    markAllTouched();
    if (!acceptedTerms) {
      toast.error("Please accept the Terms & Conditions to create an office");
      return;
    }
    if (!isFormValid) {
      toast.error("Please fill in all required fields");
      return;
    }
    await checkUserAndCreateOrg();
  }

  return (
    <div className="relative h-screen w-full bg-[#0b0b0d] flex items-center justify-center p-4 overflow-hidden text-white">
      {/* Glassmorphic background — mirrors select-organization */}
      <style>{`
        @keyframes floatParticle {
          0%, 100% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-20px); opacity: 0.8; }
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(800px_400px_at_30%_20%,color-mix(in_srgb,_var(--brand-2)_25%,_transparent),transparent_50%),radial-gradient(600px_300px_at_70%_80%,rgba(255,183,32,0.2),transparent_60%),radial-gradient(400px_200px_at_50%_50%,rgba(255,193,7,0.15),transparent_70%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/60" />
        {/* Floating particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/20 rounded-full"
              style={{
                left: `${10 + (i * 4.2) % 80}%`,
                top: `${5 + (i * 4.7) % 90}%`,
                animation: `floatParticle ${3 + (i % 3)}s ease-in-out ${(i % 5) * 0.4}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-[520px] h-full max-h-[92vh] flex flex-col">
        <form
          onSubmit={handleSubmit}
          className="flex-1 min-h-0 rounded-2xl border border-[#2a2a35] bg-[#111114]/80 backdrop-blur-xl flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200"
        >
          {/* Title inside card */}
          <div className="px-6 py-4 border-b border-[#2a2a35] shrink-0 flex items-center justify-between bg-[#111114]">
            <h1 className="text-[17px] font-semibold text-white">Create Office</h1>
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[#9fa0b8] hover:text-white p-1.5 rounded-full border border-[#2a2a35] hover:bg-[#2a2a35] transition-colors flex items-center justify-center shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pt-5 pb-5 space-y-4 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className={LABEL_CLASS}>
              Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="org-name"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, orgName: true }))}
              placeholder="e.g., Founders Office"
              maxLength={100}
              disabled={submitting}
              className={INPUT_CLASS}
            />
            {errors.orgName && (
              <p className="text-[11px] text-red-400">{errors.orgName}</p>
            )}
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <Label htmlFor="org-country" className={LABEL_CLASS}>
              Country <span className="text-red-400">*</span>
            </Label>
            <Popover open={isCountryOpen} onOpenChange={setIsCountryOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="org-country"
                  type="button"
                  disabled={submitting}
                  className={cn(
                    "w-full h-10 bg-[#1E1E1E] border border-[#2a2a35] text-white hover:bg-[#1E1E1E] hover:text-white text-sm hover:border-[#3a3a45] rounded-xl flex items-center justify-between px-3 font-normal shadow-none",
                    "focus:ring-2 focus:ring-brand-2/20 focus:border-brand-2/50 transition-all duration-200"
                  )}
                >
                  {selectedCountry ? (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{selectedCountry.flag}</span>
                      <span className="text-xs font-semibold text-[#6a6a7a] shrink-0">{selectedCountry.iso}</span>
                      <span className="truncate">{selectedCountry.name}</span>
                    </span>
                  ) : (
                    <span className="text-[#6a6a7a]">Select country</span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#9fa0b8]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 bg-[#111114] border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden z-[150]">
                <Command className="bg-[#111114]">
                  <CommandInput
                    placeholder="Search country..."
                    className="h-10 text-white placeholder-[#6a6a7a] border-none border-b-0 bg-transparent focus:ring-0"
                    onValueChange={() => {
                      setTimeout(() => {
                        countryListRef.current?.scrollTo({ top: 0 });
                      }, 0);
                    }}
                  />
                  <CommandList ref={countryListRef} className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    <CommandEmpty className="py-6 text-center text-sm text-[#6a6a7a]">No country found.</CommandEmpty>
                    <CommandGroup className="p-1">
                      {countries.map((c) => {
                        const isSelected = c.iso === country;
                        return (
                          <CommandItem
                            key={c.iso}
                            value={`${c.iso} ${c.name}`}
                            onSelect={() => {
                              handleCountryChange(c.iso);
                              setTouched((t) => ({ ...t, country: true }));
                              setIsCountryOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-white",
                              "aria-selected:bg-[#1c1c24] aria-selected:text-white hover:bg-[#1c1c24] hover:text-white focus:bg-[#1c1c24] focus:text-white",
                              isSelected ? "bg-[#1c1c24] text-white" : "bg-transparent text-white"
                            )}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{c.flag}</span>
                              <span className="text-xs font-semibold text-[#6a6a7a] shrink-0 w-6">{c.iso}</span>
                              <span className="truncate">{c.name}</span>
                            </span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-brand-2 shrink-0" />
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.country && (
              <p className="text-[11px] text-red-400">{errors.country}</p>
            )}
          </div>

          {/* Postal Code */}
          <div className="space-y-1.5">
            <Label htmlFor="org-postal" className={LABEL_CLASS}>
              Postal Code <span className="text-red-400">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6a6a7a] pointer-events-none" />
              <Input
                id="org-postal"
                value={postalCode}
                onChange={(e) => handlePostalCodeChange(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, postalCode: true }))}
                placeholder="e.g., 94107"
                maxLength={10}
                disabled={submitting}
                className={cn(INPUT_CLASS, "pl-10 pr-10")}
              />
              {postalCodeLoading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-brand-2" />
              )}
              {pinCodeResolved && !postalCodeLoading && (
                <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            {postalCodeError && (
              <p className="text-[11px] text-red-400">{postalCodeError}</p>
            )}
            {errors.postalCode && !postalCodeError && (
              <p className="text-[11px] text-red-400">{errors.postalCode}</p>
            )}
          </div>

          {/* State */}
          <div className="space-y-1.5">
            <Label htmlFor="org-state" className={LABEL_CLASS}>
              State <span className="text-red-400">*</span>
              <span className="ml-1 text-[10px] text-[#555566] font-normal">(Only Fill If It Doesn't Automatically Populate)</span>
            </Label>
            {states.length > 0 ? (
              <Popover open={isStateOpen} onOpenChange={setIsStateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="org-state"
                    type="button"
                    disabled={submitting || !country}
                    className={cn(
                      "w-full h-10 bg-[#1E1E1E] border border-[#2a2a35] text-white hover:bg-[#1E1E1E] hover:text-white text-sm hover:border-[#3a3a45] rounded-xl flex items-center justify-between px-3 font-normal shadow-none",
                      "focus:ring-2 focus:ring-brand-2/20 focus:border-brand-2/50 transition-all duration-200"
                    )}
                  >
                    {stateName ? (
                      <span className="truncate">{stateName}</span>
                    ) : (
                      <span className="text-[#6a6a7a]">
                        {country ? "Select state" : "Pick a country first"}
                      </span>
                    )}
                    <ChevronDown className="h-4 w-4 shrink-0 text-[#9fa0b8]" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0 bg-[#111114] border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden z-[150]">
                  <Command className="bg-[#111114]">
                    <CommandInput
                      placeholder="Search state..."
                      className="h-10 text-white placeholder-[#6a6a7a] border-none border-b-0 bg-transparent focus:ring-0"
                      onValueChange={() => {
                        setTimeout(() => {
                          stateListRef.current?.scrollTo({ top: 0 });
                        }, 0);
                      }}
                    />
                    <CommandList ref={stateListRef} className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      <CommandEmpty className="py-6 text-center text-sm text-[#6a6a7a]">No state found.</CommandEmpty>
                      <CommandGroup className="p-1">
                        {states.map((s) => {
                          const isSelected = s.iso === stateCode;
                          return (
                            <CommandItem
                              key={s.iso}
                              value={`${s.iso} ${s.name}`}
                              onSelect={() => {
                                handleStateSelect(s.iso);
                                setTouched((t) => ({ ...t, stateName: true }));
                                setIsStateOpen(false);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-white",
                                "aria-selected:bg-[#1c1c24] aria-selected:text-white hover:bg-[#1c1c24] hover:text-white focus:bg-[#1c1c24] focus:text-white",
                                isSelected ? "bg-[#1c1c24] text-white" : "bg-transparent text-white"
                              )}
                            >
                              <span className="truncate">{s.name}</span>
                              {isSelected && (
                                <Check className="h-4 w-4 text-brand-2 shrink-0" />
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            ) : (
              // Fallback for countries with no states in the dataset — keep
              // the field editable as a free input so the resolver's value
              // still shows up and submission stays unblocked.
              <Input
                id="org-state"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                onBlur={() => setTouched((t) => ({ ...t, stateName: true }))}
                placeholder={country ? "State / Region" : "Pick a country first"}
                disabled={submitting || !country}
                className={INPUT_CLASS}
              />
            )}
            {errors.stateName && (
              <p className="text-[11px] text-red-400">{errors.stateName}</p>
            )}
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="org-city" className={LABEL_CLASS}>
              City <span className="text-red-400">*</span>
              <span className="ml-1 text-[10px] text-[#555566] font-normal">(Only Fill If It Doesn't Automatically Populate)</span>
            </Label>
            <Input
              id="org-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, city: true }))}
              placeholder="e.g., San Francisco"
              disabled={submitting}
              className={INPUT_CLASS}
            />
            {errors.city && (
              <p className="text-[11px] text-red-400">{errors.city}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLASS}>
              Description <span className="text-red-400">*</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., A collaborative workspace for our product and engineering teams."
              rows={4}
              disabled={submitting}
              className={cn(
                INPUT_CLASS,
                "h-auto py-2.5 resize-none text-sm placeholder:text-sm placeholder:text-[#6a6a7a]",
                errors.description && "border-red-500/60"
              )}
            />
            {errors.description && (
              <p className="text-[11px] text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Logo (optional) */}
          <div className="space-y-1.5">
            <Label className={LABEL_CLASS}>
              Logo
              <span className="ml-2 text-[10px] text-[#6b6b80] font-normal">
                optional
              </span>
            </Label>
            <div
              onClick={() => logoInputRef.current?.click()}
              className="flex items-center gap-3 rounded-xl border border-dashed border-[#2a2a35] bg-[#1E1E1E] px-4 py-3 cursor-pointer hover:border-brand-2/50 transition-colors group"
            >
              {(localLogoPreview || logoUrl) ? (
                <div className="relative shrink-0">
                  <img src={localLogoPreview || logoUrl} alt="Logo" className="w-10 h-10 rounded-lg object-cover" />
                  {logoUploading ? (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-brand-2 animate-spin" />
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLogoUrl("");
                        setLocalLogoPreview("");
                      }}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="w-10 h-10 rounded-lg bg-[#2a2a35] group-hover:bg-[#2a2a45] flex items-center justify-center shrink-0 transition-colors">
                  <Building2 className="w-5 h-5 text-[#9fa0b8]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium">
                  {logoUploading ? "Uploading logo..." : (logoUrl ? "Logo uploaded" : "Upload logo")}
                </p>
                <p className="text-xs text-[#6a6a7a] mt-0.5">PNG or JPG, up to 5mb</p>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
                disabled={logoUploading}
              />
            </div>
          </div>


          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="org-category" className={LABEL_CLASS}>
              Category <span className="text-red-400">*</span>
            </Label>
            <Popover open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="org-category"
                  type="button"
                  disabled={submitting}
                  className={cn(
                    "w-full h-10 bg-[#1E1E1E] border border-[#2a2a35] text-white hover:bg-[#1E1E1E] hover:text-white text-sm hover:border-[#3a3a45] rounded-xl flex items-center justify-between px-3 font-normal shadow-none",
                    "focus:ring-2 focus:ring-brand-2/20 focus:border-brand-2/50 transition-all duration-200"
                  )}
                >
                  {category ? (
                    <span className="truncate">{category}</span>
                  ) : (
                    <span className="text-[#6a6a7a]">Select category</span>
                  )}
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#9fa0b8]" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-[#1E1E1E] border-[#2a2a35] rounded-xl shadow-2xl overflow-hidden z-[150]">
                <Command className="bg-[#1E1E1E]">
                  <CommandInput
                    placeholder="Search category..."
                    className="h-10 text-white placeholder-[#6a6a7a] border-none border-b-0 bg-transparent focus:ring-0"
                    onValueChange={() => {
                      setTimeout(() => {
                        categoryListRef.current?.scrollTo({ top: 0 });
                      }, 0);
                    }}
                  />
                  <CommandList ref={categoryListRef} className="max-h-72 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                    <CommandEmpty className="py-6 text-center text-sm text-[#6a6a7a]">No category found.</CommandEmpty>
                    <CommandGroup className="p-1">
                      {categorySuggestions.map((c) => {
                        const isSelected = c === category;
                        return (
                          <CommandItem
                            key={c}
                            value={c}
                            onSelect={() => {
                              setCategory(c);
                              setIsCategoryOpen(false);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors text-white",
                              "aria-selected:bg-[#25252b] aria-selected:text-white hover:bg-[#25252b] hover:text-white focus:bg-[#25252b] focus:text-white",
                              isSelected ? "bg-[#25252b] text-white" : "bg-transparent text-white"
                            )}
                          >
                            <span className="truncate">{c}</span>
                            {isSelected && (
                              <Check className="h-4 w-4 text-brand-2 shrink-0" />
                            )}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Number of Conference Rooms — visual only at create time.
              The stepper is disabled and the count locked at 1; founders
              get the free room with their office and add more (with the
              $5/room billing kicking in) from the dashboard later.
              COMMENTED OUT PER USER REQUEST
          <div className="space-y-1.5">
            <Label className={LABEL_CLASS}>
              Number of Conference Rooms
              <Info
                className="inline-block w-3 h-3 ml-1.5 text-[#6b6b80] align-text-bottom"
                aria-label="1 room is included free. Add more from your dashboard later."
              />
            </Label>
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-[#2a2a35] bg-[#1a1a22] overflow-hidden">
                <button
                  type="button"
                  disabled
                  className="w-9 h-10 flex items-center justify-center text-[#6b6b80] cursor-not-allowed"
                  aria-label="Decrease rooms"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <div className="w-12 h-10 flex items-center justify-center text-sm text-white border-x border-[#2a2a35] tabular-nums">
                  {conferenceRoomCount}
                </div>
                <button
                  type="button"
                  disabled
                  className="w-9 h-10 flex items-center justify-center text-[#6b6b80] cursor-not-allowed"
                  aria-label="Increase rooms"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-[#9fa0b8] leading-snug">
                1 room included free. Add more from your dashboard later —
                <span className="text-white">
                  {" "}
                  ${CONFERENCE_ROOM_PRICE_USD}/room/month
                </span>
                , billed on your office's monthly invoice.
              </p>
            </div>
          </div>
          */}

          {/* Terms & Conditions — mandatory gate on Create Office */}
          <div className="pt-2 pb-1">
            <label className="flex items-start gap-3 cursor-pointer group select-none">
              <Checkbox
                id="terms-acceptance"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                disabled={submitting}
                className="mt-0.5 border-[#3a3a48] data-[state=checked]:bg-brand data-[state=checked]:border-brand data-[state=checked]:text-brand-foreground"
              />
              <span className="text-xs text-[#9fa0b8] leading-relaxed">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTermsModal(true);
                  }}
                  className="text-brand hover:underline font-medium focus:outline-none"
                >
                  Terms &amp; Conditions
                </button>
                <span className="text-red-400 ml-0.5">*</span>
              </span>
            </label>
          </div>

          </div>

          {/* Footer — sticky at bottom of card */}
          <div className="shrink-0 flex items-center justify-end gap-2 border-t border-[#2a2a35] px-6 py-4 bg-[#0e0e12] rounded-b-2xl">
            <Button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="bg-[#1a1a22] border border-[#2a2a35] text-white hover:bg-[#2a2a35] h-10 px-5 rounded-lg font-medium text-sm"
            >
              Back
            </Button>
            <Button
              type="submit"
              disabled={submitting || !isFormValid}
              className={cn(
                "bg-brand text-brand-foreground font-semibold hover:bg-[#fde047] transition-colors px-5 h-10",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Office"
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* First-time-founder name dialog */}
      <Dialog open={showNameDialog} onOpenChange={setShowNameDialog}>
        <DialogContent className="bg-[#0e0e12] border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle>What's your name?</DialogTitle>
            <DialogDescription className="text-[#9fa0b8]">
              We'll show this on your office's founder profile. You can
              change it anytime.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your full name"
            className={INPUT_CLASS}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowNameDialog(false)}
              className="text-[#9fa0b8] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleNameSubmit}
              disabled={!userName.trim()}
              className="bg-brand text-brand-foreground font-semibold hover:bg-[#fde047]"
            >
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Terms & Conditions — read without losing form state */}
      <TermsAndConditionsModal
        open={showTermsModal}
        onOpenChange={setShowTermsModal}
        onAccept={() => setAcceptedTerms(true)}
      />
    </div>
  );
}

export default function OrganizationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <OrganizationPageContent />
    </Suspense>
  );
}
