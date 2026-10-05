"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { getToken, getUserIdFromToken } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AppIcon from "@/components/dashboard/AppIcon";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Hardcoded catalog for now
export const CATALOG = [
  // {
  //   appId: "garage",
  //   name: "Garage",
  //   url: "https://my.garage.app/",
  //   icon: "",
  //   description:
  //     "Simple, privacy-respecting link-in-bio & micro-website builder.",
  // },
  // {
  //   appId: "revenue-network",
  //   name: "Revenue Network",
  //   url: "https://www.revenue.network/",
  //   icon: "",
  //   description: "Earn while you prompt—tools to monetize AI workflows.",
  // },
  // {
  //   appId: "my-revenue-network",
  //   name: "My Revenue Network",
  //   url: "https://my.revenue.network/",
  //   icon: "",
  //   description: "My Revenue Network application",
  // },
  {
    appId: "teamforce",
    name: "Teamforce",
    icon: "",
    description: "HR, attendance, payroll and employee management",
    renderType: "inline" as const,
  },
  {
    appId: "deals",
    name: "Deals",
    url: "https://deals.garage.app",
    icon: "",
    description: "Deals application",
  },
  {
    appId: "taskrooms",
    name: "Taskrooms",
    url: "https://taskrooms.garage.app",
    icon: "",
    description: "Task rooms application",
  },
  // {
  //   appId: "autopilot",
  //   name: "Autopilot",
  //   url: "https://autopilot2.garage.app",
  //   icon: "https://35yqu70ay5.ufs.sh/f/RAEZ8dOTgh6ZuOjfjDjA2UN8vBKycdMDfqZTiePnjWbz09ES",
  //   description: "Autopilot application",
  // },
  // {
  //   appId: "clarity",
  //   name: "Clarity",
  //   url: "https://clarity.garage.app",
  //   icon: "",
  //   description: "Clarity application",
  // },
  // {
  //   appId: "thoughts",
  //   name: "Thoughts",
  //   url: "https://thoughts.garage.app",
  //   icon: "",
  //   description: "Thoughts application",
  // },
  {
    appId: "network-mail",
    name: "Network Mail",
    icon: "",
    description: "Workspace email — templates, campaigns, reports & settings",
    renderType: "inline" as const,
  },
  {
    appId: "flowboards",
    name: "Flowboards",
    url: "https://flowboards.garage.app/",
    icon: "",
    description: "Flowboards application",
  },
  // {
  //   appId: "startupbrokers",
  //   name: "Startup Brokers",
  //   url: "https://app.startupbrokers.com",
  //   icon: "",
  //   description: "Startup Brokers application",
  // },

  // {
  //   appId: "program-manager",
  //   name: "Program Manager",
  //   url: "https://launch.garage.app",
  //   icon: "",
  //   description: "Launch Garage application",
  // },
  // {
  //   appId: "indian-investors",
  //   name: "Indian Investors",
  //   url: "https://app.indianinvestor.com/",
  //   icon: "",
  //   description: "Connect with India's top investors & VCs.",
  // },
  // {
  //   appId: "whatsapp",
  //   name: "WhatsApp",
  //   url: "https://web.whatsapp.com/",
  //   icon: "",
  //   description: "Chat on WhatsApp from your desktop.",
  // },
  // {
  //   appId: "gmail",
  //   name: "Gmail",
  //   url: "https://mail.google.com/",
  //   icon: "",
  //   description: "Access your Gmail account and manage your emails.",
  // },
];

type MyApp = { id: string };
type Member = {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
  role: "founder" | "user";
};

