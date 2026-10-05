"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import dynamicImport from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  User,
  Loader2,
  Video,
  AlertCircle,
  CheckCircle,
  Mail,
  Shield,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";

// Meet-specific cache version - increment to force cache clear for meet pages only
const MEET_CACHE_VERSION = "meet_v1";
const MEET_CACHE_KEY = "meet_cache_version";

/**
 * Clears meet-specific caches without affecting workspace auth or other app data.
 * This runs on every meet page load to ensure fresh Daily SDK and meet-related code.
 */
async function clearMeetCaches(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const currentVersion = sessionStorage.getItem(MEET_CACHE_KEY);

  // If already cleared this session with current version, skip
  if (currentVersion === MEET_CACHE_VERSION) {
    return false;
  }

  console.log("[MEET_CACHE] Clearing meet-specific caches...");

  try {
    // 1. Clear only meet-related sessionStorage keys (preserve everything else)
    const meetKeys = [
      "meet_jwt",
      "meet_id",
      "meet_display_name",
      "meet_livekit_server_url",
      "meet_livekit_token",
      "meet_livekit_room_name",
      "meet_join_code",
      "meet_is_host",
      "meet_participant_id",
      "meet_status",
    ];
    meetKeys.forEach((key) => {
      sessionStorage.removeItem(key);
    });
    console.log("[MEET_CACHE] ✓ Meet sessionStorage cleared");

    // 2. Clear Cache Storage entries related to meet/daily (service worker caches)
    if ("caches" in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        for (const request of requests) {
          const url = request.url.toLowerCase();
          // Only delete meet-related and daily-related cached resources
          if (
            url.includes("/meet/") ||
            url.includes("daily") ||
            url.includes("_next/static") // Clear Next.js static chunks to get fresh JS
          ) {
            await cache.delete(request);
          }
        }
      }
      console.log("[MEET_CACHE] ✓ Meet-related cache storage cleared");
    }

    // 3. Mark this session as cleared
    sessionStorage.setItem(MEET_CACHE_KEY, MEET_CACHE_VERSION);
    console.log("[MEET_CACHE] ✅ Meet cache clear completed");

    return true; // Indicates caches were cleared
  } catch (error) {
    console.error("[MEET_CACHE] Error clearing caches:", error);
    // Mark as done to avoid repeated errors
    sessionStorage.setItem(MEET_CACHE_KEY, MEET_CACHE_VERSION);
    return false;
  }
}

// Dynamically import MeetVideoCall to avoid SSR issues with Daily SDK
const MeetVideoCall = dynamicImport(() => import("./MeetVideoCall"), {
  ssr: false,
  loading: () => (
    <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-gray-400" />
    </div>
  ),
});

interface MeetDetails {
  id: string;
  title: string;
  description?: string;
  coverPhoto?: string;
  orgIcon?: string;
  orgName?: string;
  brandColor?: string;
  startTime: string;
  endTime: string;
  status: string;
  hostEmail: string;
  hostName?: string;
  isHostVerified: boolean;
  isLive: boolean;
  hostAffiliateId?: string;
  timezone?: string;
  isRecurring?: boolean;
  nextSessionInfo?: {
    startDateTime: string;
    endDateTime: string;
    dateString: string;
  };
}

type PageState =
  | "loading"
  | "email-entry"
  | "host-otp-request"
  | "host-otp-verify"
  | "participant-otp-request"
  | "participant-otp-verify"
  | "participant-name"
  | "not-started"
  | "next-session"
  | "in-call"
  | "ended"
  | "invalid";

function MeetJoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code");
  const emailFromUrl = searchParams.get("email");
  const nameFromUrl = searchParams.get("name");
  const autoJoin = searchParams.get("autoJoin") === "true";
  const affiliateId = searchParams.get("ref") || "";

  const [pageState, setPageState] = useState<PageState>("loading");
  const [meetDetails, setMeetDetails] = useState<MeetDetails | null>(null);
  const brandColor = meetDetails?.brandColor || "#a855f7"; // fallback to purple
  const [displayName, setDisplayName] = useState(nameFromUrl || "");
  const [email, setEmail] = useState(emailFromUrl || "");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [maskedHostEmail, setMaskedHostEmail] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [hasAutoSubmittedEmail, setHasAutoSubmittedEmail] = useState(false);
  const [hasAutoSubmittedName, setHasAutoSubmittedName] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [participantOtp, setParticipantOtp] = useState("");
  const [participantOtpVerified, setParticipantOtpVerified] = useState(false);
  const [referrer, setReferrer] = useState<{ id: string; name: string; email: string; profilePicture?: string } | null>(null);

  // Fetch affiliate referrer info when ref param is present
  useEffect(() => {
    if (!affiliateId) return;

    async function fetchReferrer() {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/affiliate/referrer-info?affiliateId=${affiliateId}`
        );
        const data = await response.json();
        if (data.success && data.referrer) {
          setReferrer(data.referrer);
        }
      } catch (err) {
        console.error("Error fetching referrer info:", err);
      }
    }

    fetchReferrer();
  }, [affiliateId]);

  // Clear meet-specific caches on mount (runs once per session)
  // This ensures fresh Daily SDK and meet code without affecting workspace auth
  useEffect(() => {
    clearMeetCaches().then((wasCleared) => {
      setCacheCleared(true);
      if (wasCleared) {
        console.log("[MEET] Cache cleared, proceeding with fresh state");
      }
    });
  }, []);

  useEffect(() => {
    // Wait for cache clearing to complete before validating
    if (!cacheCleared) return;

    if (!code) {
      setPageState("invalid");
      return;
    }

    validateCode();
  }, [code, cacheCleared]);

  // Auto-request OTP for host when coming from autoJoin
  const [hasAutoRequestedOtp, setHasAutoRequestedOtp] = useState(false);

  const validateCode = async (isRefresh?: boolean) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/validate?code=${code}`
      );

      const data = await response.json();

      if (isRefresh) {
        setIsRefreshing(false);
      }

      // If no meet data at all, it's invalid
      if (!data.meet && !data.success) {
        setPageState("invalid");
        return;
      }

      setMeetDetails(data.meet);

      // On REFRESH: handle status transitions
      if (isRefresh) {
        // Meeting is now live and user has completed OTP — advance them
        if (data.meet.isLive && email.trim() && participantOtpVerified) {
          if (displayName.trim()) {
            setPageState("participant-name");
            toast.success("Meeting is now live! Click join to enter.");
          } else {
            setPageState("participant-name");
            toast.success("Meeting is now live! Enter your name to join.");
          }
        }
        // Otherwise stay on current page (not-started / next-session)
        return;
      }

      // On INITIAL LOAD: always show email entry first
      // Let the user enter email → detect host/participant → then show status screens after
      setPageState("email-entry");
    } catch (error) {
      console.error("Error validating code:", error);
      setPageState("invalid");
      if (isRefresh) {
        setIsRefreshing(false);
      }
    }
  };

  const handleEmailCheck = useCallback(
    async (emailOverride?: string | React.MouseEvent) => {
      // If called from button click, emailOverride will be MouseEvent, so ignore it
      const emailToUse =
        typeof emailOverride === "string" ? emailOverride : email;

      if (!emailToUse.trim()) {
        toast.error("Please enter your email");
        return;
      }

      // Check if this email is the host
      const normalizedEmail = emailToUse.toLowerCase().trim();
      const isHostEmail =
        meetDetails && normalizedEmail === meetDetails.hostEmail.toLowerCase();

      if (isHostEmail) {
        setIsHost(true);
        setPageState("host-otp-request");
      } else {
        // Not the host
        setIsHost(false);

        // Check if user already exists in the system
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/public/meet/check-user`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ code, email: normalizedEmail }),
            }
          );
          const data = await res.json();
          if (data.success && data.isExistingUser && data.userName) {
            setDisplayName(data.userName);
            if (data.isOrgMember) {
              toast.success(`Welcome back, ${data.userName}!`);
            }
          }
        } catch (err) {
          // Non-critical, continue with flow
          console.error("Error checking user:", err);
        }

        // All participants must verify email via OTP
        setPageState("participant-otp-request");
      }
    },
    [email, meetDetails, affiliateId, code]
  );

  const handleRequestOtp = async () => {
    if (!code) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/host-request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Failed to send verification code");
        setIsSubmitting(false);
        return;
      }

      setMaskedHostEmail(data.hostEmail);
      toast.success("Verification code sent to your email");
      setPageState("host-otp-verify");
    } catch (error) {
      console.error("Error requesting OTP:", error);
      toast.error("Failed to send verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    if (!code) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/host-verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, otp }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Invalid verification code");
        setIsSubmitting(false);
        return;
      }

      // Store credentials in session storage
      sessionStorage.setItem("meet_jwt", data.data.guestJWT);
      sessionStorage.setItem("meet_id", data.data.meetId);
      sessionStorage.setItem("meet_display_name", data.data.displayName);
      sessionStorage.setItem("meet_livekit_server_url", data.data.serverUrl || data.data.livekitServerUrl || "");
      sessionStorage.setItem("meet_livekit_token", data.data.token || data.data.livekitToken || "");
      sessionStorage.setItem("meet_livekit_room_name", data.data.roomName || data.data.agoraChannel || "");
      sessionStorage.setItem("meet_join_code", code);
      sessionStorage.setItem("meet_is_host", "true");
      sessionStorage.setItem("meet_participant_id", data.data.participantId);
      sessionStorage.setItem("meet_status", data.data.meetStatus);

      setDisplayName(data.data.displayName);
      setParticipantId(data.data.participantId);

      toast.success("Verified! Joining as host...");
      setPageState("in-call");
    } catch (error) {
      console.error("Error verifying OTP:", error);
      toast.error("Failed to verify code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParticipantRequestOtp = async () => {
    if (!code || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/join-request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, email: email.trim() }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Failed to send verification code");
        setIsSubmitting(false);
        return;
      }

      toast.success("Verification code sent to your email");
      setPageState("participant-otp-verify");
    } catch (error) {
      console.error("Error requesting participant OTP:", error);
      toast.error("Failed to send verification code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParticipantVerifyOtp = async () => {
    if (participantOtp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    if (!code || !email.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/join-verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            email: email.trim(),
            otp: participantOtp,
            ...(affiliateId ? { affiliateId } : {}),
            displayName: displayName.trim() || undefined,
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Invalid verification code");
        setIsSubmitting(false);
        return;
      }

      setParticipantOtpVerified(true);
      toast.success("Email verified! Enter your name to join.");
      setPageState("participant-name");
    } catch (error) {
      console.error("Error verifying participant OTP:", error);
      toast.error("Failed to verify code");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParticipantJoin = async () => {
    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }

    if (!code) return;

    // If meeting is not live yet, save the name and go to waiting screen
    if (meetDetails && !meetDetails.isLive) {
      // Save name to backend (user was created at OTP verify without a name)
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/public/meet/update-name`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              displayName: displayName.trim(),
            }),
          }
        );
      } catch (error) {
        console.error("Error updating name:", error);
      }
      // Show next-session screen for recurring workshops between sessions,
      // otherwise show not-started waiting screen
      if (meetDetails.nextSessionInfo) {
        setPageState("next-session");
      } else {
        setPageState("not-started");
      }
      toast.info("You're all set! Waiting for the host to start the meeting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/meet/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            displayName: displayName.trim(),
            email: email.trim(),
            ...(affiliateId ? { affiliateId } : {}),
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        if (response.status === 403) {
          // Meeting not started yet
          setPageState("not-started");
          toast.error(data.message || "Meeting has not started yet");
        } else {
          toast.error(data.message || "Failed to join meeting");
        }
        setIsSubmitting(false);
        return;
      }

      // Store credentials in session storage
      sessionStorage.setItem("meet_jwt", data.data.guestJWT);
      sessionStorage.setItem("meet_id", data.data.meetId);
      sessionStorage.setItem("meet_display_name", data.data.displayName);
      sessionStorage.setItem("meet_livekit_server_url", data.data.serverUrl || data.data.livekitServerUrl || "");
      sessionStorage.setItem("meet_livekit_token", data.data.token || data.data.livekitToken || "");
      sessionStorage.setItem("meet_livekit_room_name", data.data.roomName || data.data.agoraChannel || "");
      sessionStorage.setItem("meet_join_code", code);
      sessionStorage.setItem("meet_is_host", "false");
      sessionStorage.setItem("meet_participant_id", data.data.participantId);
      sessionStorage.setItem("meet_status", "live");

      setParticipantId(data.data.participantId);

      toast.success(`Welcome, ${displayName}! Joining the meeting...`);
      setPageState("in-call");
    } catch (error) {
      console.error("Error joining meeting:", error);
      toast.error("Failed to join meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string, tz?: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    }).format(date);
  };

  const formatTime = (dateString: string, tz?: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      ...(tz ? { timeZone: tz } : {}),
    }).format(date);
  };

  const getTimezoneBadgeLabel = (tz?: string) => {
    if (!tz) return null;
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "short",
      }).formatToParts(new Date());
      const tzPart = parts.find((p) => p.type === "timeZoneName");
      return tzPart?.value || null;
    } catch {
      return null;
    }
  };

  // Auto-submit email when pre-filled from URL with autoJoin flag
  useEffect(() => {
    if (
      pageState === "email-entry" &&
      emailFromUrl &&
      autoJoin &&
      !hasAutoSubmittedEmail &&
      meetDetails
    ) {
      setHasAutoSubmittedEmail(true);

      // Directly perform the email check logic here to avoid stale closure issues
      const normalizedEmail = emailFromUrl.toLowerCase().trim();
      const isHostEmail =
        normalizedEmail === meetDetails.hostEmail.toLowerCase();

      if (isHostEmail) {
        setIsHost(true);
        setPageState("host-otp-request");
      } else {
        // All participants must verify email via OTP
        setPageState("participant-otp-request");
      }
    }
  }, [pageState, emailFromUrl, autoJoin, hasAutoSubmittedEmail, meetDetails]);

  // Auto-submit participant name when pre-filled from URL with autoJoin flag
  useEffect(() => {
    if (
      pageState === "participant-name" &&
      nameFromUrl &&
      autoJoin &&
      !hasAutoSubmittedName &&
      !isSubmitting
    ) {
      setHasAutoSubmittedName(true);
      // Small delay to ensure UI has rendered
      const timer = setTimeout(() => {
        handleParticipantJoin();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pageState, nameFromUrl, autoJoin, hasAutoSubmittedName, isSubmitting]);

  // Auto-request OTP for host when coming from autoJoin
  useEffect(() => {
    if (
      pageState === "host-otp-request" &&
      autoJoin &&
      !hasAutoRequestedOtp &&
      !isSubmitting
    ) {
      setHasAutoRequestedOtp(true);
      // Small delay to ensure UI has rendered
      const timer = setTimeout(() => {
        handleRequestOtp();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pageState, autoJoin, hasAutoRequestedOtp, isSubmitting]);

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin mx-auto" style={{ color: brandColor }} />
          <p className="text-gray-400">Validating meeting link...</p>
        </div>
      </div>
    );
  }

  // Invalid code state
  if (pageState === "invalid") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <Card className="w-full max-w-md bg-[#111116] border-red-900/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Invalid Meeting Link
            </CardTitle>
            <CardDescription className="text-gray-400">
              This meeting link is invalid or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-gray-700 hover:bg-gray-600"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Meeting ended
  if (pageState === "ended") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <Card className="w-full max-w-md bg-[#111116] border-[#2a2a35]">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-gray-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-gray-500" />
            </div>
            <CardTitle className="text-2xl text-white">Meeting Ended</CardTitle>
            <CardDescription className="text-gray-400">
              This meeting has already ended.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-[#1a1a20] rounded-lg overflow-hidden border border-[#2a2a35] mb-6">
              {meetDetails?.coverPhoto && (
                <img
                  src={meetDetails.coverPhoto}
                  alt={meetDetails?.title || "Meeting cover"}
                  className="w-full rounded-t-lg"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-medium text-white mb-2">
                  {meetDetails?.title}
                </h3>
                {meetDetails?.description && (
                  <p className="text-gray-400 text-sm mb-2">{meetDetails.description}</p>
                )}
                <p className="text-sm text-gray-400">
                  Ended: {meetDetails && formatTime(meetDetails.endTime, meetDetails.timezone)}
                  {meetDetails?.timezone && getTimezoneBadgeLabel(meetDetails.timezone) && (
                    <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{ backgroundColor: `${brandColor}33`, color: brandColor }}>
                      {getTimezoneBadgeLabel(meetDetails.timezone)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              onClick={() => router.push("/")}
              className="w-full bg-gray-700 hover:bg-gray-600"
            >
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Recurring meeting: current session ended, next session scheduled
  if (pageState === "next-session" && meetDetails?.nextSessionInfo) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <Card className="w-full max-w-md bg-[#111116] border-[#2a2a35]">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: `${brandColor}33` }}>
              <Calendar className="h-8 w-8" style={{ color: brandColor }} />
            </div>
            <CardTitle className="text-2xl text-white">Next Session</CardTitle>
            <CardDescription className="text-gray-400">
              The current session has ended. The next one is scheduled.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-[#1a1a20] rounded-lg overflow-hidden border border-[#2a2a35]">
              {meetDetails.coverPhoto && (
                <img
                  src={meetDetails.coverPhoto}
                  alt={meetDetails.title || "Meeting cover"}
                  className="w-full rounded-t-lg"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-medium text-white mb-3">
                  {meetDetails.title}
                </h3>
                {meetDetails.description && (
                  <p className="text-gray-400 text-sm mb-3">{meetDetails.description}</p>
                )}
                <div className="space-y-2">
                  <div className="flex items-start gap-3 text-sm">
                    <Calendar className="h-4 w-4 mt-0.5" style={{ color: brandColor }} />
                    <span className="text-gray-300">
                      {formatDateTime(meetDetails.nextSessionInfo.startDateTime, meetDetails.timezone)}
                      {meetDetails.timezone && getTimezoneBadgeLabel(meetDetails.timezone) && (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{ backgroundColor: `${brandColor}33`, color: brandColor }}>
                          {getTimezoneBadgeLabel(meetDetails.timezone)}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4" style={{ color: brandColor }} />
                    <span className="text-gray-300">
                      {formatTime(meetDetails.nextSessionInfo.startDateTime, meetDetails.timezone)} - {formatTime(meetDetails.nextSessionInfo.endDateTime, meetDetails.timezone)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => validateCode(true)}
              disabled={isRefreshing}
              className="w-full text-white" style={{ backgroundColor: brandColor }}
            >
              {isRefreshing ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Meeting not started - show refresh button
  if (pageState === "not-started") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <Card className="w-full max-w-2xl bg-[#111116] border-[#2a2a35]">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Meeting Not Started Yet
            </CardTitle>
            <CardDescription className="text-gray-400">
              The host hasn't started the meeting yet. Please wait and refresh
              to check.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Show user's email if entered */}
            {email && (
              <div className="flex items-center gap-2 p-3 bg-[#1a1a20] border border-[#2a2a35] rounded-lg">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300 text-sm">
                  Joining as: {email}
                </span>
              </div>
            )}

            {/* Meeting Details */}
            <div className="bg-[#1a1a20] rounded-lg overflow-hidden border border-[#2a2a35]">
              {meetDetails?.coverPhoto && (
                <img
                  src={meetDetails.coverPhoto}
                  alt={meetDetails?.title || "Meeting cover"}
                  className="w-full rounded-t-lg"
                />
              )}
              <div className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4">
                  {meetDetails?.title}
                </h3>
                {meetDetails?.description && (
                  <p className="text-gray-400 mb-4">{meetDetails.description}</p>
                )}

                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <Calendar className="h-5 w-5 mt-0.5" style={{ color: brandColor }} />
                    <span className="text-gray-300">
                      {meetDetails && formatDateTime(meetDetails.startTime, meetDetails.timezone)}
                      {meetDetails?.timezone && getTimezoneBadgeLabel(meetDetails.timezone) && (
                        <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{ backgroundColor: `${brandColor}33`, color: brandColor }}>
                          {getTimezoneBadgeLabel(meetDetails.timezone)}
                        </span>
                      )}
                    </span>
                  </div>
                  {meetDetails?.hostName && (
                    <div className="flex items-center gap-3 text-sm">
                      <User className="h-5 w-5" style={{ color: brandColor }} />
                      <span className="text-gray-300">
                        Hosted by {meetDetails.hostName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              onClick={() => validateCode(true)}
              disabled={isRefreshing}
              className="w-full text-white" style={{ backgroundColor: brandColor }}
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Checking if meeting started...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh Status
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Host OTP Request
  if (pageState === "host-otp-request") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Host Verification
              </CardTitle>
              <CardDescription className="text-gray-400">
                We'll send a verification code to your email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Meeting Info */}
              <div className="rounded-lg p-4" style={{ backgroundColor: `${brandColor}1A`, border: `1px solid ${brandColor}33` }}>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {meetDetails?.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Mail className="h-4 w-4" />
                  <span>{email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-gray-300">
                  As the host, you need to verify your identity before starting
                  the meeting.
                </p>
              </div>

              <Button
                onClick={handleRequestOtp}
                disabled={isSubmitting}
                className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Host OTP Verify
  if (pageState === "host-otp-verify") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Enter Verification Code
              </CardTitle>
              <CardDescription className="text-gray-400">
                We sent a 6-digit code to {maskedHostEmail}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OTP Input */}
              <div className="flex justify-center">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="000000"
                  className="bg-[#1a1a20] border-[#2a2a35] text-white text-center text-3xl tracking-[0.5em] h-16 w-48 font-mono"
                  autoFocus
                />
              </div>

              <p className="text-center text-sm text-gray-500">
                Code expires in 10 minutes
              </p>

              <Button
                onClick={handleVerifyOtp}
                disabled={isSubmitting || otp.length !== 6}
                className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Verify & Join as Host
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleRequestOtp}
                disabled={isSubmitting}
                className="w-full text-gray-400 hover:text-white"
              >
                Resend Code
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Email entry form (first step for everyone)
  if (pageState === "email-entry") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`w-full my-auto ${meetDetails?.coverPhoto ? "max-w-5xl" : "max-w-lg"}`}
        >
          <Card className="bg-[#111116] border-[#2a2a35] overflow-hidden">
            <div className={meetDetails?.coverPhoto ? "grid md:grid-cols-[1fr_1fr]" : ""}>
              {/* Left column - Cover Photo + Referrer */}
              {meetDetails?.coverPhoto && (
                <div className="flex flex-col bg-black">
                  <div className="relative flex-1 flex items-center justify-center">
                    <img
                      src={meetDetails.coverPhoto}
                      alt={meetDetails.title || "Meeting cover"}
                      className="w-full h-full object-contain"
                    />
                    {meetDetails?.isLive && (
                      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                        <span className="relative flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                        </span>
                        <span className="text-green-400 text-xs font-medium">Live</span>
                      </div>
                    )}
                  </div>
                  {referrer && (
                    <div className="flex items-center justify-center gap-3 px-4 py-3" style={{ backgroundColor: `${brandColor}1A`, borderTop: `1px solid ${brandColor}33` }}>
                      {referrer.profilePicture ? (
                        <img
                          src={referrer.profilePicture}
                          alt={referrer.name}
                          className="h-8 w-8 rounded-full object-cover border-2" style={{ borderColor: `${brandColor}4D` }}
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: `${brandColor}33`, borderColor: `${brandColor}4D` }}>
                          <User className="h-4 w-4" style={{ color: brandColor }} />
                        </div>
                      )}
                      <span className="text-sm text-zinc-300">
                        <span className="font-semibold" style={{ color: brandColor }}>{referrer.name}</span>{" "}
                        invited you to join
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Right column - Meeting Info & Form */}
              <div className="p-6 md:p-8 flex flex-col justify-center">
                {/* Referrer banner when no cover photo */}
                {referrer && !meetDetails?.coverPhoto && (
                  <div className="flex items-center justify-center gap-3 px-4 py-3 mb-6 rounded-lg" style={{ backgroundColor: `${brandColor}1A`, border: `1px solid ${brandColor}33` }}>
                    {referrer.profilePicture ? (
                      <img
                        src={referrer.profilePicture}
                        alt={referrer.name}
                        className="h-8 w-8 rounded-full object-cover border-2" style={{ borderColor: `${brandColor}4D` }}
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: `${brandColor}33`, borderColor: `${brandColor}4D` }}>
                        <User className="h-4 w-4" style={{ color: brandColor }} />
                      </div>
                    )}
                    <span className="text-sm text-zinc-300">
                      <span className="font-semibold" style={{ color: brandColor }}>{referrer.name}</span>{" "}
                      invited you to join
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  {meetDetails?.orgIcon ? (
                    <img
                      src={meetDetails.orgIcon}
                      alt={meetDetails.orgName || "Organization"}
                      className="mx-auto w-14 h-14 rounded-full object-cover mb-4"
                    />
                  ) : (
                    <div className="mx-auto w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                      <Video className="h-7 w-7 text-white" />
                    </div>
                  )}
                  <h2 className="text-2xl font-bold text-white">Join Meeting</h2>
                  <p className="text-gray-400 text-sm mt-1">Enter your email to continue</p>
                </div>

                {/* Meeting Details */}
                <div className="rounded-lg p-4 mb-6"
                  style={{ backgroundColor: `${brandColor}1A`, border: `1px solid ${brandColor}33` }}>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {meetDetails?.title}
                  </h3>
                  {meetDetails?.description && meetDetails.description !== meetDetails.title && (
                    <p className="text-gray-300 text-sm mb-3">
                      {meetDetails.description}
                    </p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-start gap-3 text-sm">
                      <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: brandColor }} />
                      <span className="text-gray-300">
                        {meetDetails && formatDateTime(meetDetails.startTime, meetDetails.timezone)}
                        {meetDetails?.timezone && getTimezoneBadgeLabel(meetDetails.timezone) && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{ backgroundColor: `${brandColor}33`, color: brandColor }}>
                            {getTimezoneBadgeLabel(meetDetails.timezone)}
                          </span>
                        )}
                      </span>
                    </div>
                    {meetDetails?.hostName && (
                      <div className="flex items-center gap-3 text-sm">
                        <User className="h-4 w-4 flex-shrink-0" style={{ color: brandColor }} />
                        <span className="text-gray-300">
                          Hosted by {meetDetails.hostName}
                        </span>
                      </div>
                    )}
                  </div>
                  {!meetDetails?.coverPhoto && meetDetails?.isLive && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </span>
                      <span className="text-green-400 text-sm font-medium">
                        Meeting is Live
                      </span>
                    </div>
                  )}
                </div>

                {/* Email Form */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white">
                      Your Email *
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500 h-12 text-lg"
                      required
                      autoFocus
                    />
                  </div>

                  <Button
                    onClick={handleEmailCheck}
                    disabled={!email.trim()}
                    className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
                  >
                    <Mail className="h-5 w-5 mr-2" />
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Participant OTP Request (for affiliate-linked meeting joins)
  if (pageState === "participant-otp-request") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Verify Your Email
              </CardTitle>
              <CardDescription className="text-gray-400">
                We&apos;ll send a verification code to confirm your email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Meeting Info */}
              <div className="rounded-lg p-4" style={{ backgroundColor: `${brandColor}1A`, border: `1px solid ${brandColor}33` }}>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {meetDetails?.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-gray-300">
                  <Mail className="h-4 w-4" />
                  <span>{email}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-gray-300">
                  Verify your email to join the meeting and get added to the workspace.
                </p>
              </div>

              <Button
                onClick={handleParticipantRequestOtp}
                disabled={isSubmitting}
                className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5 mr-2" />
                    Send Verification Code
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Participant OTP Verify
  if (pageState === "participant-otp-verify") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                <Shield className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Enter Verification Code
              </CardTitle>
              <CardDescription className="text-gray-400">
                We sent a 6-digit code to {email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* OTP Input */}
              <div className="flex justify-center">
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={participantOtp}
                  onChange={(e) =>
                    setParticipantOtp(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    )
                  }
                  placeholder="000000"
                  className="bg-[#1a1a20] border-[#2a2a35] text-white text-center text-3xl tracking-[0.5em] h-16 w-48 font-mono"
                  autoFocus
                />
              </div>

              <p className="text-center text-sm text-gray-500">
                Code expires in 10 minutes
              </p>

              <Button
                onClick={handleParticipantVerifyOtp}
                disabled={isSubmitting || participantOtp.length !== 6}
                className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Verify & Continue
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                onClick={handleParticipantRequestOtp}
                disabled={isSubmitting}
                className="w-full text-gray-400 hover:text-white"
              >
                Resend Code
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Participant name entry (after email, only for non-hosts when meeting is live)
  if (pageState === "participant-name") {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg my-auto"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: brandColor }}>
                <User className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl text-white">
                Enter Your Name
              </CardTitle>
              <CardDescription className="text-gray-400">
                This will be visible to other participants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Meeting Info */}
              {meetDetails && (
                <div className="rounded-lg overflow-hidden" style={{ backgroundColor: `${brandColor}1A`, border: `1px solid ${brandColor}33` }}>
                  {meetDetails.coverPhoto && (
                    <img
                      src={meetDetails.coverPhoto}
                      alt={meetDetails.title || "Meeting cover"}
                      className="w-full rounded-t-lg"
                    />
                  )}
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {meetDetails.title}
                    </h3>
                    {meetDetails.description && (
                      <p className="text-gray-400 text-sm mb-2">
                        {meetDetails.description}
                      </p>
                    )}
                    <div className="flex items-start gap-2 text-sm text-gray-300">
                      <Calendar className="h-4 w-4 mt-0.5" style={{ color: brandColor }} />
                      <span>
                        {formatDateTime(meetDetails.startTime, meetDetails.timezone)}
                        {meetDetails.timezone && getTimezoneBadgeLabel(meetDetails.timezone) && (
                          <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium align-middle"
                            style={{ backgroundColor: `${brandColor}33`, color: brandColor }}>
                            {getTimezoneBadgeLabel(meetDetails.timezone)}
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Show email */}
              <div className="flex items-center gap-2 p-3 bg-[#1a1a20] border border-[#2a2a35] rounded-lg">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300 text-sm">{email}</span>
              </div>

              {/* Name Form */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-white">
                    Your Name *
                  </Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your full name"
                    className="bg-[#1a1a20] border-[#2a2a35] text-white placeholder:text-gray-500 h-12 text-lg"
                    maxLength={100}
                    required
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleParticipantJoin}
                  disabled={isSubmitting || !displayName.trim()}
                  className="w-full h-12 text-lg text-white" style={{ backgroundColor: brandColor }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Join Meeting
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // In call state
  if (pageState === "in-call") {
    return (
      <MeetVideoCall
        displayName={
          displayName ||
          sessionStorage.getItem("meet_display_name") ||
          "Participant"
        }
        meetTitle={meetDetails?.title || "Meeting"}
        isHost={isHost || sessionStorage.getItem("meet_is_host") === "true"}
        joinCode={code || ""}
        participantId={
          participantId || sessionStorage.getItem("meet_participant_id") || ""
        }
        affiliateId={meetDetails?.hostAffiliateId || affiliateId}
      />
    );
  }

  return null;
}

export default function MeetJoinPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-gray-400" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <MeetJoinContent />
    </Suspense>
  );
}
