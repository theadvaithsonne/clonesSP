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
  UsersRound,
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
  Store,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
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

export default function AllBuyersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
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
      setCustomers(data.customers || []);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Buyers...</p>
        </div>
      </div>
    );
  }

  const totalCustomers = customers?.length || 0;
  const activeCustomers =
    customers?.filter((customer) =>
      customer.stores.some((store) =>
        store.channels.some((channel) => channel.status === "active")
      )
    ).length || 0;

  return (
    <>
      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">
                {totalCustomers}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400">Total Buyers</div>
            </div>
            <UsersRound className="h-4 w-4 text-blue-400" />
          </div>
        </div>

        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">
                {activeCustomers}
              </div>
              <div className="text-[10px] sm:text-xs text-gray-400">Active</div>
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

      {/* All Buyers Table - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <UsersRound className="h-4 w-4 text-blue-400" />
            All Buyers ({totalCustomers})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Customer</TableHead>
                <TableHead className="text-gray-300">Stores</TableHead>
                <TableHead className="text-gray-300">Status</TableHead>
                <TableHead className="text-gray-300">Joined</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers?.map((customer) => {
                const hasActiveChannels = customer.stores.some((store) =>
                  store.channels.some((channel) => channel.status === "active")
                );
                const totalStores = customer.stores.length;
                const totalChannels = customer.stores.reduce(
                  (sum, store) => sum + store.channels.length,
                  0
                );

                return (
                  <TableRow
                    key={customer._id}
                    className="border-gray-800 hover:bg-gray-900/50"
                  >
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-medium text-xs">
                            {customer.name?.charAt(0)?.toUpperCase() || "C"}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white text-sm">
                            {customer.name || "Unnamed Customer"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {customer.email}
                          </div>
                          {customer.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {customer.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1">
                          <Store className="w-3 h-3 text-blue-400" />
                          <span className="text-xs text-white">
                            {totalStores} stores
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-green-400" />
                          <span className="text-xs text-gray-400">
                            {totalChannels} channels
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-1">
                        {hasActiveChannels ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-400" />
                            <span className="text-xs text-green-400">
                              Active
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3 text-red-400" />
                            <span className="text-xs text-red-400">
                              Inactive
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-xs text-gray-400">
                      {new Date(customer.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="py-3">
                      <Link
                        href={`/garage-admin/revenue-network/customers/${customer._id}`}
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
                );
              })}
            </TableBody>
          </Table>

          {customers?.length === 0 && (
            <div className="text-center py-6">
              <UsersRound className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">
                No Buyers Found
              </h3>
              <p className="text-xs text-gray-400">
                No revenue network buyers in the system yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
