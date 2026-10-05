"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import OtpInput from "@/components/ui/otp-input";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  User,
  Mail,
  Phone,
  Lock,
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
  Sparkles,
  Send,
} from "lucide-react";
import {
  saveToken,
  saveOrgId,
  getUserDataFromToken,
  isAuthenticated as checkWorkspaceAuth,
} from "@/lib/auth";

interface GuestJoinFlowOrganization {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  office_public?: boolean;
  branding?: {
    primaryColor?: string;
  };
}

interface GuestJoinFlowProps {
  organization: GuestJoinFlowOrganization;
  slug: string;
  brandColor: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called when org status may have changed (e.g. after joining) so parent can re-fetch */
  onStatusChange?: () => void;
}

type AuthStep = "email" | "otp" | "phone";

function isLightColor(color: string): boolean {
  let hex = color.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
}

export default function GuestJoinFlow({
  organization,
  slug,
  brandColor,
  isOpen,
  onClose,
  onStatusChange,
}: GuestJoinFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const referCode = searchParams.get("referCode");

  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [guestUserId, setGuestUserId] = useState<string | null>(null);
  const [isWorkspaceUser, setIsWorkspaceUser] = useState(false);
  const [workspaceUserName, setWorkspaceUserName] = useState<string | null>(null);

  // Auth modal state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authStep, setAuthStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [phone, setPhone] = useState("");
  const [joinName, setJoinName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [resendAt, setResendAt] = useState<number>(0);

  // Join flow state
  const [pendingPublicJoin, setPendingPublicJoin] = useState(false);
  const [pendingPrivateJoin, setPendingPrivateJoin] = useState(false);
  const [joiningOrg, setJoiningOrg] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);

  // Apply dialog (private orgs)
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [requestName, setRequestName] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already member modal
  const [showAlreadyMemberModal, setShowAlreadyMemberModal] = useState(false);
  const [alreadyMemberData, setAlreadyMemberData] = useState<{
    userId: string;
    orgId: string;
    orgName: string;
  } | null>(null);
  const [redirectingToWorkspace, setRedirectingToWorkspace] = useState(false);

  // Guest limit
  const [guestLimitReached, setGuestLimitReached] = useState(false);

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  const mobileAuthButtonColor = isLightColor(brandColor)
    ? "#18181b"
    : brandColor;

  const secondsLeft = useMemo(
    () => Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)),
    [resendAt]
  );

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    const checkMobileSize = () => setIsMobile(window.innerWidth < 640);
    checkMobileSize();
    window.addEventListener("resize", checkMobileSize);
    return () => window.removeEventListener("resize", checkMobileSize);
  }, []);

  useEffect(() => {
    if (showAuthModal && isMobile) {
      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
    } else {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    }
    return () => {
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.width = "";
      document.body.style.height = "";
    };
  }, [showAuthModal, isMobile]);

  // Check auth on mount
  useEffect(() => {
    if (checkWorkspaceAuth()) {
      const userData = getUserDataFromToken();
      if (userData.userId && userData.email) {
        setIsAuthenticated(true);
        setIsWorkspaceUser(true);
        setGuestUserId(userData.userId);
        setWorkspaceUserName(userData.name);
        if (userData.name) setIsExistingUser(true);
        return;
      }
    }
    const storedUserId = localStorage.getItem("guest_user_id");
    const storedEmail = localStorage.getItem("guest_email");
    if (storedUserId && storedEmail) {
      setIsAuthenticated(true);
      setGuestUserId(storedUserId);
    }
  }, []);

  // Check guest limit
  useEffect(() => {
    if (!organization?._id) return;
    (async () => {
      try {
        const res = await api<{ ok: boolean; limitReached: boolean }>(
          `/guest-auth/guest-limit-status?orgId=${organization._id}`
        );
        if (res.ok) setGuestLimitReached(res.limitReached);
      } catch {
        // non-critical
      }
    })();
  }, [organization?._id]);

  // Trigger join flow when isOpen becomes true
  useEffect(() => {
    if (!isOpen) return;
    handleApplyClick();
  }, [isOpen]);

  // ── Auth functions ──────────────────────────────────────────────

  function resetAuthForm() {
    setAuthStep("email");
    setEmail("");
    setOtp("");
    setPhone("");
    setJoinName("");
    setPendingPublicJoin(false);
    setPendingPrivateJoin(false);
    setIsExistingUser(false);
  }

  function handleClose() {
    setShowAuthModal(false);
    setShowApplyDialog(false);
    setShowAlreadyMemberModal(false);
    resetAuthForm();
    onClose();
  }

  async function requestOtp() {
    if (!email) {
      toast.error("Please enter your email");
      return;
    }
    setAuthLoading(true);
    try {
      await api("/guest-auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      toast.success("OTP sent to your email!");
      setAuthStep("otp");
    } catch {
      toast.error("Failed to send OTP. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyOtp() {
    if (otp.length !== 6 || authLoading) return;
    setAuthLoading(true);
    try {
      const response = await api<{
        ok: boolean;
        userId: string;
        email: string;
        guest: boolean;
        name: string | null;
        phone: string | null;
        profileComplete: boolean;
        hasOrganizations: boolean;
      }>("/guest-auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: otp,
          referralCode: referCode || undefined,
        }),
      });

      if (response.ok) {
        localStorage.setItem("guest_user_id", response.userId);
        localStorage.setItem("guest_email", response.email);
        setGuestUserId(response.userId);
        setIsAuthenticated(true);

        if (response.name) {
          setJoinName(response.name);
          setIsExistingUser(true);
        }
        if (response.phone) setPhone(response.phone);

        // Refresh org to check membership
        const orgRes = await api<{
          ok: boolean;
          organization: {
            _id: string;
            name: string;
            isMember: boolean;
            office_public?: boolean;
          };
        }>(`/guest-auth/hq-by-slug/${slug}?userId=${response.userId}`, {
          method: "GET",
        });

        if (orgRes.ok && orgRes.organization?.isMember) {
          setShowAuthModal(false);
          setAlreadyMemberData({
            userId: response.userId,
            orgId: orgRes.organization._id,
            orgName: orgRes.organization.name,
          });
          setShowAlreadyMemberModal(true);
          return;
        }

        if (organization?.office_public && pendingPublicJoin) {
          toast.success("Email verified! One more step...");
          setAuthStep("phone");
          setOtp("");
        } else if (!organization?.office_public && pendingPrivateJoin) {
          toast.success("Email verified! Complete your profile...");
          setAuthStep("phone");
          setOtp("");
        } else {
          setShowAuthModal(false);
          toast.success("Verified!");
          setAuthStep("email");
          setEmail("");
          setOtp("");
        }
      } else {
        toast.error("Verification failed. Please try again.");
      }
    } catch {
      toast.error("Something went wrong!");
      setOtp("");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handlePublicJoin(userId?: string, userPhone?: string) {
    if (!organization) return;
    const userIdToUse = userId || guestUserId;
    if (!userIdToUse) return;

    setJoiningOrg(true);
    try {
      const response = await api<{
        ok: boolean;
        token: string;
        user: { id: string; email: string; name?: string };
        needsProfileCompletion: boolean;
        alreadyMember?: boolean;
      }>("/guest-auth/public-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId: userIdToUse,
          orgId: organization._id,
          name: joinName.trim() || requestName.trim() || undefined,
          phone: userPhone || phone || undefined,
        }),
      });

      if (response.ok) {
        saveToken(response.token);
        saveOrgId(organization._id);
        localStorage.removeItem("guest_user_id");
        localStorage.removeItem("guest_email");

        if (response.alreadyMember) {
          toast.success("You're already a member!");
        } else {
          toast.success(`Welcome to ${organization.name}!`);
        }

        router.push(
          response.needsProfileCompletion
            ? "/workspace?completeProfile=true"
            : "/workspace"
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to join organization");
      onStatusChange?.();
    } finally {
      setJoiningOrg(false);
    }
  }

  async function handlePrivateJoin() {
    if (!organization || !guestUserId) return;
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!isExistingUser && !joinName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setJoiningOrg(true);
    try {
      const response = await api<{
        ok: boolean;
        token: string;
        garageHQId: string;
        garageHQName: string;
        requestId: string;
        status: string;
        needsProfileCompletion: boolean;
      }>("/guest-auth/private-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId,
          orgId: organization._id,
          name: joinName.trim(),
          phone: phone,
          message: requestMessage.trim() || undefined,
        }),
      });

      if (response.ok) {
        saveToken(response.token);
        saveOrgId(response.garageHQId);
        localStorage.removeItem("guest_user_id");
        localStorage.removeItem("guest_email");

        toast.success("Request submitted!");
        setPendingPrivateJoin(false);
        setShowAuthModal(false);
        resetAuthForm();

        const params = new URLSearchParams({
          welcome: "true",
          parentHQName: response.garageHQName,
        });
        router.push(`/my-requests?${params.toString()}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setJoiningOrg(false);
    }
  }

  async function resendOtp() {
    if (Date.now() < resendAt) return;
    try {
      await api("/guest-auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setResendAt(Date.now() + 60_000);
      toast.success("OTP sent to your email");
    } catch {
      toast.error("Failed to resend OTP");
    }
  }

  async function handleAlreadyMemberRedirect() {
    if (!alreadyMemberData) return;
    setRedirectingToWorkspace(true);
    try {
      const response = await api<{
        token: string;
        currentOrg: { id: string; name: string; role: string };
      }>("/auth/select-org", {
        method: "POST",
        body: JSON.stringify({
          userId: alreadyMemberData.userId,
          orgId: alreadyMemberData.orgId,
        }),
      });
      saveToken(response.token);
      saveOrgId(alreadyMemberData.orgId);
      localStorage.removeItem("guest_user_id");
      localStorage.removeItem("guest_email");
      router.push("/workspace");
    } catch {
      toast.error("Failed to login. Please try again.");
      setRedirectingToWorkspace(false);
    }
  }

  async function completePhoneAndJoin() {
    if (!phone || phone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (!isExistingUser && !joinName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (pendingPrivateJoin) {
      await handlePrivateJoin();
      return;
    }

    // Public org flow
    setPendingPublicJoin(false);
    setShowAuthModal(false);
    setAuthStep("email");
    setEmail("");
    setOtp("");

    await handlePublicJoin(guestUserId || undefined, phone);
    setPhone("");
    setJoinName("");
    setIsExistingUser(false);
  }

  function handleApplyClick() {
    if (guestLimitReached) {
      toast.error(
        "This organization is not accepting new members at the moment."
      );
      onClose();
      return;
    }

    if (!isAuthenticated) {
      if (organization?.office_public) {
        setPendingPublicJoin(true);
      } else {
        setPendingPrivateJoin(true);
      }
      setShowAuthModal(true);
    } else {
      if (organization?.office_public) {
        if (isWorkspaceUser) {
          handlePublicJoin(guestUserId || undefined, undefined);
        } else {
          setPendingPublicJoin(true);
          setAuthStep("phone");
          setShowAuthModal(true);
        }
      } else {
        if (isWorkspaceUser && workspaceUserName) {
          setRequestName(workspaceUserName);
        }
        setShowApplyDialog(true);
      }
    }
  }

  async function submitRequest() {
    if (!organization || !guestUserId) return;
    setSubmitting(true);
    try {
      const response = await api<{
        ok: boolean;
        requestId: string;
        status: string;
      }>("/guest-auth/request-join", {
        method: "POST",
        body: JSON.stringify({
          guestUserId,
          orgId: organization._id,
          name: requestName.trim() || undefined,
          message: requestMessage.trim() || undefined,
        }),
      });
      if (response.ok) {
        toast.success("Request submitted successfully!");
        setShowApplyDialog(false);
        setRequestName("");
        setRequestMessage("");
        onStatusChange?.();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      {/* Mobile Auth UI - Full page on mobile */}
      {showAuthModal && isMobile && (
        <>
          <div
            className="fixed inset-0 bg-white z-[9998]"
            style={{ top: "-100px", bottom: "-100px", left: "-100px", right: "-100px" }}
          />
          <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                {organization.icon ? (
                  <img
                    src={organization.icon}
                    alt={organization.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-zinc-100 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-zinc-400" />
                  </div>
                )}
                <span className="font-medium text-zinc-900 text-sm">
                  {organization.name}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="p-2 rounded-full hover:bg-zinc-100 transition-colors"
              >
                <X className="h-5 w-5 text-zinc-500" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <h2 className="text-2xl font-bold text-zinc-900 text-center mb-2">
                {organization.office_public
                  ? `See ${organization.name}'s Office`
                  : `Request To Join ${organization.name}`}
              </h2>
              <p className="text-zinc-500 text-sm text-center mb-6">
                Join {organization.name} community
              </p>

              {/* Progress bar */}
              <div className="mb-8">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "email"
                        ? isLightColor(brandColor)
                          ? "text-white"
                          : "text-black"
                        : "bg-emerald-500 text-white"
                    }`}
                    style={
                      authStep === "email"
                        ? { backgroundColor: mobileAuthButtonColor }
                        : {}
                    }
                  >
                    {authStep !== "email" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      "1"
                    )}
                  </div>
                  <div
                    className={`w-12 h-1 rounded ${
                      authStep === "email" ? "bg-zinc-200" : "bg-emerald-500"
                    }`}
                  />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "otp"
                        ? isLightColor(brandColor)
                          ? "text-white"
                          : "text-black"
                        : authStep === "phone"
                        ? "bg-emerald-500 text-white"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                    style={
                      authStep === "otp"
                        ? { backgroundColor: mobileAuthButtonColor }
                        : {}
                    }
                  >
                    {authStep === "phone" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      "2"
                    )}
                  </div>
                  <div
                    className={`w-12 h-1 rounded ${
                      authStep === "phone" ? "bg-emerald-500" : "bg-zinc-200"
                    }`}
                  />
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      authStep === "phone"
                        ? isLightColor(brandColor)
                          ? "text-white"
                          : "text-black"
                        : "bg-zinc-200 text-zinc-500"
                    }`}
                    style={
                      authStep === "phone"
                        ? { backgroundColor: mobileAuthButtonColor }
                        : {}
                    }
                  >
                    3
                  </div>
                </div>
                <p className="text-center text-xs text-zinc-500">
                  Step{" "}
                  {authStep === "email"
                    ? "1"
                    : authStep === "otp"
                    ? "2"
                    : "3"}{" "}
                  of 3:{" "}
                  {authStep === "email"
                    ? "Enter Email"
                    : authStep === "otp"
                    ? "Verify Code"
                    : "Complete Profile"}
                </p>
              </div>

              {/* Form */}
              <div className="space-y-4">
                {authStep === "email" ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="gjf-mobile-email"
                        className="text-zinc-700 text-sm"
                      >
                        Email Address
                      </Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                          id="gjf-mobile-email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                          className="pl-11 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                        />
                      </div>
                    </div>
                    <button
                      onClick={requestOtp}
                      disabled={!email || authLoading}
                      className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${
                        isLightColor(brandColor) ? "text-white" : "text-black"
                      }`}
                      style={{ backgroundColor: mobileAuthButtonColor }}
                    >
                      {authLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Continue <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                ) : authStep === "otp" ? (
                  <div className="space-y-4">
                    <div className="text-center mb-2">
                      <p className="text-sm text-zinc-600">
                        Enter the 6-digit code sent to
                      </p>
                      <p className="font-medium text-zinc-900">{email}</p>
                    </div>
                    <OtpInput value={otp} onChange={setOtp} />
                    <div className="flex items-center justify-between text-sm">
                      <button
                        type="button"
                        onClick={() => {
                          setAuthStep("email");
                          setOtp("");
                        }}
                        className="text-zinc-500 hover:text-zinc-700 transition-colors"
                      >
                        Change email
                      </button>
                      <button
                        type="button"
                        onClick={resendOtp}
                        disabled={secondsLeft > 0}
                        className="inline-flex items-center gap-1.5 text-zinc-500 disabled:opacity-50 hover:text-zinc-700 transition-colors"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {secondsLeft > 0 ? `${secondsLeft}s` : "Resend"}
                      </button>
                    </div>
                    <button
                      onClick={verifyOtp}
                      disabled={otp.length !== 6 || authLoading}
                      className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${
                        isLightColor(brandColor) ? "text-white" : "text-black"
                      }`}
                      style={{ backgroundColor: mobileAuthButtonColor }}
                    >
                      {authLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Verify <ArrowRight className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {!isExistingUser && (
                      <div className="space-y-2">
                        <Label
                          htmlFor="gjf-mobile-joinName"
                          className="text-zinc-700 text-sm"
                        >
                          Your Name <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                          <Input
                            id="gjf-mobile-joinName"
                            type="text"
                            autoComplete="name"
                            placeholder="John Doe"
                            value={joinName}
                            onChange={(e) => setJoinName(e.target.value)}
                            className="pl-11 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label
                        htmlFor="gjf-mobile-phone"
                        className="text-zinc-700 text-sm"
                      >
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                        <Input
                          id="gjf-mobile-phone"
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="9876543210"
                          value={phone}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            if (v.length <= 10) setPhone(v);
                          }}
                          onKeyDown={(e) =>
                            e.key === "Enter" &&
                            phone.length >= 10 &&
                            (isExistingUser || joinName.trim()) &&
                            completePhoneAndJoin()
                          }
                          className="pl-11 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 h-12 text-base"
                        />
                      </div>
                      <p className="text-xs text-zinc-500">
                        Required for account verification
                      </p>
                    </div>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-emerald-800 text-xs">
                        <p className="font-medium">Your privacy is protected</p>
                        <p className="text-emerald-600">
                          No spam, only important updates.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={completePhoneAndJoin}
                      disabled={
                        phone.length < 10 ||
                        (!isExistingUser && !joinName.trim()) ||
                        joiningOrg
                      }
                      className={`w-full h-12 rounded-full font-semibold text-base hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity ${
                        isLightColor(brandColor) ? "text-white" : "text-black"
                      }`}
                      style={{ backgroundColor: mobileAuthButtonColor }}
                    >
                      {joiningOrg ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          Complete Setup <Check className="h-5 w-5" />
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              <p className="text-xs text-zinc-400 text-center mt-6">
                <Lock className="inline h-3 w-3 mr-1" />
                By continuing, you agree to our Terms of Service and Privacy
                Policy
              </p>
            </div>
          </div>
        </>
      )}

      {/* Desktop Auth Dialog */}
      <Dialog
        open={showAuthModal && !isMobile}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-zinc-900">
              {authStep === "email"
                ? "Verify Your Email"
                : authStep === "otp"
                ? "Enter Code"
                : "Almost There!"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-sm">
              {authStep === "email"
                ? "We'll send you a verification code."
                : authStep === "otp"
                ? `Enter the 6-digit code sent to ${email}`
                : "We need your phone number to complete the setup."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {authStep === "email" ? (
              <div className="space-y-2">
                <Label
                  htmlFor="gjf-desk-email"
                  className="text-zinc-700 text-sm"
                >
                  Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <Input
                    id="gjf-desk-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && requestOtp()}
                    className="pl-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                  />
                </div>
              </div>
            ) : authStep === "otp" ? (
              <div className="space-y-4">
                <OtpInput value={otp} onChange={setOtp} />
                <div className="flex items-center justify-between text-sm text-zinc-500">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthStep("email");
                      setOtp("");
                    }}
                    className="hover:text-zinc-700 transition-colors"
                  >
                    Change email
                  </button>
                  <button
                    type="button"
                    onClick={resendOtp}
                    disabled={secondsLeft > 0}
                    className="inline-flex items-center gap-1.5 disabled:opacity-50 hover:text-zinc-700 transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    {secondsLeft > 0 ? `${secondsLeft}s` : "Resend"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {!isExistingUser && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="gjf-desk-joinName"
                      className="text-zinc-700 text-sm"
                    >
                      Your Name <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                      <Input
                        id="gjf-desk-joinName"
                        type="text"
                        placeholder="John Doe"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        className="pl-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                      />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label
                    htmlFor="gjf-desk-phone"
                    className="text-zinc-700 text-sm"
                  >
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                    <Input
                      id="gjf-desk-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="9876543210"
                      value={phone}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        if (v.length <= 10) setPhone(v);
                      }}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        phone.length >= 10 &&
                        (isExistingUser || joinName.trim()) &&
                        completePhoneAndJoin()
                      }
                      className="pl-10 bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-11"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    Required for account verification and important updates
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div className="text-emerald-800 text-xs">
                    <p className="font-medium">Your privacy is protected</p>
                    <p className="text-emerald-600">
                      We only use your info for verification and important
                      updates. No spam.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={authLoading || joiningOrg}
              className="border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900"
            >
              Cancel
            </Button>
            {authStep === "email" ? (
              <Button
                onClick={requestOtp}
                disabled={!email || authLoading}
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Continue"
                )}
              </Button>
            ) : authStep === "otp" ? (
              <Button
                onClick={verifyOtp}
                disabled={otp.length !== 6 || authLoading}
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {authLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Verify"
                )}
              </Button>
            ) : (
              <Button
                onClick={completePhoneAndJoin}
                disabled={
                  phone.length < 10 ||
                  (!isExistingUser && !joinName.trim()) ||
                  joiningOrg
                }
                className="text-black font-medium hover:opacity-90"
                style={{ backgroundColor: brandColor }}
              >
                {joiningOrg ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Complete Setup"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Dialog (private orgs) */}
      <Dialog
        open={showApplyDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowApplyDialog(false);
            onClose();
          }
        }}
      >
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              {organization.icon ? (
                <img
                  src={organization.icon}
                  alt={organization.name}
                  className="h-10 w-10 rounded-lg object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-zinc-100 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-zinc-400" />
                </div>
              )}
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  Join {organization.name}
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs">
                  Request to become a member
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {!isExistingUser && (
              <div className="space-y-2">
                <Label
                  htmlFor="gjf-req-name"
                  className="text-zinc-700 text-sm"
                >
                  Your Name
                </Label>
                <Input
                  id="gjf-req-name"
                  placeholder="Optional"
                  value={requestName}
                  onChange={(e) => setRequestName(e.target.value)}
                  className="bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 brand-focus h-10"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowApplyDialog(false);
                onClose();
              }}
              disabled={submitting}
              className="border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-900"
            >
              Cancel
            </Button>
            <Button
              onClick={submitRequest}
              disabled={submitting}
              className="text-black font-medium hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Already Member Modal */}
      <Dialog
        open={showAlreadyMemberModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAlreadyMemberModal(false);
            onClose();
          }
        }}
      >
        <DialogContent className="bg-white border-zinc-200 text-zinc-900 sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-zinc-900">
                  You&apos;re Already a Member!
                </DialogTitle>
                <DialogDescription className="text-zinc-500 text-xs">
                  {alreadyMemberData?.orgName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-zinc-600">
              Great news! You&apos;re already a member of this organization.
              Click below to go to your workspace.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={handleAlreadyMemberRedirect}
              disabled={redirectingToWorkspace}
              className="w-full text-black font-medium hover:opacity-90"
              style={{ backgroundColor: brandColor }}
            >
              {redirectingToWorkspace ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Go To {organization.name}&apos;s Office
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
