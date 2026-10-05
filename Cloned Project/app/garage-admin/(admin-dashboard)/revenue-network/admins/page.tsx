"use client";

import { useState, useEffect } from "react";
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
} from "../../../../../components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  DollarSign,
  Users,
  UserCheck,
  UserX,
  Calendar,
  Mail,
  Phone,
  MapPin,
  Building2,
  CheckCircle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { GARAGE_ADMIN_API_URL } from "@/lib/api";

interface RevenueNetworkAdmin {
  _id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  affiliateId: string;
  createdAt: string;
}

export default function RevenueNetworkPage() {
  const [admins, setAdmins] = useState<RevenueNetworkAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRevenueNetworkAdmins();
  }, []);

  const loadRevenueNetworkAdmins = async () => {
    try {
      const response = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/admins`,
        {
          method: "GET",
          headers: {
            "x-api-key":
              "c110bf8c30211ef3d265ced3803293f4fe2862129f9decbef88e5f7a011a3726",
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch revenue network admins");
      }

      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error("Error loading revenue network admins:", error);
      toast.error("Failed to load revenue network admins");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Revenue Network...</p>
        </div>
      </div>
    );
  }

  const totalAdmins = admins?.length || 0;
  const verifiedAdmins =
    admins?.filter((admin) => admin.affiliateId).length || 0;

  return (
    <>
      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">{totalAdmins}</div>
              <div className="text-[10px] sm:text-xs text-gray-400">Total Admins</div>
            </div>
            <Network className="h-4 w-4 text-green-400" />
          </div>
        </div>

        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">
                {verifiedAdmins}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400">Verified</div>
            </div>
            <UserCheck className="h-4 w-4 text-green-400" />
          </div>
        </div>

        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">Active</div>
              <div className="text-[10px] sm:text-xs text-gray-400">Network</div>
            </div>
            <DollarSign className="h-4 w-4 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Revenue Network Admins Table - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <Users className="h-4 w-4 text-blue-400" />
            All Sellers ({totalAdmins})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Admin</TableHead>
                <TableHead className="text-gray-300">Affiliate ID</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Joined</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {admins?.map((admin) => (
                <TableRow
                  key={admin._id}
                  className="border-gray-800 hover:bg-gray-900/50"
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-xs">
                          {admin.firstName?.charAt(0)?.toUpperCase() || "A"}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">
                          {admin.name || `${admin.firstName} ${admin.lastName}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {admin.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {admin.affiliateId ? (
                      <Badge
                        variant="outline"
                        className="text-green-400 border-green-400 text-xs"
                      >
                        {admin.affiliateId}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">No ID</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1">
                      {admin.affiliateId ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-green-400">
                            Verified
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-red-400" />
                          <span className="text-xs text-red-400">
                            Unverified
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-gray-400">
                    {new Date(admin.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Link
                      href={`/garage-admin/revenue-network/admins/${admin._id}`}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {admins?.length === 0 && (
            <div className="text-center py-6">
              <Network className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">
                No Sellers Found
              </h3>
              <p className="text-xs text-gray-400">
                No revenue network sellers in the system yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
