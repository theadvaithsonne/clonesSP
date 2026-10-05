"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  MessageCircleQuestion,
  X,
  Loader2,
  Send,
  Clock,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  ChevronLeft,
  RefreshCw,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Zap,
  Flame,
  Info,
  MessageSquare,
  FileText,
  Image as ImageIcon,
  File,
  ChevronRight,
  Building2,
  Folder,
  Bot,
  Calendar,
  ClipboardCheck,
  Users,
  Monitor,
  Settings,
  CreditCard,
  User,
  HelpCircle,
  UserPlus,
  Building,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import SupportTicketModal from "./SupportTicketModal";
import { connectSocket } from "@/lib/socket";

interface TicketUser {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
}

interface TicketResponse {
  _id?: string;
  respondedBy: TicketUser;
  message: string;
  attachments: string[];
  createdAt: string;
}

// Available modules for support tickets
const SUPPORT_MODULES: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "General", label: "General", icon: MessageSquare },
  { value: "Workspace", label: "Workspace", icon: Building2 },
  { value: "Cabinet", label: "Cabinet", icon: Folder },
  { value: "Betty", label: "Betty", icon: Bot },
  { value: "Calendar", label: "Calendar / Receptionist", icon: Calendar },
  { value: "Tasks", label: "Tasks", icon: ClipboardCheck },
  { value: "DMs & Groups", label: "DMs & Groups", icon: Users },
  { value: "Floor Roster", label: "Floor Roster", icon: Building2 },
  { value: "Deskstream", label: "Deskstream", icon: Monitor },
  { value: "BackOffice", label: "BackOffice / Apps", icon: Settings },
  { value: "Billing", label: "Billing & Payments", icon: CreditCard },
  { value: "Account", label: "Account & Profile", icon: User },
  { value: "Other", label: "Other", icon: HelpCircle },
];

const PRIORITY_CONFIG = {
  low: {
    label: "Low",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    icon: Info,
  },
  medium: {
    label: "Medium",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: AlertTriangle,
  },
  high: {
    label: "High",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: Zap,
  },
  urgent: {
    label: "Urgent",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: Flame,
  },
};

const STATUS_CONFIG = {
  open: {
    label: "Open",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
    icon: AlertCircle,
  },
  in_progress: {
    label: "In Progress",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    icon: Clock,
  },
  resolved: {
    label: "Resolved",
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    color: "text-gray-400",
    bgColor: "bg-gray-500/10",
    borderColor: "border-gray-500/30",
    icon: CheckCircle2,
  },
};

interface SupportTicket {
  _id: string;
  orgId: string;
  orgName?: string;
  createdBy: TicketUser;
  subject: string;
  description: string;
  module: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  attachments: string[];
  // Assignment fields
  assignedTo?: TicketUser;
  assignedToFloor?: { _id: string; name: string; level: number };
  assignedAt?: string;
  assignedBy?: { _id: string; name?: string; email: string };
  responses: TicketResponse[];
  createdAt: string;
  updatedAt: string;
}

interface TeamMember {
  _id: string;
  name?: string;
  email: string;
  profilePicture?: string;
  role?: string;
  floorId?: string;
}

interface FloorOption {
  _id: string;
  name: string;
  level: number;
  memberCount: number;
}

const getFileIcon = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.match(/\.(jpg|jpeg|png|gif|webp|svg)$/)) return ImageIcon;
  if (lower.match(/\.(pdf|doc|docx|txt)$/)) return FileText;
  return File;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const getModuleIcon = (moduleName: string): LucideIcon => {
  const mod = SUPPORT_MODULES.find((m) => m.value === moduleName);
  return mod?.icon || HelpCircle;
};

// Garage HQ org ID - when viewing this org, members can see all tickets
const GARAGE_HQ_ORG_ID = "68f8ee6dc45c74df03e69211";

