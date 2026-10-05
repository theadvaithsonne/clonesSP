"use client";

// Roles & Access — the one dedicated page for everything role-related:
//   • Admins tab — invite an admin, GIVE them a role + per-action access,
//     edit it later, or deactivate them.
//   • Roles tab — define reusable role TEMPLATES (a starting point copied
//     into an admin when assigned; editing a template never re-permissions
//     admins who already hold it).
//
// Both tabs drive the shared AccessGrid, which now expands pages with
// independent write actions (assign agent vs. mark NVC, edit coupon vs.
// activate vs. assign, …) into per-action checkboxes. So a grant reads and
// behaves identically wherever it's set.
//
// Super-admin only, like everything under Permissions: inviting admins and
// defining the roles they can hold are the same trust boundary.

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { garageAdminApi } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Crown,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import AccessGrid from "@/components/garage-admin/AccessGrid";
import InviteAdminDialog from "@/components/garage-admin/InviteAdminDialog";
import EditAdminAccessDialog from "@/components/garage-admin/EditAdminAccessDialog";
import {
  getAdminPageCatalogue,
  getAdminRolesInUse,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
  emptyPermissions,
  countGranted,
  type AdminPageCatalogue,
  type AdminPageLevel,
  type AdminRoleInUse,
} from "@/lib/admin-api/permissions";

interface GarageAdmin {
  id: string;
  email: string;
  name: string;
  role: string;
  isSuperAdmin?: boolean;
  permissions?: Record<string, AdminPageLevel>;
  isActive: boolean;
  lastLoginAt?: string;
}

