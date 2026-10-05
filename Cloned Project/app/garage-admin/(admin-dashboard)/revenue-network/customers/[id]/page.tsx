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
  UsersRound,
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
  Phone,
  MapPin,
  Store,
  CreditCard,
} from "lucide-react";
import { toast } from "sonner";
import { GARAGE_ADMIN_API_URL } from "@/lib/api";

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  stores: Array<{
    storeId: string;
    storeName: string;
    storeSlug: string;
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
  }>;
  createdAt: string;
}

export default function BuyerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadCustomerDetails(params.id as string);
    }
  }, [params.id]);

  const loadCustomerDetails = async (customerId: string) => {
    try {
      const response = await fetch(
        `${GARAGE_ADMIN_API_URL}/api/public/customers`,
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
        throw new Error("Failed to fetch customers");
      }

      const data = await response.json();
      const foundCustomer = data.customers?.find(
        (customer: Customer) => customer._id === customerId
      );

      if (foundCustomer) {
        setCustomer(foundCustomer);
      } else {
        toast.error("Customer not found");
        router.push("/garage-admin/revenue-network/customers");
      }
    } catch (error) {
      console.error("Error loading customer details:", error);
      toast.error("Failed to load customer details");
      router.push("/garage-admin/revenue-network/customers");
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
          <p className="text-lg">Loading Buyer Details...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <XCircle className="h-12 w-12 text-red-400" />
          <h3 className="text-lg font-semibold">Customer Not Found</h3>
          <p className="text-gray-400">
            The requested customer could not be found.
          </p>
          <Button
            onClick={() =>
              router.push("/garage-admin/revenue-network/customers")
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to All Buyers
          </Button>
        </div>
      </div>
    );
  }

  const hasActiveChannels = customer.stores.some((store) =>
    store.channels.some((channel) => channel.status === "active")
  );
  const totalStores = customer.stores.length;
  const totalChannels = customer.stores.reduce(
    (sum, store) => sum + store.channels.length,
    0
  );
  const activeChannels = customer.stores.reduce(
    (sum, store) =>
      sum +
      store.channels.filter((channel) => channel.status === "active").length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header - Compact */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/garage-admin/revenue-network/customers")}
          className="h-7 text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
        >
          <ArrowLeft className="w-3 h-3 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-white">Buyer Details</h1>
        </div>
      </div>

      {/* Customer Profile Card - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-medium text-sm">
                {customer.name?.charAt(0)?.toUpperCase() || "C"}
              </span>
            </div>
            <div className="flex-1">
              <CardTitle className="text-white text-lg">
                {customer.name || "Unnamed Customer"}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                Revenue Network Buyer
              </CardDescription>
            </div>
            {hasActiveChannels ? (
              <Badge className="bg-green-500 text-white text-xs">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            ) : (
              <Badge variant="destructive" className="text-xs">
                <XCircle className="w-3 h-3 mr-1" />
                Inactive
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
                  {customer.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(customer.email, "Email")}
                  className="h-5 w-5 p-0 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Phone */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Phone className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Phone</span>
              </div>
              <span className="text-white text-sm">
                {customer.phone || "N/A"}
              </span>
            </div>

            {/* Country */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Country</span>
              </div>
              <span className="text-white text-sm">
                {customer.country || "N/A"}
              </span>
            </div>

            {/* Customer ID */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <UsersRound className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Customer ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-mono">
                  {customer._id}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(customer._id, "Customer ID")}
                  className="h-5 w-5 p-0 flex-shrink-0"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Total Stores */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Store className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Total Stores</span>
              </div>
              <span className="text-white text-sm">{totalStores}</span>
            </div>

            {/* Total Channels */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Total Channels</span>
              </div>
              <span className="text-white text-sm">{totalChannels}</span>
            </div>

            {/* Active Channels */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Active Channels</span>
              </div>
              <span className="text-white text-sm">{activeChannels}</span>
            </div>

            {/* Joined Date */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-400">Joined Date</span>
              </div>
              <span className="text-white text-sm">
                {new Date(customer.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status & Network Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Account Status */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            {hasActiveChannels ? (
              <CheckCircle className="h-4 w-4 text-green-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400" />
            )}
            <span className="text-xs text-gray-400">Account Status</span>
          </div>
          <div className="text-white text-sm font-medium">
            {hasActiveChannels ? "Active" : "Inactive"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {hasActiveChannels
              ? "Has active subscriptions"
              : "No active subscriptions"}
          </div>
        </div>

        {/* Subscription Status */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-gray-400">Subscriptions</span>
          </div>
          <div className="text-white text-sm font-medium">
            {activeChannels} Active
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {totalChannels - activeChannels} Inactive
          </div>
        </div>

        {/* Store Activity */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Store className="h-4 w-4 text-purple-400" />
            <span className="text-xs text-gray-400">Store Activity</span>
          </div>
          <div className="text-white text-sm font-medium">
            {totalStores} Stores
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Across {totalChannels} channels
          </div>
        </div>

        {/* Network Role */}
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <UsersRound className="h-4 w-4 text-green-400" />
            <span className="text-xs text-gray-400">Role</span>
          </div>
          <div className="text-white text-sm font-medium">Buyer</div>
          <div className="text-xs text-gray-500 mt-1">Revenue Network</div>
        </div>
      </div>

      {/* Stores & Channels Details */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Store className="h-4 w-4 text-blue-400" />
            Stores & Channels ({totalStores} stores, {totalChannels} channels)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {customer.stores.map((store, storeIndex) => (
              <div key={store.storeId} className="bg-gray-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Store className="h-4 w-4 text-blue-400" />
                  <div>
                    <h4 className="text-white font-medium">
                      {store.storeName}
                    </h4>
                    <p className="text-xs text-gray-400">
                      Joined: {new Date(store.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {store.channels.map((channel, channelIndex) => (
                    <div
                      key={channel.channelId}
                      className="bg-gray-800 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h5 className="text-white text-sm font-medium">
                          {channel.channelTitle}
                        </h5>
                        <Badge
                          variant={
                            channel.status === "active"
                              ? "default"
                              : "secondary"
                          }
                          className={`text-xs ${
                            channel.status === "active"
                              ? "bg-green-500 text-white"
                              : "bg-gray-600 text-gray-300"
                          }`}
                        >
                          {channel.status}
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Cycle:</span>
                          <span className="text-white capitalize">
                            {channel.paymentCycle}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Joined:</span>
                          <span className="text-white">
                            {new Date(channel.joinedAt).toLocaleDateString()}
                          </span>
                        </div>
                        {channel.status === "active" && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Expires:</span>
                            <span className="text-white">
                              {new Date(
                                channel.expiryDate
                              ).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
