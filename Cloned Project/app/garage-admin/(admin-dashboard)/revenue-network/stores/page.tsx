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
  Store,
  DollarSign,
  Users,
  Calendar,
  ExternalLink,
  Globe,
  Palette,
  Image,
  Video,
  Package,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
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

export default function AllStoresPage() {
  const [stores, setStores] = useState<StoreData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const response = await fetch(
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

      if (!response.ok) {
        throw new Error("Failed to fetch stores");
      }

      const data = await response.json();
      setStores(data.stores || []);
    } catch (error) {
      console.error("Error loading stores:", error);
      toast.error("Failed to load stores");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111116] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-dashed border-purple-400 rounded-full animate-spin"></div>
          <p className="text-lg">Loading Stores...</p>
        </div>
      </div>
    );
  }

  const totalStores = stores?.length || 0;

  return (
    <>
      {/* Stats Cards - Compact */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">{totalStores}</div>
              <div className="text-[10px] sm:text-xs text-gray-400">Total Stores</div>
            </div>
            <Store className="h-4 w-4 text-blue-400" />
          </div>
        </div>

        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">Active</div>
              <div className="text-[10px] sm:text-xs text-gray-400">All Active</div>
            </div>
            <DollarSign className="h-4 w-4 text-green-400" />
          </div>
        </div>

        <div className="bg-[#111116] border border-gray-800 rounded-lg p-2 sm:p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-base sm:text-lg font-bold text-white">Live</div>
              <div className="text-[10px] sm:text-xs text-gray-400">Revenue Network</div>
            </div>
            <Globe className="h-4 w-4 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* All Stores Table - Compact */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2 text-lg">
            <Store className="h-4 w-4 text-blue-400" />
            All Stores ({totalStores})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Store</TableHead>
                <TableHead className="text-gray-300">Category</TableHead>
                <TableHead className="text-gray-300">URL</TableHead>
                <TableHead className="text-gray-300">Created</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stores?.map((store) => (
                <TableRow
                  key={store._id}
                  className="border-gray-800 hover:bg-gray-900/50"
                >
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                        {store.logo ? (
                          <img
                            src={store.logo}
                            alt={store.name}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-white font-medium text-xs">
                            {store.name?.charAt(0)?.toUpperCase() || "S"}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-white text-sm">
                          {store.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {store.slug}
                        </div>
                        {store.description && (
                          <div className="text-xs text-gray-500 truncate max-w-xs">
                            {store.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    {store.category ? (
                      <Badge variant="outline" className="text-xs text-blue-400 border-blue-400">
                        {store.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    {store.url ? (
                      <div className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-gray-400" />
                        <a
                          href={store.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 truncate max-w-xs"
                        >
                          {store.url}
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-gray-400">
                    {new Date(store.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="py-3">
                    <Link href={`/garage-admin/revenue-network/stores/${store._id}`}>
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

          {stores?.length === 0 && (
            <div className="text-center py-6">
              <Store className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-white mb-1">
                No Stores Found
              </h3>
              <p className="text-xs text-gray-400">
                No stores in the revenue network yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
