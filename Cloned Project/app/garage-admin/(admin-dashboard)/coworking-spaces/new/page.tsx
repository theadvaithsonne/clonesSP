"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { garageAdminApi, API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Plus,
  Trash2,
  X,
  Landmark,
  MapPin,
  Star,
  Users,
  Calendar,
  Save,
  ChevronLeft,
  ChevronRight,
  Upload,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { City, State, Country } from "country-state-city";

interface OfficeType {
  id: string;
  name: string;
  description: string;
  pricePerSeat: number;
  capacity: number;
}

// Inline editable text component
function InlineEdit({
  value,
  onChange,
  placeholder,
  className = "",
  multiline = false,
  type = "text",
  inputClassName = "",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className?: string;
  multiline?: boolean;
  type?: "text" | "number";
  inputClassName?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const handleClick = () => {
    setTempValue(value);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleBlur = () => {
    setIsEditing(false);
    onChange(tempValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) {
      setIsEditing(false);
      onChange(tempValue);
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      setTempValue(value);
    }
  };

  if (isEditing) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`bg-[#1a1a22] border border-[#FBA70A] rounded px-2 py-1 outline-none w-full min-h-[80px] resize-none text-white ${className}`}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`bg-[#1a1a22] border border-[#FBA70A] rounded px-2 py-1 outline-none text-white ${inputClassName || className}`}
      />
    );
  }

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer hover:bg-gray-800/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors group ${className}`}
    >
      {value || <span className="text-gray-500 italic">{placeholder}</span>}
      <Pencil className="w-3 h-3 inline-block ml-2 opacity-0 group-hover:opacity-50 text-gray-400" />
    </div>
  );
}

export default function NewCoworkingSpacePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [amenityInput, setAmenityInput] = useState("");
  const [officeTypes, setOfficeTypes] = useState<OfficeType[]>([]);
  const [rating, setRating] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  // City search state
  const [citySearch, setCitySearch] = useState("");
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [filteredCities, setFilteredCities] = useState<any[]>([]);
  const [isUserTyping, setIsUserTyping] = useState(false);

  // City search functionality
  useEffect(() => {
    if (citySearch.length > 2 && isUserTyping) {
      const cities = City.getAllCities();
      const filtered = cities
        .filter((c) =>
          c.name.toLowerCase().includes(citySearch.toLowerCase())
        )
        .slice(0, 10);
      setFilteredCities(filtered);
      setShowCityDropdown(true);
    } else {
      setFilteredCities([]);
      setShowCityDropdown(false);
    }
  }, [citySearch, isUserTyping]);

  const handleCitySelect = (selectedCity: any) => {
    const stateData = State.getStateByCodeAndCountry(
      selectedCity.stateCode,
      selectedCity.countryCode
    );
    const countryData = Country.getCountryByCode(selectedCity.countryCode);

    setCity(selectedCity.name);
    setState(stateData?.name || "");
    setCountry(countryData?.name || "");
    setCitySearch(selectedCity.name);
    setShowCityDropdown(false);
    setIsUserTyping(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("garage_admin_token");
      const response = await fetch(`${API_URL}/garage-admin/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      setImages([...images, data.url]);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (selectedImageIndex >= newImages.length) {
      setSelectedImageIndex(Math.max(0, newImages.length - 1));
    }
  };

  const handleSetAsMain = (index: number) => {
    if (index === 0) return; // Already main
    const newImages = [...images];
    const [movedImage] = newImages.splice(index, 1);
    newImages.unshift(movedImage);
    setImages(newImages);
    setSelectedImageIndex(0);
  };

  const handleAddAmenity = () => {
    if (amenityInput.trim() && !amenities.includes(amenityInput.trim())) {
      setAmenities([...amenities, amenityInput.trim()]);
      setAmenityInput("");
    }
  };

  const handleRemoveAmenity = (index: number) => {
    setAmenities(amenities.filter((_, i) => i !== index));
  };

  const handleAddOfficeType = () => {
    setOfficeTypes([
      ...officeTypes,
      {
        id: Date.now().toString(),
        name: "",
        description: "",
        pricePerSeat: 0,
        capacity: 1,
      },
    ]);
  };

  const handleUpdateOfficeType = (
    id: string,
    field: keyof OfficeType,
    value: string | number
  ) => {
    setOfficeTypes(
      officeTypes.map((ot) => (ot.id === id ? { ...ot, [field]: value } : ot))
    );
  };

  const handleRemoveOfficeType = (id: string) => {
    setOfficeTypes(officeTypes.filter((ot) => ot.id !== id));
  };

  const handlePrevImage = () => {
    setSelectedImageIndex((prev) =>
      prev === 0 ? images.length - 1 : prev - 1
    );
  };

  const handleNextImage = () => {
    setSelectedImageIndex((prev) =>
      prev === images.length - 1 ? 0 : prev + 1
    );
  };

  const getLowestPrice = () => {
    if (officeTypes.length === 0) return null;
    const validPrices = officeTypes
      .map((ot) => ot.pricePerSeat)
      .filter((p) => p > 0);
    return validPrices.length > 0 ? Math.min(...validPrices) : null;
  };

  const getLocationString = () => {
    const parts = [city, state, country].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : location || "";
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        country: country.trim() || undefined,
        images,
        amenities,
        officeTypes: officeTypes
          .filter((ot) => ot.name.trim())
          .map((ot) => ({
            name: ot.name.trim(),
            description: ot.description.trim() || undefined,
            pricePerSeat: Number(ot.pricePerSeat) || 0,
            capacity: Number(ot.capacity) || 1,
          })),
        rating: Number(rating) || 0,
        ratingCount: Number(ratingCount) || 0,
        isActive,
      };

      await garageAdminApi("/garage-admin/coworking-spaces", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Coworking space created successfully");
      router.push("/garage-admin/coworking-spaces");
    } catch (error) {
      console.error("Error creating coworking space:", error);
      toast.error("Failed to create coworking space");
    } finally {
      setSaving(false);
    }
  };

  const lowestPrice = getLowestPrice();

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
            onClick={handleSubmit}
            disabled={saving}
            className="bg-[#FBA70A] hover:bg-[#d08a06] text-black"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Create Space
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Title & Price Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">
            <InlineEdit
              value={name}
              onChange={setName}
              placeholder="Click to add space name..."
              className="text-3xl font-bold"
            />
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={rating}
                onChange={(e) => setRating(parseFloat(e.target.value) || 0)}
                className="w-14 h-8 bg-transparent border-0 border-b border-gray-600 rounded-none text-white text-center focus:border-[#FBA70A] focus-visible:ring-0"
                placeholder="0.0"
              />
              <span className="text-gray-400">(</span>
              <Input
                type="number"
                min="0"
                value={ratingCount}
                onChange={(e) => setRatingCount(parseInt(e.target.value) || 0)}
                className="w-16 h-8 bg-transparent border-0 border-b border-gray-600 rounded-none text-white text-center focus:border-[#FBA70A] focus-visible:ring-0"
                placeholder="0"
              />
              <span className="text-gray-400">reviews)</span>
            </div>
            <Badge
              variant={isActive ? "default" : "secondary"}
              className={`cursor-pointer ${
                isActive
                  ? "bg-green-500/20 text-green-300 border-green-500/30"
                  : "bg-gray-500/20 text-gray-300 border-gray-500/30"
              }`}
              onClick={() => setIsActive(!isActive)}
            >
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">Starting from</div>
          <div className="text-2xl font-bold text-[#FBA70A]">
            {lowestPrice !== null ? `₹${lowestPrice.toLocaleString()}` : "₹0"}
          </div>
          <div className="text-sm text-gray-400">per seat/month</div>
        </div>
      </div>

      {/* Image Gallery */}
      <Card className="bg-[#111116] border-gray-800 overflow-hidden">
        <CardContent className="p-0">
          <div className="flex flex-col lg:flex-row">
            {/* Main Image */}
            <div className="relative lg:w-2/3 aspect-video lg:aspect-auto lg:h-[400px] bg-gray-900">
              {images.length > 0 ? (
                <>
                  <img
                    src={images[selectedImageIndex]}
                    alt={`Image ${selectedImageIndex + 1}`}
                    className="w-full h-full object-cover"
                  />
                  {images.length > 1 && (
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
                    {selectedImageIndex + 1} / {images.length}
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                  <Landmark className="w-16 h-16 mb-4 opacity-30" />
                  <p>No images yet</p>
                  <p className="text-sm">Add images from the gallery</p>
                </div>
              )}
            </div>

            {/* Thumbnail Grid with Upload Card */}
            <div className="lg:w-1/3 p-2 bg-gray-900/50">
              <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                {/* Upload Card */}
                <div
                  className="relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 border-dashed border-gray-600 hover:border-[#FBA70A] transition-colors flex flex-col items-center justify-center bg-gray-800/50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <div className="w-6 h-6 border-2 border-[#FBA70A] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-6 h-6 text-gray-400" />
                      <span className="text-xs text-gray-400 mt-1">Add</span>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>

                {/* Existing Images */}
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`relative aspect-square cursor-pointer rounded-md overflow-hidden border-2 transition-all group ${
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
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {idx !== 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAsMain(idx);
                          }}
                          className="bg-[#FBA70A] text-black p-1 rounded-full"
                          title="Set as main image"
                        >
                          <Star className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(idx);
                        }}
                        className="bg-red-500 text-white p-1 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    {idx === 0 && (
                      <Badge className="absolute bottom-1 left-1 bg-[#FBA70A] text-black text-[10px] px-1 py-0">
                        Main
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">About this Space</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-300">
            <InlineEdit
              value={description}
              onChange={setDescription}
              placeholder="Click to add a description about this coworking space..."
              multiline
              className="min-h-[60px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-400" />
            Location
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-400 mb-1">Street Address</div>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter street address..."
                  className="bg-[#1a1a22] border-gray-700 text-white focus:border-[#FBA70A]"
                />
              </div>
              <div className="relative">
                <div className="text-sm text-gray-400 mb-1">City</div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />
                  <Input
                    value={citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setIsUserTyping(true);
                      if (e.target.value !== city) {
                        setCity(e.target.value);
                      }
                      if (e.target.value === "") {
                        setCity("");
                        setState("");
                        setCountry("");
                      }
                    }}
                    onFocus={() => {
                      setIsUserTyping(true);
                      if (citySearch.length > 2) {
                        setShowCityDropdown(true);
                      }
                    }}
                    placeholder="Search and select city..."
                    className="pl-10 pr-10 bg-[#1a1a22] border-gray-700 text-white focus:border-[#FBA70A]"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500" />

                  {/* City Dropdown */}
                  {showCityDropdown && filteredCities.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a22] border border-gray-700 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {filteredCities.map((c, index) => (
                        <button
                          key={index}
                          onClick={() => handleCitySelect(c)}
                          className="w-full px-4 py-3 text-left text-white hover:bg-gray-800 transition-colors border-b border-gray-700 last:border-b-0"
                        >
                          <div className="font-medium">{c.name}</div>
                          <div className="text-sm text-gray-400">
                            {State.getStateByCodeAndCountry(c.stateCode, c.countryCode)?.name},{" "}
                            {Country.getCountryByCode(c.countryCode)?.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {city && (
                <>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">State</div>
                    <Input
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="State..."
                      className="bg-[#1a1a22] border-gray-700 text-white focus:border-[#FBA70A]"
                    />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Country</div>
                    <Input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country..."
                      className="bg-[#1a1a22] border-gray-700 text-white focus:border-[#FBA70A]"
                    />
                  </div>
                </>
              )}
            </div>
            {getLocationString() && (
              <div className="pt-2 border-t border-gray-800">
                <div className="text-sm text-gray-400">Full Address</div>
                <div className="text-white">{getLocationString()}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Amenities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {amenities.map((amenity, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="bg-blue-500/10 text-blue-300 border-blue-500/30 px-3 py-1 flex items-center gap-1"
              >
                {amenity}
                <button
                  onClick={() => handleRemoveAmenity(idx)}
                  className="hover:text-red-400 ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                placeholder="Add amenity..."
                className="bg-transparent border border-gray-700 rounded px-3 py-1 text-white text-sm w-32 focus:border-[#FBA70A] outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAmenity();
                  }
                }}
              />
              <Button
                type="button"
                onClick={handleAddAmenity}
                size="sm"
                variant="outline"
                className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 h-7"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
          {amenities.length === 0 && (
            <p className="text-gray-500 text-sm italic">
              No amenities added yet. Type and press Enter to add.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Office Types */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Office Types ({officeTypes.length})
            </CardTitle>
            <CardDescription className="text-gray-400">
              Available workspace options with pricing
            </CardDescription>
          </div>
          <Button
            onClick={handleAddOfficeType}
            variant="outline"
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-800"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Type
          </Button>
        </CardHeader>
        <CardContent>
          {officeTypes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No office types added yet</p>
              <p className="text-sm">Click "Add Type" to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {officeTypes.map((ot) => (
                <div
                  key={ot.id}
                  className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors relative group"
                >
                  <button
                    onClick={() => handleRemoveOfficeType(ot.id)}
                    className="absolute top-2 right-2 text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <div className="mb-3">
                    <Input
                      value={ot.name}
                      onChange={(e) =>
                        handleUpdateOfficeType(ot.id, "name", e.target.value)
                      }
                      placeholder="Office type name..."
                      className="bg-transparent border-0 border-b border-gray-700 rounded-none text-white font-medium text-lg px-0 focus:border-[#FBA70A] focus-visible:ring-0"
                    />
                  </div>
                  <div className="text-sm text-gray-400 mb-4">
                    <Input
                      value={ot.description}
                      onChange={(e) =>
                        handleUpdateOfficeType(ot.id, "description", e.target.value)
                      }
                      placeholder="Add description..."
                      className="bg-transparent border-0 text-gray-400 text-sm px-0 focus-visible:ring-0 h-auto"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">
                        Price per seat
                      </span>
                      <div className="flex items-center gap-1 text-[#FBA70A] font-medium">
                        <span>₹</span>
                        <Input
                          type="number"
                          value={ot.pricePerSeat}
                          onChange={(e) =>
                            handleUpdateOfficeType(
                              ot.id,
                              "pricePerSeat",
                              parseInt(e.target.value) || 0
                            )
                          }
                          className="w-20 h-7 bg-transparent border-0 border-b border-gray-600 rounded-none text-[#FBA70A] text-right px-0 focus:border-[#FBA70A] focus-visible:ring-0"
                        />
                        <span>/mo</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-400">Capacity</span>
                      <div className="flex items-center gap-1 text-white">
                        <Input
                          type="number"
                          value={ot.capacity}
                          onChange={(e) =>
                            handleUpdateOfficeType(
                              ot.id,
                              "capacity",
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-16 h-7 bg-transparent border-0 border-b border-gray-600 rounded-none text-white text-right px-0 focus:border-[#FBA70A] focus-visible:ring-0"
                        />
                        <span>seats</span>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-gray-800">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          Total potential
                        </span>
                        <span className="text-green-400 font-medium">
                          ₹{(ot.pricePerSeat * ot.capacity).toLocaleString()}/mo
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details/Metadata */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-400" />
            Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-400">
            This space will be created when you click "Create Space"
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
