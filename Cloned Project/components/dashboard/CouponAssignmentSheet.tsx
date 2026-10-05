"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Loader2, Gift, X, Trash2, Calendar } from "lucide-react";
import { toast } from "sonner";
import { UserSearchPicker, PickedUser } from "@/components/ui/user-search-picker";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/api";

export interface CouponAssignmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Coupon ID to manage assignments for */
  couponId: string | null;
  couponCode?: string;
  couponName?: string;
  /** Endpoint base — e.g. "/garage-admin/platform-coupons/:id" or "/org/:orgId/platform-coupons/:id" */
  endpointBase: string;
  /** Bearer token */
  authToken: string;
  /** Picker scope */
  scope: "platform" | "org";
  /** orgId for founder-scoped picker */
  orgId?: string;
}

interface AssignmentRow {
  _id: string;
  userId: {
    _id: string;
    email?: string;
    name?: string;
    profilePicture?: string;
  } | null;
  status: "active" | "used" | "revoked" | "expired";
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

export function CouponAssignmentSheet({
  open,
  onOpenChange,
  couponId,
  couponCode,
  couponName,
  endpointBase,
  authToken,
  scope,
  orgId,
}: CouponAssignmentSheetProps) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<PickedUser[]>([]);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const url = couponId ? endpointBase.replace(":id", couponId) : "";

  const fetchAssignments = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}${url}/assignments`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.success) setAssignments(data.assignments || []);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load assignments");
    } finally {
      setLoading(false);
    }
  }, [url, authToken]);

  useEffect(() => {
    if (open && couponId) {
      fetchAssignments();
      setPicked([]);
      setReason("");
      setExpiresAt("");
    }
  }, [open, couponId, fetchAssignments]);

  const handleAssign = async () => {
    if (!picked.length) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}${url}/assignments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          userIds: picked.map((u) => u._id),
          reason: reason || undefined,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to assign");
        return;
      }
      const failedCount = (data.failed || []).length;
      if (failedCount > 0) {
        toast.warning(
          `Assigned ${data.assigned}, ${failedCount} failed`
        );
      } else {
        toast.success(`Gifted to ${data.assigned} user${data.assigned === 1 ? "" : "s"}`);
      }
      setPicked([]);
      setReason("");
      setExpiresAt("");
      fetchAssignments();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (assignmentId: string) => {
    try {
      // Admin: DELETE /garage-admin/platform-coupons/assignments/:assignmentId
      // Founder: DELETE /org/:orgId/platform-coupons/:id/assignments/:assignmentId
      const revokeUrl =
        scope === "org"
          ? `${url}/assignments/${assignmentId}`
          : `/garage-admin/platform-coupons/assignments/${assignmentId}`;
      const res = await fetch(`${API_URL}${revokeUrl}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to revoke");
        return;
      }
      toast.success("Revoked");
      fetchAssignments();
    } catch (err: any) {
      toast.error(err?.message || "Failed to revoke");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="sm:max-w-[560px] w-full p-0 gap-0 flex flex-col bg-[#0a0a0e] border-l border-[#1a1a22]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-2 p-5 border-b border-[#1a1a22] bg-[#0a0a0e]">
          <SheetHeader className="p-0">
            <SheetTitle className="flex items-center gap-2 text-lg text-white">
              <Gift className="h-4 w-4 text-brand" />
              Gift Coupon
            </SheetTitle>
            <SheetDescription className="text-xs mt-0.5 text-[#9fa0b8]">
              {couponCode ? (
                <>
                  <code className="font-mono text-brand">{couponCode}</code>
                  {couponName ? <> · {couponName}</> : null}
                </>
              ) : (
                "Manage recipients of this coupon"
              )}
            </SheetDescription>
          </SheetHeader>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#9fa0b8] hover:text-white transition-colors rounded-md p-1 hover:bg-[#1a1a22]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Add recipients */}
          <div className="space-y-3">
            <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
              Add recipients
            </Label>
            <UserSearchPicker
              scope={scope}
              orgId={orgId}
              authToken={authToken}
              selected={picked}
              onChange={setPicked}
              disabled={submitting}
            />

            <div className="grid grid-cols-1 gap-3 mt-2">
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
                  Note (optional)
                </Label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                  placeholder="Why is this being gifted?"
                  disabled={submitting}
                  className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm"
                />
              </div>
              <div>
                <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Expires (optional)
                </Label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={submitting}
                  className="w-full mt-1.5 h-10 px-3 rounded-lg bg-[#1a1a22] text-white placeholder:text-[#6b6b80] border-0 focus:outline-none focus:bg-[#1e1e28] transition-colors text-sm [color-scheme:dark]"
                />
              </div>
            </div>

            <button
              onClick={handleAssign}
              disabled={submitting || !picked.length}
              className="h-10 w-full rounded-lg bg-brand text-brand-foreground font-medium hover:bg-[color:color-mix(in_srgb,var(--brand)_92%,black)] transition-all active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Gift className="h-4 w-4 mr-1.5" />
                  Gift to {picked.length} {picked.length === 1 ? "user" : "users"}
                </>
              )}
            </button>
          </div>

          {/* Existing recipients */}
          <div className="space-y-2">
            <Label className="text-[11px] uppercase tracking-wider text-[#6b6b80] font-medium">
              Recipients ({assignments.length})
            </Label>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-[#6b6b80]" />
              </div>
            ) : assignments.length === 0 ? (
              <div className="rounded-lg bg-[#1a1a22] p-4 text-center text-xs text-[#6b6b80]">
                No one has been gifted this coupon yet.
              </div>
            ) : (
              <div className="space-y-1.5">
                {assignments.map((a) => (
                  <div
                    key={a._id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1a1a22]"
                  >
                    {a.userId?.profilePicture ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={a.userId.profilePicture}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover"
                      />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-[10px] text-brand">
                        {(a.userId?.name || a.userId?.email || "?")[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">
                        {a.userId?.name || "—"}
                      </div>
                      <div className="text-xs text-[#6b6b80] truncate">
                        {a.userId?.email}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full font-medium capitalize",
                        a.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : a.status === "used"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-zinc-500/10 text-zinc-400"
                      )}
                    >
                      {a.status}
                    </span>
                    {a.status === "active" && (
                      <button
                        onClick={() => handleRevoke(a._id)}
                        className="text-[#9fa0b8] hover:text-red-400 transition-colors p-1 rounded hover:bg-[#0a0a0e]"
                        title="Revoke"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
