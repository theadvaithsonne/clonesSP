"use client";

// Support-agent assignment — the "Assigned To" column cell plus its picker
// dialog, shared by every garage-admin table that lists a USER.
//
// The assignment is stored on the User (`assignedSupportAgentId`), not on
// anything list-specific, so it is the SAME assignment everywhere: assign from
// NetworkChain Subs and One Time Affiliates shows it, and vice versa. That is
// why this posts to the neutral `/garage-admin/users/:userId/assign-agent`
// rather than a per-table endpoint.
//
// Extracted from the NetworkChain Subs page so the two tables cannot drift.

import { useEffect, useState } from "react";
import { Check as CheckIcon, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { garageAdminApi } from "@/lib/api";

/** The support agent (a GarageAdmin) assigned to a user. */
export type AssignedAgent = {
  id: string;
  name: string | null;
  email: string | null;
  profilePicture: string | null;
  /** The agent's admin role ("Support Agent", "NVC", …) when the table sends it. */
  role?: string | null;
  assignedAt: string | null;
};

export type AdminOption = {
  id: string;
  name: string | null;
  email: string;
  profilePicture: string | null;
  /** The admin's role NAME — "NVC", "Support Agent", or a built-in. This is
   *  how you tell WHO is an NVC when picking someone to assign. */
  role?: string | null;
  isSuperAdmin?: boolean;
  isMe?: boolean;
  isActive?: boolean;
};

/** Built-in roles read as plain "Admin"/"Super Admin"; every other value is a
 *  named role someone created (NVC, Support Agent, …) and is worth showing. */
function roleLabel(role?: string | null): string | null {
  if (!role) return null;
  if (role === "garage-super-admin") return "Super Admin";
  if (role === "garage-admin") return "Admin";
  return role;
}

/** Role chip — the named roles are the point, so they get the accent. */
export function RoleChip({ role }: { role?: string | null }) {
  const label = roleLabel(role);
  if (!label) return null;
  const named = label !== "Admin" && label !== "Super Admin";
  return (
    <span
      className={
        named
          ? "shrink-0 rounded-full border border-brand/30 bg-brand/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-brand"
          : "shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/50"
      }
    >
      {label}
    </span>
  );
}

/** The minimum a row must expose to be assignable. */
export type AssignableRow = {
  userId: string | null;
  assignedTo: AssignedAgent | null;
  user?: { name?: string | null; email?: string | null } | null;
};

function Avatar({ src, name }: { src: string | null; name: string }) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className="h-9 w-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[rgba(68,68,68,0.4)] text-[13px] font-semibold text-white/70">
      {initial}
    </span>
  );
}

/** "Assigned To" cell — an Assign button when empty, the agent + Change when set. */
export function AssignedCell<T extends AssignableRow>({
  row,
  onAssign,
  canAssign,
}: {
  row: T;
  onAssign: (row: T) => void;
  canAssign: boolean;
}) {
  const a = row.assignedTo;
  if (!row.userId) return <span className="text-white/40">—</span>;
  if (!a) {
    if (!canAssign) return <span className="text-white/40">—</span>;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAssign(row);
        }}
        className="rounded-full bg-[rgba(68,68,68,0.28)] px-4 py-1.5 text-[12px] font-semibold text-white/70 transition-colors hover:bg-white/[0.12]"
      >
        Assign
      </button>
    );
  }
  return (
    <div className="flex items-start gap-3 py-1">
      <Avatar src={a.profilePicture} name={a.name || a.email || "?"} />
      <div className="min-w-0 space-y-1 leading-tight">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-white/80">
            {a.name || "Unnamed"}
          </span>
          <RoleChip role={a.role} />
        </div>
        <div className="truncate text-[14px] text-white/50">{a.email || "—"}</div>
        {canAssign && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign(row);
            }}
            className="rounded-full bg-[rgba(68,68,68,0.28)] px-3 py-1 text-[10px] font-semibold text-white/60 transition-colors hover:bg-white/[0.12]"
          >
            Change
          </button>
        )}
      </div>
    </div>
  );
}

