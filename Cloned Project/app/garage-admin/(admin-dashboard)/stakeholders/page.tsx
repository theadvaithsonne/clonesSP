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
  MapPin,
  Phone,
  Mail,
  Calendar,
  UserCheck,
  UserX,
  Globe,
  Building2,
  CheckCircle,
  XCircle,
  User,
} from "lucide-react";
import { toast } from "sonner";

interface Stakeholder {
  id: string;
  name: string;
  email: string;
  role: string;
  floorId?: string;
  department?: string;
  isVerified: boolean;
  country?: string;
  state?: string;
  city?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  profileComplete: boolean;
  earnGPT?: {
    affiliateId?: string;
    adminId?: string;
    data?: any;
  };
  organizations?: Array<{
    id: string;
    name: string;
    role: string;
    joinedAt: string;
  }>;
  legacyOrganization?: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

export default function StakeholdersPage() {
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared header search — filters this tab server-side (debounced).
  const { query: search } = useAdminSearch();
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    loadStakeholders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const loadStakeholders = async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("q", debouncedSearch);
      const response = await garageAdminApi<{ data: Stakeholder[] }>(
        `/garage-admin/stakeholders${qs.toString() ? `?${qs.toString()}` : ""}`,
        {
          method: "GET",
        }
      );
      setStakeholders(response?.data || []);
    } catch (error) {
      console.error("Error loading stakeholders:", error);
      toast.error("Failed to load stakeholders");
    } finally {
      setLoading(false);
    }
  };

  if (loading && stakeholders.length === 0) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Stakeholders...</p>
        </div>
      </div>
    );
  }

  const totalStakeholders = stakeholders?.length || 0;
  const verifiedStakeholders =
    stakeholders?.filter((stakeholder) => stakeholder.isVerified).length || 0;
  const profileCompleteStakeholders =
    stakeholders?.filter((stakeholder) => stakeholder.profileComplete).length ||
    0;
  const earnGPTStakeholders =
    stakeholders?.filter((stakeholder) => stakeholder.earnGPT).length || 0;

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Total Stakeholders
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {totalStakeholders}
            </div>
            <p className="text-xs text-gray-400">All stakeholders</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Verified Stakeholders
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {verifiedStakeholders}
            </div>
            <p className="text-xs text-gray-400">Email verified</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Complete Profiles
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {profileCompleteStakeholders}
            </div>
            <p className="text-xs text-gray-400">Profile completed</p>
          </CardContent>
        </Card>

        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              EarnGPT Integrated
            </CardTitle>
            <Globe className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {earnGPTStakeholders}
            </div>
            <p className="text-xs text-gray-400">With EarnGPT</p>
          </CardContent>
        </Card>
      </div>

      {/* Stakeholders Table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            All Stakeholders
          </CardTitle>
          <CardDescription className="text-gray-400">
            View and manage all stakeholders across organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Stakeholder</TableHead>
                <TableHead className="text-gray-300">Organization</TableHead>
                <TableHead className="text-gray-300">Location</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Profile</TableHead>
                <TableHead className="text-gray-300">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stakeholders?.map((stakeholder) => (
                <TableRow key={stakeholder.id} className="border-gray-800">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-sm">
                          {stakeholder.name?.charAt(0)?.toUpperCase() || "S"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {stakeholder.name || "Unnamed Stakeholder"}
                        </div>
                        <div className="text-sm text-gray-400">
                          {stakeholder.email}
                        </div>
                        {stakeholder.phone && (
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {stakeholder.phone}
                          </div>
                        )}
                        {stakeholder.department && (
                          <div className="text-xs text-gray-500">
                            {stakeholder.department}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {stakeholder.organizations?.map((org, index) => (
                        <div key={org.id} className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span className="text-sm text-white">{org.name}</span>
                        </div>
                      ))}
                      {stakeholder.legacyOrganization && (
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-blue-400" />
                          <span className="text-sm text-white">
                            {stakeholder.legacyOrganization.name}
                          </span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {stakeholder.city &&
                      stakeholder.state &&
                      stakeholder.country ? (
                        <>
                          <div className="text-white flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {stakeholder.city}, {stakeholder.state}
                          </div>
                          <div className="text-gray-400">
                            {stakeholder.country}
                          </div>
                        </>
                      ) : (
                        <span className="text-gray-400">No location</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {stakeholder.isVerified ? (
                        <UserCheck className="w-4 h-4 text-green-400" />
                      ) : (
                        <UserX className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm text-gray-300">
                        {stakeholder.isVerified ? "Verified" : "Unverified"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {stakeholder.profileComplete ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-sm text-gray-300">
                        {stakeholder.profileComplete
                          ? "Complete"
                          : "Incomplete"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="text-sm">
                      <div className="text-white">
                        {new Date(stakeholder.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-gray-400">
                        {new Date(stakeholder.createdAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {stakeholders?.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                No Stakeholders Found
              </h3>
              <p className="text-gray-400">
                There are no stakeholders in the system yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
