"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Landmark,
  MapPin,
  Star,
  X,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowLeft,
  CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { format, addDays, differenceInDays } from "date-fns";
import { DateRange } from "react-day-picker";

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
}

interface Booking {
  id: string;
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
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CoworkingSpacesPage() {
  const [activeTab, setActiveTab] = useState<"browse" | "my-bookings">("browse");
  const [spaces, setSpaces] = useState<CoworkingSpace[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedSpace, setSelectedSpace] = useState<CoworkingSpace | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Booking form state
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [bookingOfficeType, setBookingOfficeType] = useState<OfficeType | null>(null);
  const [bookingType, setBookingType] = useState<"single" | "range">("range");
  const [singleDate, setSingleDate] = useState<Date | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [numberOfSeats, setNumberOfSeats] = useState(1);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  useEffect(() => {
    loadCoworkingSpaces();
  }, []);

  useEffect(() => {
    if (activeTab === "my-bookings") {
      loadMyBookings();
    }
  }, [activeTab]);

  const loadCoworkingSpaces = async () => {
    try {
      const response = await api<{ data: CoworkingSpace[] }>(
        "/garage-admin/coworking-spaces/public",
        {},
        getToken()!
      );
      setSpaces(response?.data || []);
    } catch (error) {
      console.error("Error loading coworking spaces:", error);
      toast.error("Failed to load coworking spaces");
    } finally {
      setLoading(false);
    }
  };

  const loadMyBookings = async () => {
    setBookingsLoading(true);
    try {
      const response = await api<{ data: Booking[] }>(
        "/coworking-bookings/my-bookings",
        {},
        getToken()!
      );
      setBookings(response?.data || []);
    } catch (error) {
      console.error("Error loading bookings:", error);
      toast.error("Failed to load your bookings");
    } finally {
      setBookingsLoading(false);
    }
  };

  const getLocationString = (space: CoworkingSpace) => {
    const parts = [space.city, space.state, space.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : space.location || "N/A";
  };

  const getLowestPrice = (space: CoworkingSpace) => {
    if (!space.officeTypes || space.officeTypes.length === 0) return null;
    return Math.min(...space.officeTypes.map((ot) => ot.pricePerSeat));
  };

  const handlePrevImage = () => {
    if (selectedSpace?.images) {
      setSelectedImageIndex((prev) =>
        prev === 0 ? selectedSpace.images.length - 1 : prev - 1
      );
    }
  };

  const handleNextImage = () => {
    if (selectedSpace?.images) {
      setSelectedImageIndex((prev) =>
        prev === selectedSpace.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  const openSpaceDetail = (space: CoworkingSpace) => {
    setSelectedSpace(space);
    setSelectedImageIndex(0);
  };

  const closeSpaceDetail = () => {
    setSelectedSpace(null);
    setSelectedImageIndex(0);
    setIsLightboxOpen(false);
  };

  const openBookingDialog = (officeType: OfficeType) => {
    setBookingOfficeType(officeType);
    setBookingType("range");
    setSingleDate(undefined);
    setDateRange(undefined);
    setNumberOfSeats(1);
    setIsBookingDialogOpen(true);
  };

  const calculateTotalAmount = () => {
    if (!bookingOfficeType) return 0;

    let days = 1;
    if (bookingType === "single" && singleDate) {
      days = 1;
    } else if (bookingType === "range" && dateRange?.from && dateRange?.to) {
      days = differenceInDays(dateRange.to, dateRange.from) + 1;
    }

    const dailyRate = bookingOfficeType.pricePerSeat / 30;
    return Math.round(dailyRate * days * numberOfSeats);
  };

  const handleSubmitBooking = async () => {
    if (!selectedSpace || !bookingOfficeType) return;

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (bookingType === "single") {
      if (!singleDate) {
        toast.error("Please select a date");
        return;
      }
      startDate = singleDate;
      endDate = singleDate;
    } else {
      if (!dateRange?.from || !dateRange?.to) {
        toast.error("Please select a date range");
        return;
      }
      startDate = dateRange.from;
      endDate = dateRange.to;
    }

    if (numberOfSeats < 1) {
      toast.error("Please enter a valid number of seats");
      return;
    }

    setIsSubmittingBooking(true);
    try {
      await api(
        "/coworking-bookings/request",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coworkingSpaceId: selectedSpace.id,
            officeTypeId: bookingOfficeType._id,
            bookingType,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            numberOfSeats,
          }),
        },
        getToken()!
      );

      toast.success("Booking request submitted successfully! You'll be notified once it's reviewed.");
      setIsBookingDialogOpen(false);

      // Switch to my bookings tab to show the new request
      setActiveTab("my-bookings");
      closeSpaceDetail();
    } catch (error: any) {
      console.error("Error submitting booking:", error);
      toast.error(error?.message || "Failed to submit booking request");
    } finally {
      setIsSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      await api(
        `/coworking-bookings/${bookingId}/cancel`,
        { method: "PATCH" },
        getToken()!
      );
      toast.success("Booking cancelled successfully");
      loadMyBookings();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast.error(error?.message || "Failed to cancel booking");
    }
  };

  const getStatusBadge = (status: Booking["status"]) => {
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

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Coworking Spaces...</p>
        </div>
      </div>
    );
  }

  // Detail View with Booking
  if (selectedSpace) {
    const lowestPrice = getLowestPrice(selectedSpace);

    return (
      <div className="h-full overflow-y-auto">
        {/* Header with back button */}
        <div className="sticky top-0 z-10 bg-[#0b0b0d]/95 backdrop-blur-sm border-b border-gray-800 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={closeSpaceDetail}
              className="text-gray-300 hover:text-white hover:bg-gray-800 text-xs sm:text-sm px-2 sm:px-3"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Back to </span>Spaces
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSpaceDetail}
              className="text-gray-400 hover:text-white h-8 w-8 sm:h-10 sm:w-10"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Title & Price Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 sm:gap-4">
            <div className="space-y-1.5 sm:space-y-2">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white">
                {selectedSpace.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-white font-medium text-sm sm:text-base">
                    {selectedSpace.rating.toFixed(1)}
                  </span>
                  <span className="text-gray-400 text-xs sm:text-sm">
                    ({selectedSpace.ratingCount} reviews)
                  </span>
                </div>
                <div className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm">
                  <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="truncate max-w-[200px] sm:max-w-none">{getLocationString(selectedSpace)}</span>
                </div>
              </div>
            </div>
            {lowestPrice !== null && (
              <div className="text-left sm:text-right mt-2 sm:mt-0">
                <div className="text-xs sm:text-sm text-gray-400">Starting from</div>
                <div className="text-xl sm:text-2xl font-bold text-brand-2">
                  INR {lowestPrice.toLocaleString()}
                </div>
                <div className="text-xs sm:text-sm text-gray-400">per seat/month</div>
              </div>
            )}
          </div>

          {/* Image Gallery */}
          {selectedSpace.images && selectedSpace.images.length > 0 && (
            <div className="bg-[#111116] border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex flex-col lg:flex-row">
                {/* Main Image */}
                <div className="relative lg:w-2/3 aspect-video lg:aspect-auto lg:h-[400px]">
                  <img
                    src={selectedSpace.images[selectedImageIndex]}
                    alt={`${selectedSpace.name} - Image ${selectedImageIndex + 1}`}
                    className="w-full h-full object-cover cursor-pointer"
                    onClick={() => setIsLightboxOpen(true)}
                  />
                  {selectedSpace.images.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {selectedImageIndex + 1} / {selectedSpace.images.length}
                  </div>
                </div>

                {/* Thumbnail Grid */}
                {selectedSpace.images.length > 1 && (
                  <div className="lg:w-1/3 p-2 bg-gray-900/50">
                    <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                      {selectedSpace.images.map((img, idx) => (
                        <div
                          key={idx}
                          className={`relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                            idx === selectedImageIndex
                              ? "border-brand-2"
                              : "border-transparent hover:border-gray-500"
                          }`}
                          onClick={() => setSelectedImageIndex(idx)}
                        >
                          <img
                            src={img}
                            alt={`Thumbnail ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {selectedSpace.description && (
            <div className="bg-[#111116] border border-gray-800 rounded-xl p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">
                About this Space
              </h3>
              <p className="text-gray-300 whitespace-pre-wrap text-sm sm:text-base">
                {selectedSpace.description}
              </p>
            </div>
          )}

          {/* Amenities */}
          {selectedSpace.amenities && selectedSpace.amenities.length > 0 && (
            <div className="bg-[#111116] border border-gray-800 rounded-xl p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-2 sm:mb-3">
                Amenities
              </h3>
              <div className="flex flex-wrap gap-1.5 sm:gap-2">
                {selectedSpace.amenities.map((amenity, idx) => (
                  <Badge
                    key={idx}
                    variant="outline"
                    className="bg-blue-500/10 text-blue-300 border-blue-500/30 px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm"
                  >
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Office Types with Book Now Button */}
          {selectedSpace.officeTypes &&
            selectedSpace.officeTypes.length > 0 && (
              <div className="bg-[#111116] border border-gray-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">
                    Office Types ({selectedSpace.officeTypes.length})
                  </h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Select an office type to book
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedSpace.officeTypes.map((officeType) => (
                    <div
                      key={officeType._id}
                      className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="text-white font-medium">
                          {officeType.name}
                        </h4>
                      </div>
                      {officeType.description && (
                        <p className="text-sm text-gray-400 mb-3">
                          {officeType.description}
                        </p>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Price per seat
                          </span>
                          <span className="text-brand-2 font-medium">
                            ₹{officeType.pricePerSeat.toLocaleString()}/mo
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">
                            Capacity
                          </span>
                          <span className="text-white">
                            {officeType.capacity} seats
                          </span>
                        </div>
                        <div className="pt-3 border-t border-gray-800">
                          <Button
                            onClick={() => openBookingDialog(officeType)}
                            className="w-full bg-brand-2 hover:bg-brand-2/90 text-brand-foreground font-medium"
                          >
                            <CalendarIcon className="w-4 h-4 mr-2" />
                            Book Now
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          {/* Location */}
          {(selectedSpace.latitude || selectedSpace.location) && (
            <div className="bg-[#111116] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">Location</h3>
              </div>
              <p className="text-gray-300">
                {getLocationString(selectedSpace)}
              </p>
              {selectedSpace.latitude && selectedSpace.longitude && (
                <p className="text-sm text-gray-400 mt-2">
                  Coordinates: {selectedSpace.latitude.toFixed(6)},{" "}
                  {selectedSpace.longitude.toFixed(6)}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Booking Dialog */}
        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
          <DialogContent className="bg-[#111116] border-gray-800 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl">Book {bookingOfficeType?.name}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="bg-gray-900/50 rounded-lg p-3">
                <div className="text-sm text-gray-400">Space</div>
                <div className="text-white font-medium">{selectedSpace?.name}</div>
                <div className="text-sm text-gray-400 mt-1">
                  ₹{bookingOfficeType?.pricePerSeat.toLocaleString()}/seat/month
                </div>
              </div>

              {/* Booking Type Selection */}
              <div className="space-y-2">
                <Label>Booking Type</Label>
                <Select value={bookingType} onValueChange={(v: "single" | "range") => setBookingType(v)}>
                  <SelectTrigger className="bg-gray-900 border-gray-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="single">Single Day</SelectItem>
                    <SelectItem value="range">Date Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label>{bookingType === "single" ? "Select Date" : "Select Date Range"}</Label>
                {bookingType === "single" ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-gray-900 border-gray-700 hover:bg-gray-800"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {singleDate ? format(singleDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
                      <Calendar
                        mode="single"
                        selected={singleDate}
                        onSelect={setSingleDate}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className="bg-gray-900"
                      />
                    </PopoverContent>
                  </Popover>
                ) : (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-gray-900 border-gray-700 hover:bg-gray-800"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "LLL dd, y")} -{" "}
                              {format(dateRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(dateRange.from, "LLL dd, y")
                          )
                        ) : (
                          "Pick a date range"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-900 border-gray-700" align="start">
                      <Calendar
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        disabled={(date) => date < new Date()}
                        className="bg-gray-900"
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              {/* Number of Seats */}
              <div className="space-y-2">
                <Label>Number of Seats</Label>
                <Input
                  type="number"
                  min={1}
                  max={bookingOfficeType?.capacity || 100}
                  value={numberOfSeats}
                  onChange={(e) => setNumberOfSeats(parseInt(e.target.value) || 1)}
                  className="bg-gray-900 border-gray-700"
                />
                <p className="text-xs text-gray-400">
                  Max capacity: {bookingOfficeType?.capacity} seats
                </p>
              </div>

              {/* Total Estimate */}
              <div className="bg-brand-2/10 border border-brand-2/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Estimated Total</span>
                  <span className="text-2xl font-bold text-brand-2">
                    ₹{calculateTotalAmount().toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Based on daily rate (monthly price / 30 days)
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setIsBookingDialogOpen(false)}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitBooking}
                disabled={isSubmittingBooking}
                className="bg-brand-2 hover:bg-brand-2/90 text-brand-foreground"
              >
                {isSubmittingBooking ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lightbox */}
        <AnimatePresence>
          {isLightboxOpen &&
            selectedSpace.images &&
            selectedSpace.images.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/95 z-[1000] flex items-center justify-center"
                onClick={() => setIsLightboxOpen(false)}
              >
                <button
                  onClick={() => setIsLightboxOpen(false)}
                  className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 z-10"
                >
                  <X className="w-8 h-8" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevImage();
                  }}
                  className="absolute left-4 text-white hover:text-gray-300 p-2"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <img
                  src={selectedSpace.images[selectedImageIndex]}
                  alt={`${selectedSpace.name} - Image ${selectedImageIndex + 1}`}
                  className="max-w-[90vw] max-h-[90vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextImage();
                  }}
                  className="absolute right-4 text-white hover:text-gray-300 p-2"
                >
                  <ChevronRight className="w-10 h-10" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/60 px-4 py-2 rounded">
                  {selectedImageIndex + 1} / {selectedSpace.images.length}
                </div>
              </motion.div>
            )}
        </AnimatePresence>
      </div>
    );
  }

  // Main View with Tabs
  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4 sm:p-6">
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">Coworking Spaces</h1>
          <p className="text-gray-400 mt-1 text-sm sm:text-base">
            Browse available coworking spaces and manage your bookings
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "browse" | "my-bookings")}>
          <TabsList className="bg-transparent border-b border-gray-800 rounded-none p-0 h-auto mb-4 sm:mb-6 w-full justify-start gap-0">
            <TabsTrigger
              value="browse"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-2 data-[state=active]:bg-transparent data-[state=active]:text-brand-2 data-[state=active]:shadow-none bg-transparent text-gray-400 hover:text-white px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm transition-all"
            >
              <Landmark className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Browse </span>Spaces
            </TabsTrigger>
            <TabsTrigger
              value="my-bookings"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-brand-2 data-[state=active]:bg-transparent data-[state=active]:text-brand-2 data-[state=active]:shadow-none bg-transparent text-gray-400 hover:text-white px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm transition-all"
            >
              <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">My </span>Bookings
            </TabsTrigger>
          </TabsList>

          {/* Browse Spaces Tab */}
          <TabsContent value="browse" className="mt-0">
            {spaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center px-4">
                <Landmark className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                  No Coworking Spaces Available
                </h3>
                <p className="text-gray-400 max-w-md text-sm sm:text-base">
                  There are no coworking spaces listed yet. Check back later for
                  available spaces.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {spaces.map((space) => {
                  const lowestPrice = getLowestPrice(space);
                  return (
                    <div
                      key={space.id}
                      className="bg-[#111116] border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-700 transition-all hover:shadow-lg hover:shadow-purple-900/10 group"
                      onClick={() => openSpaceDetail(space)}
                    >
                      {/* Image */}
                      <div className="relative aspect-video bg-gray-900">
                        {space.images && space.images.length > 0 ? (
                          <img
                            src={space.images[0]}
                            alt={space.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Landmark className="w-12 h-12 text-gray-600" />
                          </div>
                        )}
                        {/* Starting price badge */}
                        {lowestPrice !== null && (
                          <div className="absolute top-3 right-3 bg-brand-2 text-brand-foreground text-xs font-semibold px-2 py-1 rounded">
                            From ₹{lowestPrice.toLocaleString()}/mo
                          </div>
                        )}
                        {/* Office types count */}
                        {space.officeTypes && space.officeTypes.length > 0 && (
                          <div className="absolute bottom-3 left-3 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {space.officeTypes.length} office type
                            {space.officeTypes.length > 1 ? "s" : ""}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-3 sm:p-4">
                        <h3 className="text-base sm:text-lg font-semibold text-white mb-1.5 sm:mb-2 group-hover:text-brand-2 transition-colors">
                          {space.name}
                        </h3>

                        <div className="flex items-center gap-1 text-gray-400 text-xs sm:text-sm mb-2 sm:mb-3">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{getLocationString(space)}</span>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-white font-medium text-sm">
                              {space.rating.toFixed(1)}
                            </span>
                            <span className="text-gray-400 text-xs sm:text-sm">
                              ({space.ratingCount})
                            </span>
                          </div>

                          {space.amenities && space.amenities.length > 0 && (
                            <div className="text-[10px] sm:text-xs text-gray-400 hidden sm:block">
                              {space.amenities.slice(0, 2).join(", ")}
                              {space.amenities.length > 2 &&
                                ` +${space.amenities.length - 2}`}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* My Bookings Tab */}
          <TabsContent value="my-bookings" className="mt-0">
            {bookingsLoading ? (
              <div className="flex items-center justify-center py-10 sm:py-16">
                <div className="flex flex-col items-center gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
                  <p className="text-base sm:text-lg text-white">Loading your bookings...</p>
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 sm:py-16 text-center px-4">
                <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 text-gray-600 mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-white mb-2">
                  No Bookings Yet
                </h3>
                <p className="text-gray-400 max-w-md mb-3 sm:mb-4 text-sm sm:text-base">
                  You haven't made any booking requests yet. Browse available
                  spaces and book your perfect workspace.
                </p>
                <Button
                  onClick={() => setActiveTab("browse")}
                  className="bg-brand-2 hover:bg-brand-2/90 text-brand-foreground text-sm sm:text-base"
                >
                  <Landmark className="w-4 h-4 mr-2" />
                  Browse Spaces
                </Button>
              </div>
            ) : (
              <div className="space-y-3 sm:space-y-4">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-[#111116] border border-gray-800 rounded-xl p-3 sm:p-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4">
                      <div className="space-y-1.5 sm:space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                          <h3 className="text-base sm:text-lg font-semibold text-white">
                            {booking.coworkingSpaceName}
                          </h3>
                          {getStatusBadge(booking.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-400">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            {booking.officeTypeName}
                          </span>
                          <span className="flex items-center gap-1">
                            <CalendarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                            {format(new Date(booking.startDate), "MMM d, yyyy")}
                            {booking.startDate !== booking.endDate && (
                              <> - {format(new Date(booking.endDate), "MMM d, yyyy")}</>
                            )}
                          </span>
                          <span>
                            {booking.numberOfSeats} seat{booking.numberOfSeats > 1 ? "s" : ""}
                          </span>
                        </div>
                        {booking.statusNote && (
                          <p className="text-xs sm:text-sm text-gray-400 bg-gray-900/50 rounded px-2 sm:px-3 py-1.5 sm:py-2 mt-2">
                            <span className="font-medium">Note:</span> {booking.statusNote}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 mt-2 sm:mt-0">
                        <div className="text-left sm:text-right">
                          <div className="text-xs sm:text-sm text-gray-400">Total Amount</div>
                          <div className="text-lg sm:text-xl font-bold text-brand-2">
                            INR {booking.totalAmount.toLocaleString()}
                          </div>
                        </div>
                        {booking.status === "pending" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelBooking(booking.id)}
                            className="text-xs sm:text-sm text-red-400 border-red-500/30 hover:bg-red-500/10"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[10px] sm:text-xs text-gray-500">
                      <span>Requested on {format(new Date(booking.createdAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      {booking.reviewedAt && (
                        <span>Reviewed on {format(new Date(booking.reviewedAt), "MMM d, yyyy 'at' h:mm a")}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