/** Support-agent picker. `adminId: null` clears the assignment.
 *
 * `canAssign` is decided by the PAGE that opens this — manage on One Time
 * Affiliates or on NetworkChain Subs. Passed in rather than recomputed here
 * so the one dialog serves both tables with each page's own grant, and so a
 * delegated (non-super) manager can assign. */
export function AssignAgentDialog<T extends AssignableRow>({
  subject,
  onClose,
  onAssigned,
  canAssign,
}: {
  subject: T | null;
  onClose: () => void;
  onAssigned: (userId: string, agent: AssignedAgent | null) => void;
  canAssign: boolean;
}) {
  const [admins, setAdmins] = useState<AdminOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!subject || !canAssign) return;
    let cancelled = false;
    setLoading(true);
    // The grantable roster endpoint — same shape as /admins but reachable by
    // an OTA / NC-subs manager, not just the super admin.
    garageAdminApi<{ data: AdminOption[] }>("/garage-admin/assignable-agents", {
      method: "GET",
    })
      .then((res) => {
        // Named roles (NVC, Support Agent, …) first — those are who you
        // actually assign work to; the two built-ins sink to the bottom.
        const list = [...(res?.data || [])].sort((a, b) => {
          const named = (r?: string | null) =>
            r && r !== "garage-admin" && r !== "garage-super-admin" ? 0 : 1;
          return (
            named(a.role) - named(b.role) ||
            (a.name || a.email).localeCompare(b.name || b.email)
          );
        });
        if (!cancelled) setAdmins(list);
      })
      .catch((e: any) => {
        if (!cancelled) toast.error(e?.message || "Failed to load admins");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subject, canAssign]);

  useEffect(() => {
    if (!subject) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subject, onClose]);

  if (!subject) return null;
  const userId = subject.userId;

  async function submit(adminId: string | null, admin: AdminOption | null) {
    if (!subject || !userId) return;
    setSaving(adminId ?? "__clear__");
    try {
      await garageAdminApi(`/garage-admin/users/${userId}/assign-agent`, {
        method: "POST",
        body: JSON.stringify({ adminId }),
      });
      onAssigned(
        userId,
        admin
          ? {
              id: admin.id,
              name: admin.name,
              email: admin.email,
              profilePicture: admin.profilePicture,
              role: admin.role ?? null,
              assignedAt: new Date().toISOString(),
            }
          : null,
      );
      toast.success(
        admin ? `Assigned to ${admin.name || admin.email}` : "Unassigned",
      );
      onClose();
    } catch (e: any) {
      // Surface the server's reason (e.g. lost access mid-session).
      toast.error(e?.message || "Failed to assign");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-[420px] max-w-[94vw] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0e0e12] shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Assign to admin
            </p>
            <p className="truncate text-base font-bold text-white">
              {subject.user?.name || subject.user?.email || "User"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[54vh] overflow-y-auto p-2">
          {!canAssign ? (
            <div className="px-3 py-8 text-center text-sm text-zinc-400">
              You don&apos;t have access to assign agents.
            </div>
          ) : loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : admins.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              No admins found.
            </p>
          ) : (
            admins.map((a) => {
              const isCurrent = subject.assignedTo?.id === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => submit(a.id, a)}
                  disabled={!!saving}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <Avatar src={a.profilePicture} name={a.name || a.email} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-white">
                        {a.name || "Unnamed"}
                      </span>
                      <RoleChip role={a.role} />
                    </div>
                    <div className="truncate text-[11px] text-zinc-500">
                      {a.email}
                    </div>
                  </div>
                  {saving === a.id ? (
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" />
                  ) : isCurrent ? (
                    <CheckIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {subject.assignedTo && (
          <div className="border-t border-white/[0.06] p-3">
            <button
              onClick={() => submit(null, null)}
              disabled={!!saving}
              className="w-full rounded-lg border border-red-500/25 bg-red-500/10 py-2 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              {saving === "__clear__" ? "Removing…" : "Remove assignment"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
