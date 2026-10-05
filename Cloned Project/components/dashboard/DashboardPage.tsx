"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  Users,
  Crown,
  UserCheck,
  UsersRound,
  Home,
  Building2,
  Inbox,
  Plus,
  Tag,
  ArrowRightLeft,
  Trash2,
  Edit2,
  MoreVertical,
  UserMinus,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAmIFounder } from "@/lib/hooks/useAmIFounder";
import { LastSeen } from "@/components/shared/LastSeen";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

type Member = {
  id?: string;
  _id?: string;
  name?: string;
  email: string;
  role: "founder" | "stakeholder";
  profilePicture?: string;
  avatar?: string;
  guest?: boolean;
  actions?: {
    canKick: boolean;
    canDeletePermanently: boolean;
    isCurrentUser: boolean;
    reason: string | null;
  };
};

type FloorMember = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  department?: string;
  profilePicture?: string | null;
  /** ISO date string for the "Active X ago" affordance. */
  lastSeenAt?: string | null;
};

type DeptCount = { name: string; count: number };

type FloorRoster = {
  id: string;
  level: number;
  name: string;
  departments: DeptCount[];
  members: FloorMember[];
  pending?: {
    id: string;
    name?: string;
    email: string;
    role: "admin" | "user";
    department?: string;
    createdAt?: string;
  }[];
};

type FloorResp = {
  floors: FloorRoster[];
  unassigned: { members: FloorMember[]; pending?: any[] };
};

type Dept = { name: string; color?: string };

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "floor-roster">(
    "dashboard"
  );

  return (
    <div className="h-full">
      {/* Tab Navigation */}
      <div className="pt-2 sticky top-0 z-10 bg-[#0b0b0d] border-b border-[#2a2a35]">
        <div className="px-3 sm:px-4 pt-3 sm:pt-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-all duration-200",
                activeTab === "dashboard"
                  ? "bg-[#111116] text-white border border-[#2a2a35] border-b-[#111116]"
                  : "text-[#9fa0b8] hover:text-white hover:bg-[#15151b]"
              )}
            >
              <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("floor-roster")}
              className={cn(
                "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-all duration-200",
                activeTab === "floor-roster"
                  ? "bg-[#111116] text-white border border-[#2a2a35] border-b-[#111116]"
                  : "text-[#9fa0b8] hover:text-white hover:bg-[#15151b]"
              )}
            >
              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Floor Roster</span>
              <span className="sm:hidden">Floors</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-[#111116] min-h-[calc(100vh-60px)]">
        {activeTab === "dashboard" ? (
          <DashboardContent />
        ) : (
          <FloorRosterContent />
        )}
      </div>
    </div>
  );
}

