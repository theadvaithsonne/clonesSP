"use client";

import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RotateCw,
  Mail,
  Shield,
  Ban,
  Send,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type InviteRow = {
  id: string;
  email: string;
  name?: string;
  role: string;
  floorId?: string | null;
  department?: string | null;
  status: "pending" | "accepted" | "revoked";
  createdAt: string;
};

const ITEMS_PER_PAGE = 20;

export default function InvitesPage() {
  const [items, setItems] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [floorData, setFloorData] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<{
    [key: string]: "resend" | "revoke" | null;
  }>({});

  async function loadAll() {
    const orgId = localStorage.getItem("garage_org_id");
    if (!orgId) {
      setError("No organization found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Load invites and floor data in parallel to avoid race conditions
      const [invitesRes, floorRes] = await Promise.all([
        api<{ items: InviteRow[] }>(
          `/invites/list?orgId=${orgId}`,
          {},
          getToken()!
        ),
        api<any>(
          `/floors/roster?orgId=${orgId}`,
          {},
          getToken()!
        ).catch((err) => {
          console.error("Failed to load floors:", err);
          return null;
        }),
      ]);

      setItems(invitesRes.items || []);
      setFloorData(floorRes);
    } catch (err: any) {
      console.error("Failed to load invites:", err);
      setError(err.message || "Failed to load invites");
      toast.error("Failed to load invites. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [items.length]);

  const resend = async (id: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    setActionLoading((prev) => ({ ...prev, [id]: "resend" }));

    try {
      await api(
        `/invites/${id}/resend?orgId=${orgId}`,
        { method: "PATCH" },
        getToken()!
      );
      toast.success("Invite resent successfully!");
      loadAll();
    } catch (error) {
      console.error("Failed to resend invite:", error);
      toast.error("Failed to resend invite. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const revoke = async (id: string) => {
    const orgId = localStorage.getItem("garage_org_id");
    setActionLoading((prev) => ({ ...prev, [id]: "revoke" }));

    try {
      await api(
        `/invites/${id}/revoke?orgId=${orgId}`,
        { method: "PATCH" },
        getToken()!
      );
      toast.success("Invite revoked successfully!");
      loadAll();
    } catch (error) {
      console.error("Failed to revoke invite:", error);
      toast.error("Failed to revoke invite. Please try again.");
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: null }));
    }
  };

  const colorFor = (s: InviteRow["status"]) =>
    s === "accepted"
      ? "bg-green-500/20 text-green-300 border-green-500/30"
      : s === "revoked"
      ? "bg-red-500/20 text-red-300 border-red-500/30"
      : "bg-amber-500/20 text-amber-300 border-amber-500/30";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-6 w-6 animate-spin text-[#9fa0b8]" />
      </div>
    );
  }

  return (
    <div className="p-6 pb-12">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Invitees</h1>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1a1a22] border border-[#2a2a35] text-xs text-[#9fa0b8]">
            <Users className="h-3 w-3" />
            {items.length}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={loadAll}
          className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
        >
          <RotateCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[#2a2a35] bg-[#0a0a0d] divide-y divide-[#2a2a35]">
        {/* Header */}
        <div className="grid grid-cols-12 px-4 py-2 text-xs text-[#9fa0b8]">
          <div className="col-span-3">Member</div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3">Placement</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        {paginatedItems.map((r) => (
          <div key={r.id} className="grid grid-cols-12 px-4 py-3 items-center">
            <div className="col-span-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 opacity-70 shrink-0" />
                <div className="leading-tight min-w-0">
                  <div className="text-sm text-white truncate">
                    {r.name || "—"}
                  </div>
                  <div className="text-xs text-[#9fa0b8] truncate">
                    {r.email}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <Badge
                variant="outline"
                className="text-[11px] border-[#3d3d51] text-[#c9c9ee] bg-transparent capitalize"
              >
                <Shield className="h-3.5 w-3.5 mr-1 opacity-70" />
                {r.role}
              </Badge>
            </div>
            <div className="col-span-3 text-sm">
              {r.floorId
                ? (floorData as any)?.floors?.find(
                    (f: any) => f.id === r.floorId
                  )?.name
                : "—"}
            </div>
            <div className="col-span-2">
              <span
                className={`capitalize inline-flex items-center px-2 py-0.5 rounded border text-[11px] ${colorFor(
                  r.status
                )}`}
              >
                {r.status}
              </span>
            </div>
            <div className="col-span-2 flex justify-end gap-2">
              {r.status === "pending" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resend(r.id)}
                    disabled={actionLoading[r.id] === "resend"}
                    className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
                  >
                    {actionLoading[r.id] === "resend" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => revoke(r.id)}
                    disabled={actionLoading[r.id] === "revoke"}
                    className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
                  >
                    {actionLoading[r.id] === "revoke" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </Button>
                </>
              ) : (
                <span className="text-xs text-[#9fa0b8]">
                  {r.status === "accepted" ? "Joined" : "Revoked"}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Empty state */}
        {items.length === 0 && !loading && (
          <div className="px-4 py-8 text-sm text-[#9fa0b8] text-center">
            No invites yet.
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-[#9fa0b8]">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1}–
            {Math.min(currentPage * ITEMS_PER_PAGE, items.length)} of{" "}
            {items.length}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - currentPage) <= 1) return true;
                  return false;
                })
                .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                  if (idx > 0) {
                    const prev = arr[idx - 1];
                    if (page - prev > 1) {
                      acc.push("ellipsis");
                    }
                  }
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "ellipsis" ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-1 text-[#9fa0b8] text-xs"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
                        currentPage === item
                          ? "bg-[#1a1a22] text-white border border-[#3b3b4a]"
                          : "text-[#9fa0b8] hover:text-white hover:bg-[#15151b]"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923] disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
