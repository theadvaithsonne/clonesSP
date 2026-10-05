"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { garageAdminApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Landmark,
  MapPin,
  Star,
  Plus,
  Eye,
  Building2,
  Users,
  CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAdminAccess } from "@/components/garage-admin/use-admin-access";

interface OfficeType {
  _id: string;
  name: string;
  description?: string;
  pricePerSeat: number;
  capacity: number;
  images?: string[];
}

interface CoworkingSpace {
  id: string;
  name: string;
  description?: string;
  location?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  images: string[];
  amenities: string[];
  officeTypes: OfficeType[];
  rating: number;
  ratingCount: number;
  isActive: boolean;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface BookingRequest {
  id: string;
  founderId: string;
  founderName: string;
  founderEmail: string;
  organizationId: string;
  organizationName: string;
  coworkingSpaceId: string;
  coworkingSpaceName: string;
  officeTypeId: string;
  officeTypeName: string;
  pricePerSeat: number;
  bookingType: "single" | "range";
  startDate: string;
  endDate: string;
  numberOfSeats: number;
  totalAmount: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  statusNote?: string;
  reviewedBy?: { _id: string; name: string; email: string };
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingStats {
  pending: { count: number; totalAmount: number };
  approved: { count: number; totalAmount: number };
  rejected: { count: number; totalAmount: number };
  cancelled: { count: number; totalAmount: number };
  total: { count: number; totalAmount: number };
}

export default function CoworkingSpacesPage() {
  // Two different permissions on one screen: creating a space is a
  // super-admin-only write (routes/coworkingSpace.ts gates its POST/PUT/
  // DELETE), while approving a booking is "coworking_bookings: manage".
  const { isSuperAdmin, canManage } = useAdminAccess();
  const canReviewBookings = canManage("coworking_bookings");
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"spaces" | "bookings">("spaces");
  const [spaces, setSpaces] = useState<CoworkingSpace[]>([]);
  const [bookings, setBookings] = useState<BookingRequest[]>([]);
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Dialog state for approve/reject
  const [selectedBooking, setSelectedBooking] = useState<BookingRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadCoworkingSpaces();
  }, []);

  useEffect(() => {
    if (activeTab === "bookings") {
      loadBookings();
      loadBookingStats();
    }
  }, [activeTab, statusFilter]);

  const loadCoworkingSpaces = async () => {
    try {
      const response = await garageAdminApi<{ data: CoworkingSpace[] }>(
        "/garage-admin/coworking-spaces",
        { method: "GET" }
      );
      setSpaces(response?.data || []);
    } catch (error) {
      console.error("Error loading coworking spaces:", error);
      toast.error("Failed to load coworking spaces");
    } finally {
      setLoading(false);
    }
  };

