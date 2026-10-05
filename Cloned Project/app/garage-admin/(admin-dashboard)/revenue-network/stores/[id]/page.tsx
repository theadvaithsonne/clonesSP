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
  Store,
  ArrowLeft,
  Globe,
  Calendar,
  ExternalLink,
  Copy,
  Palette,
  Image,
  Video,
  Package,
  GraduationCap,
  Users,
  DollarSign,
  Clock,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { GARAGE_ADMIN_API_URL } from "@/lib/api";

interface StoreData {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  icon?: string;
  description?: string;
  category?: string;
  url?: string;
  primaryColor?: string;
  secondaryColor?: string;
  coverPhoto?: string;
  headingText?: string;
  subHeadingText?: string;
  promoVideoLink?: string;
  createdAt: string;
}

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  joinedAt: string;
  channels: Array<{
    channelId: string;
    channelTitle: string;
    paymentCycle: string;
    status: string;
    lastTransactionDate: string;
    expiryDate: string;
    joinedAt: string;
  }>;
  createdAt: string;
}

interface Product {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  sku?: string;
  price: number;
  comparePrice?: number;
  images?: string[];
  tags?: string[];
  isDigital: boolean;
  requiresShipping: boolean;
  createdAt: string;
}

interface Course {
  _id: string;
  title: string;
  description?: string;
  coverImage?: string;
  status: string;
  isPaid: boolean;
  price?: number;
  currency?: string;
  isFree: boolean;
  totalDuration: number;
  totalChapters: number;
  enrolledStudentsCount: number;
  sections: Array<{
    title: string;
    order: number;
    chaptersCount: number;
    chapters: Array<{
      title: string;
      order: number;
      duration: number;
    }>;
  }>;
  createdAt: string;
}

