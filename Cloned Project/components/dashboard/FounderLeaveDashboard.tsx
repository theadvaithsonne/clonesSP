"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface LeaveRequest {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
  };
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  approverId?: string;
}

export default function FounderLeaveDashboard() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const loadLeaveRequests = async () => {
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const res = await api<{ success: boolean; requests: LeaveRequest[] }>(`/betty/pending-leave-requests?orgId=${orgId}`);
      setLeaveRequests(res.requests || []);
    } catch (error) {
      console.error("Failed to load leave requests:", error);
      toast.error("Failed to load leave requests");
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async (requestId: string, status: "approved" | "rejected") => {
    setProcessing(requestId);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api(`/betty/leave-requests/${requestId}?orgId=${orgId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      
      toast.success(`Leave request ${status} successfully`);
      loadLeaveRequests(); // Reload the list
    } catch (error) {
      console.error(`Failed to ${status} leave request:`, error);
      toast.error(`Failed to ${status} leave request`);
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    loadLeaveRequests();
    
    // Listen for real-time leave request notifications
    const handleLeaveNotification = () => {
      loadLeaveRequests(); // Refresh when new requests come in
    };
    window.addEventListener("leave-notification", handleLeaveNotification as any);
    
    return () => {
      window.removeEventListener("leave-notification", handleLeaveNotification as any);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "rejected": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle className="w-4 h-4" />;
      case "rejected": return <XCircle className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const calculateDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col bg-[#0b0b0d] text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#1a1a20]">
            <Calendar className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Leave Request Management</h2>
            <p className="text-xs text-gray-400">Review and approve team leave requests</p>
          </div>
        </div>
        <Button
          onClick={loadLeaveRequests}
          variant="ghost"
          className="bg-[#0e0e12]/80 border border-[#2a2a35] hover:bg-[#1a1a20]"
        >
          Refresh
        </Button>
      </div>

      {leaveRequests.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Pending Requests</h3>
            <p className="text-gray-500">All leave requests have been processed.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {leaveRequests.map((request) => (
            <motion.div
              key={request._id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#111116] border border-[#2a2a35] rounded-xl overflow-hidden"
            >
              <Card className="bg-transparent border-0">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                        <User className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{request.userId.name}</CardTitle>
                        <p className="text-sm text-gray-400">{request.userId.email}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(request.status)}>
                      <div className="flex items-center gap-1">
                        {getStatusIcon(request.status)}
                        <span className="capitalize">{request.status}</span>
                      </div>
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300">Start:</span>
                      <span className="text-white font-medium">{formatDate(request.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300">End:</span>
                      <span className="text-white font-medium">{formatDate(request.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300">Duration:</span>
                      <span className="text-white font-medium">
                        {calculateDays(request.startDate, request.endDate)} days
                      </span>
                    </div>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-2">Reason</h4>
                    <p className="text-sm text-gray-200 bg-[#0e0e12] p-3 rounded-lg border border-[#2a2a35]">
                      {request.reason}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">
                      Submitted: {new Date(request.createdAt).toLocaleString()}
                    </div>
                    
                    {request.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleApproval(request._id, "approved")}
                          disabled={processing === request._id}
                          className="bg-green-600 hover:bg-green-700 text-white"
                          size="sm"
                        >
                          {processing === request._id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleApproval(request._id, "rejected")}
                          disabled={processing === request._id}
                          variant="destructive"
                          size="sm"
                        >
                          {processing === request._id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
