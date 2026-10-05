"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Network,
  ArrowLeft,
  User,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  DollarSign,
  Building2,
  ExternalLink,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
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

export default function RevenueNetworkAdminDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [admin, setAdmin] = useState<RevenueNetworkAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadAdminDetails(params.id as string);
    }
  }, [params.id]);

  const loadAdminDetails = async (adminId: string) => {
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
      const foundAdmin = data.admins?.find(
        (admin: RevenueNetworkAdmin) => admin._id === adminId
      );

      if (foundAdmin) {
        setAdmin(foundAdmin);
      } else {
        toast.error("Admin not found");
        router.push("/garage-admin/revenue-network/admins");
      }
    } catch (error) {
      console.error("Error loading admin details:", error);
      toast.error("Failed to load admin details");
      router.push("/garage-admin/revenue-network/admins");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Admin Details...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-red-400" />
          <h3 className="text-lg font-semibold">Admin Not Found</h3>
          <p className="text-gray-400">
            The requested admin could not be found.
          </p>
          <Button
            onClick={() => router.push("/garage-admin/revenue-network/admins")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Revenue Network Admins
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/garage-admin/revenue-network/admins")}
          className="h-6 sm:h-7 px-2 text-[10px] sm:text-xs text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="w-3 h-3 sm:mr-1" />
          <span className="hidden sm:inline">Back</span>
        </Button>
        <div>
          <h1 className="text-base sm:text-lg font-semibold text-white">Seller Details</h1>
        </div>
      </div>

      {/* Admin Profile Card - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {admin.firstName?.charAt(0)?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1">
              <CardTitle className="text-white text-lg">
                {admin.name || `${admin.firstName} ${admin.lastName}`}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Revenue Network Seller
              </CardDescription>
            </div>
            {admin.affiliateId ? (
              <Badge className="bg-green-500 text-white text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="w-3 h-3 mr-1" />
                Unverified
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Email */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Email</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm truncate">
                  {admin.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(admin.email, "Email")}
                  className="h-5 w-5 p-0 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Affiliate ID */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Affiliate ID</span>
              </div>
              <div className="flex items-center gap-2">
                {admin.affiliateId ? (
                  <>
                    <span className="text-white text-sm">
                      {admin.affiliateId}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyToClipboard(admin.affiliateId, "Affiliate ID")
                      }
                      className="h-5 w-5 p-0 flex-shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <span className="text-gray-400 text-sm">Not assigned</span>
                )}
              </div>
            </div>

            {/* Full Name */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Full Name</span>
              </div>
              <span className="text-white text-sm">
                {admin.name || `${admin.firstName} ${admin.lastName}`}
              </span>
            </div>

            {/* First Name */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">First Name</span>
              </div>
              <span className="text-white text-sm">
                {admin.firstName || "N/A"}
              </span>
            </div>

            {/* Last Name */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <User className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Last Name</span>
              </div>
              <span className="text-white text-sm">
                {admin.lastName || "N/A"}
              </span>
            </div>

            {/* Admin ID */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Network className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Admin ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-mono">
                  {admin._id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(admin._id, "Admin ID")}
                  className="h-5 w-5 p-0 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Joined Date */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Joined Date</span>
              </div>
              <span className="text-white text-sm">
                {new Date(admin.createdAt).toLocaleDateString()}
              </span>
            </div>

            {/* Joined Time */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Joined Time</span>
              </div>
              <span className="text-white text-sm">
                {new Date(admin.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status & Network Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Verification Status */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            {admin.affiliateId ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="text-xs text-gray-400">Verification</span>
          </div>
          <div className="text-white text-sm font-medium">
            {admin.affiliateId ? "Verified" : "Unverified"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {admin.affiliateId ? "Has affiliate ID" : "No affiliate ID"}
          </div>
        </div>

        {/* Commission Status */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Commissions</span>
          </div>
          <div className="text-white text-sm font-medium">
            {admin.affiliateId ? "Eligible" : "Not Eligible"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {admin.affiliateId ? "Can earn commissions" : "Needs verification"}
          </div>
        </div>

        {/* Account Status */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Account</span>
          </div>
          <div className="text-white text-sm font-medium">
            {admin.affiliateId ? "Active" : "Pending"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {admin.affiliateId ? "Fully active" : "Awaiting verification"}
          </div>
        </div>

        {/* Network Role */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Network className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Role</span>
          </div>
          <div className="text-white text-sm font-medium">Seller</div>
          <div className="text-xs text-gray-500 mt-1">Revenue Network</div>
        </div>
      </div>

      {/* Additional Details */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-blue-400" />
            Additional Information
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Account Creation Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Account Details
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">
                    {new Date(admin.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Account Type:</span>
                  <span className="text-white">Revenue Network Seller</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span
                    className={`${
                      admin.affiliateId ? "text-green-400" : "text-yellow-400"
                    }`}
                  >
                    {admin.affiliateId
                      ? "Active Seller"
                      : "Pending Verification"}
                  </span>
                </div>
              </div>
            </div>

            {/* Revenue Network Details */}
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Revenue Network
              </h4>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-white">Active</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Affiliate ID:</span>
                  <span className="text-white font-mono text-xs">
                    {admin.affiliateId || "Not Assigned"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Commission Rate:</span>
                  <span className="text-white">
                    {admin.affiliateId ? "Standard Rate" : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
