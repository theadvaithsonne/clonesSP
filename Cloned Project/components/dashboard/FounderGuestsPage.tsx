"use client";

// Founder-facing tab under Office Settings → Guests. Lists every user
// who currently holds a guest:true membership on THIS org and lets the
// founder graduate any of them to guest:false in one click.
//
// This mirrors the super-admin /garage-admin/affiliate-guests page but
// scoped to the founder's current org. Backend: /team/guests and
// /team/guests/:userId/graduate (see routes/team.ts).

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Mail,
  Phone,
  Loader2,
  CheckCircle,
  Calendar,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface GuestRow {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  profilePicture: string | null;
  referredBy: string | null;
  role: string;
  joinedAt: string | null;
  createdAt: string;
}

interface ListResponse {
  success: true;
  rows: GuestRow[];
  total: number;
}

export default function FounderGuestsPage() {
  const [rows, setRows] = useState<GuestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [graduating, setGraduating] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      if (!orgId) {
        toast.error("No org selected");
        setLoading(false);
        return;
      }
      const res = await api<ListResponse>(
        `/team/guests?orgId=${encodeURIComponent(orgId)}`,
      );
      setRows(res.rows || []);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load guests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleGraduate = async (userId: string, label: string) => {
    setGraduating((s) => new Set(s).add(userId));
    try {
      const orgId = localStorage.getItem("garage_org_id");
      const r = await api<{
        success: true;
        modified: number;
        alreadyGraduated: boolean;
      }>(
        `/team/guests/${userId}/graduate?orgId=${encodeURIComponent(orgId || "")}`,
        { method: "PATCH" },
      );
      if (r.alreadyGraduated) {
        toast.info(`${label} was already a full member`);
      } else {
        toast.success(`${label} is now a full member`);
      }
      // Optimistic remove — the row disappears immediately.
      setRows((prev) => prev.filter((row) => row.userId !== userId));
    } catch (e: any) {
      toast.error(e?.message || "Failed to graduate user");
    } finally {
      setGraduating((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = `${r.name || ""} ${r.email || ""} ${r.phone || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const stats = useMemo(
    () => ({
      total: rows.length,
      referred: rows.filter((r) => r.referredBy).length,
      showing: filtered.length,
    }),
    [rows, filtered],
  );

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Guests</h1>
        <p className="text-sm text-[#9fa0b8] mt-1">
          Users currently in this office as guests (limited access).
          Graduate them to full members with one click.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Total Guests
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
              Referred
            </CardTitle>
            <UserCheck className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.referred}
            </div>
            <p className="text-xs text-gray-400">Came in via referral link</p>
          </CardContent>
        </Card>
        <Card className="bg-[#111116] border-gray-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">
              Shown
            </CardTitle>
            <Users className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {stats.showing}
            </div>
            <p className="text-xs text-gray-400">After search filter</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="bg-[#111116] border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-400" />
                Guest Members
              </CardTitle>
              <CardDescription className="text-gray-400">
                Click Graduate to convert a guest into a full member of
                this office.
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
              Loading guests…
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8">
              <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">
                {rows.length === 0
                  ? "No guests on this office"
                  : "No guests match your search"}
              </h3>
              <p className="text-gray-400">
                {rows.length === 0
                  ? "Everyone here is already a full member."
                  : "Try a different query."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800">
                  <TableHead className="text-gray-300">User</TableHead>
                  <TableHead className="text-gray-300">Referred</TableHead>
                  <TableHead className="text-gray-300">Role</TableHead>
                  <TableHead className="text-gray-300">Joined</TableHead>
                  <TableHead className="text-gray-300 text-right">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const busy = graduating.has(row.userId);
                  const label = row.name || row.email || row.userId;
                  return (
                    <TableRow key={row.userId} className="border-gray-800">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {row.profilePicture ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.profilePicture}
                              alt={row.name || "user"}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {(row.name || row.email || "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white">
                              {row.name || "Unnamed"}
                            </div>
                            <div className="text-sm text-gray-400 flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {row.email || "—"}
                            </div>
                            {row.phone && (
                              <div className="text-xs text-gray-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {row.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.referredBy ? (
                          <Badge
                            variant="outline"
                            className="border-green-500/40 bg-green-500/10 text-green-400"
                          >
                            Referred
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-gray-700 text-gray-500"
                          >
                            Direct
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-gray-300 text-sm capitalize">
                        {row.role}
                      </TableCell>
                      <TableCell className="text-gray-300">
                        <div className="text-sm flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-gray-500" />
                          {row.joinedAt
                            ? new Date(row.joinedAt).toLocaleDateString(
                                "en-US",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                },
                              )
                            : "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => handleGraduate(row.userId, label)}
                          disabled={busy}
                          className="bg-purple-600 hover:bg-purple-700 text-white h-8"
                        >
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle className="h-3.5 w-3.5 mr-1" />
                              Graduate
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
