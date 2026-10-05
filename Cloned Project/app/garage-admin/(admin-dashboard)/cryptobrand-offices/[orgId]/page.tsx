"use client";

// Drill-in page: /garage-admin/cryptobrand-offices/[orgId]
//
// Lists every member of the selected cryptobrand office. Clicking a
// row drills into the user's wallets at
// /garage-admin/cryptobrand-offices/[orgId]/users/[userId].

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  Users,
  ArrowLeft,
  Bitcoin,
  Loader2,
  Search,
  Mail,
  Phone,
  ChevronRight,
  Wallet,
} from "lucide-react";

interface Member {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  role: string;
  guest: boolean;
  joinedAt: string | null;
}

interface MembersResponse {
  success: true;
  org: { orgId: string; name: string; icon: string | null };
  members: Member[];
  total: number;
}

export default function CryptobrandOfficeMembersPage() {
  const params = useParams();
  const orgId = params?.orgId as string;
  const [org, setOrg] = useState<MembersResponse["org"] | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        if (debouncedSearch) qs.set("q", debouncedSearch);
        const res = await garageAdminApi<MembersResponse>(
          `/garage-admin/cryptobrand-offices/${orgId}/members${qs.toString() ? `?${qs.toString()}` : ""}`,
        );
        setOrg(res.org);
        setMembers(res.members || []);
      } catch (e: any) {
        toast.error(e?.message || "Failed to load members");
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId, debouncedSearch]);

  const stats = useMemo(
    () => ({
      total: members.length,
      guests: members.filter((m) => m.guest).length,
      founders: members.filter((m) => m.role === "founder").length,
    }),
    [members],
  );

  return (
    <>
      {/* Back link + header */}
      <div>
        <Link
          href="/garage-admin/cryptobrand-offices"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to offices
        </Link>
        <div className="flex items-center gap-3">
          {org?.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={org.icon}
              alt={org.name}
              className="w-12 h-12 rounded-lg object-cover bg-gray-800"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-700 rounded-lg flex items-center justify-center">
              <Bitcoin className="h-6 w-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">
              {org?.name || "…"}
            </h1>
            <p className="text-xs text-gray-500">Cryptobrand office • {orgId}</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Total Members
            </CardTitle>
            <Users className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <p className="text-xs text-gray-400">On this office</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Founders
            </CardTitle>
            <Users className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.founders}
            </div>
            <p className="text-xs text-gray-400">With founder role</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Guests
            </CardTitle>
            <Users className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">{stats.guests}</div>
            <p className="text-xs text-gray-400">Guest memberships</p>
          </CardContent>
        </Card>
      </div>

      {/* Members table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                Members
              </CardTitle>
              <CardDescription className="text-gray-400">
                Click a member to view their multi-currency wallets and
                add manual top-ups.
              </CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search name / email / phone"
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
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {debouncedSearch ? "No matching members" : "No members yet"}
              </h3>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">Member</TableHead>
                  <TableHead className="text-gray-300">Role</TableHead>
                  <TableHead className="text-gray-300">Status</TableHead>
                  <TableHead className="text-gray-300">Joined</TableHead>
                  <TableHead className="text-gray-300"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow
                    key={m.userId}
                    className="border-gray-800 hover:bg-[#161620] cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/garage-admin/cryptobrand-offices/${orgId}/users/${m.userId}`)
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {m.profilePicture ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.profilePicture}
                            alt={m.name || "user"}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                            <span className="text-white font-medium text-sm">
                              {(m.name || m.email || "?")
                                .charAt(0)
                                .toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-white">
                            {m.name || "Unnamed"}
                          </div>
                          <div className="text-sm text-gray-400 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {m.email || "—"}
                          </div>
                          {m.phone && (
                            <div className="text-xs text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {m.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          m.role === "founder"
                            ? "border-blue-500/40 bg-blue-500/10 text-blue-400 capitalize"
                            : "border-gray-700 text-gray-400 capitalize"
                        }
                      >
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.guest ? (
                        <Badge
                          variant="outline"
                          className="border-orange-500/40 bg-orange-500/10 text-orange-400"
                        >
                          Guest
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        >
                          Full member
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-300 text-sm">
                      {m.joinedAt
                        ? new Date(m.joinedAt).toLocaleDateString("en-US", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/garage-admin/cryptobrand-offices/${orgId}/users/${m.userId}`}
                        className="text-orange-400 hover:text-orange-300 flex items-center gap-1 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        Wallets
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