export default function MarketplacePage({
  onOpenApp,
}: {
  onOpenApp?: (appId: string) => void;
}) {
  const meId = getUserIdFromToken() || "";
  const [my, setMy] = useState<MyApp[]>([]);
  const mySet = useMemo(() => new Set(my.map((a) => a.id)), [my]);

  const [members, setMembers] = useState<Member[]>([]);
  const me = useMemo(
    () => members.find((m) => (m._id ?? m.id) === meId),
    [members, meId]
  );
  const isAdmin = me?.role === "founder";

  // modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignApp, setAssignApp] = useState<(typeof CATALOG)[number] | null>(
    null
  );
  const [assignees, setAssignees] = useState<string[]>([]); // userIds selected
  const [loadingAssignees, setLoadingAssignees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");

  // load my apps (for current user status)
  async function loadMy() {
    const orgId = localStorage.getItem("garage_org_id");
    const res = await api<{ apps: { id: string }[] }>(
      `/apps/my?orgId=${orgId}`,
      {},
      getToken()!
    );
    setMy(res.apps || []);
  }

  // load members (to compute isAdmin + for modal list)
  async function loadMembers() {
    const orgId = localStorage.getItem("garage_org_id");

    const res = await api<{ members: Member[] }>(
      "/team/list?orgId=" + orgId,
      {},
      getToken()!
    );

    setMembers(res.members || []);
  }

  useEffect(() => {
    loadMy();
    loadMembers();
  }, []);

  // open modal for a specific app
  const openAssign = async (app: (typeof CATALOG)[number]) => {
    if (!isAdmin) return;
    setAssignApp(app);
    setAssignOpen(true);
    setLoadingAssignees(true);
    try {
      // query who has it already
      const orgId = localStorage.getItem("garage_org_id");
      const r = await api<{ assignees: string[] }>(
        `/apps/admin/assignees?appId=${encodeURIComponent(
          app.appId
        )}&orgId=${orgId}`,
        {},
        getToken()!
      ).catch(() => ({ assignees: [] as string[] } as any));
      console.log("Assignees from backend:", r.assignees);
      console.log(
        "Members:",
        members.map((m) => ({
          id: m._id ?? m.id,
          name: m.name,
          email: m.email,
        }))
      );
      setAssignees(r.assignees || []);
    } finally {
      setLoadingAssignees(false);
    }
  };

  const toggleUser = (uid: string, checked: boolean) => {
    setAssignees((prev) => {
      const set = new Set(prev);
      if (checked) set.add(uid);
      else set.delete(uid);
      return Array.from(set);
    });
  };

  const filteredMembers = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter(
      (m) =>
        (m.name || "").toLowerCase().includes(t) ||
        (m.email || "").toLowerCase().includes(t)
    );
  }, [q, members]);

  const allFilteredSelected = useMemo(() => {
    const ids = filteredMembers.map((m) => (m._id ?? m.id)!).filter(Boolean);
    return ids.length > 0 && ids.every((id) => assignees.includes(id));
  }, [filteredMembers, assignees]);

  const toggleAllFiltered = (checked: boolean) => {
    setAssignees((prev) => {
      const set = new Set(prev);
      for (const m of filteredMembers) {
        const id = (m._id ?? m.id) as string;
        if (!id) continue;
        if (checked) set.add(id);
        else set.delete(id);
      }
      return Array.from(set);
    });
  };

  const saveAssignment = async () => {
    if (!assignApp) return;
    setSaving(true);
    try {
      const orgId = localStorage.getItem("garage_org_id");
      await api(
        `/apps/admin/assign?orgId=${orgId}`,
        {
          method: "POST",
          body: JSON.stringify({
            appId: assignApp.appId,
            userIds: assignees,
            name: assignApp.name,
            url: assignApp.url,
            icon: assignApp.icon,
            description: assignApp.description,
          }),
        },
        getToken()!
      );
      toast.success("Assignments updated");
      setAssignOpen(false);
      setAssignApp(null);
      // If current user was affected, refresh their own list
      await loadMy();
      window.dispatchEvent(new CustomEvent("apps:reload"));
    } catch (e: any) {
      toast.error(e?.message || "Failed to assign");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">BackOffice</h1>
          <p className="text-sm text-[#a5a6bf] mt-1">
            {isAdmin
              ? "Assign apps to teammates. Users only see apps assigned to them."
              : "Browse available apps. You’ll see which ones are assigned to you."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATALOG.map((app) => {
          const assignedToMe = mySet.has(app.appId);

          return (
            <div
              key={app.appId}
              className="rounded-xl h-[220px] border border-[#2a2a35] bg-[#0e0e12] p-4 hover:bg-[#111116] transition-colors flex flex-col justify-between"
            >
              {/* header */}
              <div>
                <div className="flex items-center gap-3">
                  <AppIcon
                    name={app.name}
                    url={app.url}
                    size={40}
                    icon={app?.icon || ""}
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{app.name}</div>
                    <Link
                      href={app.url}
                      target="_blank"
                      className="text-xs text-[#9fa0b8] hover:underline truncate"
                    >
                      {app.url}
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-[#c7c7da] mt-3 line-clamp-3">
                  {app.description}
                </p>
              </div>

              {/* footer/actions */}
              <div className="mt-4 flex items-center justify-between gap-2">
                {/* Status pill for users */}
                {!isAdmin && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] border",
                      assignedToMe
                        ? "border-[#3d3d51] text-white"
                        : "border-[#3d3d51] text-[#9fa0b8]"
                    )}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {assignedToMe ? "Assigned" : "Not assigned"}
                  </span>
                )}

                {/* Admin controls */}
                {isAdmin ? (
                  <div className="flex items-center gap-2 ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
                      onClick={() => openAssign(app)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Assign
                    </Button>
                    {onOpenApp ? (
                      <Button
                        size="sm"
                        onClick={() => onOpenApp(app.appId)}
                        className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] border border-brand-2/40 text-brand-foreground"
                      >
                        Open
                      </Button>
                    ) : (
                      <Button
                        asChild
                        size="sm"
                        className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] border border-brand-2/40 text-brand-foreground"
                      >
                        <Link href={`/apps/${app.appId}`}>Open</Link>
                      </Button>
                    )}
                  </div>
                ) : // Non-admin: allow open only if assigned
                  onOpenApp ? (
                    <Button
                      size="sm"
                      disabled={!assignedToMe}
                      onClick={() => assignedToMe && onOpenApp(app.appId)}
                      className={cn(
                        "ml-auto",
                        assignedToMe
                          ? "bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] border border-brand-2/40 text-brand-foreground"
                          : "bg-[#15151b] border border-[#2a2a35] text-[#9fa0b8] cursor-not-allowed"
                      )}
                      title={assignedToMe ? "Open" : "Not assigned"}
                    >
                      Open
                    </Button>
                  ) : (
                    <Button
                      asChild
                      size="sm"
                      disabled={!assignedToMe}
                      className={cn(
                        "ml-auto",
                        assignedToMe
                          ? "bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] border border-brand-2/40 text-brand-foreground"
                          : "bg-[#15151b] border border-[#2a2a35] text-[#9fa0b8] cursor-not-allowed"
                      )}
                      title={assignedToMe ? "Open" : "Not assigned"}
                    >
                      <Link href={assignedToMe ? `/apps/${app.appId}` : "#"}>
                        Open
                      </Link>
                    </Button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ASSIGN MODAL (ADMIN) */}
      <Dialog
        open={assignOpen}
        onOpenChange={(v) => {
          setAssignOpen(v);
          if (!v) setAssignApp(null);
        }}
      >
        <DialogContent className="max-w-3xl border border-[#2a2a35] bg-[#0e0e12]/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-white">
              Assign {assignApp?.name} to users
            </DialogTitle>
            <p className="text-sm text-[#9fa0b8]">
              Choose teammates who should have access to this app.
            </p>
          </DialogHeader>

          <div className="mt-2 space-y-3">
            {/* Search & Select all */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9fa0b8]" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search by name or email"
                  className="pl-9 bg-transparent border border-[#2a2a35] text-white placeholder:text-[#9fa0b8]/70"
                />
              </div>

              <Button
                variant="outline"
                onClick={() => toggleAllFiltered(!allFilteredSelected)}
                className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
                disabled={loadingAssignees}
              >
                {allFilteredSelected ? "Unselect all" : "Select all"}
              </Button>
            </div>

            {/* List */}
            <div className="max-h-[420px] overflow-y-auto rounded-md border border-[#2a2a35] divide-y divide-[#2a2a35]">
              {loadingAssignees ? (
                <div className="p-6 text-sm text-[#9fa0b8]">Loading…</div>
              ) : filteredMembers.length ? (
                filteredMembers
                  .filter((item) => item?.role !== "founder")
                  .map((m) => {
                    const id = (m._id ?? m.id) as string;
                    const checked = assignees.includes(id);
                    return (
                      <label
                        key={id || m.email}
                        className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#15151b]"
                      >
                        <div className="min-w-0">
                          <div className="text-sm truncate">
                            {m.name || m.email}
                          </div>
                          <div className="text-[12px] text-[#9fa0b8] truncate">
                            {m.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-[#9fa0b8]">
                            {m.role}
                          </span>
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleUser(id, !!v)}
                            aria-label={`Assign to ${m.name || m.email}`}
                          />
                        </div>
                      </label>
                    );
                  })
              ) : (
                <div className="p-6 text-sm text-[#9fa0b8]">No users.</div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                className="border-[#3d3d51] text-[#ddd] hover:bg-[#191923]"
                onClick={() => setAssignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={saveAssignment}
                disabled={saving}
                className="bg-brand-2 hover:bg-[color:color-mix(in_srgb,var(--brand-2)_87%,black)] border border-brand-2/40 text-brand-foreground"
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
