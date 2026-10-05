"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  MapPin,
  Calendar,
  Sparkles,
  Mail,
  PartyPopper,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { getUserIdFromToken, getToken, getUserDataFromToken } from "@/lib/auth";

interface Request {
  id: string;
  organization: {
    _id: string;
    name: string;
    icon?: string;
    location?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  status: "pending" | "approved" | "rejected";
  message?: string;
  createdAt: string;
  respondedAt?: string;
  respondedBy?: {
    name: string;
    email: string;
  };
}

export default function MyRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for welcome banner params (from private HQ join flow)
  const isWelcome = searchParams.get("welcome") === "true";
  const parentHQName = searchParams.get("parentHQName");

  // Get userId from JWT token (primary) or fall back to guest localStorage
  const userId =
    getUserIdFromToken() ||
    (typeof window !== "undefined"
      ? localStorage.getItem("guest_user_id")
      : null);

  useEffect(() => {
    if (!userId) {
      toast.error("Please login first");
      router.push("/login");
      return;
    }

    // Get email for display
    const userData = getUserDataFromToken();
    if (userData.email) {
      setUserEmail(userData.email);
    } else if (typeof window !== "undefined") {
      setUserEmail(localStorage.getItem("guest_email"));
    }

    fetchRequests();
  }, [userId, router]);

  async function fetchRequests() {
    if (!userId) return;

    try {
      const token = getToken();
      const response = await api<{
        ok: boolean;
        requests: Request[];
      }>(
        `/guest-auth/my-requests?userId=${userId}`,
        {
          method: "GET",
        },
        token || undefined
      );

      if (response.ok) {
        setRequests(response.requests);
      }
    } catch (err) {
      console.error("Error fetching requests:", err);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: Request["status"]) {
    const styles = {
      pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/10 text-green-400 border-green-500/30",
      rejected: "bg-red-500/10 text-red-400 border-red-500/30",
    };

    const icons = {
      pending: <Clock className="h-3.5 w-3.5" />,
      approved: <CheckCircle2 className="h-3.5 w-3.5" />,
      rejected: <XCircle className="h-3.5 w-3.5" />,
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs border ${styles[status]}`}
      >
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0C0C0E]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <p className="text-gray-500 text-sm">Loading your requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0C0C0E] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            {/* <Link href="/browse-hqs"> */}
            <Button
              onClick={() => router.back()}
              variant="ghost"
              size="sm"
              className="text-gray-400 hover:text-white hover:bg-white/5"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Browse
            </Button>
            {/* </Link> */}
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-white mb-2">
              My Requests
            </h1>
            <p className="text-gray-500 text-sm">
              Track the status of your join requests and stay updated
            </p>
          </div>

          {/* User info badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-2" />
            <span className="text-xs text-gray-500">
              User: <span className="text-gray-400">{userEmail}</span>
            </span>
          </div>
        </div>

        {/* Welcome Banner - shown after joining private HQ */}
        {isWelcome && parentHQName && (
          <Card className="mb-8 bg-gradient-to-r from-brand-2/10 to-brand-2/5 border-brand-2/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-brand-2/20 flex items-center justify-center">
                    <PartyPopper className="h-6 w-6 text-brand-2" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Welcome to {parentHQName}!
                    </h3>
                    <p className="text-sm text-gray-400">
                      Your request has been submitted. You can now access your workspace.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => router.push("/workspace")}
                  className="bg-brand-2 hover:bg-brand-2/90 text-brand-foreground font-medium"
                >
                  Go to Workspace
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Requests List */}
        {requests.length === 0 ? (
          <Card className="p-12 text-center bg-white/5 border-white/10">
            <Building2 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-base mb-2">No requests yet</p>
            <p className="text-gray-600 text-sm mb-6">
              Start exploring organizations to join!
            </p>
            <Link href="/browse-hqs">
              <Button className="bg-brand-2 hover:bg-brand-2/90 text-white">
                <Sparkles className="h-4 w-4 mr-2" />
                Browse Organizations
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="bg-white/5 border-white/10 hover:bg-white/[0.07] hover:border-white/20 transition-all duration-200"
              >
                <CardHeader>
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {request.organization.icon ? (
                        <img
                          src={request.organization.icon}
                          alt={request.organization.name}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base text-white font-medium truncate">
                          {request.organization.name}
                        </CardTitle>
                        {(request.organization.city ||
                          request.organization.state ||
                          request.organization.country) && (
                          <CardDescription className="flex items-center mt-1 text-gray-500 text-sm">
                            <MapPin className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate">
                              {[
                                request.organization.city,
                                request.organization.state,
                                request.organization.country,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </span>
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {request.message && (
                    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-xs text-gray-500 font-medium mb-2">
                        Your Message:
                      </p>
                      <p className="text-sm text-gray-400 leading-relaxed">
                        {request.message}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-3.5 w-3.5 mr-1.5" />
                      <span>
                        Submitted:{" "}
                        <span className="text-gray-400">
                          {formatDate(request.createdAt)}
                        </span>
                      </span>
                    </div>

                    {request.respondedAt && (
                      <div className="flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                        <span>
                          Responded:{" "}
                          <span className="text-gray-400">
                            {formatDate(request.respondedAt)}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>

                  {request.status === "approved" && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-start gap-2.5 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
                        <Mail className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-green-400 font-medium">
                            Request Approved!
                          </p>
                          <p className="text-xs text-green-400/80 mt-1">
                            Check your email for the invitation link to complete
                            your registration.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {request.status === "rejected" && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                        <p className="text-sm text-red-400">
                          Your request was not approved at this time. Don't
                          worry—you can explore and apply to other
                          organizations!
                        </p>
                      </div>
                    </div>
                  )}

                  {request.status === "pending" && (
                    <div className="pt-4 border-t border-white/10">
                      <div className="flex items-start gap-2.5 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                        <Clock className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-yellow-400 font-medium">
                            Under Review
                          </p>
                          <p className="text-xs text-yellow-400/80 mt-1">
                            The organization founders will review your request
                            soon. Hang tight!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
