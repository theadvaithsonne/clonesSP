"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Search,
  Share2,
  UserCheck,
  UserX,
  X,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/lib/auth";
import {
  Button,
  EmptyState,
  GOLD,
  formatMoney,
  useConsoleAction,
} from "../ui";
import {
  approveRegistration,
  checkInRegistration,
  listRegistrations,
  registrationsExportUrl,
  rejectRegistration,
} from "../api";
import type { EventRegistration, RegistrationStatus } from "../types";

const TABS: Array<{ value: "" | RegistrationStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "pending_approval", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending_approval: { bg: "#2d2a1f", fg: "#FACC15", label: "Pending" },
  approved: { bg: "#1f2d1f", fg: "#4ade80", label: "Approved" },
  rejected: { bg: "#3a1f1f", fg: "#f87171", label: "Rejected" },
  cancelled: { bg: "#22222b", fg: "#7c7d94", label: "Cancelled" },
};

const PAYMENT_LABEL: Record<string, string> = {
  free: "Free",
  paid: "Paid",
  pending: "Awaiting payment",
  refunded: "Refunded",
};

export default function RegistrationsSection({
  eventId,
  onChanged,
}: {
  eventId: string;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<EventRegistration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"" | RegistrationStatus>("");
  const [search, setSearch] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listRegistrations(eventId, {
        status: status || undefined,
        search: search || undefined,
        limit: 200,
      });
      setRows(res.registrations || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      toast.error(err?.message || "Could not load registrations");
    } finally {
      setLoading(false);
    }
  }, [eventId, status, search]);

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  async function decide(reg: EventRegistration, approve: boolean) {
    setActing(reg._id);
    try {
      if (approve) await approveRegistration(eventId, reg._id);
      else await rejectRegistration(eventId, reg._id);
      toast.success(approve ? "Attendee approved" : "Registration rejected");
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Could not update this registration");
    } finally {
      setActing(null);
    }
  }

  async function checkIn(reg: EventRegistration) {
    setActing(reg._id);
    try {
      await checkInRegistration(eventId, reg._id);
      toast.success(`${reg.attendee.name} checked in`);
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || "Could not check this attendee in");
    } finally {
      setActing(null);
    }
  }

  /**
   * The export route is authenticated, so a plain <a href> would 401 — fetch it
   * with the bearer token and hand the browser a blob instead.
   */
  async function exportCsv() {
    try {
      const res = await fetch(registrationsExportUrl(eventId), {
        headers: { Authorization: `Bearer ${getToken() || ""}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "registrations.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message || "Could not export registrations");
    }
  }

  // "Export CSV" lives in the bottom bar, not on the page.
  useConsoleAction("registrations:export", exportCsv);

  return (
    <div className="px-8 py-8">
      <div className="mb-6 text-sm text-[#7c7d94]">
        {total} {total === 1 ? "person" : "people"} so far.
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#4f5065]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email or company"
            className="w-72 rounded-lg border border-[#2a2a35] bg-[#141418] py-2 pl-9 pr-3 text-sm text-white placeholder:text-[#4f5065] focus:border-[#4a4a5c] focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.value || "all"}
              type="button"
              onClick={() => setStatus(t.value)}
              className={[
                "rounded-lg px-3 py-1.5 text-xs transition-colors",
                status === t.value
                  ? "bg-[#1f1f28] text-white"
                  : "text-[#7c7d94] hover:bg-white/5 hover:text-white",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-[#4f5065]" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-10 w-10" strokeWidth={1.25} />}
          title="No registrations yet"
          description="They will show up here the moment someone signs up."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#26262f]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1c1c24] bg-[#101014] text-left text-[11px] uppercase tracking-wider text-[#61627a]">
                <th className="px-4 py-3 font-medium">Attendee</th>
                <th className="px-4 py-3 font-medium">Ticket</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c1c24] bg-[#141418]">
              {rows.map((r) => {
                const badge = STATUS_STYLE[r.status] || STATUS_STYLE.cancelled;
                const tier =
                  typeof r.ticketTierId === "object" ? r.ticketTierId : null;
                return (
                  <tr key={r._id} className="transition-colors hover:bg-[#17171d]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{r.attendee.name}</div>
                      <div className="text-xs text-[#7c7d94]">{r.attendee.email}</div>
                      {r.attendee.company && (
                        <div className="text-xs text-[#61627a]">
                          {r.attendee.company}
                          {r.attendee.jobTitle ? ` · ${r.attendee.jobTitle}` : ""}
                        </div>
                      )}
                      {/* Who brought this buyer in. Only a real affiliate
                          click earns a tag — a `founder_default` placeholder
                          is attribution nobody acted on, and showing it as a
                          referral would overstate what the affiliate did. */}
                      {r.referredBy && r.referredBy.source !== "founder_default" && (
                        <div
                          className="mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: `${GOLD}1f`, color: GOLD }}
                          title={
                            r.referredBy.affiliateId
                              ? `Referred by ${r.referredBy.name} (${r.referredBy.affiliateId})`
                              : `Referred by ${r.referredBy.name}`
                          }
                        >
                          <Share2 className="h-2.5 w-2.5" />
                          Referred by {r.referredBy.name}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#c7c7da]">
                      {tier?.name || "—"}
                      {r.quantity > 1 && (
                        <span className="text-[#61627a]"> × {r.quantity}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#c7c7da]">
                        {PAYMENT_LABEL[r.paymentStatus] || r.paymentStatus}
                      </div>
                      {r.amountPaid > 0 && (
                        <div className="text-xs text-[#61627a]">
                          {formatMoney(r.amountPaid, r.currency)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded px-2 py-0.5 text-[11px]"
                        style={{ background: badge.bg, color: badge.fg }}
                      >
                        {badge.label}
                      </span>
                      {r.checkedInAt && (
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-[#4ade80]">
                          Checked in
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {acting === r._id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#4f5065]" />
                        ) : (
                          <>
                            {r.status === "pending_approval" && (
                              <>
                                <button
                                  type="button"
                                  title="Approve"
                                  onClick={() => decide(r, true)}
                                  className="rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-[#4ade80]/10 hover:text-[#4ade80]"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  title="Reject"
                                  onClick={() => decide(r, false)}
                                  className="rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {r.status === "approved" && !r.checkedInAt && (
                              <button
                                type="button"
                                title="Check in"
                                onClick={() => checkIn(r)}
                                className="rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-white/5 hover:text-white"
                                style={{ color: GOLD }}
                              >
                                <QrCode className="h-4 w-4" />
                              </button>
                            )}
                            {r.status === "approved" && (
                              <button
                                type="button"
                                title="Revoke"
                                onClick={() => decide(r, false)}
                                className="rounded-lg p-2 text-[#7c7d94] transition-colors hover:bg-[#f87171]/10 hover:text-[#f87171]"
                              >
                                <UserX className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