function readAdminInfo(): { id?: string; role?: string } | null {
  try {
    const raw = localStorage.getItem("garage_admin_info");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

type Tab = "admins" | "roles";

type Editing =
  | { mode: "new" }
  | { mode: "edit"; originalName: string }
  | null;

export default function GarageAdminRolesPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [isSuper, setIsSuper] = useState(false);
  const [meId, setMeId] = useState<string | undefined>();
  const [tab, setTab] = useState<Tab>("admins");

  const [catalogue, setCatalogue] = useState<AdminPageCatalogue | null>(null);

  // ── Admins ──────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<GarageAdmin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);

  const loadAdmins = useCallback(() => {
    setAdminsLoading(true);
    garageAdminApi<{ data: GarageAdmin[] }>("/garage-admin/admins", {
      method: "GET",
    })
      .then((r) => setAdmins(r?.data || []))
      .catch((e: any) => toast.error(e?.message || "Couldn't load admins"))
      .finally(() => setAdminsLoading(false));
  }, []);

  const toggleActive = async (admin: GarageAdmin) => {
    try {
      await garageAdminApi(`/garage-admin/admins/${admin.id}/toggle`, {
        method: "PATCH",
      });
      toast.success(`Admin ${admin.isActive ? "deactivated" : "activated"}`);
      loadAdmins();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update admin status");
    }
  };

  // ── Roles ───────────────────────────────────────────────────────────
  const [roles, setRoles] = useState<AdminRoleInUse[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<
    Record<string, AdminPageLevel>
  >({});
  const [saving, setSaving] = useState(false);

  const refreshRoles = useCallback(() => {
    setRolesLoading(true);
    getAdminRolesInUse()
      .then(setRoles)
      .catch(() => toast.error("Couldn't load roles"))
      .finally(() => setRolesLoading(false));
  }, []);

  useEffect(() => {
    const info = readAdminInfo();
    const superOk = info?.role === "garage-super-admin";
    setIsSuper(superOk);
    setMeId(info?.id);
    setChecked(true);
    if (!superOk) return;
    getAdminPageCatalogue()
      .then(setCatalogue)
      .catch(() => toast.error("Couldn't load access options"));
    loadAdmins();
    refreshRoles();
  }, [loadAdmins, refreshRoles]);

  const managed = roles.filter((r) => r.role && r.role !== "garage-admin");

  const openNew = () => {
    if (!catalogue) return;
    setName("");
    setPermissions(emptyPermissions(catalogue.pages));
    setEditing({ mode: "new" });
  };

  const openEdit = (r: AdminRoleInUse) => {
    setName(r.role);
    setPermissions({ ...r.permissions });
    setEditing({ mode: "edit", originalName: r.role });
  };

  const saveRole = async () => {
    const clean = name.trim();
    if (clean.length < 2) {
      toast.error("Give the role a name (2+ characters)");
      return;
    }
    setSaving(true);
    try {
      if (editing?.mode === "new") {
        await createAdminRole(clean, permissions);
        toast.success(`Created "${clean}"`);
      } else if (editing?.mode === "edit") {
        await updateAdminRole(editing.originalName, {
          newName:
            clean.toLowerCase() === editing.originalName.toLowerCase()
              ? undefined
              : clean,
          permissions,
        });
        toast.success(`Saved "${clean}"`);
      }
      setEditing(null);
      refreshRoles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that role");
    } finally {
      setSaving(false);
    }
  };

  const removeRole = async (roleName: string) => {
    if (
      !window.confirm(
        `Delete the role "${roleName}"? Admins who already have it keep their access — it just won't be offered for new invites.`,
      )
    )
      return;
    try {
      await deleteAdminRole(roleName);
      toast.success(`Deleted "${roleName}"`);
      refreshRoles();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Couldn't delete that role");
    }
  };

  if (!checked) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isSuper) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center text-zinc-400">
        <ShieldCheck className="h-8 w-8 text-zinc-600" />
        <p className="text-sm">
          Roles &amp; access can only be managed by a super admin.
        </p>
        <button
          onClick={() => router.push("/garage-admin/organizations")}
          className="text-xs text-[#FBD10D] hover:underline"
        >
          Back to the console
        </button>
      </div>
    );
  }

  const visibleAdmins = admins.filter((a) => a.role !== "garage-super-admin");

  return (
    <div className="mx-auto max-w-3xl">
      {/* Legacy hidden invite trigger — the layout's top-right button clicks
          [data-invite-admin-trigger]. Wired here so an invite refreshes the
          Admins tab. */}
      <InviteAdminDialog onInvited={loadAdmins}>
        <button data-invite-admin-trigger className="hidden" />
      </InviteAdminDialog>

      <div className="mb-5 flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-[#FBD10D]" />
        <h1 className="text-xl font-bold text-white">Roles &amp; Access</h1>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
        {(
          [
            { id: "admins", label: "Admins", icon: Users },
            { id: "roles", label: "Roles", icon: ShieldCheck },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[#FBD10D] text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "admins" ? (
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-400">
              Give an admin a role and the exact sections and writes they can
              reach. Applies on their next request — no re-login needed.
            </p>
            <InviteAdminDialog onInvited={loadAdmins}>
              <Button className="shrink-0 gap-1.5 bg-[#FBD10D] text-black hover:bg-[#e6c00d]">
                <UserPlus className="h-4 w-4" />
                Invite admin
              </Button>
            </InviteAdminDialog>
          </div>

          {adminsLoading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : visibleAdmins.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] py-16 text-center">
              <p className="text-sm text-zinc-400">No delegated admins yet.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {visibleAdmins.map((admin) => (
                <li
                  key={admin.id}
                  className={`flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04] ${
                    admin.isActive ? "" : "opacity-60"
                  }`}
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-zinc-400">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-white">
                        {admin.name || admin.email}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/[0.1] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                        {admin.role === "garage-admin" || !admin.role
                          ? "Admin"
                          : admin.role}
                      </span>
                      {!admin.isActive && (
                        <span className="shrink-0 rounded-full bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">
                      {admin.email} · {countGranted(admin.permissions)} section
                      {countGranted(admin.permissions) === 1 ? "" : "s"}
                    </span>
                  </div>

                  <EditAdminAccessDialog admin={admin} onSaved={loadAdmins}>
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Edit access
                    </button>
                  </EditAdminAccessDialog>

                  {admin.id !== meId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          aria-label={
                            admin.isActive ? "Deactivate" : "Activate"
                          }
                          className="shrink-0 rounded-lg border border-white/[0.08] p-1.5 text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
                        >
                          <ToggleLeft className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="border-white/[0.08] bg-[#0e0e12]/95 text-white backdrop-blur-xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2 text-white">
                            <AlertTriangle className="h-5 w-5 text-red-400" />
                            {admin.isActive ? "Deactivate" : "Activate"} admin
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-zinc-400">
                            {admin.isActive
                              ? `${admin.name || admin.email} will no longer be able to log in.`
                              : `${admin.name || admin.email} will be able to log in again.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void toggleActive(admin)}
                            className="bg-red-600 text-white hover:bg-red-500"
                          >
                            {admin.isActive ? "Deactivate" : "Activate"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm text-zinc-400">
              Reusable access templates. Assign one when inviting an admin.
              Editing a template never changes what admins who already have it
              can reach.
            </p>
            <Button
              onClick={openNew}
              disabled={!catalogue}
              className="shrink-0 gap-1.5 bg-[#FBD10D] text-black hover:bg-[#e6c00d]"
            >
              <Plus className="h-4 w-4" />
              New role
            </Button>
          </div>

          {rolesLoading ? (
            <div className="flex items-center justify-center py-16 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : managed.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.1] py-16 text-center">
              <p className="text-sm text-zinc-400">No roles yet.</p>
              <button
                onClick={openNew}
                disabled={!catalogue}
                className="mt-2 text-sm font-medium text-[#FBD10D] hover:underline disabled:opacity-50"
              >
                Create your first role
              </button>
            </div>
          ) : (
            <ul className="space-y-2">
              {managed.map((r) => {
                const n = (r as { adminCount?: number }).adminCount;
                const grantedN = countGranted(r.permissions);
                return (
                  <li
                    key={r.role}
                    className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]"
                  >
                    <ShieldCheck className="h-5 w-5 shrink-0 text-zinc-500" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold text-white">
                          {r.role}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-400">
                          <Users className="h-2.5 w-2.5" />
                          {typeof n === "number" ? n : 0}
                        </span>
                      </div>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {grantedN
                          ? `${grantedN} section${grantedN > 1 ? "s" : ""} granted`
                          : "No sections granted yet"}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${r.role}`}
                      onClick={() => void removeRole(r.role)}
                      className="shrink-0 rounded-lg p-1.5 text-zinc-400 transition hover:bg-red-500/15 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Role editor */}
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => !v && setEditing(null)}
      >
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden border-white/[0.08] bg-[#131313] p-0 text-zinc-200">
          <DialogHeader className="border-b border-white/[0.06] px-5 py-4">
            <DialogTitle className="text-white">
              {editing?.mode === "edit" ? "Edit role" : "New role"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-5 py-4">
            <div>
              <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-zinc-500">
                Role name
              </label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="NVC, Affiliate Sales Agent, Finance…"
                className="h-10 rounded-lg border-white/[0.1] bg-[#0f0f0f] text-sm"
              />
            </div>

            {catalogue && (
              <AccessGrid
                catalogue={catalogue}
                permissions={permissions}
                onPermissionsChange={setPermissions}
                className="min-h-0 flex-1"
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              className="text-zinc-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={() => void saveRole()}
              disabled={saving || name.trim().length < 2}
              className="gap-1.5 bg-[#FBD10D] text-black hover:bg-[#e6c00d]"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing?.mode === "edit" ? "Save changes" : "Create role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
