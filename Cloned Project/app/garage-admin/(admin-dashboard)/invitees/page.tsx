"use client";

import { useState, useEffect } from "react";
import { garageAdminApi } from "@/lib/api";
import { useAdminSearch } from "@/components/garage-admin/admin-search";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserPlus,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import InviteAdminDialog from "@/components/garage-admin/InviteAdminDialog";

/** Roles are free text now — show what the super admin typed, and keep the
 *  two seeded values reading the way they always did. */
function roleLabel(role: string) {
  if (role === "garage-super-admin") return "Super Admin";
  if (!role || role === "garage-admin") return "Admin";
  return role;
}

interface GarageAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  invitedBy?: {
    name: string;
    email: string;
  };
  invitedAt: string;
  lastLoginAt?: string;
  createdAt: string;
}

export default function GarageAdminInvitees() {
  const [admins, setAdmins] = useState<GarageAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared header search — filters this tab server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const loadAdmins = async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const response = await garageAdminApi<{ data: GarageAdmin[] }>(
        `/garage-admin/admins${qs.toString() ? `?${qs.toString()}` : ""}`,
        {
          method: "GET",
        }
      );
      setAdmins(response?.data || []);
    } catch (error) {
      console.error("Error loading admins:", error);
      toast.error("Failed to load admin list");
    } finally {
      setLoading(false);
    }
  };

  // Get admin info from localStorage
  const getAdminInfo = () => {
    try {
      const adminData = localStorage.getItem("garage_admin_info");
      return adminData ? JSON.parse(adminData) : null;
    } catch {
      return null;
    }
  };

  if (loading && admins.length === 0) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Invitees...</p>
        </div>
      </div>
    );
  }

  const adminInfo = getAdminInfo();

  // Separate admins by status
  const pendingInvites = admins?.filter((admin) => !admin.lastLoginAt) || [];
  const activeAdmins =
    admins?.filter((admin) => admin.lastLoginAt && admin.isActive) || [];
  const inactiveAdmins =
    admins?.filter((admin) => admin.lastLoginAt && !admin.isActive) || [];

  return (
    <>
      {/* Bulk Invite Dialog */}
      <InviteAdminDialog onInvited={loadAdmins}>
        <button data-invite-admin-trigger className="hidden" />
      </InviteAdminDialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6 px-4 sm:px-0">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-300">
              Pending Invites
            </CardTitle>
            <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-white">
              {pendingInvites.length}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">Awaiting OTP</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-300">
              Active Admins
            </CardTitle>
            <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-400" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-white">
              {activeAdmins.length}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">Currently active</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-300">
              Inactive Admins
            </CardTitle>
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-400" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-white">
              {inactiveAdmins.length}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">Deactivated</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-gray-300">
              Total Invites
            </CardTitle>
            <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-gray-400" />
          </CardHeader>
          <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-white">
              {admins?.length || 0}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400">All invitations</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invites Table */}
      {pendingInvites.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              Pending Invitations
            </CardTitle>
            <CardDescription className="text-gray-400">
              Admins who haven't completed their OTP verification yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Email</TableHead>
                  <TableHead className="text-gray-300">Invited By</TableHead>
                  <TableHead className="text-gray-300">Invited At</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.map((admin) => (
                  <TableRow key={admin.id} className="border-gray-800">
                    <TableCell className="font-medium text-white">
                      {admin.name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      {admin.invitedBy ? (
                        <div className="text-sm">
                          <div className="font-medium text-white">
                            {admin.invitedBy.name}
                          </div>
                          <div className="text-gray-400">
                            {admin.invitedBy.email}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400">System</span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="text-sm">
                        <div className="text-white">
                          {new Date(admin.invitedAt).toLocaleDateString()}
                        </div>
                        <div className="text-gray-400">
                          {new Date(admin.invitedAt).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Active Admins Table */}
      {activeAdmins.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              Active Admins
            </CardTitle>
            <CardDescription className="text-gray-400">
              Admins who have completed setup and are currently active
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Email</TableHead>
                  <TableHead className="text-gray-300">Role</TableHead>
                  <TableHead className="text-gray-300">Last Login</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAdmins.map((admin) => (
                  <TableRow key={admin.id} className="border-gray-800">
                    <TableCell className="font-medium text-white">
                      {admin.name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className="bg-blue-500/20 text-blue-300 border-blue-500/30"
                      >
                        {roleLabel(admin.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="text-sm">
                        <div className="text-white">
                          {new Date(admin.lastLoginAt!).toLocaleDateString()}
                        </div>
                        <div className="text-gray-400">
                          {new Date(admin.lastLoginAt!).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="default"
                        className="bg-green-500/20 text-green-300 border-green-500/30"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Inactive Admins Table */}
      {inactiveAdmins.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-400" />
              Inactive Admins
            </CardTitle>
            <CardDescription className="text-gray-400">
              Deactivated admin accounts that cannot log in
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Name</TableHead>
                  <TableHead className="text-gray-300">Email</TableHead>
                  <TableHead className="text-gray-300">Role</TableHead>
                  <TableHead className="text-gray-300">Last Login</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveAdmins.map((admin) => (
                  <TableRow key={admin.id} className="border-gray-800">
                    <TableCell className="font-medium text-white">
                      {admin.name}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {admin.email}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-gray-500/20 text-gray-300 border-gray-500/30"
                      >
                        {roleLabel(admin.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="text-sm">
                        <div className="text-white">
                          {new Date(admin.lastLoginAt!).toLocaleDateString()}
                        </div>
                        <div className="text-gray-400">
                          {new Date(admin.lastLoginAt!).toLocaleTimeString()}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="bg-red-500/20 text-red-300 border-red-500/30"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        Inactive
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {admins?.length === 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              No Invitations Yet
            </h3>
            <p className="text-gray-400 text-center mb-6">
              Start by inviting garage admins to your organization
            </p>
            {adminInfo?.role === "garage-super-admin" && (
              <InviteAdminDialog onInvited={loadAdmins}>
                <Button className="bg-[#FBA70A] hover:bg-[#d08a06] text-black">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite Your First Admin
                </Button>
              </InviteAdminDialog>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
