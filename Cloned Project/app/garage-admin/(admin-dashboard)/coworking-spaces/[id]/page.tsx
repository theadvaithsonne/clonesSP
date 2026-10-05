"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Landmark,
  MapPin,
  Star,
  ArrowLeft,
  Edit,
  Trash2,
  Users,
  IndianRupee,
  Calendar,
  Copy,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

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

export default function CoworkingSpaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [space, setSpace] = useState<CoworkingSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const spaceId = params?.id as string;

  useEffect(() => {
    if (spaceId) {
      loadCoworkingSpace();
    }
  }, [spaceId]);

  const loadCoworkingSpace = async () => {
    try {
      const response = await garageAdminApi<{ data: CoworkingSpace }>(
        `/garage-admin/coworking-spaces/${spaceId}`,
        { method: "GET" }
      );
      setSpace(response?.data || null);
    } catch (error) {
      console.error("Error loading coworking space:", error);
      toast.error("Failed to load coworking space");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await garageAdminApi(`/garage-admin/coworking-spaces/${spaceId}`, {
        method: "DELETE",
      });
      toast.success("Coworking space deleted successfully");
      router.push("/garage-admin/coworking-spaces");
    } catch (error) {
      console.error("Error deleting coworking space:", error);
      toast.error("Failed to delete coworking space");
    }
  };

  const handleCopyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      toast.success(`${field} copied to clipboard`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      toast.error("Failed to copy to clipboard");
    }
  };

  const getLocationString = () => {
    if (!space) return "N/A";
    const parts = [space.city, space.state, space.country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : space.location || "N/A";
  };

  const getLowestPrice = () => {
    if (!space?.officeTypes || space.officeTypes.length === 0) return null;
    return Math.min(...space.officeTypes.map((ot) => ot.pricePerSeat));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
      full: date.toLocaleString(),
    };
  };

  const handlePrevImage = () => {
    if (space?.images) {
      setSelectedImageIndex((prev) =>
        prev === 0 ? space.images.length - 1 : prev - 1
      );
    }
  };

  const handleNextImage = () => {
    if (space?.images) {
      setSelectedImageIndex((prev) =>
        prev === space.images.length - 1 ? 0 : prev + 1
      );
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Coworking Space...</p>
        </div>
      </div>
    );
  }

  if (!space) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <Landmark className="h-12 w-12 text-gray-400" />
          <h3 className="text-lg font-semibold">Coworking Space Not Found</h3>
          <p className="text-gray-400">
            The coworking space you're looking for doesn't exist.
          </p>
          <Button
            onClick={() => router.push("/garage-admin/coworking-spaces")}
            className="mt-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Coworking Spaces
          </Button>
        </div>
      </div>
    );
  }

  const lowestPrice = getLowestPrice();
  const dateInfo = formatDate(space.createdAt);
  const updatedInfo = formatDate(space.updatedAt);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/garage-admin/coworking-spaces")}
            className="border-none text-gray-300 hover:bg-gray-800"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/garage-admin/coworking-spaces/${spaceId}/edit`)}
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-[#111116] border-gray-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">
                  Delete Coworking Space?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-gray-400">
                  This action cannot be undone. This will permanently delete the
                  coworking space "{space.name}" and all its associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700">
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Title & Price Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">{space.name}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <span className="text-white font-medium">{space.rating.toFixed(1)}</span>
              <span className="text-gray-400">({space.ratingCount} reviews)</span>
            </div>
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
          </div>
        </div>
        {lowestPrice !== null && (
          <div className="text-right">
            <div className="text-sm text-gray-400">Starting from</div>
            <div className="text-2xl font-bold text-[#FBA70A]">
              ₹{lowestPrice.toLocaleString()}
            </div>
            <div className="text-sm text-gray-400">per seat/month</div>
          </div>
        )}
      </div>

      {/* Image Gallery - Flipkart Style */}
      {space.images && space.images.length > 0 ? (
        <Card className="bg-[#111116] border-gray-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row">
              {/* Main Image */}
              <div className="relative lg:w-2/3 aspect-video lg:aspect-auto lg:h-[400px]">
                <img
                  src={space.images[selectedImageIndex]}
                  alt={`${space.name} - Image ${selectedImageIndex + 1}`}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setIsLightboxOpen(true)}
                />
                {space.images.length > 1 && (
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
                  {selectedImageIndex + 1} / {space.images.length}
                </div>
              </div>

              {/* Thumbnail Grid */}
              {space.images.length > 1 && (
                <div className="lg:w-1/3 p-2 bg-gray-900/50">
                  <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                    {space.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all ${
                          idx === selectedImageIndex
                            ? "border-[#FBA70A]"
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
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#111116] border-gray-800">
          <CardContent className="py-16">
            <div className="text-center">
              <ImageIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No images uploaded yet</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox */}
      {isLightboxOpen && space.images && space.images.length > 0 && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2"
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
            src={space.images[selectedImageIndex]}
            alt={`${space.name} - Image ${selectedImageIndex + 1}`}
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
            {selectedImageIndex + 1} / {space.images.length}
          </div>
        </div>
      )}

      {/* Description */}
      {space.description && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">About this Space</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300 whitespace-pre-wrap">{space.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Location */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <p className="text-white">{getLocationString()}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyToClipboard(getLocationString(), "Location")}
                className="h-6 w-6 p-0"
              >
                {copiedField === "Location" ? (
                  <CheckCircle className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3 text-gray-400" />
                )}
              </Button>
            </div>
            {space.latitude && space.longitude && (
              <div className="text-sm text-gray-400">
                Coordinates: {space.latitude.toFixed(6)}, {space.longitude.toFixed(6)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      {space.amenities && space.amenities.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Amenities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {space.amenities.map((amenity, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-blue-500/10 text-blue-300 border-blue-500/30 px-3 py-1"
                >
                  {amenity}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Office Types */}
      {space.officeTypes && space.officeTypes.length > 0 && (
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Office Types ({space.officeTypes.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Available workspace options with pricing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {space.officeTypes.map((officeType) => (
                <div
                  key={officeType._id}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="text-white font-medium">{officeType.name}</h4>
                  </div>
                  {officeType.description && (
                    <p className="text-sm text-gray-400 mb-3">{officeType.description}</p>
                  )}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Price per seat</span>
                      <span className="text-[#FBA70A] font-medium">
                        ₹{officeType.pricePerSeat.toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Capacity</span>
                      <span className="text-white">{officeType.capacity} seats</span>
                    </div>
                    <div className="pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">Total potential</span>
                        <span className="text-green-400 font-medium">
                          ₹{(officeType.pricePerSeat * officeType.capacity).toLocaleString()}/mo
                        </span>
                      </div>
                    </div>
                  </div>
                  {officeType.images && officeType.images.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {officeType.images.slice(0, 3).map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`${officeType.name} - ${idx + 1}`}
                          className="w-16 h-16 rounded object-cover flex-shrink-0"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timestamps & Metadata */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-400" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-300">Space ID</label>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-white font-mono text-sm">{space.id}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopyToClipboard(space.id, "Space ID")}
                  className="h-6 w-6 p-0"
                >
                  {copiedField === "Space ID" ? (
                    <CheckCircle className="w-3 h-3 text-green-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-gray-400" />
                  )}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300">Created At</label>
              <div className="mt-1">
                <p className="text-white">{dateInfo.date}</p>
                <p className="text-sm text-gray-400">{dateInfo.time}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-300">Last Updated</label>
              <div className="mt-1">
                <p className="text-white">{updatedInfo.date}</p>
                <p className="text-sm text-gray-400">{updatedInfo.time}</p>
              </div>
            </div>
            {space.createdBy && (
              <div>
                <label className="text-sm font-medium text-gray-300">Created By</label>
                <div className="mt-1">
                  <p className="text-white">{space.createdBy.name}</p>
                  <p className="text-sm text-gray-400">{space.createdBy.email}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
