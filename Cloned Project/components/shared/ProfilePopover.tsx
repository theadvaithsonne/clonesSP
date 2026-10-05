"use client";

import { useState, useEffect, useRef, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  User,
  MapPin,
  Save,
  X,
  Phone,
  ChevronDown,
  Loader2,
  LogOut,
  Trash2,
  AlertTriangle,
  Building2,
  Check,
  Camera,
  Mail,
  BellRing,
  Search,
  Upload,
  UserPlus,
  Pencil,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { AssociateAccountCard } from "@/components/shared/AssociateAccountCard";
import { getToken, clearToken } from "@/lib/auth";
import { signOutActiveAccount } from "@/lib/account-session";
import { useAuthStore } from "@/store/authStore";
import { uploadProfilePictureToS3 } from "@/lib/profilePictureUpload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useRouter, usePathname } from "next/navigation";
import { type ICountry } from "country-state-city";
import { phoneCountries } from "@/lib/dialCodes";
import { useSettings } from "@/lib/hooks/useSettings";

interface ProfilePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    email: string;
    name?: string;
    phone?: string | null;
    phoneVerified?: boolean;
  };
  isFirstTimeUser?: boolean;
  onProfileComplete?: () => void;
}

/** A row from GET /unilevel-plus/users/search. */
interface ReferrerSuggestion {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

const parsePhone = (rawPhone: string, userCountryName?: string) => {
  const allCountries = phoneCountries();
  
  // Sort countries by phonecode length descending so we match longest phonecodes first (+1 246 vs +1)
  const sortedCountries = [...allCountries].sort((a, b) => b.phonecode.length - a.phonecode.length);
  
  if (rawPhone.startsWith("+")) {
    const withoutPlus = rawPhone.slice(1);
    for (const c of sortedCountries) {
      if (withoutPlus.startsWith(c.phonecode)) {
        const local = withoutPlus.slice(c.phonecode.length).trim();
        return { country: c, localNumber: local };
      }
    }
  }
  
  // If not starting with "+", try to match country by name
  let defaultCountry = allCountries.find(
    (c) => c.name.toLowerCase() === userCountryName?.toLowerCase()
  );
  if (!defaultCountry) {
    defaultCountry = allCountries.find((c) => c.isoCode === "US") || allCountries[0];
  }
  
  return { country: defaultCountry, localNumber: rawPhone };
};

export function ProfilePopover({
  isOpen,
  onClose,
  user,
  isFirstTimeUser = false,
  onProfileComplete,
}: ProfilePopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  // BAT246-only extra field (Country of Birth) — stored in that office's
  // own bat246distributors collection, never the shared User document.
  // See bat246Profile.routes.ts.
  const isBat246 = pathname?.startsWith("/games/bat246") ?? false;
  // Desktop-only larger variant for the BAT246 boards page.
  const isBat246Boards = pathname?.startsWith("/games/bat246/boards") ?? false;

  const [profileData, setProfileData] = useState({
    name: "",
    country: "",
    state: "",
    city: "",
    postalCode: "",
    phone: "",
    level2Field1: "",
    level2Field2: "",
    profilePicture: "",
    countryOfBirth: "",
  });

  // Referrer state — populated from `GET /profile.referredBy` and mutable
  // via POST /affiliate/change-referrer while `profileComplete === false`.
  // See services/affiliate.ts::isInMyDownline for cycle-check semantics.
  const [profileComplete, setProfileComplete] = useState<boolean>(false);
  const [referrer, setReferrer] = useState<{
    id: string;
    name: string;
    email: string;
    profilePicture: string;
  } | null>(null);
  const [referrerEditing, setReferrerEditing] = useState(false);
  const [referrerEmailInput, setReferrerEmailInput] = useState("");
  const [referrerSaving, setReferrerSaving] = useState(false);

  // ── Referrer lookup ──────────────────────────────────────────────────
  // Typing an email blind is the worst part of onboarding: /change-referrer
  // only tells you the address was wrong *after* you submit. So we search
  // live against GET /unilevel-plus/users/search and show who you're about
  // to attach to before the Save button is pressed.
  const [referrerResults, setReferrerResults] = useState<ReferrerSuggestion[]>([]);
  const [referrerSearching, setReferrerSearching] = useState(false);
  const [referrerSearched, setReferrerSearched] = useState(false);
  const [showReferrerSuggestions, setShowReferrerSuggestions] = useState(false);
  // Set when a suggestion is clicked. Cleared on any further typing so the
  // preview can't go stale against the input it claims to describe.
  const [pickedReferrer, setPickedReferrer] = useState<ReferrerSuggestion | null>(null);
  const [referrerActiveIndex, setReferrerActiveIndex] = useState(-1);
  const referrerSearchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const referrerSearchSeqRef = useRef(0);

  const { settings, loading: settingsLoading, updating, toggleEmailPreference } = useSettings();

  const [postalCodeLoading, setPostalCodeLoading] = useState(false);
  const [postalCodeError, setPostalCodeError] = useState("");
  const postalCodeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const desktopPhotoInputRef = useRef<HTMLInputElement>(null);
  const [countrySheetOpen, setCountrySheetOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  // Which field the shared mobile country drawer is filling in.
  const [countrySheetTarget, setCountrySheetTarget] = useState<
    "residence" | "birth"
  >("residence");
  // Desktop-only inline autocomplete (mobile uses the bottom drawer)
  const [showCountrySuggestions, setShowCountrySuggestions] = useState(false);
  // Keyboard-highlighted row in that dropdown. -1 = nothing highlighted, so
  // Enter falls through to whatever the user actually typed.
  const [countryActiveIndex, setCountryActiveIndex] = useState(-1);
  const countryListRef = useRef<HTMLDivElement>(null);

  // Phone code country & local states
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<any>(null);
  const [phoneLocal, setPhoneLocal] = useState("");
  const [showPhoneCodeDropdown, setShowPhoneCodeDropdown] = useState(false);
  const [phoneCodeSheetOpen, setPhoneCodeSheetOpen] = useState(false);
  const [phoneCodeSearch, setPhoneCodeSearch] = useState("");
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

  // Keeps the dashboard's "Verify your phone" nudge in sync when the
  // number is verified from inside this modal.
  const updateUser = useAuthStore((s) => s.updateUser);
  // `user` comes from the parent's member row, which isn't refetched when
  // AssociateAccountCard saves an email for a phone signup — the store is.
  const storeEmail = useAuthStore((s) => s.user?.email);
  const displayEmail = user.email || storeEmail || "";

  // ── Phone OTP verification (signup profile setup) ────────────────────
  // First-time users must verify the number they type here before
  // "Complete Profile" unlocks. `verifiedPhone` holds the exact E.164
  // string that was verified, so editing the number re-locks the gate.
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    user?.phoneVerified && user?.phone ? user.phone : null
  );
  // "Send OTP" in the profile form fires the code and opens this dialog,
  // where the user types it in.
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [phoneOtpCode, setPhoneOtpCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  // The number as the API wants it: "+<code><local>", no spaces.
  const phoneE164 = `+${selectedPhoneCountry?.phonecode || "1"}${phoneLocal.trim()}`;
  const phoneIsVerified =
    !!verifiedPhone &&
    verifiedPhone.replace(/\s+/g, "") === phoneE164.replace(/\s+/g, "");

  // Editing the number (or its country code) invalidates a prior code.
  useEffect(() => {
    setPhoneOtpCode("");
  }, [phoneLocal, selectedPhoneCountry?.phonecode]);

  const handleSendOtp = async () => {
    if (!phoneLocal.trim()) return;
    setOtpSending(true);
    try {
      await api("/auth/phone/request-otp", {
        method: "POST",
        // Both channels: the backend defaults to SMS alone for older clients,
        // and attempts each independently so one provider failing can't
        // swallow a code the other delivered.
        body: JSON.stringify({ phone: phoneE164, channel: "both" }),
      });
      toast.success("OTP sent by WhatsApp and SMS");
      setPhoneOtpCode("");
      setVerifyDialogOpen(true);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (phoneOtpCode.trim().length < 4) return;
    setOtpVerifying(true);
    try {
      const data = await api<{ phone: string; phoneVerified: boolean }>(
        "/auth/phone/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ phone: phoneE164, code: phoneOtpCode.trim() }),
        }
      );
      setVerifiedPhone(data?.phone || phoneE164);
      setPhoneOtpCode("");
      setVerifyDialogOpen(false);
      // Publish to the auth store as well — the dashboard's
      // "Verify your phone" nudge hides on `user.phoneVerified`, and
      // without this it keeps nagging someone who just verified here.
      updateUser({ phone: data?.phone || phoneE164, phoneVerified: true });
      toast.success("Phone verified");
    } catch (err: any) {
      toast.error(err?.message || "Verification failed");
    } finally {
      setOtpVerifying(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        phoneDropdownRef.current &&
        !phoneDropdownRef.current.contains(event.target as Node)
      ) {
        setShowPhoneCodeDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredPhoneCountries = useMemo(() => {
    const all = phoneCountries();
    if (!phoneCodeSearch.trim()) return all;
    const q = phoneCodeSearch.toLowerCase();
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phonecode.includes(q) ||
        c.isoCode.toLowerCase().includes(q)
    );
  }, [phoneCodeSearch]);

  // Full ICountry records, not bare names — the pickers render `flag`
  // alongside `name`, and selecting one carries `phonecode`/`isoCode`
  // straight into the phone-code field without a second lookup.
  const allCountries = useMemo(() => {
    return [...phoneCountries()].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, []);

  // Drawer list — driven by the drawer's own search field
  const filteredCountrySuggestions = useMemo(() => {
    if (!countrySearch.trim()) return allCountries;
    const q = countrySearch.toLowerCase();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q)
    );
  }, [countrySearch, allCountries]);

  // Desktop inline list — driven by the typed country value
  const desktopCountrySuggestions = useMemo(() => {
    if (!profileData.country.trim()) return allCountries;
    const q = profileData.country.toLowerCase();
    return allCountries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.isoCode.toLowerCase().includes(q)
    );
  }, [profileData.country, allCountries]);

  // Flag for whatever's currently in `profileData.country` — rendered next
  // to the field so a chosen country is recognisable at a glance. Null while
  // the user is mid-type on a value that doesn't resolve to a country yet.
  const selectedCountry = useMemo(() => {
    const q = profileData.country.trim().toLowerCase();
    if (!q) return null;
    return allCountries.find((c) => c.name.toLowerCase() === q) || null;
  }, [profileData.country, allCountries]);

  const selectedBirthCountry = useMemo(() => {
    const q = profileData.countryOfBirth.trim().toLowerCase();
    if (!q) return null;
    return allCountries.find((c) => c.name.toLowerCase() === q) || null;
  }, [profileData.countryOfBirth, allCountries]);

  // Typing filters the list, so any previous highlight points at a different
  // country now — drop it rather than let Enter pick something unseen.
  useEffect(() => {
    setCountryActiveIndex(-1);
  }, [profileData.country]);

  // Keep the highlighted row inside the scroll viewport.
  useEffect(() => {
    if (countryActiveIndex < 0) return;
    const list = countryListRef.current;
    const item = list?.children[countryActiveIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [countryActiveIndex]);

  const applyCountry = (country: (typeof allCountries)[number]) => {
    setProfileData((prev) => ({ ...prev, country: country.name }));
    setShowCountrySuggestions(false);
    setCountryActiveIndex(-1);
    setSelectedPhoneCountry(country);
  };

  /**
   * Arrow / Enter / Escape on the desktop country field.
   *
   * ArrowDown opens the list when it's closed, so the keyboard alone can
   * reach it. Enter only commits when a row is actually highlighted —
   * otherwise it's left alone so it can still submit the form.
   */
  const handleCountryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = desktopCountrySuggestions;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!showCountrySuggestions) {
        setShowCountrySuggestions(true);
        setCountryActiveIndex(e.key === "ArrowDown" ? 0 : list.length - 1);
        return;
      }
      if (!list.length) return;
      setCountryActiveIndex((prev) => {
        if (e.key === "ArrowDown") return prev >= list.length - 1 ? 0 : prev + 1;
        return prev <= 0 ? list.length - 1 : prev - 1;
      });
      return;
    }

    if (e.key === "Home" && showCountrySuggestions && list.length) {
      e.preventDefault();
      setCountryActiveIndex(0);
      return;
    }
    if (e.key === "End" && showCountrySuggestions && list.length) {
      e.preventDefault();
      setCountryActiveIndex(list.length - 1);
      return;
    }

    if (e.key === "Enter") {
      if (showCountrySuggestions && countryActiveIndex >= 0 && list[countryActiveIndex]) {
        e.preventDefault();
        applyCountry(list[countryActiveIndex]);
      }
      return;
    }

    if (e.key === "Escape") {
      if (showCountrySuggestions) {
        e.preventDefault();
        setShowCountrySuggestions(false);
        setCountryActiveIndex(-1);
      }
      return;
    }

    // Tab commits the highlighted row on the way out — matches how the
    // native datalist-ish controls elsewhere in this form behave.
    if (e.key === "Tab" && showCountrySuggestions && countryActiveIndex >= 0) {
      if (list[countryActiveIndex]) applyCountry(list[countryActiveIndex]);
    }
  };

  const openCountrySheet = (target: "residence" | "birth" = "residence") => {
    setCountrySearch("");
    setCountrySheetTarget(target);
    setCountrySheetOpen(true);
  };

  const selectCountry = (country: { name: string }) => {
    if (countrySheetTarget === "birth") {
      setProfileData((prev) => ({ ...prev, countryOfBirth: country.name }));
      setCountrySheetOpen(false);
      return;
    }
    setProfileData((prev) => ({ ...prev, country: country.name }));
    setCountrySheetOpen(false);

    // Auto-update phone country code
    const match = allCountries.find(
      (c) => c.name.toLowerCase() === country.name.toLowerCase()
    );
    if (match) {
      setSelectedPhoneCountry(match);
    }
  };

  // Direct-to-S3 upload. Replaces the earlier UploadThing hook — same
  // callback shape (`onSuccess → setProfileData`, `onError → toast`) so
  // the callsite (`await startUpload([file])`) can swap 1:1.
  //
  // Legacy profile pictures uploaded via UploadThing continue to render
  // because `profileData.profilePicture` is just a URL string; the
  // <img src={...}> below doesn't care where the file physically lives.
  const startUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const publicUrl = await uploadProfilePictureToS3(file);
      setProfileData((prev) => ({ ...prev, profilePicture: publicUrl }));
      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to upload photo"
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const [accountStatus, setAccountStatus] = useState<{
    canDeleteAccount: boolean;
    canLeaveCurrentOrg: boolean;
    isFounderOfCurrentOrg: boolean;
    founderOf: Array<{ id: string; name: string }>;
  } | null>(null);

  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLeavingOrg, setIsLeavingOrg] = useState(false);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"confirm" | "otp">("confirm");
  const [otpCode, setOtpCode] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProfileData();
    }
  }, [isOpen]);

  const resolvePostalCode = async (pincode: string) => {
    if (pincode.length < 3) {
      setPostalCodeError("");
      return;
    }
    setPostalCodeLoading(true);
    setPostalCodeError("");
    try {
      const params = new URLSearchParams({ pincode });
      if (profileData.country.trim()) {
        params.append("country", profileData.country.trim());
      }
      const res = await api<{
        city: string;
        state: string;
        country: string;
        latitude: number;
        longitude: number;
      }>(`/org/resolve-pincode?${params.toString()}`, {
        method: "GET",
      });
      setProfileData((prev) => ({
        ...prev,
        city: res.city || "",
        state: res.state || "",
      }));
    } catch {
      setProfileData((prev) => {
        if (!prev.city && !prev.state) {
          setPostalCodeError("Could not resolve postal code. Please fill manually.");
        }
        return prev;
      });
    } finally {
      setPostalCodeLoading(false);
    }
  };

  const handlePostalCodeChange = (value: string) => {
    setProfileData((prev) => ({ ...prev, postalCode: value }));
    if (postalCodeTimerRef.current) clearTimeout(postalCodeTimerRef.current);
    if (value.length >= 3) {
      postalCodeTimerRef.current = setTimeout(() => {
        resolvePostalCode(value);
      }, 800);
    }
  };

  const fetchProfileData = async () => {
    try {
      const response = await api<{
        name: string;
        email: string;
        country: string;
        state: string;
        city: string;
        postalCode: string;
        phone: string;
        level2Field1: string;
        level2Field2: string;
        profilePicture: string;
        profileComplete: boolean;
        referredBy: {
          id: string;
          name: string;
          email: string;
          profilePicture: string;
        } | null;
      }>(`/profile?userId=${user.id}`, {
        method: "GET",
      });

      setProfileData((prev) => ({
        ...prev,
        name: response.name || "",
        country: response.country || "",
        state: response.state || "",
        city: response.city || "",
        postalCode: response.postalCode || "",
        phone: response.phone || "",
        level2Field1: response.level2Field1 || "",
        level2Field2: response.level2Field2 || "",
        profilePicture: response.profilePicture || "",
      }));

      setProfileComplete(!!response.profileComplete);
      setReferrer(response.referredBy || null);

      const { country, localNumber } = parsePhone(
        response.phone || "",
        response.country || ""
      );
      setSelectedPhoneCountry(country);
      setPhoneLocal(localNumber);

      if (isBat246) {
        try {
          const cob = await api<{ countryOfBirth: string }>(
            "/bat246/profile/country-of-birth",
            { method: "GET" }
          );
          setProfileData((prev) => ({ ...prev, countryOfBirth: cob.countryOfBirth || "" }));
        } catch {
          // Non-fatal — field just starts blank.
        }
      }
    } catch {
      setProfileData((prev) => ({
        ...prev,
        name: user.name || "",
        country: "",
        state: "",
        city: "",
        postalCode: "",
        phone: "",
        level2Field1: "",
        level2Field2: "",
        profilePicture: "",
      }));
      setProfileComplete(false);
      setReferrer(null);

      const { country, localNumber } = parsePhone("", "");
      setSelectedPhoneCountry(country);
      setPhoneLocal("");
    }
  };

  // Debounced referrer lookup. The endpoint itself ignores queries under 2
  // chars, so we don't even fire below that. `referrerSearchSeqRef` drops
  // out-of-order responses — a slow "jo" must not overwrite "john@".
  useEffect(() => {
    if (referrerSearchTimerRef.current) {
      clearTimeout(referrerSearchTimerRef.current);
    }
    const query = referrerEmailInput.trim();
    if (!referrerEditing || query.length < 2) {
      setReferrerResults([]);
      setReferrerSearching(false);
      setReferrerSearched(false);
      return;
    }
    setReferrerSearching(true);
    referrerSearchTimerRef.current = setTimeout(async () => {
      const seq = ++referrerSearchSeqRef.current;
      try {
        const response = await api<{
          success: boolean;
          users: ReferrerSuggestion[];
        }>(`/unilevel-plus/users/search?q=${encodeURIComponent(query)}`, {
          method: "GET",
        });
        if (seq !== referrerSearchSeqRef.current) return;
        setReferrerResults(response?.users || []);
      } catch {
        if (seq !== referrerSearchSeqRef.current) return;
        setReferrerResults([]);
      } finally {
        if (seq === referrerSearchSeqRef.current) {
          setReferrerSearching(false);
          setReferrerSearched(true);
        }
      }
    }, 300);

    return () => {
      if (referrerSearchTimerRef.current) {
        clearTimeout(referrerSearchTimerRef.current);
      }
    };
  }, [referrerEmailInput, referrerEditing]);

  /**
   * Who the Save button would actually attach — either the suggestion that
   * was clicked, or an exact email match from the current results. A partial
   * match doesn't count: showing a card for someone the user hasn't fully
   * typed would misrepresent what Save does.
   */
  const referrerPreview = useMemo<ReferrerSuggestion | null>(() => {
    const typed = referrerEmailInput.trim().toLowerCase();
    if (!typed) return null;
    if (pickedReferrer && pickedReferrer.email.toLowerCase() === typed) {
      return pickedReferrer;
    }
    return (
      referrerResults.find((u) => u.email.toLowerCase() === typed) || null
    );
  }, [referrerEmailInput, pickedReferrer, referrerResults]);

  const resetReferrerSearch = () => {
    if (referrerSearchTimerRef.current) {
      clearTimeout(referrerSearchTimerRef.current);
    }
    referrerSearchSeqRef.current++;
    setReferrerEmailInput("");
    setReferrerResults([]);
    setReferrerSearching(false);
    setReferrerSearched(false);
    setShowReferrerSuggestions(false);
    setPickedReferrer(null);
    setReferrerActiveIndex(-1);
  };

  const beginReferrerEdit = () => {
    resetReferrerSearch();
    setReferrerEditing(true);
  };

  const cancelReferrerEdit = () => {
    resetReferrerSearch();
    setReferrerEditing(false);
  };

  const handleReferrerInputChange = (value: string) => {
    setReferrerEmailInput(value);
    setPickedReferrer(null);
    setShowReferrerSuggestions(true);
    setReferrerActiveIndex(-1);
  };

  const pickReferrerSuggestion = (u: ReferrerSuggestion) => {
    setReferrerEmailInput(u.email);
    setPickedReferrer(u);
    setShowReferrerSuggestions(false);
    setReferrerActiveIndex(-1);
  };

  // Same keyboard contract as the country field. Enter with nothing
  // highlighted stays a plain "save what I typed".
  const handleReferrerKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = referrerResults;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!list.length) return;
      e.preventDefault();
      if (!showReferrerSuggestions) {
        setShowReferrerSuggestions(true);
        setReferrerActiveIndex(e.key === "ArrowDown" ? 0 : list.length - 1);
        return;
      }
      setReferrerActiveIndex((prev) => {
        if (e.key === "ArrowDown") return prev >= list.length - 1 ? 0 : prev + 1;
        return prev <= 0 ? list.length - 1 : prev - 1;
      });
      return;
    }

    if (e.key === "Enter") {
      if (showReferrerSuggestions && referrerActiveIndex >= 0 && list[referrerActiveIndex]) {
        e.preventDefault();
        pickReferrerSuggestion(list[referrerActiveIndex]);
      }
      return;
    }

    if (e.key === "Escape" && showReferrerSuggestions) {
      e.preventDefault();
      setShowReferrerSuggestions(false);
      setReferrerActiveIndex(-1);
    }
  };

  // Submit a new referrer email — hits POST /affiliate/change-referrer.
  // BE gates on `profileComplete === false`, validates the target exists
  // as a Garage user, blocks self + downline cycles. See
  // routes/affiliate.ts::/change-referrer.
  const handleChangeReferrer = async () => {
    const email = referrerEmailInput.trim();
    if (!email) {
      toast.error("Enter a valid email");
      return;
    }
    setReferrerSaving(true);
    try {
      const response = await api<{
        success: boolean;
        referrer: {
          id: string;
          name: string;
          email: string;
          profilePicture: string;
        };
      }>("/affiliate/change-referrer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (response?.success && response.referrer) {
        setReferrer(response.referrer);
        setReferrerEditing(false);
        resetReferrerSearch();
        toast.success("Referrer updated");
      } else {
        toast.error("Failed to update referrer");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to update referrer");
    } finally {
      setReferrerSaving(false);
    }
  };

  /**
   * Everything "Complete Profile" is gated on, in the order the form
   * presents it — so the first miss we scroll to is also the topmost one.
   */
  const missingFields = useMemo(() => {
    const out: { field: string; label: string }[] = [];
    if (!profileData.name?.trim()) out.push({ field: "name", label: "your full name" });
    if (!phoneLocal.trim()) out.push({ field: "phone", label: "your phone number" });
    if (isFirstTimeUser && !phoneIsVerified)
      out.push({ field: "phone", label: "phone verification — tap Send OTP" });
    if (!profileData.country?.trim()) out.push({ field: "country", label: "your country" });
    if (!profileData.city?.trim()) out.push({ field: "city", label: "your city" });
    if (!profileData.state?.trim()) out.push({ field: "state", label: "your state" });
    if (isBat246 && !profileData.countryOfBirth?.trim())
      out.push({ field: "countryOfBirth", label: "your country of birth / ethnic background" });
    return out;
  }, [
    profileData.name,
    profileData.country,
    profileData.city,
    profileData.state,
    profileData.countryOfBirth,
    isBat246,
    phoneLocal,
    isFirstTimeUser,
      phoneIsVerified,
  ]);

  /**
   * Save, or — when something's still blank — take the user to it.
   *
   * The button stays enabled on an incomplete form on purpose: a dead
   * button tells you nothing, and the fields it's waiting on are often
   * scrolled out of view. Both layouts (mobile sheet + desktop dialog)
   * render the same field twice, so we pick whichever copy is actually
   * on screen (`offsetParent` is null for the hidden one).
   */
  const attemptSave = () => {
    if (isSubmitting) return;
    const miss = missingFields[0];
    if (!miss) {
      void saveProfile();
      return;
    }
    const visible = Array.from(
      document.querySelectorAll<HTMLElement>(`[data-field="${miss.field}"]`),
    ).find((el) => el.offsetParent !== null);
    visible?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Focus after the scroll settles, else the browser yanks it back.
    setTimeout(() => visible?.focus({ preventScroll: true }), 350);
    toast.error(
      missingFields.length > 1
        ? `Still needed: ${miss.label} (+${missingFields.length - 1} more)`
        : `Still needed: ${miss.label}`,
    );
  };

  const saveProfile = async () => {
    if (phoneLocal.trim()) {
      const phoneDigits = phoneLocal.trim().replace(/\D/g, "");
      const globalPhoneRegex = /^[0-9]{7,15}$/;
      if (!globalPhoneRegex.test(phoneDigits)) {
        toast.error("Please enter a valid phone number (7 to 15 digits)");
        return;
      }
    }

    try {
      const orgId = localStorage.getItem("garage_org_id");
      setIsSubmitting(true);
      
      const formattedPhone = phoneLocal.trim()
        ? (selectedPhoneCountry
          ? `+${selectedPhoneCountry.phonecode} ${phoneLocal.trim()}`
          : phoneLocal.trim())
        : "";

      await api<{
        message: string;
        profileComplete: boolean;
      }>("/profile" + (orgId ? "?orgId=" + orgId : ""), {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          name: profileData.name,
          country: profileData.country,
          state: profileData.state,
          city: profileData.city,
          postalCode: profileData.postalCode,
          phone: formattedPhone,
          level2Field1: profileData.level2Field1,
          level2Field2: profileData.level2Field2,
          profilePicture: profileData.profilePicture,
          isFirstTimeUser: isFirstTimeUser,
        }),
      });

      if (isBat246) {
        await api("/bat246/profile/country-of-birth", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${getToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ countryOfBirth: profileData.countryOfBirth }),
        });
      }

      onClose();

      if (isFirstTimeUser && onProfileComplete) {
        onProfileComplete();
      }

      toast.success("Profile saved successfully!");
    } catch (error: any) {
      console.error("Error saving profile:", error);
      toast.error(error?.message || "Failed to save profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const emailNotificationSections: Array<{
    id: string;
    title: string;
    items: Array<{
      key: string;
      title: string;
      description: string;
    }>;
  }> = [
    {
      id: "global-emails",
      title: "Global Emails",
      items: [
        {
          key: "globalNewOfficeJoinsGarage",
          title: "New office joins Garage",
          description: "Get notified when a new office joins Garage.",
        },
        {
          key: "globalNewOfferReleased",
          title: "New offer released by any office",
          description: "Get notified when any office releases a new offer.",
        },
        {
          key: "globalNewPersonJoinsGarage",
          title: "New person joins Garage",
          description: "Get notified when a new person joins Garage.",
        },
      ],
    },
    {
      id: "office-fixed-emails",
      title: "Office Fixed Emails",
      items: [
        {
          key: "officeCommunityPost",
          title: "Community posts in your office",
          description:
            "Get notified when a new post is made in one of the communities you're in.",
        },
        {
          key: "officeNewOffer",
          title: "New offer in this office",
          description: "Get notified when a new offer is made by this office.",
        },
        {
          key: "officeNewMember",
          title: "New member in this office",
          description: "Get notified when someone joins this office.",
        },
      ],
    },
    {
      id: "affiliate-emails",
      title: "Affiliate Emails",
      items: [
        {
          key: "affiliateDownlineRegistration",
          title: "Downline registrations",
          description: "Get notified when someone registers in your downline.",
        },
        {
          key: "affiliateDirectReferralRegistration",
          title: "Direct referral registrations",
          description: "Get notified when a direct referral registers.",
        },
        {
          key: "affiliateCommissionEarned",
          title: "Commission earned",
          description: "Get notified whenever you earn a commission.",
        },
        {
          key: "affiliateDownlinePurchase",
          title: "Downline purchases",
          description: "Get notified whenever someone in your downline buys something.",
        },
      ],
    },
  ];

  const fetchAccountStatus = async () => {
    try {
      const response = await api<{
        success: boolean;
        canDeleteAccount: boolean;
        canLeaveCurrentOrg: boolean;
        isFounderOfCurrentOrg: boolean;
        founderOf: Array<{ id: string; name: string }>;
      }>("/auth/account/status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (response.success) {
        setAccountStatus({
          canDeleteAccount: response.canDeleteAccount,
          canLeaveCurrentOrg: response.canLeaveCurrentOrg,
          isFounderOfCurrentOrg: response.isFounderOfCurrentOrg,
          founderOf: response.founderOf || [],
        });
      }
    } catch (error) {
      console.error("Error fetching account status:", error);
    }
  };

  const handleLeaveOrg = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;

    setIsLeavingOrg(true);
    try {
      await api(`/org/${orgId}/leave`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      toast.success("Successfully left the organization");
      setShowLeaveDialog(false);
      clearToken();
      router.push("/select-organization");
    } catch (error: any) {
      toast.error(error?.message || "Failed to leave organization");
    } finally {
      setIsLeavingOrg(false);
    }
  };

  const handleRequestDeletionOtp = async () => {
    setIsRequestingOtp(true);
    try {
      await api("/auth/account/deletion-request", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      toast.success("Verification code sent to your email");
      setDeleteStep("otp");
    } catch (error: any) {
      toast.error(error?.message || "Failed to send verification code");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code");
      return;
    }

    setIsDeletingAccount(true);
    try {
      await api("/auth/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          confirmation: "DELETE_MY_ACCOUNT",
          verificationCode: otpCode,
        }),
      });

      toast.success("Account deleted successfully");
      clearToken();
      router.push("/");
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete account");
    } finally {
      setIsDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (isOpen && !isFirstTimeUser) {
      fetchAccountStatus();
    }
  }, [isOpen, isFirstTimeUser]);

  const pinCodeResolved =
    !!profileData.city &&
    !postalCodeLoading &&
    !postalCodeError &&
    profileData.postalCode.length >= 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment key="profile-modal">
          {/* Overlay */}
          <motion.div
            key="profile-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] hidden md:block"
            onClick={isFirstTimeUser ? undefined : onClose}
          />

          {/* Profile Popover */}
          <motion.div
            key="profile-popover"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "fixed top-0 left-0 right-0 bottom-0 md:inset-auto md:top-1/2 md:left-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 z-[1000] bg-black md:bg-[#0e0e12]/98 md:border md:border-[#2a2a35] md:backdrop-blur-xl md:rounded-xl md:shadow-2xl flex flex-col md:h-auto overflow-hidden",
              isBat246Boards
                ? // zoom (not font-size) so the many fixed-px text sizes scale
                  // too; max-w/h are pre-divided by 1.1 to stay inside 90%.
                  "md:w-6xl md:max-w-[81vw] md:max-h-[81vh] md:[zoom:1.1]"
                : "md:w-4xl md:max-w-[90vw] md:max-h-[90vh]"
            )}
          >
            {/* Mobile Header */}
            <div className="flex md:hidden items-center justify-between px-4 py-3 pt-[calc(env(safe-area-inset-top)+12px)] bg-black flex-shrink-0">
              {!isFirstTimeUser ? (
                <button
                  onClick={onClose}
                  className="text-brand-2 text-[17px] font-normal active:opacity-70 transition-opacity"
                >
                  Cancel
                </button>
              ) : (
                <div className="w-16"></div>
              )}
              <span className="text-white text-[17px] font-semibold">Profile</span>
              <button
                onClick={attemptSave}
                // Stays enabled on an incomplete form — attemptSave scrolls
                // to the first blank field instead of silently doing nothing.
                disabled={isSubmitting}
                className="text-brand-2 text-[17px] font-semibold active:opacity-70 transition-opacity disabled:opacity-40 disabled:text-[#6a6a7a]"
              >
                {isSubmitting ? "Saving..." : "Done"}
              </button>
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block p-4 border-b border-[#2a2a35]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Profile</h3>
                    <p
                      className={cn(
                        "text-[#9fa0b8]",
                        isBat246Boards ? "text-[14.7px]" : "text-sm"
                      )}
                    >
                      {isFirstTimeUser
                        ? "Complete your profile to continue"
                        : "Update your information"}
                    </p>
                  </div>
                </div>
                {!isFirstTimeUser && (
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-[#1a1a22] hover:bg-[#2a2a35] flex items-center justify-center transition-all duration-200 hover:scale-105"
                  >
                    <X className="h-4 w-4 text-[#6a6a7a]" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
              {/* Placed above the form, not below it: someone who signed in by
                  phone and landed in a brand-new account needs the way back to
                  their real one BEFORE they start filling this in. The card
                  renders itself only for an account with a verified phone and
                  no email — i.e. one that could actually be a throwaway. */}
              <div className="px-4 pt-4">
                <AssociateAccountCard onDone={onClose} />
              </div>

              {/* Mobile Profile Picture */}
              <div className="flex md:hidden flex-col items-center pt-2 pb-4">
                <div className="relative">
                  <label className="block w-20 h-20 rounded-full overflow-hidden bg-[#1a1a22] border-2 border-[#2a2a35] cursor-pointer">
                    {profileData.profilePicture ? (
                      <img
                        src={profileData.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="h-8 w-8 text-[#6a6a7a]" />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingPhoto}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error("File size must be less than 2MB");
                          return;
                        }
                        await startUpload([file]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {profileData.profilePicture && (
                    <button
                      onClick={() =>
                        setProfileData((prev) => ({ ...prev, profilePicture: "" }))
                      }
                      className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center z-10"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                  )}
                  <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-brand-2 rounded-full flex items-center justify-center pointer-events-none">
                    <Camera className="h-3 w-3 text-brand-foreground" />
                  </div>
                </div>
                {isUploadingPhoto && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Loader2 className="h-3 w-3 animate-spin text-brand-2" />
                    <span className="text-xs text-[#6a6a7a]">Uploading...</span>
                  </div>
                )}
              </div>

              {/* ═══ MOBILE FORM ═══ */}
              <div className="md:hidden px-4 space-y-3 pb-[calc(env(safe-area-inset-bottom)+32px)]">
                {/* Name + Email Card */}
                <div className="bg-[#1a1a22] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2a2a35]/40 flex items-center gap-3">
                    <User className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                    <Input
                      value={profileData.name}
                      onChange={(e) =>
                        setProfileData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      className="h-auto p-0 bg-transparent border-0 text-white text-[15px] placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      data-field="name" placeholder="Full Name"
                    />
                  </div>
                  <div className="px-4 py-2.5 flex items-center gap-3">
                    <Mail className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                    <span className="text-[15px] text-[#6a6a7a] truncate">{displayEmail || "No email on this account"}</span>
                  </div>
                </div>

                {/* Phone + Country + Pin Code Card */}
                <div className="bg-[#1a1a22] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#2a2a35]/40 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPhoneCodeSearch("");
                        setPhoneCodeSheetOpen(true);
                      }}
                      className="flex items-center gap-1.5 text-white active:opacity-70 transition-opacity flex-shrink-0"
                    >
                      <span className="text-lg leading-none">{selectedPhoneCountry?.flag || "🇺🇸"}</span>
                      <span className="text-[15px] font-semibold text-white">+{selectedPhoneCountry?.phonecode || "1"}</span>
                      <ChevronDown className="h-3.5 w-3.5 text-[#6a6a7a] flex-shrink-0" />
                    </button>
                    <div className="w-px h-5 bg-[#2a2a35]/40 flex-shrink-0" />
                    <input
                      value={phoneLocal}
                      onChange={(e) => {
                        const sanitizedPhone = e.target.value
                          .replace(/[^0-9]/g, "")
                          .slice(0, 15);
                        setPhoneLocal(sanitizedPhone);
                      }}
                      className="h-auto w-full p-0 bg-transparent border-0 text-white text-[15px] placeholder-[#6a6a7a] focus:outline-none"
                      data-field="phone" placeholder="Phone Number"
                    />
                  </div>
                  {(isFirstTimeUser || phoneLocal.trim()) && (
                    <div className="px-4 py-2.5 border-b border-[#2a2a35]/40">
                      <PhoneVerifyTrigger
                        isFirstTimeUser={isFirstTimeUser}
                        phoneLocal={phoneLocal}
                        phoneIsVerified={phoneIsVerified}
                        otpSending={otpSending}
                        onSend={handleSendOtp}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => openCountrySheet("residence")}
                    className="w-full px-4 py-2.5 border-b border-[#2a2a35]/40 flex items-center gap-3 text-left"
                  >
                    {selectedCountry ? (
                      <span className="text-lg leading-none flex-shrink-0">
                        {selectedCountry.flag}
                      </span>
                    ) : (
                      <MapPin className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        "flex-1 text-[15px] truncate",
                        profileData.country ? "text-white" : "text-[#6a6a7a]"
                      )}
                    >
                      {profileData.country || "Select country"}
                    </span>
                    <ChevronDown className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                  </button>
                  <div className="px-4 py-2.5 flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                    <Input
                      value={profileData.postalCode}
                      onChange={(e) => handlePostalCodeChange(e.target.value)}
                      className="h-auto p-0 bg-transparent border-0 text-white text-[15px] placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                      placeholder="Postal Code"
                    />
                    {postalCodeLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-2 flex-shrink-0" />
                    )}
                    {pinCodeResolved && (
                      <Check className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    )}
                  </div>
                  {postalCodeError && (
                    <p className="text-[11px] text-red-400 px-4 pb-2 pl-11">{postalCodeError}</p>
                  )}
                </div>

                {/* Country of Birth Card — BAT246-only, see isBat246 above. */}
                {isBat246 && (
                  <div className="bg-[#1a1a22] rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5">
                      <p className="text-[9px] text-[#6a6a7a] uppercase tracking-wider mb-1">Country of Birth / Ethnic Background</p>
                      <button
                        type="button"
                        data-field="countryOfBirth"
                        onClick={() => openCountrySheet("birth")}
                        className="w-full flex items-center gap-3 text-left"
                      >
                        {selectedBirthCountry ? (
                          <span className="text-lg leading-none flex-shrink-0">
                            {selectedBirthCountry.flag}
                          </span>
                        ) : (
                          <MapPin className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            "flex-1 text-[15px] truncate",
                            profileData.countryOfBirth ? "text-white" : "text-[#6a6a7a]"
                          )}
                        >
                          {profileData.countryOfBirth || "Select country"}
                        </span>
                        <ChevronDown className="h-4 w-4 text-[#6a6a7a] flex-shrink-0" />
                      </button>
                    </div>
                  </div>
                )}

                {/* City + State Card */}
                <div className="bg-[#1a1a22] rounded-xl overflow-hidden">
                  <div className="grid grid-cols-2 divide-x divide-[#2a2a35]/40">
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] text-[#6a6a7a] uppercase tracking-wider mb-1">City</p>
                      <Input
                        value={profileData.city}
                        onChange={(e) =>
                          setProfileData((prev) => ({ ...prev, city: e.target.value }))
                        }
                        className="h-auto p-0 bg-transparent border-0 text-white text-[13px] placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="City"
                      />
                    </div>
                    <div className="px-3 py-2.5">
                      <p className="text-[9px] text-[#6a6a7a] uppercase tracking-wider mb-1">State</p>
                      <Input
                        value={profileData.state}
                        onChange={(e) =>
                          setProfileData((prev) => ({ ...prev, state: e.target.value }))
                        }
                        className="h-auto p-0 bg-transparent border-0 text-white text-[13px] placeholder-[#6a6a7a] focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="State"
                      />
                    </div>
                  </div>
                  {pinCodeResolved && (
                    <div className="px-3 pb-2 flex items-center gap-1">
                      <Check className="h-2.5 w-2.5 text-emerald-500" />
                      <span className="text-[10px] text-emerald-500/70">Location resolved</span>
                    </div>
                  )}
                </div>

                {/* Email Notifications — hidden in profile setup for now.
                    Kept in place (not deleted) so it can be switched back on
                    without rebuilding the settings wiring. */}
                {false && (
                <div className="pt-4 space-y-3">
                  <p className="text-[10px] text-[#6a6a7a] uppercase tracking-wider px-1 font-medium">
                    Email Notifications
                  </p>
                  <div className="space-y-3">
                    {emailNotificationSections.map((section) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-[10px] text-[#8f90a8] uppercase tracking-wider px-1 font-medium">
                          {section.title}
                        </p>
                        {section.items.length > 0 ? (
                          <div className="bg-[#1a1a22] rounded-xl overflow-hidden divide-y divide-[#2a2a35]/40">
                            {section.items.map((item) => (
                              <div
                                key={item.key}
                                className="px-4 py-3 flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <p className="text-[13px] text-white font-medium">{item.title}</p>
                                  <p className="text-[11px] text-[#8f90a8] mt-0.5 leading-relaxed">
                                    {item.description}
                                  </p>
                                </div>
                                <Switch
                                  checked={settings?.emailPreferences[item.key] ?? true}
                                  disabled={updating || settingsLoading}
                                  onCheckedChange={(checked) =>
                                    toggleEmailPreference(item.key, checked)
                                  }
                                  className="data-[state=checked]:bg-brand-2 data-[state=unchecked]:bg-[#2a2a35] mt-0.5"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-[#1a1a22] rounded-xl border border-[#2a2a35]/50 px-4 py-3">
                            <p className="text-[11px] text-[#8f90a8]">
                              No dynamic office email automations are configured yet.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* Account Management - Mobile */}
                {!isFirstTimeUser && accountStatus && (
                  <div className="pt-4 space-y-3">
                    <p className="text-[10px] text-[#6a6a7a] uppercase tracking-wider px-1 font-medium">
                      Account
                    </p>
                    <div className="bg-[#1a1a22] rounded-xl overflow-hidden divide-y divide-[#2a2a35]/40">
                      <button
                        onClick={() => accountStatus.canLeaveCurrentOrg && setShowLeaveDialog(true)}
                        disabled={!accountStatus.canLeaveCurrentOrg}
                        className="w-full px-4 py-3 flex items-center justify-between text-left disabled:opacity-40"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut className="h-4 w-4 text-yellow-500" />
                          <div>
                            <span className="text-[15px] text-yellow-500">Leave HQ</span>
                            {!accountStatus.canLeaveCurrentOrg && (
                              <p className="text-[11px] text-[#6a6a7a]">
                                {accountStatus.isFounderOfCurrentOrg
                                  ? "Transfer ownership first"
                                  : "Not available"}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-[#6a6a7a] -rotate-90" />
                      </button>
                      <button
                        onClick={() => {
                          if (accountStatus.canDeleteAccount) {
                            setShowDeleteDialog(true);
                            setDeleteStep("confirm");
                            setOtpCode("");
                          }
                        }}
                        disabled={!accountStatus.canDeleteAccount}
                        className="w-full px-4 py-3 flex items-center justify-between text-left disabled:opacity-40"
                      >
                        <div className="flex items-center gap-3">
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <div>
                            <span className="text-[15px] text-red-500">Delete Account</span>
                            {!accountStatus.canDeleteAccount && (
                              <p className="text-[11px] text-[#6a6a7a]">Transfer founder roles first</p>
                            )}
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-[#6a6a7a] -rotate-90" />
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        clearToken();
                        // Other accounts on this browser stay signed in — this
                        // hands over to one of them, and only lands on "/"
                        // when this was the last.
                        signOutActiveAccount("/");
                      }}
                      className="w-full bg-[#1a1a22] rounded-xl px-4 py-3 flex items-center justify-center gap-2 active:opacity-70 transition-opacity"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span className="text-[15px] text-red-500 font-medium">Logout</span>
                    </button>
                  </div>
                )}

                {/* Referred By — Mobile. Only shown while onboarding is
                    incomplete (profileComplete === false); once complete
                    the referrer is locked. Handles THREE states:
                      (a) existing referrer + not editing → display card
                      (b) editing → input form
                      (c) no referrer + not editing → "set your referrer"
                          prompt (previously omitted, which left users like
                          fresh direct signups with no way to attach an
                          upline).
                    See routes/affiliate.ts::/change-referrer for BE gating
                    + cycle-check. */}
                {!profileComplete && (
                  <div className="pt-4">
                    {/* `overflow-hidden` clips the email suggestions
                        dropdown, so it's dropped while editing. */}
                    <div
                      className={cn(
                        "relative rounded-2xl bg-gradient-to-br from-brand-2/[0.06] via-[#1a1a22] to-[#1a1a22] border border-brand-2/20 p-4 space-y-4",
                        !referrerEditing && "overflow-hidden"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-3 w-3 text-brand-2" />
                        <p className="text-[10px] text-brand-2 uppercase tracking-wider font-semibold">
                          Referred By
                        </p>
                      </div>

                      {referrerEditing ? (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[11px] text-[#c7c7da] font-medium block mb-1.5">
                              Their Garage email
                            </label>
                            <div className="relative">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6a6a7a] pointer-events-none" />
                              <input
                                type="email"
                                value={referrerEmailInput}
                                onChange={(e) => handleReferrerInputChange(e.target.value)}
                                onFocus={() => setShowReferrerSuggestions(true)}
                                onBlur={() => {
                                  setShowReferrerSuggestions(false);
                                  setReferrerActiveIndex(-1);
                                }}
                                onKeyDown={handleReferrerKeyDown}
                                placeholder="person@example.com"
                                autoFocus
                                autoComplete="off"
                                className="w-full h-10 rounded-lg bg-[#0e0e12] border border-[#2a2a35] pl-9 pr-9 text-[14px] text-white placeholder:text-[#4a4a5a] focus:border-brand-2/60 focus:ring-2 focus:ring-brand-2/10 focus:outline-none transition-all"
                                disabled={referrerSaving}
                              />
                              {referrerSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-brand-2" />
                              )}
                              <ReferrerSuggestionList
                                open={showReferrerSuggestions && !referrerSaving}
                                searching={referrerSearching}
                                searched={referrerSearched}
                                results={referrerResults}
                                activeIndex={referrerActiveIndex}
                                onActiveIndexChange={setReferrerActiveIndex}
                                onPick={pickReferrerSuggestion}
                              />
                            </div>
                            <p className="text-[10px] text-[#6a6a7a] mt-1.5 leading-relaxed">
                              Must be someone with a Garage account and not in your downline.
                            </p>
                          </div>
                          {referrerPreview && <ReferrerPreviewCard user={referrerPreview} />}
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={cancelReferrerEdit}
                              disabled={referrerSaving}
                              className="flex-1 h-9 rounded-lg text-[13px] text-[#a5a6bf] font-medium hover:bg-[#0e0e12] transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleChangeReferrer}
                              disabled={referrerSaving || !referrerEmailInput.trim()}
                              className="flex-1 h-9 rounded-lg bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] text-brand-foreground text-[13px] font-semibold hover:from-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] hover:to-brand-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5"
                            >
                              {referrerSaving ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Saving
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  Save
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      ) : referrer ? (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-2/40 to-transparent blur-sm" />
                              {referrer.profilePicture ? (
                                <img
                                  src={referrer.profilePicture}
                                  alt={referrer.name}
                                  className="relative h-11 w-11 rounded-full object-cover ring-2 ring-brand-2/30"
                                />
                              ) : (
                                <div className="relative h-11 w-11 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#1a1a22] flex items-center justify-center text-sm text-white font-semibold ring-2 ring-brand-2/30">
                                  {(referrer.name || referrer.email || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] text-white font-semibold truncate leading-tight">
                                {referrer.name || referrer.email}
                              </p>
                              <p className="text-[12px] text-[#a5a6bf] truncate mt-0.5">
                                {referrer.email}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={beginReferrerEdit}
                              className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[12px] font-medium text-brand-2 hover:bg-brand-2/10 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                              Change
                            </button>
                          </div>
                          <p className="text-[11px] text-[#8a8a9a] leading-relaxed border-t border-[#2a2a35]/40 pt-3">
                            Not the right person? You can update it before completing your profile.
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="relative shrink-0 h-11 w-11 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#0e0e12] flex items-center justify-center ring-2 ring-brand-2/25">
                              <UserPlus className="h-4 w-4 text-brand-2" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] text-white font-semibold leading-tight">
                                No referrer set
                              </p>
                              <p className="text-[12px] text-[#a5a6bf] mt-0.5 leading-snug">
                                Add the person who invited you to Garage — it stays with your account.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={beginReferrerEdit}
                            className="w-full h-9 rounded-lg bg-brand-2/10 border border-brand-2/30 text-brand-2 text-[13px] font-semibold hover:bg-brand-2/15 transition-colors inline-flex items-center justify-center gap-1.5"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Add referrer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ═══ DESKTOP FORM ═══ */}
              <div className="hidden md:block p-4 space-y-6">
                {/* Section 1: Basic Information */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                      <span className="text-brand-2 font-bold text-[10px]">1</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">Basic Information</h4>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm font-medium text-[#c7c7da]">
                        Full Name <Req />
                      </Label>
                      <Input
                        id="name" data-field="name"
                        value={profileData.name}
                        onChange={(e) =>
                          setProfileData((prev) => ({ ...prev, name: e.target.value }))
                        }
                        className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                        placeholder="Enter your full name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-[#c7c7da]">
                        Email Address
                      </Label>
                      <Input
                        id="email"
                        value={displayEmail}
                        placeholder="No email on this account"
                        disabled
                        className="h-10 bg-[#1a1a22] border-[#2a2a35] text-[#6a6a7a] cursor-not-allowed"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-[#c7c7da]">
                        Phone Number <Req />
                      </Label>
                      <div className="relative flex rounded-lg border border-[#2a2a35] bg-[#1a1a22] focus-within:border-brand-2/50 focus-within:ring-1 focus-within:ring-brand-2/20 transition-all duration-200" ref={phoneDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowPhoneCodeDropdown(!showPhoneCodeDropdown)}
                          className="flex items-center gap-1.5 px-3 border-r border-[#2a2a35] hover:bg-[#2a2a35]/30 rounded-l-lg transition-colors text-sm text-white flex-shrink-0"
                        >
                          <span className="text-base leading-none">{selectedPhoneCountry?.flag || "🇺🇸"}</span>
                          <span className="font-semibold text-white">+{selectedPhoneCountry?.phonecode || "1"}</span>
                          <ChevronDown className="h-3.5 w-3.5 text-[#6a6a7a] flex-shrink-0" />
                        </button>
                        <input
                          id="phone" data-field="phone"
                          value={phoneLocal}
                          onChange={(e) => {
                            const sanitizedPhone = e.target.value
                              .replace(/[^0-9]/g, "")
                              .slice(0, 15);
                            setPhoneLocal(sanitizedPhone);
                          }}
                          className="h-10 pl-3 bg-transparent text-white placeholder-[#6a6a7a] focus:outline-none flex-1 text-sm min-w-0"
                          placeholder="Phone number"
                        />
                        {showPhoneCodeDropdown && (
                          <div className="absolute left-0 right-0 top-full mt-1 max-h-60 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-lg z-50 overflow-y-auto">
                            <div className="p-2 border-b border-[#2a2a35] sticky top-0 bg-[#1a1a22] z-10">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6a6a7a]" />
                                <Input
                                  value={phoneCodeSearch}
                                  onChange={(e) => setPhoneCodeSearch(e.target.value)}
                                  placeholder="Search country or code..."
                                  className="h-8 pl-8 bg-[#13131a] border-[#2a2a35] text-xs text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20"
                                />
                              </div>
                            </div>
                            <div className="p-1">
                              {filteredPhoneCountries.map((c) => (
                                <button
                                  key={`${c.isoCode}-${c.phonecode}`}
                                  type="button"
                                  onClick={() => {
                                    setSelectedPhoneCountry(c);
                                    setShowPhoneCodeDropdown(false);
                                    setPhoneCodeSearch("");
                                  }}
                                  className={cn(
                                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-left text-xs transition-colors hover:bg-[#2a2a35]",
                                    selectedPhoneCountry?.isoCode === c.isoCode
                                      ? "text-brand-2 bg-[#2a2a35]/50"
                                      : "text-[#c7c7da]"
                                  )}
                                >
                                  <span className="text-sm">{c.flag}</span>
                                  <span className="font-semibold text-white">+{c.phonecode}</span>
                                  <span className="truncate text-[#8f90a8] flex-1 text-right">{c.name}</span>
                                </button>
                              ))}
                              {filteredPhoneCountries.length === 0 && (
                                <div className="text-center text-xs text-[#6a6a7a] py-4">No results</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <PhoneVerifyTrigger
                        isFirstTimeUser={isFirstTimeUser}
                        phoneLocal={phoneLocal}
                        phoneIsVerified={phoneIsVerified}
                        otpSending={otpSending}
                        onSend={handleSendOtp}
                        largeHint={isBat246Boards}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Profile Picture */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                      <span className="text-brand-2 font-bold text-[10px]">2</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">Profile Picture</h4>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                    <span className="text-xs text-[#6a6a7a] bg-[#1a1a22] px-2 py-1 rounded-md">Optional</span>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-48">
                      <div
                        className={cn(
                          "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-200",
                          isUploadingPhoto
                            ? "border-brand-2/50 bg-brand-2/5"
                            : "border-[#2a2a35] hover:border-brand-2/50"
                        )}
                      >
                        {isUploadingPhoto && (
                          <div className="absolute inset-0 bg-black/40 rounded-lg flex flex-col items-center justify-center z-10">
                            <Loader2 className="w-8 h-8 text-brand-2 animate-spin" />
                            <span className="text-sm text-white mt-2">Uploading...</span>
                          </div>
                        )}
                        <div className={cn("flex flex-col items-center space-y-2", isUploadingPhoto && "opacity-30")}>
                          {profileData.profilePicture ? (
                            <div className="relative">
                              <img
                                src={profileData.profilePicture}
                                alt="Profile"
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 hover:bg-red-600 border-red-500"
                                onClick={() =>
                                  setProfileData((prev) => ({ ...prev, profilePicture: "" }))
                                }
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-[#2a2a35] flex items-center justify-center">
                              <Upload className="h-6 w-6 text-[#9fa0b8]" />
                            </div>
                          )}

                          <div className="text-sm text-[#c7c7da]">
                            {profileData.profilePicture ? "File uploaded" : "Upload profile picture"}
                          </div>
                          <div className="text-xs text-[#9fa0b8]">Max 2MB</div>

                          <input
                            ref={desktopPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={isUploadingPhoto}
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 2 * 1024 * 1024) {
                                toast.error("File size must be less than 2MB");
                                return;
                              }
                              await startUpload([file]);
                              e.target.value = "";
                            }}
                          />

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45]"
                            onClick={() => desktopPhotoInputRef.current?.click()}
                            disabled={isUploadingPhoto}
                          >
                            Choose File
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 3: Location */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                      <span className="text-brand-2 font-bold text-[10px]">3</span>
                    </div>
                    <h4 className="text-sm font-semibold text-white">Location</h4>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                  </div>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2 relative">
                        <Label htmlFor="profile-country" className="text-sm font-medium text-[#c7c7da]">
                          Country <Req />
                        </Label>
                        <div className="relative">
                          {/* Flag of the resolved country, inside the field */}
                          {selectedCountry && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none">
                              {selectedCountry.flag}
                            </span>
                          )}
                          <Input
                            id="profile-country" data-field="country"
                            value={profileData.country}
                            onChange={(e) => {
                              setProfileData((prev) => ({ ...prev, country: e.target.value }));
                              setShowCountrySuggestions(true);
                            }}
                            onFocus={() => setShowCountrySuggestions(true)}
                            onBlur={() => {
                              setShowCountrySuggestions(false);
                              setCountryActiveIndex(-1);
                            }}
                            onKeyDown={handleCountryKeyDown}
                            role="combobox"
                            aria-expanded={showCountrySuggestions}
                            aria-controls="profile-country-listbox"
                            aria-activedescendant={
                              countryActiveIndex >= 0 &&
                              desktopCountrySuggestions[countryActiveIndex]
                                ? `country-opt-${desktopCountrySuggestions[countryActiveIndex].isoCode}`
                                : undefined
                            }
                            autoComplete="off"
                            className={cn(
                              "h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200",
                              selectedCountry && "pl-10"
                            )}
                            placeholder="Type to search country..."
                          />
                        </div>
                        {showCountrySuggestions && desktopCountrySuggestions.length > 0 && (
                          <div
                            id="profile-country-listbox"
                            role="listbox"
                            ref={countryListRef}
                            className="absolute left-0 right-0 top-full mt-1 max-h-48 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-lg z-50 overflow-y-auto"
                          >
                            {desktopCountrySuggestions.map((c, i) => {
                              const isActive = i === countryActiveIndex;
                              const isSelected = profileData.country === c.name;
                              return (
                                <button
                                  key={c.isoCode}
                                  id={`country-opt-${c.isoCode}`}
                                  role="option"
                                  aria-selected={isSelected}
                                  type="button"
                                  onMouseDown={(e) => e.preventDefault()}
                                  onMouseEnter={() => setCountryActiveIndex(i)}
                                  onClick={() => applyCountry(c)}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm transition-colors",
                                    isActive
                                      ? "bg-[#2a2a35]"
                                      : isSelected
                                      ? "bg-[#2a2a35]/50"
                                      : ""
                                  )}
                                >
                                  <span className="text-base leading-none">{c.flag}</span>
                                  <span
                                    className={cn(
                                      "font-medium truncate",
                                      isSelected ? "text-brand-2" : "text-white"
                                    )}
                                  >
                                    {c.name}
                                  </span>
                                  <span className="ml-auto shrink-0 text-[11px] text-[#6a6a7a]">
                                    +{c.phonecode}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="postalCode" className="text-sm font-medium text-[#c7c7da]">
                          Postal Code
                        </Label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                          <Input
                            id="postalCode"
                            value={profileData.postalCode}
                            onChange={(e) => handlePostalCodeChange(e.target.value)}
                            className="h-10 pl-10 pr-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                            placeholder="Enter postal code"
                          />
                          {postalCodeLoading && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-brand-2" />
                          )}
                          {pinCodeResolved && (
                            <Check className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-emerald-500" />
                          )}
                        </div>
                        {postalCodeError && (
                          <p className="text-xs text-red-400">{postalCodeError}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="city" className="text-sm font-medium text-[#c7c7da]">
                          City <Req />
                        </Label>
                        <Input
                          id="city" data-field="city"
                          value={profileData.city}
                          onChange={(e) =>
                            setProfileData((prev) => ({ ...prev, city: e.target.value }))
                          }
                          className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="City"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state" className="text-sm font-medium text-[#c7c7da]">
                          State <Req />
                        </Label>
                        <Input
                          id="state" data-field="state"
                          value={profileData.state}
                          onChange={(e) =>
                            setProfileData((prev) => ({ ...prev, state: e.target.value }))
                          }
                          className="h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200"
                          placeholder="State"
                        />
                      </div>
                    </div>
                    {/* BAT246-only — see isBat246 above. Stored separately
                        from Country (current residence); never sent to
                        the shared /profile endpoint. */}
                    {isBat246 && (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="countryOfBirth" className="text-sm font-medium text-[#c7c7da]">
                            Country of Birth / Ethnic Background <Req />
                          </Label>
                          <CountryTypeahead
                            id="countryOfBirth"
                            value={profileData.countryOfBirth}
                            onChange={(name) =>
                              setProfileData((prev) => ({ ...prev, countryOfBirth: name }))
                            }
                            countries={allCountries}
                          />
                        </div>
                      </div>
                    )}
                    {pinCodeResolved && (
                      <p className="text-xs text-emerald-500/80 flex items-center gap-1.5">
                        <Check className="h-3 w-3" />
                        Location resolved
                      </p>
                    )}
                  </div>
                </div>

                {/* Email Notifications — hidden in profile setup for now.
                    Kept in place (not deleted) so it can be switched back on
                    without rebuilding the settings wiring. */}
                {false && (
                <div className="space-y-4 pt-2 border-t border-[#2a2a35]">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                      <BellRing className="h-3 w-3 text-brand-2" />
                    </div>
                    <h4 className="text-sm font-semibold text-white">Email Notifications</h4>
                    <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                  </div>
                  <div className="space-y-4">
                    {emailNotificationSections.map((section) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wider text-[#8f90a8] font-medium px-1">
                          {section.title}
                        </p>
                        {section.items.length > 0 ? (
                          <div className="bg-[#1a1a22] rounded-lg border border-[#2a2a35] divide-y divide-[#2a2a35]/50">
                            {section.items.map((item) => (
                              <div
                                key={item.key}
                                className="px-4 py-3 flex items-start justify-between gap-4"
                              >
                                <div className="pr-2">
                                  <p className="text-sm font-medium text-white">{item.title}</p>
                                  <p className="text-xs text-[#9fa0b8] mt-0.5">{item.description}</p>
                                </div>
                                <Switch
                                  checked={settings?.emailPreferences[item.key] ?? true}
                                  disabled={updating || settingsLoading}
                                  onCheckedChange={(checked) =>
                                    toggleEmailPreference(item.key, checked)
                                  }
                                  className="data-[state=checked]:bg-brand-2 data-[state=unchecked]:bg-[#2a2a35] mt-1"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-[#1a1a22] rounded-lg border border-[#2a2a35] px-4 py-3">
                            <p className="text-xs text-[#9fa0b8]">
                              No dynamic office email automations are configured yet.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                )}

                {/* Section 5: Account Management - Desktop */}
                {!isFirstTimeUser && accountStatus && (
                  <div className="space-y-4 pt-2 border-t border-[#2a2a35]">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 flex items-center justify-center">
                        <AlertTriangle className="h-3 w-3 text-red-500" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Account Management</h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
                        <div className="flex items-center gap-2 mb-2">
                          <Building2 className="h-4 w-4 text-yellow-500" />
                          <span className="text-sm font-medium text-white">Leave HQ</span>
                        </div>
                        <p className="text-xs text-[#9fa0b8] mb-3">
                          Leave this organization. Your account will remain active.
                        </p>
                        {accountStatus.canLeaveCurrentOrg ? (
                          <Button
                            onClick={() => setShowLeaveDialog(true)}
                            variant="outline"
                            size="sm"
                            className="w-full border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10 hover:border-yellow-500/50"
                          >
                            <LogOut className="h-4 w-4 mr-2" />
                            Leave HQ
                          </Button>
                        ) : (
                          <div className="text-xs text-[#6a6a7a] bg-[#0e0e12] p-2 rounded">
                            {accountStatus.isFounderOfCurrentOrg
                              ? "Founders cannot leave. Transfer ownership first."
                              : "You cannot leave this organization."}
                          </div>
                        )}
                      </div>
                      <div className="p-4 bg-[#1a1a22] rounded-lg border border-[#2a2a35]">
                        <div className="flex items-center gap-2 mb-2">
                          <Trash2 className="h-4 w-4 text-red-500" />
                          <span className="text-sm font-medium text-white">Delete Account</span>
                        </div>
                        <p className="text-xs text-[#9fa0b8] mb-3">
                          Permanently delete your account and all data.
                        </p>
                        {accountStatus.canDeleteAccount ? (
                          <Button
                            onClick={() => {
                              setShowDeleteDialog(true);
                              setDeleteStep("confirm");
                              setOtpCode("");
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Account
                          </Button>
                        ) : (
                          <div className="text-xs text-[#6a6a7a] bg-[#0e0e12] p-2 rounded">
                            <p>You must transfer founder roles first:</p>
                            <ul className="mt-1 list-disc list-inside">
                              {accountStatus.founderOf.map((org) => (
                                <li key={org.id}>{org.name}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Section 6: Referred By — Desktop. Same three-state
                    treatment as mobile (see comment there):
                    display / edit / empty-state prompt. */}
                {!profileComplete && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-2/20 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)]/20 flex items-center justify-center">
                        <UserPlus className="h-3 w-3 text-brand-2" />
                      </div>
                      <h4 className="text-sm font-semibold text-white">Referred By</h4>
                      <div className="flex-1 h-px bg-gradient-to-r from-[#2a2a35] to-transparent" />
                    </div>

                    {/* `overflow-hidden` (which keeps the corner glow inside
                        the card) also clips the email suggestions dropdown —
                        so while editing, both come off. */}
                    <div
                      className={cn(
                        "relative rounded-2xl bg-gradient-to-br from-brand-2/[0.05] via-[#1a1a22] to-[#1a1a22] border border-brand-2/15 p-5",
                        !referrerEditing && "overflow-hidden"
                      )}
                    >
                      {/* Decorative corner glow */}
                      {!referrerEditing && (
                        <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full bg-brand-2/10 blur-2xl pointer-events-none" />
                      )}

                      {referrerEditing ? (
                        <div className="relative space-y-4">
                          <div>
                            <Label className="text-xs font-medium text-[#c7c7da]">
                              Their Garage email
                            </Label>
                            <div className="relative mt-1.5">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#6a6a7a] pointer-events-none" />
                              <Input
                                type="email"
                                value={referrerEmailInput}
                                onChange={(e) => handleReferrerInputChange(e.target.value)}
                                onFocus={() => setShowReferrerSuggestions(true)}
                                onBlur={() => {
                                  setShowReferrerSuggestions(false);
                                  setReferrerActiveIndex(-1);
                                }}
                                onKeyDown={handleReferrerKeyDown}
                                placeholder="person@example.com"
                                autoFocus
                                autoComplete="off"
                                disabled={referrerSaving}
                                className="bg-[#0e0e12] border-[#2a2a35] text-white placeholder:text-[#4a4a5a] pl-9 pr-9 focus:border-brand-2/60 focus-visible:ring-1 focus-visible:ring-brand-2/30"
                              />
                              {referrerSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-brand-2" />
                              )}
                              <ReferrerSuggestionList
                                open={showReferrerSuggestions && !referrerSaving}
                                searching={referrerSearching}
                                searched={referrerSearched}
                                results={referrerResults}
                                activeIndex={referrerActiveIndex}
                                onActiveIndexChange={setReferrerActiveIndex}
                                onPick={pickReferrerSuggestion}
                              />
                            </div>
                            <p className="text-[11px] text-[#6a6a7a] mt-2 leading-relaxed">
                              Must be someone with a Garage account and not in your downline.
                            </p>
                          </div>
                          {referrerPreview && <ReferrerPreviewCard user={referrerPreview} />}
                          <div className="flex gap-2 justify-end">
                            <Button
                              onClick={cancelReferrerEdit}
                              disabled={referrerSaving}
                              variant="ghost"
                              size="sm"
                              className="text-[#a5a6bf] hover:text-white hover:bg-[#0e0e12]"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={handleChangeReferrer}
                              disabled={referrerSaving || !referrerEmailInput.trim()}
                              size="sm"
                              className="bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_90%,black)] hover:to-brand-2 text-brand-foreground font-semibold shadow-md shadow-brand-2/10 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {referrerSaving ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                                  Saving
                                </>
                              ) : (
                                <>
                                  <Check className="h-3.5 w-3.5 mr-1.5" />
                                  Save
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : referrer ? (
                        <div className="relative">
                          <div className="flex items-center gap-4">
                            <div className="relative shrink-0">
                              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-2/50 to-transparent blur-md" />
                              {referrer.profilePicture ? (
                                <img
                                  src={referrer.profilePicture}
                                  alt={referrer.name}
                                  className="relative h-12 w-12 rounded-full object-cover ring-2 ring-brand-2/40"
                                />
                              ) : (
                                <div className="relative h-12 w-12 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#0e0e12] flex items-center justify-center text-base text-white font-semibold ring-2 ring-brand-2/40">
                                  {(referrer.name || referrer.email || "?").charAt(0).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base text-white font-semibold truncate leading-tight">
                                {referrer.name || referrer.email}
                              </p>
                              <p className="text-xs text-[#a5a6bf] truncate mt-1">
                                {referrer.email}
                              </p>
                            </div>
                            {isBat246Boards && (
                              <p className="shrink-0 whitespace-nowrap text-[15.97px] text-[#e6e6f0] leading-snug">
                                Not the right person? You can change it before completing your profile.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={beginReferrerEdit}
                              className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-brand-2 border border-brand-2/25 hover:bg-brand-2/10 hover:border-brand-2/40 transition-all"
                            >
                              <Pencil className="h-3 w-3" />
                              Change
                            </button>
                          </div>
                          {!isBat246Boards && (
                            <p className="text-xs text-[#8a8a9a] leading-relaxed mt-4 pt-4 border-t border-[#2a2a35]/40">
                              Not the right person? You can update it before completing your profile.
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="flex items-center gap-4">
                            <div className="shrink-0 h-12 w-12 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#0e0e12] flex items-center justify-center ring-2 ring-brand-2/30">
                              <UserPlus className="h-5 w-5 text-brand-2" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-base text-white font-semibold leading-tight">
                                No referrer set
                              </p>
                              <p className="text-xs text-[#a5a6bf] mt-1 leading-snug">
                                Add the person who invited you to Garage — it stays with your account after you complete your profile.
                              </p>
                            </div>
                            <Button
                              onClick={beginReferrerEdit}
                              size="sm"
                              className="shrink-0 bg-brand-2/15 hover:bg-brand-2/25 text-brand-2 border border-brand-2/30 hover:border-brand-2/50 shadow-none"
                            >
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              Add referrer
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Desktop */}
            <div className="hidden md:block bg-[#1a1a22]/50 p-4 border-t border-[#2a2a35]">
              <div className="flex items-center justify-between">
                {isFirstTimeUser ? (
                  <Button
                    onClick={() => {
                      clearToken();
                      signOutActiveAccount("/");
                    }}
                    variant="ghost"
                    className="w-fit h-9 text-red-500 hover:text-red-600 hover:bg-red-500/10 font-medium transition-all duration-200"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-4">
                  {!isFirstTimeUser && (
                    <Button
                      onClick={onClose}
                      variant="outline"
                      className="w-fit h-9 border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200 font-medium"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={attemptSave}
                    // Stays enabled on an incomplete form — attemptSave
                    // scrolls to the first blank field instead of silently
                    // doing nothing.
                    disabled={isSubmitting}
                    className={cn(
                      "w-fit h-9 bg-gradient-to-r from-brand-2 to-[color:color-mix(in_srgb,var(--brand-2)_89%,white)] hover:from-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] hover:to-[color:color-mix(in_srgb,var(--brand-2)_93%,black)] text-brand-foreground font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSubmitting
                      ? "Saving..."
                      : isFirstTimeUser
                        ? "Complete Profile"
                        : "Save Profile"}
                  </Button>
                </div>
              </div>
            </div>
            {/* Footer - Mobile */}
            {isFirstTimeUser && (
              <div className="block md:hidden bg-[#1a1a22]/50 p-4 border-t border-[#2a2a35] pb-[calc(env(safe-area-inset-bottom)+12px)] flex-shrink-0">
                <div className="flex items-center justify-between">
                  <Button
                    onClick={() => {
                      clearToken();
                      signOutActiveAccount("/");
                    }}
                    variant="ghost"
                    className="w-fit h-9 text-red-500 hover:text-red-600 hover:bg-red-500/10 font-medium transition-all duration-200 p-0"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </Fragment>
      )}

      {/* Phone verification — opened by "Send OTP" in the profile form. */}
      <Dialog
        key="phone-verify-dialog"
        open={verifyDialogOpen}
        onOpenChange={(v) => !v && setVerifyDialogOpen(false)}
      >
        <DialogContent className="bg-[#0e0e12] z-999999! border border-[#2a2a35] text-white sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <div className="mx-auto mb-2 w-fit rounded-full bg-brand-2/20 p-3">
              <ShieldCheck className="h-7 w-7 text-brand-2" />
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              Verify Your Phone
            </DialogTitle>
            <DialogDescription className="text-sm text-[#9fa0b8]">
              Enter the 6-digit code sent to {phoneE164}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <input
              autoFocus
              value={phoneOtpCode}
              onChange={(e) =>
                setPhoneOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              className="h-11 w-full rounded-lg border border-[#2a2a35] bg-[#13131a] px-3 text-center text-lg tracking-[0.4em] text-white placeholder-[#6a6a7a] placeholder:tracking-normal placeholder:text-sm focus:border-brand-2/50 focus:outline-none"
            />
            <Button
              onClick={handleVerifyOtp}
              disabled={otpVerifying || phoneOtpCode.trim().length < 4}
              className="w-full bg-brand-2 font-semibold text-brand-foreground hover:bg-[color:color-mix(in_srgb,var(--brand-2)_92%,black)] disabled:opacity-40"
            >
              {otpVerifying ? "Verifying…" : "Verify"}
            </Button>
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={otpSending}
              className="w-full text-xs text-[#6a6a7a] transition-colors hover:text-[#c7c7da] disabled:opacity-40"
            >
              {otpSending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Leave HQ Dialog */}
      <Dialog key="leave-dialog" open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <DialogContent className="bg-[#0e0e12] z-999999! border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <LogOut className="h-5 w-5 text-yellow-500" />
              Leave HQ
            </DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              Are you sure you want to leave this organization?
              <br />
              <br />
              <span className="text-[#9fa0b8]">
                This will remove you from all groups, channels, and cancel your future bookings.
                Your account will remain active and you can join other organizations.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLeaveDialog(false)}
              disabled={isLeavingOrg}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeaveOrg}
              disabled={isLeavingOrg}
              className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              {isLeavingOrg ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Leaving...
                </>
              ) : (
                <>
                  <LogOut className="h-4 w-4 mr-2" />
                  Leave HQ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog
        key="delete-dialog"
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setDeleteStep("confirm");
            setOtpCode("");
          }
        }}
      >
        <DialogContent className="bg-[#0e0e12] z-999999! border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              {deleteStep === "confirm" ? "Delete Account" : "Verify Deletion"}
            </DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              {deleteStep === "confirm" ? (
                <>
                  <span className="text-red-400 font-medium">Warning: This action cannot be undone!</span>
                  <br />
                  <br />
                  This will permanently delete:
                  <ul className="list-disc list-inside text-[#9fa0b8] mt-2 space-y-1">
                    <li>All your messages and conversations</li>
                    <li>All your files and uploads</li>
                    <li>All your posts, comments, and likes</li>
                    <li>Your membership in ALL organizations</li>
                    <li>Your entire user account</li>
                  </ul>
                </>
              ) : (
                <>
                  A verification code has been sent to{" "}
                  <span className="text-white font-medium">{user.email}</span>.
                  <br />
                  <br />
                  Enter the 6-digit code to confirm account deletion.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {deleteStep === "otp" && (
            <div className="py-4">
              <Input
                type="text"
                placeholder="Enter 6-digit code"
                value={otpCode}
                onChange={(e) =>
                  setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="h-12 text-center text-2xl tracking-widest bg-[#1a1a22] border-[#2a2a35] text-white"
                maxLength={6}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteStep("confirm");
                setOtpCode("");
              }}
              disabled={isRequestingOtp || isDeletingAccount}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            {deleteStep === "confirm" ? (
              <Button
                onClick={handleRequestDeletionOtp}
                disabled={isRequestingOtp}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isRequestingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Continue
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleDeleteAccount}
                disabled={isDeletingAccount || otpCode.length !== 6}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isDeletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Forever
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Country Picker — bottom drawer */}
      <Sheet key="country-sheet" open={countrySheetOpen} onOpenChange={setCountrySheetOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#13131a] border-t border-[#2a2a35] rounded-t-2xl p-0 gap-0 max-h-[85vh] z-[1100]"
        >
          <div className="flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 px-4 pt-3 pb-2">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2a2a35]" />
              {/* The shared Sheet component's own close button is commented
                  out (components/ui/sheet.tsx), and at max-h-[85vh] on a
                  phone the only way to dismiss otherwise is tapping the
                  thin overlay strip above the sheet — not obvious, and the
                  drag-handle bar above is purely decorative (no onClick).
                  This is the actual close affordance. */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white">
                  {countrySheetTarget === "birth"
                    ? "Country of birth / ethnic background"
                    : "Select country"}
                </h3>
                <button
                  type="button"
                  onClick={() => setCountrySheetOpen(false)}
                  aria-label="Close"
                  className="flex-shrink-0 -mr-1.5 p-1.5 rounded-full text-[#8f90a8] hover:text-white hover:bg-[#2a2a35] transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                <Input
                  autoFocus
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  placeholder="Search country..."
                  className="h-11 pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              {filteredCountrySuggestions.length > 0 ? (
                filteredCountrySuggestions.map((c) => {
                  const isCurrent =
                    (countrySheetTarget === "birth"
                      ? profileData.countryOfBirth
                      : profileData.country) === c.name;
                  return (
                    <button
                      key={c.isoCode}
                      type="button"
                      onClick={() => selectCountry(c)}
                      className={cn(
                        "w-full flex items-center gap-3 text-left px-3 py-3 rounded-lg text-[15px] transition-colors",
                        isCurrent
                          ? "text-brand-2 bg-[#2a2a35]/50"
                          : "text-[#c7c7da] hover:bg-[#1a1a22]"
                      )}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                      {isCurrent && (
                        <Check className="h-4 w-4 flex-shrink-0 ml-auto" />
                      )}
                    </button>
                  );
                })
              ) : (
                <p className="text-center text-sm text-[#6a6a7a] py-8">
                  No countries found
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Phone Code Picker — bottom drawer */}
      <Sheet key="phone-code-sheet" open={phoneCodeSheetOpen} onOpenChange={setPhoneCodeSheetOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#13131a] border-t border-[#2a2a35] rounded-t-2xl p-0 gap-0 max-h-[85vh] z-[1100]"
        >
          <div className="flex flex-col max-h-[85vh]">
            <div className="flex-shrink-0 px-4 pt-3 pb-2">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#2a2a35]" />
              {/* Same missing-close-affordance fix as the country sheet
                  above — see the comment there. */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-white">Select country code</h3>
                <button
                  type="button"
                  onClick={() => setPhoneCodeSheetOpen(false)}
                  aria-label="Close"
                  className="flex-shrink-0 -mr-1.5 p-1.5 rounded-full text-[#8f90a8] hover:text-white hover:bg-[#2a2a35] transition-colors"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6a6a7a]" />
                <Input
                  autoFocus
                  value={phoneCodeSearch}
                  onChange={(e) => setPhoneCodeSearch(e.target.value)}
                  placeholder="Search country or code..."
                  className="h-11 pl-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-[calc(env(safe-area-inset-bottom)+12px)]">
              {filteredPhoneCountries.length > 0 ? (
                filteredPhoneCountries.map((c) => (
                  <button
                    key={`${c.isoCode}-${c.phonecode}`}
                    type="button"
                    onClick={() => {
                      setSelectedPhoneCountry(c);
                      setPhoneCodeSheetOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 text-left px-3 py-3 rounded-lg text-[15px] transition-colors",
                      selectedPhoneCountry?.isoCode === c.isoCode
                        ? "text-brand-2 bg-[#2a2a35]/50"
                        : "text-[#c7c7da] hover:bg-[#1a1a22]"
                    )}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="font-semibold text-white">+{c.phonecode}</span>
                    <span className="text-[#8f90a8] truncate flex-1">{c.name}</span>
                    {selectedPhoneCountry?.isoCode === c.isoCode && (
                      <Check className="h-4 w-4 text-brand-2 flex-shrink-0" />
                    )}
                  </button>
                ))
              ) : (
                <p className="text-center text-sm text-[#6a6a7a] py-8">
                  No countries found
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </AnimatePresence>
  );
}

/**
 * Inline country autocomplete with the same behaviour as the desktop Country
 * field (type to filter, flag inside the field, arrows/Enter/Tab/Escape), kept
 * self-contained so it doesn't need another set of state hooks in the parent.
 */
function CountryTypeahead({
  id,
  value,
  onChange,
  countries,
}: {
  id: string;
  value: string;
  onChange: (name: string) => void;
  countries: ICountry[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  const suggestions = useMemo(
    () =>
      q
        ? countries.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              c.isoCode.toLowerCase().includes(q)
          )
        : countries,
    [q, countries]
  );
  const selected = useMemo(
    () => (q ? countries.find((c) => c.name.toLowerCase() === q) ?? null : null),
    [q, countries]
  );

  useEffect(() => {
    setActive(-1);
  }, [value]);

  useEffect(() => {
    if (active < 0) return;
    const item = listRef.current?.children[active] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const apply = (c: ICountry) => {
    onChange(c.name);
    setOpen(false);
    setActive(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(e.key === "ArrowDown" ? 0 : suggestions.length - 1);
        return;
      }
      if (!suggestions.length) return;
      setActive((prev) => {
        if (e.key === "ArrowDown") return prev >= suggestions.length - 1 ? 0 : prev + 1;
        return prev <= 0 ? suggestions.length - 1 : prev - 1;
      });
      return;
    }
    if (e.key === "Home" && open && suggestions.length) {
      e.preventDefault();
      setActive(0);
      return;
    }
    if (e.key === "End" && open && suggestions.length) {
      e.preventDefault();
      setActive(suggestions.length - 1);
      return;
    }
    if (e.key === "Enter") {
      if (open && active >= 0 && suggestions[active]) {
        e.preventDefault();
        apply(suggestions[active]);
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
      return;
    }
    if (e.key === "Tab" && open && active >= 0 && suggestions[active]) {
      apply(suggestions[active]);
    }
  };

  return (
    <div className="relative">
      {selected && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base leading-none pointer-events-none">
          {selected.flag}
        </span>
      )}
      <Input
        id={id}
        data-field="countryOfBirth"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setActive(-1);
        }}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-activedescendant={
          active >= 0 && suggestions[active]
            ? `${id}-opt-${suggestions[active].isoCode}`
            : undefined
        }
        autoComplete="off"
        className={cn(
          "h-10 bg-[#1a1a22] border-[#2a2a35] text-white placeholder-[#6a6a7a] focus:border-brand-2/50 focus:ring-brand-2/20 transition-all duration-200",
          selected && "pl-10"
        )}
        placeholder="Type to search country..."
      />
      {open && suggestions.length > 0 && (
        <div
          id={`${id}-listbox`}
          role="listbox"
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-1 max-h-48 bg-[#1a1a22] border border-[#2a2a35] rounded-lg shadow-lg z-50 overflow-y-auto"
        >
          {suggestions.map((c, i) => {
            const isActive = i === active;
            const isSelected = selected?.isoCode === c.isoCode;
            return (
              <button
                key={c.isoCode}
                id={`${id}-opt-${c.isoCode}`}
                role="option"
                aria-selected={isSelected}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => apply(c)}
                className={cn(
                  "w-full flex items-center gap-2.5 text-left px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-[#2a2a35]" : isSelected ? "bg-[#2a2a35]/50" : ""
                )}
              >
                <span className="text-base leading-none">{c.flag}</span>
                <span
                  className={cn(
                    "font-medium truncate",
                    isSelected ? "text-brand-2" : "text-white"
                  )}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Red asterisk marking a field the save button is gated on. */
function Req() {
  return (
    <span className="text-red-500" aria-hidden>
      *
    </span>
  );
}

/**
 * "Send OTP" row under the phone field in profile setup. Sending the code
 * opens the verification dialog; the code itself is typed there.
 *
 * For a first-time user this is the gate on "Complete Profile": until the
 * typed number is verified the save button stays disabled. Editing the
 * number re-locks the gate (the parent compares the verified E.164 string
 * against what's currently typed).
 */
function PhoneVerifyTrigger({
  isFirstTimeUser,
  phoneLocal,
  phoneIsVerified,
  otpSending,
  onSend,
  largeHint = false,
}: {
  isFirstTimeUser: boolean;
  phoneLocal: string;
  phoneIsVerified: boolean;
  otpSending: boolean;
  onSend: () => void;
  largeHint?: boolean;
}) {
  // Existing users editing their profile only see this once they've typed
  // a number; first-time users always see it (it's their gate).
  if (!isFirstTimeUser && !phoneLocal.trim()) return null;

  if (phoneIsVerified) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-400">
        <ShieldCheck className="h-3.5 w-3.5" />
        Phone verified
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <p
        className={cn(
          "text-[#8f90a8]",
          largeHint ? "text-[14.55px]" : "text-xs"
        )}
      >
        {isFirstTimeUser
          ? "Verify your number to complete your profile."
          : "Verify this number to secure your account."}
      </p>
      <button
        type="button"
        onClick={onSend}
        disabled={otpSending || !phoneLocal.trim()}
        className="shrink-0 rounded-md border border-brand-2/40 bg-brand-2/10 px-3 py-1 text-xs font-semibold text-brand-2 transition-colors hover:bg-brand-2/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {otpSending ? "Sending…" : "Send OTP"}
      </button>
    </div>
  );
}

/** Circular avatar with a first-letter fallback, used by both referrer UIs. */
function ReferrerAvatar({
  user,
  size,
}: {
  user: ReferrerSuggestion;
  size: "sm" | "lg";
}) {
  const box = size === "sm" ? "h-8 w-8 text-[12px]" : "h-11 w-11 text-sm";
  if (user.profilePicture) {
    return (
      <img
        src={user.profilePicture}
        alt={user.name || user.email}
        className={cn(
          "shrink-0 rounded-full object-cover ring-2 ring-brand-2/30",
          box
        )}
      />
    );
  }
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-gradient-to-br from-[#2a2a35] to-[#0e0e12] flex items-center justify-center text-white font-semibold ring-2 ring-brand-2/30",
        box
      )}
    >
      {(user.name || user.email || "?").charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Live results under the referrer email field.
 *
 * Absolutely positioned — the parent must be `relative`, and the field's
 * container must not clip it.
 */
function ReferrerSuggestionList({
  open,
  searching,
  searched,
  results,
  activeIndex,
  onActiveIndexChange,
  onPick,
}: {
  open: boolean;
  searching: boolean;
  searched: boolean;
  results: ReferrerSuggestion[];
  activeIndex: number;
  onActiveIndexChange: (i: number) => void;
  onPick: (u: ReferrerSuggestion) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Keep the arrow-key highlight inside the scroll viewport.
  useEffect(() => {
    if (activeIndex < 0) return;
    const item = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  // Nothing worth showing yet — the debounce hasn't fired and there's no
  // stale result set to keep on screen.
  if (!searching && !searched) return null;

  return (
    <div
      ref={listRef}
      role="listbox"
      className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-56 overflow-y-auto rounded-lg border border-[#2a2a35] bg-[#1a1a22] shadow-xl shadow-black/40"
    >
      {searching && results.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[#8a8a9a]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-2" />
          Searching Garage users…
        </div>
      ) : results.length === 0 ? (
        <div className="px-3 py-3 text-[12px] text-[#8a8a9a]">
          No Garage user found with this email
        </div>
      ) : (
        results.map((u, i) => (
          <button
            key={u._id}
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => onActiveIndexChange(i)}
            onClick={() => onPick(u)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
              i === activeIndex && "bg-[#2a2a35]"
            )}
          >
            <ReferrerAvatar user={u} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-white truncate leading-tight">
                {u.name || u.email}
              </p>
              <p className="text-[11px] text-[#8a8a9a] truncate mt-0.5">
                {u.email}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}

/**
 * Confirmation card above the Save button: this is exactly who
 * /affiliate/change-referrer will attach if Save is pressed now.
 */
function ReferrerPreviewCard({ user }: { user: ReferrerSuggestion }) {
  return (
    <div className="rounded-xl border border-brand-2/30 bg-brand-2/[0.06] p-3">
      <div className="flex items-center gap-3">
        <ReferrerAvatar user={user} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-white truncate leading-tight">
            {user.name || user.email}
          </p>
          <p className="text-[12px] text-[#a5a6bf] truncate mt-0.5">
            {user.email}
          </p>
        </div>
      </div>
    </div>
  );
}