export default function SupportTicketsPage() {
  const { amIFounder } = useAmIFounder();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [responseMessage, setResponseMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachments, setAttachments] = useState<
    { file: File; url?: string; uploading: boolean }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [orgFilter, setOrgFilter] = useState<string>("all");
  const [isGarageHQMember, setIsGarageHQMember] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Assignment state (for global admin - only when viewing Garage HQ)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [floors, setFloors] = useState<FloorOption[]>([]);
  const [isLoadingAssignmentData, setIsLoadingAssignmentData] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [showAssignmentDropdown, setShowAssignmentDropdown] = useState(false);
  const [assignmentType, setAssignmentType] = useState<"user" | "floor">("user");

  // isGlobalAdmin = user is a Garage HQ member AND currently viewing Garage HQ org
  const isGlobalAdmin = isGarageHQMember && currentOrgId === GARAGE_HQ_ORG_ID;

  // Get current org ID from localStorage
  useEffect(() => {
    const orgId = localStorage.getItem("garage_org_id");
    setCurrentOrgId(orgId);
  }, []);

  // Check if user is a Garage HQ member on mount
  useEffect(() => {
    checkGarageHQMembership();
  }, []);

  // Listen for org switch events
  useEffect(() => {
    const handleOrgSwitch = () => {
      const orgId = localStorage.getItem("garage_org_id");
      setCurrentOrgId(orgId);
      // Clear selected ticket when switching orgs
      setSelectedTicket(null);
    };

    window.addEventListener("org:switched", handleOrgSwitch);
    return () => window.removeEventListener("org:switched", handleOrgSwitch);
  }, []);

  // Fetch tickets when org changes or role changes
  useEffect(() => {
    if (currentOrgId !== null) {
      fetchTickets();
    }
  }, [amIFounder, currentOrgId, isGarageHQMember]);

  const checkGarageHQMembership = async () => {
    try {
      const response = await api<{ isGarageHQMember: boolean }>(
        `/support-tickets/check-global-admin`,
        {},
        getToken()!
      );
      setIsGarageHQMember(response.isGarageHQMember || response.isGlobalAdmin);
    } catch (error) {
      console.error("Error checking Garage HQ membership:", error);
      setIsGarageHQMember(false);
    }
  };

  // Fetch team members and floors for assignment (global admin only)
  const fetchAssignmentData = async () => {
    if (!isGlobalAdmin) return;

    setIsLoadingAssignmentData(true);
    try {
      const [membersRes, floorsRes] = await Promise.all([
        api<{ teamMembers: TeamMember[] }>(
          `/support-tickets/assignment/team-members`,
          {},
          getToken()!
        ),
        api<{ floors: FloorOption[] }>(
          `/support-tickets/assignment/floors`,
          {},
          getToken()!
        ),
      ]);
      setTeamMembers(membersRes.teamMembers || []);
      setFloors(floorsRes.floors || []);
    } catch (error) {
      console.error("Error fetching assignment data:", error);
      toast.error("Failed to load assignment options");
    } finally {
      setIsLoadingAssignmentData(false);
    }
  };

  // Assign ticket to user or floor
  const assignTicket = async (assignTo: string, type: "user" | "floor") => {
    if (!selectedTicket) return;

    setIsAssigning(true);
    try {
      const body = type === "user"
        ? { assignedTo: assignTo }
        : { assignedToFloor: assignTo };

      const response = await api<{ ticket: SupportTicket }>(
        `/support-tickets/${selectedTicket._id}/assign`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
        getToken()!
      );

      toast.success(type === "user" ? "Ticket assigned to team member" : "Ticket assigned to floor");
      setSelectedTicket(response.ticket);
      setShowAssignmentDropdown(false);
      fetchTickets(); // Refresh list
    } catch (error) {
      console.error("Error assigning ticket:", error);
      toast.error("Failed to assign ticket");
    } finally {
      setIsAssigning(false);
    }
  };

  // Unassign ticket
  const unassignTicket = async () => {
    if (!selectedTicket) return;

    setIsAssigning(true);
    try {
      const response = await api<{ ticket: SupportTicket }>(
        `/support-tickets/${selectedTicket._id}/unassign`,
        {
          method: "PATCH",
        },
        getToken()!
      );

      toast.success("Ticket unassigned");
      setSelectedTicket(response.ticket);
      fetchTickets(); // Refresh list
    } catch (error) {
      console.error("Error unassigning ticket:", error);
      toast.error("Failed to unassign ticket");
    } finally {
      setIsAssigning(false);
    }
  };

  // Fetch assignment data when global admin opens a ticket
  useEffect(() => {
    if (isGlobalAdmin && selectedTicket && teamMembers.length === 0) {
      fetchAssignmentData();
    }
  }, [isGlobalAdmin, selectedTicket]);

  // Socket.IO real-time updates
  useEffect(() => {
    if (!currentOrgId) return;

    const socket = connectSocket();

    // Join org support room
    socket.emit("support:join-org", { orgId: currentOrgId });

    // Join global support room if user is Garage HQ member
    if (isGarageHQMember) {
      socket.emit("support:join-global");
    }

    // Handler for new tickets
    const handleNewTicket = (data: { ticket: SupportTicket }) => {
      console.log("[SUPPORT] New ticket received:", data.ticket._id);
      setTickets((prev) => {
        // Avoid duplicates
        if (prev.some((t) => t._id === data.ticket._id)) return prev;
        return [data.ticket, ...prev];
      });
      toast.info(`New support ticket: ${data.ticket.subject}`);
    };

    // Handler for ticket responses
    const handleTicketResponse = (data: {
      ticketId: string;
      response: TicketResponse;
      ticket: SupportTicket;
    }) => {
      console.log("[SUPPORT] Ticket response received:", data.ticketId);
      // Update tickets list
      setTickets((prev) =>
        prev.map((t) => (t._id === data.ticketId ? data.ticket : t))
      );
      // Update selected ticket if viewing it
      setSelectedTicket((prev) =>
        prev?._id === data.ticketId ? data.ticket : prev
      );
    };

    // Handler for status changes
    const handleStatusChange = (data: {
      ticketId: string;
      status: string;
      ticket: SupportTicket;
    }) => {
      console.log("[SUPPORT] Ticket status changed:", data.ticketId, data.status);
      setTickets((prev) =>
        prev.map((t) => (t._id === data.ticketId ? data.ticket : t))
      );
      setSelectedTicket((prev) =>
        prev?._id === data.ticketId ? data.ticket : prev
      );
    };

    // Handler for assignment changes
    const handleTicketAssigned = (data: { ticketId: string; ticket: SupportTicket }) => {
      console.log("[SUPPORT] Ticket assigned:", data.ticketId);
      setTickets((prev) =>
        prev.map((t) => (t._id === data.ticketId ? data.ticket : t))
      );
      setSelectedTicket((prev) =>
        prev?._id === data.ticketId ? data.ticket : prev
      );
    };

    // Handler for unassignment
    const handleTicketUnassigned = (data: { ticketId: string; ticket: SupportTicket }) => {
      console.log("[SUPPORT] Ticket unassigned:", data.ticketId);
      setTickets((prev) =>
        prev.map((t) => (t._id === data.ticketId ? data.ticket : t))
      );
      setSelectedTicket((prev) =>
        prev?._id === data.ticketId ? data.ticket : prev
      );
    };

    // Subscribe to events
    socket.on("support:new-ticket", handleNewTicket);
    socket.on("support:ticket-response", handleTicketResponse);
    socket.on("support:ticket-status-changed", handleStatusChange);
    socket.on("support:ticket-assigned", handleTicketAssigned);
    socket.on("support:ticket-unassigned", handleTicketUnassigned);

    // Cleanup on unmount or org change
    return () => {
      socket.emit("support:leave-org", { orgId: currentOrgId });
      if (isGarageHQMember) {
        socket.emit("support:leave-global");
      }
      socket.off("support:new-ticket", handleNewTicket);
      socket.off("support:ticket-response", handleTicketResponse);
      socket.off("support:ticket-status-changed", handleStatusChange);
      socket.off("support:ticket-assigned", handleTicketAssigned);
      socket.off("support:ticket-unassigned", handleTicketUnassigned);
    };
  }, [currentOrgId, isGarageHQMember]);

  // Join/leave ticket room when selecting a ticket (for real-time messages)
  useEffect(() => {
    if (!selectedTicket) return;

    const socket = connectSocket();
    socket.emit("support:join-ticket", { ticketId: selectedTicket._id });

    return () => {
      socket.emit("support:leave-ticket", { ticketId: selectedTicket._id });
    };
  }, [selectedTicket?._id]);

  const fetchTickets = async () => {
    try {
      setIsLoading(true);
      const orgId = currentOrgId || localStorage.getItem("garage_org_id");

      let endpoint: string;
      // Only show global tickets when viewing Garage HQ org AND user is a Garage HQ member
      if (isGarageHQMember && orgId === GARAGE_HQ_ORG_ID) {
        endpoint = `/support-tickets/global`;
      } else if (!orgId) {
        setIsLoading(false);
        return;
      } else if (amIFounder) {
        endpoint = `/support-tickets/all?orgId=${orgId}`;
      } else {
        endpoint = `/support-tickets/my?orgId=${orgId}`;
      }

      const response = await api<{ tickets: SupportTicket[]; isGlobalAdmin?: boolean }>(
        endpoint,
        {},
        getToken()!
      );

      setTickets(response.tickets || []);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast.error("Failed to load support tickets");
    } finally {
      setIsLoading(false);
    }
  };

  const updateTicketStatus = async (
    ticketId: string,
    status: SupportTicket["status"]
  ) => {
    try {
      const orgId = currentOrgId || localStorage.getItem("garage_org_id");

      const endpoint = isGlobalAdmin
        ? `/support-tickets/${ticketId}/status`
        : `/support-tickets/${ticketId}/status?orgId=${orgId}`;

      if (!isGlobalAdmin && !orgId) return;

      await api(
        endpoint,
        {
          method: "PATCH",
          body: JSON.stringify({ status }),
        },
        getToken()!
      );

      toast.success("Ticket status updated");
      fetchTickets();
      if (selectedTicket?._id === ticketId) {
        setSelectedTicket((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast.error("Failed to update status");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const newAttachment = { file, uploading: true };
    setAttachments((prev) => [...prev, newAttachment]);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${getToken()}`,
          },
          body: formData,
        }
      );

      if (!response.ok) throw new Error("Upload failed");

      const data = await response.json();
      setAttachments((prev) =>
        prev.map((a) =>
          a.file === file ? { ...a, url: data.url, uploading: false } : a
        )
      );
    } catch (error) {
      console.error("File upload error:", error);
      toast.error("Failed to upload file");
      setAttachments((prev) => prev.filter((a) => a.file !== file));
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sendResponse = async () => {
    if (!selectedTicket || !responseMessage.trim()) return;

    setIsSending(true);
    try {
      const orgId = currentOrgId || localStorage.getItem("garage_org_id");

      const responseEndpoint = isGlobalAdmin
        ? `/support-tickets/${selectedTicket._id}/response`
        : `/support-tickets/${selectedTicket._id}/response?orgId=${orgId}`;

      const ticketEndpoint = isGlobalAdmin
        ? `/support-tickets/${selectedTicket._id}`
        : `/support-tickets/${selectedTicket._id}?orgId=${orgId}`;

      if (!isGlobalAdmin && !orgId) return;

      const attachmentUrls = attachments
        .filter((a) => a.url)
        .map((a) => a.url as string);

      await api(
        responseEndpoint,
        {
          method: "POST",
          body: JSON.stringify({
            message: responseMessage,
            attachments: attachmentUrls,
          }),
        },
        getToken()!
      );

      toast.success("Response sent");
      setResponseMessage("");
      setAttachments([]);
      fetchTickets();

      const response = await api<{ ticket: SupportTicket }>(
        ticketEndpoint,
        {},
        getToken()!
      );
      setSelectedTicket(response.ticket);
    } catch (error) {
      console.error("Error sending response:", error);
      toast.error("Failed to send response");
    } finally {
      setIsSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const formatFullDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const uniqueOrgs = isGlobalAdmin
    ? [...new Set(tickets.map((t) => t.orgName).filter(Boolean))]
    : [];

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (ticket.orgName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesOrg =
      orgFilter === "all" || ticket.orgName === orgFilter;
    return matchesSearch && matchesStatus && matchesOrg;
  });

  const isUploading = attachments.some((a) => a.uploading);

  // Stats
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;

  return (
    <div className="h-screen flex flex-col bg-[#0b0b0d] text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-[#2a2a35]">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {selectedTicket && (
                <motion.button
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#15151b] transition-all"
                >
                  <ChevronLeft className="h-5 w-5" />
                </motion.button>
              )}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border border-yellow-500/20 shadow-lg shadow-yellow-500/5">
                  <MessageCircleQuestion className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-white">
                    {isGlobalAdmin
                      ? "Global Support Tickets"
                      : amIFounder
                      ? "Support Tickets"
                      : "My Support Tickets"}
                  </h1>
                  <p className="text-sm text-gray-500">
                    {isGlobalAdmin
                      ? "All tickets across organizations"
                      : amIFounder
                      ? "Manage team support requests"
                      : "Track your support requests"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {!selectedTicket && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={fetchTickets}
                    disabled={isLoading}
                    className="h-10 w-10 text-gray-400 hover:text-white hover:bg-[#15151b] rounded-lg transition-all"
                  >
                    <RefreshCw
                      className={cn("h-4 w-4", isLoading && "animate-spin")}
                    />
                  </Button>
                  <SupportTicketModal onTicketCreated={fetchTickets}>
                    <Button
                      className="h-10 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-medium rounded-lg shadow-lg shadow-yellow-500/20 transition-all"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      New Ticket
                    </Button>
                  </SupportTicketModal>
                </>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          {!selectedTicket && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col lg:flex-row lg:items-center gap-4 mt-5"
            >
              {/* Stats Cards */}
              <div className="flex gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-400">{openCount} Open</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Clock className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-medium text-amber-400">{inProgressCount} In Progress</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">{resolvedCount} Resolved</span>
                </div>
              </div>

              <div className="flex-1" />

              {/* Search and Filters */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder={isGlobalAdmin ? "Search tickets or orgs..." : "Search tickets..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-64 h-10 bg-[#0e0e12] border-[#2a2a35] text-white placeholder:text-gray-600 rounded-lg focus:border-yellow-500/50"
                  />
                </div>
                {isGlobalAdmin && uniqueOrgs.length > 0 && (
                  <Select value={orgFilter} onValueChange={setOrgFilter}>
                    <SelectTrigger className="w-[180px] h-10 bg-[#0e0e12] border-[#2a2a35] text-white rounded-lg">
                      <Building2 className="h-4 w-4 mr-2 text-gray-500" />
                      <SelectValue placeholder="All Organizations" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0e0e12] border-[#2a2a35] rounded-lg">
                      <SelectItem value="all" className="text-white">All Organizations</SelectItem>
                      {uniqueOrgs.map((org) => (
                        <SelectItem key={org} value={org!} className="text-white">
                          {org}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px] h-10 bg-[#0e0e12] border-[#2a2a35] text-white rounded-lg">
                    <Filter className="h-4 w-4 mr-2 text-gray-500" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0e0e12] border-[#2a2a35] rounded-lg">
                    <SelectItem value="all" className="text-white">All Status</SelectItem>
                    <SelectItem value="open" className="text-white">Open</SelectItem>
                    <SelectItem value="in_progress" className="text-white">In Progress</SelectItem>
                    <SelectItem value="resolved" className="text-white">Resolved</SelectItem>
                    <SelectItem value="closed" className="text-white">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                </div>
                <p className="text-gray-500">Loading tickets...</p>
              </div>
            </motion.div>
          ) : selectedTicket ? (
            /* Ticket Detail View */
            <motion.div
              key="detail"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Ticket Header Card */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl overflow-hidden"
                >
                  <div className="relative px-6 pt-5 pb-4">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent" />

                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {isGlobalAdmin && selectedTicket.orgName && (
                            <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-xs">
                              <Building2 className="h-3 w-3 mr-1" />
                              {selectedTicket.orgName}
                            </Badge>
                          )}
                          {selectedTicket.module && (() => {
                            const ModIcon = getModuleIcon(selectedTicket.module);
                            return (
                              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                                <ModIcon className="h-3 w-3 mr-1" />
                                {selectedTicket.module}
                              </Badge>
                            );
                          })()}
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">
                          {selectedTicket.subject}
                        </h2>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={selectedTicket.createdBy.profilePicture} />
                              <AvatarFallback className="text-[10px] bg-[#2a2a35]">
                                {(
                                  selectedTicket.createdBy.name?.[0] ||
                                  selectedTicket.createdBy.email[0]
                                ).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>
                              {selectedTicket.createdBy.name ||
                                selectedTicket.createdBy.email}
                            </span>
                          </div>
                          <span className="text-gray-600">•</span>
                          <span>{formatFullDate(selectedTicket.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {(() => {
                          const priorityConf = PRIORITY_CONFIG[selectedTicket.priority];
                          const PriorityIcon = priorityConf.icon;
                          return (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                priorityConf.bgColor,
                                priorityConf.color,
                                priorityConf.borderColor
                              )}
                            >
                              <PriorityIcon className="h-3 w-3 mr-1" />
                              {priorityConf.label}
                            </Badge>
                          );
                        })()}
                        {(amIFounder || isGlobalAdmin) ? (
                          <Select
                            value={selectedTicket.status}
                            onValueChange={(v) =>
                              updateTicketStatus(
                                selectedTicket._id,
                                v as SupportTicket["status"]
                              )
                            }
                          >
                            <SelectTrigger
                              className={cn(
                                "h-8 w-[140px] text-xs border rounded-lg",
                                STATUS_CONFIG[selectedTicket.status].bgColor,
                                STATUS_CONFIG[selectedTicket.status].color,
                                STATUS_CONFIG[selectedTicket.status].borderColor
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0e0e12] border-[#2a2a35] rounded-lg">
                              {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => {
                                const conf = STATUS_CONFIG[key];
                                const Icon = conf.icon;
                                return (
                                  <SelectItem key={key} value={key} className="text-white">
                                    <span className="flex items-center gap-2">
                                      <Icon className={cn("h-3 w-3", conf.color)} />
                                      <span>{conf.label}</span>
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs flex items-center gap-1",
                              STATUS_CONFIG[selectedTicket.status].bgColor,
                              STATUS_CONFIG[selectedTicket.status].color,
                              STATUS_CONFIG[selectedTicket.status].borderColor
                            )}
                          >
                            {(() => {
                              const Icon = STATUS_CONFIG[selectedTicket.status].icon;
                              return <Icon className="h-3 w-3" />;
                            })()}
                            {STATUS_CONFIG[selectedTicket.status].label}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Assignment Section (Global Admin Only) */}
                    {isGlobalAdmin && (
                      <div className="pt-2 pb-2 border-t border-[#2a2a35]">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-sm font-medium text-gray-400 flex-shrink-0">Assignment:</span>
                            {selectedTicket.assignedTo ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={selectedTicket.assignedTo.profilePicture} />
                                  <AvatarFallback className="text-[10px] bg-cyan-500/20 text-cyan-400">
                                    {(selectedTicket.assignedTo.name?.[0] || selectedTicket.assignedTo.email[0]).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-cyan-400">
                                  {selectedTicket.assignedTo.name || selectedTicket.assignedTo.email}
                                </span>
                                <button
                                  onClick={unassignTicket}
                                  disabled={isAssigning}
                                  className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                                  title="Unassign"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ) : selectedTicket.assignedToFloor ? (
                              <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/30 rounded-lg">
                                <Building className="h-4 w-4 text-violet-400" />
                                <span className="text-sm text-violet-400">
                                  {selectedTicket.assignedToFloor.name}
                                </span>
                                <button
                                  onClick={unassignTicket}
                                  disabled={isAssigning}
                                  className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                                  title="Unassign"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-600">Unassigned</span>
                            )}
                          </div>

                          {/* Assign Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAssignmentDropdown(true)}
                            disabled={isAssigning || isLoadingAssignmentData}
                            className="h-8 px-3 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-[#2a2a35] hover:border-cyan-500/30 rounded-lg flex-shrink-0"
                          >
                            {isAssigning ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                              <UserPlus className="h-4 w-4 mr-2" />
                            )}
                            {selectedTicket.assignedTo || selectedTicket.assignedToFloor ? "Reassign" : "Assign"}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Assignment Modal (outside the card for proper z-index) */}
                    <AnimatePresence>
                      {showAssignmentDropdown && isGlobalAdmin && (
                        <>
                          {/* Backdrop */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowAssignmentDropdown(false)}
                            className="fixed inset-0 bg-black/50 z-[9998]"
                          />
                          {/* Modal */}
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-[#0e0e12] border border-[#2a2a35] rounded-xl shadow-2xl z-[9999] overflow-hidden"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a35]">
                              <h3 className="text-sm font-semibold text-white">Assign Ticket</h3>
                              <button
                                onClick={() => setShowAssignmentDropdown(false)}
                                className="p-1 rounded hover:bg-[#1a1a22] text-gray-500 hover:text-white transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>

                            {/* Assignment Type Tabs */}
                            <div className="flex border-b border-[#2a2a35]">
                              <button
                                onClick={() => setAssignmentType("user")}
                                className={cn(
                                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                                  assignmentType === "user"
                                    ? "bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500"
                                    : "text-gray-500 hover:text-gray-300"
                                )}
                              >
                                <User className="h-4 w-4 inline mr-2" />
                                Team Member
                              </button>
                              <button
                                onClick={() => setAssignmentType("floor")}
                                className={cn(
                                  "flex-1 px-4 py-2.5 text-sm font-medium transition-colors",
                                  assignmentType === "floor"
                                    ? "bg-violet-500/10 text-violet-400 border-b-2 border-violet-500"
                                    : "text-gray-500 hover:text-gray-300"
                                )}
                              >
                                <Building className="h-4 w-4 inline mr-2" />
                                Floor
                              </button>
                            </div>

                            {/* Options List */}
                            <div className="max-h-72 overflow-y-auto p-2">
                              {isLoadingAssignmentData ? (
                                <div className="flex items-center justify-center py-8">
                                  <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                                </div>
                              ) : assignmentType === "user" ? (
                                teamMembers.length === 0 ? (
                                  <div className="py-4 text-center text-sm text-gray-500">
                                    No team members found
                                  </div>
                                ) : (
                                  teamMembers.map((member) => (
                                    <button
                                      key={member._id}
                                      onClick={() => assignTicket(member._id, "user")}
                                      disabled={isAssigning}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-cyan-500/10 transition-colors text-left group"
                                    >
                                      <Avatar className="h-8 w-8">
                                        <AvatarImage src={member.profilePicture} />
                                        <AvatarFallback className="text-xs bg-[#2a2a35]">
                                          {(member.name?.[0] || member.email[0]).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white group-hover:text-cyan-300 truncate">
                                          {member.name || member.email}
                                        </div>
                                        {member.name && (
                                          <div className="text-xs text-gray-500 truncate">
                                            {member.email}
                                          </div>
                                        )}
                                      </div>
                                      {member.role === "founder" && (
                                        <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-[10px]">
                                          Founder
                                        </Badge>
                                      )}
                                    </button>
                                  ))
                                )
                              ) : (
                                floors.length === 0 ? (
                                  <div className="py-4 text-center text-sm text-gray-500">
                                    No floors found
                                  </div>
                                ) : (
                                  floors.map((floor) => (
                                    <button
                                      key={floor._id}
                                      onClick={() => assignTicket(floor._id, "floor")}
                                      disabled={isAssigning}
                                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-violet-500/10 transition-colors text-left group"
                                    >
                                      <div className="p-2 rounded-lg bg-violet-500/10">
                                        <Building className="h-4 w-4 text-violet-400" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="text-sm text-white group-hover:text-violet-300">
                                          {floor.name}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          Level {floor.level} • {floor.memberCount} member{floor.memberCount !== 1 ? "s" : ""}
                                        </div>
                                      </div>
                                    </button>
                                  ))
                                )
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* Description */}
                    <div className="pt-4 border-t border-[#2a2a35]">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {selectedTicket.description}
                      </p>
                      {selectedTicket.attachments.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-[#2a2a35]">
                          <div className="text-xs font-medium text-gray-500 mb-2">Attachments</div>
                          <div className="flex flex-wrap gap-2">
                            {selectedTicket.attachments.map((url, idx) => {
                              const FileIcon = getFileIcon(url);
                              return (
                                <a
                                  key={idx}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-2 bg-[#15151b] hover:bg-[#1a1a22] border border-[#2a2a35] rounded-lg text-sm text-gray-300 transition-all group"
                                >
                                  <FileIcon className="h-4 w-4 text-gray-500 group-hover:text-yellow-400" />
                                  <span>Attachment {idx + 1}</span>
                                  <ChevronRight className="h-3 w-3 text-gray-600 group-hover:text-gray-400" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Responses */}
                {selectedTicket.responses.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <MessageSquare className="h-4 w-4" />
                      <span>Responses ({selectedTicket.responses.length})</span>
                    </div>
                    {selectedTicket.responses.map((response, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + idx * 0.05 }}
                        className="bg-[#0e0e12] border border-[#2a2a35] rounded-xl p-5"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={response.respondedBy?.profilePicture} />
                            <AvatarFallback className="text-xs bg-[#2a2a35]">
                              {(
                                response.respondedBy?.name?.[0] ||
                                response.respondedBy?.email?.[0] ||
                                "?"
                              ).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="text-sm font-medium text-white">
                              {response.respondedBy?.name || response.respondedBy?.email}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              {formatFullDate(response.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                          {response.message}
                        </p>
                        {response.attachments?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {response.attachments.map((url, i) => {
                              const FileIcon = getFileIcon(url);
                              return (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-2 py-1.5 bg-[#15151b] hover:bg-[#1a1a22] border border-[#2a2a35] rounded-lg text-xs text-gray-400 transition-all"
                                >
                                  <FileIcon className="h-3 w-3" />
                                  Attachment {i + 1}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Response Input */}
              {selectedTicket.status !== "closed" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 border-t border-[#2a2a35] flex-shrink-0 bg-[#0b0b0d]"
                >
                  <div className="space-y-3">
                    <AnimatePresence>
                      {attachments.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="flex flex-wrap gap-2"
                        >
                          {attachments.map((attachment, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-2 px-2 py-1.5 bg-[#15151b] border border-[#2a2a35] rounded-lg text-xs group"
                            >
                              {attachment.uploading ? (
                                <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                              )}
                              <span className="text-gray-300 truncate max-w-[100px]">
                                {attachment.file.name}
                              </span>
                              {!attachment.uploading && (
                                <button
                                  onClick={() =>
                                    setAttachments((prev) =>
                                      prev.filter((a) => a.file !== attachment.file)
                                    )
                                  }
                                  className="text-gray-500 hover:text-red-400 transition-colors"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="flex gap-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        onChange={(e) => handleFileSelect(e, false)}
                        className="hidden"
                        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.zip,.rar"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-11 w-11 text-gray-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded-lg flex-shrink-0 transition-all"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Textarea
                        placeholder="Write your response..."
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        className="flex-1 min-h-[44px] max-h-[120px] bg-[#0e0e12] border-[#2a2a35] text-white placeholder:text-gray-600 resize-none rounded-lg focus:border-yellow-500/50"
                      />
                      <Button
                        onClick={sendResponse}
                        disabled={isSending || isUploading || !responseMessage.trim()}
                        className={cn(
                          "h-11 px-5 rounded-lg font-medium transition-all flex-shrink-0",
                          "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400",
                          "text-black shadow-lg shadow-yellow-500/20",
                          (isSending || isUploading || !responseMessage.trim()) && "opacity-50 cursor-not-allowed shadow-none"
                        )}
                      >
                        {isSending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Send
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          ) : filteredTickets.length === 0 ? (
            /* Empty State */
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <div className="p-6 rounded-full bg-[#15151b] border border-[#2a2a35] mb-6">
                <MessageCircleQuestion className="h-12 w-12 text-gray-600" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">No support tickets</h3>
              <p className="text-sm text-gray-500 text-center max-w-sm mb-6">
                {searchQuery || statusFilter !== "all" || orgFilter !== "all"
                  ? "No tickets match your search or filter criteria."
                  : isGlobalAdmin
                  ? "No tickets have been raised across any organization."
                  : amIFounder
                  ? "No tickets have been raised yet."
                  : "You haven't raised any support tickets yet."}
              </p>
              {!searchQuery && statusFilter === "all" && orgFilter === "all" && (
                <SupportTicketModal onTicketCreated={fetchTickets}>
                  <Button
                    className="h-11 px-5 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-medium rounded-lg shadow-lg shadow-yellow-500/20 transition-all"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Ticket
                  </Button>
                </SupportTicketModal>
              )}
            </motion.div>
          ) : (
            /* Tickets List */
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="overflow-y-auto h-full"
            >
              <div className="p-6 space-y-3">
                {filteredTickets.map((ticket, idx) => {
                  const priorityConf = PRIORITY_CONFIG[ticket.priority];
                  const statusConf = STATUS_CONFIG[ticket.status];
                  const PriorityIcon = priorityConf.icon;
                  const StatusIcon = statusConf.icon;

                  return (
                    <motion.div
                      key={ticket._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedTicket(ticket)}
                      className="group p-5 bg-[#0e0e12] border border-[#2a2a35] rounded-xl hover:border-yellow-500/30 hover:bg-[#0f0f14] cursor-pointer transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {isGlobalAdmin && ticket.orgName && (
                              <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-[10px]">
                                <Building2 className="h-3 w-3 mr-1" />
                                {ticket.orgName}
                              </Badge>
                            )}
                            {ticket.module && (() => {
                              const ModIcon = getModuleIcon(ticket.module);
                              return (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[10px]">
                                  <ModIcon className="h-3 w-3 mr-1" />
                                  {ticket.module}
                                </Badge>
                              );
                            })()}
                            {ticket.responses.length > 0 && (
                              <Badge variant="outline" className="bg-[#15151b] text-gray-400 border-[#2a2a35] text-[10px]">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                {ticket.responses.length}
                              </Badge>
                            )}
                            {/* Assignment indicator for global admin */}
                            {isGlobalAdmin && ticket.assignedTo && (
                              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[10px]">
                                <User className="h-3 w-3 mr-1" />
                                {ticket.assignedTo.name || ticket.assignedTo.email?.split("@")[0] || "Assigned"}
                              </Badge>
                            )}
                            {isGlobalAdmin && ticket.assignedToFloor && (
                              <Badge variant="outline" className="bg-violet-500/10 text-violet-400 border-violet-500/30 text-[10px]">
                                <Building className="h-3 w-3 mr-1" />
                                {ticket.assignedToFloor.name}
                              </Badge>
                            )}
                          </div>
                          <h3 className="font-medium text-white truncate mb-1 group-hover:text-yellow-100 transition-colors">
                            {ticket.subject}
                          </h3>
                          <p className="text-sm text-gray-500 line-clamp-1 mb-3">
                            {ticket.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            {(amIFounder || isGlobalAdmin) && (
                              <div className="flex items-center gap-1.5">
                                <Avatar className="h-4 w-4">
                                  <AvatarImage src={ticket.createdBy.profilePicture} />
                                  <AvatarFallback className="text-[8px] bg-[#2a2a35]">
                                    {(
                                      ticket.createdBy.name?.[0] ||
                                      ticket.createdBy.email[0]
                                    ).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-gray-500">
                                  {ticket.createdBy.name || ticket.createdBy.email}
                                </span>
                              </div>
                            )}
                            {(amIFounder || isGlobalAdmin) && (
                              <span className="text-gray-700">•</span>
                            )}
                            <span>{formatDate(ticket.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              priorityConf.bgColor,
                              priorityConf.color,
                              priorityConf.borderColor
                            )}
                          >
                            <PriorityIcon className="h-3 w-3 mr-1" />
                            {priorityConf.label}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              statusConf.bgColor,
                              statusConf.color,
                              statusConf.borderColor
                            )}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusConf.label}
                          </Badge>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
