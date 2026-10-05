"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
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
} from "lucide-react";
import { motion } from "framer-motion";

// Dynamically import GuestVideoCall to avoid SSR issues with Daily SDK
const GuestVideoCall = dynamic(() => import("./GuestVideoCall"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-purple-500" />
    </div>
  ),
});

interface EventDetails {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  creator: {
    name: string;
    email: string;
  };
  status: string;
}

type PageState =
  | "loading"
  | "name-entry"
  | "not-started"
  | "joining"
  | "in-call"
  | "ended"
  | "invalid";

function GuestEventCallContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [eventDetails, setEventDetails] = useState<EventDetails | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }

    validateToken();
  }, [token]);

  const validateToken = async (val?: boolean) => {
    try {
      if (val) {
        setIsRefreshing(true);
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/events/validate-guest?token=${token}`
      );

      const data = await response.json();

      if (val) {
        setIsRefreshing(false);
      }

      // Handle different response statuses
      if (!data.success) {
        // Check if it's a timing issue (403 status)
        if (response.status === 403 && data.event) {
          // Event exists but timing is wrong
          setEventDetails(data.event);

          const now = new Date();
          const endTime = new Date(data.event.endTime);

          if (now > endTime) {
            setPageState("ended");
          } else {
            setPageState("not-started");
          }
          return;
        }

        // Invalid token or other error
        setPageState("invalid");
        return;
      }

      setEventDetails(data.event);

      // Check if event has started (this shouldn't happen if backend validates correctly)
      const now = new Date();
      const startTime = new Date(data.event.startTime);
      const endTime = new Date(data.event.endTime);

      // Guests can only join when the meeting has actually started
      if (now < startTime) {
        setPageState("not-started");
      } else if (now > endTime) {
        setPageState("ended");
      } else {
        setPageState("name-entry");
      }
    } catch (error) {
      console.error("Error validating token:", error);
      setPageState("invalid");
      if (val) {
        setIsRefreshing(false);
      }
    }
  };

  const handleJoinEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!token) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/public/events/join-guest`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
            displayName: displayName.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        toast.error(data.message || "Failed to join event");
        setIsSubmitting(false);
        return;
      }

      // Store guest JWT in sessionStorage
      sessionStorage.setItem("guest_jwt", data.data.guestJWT);
      sessionStorage.setItem("guest_event_id", data.data.eventId);
      sessionStorage.setItem("guest_display_name", data.data.displayName);
      sessionStorage.setItem("guest_livekit_server_url", data.data.serverUrl || data.data.livekitServerUrl || data.data.dailyRoomUrl || "");
      sessionStorage.setItem("guest_livekit_token", data.data.token || data.data.livekitToken || data.data.dailyToken || "");
      sessionStorage.setItem("guest_livekit_room_name", data.data.roomName || data.data.agoraChannel || "");

      toast.success(`Welcome, ${displayName}! Joining the meeting...`);

      setPageState("in-call");
    } catch (error: any) {
      console.error("Error joining event:", error);
      toast.error("Failed to join event. Please try again.");
      setIsSubmitting(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  };

  // Loading state
  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto" />
          <p className="text-gray-400">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (pageState === "invalid") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#111116] border-red-900/50">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Invalid Invitation
            </CardTitle>
            <CardDescription className="text-gray-400">
              This invitation link is invalid or has expired.
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

  // Event not started yet
  if (pageState === "not-started") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl bg-[#111116] border-[#2a2a35]">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
            <CardTitle className="text-2xl text-white">
              Meeting Not Started Yet
            </CardTitle>
            <CardDescription className="text-gray-400">
              The meeting hasn't started. You can join when the meeting starts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Event Details */}
            <div className="bg-[#1a1a20] rounded-lg p-6 border border-[#2a2a35]">
              <h3 className="text-xl font-semibold text-white mb-4">
                {eventDetails?.title}
              </h3>
              {eventDetails?.description && (
                <p className="text-gray-400 mb-4">{eventDetails.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-5 w-5 text-purple-400" />
                  <span className="text-gray-300">
                    {eventDetails && formatDateTime(eventDetails.startTime)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <User className="h-5 w-5 text-purple-400" />
                  <span className="text-gray-300">
                    Hosted by {eventDetails?.creator.name}
                  </span>
                </div>
              </div>
            </div>

            <Button
              onClick={() => validateToken(true)}
              disabled={isRefreshing}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {isRefreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Refreshing...
                </>
              ) : (
                "Refresh Status"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Event ended
  if (pageState === "ended") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
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
            <div className="bg-[#1a1a20] rounded-lg p-4 border border-[#2a2a35] mb-6">
              <h3 className="text-lg font-medium text-white mb-2">
                {eventDetails?.title}
              </h3>
              <p className="text-sm text-gray-400">
                Ended: {eventDetails && formatTime(eventDetails.endTime)}
              </p>
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

  // Name entry form
  if (pageState === "name-entry") {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl"
        >
          <Card className="bg-[#111116] border-[#2a2a35]">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center mb-4">
                <Video className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl text-white">
                You're Invited!
              </CardTitle>
              <CardDescription className="text-gray-400">
                Enter your name to join the meeting
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Info */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-6 border border-purple-500/20">
                <h3 className="text-2xl font-semibold text-white mb-3">
                  {eventDetails?.title}
                </h3>
                {eventDetails?.description && (
                  <p className="text-gray-300 mb-4">
                    {eventDetails.description}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-300">
                      {eventDetails && formatDateTime(eventDetails.startTime)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-purple-400" />
                    <span className="text-gray-300">
                      Hosted by {eventDetails?.creator.name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Name Entry Form */}
              <form onSubmit={handleJoinEvent} className="space-y-4">
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
                  <p className="text-xs text-gray-500">
                    This name will be visible to other participants
                  </p>
                </div>

                <div className="flex items-center gap-2 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-blue-400 flex-shrink-0" />
                  <p className="text-sm text-gray-300">
                    No account needed - join directly as a guest
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !displayName.trim()}
                  className="w-full h-12 text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Joining Meeting...
                    </>
                  ) : (
                    <>
                      <Video className="h-5 w-5 mr-2" />
                      Join Meeting
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // In call state - will show the actual video interface
  if (pageState === "in-call") {
    return (
      <GuestVideoCall
        displayName={displayName}
        eventTitle={eventDetails?.title || "Meeting"}
      />
    );
  }

  return null;
}

export default function GuestEventCallPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-purple-500 mx-auto" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <GuestEventCallContent />
    </Suspense>
  );
}
