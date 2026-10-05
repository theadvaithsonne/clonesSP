"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getUserDataFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  User,
  MessageSquare,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";

interface JoinRequest {
  id: string;
  guestUser: {
    _id: string;
    name?: string;
    email: string;
    profilePicture?: string;
  };
  email: string;
  name?: string;
  message?: string;
  createdAt: string;
}

export default function PendingRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(
    null
  );
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [submitting, setSubmitting] = useState(false);

  const userData = getUserDataFromToken();
  const orgId = userData?.orgId;

  useEffect(() => {
    if (orgId) {
      fetchPendingRequests();
    }
  }, [orgId]);

  async function fetchPendingRequests() {
    if (!orgId) return;

    try {
      const response = await api<{
        ok: boolean;
        requests: JoinRequest[];
      }>(`/join-requests/pending?orgId=${orgId}`, {
        method: "GET",
      });

      if (response.ok) {
        setRequests(response.requests);
      }
    } catch (err) {
      console.error("Error fetching pending requests:", err);
      toast.error("Failed to load pending requests");
    } finally {
      setLoading(false);
    }
  }

  function openActionDialog(
    request: JoinRequest,
    action: "approve" | "reject"
  ) {
    setSelectedRequest(request);
    setActionType(action);
    setActionDialogOpen(true);
  }

  async function handleAction() {
    if (!selectedRequest || !orgId) return;

    setSubmitting(true);
    try {
      const endpoint =
        actionType === "approve"
          ? `/join-requests/${selectedRequest.id}/approve?orgId=${orgId}`
          : `/join-requests/${selectedRequest.id}/reject?orgId=${orgId}`;

      const response = await api<{
        ok: boolean;
        message: string;
      }>(endpoint, {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (response.ok) {
        toast.success(
          actionType === "approve"
            ? "Request approved! Invitation sent."
            : "Request rejected."
        );
        setActionDialogOpen(false);
        setSelectedRequest(null);
        // Refresh the list
        await fetchPendingRequests();
      }
    } catch (err: any) {
      console.error(`Error ${actionType}ing request:`, err);
      toast.error(err.message || `Failed to ${actionType} request`);
    } finally {
      setSubmitting(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0d]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-2" />
      </div>
    );
  }

  return (
    <div className="h-full bg-[#0a0a0d] overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-brand-2/20 backdrop-blur-sm">
              <UserPlus className="h-6 w-6 text-brand-2" />
            </div>
            <h1 className="text-3xl font-bold text-white">
              Pending Join Requests
            </h1>
          </div>
          <p className="text-gray-400">
            Review and approve guest requests to join your organization
          </p>
          {requests.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-2/20 border border-brand-2/30">
              <Sparkles className="h-4 w-4 text-brand-2" />
              <span className="text-sm font-medium text-white">
                {requests.length} pending request{requests.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>

        {/* Requests List */}
        {requests.length === 0 ? (
          <Card className="border-brand-2/20 bg-[#0C0C0E]/50 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-brand-2/5 blur-2xl" />
                <CheckCircle2 className="h-16 w-16 text-brand-2/50 mx-auto relative" />
              </div>
              <p className="text-gray-400 text-lg mb-2">
                All caught up!
              </p>
              <p className="text-sm text-gray-500">
                When guests request to join your organization, they'll appear here for review
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <Card
                key={request.id}
                className="group relative overflow-hidden border-brand-2/20 bg-[#0C0C0E]/50 backdrop-blur-sm hover:border-brand-2/50 transition-all duration-300 hover:shadow-lg hover:shadow-brand-2/10"
              >
                {/* Subtle glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-2/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                <CardHeader className="relative">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <Avatar className="h-14 w-14 ring-2 ring-brand-2/30 group-hover:ring-brand-2/60 transition-all">
                        <AvatarFallback className="bg-gradient-to-br from-brand-2/30 to-purple-500/30 text-brand-2 text-lg font-semibold">
                          {(request.name || request.email)?.[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg text-white group-hover:text-brand transition-colors">
                          {request.name || "Guest User"}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1 text-gray-400">
                          <Mail className="h-3 w-3 text-brand-2" />
                          <span className="text-sm truncate">{request.email}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <Clock className="h-3 w-3 text-brand-2" />
                          {formatDate(request.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {request.message && (
                  <CardContent className="pt-0 pb-4 relative">
                    <div className="p-4 bg-[#1a1a2e]/50 rounded-lg border border-brand-2/10">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-4 w-4 text-brand-2 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-400 mb-2">
                            Message:
                          </p>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {request.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                )}

                <CardContent className="pt-0 flex gap-3 relative">
                  <Button
                    onClick={() => openActionDialog(request, "approve")}
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg shadow-green-600/30 hover:shadow-green-600/50 transition-all duration-300"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => openActionDialog(request, "reject")}
                    className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/30 hover:shadow-red-600/50 transition-all duration-300"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Action Confirmation Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent className="bg-[#0C0C0E]/95 backdrop-blur-xl border-brand-2/30">
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-gradient-to-br from-brand-2/30 to-purple-500/30 text-brand-2">
                    {(selectedRequest?.name || selectedRequest?.email)?.[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <DialogTitle className="text-xl text-white">
                  {actionType === "approve"
                    ? "Approve Join Request"
                    : "Reject Join Request"}
                </DialogTitle>
              </div>
              <DialogDescription className="text-gray-400">
                {actionType === "approve" ? (
                  <>
                    Are you sure you want to approve{" "}
                    <span className="text-brand font-medium">
                      {selectedRequest?.name || selectedRequest?.email}
                    </span>
                    's request? They will receive an invitation email to complete their registration and join your organization.
                  </>
                ) : (
                  <>
                    Are you sure you want to reject{" "}
                    <span className="text-red-400 font-medium">
                      {selectedRequest?.name || selectedRequest?.email}
                    </span>
                    's request? They will be notified of this decision via email.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {actionType === "approve" && (
              <div className="p-3 rounded-lg bg-green-600/10 border border-green-500/30 my-2">
                <p className="text-xs text-green-200 flex items-center gap-2">
                  <Sparkles className="h-3 w-3" />
                  An invitation email with OTP will be automatically sent to the guest.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setActionDialogOpen(false)}
                disabled={submitting}
                className="border-gray-600 bg-transparent hover:bg-white/10 text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={submitting}
                className={
                  actionType === "approve"
                    ? "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-lg shadow-green-600/30"
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/30"
                }
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {actionType === "approve" ? "Approving..." : "Rejecting..."}
                  </>
                ) : actionType === "approve" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve & Send Invite
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