// Dashboard Content Component
function DashboardContent() {
  const { amIFounder } = useAmIFounder();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Member management state
  const [memberToKick, setMemberToKick] = useState<Member | null>(null);
  const [kickingMember, setKickingMember] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Kick member from HQ
  const handleKickMember = async (memberId: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;
    setKickingMember(true);
    try {
      await api(
        `/org/${orgId}/members/${memberId}`,
        { method: "DELETE" },
        getToken()!
      );
      toast.success("Member removed from HQ successfully!");
      setMemberToKick(null);
      load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to remove member");
    } finally {
      setKickingMember(false);
    }
  };

  // Permanently delete member account
  const handleDeleteMember = async (memberId: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) return;
    setDeletingMember(true);
    try {
      await api(
        `/org/${orgId}/members/${memberId}/permanent`,
        {
          method: "DELETE",
          body: JSON.stringify({ confirmation: "PERMANENTLY_DELETE" }),
        },
        getToken()!
      );
      toast.success("Member account permanently deleted!");
      setMemberToDelete(null);
      load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete member account");
    } finally {
      setDeletingMember(false);
    }
  };

  async function load() {
    setLoading(true);
    const orgId = localStorage.getItem("garage_org_id");
    const res = await api<{ members: Member[] }>(
      "/team/list?orgId=" + orgId,
      {},
      getToken()!
    );
    setMembers(res.members || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    const fn = () => load();
    window.addEventListener("team:reload", fn as any);
    return () => window.removeEventListener("team:reload", fn as any);
  }, []);

  const admins = members.filter((m) => m.role === "founder");
  const stakeholders = members.filter(
    (m) => m.role === "stakeholder" && !m.guest
  );
  const guests = members.filter((m) => m.guest === true);

  // Generate initials from name or email
  const getInitials = (m: Member) => {
    if (m.name) {
      return m.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return m.email.slice(0, 2).toUpperCase();
  };

  const Row = ({ m }: { m: Member }) => {
    const profileImg = m.profilePicture || m.avatar;
    const memberId = m.id || m._id;
    const showActions =
      amIFounder &&
      !m.actions?.isCurrentUser &&
      (m.actions?.canKick || m.actions?.canDeletePermanently);

    return (
      <div className="group flex items-center gap-2 sm:gap-2.5 p-2 sm:p-3 rounded-lg bg-[#14141a] border border-[#2c2c3a] hover:border-[#4c2e8f] transition-all duration-200 hover:shadow-lg hover:shadow-purple-900/10">
        {/* Avatar with profile picture or initials */}
        <div
          className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#2a1752] to-[#4c2e8f] flex items-center justify-center text-white font-semibold text-[10px] sm:text-xs border border-[#4c2e8f] overflow-hidden cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => {
            if (memberId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId: memberId },
                })
              );
            }
          }}
        >
          {profileImg ? (
            <img
              src={profileImg}
              alt={m.name || m.email}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.parentElement!.textContent = getInitials(m);
              }}
            />
          ) : (
            getInitials(m)
          )}
        </div>

        {/* User info */}
        <div
          className="flex-1 min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
          onClick={() => {
            if (memberId) {
              window.dispatchEvent(
                new CustomEvent("affiliate-profile:open", {
                  detail: { userId: memberId },
                })
              );
            }
          }}
        >
          <div className="font-medium text-xs text-white truncate">
            {m.name || m.email}
          </div>
          <div className="text-[10px] text-[#9fa0b8] truncate">{m.email}</div>
        </div>

        {/* Role badge */}
        <Badge className="text-[9px] px-2 py-0.5 bg-[#2a1752] text-[#e6d7ff] border border-[#4c2e8f] group-hover:bg-[#3a2762] transition-colors">
          {m.role === "founder" ? (
            <Crown className="w-2.5 h-2.5 mr-0.5 inline" />
          ) : (
            <UserCheck className="w-2.5 h-2.5 mr-0.5 inline" />
          )}
          {m.role}
        </Badge>

        {/* Actions dropdown for founders */}
        {showActions && memberId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4 text-[#9fa0b8]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-[#0e0e12] border border-[#2a2a35] text-white"
            >
              {m.actions?.canKick && (
                <DropdownMenuItem
                  onClick={() => setMemberToKick(m)}
                  className="text-[#c7c7da] hover:bg-[#1a1a22] hover:text-white cursor-pointer"
                >
                  <UserMinus className="h-4 w-4 mr-2" />
                  Remove from HQ
                </DropdownMenuItem>
              )}
              {/* 
              {m.actions?.canDeletePermanently && (
                <DropdownMenuItem
                  onClick={() => setMemberToDelete(m)}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-400 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account Permanently
                </DropdownMenuItem>
              )}
               */}

              </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    );
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card className="border border-[#2a2a35] bg-gradient-to-br from-[#111116] to-[#14141a] hover:border-[#4c2e8f] transition-all duration-200">
      <CardContent className="px-2 sm:px-4 py-2 sm:py-3">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] text-[#9fa0b8] uppercase tracking-wider mb-0.5 truncate">
              {title}
            </p>
            <p className="text-lg sm:text-2xl font-bold text-white">{value}</p>
          </div>
          <div className={`p-1.5 sm:p-2 rounded-lg ${color} flex-shrink-0`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-3 sm:p-5 space-y-4">
      {/* Header */}
      <div className="mb-1">
        <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">Dashboard</h1>
        <p className="text-xs text-[#a5a6bf]">
          Overview of your workspace members and team structure
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mt-4">
        <StatCard
          title="Total Members"
          value={loading ? "..." : members.length}
          icon={Users}
          color="bg-gradient-to-br from-[#4c2e8f] to-[#2a1752]"
        />
        <StatCard
          title="Founders"
          value={loading ? "..." : admins.length}
          icon={Crown}
          color="bg-gradient-to-br from-[#6d3aad] to-[#4c2e8f]"
        />
        <StatCard
          title="Stakeholders"
          value={loading ? "..." : stakeholders.length}
          icon={UserCheck}
          color="bg-gradient-to-br from-[#5a2e8f] to-[#3a1f62]"
        />
        <StatCard
          title="Community"
          value={loading ? "..." : guests.length}
          icon={UsersRound}
          color="bg-gradient-to-br from-[#3a5e8f] to-[#1f3a62]"
        />
      </div>

      {/* Team Members Card */}
      <Card className="border border-[#2a2a35] bg-[#111116] shadow-xl">
        <CardHeader className="border-b border-[#2a2a35] px-3 sm:px-4 py-3 sm:py-4">
          <CardTitle className="text-white flex items-center gap-2 text-sm sm:text-base">
            <Users className="w-4 h-4" />
            Team Members
          </CardTitle>
          <CardDescription className="text-[10px] text-[#a5a6bf]">
            Manage and view all members in your workspace
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-4 max-w-5xl">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4c2e8f]"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {/* Founders Section */}
              <section>
                <div className="flex items-center gap-1.5 mb-3">
                  <Crown className="w-3.5 h-3.5 text-[#e6d7ff]" />
                  <h3 className="text-[10px] uppercase tracking-wider text-[#e6d7ff] font-semibold">
                    Founders ({admins.length})
                  </h3>
                </div>
                <div className="space-y-2">
                  {admins.map((m, i) => (
                    <Row key={i} m={m} />
                  ))}
                  {admins.length === 0 && (
                    <div className="text-center py-6 px-3 rounded-lg border border-dashed border-[#2c2c3a]">
                      <Crown className="w-8 h-8 text-[#4c2e8f] mx-auto mb-1.5 opacity-50" />
                      <p className="text-xs text-[#9fa0b8]">No founders yet</p>
                      <p className="text-[10px] text-[#6f7088] mt-0.5">
                        Founders will appear here
                      </p>
                    </div>
                  )}
                </div>
              </section>

              {/* Team and Community Section - Side by side on desktop, stacked on mobile */}
              <div className="flex flex-col md:flex-row w-full gap-4 md:gap-6">
                {/* Team (Stakeholders) - Left side */}
                <div className="flex-1 min-w-0 overflow-hidden">
                  {guests.length > 0 && (
                    <div className="w-full text-center mb-3 hidden md:block">
                      <span className="text-[#9fa0b8] text-sm font-medium">
                        Team
                      </span>
                    </div>
                  )}
                  <section>
                    <div className="flex items-center gap-1.5 mb-3">
                      <UserCheck className="w-3.5 h-3.5 text-[#e6d7ff]" />
                      <h3 className="text-[10px] uppercase tracking-wider text-[#e6d7ff] font-semibold">
                        Stakeholders ({stakeholders.length})
                      </h3>
                    </div>
                    <div className="space-y-2">
                      {stakeholders.map((m, i) => (
                        <Row key={i} m={m} />
                      ))}
                      {stakeholders.length === 0 && (
                        <div className="text-center py-6 px-3 rounded-lg border border-dashed border-[#2c2c3a]">
                          <UserCheck className="w-8 h-8 text-[#4c2e8f] mx-auto mb-1.5 opacity-50" />
                          <p className="text-xs text-[#9fa0b8]">
                            No stakeholders yet
                          </p>
                          <p className="text-[10px] text-[#6f7088] mt-0.5">
                            Stakeholders will appear here
                          </p>
                        </div>
                      )}
                    </div>
                  </section>
                </div>

                {/* Vertical divider - only on desktop */}
                {guests.length > 0 && (
                  <div className="hidden md:block w-px bg-[#2c2c3a] self-stretch min-h-[100px]" />
                )}

                {/* Community (Guests) - Right side */}
                {guests.length > 0 && (
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="w-full text-center mb-3 hidden md:block">
                      <span className="text-[#9fa0b8] text-sm font-medium">
                        Community
                      </span>
                    </div>
                    <section>
                      <div className="flex items-center gap-1.5 mb-3">
                        <UsersRound className="w-3.5 h-3.5 text-[#e6d7ff]" />
                        <h3 className="text-[10px] uppercase tracking-wider text-[#e6d7ff] font-semibold">
                          Guests ({guests.length})
                        </h3>
                      </div>
                      <div className="space-y-2">
                        {guests.map((m, i) => (
                          <Row key={i} m={m} />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Kick Member Confirmation Dialog */}
      <Dialog
        open={!!memberToKick}
        onOpenChange={(open) => !open && setMemberToKick(null)}
      >
        <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-orange-400" />
              Remove Member from HQ
            </DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              Are you sure you want to remove{" "}
              <span className="text-white font-medium">
                {memberToKick?.name || memberToKick?.email}
              </span>{" "}
              from this HQ? They will lose access to all channels and content in
              this organization, but their account will remain active.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToKick(null)}
              disabled={kickingMember}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const memberId = memberToKick?.id || memberToKick?._id;
                if (memberId) handleKickMember(memberId);
              }}
              disabled={kickingMember}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {kickingMember ? "Removing..." : "Remove from HQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanently Delete Member Confirmation Dialog */}
      <Dialog
        open={!!memberToDelete}
        onOpenChange={(open) => !open && setMemberToDelete(null)}
      >
        <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Permanently Delete Account
            </DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              <div className="space-y-3">
                <p>
                  Are you sure you want to permanently delete the account for{" "}
                  <span className="text-white font-medium">
                    {memberToDelete?.name || memberToDelete?.email}
                  </span>
                  ?
                </p>
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-300 text-sm">
                  <strong>Warning:</strong> This action cannot be undone. The
                  user will be removed from all organizations and their account
                  will be permanently deleted.
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMemberToDelete(null)}
              disabled={deletingMember}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22]"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const memberId = memberToDelete?.id || memberToDelete?._id;
                if (memberId) handleDeleteMember(memberId);
              }}
              disabled={deletingMember}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deletingMember ? "Deleting..." : "Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Floor Roster Content Component