export default function StoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [store, setStore] = useState<StoreData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadStoreDetails(params.id as string);
    }
  }, [params.id]);

  const loadStoreDetails = async (storeId: string) => {
    try {
      // Load store info
      const storeResponse = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/stores`,
        {
          method: "GET",
          headers: {
            "x-api-key":
              "c110bf8c30211ef3d265ced3803293f4fe2862129f9decbef88e5f7a011a3726",
            "Content-Type": "application/json",
          },
        }
      );

      if (!storeResponse.ok) {
        throw new Error("Failed to fetch stores");
      }

      const storeData = await storeResponse.json();
      const foundStore = storeData.stores?.find(
        (store: StoreData) => store._id === storeId
      );

      if (!foundStore) {
        toast.error("Store not found");
        router.push("/garage-admin/revenue-network/stores");
        return;
      }

      setStore(foundStore);

      // Load customers for this store
      const customersResponse = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/customers`,
        {
          method: "GET",
          headers: {
            "x-api-key":
              "c110bf8c30211ef3d265ced3803293f4fe2862129f9decbef88e5f7a011a3726",
            "Content-Type": "application/json",
          },
        }
      );

      if (customersResponse.ok) {
        const customersData = await customersResponse.json();
        setCustomers(customersData.customers || []);
      }

      // Load products for this store
      const productsResponse = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/products`,
        {
          method: "GET",
          headers: {
            "x-api-key":
              "c110bf8c30211ef3d265ced3803293f4fe2862129f9decbef88e5f7a011a3726",
            "Content-Type": "application/json",
          },
        }
      );

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        setProducts(productsData.products || []);
      }

      // Load courses for this store
      const coursesResponse = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/stores/${storeId}/courses`,
        {
          method: "GET",
          headers: {
            "x-api-key":
              "c110bf8c30211ef3d265ced3803293f4fe2862129f9decbef88e5f7a011a3726",
            "Content-Type": "application/json",
          },
        }
      );

      if (coursesResponse.ok) {
        const coursesData = await coursesResponse.json();
        setCourses(coursesData.courses || []);
      }
    } catch (error) {
      console.error("Error loading store details:", error);
      toast.error("Failed to load store details");
      router.push("/garage-admin/revenue-network/stores");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Store Details...</p>
        </div>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <Store className="h-12 w-12 text-red-400" />
          <h3 className="text-lg font-semibold">Store Not Found</h3>
          <p className="text-gray-400">The requested store could not be found.</p>
          <Button onClick={() => router.push("/garage-admin/revenue-network/stores")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Stores
          </Button>
        </div>
      </div>
    );
  }

  const activeCustomers = customers.filter((customer) =>
    customer.channels.some((channel) => channel.status === "active")
  ).length;

  const totalRevenue = products.reduce((sum, product) => sum + product.price, 0) +
    courses.reduce((sum, course) => sum + (course.price || 0), 0);

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/garage-admin/revenue-network/stores")}
          className="h-7 text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="w-3 h-3 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-white">Store Details</h1>
        </div>
      </div>

      {/* Store Profile Card - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
              {store.logo ? (
                <img
                  src={store.logo}
                  alt={store.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <span className="text-white font-medium text-lg">
                  {store.name?.charAt(0)?.toUpperCase() || "S"}
                </span>
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-white text-xl">
                {store.name}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                {store.slug} • {store.category || "No Category"}
              </CardDescription>
            </div>
            {store.url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(store.url, '_blank')}
                className="h-8 text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
              >
                <Globe className="w-3 h-3 mr-1" />
                Visit Store
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Store ID */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Store className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Store ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-mono">
                  {store._id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(store._id, "Store ID")}
                  className="h-5 w-5 p-0 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* URL */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Website</span>
              </div>
              <span className="text-white text-sm truncate">
                {store.url || "N/A"}
              </span>
            </div>

            {/* Category */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Tag className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Category</span>
              </div>
              <span className="text-white text-sm">
                {store.category || "N/A"}
              </span>
            </div>

            {/* Created Date */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Created</span>
              </div>
              <span className="text-white text-sm">
                {new Date(store.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Customers */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Customers</span>
          </div>
          <div className="text-white text-sm font-medium">
            {customers.length} Total
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {activeCustomers} Active
          </div>
        </div>

        {/* Products */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Package className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Products</span>
          </div>
          <div className="text-white text-sm font-medium">
            {products.length} Items
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {products.filter(p => p.isDigital).length} Digital
          </div>
        </div>

        {/* Courses */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Courses</span>
          </div>
          <div className="text-white text-sm font-medium">
            {courses.length} Courses
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {courses.reduce((sum, course) => sum + course.enrolledStudentsCount, 0)} Students
          </div>
        </div>

        {/* Revenue Potential */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-yellow-400" />
            <span className="text-xs text-gray-400">Revenue</span>
          </div>
          <div className="text-white text-sm font-medium">
            ₹{totalRevenue.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Total Value
          </div>
        </div>
      </div>

      {/* Customers Section */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-400" />
            Customers ({customers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {customers.length > 0 ? (
            <div className="space-y-3">
              {customers.slice(0, 5).map((customer) => (
                <div key={customer._id} className="bg-gray-900 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium text-xs">
                          {customer.name?.charAt(0)?.toUpperCase() || "C"}
                        </span>
                      </div>
                      <div>
                        <div className="text-white text-sm font-medium">{customer.name}</div>
                        <div className="text-xs text-gray-400">{customer.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={customer.channels.some(c => c.status === "active") ? "default" : "secondary"}
                        className={`text-xs ${
                          customer.channels.some(c => c.status === "active") 
                            ? "bg-green-500 text-white" 
                            : "bg-gray-600 text-gray-300"
                        }`}
                      >
                        {customer.channels.some(c => c.status === "active") ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {customer.channels.length} channels
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {customers.length > 5 && (
                <div className="text-center text-xs text-gray-400">
                  ... and {customers.length - 5} more customers
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">
              No customers found for this store
            </div>
          )}
        </CardContent>
      </Card>

      {/* Products Section */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Package className="h-4 w-4 text-green-400" />
            Products ({products.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {products.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {products.slice(0, 6).map((product) => (
                <div key={product._id} className="bg-gray-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white text-sm font-medium truncate">{product.name}</h4>
                    <Badge variant="outline" className="text-xs">
                      {product.isDigital ? "Digital" : "Physical"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white">₹{product.price}</span>
                    </div>
                    {product.comparePrice && (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Compare:</span>
                        <span className="text-gray-400 line-through">₹{product.comparePrice}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">SKU:</span>
                      <span className="text-white font-mono">{product.sku || "N/A"}</span>
                    </div>
                  </div>
                </div>
              ))}
              {products.length > 6 && (
                <div className="col-span-full text-center text-xs text-gray-400">
                  ... and {products.length - 6} more products
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">
              No products found for this store
            </div>
          )}
        </CardContent>
      </Card>

      {/* Courses Section */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-purple-400" />
            Courses ({courses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {courses.length > 0 ? (
            <div className="space-y-3">
              {courses.slice(0, 5).map((course) => (
                <div key={course._id} className="bg-gray-900 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-white text-sm font-medium">{course.title}</h4>
                    <Badge 
                      variant={course.isPaid ? "default" : "secondary"}
                      className={`text-xs ${
                        course.isPaid 
                          ? "bg-green-500 text-white" 
                          : "bg-gray-600 text-gray-300"
                      }`}
                    >
                      {course.isPaid ? "Paid" : "Free"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Duration:</span>
                      <span className="text-white">{formatDuration(course.totalDuration)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Chapters:</span>
                      <span className="text-white">{course.totalChapters}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Students:</span>
                      <span className="text-white">{course.enrolledStudentsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Price:</span>
                      <span className="text-white">
                        {course.isPaid ? `₹${course.price || 0}` : "Free"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {courses.length > 5 && (
                <div className="text-center text-xs text-gray-400">
                  ... and {courses.length - 5} more courses
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400 text-sm">
              No courses found for this store
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
