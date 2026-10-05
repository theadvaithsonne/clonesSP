"use client";

// Sidebar page: /garage-admin/cryptobrand-offices
//
// Lists every org where Organization.officeCreatedFromCryptobrand === true.
// Clicking a row drills into the org's member list at
// /garage-admin/cryptobrand-offices/[orgId].

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { garageAdminApi } from "@/lib/api";
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Users,
  Bitcoin,
  Loader2,
  Search,
  MapPin,
  ChevronRight,
  Calendar,
} from "lucide-react";

interface Office {
  orgId: string;
  name: string;
  icon: string | null;
  city: string | null;
  country: string | null;
  createdAt: string;
  memberCount: number;
}

interface ListResponse {
  success: true;
  offices: Office[];
  total: number;
}

export default function CryptobrandOfficesPage() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (debouncedSearch) qs.set("q", debouncedSearch);
        const res = await garageAdminApi<ListResponse>(
          `/garage-admin/cryptobrand-offices${qs.toString() ? `?${qs.toString()}` : ""}`,
        );
        setOffices(res.offices || []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load cryptobrand offices");
      } finally {
        setLoading(false);
      }
    })();
  }, [debouncedSearch]);

  const stats = useMemo(
    () => ({
      totalOffices: offices.length,
      totalMembers: offices.reduce((s, o) => s + o.memberCount, 0),
    }),
    [offices],
  );

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Cryptobrand Offices
            </CardTitle>
            <Bitcoin className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalOffices}
            </div>
            <p className="text-xs text-gray-400">
              Orgs with `officeCreatedFromCryptobrand: true`
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.totalMembers}
            </div>
            <p className="text-xs text-gray-400">
              Across all cryptobrand offices
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Bitcoin className="h-5 w-5 text-orange-400" />
                My Crypto Offices
              </CardTitle>
              <CardDescription className="text-gray-400">
                Click an office to see its members + manage their
                multi-currency wallets.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search office name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 w-64 bg-[#1a1a20] border-[#2a2a35] text-white"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[#9fa0b8]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading offices…
            </div>
          ) : offices.length === 0 ? (
            <div className="text-center py-12">
              <Bitcoin className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {debouncedSearch
                  ? "No offices match your search"
                  : "No cryptobrand offices yet"}
              </h3>
              <p className="text-gray-400">
                {debouncedSearch
                  ? "Try a different query."
                  : "Offices created via the Cryptobrand flow will show here."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Office</TableHead>
                  <TableHead className="text-gray-300">Location</TableHead>
                  <TableHead className="text-gray-300">Members</TableHead>
                  <TableHead className="text-gray-300">Created</TableHead>
                  <TableHead className="text-gray-300"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {offices.map((o) => (
                  <TableRow
                    key={o.orgId}
                    className="border-gray-800 hover:bg-[#161620] cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/garage-admin/cryptobrand-offices/${o.orgId}`)
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {o.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={o.icon}
                            alt={o.name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-800"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-white" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-white">
                            {o.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {o.orgId}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {o.city || o.country ? (
                        <div className="flex items-center gap-1 text-sm text-gray-300">
                          <MapPin className="h-3 w-3 text-gray-500" />
                          {[o.city, o.country].filter(Boolean).join(", ")}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-purple-500/40 bg-purple-500/10 text-purple-400"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {o.memberCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      <div className="text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-500" />
                        {new Date(o.createdAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/garage-admin/cryptobrand-offices/${o.orgId}`}
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View members
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