function FloorRosterContent() {
  const { amIFounder } = useAmIFounder();
  const [data, setData] = useState<FloorResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  // `userStatuses` (live available/busy/afk) was removed with the
  // status-broadcast UI. Members now show "Active X ago" via `lastSeenAt`.
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showChangeAssignmentsDialog, setShowChangeAssignmentsDialog] =
    useState(false);
  const [floorToDelete, setFloorToDelete] = useState<FloorRoster | null>(null);
  const [deletingFloor, setDeletingFloor] = useState(false);
  const [floorToEdit, setFloorToEdit] = useState<FloorRoster | null>(null);

  const load = async () => {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      console.error("No orgId found");
      setLoading(false);
      return;
    }
    try {
      const res = await api<FloorResp>(
        `/floors/roster?orgId=${orgId}`,
        {},
        getToken()!
      );
      setData(res);
    } catch (error) {
      console.error("Failed to load floor roster:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    const orgId = localStorage.getItem("garage_org_id");

    setDeletingFloor(true);
    try {
      await api(
        `/floors/${floorId}?organizationId=${orgId}`,
        { method: "DELETE" },
        getToken()!
      );
      toast.success("Floor deleted successfully!");
      setFloorToDelete(null);
      load();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete floor");
    } finally {
      setDeletingFloor(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // The live status listener was removed with the available/busy/afk
  // broadcast. Presence is rendered as "Active X ago" via `lastSeenAt`.

  const filtered = useMemo(() => {
    if (!data) return null;
    const qq = q.trim().toLowerCase();
    if (!qq) return data;
    return {
      floors: data.floors.filter((f) => f.name.toLowerCase().includes(qq)),
      unassigned: data.unassigned,
    } as FloorResp;
  }, [data, q]);

  if (loading) {
    return (
      <div className="px-3 sm:px-6 py-4 sm:py-6">
        <div className="h-8 w-48 bg-[#15151b] rounded mb-4" />
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-40 border border-[#2a2a35] bg-[#0e0e12] rounded-xl"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!filtered) return null;

  return (
    <div className="px-3 sm:px-6 py-4 sm:py-6">
      <div className="mb-4 sm:mb-6">
        {/* Title section */}
        <div className="mb-3 sm:mb-4">
          <div className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] bg-[#1a1a22] border border-[#2a2a35] text-[#c7c7da]">
            <Building2 className="h-3.5 w-3.5" />
            Floor Roster
          </div>
          <h1 className="text-xl sm:text-2xl mt-2 font-semibold">
            People by floor & department
          </h1>
          <p className="text-xs sm:text-sm text-[#a5a6bf]">
            View who's assigned where — including pending invites and unassigned
            teammates.
          </p>
        </div>

        {/* Search and action buttons - stack on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by floor name…"
            className="h-10 w-full sm:w-auto rounded-md bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 px-3 text-sm"
          />
          {amIFounder && (
            <div className="flex items-center gap-2">
              <motion.div whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                <Button
                  onClick={() => setShowChangeAssignmentsDialog(true)}
                  className="w-full sm:w-auto bg-[#111111] hover:bg-[#1a1a1a] text-brand border border-[#3a3a3a] transition-all duration-200 hover:scale-105 text-xs sm:text-sm"
                >
                  <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                  <span className="hidden sm:inline">Change Assignments</span>
                  <span className="sm:hidden">Assign</span>
                </Button>
              </motion.div>
              <motion.div whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                <Button
                  onClick={() => setShowAddDialog(true)}
                  className="w-full sm:w-auto bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 text-xs sm:text-sm"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add Floor
                </Button>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
        {filtered.floors.map((f) => (
          <Card
            key={f.id}
            className={cn(
              "border border-[#2a2a35] bg-[#0e0e12]/92 rounded-xl overflow-hidden",
              "shadow-[0_12px_40px_rgba(0,0,0,0.35)] py-0"
            )}
          >
            {/* header */}
            <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-[#2a2a35] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg grid place-items-center bg-brand/15 border border-brand/30 text-brand text-xs sm:text-sm flex-shrink-0">
                  {f.level}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm sm:text-base truncate">{f.name}</div>
                  <div className="text-[10px] sm:text-[11px] text-[#9fa0b8]">
                    Level {f.level}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <div className="text-[11px] sm:text-[12px] text-[#9fa0b8] flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  {f.members.length}
                </div>
                {amIFounder && (
                  <>
                    <motion.div whileTap={{ scale: 0.95 }}>
                      <Button
                        onClick={() => setFloorToEdit(f)}
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 sm:h-8 sm:w-8 p-0 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] hover:border-[#3a3a45] transition-all duration-200"
                      >
                        <Edit2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </Button>
                    </motion.div>
                    {f.members.length === 0 && (
                      <motion.div whileTap={{ scale: 0.95 }}>
                        <Button
                          onClick={() => setFloorToDelete(f)}
                          variant="outline"
                          size="sm"
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 border border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50 transition-all duration-200"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Button>
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* departments chips */}
            <div className="px-3 sm:px-4">
              {f.departments.length ? (
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
                  {f.departments.map((d) => (
                    <span
                      key={d.name}
                      className="inline-flex items-center gap-1.5 px-2 h-6 sm:h-7 rounded-md border border-[#3b3b4a] bg-[#15151b] text-[11px] sm:text-[12px]"
                    >
                      {d.name}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] sm:text-[12px] text-[#9fa0b8]">
                  No departments configured.
                </div>
              )}
            </div>

            {/* members list */}
            <div className="px-3 sm:px-4 pb-3">
              {f.members.length ? (
                <ul className="divide-y divide-[#23232f]">
                  {f.members.map((m) => (
                    <li
                      key={m.id}
                      className="py-2 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Avatar className="h-6 w-6 sm:h-7 sm:w-7 border border-[#2f2f3b] bg-[#1b1b24] flex-shrink-0">
                          <AvatarFallback className="text-[10px] sm:text-xs text-black font-medium">
                            {(m.name || m.email || "?")
                              .slice(0, 1)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm truncate">
                            {m.name || m.email}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-[#9fa0b8] truncate">
                            {m.email}
                          </div>
                          <LastSeen
                            date={m.lastSeenAt}
                            className="text-[10px] text-[#6b6b80]"
                          />
                          {/* "In a meeting" pill removed with the status broadcast. */}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {m.department ? (
                          <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {m.department}
                          </span>
                        ) : null}
                        <Badge
                          variant="outline"
                          className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent"
                        >
                          {m.role}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[12px] text-[#9fa0b8] py-2">
                  No members on this floor yet.
                </div>
              )}
            </div>

            {/* optional pending invites for this floor */}
            {amIFounder && (
              <>
                {f.pending && f.pending.length > 0 && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <div className="mt-1 text-[11px] uppercase tracking-wider text-[#9fa0b8] flex items-center gap-1">
                      <Inbox className="h-3.5 w-3.5" /> Pending invites
                    </div>
                    <ul className="mt-2 space-y-1">
                      {f.pending.map((p) => (
                        <li
                          key={p.id}
                          className="text-[12px] text-[#c7c7da] flex items-center gap-2"
                        >
                          <span className="inline-flex items-center gap-1 px-2 h-6 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {p.email}
                            {p.department ? (
                              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-brand/15 text-brand border border-brand/20">
                                {p.department}
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </Card>
        ))}
      </div>

      {/* Add Floor Dialog */}
      <AddFloorDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSuccess={() => {
          setShowAddDialog(false);
          load();
        }}
        existingFloors={data?.floors || []}
      />

      {/* Change Assignments Dialog */}
      <ChangeAssignmentsDialog
        open={showChangeAssignmentsDialog}
        onOpenChange={setShowChangeAssignmentsDialog}
        onSuccess={() => {
          setShowChangeAssignmentsDialog(false);
          load();
        }}
        floors={data?.floors || []}
        unassignedMembers={data?.unassigned.members || []}
      />

      {/* Edit Floor Dialog */}
      <EditFloorDialog
        open={!!floorToEdit}
        onOpenChange={(open) => !open && setFloorToEdit(null)}
        onSuccess={() => {
          setFloorToEdit(null);
          load();
        }}
        floor={floorToEdit}
      />

      {/* Delete Floor Confirmation Dialog */}
      <Dialog
        open={!!floorToDelete}
        onOpenChange={(open) => !open && setFloorToDelete(null)}
      >
        <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Floor</DialogTitle>
            <DialogDescription className="text-[#a5a6bf]">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">
                {floorToDelete?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFloorToDelete(null)}
              disabled={deletingFloor}
              className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
            >
              Cancel
            </Button>
            <motion.div whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() =>
                  floorToDelete && handleDeleteFloor(floorToDelete.id)
                }
                disabled={deletingFloor}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-600/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <motion.span
                  animate={deletingFloor ? { opacity: [1, 0.5, 1] } : {}}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  {deletingFloor ? "Deleting..." : "Delete Floor"}
                </motion.span>
              </Button>
            </motion.div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AddFloorDialog Component
function AddFloorDialog({
  open,
  onOpenChange,
  onSuccess,
  existingFloors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  existingFloors: FloorRoster[];
}) {
  const [floorName, setFloorName] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [saving, setSaving] = useState(false);
  const [deptInput, setDeptInput] = useState("");
  const enterLock = useRef(false);

  const nextLevel = Math.max(0, ...existingFloors.map((f) => f.level)) + 1;

  const resetForm = () => {
    setFloorName("");
    setDepartments([]);
    setDeptInput("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addDepartment = () => {
    const name = deptInput.trim();
    if (!name || enterLock.current) return;
    enterLock.current = true;
    setDepartments((prev) => [...prev, { name }]);
    setDeptInput("");
    setTimeout(() => (enterLock.current = false), 180);
  };

  const removeDepartment = (index: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!floorName.trim()) {
      toast.error("Please enter a floor name");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        level: nextLevel,
        name: floorName.trim(),
        departments: departments.map((d) => ({
          name: d.name.trim(),
          color: d.color || "",
        })),
      };

      await api(
        "/floors",
        { method: "POST", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success("Floor added successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to add floor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Add New Floor</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            Create a new floor with departments for your organization.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Floor Name */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-1 block">
              Floor name
            </label>
            <Input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
              placeholder={`Floor ${nextLevel}`}
            />
          </div>

          {/* Departments */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-2 block">
              Departments
            </label>

            {/* Department Input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === "NumpadEnter") &&
                      !e.shiftKey &&
                      !(e as any).nativeEvent?.isComposing &&
                      !e.repeat
                    ) {
                      e.preventDefault();
                      addDepartment();
                    }
                  }}
                  placeholder="Add department (press Enter)"
                  className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  onClick={addDepartment}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </motion.div>
            </div>

            {/* Department Tags */}
            <AnimatePresence>
              {departments.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-2"
                >
                  {departments.map((d, i) => (
                    <motion.span
                      key={`${d.name}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      className="inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-[#4f4f4f] bg-[#121212] text-[13px] text-white hover:bg-[#1a1a22] transition-all duration-200"
                    >
                      {d.name}
                      <motion.button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-[#d6d6d6]/80 hover:text-white transition-colors duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Remove"
                      >
                        x
                      </motion.button>
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8]"
                >
                  No departments yet.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSave}
              disabled={saving || !floorName.trim()}
              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <motion.span
                animate={saving ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {saving ? "Adding..." : "Add Floor"}
              </motion.span>
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// EditFloorDialog Component
function EditFloorDialog({
  open,
  onOpenChange,
  onSuccess,
  floor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  floor: FloorRoster | null;
}) {
  const [floorName, setFloorName] = useState("");
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [saving, setSaving] = useState(false);
  const [deptInput, setDeptInput] = useState("");
  const enterLock = useRef(false);

  useEffect(() => {
    if (floor) {
      setFloorName(floor.name);
      setDepartments(
        floor.departments.map((d) => ({
          name: d.name,
          color: (d as any).color || "",
        }))
      );
    }
  }, [floor]);

  const resetForm = () => {
    setFloorName("");
    setDepartments([]);
    setDeptInput("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const addDepartment = () => {
    const name = deptInput.trim();
    if (!name || enterLock.current) return;
    enterLock.current = true;
    setDepartments((prev) => [...prev, { name }]);
    setDeptInput("");
    setTimeout(() => (enterLock.current = false), 180);
  };

  const removeDepartment = (index: number) => {
    setDepartments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!floorName.trim()) {
      toast.error("Please enter a floor name");
      return;
    }
    if (!floor) return;

    const orgId = localStorage.getItem("garage_org_id");

    setSaving(true);
    try {
      const payload = {
        name: floorName.trim(),
        departments: departments.map((d) => ({
          name: d.name.trim(),
          color: d.color || "",
        })),
      };

      await api(
        `/floors/${floor.id}?organizationId=${orgId}`,
        { method: "PATCH", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success("Floor updated successfully!");
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update floor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Edit Floor</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            Update floor name and departments for {floor?.name || "this floor"}.
          </DialogDescription>
        </DialogHeader>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="space-y-4"
        >
          {/* Floor Name */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-1 block">
              Floor name
            </label>
            <Input
              value={floorName}
              onChange={(e) => setFloorName(e.target.value)}
              className="bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
              placeholder="Enter floor name"
            />
          </div>

          {/* Departments */}
          <div>
            <label className="text-[12px] text-[#9fa0b8] mb-2 block">
              Departments
            </label>

            {/* Department Input */}
            <div className="flex gap-2 mb-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === "NumpadEnter") &&
                      !e.shiftKey &&
                      !(e as any).nativeEvent?.isComposing &&
                      !e.repeat
                    ) {
                      e.preventDefault();
                      addDepartment();
                    }
                  }}
                  placeholder="Add department (press Enter)"
                  className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70 hover:border-[#3a3a45] focus:border-brand/50 transition-all duration-200"
                />
              </div>
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  type="button"
                  onClick={addDepartment}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add
                </Button>
              </motion.div>
            </div>

            {/* Department Tags */}
            <AnimatePresence>
              {departments.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-wrap gap-2"
                >
                  {departments.map((d, i) => (
                    <motion.span
                      key={`${d.name}-${i}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.2, delay: i * 0.05 }}
                      className="inline-flex items-center gap-2 px-2.5 h-8 rounded-md border border-[#4f4f4f] bg-[#121212] text-[13px] text-white hover:bg-[#1a1a22] transition-all duration-200"
                    >
                      {d.name}
                      <motion.button
                        type="button"
                        onClick={() => removeDepartment(i)}
                        className="text-[#d6d6d6]/80 hover:text-white transition-colors duration-200"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Remove"
                      >
                        x
                      </motion.button>
                    </motion.span>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8]"
                >
                  No departments yet.
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
          >
            Cancel
          </Button>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleSave}
              disabled={saving || !floorName.trim()}
              className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <motion.span
                animate={saving ? { opacity: [1, 0.5, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {saving ? "Updating..." : "Update Floor"}
              </motion.span>
            </Button>
          </motion.div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ChangeAssignmentsDialog Component
function ChangeAssignmentsDialog({
  open,
  onOpenChange,
  onSuccess,
  floors,
  unassignedMembers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  floors: FloorRoster[];
  unassignedMembers: FloorMember[];
}) {
  const [step, setStep] = useState<
    "select-source" | "select-users" | "select-destination"
  >("select-source");
  const [sourceFloorId, setSourceFloorId] = useState<string>("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [destinationFloorId, setDestinationFloorId] = useState<string>("");
  const [transferring, setTransferring] = useState(false);

  const resetForm = () => {
    setStep("select-source");
    setSourceFloorId("");
    setSelectedUsers([]);
    setDestinationFloorId("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const getSourceFloorMembers = () => {
    if (sourceFloorId === "unassigned") {
      return unassignedMembers;
    }
    const floor = floors.find((f) => f.id === sourceFloorId);
    return floor?.members || [];
  };

  const getAvailableDestinationFloors = () => {
    return floors.filter((f) => f.id !== sourceFloorId);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    const members = getSourceFloorMembers();
    setSelectedUsers(members.map((m) => m.id));
  };

  const deselectAllUsers = () => {
    setSelectedUsers([]);
  };

  const handleTransfer = async () => {
    if (selectedUsers.length === 0) {
      toast.error("Please select at least one user to transfer");
      return;
    }

    if (!destinationFloorId) {
      toast.error("Please select a destination floor");
      return;
    }

    setTransferring(true);
    try {
      const payload = {
        userIds: selectedUsers,
        destinationFloorId:
          destinationFloorId === "unassigned" ? null : destinationFloorId,
      };

      await api(
        "/team/bulk-transfer",
        { method: "POST", body: JSON.stringify(payload) },
        getToken()!
      );

      toast.success(`Successfully transferred ${selectedUsers.length} user(s)`);
      resetForm();
      onSuccess();
    } catch (error: any) {
      toast.error(error?.message || "Failed to transfer users");
    } finally {
      setTransferring(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case "select-source":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div>
              <label className="text-[12px] text-[#9fa0b8] mb-2 block">
                Select source floor
              </label>
              <Select value={sourceFloorId} onValueChange={setSourceFloorId}>
                <SelectTrigger className="w-full h-10 bg-transparent border border-[#2a2a35] text-white hover:border-[#3a3a45] focus:border-brand/50">
                  <SelectValue placeholder="Choose a floor..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                  {floors.map((floor) => (
                    <SelectItem
                      key={floor.id}
                      value={floor.id}
                      className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                    >
                      {floor.name} - Level {floor.level} ({floor.members.length}{" "}
                      users)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        );

      case "select-users":
        const members = getSourceFloorMembers();
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">
                Select users to transfer ({members.length} total)
              </h3>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={selectAllUsers}
                  className="text-[10px] px-2 py-1 h-6 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
                >
                  Select All
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={deselectAllUsers}
                  className="text-[10px] px-2 py-1 h-6 border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200"
                >
                  Deselect All
                </Button>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto border border-[#2a2a35] rounded-md p-2 space-y-2">
              {members.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[12px] text-[#9fa0b8] text-center py-4"
                >
                  No users on this floor
                </motion.div>
              ) : (
                <AnimatePresence>
                  {members.map((member, index) => (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{
                        duration: 0.2,
                        delay: index * 0.05,
                        ease: "easeOut",
                      }}
                      className={cn(
                        "flex items-center gap-3 p-2 rounded-md cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                        selectedUsers.includes(member.id)
                          ? "bg-brand/20 border border-brand/30 shadow-lg shadow-brand/10"
                          : "hover:bg-[#1a1a22] border border-transparent hover:border-[#2a2a35]"
                      )}
                      onClick={() => toggleUserSelection(member.id)}
                    >
                      <motion.input
                        type="checkbox"
                        checked={selectedUsers.includes(member.id)}
                        onChange={() => toggleUserSelection(member.id)}
                        className="rounded border-[#2a2a35] bg-transparent"
                        whileTap={{ scale: 0.95 }}
                      />
                      <Avatar className="h-8 w-8 border border-[#2f2f3b] bg-[#1b1b24]">
                        <AvatarFallback className="text-xs text-black font-medium">
                          {(member.name || member.email || "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">
                          {member.name || member.email}
                        </div>
                        <div className="text-[11px] text-[#9fa0b8] truncate">
                          {member.email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {member.department && (
                          <span className="text-[11px] px-2 py-0.5 rounded border border-[#3b3b4a] bg-[#15151b]">
                            {member.department}
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px] px-2 py-0.5 border-[#3d3d51] text-[#c9c9ee] bg-transparent"
                        >
                          {member.role}
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            <AnimatePresence>
              {selectedUsers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="text-[12px] text-brand flex items-center gap-2"
                >
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 0.3 }}
                    className="w-2 h-2 bg-brand rounded-full"
                  />
                  {selectedUsers.length} user(s) selected
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );

      case "select-destination":
        const availableFloors = getAvailableDestinationFloors();
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="space-y-4"
          >
            <div>
              <label className="text-[12px] text-[#9fa0b8] mb-2 block">
                Select destination floor
              </label>
              <Select
                value={destinationFloorId}
                onValueChange={setDestinationFloorId}
              >
                <SelectTrigger className="w-full h-10 bg-transparent border border-[#2a2a35] text-white hover:border-[#3a3a45] focus:border-brand/50">
                  <SelectValue placeholder="Choose destination..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0e0e12] border border-[#2a2a35] text-white">
                  {availableFloors.map((floor) => (
                    <SelectItem
                      key={floor.id}
                      value={floor.id}
                      className="hover:bg-[#1a1a22] focus:bg-[#1a1a22]"
                    >
                      {floor.name} - Level {floor.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="bg-[#1a1a22] border border-[#2a2a35] rounded-md p-3"
            >
              <div className="text-[12px] text-[#9fa0b8] mb-2">
                Transfer Summary:
              </div>
              <div className="text-sm text-white">
                Moving {selectedUsers.length} user(s) to{" "}
                {destinationFloorId === "unassigned"
                  ? "Unassigned"
                  : availableFloors.find((f) => f.id === destinationFloorId)
                      ?.name || "Unknown"}
              </div>
            </motion.div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (step) {
      case "select-source":
        return sourceFloorId !== "";
      case "select-users":
        return selectedUsers.length > 0;
      case "select-destination":
        return destinationFloorId !== "";
      default:
        return false;
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "select-source":
        return "Select Source Floor";
      case "select-users":
        return "Select Users to Transfer";
      case "select-destination":
        return "Select Destination Floor";
      default:
        return "Change Assignments";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#0e0e12] border border-[#2a2a35] text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{getStepTitle()}</DialogTitle>
          <DialogDescription className="text-[#a5a6bf]">
            {step === "select-source" &&
              "Choose which floor you want to transfer users from."}
            {step === "select-users" &&
              "Select the users you want to transfer."}
            {step === "select-destination" &&
              "Choose where to move the selected users."}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="py-5"
          >
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-2">
              <AnimatePresence>
                {step !== "select-source" && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (step === "select-users") {
                          setStep("select-source");
                        } else if (step === "select-destination") {
                          setStep("select-users");
                        }
                      }}
                      className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
                    >
                      Back
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="border border-[#2a2a35] text-[#c7c7da] hover:bg-[#1a1a22] transition-all duration-200 hover:scale-105"
              >
                Cancel
              </Button>
            </div>

            <div className="flex gap-2">
              {step === "select-destination" ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    onClick={handleTransfer}
                    disabled={transferring || !canProceed()}
                    className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <motion.span
                      animate={transferring ? { opacity: [1, 0.5, 1] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      {transferring ? "Transferring..." : "Transfer Users"}
                    </motion.span>
                  </Button>
                </motion.div>
              ) : (
                <Button
                  onClick={() => {
                    if (step === "select-source") {
                      setStep("select-users");
                    } else if (step === "select-users") {
                      setStep("select-destination");
                    }
                  }}
                  disabled={!canProceed()}
                  className="bg-brand hover:bg-[color:color-mix(in_srgb,var(--brand-2)_82%,black)] text-brand-foreground border border-brand/30 transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