  const loadBookings = async () => {
    setBookingsLoading(true);
    try {
      const url = statusFilter === "all"
        ? "/coworking-bookings/admin/requests"
        : `/coworking-bookings/admin/requests?status=${statusFilter}`;
      const response = await garageAdminApi<{ data: BookingRequest[] }>(url, { method: "GET" });
      setBookings(response?.data || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load booking requests");
    } finally {
      setBookingsLoading(false);
    }
  };

  const loadBookingStats = async () => {
    try {
      const response = await garageAdminApi<{ data: BookingStats }>(
        "/coworking-bookings/admin/stats",
        { method: "GET" }
      );
      setBookingStats(response?.data || null);
    } catch (error) {
      console.error("Error loading booking stats:", error);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedBooking || !actionType) return;

    setIsSubmitting(true);
    try {
      await garageAdminApi(`/coworking-bookings/admin/requests/${selectedBooking.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: actionType === "approve" ? "approved" : "rejected",
          statusNote: statusNote || undefined,
        }),
      });

      toast.success(`Booking ${actionType === "approve" ? "approved" : "rejected"} successfully`);
      setSelectedBooking(null);
      setActionType(null);
      setStatusNote("");
      loadBookings();
      loadBookingStats();
    } catch (error: any) {
      console.error("Error updating booking status:", error);
      toast.error(error?.message || "Failed to update booking status");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openActionDialog = (booking: BookingRequest, action: "approve" | "reject") => {
    setSelectedBooking(booking);
    setActionType(action);
    setStatusNote("");
  };

  const getLocationString = (space: CoworkingSpace) => {
    const parts = [space.city, space.state, space.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : space.location || "N/A";
  };

  const getLowestPrice = (space: CoworkingSpace) => {
    if (!space.officeTypes || space.officeTypes.length === 0) return null;
    const minPrice = Math.min(
      ...space.officeTypes.map((ot) => ot.pricePerSeat)
    );
    return minPrice;
  };

  const getStatusBadge = (status: BookingRequest["status"]) => {
    switch (status) {
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
            <AlertCircle className="w-3 h-3 mr-1" />
            Cancelled
          </Badge>
        );
    }
  };

  // Stats calculations for spaces
  const totalSpaces = spaces.length;
  const activeSpaces = spaces.filter((s) => s.isActive).length;
  const totalOfficeTypes = spaces.reduce(
    (sum, s) => sum + (s.officeTypes?.length || 0),
    0
  );
  const avgRating =
    spaces.length > 0
      ? (spaces.reduce((sum, s) => sum + s.rating, 0) / spaces.length).toFixed(
          1
        )
      : "0.0";

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Coworking Spaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 px-4 sm:px-0">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "spaces" | "bookings")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-0">
          <TabsList className="bg-transparent border-b border-gray-800 rounded-none p-0 h-auto justify-start gap-0 w-full sm:w-auto overflow-x-auto">
            <TabsTrigger
              value="spaces"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FBA70A] data-[state=active]:bg-transparent data-[state=active]:text-[#FBA70A] data-[state=active]:shadow-none bg-transparent text-gray-400 hover:text-white px-3 sm:px-4 py-2 sm:py-3 transition-all text-xs sm:text-sm"
            >
              <Landmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Spaces
            </TabsTrigger>
            <TabsTrigger
              value="bookings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#FBA70A] data-[state=active]:bg-transparent data-[state=active]:text-[#FBA70A] data-[state=active]:shadow-none bg-transparent text-gray-400 hover:text-white px-3 sm:px-4 py-2 sm:py-3 transition-all relative text-xs sm:text-sm"
            >
              <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Booking </span>Requests
              {bookingStats && bookingStats.pending.count > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] sm:text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                  {bookingStats.pending.count}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {activeTab === "spaces" && isSuperAdmin && (
            <Button
              onClick={() => router.push("/garage-admin/coworking-spaces/new")}
              className="bg-[#FBA70A] hover:bg-[#d08a06] text-black text-xs sm:text-sm h-8 sm:h-10 w-full sm:w-auto"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Add New Space
            </Button>
          )}
        </div>

        {/* Spaces Tab */}
        <TabsContent value="spaces" className="mt-0 space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-[#111116] border-gray-800">
              <CardContent className="">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Landmark className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{totalSpaces}</p>
                    <p className="text-sm text-gray-400">Total Spaces</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111116] border-gray-800">
              <CardContent className="">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Building2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{activeSpaces}</p>
                    <p className="text-sm text-gray-400">Active Spaces</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111116] border-gray-800">
              <CardContent className="">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Users className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">
                      {totalOfficeTypes}
                    </p>
                    <p className="text-sm text-gray-400">Office Types</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#111116] border-gray-800">
              <CardContent className="">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-500/20 rounded-lg">
                    <Star className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{avgRating}</p>
                    <p className="text-sm text-gray-400">Avg Rating</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Spaces Table */}
          <Card className="bg-[#111116] border-gray-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-400" />
                Coworking Spaces
              </CardTitle>
              <CardDescription className="text-gray-400">
                Manage all coworking space listings
              </CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {spaces.length > 0 ? (
                <Table className="min-w-[800px]">
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">Name</TableHead>
                      <TableHead className="text-gray-400">Location</TableHead>
                      <TableHead className="text-gray-400">Office Types</TableHead>
                      <TableHead className="text-gray-400">Starting From</TableHead>
                      <TableHead className="text-gray-400">Rating</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400 text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {spaces.map((space) => (
                      <TableRow
                        key={space.id}
                        className="border-gray-800 hover:bg-gray-900/50 cursor-pointer"
                        onClick={() =>
                          router.push(`/garage-admin/coworking-spaces/${space.id}`)
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {space.images && space.images.length > 0 ? (
                              <img
                                src={space.images[0]}
                                alt={space.name}
                                className="w-10 h-10 rounded-lg object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                                <Landmark className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-white">
                                {space.name}
                              </div>
                              {space.amenities && space.amenities.length > 0 && (
                                <div className="text-xs text-gray-400">
                                  {space.amenities.slice(0, 3).join(", ")}
                                  {space.amenities.length > 3 &&
                                    ` +${space.amenities.length - 3}`}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-gray-300">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span className="text-sm">
                              {getLocationString(space)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="text-gray-300 border-gray-600"
                          >
                            {space.officeTypes?.length || 0} types
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getLowestPrice(space) !== null ? (
                            <div className="text-white font-medium">
                              ₹{getLowestPrice(space)?.toLocaleString()}
                              <span className="text-xs text-gray-400">
                                /seat/mo
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-white">
                              {space.rating.toFixed(1)}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({space.ratingCount})
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={space.isActive ? "default" : "secondary"}
                            className={
                              space.isActive
                                ? "bg-green-500/20 text-green-300 border-green-500/30"
                                : "bg-gray-500/20 text-gray-300 border-gray-500/30"
                            }
                          >
                            {space.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-400 hover:text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(
                                `/garage-admin/coworking-spaces/${space.id}`
                              );
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <Landmark className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No Coworking Spaces Yet
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Get started by adding your first coworking space listing.
                  </p>
                  <Button
                    onClick={() =>
                      router.push("/garage-admin/coworking-spaces/new")
                    }
                    className="bg-[#FBA70A] hover:bg-[#d08a06] text-black"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Your First Space
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Booking Requests Tab */}
        <TabsContent value="bookings" className="mt-0 space-y-6">
          {/* Booking Stats Cards */}
          {bookingStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
              <Card className="bg-[#111116] border-gray-800">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Clock className="h-5 w-5 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {bookingStats.pending.count}
                      </p>
                      <p className="text-sm text-gray-400">Pending</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111116] border-gray-800">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {bookingStats.approved.count}
                      </p>
                      <p className="text-sm text-gray-400">Approved</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111116] border-gray-800">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {bookingStats.rejected.count}
                      </p>
                      <p className="text-sm text-gray-400">Rejected</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111116] border-gray-800">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-500/20 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {bookingStats.cancelled.count}
                      </p>
                      <p className="text-sm text-gray-400">Cancelled</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#111116] border-gray-800">
                <CardContent className="">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-[#FBA70A]/20 rounded-lg">
                      <CalendarIcon className="h-5 w-5 text-[#FBA70A]" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-white">
                        ₹{(bookingStats.approved.totalAmount / 1000).toFixed(1)}K
                      </p>
                      <p className="text-sm text-gray-400">Approved Value</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Booking Requests Table */}
          <Card className="bg-[#111116] border-gray-800">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-white flex items-center gap-2 text-base sm:text-lg">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-[#FBA70A]" />
                  Booking Requests
                </CardTitle>
                <CardDescription className="text-gray-400 text-xs sm:text-sm">
                  Review and manage booking requests from founders
                </CardDescription>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                {["pending", "approved", "rejected", "cancelled", "all"].map((filter) => (
                  <Button
                    key={filter}
                    variant={statusFilter === filter ? "default" : "outline"}
                    size="sm"
                    onClick={() => setStatusFilter(filter)}
                    className={`text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 ${
                      statusFilter === filter
                        ? "bg-[#FBA70A] text-black hover:bg-[#d08a06]"
                        : "border-gray-700 text-gray-300 hover:bg-gray-800"
                    }`}
                  >
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {bookingsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
                    <p className="text-lg text-white">Loading bookings...</p>
                  </div>
                </div>
              ) : bookings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="text-gray-400">Founder</TableHead>
                      <TableHead className="text-gray-400">Space & Office</TableHead>
                      <TableHead className="text-gray-400">Dates</TableHead>
                      <TableHead className="text-gray-400">Seats</TableHead>
                      <TableHead className="text-gray-400">Amount</TableHead>
                      <TableHead className="text-gray-400">Status</TableHead>
                      <TableHead className="text-gray-400">Requested</TableHead>
                      <TableHead className="text-gray-400 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookings.map((booking) => (
                      <TableRow key={booking.id} className="border-gray-800 hover:bg-gray-900/50">
                        <TableCell>
                          <div>
                            <div className="font-medium text-white">{booking.founderName}</div>
                            <div className="text-xs text-gray-400">{booking.founderEmail}</div>
                            <div className="text-xs text-gray-500">{booking.organizationName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-white">{booking.coworkingSpaceName}</div>
                            <div className="text-xs text-gray-400">{booking.officeTypeName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-gray-300">
                            {format(new Date(booking.startDate), "MMM d, yyyy")}
                            {booking.startDate !== booking.endDate && (
                              <>
                                <br />
                                <span className="text-gray-500">to</span>{" "}
                                {format(new Date(booking.endDate), "MMM d, yyyy")}
                              </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-white">{booking.numberOfSeats}</span>
                        </TableCell>
                        <TableCell>
                          <div className="text-[#FBA70A] font-medium">
                            ₹{booking.totalAmount.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(booking.status)}</TableCell>
                        <TableCell>
                          <div className="text-xs text-gray-400">
                            {format(new Date(booking.createdAt), "MMM d, yyyy")}
                            <br />
                            {format(new Date(booking.createdAt), "h:mm a")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {booking.status === "pending" && canReviewBookings ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openActionDialog(booking, "approve")}
                                className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openActionDialog(booking, "reject")}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">
                              {booking.reviewedAt
                                ? format(new Date(booking.reviewedAt), "MMM d")
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No Booking Requests
                  </h3>
                  <p className="text-gray-400">
                    {statusFilter === "all"
                      ? "No booking requests have been made yet."
                      : `No ${statusFilter} booking requests found.`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve/Reject Dialog */}
      <Dialog open={!!selectedBooking && !!actionType} onOpenChange={() => {
        setSelectedBooking(null);
        setActionType(null);
        setStatusNote("");
      }}>
        <DialogContent className="bg-[#111116] border-gray-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {actionType === "approve" ? "Approve Booking" : "Reject Booking"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {actionType === "approve"
                ? "Are you sure you want to approve this booking request?"
                : "Are you sure you want to reject this booking request?"}
            </DialogDescription>
          </DialogHeader>

          {selectedBooking && (
            <div className="space-y-4 py-4">
              <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400">Founder</span>
                  <span className="text-white">{selectedBooking.founderName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Space</span>
                  <span className="text-white">{selectedBooking.coworkingSpaceName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Office Type</span>
                  <span className="text-white">{selectedBooking.officeTypeName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Dates</span>
                  <span className="text-white">
                    {format(new Date(selectedBooking.startDate), "MMM d")}
                    {selectedBooking.startDate !== selectedBooking.endDate && (
                      <> - {format(new Date(selectedBooking.endDate), "MMM d, yyyy")}</>
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Seats</span>
                  <span className="text-white">{selectedBooking.numberOfSeats}</span>
                </div>
                <div className="flex justify-between border-t border-gray-800 pt-2">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="text-[#FBA70A] font-bold">
                    ₹{selectedBooking.totalAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Note (optional)</Label>
                <Textarea
                  placeholder={
                    actionType === "approve"
                      ? "Add a message for the founder..."
                      : "Reason for rejection..."
                  }
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  className="bg-gray-900 border-gray-700 min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedBooking(null);
                setActionType(null);
                setStatusNote("");
              }}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateStatus}
              disabled={isSubmitting}
              className={
                actionType === "approve"
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : actionType === "approve" ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
